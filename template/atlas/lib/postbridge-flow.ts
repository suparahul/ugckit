/**
 * The Atlas's side of the Post Bridge scheduler: the account map, the send to
 * TikTok drafts, the status read-back and the outcome sync. Server-side only
 * (node:fs, node:child_process, the API key). The client itself is lib/postbridge.ts.
 *
 * Two modes, one rule before either: the final is approved.
 *   draft   (the default) TikTok puts the post in the account's inbox as a draft; the
 *           cover text is typed by hand in TikTok, like the sound. "Mark posted" (or the
 *           sync's link pull) is the moment the draft goes live from the phone.
 *   direct  a scheduled post at a set instant (UTC): Post Bridge publishes it, public,
 *           comments on, TikTok picks the sound. Nobody types anything, so the cover
 *           slide is rendered WITH its text (render-slides.mjs --burn-cover); the log's
 *           text flag for slide 1 is not changed.
 * What a send does, in order:
 *   1. re-runs the compositor for the post (scripts/render-slides.mjs <key> [--burn-cover]), so final/ matches the log;
 *   2. uploads final/slide-01..NN in order (each a media id);
 *   3. creates one post: the caption from final/caption.txt, the one mapped account,
 *      platform_configurations { tiktok: { draft: true } } or, direct, { draft: false, privacy_status: "public", … } + scheduled_at;
 *   4. appends `postbridge.sent` to production/log.jsonl: data { id, media, account, status, mode, scheduledAt }.
 * A video post (lib/video-post.ts) skips step 1: it uploads the one delivered file,
 * final/<video>.mp4, after checking that its sha256 is the approved one, and the
 * line carries `video` and `sha256`. `--request` (or REQUEST_ONLY=1) shows the
 * exact requests a send would make, with placeholder media ids, and sends nothing.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { identitiesOf } from "./accounts.ts";
import { MAX_SLIDES, PLATFORM_NAME, linePlatform, platformOf, primaryOf, type Platform } from "./platform.ts";
import { slotKey, slotTimes } from "./slots.ts";
import { accountsOf, hasKey, legsPost, postBody, postBridge, sendStatusOf, type CreatePostInput, type PostBridgeClient, type RequestPreview, type Leg, type SentPost, syncOutcomesWith, tiktokDirectPost, tiktokDraftPost, type AccountsFile, type PBAccount, type SendStatus, type SyncReport } from "./postbridge.ts";
import { allStates, appendEvent, filesRoot, fileKey, getProduction, isSent, legsOfSent, postingStep, readLog, storeOf, type Event, type PostState } from "./production.ts";
import { checkVideoSend } from "./video-post.ts";
import { finalFileOf } from "./video.ts";
import { findLinks, monidRuns, savedRunsFetch, type LinkReport } from "./tiktok-link.ts";
import { fmtBoth, postingZone, zonedToUtc } from "./when.ts";

const run = promisify(execFile);

/** apps/<slug>/production/posting-accounts.json: the handle → account map. The older name, postbridge-accounts.json, is read when it is the only one. */
export function accountsFile(slug: string): string {
  const now = join(storeOf(slug), "posting-accounts.json");
  const old = join(storeOf(slug), "postbridge-accounts.json");
  return !existsSync(now) && existsSync(old) ? old : now;
}

export type { AccountsFile };

export function readAccounts(slug: string): AccountsFile | null {
  const f = accountsFile(slug);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf8")) as AccountsFile; } catch { return null; }
}

/** The handles the plan names: `@maya.petmom`, … */
export function planHandles(slug: string): string[] {
  return Object.values(getProduction(slug).plan.handles).map((h) => h.handle);
}

export function writeAccounts(slug: string, file: AccountsFile): void {
  writeFileSync(join(storeOf(slug), "posting-accounts.json"), JSON.stringify(file, null, 2) + "\n");
}

/** The posting-service account of a handle on one platform (TikTok when not named), or null with the reason the UI prints. */
export function accountFor(slug: string, handle: string, platform: Platform = "tiktok"): { account: PBAccount | null; why: string | null } {
  const f = readAccounts(slug);
  if (!f) return { account: null, why: "no account map yet: run node scripts/postbridge-accounts.mjs" };
  const a = accountsOf(f, handle)[platform] ?? null;
  if (!a) return { account: null, why: `connect ${handle}${platform === "tiktok" ? "" : ` on ${PLATFORM_NAME[platform]}`} in Post Bridge, then run node scripts/postbridge-accounts.mjs` };
  if (a.needs_reconnect) return { account: a, why: `${handle} needs a reconnect in Post Bridge` };
  return { account: a, why: null };
}

/** What the post page needs to draw the panel: the button's availability and why not. */
export function bridgeInfo(state: PostState): { keySet: boolean; account: PBAccount | null; why: string | null; canSend: boolean; /** A video that cannot go as it is: the reason (no caption, not the approved file, a limit). */ videoSkip?: string | null } {
  const { account, why } = accountFor(state.row.slug, state.row.handle);
  const keySet = hasKey();
  const finalOk = state.final.status === "approved" && ["ready", "posted", "read"].includes(state.stage);
  const videoSkip = state.video && finalOk && state.video.final ? videoCheck(state, "draft", state.platforms).check.skip : null;
  return { keySet, account, why: !keySet ? "POST_BRIDGE_API_KEY is not set in .env" : why, canSend: keySet && !!account && !why && finalOk && !videoSkip, ...(state.video ? { videoSkip } : {}) };
}

/** The one note line under the band's sentence. Never the cover text itself; the account warning sits under the button instead. */
export function postingNotes(state: PostState): string[] {
  if (postingStep(state) !== "send") return [];
  return [state.video ? "A TikTok draft of a video may arrive without its caption: paste it from the caption block." : "Slide 1 text is typed in TikTok by hand; a direct post carries it burned in."];
}

/** The warning under the primary button when the send is not offered, or null. */
export function sendWarning(state: PostState, info: ReturnType<typeof bridgeInfo>): string | null {
  if (!info.keySet) return "POST_BRIDGE_API_KEY is missing in .env.";
  if (!info.account) return `Connect ${state.row.handle} in Post Bridge to enable sending.`;
  if (info.why) return `Reconnect ${state.row.handle} in Post Bridge to enable sending.`;
  if (info.videoSkip) return `Not sendable: ${info.videoSkip}.`;
  return null;
}

/* ---------------------------------------------------------------- send */

export type SendMode = "draft" | "direct";

/** One post as the selection sees it: sent when `skip` is null. */
export type SendPlan = {
  key: string;
  handle: string;
  account: number | null;
  slides: number;
  /** The caption's first line, for the eye. */
  caption: string;
  mode: SendMode;
  /** Direct mode: the instant, ISO UTC. */
  scheduledAt: string | null;
  /** The final gate as it stands: approved, stale, sentback, open. */
  finalStatus: string;
  /** Slide 1's text lines: typed by hand in draft mode, burned into the cover in direct mode. */
  coverText: string[];
  /** Why the post is not sent, or null. */
  skip: string | null;
  /** True when a `postbridge.sent` line exists (sent only with force). */
  sentBefore: boolean;
  /** Every platform the post goes to: the account, and why that leg is not sent (null: it is sent). */
  legs: { platform: Platform; account: number | null; skip: string | null }[];
  /** Said before the send, not a reason to stop: "Instagram publishes at once", … */
  warnings: string[];
  /** A video post: the one file sent, as checked now. */
  video?: { id: string; file: string; bytes: number | null; duration: number | null; sha256: string | null; caption: string | null };
};

/** The sha256 of a file, or null when it is missing. */
function sha256Of(file: string): string | null {
  if (!existsSync(file)) return null;
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** The approved hash of the final point: the last final.approve line's, when the point is approved. */
function approvedHash(s: PostState): string | null {
  if (s.final.status !== "approved") return null;
  const e = [...s.log].reverse().find((x) => x.kind === "final.approve");
  return typeof e?.hash === "string" ? e.hash : null;
}

/** A video post's file and its send check (lib/video-post.ts), for the legs it goes to. */
function videoCheck(s: PostState, mode: SendMode, platforms: Platform[]) {
  const v = s.video!;
  const file = v.id ? finalFileOf(v.id) : "";
  const sha256 = v.id ? sha256Of(file) : null;
  const check = checkVideoSend({
    id: v.id ?? "<video>", caption: v.plan?.caption, tags: s.row.tags ?? [], music: v.plan?.music,
    sha256, delivered: v.final?.sha256 ?? null, approved: approvedHash(s),
    bytes: sha256 ? statSync(file).size : null, duration: v.final?.duration ?? null, mode, platforms,
  });
  return { file, sha256, check, info: { id: v.id ?? "", file, bytes: sha256 ? statSync(file).size : null, duration: v.final?.duration ?? null, sha256, caption: check.caption } };
}

export type SendSelect = { date?: string; keys?: string[]; force?: boolean; mode?: SendMode; /** Direct mode: the instant, ISO UTC; required. */ at?: string; /** One platform only: a retry of one leg, or TikTok alone for a deck Instagram cannot take. */ only?: Platform; /** The request preview: nothing is sent, so the key is not needed. */ noKey?: boolean };

/** The slot instant of a plan row (ISO UTC), from the handle's `Slots:` line in the posting zone, or null for a slot word with no time. */
function slotInstant(slug: string, handle: string, date: string, slot: string): string | null {
  const line = identitiesOf(slug).find((i) => i.handle.toLowerCase() === handle.toLowerCase())?.slots ?? null;
  const t = slotTimes(line)[slotKey(slot)] ?? (/^\d{1,2}:\d{2}$/.test(slot) ? slot : null);
  return t ? zonedToUtc(date, t, postingZone()) : null;
}

/**
 * The selection rule, shared by the CLI and the button: the posts of the date
 * (or the keys named) whose final is approved, whose account is mapped, and
 * which have no `postbridge.sent` line yet; `force` allows a second send.
 */
export function selectSends(slug: string, sel: SendSelect): SendPlan[] {
  const mode: SendMode = sel.mode ?? "draft";
  const at = mode === "direct" ? sel.at ?? null : null;
  const timeBad = mode === "direct"
    ? !at ? "direct mode needs a time (--at or --at-local)"
      : new Date(at).getTime() <= Date.now() ? `the time ${fmtBoth(at)} is in the past`
      : null
    : null;
  const states = allStates(slug).filter((s) => (sel.keys ? sel.keys.includes(s.row.key) : s.row.date === sel.date));
  return states.map((s) => {
    const info = bridgeInfo(s);
    const finalOk = s.final.status === "approved" && ["ready", "posted", "read"].includes(s.stage);
    const slides = s.deck?.slides.length ?? 0;
    /* The legs: the post's platforms, less a leg taken off (leg.drop), or the one named with --only. */
    const wanted = sel.only ? [sel.only] : s.platforms.filter((p) => !s.legs[p]?.dropped);
    const legs = wanted.map((p) => {
      const { account, why } = accountFor(slug, s.row.handle, p);
      const leg = s.legs[p];
      const sent = !!leg?.sent && !leg.failed && !sel.force;
      const skip =
        !account ? why
        : why ? `${why}; then run node scripts/postbridge-accounts.mjs`
        : sent ? `sent already (${leg!.sent!.at.slice(0, 16).replace("T", " ")}, Post Bridge post ${leg!.sent!.id}${leg!.sent!.mode === "direct" ? ", direct" : ""}${p === "tiktok" ? "" : `, ${PLATFORM_NAME[p]}`}); --force to send again`
        : null;
      return { platform: p, account: account?.id ?? null, skip, sent };
    });
    /* The 10-slide rule: a deck over the limit of a platform stops the send; no slide is dropped. */
    const over = legs.map((l) => l.platform).filter((p) => MAX_SLIDES[p] !== null && slides > MAX_SLIDES[p]!);
    const tooLong = over.length ? `${slides} slides; ${over.map((p) => `${PLATFORM_NAME[p]} takes ${MAX_SLIDES[p]}`).join(", ")}: cut the deck to ${Math.min(...over.map((p) => MAX_SLIDES[p]!))} (the deck skill)${s.platforms.includes("tiktok") && !sel.only ? ", or send TikTok alone with --only tiktok" : ""}` : null;
    const primaryLeg = legs.find((l) => l.platform === primaryOf(wanted)) ?? legs[0];
    const open = legs.filter((l) => !l.skip);
    /* A video: the one delivered file, checked against the approval, and its caption. */
    const vc = s.video && s.video.final && finalOk ? videoCheck(s, mode, open.map((l) => l.platform)) : null;
    const skip =
      s.killed ? "killed"
      : !finalOk ? `the final is not approved (${s.final.status})`
      : s.video && !vc ? "the video is not delivered yet"
      : vc?.check.skip ? vc.check.skip
      : timeBad ? timeBad
      : !info.keySet && !sel.noKey ? info.why
      : !legs.length ? "no platform left: every leg was taken off"
      : tooLong ? tooLong
      /* Nothing left to send; or the primary leg cannot go (not connected, needs a reconnect): the post stops.
         A primary leg sent already lets the other legs go (the retry of a failed Instagram leg). */
      : !open.length ? primaryLeg.skip
      : primaryLeg.skip && !primaryLeg.sent ? primaryLeg.skip
      : null;
    const warnings: string[] = [];
    for (const l of legs) if (l.skip && !skip) warnings.push(`${PLATFORM_NAME[l.platform]} is left out: ${l.skip}`);
    if (!skip && vc) warnings.push(...vc.check.warnings);
    if (!skip && open.some((l) => l.platform === "instagram") && mode === "draft") {
      /* Instagram has no drafts: the leg publishes when the send runs. Q3: at the slot time, with TikTok's. */
      const slotAt = slotInstant(slug, s.row.handle, s.row.date, s.row.slot);
      const ahead = slotAt ? (new Date(slotAt).getTime() - Date.now()) / 60000 : null;
      warnings.push(ahead !== null && ahead > 15
        ? `Instagram has no drafts: it publishes the moment this is sent, ${Math.round(ahead)} minutes before the slot (${fmtBoth(slotAt!)}). Send at the slot time, or schedule a direct post.`
        : "Instagram has no drafts: the Instagram post publishes the moment this is sent.");
    }
    return {
      key: s.row.key, handle: s.row.handle, account: info.account?.id ?? null, slides, caption: (vc ? vc.check.caption ?? "" : s.deck?.caption ?? "").split("\n")[0],
      mode, scheduledAt: at, finalStatus: s.final.status, coverText: s.deck?.slides[0]?.blocks.map((b) => b.text) ?? [], skip, sentBefore: !!s.sent,
      legs: legs.map(({ platform, account, skip }) => ({ platform, account, skip })), warnings,
      ...(vc ? { video: vc.info } : {}),
    };
  });
}

export type SendReport = { id: string; media: string[]; account: number; status: string; warnings: string[] };
export type SendResult = { key: string; ok: boolean; id?: string; status?: string; error?: string; /** Post Bridge's own warnings on the created post. */ warnings?: string[] };

/**
 * Sends the selected posts, one after the other, and never throws for one
 * post: each result says ok or the error text. `dryRun` selects and sends nothing.
 */
export async function sendPosts(slug: string, sel: SendSelect & { dryRun?: boolean; /** Tests: the client to use instead of the real one. */ pb?: PostBridgeClient }): Promise<{ plans: SendPlan[]; results: SendResult[] }> {
  const plans = selectSends(slug, sel);
  const results: SendResult[] = [];
  if (sel.dryRun) return { plans, results };
  for (const p of plans) {
    if (p.skip) continue;
    try {
      const r = await sendPost(slug, p.key, { force: !!sel.force, mode: p.mode, at: p.scheduledAt ?? undefined, only: sel.only, pb: sel.pb });
      results.push({ key: p.key, ok: true, id: r.id, status: r.status, warnings: r.warnings.filter((w) => !p.warnings.includes(w)) });
    } catch (e) {
      results.push({ key: p.key, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { plans, results };
}

/**
 * One post, to the drafts or as a scheduled direct post, on every leg that is
 * open (selectSends decides which): one Post Bridge post for all the accounts.
 * The button and sendPosts both come here. A post with one TikTok leg writes
 * exactly the line it always wrote; with Instagram, the line carries `legs`.
 */
export async function sendPost(slug: string, key: string, opts: { compose?: boolean; force?: boolean; mode?: SendMode; at?: string; only?: Platform; pb?: PostBridgeClient } = {}): Promise<SendReport> {
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state) throw new Error(`No post ${key}.`);
  if (state.video) return sendVideo(slug, key, opts);
  if (!state.deck) throw new Error("No deck.");
  const plan = selectSends(slug, { keys: [key], force: opts.force, mode: opts.mode, at: opts.at, only: opts.only })[0];
  if (plan.skip) throw new Error(plan.skip);
  const legs = plan.legs.filter((l) => !l.skip && l.account !== null).map((l) => ({ platform: l.platform, account: l.account! }));
  const tt = legs.some((l) => l.platform === "tiktok");
  const ig = legs.some((l) => l.platform === "instagram");
  const direct = plan.mode === "direct";

  /* 1. The compositor, from the log as it is now; direct mode burns the cover text; an Instagram leg adds the 4:5 JPEG set. */
  if (opts.compose !== false) {
    const { stdout, stderr } = await run("node", ["scripts/render-slides.mjs", slug, key, ...(direct ? ["--burn-cover"] : []), ...(ig ? ["--instagram"] : [])], { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });
    if (/skipped/.test(stdout)) throw new Error(`The compositor skipped: ${stdout.trim().split("\n").find((l) => /skipped/.test(l))}`);
    if (stderr.trim()) console.warn(stderr.trim());
  }
  const dir = join(filesRoot(slug), fileKey(key), "final");
  const need = (f: string) => { if (!existsSync(f)) throw new Error(`${f.slice(dir.length + 1)} is missing in final/.`); return f; };
  const text = (f: string, what: string) => { const t = readFileSync(need(f), "utf8").trim(); if (!t && what) throw new Error(`The ${what} is empty.`); return t; };
  const nn = (n: number) => String(n).padStart(2, "0");
  const ttFiles = tt ? state.deck.slides.map((s) => need(join(dir, `slide-${nn(s.n)}.png`))) : [];
  /* One caption for both platforms, hashtags included. */
  const caption = text(join(dir, "caption.txt"), "caption");
  const igFiles = ig ? state.deck.slides.map((s) => need(join(dir, "instagram", `slide-${nn(s.n)}.jpg`))) : [];

  /* 2. and 3. */
  const pb = opts.pb ?? postBridge();
  const media: string[] = [];
  for (const f of ttFiles) media.push((await pb.uploadMedia({ path: f })).media_id);
  const igMedia: string[] = [];
  for (const f of igFiles) igMedia.push((await pb.uploadMedia({ path: f })).media_id);
  const post = await pb.createPost(legsPost({
    legs, mode: plan.mode, scheduledAt: plan.scheduledAt,
    ...(tt ? { tiktok: { caption, media } } : {}),
    ...(ig ? { instagram: { caption, media: igMedia } } : {}),
  }));

  /* 4. One line for the send. TikTok alone: the line as it always was. */
  const first = legs[0];
  const lineMedia = tt ? media : igMedia;
  appendEvent(slug, { post: key, kind: "posting.sent", actor: "agent", data: {
    provider: "postbridge", id: post.id, media: lineMedia.join(" "), account: first.account, status: post.status, mode: plan.mode, ...(direct ? { scheduledAt: plan.scheduledAt! } : {}),
    ...(legs.length === 1 && first.platform === "tiktok" ? {} : {
      ...(ig && tt ? { igMedia: igMedia.join(" ") } : {}),
      legs: legs.map((l) => ({ platform: l.platform, account: l.account, mode: plan.mode, scheduledAt: direct ? plan.scheduledAt : null, status: post.status })),
    }),
  } });
  return { id: post.id, media: lineMedia, account: first.account, status: post.status, warnings: [...plan.warnings, ...(post.warnings ?? [])] };
}

/**
 * A video post: no compositor. The one delivered file is hashed again just
 * before the upload (selectSends checked it against delivery.json and the
 * approval), uploaded once, and the same media id goes to every leg.
 * With `requestOnly`, nothing is uploaded or created and no line is written:
 * it returns the exact request bodies with placeholder media ids.
 */
const MEDIA_PLACEHOLDER = "<media id of the video>";

export function videoRequest(slug: string, key: string, opts: { force?: boolean; mode?: SendMode; at?: string; only?: Platform; noKey?: boolean } = {}): { plan: SendPlan; legs: Leg[]; input: (mediaId: string) => CreatePostInput; preview: RequestPreview } {
  const plan = selectSends(slug, { keys: [key], force: opts.force, mode: opts.mode, at: opts.at, only: opts.only, noKey: opts.noKey })[0];
  if (!plan) throw new Error(`No post ${key}.`);
  if (plan.skip) throw new Error(plan.skip);
  if (!plan.video?.sha256 || !plan.video.caption || plan.video.bytes === null) throw new Error("The video is not ready to send.");
  const legs = plan.legs.filter((l) => !l.skip && l.account !== null).map((l) => ({ platform: l.platform, account: l.account! }));
  const caption = plan.video.caption;
  const input = (mediaId: string) => {
    const one = { caption, media: [mediaId] };
    return legsPost({
      legs, mode: plan.mode, scheduledAt: plan.scheduledAt, kind: "video",
      ...(legs.some((l) => l.platform === "tiktok") ? { tiktok: one } : {}),
      ...(legs.some((l) => l.platform === "instagram") ? { instagram: one } : {}),
    });
  };
  return { plan, legs, input, preview: { uploads: [{ mime_type: "video/mp4", size_bytes: plan.video.bytes, name: `${plan.video.id}.mp4` }], post: postBody(input(MEDIA_PLACEHOLDER)) } };
}

/** The exact requests a send of these posts would make (videos only), with placeholder media ids. Nothing leaves. */
export function requestPreviews(slug: string, sel: SendSelect): { key: string; preview: RequestPreview | null; error: string | null }[] {
  return selectSends(slug, { ...sel, noKey: true }).map((p) => {
    if (!p.video) return { key: p.key, preview: null, error: "the request preview is built for video posts; a slideshow's dry run lists its slides" };
    try { return { key: p.key, preview: videoRequest(slug, p.key, { ...sel, noKey: true }).preview, error: null }; } catch (e) { return { key: p.key, preview: null, error: e instanceof Error ? e.message : String(e) }; }
  });
}

async function sendVideo(slug: string, key: string, opts: { force?: boolean; mode?: SendMode; at?: string; only?: Platform; pb?: PostBridgeClient }): Promise<SendReport> {
  const { plan, legs, input } = videoRequest(slug, key, opts);
  const v = plan.video!;
  /* The bytes uploaded are the bytes approved: hashed once more, now. */
  const bytes = new Uint8Array(readFileSync(v.file));
  const now = createHash("sha256").update(bytes).digest("hex");
  if (now !== v.sha256) throw new Error(`final/${v.id}.mp4 changed during the send (sha256 ${now.slice(0, 12)}, checked ${v.sha256!.slice(0, 12)}): nothing was sent.`);
  const pb = opts.pb ?? postBridge();
  const { media_id } = await pb.uploadMedia({ name: `${v.id}.mp4`, bytes, mime: "video/mp4" });
  const post = await pb.createPost(input(media_id));
  const first = legs[0];
  const direct = plan.mode === "direct";
  appendEvent(slug, { post: key, kind: "posting.sent", actor: "agent", data: {
    provider: "postbridge", id: post.id, media: media_id, account: first.account, status: post.status, mode: plan.mode, ...(direct ? { scheduledAt: plan.scheduledAt! } : {}),
    video: v.id, sha256: v.sha256!,
    ...(legs.length === 1 && first.platform === "tiktok" ? {} : {
      legs: legs.map((l) => ({ platform: l.platform, account: l.account, mode: plan.mode, scheduledAt: direct ? plan.scheduledAt : null, status: post.status })),
    }),
  } });
  return { id: post.id, media: [media_id], account: first.account, status: post.status, warnings: [...plan.warnings, ...(post.warnings ?? [])] };
}

/** The old name of sendPost, draft mode. */
export const sendToDrafts = (slug: string, key: string, opts: { compose?: boolean; force?: boolean } = {}) => sendPost(slug, key, { ...opts, mode: "draft" });

/* ---------------------------------------------------------- reschedule */

/**
 * Moves a scheduled direct post to a new instant (PATCH scheduled_at), reads
 * the post back, and appends `postbridge.rescheduled` { id, scheduledAt, from, status }.
 * Throws when Post Bridge refuses or the read-back does not show the new time.
 */
export async function reschedule(slug: string, key: string, atUtc: string, note?: string): Promise<{ id: string; scheduledAt: string; status: string; from: string | null }> {
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state?.sent) throw new Error(`${key}: not sent through Post Bridge.`);
  if (state.sent.mode !== "direct") throw new Error(`${key}: the send is a draft, not a scheduled post.`);
  const pb = postBridge();
  await pb.updatePost(state.sent.id, { scheduled_at: atUtc });
  const back = await pb.getPost(state.sent.id);
  const got = back.scheduled_at ? new Date(back.scheduled_at).toISOString() : null;
  if (got !== atUtc) throw new Error(`${key}: Post Bridge shows scheduled_at ${back.scheduled_at ?? "null"} (status ${back.status}), not ${atUtc}.`);
  appendEvent(slug, { post: key, kind: "posting.rescheduled", actor: "agent", ...(note ? { note } : {}), data: { provider: "postbridge", id: state.sent.id, scheduledAt: atUtc, from: state.sent.scheduledAt ?? "", status: back.status } });
  wordCache.delete(state.sent.id);
  return { id: state.sent.id, scheduledAt: atUtc, status: back.status, from: state.sent.scheduledAt };
}

/* -------------------------------------------------------------- status */

export async function sendStatus(pbPostId: string): Promise<SendStatus> {
  const pb = postBridge();
  const [post, results] = await Promise.all([pb.getPost(pbPostId), pb.listPostResults(pbPostId)]);
  return sendStatusOf(post, results);
}

/** The status word per Post Bridge post id, held for a minute so a board render costs at most one call per sent post. */
const wordCache = new Map<string, { at: number; word: string }>();
const WORD_TTL = 60_000;

/** "draft created", "queued", "scheduled", "posted", or "error: …", or null when Post Bridge cannot be asked. */
export async function statusWord(pbPostId: string): Promise<string | null> {
  const hit = wordCache.get(pbPostId);
  if (hit && Date.now() - hit.at < WORD_TTL) return hit.word;
  if (!hasKey()) return null;
  try {
    const s = await sendStatus(pbPostId);
    const word = s.word === "error" ? `error: ${s.error}` : s.word;
    wordCache.set(pbPostId, { at: Date.now(), word });
    return word;
  } catch (e) {
    const word = `error: ${e instanceof Error ? e.message : String(e)}`;
    wordCache.set(pbPostId, { at: Date.now(), word });
    return word;
  }
}

/**
 * Adds the live Post Bridge word to the sentence of every sent post in place
 * ("in TikTok drafts · @maya.petmom 17:25 · draft created"; a direct post
 * only once its time has come: "scheduled Wed 19:00 ET (Thu 04:30 IST) · direct · posted").
 * The board and the post head call it once per render.
 */
export async function withStatusWords<T extends PostState>(states: T[]): Promise<T[]> {
  const due = (s: PostState) => !s.sent!.scheduledAt || new Date(s.sent!.scheduledAt).getTime() <= Date.now();
  await Promise.all(states.filter((s) => s.stage === "ready" && s.sent && due(s)).map(async (s) => {
    const w = await statusWord(s.sent!.id);
    if (w) s.sentence = `${s.sentence} · ${w}`;
  }));
  return states;
}

/* ---------------------------------------------------------------- sync */

/**
 * The Post Bridge posts the analytics pass reads, from the log: per post and
 * platform, the last send that carried that leg, grouped by Post Bridge post.
 * Pure. A send with no `legs` is one leg on `data.platform` (TikTok when
 * absent). A leg that is not TikTok is always passed as a leg, so its numbers
 * are written with its platform: an Instagram reel sent on its own line
 * (`data.platform: "instagram"`, no `legs`) must never read as the TikTok leg.
 * A TikTok-only send stays legless, as before (the post's own status word).
 */
export function sentPostsOf(log: Event[], wanted: string[] | null = null): Map<string, SentPost & { at: string }> {
  const lastSend = new Map<string, { at: string; pbPost: string; leg: Leg; legs: boolean }>();
  for (const e of log) {
    if (!isSent(e.kind) || !e.post || !e.data?.id || (wanted && !wanted.includes(e.post))) continue;
    const many = Array.isArray(e.data.legs);
    for (const l of legsOfSent(e)) {
      const p = platformOf(l.platform);
      if (p) lastSend.set(`${e.post}\u0000${p}`, { at: e.at, pbPost: String(e.data.id), leg: { platform: p, account: Number(l.account ?? 0) }, legs: many || p !== "tiktok" });
    }
  }
  const sends = new Map<string, SentPost & { at: string }>();
  for (const [k, v] of lastSend) {
    const post = k.split("\u0000")[0];
    const id = `${post}\u0000${v.pbPost}`;
    const x = sends.get(id) ?? { post, pbPost: v.pbPost, at: v.at, ...(v.legs ? { legs: [] } : {}) };
    if (v.legs) x.legs!.push(v.leg);
    sends.set(id, x);
  }
  return sends;
}

/**
 * The Post Bridge half of the sync: reads the analytics of every sent post (or
 * the ones named) and appends one `outcome.sync` line per post whose numbers
 * changed since the last Post Bridge line (the Monid lines are a separate
 * series). The core is syncOutcomesWith. Post Bridge rarely has numbers for a
 * draft published from the phone; Monid (syncAll) is the first source.
 */
export async function syncOutcomes(slug: string, sel: { date?: string; keys?: string[] } = {}): Promise<{ refreshed: boolean; reports: SyncReport[] }> {
  const log = readLog(slug);
  const wanted = sel.keys ?? (sel.date ? getProduction(slug).rows.filter((r) => r.date === sel.date).map((r) => r.key) : null);
  const sends = sentPostsOf(log, wanted);
  const lineOf = (post: string, kind: Event["kind"], p: Platform, after = "") => log.some((e) => e.post === post && e.kind === kind && (linePlatform(e.data) ?? "tiktok") === p && e.at >= after);
  return syncOutcomesWith(
    postBridge(),
    [...sends.values()],
    (post, p) => ([...log].reverse().find((e) => e.post === post && e.kind === "outcome.sync" && e.data?.source !== "monid" && (linePlatform(e.data) ?? "tiktok") === p)?.data as Record<string, unknown> | undefined) ?? null,
    (post, o) => { appendEvent(slug, { post, kind: "outcome.sync", actor: "agent", data: { source: "postbridge", ...o } }); },
    /* A leg of a two-platform send: its failure once (the platform's words), and an Instagram leg's post and link once it is published. */
    (post, pbPost, leg, st, pbp) => {
      const since = sends.get(`${post}\u0000${pbPost}`)?.at ?? "";
      const tag = { platform: leg.platform, account: leg.account };
      if (st.word === "error" && !lineOf(post, "posting.failed", leg.platform, since)) appendEvent(slug, { post, kind: "posting.failed", actor: "sync", data: { ...tag, error: st.error ?? "failed", pbPost } });
      if (leg.platform !== "tiktok" && st.word === "posted") {
        const at = pbp.scheduled_at ? new Date(pbp.scheduled_at).toISOString() : pbp.updated_at ?? new Date().toISOString();
        if (!lineOf(post, "posted", leg.platform, since)) appendEvent(slug, { post, kind: "posted", actor: "sync", data: { platform: leg.platform, time: at.slice(11, 16), url: st.url ?? "" } });
        if (st.url && !lineOf(post, "posted.link", leg.platform, since)) appendEvent(slug, { post, kind: "posted.link", actor: "sync", data: { platform: leg.platform, url: st.url, uploadedAt: at } });
      }
    },
  );
}

export type SyncAll = { links: LinkReport[]; refreshed: boolean; reports: SyncReport[]; postBridgeError: string | null };

/**
 * The whole sync, the same for the button and scripts/postbridge-sync.mjs:
 * first "find the link" (lib/tiktok-link.ts findLinks), then the Post Bridge
 * analytics as the second source when it has data. A Post Bridge failure (no
 * key, an API error) does not undo the link half.
 * The link comes from Post Bridge for every post Post Bridge published live
 * (a `direct` send) and from Monid only for a post it did not (a draft
 * published by hand from the phone) — AGENTS.md rule 15.
 * `noMonid` makes no Monid call at all: the Post Bridge links are still
 * written; a post only Monid can link is reported as skipped.
 * `refreshStats` (passed straight to `findLinks`) fetches every handle in
 * scope from Monid on purpose, even one with nothing unlinked, so an older
 * post's numbers (saves included) get refreshed too — see
 * `monidFetchPlan` for the cost estimate before spending it.
 * `monidRuns` reads the Monid posts from those saved runs instead of a new
 * paid fetch (`savedRunsFetch`); a handle with no saved run is reported as an
 * error, never fetched.
 */
export async function syncAll(slug: string, sel: { date?: string; keys?: string[] } = {}, opts: { noMonid?: boolean; refreshStats?: boolean; monidRuns?: string[] } = {}): Promise<SyncAll> {
  const fetch = opts.monidRuns?.length && !opts.noMonid ? savedRunsFetch(await monidRuns(opts.monidRuns)) : undefined;
  const links = await findLinks(slug, sel, fetch, { refreshStats: opts.refreshStats && !opts.noMonid, noMonid: opts.noMonid });
  if (!hasKey()) return { links, refreshed: false, reports: [], postBridgeError: "POST_BRIDGE_API_KEY is not set" };
  try {
    const { refreshed, reports } = await syncOutcomes(slug, sel);
    return { links, refreshed, reports, postBridgeError: null };
  } catch (e) {
    return { links, refreshed: false, reports: [], postBridgeError: e instanceof Error ? e.message : String(e) };
  }
}
