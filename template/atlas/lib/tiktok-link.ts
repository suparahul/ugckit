/**
 * The TikTok link and the live numbers of a post that went out as a draft,
 * from Monid (the same apidojo/tiktok-profile-scraper call as
 * tools/scrape-account.sh), not from Post Bridge: Post Bridge never learns the
 * final URL of a draft (platform_video_id stays null once the phone publishes it).
 *
 * "Find the link", per handle with a sent post that has no link yet:
 *   1. fetch the handle's latest posts through Monid (one paid call per handle, cents);
 *   2. match by caption: the caption's first line, hashtags off, exact or a
 *      high token overlap (captionMatch), and an upload time after the send;
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

/** The URL TikTok shows for the post: /photo/ for a slideshow, /video/ otherwise. */
export function tiktokUrl(handle: string, p: MonidPost): string {
  const kind = (p.images?.length ?? 0) > 0 ? "photo" : "video";
  return `https://www.tiktok.com/@${handle.replace(/^@/, "")}/${kind}/${p.id}`;
}

export function outcomeOfMonid(p: MonidPost, url: string, now = new Date().toISOString()): MonidOutcome {
  return { source: "monid", tiktokId: p.id, views: p.views ?? 0, likes: p.likes ?? 0, comments: p.comments ?? 0, saves: p.bookmarks ?? 0, shares: p.shares ?? 0, url, syncedAt: now };
}

/* ---------------------------------------------------------------- monid */

/** The handle's latest posts through Monid (paid: about $0.00045 per post). */
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

type Fetch = (handle: string) => Promise<MonidPost[]>;

/** The link the log holds for a post: the last `posted.link`, else the url of the `posted` line. */
export function linkOf(log: Event[]): { url: string; id: string | null } | null {
  const l = [...log].reverse().find((e) => e.kind === "posted.link" && e.data?.url);
  if (l) return { url: String(l.data!.url), id: l.data!.id ? String(l.data!.id) : null };
  const p = [...log].reverse().find((e) => e.kind === "posted" && e.data?.url);
  if (p) return { url: String(p.data!.url), id: String(p.data!.url).split("/").pop() ?? null };
  return null;
}

/**
 * Finds the links and pulls the Monid numbers for every sent post (or the
 * ones selected). One Monid call per handle. `fetch` is for tests.
 */
export async function findLinks(slug: string, sel: { date?: string; keys?: string[] } = {}, fetch: Fetch = monidHandlePosts): Promise<LinkReport[]> {
  const wanted = sel.keys ?? (sel.date ? getProduction(slug).rows.filter((r) => r.date === sel.date).map((r) => r.key) : null);
  const states = allStates(slug).filter((s) => s.sent && (!wanted || wanted.includes(s.row.key)));
  const byHandle = new Map<string, PostState[]>();
  for (const s of states) byHandle.set(s.row.handle, [...(byHandle.get(s.row.handle) ?? []), s]);
  const reports: LinkReport[] = [];
  for (const [handle, posts] of byHandle) {
    let records: MonidPost[];
    try { records = await fetch(handle); } catch (e) {
      const note = `Monid: ${e instanceof Error ? e.message : String(e)}`;
      for (const s of posts) reports.push({ post: s.row.key, handle, status: "error", url: null, tiktokId: null, candidates: [], outcome: null, written: false, note });
      continue;
    }
    for (const s of posts) reports.push(linkOne(s, handle, records));
  }
  return reports;
}

function linkOne(s: PostState, handle: string, records: MonidPost[]): LinkReport {
  const key = s.row.key;
  const known = linkOf(s.log);
  const base = { post: key, handle, candidates: [] as LinkReport["candidates"], outcome: null as MonidOutcome | null, written: false };
  let record: MonidPost | undefined;
  let url: string;
  let status: LinkReport["status"];
  if (known) {
    status = "known";
    url = known.url;
    record = records.find((p) => p.id === known.id);
  } else {
    const caption = s.deck?.caption ?? "";
    /* A direct post goes up at its scheduled time, never before; a draft any time after the send. */
    const since = s.sent!.scheduledAt && s.sent!.scheduledAt > s.sent!.at ? s.sent!.scheduledAt : s.sent!.at;
    const matches = matchPosts(caption, since, records);
    base.candidates = matches.map((m) => ({ url: tiktokUrl(handle, m.post), title: m.post.title, uploadedAt: m.post.uploadedAtFormatted, score: m.score }));
    if (matches.length !== 1) {
      /* Nothing matched: the later posts are the candidates the eye can check. */
      const later = records.filter((p) => p.uploadedAtFormatted > since);
      if (!matches.length) base.candidates = later.map((p) => ({ url: tiktokUrl(handle, p), title: p.title ?? "", uploadedAt: p.uploadedAtFormatted, score: captionMatch(caption, p.title ?? "") }));
      return { ...base, status: matches.length ? "many" : "none", url: null, tiktokId: null, note: matches.length ? `${matches.length} posts match the caption; nothing written` : `no post of @${handle.replace(/^@/, "")} after ${since.slice(0, 16).replace("T", " ")} reads as the caption (${later.length} later post${later.length === 1 ? "" : "s"} seen)` };
    }
    record = matches[0].post;
    url = tiktokUrl(handle, record);
    status = "linked";
    appendEvent(s.row.slug, { post: key, kind: "posted.link", actor: "sync", data: { url, id: record.id, uploadedAt: record.uploadedAtFormatted } });
    if (!s.posted) appendEvent(s.row.slug, { post: key, kind: "posted", actor: "sync", data: { time: record.uploadedAtFormatted.slice(11, 16), url } });
  }
  if (!record) return { ...base, status, url, tiktokId: known?.id ?? null, note: "linked, but the post is not among the latest Monid records; no numbers" };
  const o = outcomeOfMonid(record, url);
  const prev = [...s.log].reverse().find((e) => e.kind === "outcome.sync" && e.data?.source === "monid")?.data ?? null;
  const same = !!prev && (["views", "likes", "comments", "saves", "shares"] as const).every((k) => Number(prev[k] ?? -1) === o[k]);
  if (!same) appendEvent(s.row.slug, { post: key, kind: "outcome.sync", actor: "sync", data: { ...o } });
  return { ...base, status, url, tiktokId: record.id, outcome: o, written: !same, note: same ? "numbers unchanged" : "numbers written" };
}
