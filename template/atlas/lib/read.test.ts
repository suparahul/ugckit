/**
 * The periods of the numbers card (lib/read.ts): calendar weeks Monday to
 * Sunday, calendar months, the column window of the week and month views, and
 * views added up per span. No file, no network. Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { PostState } from "./production.ts";
import { addMonths, calendarWeek, monthEnd, monthStart, readOf, spansOf, spanViews } from "./read.ts";

test("calendar week: Monday to Sunday, the same seven days for every day in it", () => {
  const week = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
  for (const d of week) assert.deepEqual(calendarWeek(d), week);
  assert.deepEqual(calendarWeek("2026-09-28").slice(0, 1), ["2026-09-28"]);
  /* A week across two months and across a year end. */
  assert.deepEqual([calendarWeek("2026-10-01")[0], calendarWeek("2026-10-01")[6]], ["2026-09-28", "2026-10-04"]);
  assert.deepEqual([calendarWeek("2027-01-01")[0], calendarWeek("2027-01-01")[6]], ["2026-12-28", "2027-01-03"]);
});

test("months: the first and last day, and steps across a year end", () => {
  assert.equal(monthStart("2026-09-24"), "2026-09-01");
  assert.equal(monthEnd("2026-09-24"), "2026-09-30");
  assert.equal(monthEnd("2028-02-10"), "2028-02-29");
  assert.equal(addMonths("2026-09-24", 1), "2026-10-01");
  assert.equal(addMonths("2026-01-31", -1), "2025-12-01");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-01");
});

test("week columns: eight Mondays ending at the current week, the window fixed while stepping inside it", () => {
  const cols = spansOf("week", "2026-09-21", "2026-09-25", 8);
  assert.equal(cols.length, 8);
  assert.equal(cols[7].from, "2026-09-21");
  assert.equal(cols[7].to, "2026-09-27");
  assert.equal(cols[0].from, "2026-08-03");
  assert.deepEqual(spansOf("week", "2026-08-03", "2026-09-25", 8), cols);
  /* Past the window's first week, the window moves back by a whole window. */
  const older = spansOf("week", "2026-07-27", "2026-09-25", 8);
  assert.equal(older[7].from, "2026-07-27");
  assert.equal(older[0].from, "2026-06-08");
  /* A week after the current one ends the window. */
  assert.equal(spansOf("week", "2026-10-05", "2026-09-25", 8)[7].from, "2026-10-05");
});

test("month columns: six months ending at the current month", () => {
  const cols = spansOf("month", "2026-09-01", "2026-09-25", 6);
  assert.deepEqual(cols.map((c) => c.from), ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]);
  assert.equal(cols[5].to, "2026-09-30");
  assert.equal(spansOf("month", "2026-02-01", "2026-09-25", 6)[5].from, "2026-03-01");
});

const post = (date: string, views: number | null, extra: Partial<PostState> = {}): PostState =>
  ({ row: { date }, posted: { at: `${date}T10:00:00.000Z` }, log: [], synced: views === null ? undefined : { views, likes: 0, comments: 0, saves: 1, shares: 0, source: "monid", at: `${date}T12:00:00.000Z` }, ...extra }) as unknown as PostState;

test("views per span: the sum, unread, or nothing posted; killed posts do not count", () => {
  const states = [post("2026-09-14", 100), post("2026-09-20", 50), post("2026-09-21", null), post("2026-09-22", 7, { killed: { at: "2026-09-22T11:00:00.000Z", note: "test" } })];
  const spans = spansOf("week", "2026-09-21", "2026-09-25", 3);
  assert.deepEqual(spanViews(states, spans), { "2026-09-07": null, "2026-09-14": 150, "2026-09-21": "unread" });
  /* The week-over-week change reads the previous week the same way. */
  assert.equal(readOf(states.filter((s) => s.row.date >= "2026-09-14" && s.row.date <= "2026-09-20")).views, 150);
});
