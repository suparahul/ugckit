#!/usr/bin/env node
/**
 * Writes apps/<slug>/production/posting-accounts.json: the plan's handles
 * (@example.one, @example.two, …) paired with the accounts connected in Post
 * Bridge. Each identity's HANDLE.md declares its accounts (the `## Accounts`
 * table: TikTok, and Instagram when it reposts there, each with its own name);
 * an account matches when the platform AND the username are the declared ones.
 * No table: one TikTok account with the handle's name. Asks nothing.
 * An account not connected yet is written as null, and the UI says "connect".
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
/* The declared accounts of each identity; lib/root.ts reads the workspace from ATLAS_ROOT. */
process.env.ATLAS_ROOT ??= WORKSPACE;
const { identitiesOf } = await import("../lib/accounts.ts");
const { PLATFORM_NAME } = await import("../lib/platform.ts");
const declared = new Map(identitiesOf(SLUG).map((i) => [i.handle.toLowerCase(), i]));
const identities = handles.map((h) => { const i = declared.get(h.toLowerCase()); return i ? { handle: h, accounts: i.accounts } : h; });

if (!hasKey()) {
  console.error(`${ENV_KEY} is not set. Put the key from the Post Bridge dashboard (API Keys) in the workspace .env:\n  ${ENV_KEY}=pb_live_…`);
  process.exit(1);
}

const accounts = await postBridge().listAccounts();
const file = { ...mapAccounts(identities, accounts), provider: "postbridge" };
for (const e of Object.values(file.accounts)) for (const a of Object.values(e?.platforms ?? {})) if (a) a.provider = "postbridge";
writeFileSync(OUT, JSON.stringify(file, null, 2) + "\n");

console.log(`Post Bridge lists ${accounts.length} account${accounts.length === 1 ? "" : "s"}:`);
for (const a of accounts) console.log(`  ${String(a.id).padStart(6)}  ${a.platform.padEnd(10)} @${a.username}${a.needs_reconnect ? "  (needs reconnect)" : ""}`);
console.log(`\nwrote ${OUT}`);
for (const h of handles) {
  const on = Object.entries(file.accounts[h]?.platforms ?? {});
  for (const [p, a] of on) {
    const label = on.length > 1 ? `${h} ${PLATFORM_NAME[p]}` : h;
    const want = declared.get(h.toLowerCase())?.accounts.find((d) => d.platform === p)?.account ?? h;
    console.log(`  ${label.padEnd(30)} ${a ? `→ account ${a.id} (@${a.username})${a.needs_reconnect ? " · needs a reconnect in Post Bridge" : ""}` : `not connected: connect the ${PLATFORM_NAME[p]} account ${want} in Post Bridge, then run this again`}`);
  }
}
if (file.unmatched.length) console.log(`  ${file.unmatched.length} connected account${file.unmatched.length === 1 ? "" : "s"} no identity declares: ${file.unmatched.map((a) => `${a.platform} @${a.username}`).join(", ")}. To use one, add its row to the identity's ## Accounts table (the handles skill, step 1), then run this again.`);
