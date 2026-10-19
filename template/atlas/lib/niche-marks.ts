/**
 * The curation marks of the niche page: apps/<slug>/niche/marks.json, one
 * file per niche, read live on every visit and never touched by an index
 * rebuild or a refresh. The user writes it from the page's edit mode (the
 * /api/niche/marks route); an agent reads and writes the same file, by hand
 * or with scripts/niche-marks.py.
 *
 *   {
 *     "version": 1,
 *     "marks": {
 *       "tiktok:7412345678901234567": { "mark": "out", "by": "you", "at": "2026-10-19T10:02:11Z", "handle": "x", "caption": "…" },
 *       "tiktok:7498765432109876543": { "mark": "study", "by": "agent", "at": "…", "rule": "C2", "why": "…" }
 *     }
 *   }
 *
 * The key is `<platform>:<post id>`. `mark` is one of:
 *   out    ruled out: off the explorer (the marks filter shows it again); nothing is deleted
 *   study  the full slides or video are wanted: the agent fetches them (niche-fetch) and reads them
 *   keep   a mark of yours that says "leave this one alone": an agent mark you took back.
 *          It shows as unmarked; an agent never marks it again.
 * A post not in the file is unmarked: kept, not downloaded. `by` is "you" or
 * "agent"; an agent never changes a mark by "you". `rule` names the cleanup rule
 * (niche/CLEANUP.md) an agent applied, `why` says why in a few words.
 */

import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { appDir, readText } from "./root.ts";

export type Mark = "out" | "study" | "keep";
export const MARKS: Mark[] = ["out", "study", "keep"];
export type MarkEntry = { mark: Mark; by: "you" | "agent"; at: string; handle?: string; caption?: string; rule?: string; why?: string };
export type MarksFile = { version: 1; marks: Record<string, MarkEntry> };
/** One change from the page: a mark set, or null to take it off. */
export type MarkChange = { key: string; mark: Mark | null; handle?: string; caption?: string };

export const markKey = (platform: string, id: string) => `${platform}:${id}`;
const KEY = /^(tiktok|instagram):[\w.-]{1,64}$/;
export const validKey = (k: string) => KEY.test(k);

export const marksPath = (slug: string) => join(appDir(slug), "niche", "marks.json");

const empty = (): MarksFile => ({ version: 1, marks: {} });

/** The file's text as marks; a broken file, a wrong key or an unknown mark is dropped, never thrown. Pure. */
export function parseMarks(text: string | null): MarksFile {
  if (!text) return empty();
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return empty(); }
  const m = raw && typeof raw === "object" ? (raw as { marks?: unknown }).marks : null;
  const out = empty();
  if (!m || typeof m !== "object") return out;
  for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
    if (!validKey(k) || !v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    if (!MARKS.includes(e.mark as Mark)) continue;
    const entry: MarkEntry = { mark: e.mark as Mark, by: e.by === "agent" ? "agent" : "you", at: typeof e.at === "string" ? e.at : "" };
    for (const f of ["handle", "caption", "rule", "why"] as const) if (typeof e[f] === "string" && e[f]) entry[f] = e[f] as string;
    out.marks[k] = entry;
  }
  return out;
}

export const readMarksAt = (p: string): MarksFile => parseMarks(readText(p));
export const readMarks = (slug: string): MarksFile => readMarksAt(marksPath(slug));

/** The file's text: the keys in order, two-space JSON, so a diff shows one line per mark. Pure. */
export function marksText(file: MarksFile): string {
  const marks: Record<string, MarkEntry> = {};
  for (const k of Object.keys(file.marks).sort()) marks[k] = file.marks[k];
  return `${JSON.stringify({ version: 1, marks }, null, 2)}\n`;
}

/**
 * The page's changes applied as the user's. A mark set is the user's, with the
 * time. A mark taken off is gone, except one an agent set: that becomes `keep`
 * by you, so the next cleanup does not mark the post again. Pure.
 */
export function applyChanges(file: MarksFile, changes: MarkChange[], at: string): MarksFile {
  const marks = { ...file.marks };
  for (const c of changes) {
    if (!validKey(c.key)) continue;
    const had = marks[c.key];
    if (c.mark === null || c.mark === "keep") {
      if (had?.by === "agent" || c.mark === "keep") marks[c.key] = { mark: "keep", by: "you", at, ...meta(c, had) };
      else delete marks[c.key];
      continue;
    }
    if (!MARKS.includes(c.mark)) continue;
    marks[c.key] = { mark: c.mark, by: "you", at, ...meta(c, had) };
  }
  return { version: 1, marks };
}

const meta = (c: MarkChange, had?: MarkEntry) => {
  const handle = c.handle || had?.handle;
  const caption = (c.caption || had?.caption || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return { ...(handle ? { handle } : {}), ...(caption ? { caption } : {}) };
};

/** Write the file whole, through a temporary file, so a reader never sees half of it. */
export const writeMarks = (slug: string, file: MarksFile): void => writeMarksAt(marksPath(slug), file);
export function writeMarksAt(p: string, file: MarksFile): void {
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, marksText(file));
  renameSync(tmp, p);
}

/** The mark a post shows: out or study; keep and no mark are both unmarked (""). */
export const shownMark = (e: MarkEntry | undefined): "" | "out" | "study" => (e && e.mark !== "keep" ? e.mark : "");

/**
 * The marks filter of the explorer. "" (the default) hides the ruled-out posts;
 * "out" shows only them, to review or restore; "study", "unmarked" and "all" as named.
 */
export const MARK_VIEWS = ["", "study", "unmarked", "out", "all"] as const;
export type MarkView = (typeof MARK_VIEWS)[number];
export const markViewOf = (x: string): MarkView => ((MARK_VIEWS as readonly string[]).includes(x) ? (x as MarkView) : "");
export function inMarkView(view: MarkView, mark: "" | "out" | "study"): boolean {
  if (view === "all") return true;
  if (view === "") return mark !== "out";
  if (view === "unmarked") return mark === "";
  return mark === view;
}
