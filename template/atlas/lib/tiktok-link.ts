/**
 * The TikTok link and the live numbers of a sent post.
 *
 * The rule (AGENTS.md rule 15): a post Post Bridge published live (a `direct`
 * send) takes its link from Post Bridge only, and the link pull makes no Monid
 * call for it (`linkViaDirectSend`). When Post Bridge has not filled the post
 * id yet, the report says so and the next sync asks Post Bridge again.
 *
 * Monid (the same apidojo/tiktok-profile-scraper call as
 * tools/scrape-account.sh) is for a post Post Bridge did not publish: a draft
 * published by hand from the phone, or a post published on TikTok by hand
 * with no send at all (a `posted` line with `data.manual: true`,
 * `handPostedLine`). Post Bridge never learns the final URL of such a post
 * (platform_video_id stays null).
 *
 * A draft Post Bridge's own analytics already report a link for (`pbLinkOf`,
 * an `outcome.sync` line with `data.source === "postbridge"`) skips Monid too:
 * the link is written straight from that URL.
 *
 * Otherwise, "find the link", per handle with a sent post that has no link yet:
 *   1. fetch the handle's latest posts through Monid (one paid call per handle, cents);
 *   2. match (pickRecord), among the posts uploaded after the send (or the
 *      final approval, for a post published by hand), of the post's kind
 *      (slideshow or video), and not linked by another post of the handle:
 *      by caption first — the first line, hashtags off, exact or a high
 *      token overlap (captionMatch) — then, for the posts still open, the
 *      single post left (a hashtags-only caption, matchByTime) or the single
 *      one of the same shape (the slide count; a caption rewritten on the phone);
 *   3. exactly one match: append `posted.link` { url, id, uploadedAt } and, when
 *      no `posted` line exists yet, `posted` { time, url } — both actor "sync";
 *      more than one: write nothing and return the candidates.
 * Then, for every linked post, one `outcome.sync` line from the Monid record
 * (views, likes, comments, saves, shares; data.source = "monid") when the
 * numbers changed. Server-side only (node:child_process). Pure parts at the top.
 */

import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { allStates, appendEvent, getProduction, readLog, type Event, type PostState } from "./production.ts";
import { linePlatform } from "./platform.ts";
import { hasKey, legStatusOf, postBridge, type Leg, type PBAnalytics, type PBPost, type PBPostResult, type PostBridgeClient } from "./postbridge.ts";

const run = promisify(execFile);

/** One post as Monid returns it (the fields this file reads). */
export type MonidPost = {
  id: string;
  postPage: string;
  uploadedAtFormatted: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  title: string;
  images?: unknown[];
  /** When the record was read, for a record replayed from a saved run (`savedRunsFetch`); absent means now. */
  readAt?: string;
};

/** The data of an `outcome.sync` line written from Monid. */
export type MonidOutcome = {
  source: "monid";
  tiktokId: string;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  url: string;
  syncedAt: string;
};

/* ---------------------------------------------------------------- match */

/** The caption's first line as tokens: hashtags, punctuation and emoji off, lower case. */
export function captionTokens(text: string): string[] {
  return (text.split("\n")[0] ?? "")
    .replace(/#[^\s#]+/g, " ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Two words are the same word: equal, or one is the other's stem ("desensitize" / "desensitized"; six letters or more). */
const sameWord = (x: string, y: string) => x === y || (x.length >= 6 && y.length >= 6 && (x.startsWith(y) || y.startsWith(x)));

/** 1 for the same words, else the share of the shorter side's words found in the other (0..1). The phone edit of a caption is what this tolerates. */
export function captionMatch(caption: string, title: string): number {
  const a = captionTokens(caption);
  const b = captionTokens(title);
  if (!a.length || !b.length) return 0;
  if (a.join(" ") === b.join(" ")) return 1;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.filter((t) => long.some((u) => sameWord(t, u))).length / short.length;
}

export const MATCH_MIN = 0.8;

/** The Monid posts that read as this caption and went up after the send. */
export function matchPosts(caption: string, sentAt: string, posts: MonidPost[]): { post: MonidPost; score: number }[] {
  return posts
    .filter((p) => p.uploadedAtFormatted > sentAt)
    .map((p) => ({ post: p, score: captionMatch(caption, p.title ?? "") }))
    .filter((m) => m.score >= MATCH_MIN)
    .sort((x, y) => y.score - x.score);
}

export type PostKind = "photo" | "video";

/** The URL TikTok shows for a post id: /photo/ for a slideshow, /video/ otherwise. */
export function tiktokUrlOf(handle: string, id: string, kind: PostKind): string {
  return `https://www.tiktok.com/@${handle.replace(/^@/, "")}/${kind}/${id}`;
}

/** The URL TikTok shows for a Monid record. */
export function tiktokUrl(handle: string, p: MonidPost): string {
  return tiktokUrlOf(handle, p.id, (p.images?.length ?? 0) > 0 ? "photo" : "video");
}

/**
 * A post of the slideshow path is a photo post: its deck has slides, and the
 * send uploads them as images. A post published by hand says what it was on
 * its `posted` line (`data.format`): a video posted by hand is a video, even
 * when its deck holds one slide (the frame shown on the board).
 */
export function postKindOf(s: Pick<PostState, "deck"> & { log?: Event[] }): PostKind {
  const format = s.log ? handPostedLine(s.log)?.data?.format : undefined;
  if (format === "video") return "video";
  if (format === "photo" || format === "slideshow") return "photo";
  return s.deck?.slides.length ? "photo" : "video";
}

/** The kind of a Monid record: a slideshow has images. */
export const recordKindOf = (p: MonidPost): PostKind => ((p.images?.length ?? 0) > 0 ? "photo" : "video");

export function outcomeOfMonid(p: MonidPost, url: string, now = p.readAt ?? new Date().toISOString()): MonidOutcome {
  return { source: "monid", tiktokId: p.id, views: p.views ?? 0, likes: p.likes ?? 0, comments: p.comments ?? 0, saves: p.bookmarks ?? 0, shares: p.shares ?? 0, url, syncedAt: now };
}

/* ---------------------------------------------------------------- monid */

export const MONID_COST_PER_POST = 0.00045;

/** A Monid handle-fetch's dollar estimate: `maxItems` posts at MONID_COST_PER_POST each — an upper bound, since Monid bills for what it actually returns. */
export function monidCostEstimate(maxItems: number): number {
  return maxItems * MONID_COST_PER_POST;
}

/** Margin added on top of a handle's sent-post count, for a deleted/hidden post or a retry. */
const MONID_MAX_ITEMS_MARGIN = 5;

/** The `maxItems` to ask Monid for so one fetch covers every one of a handle's sent TikTok posts, not just its newest 20. Pure. */
export function maxItemsFor(sentTiktokCount: number): number {
  return Math.max(sentTiktokCount, 0) + MONID_MAX_ITEMS_MARGIN;
}

/** The handle's latest posts through Monid (paid: about $0.00045 per post; `maxItems` sized by the caller, see `maxItemsFor`). */
export async function monidHandlePosts(handle: string, maxItems = 20): Promise<MonidPost[]> {
  const dir = mkdtempSync(join(tmpdir(), "atlas-monid-"));
  const out = join(dir, "posts.json");
  try {
    await run("monid", ["run", "-p", "apify", "-e", "/apidojo/tiktok-profile-scraper", "-i", JSON.stringify({ usernames: [handle.replace(/^@/, "")], maxItems }), "-w", "120", "-o", out], { env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 16 * 1024 * 1024 });
    const parsed = JSON.parse(readFileSync(out, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as MonidPost[]) : [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A saved Monid run as `monid runs get -r <id> -j` prints it (the fields this file reads). */
export type MonidRun = { runId: string; status: string; endpoint: string; input?: { body?: { usernames?: string[] } }; completedAt?: string; output?: MonidPost[] };

/**
 * A fetch that pays nothing: each handle's posts from a saved profile-scraper
 * run (one already paid for, read again with `monid runs get`), each record
 * marked with the run's time. A handle with no saved run is an error, never a
 * paid call. Pure; `monidRuns` reads the runs.
 */
export function savedRunsFetch(runs: MonidRun[]): Fetch {
  const byHandle = new Map<string, MonidRun>();
  for (const r of runs) {
    if (r.status !== "COMPLETED" || !r.endpoint.endsWith("/tiktok-profile-scraper")) continue;
    for (const u of r.input?.body?.usernames ?? []) {
      const h = u.replace(/^@/, "").toLowerCase();
      if ((r.completedAt ?? "") >= (byHandle.get(h)?.completedAt ?? "")) byHandle.set(h, r);
    }
  }
  return async (handle) => {
    const r = byHandle.get(handle.replace(/^@/, "").toLowerCase());
    if (!r) throw new Error(`no saved run for ${handle} among the runs given; no paid call was made`);
    return (r.output ?? []).map((p) => ({ ...p, readAt: r.completedAt }));
  };
}

/** The saved Monid runs, by id (`monid runs get`, free). */
export async function monidRuns(ids: string[]): Promise<MonidRun[]> {
  const out: MonidRun[] = [];
  for (const id of ids) {
    const { stdout } = await run("monid", ["runs", "get", "-r", id, "-j"], { env: { ...process.env, NO_COLOR: "1" }, maxBuffer: 64 * 1024 * 1024 });
    out.push(JSON.parse(stdout) as MonidRun);
  }
  return out;
}

/* ----------------------------------------------------------------- flow */

export type LinkReport = {
  post: string;
  handle: string;
  /** linked: the link was written now; known: it was in the log already; many/none: nothing written; error: the Monid call failed. */
  status: "linked" | "known" | "many" | "none" | "error";
  url: string | null;
  tiktokId: string | null;
  candidates: { url: string; title: string; uploadedAt: string; score: number }[];
  /** The Monid numbers, when the post is linked and its record was in the fetch. */
  outcome: MonidOutcome | null;
  /** True when an outcome.sync line was appended. */
  written: boolean;
  note: string;
};

type Fetch = (handle: string, maxItems: number) => Promise<MonidPost[]>;

/** A line of the TikTok leg: no platform named, or TikTok. The Instagram leg's lines are never read here. */
const tiktokLine = (e: Event) => linePlatform(e.data) === "tiktok";

/**
 * The `posted` line of a post published on TikTok by hand, with no send
 * through the posting service (`data.manual: true`, the TikTok leg). Such a
 * post has no send record, so only Monid can find its link, like a draft
 * published from the phone. Null otherwise.
 */
export function handPostedLine(log: Event[]): Event | null {
  return [...log].reverse().find((e) => e.kind === "posted" && (e.data?.manual as unknown) === true && tiktokLine(e)) ?? null;
}

/** A TikTok post the sync reads: sent through the posting service, or published on TikTok by hand (`handPostedLine`). */
export function syncsOnTiktok(s: PostState): boolean {
  return (s.primary ?? "tiktok") === "tiktok" && (!!s.sent || !!handPostedLine(s.log));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The time after which the post can be live on TikTok. A send: its time, or
 * its scheduled time when later (a direct post goes up at that time, never
 * before; a draft any time after the send). A post published by hand: the
 * final approval (it cannot go up before it), else the day before its plan
 * date. The `posted` line's own time is not used: it is often ticked before
 * or after the real upload.
 */
export function sinceOf(s: Pick<PostState, "sent" | "log"> & { row: { date: string } }): string {
  if (s.sent) return s.sent.scheduledAt && s.sent.scheduledAt > s.sent.at ? s.sent.scheduledAt : s.sent.at;
  const approved = [...s.log].reverse().find((e) => e.kind === "final.approve");
  if (approved) return approved.at;
  const day = Date.parse(`${s.row.date}T00:00:00Z`);
  return isNaN(day) ? "" : new Date(day - DAY_MS).toISOString();
}

/**
 * The TikTok link the log holds for a post: the last `posted.link`, else the
 * url of the `posted` line — either kind ignored unless `tiktokIdOf` can read
 * a real post id out of its url (`/video/<digits>` or `/photo/<digits>`). A
 * bare profile url (Post Bridge's `platform_data.url` for a direct TikTok
 * send) has no post id and must not count as a link, so a
 * post with only that written is still "unlinked" here.
 */
export function linkOf(log: Event[]): { url: string; id: string } | null {
  const l = [...log].reverse().find((e) => e.kind === "posted.link" && e.data?.url && tiktokIdOf(String(e.data.url)) && tiktokLine(e));
  if (l) return { url: String(l.data!.url), id: tiktokIdOf(String(l.data!.url))! };
  const p = [...log].reverse().find((e) => e.kind === "posted" && e.data?.url && tiktokIdOf(String(e.data.url)) && tiktokLine(e));
  if (p) return { url: String(p.data!.url), id: tiktokIdOf(String(p.data!.url))! };
  return null;
}

/** The TikTok id in a URL Post Bridge (or Monid) reports: the digits after `/video/` or `/photo/`, query stripped. */
export function tiktokIdOf(url: string): string | null {
  const m = url.split("?")[0].match(/\/(?:video|photo)\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * The link Post Bridge's own analytics already report for a post: the last
 * `outcome.sync` line with `data.source === "postbridge"`, its query stripped.
 * When Post Bridge already knows the link, `findLinks` uses it directly and
 * skips both the caption match and the Monid call — that pull is only for the
 * posts nothing else has resolved yet.
 */
export function pbLinkOf(log: Event[]): { url: string; id: string } | null {
  const e = [...log].reverse().find((ev) => ev.kind === "outcome.sync" && ev.data?.source === "postbridge" && typeof ev.data?.url === "string" && tiktokLine(ev) && tiktokIdOf(String(ev.data.url)));
  if (!e) return null;
  const url = String(e.data!.url).split("?")[0];
  const id = tiktokIdOf(url);
  return id ? { url, id } : null;
}

/** The single Monid post uploaded after the send, when it is the only one: the fallback for a caption with no text to match (hashtags only). */
export function matchByTime(since: string, posts: MonidPost[]): MonidPost | null {
  const later = posts.filter((p) => p.uploadedAtFormatted > since);
  return later.length === 1 ? later[0] : null;
}

export type FindLinksOpts = {
  /**
   * Fetch every handle in scope from Monid, even one where every post already
   * has a link — a stats refresh run on purpose (see `monidFetchPlan` for the
   * cost estimate before spending it).
   */
  refreshStats?: boolean;
  /**
   * No Monid call at all: the Post Bridge links (`direct` sends, `pbLinkOf`)
   * are still resolved and written; a post that only Monid can link is
   * reported as skipped.
   */
  noMonid?: boolean;
};

/**
 * A non-`direct` post that a Monid handle-fetch must cover: either it has no
 * link at all yet (Post Bridge's own analytics — `pbLinkOf` — didn't give one
 * either), or it does and the fetch is how its numbers get refreshed. A
 * `direct` post never needs one: its link is Post Bridge's job
 * (`linkViaDirectSend`), always.
 */
function needsMonidBatch(s: PostState): boolean {
  if (s.sent?.mode === "direct") return false;
  return !!linkOf(s.log) || !pbLinkOf(s.log);
}

/**
 * The Monid handles a `findLinks` run would fetch, and the `maxItems`/cost
 * estimate for each — no network call (Monid or Post Bridge), so it is safe
 * to print before spending real money. `sel` and `refreshStats` mirror
 * `findLinks`'s own arguments; call this with the same ones to get a true
 * preview of what that call would do.
 */
export function monidFetchPlan(slug: string, sel: { date?: string; keys?: string[] } = {}, opts: FindLinksOpts = {}): { handle: string; maxItems: number; costEstimate: number }[] {
  const wanted = sel.keys ?? (sel.date ? getProduction(slug).rows.filter((r) => r.date === sel.date).map((r) => r.key) : null);
  const states = allStates(slug).filter((s) => syncsOnTiktok(s) && (!wanted || wanted.includes(s.row.key)));
  const countByHandle = new Map<string, number>();
  const needsBatch = new Set<string>();
  for (const s of states) {
    countByHandle.set(s.row.handle, (countByHandle.get(s.row.handle) ?? 0) + 1);
    if (needsMonidBatch(s)) needsBatch.add(s.row.handle);
  }
  const toFetch = opts.refreshStats ? countByHandle.keys() : needsBatch.values();
  return [...toFetch].map((handle) => {
    const maxItems = maxItemsFor(countByHandle.get(handle) ?? 0);
    return { handle, maxItems, costEstimate: monidCostEstimate(maxItems) };
  });
}

/**
 * Finds the links and pulls the Monid numbers for every sent post, and every
 * post published on TikTok by hand (`handPostedLine`), or the ones selected.
 * A post Post Bridge already links (`pbLinkOf`) is resolved without a Monid
 * call. A post sent `direct` never touches Monid for its LINK — that always
 * comes from Post Bridge's own post results (`linkViaDirectSend`) — but once
 * a handle is fetched from Monid for any reason, every one of its posts whose
 * TikTok id is in the fetch, `direct` ones included, gets its numbers
 * refreshed from that record (`refreshStatsOnly`), a link written earlier in
 * the same run included. `maxItems` is sized per handle to cover every one of
 * its posts (`maxItemsFor`), not a fixed 20, so an older post is not silently
 * left with no numbers. The match, per handle, in two passes (`pickRecord`):
 * the caption first for every post, then time and shape for the rest; a
 * record another post of the handle already links is never matched again.
 * `opts.refreshStats` fetches every handle on purpose, even one with nothing
 * unlinked. `fetch` is for tests.
 */
export async function findLinks(slug: string, sel: { date?: string; keys?: string[] } = {}, fetch: Fetch = monidHandlePosts, opts: FindLinksOpts = {}): Promise<LinkReport[]> {
  const wanted = sel.keys ?? (sel.date ? getProduction(slug).rows.filter((r) => r.date === sel.date).map((r) => r.key) : null);
  /* The TikTok posts, sent or published by hand: Monid reads TikTok only. An Instagram leg's link comes from Post Bridge (syncOutcomes). */
  const tiktokAll = allStates(slug).filter(syncsOnTiktok);
  const states = tiktokAll.filter((s) => !wanted || wanted.includes(s.row.key));
  const pending = new Map<string, LinkReport>();
  const byHandleAll = new Map<string, PostState[]>();
  const byHandleNeedsBatch = new Map<string, PostState[]>();
  let pb: PostBridgeClient | null = null;
  for (const s of states) {
    byHandleAll.set(s.row.handle, [...(byHandleAll.get(s.row.handle) ?? []), s]);
    if (s.sent?.mode === "direct") {
      const known = linkOf(s.log);
      if (known) { pending.set(s.row.key, { post: s.row.key, handle: s.row.handle, status: "known", url: known.url, tiktokId: known.id, candidates: [], outcome: null, written: false, note: "linked already; a direct send is never read from Monid for its link" }); continue; }
      if (!hasKey()) { pending.set(s.row.key, { post: s.row.key, handle: s.row.handle, status: "error", url: null, tiktokId: null, candidates: [], outcome: null, written: false, note: "POST_BRIDGE_API_KEY is not set" }); continue; }
      pb ??= postBridge();
      pending.set(s.row.key, await linkViaDirectSend(s, pb));
      continue;
    }
    if (!needsMonidBatch(s)) { pending.set(s.row.key, linkViaPostBridge(s, pbLinkOf(s.log)!)); continue; }
    byHandleNeedsBatch.set(s.row.handle, [...(byHandleNeedsBatch.get(s.row.handle) ?? []), s]);
  }
  if (opts.noMonid) {
    for (const [handle, needsBatch] of byHandleNeedsBatch) {
      for (const s of needsBatch) {
        const known = linkOf(s.log);
        pending.set(s.row.key, known
          ? { post: s.row.key, handle, status: "known", url: known.url, tiktokId: known.id, candidates: [], outcome: null, written: false, note: "linked already; Monid skipped (--no-monid), so no numbers from Monid" }
          : { post: s.row.key, handle, status: "none", url: null, tiktokId: null, candidates: [], outcome: null, written: false, note: `${s.sent ? "not published by Post Bridge" : "posted by hand"}, so only Monid can find its link; Monid skipped (--no-monid)` });
      }
    }
    return states.map((s) => pending.get(s.row.key)!);
  }
  const handlesToFetch = new Set(byHandleNeedsBatch.keys());
  if (opts.refreshStats) for (const h of byHandleAll.keys()) handlesToFetch.add(h);
  for (const handle of handlesToFetch) {
    const needsBatch = byHandleNeedsBatch.get(handle) ?? [];
    const all = byHandleAll.get(handle) ?? [];
    const maxItems = maxItemsFor(all.length);
    let records: MonidPost[];
    try { records = await fetch(handle, maxItems); } catch (e) {
      const note = `Monid: ${e instanceof Error ? e.message : String(e)}`;
      for (const s of needsBatch) pending.set(s.row.key, { post: s.row.key, handle, status: "error", url: null, tiktokId: null, candidates: [], outcome: null, written: false, note });
      continue;
    }
    /* The TikTok ids this handle's posts already hold (every date, not only the selection), and the ones linked in this run. */
    const claimed = new Set<string>();
    for (const s of tiktokAll) if (s.row.handle === handle) for (const l of [linkOf(s.log), pbLinkOf(s.log)]) if (l) claimed.add(l.id);
    for (const r of pending.values()) if (r.handle === handle && r.tiktokId) claimed.add(r.tiktokId);
    const settle = (s: PostState, r: LinkReport) => { pending.set(s.row.key, r); if (r.tiktokId) claimed.add(r.tiktokId); };
    const open: PostState[] = [];
    for (const s of needsBatch) {
      const r = linkOne(s, handle, records, claimed, "caption");
      if (r) settle(s, r); else open.push(s);
    }
    for (const s of open) settle(s, linkOne(s, handle, records, claimed, "fallback")!);
    /* Every OTHER post of this handle already in the fetch — a direct send,
       or a draft already linked via Post Bridge's own analytics — gets its
       numbers refreshed too, since the fetch is already paid for. A link
       written earlier in this run counts: the states were read before it. */
    for (const s of all) {
      if (needsBatch.includes(s)) continue;
      const refreshed = refreshStatsOnly(s, handle, records, pending.get(s.row.key));
      if (refreshed) pending.set(s.row.key, refreshed);
    }
  }
  return states.map((s) => pending.get(s.row.key)!);
}

const DIGITS = /^\d+$/;

/**
 * The real post link for a `direct` TikTok send, from whichever Post Bridge
 * field carries the post id — pure, so the order is testable without a
 * network call. The url is always built from the id as TikTok shows it
 * (`tiktokUrlOf`: /photo/ for a slideshow, /video/ otherwise, no query), so
 * every source gives the same link. In order:
 *   1. `platform_data.url` (`statusUrl`, from `legStatusOf`), only when
 *      `tiktokIdOf` reads a post id from it. For a direct TikTok send Post
 *      Bridge puts the ACCOUNT'S PROFILE url here, so this step rarely
 *      resolves.
 *   2. `platform_data.platform_video_id`, if purely digits: the real id, in the
 *      post result as soon as TikTok has published (about two minutes after
 *      the scheduled time).
 *   3. the analytics `share_url` of the post result: TikTok's own link, with
 *      /video/ even for a photo post and a utm query.
 *   4. `platform_data.id`, if purely digits. For TikTok this field holds
 *      `"p_pub_url~v2.<n>"`, and <n> is the publish id, NOT the post id. The
 *      digits-only test rejects that shape.
 */
export function directLinkFrom(handle: string, c: { statusUrl?: string | null; shareUrl?: string | null; platformVideoId?: string | null; platformDataId?: string | null }, kind: PostKind = "video"): { url: string; id: string; source: string } | null {
  const found =
    c.statusUrl && tiktokIdOf(c.statusUrl) ? { id: tiktokIdOf(c.statusUrl)!, source: "platform_data.url" }
    : c.platformVideoId && DIGITS.test(c.platformVideoId) ? { id: c.platformVideoId, source: "platform_data.platform_video_id" }
    : c.shareUrl && tiktokIdOf(c.shareUrl) ? { id: tiktokIdOf(c.shareUrl)!, source: "analytics.share_url" }
    : c.platformDataId && DIGITS.test(c.platformDataId) ? { id: c.platformDataId, source: "platform_data.id" }
    : null;
  return found ? { url: tiktokUrlOf(handle, found.id, kind), ...found } : null;
}

/** What Post Bridge says about the link of a `direct` send: found, not yet, or failed. Pure. */
export type DirectLink =
  | { status: "linked"; url: string; id: string; source: string; uploadedAt: string | null }
  | { status: "waiting"; note: string }
  | { status: "error"; note: string };

/**
 * The link of a `direct` send from the Post Bridge post, its post results and
 * the analytics rows of the TikTok leg's result (`directLinkFrom`). Pure: the
 * caller does the three GETs. `uploadedAt` is TikTok's own publish time
 * (analytics `platform_created_at`) when Post Bridge has it.
 */
export function directLinkOf(handle: string, kind: PostKind, pbp: PBPost, results: PBPostResult[], analytics: PBAnalytics[], leg: Leg): DirectLink {
  const st = legStatusOf(pbp, results, leg);
  if (st.word === "error") return { status: "error", note: `Post Bridge: ${st.error ?? "the post failed"}` };
  const pd = results.find((r) => r.social_account_id === leg.account)?.platform_data;
  const row = analytics.find((r) => r.platform === "tiktok") ?? analytics[0];
  const found = directLinkFrom(handle, { statusUrl: st.url, shareUrl: row?.share_url, platformVideoId: pd?.platform_video_id, platformDataId: pd?.id }, kind);
  if (!found) return { status: "waiting", note: `Post Bridge has not filled the post id yet (post ${pbp.status}, leg ${st.word}); run the sync again later` };
  const created = row?.platform_created_at ? new Date(row.platform_created_at) : null;
  return { status: "linked", ...found, uploadedAt: created && !isNaN(created.getTime()) ? created.toISOString() : null };
}

/**
 * A `direct` send's link: Post Bridge's post, its post results
 * (`GET /v1/post-results?post_id=`) and the leg's analytics row, read by
 * `directLinkOf` — never Monid, since Post Bridge published the post itself.
 * When the id is not there yet, nothing is written and the next sync asks
 * Post Bridge again.
 */
async function linkViaDirectSend(s: PostState, pb: PostBridgeClient): Promise<LinkReport> {
  const base = { post: s.row.key, handle: s.row.handle, candidates: [] as LinkReport["candidates"], outcome: null as MonidOutcome | null, written: false };
  const leg: Leg = { platform: "tiktok", account: s.sent!.account };
  try {
    const [pbp, results] = await Promise.all([pb.getPost(s.sent!.id), pb.listPostResults(s.sent!.id)]);
    const result = results.find((r) => r.social_account_id === leg.account);
    const analytics = result?.success ? await pb.analyticsForResult(result.id) : [];
    const d = directLinkOf(s.row.handle, postKindOf(s), pbp, results, analytics, leg);
    if (d.status === "error") return { ...base, status: "error", url: null, tiktokId: null, note: d.note };
    if (d.status === "waiting") return { ...base, status: "none", url: null, tiktokId: null, note: `${d.note}; no Monid call was made` };
    writeLink(s, d.url, d.id, d.uploadedAt ?? sinceOf(s));
    return { ...base, status: "linked", url: d.url, tiktokId: d.id, note: `linked from Post Bridge's ${d.source} (direct send); no Monid call was made` };
  } catch (e) {
    return { ...base, status: "error", url: null, tiktokId: null, note: `Post Bridge: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Writes `posted.link` (and `posted`, when none exists or the existing one
 * has no usable post id — the log is append-only, so a bad `posted` line
 * is superseded by a later, corrected one rather than edited in place) —
 * shared by every path that resolves a link.
 */
function writeLink(s: PostState, url: string, id: string, uploadedAt: string): void {
  appendEvent(s.row.slug, { post: s.row.key, kind: "posted.link", actor: "sync", data: { url, id, uploadedAt } });
  if (!s.posted || !tiktokIdOf(s.posted.url)) appendEvent(s.row.slug, { post: s.row.key, kind: "posted", actor: "sync", data: { time: uploadedAt.slice(11, 16), url } });
}

/** A post Post Bridge already reports the link for: no caption match, no Monid call. The url is rebuilt from the id (share_url says /video/ for a photo post too). */
function linkViaPostBridge(s: PostState, pb: { url: string; id: string }): LinkReport {
  const base = { post: s.row.key, handle: s.row.handle, candidates: [] as LinkReport["candidates"], outcome: null as MonidOutcome | null, written: false };
  const url = tiktokUrlOf(s.row.handle, pb.id, postKindOf(s));
  writeLink(s, url, pb.id, sinceOf(s));
  return { ...base, status: "linked", url, tiktokId: pb.id, note: "linked from Post Bridge's own analytics; no Monid call was made" };
}

/**
 * A link already known to have this `id`, matched against a Monid fetch: an
 * `outcome.sync` line (source "monid") when the record is in the fetch and
 * the numbers changed since the last Monid line. Shared by `linkOne` (a link
 * just found, or already known) and `refreshStatsOnly` (any other sent post
 * of a handle that got fetched anyway).
 */
function syncOutcomeFromRecords(s: PostState, status: LinkReport["status"], url: string, id: string, records: MonidPost[], base: { post: string; handle: string; candidates: LinkReport["candidates"] }): LinkReport {
  const record = records.find((p) => p.id === id);
  if (!record) return { ...base, status, url, tiktokId: id, outcome: null, written: false, note: `linked, but the post is not among the latest ${records.length} Monid records; no numbers` };
  const o = outcomeOfMonid(record, url);
  const prev = [...s.log].reverse().find((e) => e.kind === "outcome.sync" && e.data?.source === "monid")?.data ?? null;
  const same = !!prev && (["views", "likes", "comments", "saves", "shares"] as const).every((k) => Number(prev[k] ?? -1) === o[k]);
  if (!same) appendEvent(s.row.slug, { post: s.row.key, kind: "outcome.sync", actor: "sync", data: { ...o } });
  return { ...base, status, url, tiktokId: id, outcome: o, written: !same, note: same ? "numbers unchanged" : "numbers written" };
}

/**
 * A sent post that already has a link (any mode) but wasn't the reason its
 * handle got fetched — a `direct` send, or a draft already linked through
 * Post Bridge's own analytics — gets its numbers refreshed from the same
 * fetch, at no extra Monid cost. `now` is the report this run already made
 * for the post: a link written in this run is not in `s.log` yet. Null when
 * the post has no link yet (a `direct` send Post Bridge hasn't reported a
 * link for): nothing to match.
 */
function refreshStatsOnly(s: PostState, handle: string, records: MonidPost[], now?: LinkReport): LinkReport | null {
  const known = now?.url && now.tiktokId ? { url: now.url, id: now.tiktokId } : linkOf(s.log);
  if (!known) return null;
  return syncOutcomeFromRecords(s, now?.status === "linked" ? "linked" : "known", known.url, known.id, records, { post: s.row.key, handle, candidates: [] });
}

/** What the match needs to know of a post. */
export type MatchTarget = { caption: string; since: string; kind: PostKind; slides: number };

export type RecordPick =
  | { status: "linked"; record: MonidPost; score: number; how: "caption" | "time" | "shape" }
  | { status: "many" | "none"; candidates: { post: MonidPost; score: number }[]; note: string }
  | null;

/** The record has the post's shape: any video for a video, the same slide count for a slideshow. */
const sameShape = (t: MatchTarget, p: MonidPost) => t.kind === "video" || (p.images?.length ?? 0) === t.slides;

const at16 = (iso: string) => iso.slice(0, 16).replace("T", " ");

/**
 * The Monid record of one post, from the handle's fetch. Pure. Only the
 * records that went up after `since`, that no other post of the handle
 * already links (`claimed`), and of the post's own kind (a slideshow has
 * images, a video has none) are read. Two passes:
 *   "caption"   the caption's first line (`matchPosts`), among the records of
 *               the same shape (`sameShape`): one match links it, several
 *               are "many"; no match, or a caption with no text
 *               (hashtags only), returns null for the second pass.
 *   "fallback"  for a caption with no text, the single record left
 *               (`matchByTime`); then, for any post, the single record of the
 *               same shape: a slideshow with the same number of slides, or
 *               the one video. This is what finds a draft whose caption was
 *               rewritten on the phone. Otherwise "many" or "none".
 * The caller runs the caption pass for every post of the handle before the
 * fallback, so a weaker match never takes the record of a stronger one.
 */
export function pickRecord(t: MatchTarget, records: MonidPost[], claimed: Set<string>, pass: "caption" | "fallback"): RecordPick {
  const later = records.filter((p) => p.uploadedAtFormatted > t.since && !claimed.has(p.id) && recordKindOf(p) === t.kind);
  const scored = () => later.map((p) => ({ post: p, score: captionMatch(t.caption, p.title ?? "") }));
  const hasText = captionTokens(t.caption).length > 0;
  if (pass === "caption") {
    if (!hasText) return null;
    const matches = matchPosts(t.caption, t.since, later);
    /* Only a record of the same shape: short captions share words, and a post of another slide count is another post. */
    const same = matches.filter((m) => sameShape(t, m.post));
    if (same.length === 1) return { status: "linked", record: same[0].post, score: same[0].score, how: "caption" };
    if (same.length > 1) return { status: "many", candidates: same, note: `${same.length} posts match the caption; nothing written` };
    return null;
  }
  if (!hasText) {
    const byTime = matchByTime(t.since, later);
    if (byTime) return { status: "linked", record: byTime, score: 0, how: "time" };
  }
  const shape = later.filter((p) => sameShape(t, p));
  if (shape.length === 1) return { status: "linked", record: shape[0], score: captionMatch(t.caption, shape[0].title ?? ""), how: "shape" };
  const what = t.kind === "photo" ? `slideshow${t.slides ? ` of ${t.slides} slides` : ""}` : "video";
  const note = !later.length
    ? `no ${t.kind === "photo" ? "slideshow" : "video"} of the handle after ${at16(t.since)} that no other post already links${hasText ? "" : " (the caption is hashtags only)"}`
    : hasText
      ? `no post after ${at16(t.since)} reads as the caption, and ${shape.length ? `${shape.length} of them are a ${what}` : `none is a ${what}`} (${later.length} later post${later.length === 1 ? "" : "s"} seen)`
      : `the caption is hashtags only; ${later.length} posts went up after ${at16(t.since)}, none can be told apart`;
  return { status: later.length ? (hasText && !shape.length ? "none" : "many") : "none", candidates: scored(), note };
}

/** One post not linked yet (or linked already), against its handle's fetch: `pickRecord` for the pass, then the link and the numbers. Null: the caption pass found nothing; try the fallback. */
function linkOne(s: PostState, handle: string, records: MonidPost[], claimed: Set<string>, pass: "caption" | "fallback"): LinkReport | null {
  const key = s.row.key;
  const known = linkOf(s.log);
  const base = { post: key, handle, candidates: [] as LinkReport["candidates"] };
  if (known) return syncOutcomeFromRecords(s, "known", known.url, known.id, records, base);
  const target: MatchTarget = { caption: s.deck?.caption ?? "", since: sinceOf(s), kind: postKindOf(s), slides: s.deck?.slides.length ?? 0 };
  const pick = pickRecord(target, records, claimed, pass);
  if (!pick) return null;
  const cands = (list: { post: MonidPost; score: number }[]) => list.map((m) => ({ url: tiktokUrl(handle, m.post), title: m.post.title ?? "", uploadedAt: m.post.uploadedAtFormatted, score: m.score }));
  if (pick.status !== "linked") return { ...base, candidates: cands(pick.candidates), status: pick.status, url: null, tiktokId: null, outcome: null, written: false, note: pick.note };
  const url = tiktokUrl(handle, pick.record);
  writeLink(s, url, pick.record.id, pick.record.uploadedAtFormatted);
  const r = syncOutcomeFromRecords(s, "linked", url, pick.record.id, records, { ...base, candidates: cands([{ post: pick.record, score: pick.score }]) });
  const how = pick.how === "caption" ? "" : pick.how === "time" ? "matched by time (the caption is hashtags only); " : `matched by kind, slide count and time (caption ${Math.round(pick.score * 100)}%, edited on the phone?); `;
  return { ...r, note: `${s.sent ? "" : "posted by hand; "}${how}${r.note}` };
}
