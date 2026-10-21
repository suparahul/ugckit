/** "Approve anyway" (lib/accept-fail.ts): which failed gates the user may accept with a note. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { cutAccepts, motionAccepts } from "./accept-fail.ts";

test("a failed motion-design gate may be approved anyway", () => {
  const r = motionAccepts({ failed: ["story_text"], notRun: [] }, []);
  assert.deepEqual(r, { stale: false, seen: [], accept: ["story_text"] });
});

test("a stale render, a wrong format or a page error is never accepted", () => {
  for (const g of ["current", "format", "page"]) {
    const r = motionAccepts({ failed: [g, "hero"], notRun: [] }, []);
    assert.equal(r.stale, true);
    assert.deepEqual(r.accept, []);
  }
});

test("a gate not run: the eye check is a claim; unticked it never blocks", () => {
  assert.deepEqual(motionAccepts({ failed: [], notRun: ["text_read", "hero"] }, ["text"]), { stale: false, seen: ["text"], accept: [] });
});

test("the cut: overlays not the plan's or a changed supplied file block; another failed overlay check may be accepted", () => {
  assert.deepEqual(cutAccepts(["overlays readable", "supplied files unchanged", "overlays as planned", "loudness"]),
    { blocked: ["supplied files unchanged", "overlays as planned"], overlays: ["overlays readable"] });
  assert.deepEqual(cutAccepts([]), { blocked: [], overlays: [] });
});
