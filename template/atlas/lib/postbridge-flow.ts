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
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { hasKey, postBridge, sendStatusOf, syncOutcomesWith, tiktokDirectPost, tiktokDraftPost, type AccountsFile, type PBAccount, type SendStatus, type SyncReport } from "./postbridge.ts";
import { allStates, appendEvent, filesRoot, fileKey, getProduction, isSent, postingStep, readLog, storeOf, type PostState } from "./production.ts";
import { findLinks, type LinkReport } from "./tiktok-link.ts";
import { fmtBoth } from "./when.ts";

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

/** The handles the plan names: `@hannah.catmom`, … */
export function planHandles(slug: string): string[] {
  return Object.values(getProduction(slug).plan.handles).map((h) => h.handle);
}

export function writeAccounts(slug: string, file: AccountsFile): void {
  writeFileSync(join(storeOf(slug), "posting-accounts.json"), JSON.stringify(file, null, 2) + "\n");
}

/** The posting-service account for a handle, or null with the reason the UI prints. */
export function accountFor(slug: string, handle: string): { account: PBAccount | null; why: string | null } {
  const f = readAccounts(slug);
  if (!f) return { account: null, why: "no account map yet: run node scripts/postbridge-accounts.mjs" };
  const a = f.accounts[handle];
  if (!a) return { account: null, why: `connect ${handle} in Post Bridge, then run node scripts/postbridge-accounts.mjs` };
  if (a.needs_reconnect) return { account: a, why: `${handle} needs a reconnect in Post Bridge` };
  return { account: a, why: null };
}

/** What the post page needs to draw the panel: the button's availability and why not. */
export function bridgeInfo(state: PostState): { keySet: boolean; account: PBAccount | null; why: string | null; canSend: boolean } {
  const { account, why } = accountFor(state.row.slug, state.row.handle);
  const keySet = hasKey();
  const finalOk = state.final.status === "approved" && ["ready", "posted", "read"].includes(state.stage);
  return { keySet, account, why: !keySet ? "POST_BRIDGE_API_KEY is not set in .env" : why, canSend: keySet && !!account && !why && finalOk };
}

/** The one note line under the band's sentence. Never the cover text itself; the account warning sits under the button instead. */
export function postingNotes(state: PostState): string[] {
  return postingStep(state) === "send" ? ["Slide 1 text is typed in TikTok by hand; a direct post carries it burned in."] : [];
}

/** The warning under the primary button when the send is not offered, or null. */
export function sendWarning(state: PostState, info: ReturnType<typeof bridgeInfo>): string | null {
  if (!info.keySet) return "POST_BRIDGE_API_KEY is missing in .env.";
  if (!info.account) return `Connect ${state.row.handle} in Post Bridge to enable sending.`;
  if (info.why) return `Reconnect ${state.row.handle} in Post Bridge to enable sending.`;
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
};

export type SendSelect = { date?: string; keys?: string[]; force?: boolean; mode?: SendMode; /** Direct mode: the instant, ISO UTC; required. */ at?: string};

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
    const skip =
      s.killed ? "killed"
      : !finalOk ? `the final is not approved (${s.final.status})`
      : timeBad ? timeBad
      : !info.keySet ? info.why
      : !info.account || info.why ? info.why
      : s.sent && !sel.force ? `sent already (${s.sent.at.slice(0, 16).replace("T", " ")}, Post Bridge post ${s.sent.id}${s.sent.mode === "direct" ? ", direct" : ""}); --force to send again`
      : null;
    return {
      key: s.row.key, handle: s.row.handle, account: info.account?.id ?? null, slides: s.deck?.slides.length ?? 0, caption: (s.deck?.caption ?? "").split("\n")[0],
      mode, scheduledAt: at, finalStatus: s.final.status, coverText: s.deck?.slides[0]?.blocks.map((b) => b.text) ?? [], skip, sentBefore: !!s.sent,
    };
  });
}

export type SendReport = { id: string; media: string[]; account: number; status: string; warnings: string[] };
export type SendResult = { key: string; ok: boolean; id?: string; status?: string; error?: string };

/**
 * Sends the selected posts, one after the other, and never throws for one
 * post: each result says ok or the error text. `dryRun` selects and sends nothing.
 */
export async function sendPosts(slug: string, sel: SendSelect & { dryRun?: boolean }): Promise<{ plans: SendPlan[]; results: SendResult[] }> {
  const plans = selectSends(slug, sel);
  const results: SendResult[] = [];
  if (sel.dryRun) return { plans, results };
  for (const p of plans) {
    if (p.skip) continue;
    try {
      const r = await sendPost(slug, p.key, { force: !!sel.force, mode: p.mode, at: p.scheduledAt ?? undefined });
      results.push({ key: p.key, ok: true, id: r.id, status: r.status });
    } catch (e) {
      results.push({ key: p.key, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { plans, results };
}

/** One post, to the drafts or as a scheduled direct post. The button and sendPosts both come here; the selection rule is selectSends. */
export async function sendPost(slug: string, key: string, opts: { compose?: boolean; force?: boolean; mode?: SendMode; at?: string } = {}): Promise<SendReport> {
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state) throw new Error(`No post ${key}.`);
  if (!state.deck) throw new Error("No deck.");
  const plan = selectSends(slug, { keys: [key], force: opts.force, mode: opts.mode, at: opts.at })[0];
  if (plan.skip) throw new Error(plan.skip);
  const account = plan.account!;
  const direct = plan.mode === "direct";

  /* 1. The compositor, from the log as it is now; direct mode burns the cover text. */
  if (opts.compose !== false) {
    const { stdout, stderr } = await run("node", ["scripts/render-slides.mjs", slug, key, ...(direct ? ["--burn-cover"] : [])], { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });
    if (/skipped/.test(stdout)) throw new Error(`The compositor skipped: ${stdout.trim().split("\n").find((l) => /skipped/.test(l))}`);
    if (stderr.trim()) console.warn(stderr.trim());
  }
  const dir = join(filesRoot(slug), fileKey(key), "final");
  const files = state.deck.slides.map((s) => join(dir, `slide-${String(s.n).padStart(2, "0")}.png`));
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`final/ is missing ${missing.map((f) => f.split("/").pop()).join(", ")}.`);
  const captionFile = join(dir, "caption.txt");
  if (!existsSync(captionFile)) throw new Error("final/caption.txt is missing.");
  const caption = readFileSync(captionFile, "utf8").trim();
  if (!caption) throw new Error("The caption is empty.");

  /* 2. and 3. */
  const pb = postBridge();
  const media: string[] = [];
  for (const f of files) media.push((await pb.uploadMedia({ path: f })).media_id);
  const post = await pb.createPost(direct ? tiktokDirectPost(caption, account, media, plan.scheduledAt!) : tiktokDraftPost(caption, account, media));

  /* 4. */
  appendEvent(slug, { post: key, kind: "posting.sent", actor: "agent", data: { provider: "postbridge", id: post.id, media: media.join(" "), account, status: post.status, mode: plan.mode, ...(direct ? { scheduledAt: plan.scheduledAt! } : {}) } });
  return { id: post.id, media, account, status: post.status, warnings: post.warnings ?? [] };
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
 * ("in TikTok drafts · @hannah.catmom 17:25 · draft created"; a direct post
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
 * The Post Bridge half of the sync: reads the analytics of every sent post (or
 * the ones named) and appends one `outcome.sync` line per post whose numbers
 * changed since the last Post Bridge line (the Monid lines are a separate
 * series). The core is syncOutcomesWith. Post Bridge rarely has numbers for a
 * draft published from the phone; Monid (syncAll) is the first source.
 */
export async function syncOutcomes(slug: string, sel: { date?: string; keys?: string[] } = {}): Promise<{ refreshed: boolean; reports: SyncReport[] }> {
  const log = readLog(slug);
  const wanted = sel.keys ?? (sel.date ? getProduction(slug).rows.filter((r) => r.date === sel.date).map((r) => r.key) : null);
  const byPost = new Map<string, string>();
  for (const e of log) if (isSent(e.kind) && e.post && e.data?.id && (!wanted || wanted.includes(e.post))) byPost.set(e.post, String(e.data.id));
  return syncOutcomesWith(
    postBridge(),
    [...byPost].map(([post, pbPost]) => ({ post, pbPost })),
    (post) => [...log].reverse().find((e) => e.post === post && e.kind === "outcome.sync" && e.data?.source !== "monid")?.data ?? null,
    (post, o) => { appendEvent(slug, { post, kind: "outcome.sync", actor: "agent", data: { source: "postbridge", ...o } }); },
  );
}

export type SyncAll = { links: LinkReport[]; refreshed: boolean; reports: SyncReport[]; postBridgeError: string | null };

/**
 * The whole sync, the same for the button and scripts/postbridge-sync.mjs:
 * first "find the link" and the numbers through Monid (lib/tiktok-link.ts),
 * then the Post Bridge analytics as the second source when it has data.
 * A Post Bridge failure (no key, an API error) does not undo the Monid half.
 * `noMonid` skips the Monid half entirely (no calls, no cost) — for a run
 * where every sent post's link is already known, from the log or from
 * Post Bridge's own analytics (`pbLinkOf` in findLinks handles that case even
 * without this flag; `noMonid` is for skipping the Monid call outright, e.g.
 * when nothing new needs a link and only fresh numbers are wanted).
 */
export async function syncAll(slug: string, sel: { date?: string; keys?: string[] } = {}, opts: { noMonid?: boolean } = {}): Promise<SyncAll> {
  const links = opts.noMonid ? [] : await findLinks(slug, sel);
  if (!hasKey()) return { links, refreshed: false, reports: [], postBridgeError: "POST_BRIDGE_API_KEY is not set" };
  try {
    const { refreshed, reports } = await syncOutcomes(slug, sel);
    return { links, refreshed, reports, postBridgeError: null };
  } catch (e) {
    return { links, refreshed: false, reports: [], postBridgeError: e instanceof Error ? e.message : String(e) };
  }
}
