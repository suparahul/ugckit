/**
 * The niche readers (lib/niche-posts.ts): no file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { generalItems, generalPost, igItems, igPost, lenientJson } from "./niche-posts.ts";

test("lenientJson: strict JSON as it is; raw control characters inside strings escaped", () => {
  assert.deepEqual(lenientJson('{"a": [1, 2]}'), { a: [1, 2] });
  const raw = '{\n  "caption_text": "line one\nline two\ttab \\" quote\u0001",\n  "n": 3\n}';
  assert.throws(() => JSON.parse(raw));
  assert.deepEqual(lenientJson(raw), { caption_text: 'line one\nline two\ttab " quote\u0001', n: 3 });
  assert.equal(lenientJson("<html>busy</html>"), null);
});

test("igItems: the Monid envelope or the bare TikHub body", () => {
  const item = { id: "1", code: "C" };
  assert.deepEqual(igItems({ output: { data: { items: [item] }, pagination_token: "t" } }), [item]);
  assert.deepEqual(igItems({ data: { items: [item] } }), [item]);
  assert.deepEqual(igItems({ output: { data: {} } }), []);
});

test("igPost: a reel from a top page (caption_text, ISO taken_at, play_count)", () => {
  const p = igPost({ id: "3989448826971294496", code: "DddXpI1OQsg", media_type: 2, product_type: "clips", taken_at: "2026-09-19T06:30:58Z", like_count: 648, comment_count: 112, play_count: 35889, view_count: 0, caption_text: "Comment climb\nif you need one", user: { username: "catclimb" }, thumbnail_url: "https://x/c.jpg" }, "catmom", "IG_TOP")!;
  assert.equal(p.platform, "instagram");
  assert.equal(p.mediaType, "video");
  assert.equal(p.views, 35889);
  assert.equal(p.likes, 648);
  assert.equal(p.saves, null);
  assert.equal(p.shares, null);
  assert.equal(p.date, "2026-09-19");
  assert.equal(p.caption, "Comment climb if you need one");
  assert.equal(p.url, "https://www.instagram.com/reel/DddXpI1OQsg/");
  assert.equal(p.cover, "https://x/c.jpg");
});

test("igPost: a carousel from a recent page (caption.text, taken_at in seconds, no views)", () => {
  const p = igPost({ pk: "3993129096355362113", id: "3993129096355362113_123", code: "DdqccGyibVB", media_type: 8, product_type: "carousel_container", taken_at: 1790238104, like_count: 11, comment_count: 3, carousel_media_count: 2, caption: { text: "Cardboard box" }, user: { username: "sabrina_the_brit" }, image_versions: { items: [{ url: "https://x/i.jpg" }] } }, "catmom", "IG_RECENT")!;
  assert.equal(p.id, "3993129096355362113");
  assert.equal(p.mediaType, "slideshow");
  assert.equal(p.slideCount, 2);
  assert.equal(p.views, null);
  assert.equal(p.url, "https://www.instagram.com/p/DdqccGyibVB/");
  assert.equal(p.cover, "https://x/i.jpg");
});

test("igPost: a photo is a slideshow of one; hidden likes are null; no code, no post", () => {
  const photo = igPost({ id: "5", code: "P", media_type: 1, product_type: "feed", like_count: null, like_and_view_counts_disabled: true, comment_count: 0, user: { username: "u" } }, "cattips", "IG_TOP")!;
  assert.equal(photo.slideCount, 1);
  assert.equal(photo.likes, null);
  assert.equal(igPost({ id: "6", media_type: 1 }, "cattips", "IG_TOP"), null);
});

test("igPost: shares when the page carries a count; null when it does not, or when they are disabled", () => {
  const base = { id: "7", code: "S", media_type: 2, like_count: 5, play_count: 100, user: { username: "u" } };
  assert.equal(igPost(base, "k", "IG_TOP")!.shares, null);
  assert.equal(igPost({ ...base, share_count: 42 }, "k", "IG_TOP")!.shares, 42);
  assert.equal(igPost({ ...base, reshare_count: 9 }, "k", "IG_TOP")!.shares, 9);
  assert.equal(igPost({ ...base, share_count: 42, share_count_disabled: true }, "k", "IG_TOP")!.shares, null);
});

test("generalPost: an aweme from the TikTok general search", () => {
  const [a] = generalItems({ data: [{ aweme_info: { aweme_id: "7", desc: "tips", create_time: 1790000000, author: { unique_id: "h" }, statistics: { play_count: 1000, digg_count: 50, comment_count: 2, share_count: 3, collect_count: 20 }, image_post_info: { images: [{ display_image: { url_list: ["https://t/1.jpg"] } }, {}] } } }, { other: 1 }] });
  const p = generalPost(a, "cattips");
  assert.equal(p.platform, undefined);
  assert.equal(p.window, "GENERAL");
  assert.equal(p.mediaType, "slideshow");
  assert.equal(p.slideCount, 2);
  assert.equal(p.saveRate, 0.02);
  assert.equal(p.cover, "https://t/1.jpg");
  assert.equal(p.url, "https://www.tiktok.com/@h/photo/7");
});
