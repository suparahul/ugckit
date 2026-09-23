#!/usr/bin/env node
/**
 * Phase 8, the sync (the `sync` skill): the posted link and the outcome numbers of
 * every sent post, through Monid, plus the provider's own analytics as a second source.
 *
 *   node scripts/posting-sync.mjs <slug> --all
 *   node scripts/posting-sync.mjs <slug> --date 2026-09-17
 *   node scripts/posting-sync.mjs <slug> --post <key>
 *   ... --no-monid   (Post Bridge only) skip the Monid link pull, numbers from the provider's own analytics only
 *
 * For a sent post without a link: the handle's latest posts through Monid (the profile
 * scraper, $0.00045 a post; under a cent for three posts), matched by caption and upload
 * time (atlas/lib/tiktok-link.ts); one match writes `posted.link` (and `posted` when
 * missing); several write nothing and print the candidates. Every linked post gets an
 * `outcome.sync` line: views, likes, comments, saves, shares, data.source "monid".
 * Post Bridge: atlas/scripts/postbridge-sync.mjs. Another provider: scripts/lib/posting/<p>.mjs.
 */
import { providerOf, runProvider } from "./lib/posting/index.mjs";
import { runAtlasScript } from "./lib/atlas-run.mjs";

const [slug, ...rest] = process.argv.slice(2);
if (!slug || slug.startsWith("--") || !rest.length) { console.error("usage: node scripts/posting-sync.mjs <slug> --all | --date YYYY-MM-DD | --post <key>"); process.exit(2); }
const provider = providerOf(slug, rest);
if (provider === "postbridge") runAtlasScript("postbridge-sync.mjs", [slug, ...rest]);
else await runProvider(provider, "sync", slug, rest);
