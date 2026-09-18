#!/usr/bin/env node
/**
 * Phase 8, the first send (the `posting-provider` skill): map the plan's handles to the
 * accounts connected on the posting service, into apps/<slug>/production/posting-accounts.json
 * with `provider` on every account.
 *
 *   node scripts/posting-accounts.mjs <slug>                  the provider named in PLAN.md (postbridge by default)
 *   node scripts/posting-accounts.mjs <slug> --provider <p>   another provider: scripts/lib/posting/<p>.mjs must exist
 *
 * Post Bridge: needs POST_BRIDGE_API_KEY in the workspace .env (./ugckit key postbridge);
 * atlas/scripts/postbridge-accounts.mjs lists the connected accounts and writes the map.
 * A handle not connected yet is written as null and named in the output: the user
 * connects it on the service's side and runs this again. No cost.
 */
import { providerOf, runProvider } from "./lib/posting/index.mjs";
import { runAtlasScript } from "./lib/atlas-run.mjs";

const [slug, ...rest] = process.argv.slice(2);
if (!slug || slug.startsWith("--")) { console.error("usage: node scripts/posting-accounts.mjs <slug> [--provider <name>]"); process.exit(2); }
const provider = providerOf(slug, rest);
if (provider === "postbridge") runAtlasScript("postbridge-accounts.mjs", [slug]);
else await runProvider(provider, "accounts", slug, rest);
