/**
 * The current outcome of one leg of a post: one record, kept by the sync.
 *
 * Monid and Post Bridge are two ways to update it, nothing more. Each sync
 * merges what it fetched into the record at write time (`mergeOutcome`):
 *   - a field it fetched is replaced, unless the record already holds a value
 *     of that field fetched later (a saved Monid run replayed after a newer
 *     read, or Post Bridge's numbers from before its 30-minute cooldown);
 *   - a field it did not fetch (saves from Post Bridge) keeps its last value;
 *   - each field carries its source and the time it was fetched.
 * A fetch that reads 0 views for a post the record holds views for is a
 * failed read (views never fall to 0) and changes nothing.
 *
 * The record is an `outcome.current` line in the log, always a full merged
 * snapshot: the reader takes the leg's last one and computes nothing. The
 * `outcome.sync` lines stay as the history of each fetch. `backfillOutcome`
 * folds a leg's `outcome.sync` lines through the same merge, so an old log
 * gives the record the newest number per field (scripts/outcome-backfill.mjs,
 * and the first sync of a leg that has no record yet).
 *
 * Pure: no file, no network. The write is `recordOutcome` in production.ts.
 */

import type { Platform } from "./platform.ts";

export const OUTCOME_FIELDS = ["views", "likes", "comments", "saves", "shares"] as const;
export type OutcomeField = (typeof OUTCOME_FIELDS)[number];
/** The fields that carry a source and a time: the numbers and the url. */
export type MarkedField = OutcomeField | "url";

/** Where one field's value came from, and when it was fetched (ISO). */
export type FieldMark = { source: string; at: string };
export type OutcomeMarks = Partial<Record<MarkedField, FieldMark>>;

/** The data of an `outcome.current` line. A number absent: never fetched (Instagram's saves). */
export type CurrentOutcome = {
  platform: Platform;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  url?: string;
  tiktokId?: string;
  pbPost?: string;
  /** The source of the fetch that wrote this snapshot. */
  by: string;
  fields: OutcomeMarks;
};

/** One fetch, as a sync hands it over. A value null or absent: the source did not fetch it. */
export type Fetched = {
  source: string;
  /** When the source read the numbers (ISO); the merge compares it per field. */
  at: string;
  values: Partial<Record<OutcomeField, number | null | undefined>>;
  url?: string | null;
  tiktokId?: string | null;
  pbPost?: string | null;
};

const time = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return isNaN(t) ? -Infinity : t;
};

/** The url as the record keeps it: Post Bridge's share_url without its utm query. */
const cleanUrl = (u: string) => (/tiktok\.com\//.test(u) ? u.split("?")[0] : u);

/** The record after one fetch. Pure: the same inputs give the same record. */
export function mergeOutcome(prev: CurrentOutcome | null, platform: Platform, f: Fetched): CurrentOutcome {
  const out: CurrentOutcome = prev ? { ...prev, fields: { ...prev.fields } } : { platform, by: f.source, fields: {} };
  const views = f.values.views;
  if (views === 0 && (prev?.views ?? 0) > 0) return out;
  const fresh = (k: MarkedField) => time(f.at) >= time(out.fields[k]?.at);
  let any = false;
  for (const k of OUTCOME_FIELDS) {
    const v = f.values[k];
    if (v == null || !Number.isFinite(Number(v)) || !fresh(k)) continue;
    out[k] = Number(v);
    out.fields[k] = { source: f.source, at: f.at };
    any = true;
  }
  if (f.url && fresh("url")) { out.url = cleanUrl(f.url); out.fields.url = { source: f.source, at: f.at }; any = true; }
  if (f.tiktokId) out.tiktokId = f.tiktokId;
  if (f.pbPost) out.pbPost = f.pbPost;
  if (any) out.by = f.source;
  return out;
}

/** True when two records hold the same values from the same sources. Times alone do not make a new line. */
export function sameOutcome(a: CurrentOutcome | null, b: CurrentOutcome | null): boolean {
  if (!a || !b) return a === b;
  for (const k of [...OUTCOME_FIELDS, "url"] as const) {
    if (a[k] !== b[k] || a.fields[k]?.source !== b.fields[k]?.source) return false;
  }
  return true;
}

/** An `outcome.sync` line as a fetch: its source, its read time (`syncedAt`, else the line's time) and its fields. */
export function fetchOfSyncLine(e: { at: string; data?: Record<string, unknown> }): Fetched {
  const d = e.data ?? {};
  const read = typeof d.syncedAt === "string" && !isNaN(Date.parse(d.syncedAt)) ? new Date(d.syncedAt).toISOString() : e.at;
  const num = (k: string) => (d[k] == null || d[k] === "" ? null : Number(d[k]));
  return {
    source: String(d.source ?? "postbridge"),
    at: read,
    values: { views: num("views"), likes: num("likes"), comments: num("comments"), saves: num("saves"), shares: num("shares") },
    url: typeof d.url === "string" ? d.url : null,
    tiktokId: typeof d.tiktokId === "string" ? d.tiktokId : null,
    pbPost: typeof d.pbPost === "string" ? d.pbPost : null,
  };
}

/** The record an old log gives a leg: its `outcome.sync` lines folded in read-time order, so each field holds its newest number. Null without lines. */
export function backfillOutcome(lines: { at: string; data?: Record<string, unknown> }[], platform: Platform): CurrentOutcome | null {
  if (!lines.length) return null;
  const fetches = lines.map(fetchOfSyncLine).sort((a, b) => time(a.at) - time(b.at));
  return fetches.reduce<CurrentOutcome | null>((rec, f) => mergeOutcome(rec, platform, f), null);
}

/** The record as the log stores it: the line's data. */
export function currentOfLine(data: Record<string, unknown> | undefined): CurrentOutcome | null {
  if (!data || typeof data.fields !== "object" || !data.fields) return null;
  return data as unknown as CurrentOutcome;
}

const WORD: Record<string, string> = { monid: "Monid", postbridge: "Post Bridge", typed: "typed by hand" };
export const sourceWord = (s: string) => WORD[s] ?? s;

/** "views, likes, comments and shares from Post Bridge 2026-10-15 · saves from Monid 2026-10-14": each source once, with its fields and its last read. */
export function sourcesText(fields: OutcomeMarks): string {
  const by = new Map<string, { names: string[]; at: string }>();
  for (const k of OUTCOME_FIELDS) {
    const m = fields[k];
    if (!m) continue;
    const g = by.get(m.source) ?? { names: [], at: "" };
    g.names.push(k);
    if (m.at > g.at) g.at = m.at;
    by.set(m.source, g);
  }
  const list = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0]);
  return [...by].map(([s, g]) => `${list(g.names)} from ${sourceWord(s)} ${g.at.slice(0, 10)}`).join(" · ");
}
