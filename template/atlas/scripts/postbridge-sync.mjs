#!/usr/bin/env node
/**
 * The outcome sync for the posts sent through Post Bridge, two sources, one
 * pass (lib/postbridge-flow.ts syncAll — the same as the post page's "Sync outcomes"):
 *
 *   1. "find the link" (lib/tiktok-link.ts). A post Post Bridge published live
 *      (a direct send) takes its link from Post Bridge, with no Monid call; when
 *      Post Bridge has not filled the post id yet, run the sync again later.
 *      For any other sent post without a TikTok link in the log (a draft
 *      published by hand from the phone), the handle's latest posts are fetched
 *      through Monid (cents per call), matched by caption and upload time; one
 *      match writes `posted.link` (+ `posted` when none exists) — more than one
 *      writes nothing and prints the candidates. Every linked post then gets an
 *      `outcome.sync` line from its Monid record: views, likes, comments, saves,
 *      shares (data.source "monid"), when the numbers changed.
 *   2. the Post Bridge analytics, as a second source when it has data (no saves;
 *      rarely anything for a draft published from the phone).
 *
 * An Instagram leg (a post sent to TikTok and Instagram) needs no Monid call:
 * its link, its post time and its numbers come from Post Bridge, one
 * `outcome.sync` line with data.platform "instagram" (views, likes, comments,
 * shares; no source gives Instagram's saves). A failed Instagram leg is written
 * once as `posting.failed`, with Instagram's own words.
 *
 *   node scripts/postbridge-sync.mjs --all                 every sent post
 *   node scripts/postbridge-sync.mjs --date 2026-09-17     the sent posts of that date
 *   node scripts/postbridge-sync.mjs --post <key>          one post
 *   ... --no-monid                                         no Monid call at all: the Post Bridge links are still written,
 *                                                           a post only Monid can link is reported as skipped
 *   ... --refresh-stats                                    fetch every handle in scope from Monid on purpose, even one with nothing
 *                                                           unlinked, so an older post's numbers (saves included) get refreshed too —
 *                                                           the plan (maxItems and the cost estimate per handle) prints first
 *   ... --monid-runs <id,id>                               no new paid Monid call: read each handle's posts from these saved runs
 *                                                           (`monid runs list`; `monid runs get` is free); a handle with no saved
 *                                                           run among them is reported as an error
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const { ENV_KEY, readKey } = await import("../lib/postbridge.ts");
const { syncAll } = await import("../lib/postbridge-flow.ts");
const { monidFetchPlan } = await import("../lib/tiktok-link.ts");

const key = readKey(process.env);
if (key) process.env[ENV_KEY] = key;

const SLUG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/postbridge-sync.mjs <app slug> --all | --date YYYY-MM-DD | --post <key>"); process.exit(2); }
const args = process.argv.slice(3);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const post = value("--post");
const date = value("--date");
const noMonid = args.includes("--no-monid");
const refreshStats = args.includes("--refresh-stats");
const runIds = (value("--monid-runs") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
if (!post && !date && !args.includes("--all")) { console.error("usage: node scripts/postbridge-sync.mjs --all | --date YYYY-MM-DD | --post <key> [--no-monid] [--refresh-stats] [--monid-runs <id,id>]"); process.exit(2); }

const sel = post ? { keys: [post] } : date ? { date } : {};

if (runIds.length && !noMonid) console.log(`Monid — reading ${runIds.length} saved run${runIds.length === 1 ? "" : "s"} (${runIds.join(", ")}); no new paid call.`);
else if (refreshStats && !noMonid) {
  const plan = monidFetchPlan(SLUG, sel, { refreshStats: true });
  console.log("Monid — the plan (maxItems and the cost estimate, per handle, before spending anything):");
  let total = 0;
  for (const p of plan) { console.log(`  ${p.handle.padEnd(20)} maxItems ${String(p.maxItems).padEnd(5)} ~$${p.costEstimate.toFixed(4)}`); total += p.costEstimate; }
  console.log(`  total: ~$${total.toFixed(4)}`);
}

const { links, refreshed, reports, postBridgeError } = await syncAll(SLUG, sel, { noMonid, refreshStats, monidRuns: runIds });
if (!links.length) { console.log(post ? `${post}: not sent through Post Bridge nor posted on TikTok by hand` : date ? `${date}: no post sent through Post Bridge or posted on TikTok by hand` : "No post was sent through Post Bridge or posted on TikTok by hand yet."); process.exit(0); }

console.log(noMonid ? "The link — Post Bridge only (--no-monid, no Monid call):" : "The link (Post Bridge for a direct send, Monid otherwise) and the Monid numbers:");
for (const l of links) {
  const o = l.outcome;
  const nums = o ? `${o.views} views · ${o.likes} likes · ${o.comments} comments · ${o.saves} saves · ${o.shares} shares` : "no numbers";
  console.log(`  ${l.post.padEnd(26)} ${l.status.padEnd(7)} ${l.url ?? "—"}`);
  console.log(`  ${"".padEnd(26)} ${nums}  (${l.note})`);
  if (l.status === "many" || l.status === "none") for (const c of l.candidates) console.log(`  ${"".padEnd(26)}   candidate ${c.url} · ${c.uploadedAt} · ${Math.round(c.score * 100)}% · “${c.title.split("\n")[0].slice(0, 60)}”`);
}

console.log("Post Bridge — the second source:");
if (postBridgeError) console.log(`  not read: ${postBridgeError}`);
else {
  const platforms = [...new Set(reports.map((r) => r.platform ?? "tiktok"))].map((p) => (p === "instagram" ? "Instagram" : "TikTok")).join(" and ") || "TikTok";
  console.log(refreshed ? `  Post Bridge pulled fresh numbers from ${platforms}.` : "  Post Bridge is on its 30-minute cooldown; the numbers are the last it holds.");
  const labelled = reports.some((x) => x.platform);
  /* A TikTok leg Monid read too: Atlas shows Monid's numbers, so say so when Post Bridge's differ (its analytics lag). */
  const monidViews = new Map(links.filter((l) => l.outcome).map((l) => [l.post, l.outcome.views]));
  for (const r of reports) {
    const o = r.outcome;
    const leg = labelled ? ` ${r.platform ?? "tiktok"}` : "";
    const other = !r.platform && o && monidViews.has(r.post) && monidViews.get(r.post) !== o.views ? `; Atlas shows Monid's ${monidViews.get(r.post)} views` : "";
    console.log(`  ${`${r.post}${leg}`.padEnd(labelled ? 36 : 26)} ${r.result.padEnd(14)} ${o ? `${o.views} views · ${o.likes} likes · ${o.comments} comments · ${o.shares} shares${r.platform === "instagram" ? " · saves not reported on Instagram" : ""}` : "no numbers yet"}  (${r.note}${other})`);
  }
}
process.exit(links.some((l) => l.status === "error") ? 1 : 0);
