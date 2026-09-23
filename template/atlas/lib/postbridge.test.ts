/**
 * The request shapes of lib/postbridge.ts against a mocked fetch: no key, no
 * network, no real post. Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { accountsOf, legStatusOf, legsPost, mapAccounts, outcomeOf, postBridge, PostBridgeError, readKey, sendStatusOf, syncOutcomesWith, tiktokDirectPost, tiktokDraftPost, type PBAnalytics, type PBPost, type PBPostResult } from "./postbridge.ts";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

/** A fetch that records every call and answers from a table keyed by "METHOD path". */
function mockFetch(answers: Record<string, unknown | ((call: Call) => unknown)>) {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}));
    let body: unknown = null;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    else if (init?.body instanceof Blob) body = { blob: init.body.size, type: init.body.type };
    const call = { url, method, headers, body };
    calls.push(call);
    const path = url.replace("https://api.post-bridge.com", "");
    const key = Object.keys(answers).find((k) => k === `${method} ${path}` || k === `${method} ${path.split("?")[0]}` || (k.startsWith(method + " ") && url.startsWith(k.slice(method.length + 1))));
    if (!key) return new Response(JSON.stringify({ message: `no mock for ${method} ${path}` }), { status: 404 });
    const a = answers[key];
    const out = typeof a === "function" ? (a as (c: Call) => unknown)(call) : a;
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetch: f, calls };
}

const KEY = "pb_live_test";

test("readKey: the environment first, else the last non-empty line of .env.local", () => {
  const dir = mkdtempSync(join(tmpdir(), "pb-"));
  const f = join(dir, ".env.local");
  writeFileSync(f, "# secrets\nPOST_BRIDGE_API_KEY=\nOTHER=1\nPOST_BRIDGE_API_KEY=pb_live_second\nPOST_BRIDGE_API_KEY=\"pb_live_third\"\n");
  assert.equal(readKey({}, f), "pb_live_third");
  assert.equal(readKey({ POST_BRIDGE_API_KEY: "pb_live_env" }, f), "pb_live_env");
  assert.equal(readKey({ POST_BRIDGE_API_KEY: "  " }, f), "pb_live_third");
  assert.equal(readKey({}, join(dir, "missing")), null);
});

test("the client refuses to start without a key", () => {
  assert.throws(() => postBridge({ apiKey: "", fetch: fetch }), /POST_BRIDGE_API_KEY is not set/);
});

test("listAccounts: GET /v1/social-accounts with the bearer key", async () => {
  const m = mockFetch({ "GET /v1/social-accounts": { data: [{ id: 7, platform: "tiktok", username: "example.one", needs_reconnect: false }], meta: { total: 1 } } });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const accounts = await pb.listAccounts();
  assert.deepEqual(accounts.map((a) => a.id), [7]);
  assert.equal(m.calls[0].url, "https://api.post-bridge.com/v1/social-accounts?limit=100");
  assert.equal(m.calls[0].headers.Authorization, `Bearer ${KEY}`);
  assert.equal(m.calls[0].headers["X-PB-Client"], "atlas");
});

test("uploadMedia: create-upload-url with mime, size and name, then PUT the bytes to the signed URL", async () => {
  const m = mockFetch({
    "POST /v1/media/create-upload-url": { media_id: "mid_1", upload_url: "https://storage.example/signed/1", name: "slide-01.png" },
    "PUT https://storage.example/signed/1": new Response("", { status: 200 }),
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const r = await pb.uploadMedia({ name: "slide-01.png", bytes, mime: "image/png" });
  assert.equal(r.media_id, "mid_1");
  assert.deepEqual(m.calls[0].body, { mime_type: "image/png", size_bytes: 8, name: "slide-01.png" });
  assert.equal(m.calls[1].method, "PUT");
  assert.equal(m.calls[1].url, "https://storage.example/signed/1");
  assert.equal(m.calls[1].headers["Content-Type"], "image/png");
  assert.deepEqual(m.calls[1].body, { blob: 8, type: "image/png" });
  assert.equal(m.calls[1].headers.Authorization, undefined, "the signed URL gets no bearer key");
});

test("uploadMedia: a failed PUT is an error with the status", async () => {
  const m = mockFetch({
    "POST /v1/media/create-upload-url": { media_id: "mid_1", upload_url: "https://storage.example/signed/1", name: "x.png" },
    "PUT https://storage.example/signed/1": new Response("denied", { status: 403 }),
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  await assert.rejects(pb.uploadMedia({ name: "x.png", bytes: new Uint8Array(1), mime: "image/png" }), (e: unknown) => e instanceof PostBridgeError && e.status === 403);
});

test("createPost: the TikTok photo post in draft mode, slides in order, no is_draft, no schedule", async () => {
  const m = mockFetch({ "POST /v1/posts": (c: Call) => ({ id: "post_9", status: "processing", is_draft: false, ...(c.body as object) }) });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const input = tiktokDraftPost("Seven signs your cat is bored #cattips", 7, ["mid_1", "mid_2", "mid_3"]);
  const post = await pb.createPost(input);
  assert.equal(post.id, "post_9");
  assert.deepEqual(m.calls[0].body, {
    caption: "Seven signs your cat is bored #cattips",
    social_accounts: [7],
    media: ["mid_1", "mid_2", "mid_3"],
    platform_configurations: { tiktok: { draft: true } },
  });
});

test("createPost: a 400 carries Post Bridge's error list", async () => {
  const m = mockFetch({ "POST /v1/posts": new Response(JSON.stringify({ error: ["media is required for tiktok"] }), { status: 400 }) });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  await assert.rejects(pb.createPost(tiktokDraftPost("x", 7, [])), (e: unknown) => e instanceof PostBridgeError && e.status === 400 && /media is required/.test(e.message));
});

test("getPost and listPostResults use the post id", async () => {
  const m = mockFetch({
    "GET /v1/posts/post_9": { id: "post_9", status: "posted", platform_configurations: { tiktok: { draft: true } } },
    "GET /v1/post-results": { data: [{ id: "res_1", post_id: "post_9", success: true, social_account_id: 7, error: null, platform_data: { id: "v1", url: "https://www.tiktok.com/@example.one/photo/1" } }] },
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const post = await pb.getPost("post_9");
  const results = await pb.listPostResults("post_9");
  assert.equal(post.status, "posted");
  assert.equal(m.calls[1].url, "https://api.post-bridge.com/v1/post-results?post_id=post_9&limit=100");
  assert.equal(results[0].platform_data?.url, "https://www.tiktok.com/@example.one/photo/1");
});

test("createPost: the direct post is scheduled (UTC), public, comments on, sound by TikTok, no draft flag on", async () => {
  const m = mockFetch({ "POST /v1/posts": (c: Call) => ({ id: "post_d", status: "scheduled", is_draft: false, ...(c.body as object) }) });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  await pb.createPost(tiktokDirectPost("Never do these 5 things with a kitten #example", 97302, ["mid_1", "mid_2"], "2026-09-17T23:00:00.000Z"));
  assert.deepEqual(m.calls[0].body, {
    caption: "Never do these 5 things with a kitten #example",
    social_accounts: [97302],
    media: ["mid_1", "mid_2"],
    scheduled_at: "2026-09-17T23:00:00.000Z",
    platform_configurations: { tiktok: { draft: false, privacy_status: "public", auto_add_music: true, allow_comment: true } },
  });
});

test("sendStatusOf: a direct post before its time is scheduled, then posted", () => {
  const direct = { status: "scheduled", scheduled_at: "2026-09-17T23:00:00.000Z", platform_configurations: { tiktok: { draft: false } } } as unknown as PBPost;
  assert.equal(sendStatusOf(direct, []).word, "scheduled");
  const ok = { id: "res_1", post_id: "p", success: true, social_account_id: 7, error: null, platform_data: { url: "u" } } as PBPostResult;
  assert.equal(sendStatusOf({ ...direct, status: "posted" }, [ok]).word, "posted");
});

test("sendStatusOf: queued, draft created, error", () => {
  const draft = { status: "processing", platform_configurations: { tiktok: { draft: true } } } as unknown as PBPost;
  assert.equal(sendStatusOf(draft, []).word, "queued");
  const ok = { id: "res_1", post_id: "p", success: true, social_account_id: 7, error: null, platform_data: { url: "u" } } as PBPostResult;
  const s = sendStatusOf({ ...draft, status: "posted" }, [ok]);
  assert.equal(s.word, "draft created");
  assert.equal(s.url, "u");
  const bad = { ...ok, success: false, error: { message: "TikTok: the account is not authorized for photo posts" } } as PBPostResult;
  const e = sendStatusOf({ ...draft, status: "failed" }, [bad]);
  assert.equal(e.word, "error");
  assert.match(e.error ?? "", /not authorized/);
});

test("analytics: sync then per post-result rows, mapped to an outcome line without saves", async () => {
  const row: PBAnalytics = { id: "an_1", post_result_id: "res_1", platform: "tiktok", platform_post_id: "v1", view_count: 12000, like_count: 340, comment_count: 21, share_count: 55, share_url: "https://www.tiktok.com/@example.one/photo/1", last_synced_at: "2026-09-23T10:00:00.000Z", match_confidence: "exact" };
  const m = mockFetch({
    "POST /v1/analytics/sync": new Response("", { status: 429 }),
    "GET /v1/post-results": { data: [{ id: "res_1", post_id: "post_9", success: true, social_account_id: 7, error: null, platform_data: {} }] },
    "GET /v1/analytics": { data: [row] },
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  assert.equal(await pb.syncAnalytics("tiktok"), false, "the cooldown is not an error");
  assert.equal(m.calls[0].url, "https://api.post-bridge.com/v1/analytics/sync?platform=tiktok");
  const rows = await pb.analyticsForPost("post_9");
  assert.equal(m.calls[2].url, "https://api.post-bridge.com/v1/analytics?post_result_id=res_1&limit=100");
  const o = outcomeOf("post_9", rows[0]);
  assert.deepEqual(o, { pbPost: "post_9", analyticsId: "an_1", views: 12000, likes: 340, comments: 21, shares: 55, url: "https://www.tiktok.com/@example.one/photo/1", syncedAt: "2026-09-23T10:00:00.000Z" });
  assert.equal("saves" in o, false);
});

test("syncOutcomesWith: writes a line when the numbers changed, none when they did not, none without analytics", async () => {
  const row: PBAnalytics = { id: "an_1", post_result_id: "res_1", platform: "tiktok", platform_post_id: null, view_count: 100, like_count: 1, comment_count: 0, share_count: 0, share_url: null, last_synced_at: "", match_confidence: null };
  const m = mockFetch({
    "POST /v1/analytics/sync": {},
    "GET /v1/posts/post_9": { id: "post_9", status: "posted", platform_configurations: { tiktok: { draft: true } } },
    "GET /v1/posts/post_0": { id: "post_0", status: "processing", platform_configurations: { tiktok: { draft: true } } },
    "GET /v1/post-results": (c: Call) => (c.url.includes("post_id=post_9") ? { data: [{ id: "res_1", post_id: "post_9", success: true, social_account_id: 7, error: null, platform_data: {} }] } : { data: [] }),
    "GET /v1/analytics": { data: [row] },
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const written: string[] = [];
  const r1 = await syncOutcomesWith(pb, [{ post: "a", pbPost: "post_9" }, { post: "b", pbPost: "post_0" }], () => null, (post) => written.push(post));
  assert.deepEqual(written, ["a"]);
  assert.equal(r1.reports[0].result, "draft created");
  assert.equal(r1.reports[1].result, "queued");
  assert.equal(r1.reports[1].note, "no analytics yet (the draft is not live, or TikTok has not exposed it)");
  const r2 = await syncOutcomesWith(pb, [{ post: "a", pbPost: "post_9" }], () => ({ views: 100, likes: 1, comments: 0, shares: 0 }), (post) => written.push(post));
  assert.deepEqual(written, ["a"]);
  assert.equal(r2.reports[0].note, "unchanged");
});

test("mapAccounts: a bare handle declares one TikTok account; a missing one is null; the rest are unmatched", () => {
  const f = mapAccounts(["@example.one", "@example.two", "@example.app"], [
    { id: 7, platform: "tiktok", username: "example.one" },
    { id: 8, platform: "instagram", username: "example.app" },
    { id: 9, platform: "tiktok", username: "someone.else" },
  ], "2026-09-16T00:00:00.000Z");
  assert.equal(accountsOf(f, "@example.one").tiktok?.id, 7);
  assert.deepEqual(accountsOf(f, "@example.two"), {});
  assert.deepEqual(accountsOf(f, "@example.app"), {}, "an Instagram account with the same name is not matched: the identity does not declare it");
  assert.deepEqual(f.unmatched.map((a) => a.id), [8, 9]);
});

test("mapAccounts: a declared Instagram account with another name is matched; the same name on Instagram is not, unless declared", () => {
  const listed = [
    { id: 1, platform: "tiktok", username: "hannah.catmom" },
    { id: 2, platform: "tiktok", username: "catlover.tiktok3" },
    { id: 3, platform: "tiktok", username: "catwise.app" },
    { id: 4, platform: "instagram", username: "hannah.catmom_" },
    { id: 5, platform: "instagram", username: "catlover.tiktok3" },
  ];
  const f = mapAccounts([
    { handle: "@hannah.catmom", accounts: [{ platform: "tiktok", account: "@hannah.catmom", role: "primary" }, { platform: "instagram", account: "@hannah.catmom_", role: "repost" }] },
    "@catlover.tiktok3",
    { handle: "@catwise.app", accounts: [{ platform: "tiktok", account: "@catwise.app", role: "primary" }, { platform: "instagram", account: "@catwise.app", role: "repost" }] },
  ], listed, "2026-09-23T00:00:00.000Z");
  const hannah = accountsOf(f, "@hannah.catmom");
  assert.equal(hannah.tiktok?.id, 1);
  assert.equal(hannah.instagram?.id, 4, "the declared Instagram account, with its own name");
  assert.deepEqual(Object.keys(accountsOf(f, "@catlover.tiktok3")), ["tiktok"], "the Instagram account with the same name is not matched: not declared");
  const catwise = accountsOf(f, "@catwise.app");
  assert.equal(catwise.tiktok?.id, 3);
  assert.equal(catwise.instagram, undefined, "declared, not connected yet");
  assert.equal((f.accounts["@catwise.app"] as { platforms: Record<string, unknown> }).platforms.instagram, null);
  assert.deepEqual(f.unmatched.map((a) => a.id), [5]);
});

test("accountsOf: a map written before 0.4.0 (one account per handle) still gives the TikTok account", () => {
  const old = { accounts: { "@hannah.catmom": { id: 97911, platform: "tiktok", username: "hannah.catmom", needs_reconnect: false, provider: "postbridge" }, "@catlover.tiktok3": null } };
  assert.equal(accountsOf(old, "@hannah.catmom").tiktok?.id, 97911);
  assert.equal(accountsOf(old, "hannah.catmom").tiktok?.id, 97911, "found without the @ too");
  assert.deepEqual(accountsOf(old, "@catlover.tiktok3"), {});
  assert.deepEqual(accountsOf(null, "@hannah.catmom"), {});
});

test("legsPost: one post for both accounts; TikTok draft, Instagram with its own slides, caption and first comment", () => {
  const input = legsPost({
    legs: [{ platform: "tiktok", account: 97911 }, { platform: "instagram", account: 98014 }],
    mode: "draft",
    tiktok: { caption: "7 signs your cat is stressed #catsoftiktok", media: ["t1", "t2"] },
    instagram: { caption: "7 signs your cat is stressed", media: ["i1", "i2"], firstComment: "#catsoftiktok" },
  });
  assert.deepEqual(input.accounts, [97911, 98014]);
  assert.deepEqual(input.media, ["t1", "t2"], "the post's media are TikTok's");
  assert.equal(input.caption, "7 signs your cat is stressed #catsoftiktok");
  assert.deepEqual(input.platformConfig, {
    tiktok: { draft: true },
    instagram: { caption: "7 signs your cat is stressed", media: ["i1", "i2"], first_comment: "#catsoftiktok" },
  });
  assert.equal(input.schedule, undefined, "a draft is processed now: Instagram publishes at once");
});

test("legsPost: direct mode schedules both legs at one instant; an Instagram leg alone carries its own media", () => {
  const both = legsPost({
    legs: [{ platform: "tiktok", account: 1 }, { platform: "instagram", account: 2 }],
    mode: "direct", scheduledAt: "2026-09-23T23:00:00.000Z",
    tiktok: { caption: "c", media: ["t1"] }, instagram: { caption: "c", media: ["i1"], firstComment: "" },
  });
  assert.equal(both.schedule, "2026-09-23T23:00:00.000Z");
  assert.equal(both.platformConfig?.tiktok?.draft, false);
  assert.equal(both.platformConfig?.instagram?.first_comment, undefined, "no hashtags, no first comment");
  const ig = legsPost({ legs: [{ platform: "instagram", account: 2 }], mode: "draft", instagram: { caption: "c", media: ["i1", "i2"], firstComment: "#a" } });
  assert.deepEqual(ig.accounts, [2]);
  assert.deepEqual(ig.media, ["i1", "i2"]);
  assert.equal(ig.platformConfig?.tiktok, undefined);
  assert.throws(() => legsPost({ legs: [{ platform: "instagram", account: 2 }], mode: "draft" }), /Instagram leg needs/);
  assert.throws(() => legsPost({ legs: [{ platform: "tiktok", account: 1 }], mode: "direct", tiktok: { caption: "c", media: ["t"] } }), /needs a time/);
});

test("legStatusOf: each leg reads its own post result; one success and one failure", () => {
  const post = { id: "p1", status: "posted", scheduled_at: null, platform_configurations: { tiktok: { draft: true } } } as unknown as PBPost;
  const results = [
    { id: "r1", post_id: "p1", success: true, social_account_id: 1, error: null, platform_data: { url: "https://www.tiktok.com/@h/photo/1" } },
    { id: "r2", post_id: "p1", success: false, social_account_id: 2, error: { message: "Aspect ratio not supported" }, platform_data: null },
  ] as PBPostResult[];
  assert.deepEqual(legStatusOf(post, results, { platform: "tiktok", account: 1 }), { word: "draft created", error: null, url: "https://www.tiktok.com/@h/photo/1" });
  assert.deepEqual(legStatusOf(post, results, { platform: "instagram", account: 2 }), { word: "error", error: "Aspect ratio not supported", url: null });
  assert.equal(legStatusOf({ ...post, status: "processing" } as PBPost, [], { platform: "instagram", account: 2 }).word, "queued");
});

test("syncOutcomesWith: two legs give one line each; one refresh per platform; an Instagram failure is heard, not a TikTok line", async () => {
  const ttRow: PBAnalytics = { id: "an_t", post_result_id: "res_t", platform: "tiktok", platform_post_id: null, view_count: 900, like_count: 40, comment_count: 3, share_count: 2, share_url: "https://www.tiktok.com/@h/photo/1", last_synced_at: "", match_confidence: null };
  const igRow: PBAnalytics = { ...ttRow, id: "an_i", post_result_id: "res_i", platform: "instagram", view_count: 300, like_count: 25, share_url: "https://www.instagram.com/p/abc/" };
  const m = mockFetch({
    "POST /v1/analytics/sync": {},
    "GET /v1/posts/two": { id: "two", status: "posted", scheduled_at: "2026-09-23T23:00:00.000Z", platform_configurations: { tiktok: { draft: false }, instagram: {} } },
    "GET /v1/posts/bad": { id: "bad", status: "posted", scheduled_at: null, platform_configurations: { tiktok: { draft: true }, instagram: {} } },
    "GET /v1/post-results": (c: Call) => (c.url.includes("post_id=two")
      ? { data: [{ id: "res_t", post_id: "two", success: true, social_account_id: 1, error: null, platform_data: {} }, { id: "res_i", post_id: "two", success: true, social_account_id: 4, error: null, platform_data: { url: "https://www.instagram.com/p/abc/" } }] }
      : { data: [{ id: "res_t2", post_id: "bad", success: true, social_account_id: 1, error: null, platform_data: {} }, { id: "res_i2", post_id: "bad", success: false, social_account_id: 4, error: "Media aspect ratio not supported", platform_data: null }] }),
    "GET /v1/analytics": (c: Call) => ({ data: c.url.includes("res_t2") || c.url.includes("res_i2") ? [] : c.url.includes("res_t") ? [ttRow] : [igRow] }),
  });
  const pb = postBridge({ apiKey: KEY, fetch: m.fetch });
  const legs = [{ platform: "tiktok" as const, account: 1 }, { platform: "instagram" as const, account: 4 }];
  const written: { post: string; platform?: string; views: number; saves?: null }[] = [];
  const heard: string[] = [];
  const r = await syncOutcomesWith(pb, [{ post: "a", pbPost: "two", legs }, { post: "b", pbPost: "bad", legs }], () => null,
    (post, o) => written.push({ post, platform: o.platform, views: o.views, saves: o.saves }),
    (post, _pb, leg, st) => heard.push(`${post} ${leg.platform} ${st.word}${st.error ? `: ${st.error}` : ""}`));
  assert.deepEqual(m.calls.filter((c) => c.url.includes("/v1/analytics/sync")).map((c) => c.url.split("platform=")[1]), ["tiktok", "instagram"]);
  assert.deepEqual(written, [{ post: "a", platform: undefined, views: 900, saves: undefined }, { post: "a", platform: "instagram", views: 300, saves: null }]);
  assert.deepEqual(heard, ["a tiktok posted", "a instagram posted", "b tiktok draft created", "b instagram error: Media aspect ratio not supported"]);
  assert.equal(r.reports.find((x) => x.post === "b" && x.platform === "instagram")?.result, "error: Media aspect ratio not supported");
  /* The same numbers again: nothing written, per leg. */
  const again: string[] = [];
  await syncOutcomesWith(pb, [{ post: "a", pbPost: "two", legs }], (_p, platform) => (platform === "tiktok" ? { views: 900, likes: 40, comments: 3, shares: 2 } : { views: 300, likes: 25, comments: 3, shares: 2 }), (post, o) => again.push(`${post} ${o.platform ?? "tiktok"}`));
  assert.deepEqual(again, []);
});

test("syncOutcomesWith: a TikTok-only send makes exactly the calls it made before (one refresh, no platform in the line)", async () => {
  const row: PBAnalytics = { id: "an_1", post_result_id: "res_1", platform: "tiktok", platform_post_id: null, view_count: 5, like_count: 0, comment_count: 0, share_count: 0, share_url: null, last_synced_at: "", match_confidence: null };
  const m = mockFetch({
    "POST /v1/analytics/sync": {},
    "GET /v1/posts/p": { id: "p", status: "posted", platform_configurations: { tiktok: { draft: true } } },
    "GET /v1/post-results": { data: [{ id: "res_1", post_id: "p", success: true, social_account_id: 7, error: null, platform_data: {} }] },
    "GET /v1/analytics": { data: [row] },
  });
  const lines: object[] = [];
  let heard = 0;
  await syncOutcomesWith(postBridge({ apiKey: KEY, fetch: m.fetch }), [{ post: "a", pbPost: "p" }], () => null, (_post, o) => lines.push(o), () => heard++);
  assert.deepEqual(m.calls.map((c) => `${c.method} ${c.url.replace("https://api.post-bridge.com", "")}`), [
    "POST /v1/analytics/sync?platform=tiktok", "GET /v1/posts/p", "GET /v1/post-results?post_id=p&limit=100", "GET /v1/analytics?post_result_id=res_1&limit=100",
  ]);
  assert.equal("platform" in (lines[0] as object), false);
  assert.equal(heard, 0, "a send with no legs is not a two-platform send");
});
