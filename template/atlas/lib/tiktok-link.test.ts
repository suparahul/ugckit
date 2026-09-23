/** The pure parts of the link pull: the caption match, the URL, the outcome line. `npm test`. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { captionMatch, captionTokens, matchByTime, matchPosts, outcomeOfMonid, pbLinkOf, tiktokIdOf, tiktokUrl, type MonidPost } from "./tiktok-link.ts";
import type { Event } from "./production.ts";

const rec = (o: Partial<MonidPost>): MonidPost => ({ id: "1", postPage: "", uploadedAtFormatted: "2026-09-16T19:30:03.000Z", views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0, title: "", ...o });

test("captionTokens: the first line, hashtags and emoji off, lower case", () => {
  assert.deepEqual(captionTokens("Signs your cat LOVES you 🐾 #cattok #example\nsecond line"), ["signs", "your", "cat", "loves", "you"]);
});

test("captionMatch: exact is 1, a phone edit still scores high, another post low", () => {
  const caption = "Signs your cat loves you and actually trusts you, from a first time cat owner who wondered 🐾 #cattok";
  assert.equal(captionMatch(caption, "Signs your cat loves you and actually trusts you, from a first time cat owner who wondered #catbonding"), 1);
  assert.ok(captionMatch(caption, "Signs your cat loves you, from a first time cat owner who wondered 🐾 #cattok") >= 0.8);
  assert.ok(captionMatch(caption, "How to raise a calm & desensitized cat (from kitten stage) #cattok") < 0.5);
  assert.ok(captionMatch("How to raise a calm & desensitized cat (from kitten stage) #catsoftiktok", "How to desensitize your cat from kitten stage #catsoftiktok") >= 0.8);
  assert.equal(captionMatch("", "anything"), 0);
});

test("matchPosts: only posts after the send, best first", () => {
  const posts = [
    rec({ id: "old", title: "Signs your cat loves you", uploadedAtFormatted: "2026-09-16T10:00:00.000Z" }),
    rec({ id: "new", title: "Signs your cat loves you, from a first time cat owner" }),
    rec({ id: "other", title: "CatGPT knows how much he sleeps" }),
  ];
  const m = matchPosts("Signs your cat loves you, from a first time cat owner #cattok", "2026-09-16T17:25:31.650Z", posts);
  assert.deepEqual(m.map((x) => x.post.id), ["new"]);
});

test("matchByTime: the single later post is the match; none or several is no match", () => {
  const posts = [
    rec({ id: "old", uploadedAtFormatted: "2026-09-16T10:00:00.000Z" }),
    rec({ id: "new", uploadedAtFormatted: "2026-09-16T19:00:00.000Z" }),
  ];
  assert.equal(matchByTime("2026-09-16T17:25:31.650Z", posts)?.id, "new");
  assert.equal(matchByTime("2026-09-16T20:00:00.000Z", posts), null, "nothing after the send");
  const two = [...posts, rec({ id: "new2", uploadedAtFormatted: "2026-09-16T19:30:00.000Z" })];
  assert.equal(matchByTime("2026-09-16T17:25:31.650Z", two), null, "more than one after the send");
});

test("tiktokIdOf: the digits after /video/ or /photo/, query stripped", () => {
  assert.equal(tiktokIdOf("https://www.tiktok.com/@x/video/123?utm_campaign=a&utm_source=b"), "123");
  assert.equal(tiktokIdOf("https://www.tiktok.com/@x/photo/456"), "456");
  assert.equal(tiktokIdOf("https://www.tiktok.com/@x"), null);
});

test("pbLinkOf: the last Post Bridge outcome.sync line's url, query stripped; null without one", () => {
  const log: Event[] = [
    { at: "t1", post: "p", kind: "outcome.sync", data: { source: "monid", url: "https://www.tiktok.com/@x/photo/1" } },
    { at: "t2", post: "p", kind: "outcome.sync", data: { source: "postbridge", url: "https://www.tiktok.com/@x/video/789?utm_campaign=a" } },
  ];
  assert.deepEqual(pbLinkOf(log), { url: "https://www.tiktok.com/@x/video/789", id: "789" });
  assert.equal(pbLinkOf([{ at: "t1", post: "p", kind: "posted", data: {} }]), null);
});

test("tiktokUrl and outcomeOfMonid", () => {
  const p = rec({ id: "7686217529173331213", images: [{}, {}], views: 166, likes: 5, bookmarks: 2, shares: 1 });
  assert.equal(tiktokUrl("@example.one", p), "https://www.tiktok.com/@example.one/photo/7686217529173331213");
  assert.equal(tiktokUrl("example.one", rec({ id: "9" })), "https://www.tiktok.com/@example.one/video/9");
  const o = outcomeOfMonid(p, "u", "2026-09-17T08:00:00.000Z");
  assert.deepEqual(o, { source: "monid", tiktokId: "7686217529173331213", views: 166, likes: 5, comments: 0, saves: 2, shares: 1, url: "u", syncedAt: "2026-09-17T08:00:00.000Z" });
});
