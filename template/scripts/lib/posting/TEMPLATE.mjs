/**
 * The shape of a posting provider file, scripts/lib/posting/<name>.mjs. Copy this,
 * name it after the service (the word the plan's `Posting service:` line carries), and
 * fill the five operations from the service's API docs. The key is <NAME>_API_KEY in
 * the workspace .env, stored with `./ugckit key <name>`; never read it from the chat.
 *
 * What the kit gives each operation: the app slug and the raw argument list of the
 * launcher (--post <key>, --date YYYY-MM-DD, --send, --force, --direct, --at-local
 * "HH:MM Zone"). What the kit expects back: files and log lines, never a return value.
 *
 *   accounts    apps/<slug>/production/posting-accounts.json, one entry per platform account each identity
 *               declares (the `## Accounts` table of its HANDLE.md; no table: one TikTok account with
 *               the handle's name; atlas/lib/accounts.ts identitiesOf reads them). Match by platform AND
 *               username, never by a similar name:
 *               { "provider": "<name>", "accounts": { "@handle": { "primary": "tiktok", "platforms": {
 *                   "tiktok": { "id", "username", "platform", "provider": "<name>" } | null,
 *                   "instagram": { … } | null } } }, "unmatched": [ accounts no identity declares ] }
 *   send        for each selected post (final approved, mapped, not yet sent unless --force):
 *               upload apps/<slug>/production/files/<date>-<short>-<n>/final/slide-NN.png in order,
 *               the caption from final/caption.txt, create the post (draft by default; scheduled
 *               when --direct with the instant from --at-local), then append to log.jsonl:
 *               {"at", "post": "<key>", "kind": "posting.sent", "actor": "agent",
 *                "data": {"provider": "<name>", "mode": "draft"|"direct", "id": "<post id>", "media": [...], "scheduledAt": "<iso>"|null}}
 *               A post goes to every platform its handle declares (one leg each, at one time). With
 *               more than TikTok, the line also carries "legs": [{"platform", "account", "mode",
 *               "scheduledAt", "status"}]. The Instagram leg: always direct (no draft exists), the
 *               4:5 JPEG set in final/instagram/ (render-slides.mjs --instagram) and the same
 *               final/caption.txt as TikTok (no first comment); 10 slides at most. A leg the
 *               service refuses: {"kind": "posting.failed", "data": {"platform", "account",
 *               "error": "<the platform's words>"}}. --only tiktok|instagram sends one leg.
 *               Without --send: print the selection and send nothing.
 *   status      print the service's state of each sent post.
 *   sync        the posted url when the service returns one (append posted.link + posted), the
 *               service's numbers (append outcome.sync with data.source "<name>"); the Monid link
 *               match of atlas/lib/tiktok-link.ts can be reused for a TikTok draft the service cannot
 *               see. A line of another leg than TikTok carries "platform": "instagram"; a line with
 *               no platform is TikTok's.
 *   reschedule  move a scheduled post; append posting.rescheduled with the new instant.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const NAME = "template";                                   // the service's name, lowercase
const KEY = `${NAME.toUpperCase().replace(/-/g, "_")}_API_KEY`;

function key() {
  if (process.env[KEY]) return process.env[KEY];
  const env = join(ROOT, ".env");
  if (existsSync(env)) for (const l of readFileSync(env, "utf8").split("\n")) { const m = l.match(new RegExp(`^${KEY}=(.*)$`)); if (m && m[1].trim()) return m[1].trim(); }
  console.error(`${KEY} is not set: ./ugckit key ${NAME}`); process.exit(1);
}
const logOf = (slug) => join(ROOT, "apps", slug, "production", "log.jsonl");
const append = (slug, e) => appendFileSync(logOf(slug), JSON.stringify({ at: new Date().toISOString(), ...e }) + "\n");
const flag = (args, n) => args.includes(n);
const value = (args, n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

export async function accounts(slug, args) { key(); throw new Error("not written yet: list the connected accounts and write posting-accounts.json"); }
export async function send(slug, args) { key(); if (!flag(args, "--send")) { console.log("dry run: nothing sent"); return; } throw new Error("not written yet"); }
export async function status(slug, args) { key(); throw new Error("not written yet"); }
export async function sync(slug, args) { key(); throw new Error("not written yet"); }
export async function reschedule(slug, args) { key(); throw new Error("not written yet"); }
