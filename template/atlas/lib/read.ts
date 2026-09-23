/**
 * The stats layer, as the reporting plan states it: every number is an
 * `outcome.sync` or `outcomes` line in the log, with its source and read
 * time. Nothing here adds a metric. The read of a period is the sum over the
 * posts posted in it; a post without a read counts as posted, unread.
 *
 * With two platforms, a post has one read per leg. The view is one platform, or
 * "both": views, likes, comments and shares add up; saves come from TikTok only
 * (no source gives Instagram's: Post Bridge has none, and the public scrapers
 * cannot see them), so they add up only where they are known.
 */

import type { Platform } from "./platform.ts";
import { addDays, weekStartOf, type PostState } from "./production.ts";

/** One platform, or both added up. */
export type View = Platform | "both";

export type Numbers = { views: number; likes: number; comments: number; saves: number; shares: number };
export type Read = Numbers & {
  /** The views of the reads whose saves are known (TikTok's): saves/view divides by this, not by every view. */
  savesViews: number;
  /** Posts posted in the period. */
  posted: number;
  /** Of those, posts with at least one read. */
  read: number;
  sources: string[];
  /** The latest read time (ISO), or null. */
  lastAt: string | null;
};

const SOURCE_WORD: Record<string, string> = { monid: "Monid", postbridge: "Post Bridge", typed: "typed by hand" };

export type PostNumbers = Numbers & { source: string; at: string; /** The legs the numbers come from; saves only from those with a known save count. */ legs?: Platform[]; savesKnown?: boolean; /** The views of the legs whose saves are known. Absent: all of them. */ savesViews?: number };

/** The latest numbers of one post, every leg added up. Null when unread. One argument: it is passed to `map` as it is. */
export function numbersOf(s: PostState): PostNumbers | null {
  return numbersIn(s, "both");
}

/** The latest numbers of one post in a view: one leg's, or every leg's added up. Null when unread. */
export function numbersIn(s: PostState, view: View): PostNumbers | null {
  if (view !== "both") return legNumbers(s, view);
  const platforms = s.platforms ?? ["tiktok"];
  const parts = platforms.map((p) => [p, legNumbers(s, p)] as const).filter((x): x is readonly [Platform, PostNumbers] => !!x[1]);
  if (parts.length <= 1) return parts[0]?.[1] ?? null;
  const out: PostNumbers = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, source: parts[0][1].source, at: "", legs: parts.map(([p]) => p), savesKnown: parts.some(([, n]) => n.savesKnown !== false), savesViews: 0 };
  for (const [, n] of parts) {
    out.views += n.views; out.likes += n.likes; out.comments += n.comments; out.shares += n.shares;
    if (n.savesKnown !== false) { out.saves += n.saves; out.savesViews! += n.savesViews ?? n.views; }
    if (n.at > out.at) out.at = n.at;
  }
  return out;
}

/** One leg's numbers: the day-7 form (typed for the primary leg) when there is one, else the leg's last sync. */
function legNumbers(s: PostState, p: Platform): PostNumbers | null {
  const primary = s.primary ?? "tiktok";
  if (p === primary) return primaryNumbers(s);
  const y = s.legs?.[p]?.synced;
  if (!y) return null;
  return { views: y.views, likes: y.likes, comments: y.comments, saves: y.saves ?? 0, shares: y.shares, source: y.source, at: y.syncedAt || y.at, legs: [p], savesKnown: y.saves !== null, savesViews: y.saves !== null ? y.views : 0 };
}

/** The primary leg's numbers: exactly the rule from before two platforms. */
function primaryNumbers(s: PostState): PostNumbers | null {
  if (s.outcomes) {
    const o = s.outcomes;
    const num = (k: string) => Number(String(o[k] ?? 0).replace(/,/g, "")) || 0;
    return { views: num("views"), likes: num("likes"), comments: num("comments"), saves: num("saves"), shares: num("shares"), source: "typed", at: s.log.filter((e) => e.kind === "outcomes").slice(-1)[0]?.at ?? s.posted?.at ?? "" };
  }
  if (s.synced) return { views: s.synced.views, likes: s.synced.likes, comments: s.synced.comments, saves: s.synced.saves ?? 0, shares: s.synced.shares, source: s.synced.source, at: s.synced.syncedAt || s.synced.at };
  return null;
}

/** Posted: the primary leg is posted, as before two platforms. One argument: it is passed to `filter` as it is. */
export const isPosted = (s: PostState) => !!s.posted && !s.killed;
/** Posted in the view: the primary leg for "both", else that platform's leg. */
export const isPostedIn = (s: PostState, view: View) => !s.killed && (view === "both" || view === (s.primary ?? "tiktok") ? !!s.posted : !!s.legs?.[view]?.posted);
/** The day a post went out: the plan's date (the posted line's clock may be the next day in UTC). */
export const postedDay = (s: PostState) => s.row.date;

export function readOf(states: PostState[], view: View = "both"): Read {
  const posted = states.filter((s) => isPostedIn(s, view));
  const out: Read = { views: 0, likes: 0, comments: 0, saves: 0, shares: 0, savesViews: 0, posted: posted.length, read: 0, sources: [], lastAt: null };
  const sources = new Set<string>();
  for (const s of posted) {
    const nb = numbersIn(s, view);
    if (!nb) continue;
    out.read++;
    out.views += nb.views; out.likes += nb.likes; out.comments += nb.comments; out.saves += nb.saves; out.shares += nb.shares;
    out.savesViews += nb.savesViews ?? nb.views;
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
export function dayViews(states: PostState[], days: string[], view: View = "both"): Record<string, number | "unread" | null> {
  const out: Record<string, number | "unread" | null> = {};
  for (const d of days) {
    const mine = states.filter((s) => isPostedIn(s, view) && postedDay(s) === d);
    if (!mine.length) { out[d] = null; continue; }
    const nums = mine.map((s) => numbersIn(s, view)).filter((x): x is NonNullable<typeof x> => !!x);
    out[d] = nums.length ? nums.reduce((t, x) => t + x.views, 0) : "unread";
  }
  return out;
}
