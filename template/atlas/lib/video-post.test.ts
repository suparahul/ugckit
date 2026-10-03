/**
 * Sending a video post through Post Bridge, against a mocked client: the
 * rules (lib/video-post.ts), the request shapes (lib/postbridge.ts legsPost)
 * and the whole send (lib/postbridge-flow.ts) in a temporary workspace. The
 * real fetch throws for the whole file: nothing here can reach the network.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

globalThis.fetch = (async () => { throw new Error("no network in this test"); }) as typeof fetch;

const WS = mkdtempSync(join(tmpdir(), "atlas-vpost-ws-"));
const CWD = mkdtempSync(join(tmpdir(), "atlas-vpost-cwd-"));
process.env.ATLAS_ROOT = WS;
process.env.POST_BRIDGE_API_KEY = "pb_test_not_a_key";
process.chdir(CWD);

const { VIDEO_LIMITS, checkVideoSend, videoCaption } = await import("./video-post.ts");
const { legsPost, postBody, postBridge } = await import("./postbridge.ts");
const { bridgeInfo, requestPreviews, selectSends, sendPosts } = await import("./postbridge-flow.ts");
const { allStates, readLog } = await import("./production.ts");
const { exportPost } = await import("./export-flow.ts");

const SLUG = "pawly";
const ID = "maya-2026-10-06-vettech";
const KEY = "2026-10-06/maya/1";
const VD = `pipeline/character/${ID}`;
const BYTES = Buffer.from("not really an mp4, but bytes with a checksum");
const SHA = createHash("sha256").update(BYTES).digest("hex");

const w = (p: string, body: unknown) => {
  const abs = join(WS, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const row = {
  slug: SLUG, key: KEY, n: 1, day: 1, date: "2026-10-06", short: "maya", handle: "@maya.petmom", role: "main", slot: "PM",
  topic: "the vet-tech tip nobody gives you", format: "video-plan", arm: "Pawly payoff",
  source: { raw: "", handle: null, id: null, views: null }, sourceRaw: "", sources: [],
  idea: { premise: null, product: null, feature: null, reasons: [], experiments: [], answer: null, record: null },
  kind: "video" as const, video: { type: "talking_head", hook: null, hookJob: null, length: "15" }, tags: ["#cattok", "#vettech"], videoId: ID,
  platforms: ["tiktok", "instagram"],
};
mkdirSync(join(CWD, "data"), { recursive: true });
writeFileSync(join(CWD, "data", `production-${SLUG}.json`), JSON.stringify({ generatedAt: "x", plan: { title: null, range: null, app: "Pawly", slug: SLUG, appStoreId: null, service: "postbridge", zones: { posting: null, home: null }, handles: {}, rules: [], tasks: {}, platforms: ["tiktok", "instagram"] }, rows: [row], decks: [], notes: [] }));

const PLAN = (caption: string | null, music: string | null = null) => ({
  schema_version: 2, revision: 1, video_id: ID, format: { length_s: 15 },
  script: [], beats: [], overlays: [],
  publishing_note: { caption, bio_ref: null, music_note: music },
});

/** A video approved for posting: the brief, the lock, the delivered file and final.approve on its sha256. */
function ready(o: { caption?: string | null; music?: string | null; approvedSha?: string } = {}) {
  rmSync(join(WS, "apps"), { recursive: true, force: true });
  rmSync(join(WS, "pipeline"), { recursive: true, force: true });
  w(`apps/${SLUG}/production/video-plans/${ID}/brief.json`, { video_id: ID, strategy_ref: { post: KEY } });
  w(`${VD}/plan.json`, PLAN(o.caption === undefined ? "what the vet tech said" : o.caption, o.music ?? null));
  w(`${VD}/planning-approval.json`, { video_id: ID, revision: 1, content_sha256: "a".repeat(64), words: "yes", date: "2026-10-04" });
  w(`${VD}/final/${ID}.mp4`, BYTES);
  w(`${VD}/final/delivery.json`, { video_id: ID, sha256: SHA, duration_s: 15, delivered: "2026-10-05T10:00:00Z" });
  w(`apps/${SLUG}/production/log.jsonl`, JSON.stringify({ at: "2026-10-05T11:00:00.000Z", post: KEY, kind: "final.approve", hash: o.approvedSha ?? SHA }) + "\n");
  w(`apps/${SLUG}/production/posting-accounts.json`, { syncedAt: "x", provider: "postbridge", unmatched: [], accounts: { "@maya.petmom": { primary: "tiktok", platforms: {
    tiktok: { id: 7, platform: "tiktok", username: "maya.petmom" }, instagram: { id: 8, platform: "instagram", username: "maya.petmom" } } } } });
}

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
/** A Post Bridge that records every call: the upload url, the PUT, the post. */
function mockPB() {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body instanceof Blob ? { blob: init.body.size, type: init.body.type } : null;
    calls.push({ url, method, headers: (init?.headers as Record<string, string>) ?? {}, body });
    const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
    if (url.endsWith("/v1/media/create-upload-url")) return json({ media_id: "mid_video", upload_url: "https://storage.example/signed/v", name: `${ID}.mp4` });
    if (url === "https://storage.example/signed/v") return new Response("", { status: 200 });
    if (url.endsWith("/v1/posts")) return json({ id: "post_v1", status: "processing", ...(body as object) });
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { pb: postBridge({ apiKey: "pb_test_not_a_key", fetch: f }), calls };
}

/* ------------------------------------------------------------------ the rules */

test("the caption: the plan's caption, then the row's tags unless it carries them; a placeholder is no caption", () => {
  assert.equal(videoCaption("what the vet tech said", ["#cattok", "#vettech"]), "what the vet tech said #cattok #vettech");
  assert.equal(videoCaption("what the vet tech said #vettech", ["#cattok", "#vettech"]), "what the vet tech said #vettech #cattok");
  assert.equal(videoCaption("<optional>", ["#a"]), null);
  assert.equal(videoCaption("  ", []), null);
  assert.equal(videoCaption(null, ["#a"]), null);
});

test("checkVideoSend: the file must be the delivered and the approved one; caption, length and size limits", () => {
  const ok = { id: ID, caption: "c", tags: [], music: null, sha256: SHA, delivered: SHA, approved: SHA, bytes: 1000, duration: 15, mode: "draft" as const, platforms: ["tiktok", "instagram"] as ("tiktok" | "instagram")[] };
  assert.equal(checkVideoSend(ok).skip, null);
  assert.match(checkVideoSend({ ...ok, sha256: null }).skip!, /is missing/);
  assert.match(checkVideoSend({ ...ok, sha256: "c".repeat(64) }).skip!, /not the delivered file/);
  assert.match(checkVideoSend({ ...ok, approved: "d".repeat(64) }).skip!, /not the one approved/);
  assert.match(checkVideoSend({ ...ok, caption: null }).skip!, /no publishing_note.caption/);
  assert.match(checkVideoSend({ ...ok, caption: "x".repeat(VIDEO_LIMITS.captionChars + 1) }).skip!, /2200/);
  assert.match(checkVideoSend({ ...ok, caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ") }).skip!, /31 hashtags; Instagram takes 30/);
  assert.equal(checkVideoSend({ ...ok, caption: Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" "), platforms: ["tiktok"] }).skip, null, "the hashtag limit is Instagram's");
  assert.match(checkVideoSend({ ...ok, duration: 2 }).skip!, /3 s at least/);
  assert.match(checkVideoSend({ ...ok, duration: 601 }).skip!, /600 s at most/);
  assert.match(checkVideoSend({ ...ok, bytes: 301 * 1024 * 1024 }).skip!, /Reels through the API/);
});

test("checkVideoSend: what each mode says first", () => {
  const base = { id: ID, caption: "c", music: "a soft piano", sha256: SHA, delivered: SHA, approved: SHA, bytes: 1, duration: 15, platforms: ["tiktok", "instagram"] as ("tiktok" | "instagram")[] };
  const draft = checkVideoSend({ ...base, mode: "draft" }).warnings.join("\n");
  assert.match(draft, /may not carry the caption/);
  assert.match(draft, /music note .* not applied on Instagram/);
  assert.match(draft, /a Reel/);
  assert.doesNotMatch(draft, /AI-generated/);
  const direct = checkVideoSend({ ...base, mode: "direct" }).warnings.join("\n");
  assert.match(direct, /its own sound only/);
  assert.match(direct, /AI-generated label is not set/);
  assert.doesNotMatch(direct, /may not carry the caption/);
});

test("legsPost for a video: one media id on both legs; direct sets no auto_add_music", () => {
  const legs = [{ platform: "tiktok" as const, account: 7 }, { platform: "instagram" as const, account: 8 }];
  const one = { caption: "c #a", media: ["mid"] };
  assert.deepEqual(postBody(legsPost({ legs, mode: "draft", kind: "video", tiktok: one, instagram: one })), {
    caption: "c #a", social_accounts: [7, 8], media: ["mid"],
    platform_configurations: { tiktok: { draft: true }, instagram: { caption: "c #a", media: ["mid"] } },
  });
  const direct = postBody(legsPost({ legs, mode: "direct", scheduledAt: "2026-10-06T23:00:00.000Z", kind: "video", tiktok: one, instagram: one }));
  assert.deepEqual((direct.platform_configurations as { tiktok: unknown }).tiktok, { draft: false, privacy_status: "public", allow_comment: true });
  assert.equal(direct.scheduled_at, "2026-10-06T23:00:00.000Z");
  assert.throws(() => legsPost({ legs, mode: "draft", kind: "video", tiktok: { caption: "c", media: ["a", "b"] }, instagram: one }), /exactly one video/);
  /* The slideshow's direct post keeps its sound setting. */
  assert.equal((postBody(legsPost({ legs: [legs[0]], mode: "direct", scheduledAt: "x", tiktok: one })).platform_configurations as { tiktok: { auto_add_music?: boolean } }).tiktok.auto_add_music, true);
});

/* ------------------------------------------------------------------ the flow */

test("selectSends: an approved, delivered video is sendable on both legs, with its caption and warnings", () => {
  ready();
  const [p] = selectSends(SLUG, { keys: [KEY] });
  assert.equal(p.skip, null);
  assert.deepEqual(p.legs.map((l) => [l.platform, l.account, l.skip]), [["tiktok", 7, null], ["instagram", 8, null]]);
  assert.equal(p.video?.sha256, SHA);
  assert.equal(p.video?.caption, "what the vet tech said #cattok #vettech");
  assert.match(p.warnings.join("\n"), /Instagram has no drafts/);
  assert.match(p.warnings.join("\n"), /a Reel/);
  const s = allStates(SLUG)[0];
  assert.equal(bridgeInfo(s).canSend, true);
});

test("selectSends: no caption, a file changed after delivery, or an approval of another file stops the send", () => {
  ready({ caption: "<optional>" });
  assert.match(selectSends(SLUG, { keys: [KEY] })[0].skip!, /no publishing_note.caption/);
  const s = allStates(SLUG)[0];
  assert.equal(bridgeInfo(s).canSend, false);
  assert.match(bridgeInfo(s).videoSkip!, /caption/);
  ready();
  w(`${VD}/final/${ID}.mp4`, Buffer.from("another file"));
  assert.match(selectSends(SLUG, { keys: [KEY] })[0].skip!, /not the delivered file/);
  ready({ approvedSha: "e".repeat(64) });
  assert.match(selectSends(SLUG, { keys: [KEY] })[0].skip!, /final is not approved \(stale\)/);
});

test("the request preview: the exact upload and post bodies, a placeholder media id, nothing sent, no key needed", () => {
  ready();
  const key = process.env.POST_BRIDGE_API_KEY;
  delete process.env.POST_BRIDGE_API_KEY;
  try {
    const [r] = requestPreviews(SLUG, { keys: [KEY] });
    assert.equal(r.error, null);
    assert.deepEqual(r.preview!.uploads, [{ mime_type: "video/mp4", size_bytes: BYTES.length, name: `${ID}.mp4` }]);
    assert.deepEqual(r.preview!.post, {
      caption: "what the vet tech said #cattok #vettech", social_accounts: [7, 8], media: ["<media id of the video>"],
      platform_configurations: { tiktok: { draft: true }, instagram: { caption: "what the vet tech said #cattok #vettech", media: ["<media id of the video>"] } },
    });
    const [d] = requestPreviews(SLUG, { keys: [KEY], mode: "direct", at: "2099-01-01T00:00:00.000Z", only: "tiktok" });
    assert.deepEqual(d.preview!.post, { caption: "what the vet tech said #cattok #vettech", social_accounts: [7], media: ["<media id of the video>"], platform_configurations: { tiktok: { draft: false, privacy_status: "public", allow_comment: true } }, scheduled_at: "2099-01-01T00:00:00.000Z" });
  } finally { process.env.POST_BRIDGE_API_KEY = key; }
  assert.equal(readLog(SLUG).filter((e) => e.kind === "posting.sent").length, 0);
});

test("the send, mocked: one upload of the approved bytes, one post for both legs, one posting.sent line", async () => {
  ready();
  const { pb, calls } = mockPB();
  const { results } = await sendPosts(SLUG, { keys: [KEY], pb });
  assert.deepEqual(results.map((r) => [r.ok, r.id, r.error]), [[true, "post_v1", undefined]]);
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url.replace("https://api.post-bridge.com", "")}`), ["POST /v1/media/create-upload-url", "PUT https://storage.example/signed/v", "POST /v1/posts"]);
  assert.deepEqual(calls[0].body, { mime_type: "video/mp4", size_bytes: BYTES.length, name: `${ID}.mp4` });
  assert.deepEqual(calls[1].body, { blob: BYTES.length, type: "video/mp4" });
  assert.deepEqual(calls[2].body, {
    caption: "what the vet tech said #cattok #vettech", social_accounts: [7, 8], media: ["mid_video"],
    platform_configurations: { tiktok: { draft: true }, instagram: { caption: "what the vet tech said #cattok #vettech", media: ["mid_video"] } },
  });
  const line = readLog(SLUG).find((e) => e.kind === "posting.sent")!;
  assert.equal(line.data!.video, ID);
  assert.equal(line.data!.sha256, SHA);
  assert.equal(line.data!.mode, "draft");
  assert.deepEqual((line.data!.legs as { platform: string }[]).map((l) => l.platform), ["tiktok", "instagram"]);
  /* Sent: the post is in the drafts, and a second send needs force. */
  const s = allStates(SLUG)[0];
  assert.equal(s.sent?.id, "post_v1");
  assert.match(selectSends(SLUG, { keys: [KEY] })[0].skip!, /sent already/);
});

test("the send, mocked, direct: scheduled_at and the TikTok video settings", async () => {
  ready();
  const { pb, calls } = mockPB();
  const at = new Date(Date.now() + 86_400_000).toISOString();
  const { results } = await sendPosts(SLUG, { keys: [KEY], mode: "direct", at, only: "tiktok", pb });
  assert.equal(results[0].ok, true);
  assert.deepEqual(calls[2].body, { caption: "what the vet tech said #cattok #vettech", social_accounts: [7], media: ["mid_video"], platform_configurations: { tiktok: { draft: false, privacy_status: "public", allow_comment: true } }, scheduled_at: at });
  const line = readLog(SLUG).find((e) => e.kind === "posting.sent")!;
  assert.equal(line.data!.scheduledAt, at);
  assert.equal(line.data!.legs, undefined, "TikTok alone: the line as a slideshow's");
});

test("a dry run sends nothing; the export still refuses a video", async () => {
  ready();
  const { pb, calls } = mockPB();
  const { plans, results } = await sendPosts(SLUG, { keys: [KEY], dryRun: true, pb });
  assert.equal(plans[0].skip, null);
  assert.deepEqual(results, []);
  assert.equal(calls.length, 0);
  await assert.rejects(exportPost(SLUG, KEY, { compose: false }), /has no export/);
  assert.ok(readFileSync(join(WS, VD, "final", `${ID}.mp4`)).equals(BYTES), "the delivered file is untouched");
});
