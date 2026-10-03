/**
 * A video post's files, read in place at request time (as the log is), so a
 * file the planning or production session writes shows on the next render:
 *
 *   apps/<slug>/production/video-plans/<video>/
 *     brief.json         video-plan     (the idea is being planned)
 *     plan.draft.json    video-script   (its `revision`)
 *     REVIEW.md          video_plan.py review (the revision and the content digest shown to the user)
 *   pipeline/character/<video>/
 *     plan.json, planning-approval.json   video-lock (the plan gate)
 *     video.json, segments/<nn>-<type>/prompt.txt   character-shots (the per-shot prompts)
 *     final/<video>.mp4, final/delivery.json        character-deliver (after gate C)
 *
 * Nothing here writes, and nothing here reads a storyboard, a gate, a cost or
 * a generation: only what the post page shows. The gates are the slideshow's
 * (idea, plan, final); videoPlanPoint() says where the plan gate comes from.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PlanRow, PointState } from "./production.ts";
import { appDir, CHARACTER_DIR } from "./root.ts";

/** A video id: lowercase, digits and hyphens (video-plan's rule). Anything else never reaches a path. */
export const validVideoId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,120}$/.test(id);

export type Beat = {
  id: string;
  role: string | null;
  start: number;
  end: number;
  /** The spoken lines, in order, with the speaker. */
  said: { speaker: string | null; line: string }[];
  action: string | null;
  performance: string | null;
  /** The plan's overlays that start inside this beat. */
  onScreen: string[];
  /** The production prompts of the segments that carry this beat. */
  prompts: { segment: string; text: string }[];
};

export type VideoState = {
  /** The resolved video id, or null when no brief and no plan row names one. */
  id: string | null;
  brief: boolean;
  draft: { revision: number } | null;
  review: { revision: number | null; digest: string | null; text: string } | null;
  /** A real lock: planning-approval.json with the user's words, not a dry run, for plan.json's revision. */
  lock: { revision: number; digest: string; words: string; date: string | null } | null;
  /** The locked plan, as the post page shows it. */
  plan: { lengthS: number | null; caption: string | null; music: string | null; beats: Beat[] } | null;
  /** The delivered file, after gate C. */
  final: { url: string; sha256: string; duration: number | null; delivered: string | null } | null;
};

const readJson = (p: string): any => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
};
const readText = (p: string): string | null => {
  try { return readFileSync(p, "utf8"); } catch { return null; }
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export const plansDir = (slug: string) => join(appDir(slug), "production", "video-plans");

/**
 * Which video a row is: the id an old plan wrote in Format / variation; else the
 * brief whose strategy_ref.post is the row's key (video-plan writes it); else
 * the one brief for the row's handle and date.
 */
export function videoIdOf(row: Pick<PlanRow, "slug" | "key" | "handle" | "date"> & { videoId?: string | null }): string | null {
  if (validVideoId(row.videoId)) return row.videoId;
  const dir = plansDir(row.slug);
  if (!existsSync(dir)) return null;
  const briefs = readdirSync(dir).filter(validVideoId).map((id) => ({ id, b: readJson(join(dir, id, "brief.json")) })).filter((x) => x.b);
  const byKey = briefs.find((x) => x.b.strategy_ref?.post === row.key);
  if (byKey) return byKey.id;
  const same = briefs.filter((x) => String(x.b.handle ?? "").toLowerCase() === row.handle.toLowerCase() && x.b.date === row.date && !x.b.strategy_ref?.post);
  return same.length === 1 ? same[0].id : null;
}

/** REVIEW.md's revision and content digest, from the lines video_plan.py writes. */
export function reviewHead(text: string): { revision: number | null; digest: string | null } {
  const rev = text.match(/^# Review — .*revision (\d+)/m);
  const dig = text.match(/\*\*Content digest:\*\*\s*`([0-9a-f]{64})`/);
  return { revision: rev ? Number(rev[1]) : null, digest: dig ? dig[1] : null };
}

/** The locked plan's beats, in order: time, the words or the action, the on-screen text, and the per-shot prompts once production wrote them. */
export function beatsOf(plan: any, segments: { name: string; beatIds: string[]; prompt: string | null }[] = []): Beat[] {
  const lines = new Map<string, any>((plan?.script ?? []).map((l: any) => [l.id, l]));
  const overlays: any[] = plan?.overlays ?? [];
  const beats: any[] = [...(plan?.beats ?? [])].sort((a, b) => (num(a.start_s) ?? 0) - (num(b.start_s) ?? 0));
  return beats.map((b) => {
    const start = num(b.start_s) ?? 0;
    const end = num(b.end_s) ?? start;
    return {
      id: String(b.id ?? ""),
      role: b.role ?? null,
      start,
      end,
      said: (b.lines ?? []).map((id: string) => lines.get(id)).filter(Boolean).map((l: any) => ({ speaker: l.speaker ?? null, line: String(l.line ?? "") })),
      action: b.action ?? null,
      performance: b.performance ?? null,
      onScreen: overlays.filter((o) => (num(o.start_s) ?? -1) >= start && (num(o.start_s) ?? -1) < end).map((o) => String(o.text ?? "")),
      prompts: segments.filter((s) => s.prompt && s.beatIds.includes(String(b.id))).map((s) => ({ segment: s.name, text: s.prompt! })),
    };
  });
}

/** The segments production cut, with the prompt of each one that has one (segments/<nn>-<type>/prompt.txt). */
function segmentsOf(vd: string): { name: string; beatIds: string[]; prompt: string | null }[] {
  const v = readJson(join(vd, "video.json"));
  return (v?.segments ?? []).map((s: any) => {
    const name = `${String(Number(s.n)).padStart(2, "0")}-${String(s.type ?? "").toLowerCase()}`;
    return { name, beatIds: (s.beat_ids ?? []).map(String), prompt: /^\d\d-[a-z]$/.test(name) ? readText(join(vd, "segments", name, "prompt.txt"))?.trim() || null : null };
  });
}

export function readVideo(row: Pick<PlanRow, "slug" | "key" | "handle" | "date"> & { videoId?: string | null }): VideoState {
  const id = videoIdOf(row);
  const empty: VideoState = { id, brief: false, draft: null, review: null, lock: null, plan: null, final: null };
  if (!id) return empty;
  const pd = join(plansDir(row.slug), id);
  const vd = join(CHARACTER_DIR, id);
  const draftJ = readJson(join(pd, "plan.draft.json"));
  const reviewT = readText(join(pd, "REVIEW.md"));
  const planJ = readJson(join(vd, "plan.json"));
  const pa = readJson(join(vd, "planning-approval.json"));
  const lock =
    planJ && pa && !pa.dry_run && typeof pa.words === "string" && pa.words.trim() && pa.video_id === id && pa.revision === planJ.revision && typeof pa.content_sha256 === "string"
      ? { revision: Number(pa.revision), digest: pa.content_sha256, words: pa.words, date: pa.date ?? null }
      : null;
  const delivery = readJson(join(vd, "final", "delivery.json"));
  const file = join(vd, "final", `${id}.mp4`);
  const final =
    delivery && typeof delivery.sha256 === "string" && existsSync(file)
      ? { url: `/media/pipeline/character/${id}/final/${id}.mp4?v=${delivery.sha256.slice(0, 12)}`, sha256: delivery.sha256, duration: num(delivery.duration_s), delivered: delivery.delivered ?? null }
      : null;
  return {
    id,
    brief: existsSync(join(pd, "brief.json")),
    draft: draftJ ? { revision: Number(draftJ.revision ?? 0) } : null,
    review: reviewT ? { ...reviewHead(reviewT), text: reviewT } : null,
    lock,
    plan: lock && planJ ? { lengthS: num(planJ.format?.length_s), caption: planJ.publishing_note?.caption ?? null, music: planJ.publishing_note?.music_note ?? null, beats: beatsOf(planJ, segmentsOf(vd)) } : null,
    final,
  };
}

type Line = { at: string; kind: string; note?: string; data?: Record<string, unknown> };

/**
 * The plan gate of a video. A slideshow's plan is its deck on disk; a video's
 * is the user's approval of one exact revision, by digest (video-lock):
 *
 *   approved   a real lock, and no newer draft revision; or an Atlas
 *              `plan.approve` line whose digest is REVIEW.md's (the lock is
 *              then the agent's next step: video-lock --from-atlas)
 *   sentback   a `plan.sendback` line for the current draft revision; a new
 *              revision clears it, as a rewritten deck does
 *   stale      locked, and the draft has a newer revision not yet approved
 *   open       otherwise
 */
export function videoPlanPoint(v: VideoState, log: Line[]): PointState {
  const ev = [...log].reverse().find((e) => e.kind === "plan.approve" || e.kind === "plan.sendback");
  const rev = v.draft?.revision ?? null;
  const atlasYes = ev?.kind === "plan.approve" && !!v.review?.digest && ev.data?.digest === v.review.digest && (rev === null || v.review.revision === rev);
  const back = ev?.kind === "plan.sendback" && rev !== null && Number(ev.data?.revision) === rev;
  if (v.lock && (rev === null || rev <= v.lock.revision)) return { status: "approved", at: v.lock.date, note: null };
  if (atlasYes) return { status: "approved", at: ev!.at, note: null };
  if (back) return { status: "sentback", at: ev!.at, note: ev!.note ?? null };
  if (v.lock) return { status: "stale", at: v.lock.date, note: null };
  return { status: "open", at: null, note: null };
}
