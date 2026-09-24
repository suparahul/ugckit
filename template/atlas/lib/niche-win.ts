/**
 * What wins in the niche: one rule per platform, worked out again on every visit.
 * Pure: the niche page uses it, lib/niche-win.test.ts checks it.
 *
 * TikTok (unchanged): 50,000 views or more, and saves per view at the median of
 * the TikTok slideshows that reached 50,000 views.
 *
 * Instagram reports no saves, and no views on a photo or a carousel, so it is
 * judged on likes, against itself:
 *   - a video (a reel): 50,000 views or more, and likes per view at the median of
 *     the Instagram videos that reached 50,000 views (the TikTok rule, likes in
 *     place of saves);
 *   - a photo or a carousel: at least the likes a reel has at 50,000 views and
 *     that median rate (50,000 x the median, rounded). With no reel to measure,
 *     IG_LIKES_FLOOR.
 *   - likes hidden by the author: never a win.
 * `strength` is how far a post stands over its own bar (1 = on it), so one sort
 * can rank both platforms side by side.
 */

import type { Platform } from "./platform.ts";

export const WIN_VIEWS = 50_000;
/** The photo and carousel bar when no Instagram video reached WIN_VIEWS to measure the rate. */
export const IG_LIKES_FLOOR = 2_000;

export type Rated = {
  platform: Platform;
  kind: "slideshow" | "video";
  views: number | null;
  likes: number | null;
  saves: number | null;
  win_: boolean;
  /** The rate against the post's own bar; null when the post has no measure. */
  strength: number | null;
};

export type WinRule = {
  tiktok: { median: number; over: number; wins: number; slideshows: number };
  instagram: { median: number; over: number; likesFloor: number; wins: number; posts: number };
};

const medianOf = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** The TikTok rate (saves per view) or the Instagram one (likes per view); null when it cannot be worked out. */
export function rateOf(t: Pick<Rated, "platform" | "views" | "likes" | "saves">): number | null {
  if (!t.views) return null;
  const top = t.platform === "instagram" ? t.likes : t.saves;
  return top === null ? null : top / t.views;
}

export function markWins<T extends Rated>(tiles: T[]): WinRule {
  const tt = tiles.filter((t) => t.platform === "tiktok");
  const ig = tiles.filter((t) => t.platform === "instagram");

  const ttMedian = medianOf(tt.filter((t) => t.kind === "slideshow" && (t.views ?? 0) >= WIN_VIEWS).map((t) => rateOf(t) ?? 0));
  const ttOver = tt.filter((t) => t.kind === "slideshow" && (t.views ?? 0) >= WIN_VIEWS).length;
  for (const t of tt) {
    const r = rateOf(t) ?? 0;
    t.win_ = (t.views ?? 0) >= WIN_VIEWS && r >= ttMedian && ttMedian > 0;
    t.strength = ttMedian > 0 && t.views ? r / ttMedian : null;
  }

  const reels = ig.filter((t) => t.kind === "video" && (t.views ?? 0) >= WIN_VIEWS && t.likes !== null);
  const igMedian = medianOf(reels.map((t) => rateOf(t)!));
  const likesFloor = igMedian > 0 ? Math.round(WIN_VIEWS * igMedian) : IG_LIKES_FLOOR;
  for (const t of ig) {
    const r = rateOf(t);
    if (t.likes === null) { t.win_ = false; t.strength = null; }
    else if (t.views) { t.win_ = t.views >= WIN_VIEWS && igMedian > 0 && r! >= igMedian; t.strength = igMedian > 0 ? r! / igMedian : null; }
    else { t.win_ = t.likes >= likesFloor; t.strength = t.likes / likesFloor; }
  }

  return {
    tiktok: { median: ttMedian, over: ttOver, wins: tt.filter((t) => t.win_ && t.kind === "slideshow").length, slideshows: tt.filter((t) => t.kind === "slideshow").length },
    instagram: { median: igMedian, over: reels.length, likesFloor, wins: ig.filter((t) => t.win_).length, posts: ig.length },
  };
}

/**
 * The views floor of the filter, for every post. A post with views is held to it
 * as it is; a post with none reported (an Instagram photo or carousel) is held to
 * the likes a reel has at that many views and the Instagram median rate.
 */
export function overFloor(t: Pick<Rated, "views" | "likes">, min: number, rule: WinRule): boolean {
  if (!min) return true;
  if (t.views !== null) return t.views >= min;
  const rate = rule.instagram.median > 0 ? rule.instagram.median : rule.instagram.likesFloor / WIN_VIEWS;
  return (t.likes ?? 0) >= min * rate;
}
