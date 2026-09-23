#!/usr/bin/env node
/**
 * Sends finished posts through Post Bridge: the same lib function as the post
 * page's buttons (lib/postbridge-flow.ts sendPosts). Two modes:
 *   draft   (default) to the TikTok account's inbox drafts; the phone publishes.
 *   direct  a scheduled post at a set instant; Post Bridge publishes it, public,
 *           comments on, TikTok picks the sound; the cover slide is rendered
 *           with its text burned in (render-slides.mjs --burn-cover).
 *
 *   node scripts/postbridge-send.mjs                       dry run for today: prints what would be sent, sends nothing
 *   node scripts/postbridge-send.mjs --date 2026-09-17     dry run for that date
 *   node scripts/postbridge-send.mjs --post <key>          dry run for one post
 *   node scripts/postbridge-send.mjs --date … --send       sends
 *   node scripts/postbridge-send.mjs --post <key> --send --force   sends a post that was sent before
 *   node scripts/postbridge-send.mjs --date 2026-09-17 --direct --at "2026-09-17T19:00:00-04:00"
 *   node scripts/postbridge-send.mjs --date 2026-09-17 --direct --at-local "19:00 America/New_York"
 *                                                          direct, at that wall-clock time of the date (--at-local is sugar for --at;
 *                                                          "2026-09-18 19:00 America/New_York" names another day)
 *   node scripts/postbridge-send.mjs --post <key> --post <key> …   several posts (--post repeats)
 *   node scripts/postbridge-send.mjs --post <key> --only instagram --send   one leg only: the retry of a failed Instagram
 *                                                          leg, or --only tiktok for a deck Instagram cannot take
 *
 * Two platforms: a post goes to every platform its plan row names (the `Platforms`
 * cell, else the plan's `Platforms:` line, else TikTok), each on the account the
 * identity declares (posting-accounts.json). One Post Bridge post carries every
 * leg, at one time. Instagram has no drafts: its leg publishes when the post is
 * processed, so in draft mode it publishes the moment this sends, and the dry run
 * says so. Its slides are the 4:5 JPEG set (render-slides.mjs --instagram), its
 * caption has no hashtags, and the hashtags are its first comment. A deck over
 * 10 slides with an Instagram leg is not sent: cut the deck, or --only tiktok.
 *
 * Selection: the posts of the date (or the one named) whose final is approved,
 * whose account is mapped in production/postbridge-accounts.json, and which
 * have no postbridge.sent line yet (--force allows a second send). For each:
 * the compositor, the uploads in slide order, one TikTok photo post (draft or
 * scheduled direct) with the caption, one postbridge.sent line with mode and
 * scheduledAt. Exit 1 when any send failed.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT); /* lib/production.ts reads ../production and data/ from the working directory */

const { ENV_KEY, hasKey, readKey } = await import("../lib/postbridge.ts");
const { sendPosts } = await import("../lib/postbridge-flow.ts");
const { fmtBoth, hoursAhead, parseAt, parseAtLocal } = await import("../lib/when.ts");

const key = readKey(process.env);
if (key) process.env[ENV_KEY] = key;

const SLUG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/postbridge-send.mjs <app slug> [--date YYYY-MM-DD | --post <key>] [--send] [--force] [--direct --at <iso> | --at-local \"HH:MM Zone\"]"); process.exit(2); }
const args = process.argv.slice(3);
const flag = (n) => args.includes(n);
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const values = (n) => args.flatMap((a, i) => (a === n && args[i + 1] ? [args[i + 1]] : []));
const send = flag("--send");
const force = flag("--force");
const posts = values("--post");
const post = posts.length ? posts.join(", ") : undefined;
const date = post ? undefined : value("--date") ?? new Date().toISOString().slice(0, 10);
const direct = flag("--direct");
const only = value("--only");
if (only !== undefined && only !== "tiktok" && only !== "instagram") { console.error("--only takes tiktok or instagram."); process.exit(2); }
if (flag("--dry-run") && send) { console.error("--dry-run and --send together: pick one."); process.exit(2); }
if ((value("--at") || value("--at-local")) && !direct) { console.error("--at / --at-local need --direct."); process.exit(2); }

let at;
if (direct) {
  try {
    if (value("--at")) at = parseAt(value("--at"));
    else if (value("--at-local")) at = parseAtLocal(value("--at-local"), date ?? new Date().toISOString().slice(0, 10));
    else throw new Error('--direct needs --at "<ISO time with zone>" or --at-local "HH:MM Zone/Name"');
  } catch (e) { console.error(e.message); process.exit(2); }
}

if (!hasKey()) { console.error(`${ENV_KEY} is not set. Put the key from the Post Bridge dashboard (API Keys) in the workspace .env.`); process.exit(2); }

const sel = post ? { keys: posts } : { date };
const { plans, results } = await sendPosts(SLUG, { ...sel, force, dryRun: !send, mode: direct ? "direct" : "draft", at, ...(only ? { only } : {}) });

const when = at ? `at ${fmtBoth(at)} = ${at} (in ${hoursAhead(at).toFixed(1)} h)` : "";
console.log(`${send ? "Sending" : "Dry run"} ${post ? post : `for ${date}`}, mode ${direct ? "direct" : "draft"}${when ? ` ${when}` : ""}: ${plans.length} post${plans.length === 1 ? "" : "s"}, ${plans.filter((p) => !p.skip).length} to send`);
for (const p of plans) {
  const head = `  ${p.key.padEnd(26)} ${p.handle.padEnd(18)} account ${String(p.account ?? "—").padEnd(6)} ${String(p.slides).padStart(2)} slides  final ${p.finalStatus.padEnd(9)} “${p.caption}”`;
  console.log(p.skip ? `${head}\n      skipped: ${p.skip}` : head);
  /* The legs, when there is more than TikTok. */
  if (p.legs.length > 1 || p.legs.some((l) => l.platform !== "tiktok")) {
    for (const l of p.legs) console.log(`      ${l.platform.padEnd(9)} account ${String(l.account ?? "—").padEnd(6)} ${l.skip ? `left out: ${l.skip}` : l.platform === "instagram" ? "published by Post Bridge · 4:5 JPEG slides, cover text burned, hashtags in the first comment, no music (add it in the Instagram app: Edit, then Replace Audio)" : p.mode === "direct" ? "published by Post Bridge" : "to the TikTok drafts"}`);
  }
  for (const w of p.warnings) console.log(`      ! ${w}`);
  if (p.mode === "direct") {
    console.log(`      ${p.scheduledAt ? fmtBoth(p.scheduledAt) : "no time"} · public · comments on · sound by TikTok`);
    console.log(`      slide 1 text burned in: ${p.coverText.length ? p.coverText.map((t) => `“${t.replace(/\n/g, " / ")}”`).join(" + ") : "(slide 1 has no text)"}`);
  } else console.log(`      slide 1 text typed by hand: ${p.coverText.length ? p.coverText.map((t) => `“${t.replace(/\n/g, " / ")}”`).join(" + ") : "(none)"}`);
}
if (!send) {
  console.log(plans.some((p) => !p.skip) ? "\nNothing was sent. Add --send to send." : "\nNothing to send.");
  process.exit(0);
}

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ${r.key.padEnd(26)} sent · Post Bridge post ${r.id} · ${r.status}`);
    for (const w of r.warnings ?? []) console.log(`      Post Bridge: ${w}`);
    if (plans.find((p) => p.key === r.key)?.legs.some((l) => l.platform === "instagram" && !l.skip)) console.log("      Instagram: the post has no music. Once it is live, add it in the Instagram app: Edit, then Replace Audio.");
  }
  else { failed++; console.log(`  ${r.key.padEnd(26)} FAILED · ${r.error}`); }
}
if (!results.length) console.log("Nothing was sent.");
process.exit(failed ? 1 : 0);
