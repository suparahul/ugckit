/**
 * A locked video's production in the Atlas: the storyboard, the takes and the cut, each
 * with the user's click and the agent's record, and whose turn it is. A temporary
 * workspace (ATLAS_ROOT) holds every file; the real models.json gives the prices.
 */

import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WS = mkdtempSync(join(tmpdir(), "atlas-vprod-ws-"));
process.env.ATLAS_ROOT = WS;
mkdirSync(join(WS, "scripts", "character"), { recursive: true });
copyFileSync(join(HERE, "..", "..", "scripts", "character", "models.json"), join(WS, "scripts", "character", "models.json"));

const { readProduction, productionStep, runCost, sha256Of } = await import("./video-production.ts");

const ID = "nora-2026-10-20-reaction";
const VD = `pipeline/character/${ID}`;
const LOCK = "c".repeat(64);
const w = (p: string, body: unknown) => {
  const abs = join(WS, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body));
};
const sha = (p: string) => sha256Of(join(WS, p))!;
type Line = Parameters<typeof readProduction>[1][number];
const ev = (kind: string, data: Record<string, unknown>, at = "2026-10-20T10:00:00.000Z", note?: string) =>
  ({ at, kind, post: "k", data: { video: ID, ...data }, ...(note ? { note } : {}) }) as unknown as Line;

const REF = { id: "r1", generation_input: "face_replace", start_s: 1.0, end_s: 3.0 };
const setup = (route?: string) => {
  rmSync(join(WS, "pipeline"), { recursive: true, force: true });
  w(`${VD}/plan.json`, { app: "app", reaction_refs: [REF] });
  w(`${VD}/video.json`, { segments: [{ n: 1, type: "X", beat_ids: ["b1"] }, { n: 2, type: "T", beat_ids: ["b2"] }, { n: 3, type: "R", beat_ids: ["b3"] }] });
  w(`${VD}/shots/01-x.json`, { face_replace: { ref_id: "r1", ...(route ? { route } : {}) }, video: { duration_seconds: null } });
  w(`${VD}/shots/02-t.json`, { video: { duration_seconds: 5 } });
  w("pipeline/character/state.json", { model: { slug: "minimax-h3-max-reference-to-video", duration_s: 5, price_per_s: 0.08 }, videos: { [ID]: { costs: [{ usd: 0.5 }] } } });
};

test("the computed cost of one run: Kling on the padded clip, Wan per frame, the segment model per second", () => {
  const spec = JSON.parse(readFileSync(join(WS, "scripts", "character", "models.json"), "utf8"));
  assert.equal(runCost(spec, null, { face_replace: { ref_id: "r1" } }, "X", REF).cost, 0.5, "motion: 2 s held to 3.0 s, 3 x $0.168");
  assert.equal(runCost(spec, null, { face_replace: { ref_id: "r1" } }, "X", REF).route, "motion", "no route named: the default");
  assert.equal(runCost(spec, null, { face_replace: { ref_id: "r1", route: "replace" } }, "X", REF).cost, 0.3, "replace: 60 frames x $0.005");
  assert.equal(runCost(spec, { model: { slug: "x", price_per_s: 0.08, duration_s: 5 } }, {}, "T", null).cost, 0.4);
});

test("the storyboard: whose turn, the click, the record, a keyframe redone after the approval", () => {
  setup();
  let p = readProduction(ID, [], LOCK);
  assert.equal(productionStep(p).sentence, "shots being written");
  w(`${VD}/keyframes/01-x.png`, "kf1");
  w(`${VD}/keyframes/02-t.png`, "kf2");
  w(`${VD}/keyframes/storyboard.jpg`, "board");
  p = readProduction(ID, [], LOCK);
  assert.equal(p.cost, 0.9, "the motion X ($0.50) and the T ($0.40)");
  assert.equal(p.spent, 0.5);
  assert.deepEqual(Object.keys(p.keyframes), ["01-x", "02-t"]);
  assert.equal(productionStep(p).who, "you");
  const click = ev("storyboard.approve", { keyframes: p.keyframes, cost_usd: 0.9 });
  p = readProduction(ID, [click], LOCK);
  assert.equal(productionStep(p).sentence, "storyboard approved: being recorded");
  w(`${VD}/approval.json`, { gate_a_storyboard: { decision: "approve", words: "ok", date: "2026-10-20", keyframes_sha256: p.keyframes, approved_in: { atlas_line_at: click.at } } });
  p = readProduction(ID, [click], LOCK);
  assert.ok(p.gateA?.current && p.gateAClick?.recorded);
  assert.equal(productionStep(p).sentence, "generating 01-x");
  w(`${VD}/keyframes/01-x.png`, "kf1, redone");
  p = readProduction(ID, [click], LOCK);
  assert.ok(!p.gateA?.current, "a keyframe changed after gate A: approve again");
  assert.equal(productionStep(p).sentence, "storyboard: waiting for you");
});

test("the replace route has no keyframe: the storyboard does not wait for one", () => {
  setup("replace");
  w(`${VD}/keyframes/02-t.png`, "kf2");
  w(`${VD}/keyframes/storyboard.jpg`, "board");
  const p = readProduction(ID, [], LOCK);
  assert.deepEqual(Object.keys(p.keyframes), ["02-t"]);
  assert.equal(p.segments[0].needsKeyframe, false);
  assert.equal(productionStep(p).sentence, "storyboard: waiting for you");
});

test("the takes: waiting for you, the identity gate shown, approved, rejected and made again; then the cut", () => {
  setup();
  w(`${VD}/keyframes/01-x.png`, "kf1");
  w(`${VD}/keyframes/02-t.png`, "kf2");
  const kf = { "01-x": sha(`${VD}/keyframes/01-x.png`), "02-t": sha(`${VD}/keyframes/02-t.png`) };
  const ga = { decision: "approve", words: "ok", date: "2026-10-20", keyframes_sha256: kf };
  w(`${VD}/approval.json`, { gate_a_storyboard: ga });
  w(`${VD}/segments/01-x/generated/a.mp4`, "take a");
  w(`${VD}/segments/01-x/generated/qc/identity-a.json`, { result: "FAIL", why: "a face in 4 of 8 frames", median_character: 0.52 });
  let p = readProduction(ID, [], LOCK);
  const x = p.segments[0];
  assert.equal(x.faceReplace?.route, "motion");
  assert.deepEqual(x.checks, ["identity", "no_source_identity", "silent"]);
  assert.equal(x.takes[0].identity?.result, "FAIL");
  assert.equal(productionStep(p).sentence, "take 01-x: waiting for you");
  const rej = ev("take.reject", { segment: "01-x", file: "generated/a.mp4", sha256: x.takes[0].sha256, decision: "regenerate" }, "2026-10-20T11:00:00.000Z", "the face drifts");
  p = readProduction(ID, [rej], LOCK);
  assert.equal(productionStep(p).sentence, "01-x: being recorded");
  w(`${VD}/approval.json`, { gate_a_storyboard: ga, gate_b_segments: [{ project: `${ID}.01-x`, file: "generated/a.mp4", decision: "regenerate", date: "2026-10-20", atlas_line_at: rej.at }] });
  p = readProduction(ID, [rej], LOCK);
  assert.equal(productionStep(p).sentence, "generating 01-x", "rejected and recorded: the agent makes a new take");
  w(`${VD}/segments/01-x/generated/b.mp4`, "take b");
  p = readProduction(ID, [rej], LOCK);
  assert.equal(productionStep(p).sentence, "take 01-x: waiting for you");
  w(`${VD}/approval.json`, { gate_a_storyboard: ga, gate_b_segments: [
    { project: `${ID}.01-x`, file: "generated/a.mp4", decision: "regenerate", date: "2026-10-20" },
    { project: `${ID}.01-x`, file: "generated/b.mp4", decision: "approve", date: "2026-10-20" },
    { project: `${ID}.02-t`, file: "generated/t.mp4", decision: "approve", date: "2026-10-20" }] });
  w(`${VD}/segments/02-t/generated/t.mp4`, "take t");
  p = readProduction(ID, [], LOCK);
  assert.equal(p.segments[0].approved?.file, "generated/b.mp4");
  assert.equal(p.cost, 0, "nothing left to run");
  assert.equal(productionStep(p).sentence, "assembling");
  /* The cut: from another revision is stale; this one waits for the user, then the agent. */
  w(`${VD}/assembly/${ID}.mp4`, "cut");
  w(`${VD}/assembly/assembly.json`, { file: `${VD}/assembly/${ID}.mp4`, plan_sha256: "d".repeat(64), checks: {} });
  assert.equal(productionStep(readProduction(ID, [], LOCK)).sentence, "assembling", "stale cut");
  w(`${VD}/assembly/assembly.json`, { file: `${VD}/assembly/${ID}.mp4`, plan_sha256: LOCK, checks: { overlays: { result: "PASS" } } });
  p = readProduction(ID, [], LOCK);
  assert.equal(productionStep(p).sentence, "cut: waiting for you");
  const cut = ev("cut.approve", { file: `${VD}/assembly/${ID}.mp4`, sha256: p.assembly!.sha256, export: "default" });
  assert.equal(productionStep(readProduction(ID, [cut], LOCK)).sentence, "cut approved: being recorded");
  w(`${VD}/assembly/${ID}.mp4`, "cut, assembled again");
  assert.equal(productionStep(readProduction(ID, [cut], LOCK)).sentence, "cut: waiting for you", "a new file after the click: decide again");
});

test("an agent's line is never the user's decision", () => {
  setup();
  w(`${VD}/keyframes/01-x.png`, "kf1");
  w(`${VD}/keyframes/02-t.png`, "kf2");
  const p0 = readProduction(ID, [], LOCK);
  const p = readProduction(ID, [{ ...ev("storyboard.approve", { keyframes: p0.keyframes }), actor: "codex" }], LOCK);
  assert.equal(p.gateAClick, null);
});
