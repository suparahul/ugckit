/**
 * The accounts an identity posts from: the `## Accounts` table of its
 * HANDLE.md, one row per platform. The two accounts of one identity may have
 * different names (@hannah.catmom on TikTok, @hannah.catmom_ on Instagram),
 * which is why the table exists: no rule derives one name from the other.
 *
 *     ## Accounts
 *
 *     | Platform | Account | Created | Role | Status |
 *     |---|---|---|---|---|
 *     | tiktok | @hannah.catmom | 2026-09-14 | primary | connected |
 *     | instagram | @hannah.catmom_ | 2026-09-22 | repost | connected |
 *
 * No table: one account, from the `Handle:`, `Platform:` and `Created:` head
 * lines, so every HANDLE.md written before this reads as it did. The Status
 * cell is for the eye; the truth is posting-accounts.json.
 *
 * Pure apart from reading the files: the scripts import it too.
 */

import { statSync } from "node:fs";
import { join } from "node:path";

import { PLATFORMS, platformOf, type Platform } from "./platform.ts";
import { appDir, headLines, listDirs, readText, sectionOf, tableRows, titleOf } from "./root.ts";

export type DeclaredAccount = {
  platform: Platform;
  /** `@name` on that platform. */
  account: string;
  created: string | null;
  /** `primary` is the account `Handle:` names and the plan's short name resolves to. Exactly one. */
  role: "primary" | "repost";
};

/** The handle a HANDLE.md names: `Handle:`, else the `@name` in its title, else the folder name. */
export function handleOf(md: string, dir: string): string {
  const head = headLines(md);
  const fromTitle = (titleOf(md) ?? "").match(/@([\w.]+)/)?.[1];
  return `@${(head["Handle"] ?? "").replace(/^@/, "") || fromTitle || dir.replace(/^@/, "")}`;
}

const at = (s: string) => `@${s.replace(/`/g, "").trim().replace(/^@/, "")}`;
const dateOf = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s.trim()) ? s.trim().slice(0, 10) : null);

/** The declared accounts of one HANDLE.md, TikTok first. */
export function declaredAccounts(md: string, dir = ""): DeclaredAccount[] {
  const head = headLines(md);
  const handle = handleOf(md, dir);
  const rows = tableRows(sectionOf(md, /^Accounts\b/i) ?? "");
  const out: DeclaredAccount[] = [];
  for (const r of rows) {
    const platform = platformOf(r["Platform"]);
    const name = (r["Account"] ?? "").trim();
    if (!platform || !name || !r["Platform"]?.trim() || out.some((a) => a.platform === platform)) continue;
    out.push({ platform, account: at(name), created: dateOf(r["Created"]), role: /primary/i.test(r["Role"] ?? "") ? "primary" : "repost" });
  }
  if (!out.length) return [{ platform: platformOf(head["Platform"]) ?? "tiktok", account: handle, created: dateOf(head["Created"]), role: "primary" }];
  /* Exactly one primary: the one marked, else the account `Handle:` names, else TikTok's, else the first. */
  const marked = out.filter((a) => a.role === "primary");
  const primary = marked[0] ?? out.find((a) => a.account.toLowerCase() === handle.toLowerCase()) ?? out.find((a) => a.platform === "tiktok") ?? out[0];
  for (const a of out) a.role = a === primary ? "primary" : "repost";
  return PLATFORMS.flatMap((p) => out.filter((a) => a.platform === p));
}

export type Identity = { dir: string; handle: string; accounts: DeclaredAccount[]; /** The `Slots:` head line ("AM 11:00, PM 19:00"), or null. */ slots: string | null };

/** Every identity of an app with its declared accounts, in folder order. */
export function identitiesOf(slug: string): Identity[] {
  if (!/^[\w.-]+$/.test(slug)) return [];
  return listDirs(join(appDir(slug), "handles"))
    .filter((d) => !/^EXAMPLE$/i.test(d))
    .flatMap((dir) => {
      const md = readText(join(appDir(slug), "handles", dir, "HANDLE.md"));
      return md === null ? [] : [{ dir, handle: handleOf(md, dir), accounts: declaredAccounts(md, dir), slots: headLines(md)["Slots"] ?? null }];
    });
}

/* Cached per app on the HANDLE.md files' times: allStates asks once per post. */
const platformCache = new Map<string, { stamp: string; map: Map<string, Platform[]> }>();

/** The platforms each handle posts on, by its lowercase `@handle`: its declared accounts. */
export function declaredPlatforms(slug: string): Map<string, Platform[]> {
  const dirs = listDirs(join(appDir(slug), "handles"));
  const stamp = dirs.map((d) => { try { return `${d}:${statSync(join(appDir(slug), "handles", d, "HANDLE.md")).mtimeMs}`; } catch { return d; } }).join("|");
  const hit = platformCache.get(slug);
  if (hit && hit.stamp === stamp) return hit.map;
  const map = new Map(identitiesOf(slug).map((i) => [i.handle.toLowerCase(), i.accounts.map((a) => a.platform)]));
  platformCache.set(slug, { stamp, map });
  return map;
}
