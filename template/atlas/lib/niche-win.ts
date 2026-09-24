/**
 * What wins in the niche: one rule per platform, worked out again on every visit.
 * Pure: the niche page uses it, lib/niche-win.test.ts checks it.
 *
 * TikTok (unchanged): 50,000 views or more, and saves per view at the median of
 * the TikTok slideshows that reached 50,000 views.
 *
 * Instagram reports no saves, and no views on a photo or a carousel, so it is
 * judged against itself, on likes OR on shares (a post wins on either):
 *   - a video (a reel): 50,000 views or more, and likes per view at the median of
 *     the Instagram videos that reached 50,000 views (the TikTok rule, likes in
 *     place of saves);
 *   - a photo or a carousel: at least the likes a reel has at 50,000 views and
 *     that median rate (50,000 x the median, rounded). With no reel to measure,
 *     IG_LIKES_FLOOR.
 *   - likes hidden by the author: never a win on likes.
 *   - shares, by the same two rules with shares in place of likes, measured over the
 *     Instagram reels that reached 50,000 views and report shares. With no such reel
 *     there is no share bar, and no post wins on shares (the hashtag pages of
 *     2026-09-24 report no shares on any post).
 * `strength` is how far a post stands over its own bar (1 = on it; on Instagram the
 * higher of the likes bar and the share bar), so one sort can rank both platforms.
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
  /** Instagram's second measure; null when not reported. Absent: not reported. */
  shares?: number | null;
  win_: boolean;
  /** The rate against the post's own bar; null when the post has no measure. */
  strength: number | null;
};

export type WinRule = {
  tiktok: { median: number; over: number; wins: number; slideshows: number };
  instagram: {
    median: number; over: number; likesFloor: number;
    /** Shares per view at the median of the reels over WIN_VIEWS that report shares; 0 when none do (no share bar). */
    shareMedian: number; shareOver: number;
    /** 50,000 x shareMedian: a photo's or a carousel's share bar; null when there is no share bar. */
    sharesFloor: number | null;
    wins: number; likeWins: number; shareWins: number; posts: number; withShares: number;
  };
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
  const shareReels = ig.filter((t) => t.kind === "video" && (t.views ?? 0) >= WIN_VIEWS && t.shares != null);
  const shareMedian = medianOf(shareReels.map((t) => t.shares! / t.views!));
  const sharesFloor = shareMedian > 0 ? Math.round(WIN_VIEWS * shareMedian) : null;
  let likeWins = 0, shareWins = 0;
  for (const t of ig) {
    /* On likes: a reel by likes per view, a photo or carousel by the likes floor. */
    let onLikes = false, likeStrength: number | null = null;
    if (t.likes !== null && t.views) { const r = t.likes / t.views; onLikes = t.views >= WIN_VIEWS && igMedian > 0 && r >= igMedian; likeStrength = igMedian > 0 ? r / igMedian : null; }
    else if (t.likes !== null) { onLikes = t.likes >= likesFloor; likeStrength = t.likes / likesFloor; }
    /* On shares: the same, when the post reports shares and a share bar exists. */
    let onShares = false, shareStrength: number | null = null;
    if (t.shares != null && shareMedian > 0) {
      if (t.views) { const r = t.shares / t.views; onShares = t.views >= WIN_VIEWS && r >= shareMedian; shareStrength = r / shareMedian; }
      else { onShares = t.shares >= sharesFloor!; shareStrength = t.shares / sharesFloor!; }
    }
    t.win_ = onLikes || onShares;
    if (onLikes) likeWins++;
    if (onShares) shareWins++;
    t.strength = likeStrength === null && shareStrength === null ? null : Math.max(likeStrength ?? 0, shareStrength ?? 0);
  }

  return {
    tiktok: { median: ttMedian, over: ttOver, wins: tt.filter((t) => t.win_ && t.kind === "slideshow").length, slideshows: tt.filter((t) => t.kind === "slideshow").length },
    instagram: { median: igMedian, over: reels.length, likesFloor, shareMedian, shareOver: shareReels.length, sharesFloor, wins: ig.filter((t) => t.win_).length, likeWins, shareWins, posts: ig.length, withShares: ig.filter((t) => t.shares != null).length },
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
