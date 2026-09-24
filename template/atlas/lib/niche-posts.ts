/**
 * One niche post, and the pure readers that turn a search file's item into one.
 * scripts/build-niche.mjs imports this (Node strips the types); lib/niche.ts
 * re-exports the type for the page.
 *
 * A post names its platform; absent means TikTok, the kit's rule (lib/platform.ts).
 * A count a platform does not report is null, never 0: Instagram reports no saves,
 * shares only when a page carries share_count or reshare_count, no views on a photo
 * or a carousel, and no likes when the author hides them.
 */

import type { Platform } from "./platform.ts";

export type NichePost = {
  id: string;
  /** Absent: TikTok. */
  platform?: Platform;
  /** Instagram's shortcode: the post is instagram.com/p/<code>/ (or /reel/<code>/). */
  code?: string;
  keyword: string;
  window: string;
  handle: string;
  mediaType: "slideshow" | "video";
  slideCount: number | null;
  /** Null: not reported (an Instagram photo or carousel). */
  views: number | null;
  /** Null: hidden by the author (Instagram). */
  likes: number | null;
  comments: number;
  /** Null: not reported (Instagram). */
  saves: number | null;
  shares: number | null;
  /** Saves per view; null when either is not reported. */
  saveRate: number | null;
  date: string;
  caption: string;
  /** A /media URL when the cover is held on disk, else the signed URL from the search. */
  cover: string | null;
  coverLocal: boolean;
  url: string;
};

/**
 * JSON.parse, or, when that fails, JSON.parse after escaping the raw control
 * characters inside strings. Instagram captions come back from TikHub with raw
 * control characters in them, which strict JSON refuses (Python reads them with
 * strict=False). Null when the text is not JSON either way.
 */
export function lenientJson(text: string): unknown {
  try { return JSON.parse(text); } catch { /* below */ }
  let out = "";
  let from = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (inStr) {
      if (c === 92) { i++; continue; } // a backslash: skip the escaped character
      if (c === 34) inStr = false;
      else if (c < 32) { out += text.slice(from, i) + `\\u${c.toString(16).padStart(4, "0")}`; from = i + 1; }
    } else if (c === 34) inStr = true;
  }
  try { return JSON.parse(out + text.slice(from)); } catch { return null; }
}

const oneLine = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
const count = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const dateOf = (t: unknown) => {
  const d = typeof t === "number" ? new Date(t * 1000) : typeof t === "string" ? new Date(t) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";
};

/* ------------------------------------------------------------- Instagram */

/** The items of a TikHub fetch_hashtag_posts page, with or without the Monid envelope. */
export function igItems(file: unknown): Record<string, any>[] {
  const f = file as { output?: { data?: { items?: unknown } }; data?: { items?: unknown } } | null;
  const items = f?.output?.data?.items ?? f?.data?.items;
  return Array.isArray(items) ? items.filter((x) => x && typeof x === "object") : [];
}

/** The id an Instagram post is filed under (its cover is instagram/covers/<id>.jpg). */
export const igIdOf = (it: Record<string, any>): string => String(it.pk ?? it.id ?? "").split("_")[0];

/** The signed cover URL of an Instagram item (it expires: fetch it now). */
export function igCoverOf(it: Record<string, any>): string | null {
  const iv = it.image_versions;
  const list = Array.isArray(iv) ? iv : Array.isArray(iv?.items) ? iv.items : Array.isArray(it.image_versions2?.candidates) ? it.image_versions2.candidates : [];
  return it.thumbnail_url ?? list[0]?.url ?? null;
}

/**
 * One item of a hashtag page as a niche post. Two shapes come back from the same
 * endpoint: `top` pages carry caption_text, resources and an ISO taken_at; `recent`
 * pages carry Instagram's own shape (caption.text, carousel_media, taken_at in
 * seconds). media_type 1 is a photo (a slideshow of one), 2 a video, 8 a carousel.
 */
export function igPost(it: Record<string, any>, keyword: string, window: string): NichePost | null {
  const id = igIdOf(it);
  const code = String(it.code ?? "");
  if (!id || !code) return null;
  const video = it.media_type === 2;
  const slides = it.media_type === 8
    ? (Array.isArray(it.resources) && it.resources.length) || count(it.carousel_media_count) || (Array.isArray(it.carousel_media) ? it.carousel_media.length : 0) || null
    : video ? null : 1;
  const plays = Math.max(count(it.play_count) ?? 0, count(it.view_count) ?? 0, count(it.ig_play_count) ?? 0);
  const clip = it.product_type === "clips" || video;
  return {
    id,
    platform: "instagram",
    code,
    keyword,
    window,
    handle: String(it.user?.username ?? ""),
    mediaType: video ? "video" : "slideshow",
    slideCount: slides,
    views: video && plays > 0 ? plays : null,
    likes: it.like_and_view_counts_disabled && !count(it.like_count) ? null : count(it.like_count),
    comments: count(it.comment_count) ?? 0,
    saves: null,
    shares: it.share_count_disabled ? null : count(it.share_count) ?? count(it.reshare_count),
    saveRate: null,
    date: dateOf(it.taken_at ?? it.taken_at_ts),
    caption: oneLine(it.caption_text ?? it.caption?.text),
    cover: igCoverOf(it),
    coverLocal: false,
    url: `https://www.instagram.com/${clip ? "reel" : "p"}/${code}/`,
  };
}

/* ------------------------------------------------------ TikTok, general */

/** The items of a TikHub fetch_general_search_result page: data[].aweme_info. */
export function generalItems(file: unknown): Record<string, any>[] {
  const d = (file as { data?: unknown } | null)?.data;
  return Array.isArray(d) ? d.map((x) => x?.aweme_info).filter((a) => a?.aweme_id) : [];
}

/** The first slide of a general-search photo post, or the cover of a video. */
export function generalCoverOf(a: Record<string, any>): string | null {
  const img = a.image_post_info?.images?.[0];
  return img?.display_image?.url_list?.[0] ?? img?.owner_watermark_image?.url_list?.[0] ?? a.video?.cover?.url_list?.[0] ?? null;
}

/** One aweme of the TikTok general search as a niche post (window GENERAL). */
export function generalPost(a: Record<string, any>, keyword: string): NichePost {
  const s = a.statistics ?? {};
  const handle = String(a.author?.unique_id ?? "");
  const slides = Array.isArray(a.image_post_info?.images) ? a.image_post_info.images.length : 0;
  const views = Number(s.play_count ?? 0), saves = Number(s.collect_count ?? 0);
  const id = String(a.aweme_id);
  return {
    id, keyword, window: "GENERAL", handle,
    mediaType: slides ? "slideshow" : "video",
    slideCount: slides || null,
    views, likes: Number(s.digg_count ?? 0), comments: Number(s.comment_count ?? 0), saves, shares: Number(s.share_count ?? 0),
    saveRate: views > 0 ? saves / views : 0,
    date: dateOf(a.create_time),
    caption: oneLine(a.desc),
    cover: generalCoverOf(a),
    coverLocal: false,
    url: handle ? `https://www.tiktok.com/@${handle}/${slides ? "photo" : "video"}/${id}` : "",
  };
}

/* ------------------------------------------------------------- the detail */

/** A search window as the niche pages name it. */
export const windowLabel = (w: string) => ({ LAST_THREE_MONTHS: "last three months", PHOTO_TAB: "photo tab", THIS_MONTH: "this month", SCROLL: "your scroll", GENERAL: "general search", IG_TOP: "Instagram top", IG_RECENT: "Instagram recent" }[w] ?? w.toLowerCase().replace(/_/g, " "));

/** The detail page of a niche post: /app/<slug>/niche/post/<platform>/<id>. */
export const nichePostHref = (slug: string, platform: Platform, id: string) =>
  `/app/${encodeURIComponent(slug)}/niche/post/${platform}/${encodeURIComponent(id)}`;

/**
 * One niche post as its detail page shows it: every search row of the post merged
 * (a post found by two keywords or two windows is one post, with both names). A
 * count not reported stays null, as on the niche page.
 */
export type NicheDetail = {
  platform: Platform;
  id: string;
  code?: string;
  src: "search" | "scroll";
  handle: string;
  url: string;
  date: string;
  mediaType: "slideshow" | "video";
  slideCount: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  caption: string;
  hashtags: string[];
  /** A /media URL on disk, or null (a signed URL is not shown: it expires). */
  cover: string | null;
  /** The slides on disk (a post from your scroll), as /media URLs. */
  slides: string[];
  sound: string | null;
  /** Where the search found it: keyword and window, one per row. */
  found: { keyword: string; window: string }[];
};

/** The hashtags of a caption, without the #, in order, once each. */
export const hashtagsOf = (caption: string): string[] => [...new Set(Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu), (m) => m[1]))];

/** The detail of a searched post, or null when the searches hold no post with this platform and id. */
export function nicheDetailOf(posts: NichePost[], platform: Platform, id: string): NicheDetail | null {
  const rows = posts.filter((p) => (p.platform ?? "tiktok") === platform && p.id === id);
  if (!rows.length) return null;
  /* The row with the most views (or likes) carries the counts: the latest read of the post. */
  const best = [...rows].sort((a, b) => (b.views ?? -1) - (a.views ?? -1) || (b.likes ?? -1) - (a.likes ?? -1))[0];
  const found: NicheDetail["found"] = [];
  for (const r of rows) if (!found.some((f) => f.keyword === r.keyword && f.window === r.window)) found.push({ keyword: r.keyword, window: r.window });
  return {
    platform, id, code: best.code, src: "search", handle: best.handle, url: best.url, date: best.date,
    mediaType: best.mediaType, slideCount: best.slideCount,
    views: best.views, likes: best.likes, comments: best.comments, shares: best.shares, saves: best.saves,
    caption: best.caption, hashtags: hashtagsOf(best.caption),
    cover: rows.find((r) => r.coverLocal)?.cover ?? null,
    slides: [], sound: null, found,
  };
}

/** The detail of a post from your own scroll (a read batch; TikTok): the slides are on disk. */
export function scrollDetailOf(p: { id: string; handle: string; url: string; date: string | null; views: number; likes: number; comments: number; shares: number; saves: number; slideCount: number; caption: string; sound: string | null; slides: string[] }): NicheDetail {
  return {
    platform: "tiktok", id: p.id, src: "scroll", handle: p.handle, url: p.url, date: p.date ?? "",
    mediaType: "slideshow", slideCount: p.slideCount || p.slides.length || null,
    views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, saves: p.saves,
    caption: p.caption, hashtags: hashtagsOf(p.caption), cover: p.slides[0] ?? null, slides: p.slides, sound: p.sound,
    found: [{ keyword: "", window: "SCROLL" }],
  };
}
