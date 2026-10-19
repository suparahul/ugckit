/**
 * The shared date window and sort (lib/post-filters.ts), used by All posts
 * and the niche explorer. No file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { compare, dateOpts, dateWindow, inWindow } from "./post-filters.ts";

const NOW = new Date(2026, 9, 19, 15, 0);

test("dateOpts: all time first, then 7, 30, 90 days, 6 months, a year, and a custom range", () => {
  assert.deepEqual(dateOpts.map((o) => o.v), ["", "7d", "30d", "90d", "180d", "365d", "custom"]);
  assert.deepEqual(dateOpts.map((o) => o.label), ["all time", "last 7 days", "last 30 days", "last 90 days", "last 6 months", "last year", "custom range"]);
});

test("dateWindow: a preset counts today as its first day; all time and an unknown value are open", () => {
  assert.deepEqual(dateWindow("7d", "", "", NOW), { from: "2026-10-13", to: "" });
  assert.deepEqual(dateWindow("90d", "", "", NOW), { from: "2026-07-22", to: "" });
  assert.deepEqual(dateWindow("180d", "", "", NOW), { from: "2026-04-21", to: "" });
  assert.deepEqual(dateWindow("365d", "", "", NOW), { from: "2025-10-20", to: "" });
  assert.deepEqual(dateWindow("", "2026-01-01", "", NOW), { from: "", to: "" });
  assert.deepEqual(dateWindow("1000d", "", "", NOW), { from: "", to: "" });
});

test("dateWindow custom: either side may be open; a malformed day is dropped", () => {
  assert.deepEqual(dateWindow("custom", "2026-09-01", "2026-09-30", NOW), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(dateWindow("custom", "", "2026-09-30", NOW), { from: "", to: "2026-09-30" });
  assert.deepEqual(dateWindow("custom", "Sept 1", "2026-9-30", NOW), { from: "", to: "" });
});

test("inWindow: both bounds inclusive, a timestamp read by its day, a post with no date outside a set window", () => {
  const w = { from: "2026-09-01", to: "2026-09-30" };
  for (const d of ["2026-09-01", "2026-09-30T23:59:00Z", "2026-09-15"]) assert.equal(inWindow(d, w), true, d);
  for (const d of ["2026-08-31", "2026-10-01", ""]) assert.equal(inWindow(d, w), false, d || "no date");
  assert.equal(inWindow("", { from: "", to: "" }), true);
});

test("compare: high to low by default, a missing value last either way", () => {
  assert.deepEqual([3, null, 10, 1].sort((a, b) => compare(a, b, "desc")), [10, 3, 1, null]);
  assert.deepEqual([3, null, 10, 1].sort((a, b) => compare(a, b, "asc")), [1, 3, 10, null]);
  assert.deepEqual(["2026-01-02", "", "2026-03-01"].sort((a, b) => compare(a, b, "desc")), ["2026-03-01", "2026-01-02", ""]);
});
