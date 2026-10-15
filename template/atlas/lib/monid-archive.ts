/**
 * The Monid output the sync has seen, kept on disk inside the project:
 * apps/<slug>/production/monid/. Nothing here is a paid call.
 *
 *   <stamp>-<name>.json    the raw output of one paid profile fetch (`monid run -o`),
 *                          as Monid wrote it: an array of posts. <stamp> is the read
 *                          time, <name> the TikTok username asked for.
 *   <stamp>-<runId>.json   one saved run as `monid runs get -r <id> -j` printed it
 *                          (free), the run object with its `output`.
 *
 * `archivedRuns` reads both shapes back as runs, so the sync can look in every
 * fetch it ever paid for before it pays again (`savedRecordsFor`). The free
 * `monid runs list` + `monid runs get` add the runs made outside the sync
 * (a fetch by hand, another tool) to the same folder, once each.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { storeOf } from "./production.ts";
import type { MonidPost, MonidRun } from "./tiktok-link.ts";

const run = promisify(execFile);
const ENDPOINT = "/apidojo/tiktok-profile-scraper";

export const archiveDirOf = (slug: string) => join(storeOf(slug), "monid");

const bare = (name: string) => name.replace(/^@/, "").toLowerCase();
/** An ISO time as a file name part: 2026-10-15T10-55-20.167Z. */
export const stampOf = (iso: string) => iso.replace(/:/g, "-");
const isoOf = (stamp: string) => stamp.replace(/^(\d{4}-\d\d-\d\dT\d\d)-(\d\d)-(\d\d(?:\.\d+)?Z)$/, "$1:$2:$3");
const STAMP = /^(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d(?:\.\d+)?Z)-(.+)\.json$/;

/** The file a paid fetch writes its raw output to. The caller (`monidHandlePosts`) passes it to `monid run -o`. */
export function rawFetchFile(slug: string, name: string, readAt = new Date().toISOString()): string {
  const dir = archiveDirOf(slug);
  mkdirSync(dir, { recursive: true });
  return join(dir, `${stampOf(readAt)}-${bare(name)}.json`);
}

/** Keeps one saved run (`monid runs get`), once: a run already in the folder is not written again. */
export function keepRun(slug: string, r: MonidRun): void {
  const dir = archiveDirOf(slug);
  mkdirSync(dir, { recursive: true });
  if (archivedRunIds(slug).has(r.runId)) return;
  writeFileSync(join(dir, `${stampOf(r.completedAt ?? new Date().toISOString())}-${r.runId}.json`), JSON.stringify(r));
}

/** The run ids already kept (the saved runs; a raw fetch has no id of its own). */
export function archivedRunIds(slug: string): Set<string> {
  const dir = archiveDirOf(slug);
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).map((f) => f.match(STAMP)?.[2] ?? "").filter((x) => /^[0-9A-Z]{20,}$/.test(x)));
}

/** Every kept fetch and run, as runs: a raw fetch becomes a run of its name, read at its stamp. An unreadable file is skipped. */
export function archivedRuns(slug: string): MonidRun[] {
  const dir = archiveDirOf(slug);
  if (!existsSync(dir)) return [];
  const out: MonidRun[] = [];
  for (const f of readdirSync(dir).sort()) {
    const m = f.match(STAMP);
    if (!m) continue;
    try {
      const body = JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
      if (Array.isArray(body)) out.push({ runId: `fetch:${f}`, status: "COMPLETED", endpoint: ENDPOINT, input: { body: { usernames: [m[2]] } }, completedAt: isoOf(m[1]), output: body as MonidPost[] });
      else if (body && typeof body === "object" && "output" in body) out.push(body as MonidRun);
    } catch { /* a half-written or foreign file: not a run */ }
  }
  return out;
}

/** The posts of one TikTok name across the runs, each id once at its latest read, each marked with that read time (`readAt`). Pure. */
export function recordsFor(runs: MonidRun[], name: string): MonidPost[] {
  const best = new Map<string, MonidPost>();
  for (const r of runs) {
    if (r.status !== "COMPLETED" || !r.endpoint?.endsWith("/tiktok-profile-scraper")) continue;
    if (!(r.input?.body?.usernames ?? []).some((u) => bare(u) === bare(name))) continue;
    for (const p of r.output ?? []) {
      const at = p.readAt ?? r.completedAt ?? "";
      const had = best.get(p.id);
      if (!had || at >= (had.readAt ?? "")) best.set(p.id, { ...p, readAt: at });
    }
  }
  return [...best.values()];
}

/** The ids of the runs `monid runs list -j` prints, as far as its shape can be read: an array, or the first array inside an object. Pure. */
export function listedRunIds(listed: unknown): { id: string; endpoint: string | null; status: string | null }[] {
  const arr = Array.isArray(listed) ? listed : listed && typeof listed === "object" ? Object.values(listed).find(Array.isArray) ?? [] : [];
  return (arr as Record<string, unknown>[]).map((x) => ({
    id: String(x?.runId ?? x?.id ?? ""),
    endpoint: typeof x?.endpoint === "string" ? x.endpoint : null,
    status: typeof x?.status === "string" ? x.status : null,
  })).filter((x) => x.id && (!x.endpoint || x.endpoint.endsWith("/tiktok-profile-scraper")) && (!x.status || x.status === "COMPLETED"));
}

/**
 * Brings the saved runs made outside the folder into it: `monid runs list` (the
 * latest `limit`) and `monid runs get` for each profile-scraper run not kept
 * yet. Both are free. Returns how many runs were added. A failure (no CLI, no
 * key) adds nothing and is not an error: the sync still has the folder.
 */
export async function pullSavedRuns(slug: string, limit = 50): Promise<number> {
  try {
    const { stdout } = await run("monid", ["runs", "list", "-l", String(limit), "-j"], { env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 16 * 1024 * 1024 });
    const have = archivedRunIds(slug);
    let added = 0;
    for (const x of listedRunIds(JSON.parse(stdout))) {
      if (have.has(x.id)) continue;
      const got = await run("monid", ["runs", "get", "-r", x.id, "-j"], { env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
      const r = JSON.parse(got.stdout) as MonidRun;
      if (r.status === "COMPLETED" && r.endpoint?.endsWith("/tiktok-profile-scraper")) { keepRun(slug, r); added++; }
    }
    return added;
  } catch {
    return 0;
  }
}
