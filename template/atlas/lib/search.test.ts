/**
 * The search of the All posts page (lib/search.ts): without case, every word
 * somewhere in the text, a quoted phrase only as a whole, an @ before a
 * handle dropped. No file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Post } from "./data.ts";
import type { PostState } from "./production.ts";
import { batchFields, matches, postFields, quoted, stateFields, terms, tileFields } from "./search.ts";

test("terms: lower case, split on space, an empty search has none", () => {
  assert.deepEqual(terms("  Cat  FOOD "), ["cat", "food"]);
  assert.deepEqual(terms(""), []);
  assert.deepEqual(terms("   "), []);
});

test("terms: a quoted phrase is one term, mixed with words, curly quotes too", () => {
  assert.deepEqual(terms('"Cat Food"'), ["cat food"]);
  assert.deepEqual(terms('kitten "cat   food" 2026'), ["kitten", "cat food", "2026"]);
  assert.deepEqual(terms('“wet food” “dry food”'), ["wet food", "dry food"]);
  assert.deepEqual(terms('vet"cat food"'), ["vet", "cat food"]);
  /* Empty quotes say nothing. */
  assert.deepEqual(terms('"" "  " cat'), ["cat"]);
});

test("terms: a quote left open makes the rest one phrase", () => {
  assert.deepEqual(terms('"cat fo'), ["cat fo"]);
  assert.deepEqual(terms('vet "cat food'), ["vet", "cat food"]);
  assert.deepEqual(terms('"'), []);
});

test("matches: a phrase only together and in order, words still apart", () => {
  const f = ["Best CAT FOOD for kittens", "food your cat will love"];
  assert.equal(matches(terms('"cat food"'), f), true);
  assert.equal(matches(terms('"food cat"'), f), false);
  assert.equal(matches(terms('"cat food"'), ["food your cat will love"]), false);
  assert.equal(matches(terms("cat food"), ["food your cat will love"]), true);
  /* Mixed: every part must match. */
  assert.equal(matches(terms('"cat food" kittens'), f), true);
  assert.equal(matches(terms('"cat food" puppies'), f), false);
  /* A line break or double space in the text still holds the phrase; two fields do not. */
  assert.equal(matches(terms('"cat food"'), ["wet cat\n  food"]), true);
  assert.equal(matches(terms('"cat food"'), ["my cat", "food"]), false);
  /* A phrase is found as text, like a word is. */
  assert.equal(matches(terms('"cat food"'), ["bobcat foodie"]), true);
  /* Typing: an open quote is a phrase so far. */
  assert.equal(matches(terms('"cat fo'), f), true);
  assert.equal(matches(terms('"cat fo'), ["food your cat"]), false);
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

test("a Niche post is found by its caption, handle, keywords, windows, id and date", () => {
  const t = { caption: "My cat's vet bill was $900", handle: "kitty.costs", id: "7300001", date: "2026-08-30" };
  const f = tileFields(t, ["catcare", ""], ["last three months", "photo tab"]);
  for (const s of ["VET BILL", '"vet bill was"', "@kitty.costs", "#catcare", "catcare", '"photo tab"', "three months", "7300001", "2026-08"]) assert.equal(matches(terms(s), f), true, s);
  for (const s of ['"bill vet"', "#dogcare", '"three photo"']) assert.equal(matches(terms(s), f), false, s);
  /* An empty keyword adds no lone "#". */
  assert.equal(f.includes("#"), false);
});

test("a post from your scroll is found by its caption, handle, sound, id and date; no date is fine", () => {
  const p = { caption: "Indoor cat enrichment ideas", handle: "whisker.lab", sound: "original sound - whisker.lab", id: "7400002", date: null };
  for (const s of ["enrichment", "@whisker.lab", '"original sound"', "7400002"]) assert.equal(matches(terms(s), batchFields(p)), true, s);
  assert.equal(matches(terms("2026"), batchFields(p)), false);
});

test("a findings table row is its cells", () => {
  const row = ["3", "@kitty.costs / 7300001", "vet tech", "7", "Question hook"];
  assert.equal(matches(terms('"question hook" kitty'), row), true);
  assert.equal(matches(terms('"hook question"'), row), false);
});

test("quoted: curly quotes around a search, none added to one that has its own", () => {
  assert.equal(quoted("cat food"), "“cat food”");
  assert.equal(quoted('"cat food" vet'), '"cat food" vet');
  assert.equal(quoted("“cat food"), "“cat food");
});
