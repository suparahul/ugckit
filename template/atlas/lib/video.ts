/**
 * A video post's files, read in place at request time (as the log is), so a
 * file the planning or production session writes shows on the next render:
 *
 *   apps/<slug>/production/video-plans/<video>/
 *     brief.json         video-plan     (the idea is being planned)
 *     plan.draft.json    video-script   (its `revision`)
 *     REVIEW.md          video_plan.py review (the revision and the content digest shown to the user)
 *     ready.json         video_plan.py review / ready --json (what blocks the lock, what blocks production)
 *   pipeline/character/<video>/
 *     plan.json, planning-approval.json   video-lock (the plan gate)
 *     video.json, segments/<nn>-<type>/prompt.txt   character-shots (the per-shot prompts)
 *     final/<video>.mp4, final/delivery.json        character-deliver (after gate C)
 *
 * Nothing here writes. The gates are the slideshow's (idea, plan, final);
 * videoPlanPoint() says where the plan gate comes from. What happens between
 * the lock and the delivered file (the storyboard, the takes, the cut) is read
 * by lib/video-production.ts.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PlanRow, PointState } from "./production.ts";
import type { Production } from "./video-production.ts";
import type { Ready, StagesView, Timeline } from "./video-stages.ts";
import { mediaUrl } from "./media-paths.ts";
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

/** Stage 1's view of brief.json: the idea, the hooks, the user's own choices, the facts, the inputs and who owes them. */
export type BriefSummary = {
  idea: string | null;
  viewerMoment: string | null;
  topic: string | null;
  hooks: { id: string; text: string; note: string | null; selected: boolean }[];
  /** The slots the user filled (status user), and the recipe, the cast and the narrator whatever their source. */
  choices: { slot: string; value: string; status: string | null }[];
  facts: { id: string; text: string; verified: boolean }[];
  screens: { id: string; job: string | null; status: string | null }[];
  assets: { id: string; what: string | null; status: string | null }[];
  /** Founder first. */
  missing: { what: string; owner: string | null; blocks: string | null }[];
  reaction: { post: string | null; handle: string | null; start: number | null; end: number | null; burnedInText: string | null; url: string | null } | null;
  limitations: string[];
};

export type VideoState = {
  /** The resolved video id, or null when no brief and no plan row names one. */
  id: string | null;
  brief: boolean;
  briefSummary: BriefSummary | null;
  /** A brief, plan and delivery written by hand to show a video made outside the pipeline (brief.json manual_display_entry, or no video.json and no approval.json beside a delivered file). */
  manual: boolean;
  draft: { revision: number } | null;
  /** video_plan.py ready, for REVIEW.md's digest: the blocking inputs and the dependencies (stage 2). */
  ready: Ready | null;
  review: { revision: number | null; digest: string | null; text: string } | null;
  /** A real lock: planning-approval.json with the user's words, not a dry run, for plan.json's revision. */
  lock: { revision: number; digest: string; words: string; date: string | null } | null;
  /** The locked plan, as the post page shows it. */
  plan: { lengthS: number | null; caption: string | null; music: string | null; beats: Beat[] } | null;
  /** The delivered file, after gate C. */
  final: { url: string; sha256: string; duration: number | null; delivered: string | null } | null;
  /** After the lock: the storyboard, the segments and their takes, the cut (lib/video-production.ts; postState fills it). */
  production?: Production | null;
  /** The eight stages and the timeline (lib/video-stages.ts; postState fills them). */
  stages?: StagesView;
  timeline?: Timeline;
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

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() && !/^<.*>$/.test(v.trim()) ? v : null);
const KEY_SLOTS = new Set(["recipe_id", "cast_kind", "narrator_ref", "hook_channel", "hook_job"]);

/** Stage 1: the brief in a few lists, from brief.json (video-plan). */
export function briefSummaryOf(b: any): BriefSummary | null {
  if (!b || typeof b !== "object" || b.manual_display_entry) return null;
  const rr = b.reaction_reference;
  const rv = rr ? str(rr.video) ?? str(rr.video_path) : null;
  const owner = (m: any) => (m.owner === "founder" ? 0 : 1);
  return {
    idea: str(b.idea), viewerMoment: str(b.viewer_moment), topic: str(b.topic),
    hooks: (b.hook_alternatives ?? []).map((h: any) => ({ id: String(h.id ?? ""), text: String(h.text ?? ""), note: str(h.note), selected: h.id === b.selected_hook })),
    choices: (b.choices ?? []).filter((c: any) => c && (c.status === "user" || KEY_SLOTS.has(c.slot))).map((c: any) => ({ slot: String(c.slot), value: typeof c.value === "string" ? c.value : JSON.stringify(c.value), status: c.status ?? null })),
    facts: (b.facts ?? []).map((f: any) => ({ id: String(f.id ?? ""), text: String(f.text ?? f.claim ?? ""), verified: !!f.verified })),
    screens: (b.screens_needed ?? []).map((s: any) => ({ id: String(s.screen_id ?? s.id ?? ""), job: str(s.job), status: str(s.status) })),
    assets: (b.assets_needed ?? []).map((a: any) => ({ id: String(a.id ?? ""), what: str(a.what), status: str(a.status) ?? (a.path ? "present" : "missing") })),
    missing: [...(b.missing_inputs ?? [])].sort((x, y) => owner(x) - owner(y)).map((m: any) => ({ what: String(m.what ?? m.id ?? ""), owner: m.owner ?? null, blocks: m.blocks ?? null })),
    reaction: rr ? { post: rr.post_id ?? null, handle: rr.handle ?? null, start: num(rr.start_s), end: num(rr.end_s), burnedInText: str(rr.burned_in_text), url: rv ? mediaUrl(rv) : null } : null,
    limitations: (b.limitations ?? []).map(String),
  };
}

/** ready.json beside REVIEW.md: current while its digest is REVIEW.md's. */
function readyOf(pd: string, digest: string | null): Ready | null {
  const j = readJson(join(pd, "ready.json"));
  if (!j) return null;
  return { revision: num(j.revision), digest: typeof j.digest === "string" ? j.digest : null, blocking: (j.blocking ?? []).map(String), dependencies: (j.dependencies ?? []).map(String), current: !!digest && j.digest === digest };
}

export function readVideo(row: Pick<PlanRow, "slug" | "key" | "handle" | "date"> & { videoId?: string | null }): VideoState {
  const id = videoIdOf(row);
  const empty: VideoState = { id, brief: false, briefSummary: null, manual: false, draft: null, ready: null, review: null, lock: null, plan: null, final: null };
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
  const file = finalFileOf(id);
  const final =
    delivery && typeof delivery.sha256 === "string" && existsSync(file)
      ? { url: `/media/pipeline/character/${id}/final/${id}.mp4?v=${delivery.sha256.slice(0, 12)}`, sha256: delivery.sha256, duration: num(delivery.duration_s), delivered: delivery.delivered ?? null }
      : null;
  const briefJ = readJson(join(pd, "brief.json"));
  const head = reviewT ? reviewHead(reviewT) : null;
  /* A video made outside the pipeline and entered by hand: a delivered file with no video.json and no approval.json. */
  const manual = !!briefJ?.manual_display_entry || (!!final && !existsSync(join(vd, "video.json")) && !existsSync(join(vd, "approval.json")));
  return {
    id,
    brief: !!briefJ,
    briefSummary: briefSummaryOf(briefJ),
    manual,
    draft: draftJ ? { revision: Number(draftJ.revision ?? 0) } : null,
    ready: readyOf(pd, head?.digest ?? null),
    review: reviewT ? { ...head!, text: reviewT } : null,
    lock,
    plan: lock && planJ ? { lengthS: num(planJ.format?.length_s), caption: planJ.publishing_note?.caption ?? null, music: planJ.publishing_note?.music_note ?? null, beats: beatsOf(planJ, segmentsOf(vd)) } : null,
    final,
  };
}

/** The plan the timeline reads: the locked plan.json, else the current draft (plan.draft.json); read here, never kept in the state the client receives. */
export function timelinePlan(v: VideoState, slug: string): { plan: any; source: "plan.json" | "plan.draft.json" | null } {
  if (!v.id) return { plan: null, source: null };
  if (v.lock) {
    const j = readJson(join(CHARACTER_DIR, v.id, "plan.json"));
    if (j) return { plan: j, source: "plan.json" };
  }
  const d = readJson(join(plansDir(slug), v.id, "plan.draft.json"));
  return d ? { plan: d, source: "plan.draft.json" } : { plan: null, source: null };
}

/** The delivered file of a video: pipeline/character/<id>/final/<id>.mp4. */
export const finalFileOf = (id: string): string => join(CHARACTER_DIR, id, "final", `${id}.mp4`);

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
