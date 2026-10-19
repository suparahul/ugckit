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

import type { Event } from "./production.ts";
import { CHARACTER_DIR, ROOT } from "./root.ts";

/* The segment types generate.sh makes; the phone plates among them get the app at P4. */
const GENERATED = ["T", "O", "G", "S", "H", "F", "B", "X"];
const PHONE = ["O", "G", "S", "H", "F"];
/* review.py's required checks: a silent reaction (the written route), and a face-replace reaction. */
export const REACTION_CHECKS = ["identity", "hands", "silent", "performance"];
export const FACE_REPLACE_CHECKS = ["identity", "no_source_identity", "silent"];
export const GUIDED_CHECKS = ["follows_reference"];

export type Identity = { result: string; why: string | null; character: number | null; reference: number | null; closer: number | null };
export type Take = { file: string; url: string; sha256: string; at: string; identity: Identity | null };
export type Decision = { decision: string; file: string | null; words: string | null; date: string | null; failure: string | null; fix: string | null };
/** The user's last Atlas line for a stage, and whether the agent has recorded it yet. */
export type Click = { kind: string; at: string; note: string | null; file: string | null; sha256: string | null; recorded: boolean; current: boolean };

export type Segment = {
  name: string;
  type: string;
  beatIds: string[];
  /** Made by generate.sh (a take, gate B); else built at assembly (C, M, R, P). */
  generated: boolean;
  /** A segment of another video (video.json project): shown, decided there. */
  sharedFrom: string | null;
  keyframe: { url: string; sha256: string } | null;
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
  composite: { file: string; url: string; sha256: string; gates: string | null; failed: string[] } | null;
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
  assembly: { file: string; url: string; sha256: string; grain: string | null; duration: number | null; failed: string[]; stale: boolean } | null;
  gateC: (Decision & { current: boolean }) | null;
  cutClick: Click | null;
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

function takesOf(id: string, name: string, sd: string): Take[] {
  const gd = join(sd, "generated");
  let files: string[] = [];
  try { files = readdirSync(gd).filter((f) => f.endsWith(".mp4") && !f.startsWith(".")); } catch { return []; }
  return files
    .map((f) => {
      const abs = join(gd, f);
      const sha = sha256Of(abs) ?? "";
      return { file: `generated/${f}`, url: media(id, `segments/${name}/generated/${f}`, sha), sha256: sha, at: mtimeIso(abs), identity: identityOf(sd, f) };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** The last Atlas line of `kinds` for this video (and segment), by the user (no actor). */
export function lastClick(log: Pick<Event, "kind" | "at" | "note" | "actor" | "data">[], kinds: string[], video: string, segment?: string): Pick<Event, "kind" | "at" | "note" | "data"> | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!kinds.includes(e.kind) || e.actor) continue;
    const d = (e.data ?? {}) as Record<string, unknown>;
    if (d.video !== video || (segment !== undefined && d.segment !== segment)) continue;
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
  const refs = new Map<string, any>((plan?.reaction_refs ?? []).map((r: any) => [r.id, r]));
  const rows: any[] = ap.gate_b_segments ?? [];
  const lastRow = (project: string) => [...rows].reverse().find((e) => e.project === project) ?? null;

  const segments: Segment[] = (v?.segments ?? []).filter((s: any) => s?.type).map((s: any) => {
    const name = segName(s);
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
    const click: Click | null = tc ? {
      kind: tc.kind, at: tc.at, note: tc.note ?? null, file: tcData.file ?? null, sha256: tcData.sha256 ?? null,
      /* Recorded: approval.json has a gate B row for that very file, written after the click. */
      recorded: !!row && row.file === tcData.file && (row.atlas_line_at === tc.at || String(row.date ?? "") >= tc.at.slice(0, 10)) && (tc.kind === "take.approve") === (row.decision === "approve"),
      current: takes.some((t) => t.file === tcData.file && t.sha256 === tcData.sha256),
    } : null;
    const phone = PHONE.includes(type) || (type === "C" && !!s.insert);
    let composite: Segment["composite"] = null;
    if (phone && !sharedFrom) {
      const g = readJson(join(sd, "composite", "qc", "gates.json"));
      const f = typeof g?.file === "string" ? g.file.replace(/^.*\//, "") : null;
      const abs = f ? join(sd, "composite", f) : null;
      if (abs && existsSync(abs)) {
        const sha = sha256Of(abs) ?? "";
        const failed = (g.results ?? []).filter((r: any) => r.result !== "PASS").map((r: any) => String(r.gate));
        composite = { file: `composite/${f}`, url: media(id, `segments/${name}/composite/${f}`, sha), sha256: sha, gates: failed.length ? `fail: ${failed.join(", ")}` : "pass", failed };
      }
    }
    const cc = phone && !sharedFrom ? lastClick(log, ["composite.approve"], id, name) : null;
    const ccData = (cc?.data ?? {}) as Record<string, any>;
    return {
      name, type, beatIds: (s.beat_ids ?? []).map(String), generated, sharedFrom,
      keyframe: kfSha ? { url: media(id, `keyframes/${name}.png`, kfSha), sha256: kfSha } : null,
      needsKeyframe,
      prompt: existsSync(join(sd, "prompt.txt")),
      faceReplace: fr,
      continues: typeof shot?.continuity?.from === "string" ? shot.continuity.from : null,
      cost, takes, gateB, approved,
      checks: checksOf(type, route, !!fr),
      click, phone, composite,
      compositeApproved: !!(row?.composite && composite && row.composite.file === composite.file),
      compositeClick: cc ? { kind: cc.kind, at: cc.at, note: cc.note ?? null, file: ccData.file ?? null, sha256: ccData.sha256 ?? null, recorded: !!(row?.composite && row.composite.file === ccData.file), current: !!composite && composite.sha256 === ccData.sha256 } : null,
    };
  });

  const keyframes: Record<string, string> = {};
  for (const s of segments) if (s.keyframe && s.needsKeyframe && !s.sharedFrom) keyframes[s.name] = s.keyframe.sha256;
  const own = segments.filter((s) => s.generated && !s.sharedFrom);
  const open = own.filter((s) => !s.approved);
  const cost = open.length && open.every((s) => s.cost !== null) ? Math.round(open.reduce((a, s) => a + (s.cost ?? 0), 0) * 100) / 100 : open.length ? null : 0;
  const spent = Math.round(((st?.videos?.[id]?.costs ?? []) as any[]).reduce((a, c) => a + (num(c?.usd) ?? 0), 0) * 100) / 100;

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
    recorded: sc.kind === "storyboard.approve" && ga?.decision === "approve" && (ga?.approved_in?.atlas_line_at === sc.at || String(ga?.date ?? "") >= sc.at.slice(0, 10)),
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
    };
  }
  const gc = ap.gate_c_final;
  const gateC = gc?.decision ? { ...decisionOf(gc)!, current: !!assembly && gc.file === assembly.file && (gc.sha256 ? gc.sha256 === assembly.sha256 : true) } : null;
  const cc = lastClick(log, ["cut.approve", "cut.sendback"], id);
  const ccData = (cc?.data ?? {}) as Record<string, any>;
  const cutClick: Click | null = cc ? {
    kind: cc.kind, at: cc.at, note: cc.note ?? null, file: ccData.file ?? null, sha256: ccData.sha256 ?? null,
    recorded: !!gc && gc.file === ccData.file && (gc.atlas_line_at === cc.at || String(gc.date ?? "") >= cc.at.slice(0, 10)) && (cc.kind === "cut.approve") === (gc.decision === "approve"),
    current: !!assembly && assembly.sha256 === ccData.sha256,
  } : null;

  return {
    storyboard: existsSync(join(vd, "keyframes", "storyboard.jpg")) ? { url: media(id, "keyframes/storyboard.jpg", sha256Of(join(vd, "keyframes", "storyboard.jpg"))) } : null,
    segments, keyframes, cost, spent, gateA, gateAClick, assembly, gateC, cutClick,
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
