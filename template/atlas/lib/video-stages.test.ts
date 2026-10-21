/**
 * The seven stages and the timeline of a character video (lib/video-stages.ts), one
 * fixture per video type of ATLAS-VIDEO-STAGES-PLAN.md § 6, and the case of a real video
 * whose approvals were written by hand while state.json stayed behind. A temporary
 * workspace (ATLAS_ROOT) holds every file; the real models.json gives the prices.
 */

import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WS = mkdtempSync(join(tmpdir(), "atlas-vstages-ws-"));
process.env.ATLAS_ROOT = WS;
mkdirSync(join(WS, "scripts", "character"), { recursive: true });
copyFileSync(join(HERE, "..", "..", "scripts", "character", "models.json"), join(WS, "scripts", "character", "models.json"));

const { readProduction, sha256Of } = await import("./video-production.ts");
const { videoStages, timeline } = await import("./video-stages.ts");
const { served } = await import("./media-paths.ts");

const LOCK = "c".repeat(64);
const w = (p: string, body: unknown) => {
  const abs = join(WS, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body));
};
const open = { status: "open" as const, at: null, note: null };
const approved = { status: "approved" as const, at: null, note: null };
/* A locked video's stage input, with its production read from the files. */
const locked = (id: string, extra: Partial<Parameters<typeof videoStages>[0]> = {}) => {
  const p = readProduction(id, [], LOCK);
  return {
    p,
    v: videoStages({ id, brief: true, draft: { revision: 1 }, review: { revision: 1, digest: "d".repeat(64) }, lock: { revision: 1, digest: LOCK }, planPoint: approved, ready: null, production: p, final: null, finalPoint: open, manual: false, ...extra }),
  };
};
const word = (v: ReturnType<typeof videoStages>, n: number) => v.stages[n - 1].state;
const reset = () => rmSync(join(WS, "pipeline"), { recursive: true, force: true });

test("the motion-copy reaction of 2026-10-14, with the names before 2026-10-19: hand-written approvals, state.json behind, then the cut", () => {
  reset();
  const id = "rx-2026-10-14-reaction-x";
  const vd = `pipeline/character/${id}`;
  w(`${vd}/plan.json`, { app: "app", handle: "@rx", characters: ["nora@v1"], reaction_refs: [{ id: "r1", generation_input: "face_replace", start_s: 0, end_s: 2, video_path: "research/app/x/1/video.mp4", handle: "creator" }],
    beats: [{ id: "b0", role: "hook", start_s: 0, end_s: 2, lines: [], action: "her face reacts, silent", performance: "silent_action", framing: "face", reaction: { ref_id: "r1" } }],
    overlays: [{ id: "o1", text: "I just found this??", start_s: 0, end_s: 2, placement: "top" }], format: { length_s: 2 } });
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "X", beat_ids: ["b0"] }] });
  w(`${vd}/shots/01-x.json`, { face_replace: { ref_id: "r1" }, video: { duration_seconds: null } });
  w(`${vd}/keyframes/01-x.png`, "kf");
  w(`${vd}/segments/01-x/source/reference.mp4`, "ref");
  w(`${vd}/segments/01-x/generated/a.mp4`, "take a");
  w(`${vd}/segments/01-x/generated/qc/identity-a.json`, { result: "FAIL", why: "padding" });
  const kf = sha256Of(join(WS, vd, "keyframes/01-x.png"))!;
  w(`${vd}/approval.json`, {
    gate_a_storyboard: { decision: "approve", words: "ok", date: "2026-10-14", keyframes_sha256: { "01-x": kf } },
    gate_b_segments: [{ project: `${id}.01-x`, file: "generated/a.mp4", decision: "approve", words: "good enough", date: "2026-10-14", checks: {} }],
  });
  w("pipeline/character/state.json", { videos: { [id]: { stages: { shots: { status: "pending" }, generate: { status: "done" }, review: { status: "running", note: "0 of 1 approved" } }, costs: [{ usd: 0.34 }, { usd: 0.34 }] } } });
  let { p, v } = locked(id);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map((n) => word(v, n)), ["done", "done", "done", "done", "n/a", "agent", "not reached"]);
  assert.equal(v.current, 6);
  assert.equal(v.now, "Cut: assembling (assemble.sh).");
  assert.equal(p.spent, 0.68);
  assert.ok(v.notes.some((n) => n.startsWith("state.json says shots pending")), "state.json is behind gate A");
  assert.ok(v.notes.some((n) => n.startsWith("state.json says review running")), "state.json is behind gate B");
  assert.ok(v.notes.some((n) => n.includes("no identity gate result")), "a hand-written motion-copy approval");
  /* The timeline: one checkpoint, the approved take as its picture, the keyframe and the reference one click away. */
  const tl = timeline({ plan: { ...JSON.parse(JSON.stringify({ app: "app", handle: "@rx", characters: ["nora@v1"], reaction_refs: [{ id: "r1", start_s: 0, end_s: 2, video_path: "research/app/x/1/video.mp4", handle: "creator" }], beats: [{ id: "b0", role: "hook", start_s: 0, end_s: 2, lines: [], action: "her face reacts, silent", performance: "silent_action", framing: "face", reaction: { ref_id: "r1" } }], overlays: [{ id: "o1", text: "I just found this??", start_s: 0, end_s: 2, placement: "top" }], format: { length_s: 2 } })) }, source: "plan.json", production: p, final: null });
  const c = tl.checkpoints[0];
  assert.equal(c.range, "0.0–2.0 s");
  assert.equal(c.segment, "01-x");
  assert.equal(c.picture?.label, "take 1, approved");
  assert.deepEqual(c.earlier.map((e) => e.label), ["keyframe, approved", "reference, @creator at 0.0 s"]);
  assert.deepEqual(c.text.map((t) => t.text), ["I just found this??"]);
  assert.equal(c.sound, "silent");
  assert.equal(c.app, "not on screen");
  /* The cut, approved: stage 7 waits for the delivery. */
  w(`${vd}/assembly/${id}.mp4`, "cut");
  w(`${vd}/assembly/assembly.json`, { file: `${vd}/assembly/${id}.mp4`, plan_sha256: LOCK, checks: {} });
  ({ v } = locked(id));
  assert.equal(word(v, 6), "you");
  const sha = sha256Of(join(WS, `${vd}/assembly/${id}.mp4`));
  w(`${vd}/approval.json`, { gate_a_storyboard: { decision: "approve", words: "ok", date: "2026-10-14", keyframes_sha256: { "01-x": kf } }, gate_b_segments: [{ project: `${id}.01-x`, file: "generated/a.mp4", decision: "approve", date: "2026-10-14" }], gate_c_final: { decision: "approve", file: `${vd}/assembly/${id}.mp4`, sha256: sha, date: "2026-10-15" } });
  ({ v } = locked(id));
  assert.equal(word(v, 6), "done");
  assert.equal(v.now, "Deliver: being delivered (deliver.sh).");
  ({ v } = locked(id, { final: { sha256: "f".repeat(64) } }));
  assert.equal(v.now, "Deliver: delivered: approve it for posting.");
  assert.equal(locked(id, { final: { sha256: "f".repeat(64) }, finalPoint: approved }).v.who, "done");
});

test("a talking head with app insertion: the plate, then the composite at stage 5; the screen on the timeline", () => {
  reset();
  const id = "th-2026-10-20-talk";
  const vd = `pipeline/character/${id}`;
  const plan = { app: "app", handle: "@th", characters: ["nora@v1"], script: [{ id: "l1", speaker: "nora", line: "Here is the plan." }],
    beats: [{ id: "b1", role: "step", start_s: 0, end_s: 3, lines: ["l1"], performance: "on_camera", framing: "face" }, { id: "b2", role: "proof", start_s: 3, end_s: 5, lines: [], app_on_screen: true, screen_id: "plan-screen", framing: "phone" }],
    hero_strings: { "plan-screen": "Your care plan" }, format: { length_s: 5 } };
  w(`${vd}/plan.json`, plan);
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "T", beat_ids: ["b1"] }, { n: 2, type: "O", beat_ids: ["b2"] }] });
  w(`${vd}/shots/01-t.json`, { video: { duration_seconds: 5 } });
  w(`${vd}/shots/02-o.json`, { video: { duration_seconds: 5 } });
  w(`${vd}/keyframes/01-t.png`, "k1");
  w(`${vd}/keyframes/02-o.png`, "k2");
  w("apps/app/screens/screens.json", { screens: [{ id: "plan-screen", file: "plan-screen.png", hero: { text: "Your care plan" } }] });
  w("apps/app/screens/plan-screen.png", "png");
  w("pipeline/character/state.json", { model: { slug: "x", price_per_s: 0.08, duration_s: 5 }, videos: {} });
  let { v } = locked(id);
  assert.equal(word(v, 2), "you", "the storyboard waits for gate A");
  assert.equal(v.now, "Keyframes: the storyboard and $0.80 of first runs wait for you.");
  const k = { "01-t": sha256Of(join(WS, vd, "keyframes/01-t.png")), "02-o": sha256Of(join(WS, vd, "keyframes/02-o.png")) };
  w(`${vd}/segments/01-t/generated/t.mp4`, "t");
  w(`${vd}/segments/02-o/generated/o.mp4`, "o");
  w(`${vd}/approval.json`, { gate_a_storyboard: { decision: "approve", date: "2026-10-20", keyframes_sha256: k },
    gate_b_segments: [{ project: `${id}.01-t`, file: "generated/t.mp4", decision: "approve", date: "2026-10-20" }, { project: `${id}.02-o`, file: "generated/o.mp4", decision: "approve", date: "2026-10-20" }] });
  ({ v } = locked(id));
  assert.equal(word(v, 4), "done");
  assert.equal(word(v, 5), "agent", "the plate is approved; the composite is not made yet");
  w(`${vd}/segments/02-o/composite/o-comp.mp4`, "comp");
  w(`${vd}/segments/02-o/composite/qc/gates.json`, { file: "o-comp.mp4", results: [{ gate: "green", result: "PASS" }] });
  w(`${vd}/segments/02-o/composite/qc/corner-sheet.png`, "sheet");
  const r = locked(id);
  assert.equal(word(r.v, 5), "you");
  assert.equal(r.p.segments[1].composite?.sheets[0].label, "corner sheet");
  /* The timeline: the spoken line with its speaker, and the screen at the beat where the app comes in. */
  const tl = timeline({ plan, source: "plan.json", production: r.p, final: null });
  assert.equal(tl.checkpoints[0].sound, "nora: “Here is the plan.”");
  assert.equal(tl.checkpoints[1].app, "screen plan-screen, “Your care plan”");
  assert.ok(tl.checkpoints[1].earlier.some((e) => e.label === "screen plan-screen"), "the screen is one click away behind the take");
});

test("a pet-only video with a narration take: stage 4 waits for the take; the subject picture before production", () => {
  reset();
  const id = "pet-2026-10-21-cat";
  const vd = `pipeline/character/${id}`;
  const plan = { app: "app", handle: "@pet", editorial: { narrator_ref: "nar" }, script: [{ id: "l1", speaker: "vo", line: "She knows the box." }],
    beats: [{ id: "b1", role: "item", start_s: 0, end_s: 4, lines: ["l1"], performance: "voiceover", framing: "subject_only", subject_ids: ["mochi"], action: "the cat walks to the box" }], format: { length_s: 4 } };
  w(`${vd}/plan.json`, plan);
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "B", beat_ids: ["b1"], audio_from: "narration:nar-1" }] });
  w(`${vd}/shots/01-b.json`, { framing_kind: "subject_only", video: { duration_seconds: 5 } });
  w(`${vd}/keyframes/01-b.png`, "kb");
  w(`${vd}/segments/01-b/generated/b.mp4`, "b");
  w(`${vd}/approval.json`, { gate_a_storyboard: { decision: "approve", date: "2026-10-21" }, gate_b_segments: [{ project: `${id}.01-b`, file: "generated/b.mp4", decision: "approve", date: "2026-10-21" }] });
  w("apps/app/handles/pet/references/subject-mochi.png", "cat");
  let { p, v } = locked(id);
  assert.equal(p.narration[0].file, null);
  assert.equal(word(v, 4), "agent", "the narration take is not in narration/ yet");
  w(`${vd}/narration/nar-1.wav`, "voice");
  ({ p, v } = locked(id));
  assert.deepEqual(p.narration[0].lines, ["l1"]);
  assert.equal(p.narration[0].narrator, "nar");
  assert.equal(word(v, 4), "you");
  assert.equal(v.now, "Review: waiting for you: nar-1.");
  /* Before any take: the subject's picture, never the character's face (subject only). */
  const tl = timeline({ plan, source: "plan.draft.json", production: null, final: null });
  assert.equal(tl.checkpoints[0].picture?.label, "subject mochi");
  assert.equal(tl.checkpoints[0].sound, "voiceover (nar): “She knows the box.”");
});

test("supplied media and panels: no generation, stage 3 n/a, the source waits at stage 4", () => {
  reset();
  const id = "demo-2026-10-22-live";
  const vd = `pipeline/character/${id}`;
  w(`${vd}/plan.json`, { app: "app", assets: [{ id: "a1", kind: "clip", path: `${vd}/supplied/a1.mp4`, trim_s: [1, 4] }], beats: [{ id: "b1", start_s: 0, end_s: 3, source_asset_ids: ["a1"], layout: "panels" }] });
  w(`${vd}/supplied/a1.mp4`, "clip");
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "C", beat_ids: ["b1"], asset_id: "a1", source_range_s: [1, 4] }, { n: 2, type: "M", beat_ids: [], panels: [{ id: "p1", asset_id: "a1", rect: [0, 0, 1, 0.5] }] }] });
  const { p, v } = locked(id);
  assert.deepEqual([2, 3, 4].map((n) => word(v, n)), ["done", "n/a", "you"]);
  assert.equal(p.sources[0].id, "a1");
  assert.deepEqual(p.sources[0].segments, ["01-c", "02-m"]);
  assert.ok(p.sources[0].url?.startsWith(`/media/pipeline/character/${id}/supplied/a1.mp4`));
  assert.equal(p.segments[1].panels[0].what, "supplied a1");
});

test("motion design: no generation; the render, its gates and gate B at stage 4; the timeline says how the app is shown", () => {
  reset();
  const id = "md-2026-10-23-tail";
  const vd = `pipeline/character/${id}`;
  const story = { screens: ["Tail Reading"], rebuilt_from: ["code src/screens/TailReading.tsx"], fit: "pad",
    steps: [{ at_s: 0, screen: "Tail Reading", action: "appear", target: null, shows: ["Tail reading", "Upload a clip"] },
      { at_s: 1.5, screen: "Tail Reading", action: "tap", target: "Upload a clip", shows: ["Tail reading", "Upload a clip"] },
      { at_s: 2.5, screen: "Tail Reading", action: "result", target: null, shows: ["Tail reading", "Relaxed tail"] }] };
  const plan = { app: "app", handle: "@md", format: { length_s: 7 }, hero_strings: { "tail-reading": "Relaxed tail" },
    beats: [{ id: "b1", role: "hook", start_s: 0, end_s: 2, framing: "subject_only", source_asset_ids: [] },
      { id: "b2", role: "result", start_s: 2, end_s: 7, framing: "app_screen", app_on_screen: true, screen_id: "tail-reading", viewer_must: "read",
        demo_source: "motion_design", demo_source_reason: "no recording of the reading yet", screen_story: story }] };
  w(`${vd}/plan.json`, plan);
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "R", beat_ids: ["b2"], screen_id: "tail-reading" }] });
  let { p, v } = locked(id);
  const m = p.segments[0].motion;
  assert.ok(m, "an R segment of a motion-designed beat");
  assert.equal(m!.seconds, 5);
  assert.deepEqual(m!.steps.map((x) => x.at), [0, 1.5, 2.5]);
  assert.equal(p.segments[0].screen?.source, "motion_design");
  assert.equal(p.segments[0].seconds, 5);
  assert.equal(word(v, 3), "n/a", "nothing is generated");
  assert.equal(word(v, 4), "agent", "the render is not made yet");
  /* The render and its stills; gates of another render do not count. */
  w(`${vd}/segments/01-r/motion/render.mp4`, "render");
  const sha = sha256Of(join(WS, vd, "segments/01-r/motion/render.mp4"))!;
  w(`${vd}/segments/01-r/motion/stills/step-01.png`, "s1");
  w(`${vd}/segments/01-r/motion/render.json`, { sha256: sha, stills: { "stills/step-01.png": 1.4 } });
  w(`${vd}/segments/01-r/motion/gates.json`, { sha256: "0".repeat(64), results: [{ gate: "format", result: "PASS" }] });
  ({ p, v } = locked(id));
  assert.equal(p.segments[0].motion!.gates, null, "gates.json is of another render");
  assert.equal(word(v, 4), "agent");
  w(`${vd}/segments/01-r/motion/gates.json`, { sha256: sha, results: [{ gate: "format", result: "PASS", detail: "1080x1920" }, { gate: "text_read", result: "NOT RUN", detail: "no OCR" }] });
  ({ p, v } = locked(id));
  assert.deepEqual(p.segments[0].motion!.notRun, ["text_read"]);
  assert.equal(p.segments[0].motion!.stills.length, 1);
  assert.equal(word(v, 4), "you");
  assert.equal(v.now, "Review: waiting for you: 01-r (motion design).");
  assert.ok(served(`${vd}/segments/01-r/motion/render.mp4`) && served(`${vd}/segments/01-r/motion/stills/step-01.png`));
  assert.ok(!served(`${vd}/segments/01-r/motion/index.html`) && !served(`${vd}/segments/01-r/motion/gates.json`), "never the page or a JSON file");
  /* Gate B approves this render by its sha256; a changed render is not approved. */
  w(`${vd}/approval.json`, { gate_b_motion: [{ segment: "01-r", sha256: sha, decision: "approve", words: "Yes.", date: "2026-10-23" }] });
  ({ p, v } = locked(id));
  assert.equal(p.segments[0].motion!.approved, true);
  assert.equal(word(v, 4), "done");
  const tl = timeline({ plan, source: "plan.json", production: p, final: null });
  assert.equal(tl.checkpoints[1].app, "screen tail-reading by motion design, “Relaxed tail”");
  /* The plan panel's story: the source in one word, the steps with the strings new at each one, the hero string. */
  assert.equal(tl.checkpoints[1].story?.source, "motion_design");
  assert.deepEqual(tl.checkpoints[1].story?.steps.map((x) => [x.at, x.what, x.reads]), [[0, "the screen appears", ["Tail reading", "Upload a clip"]], [1.5, "a tap on Upload a clip", []], [2.5, "the result shows", ["Relaxed tail"]]]);
  assert.equal(tl.checkpoints[1].hero, "Relaxed tail");
  assert.equal(tl.checkpoints[1].viewerMust, "read");
  assert.equal(tl.checkpoints[0].story, null);
  assert.equal(tl.checkpoints[1].picture?.label, "motion design, approved");
  w(`${vd}/segments/01-r/motion/render.mp4`, "render 2");
  ({ p } = locked(id));
  assert.equal(p.segments[0].motion!.approved, false, "the approval is of another render");
  /* Before the render: the timeline says how the picture will come. */
  const tl0 = timeline({ plan, source: "plan.draft.json", production: null, final: null });
  assert.equal(tl0.checkpoints[1].app, "screen tail-reading by motion design, “Relaxed tail”");
});

test("motion design on a phone and approve anyway: the bare screen; a failed gate waits for the user, a stale render for the agent", () => {
  reset();
  const id = "md-2026-10-24-phone";
  const vd = `pipeline/character/${id}`;
  const story = { screens: ["Tail Reading"], rebuilt_from: ["code src/screens/TailReading.tsx"], fit: "pad",
    steps: [{ at_s: 0, screen: "Tail Reading", action: "appear", target: null, shows: ["Tail reading"] }] };
  const plan = { app: "app", handle: "@md", format: { length_s: 4 }, app_insertion: true, hero_strings: {},
    beats: [{ id: "b1", role: "use_reveal", start_s: 0, end_s: 4, framing: "hands_only", app_on_screen: true, screen_id: "tail-reading",
      viewer_must: "recognise", demo_source: "motion_design", demo_source_reason: "the user chose it", screen_story: story }] };
  w(`${vd}/plan.json`, plan);
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "G", beat_ids: ["b1"] }, { n: 2, type: "R", beat_ids: ["b1"], screen_id: "tail-reading" }] });
  let { p, v } = locked(id);
  assert.equal(p.segments[0].motion?.fit, "screen", "a phone's screen is rendered bare, at its own aspect");
  assert.equal(p.segments[1].motion?.fit, "pad", "full screen keeps the story's fit");
  w(`${vd}/video.json`, { segments: [{ n: 2, type: "R", beat_ids: ["b1"], screen_id: "tail-reading" }] });
  w(`${vd}/segments/02-r/motion/render.mp4`, "render");
  const sha = sha256Of(join(WS, vd, "segments/02-r/motion/render.mp4"))!;
  w(`${vd}/segments/02-r/motion/gates.json`, { sha256: sha, results: [{ gate: "story_text", result: "FAIL", detail: "not in the story: 'Try premium'" }] });
  ({ p, v } = locked(id));
  assert.ok(v.now.includes("02-r (motion design)"), "a failed gate: the user rejects it or approves anyway");
  w(`${vd}/segments/02-r/motion/gates.json`, { sha256: sha, results: [{ gate: "current", result: "FAIL", detail: "the story changed" }] });
  ({ p, v } = locked(id));
  assert.ok(!v.now.includes("02-r (motion design)"), "a stale render goes back to the agent");
});

test("a continuous take: the seam names the clip it opens on", () => {
  reset();
  const id = "cont-2026-10-23-two";
  const vd = `pipeline/character/${id}`;
  w(`${vd}/plan.json`, { app: "app", beats: [{ id: "b1", start_s: 0, end_s: 3 }, { id: "b2", start_s: 3, end_s: 6 }] });
  w(`${vd}/video.json`, { segments: [{ n: 1, type: "T", beat_ids: ["b1"] }, { n: 2, type: "T", beat_ids: ["b2"] }] });
  w(`${vd}/shots/02-t.json`, { continuity: { from: "01-t" } });
  w(`${vd}/segments/01-t/last-frame.png`, "lf");
  const { p } = locked(id);
  assert.equal(p.segments[1].seam?.from, "01-t");
  assert.ok(p.segments[1].seam?.lastFrame);
  assert.equal(p.segments[1].seam?.verified, false, "capabilities.json does not verify continuity in this workspace");
});

test("before the lock: the one plan stage is written by the agent, then blocked by an input, then sent back; a sheet video made outside the pipeline", () => {
  const base = { id: "v", brief: true, draft: { revision: 2 }, review: { revision: 2, digest: "a".repeat(64) }, lock: null, planPoint: open, production: null, final: null, finalPoint: open, manual: false };
  let v = videoStages({ ...base, review: { revision: 1, digest: "a".repeat(64) }, ready: null });
  assert.equal(v.now, "Plan: REVIEW.md of revision 2 is being written (video_plan.py review).");
  v = videoStages({ ...base, ready: { revision: 2, digest: "a".repeat(64), blocking: ["screen s1: not in screens.json"], dependencies: [], current: true } });
  assert.equal(word(v, 1), "blocked");
  assert.equal(v.now, "Plan: 1 blocking input: screen s1: not in screens.json.");
  v = videoStages({ ...base, ready: null });
  assert.equal(word(v, 1), "you");
  assert.equal(v.now, "Plan: revision 2 waits for you: approve it, or send it back with a note.");
  v = videoStages({ ...base, ready: null, planPoint: { status: "sentback", at: null, note: "another hook" } });
  assert.equal(v.now, "Plan: sent back — “another hook”.");
  v = videoStages({ ...base, ready: null, planPoint: approved });
  assert.equal(word(v, 1), "clicked", "approved in the Atlas, not locked yet");
  v = videoStages({ ...base, ready: null, planPoint: approved, lock: { revision: 2, digest: "a".repeat(64) } });
  assert.equal(word(v, 1), "done");
  assert.equal(v.current, 2);
  v = videoStages({ ...base, brief: false, draft: null, review: null, ready: null, manual: true, final: { sha256: "f".repeat(64) } });
  assert.deepEqual(v.stages.map((s) => s.state), ["n/a", "n/a", "n/a", "n/a", "n/a", "n/a", "you"]);
});

test("the media route serves the pictures the stages show, and never a plan, a prompt or a JSON file", () => {
  for (const ok of ["pipeline/character/v-1/keyframes/03-h-end.png", "pipeline/character/v-1/segments/01-x/source/first-frame.png", "pipeline/character/v-1/segments/01-t/last-frame.png",
    "pipeline/character/v-1/segments/02-o/composite/qc/corner-sheet.png", "pipeline/character/v-1/narration/n-1.wav", "pipeline/character/v-1/supplied/a/b.mp4", "pipeline/character/v-1/assembly/contact-sheet.png", "apps/app/screens/s.png"])
    assert.ok(served(ok), ok);
  for (const no of ["pipeline/character/v-1/plan.json", "pipeline/character/v-1/segments/01-t/prompt.txt", "pipeline/character/v-1/approval.json", "pipeline/character/v-1/segments/01-x/generated/qc/identity-a.json", "pipeline/character/v-1/supplied/../plan.json", "apps/app/screens/screens.json"])
    assert.ok(!served(no), no);
});

test("a stale plan: the user's turn at the plan, the stages after it wait for the re-lock; accepted, the plan is clicked, not done", () => {
  const lock = { revision: 1, digest: "a".repeat(64), words: "go", date: "2026-10-20" };
  const prod = { segments: [{ name: "01-x", type: "X", generated: true, sharedFrom: null, keyframe: { url: "/k.png" }, needsKeyframe: true, approved: null, takes: [], click: null, phone: false, motion: null, composite: null, compositeApproved: false, compositeClick: null, gateB: null }], sources: [], narration: [], gateA: null, gateAClick: null, gateC: null, cutClick: null, assembly: null, keyframes: {}, cost: 0.5, spent: 0, notes: [], state: null, storyboard: null } as any;
  const base = { id: "v", brief: true, draft: { revision: 2 }, review: { revision: 2, digest: "b".repeat(64) }, ready: null, lock, planPoint: { status: "stale", at: "2026-10-20", note: null }, production: prod, final: null, finalPoint: { status: "open", at: null, note: null }, manual: false } as any;
  let v = videoStages(base);
  assert.equal(v.stages[0].state, "you");
  assert.equal(v.stages[0].words, "changed after the lock: revision 2 waits for you, locked revision 1; accept it and re-lock, or send it back");
  assert.equal(v.current, 1);
  assert.equal(v.who, "you");
  assert.equal(v.stages[1].state, "not reached", "keyframes wait for the re-lock");
  assert.equal(v.stages[1].words, "the changed plan is re-locked first");
  v = videoStages({ ...base, planPoint: { status: "approved", at: "2026-10-21T17:07:00.000Z", note: null } });
  assert.equal(v.stages[0].state, "clicked", "accepted in the Atlas: not done until the agent re-locks");
  assert.equal(v.who, "agent");
  v = videoStages({ ...base, planPoint: { status: "approved", at: null, note: null }, lock: { ...lock, revision: 2, digest: "b".repeat(64) } });
  assert.equal(v.stages[0].state, "done");
  assert.equal(v.stages[1].state, "you", "re-locked: the storyboard waits again");
});
