#!/usr/bin/env node
/**
 * The outcome sync for the posts sent through Post Bridge, two sources, one
 * pass (lib/postbridge-flow.ts syncAll — the same as the post page's "Sync outcomes"):
 *
 *   1. "find the link" through Monid (lib/tiktok-link.ts): for every sent post
 *      without a TikTok link in the log, the handle's latest posts are fetched
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
 *   ... --no-monid                                         skip step 1 (Monid) entirely — Post Bridge's own analytics only, no Monid cost
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

const { ENV_KEY, readKey } = await import("../lib/postbridge.ts");
const { syncAll } = await import("../lib/postbridge-flow.ts");

const key = readKey(process.env);
if (key) process.env[ENV_KEY] = key;

const SLUG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/postbridge-sync.mjs <app slug> --all | --date YYYY-MM-DD | --post <key>"); process.exit(2); }
const args = process.argv.slice(3);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const post = value("--post");
const date = value("--date");
const noMonid = args.includes("--no-monid");
if (!post && !date && !args.includes("--all")) { console.error("usage: node scripts/postbridge-sync.mjs --all | --date YYYY-MM-DD | --post <key> [--no-monid]"); process.exit(2); }

const { links, refreshed, reports, postBridgeError } = await syncAll(SLUG, post ? { keys: [post] } : date ? { date } : {}, { noMonid });
if (!links.length && !noMonid) { console.log(post ? `${post}: not sent through Post Bridge` : date ? `${date}: no post sent through Post Bridge` : "No post was sent through Post Bridge yet."); process.exit(0); }

if (noMonid) console.log("Monid — skipped (--no-monid).");
else {
  console.log("Monid — the link and the numbers:");
  for (const l of links) {
    const o = l.outcome;
    const nums = o ? `${o.views} views · ${o.likes} likes · ${o.comments} comments · ${o.saves} saves · ${o.shares} shares` : "no numbers";
    console.log(`  ${l.post.padEnd(26)} ${l.status.padEnd(7)} ${l.url ?? "—"}`);
    console.log(`  ${"".padEnd(26)} ${nums}  (${l.note})`);
    if (l.status === "many" || l.status === "none") for (const c of l.candidates) console.log(`  ${"".padEnd(26)}   candidate ${c.url} · ${c.uploadedAt} · ${Math.round(c.score * 100)}% · “${c.title.split("\n")[0].slice(0, 60)}”`);
  }
}

console.log("Post Bridge — the second source:");
if (postBridgeError) console.log(`  not read: ${postBridgeError}`);
else {
  const platforms = [...new Set(reports.map((r) => r.platform ?? "tiktok"))].map((p) => (p === "instagram" ? "Instagram" : "TikTok")).join(" and ") || "TikTok";
  console.log(refreshed ? `  Post Bridge pulled fresh numbers from ${platforms}.` : "  Post Bridge is on its 30-minute cooldown; the numbers are the last it holds.");
  for (const r of reports) {
    const o = r.outcome;
    const leg = r.platform ? ` ${r.platform}` : reports.some((x) => x.post === r.post && x.platform) ? " tiktok" : "";
    console.log(`  ${`${r.post}${leg}`.padEnd(reports.some((x) => x.platform) ? 36 : 26)} ${r.result.padEnd(14)} ${o ? `${o.views} views · ${o.likes} likes · ${o.comments} comments · ${o.shares} shares${r.platform === "instagram" ? " · saves not reported on Instagram" : ""}` : "no numbers yet"}  (${r.note})`);
  }
}
process.exit(links.some((l) => l.status === "error") ? 1 : 0);
