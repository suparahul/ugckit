import assert from "node:assert/strict";
import { test } from "node:test";

import { planChanges, rowWas, technicalChanges } from "./plan-changes.ts";

const locked = {
  revision: 1,
  video_id: "latte-x",
  format: { length_s: 20 },
  beats: [
    { id: "b1", start_s: 0, end_s: 2.75, action: "Nicole looks up, tired and soft." },
    { id: "b2", start_s: 2.75, end_s: 6, screen_story: { steps: [{ at_s: 0, action: "result", shows: ["What we saw", "Latte stayed under the sofa."] }] } },
  ],
  overlays: [{ id: "o1", role: "hook", text: "my kitten's first night home. wish I'd had THIS", start_s: 0, end_s: 3 }],
  hero_strings: { "latte-x-reveal": "Give her time." },
  publishing_note: { caption: "her first night home #kittens", music_note: "library track" },
  source: { row: "| 35 | 10-20 |", section: "Posts, 10-20" },
};

test("the changes of a stale plan, in words: the words on screen first, the source row never", () => {
  const draft = JSON.parse(JSON.stringify(locked));
  draft.revision = 2;
  draft.source = { row: "| 36 | 10-21 |", section: "Posts, 10-21" };
  draft.overlays[0].text = "struggling with my new kitten for days and now I find this";
  draft.overlays[0].end_s = 4;
  draft.beats[0].action = "Nicole looks up, worn out after days of trying.";
  draft.beats[1].screen_story.steps[0].shows = ["What we saw", "Latte stayed under the sofa again."];
  draft.hero_strings["latte-x-reveal"] = "Sit in the same room.";
  draft.publishing_note.caption = "days of her hiding #kittens";
  const out = planChanges(locked, draft);
  assert.deepEqual(out, [
    "The words on screen (text 1): was “my kitten's first night home. wish I'd had THIS”; now “struggling with my new kitten for days and now I find this”.",
    "The end of the words on screen (text 1), in seconds: was 3; now 4.",
    "What the viewer sees in part 1: was “Nicole looks up, tired and soft.”; now “Nicole looks up, worn out after days of trying.”.",
    "The app's text in part 2, step 1: was “What we saw”, “Latte stayed under the sofa.”; now “What we saw”, “Latte stayed under the sofa again.”.",
    "The caption: was “her first night home #kittens”; now “days of her hiding #kittens”.",
    "The hero text of screen latte-x-reveal: was “Give her time.”; now “Sit in the same room.”.",
  ]);
});

test("no plan, or the same plan under another revision and source row: nothing changed", () => {
  assert.deepEqual(planChanges(null, locked), []);
  const same = { ...locked, revision: 2, source: { row: "| 36 | 10-21 |" } };
  assert.deepEqual(planChanges(locked, same), []);
});

test("the technical changes, each once; the old row beside the new row, only where they differ", () => {
  const draft = JSON.parse(JSON.stringify(locked));
  draft.revision = 2;
  draft.source = { row: "| 36 | 10-21 |", section: "Posts, 10-21", post: "2026-10-21/latte/1" };
  draft.reaction_refs = [{ id: "r1", video_sha256: "b" }];
  const withRef = { ...locked, reaction_refs: [{ id: "r1", video_sha256: "a" }] };
  assert.deepEqual(technicalChanges(withRef, draft), ["the revision number", "the source row of PLAN.md", "the post key", "a checksum"]);
  assert.deepEqual(technicalChanges(locked, locked), []);
  const row = { range: "0.0–3.0 s", sees: "Nicole looks up, tired and soft.", text: [{ text: "old hook", placement: "top", range: "0.0–3.0 s" }], sound: "silent", app: "not on screen", hero: null, story: null };
  assert.equal(rowWas(row, row), null);
  assert.deepEqual(rowWas(row, null), { new: true });
  const next = { ...row, sees: "Nicole looks up, worn out.", text: [{ text: "new hook", placement: "top", range: "0.0–4.0 s" }] };
  assert.deepEqual(rowWas(next, row), { sees: "Nicole looks up, tired and soft.", text: [{ text: "old hook", placement: "top", range: "0.0–3.0 s" }] });
  const app = { ...row, text: [], story: { steps: [{ what: "the screen appears", reads: ["What we saw", "Latte hid."] }, { what: "the screen holds", reads: [] }] } };
  const app2 = { ...app, hero: "Sit with her.", story: { steps: [{ what: "the screen appears", reads: ["What we saw", "Latte hid again."] }, { what: "the screen holds", reads: [] }, { what: "a tap", reads: ["Continue"] }] } };
  assert.deepEqual(rowWas(app2, app), { hero: null, steps: [{ what: "the screen appears", reads: ["What we saw", "Latte hid."] }, null, { what: "", reads: [] }] });
  assert.deepEqual(rowWas(app, app2), { hero: "Sit with her.", steps: [{ what: "the screen appears", reads: ["What we saw", "Latte hid again."] }, null], stepsGone: [{ what: "a tap", reads: ["Continue"] }] });
});
