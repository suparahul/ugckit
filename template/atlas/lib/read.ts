/**
 * The stats layer, as the reporting plan states it: every number is an
 * `outcome.sync` or `outcomes` line in the log, with its source and read
 * time. Nothing here adds a metric. The read of a period is the sum over the
 * posts posted in it; a post without a read counts as posted, unread.
 */

import { addDays, weekStartOf, type PostState } from "./production";

export type Numbers = { views: number; likes: number; comments: number; saves: number; shares: number };
export type Read = Numbers & {
  /** Posts posted in the period. */
  posted: number;
  /** Of those, posts with at least one read. */
  read: number;
  sources: string[];
  /** The latest read time (ISO), or null. */
  lastAt: string | null;
};

const SOURCE_WORD: Record<string, string> = { monid: "Monid", postbridge: "Post Bridge", typed: "typed by hand" };

/** The latest numbers of one post: the day-7 form when typed, else the last sync. Null when unread. */
export function numbersOf(s: PostState): (Numbers & { source: string; at: string }) | null {
  if (s.outcomes) {
    const o = s.outcomes;
    const num = (k: string) => Number(String(o[k] ?? 0).replace(/,/g, "")) || 0;
    return { views: num("views"), likes: num("likes"), comments: num("comments"), saves: num("saves"), shares: num("shares"), source: "typed", at: s.log.filter((e) => e.kind === "outcomes").slice(-1)[0]?.at ?? s.posted?.at ?? "" };
  }
  if (s.synced) return { views: s.synced.views, likes: s.synced.likes, comments: s.synced.comments, saves: s.synced.saves ?? 0, shares: s.synced.shares, source: s.synced.source, at: s.synced.syncedAt || s.synced.at };
  return null;
}

export const isPosted = (s: PostState) => !!s.posted && !s.killed;
/** The day a post went out: the plan's date (the posted line's clock may be the next day in UTC). */
export const postedDay = (s: PostState) => s.row.date;

export function readOf(states: PostState[]): Read {
  const posted = states.filter(isPosted);
  const out: Read = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, posted: posted.length, read: 0, sources: [], lastAt: null };
  const sources = new Set<string>();
  for (const s of posted) {
    const nb = numbersOf(s);
    if (!nb) continue;
    out.read++;
    out.views += nb.views; out.likes += nb.likes; out.comments += nb.comments; out.saves += nb.saves; out.shares += nb.shares;
    sources.add(nb.source);
    if (!out.lastAt || nb.at > out.lastAt) out.lastAt = nb.at;
  }
  out.sources = [...sources].map((s) => SOURCE_WORD[s] ?? s);
  return out;
}

/** "Read through Monid, Post Bridge agrees · last Wed 17 Sep 05:26 UTC", or the zero sentence. */
export function readSentence(r: Read): string {
  if (!r.posted) return "Nothing posted in this period.";
  if (!r.read) return `${r.posted} posted, no read yet. The numbers appear after the first sync.`;
  const src = r.sources.length ? `Read through ${r.sources[0]}${r.sources.length > 1 ? `, ${r.sources.slice(1).join(" and ")} ${r.sources.length === 2 ? "agrees" : "agree"}` : ""}` : "Read";
  const when = r.lastAt ? ` · last ${r.lastAt.slice(0, 10)} ${r.lastAt.slice(11, 16)} UTC` : "";
  const partial = r.read < r.posted ? ` · ${r.read} of ${r.posted} read` : "";
  return `${src}${when}${partial}`;
}

/** The seven days of the plan week a date falls in. */
export function weekDays(slug: string, iso: string): string[] {
  const start = weekStartOf(slug, iso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Views by posting day: a number, "unread" (posted, no read yet) or null (nothing posted). */
export function dayViews(states: PostState[], days: string[]): Record<string, number | "unread" | null> {
  const out: Record<string, number | "unread" | null> = {};
  for (const d of days) {
    const mine = states.filter((s) => isPosted(s) && postedDay(s) === d);
    if (!mine.length) { out[d] = null; continue; }
    const nums = mine.map(numbersOf).filter((x): x is NonNullable<typeof x> => !!x);
    out[d] = nums.length ? nums.reduce((t, x) => t + x.views, 0) : "unread";
  }
  return out;
}
