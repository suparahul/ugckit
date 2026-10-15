#!/usr/bin/env node
/**
 * The one-time backfill of the current outcome records (lib/outcome.ts). For
 * every post leg that has `outcome.sync` lines and no `outcome.current` line
 * yet, it folds those lines in read-time order through the sync's own merge
 * and appends one `outcome.current` line (actor "backfill"): each field holds
 * its newest number, with its source and read time. A leg that has a record
 * already is left as it is, so a second run writes nothing.
 *
 * The log is copied to log.jsonl.bak-<today>-outcome-current first. No network.
 * (The sync does the same for one leg the first time it writes it; this script
 * does every leg at once, so the Atlas shows the right numbers before the next sync.)
 *
 *   node scripts/outcome-backfill.mjs <app slug>            write
 *   node scripts/outcome-backfill.mjs <app slug> --dry-run  print what it would write
 */

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const { appendEvent, readLog, storeOf } = await import("../lib/production.ts");
const { backfillOutcome } = await import("../lib/outcome.ts");
const { linePlatform } = await import("../lib/platform.ts");

const SLUG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/outcome-backfill.mjs <app slug> [--dry-run]"); process.exit(2); }
const dry = process.argv.includes("--dry-run");

const log = readLog(SLUG);
const legs = new Map();
for (const e of log) {
  if (!e.post || (e.kind !== "outcome.sync" && e.kind !== "outcome.current")) continue;
  const k = `${e.post}\u0000${linePlatform(e.data)}`;
  const x = legs.get(k) ?? { post: e.post, platform: linePlatform(e.data), lines: [], current: false };
  if (e.kind === "outcome.current") x.current = true;
  else x.lines.push(e);
  legs.set(k, x);
}
const todo = [...legs.values()].filter((x) => !x.current && x.lines.length);
if (!todo.length) { console.log(`${SLUG}: every leg with outcome lines has its current record; nothing to write.`); process.exit(0); }

if (!dry) {
  const file = join(storeOf(SLUG), "log.jsonl");
  const bak = `${file}.bak-${new Date().toISOString().slice(0, 10)}-outcome-current`;
  if (!existsSync(bak)) copyFileSync(file, bak);
  console.log(`backup: ${bak}`);
}
for (const x of todo) {
  const rec = backfillOutcome(x.lines, x.platform);
  if (!rec) continue;
  if (!dry) appendEvent(SLUG, { post: x.post, kind: "outcome.current", actor: "backfill", data: rec });
  const src = Object.entries(rec.fields).map(([k, m]) => `${k} ${m.source}`).join(", ");
  console.log(`  ${`${x.post} ${x.platform}`.padEnd(40)} ${String(rec.views ?? "—").padStart(7)} views · ${rec.saves ?? "—"} saves  (${x.lines.length} lines; ${src})`);
}
console.log(`${dry ? "would write" : "wrote"} ${todo.length} current record${todo.length === 1 ? "" : "s"}.`);
