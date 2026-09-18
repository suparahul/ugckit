/** The pure parts of the link pull: the caption match, the URL, the outcome line. `npm test`. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { captionMatch, captionTokens, matchPosts, outcomeOfMonid, tiktokUrl, type MonidPost } from "./tiktok-link.ts";

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

test("tiktokUrl and outcomeOfMonid", () => {
  const p = rec({ id: "7686217529173331213", images: [{}, {}], views: 166, likes: 5, bookmarks: 2, shares: 1 });
  assert.equal(tiktokUrl("@example.one", p), "https://www.tiktok.com/@example.one/photo/7686217529173331213");
  assert.equal(tiktokUrl("example.one", rec({ id: "9" })), "https://www.tiktok.com/@example.one/video/9");
  const o = outcomeOfMonid(p, "u", "2026-09-17T08:00:00.000Z");
  assert.deepEqual(o, { source: "monid", tiktokId: "7686217529173331213", views: 166, likes: 5, comments: 0, saves: 2, shares: 1, url: "u", syncedAt: "2026-09-17T08:00:00.000Z" });
});
