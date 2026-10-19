/**
 * The curation marks of the niche page (lib/niche-marks.ts): the file read
 * leniently, the page's changes applied as the user's, the marks filter, and
 * the file written whole. One temporary folder, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { applyChanges, inMarkView, markKey, marksPath, marksText, markViewOf, parseMarks, readMarksAt, shownMark, validKey, writeMarksAt, type MarksFile } from "./niche-marks.ts";

const AT = "2026-10-19T10:00:00Z";

test("markKey and validKey: <platform>:<id>, nothing else", () => {
  assert.equal(markKey("tiktok", "7412345"), "tiktok:7412345");
  assert.equal(validKey("tiktok:7412345"), true);
  assert.equal(validKey("instagram:C_x9.a-1"), true);
  for (const k of ["7412345", "youtube:1", "tiktok:", "tiktok:a/b", "tiktok:../x"]) assert.equal(validKey(k), false, k);
});

test("parseMarks: no file, a broken file, a wrong key or mark are dropped, never thrown", () => {
  assert.deepEqual(parseMarks(null), { version: 1, marks: {} });
  assert.deepEqual(parseMarks("{not json"), { version: 1, marks: {} });
  assert.deepEqual(parseMarks('{"marks": 3}'), { version: 1, marks: {} });
  const f = parseMarks(JSON.stringify({ version: 1, marks: {
    "tiktok:1": { mark: "out", by: "you", at: AT, handle: "a", why: "" },
    "tiktok:2": { mark: "study", by: "agent", at: AT, rule: "C2", why: "a 5-slide list", extra: 1 },
    "tiktok:3": { mark: "maybe", by: "you", at: AT },
    "bad": { mark: "out" },
    "tiktok:4": "out",
    "instagram:5": { mark: "keep" },
  } }));
  assert.deepEqual(Object.keys(f.marks), ["tiktok:1", "tiktok:2", "instagram:5"]);
  assert.deepEqual(f.marks["tiktok:1"], { mark: "out", by: "you", at: AT, handle: "a" });
  assert.deepEqual(f.marks["tiktok:2"], { mark: "study", by: "agent", at: AT, rule: "C2", why: "a 5-slide list" });
  /* A mark with no `by` is the user's: an agent never overrides what it cannot prove is its own. */
  assert.deepEqual(f.marks["instagram:5"], { mark: "keep", by: "you", at: "" });
});

test("applyChanges: a mark set is the user's, with the time, the handle and a short caption", () => {
  const f = applyChanges({ version: 1, marks: {} }, [
    { key: "tiktok:1", mark: "out", handle: "dogmom", caption: "my   dog\\nat the beach" },
    { key: "tiktok:2", mark: "study", handle: "catvet", caption: "x".repeat(400) },
    { key: "nope", mark: "out" },
  ], AT);
  assert.deepEqual(Object.keys(f.marks), ["tiktok:1", "tiktok:2"]);
  assert.deepEqual(f.marks["tiktok:1"], { mark: "out", by: "you", at: AT, handle: "dogmom", caption: "my dog\\nat the beach" });
  assert.equal(f.marks["tiktok:2"].caption!.length, 160);
});

test("applyChanges: taking off your own mark deletes it; taking off an agent's mark leaves a keep", () => {
  const start: MarksFile = { version: 1, marks: {
    "tiktok:1": { mark: "out", by: "you", at: "earlier", handle: "a" },
    "tiktok:2": { mark: "out", by: "agent", at: "earlier", rule: "C1", handle: "b", caption: "dog video" },
    "tiktok:3": { mark: "study", by: "agent", at: "earlier" },
  } };
  const f = applyChanges(start, [{ key: "tiktok:1", mark: null }, { key: "tiktok:2", mark: null }, { key: "tiktok:3", mark: "out" }], AT);
  assert.equal(f.marks["tiktok:1"], undefined);
  assert.deepEqual(f.marks["tiktok:2"], { mark: "keep", by: "you", at: AT, handle: "b", caption: "dog video" });
  /* Overriding an agent's mark makes it yours. */
  assert.deepEqual(f.marks["tiktok:3"], { mark: "out", by: "you", at: AT });
  /* The input is not changed. */
  assert.equal(start.marks["tiktok:1"].mark, "out");
});

test("marksText: keys in order, two-space JSON, read back the same", () => {
  const f: MarksFile = { version: 1, marks: { "tiktok:9": { mark: "out", by: "you", at: AT }, "tiktok:10": { mark: "study", by: "agent", at: AT, rule: "C1" } } };
  const t = marksText(f);
  assert.ok(t.indexOf('"tiktok:10"') < t.indexOf('"tiktok:9"'));
  assert.ok(t.endsWith("}\n"));
  assert.deepEqual(parseMarks(t), f);
});

test("shownMark and the marks filter: the default hides ruled out; keep is unmarked", () => {
  assert.equal(shownMark(undefined), "");
  assert.equal(shownMark({ mark: "keep", by: "you", at: AT }), "");
  assert.equal(shownMark({ mark: "study", by: "agent", at: AT }), "study");
  const views = ["", "study", "unmarked", "out", "all"] as const;
  const want: Record<string, [boolean, boolean, boolean]> = { "": [true, true, false], study: [false, true, false], unmarked: [true, false, false], out: [false, false, true], all: [true, true, true] };
  for (const v of views) assert.deepEqual((["", "study", "out"] as const).map((m) => inMarkView(v, m)), want[v], `view ${v || "default"}`);
  assert.equal(markViewOf("out"), "out");
  assert.equal(markViewOf("bogus"), "");
});

test("writeMarksAt: the whole file through a temporary file; a second save keeps the first", () => {
  const dir = mkdtempSync(join(tmpdir(), "marks-"));
  try {
    const p = join(dir, "marks.json");
    assert.deepEqual(readMarksAt(p), { version: 1, marks: {} });
    writeMarksAt(p, applyChanges(readMarksAt(p), [{ key: "tiktok:1", mark: "out" }], AT));
    writeMarksAt(p, applyChanges(readMarksAt(p), [{ key: "tiktok:2", mark: "study" }], AT));
    assert.deepEqual(Object.keys(readMarksAt(p).marks), ["tiktok:1", "tiktok:2"]);
    assert.deepEqual(readdirSync(dir), ["marks.json"], "no temporary file left");
    assert.equal(JSON.parse(readFileSync(p, "utf8")).version, 1);
    assert.ok(marksPath("demo").endsWith(join("apps", "demo", "niche", "marks.json")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
