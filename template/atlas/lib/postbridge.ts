/**
 * A thin typed client for the Post Bridge REST API (https://api.post-bridge.com).
 *
 * Endpoints, from the CLI source (post-bridge-hq/agent-mode, postbridge-cli
 * 1.1.4) and the OpenAPI document at https://api.post-bridge.com/openapi.json:
 *
 *   GET  /v1/social-accounts                 the connected accounts (id, platform, username)
 *   POST /v1/media/create-upload-url         { mime_type, size_bytes, name } → { media_id, upload_url }
 *   PUT  <upload_url>                        the file's bytes, then the media id is usable
 *   POST /v1/posts                           { caption, social_accounts, media, platform_configurations, scheduled_at?, is_draft? }
 *   GET  /v1/posts/{id}                      status: scheduled | processing | posted | failed
 *   GET  /v1/post-results?post_id=           one row per account: success, error, platform_data { id, url }
 *   GET  /v1/analytics?post_result_id=       view_count, like_count, comment_count, share_count (no save count)
 *   GET  /v1/analytics/{id}/daily            per-day snapshots and deltas
 *   POST /v1/analytics/sync?platform=        asks the platforms for fresh numbers (30-minute cooldown, 429 when too soon)
 *
 * The key is read from POST_BRIDGE_API_KEY, server-side only (atlas/.env.local,
 * never committed). This module imports nothing from the rest of the Atlas, so
 * the scripts import it too (Node strips the types).
 *
 * Two different "draft" flags, not to be confused:
 *   is_draft: true                              Post Bridge keeps the post and sends nothing anywhere.
 *   platform_configurations.tiktok.draft: true  Post Bridge processes the post now and TikTok puts it in the account's
 *                                               inbox (drafts) instead of publishing it. This is the one the Atlas uses.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

import { PLATFORMS, platformOf, primaryOf, type Platform } from "./platform.ts";

export const API_BASE = "https://api.post-bridge.com";
export const ENV_KEY = "POST_BRIDGE_API_KEY";

export type PBAccount = { id: number; platform: string; username: string; needs_reconnect?: boolean };

export type PBPostStatus = "scheduled" | "processing" | "posted" | "failed";

export type PBPost = {
  id: string;
  caption: string;
  status: PBPostStatus;
  scheduled_at: string | null;
  platform_configurations: Record<string, unknown> | null;
  social_accounts: number[];
  media: unknown;
  created_at: string;
  updated_at: string;
  is_draft: boolean;
  warnings?: string[];
};

export type PBPostResult = {
  id: string;
  post_id: string;
  success: boolean;
  social_account_id: number;
  /** A string, an object with a message, or null: the platform's own words. */
  error: unknown;
  platform_data: { id?: string; url?: string; username?: string; platform_video_id?: string | null } | null;
};

export type PBAnalytics = {
  id: string;
  post_result_id: string;
  platform: string;
  platform_post_id: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  share_url: string | null;
  last_synced_at: string;
  match_confidence: string | null;
};

export type PBAnalyticsDaily = {
  snapshots: { date: string; view_count: number; like_count: number; comment_count: number; share_count: number }[];
  deltas: { date: string; views: number; likes: number; comments: number; shares: number }[];
};

export type PBPage<T> = { data: T[]; meta?: { total?: number; offset?: number; limit?: number } };

export type TiktokConfig = {
  draft?: boolean;
  title?: string;
  privacy_status?: "public" | "private";
  auto_add_music?: boolean;
  allow_comment?: boolean;
  /** Video posts only; no effect on a photo post. */
  allow_duet?: boolean;
  allow_stitch?: boolean;
  is_aigc?: boolean;
  disclose_branded_content?: boolean;
  disclose_your_brand?: boolean;
};

/**
 * Instagram has no draft: a post is published when Post Bridge processes it
 * (its API reference has no draft field for Instagram; `is_draft` only holds
 * the post in Post Bridge). `media` and `caption` override the post's for the
 * Instagram account; the kit sends no `first_comment` (Rahul, 2026-09-23: the
 * hashtags stay in the caption). Carousels take 1–10 images, JPEG, 4:5 to 1.91:1.
 */
export type InstagramConfig = { caption?: string; media?: string[]; first_comment?: string; placement?: "story" };

export type PlatformConfig = { tiktok?: TiktokConfig; instagram?: InstagramConfig } & Record<string, unknown>;

export type CreatePostInput = {
  caption: string;
  /** Post Bridge social account ids. */
  accounts: number[];
  /** Media ids from uploadMedia, in slide order. Several images to one TikTok account make a photo post. */
  media: string[];
  platformConfig?: PlatformConfig;
  /** ISO time; absent means "process now". */
  schedule?: string;
};

export type MediaFile = { path: string } | { name: string; bytes: Uint8Array; mime: MediaMime };
export type MediaMime = "image/png" | "image/jpeg" | "video/mp4" | "video/quicktime" | "application/pdf";

export class PostBridgeError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Post Bridge answered ${status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
    this.name = "PostBridgeError";
    this.status = status;
    this.body = body;
  }
}

export type PostBridgeClient = ReturnType<typeof postBridge>;

export type ClientOptions = {
  apiKey?: string;
  /** Injected in tests; the real fetch otherwise. */
  fetch?: typeof fetch;
  base?: string;
  /** Sent as X-PB-Client, the surface that made the post. */
  clientName?: string;
};

/**
 * The key: the environment's non-empty value, else the last non-empty
 * POST_BRIDGE_API_KEY= line of the workspace's .env (the kit's convention),
 * else of atlas/.env.local (dotenv loaders keep the first assignment, and the
 * file may start with an empty placeholder line). Never printed.
 */
export function readKey(env: Record<string, string | undefined> = process.env, envFile?: string): string | null {
  const fromEnv = (env[ENV_KEY] ?? "").trim();
  if (fromEnv) return fromEnv;
  const root = env.ATLAS_ROOT ? resolve(env.ATLAS_ROOT) : resolve(process.cwd(), "..");
  const files = envFile ? [envFile] : [resolve(root, ".env"), resolve(process.cwd(), ".env.local")];
  let key: string | null = null;
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(new RegExp(`^\\s*(?:export\\s+)?${ENV_KEY}\\s*=\\s*(.*?)\\s*$`));
      if (!m) continue;
      const v = m[1].replace(/^(["'])(.*)\1$/, "$2").trim();
      if (v) key = v;
    }
    if (key) break;
  }
  return key;
}

/** True when a key is set. The scripts and the UI ask this before they promise anything. */
export function hasKey(env: Record<string, string | undefined> = process.env): boolean {
  return !!readKey(env);
}

const MIME_BY_EXT: Record<string, MediaMime> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".mov": "video/quicktime", ".pdf": "application/pdf" };

export function mimeOf(file: string): MediaMime {
  const m = MIME_BY_EXT[extname(file).toLowerCase()];
  if (!m) throw new Error(`Post Bridge does not accept ${extname(file) || "a file without an extension"}: PNG, JPEG, MP4, MOV or PDF.`);
  return m;
}

/** The message of a post result's error, whatever shape the platform gave it. */
export function errorText(e: unknown): string | null {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    for (const k of ["message", "error", "detail", "description"]) if (typeof o[k] === "string") return o[k] as string;
    return JSON.stringify(e);
  }
  return String(e);
}

export function postBridge(opts: ClientOptions = {}) {
  const apiKey = opts.apiKey ?? readKey();
  if (!apiKey) throw new Error(`${ENV_KEY} is not set. Put the key from the Post Bridge dashboard (API Keys) in the workspace .env.`);
  const doFetch = opts.fetch ?? fetch;
  const base = (opts.base ?? API_BASE).replace(/\/$/, "");
  const clientName = opts.clientName ?? "atlas";

  async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-PB-Client": clientName },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: unknown;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new PostBridgeError(res.status, data);
    return data as T;
  }

  const q = (params: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
    const s = u.toString();
    return s ? `?${s}` : "";
  };

  /** One row per account the post went to. */
  async function listPostResults(postId: string): Promise<PBPostResult[]> {
    const page = await call<PBPage<PBPostResult>>("GET", `/v1/post-results${q({ post_id: postId, limit: 100 })}`);
    return page.data ?? [];
  }

  return {
    /** Every connected account. Post Bridge pages at 10 by default; this asks for 100. */
    async listAccounts(): Promise<PBAccount[]> {
      const page = await call<PBPage<PBAccount>>("GET", `/v1/social-accounts${q({ limit: 100 })}`);
      return page.data ?? [];
    },

    /** Two steps: ask for a signed URL, then PUT the bytes. Returns the media id to pass to createPost. */
    async uploadMedia(file: MediaFile): Promise<{ media_id: string; name: string }> {
      const name = "path" in file ? basename(file.path) : file.name;
      const mime = "path" in file ? mimeOf(file.path) : file.mime;
      const bytes = "path" in file ? new Uint8Array(readFileSync(file.path)) : file.bytes;
      const size = "path" in file ? statSync(file.path).size : bytes.byteLength;
      const created = await call<{ media_id: string; upload_url: string; name: string }>("POST", "/v1/media/create-upload-url", { mime_type: mime, size_bytes: size, name });
      const put = await doFetch(created.upload_url, { method: "PUT", headers: { "Content-Type": mime }, body: new Blob([bytes as BlobPart], { type: mime }) });
      if (!put.ok) throw new PostBridgeError(put.status, await put.text().catch(() => ""), `The upload of ${name} failed (${put.status}).`);
      return { media_id: created.media_id, name: created.name ?? name };
    },

    async createPost(input: CreatePostInput): Promise<PBPost> {
      const body: Record<string, unknown> = {
        caption: input.caption,
        social_accounts: input.accounts,
        media: input.media,
      };
      if (input.platformConfig) body.platform_configurations = input.platformConfig;
      if (input.schedule) body.scheduled_at = input.schedule;
      return call<PBPost>("POST", "/v1/posts", body);
    },

    /** PATCH /v1/posts/{id}. A scheduled post must always get `scheduled_at` again, else Post Bridge processes it at once. */
    updatePost(id: string, patch: { scheduled_at?: string; caption?: string }): Promise<PBPost> {
      return call<PBPost>("PATCH", `/v1/posts/${encodeURIComponent(id)}`, patch);
    },

    getPost(id: string): Promise<PBPost> {
      return call<PBPost>("GET", `/v1/posts/${encodeURIComponent(id)}`);
    },

    async listPosts(params: { status?: PBPostStatus | "draft"; platform?: string; limit?: number; offset?: number } = {}): Promise<PBPost[]> {
      const page = await call<PBPage<PBPost>>("GET", `/v1/posts${q(params)}`);
      return page.data ?? [];
    },

    deletePost(id: string): Promise<unknown> {
      return call("DELETE", `/v1/posts/${encodeURIComponent(id)}`);
    },

    listPostResults,

    /** The analytics rows of one post result. */
    async analyticsForResult(resultId: string): Promise<PBAnalytics[]> {
      const page = await call<PBPage<PBAnalytics>>("GET", `/v1/analytics${q({ post_result_id: resultId, limit: 100 })}`);
      return page.data ?? [];
    },

    /** The analytics rows for one Post Bridge post: found through its post results. */
    async analyticsForPost(postId: string): Promise<PBAnalytics[]> {
      const results = await listPostResults(postId);
      const out: PBAnalytics[] = [];
      for (const r of results) {
        const page = await call<PBPage<PBAnalytics>>("GET", `/v1/analytics${q({ post_result_id: r.id, limit: 100 })}`);
        out.push(...(page.data ?? []));
      }
      return out;
    },

    async listAnalytics(params: { platform?: string; timeframe?: "7d" | "30d" | "90d" | "all"; limit?: number; offset?: number } = {}): Promise<PBAnalytics[]> {
      const page = await call<PBPage<PBAnalytics>>("GET", `/v1/analytics${q(params)}`);
      return page.data ?? [];
    },

    analyticsDaily(analyticsId: string): Promise<PBAnalyticsDaily> {
      return call<PBAnalyticsDaily>("GET", `/v1/analytics/${encodeURIComponent(analyticsId)}/daily`);
    },

    /** Asks Post Bridge to pull fresh numbers. Returns false on the 30-minute cooldown (429) instead of throwing. */
    async syncAnalytics(platform?: string): Promise<boolean> {
      try {
        await call("POST", `/v1/analytics/sync${q({ platform })}`);
        return true;
      } catch (e) {
        if (e instanceof PostBridgeError && e.status === 429) return false;
        throw e;
      }
    },
  };
}

/* ------------------------------------------------- the Atlas's own shapes */

/** The request the Atlas makes for a TikTok photo post that lands in the account's drafts. */
export function tiktokDraftPost(caption: string, accountId: number, media: string[]): CreatePostInput {
  return {
    caption,
    accounts: [accountId],
    media,
    platformConfig: { tiktok: { draft: true } },
  };
}

/**
 * A direct TikTok photo post at a set time: `scheduled_at` (ISO UTC), no draft,
 * public, comments on, TikTok picks the sound (`auto_add_music`, its default,
 * set on purpose). Duet and stitch are video-only and left at their defaults.
 * The cover slide must carry its text: nobody types it (render-slides.mjs --burn-cover).
 */
export function tiktokDirectPost(caption: string, accountId: number, media: string[], scheduledAt: string): CreatePostInput {
  return {
    caption,
    accounts: [accountId],
    media,
    schedule: scheduledAt,
    platformConfig: { tiktok: { draft: false, privacy_status: "public", auto_add_music: true, allow_comment: true } },
  };
}

/** One account a post goes to: the platform and the posting service's account id. */
export type Leg = { platform: Platform; account: number };

/**
 * One request for every leg of a post: the accounts together, one time for all
 * (Rahul, 2026-09-23: Instagram posts at the same time as TikTok). TikTok gets
 * the draft or the direct configuration as before; Instagram gets its own
 * slides (4:5 JPEG) and the same caption, hashtags included, with no first
 * comment. With no TikTok leg, the post's own media and caption are
 * Instagram's.
 */
export function legsPost(o: {
  legs: Leg[];
  mode: "draft" | "direct";
  /** Direct mode: ISO UTC, one instant for every leg. */
  scheduledAt?: string | null;
  tiktok?: { caption: string; media: string[] };
  instagram?: { caption: string; media: string[] };
}): CreatePostInput {
  const tt = o.legs.some((l) => l.platform === "tiktok");
  const ig = o.legs.some((l) => l.platform === "instagram");
  if (tt && !o.tiktok) throw new Error("A TikTok leg needs the TikTok slides and caption.");
  if (ig && !o.instagram) throw new Error("An Instagram leg needs the Instagram slides and caption.");
  const direct = o.mode === "direct";
  if (direct && !o.scheduledAt) throw new Error("A direct post needs a time.");
  const platformConfig: PlatformConfig = {};
  if (tt) platformConfig.tiktok = direct ? { draft: false, privacy_status: "public", auto_add_music: true, allow_comment: true } : { draft: true };
  if (ig) platformConfig.instagram = { caption: o.instagram!.caption, media: o.instagram!.media };
  const main = tt ? o.tiktok! : o.instagram!;
  return {
    caption: main.caption,
    accounts: o.legs.map((l) => l.account),
    media: main.media,
    platformConfig,
    ...(direct ? { schedule: o.scheduledAt! } : {}),
  };
}

/** The status of one leg: its post result, by the account id. The same words as sendStatusOf. */
export function legStatusOf(post: PBPost, results: PBPostResult[], leg: Leg): { word: SendStatus["word"]; error: string | null; url: string | null } {
  const r = results.find((x) => x.social_account_id === leg.account);
  const tiktokDraft = leg.platform === "tiktok" && !!(post.platform_configurations as PlatformConfig | null)?.tiktok?.draft;
  if (r && !r.success && r.error) return { word: "error", error: errorText(r.error), url: null };
  if (r?.success) return { word: tiktokDraft ? "draft created" : "posted", error: null, url: r.platform_data?.url ?? null };
  if (post.status === "failed") return { word: "error", error: "Post Bridge marked the post failed.", url: null };
  return { word: !tiktokDraft && post.scheduled_at ? "scheduled" : "queued", error: null, url: null };
}

/**
 * The data of one `outcome.sync` log line, from one analytics row. Post Bridge
 * has no save count, so `saves` is absent (TikTok's come from Monid). A line of
 * another leg than TikTok names its `platform`, and its `saves` is null: no
 * source gives Instagram's (not Post Bridge, not Monid's public scrapers).
 */
export type OutcomeSync = {
  platform?: Platform;
  saves?: null;
  pbPost: string;
  analyticsId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  url: string;
  syncedAt: string;
};

export function outcomeOf(pbPost: string, a: PBAnalytics, platform: Platform = "tiktok"): OutcomeSync {
  return {
    ...(platform === "tiktok" ? {} : { platform, saves: null }),
    pbPost,
    analyticsId: a.id,
    views: a.view_count ?? 0,
    likes: a.like_count ?? 0,
    comments: a.comment_count ?? 0,
    shares: a.share_count ?? 0,
    url: a.share_url ?? "",
    syncedAt: a.last_synced_at ?? "",
  };
}

/** The status the post page prints for one sent post. */
export type SendStatus = {
  status: PBPostStatus;
  /** Plain words: "queued" (a draft not yet processed), "scheduled" (a direct post before its time), "draft created", "posted", or the platform's error. */
  word: "queued" | "scheduled" | "draft created" | "posted" | "error";
  error: string | null;
  url: string | null;
  results: PBPostResult[];
};

export function sendStatusOf(post: PBPost, results: PBPostResult[]): SendStatus {
  const failed = results.find((r) => !r.success && r.error);
  const ok = results.find((r) => r.success);
  const draft = !!(post.platform_configurations as PlatformConfig | null)?.tiktok?.draft;
  if (post.status === "failed" || failed) return { status: post.status, word: "error", error: errorText(failed?.error) ?? "Post Bridge marked the post failed.", url: null, results };
  if (post.status === "posted" || ok) return { status: post.status, word: draft ? "draft created" : "posted", error: null, url: ok?.platform_data?.url ?? null, results };
  return { status: post.status, word: !draft && post.scheduled_at ? "scheduled" : "queued", error: null, url: null, results };
}

/* ------------------------------------------------- shared with the scripts */

/** One connected account, as the map stores it. `provider` names the posting service. */
export type AccountEntry = PBAccount & { provider?: string };

/** The accounts of one identity, per platform. Null: declared, not connected yet. */
export type IdentityAccounts = { primary: Platform; platforms: Partial<Record<Platform, AccountEntry | null>> };

/**
 * production/posting-accounts.json: our handles → the posting service's accounts.
 * Committed; it holds ids and usernames, no secrets. Keyed by the handle the plan
 * uses. An entry is the per-platform shape (written since 0.4.0) or, in a file
 * written before, one account (read as that account's platform; see accountsOf).
 */
export type AccountsFile = {
  syncedAt: string;
  provider?: string;
  /** One entry per handle in the plan. Null: the handle is not connected yet. */
  accounts: Record<string, IdentityAccounts | AccountEntry | null>;
  /** Connected accounts that no identity declares, for the eye. */
  unmatched: PBAccount[];
};

const bare = (h: string) => h.replace(/^@/, "").toLowerCase();

/** The connected accounts of one handle, per platform, from either shape of the file. Empty: not connected. */
export function accountsOf(file: Pick<AccountsFile, "accounts"> | null | undefined, handle: string): Partial<Record<Platform, AccountEntry>> {
  const e = file?.accounts?.[handle] ?? file?.accounts?.[handle.replace(/^@/, "")] ?? file?.accounts?.[`@${bare(handle)}`] ?? null;
  if (!e) return {};
  if ("platforms" in e && e.platforms) {
    const out: Partial<Record<Platform, AccountEntry>> = {};
    for (const p of PLATFORMS) if (e.platforms[p]) out[p] = e.platforms[p]!;
    return out;
  }
  const p = platformOf((e as AccountEntry).platform) ?? "tiktok";
  return { [p]: e as AccountEntry };
}

/** An identity to map: its handle and the accounts its HANDLE.md declares. A bare handle declares one TikTok account of that name. */
export type MapIdentity = string | { handle: string; accounts: { platform: Platform; account: string; role?: string }[] };

/**
 * Pairs each identity's declared accounts with the accounts the posting service
 * lists: an account matches when it has the declared platform AND the declared
 * username. No name is guessed: an Instagram account with the TikTok name is
 * not matched unless the identity declares it, and a declared account with
 * another name is. Pure: the script, the Organic Factory UI and the tests share it.
 */
export function mapAccounts(identities: MapIdentity[], accounts: PBAccount[], now = new Date().toISOString()): AccountsFile {
  const map: AccountsFile["accounts"] = {};
  const used = new Set<number>();
  for (const i of identities) {
    const handle = typeof i === "string" ? i : i.handle;
    const declared = typeof i === "string" ? [{ platform: "tiktok" as Platform, account: i, role: "primary" }] : i.accounts;
    const platforms: IdentityAccounts["platforms"] = {};
    for (const d of declared) {
      const hit = accounts.find((a) => platformOf(a.platform) === d.platform && bare(a.username) === bare(d.account)) ?? null;
      platforms[d.platform] = hit;
      if (hit) used.add(hit.id);
    }
    const primary = declared.find((d) => d.role === "primary")?.platform ?? primaryOf(declared.map((d) => d.platform));
    map[handle] = { primary, platforms };
  }
  return { syncedAt: now, accounts: map, unmatched: accounts.filter((a) => !used.has(a.id)) };
}

export type SyncReport = { post: string; pbPost: string; /** The leg; absent for TikTok. */ platform?: Platform; written: boolean; outcome: OutcomeSync | null; note: string; /** The send's result in words: queued, draft created, error: … */ result: string };

/** One send to read: the Post Bridge post and its legs. No legs: one TikTok leg, as every send before Instagram. */
export type SentPost = { post: string; pbPost: string; legs?: Leg[] };

/**
 * The outcome sync, with the log abstracted: `sent` is every send with its Post
 * Bridge id and legs, `lastSync(post, platform)` the data of that leg's last
 * `outcome.sync` line, `append(post, data)` writes one. One line per leg whose
 * numbers changed. Asks Post Bridge for fresh numbers first, once per platform
 * that has a leg; the 30-minute cooldown is not an error. `onLeg` hears each
 * leg's status (the flow records a failed or a published Instagram leg).
 */
export async function syncOutcomesWith(
  pb: PostBridgeClient,
  sent: SentPost[],
  lastSync: (post: string, platform: Platform) => Record<string, unknown> | null,
  append: (post: string, data: OutcomeSync) => void,
  onLeg?: (post: string, pbPost: string, leg: Leg, status: ReturnType<typeof legStatusOf>, pbp: PBPost) => void,
): Promise<{ refreshed: boolean; reports: SyncReport[] }> {
  const legsOf = (x: SentPost): Leg[] => (x.legs?.length ? x.legs : [{ platform: "tiktok", account: 0 }]);
  /* Nothing sent: no call at all. Otherwise one refresh per platform, TikTok first. */
  const platforms = PLATFORMS.filter((p) => sent.some((x) => legsOf(x).some((l) => l.platform === p)));
  let refreshed = false;
  for (const p of platforms) if (await pb.syncAnalytics(p)) refreshed = true;
  const reports: SyncReport[] = [];
  for (const x of sent) {
    const { post, pbPost } = x;
    const [pbp, results] = await Promise.all([pb.getPost(pbPost), pb.listPostResults(pbPost)]);
    const st = sendStatusOf(pbp, results);
    const rows: PBAnalytics[] = [];
    for (const r of results) rows.push(...(await pb.analyticsForResult(r.id)));
    for (const leg of legsOf(x)) {
      const tag = leg.platform === "tiktok" ? {} : { platform: leg.platform };
      const ls = legStatusOf(pbp, results, leg);
      /* One leg's word; a send with one TikTok leg keeps the post's word, as before. */
      const result = x.legs?.length ? (ls.word === "error" ? `error: ${ls.error}` : ls.word) : st.word === "error" ? `error: ${st.error}` : st.word;
      if (x.legs?.length) onLeg?.(post, pbPost, leg, ls, pbp);
      const a = leg.platform === "tiktok" ? rows.find((r) => r.platform === "tiktok") ?? (x.legs?.length ? undefined : rows[0]) : rows.find((r) => platformOf(r.platform) === leg.platform);
      if (!a) { reports.push({ post, pbPost, ...tag, written: false, outcome: null, note: leg.platform === "tiktok" ? "no analytics yet (the draft is not live, or TikTok has not exposed it)" : `no analytics yet (${leg.platform} has not reported the post)`, result }); continue; }
      const o = outcomeOf(pbPost, a, leg.platform);
      const prev = lastSync(post, leg.platform);
      const same = !!prev && (["views", "likes", "comments", "shares"] as const).every((k) => Number(prev[k] ?? -1) === o[k]);
      if (same) { reports.push({ post, pbPost, ...tag, written: false, outcome: o, note: "unchanged", result }); continue; }
      append(post, o);
      reports.push({ post, pbPost, ...tag, written: true, outcome: o, note: "written", result });
    }
  }
  return { refreshed, reports };
}
