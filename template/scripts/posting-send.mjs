#!/usr/bin/env node
/**
 * Phase 8, the send (the `post` skill): one post, or a day's posts, through the
 * provider PLAN.md names. Dry run by default; nothing leaves without --send.
 *
 *   node scripts/posting-send.mjs <slug> --post <key>                     dry run: what would be sent
 *   node scripts/posting-send.mjs <slug> --post <key> --send              draft mode: the media lands in the TikTok inbox
 *   node scripts/posting-send.mjs <slug> --date 2026-09-17 --send         every approved post of the day
 *   node scripts/posting-send.mjs <slug> --post <key> --send --direct --at-local "19:00 America/New_York"
 *                                                                          direct mode: scheduled, TikTok picks the sound,
 *                                                                          the cover text burned in
 *   node scripts/posting-send.mjs <slug> --post <key> --send --force      a post that was sent before
 *
 * Selection: the posts whose final is approved (final.approve in the log), whose handle
 * is mapped in posting-accounts.json, with no posting.sent line yet. For each: the
 * compositor, the uploads in slide order, one photo post, one `posting.sent` log line
 * with the provider, the mode and the media ids. Exit 1 when a send failed.
 * Post Bridge: atlas/scripts/postbridge-send.mjs. Another provider: scripts/lib/posting/<p>.mjs.
 */
import { providerOf, runProvider } from "./lib/posting/index.mjs";
import { runAtlasScript } from "./lib/atlas-run.mjs";

const [slug, ...rest] = process.argv.slice(2);
if (!slug || slug.startsWith("--")) { console.error("usage: node scripts/posting-send.mjs <slug> [--post <key> | --date YYYY-MM-DD] [--send] [--force] [--direct --at-local \"HH:MM Zone\"]"); process.exit(2); }
const provider = providerOf(slug, rest);
if (provider === "postbridge") runAtlasScript("postbridge-send.mjs", [slug, ...rest]);
else await runProvider(provider, "send", slug, rest);
