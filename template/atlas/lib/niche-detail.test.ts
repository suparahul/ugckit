/**
 * The niche post detail (lib/niche-posts.ts: nicheDetailOf, scrollDetailOf,
 * nichePostHref, hashtagsOf): no file, no network. Run with `npm test`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { batchKindOf, batchMediaOf, batchSlideCount, hashtagsOf, isViewable, nicheDetailOf, nichePostHref, scrollDetailOf, type NichePost } from "./niche-posts.ts";

const row = (o: Partial<NichePost>): NichePost => ({
  id: "1", keyword: "cattips", window: "PHOTO_TAB", handle: "h", mediaType: "slideshow", slideCount: 4,
  views: 1000, likes: 100, comments: 5, saves: 20, shares: 3, saveRate: 0.02, date: "2026-09-01",
  caption: "Five tips #cattips #catmom", cover: null, coverLocal: false, url: "https://www.tiktok.com/@h/photo/1", ...o,
});

test("nichePostHref: one address per platform and id", () => {
  assert.equal(nichePostHref("pawly", "tiktok", "7171652144062401797"), "/app/pawly/niche/post/tiktok/7171652144062401797");
  assert.equal(nichePostHref("my app", "instagram", "39"), "/app/my%20app/niche/post/instagram/39");
});

test("nicheDetailOf: the rows of one post merged; the counts of the latest read; the cover on disk", () => {
  const posts = [
    row({ keyword: "cattips", window: "PHOTO_TAB", views: 900 }),
    row({ keyword: "catmom", window: "GENERAL", views: 1200, cover: "/media/apps/pawly/niche/covers/1.jpg", coverLocal: true }),
    row({ keyword: "catmom", window: "GENERAL", views: 1100 }),
    row({ id: "2" }),
  ];
  const d = nicheDetailOf(posts, "tiktok", "1")!;
  assert.equal(d.views, 1200);
  assert.deepEqual(d.found, [{ keyword: "cattips", window: "PHOTO_TAB" }, { keyword: "catmom", window: "GENERAL" }]);
  assert.equal(d.cover, "/media/apps/pawly/niche/covers/1.jpg");
  assert.deepEqual(d.hashtags, ["cattips", "catmom"]);
  assert.equal(d.src, "search");
});

test("nicheDetailOf: a signed cover URL is not shown (it expires)", () => {
  assert.equal(nicheDetailOf([row({ cover: "https://p16.tiktokcdn.com/x.jpg?x-expires=1" })], "tiktok", "1")!.cover, null);
});

test("nicheDetailOf: an Instagram photo keeps its empty counts empty, not 0; the platform is part of the key", () => {
  const ig = row({ id: "1", platform: "instagram", code: "DdqccGyibVB", views: null, likes: null, saves: null, shares: null, saveRate: null, url: "https://www.instagram.com/p/DdqccGyibVB/" });
  const d = nicheDetailOf([row({}), ig], "instagram", "1")!;
  assert.equal(d.platform, "instagram");
  assert.equal(d.code, "DdqccGyibVB");
  assert.equal(d.views, null);
  assert.equal(d.likes, null);
  assert.equal(d.saves, null);
  assert.equal(d.shares, null);
  assert.equal(d.url, "https://www.instagram.com/p/DdqccGyibVB/");
  assert.equal(nicheDetailOf([row({})], "instagram", "1"), null);
});

test("scrollDetailOf: a post from your scroll carries its slides and its sound", () => {
  const d = scrollDetailOf({ id: "9", handle: "h", url: "u", date: null, views: 10, likes: 1, comments: 0, shares: 0, saves: 2, slideCount: 0, caption: "hi #cats", sound: "a song", slides: ["/s1.jpg", "/s2.jpg"] });
  assert.equal(d.src, "scroll");
  assert.equal(d.slideCount, 2);
  assert.equal(d.cover, "/s1.jpg");
  assert.equal(d.sound, "a song");
  assert.deepEqual(d.hashtags, ["cats"]);
});

test("hashtagsOf: letters in any script, once each", () => {
  assert.deepEqual(hashtagsOf("#cat #猫 #cat #cat_tips!"), ["cat", "猫", "cat_tips"]);
});

test("scrollDetailOf: a video from a batch is a video, with no slide count", () => {
  const d = scrollDetailOf({ id: "9", handle: "h", url: "u", date: null, views: 10, likes: 1, comments: 0, shares: 0, saves: 2, slideCount: 0, caption: "", sound: null, slides: ["/cover.jpg"], kind: "video" });
  assert.equal(d.mediaType, "video");
  assert.equal(d.slideCount, null);
  assert.equal(d.cover, "/cover.jpg");
});

test("batchKindOf and batchSlideCount: the Kind cell first, then the Slides / length cell", () => {
  assert.equal(batchKindOf("9 slides", "slideshow"), "slideshow");
  assert.equal(batchKindOf("45 s", "video"), "video");
  assert.equal(batchKindOf("45 s", undefined), "video");
  assert.equal(batchKindOf("9", undefined), "slideshow");
  assert.equal(batchSlideCount("9 slides", "slideshow"), 9);
  assert.equal(batchSlideCount("12", "slideshow"), 12);
  assert.equal(batchSlideCount("45 s", "video"), 0);
  assert.equal(batchSlideCount("", "slideshow"), 0);
});

const B = "/media/apps/catwise/niche/batches/2026-10-01/mishmish.honey/7666141879120956685";

test("batchMediaOf: a video folder gives the video and the cover; a slideshow folder gives its slides in order", () => {
  const v = batchMediaOf(["cover.jpg", "video.mp4", "meta.json"], B);
  assert.equal(v.video, `${B}/video.mp4`);
  assert.equal(v.cover, `${B}/cover.jpg`);
  assert.deepEqual(v.slides, []);
  const s = batchMediaOf(["slide-02.jpg", "slide-01.jpg", "notes.txt"], B);
  assert.deepEqual(s.slides, [`${B}/slide-01.jpg`, `${B}/slide-02.jpg`]);
  assert.equal(s.video, null);
  assert.deepEqual(batchMediaOf([], B), { slides: [], video: null, cover: null });
});

test("isViewable: a video needs its video.mp4; a slideshow needs its slides on disk (a cover alone is not enough)", () => {
  assert.equal(isViewable({ kind: "video", video: `${B}/video.mp4` }), true);
  assert.equal(isViewable({ kind: "video", video: null, slides: [`${B}/cover.jpg`] }), false);
  assert.equal(isViewable({ kind: "video", held: "metadata" }), false);
  assert.equal(isViewable({ kind: "slideshow", slides: [`${B}/slide-01.jpg`] }), true);
  assert.equal(isViewable({ kind: "slideshow", slides: [] }), false);
  assert.equal(isViewable({ kind: "slideshow", held: "slides" }), true);
  assert.equal(isViewable({ kind: "slideshow", held: "metadata" }), false);
});

test("nicheDetailOf and scrollDetailOf: the video URL goes through to the detail", () => {
  assert.equal(nicheDetailOf([row({ mediaType: "video", held: "video", video: `${B}/video.mp4` })], "tiktok", "1")!.video, `${B}/video.mp4`);
  assert.equal(nicheDetailOf([row({})], "tiktok", "1")!.video, null);
  const p = { id: "9", handle: "h", url: "u", date: null, views: 10, likes: 1, comments: 0, shares: 0, saves: 2, slideCount: 0, caption: "", sound: null, slides: [`${B}/cover.jpg`] };
  assert.equal(scrollDetailOf({ ...p, video: `${B}/video.mp4`, kind: "video" }).video, `${B}/video.mp4`);
  assert.equal(scrollDetailOf({ ...p, kind: "video" }).video, null);
  assert.equal(scrollDetailOf({ ...p, slides: [`${B}/slide-01.jpg`], kind: "slideshow" }).video, null);
});
