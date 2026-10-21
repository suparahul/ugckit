import assert from "node:assert/strict";
import { test } from "node:test";

import { plainBlock, plainProblem, roleWord, shortLine, videoStatus } from "./plain-words.ts";
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
    "The reaction clip has burned-in text (\"i'm leaving for PARIS\", centre). Production masks it; on the motion route the clip gives only the motion, so neither the text nor the mask reaches the video. Or choose a clean clip.",
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
  const keys = ["plan", "approval", "keyframes", "generate", "review", "composite", "cut", "deliver"] as const;
  const n = keys.indexOf(key) + 1;
  return { current: n, who, now: "", notes: [], stages: keys.map((k, i) => ({ n: i + 1, key: k, name: k, short: k, state: i + 1 < n ? "done" : i + 1 === n ? state : "not reached", words: i + 1 === n ? words : "" })) };
};

test("the status sentence: whose turn, what to do, in the user's words", () => {
  assert.deepEqual(videoStatus(view("approval", "you", "read the plan; approve it, or send it back with a note")), { who: "you", head: "Waiting for you", text: "Approve the plan, or send it back with a note." });
  assert.deepEqual(videoStatus(view("approval", "blocked", "4 blocking inputs: screen x: not in apps/a/screens/screens.json")), { who: "blocked", head: "Blocked", text: "4 inputs are missing before the plan can be approved." });
  assert.equal(videoStatus(view("approval", "clicked", "you approved the plan: the agent locks it (video_plan.py lock --from-atlas)")).text, "You approved the plan. The agent locks it next.");
  assert.equal(videoStatus(view("keyframes", "you", "the storyboard and $0.50 of first runs wait for you")).text, "Approve the storyboard and $0.50 of first runs, or send it back with a note.");
  assert.equal(videoStatus(view("keyframes", "agent", "keyframes being made: 01-x")).text, "The agent writes the shots and makes the keyframes.");
  assert.equal(videoStatus(view("generate", "agent", "generating 01-x ($0.50 computed)")).text, "The agent generates the takes ($0.50 computed).");
  assert.equal(videoStatus(view("review", "you", "waiting for you: 01-x, 02-r (motion design)")).text, "Review 2 takes: 01-x, 02-r (motion design).");
  assert.equal(videoStatus(view("cut", "you", "the cut waits for you")).text, "Watch the cut. Approve it, or send it back.");
  assert.equal(videoStatus(view("deliver", "you", "delivered: approve it for posting")).text, "Watch the video. Approve it for posting, or send it back with a note.");
  assert.deepEqual(videoStatus(view("deliver", "done", "approved for posting", "done")), { who: "done", head: "Done", text: "Delivered and approved for posting." });
  assert.equal(videoStatus(view("plan", "agent", "REVIEW.md of revision 2 is being written (video_plan.py review)")).text, "The agent writes the review of the plan.");
});
