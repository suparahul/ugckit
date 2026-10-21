/** "Approve anyway" (lib/accept-fail.ts): which failed gates the user may accept with a note. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { cutAccepts, motionAccepts } from "./accept-fail.ts";

test("a failed motion-design gate may be approved anyway", () => {
  const r = motionAccepts({ failed: ["story_text"], notRun: [] }, []);
  assert.deepEqual(r, { stale: false, seen: [], accept: ["story_text"] });
});

test("a stale render (gate current) is never accepted", () => {
  const r = motionAccepts({ failed: ["current", "hero"], notRun: [] }, []);
  assert.equal(r.stale, true);
  assert.deepEqual(r.accept, []);
});

test("a gate not run: ticked by eye it passes, left unticked it is accepted like a failure", () => {
  assert.deepEqual(motionAccepts({ failed: [], notRun: ["text_read", "hero"] }, ["text"]), { stale: false, seen: ["text"], accept: ["hero"] });
  assert.deepEqual(motionAccepts({ failed: [], notRun: ["text_read"] }, ["text"]).accept, []);
});

test("the cut: overlays not the plan's or a changed supplied file block; another failed overlay check may be accepted", () => {
  assert.deepEqual(cutAccepts(["overlays readable", "supplied files unchanged", "overlays as planned", "loudness"]),
    { blocked: ["supplied files unchanged", "overlays as planned"], overlays: ["overlays readable"] });
  assert.deepEqual(cutAccepts([]), { blocked: [], overlays: [] });
});
