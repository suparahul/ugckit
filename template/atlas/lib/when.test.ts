/** The zone helpers: New York in summer and winter, Kolkata beside it. `npm test`. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { fmtBoth, fmtIn, KOLKATA, NY, parseAt, parseAtLocal, setZones, zonedToUtc } from "./when.ts";

test("zonedToUtc: 19:00 New York is 23:00Z in September (EDT) and 00:00Z next day in December (EST)", () => {
  assert.equal(zonedToUtc("2026-09-17", "19:00", NY), "2026-09-17T23:00:00.000Z");
  assert.equal(zonedToUtc("2026-12-17", "19:00", NY), "2026-12-18T00:00:00.000Z");
  assert.equal(zonedToUtc("2026-09-18", "04:30", KOLKATA), "2026-09-17T23:00:00.000Z");
});

test("parseAtLocal and parseAt agree; a time without a zone is refused", () => {
  assert.equal(parseAtLocal("19:00 America/New_York", "2026-09-17"), "2026-09-17T23:00:00.000Z");
  assert.equal(parseAtLocal("2026-09-18 19:00 America/New_York", "2026-09-17"), "2026-09-18T23:00:00.000Z");
  assert.equal(parseAt("2026-09-17T19:00:00-04:00"), "2026-09-17T23:00:00.000Z");
  assert.throws(() => parseAt("2026-09-17T19:00:00"), /with its zone/);
  assert.throws(() => parseAtLocal("7pm New York", "2026-09-17"), /wants/);
  assert.throws(() => parseAtLocal("19:00 Mars/Olympus", "2026-09-17"), /Unknown zone/);
});

test("fmtIn and fmtBoth", () => {
  setZones(NY, KOLKATA);
  assert.equal(fmtIn("2026-09-17T23:00:00.000Z", NY, "ET"), "2026-09-17 19:00 ET");
  assert.equal(fmtBoth("2026-09-17T23:00:00.000Z"), "Thu 19:00 ET (Fri 04:30 IST)");
  assert.equal(fmtBoth("2026-09-17T12:00:00.000Z"), "Thu 08:00 ET (Thu 17:30 IST)");
  setZones(NY, NY);
  assert.equal(fmtBoth("2026-09-17T23:00:00.000Z"), "Thu 19:00 ET");
  setZones(null, null);
  assert.equal(fmtIn("2026-09-16T23:00:00.000Z", NY, "ET", true), "Wed 2026-09-16 19:00 ET");
});
