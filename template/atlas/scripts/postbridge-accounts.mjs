#!/usr/bin/env node
/**
 * Writes apps/<slug>/production/posting-accounts.json: the plan's handles
 * (@example.one, @example.two, …) paired with the TikTok accounts connected
 * in Post Bridge, by username. Asks nothing. A handle that is not connected
 * yet is written as null, and the post page says "connect this account".
 *
 *   node scripts/postbridge-accounts.mjs <app slug>
 *
 * Needs POST_BRIDGE_API_KEY in the workspace .env (or the environment). The
 * file holds ids and usernames only, no secrets, and is committed.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ENV_KEY, hasKey, mapAccounts, postBridge, readKey } from "../lib/postbridge.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(ROOT, "..");
const SLUG = process.argv[2];
if (!SLUG || !/^[\w.-]+$/.test(SLUG)) { console.error("usage: node scripts/postbridge-accounts.mjs <app slug>"); process.exit(2); }
/* The key: the environment, else the workspace .env, else atlas/.env.local (see readKey). */
const key = readKey(process.env);
if (key) process.env[ENV_KEY] = key;

const OUT = join(WORKSPACE, "apps", SLUG, "production", "posting-accounts.json");
const prod = JSON.parse(readFileSync(join(ROOT, "data", `production-${SLUG}.json`), "utf8"));
const handles = Object.values(prod.plan.handles).map((h) => h.handle);

if (!hasKey()) {
  console.error(`${ENV_KEY} is not set. Put the key from the Post Bridge dashboard (API Keys) in the workspace .env:\n  ${ENV_KEY}=pb_live_…`);
  process.exit(1);
}

const accounts = await postBridge().listAccounts();
const file = mapAccounts(handles, accounts);
for (const h of Object.keys(file.accounts)) if (file.accounts[h]) file.accounts[h].provider = "postbridge";
writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n");

console.log(`Post Bridge lists ${accounts.length} account${accounts.length === 1 ? "" : "s"}:`);
for (const a of accounts) console.log(`  ${String(a.id).padStart(6)}  ${a.platform.padEnd(10)} @${a.username}${a.needs_reconnect ? "  (needs reconnect)" : ""}`);
console.log(`\nwrote ${OUT}`);
for (const h of handles) {
  const a = file.accounts[h];
  console.log(`  ${h.padEnd(20)} ${a ? `→ account ${a.id} (@${a.username})` : "not connected: connect this account in Post Bridge, then run this again"}`);
}
if (file.unmatched.length) console.log(`  ${file.unmatched.length} connected account${file.unmatched.length === 1 ? "" : "s"} match no handle in the plan: ${file.unmatched.map((a) => `${a.platform} @${a.username}`).join(", ")}`);
