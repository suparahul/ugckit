/**
 * The search of the All posts page (lib/search.ts): without case, every word
 * somewhere in the text, an @ before a handle dropped. No file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Post } from "./data.ts";
import type { PostState } from "./production.ts";
import { matches, postFields, stateFields, terms } from "./search.ts";

test("terms: lower case, split on space, an empty search has none", () => {
  assert.deepEqual(terms("  Cat  FOOD "), ["cat", "food"]);
  assert.deepEqual(terms(""), []);
  assert.deepEqual(terms("   "), []);
});

test("matches: no words match everything, every word must be found", () => {
  assert.equal(matches([], ["anything"]), true);
  assert.equal(matches([], []), true);
  assert.equal(matches(terms("CAT"), ["my cat is sick"]), true);
  assert.equal(matches(terms("cat sick"), ["my cat", "is sick"]), true);
  assert.equal(matches(terms("cat dog"), ["my cat is sick"]), false);
  assert.equal(matches(terms("cat"), [null, undefined, ""]), false);
});

test("matches: a leading @ finds the handle, a lone @ is a plain character", () => {
  assert.equal(matches(terms("@catcare"), ["catcare.daily"]), true);
  assert.equal(matches(terms("@"), ["catcare.daily"]), false);
  assert.equal(matches(terms("@"), ["mail@x"]), true);
});

test("a research post is found by its hook, caption, handle, app, id and date", () => {
  const p = { id: "7412345", handle: "purr.daily", onScreen: "POV: your cat stops eating", caption: "3 signs #cats", date: "2026-09-14" } as Post;
  const b = { name: "Purr", fullName: "Purr — Cat Health" };
  for (const s of ["stops EATING", "signs", "@purr.daily", "cat health", "7412345", "2026-09", "pov eating 2026"]) assert.equal(matches(terms(s), postFields(p, b)), true, s);
  assert.equal(matches(terms("dog"), postFields(p, b)), false);
});

test("one of our posts is found by its topic, deck, first slide, handle, key and dates", () => {
  const st = {
    row: { topic: "Why cats hide pain", handle: "@vet.notes", short: "vet", key: "2026-10-02/vet/1", format: "listicle", date: "2026-10-02" },
    deck: { title: "Hidden pain", caption: "Save this for later", slides: [{ blocks: [{ text: "5 quiet signs" }] }] },
    posted: { at: "2026-10-02T09:14:00Z", time: "09:14", url: "" },
    link: "https://www.tiktok.com/@vet.notes/video/123",
  } as unknown as PostState;
  for (const s of ["hide PAIN", "hidden", "save this", "quiet signs", "vet.notes", "2026-10-02/vet/1", "listicle", "2026-10", "video/123"]) assert.equal(matches(terms(s), stateFields(st)), true, s);
  assert.equal(matches(terms("dog"), stateFields(st)), false);
  /* No deck yet: the row alone still answers. */
  assert.equal(matches(terms("hide"), stateFields({ ...st, deck: null })), true);
});
