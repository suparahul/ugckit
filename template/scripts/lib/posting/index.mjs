/**
 * The posting provider, pluggable (SYSTEM.md § 9.2). The plan's `Posting service:` line
 * names it; `postbridge` is the default and is served by the Atlas's own scripts.
 * Another service is one file, scripts/lib/posting/<name>.mjs, written by the agent at
 * the first send from the service's API docs, with the five operations the kit needs:
 *
 *   export async function accounts(slug, args)     list the connected accounts, write posting-accounts.json (provider: "<name>")
 *   export async function send(slug, args)         the posts of --post/--date: upload the final slides, create the post
 *                                                  (draft by default, --direct --at-local for a scheduled one), append posting.sent
 *   export async function status(slug, args)       read the state of a sent post (scheduled, published, failed)
 *   export async function sync(slug, args)         the posted link and the outcomes -> posted.link, posted, outcome.sync
 *   export async function reschedule(slug, args)   move a scheduled post, append posting.rescheduled
 *
 * Each takes the slug and the raw argument list, reads the key from the workspace .env
 * (<NAME>_API_KEY, stored with ./ugckit key <name>), and prints what it did. A dry run
 * (no --send) must send nothing. See TEMPLATE.mjs for the shape.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The provider: --provider <name> on the command line (removed from the args), else posting-accounts.json, else the plan's line, else postbridge. */
export function providerOf(slug, args) {
  const i = args.indexOf("--provider");
  if (i >= 0 && args[i + 1]) { const name = args[i + 1].toLowerCase(); args.splice(i, 2); return name; }
  const map = join(ROOT, "apps", slug, "production", "posting-accounts.json");
  if (existsSync(map)) {
    try {
      const j = JSON.parse(readFileSync(map, "utf8"));
      const p = j.provider ?? Object.values(j.accounts ?? {}).find((a) => a?.provider)?.provider;
      if (p) return String(p).toLowerCase();
    } catch { /* fall through to the plan */ }
  }
  const plan = join(ROOT, "apps", slug, "production", "PLAN.md");
  if (existsSync(plan)) {
    const m = readFileSync(plan, "utf8").match(/^\**Posting service\**:\**\s*(.+?)\s*$/mi);
    if (m) return m[1].replace(/`/g, "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  }
  return "postbridge";
}

export async function runProvider(name, op, slug, args) {
  const file = join(ROOT, "scripts", "lib", "posting", `${name}.mjs`);
  if (!existsSync(file)) {
    console.error(`no provider file for "${name}": scripts/lib/posting/${name}.mjs. The posting-provider skill writes it from the service's API docs (see TEMPLATE.mjs).`);
    process.exit(1);
  }
  const mod = await import(file);
  if (typeof mod[op] !== "function") { console.error(`scripts/lib/posting/${name}.mjs has no ${op}() -- the five operations are accounts, send, status, sync, reschedule`); process.exit(1); }
  await mod[op](slug, args);
}
