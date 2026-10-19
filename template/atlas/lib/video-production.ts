/**
 * A locked video's production, read in place at request time, so a keyframe, a take or
 * a cut the agent writes shows on the next render. The stages of the character pipeline
 * after the plan lock, and the user's decision at each one:
 *
 *   storyboard   keyframes/<nn>-<type>.png, keyframes/storyboard.jpg (character-shots)
 *                gate A: approval.json gate_a_storyboard (with keyframes_sha256), and the
 *                computed cost of every first run: the Atlas `storyboard.approve` line is
 *                the user's yes to both
 *   generate     segments/<nn>-<type>/generated/*.mp4 (generate.sh, one run each)
 *   review       gate B: approval.json gate_b_segments; the Atlas `take.approve` and
 *                `take.reject` lines (a reject with `regenerate` is the yes to one more run).
 *                A face-replace take shows its identity gate (generated/qc/identity-*.json).
 *   composite    a phone segment's composite/*.mp4 (composite.sh) and its gates; the Atlas
 *                `composite.approve` line
 *   assemble     assembly/assembly.json and its file (assemble.sh); gate C:
 *                approval.json gate_c_final; the Atlas `cut.approve` and `cut.sendback` lines
 *   deliver      final/<video>.mp4 and final/delivery.json (deliver.sh): lib/video.ts
 *
 * The Atlas writes only log lines. The agent records each one in approval.json with
 * scripts/character/review.py ... --from-atlas, which checks the file's sha256 against
 * the line and runs every gate (the identity gate too). A line is "clicked" until then.
 * Nothing here writes, generates or spends.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { mediaUrl } from "./media-paths.ts";
import type { Event } from "./production.ts";
import { APPS_DIR, CHARACTER_DIR, ROOT } from "./root.ts";

/* The segment types generate.sh makes; the phone plates among them get the app at P4. */
const GENERATED = ["T", "O", "G", "S", "H", "F", "B", "X"];
const PHONE = ["O", "G", "S", "H", "F"];
/* review.py's required checks: a silent reaction (the written route), and a face-replace reaction. */
export const REACTION_CHECKS = ["identity", "hands", "silent", "performance"];
export const FACE_REPLACE_CHECKS = ["identity", "no_source_identity", "silent"];
export const GUIDED_CHECKS = ["follows_reference"];

export type Identity = { result: string; why: string | null; character: number | null; reference: number | null; closer: number | null };
export type Take = { file: string; url: string; sha256: string; at: string; identity: Identity | null; sheet: string | null };
export type Decision = { decision: string; file: string | null; words: string | null; date: string | null; failure: string | null; fix: string | null };
/** The user's last Atlas line for a stage, and whether the agent has recorded it yet. */
export type Click = { kind: string; at: string; note: string | null; file: string | null; sha256: string | null; recorded: boolean; current: boolean };

/** A supplied file that gate B approves by its checksum, permission and range (review.py source). */
export type Source = { id: string; kind: string | null; origin: string | null; file: string | null; url: string | null; sha256: string | null; range: number[] | null; still: number | null; segments: string[]; decision: Decision | null; approved: boolean; click: Click | null };
/** A narrator's take that gate B approves after the natural-voice check (review.py narration). */
export type Narration = { take: string; file: string | null; url: string | null; sha256: string | null; narrator: string | null; lines: string[]; words: string[]; segments: string[]; decision: Decision | null; approved: boolean; click: Click | null };
/** A clip that continues from the one before it: that clip's last frame, and how far the take's first frame is from it. */
export type Seam = { from: string; lastFrame: string | null; seedDiff: number | null; verified: boolean };

export type Segment = {
  name: string;
  type: string;
  beatIds: string[];
  /** The plan's time of the beats the segment carries. */
  start: number | null;
  end: number | null;
  /** The shot: its framing kind, its planned length, the words it speaks, how many references it carries, its fixed subjects. */
  framing: string | null;
  seconds: number | null;
  lines: string[];
  refCount: number;
  subjects: string[];
  expressionBeats: number;
  /** A face-replace X's pose picture (source/first-frame.png); an H segment's end still. */
  poseFrame: string | null;
  endStill: string | null;
  /** The plate's insertion gates (generated/qc/gates.json), the flat-on check first. */
  plateGates: string | null;
  seam: Seam | null;
  /** C: the supplied file and its range. */
  asset: { id: string; file: string | null; url: string | null; range: number[] | null; still: number | null } | null;
  /** M: each panel, its place in the frame and its source. */
  panels: { id: string; rect: number[] | null; what: string; url: string | null }[];
  /** R, P: the screen recording and its hero string. */
  screen: { id: string; url: string | null; hero: string | null } | null;
  /** Another approved segment's voice, a supplied sound or a narration take under this one (video.json audio_from). */
  audioFrom: string | null;
  /** Made by generate.sh (a take, gate B); else built at assembly (C, M, R, P). */
  generated: boolean;
  /** A segment of another video (video.json project): shown, decided there. */
  sharedFrom: string | null;
  keyframe: { url: string; sha256: string; at: string } | null;
  /** Starts from a keyframe approved at gate A: every generated segment but a face-replace X on a route with no first frame (replace, guided: the clip leads). */
  needsKeyframe: boolean;
  prompt: boolean;
  /** An X shot in face-replace mode: its route (models.json face_replace.routes), and the reference clip. */
  faceReplace: { route: string; model: string | null; reference: string | null } | null;
  continues: string | null;
  /** generate.sh's computed figure for one run, from models.json and the shot; null when unknown. */
  cost: number | null;
  takes: Take[];
  gateB: Decision | null;
  /** The approved take, when its file is on disk. */
  approved: Take | null;
  checks: string[];
  click: Click | null;
  phone: boolean;
  composite: { file: string; url: string; sha256: string; gates: string | null; failed: string[]; sheets: { label: string; url: string }[] } | null;
  compositeApproved: boolean;
  compositeClick: Click | null;
};

export type Production = {
  storyboard: { url: string } | null;
  segments: Segment[];
  /** Every generated segment's keyframe, by its sha256 (the shape of gate_a_storyboard.keyframes_sha256). */
  keyframes: Record<string, string>;
  /** The computed cost of one run of every generated segment that has none approved yet. */
  cost: number | null;
  /** The computed spend so far (pipeline/character/state.json videos.<id>.costs). */
  spent: number;
  gateA: { decision: string | null; words: string | null; date: string | null; current: boolean } | null;
  gateAClick: Click | null;
  assembly: { file: string; url: string; sha256: string; grain: string | null; duration: number | null; failed: string[]; stale: boolean; sheet: string | null; checks: { name: string; result: string; detail: string | null }[]; times: Record<string, (number | null)[]> } | null;
  gateC: (Decision & { current: boolean }) | null;
  cutClick: (Click & { segment?: string | null }) | null;
  /** The supplied files and narration takes gate B approves (the lists of review.py needs()). */
  sources: Source[];
  narration: Narration[];
  /** pipeline/character/state.json for this video: running and failed with their notes, never a gate. */
  state: { stages: Record<string, { status: string; note: string | null }>; notes: string[] } | null;
  /** What does not hold in the files yet: state.json behind approval.json, a hand-written approval. */
  notes: string[];
};

const readJson = (p: string): any => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const shaCache = new Map<string, { mtime: number; size: number; sha: string }>();
/* A file's sha256, cached on its mtime and size: a take is written once, then only read. */
export function sha256Of(p: string): string | null {
  try {
    const st = statSync(p);
    const hit = shaCache.get(p);
    if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.sha;
    const sha = createHash("sha256").update(readFileSync(p)).digest("hex");
    shaCache.set(p, { mtime: st.mtimeMs, size: st.size, sha });
    return sha;
  } catch {
    return null;
  }
}
const mtimeIso = (p: string): string => {
  try { return statSync(p).mtime.toISOString(); } catch { return ""; }
};
const media = (id: string, rel: string, sha: string | null) => `/media/pipeline/character/${id}/${rel}${sha ? `?v=${sha.slice(0, 12)}` : ""}`;
const segName = (s: any) => `${String(Number(s.n)).padStart(2, "0")}-${String(s.type ?? "").toLowerCase()}`;

function identityOf(sd: string, file: string): Identity | null {
  const stem = file.replace(/^.*\//, "").replace(/\.mp4$/, "");
  const j = readJson(join(sd, "generated", "qc", `identity-${stem}.json`));
  if (!j || typeof j.result !== "string") return null;
  return { result: j.result, why: j.why ?? null, character: num(j.median_character), reference: num(j.median_reference), closer: num(j.closer_to_character) };
}

/* qc.py writes one contact sheet per run, of the take it measured: the newest one. */
const sheetOf = (id: string, name: string, sd: string): string | null =>
  existsSync(join(sd, "generated", "qc", "sheet_01.png")) ? media(id, `segments/${name}/generated/qc/sheet_01.png`, String(statSafe(join(sd, "generated", "qc", "sheet_01.png")))) : null;
const statSafe = (p: string): number => {
  try { return statSync(p).mtimeMs; } catch { return 0; }
};

function takesOf(id: string, name: string, sd: string): Take[] {
  const gd = join(sd, "generated");
  let files: string[] = [];
  try { files = readdirSync(gd).filter((f) => f.endsWith(".mp4") && !f.startsWith(".")); } catch { return []; }
  return files
    .map((f) => {
      const abs = join(gd, f);
      const sha = sha256Of(abs) ?? "";
      return { file: `generated/${f}`, url: media(id, `segments/${name}/generated/${f}`, sha), sha256: sha, at: mtimeIso(abs), identity: identityOf(sd, f), sheet: null as string | null };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .map((t, i) => (i === 0 ? { ...t, sheet: sheetOf(id, name, sd) } : t));
}

/** The last Atlas line of `kinds` for this video (and segment), by the user (no actor). */
export function lastClick(log: Pick<Event, "kind" | "at" | "note" | "actor" | "data">[], kinds: string[], video: string, segment?: string, key = "segment"): Pick<Event, "kind" | "at" | "note" | "data"> | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!kinds.includes(e.kind) || e.actor) continue;
    const d = (e.data ?? {}) as Record<string, unknown>;
    if (d.video !== video || (segment !== undefined && d[key] !== segment)) continue;
    return e;
  }
  return null;
}

const decisionOf = (e: any): Decision | null =>
  e ? { decision: String(e.decision ?? ""), file: e.file ?? null, words: e.words ?? null, date: e.date ?? null, failure: e.failure_class ?? null, fix: e.fix ?? null } : null;

/** The cost of one run of a segment, as generate.sh computes it (list price x seconds, or x source frames). */
export function runCost(spec: any, state: any, shot: any, type: string, ref: any): { cost: number | null; route: string | null; model: string | null } {
  const fx = type === "X" && shot?.face_replace && typeof shot.face_replace === "object" && Object.keys(shot.face_replace).length ? shot.face_replace : null;
  if (fx && ref && ref.generation_input === "face_replace") {
    const route = fx.route || spec?.face_replace?.default_route || null;
    const rt = spec?.face_replace?.routes?.[route];
    const lim = rt ? spec?.known_model_limits?.[rt.model] : null;
    const clip = (num(ref.end_s) ?? 0) - (num(ref.start_s) ?? 0);
    if (!rt || !lim || clip <= 0) return { cost: null, route, model: rt?.model ?? null };
    if (lim.price_per_frame) return { cost: Math.ceil(Math.round(clip * 30) * lim.price_per_frame * 100 - 1e-9) / 100, route, model: rt.model };
    const dur = rt.length === "exact" ? Math.max(clip, rt.pad_to_s ?? 0) : num(shot?.video?.duration_seconds) ?? 0;
    return { cost: lim.price_per_s ? Math.round(Math.ceil(dur - 1e-6) * lim.price_per_s * 100) / 100 : null, route, model: rt.model };
  }
  const slug = state?.model?.slug ?? spec?.default ?? null;
  const price = num(state?.model?.price_per_s) ?? num(spec?.known_model_limits?.[slug]?.price_per_s);
  const dur = num(state?.model?.duration_s) ?? num(shot?.video?.duration_seconds);
  return { cost: price !== null && dur !== null ? Math.round(price * dur * 100) / 100 : null, route: null, model: slug };
}

/** The checks review.py requires before it approves a take of this segment. */
export function checksOf(type: string, route: string | null, faceReplace: boolean): string[] {
  if (type !== "X") return [];
  if (!faceReplace) return REACTION_CHECKS;
  return route === "guided" ? [...FACE_REPLACE_CHECKS, ...GUIDED_CHECKS] : FACE_REPLACE_CHECKS;
}

const AUDIO = [".wav", ".mp3", ".m4a"];
const clickOf = (c: Pick<Event, "kind" | "at" | "note" | "data"> | null, recorded: boolean, current: boolean): Click | null => {
  if (!c) return null;
  const d = (c.data ?? {}) as Record<string, any>;
  return { kind: c.kind, at: c.at, note: c.note ?? null, file: d.file ?? null, sha256: d.sha256 ?? null, recorded, current };
};
const recordedAt = (row: any, at: string) => !!row && (row.atlas_line_at === at || String(row.date ?? "") >= at.slice(0, 10));

/**
 * The production of a locked video. `lockDigest` is planning-approval.json's
 * content_sha256: an assembly made from another revision is stale.
 */
export function readProduction(id: string, log: Pick<Event, "kind" | "at" | "note" | "actor" | "data">[], lockDigest: string | null): Production {
  const vd = join(CHARACTER_DIR, id);
  const v = readJson(join(vd, "video.json"));
  const plan = readJson(join(vd, "plan.json"));
  const ap = readJson(join(vd, "approval.json")) ?? {};
  const spec = readJson(join(ROOT, "scripts", "character", "models.json"));
  const st = readJson(join(CHARACTER_DIR, "state.json"));
  const caps = readJson(join(ROOT, "scripts", "character", "capabilities.json")) ?? {};
  const refs = new Map<string, any>((plan?.reaction_refs ?? []).map((r: any) => [r.id, r]));
  const assets = new Map<string, any>((plan?.assets ?? []).map((a: any) => [a.id, a]));
  const beats = new Map<string, any>((plan?.beats ?? []).map((b: any) => [String(b.id), b]));
  const lines = new Map<string, any>((plan?.script ?? []).map((l: any) => [l.id, l]));
  const screensJ = plan?.app ? readJson(join(APPS_DIR, String(plan.app), "screens", "screens.json")) : null;
  const screens = new Map<string, any>((screensJ?.screens ?? []).map((r: any) => [r.id, r]));
  const screenUrl = (sid: string) => {
    const r = screens.get(sid);
    return r?.file ? mediaUrl(`apps/${plan.app}/screens/${r.file}`) : null;
  };
  const rows: any[] = ap.gate_b_segments ?? [];
  const lastRow = (project: string) => [...rows].reverse().find((e) => e.project === project) ?? null;
  const allSegs: any[] = (v?.segments ?? []).filter((s: any) => s?.type);
  const nameOf = new Map<any, string>(allSegs.map((s) => [s, segName(s)]));

  const segments: Segment[] = allSegs.map((s: any) => {
    const name = nameOf.get(s)!;
    const type = String(s.type).toUpperCase();
    const project = typeof s.project === "string" ? s.project : `${id}.${name}`;
    const sharedFrom = project.startsWith(`${id}.`) ? null : project;
    const sd = join(vd, "segments", name);
    const shot = readJson(join(vd, "shots", `${name}.json`));
    const generated = GENERATED.includes(type);
    const kfAbs = join(vd, "keyframes", `${name}.png`);
    const kfSha = generated && existsSync(kfAbs) ? sha256Of(kfAbs) : null;
    const rxRef = refs.get(shot?.face_replace?.ref_id ?? shot?.reaction?.ref_id);
    const { cost, route, model } = generated ? runCost(spec, st, shot, type, rxRef) : { cost: null, route: null, model: null };
    const needsKeyframe = generated && !(route && spec?.face_replace?.routes?.[route]?.first_frame !== "keyframe");
    const fr = type === "X" && rxRef?.generation_input === "face_replace" && route ? { route, model, reference: existsSync(join(sd, "source", "reference.mp4")) ? media(id, `segments/${name}/source/reference.mp4`, sha256Of(join(sd, "source", "reference.mp4"))) : null } : null;
    const takes = generated && !sharedFrom ? takesOf(id, name, sd) : [];
    const row = lastRow(project);
    const gateB = decisionOf(row);
    const approved = row?.decision === "approve" ? takes.find((t) => t.file === row.file) ?? null : null;
    const tc = sharedFrom ? null : lastClick(log, ["take.approve", "take.reject"], id, name);
    const tcData = (tc?.data ?? {}) as Record<string, any>;
    /* Recorded: approval.json has a gate B row for that very file, written after the click. */
    const click = clickOf(tc, !!tc && !!row && row.file === tcData.file && recordedAt(row, tc.at) && (tc.kind === "take.approve") === (row.decision === "approve"),
      takes.some((t) => t.file === tcData.file && t.sha256 === tcData.sha256));
    const phone = PHONE.includes(type) || (type === "C" && !!s.insert);
    let composite: Segment["composite"] = null;
    if (phone && !sharedFrom) {
      const g = readJson(join(sd, "composite", "qc", "gates.json"));
      const f = typeof g?.file === "string" ? g.file.replace(/^.*\//, "") : null;
      const abs = f ? join(sd, "composite", f) : null;
      if (abs && existsSync(abs)) {
        const sha = sha256Of(abs) ?? "";
        const failed = (g.results ?? []).filter((r: any) => r.result !== "PASS").map((r: any) => String(r.gate));
        let pngs: string[] = [];
        try { pngs = readdirSync(join(sd, "composite", "qc")).filter((x) => x.endsWith(".png")).sort(); } catch { /* none */ }
        composite = {
          file: `composite/${f}`, url: media(id, `segments/${name}/composite/${f}`, sha), sha256: sha, gates: failed.length ? `fail: ${failed.join(", ")}` : "pass", failed,
          sheets: pngs.map((x) => ({ label: x.replace(/\.png$/, "").replace(/-/g, " "), url: media(id, `segments/${name}/composite/qc/${x}`, String(statSafe(join(sd, "composite", "qc", x)))) })),
        };
      }
    }
    const cc = phone && !sharedFrom ? lastClick(log, ["composite.approve", "composite.sendback"], id, name) : null;
    const ccData = (cc?.data ?? {}) as Record<string, any>;
    const beatRows = (s.beat_ids ?? []).map((b: unknown) => beats.get(String(b))).filter(Boolean);
    const starts = beatRows.map((b: any) => num(b.start_s)).filter((x: number | null): x is number => x !== null);
    const ends = beatRows.map((b: any) => num(b.end_s)).filter((x: number | null): x is number => x !== null);
    const g = readJson(join(sd, "generated", "qc", "gates.json"));
    /* A continuing segment: the clip before it gives its first frame (continuity.py writes last-frame.png at that clip's gate B). */
    const from = typeof shot?.continuity?.from === "string" ? shot.continuity.from : null;
    const lf = from ? join(vd, "segments", from, "last-frame.png") : null;
    const seed = approved ? num(row?.checks?.seed_diff) : null;
    const a = type === "C" && s.asset_id ? assets.get(s.asset_id) : null;
    return {
      name, type, beatIds: (s.beat_ids ?? []).map(String), generated, sharedFrom,
      start: starts.length ? Math.min(...starts) : null,
      end: ends.length ? Math.max(...ends) : null,
      framing: shot?.framing_kind ?? beatRows[0]?.framing ?? null,
      seconds: num(shot?.video?.trim_to_seconds) ?? num(shot?.video?.duration_seconds) ?? num(s.planned_s),
      lines: beatRows.flatMap((b: any) => (b.lines ?? []).map((l: string) => lines.get(l)).filter(Boolean).map((l: any) => String(l.line ?? ""))),
      refCount: Array.isArray(shot?.references) ? shot.references.length : Array.isArray(shot?.generation_references) ? shot.generation_references.length : 0,
      subjects: (shot?.fixed_subjects_in_shot ?? beatRows.flatMap((b: any) => b.subject_ids ?? [])).map(String),
      expressionBeats: (shot?.reaction?.expression_beats ?? []).length,
      poseFrame: existsSync(join(sd, "source", "first-frame.png")) ? media(id, `segments/${name}/source/first-frame.png`, sha256Of(join(sd, "source", "first-frame.png"))) : null,
      endStill: type === "H" && existsSync(join(vd, "keyframes", `${name.slice(0, 2)}-h-end.png`)) ? media(id, `keyframes/${name.slice(0, 2)}-h-end.png`, sha256Of(join(vd, "keyframes", `${name.slice(0, 2)}-h-end.png`))) : null,
      plateGates: g ? (g.pass ? "pass" : `fail: ${(g.results ?? []).filter((r: any) => r.result !== "PASS").map((r: any) => r.gate).join(", ")}`) : null,
      seam: from ? { from, lastFrame: lf && existsSync(lf) ? media(id, `segments/${from}/last-frame.png`, sha256Of(lf)) : null, seedDiff: seed, verified: !!caps["bridge.continuity.input_verified"] } : null,
      asset: a || (type === "C" && s.asset_id) ? { id: String(s.asset_id), file: a?.path ?? null, url: mediaUrl(a?.path, a?.sha256), range: s.source_range_s ?? a?.trim_s ?? null, still: num(s.still_s) } : null,
      panels: (s.panels ?? []).map((pn: any) => {
        const pa = pn.asset_id ? assets.get(pn.asset_id) : null;
        const pv = typeof pn.project === "string" ? (() => { const r = lastRow(pn.project); const [pid, pseg] = [pn.project.slice(0, pn.project.lastIndexOf(".")), pn.project.slice(pn.project.lastIndexOf(".") + 1)]; return r?.decision === "approve" && r.file ? media(pid, `segments/${pseg}/${r.file}`, r.sha256 ?? null) : null; })() : null;
        return {
          id: String(pn.id ?? ""), rect: Array.isArray(pn.rect) ? pn.rect : null,
          what: pn.asset_id ? `supplied ${pn.asset_id}` : pn.project ? `segment ${pn.project}` : pn.screen_id ? `screen ${pn.screen_id}` : "no source",
          url: pa ? mediaUrl(pa.path, pa.sha256) : pv ?? (pn.screen_id ? screenUrl(pn.screen_id) : null),
        };
      }),
      screen: (type === "R" || type === "P") && s.screen_id ? { id: String(s.screen_id), url: screenUrl(s.screen_id), hero: plan?.hero_strings?.[s.screen_id] ?? screens.get(s.screen_id)?.hero?.text ?? null } : null,
      audioFrom: typeof s.audio_from === "string" ? s.audio_from : null,
      keyframe: kfSha ? { url: media(id, `keyframes/${name}.png`, kfSha), sha256: kfSha, at: mtimeIso(kfAbs) } : null,
      needsKeyframe,
      prompt: existsSync(join(sd, "prompt.txt")),
      faceReplace: fr,
      continues: from,
      cost, takes, gateB, approved,
      checks: checksOf(type, route, !!fr),
      click, phone, composite,
      compositeApproved: !!(row?.composite && composite && row.composite.file === composite.file),
      compositeClick: clickOf(cc, cc?.kind === "composite.sendback" || !!(row?.composite && row.composite.file === ccData.file), !!composite && composite.sha256 === ccData.sha256),
    };
  });

  const keyframes: Record<string, string> = {};
  for (const s of segments) if (s.keyframe && s.needsKeyframe && !s.sharedFrom) keyframes[s.name] = s.keyframe.sha256;
  const own = segments.filter((s) => s.generated && !s.sharedFrom);
  const open = own.filter((s) => !s.approved);
  const cost = open.length && open.every((s) => s.cost !== null) ? Math.round(open.reduce((a, s) => a + (s.cost ?? 0), 0) * 100) / 100 : open.length ? null : 0;
  const stRow = st?.videos?.[id] ?? null;
  const spent = Math.round(((stRow?.costs ?? []) as any[]).reduce((a, c) => a + (num(c?.usd) ?? 0), 0) * 100) / 100;

  /* Gate A is current while every keyframe it approved is still the one on disk. */
  const sameKeyframes = (want: Record<string, unknown> | undefined) =>
    !!want && own.every((s) => !s.keyframe || !s.needsKeyframe || want[s.name] === s.keyframe.sha256);
  const ga = ap.gate_a_storyboard;
  /* An approval written before keyframes_sha256 existed stays current: nothing to compare. */
  const gateA = ga ? { decision: ga.decision ?? null, words: ga.words ?? null, date: ga.date ?? null, current: ga.decision === "approve" && (!ga.keyframes_sha256 || sameKeyframes(ga.keyframes_sha256)) } : null;
  const sc = lastClick(log, ["storyboard.approve", "storyboard.sendback"], id);
  const scData = (sc?.data ?? {}) as Record<string, any>;
  const gateAClick: Click | null = sc ? {
    kind: sc.kind, at: sc.at, note: sc.note ?? null, file: null, sha256: null,
    /* Recorded: gate A says what was clicked (approve, or redo for a send-back), written after the click. */
    recorded: (sc.kind === "storyboard.approve" ? ga?.decision === "approve" : String(ga?.decision ?? "").startsWith("redo"))
      && (ga?.approved_in?.atlas_line_at === sc.at || String(ga?.date ?? "") >= sc.at.slice(0, 10)),
    current: sameKeyframes(scData.keyframes),
  } : null;

  const m = readJson(join(vd, "assembly", "assembly.json"));
  let assembly: Production["assembly"] = null;
  if (m && typeof m.file === "string" && existsSync(join(ROOT, m.file))) {
    const rel = m.file.replace(new RegExp(`^pipeline/character/${id}/`), "");
    const sha = sha256Of(join(ROOT, m.file)) ?? "";
    const failed = Object.entries(m.checks ?? {}).filter(([, c]: [string, any]) => c?.result === "FAIL").map(([k]) => k);
    const grainRel = typeof m.grain_file === "string" && existsSync(join(ROOT, m.grain_file)) ? m.grain_file.replace(new RegExp(`^pipeline/character/${id}/`), "") : null;
    assembly = {
      file: m.file, url: media(id, rel, sha), sha256: sha, grain: grainRel ? media(id, grainRel, sha256Of(join(ROOT, m.grain_file))) : null,
      duration: num(m.duration_s), failed, stale: !!(lockDigest && m.plan_sha256 && m.plan_sha256 !== lockDigest),
      sheet: existsSync(join(vd, "assembly", "contact-sheet.png")) ? media(id, "assembly/contact-sheet.png", String(statSafe(join(vd, "assembly", "contact-sheet.png")))) : null,
      checks: Object.entries(m.checks ?? {}).map(([k, c]: [string, any]) => ({ name: k, result: String(c?.result ?? (typeof c === "string" ? c : "")), detail: typeof c?.detail === "string" ? c.detail : typeof c?.why === "string" ? c.why : null })),
      times: Object.fromEntries(((m.segments ?? []) as any[]).filter((x) => x && typeof x.name === "string").map((x) => [x.name, [num(x.start_s), num(x.end_s)]])),
    };
  }
  const gc = ap.gate_c_final;
  const gateC = gc?.decision ? { ...decisionOf(gc)!, current: !!assembly && gc.file === assembly.file && (gc.sha256 ? gc.sha256 === assembly.sha256 : true) } : null;
  const cc = lastClick(log, ["cut.approve", "cut.sendback"], id);
  const ccData = (cc?.data ?? {}) as Record<string, any>;
  const cutClick = clickOf(cc, !!cc && !!gc && gc.file === ccData.file && recordedAt(gc, cc.at) && (cc.kind === "cut.approve") === (gc.decision === "approve"), !!assembly && assembly.sha256 === ccData.sha256);
  if (cutClick && cc) (cutClick as Click & { segment?: string | null }).segment = typeof ccData.segment === "string" ? ccData.segment : null;

  /* Gate B's other items (review.py needs()): the supplied files the segments use, and the narration takes. */
  const srcUse = new Map<string, string[]>();
  const takeUse = new Map<string, string[]>();
  const use = (m_: Map<string, string[]>, k: string, seg: string) => m_.set(k, [...(m_.get(k) ?? []), seg]);
  for (const s of allSegs) {
    const t = String(s.type).toUpperCase();
    const n = nameOf.get(s)!;
    if (t === "C" && s.asset_id) use(srcUse, String(s.asset_id), n);
    for (const pn of s.panels ?? []) if (pn.asset_id) use(srcUse, String(pn.asset_id), n);
    const af = typeof s.audio_from === "string" ? s.audio_from : "";
    if (af.startsWith("asset:")) use(srcUse, af.slice(6), n);
    else if (af.startsWith("narration:")) use(takeUse, af.slice(10), n);
  }
  const lastOf = (list: any[] | undefined, key: string, val: string) => [...(list ?? [])].reverse().find((e) => e?.[key] === val) ?? null;
  const sources: Source[] = [...srcUse.keys()].filter((aid) => assets.get(aid)?.kind !== "screen").sort().map((aid) => {
    const a = assets.get(aid);
    const abs = a?.path ? join(ROOT, a.path) : null;
    const sha = abs && existsSync(abs) ? sha256Of(abs) : null;
    const r = lastOf(ap.gate_b_sources, "asset_id", aid);
    const c = lastClick(log, ["source.approve", "source.reject"], id, aid, "asset_id");
    const cd = (c?.data ?? {}) as Record<string, any>;
    return {
      id: aid, kind: a?.kind ?? null, origin: a?.origin ?? null, file: a?.path ?? null, url: mediaUrl(a?.path, sha), sha256: sha,
      range: Array.isArray(a?.trim_s) ? a.trim_s : null, still: num(a?.still_s), segments: srcUse.get(aid) ?? [],
      decision: r ? { ...decisionOf(r)!, file: r.file ?? null } : null,
      approved: r?.decision === "approve" && r.sha256 === sha,
      click: clickOf(c, !!c && !!r && recordedAt(r, c.at) && (c.kind === "source.approve") === (r.decision === "approve"), !!sha && cd.sha256 === sha),
    };
  });
  const narration: Narration[] = [...takeUse.keys()].sort().map((take) => {
    let file: string | null = null;
    for (const ext of AUDIO) if (existsSync(join(vd, "narration", `${take}${ext}`))) { file = `narration/${take}${ext}`; break; }
    const sha = file ? sha256Of(join(vd, file)) : null;
    const segs = takeUse.get(take) ?? [];
    const bs = allSegs.filter((s) => segs.includes(nameOf.get(s)!)).flatMap((s) => (s.beat_ids ?? []).map((b: unknown) => beats.get(String(b)))).filter((b: any) => b && b.performance === "voiceover");
    const lineIds = [...new Set(bs.flatMap((b: any) => (b.lines ?? []).map(String)))] as string[];
    const r = lastOf(ap.gate_b_narration, "take", take);
    const c = lastClick(log, ["narration.approve", "narration.reject"], id, take, "take");
    const cd = (c?.data ?? {}) as Record<string, any>;
    return {
      take, file, url: file ? media(id, file, sha) : null, sha256: sha,
      narrator: bs.map((b: any) => b.narrator_ref).find(Boolean) ?? plan?.editorial?.narrator_ref ?? null,
      lines: lineIds, words: lineIds.map((l) => String(lines.get(l)?.line ?? "")).filter(Boolean), segments: segs,
      decision: r ? decisionOf(r) : null,
      approved: r?.decision === "approve" && r.sha256 === sha,
      click: clickOf(c, !!c && !!r && recordedAt(r, c.at) && (c.kind === "narration.approve") === (r.decision === "approve"), !!sha && cd.sha256 === sha),
    };
  });

  const stages: Record<string, { status: string; note: string | null }> = {};
  for (const [k, x] of Object.entries(stRow?.stages ?? {})) stages[k] = { status: String((x as any)?.status ?? ""), note: (x as any)?.note ?? null };
  const notes: string[] = [];
  /* state.json never overrides approval.json for a gate; where they disagree the page says so. */
  if (gateA?.decision === "approve" && stages.shots && stages.shots.status !== "done") notes.push(`state.json says shots ${stages.shots.status}; gate A is approved in approval.json. The agent runs: state.py set ${id} shots done`);
  const allB = own.length > 0 && own.every((s) => s.approved) && sources.every((x) => x.approved) && narration.every((x) => x.approved);
  if (allB && stages.review && stages.review.status !== "done") notes.push(`state.json says review ${stages.review.status}${stages.review.note ? ` (${stages.review.note})` : ""}; every gate B item is approved in approval.json. The agent runs: state.py set ${id} review done`);
  for (const s of own) {
    const r = lastRow(`${id}.${s.name}`);
    if (r?.decision === "approve" && !r.atlas_line_at && s.faceReplace && !String(r.checks?.identity_gate ?? "").startsWith("pass")) notes.push(`${s.name}: the approval in approval.json has no identity gate PASS (written by hand, not by review.py)`);
  }

  return {
    storyboard: existsSync(join(vd, "keyframes", "storyboard.jpg")) ? { url: media(id, "keyframes/storyboard.jpg", sha256Of(join(vd, "keyframes", "storyboard.jpg"))) } : null,
    segments, keyframes, cost, spent, gateA, gateAClick, assembly, gateC, cutClick, sources, narration,
    state: stRow ? { stages, notes: (stRow.notes ?? []).map((n: any) => (typeof n === "string" ? n : String(n?.text ?? n?.note ?? ""))).filter(Boolean) } : null,
    notes,
  };
}

export type ProductionStep = { who: "you" | "agent"; text: string; sentence: string };

const usd = (n: number | null) => (n === null ? "an unknown amount" : `$${n.toFixed(2)}`);

/**
 * Where a locked, undelivered video stands, and whose turn it is: the first stage
 * that is not done, in the pipeline's order.
 */
export function productionStep(p: Production): ProductionStep {
  const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
  const you = (text: string, sentence: string): ProductionStep => ({ who: "you", text, sentence });
  const agent = (text: string, sentence: string): ProductionStep => ({ who: "agent", text, sentence });
  /* Storyboard and gate A. No video.json yet: the shots are not written. */
  if (!p.segments.length || (own.length && !p.storyboard && own.some((s) => s.needsKeyframe && !s.keyframe)))
    return agent("The plan is locked. The agent writes the shots and makes the keyframes (character-shots); the storyboard shows here.", "shots being written");
  const gateADone = !own.length || (p.gateA?.decision === "approve" && p.gateA.current);
  if (!gateADone) {
    const c = p.gateAClick;
    if (c?.kind === "storyboard.approve" && c.current)
      return agent("You approved the storyboard. The agent records it (review.py storyboard --from-atlas), then generates each segment.", "storyboard approved: being recorded");
    if (c?.kind === "storyboard.sendback" && c.current)
      return agent("Sent back with your note. The keyframes come back here when they are redone.", `storyboard: sent back — “${c.note ?? ""}”`);
    return you(`Look at the storyboard and the keyframes. Approve them and the first runs (${usd(p.cost)} computed), or send them back with a note.`, "storyboard: waiting for you");
  }
  /* Generate and gate B, segment by segment. */
  for (const s of own) {
    if (s.approved) continue;
    const c = s.click;
    if (c?.current && !c.recorded)
      return agent(`You ${c.kind === "take.approve" ? "approved" : "rejected"} a take of ${s.name}. The agent records it (review.py segment --from-atlas)${c.kind === "take.reject" ? " and generates it again" : ""}.`, `${s.name}: being recorded`);
    /* A take nobody decided yet: not the one gate B recorded, not the one just clicked. */
    const undecided = s.takes.find((t) => t.file !== s.gateB?.file && !(c?.current && c.file === t.file));
    if (undecided)
      return you(`Watch the take of ${s.name}. Approve it, or reject it with what failed.`, `take ${s.name}: waiting for you`);
    return agent(`The agent generates ${s.name} (generate.sh, ${usd(s.cost)} computed)${s.gateB ? " again, after your reject" : ""}.`, `generating ${s.name}`);
  }
  /* The composites of the phone segments. */
  for (const s of own.filter((x) => x.phone)) {
    if (s.compositeApproved) continue;
    const c = s.compositeClick;
    if (c?.current && !c.recorded) return agent(`You approved the composite of ${s.name}. The agent records it (review.py composite --from-atlas).`, `${s.name} composite: being recorded`);
    if (s.composite) return you(`Watch the composite of ${s.name} (the app in the phone). Approve it, or say what is wrong in the decision log.`, `composite ${s.name}: waiting for you`);
    return agent(`The agent puts the app into ${s.name} (composite.sh).`, `compositing ${s.name}`);
  }
  /* Assembly and gate C. */
  if (!p.assembly || p.assembly.stale) return agent(p.assembly?.stale ? "The plan changed after the cut. The agent assembles again (assemble.sh)." : "Every segment is approved. The agent assembles the video (assemble.sh).", "assembling");
  if (p.gateC?.decision === "approve" && p.gateC.current) return agent("You approved the cut. The agent delivers it (deliver.sh); it shows here for the posting approval.", "cut approved: being delivered");
  const c = p.cutClick;
  if (c?.current && !c.recorded)
    return agent(c.kind === "cut.approve" ? "You approved the cut. The agent records gate C (review.py final --from-atlas) and delivers it (deliver.sh)." : "Sent back with your note. The agent fixes the cut.", c.kind === "cut.approve" ? "cut approved: being recorded" : `cut: sent back — “${c.note ?? ""}”`);
  if (p.gateC && p.gateC.current && p.gateC.decision !== "approve") return agent("The cut was sent back. The agent fixes it and assembles again.", "cut: sent back");
  return you("Watch the cut. Approve it for delivery, or send it back with a note.", "cut: waiting for you");
}
