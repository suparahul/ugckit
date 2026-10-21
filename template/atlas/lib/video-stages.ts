/**
 * Every stage of a character video, and what is in it (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md
 * § 3 and § 4.1). Two pure reads of the files lib/video.ts and lib/video-production.ts
 * already read:
 *
 *   videoStages()  the seven stages (plan, shots and keyframes, generate, review takes,
 *                  composite, assemble, deliver), each with one state word and one line, the
 *                  current stage and its "Now" sentence. The plan stage is one: the agent
 *                  writes it, then it waits for the user (approve or send back), then it is
 *                  approved and locked. The files decide the state: a gate is done when
 *                  approval.json (or planning-approval.json) records it for the file on disk
 *                  now. state.json gives running and failed only, and never overrides a gate.
 *   timeline()     one checkpoint per beat of the plan, top to bottom: the time range in
 *                  words, the role, the segment, what the viewer sees, the on-screen text,
 *                  the sound, the app; and one picture that is already on disk (a still, or
 *                  a paused frame of a video on disk), with a label in words. No colour code,
 *                  no frame extracted, nothing generated.
 *
 * Nothing here writes, generates or spends. One stage model and one strip for every video
 * type: the segments and the beats decide what shows, never a type switch.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MOTION_HARD } from "./accept-fail.ts";
import { mediaUrl } from "./media-paths.ts";
import { planBeatsOf, reactionCardOf, type ReactionCard } from "./reactions.ts";
import type { PointState } from "./production.ts";
import { APPS_DIR, ROOT } from "./root.ts";
import type { Production, Segment } from "./video-production.ts";

export type StageState = "not reached" | "agent" | "you" | "clicked" | "sent back" | "blocked" | "stale" | "done" | "n/a";
export type StageKey = "plan" | "keyframes" | "generate" | "review" | "composite" | "cut" | "deliver";
export type Stage = { n: number; key: StageKey; name: string; short: string; state: StageState; words: string };
export type StagesView = { stages: Stage[]; current: number; now: string; who: "you" | "agent" | "done"; notes: string[] };

/** video_plan.py ready, written beside REVIEW.md (ready.json): what stops the lock and what stops production. */
export type Ready = { revision: number | null; digest: string | null; blocking: string[]; dependencies: string[]; current: boolean };

export type StagesInput = {
  id: string | null;
  brief: boolean;
  draft: { revision: number } | null;
  review: { revision: number | null; digest: string | null } | null;
  lock: { revision: number; digest: string } | null;
  planPoint: PointState;
  ready: Ready | null;
  production: Production | null;
  final: { sha256: string } | null;
  finalPoint: PointState;
  /** A delivered file with no video.json and no approval.json: made outside the pipeline (an animated sheet). */
  manual: boolean;
};

const NAMES: [StageKey, string, string][] = [
  ["plan", "Plan (brief, script, approval)", "Plan"],
  ["keyframes", "Shots and keyframes (gate A)", "Keyframes"],
  ["generate", "Generate", "Generate"],
  ["review", "Review takes (gate B)", "Review"],
  ["composite", "Composite (app insertion)", "Composite"],
  ["cut", "Assemble (gate C)", "Cut"],
  ["deliver", "Deliver", "Deliver"],
];
/* The state.json stage of each pipeline stage. */
const STATE_STAGE: Partial<Record<StageKey, string>> = { keyframes: "shots", generate: "generate", review: "review", composite: "composite", cut: "assemble", deliver: "deliver" };

const usd = (n: number | null) => (n === null ? "an unknown amount" : `$${n.toFixed(2)}`);
const quote = (s: string | null | undefined) => (s ? ` — “${s}”` : "");
type S = { state: StageState; words: string };
const st = (state: StageState, words: string): S => ({ state, words });

/** The undecided take of a segment: not the one gate B recorded, not the one just clicked. */
export const undecidedTake = (s: Segment) => s.takes.find((t) => t.file !== s.gateB?.file && !(s.click?.current && s.click.file === t.file)) ?? null;

export function videoStages(x: StagesInput): StagesView {
  const p = x.production;
  const own = p ? p.segments.filter((s) => s.generated && !s.sharedFrom) : [];
  const phones = own.filter((s) => s.phone);
  const out: Partial<Record<StageKey, S>> = {};

  /* 1 Plan: written (a REVIEW.md with a digest for the draft's current revision), then approved (a real lock of plan.json's revision). */
  const reviewed = !!x.review?.digest && (!x.draft || x.review.revision === x.draft.revision);
  const written = !!x.draft && reviewed;
  const blocking = x.ready?.current ? x.ready.blocking : [];
  /* Locked for the draft's revision; else, with a lock and a newer draft, the plan is stale: the user accepts the change
     (a plan.approve line for the new digest, "clicked") or sends it back, and the agent re-locks. The stages after it wait. */
  const lockedNow = !!x.lock && (!x.draft || x.draft.revision <= x.lock.revision);
  const planStale = !!x.lock && !lockedNow;
  out.plan = x.manual && !x.lock ? st("n/a", "made outside the pipeline")
    : lockedNow ? st("done", `approved: locked revision ${x.lock!.revision}`)
    : x.planPoint.status === "approved" ? st("clicked", planStale ? `you accepted revision ${x.draft!.revision}: the agent re-locks it (video_plan.py lock --from-atlas)` : "you approved the plan: the agent locks it (video_plan.py lock --from-atlas)")
    : x.planPoint.status === "sentback" ? st("sent back", `sent back${quote(x.planPoint.note)}`)
    : planStale ? st("you", `changed after the lock: revision ${x.draft!.revision} waits for you, locked revision ${x.lock!.revision}; accept it and re-lock, or send it back`)
    : !x.brief && !x.draft ? st("agent", "the brief is being written (video-plan)")
    : !x.draft ? st("agent", "the script is being written (video-script)")
    : !written ? st("agent", `REVIEW.md of revision ${x.draft.revision} is being written (video_plan.py review)`)
    : blocking.length ? st("blocked", `${blocking.length} blocking input${blocking.length === 1 ? "" : "s"}: ${blocking[0]}`)
    : st("you", `revision ${x.review!.revision} waits for you: approve it, or send it back with a note`);

  const locked = out.plan.state === "done" || planStale;
  const failed = (k: StageKey): S | null => {
    const row = p?.state?.stages[STATE_STAGE[k] ?? ""];
    if (row?.status === "failed") return st("blocked", `state.json: failed${row.note ? ` — ${row.note}` : ""}`);
    return null;
  };
  const running = (k: StageKey): string | null => {
    const row = p?.state?.stages[STATE_STAGE[k] ?? ""];
    return row?.status === "running" && row.note ? row.note : null;
  };

  if (x.manual) {
    for (const k of ["keyframes", "generate", "review", "composite", "cut"] as StageKey[]) out[k] = st("n/a", "made outside the pipeline: no video.json, no gates");
  } else if (!locked || !p) {
    for (const k of ["keyframes", "generate", "review", "composite", "cut"] as StageKey[]) out[k] = st("not reached", "the plan is not locked yet");
  } else {
    /* 2 Shots and keyframes, gate A. A character that is not live blocks it. */
    const deps = (x.ready?.dependencies ?? []).filter((d) => /^(character|narrator) /.test(d));
    const gateADone = !own.length ? !!p.segments.length : p.gateA?.decision === "approve" && p.gateA.current;
    const c = p.gateAClick;
    const noKeys = own.filter((s) => s.needsKeyframe && !s.keyframe).map((s) => s.name);
    out.keyframes = !p.segments.length ? (deps.length ? st("blocked", deps[0]) : st("agent", "the shots are being written (character-shots)"))
      : gateADone ? st("done", !own.length ? "no generated segment: nothing to approve" : `approved${p.gateA?.date ? ` ${p.gateA.date}` : ""}`)
      : failed("keyframes") ?? (c?.kind === "storyboard.approve" && c.current ? st("clicked", "you approved the storyboard: being recorded (review.py storyboard --from-atlas)")
      : c?.kind === "storyboard.sendback" && c.current ? st("sent back", `sent back${quote(c.note)}`)
      : noKeys.length ? st("agent", `keyframes being made: ${noKeys.join(", ")}`)
      : p.gateA?.decision === "approve" ? st("stale", "a keyframe changed after gate A: approve again")
      : deps.length ? st("blocked", deps[0])
      : st("you", `the storyboard and ${usd(p.cost)} of first runs wait for you`));

    /* 3 Generate: a take for every generated segment (an approved one, or one gate B has not decided). */
    const caps = (x.ready?.dependencies ?? []).filter((d) => d.includes("not runnable yet"));
    const toMake = own.filter((s) => !s.approved && !undecidedTake(s));
    out.generate = !own.length ? st("n/a", "no generated segment (supplied media, panels, recordings, motion design)")
      : !gateADone ? st("not reached", "gate A first")
      : !toMake.length ? st("done", `${own.length} segment${own.length === 1 ? "" : "s"} with a take`)
      : failed("generate") ?? (caps.length ? st("blocked", caps[0])
      : st("agent", running("generate") ? `running: ${running("generate")}` : `generating ${toMake.map((s) => s.name).join(", ")} (${usd(toMake.reduce((a, s) => a + (s.cost ?? 0), 0))} computed)`));

    /* 4 Review takes, gate B: every segment, source and narration take review.py needs(), and each motion-designed render. */
    const motions = p.segments.filter((s) => s.motion && !s.sharedFrom);
    const items = own.length + p.sources.length + p.narration.length + motions.length;
    const okItems = own.filter((s) => s.approved).length + p.sources.filter((s) => s.approved).length + p.narration.filter((s) => s.approved).length
      + motions.filter((s) => s.motion!.approved).length;
    const clicked = own.some((s) => s.click?.current && !s.click.recorded) || [...p.sources, ...p.narration].some((s) => s.click?.current && !s.click.recorded)
      || motions.some((s) => s.motion!.click?.current && !s.motion!.click.recorded);
    const waiting = own.filter((s) => !s.approved && undecidedTake(s)).map((s) => s.name)
      .concat(p.sources.filter((s) => !s.approved && s.sha256 && !s.click?.current).map((s) => s.id))
      .concat(p.narration.filter((s) => !s.approved && s.sha256 && !s.click?.current).map((s) => s.take))
      .concat(motions.filter((s) => !s.motion!.approved && s.motion!.gates && !s.motion!.failed.some((g) => MOTION_HARD.includes(g)) && !s.motion!.click?.current).map((s) => `${s.name} (motion design)`));
    const lastReject = own.find((s) => !s.approved && s.gateB && s.gateB.decision !== "approve" && !undecidedTake(s));
    out.review = !items ? st("n/a", "nothing for gate B")
      : okItems === items ? st("done", `${items} item${items === 1 ? "" : "s"} approved`)
      : !gateADone && own.length ? st("not reached", "gate A first")
      : waiting.length ? st("you", `waiting for you: ${waiting.join(", ")}`)
      : clicked ? st("clicked", "your decision is being recorded (review.py --from-atlas)")
      : lastReject ? st("sent back", `${lastReject.name} rejected${quote(lastReject.gateB?.failure ?? lastReject.gateB?.words)}`)
      : failed("review") ?? st("agent", `${okItems} of ${items} approved; the rest have no take or file yet`);

    /* 5 Composite: only with a phone segment. */
    const pc = phones.find((s) => !s.compositeApproved && s.compositeClick?.current);
    out.composite = !phones.length ? st("n/a", "no app insertion in the plan")
      : phones.every((s) => s.compositeApproved) ? st("done", `${phones.length} composite${phones.length === 1 ? "" : "s"} approved`)
      : !phones.some((s) => s.approved) ? st("not reached", "the plates are approved at gate B first")
      : pc?.compositeClick?.kind === "composite.sendback" ? st("sent back", `${pc.name} sent back${quote(pc.compositeClick.note)}`)
      : pc ? st("clicked", `you approved the composite of ${pc.name}: being recorded`)
      : phones.some((s) => s.approved && s.composite && !s.compositeApproved) ? st("you", `waiting for you: ${phones.filter((s) => s.approved && s.composite && !s.compositeApproved).map((s) => s.name).join(", ")}`)
      : failed("composite") ?? st("agent", `compositing ${phones.filter((s) => !s.composite).map((s) => s.name).join(", ")} (composite.sh)`);

    /* 6 Assemble, gate C. */
    const ready7 = (out.review.state === "done" || out.review.state === "n/a") && (out.composite.state === "done" || out.composite.state === "n/a");
    const a = p.assembly;
    const cc = p.cutClick;
    out.cut = p.gateC?.decision === "approve" && p.gateC.current ? st("done", `approved${p.gateC.date ? ` ${p.gateC.date}` : ""}`)
      : !a ? (ready7 ? failed("cut") ?? st("agent", "assembling (assemble.sh)") : st("not reached", "every segment is approved first"))
      : a.stale ? st("stale", "assembled from another revision of the plan: the agent assembles again")
      : cc?.current && !cc.recorded ? st("clicked", cc.kind === "cut.approve" ? "you approved the cut: being recorded (review.py final --from-atlas)" : `sent back${cc.segment ? ` (regenerate ${cc.segment})` : ""}: being recorded`)
      : p.gateC && p.gateC.current && p.gateC.decision !== "approve" ? st("sent back", `${p.gateC.decision}${quote(p.gateC.words)}`)
      : !ready7 ? st("not reached", "every segment is approved first")
      : st("you", "the cut waits for you");
  }

  /* A stale plan: what production made for the old revision stays, but no stage after the plan is anyone's turn until the re-lock. */
  if (planStale) {
    for (const k of ["keyframes", "generate", "review", "composite", "cut"] as StageKey[]) {
      if (out[k] && out[k]!.state !== "done" && out[k]!.state !== "n/a") out[k] = st("not reached", "the changed plan is re-locked first");
    }
  }

  /* 7 Deliver: the delivered file, then the Atlas posting gate. */
  out.deliver = x.final
    ? x.finalPoint.status === "approved" ? st("done", "approved for posting")
      : x.finalPoint.status === "sentback" ? st("sent back", `sent back${quote(x.finalPoint.note)}`)
      : st("you", x.manual ? "delivered (made outside the pipeline): approve it for posting" : "delivered: approve it for posting")
    : out.cut?.state === "done" ? st("agent", "being delivered (deliver.sh)")
    : st("not reached", "gate C first");

  const stages: Stage[] = NAMES.map(([key, name, short], i) => ({ n: i + 1, key, name, short, ...(out[key] ?? st("not reached", "")) }));
  const cur = stages.find((s) => s.state !== "done" && s.state !== "n/a");
  const current = cur?.n ?? 7;
  const who = !cur ? "done" : cur.state === "you" ? "you" : "agent";
  const now = !cur ? "Delivered and approved for posting." : `${cur.short}: ${cur.words}.`;
  return { stages, current, now, who, notes: p?.notes ?? [] };
}

/* --------------------------------------------------------------- the timeline */

export type Picture = { kind: "image" | "video"; url: string; at: number | null; label: string };
/** How the app is shown in a beat, and what the viewer reads, step by step (the plan's screen_story). */
export type Story = {
  /** How the picture comes: rebuilt in code and animated, a real recording, a real still, or not said. */
  source: "motion_design" | "recording" | "still" | null;
  reason: string | null;
  screens: string[];
  /** Each step: its time inside the beat, the action in words, the screen, and the strings new on screen at that step. */
  steps: { at: number; what: string; screen: string; reads: string[] }[];
};

export type Checkpoint = {
  id: string;
  start: number;
  end: number;
  range: string;
  role: string | null;
  segment: string | null;
  sees: string;
  text: { text: string; placement: string | null; range: string }[];
  sound: string;
  app: string;
  /** The app beat's screen story, the hero string the viewer must read, and what the viewer must do (read, recognise). */
  story: Story | null;
  hero: string | null;
  viewerMust: string | null;
  /** The picture of the stage reached, then the ones it replaced ("show the reference"). */
  picture: Picture | null;
  earlier: Picture[];
  /** Why there is no picture, in words. */
  noPicture: string | null;
  /** The reaction of a beat with a reaction reference, as its card (lib/reactions.ts). */
  reaction: ReactionCard | null;
};
export type Timeline = { length: number; checkpoints: Checkpoint[]; player: { url: string; label: string } | null; source: "plan.json" | "plan.draft.json" | null;
  /** The caption and the music note of the plan the strip reads (the draft before the lock), as written. */
  caption: string | null; music: string | null };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const secs = (n: number) => (Number.isInteger(n) ? `${n}.0` : n.toFixed(1));
export const rangeOf = (a: number, b: number) => `${secs(a)}–${secs(b)} s`;
const has = (rel: string) => existsSync(join(ROOT, rel));

export type TimelineInput = {
  plan: any;
  source: "plan.json" | "plan.draft.json" | null;
  production: Production | null;
  /** The delivered file, after gate C. */
  final: { url: string } | null;
};

const ACTION_WORDS: Record<string, string> = { appear: "the screen appears", tap: "a tap on", result: "the result shows", hold: "the screen holds", scroll: "a scroll", type: "typing", swipe: "a swipe" };

/** The screen story of an app beat: the source in one word, and the steps with the strings that are new at each one. */
function storyOf(b: any): Story {
  const ss = b.screen_story ?? null;
  const source: Story["source"] = b.demo_source === "motion_design" ? "motion_design" : b.demo_source === "still" ? "still" : b.demo_source === "recording" || (b.framing === "app_screen" && !b.demo_source) ? "recording" : null;
  const steps: Story["steps"] = [];
  let seen = new Set<string>();
  for (const x of ss?.steps ?? []) {
    const shows: string[] = (x.shows ?? []).map(String);
    const reads = shows.filter((w) => !seen.has(w));
    seen = new Set(shows);
    const verb = ACTION_WORDS[x.action] ?? String(x.action ?? "");
    const what = x.target ? `${verb} ${x.target}` : verb;
    steps.push({ at: num(x.at_s) ?? 0, what, screen: String(x.screen ?? ""), reads });
  }
  return { source, reason: typeof b.demo_source_reason === "string" ? b.demo_source_reason : null, screens: (ss?.screens ?? []).map(String), steps };
}

/** The checkpoints of the strip: one per beat, in time order (§ 4.1). */
export function timeline({ plan, source, production: p, final }: TimelineInput): Timeline {
  const beats: any[] = [...(plan?.beats ?? [])].sort((a, b) => (num(a.start_s) ?? 0) - (num(b.start_s) ?? 0));
  const slug = String(plan?.app ?? "");
  const hdir = String(plan?.handle ?? "").replace(/^@/, "");
  const lines = new Map<string, any>((plan?.script ?? []).map((l: any) => [l.id, l]));
  const refs = new Map<string, any>((plan?.reaction_refs ?? []).map((r: any) => [r.id, r]));
  const assets = new Map<string, any>((plan?.assets ?? []).map((a: any) => [a.id, a]));
  const overlays: any[] = plan?.overlays ?? [];
  const screensFile = slug ? join(APPS_DIR, slug, "screens", "screens.json") : "";
  let screens = new Map<string, any>();
  try {
    if (screensFile && existsSync(screensFile)) screens = new Map((JSON.parse(readFileSync(screensFile, "utf8")).screens ?? []).map((r: any) => [r.id, r]));
  } catch { /* no library */ }
  const music = plan?.publishing_note?.music_note && !/^<.*>$/.test(plan.publishing_note.music_note) ? String(plan.publishing_note.music_note) : null;
  const length = num(plan?.format?.length_s) ?? (beats.length ? Math.max(...beats.map((b) => num(b.end_s) ?? 0)) : 0);
  const segOf = (bid: string) => p?.segments.find((s) => s.beatIds.includes(bid)) ?? null;

  const checkpoints: Checkpoint[] = beats.map((b, i) => {
    const id = String(b.id ?? `b${i}`);
    const start = num(b.start_s) ?? 0;
    const end = num(b.end_s) ?? start;
    const seg = segOf(id);
    const segStart = seg?.start ?? start;
    const at = Math.max(0, start - segStart);

    /* sees: the action, the framing, and the layout of a panel beat. */
    const panels: any[] = b.panels ?? [];
    const sees = [b.action && !/^<.*>$/.test(b.action) ? String(b.action) : null, b.framing ? `framing: ${b.framing}` : null,
      b.layout && b.layout !== "sequence" ? `${b.layout}${panels.length ? `, ${panels.length} panel${panels.length === 1 ? "" : "s"}: ${panels.map((x) => x.id ?? x.asset_id ?? x.screen_id).filter(Boolean).join(", ")}` : ""}` : null]
      .filter(Boolean).join(" · ") || "not written";
    /* text: every overlay whose range meets the beat's, word for word. */
    const text = overlays.filter((o) => (num(o.start_s) ?? 0) < end && (num(o.end_s) ?? num(o.start_s) ?? 0) > start || (num(o.start_s) === start && start === end))
      .map((o) => ({ text: String(o.text ?? ""), placement: o.placement ?? null, range: rangeOf(num(o.start_s) ?? 0, num(o.end_s) ?? num(o.start_s) ?? 0) }));
    /* sound: the spoken lines and who speaks them, a narration take, silent; the music note on the first beat. */
    const said = (b.lines ?? []).map((l: string) => lines.get(l)).filter(Boolean)
      .map((l: any) => `${b.performance === "voiceover" ? `voiceover${b.narrator_ref ?? plan?.editorial?.narrator_ref ? ` (${b.narrator_ref ?? plan.editorial.narrator_ref})` : ""}` : l.speaker ?? "?"}: “${l.line}”`);
    const af = seg?.audioFrom;
    const under = af ? af.startsWith("narration:") ? `narration take ${af.slice(10)}` : af.startsWith("asset:") ? `supplied sound ${af.slice(6)}` : `the voice of ${af}` : null;
    const sound = [...said, under, !said.length && !under ? (b.performance === "silent_action" || seg?.type === "X" ? "silent" : "no line") : null, i === 0 && music ? `music: ${music}` : null].filter(Boolean).join(" · ");
    /* app: the screen and its hero string, a supplied clip, or not on screen. */
    const hero = b.screen_id ? plan?.hero_strings?.[b.screen_id] ?? screens.get(b.screen_id)?.hero?.text ?? null : null;
    const how = b.demo_source === "motion_design" ? " by motion design" : b.demo_source === "still" ? ", a real still" : b.app_on_screen && b.framing === "app_screen" ? ", a real recording" : "";
    const app = b.app_on_screen && b.screen_id ? `screen ${b.screen_id}${how}${hero ? `, “${hero}”` : ""}`
      : (b.source_asset_ids ?? []).length ? `supplied ${(b.source_asset_ids as string[]).join(", ")}`
      : b.app_on_screen ? "on screen (no screen named)" : "not on screen";
    const story: Story | null = b.app_on_screen ? storyOf(b) : null;

    /* The pictures, from the latest stage down to the plan's (§ 4.1); every one a file on disk. */
    const pics: Picture[] = [];
    if (seg?.compositeApproved && seg.composite) pics.push({ kind: "video", url: seg.composite.url, at, label: "composite, approved" });
    if (seg?.approved) {
      const n = seg.takes.length - seg.takes.findIndex((t) => t.file === seg.approved!.file);
      const stale = seg.keyframe && seg.keyframe.at > seg.approved.at ? "; the keyframe was redone after it" : "";
      pics.push({ kind: "video", url: seg.approved.url, at, label: `take ${n}, approved${stale}` });
    } else if (seg && seg.takes[0]) {
      pics.push({ kind: "video", url: seg.takes[0].url, at, label: `take ${seg.takes.length}, not decided` });
    }
    if (seg?.motion?.render) {
      const m = seg.motion;
      pics.push({ kind: "video", url: seg.motion.render.url, at, label: m.approved ? "motion design, approved" : m.failed.length ? `motion design, gates failed: ${m.failed.join(", ")}` : "motion design, not approved yet" });
      const still = [...m.stills].reverse().find((x) => x.at <= at + (end - start)) ?? m.stills[0];
      if (still) pics.push({ kind: "image", url: still.url, at: null, label: `motion design at ${secs(still.at)} s` });
    }
    if (seg?.keyframe && seg.needsKeyframe) pics.push({ kind: "image", url: seg.keyframe.url, at: null, label: p?.gateA?.decision === "approve" && p.gateA.current ? "keyframe, approved" : "keyframe, not approved yet" });
    const ref = refs.get(b.reaction?.ref_id ?? "");
    const refUrl = ref ? mediaUrl(ref.video_path) : null;
    if (refUrl) pics.push({ kind: "video", url: refUrl, at: num(ref.start_s), label: `reference, ${ref.handle ? `@${String(ref.handle).replace(/^@/, "")} ` : ""}at ${secs(num(ref.start_s) ?? 0)} s` });
    else if (seg?.motionCopy?.reference) pics.push({ kind: "video", url: seg.motionCopy.reference, at: 0, label: "reference clip" });
    if (b.screen_id && screens.get(b.screen_id)?.file) {
      const r = screens.get(b.screen_id);
      const u = mediaUrl(`apps/${slug}/screens/${r.file}`);
      if (u) pics.push({ kind: /\.(mp4|mov)$/i.test(r.file) ? "video" : "image", url: u, at: /\.(mp4|mov)$/i.test(r.file) ? 0 : null, label: `screen ${b.screen_id}` });
    }
    for (const aid of b.source_asset_ids ?? []) {
      const a = assets.get(aid);
      const u = a ? mediaUrl(a.path, a.sha256) : null;
      if (u) pics.push({ kind: a.kind === "still" ? "image" : "video", url: u, at: a.kind === "still" ? null : num(a.trim_s?.[0]) ?? 0, label: `supplied ${aid}` });
    }
    const faceless = b.framing === "subject_only" || b.framing === "hands_only";
    for (const sid of b.subject_ids ?? []) {
      const rel = `apps/${slug}/handles/${hdir}/references/subject-${sid}.png`;
      if (slug && hdir && has(rel)) pics.push({ kind: "image", url: mediaUrl(rel)!, at: null, label: `subject ${sid}` });
    }
    const heroRel = `apps/${slug}/handles/${hdir}/references/face.png`;
    if (!faceless && (plan?.characters ?? []).length && slug && hdir && has(heroRel)) pics.push({ kind: "image", url: mediaUrl(heroRel)!, at: null, label: "hero, the character" });

    const noPicture = pics.length ? null
      : seg?.motion ? "no picture yet: the app's screens are rebuilt in code and rendered locally (motion_design.py), then approved at gate B"
      : seg && (seg.type === "R" || seg.type === "P") ? "no picture yet: the screen recording is laid in at assembly"
      : seg?.type === "C" || (b.source_asset_ids ?? []).length ? "no picture: the supplied file is not on disk or not served"
      : "no picture: text only, or nothing on disk yet";
    return { id, start, end, range: rangeOf(start, end), role: b.role && !/^<.*>$/.test(b.role) ? String(b.role) : null, segment: seg?.name ?? null, sees, text, sound, app, story, hero: hero ? String(hero) : null, viewerMust: typeof b.viewer_must === "string" ? b.viewer_must : null, picture: pics[0] ?? null, earlier: pics.slice(1), noPicture,
      reaction: ref ? reactionCardOf(ref, planBeatsOf(plan, String(ref.id), num(ref.start_s) ?? 0)) : null };
  });

  /* Gate C and after: the whole strip plays the cut. */
  const a = p?.assembly;
  const player = final ? { url: final.url, label: "the delivered file" } : a && !a.stale ? { url: a.url, label: "the cut" } : null;
  return { length, checkpoints, player, source, caption: typeof plan?.publishing_note?.caption === "string" ? plan.publishing_note.caption : null, music: typeof plan?.publishing_note?.music_note === "string" ? plan.publishing_note.music_note : null };
}
