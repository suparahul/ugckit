import assert from "node:assert/strict";
import { test } from "node:test";

import { groupBeats, pendingLine, stageLine, plainBlock, plainProblem, purposeLine, roleWord, shortLine, videoStatus } from "./plain-words.ts";
import type { StagesView } from "./video-stages.ts";

test("ready.json lines read as plain sentences: no path, no backtick, what to do", () => {
  assert.equal(
    plainProblem("screen leo-2026-10-20-night-meowing-capture: not in apps/catwise/screens/screens.json (record it, then `screens`; or, with no recording, motion design: demo_source motion_design and its screen_story)"),
    "Screen “leo-2026-10-20-night-meowing-capture” has no recording in the screen library. Record it, or switch the beat to motion design.",
  );
  assert.equal(plainProblem("hero string of leo-2026-10-20-night-meowing-entry: copied from the real screen once it is indexed"), "The hero text of screen “leo-2026-10-20-night-meowing-entry” is taken from the real screen once it is recorded.");
  assert.equal(plainProblem("asset entry-recording: no file yet (screen, app_recording)"), "The file “entry-recording” (screen, app recording) is not there yet.");
  assert.equal(
    plainProblem("reaction ref rx1: burned-in text in the clip (\"i'm leaving for PARIS\", centre). Production masks it; on the animate route the clip gives only the motion, so neither the text nor the mask reaches the video. Or choose a clean clip"),
    "The reaction clip has burned-in text (\"i'm leaving for PARIS\", centre). Keep this clip: the text does not reach the video. Or pick a clean clip.",
  );
  assert.equal(plainProblem("character nora@v1: not live (the twenty-generation gate)"), "The character nora@v1 not live (the twenty-generation gate).");
  assert.equal(plainProblem("motion_copy: not runnable yet; needed by 01-x"), "Motion copy cannot run yet; needed by 01-x.");
  /* Unknown lines are cleaned and kept whole. */
  const out = plainProblem("something odd in apps/catwise/screens/screens.json, run `screens` again");
  assert.equal(out, "Something odd in the screen library, run screens again.");
  assert.ok(!/`/.test(out));
});

test("the button's reason, in a few words", () => {
  assert.equal(plainBlock("4 blocking inputs: screen x: not in apps/catwise/screens/screens.json (…)"), "4 inputs missing");
  assert.equal(plainBlock("1 blocking input: x"), "1 input missing");
  assert.equal(plainBlock("REVIEW.md has no content digest yet"), "the plan has no review yet");
  assert.equal(plainBlock("the video is not delivered yet"), "the video is not delivered yet");
  assert.equal(plainBlock(null), null);
});

test("roles and short lines", () => {
  assert.equal(roleWord("use_reveal"), "the app appears");
  assert.equal(roleWord("attention"), "the hook");
  assert.equal(roleWord("some_other"), "some other");
  assert.equal(roleWord(null), null);
  assert.equal(shortLine("Hannah in her kitchen. Then the cat jumps."), "Hannah in her kitchen.");
  assert.equal(shortLine("a".repeat(50) + " " + "b".repeat(80), 60), "a".repeat(50) + "…");
});

const view = (key: StagesView["stages"][number]["key"], state: StagesView["stages"][number]["state"], words: string, who: StagesView["who"] = state === "you" ? "you" : "agent"): StagesView => {
  const keys = ["plan", "keyframes", "generate", "review", "composite", "cut", "deliver"] as const;
  const n = keys.indexOf(key) + 1;
  return { current: n, who, now: "", notes: [], stages: keys.map((k, i) => ({ n: i + 1, key: k, name: k, short: k, state: i + 1 < n ? "done" : i + 1 === n ? state : "not reached", words: i + 1 === n ? words : "" })) };
};

test("the status sentence: whose turn, what to do, in the user's words", () => {
  assert.deepEqual(videoStatus(view("plan", "you", "read the plan; approve it, or send it back with a note")), { who: "you", head: "Waiting for you", text: "Approve the plan, or send it back with a note." });
  assert.deepEqual(videoStatus(view("plan", "blocked", "4 blocking inputs: screen x: not in apps/a/screens/screens.json")), { who: "blocked", head: "Blocked", text: "4 inputs are missing before the plan can be approved." });
  assert.equal(videoStatus(view("plan", "clicked", "you approved the plan: the agent locks it (video_plan.py lock --from-atlas)")).text, "Waiting for the agent to record your decision and lock the plan.");
  assert.equal(videoStatus(view("keyframes", "you", "the storyboard and $0.50 of first runs wait for you")).text, "Approve the storyboard and $0.50 of first runs, or send it back with a note.");
  assert.equal(videoStatus(view("keyframes", "agent", "keyframes being made: 01-x")).text, "The agent writes the shots and makes the keyframes.");
  assert.equal(videoStatus(view("generate", "agent", "generating 01-x ($0.50 computed)")).text, "The agent generates the takes ($0.50 computed).");
  assert.equal(videoStatus(view("review", "you", "waiting for you: 01-x, 02-r (motion design)")).text, "Review 2 takes: 01-x, 02-r (motion design).");
  assert.equal(videoStatus(view("cut", "you", "the cut waits for you")).text, "Watch the cut. Approve it, or send it back.");
  assert.equal(videoStatus(view("deliver", "you", "delivered: approve it for posting")).text, "Watch the video. Approve it for posting, or send it back with a note.");
  assert.deepEqual(videoStatus(view("deliver", "done", "approved for posting", "done")), { who: "done", head: "Done", text: "Delivered and approved for posting." });
  assert.equal(videoStatus(view("plan", "agent", "REVIEW.md of revision 2 is being written (video_plan.py review)")).text, "The agent writes the review of the plan.");
});

test("consecutive beats of one segment become one card; a beat with no segment stays alone", () => {
  const beats = [
    { id: "b1", start: 0, end: 2.8, segment: "01-x", role: "attention" },
    { id: "b2", start: 2.8, end: 6.2, segment: "02-r", role: "use_reveal" },
    { id: "b3", start: 6.2, end: 20, segment: "02-r", role: "result" },
    { id: "b4", start: 20, end: 21, segment: null, role: "cta" },
    { id: "b5", start: 21, end: 22, segment: null, role: "cta" },
  ];
  const g = groupBeats(beats);
  assert.deepEqual(g.map((x) => [x.id, x.start, x.end, x.segment, x.beats.length]), [["b1", 0, 2.8, "01-x", 1], ["b2", 2.8, 20, "02-r", 2], ["b4", 20, 21, null, 1], ["b5", 21, 22, null, 1]]);
});

test("the purpose line: the roles in words, then the first sentence the viewer sees", () => {
  assert.equal(purposeLine([{ role: "use_reveal", sees: "Full screen: the Catwise reveal. · framing: app_screen" }, { role: "result", sees: "The card lands." }]), "The app appears, then the result: Full screen: the Catwise reveal.");
  assert.equal(purposeLine([{ role: "attention", sees: "not written" }]), "The hook");
  assert.equal(purposeLine([]), null);
});

test("the bar of a stage that is not the current one: done with its date, skipped, not yet, else as if current", () => {
  const v = view("review", "you", "waiting for you: 01-x");
  v.stages[1].words = "approved 2026-10-19";
  assert.deepEqual(stageLine(v, 1), { who: "done", head: "Done", text: "The plan is approved and locked." });
  assert.deepEqual(stageLine(v, 2), { who: "done", head: "Done", text: "The storyboard was approved on 2026-10-19." });
  assert.deepEqual(stageLine(v, 6), { who: "agent", head: "Not yet", text: "cut starts later: the stages before it come first." });
  v.stages[5].words = "every segment is approved first";
  assert.equal(stageLine(v, 6).text, "cut starts later: every segment is approved first.");
  v.stages[4] = { ...v.stages[4], state: "n/a", words: "no app insertion in the plan" };
  assert.deepEqual(stageLine(v, 5), { who: "done", head: "Skipped", text: "No app insertion in the plan." });
  assert.equal(stageLine(v, 4).text, "Review the take of 01-x.");
});

test("a click the agent has not recorded: one line with the time, and what is waited for; the stale plan is the user's turn", () => {
  assert.equal(pendingLine({ kind: "storyboard.approve", at: "2026-10-21T17:07:12.000Z" }, "keyframes", "2026-10-21"), "Approved at 17:07. Waiting for the agent to record it and generate the takes.");
  assert.equal(pendingLine({ kind: "storyboard.sendback", at: "2026-10-20T09:00:00.000Z", note: "redo the hand" }, "keyframes", "2026-10-21"), "Sent back at 2026-10-20 09:00 — “redo the hand”. Waiting for the agent to record it.");
  assert.equal(pendingLine({ kind: "take.reject", at: "2026-10-21T17:07:12.000Z", note: "six fingers" }, "review", "2026-10-21"), "Rejected at 17:07 — “six fingers”. Waiting for the agent to record it.");
  assert.equal(pendingLine({ kind: "plan.approve", at: "2026-10-21T17:07:12.000Z" }, "plan", "2026-10-21"), "Approved at 17:07. Waiting for the agent to record it and lock the plan.");
  assert.equal(pendingLine(null, "cut"), "Waiting for the agent to record your decision and deliver the video.");
  const stale = videoStatus(view("plan", "you", "changed after the lock: revision 2 waits for you, locked revision 1; accept it and re-lock, or send it back"));
  assert.equal(stale.who, "you");
  assert.equal(stale.text, "The plan changed after the lock. Accept the change and re-lock, or send it back with a note.");
  assert.equal(plainProblem("reaction ref rx1: burned-in text in the clip (\"pov: your ex texts at 3AM\", centre). Production crops text at an edge; text mid-frame is blurred and a soft patch stays. Or choose a clean clip"), "The reaction clip has burned-in text (\"pov: your ex texts at 3AM\", centre). Keep this clip: the text does not reach the video. Or pick a clean clip.");
});
