/** The pure parts of the link pull: the caption match, the URL, the outcome line. `npm test`. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { captionMatch, captionTokens, directLinkFrom, directLinkOf, handPostedLine, linkOf, matchByTime, matchPosts, maxItemsFor, MONID_COST_PER_POST, monidCostEstimate, outcomeOfMonid, pbLinkOf, pickRecord, postKindOf, savedRunsFetch, sinceOf, tiktokIdOf, tiktokUrl, type MatchTarget, type MonidPost } from "./tiktok-link.ts";
import type { Event } from "./production.ts";
import type { PBAnalytics, PBPost, PBPostResult } from "./postbridge.ts";

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

test("linkOf: a profile-only url (no /video/ or /photo/, no id) is ignored; a real link written later wins", () => {
  const bad: Event = { at: "t1", post: "p", kind: "posted.link", data: { url: "https://www.tiktok.com/@example.one", id: "" } };
  assert.equal(linkOf([bad]), null, "a posted.link with a profile url and no id is not a link");
  const badPosted: Event = { at: "t1", post: "p", kind: "posted", data: { url: "https://www.tiktok.com/@example.one" } };
  assert.equal(linkOf([badPosted]), null, "the posted-line fallback ignores a profile url the same way");
  const good: Event = { at: "t2", post: "p", kind: "posted.link", data: { url: "https://www.tiktok.com/@example.one/video/7690230383996095758", id: "7690230383996095758" } };
  assert.deepEqual(linkOf([bad, good]), { url: "https://www.tiktok.com/@example.one/video/7690230383996095758", id: "7690230383996095758" }, "a later, corrected line overrides the bad one — the log is append-only");
});

test("directLinkFrom: the url is built from the id (no query, /photo/ for a slideshow); a profile-only platform_data.url and the internal \"p_pub_url~v2...\" id never resolve", () => {
  const handle = "@example.one";
  assert.equal(directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one" }), null, "a profile url alone resolves nothing");
  assert.deepEqual(
    directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one", shareUrl: "https://www.tiktok.com/@example.one/video/7690230383996095758?utm_campaign=tt4d_open_api" }, "photo"),
    { url: "https://www.tiktok.com/@example.one/photo/7690230383996095758", id: "7690230383996095758", source: "analytics.share_url" },
    "share_url says /video/ for a photo post; the link is rebuilt as /photo/, query off",
  );
  assert.deepEqual(
    directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one", platformVideoId: "7690230383996095758" }),
    { url: "https://www.tiktok.com/@example.one/video/7690230383996095758", id: "7690230383996095758", source: "platform_data.platform_video_id" },
  );
  assert.equal(directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one", platformDataId: "p_pub_url~v2.7690230414731921421" }), null, "the internal id shape is not digits-only and is never used");
  assert.deepEqual(
    directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one", platformDataId: "7690230383996095758" }),
    { url: "https://www.tiktok.com/@example.one/video/7690230383996095758", id: "7690230383996095758", source: "platform_data.id" },
  );
  assert.deepEqual(
    directLinkFrom(handle, { statusUrl: "https://www.tiktok.com/@example.one/photo/123", platformVideoId: "999" }, "photo"),
    { url: "https://www.tiktok.com/@example.one/photo/123", id: "123", source: "platform_data.url" },
    "a real platform_data.url wins outright",
  );
});

/* Post Bridge's answers for three direct sends (GET /v1/posts/{id}, /v1/post-results, /v1/analytics), trimmed. */
const pbPost = (status: PBPost["status"]): PBPost => ({ id: "p", caption: "", status, scheduled_at: "2026-09-28T15:08:00+00:00", platform_configurations: { tiktok: { draft: false, privacy_status: "public" } }, social_accounts: [97911], media: [], created_at: "", updated_at: "", is_draft: false });
const pbResult = (account: number, handle: string, pubId: string, videoId: string | null): PBPostResult => ({ id: `r${account}`, post_id: "p", success: true, social_account_id: account, error: null, platform_data: { id: `p_pub_url~v2.${pubId}`, url: `https://www.tiktok.com/@${handle}`, username: handle, platform_video_id: videoId } });
const pbRow = (id: string, handle: string): PBAnalytics => ({ id: "a", post_result_id: "r", platform: "tiktok", platform_post_id: id, view_count: 0, like_count: 0, comment_count: 0, share_count: 0, share_url: `https://www.tiktok.com/@${handle}/video/${id}?utm_campaign=tt4d_open_api&utm_source=aw75i85tzolnpqso`, platform_created_at: "2026-09-28T15:11:13+00:00", last_synced_at: "", match_confidence: "high" });

test("directLinkOf: a post Post Bridge sent live is linked from Post Bridge alone; no id yet is \"waiting\", never a Monid fallback", () => {
  const leg = { platform: "tiktok" as const, account: 97911 };
  /* @example.one: platform_video_id is the post id; the p_pub_url number is a different one. */
  const one = directLinkOf("@example.one", "photo", pbPost("posted"), [pbResult(97911, "example.one", "7690603911254427661", "7690603933558983949")], [pbRow("7690603933558983949", "example.one")], leg);
  assert.deepEqual(one, { status: "linked", url: "https://www.tiktok.com/@example.one/photo/7690603933558983949", id: "7690603933558983949", source: "platform_data.platform_video_id", uploadedAt: "2026-09-28T15:11:13.000Z" });
  /* The post result without platform_video_id: the analytics share_url gives the id. */
  const viaShare = directLinkOf("@example.two", "photo", pbPost("posted"), [pbResult(97302, "example.two", "7690603844249946134", null)], [pbRow("7690603954622696726", "example.two")], { platform: "tiktok", account: 97302 });
  assert.equal(viaShare.status === "linked" && viaShare.url, "https://www.tiktok.com/@example.two/photo/7690603954622696726");
  /* @example.three at 15:17: processing, a profile url, no platform_video_id, no analytics yet. */
  const three = directLinkOf("@example.three", "photo", pbPost("processing"), [pbResult(97291, "example.three", "7690604953123031070", null)], [], { platform: "tiktok", account: 97291 });
  assert.equal(three.status, "waiting");
  /* A failed leg is an error with Post Bridge's words. */
  const failed = directLinkOf("@x", "photo", pbPost("failed"), [{ ...pbResult(1, "x", "1", null), success: false, error: "spam risk" }], [], { platform: "tiktok", account: 1 });
  assert.deepEqual(failed, { status: "error", note: "Post Bridge: spam risk" });
});

test("maxItemsFor: a handle's sent-post count plus a small margin, never below the margin", () => {
  assert.equal(maxItemsFor(0), 5);
  assert.equal(maxItemsFor(23), 28);
  assert.equal(maxItemsFor(-3), 5, "a bad count never asks Monid for fewer than the margin");
});

test("monidCostEstimate: maxItems posts at MONID_COST_PER_POST each", () => {
  assert.equal(monidCostEstimate(20), 20 * MONID_COST_PER_POST);
  assert.ok(Math.abs(monidCostEstimate(28) - 0.0126) < 1e-9);
});

test("tiktokUrl and outcomeOfMonid", () => {
  const p = rec({ id: "7686217529173331213", images: [{}, {}], views: 166, likes: 5, bookmarks: 2, shares: 1 });
  assert.equal(tiktokUrl("@example.one", p), "https://www.tiktok.com/@example.one/photo/7686217529173331213");
  assert.equal(tiktokUrl("example.one", rec({ id: "9" })), "https://www.tiktok.com/@example.one/video/9");
  assert.equal(postKindOf({ deck: { slides: [{}] } } as never), "photo", "a slideshow deck is a photo post");
  assert.equal(postKindOf({ deck: null } as never), "video");
  const o = outcomeOfMonid(p, "u", "2026-09-17T08:00:00.000Z");
  assert.deepEqual(o, { source: "monid", tiktokId: "7686217529173331213", views: 166, likes: 5, comments: 0, saves: 2, shares: 1, url: "u", syncedAt: "2026-09-17T08:00:00.000Z" });
});

/* ------------------------------------------------ posted by hand, and the match */

const handPosted: Event = { at: "2026-05-04T19:15:37.000Z", post: "p", kind: "posted", data: { time: "15:15", manual: true, platform: "tiktok", format: "video", file: "p/final/video.mp4" } as never };

test("handPostedLine: a TikTok posted line with manual true; not a plain tick, not another platform", () => {
  assert.equal(handPostedLine([handPosted]), handPosted);
  assert.equal(handPostedLine([{ at: "t", post: "p", kind: "posted", data: { time: "18:20" } }]), null, "a plain tick after a draft send is not a hand post");
  assert.equal(handPostedLine([{ ...handPosted, data: { ...handPosted.data, platform: "instagram" } as never }]), null);
});

test("postKindOf: a video posted by hand is a video, even with the one-slide deck the board shows", () => {
  assert.equal(postKindOf({ deck: { slides: [{}] }, log: [handPosted] } as never), "video");
  assert.equal(postKindOf({ deck: { slides: [{}, {}] }, log: [] } as never), "photo");
  assert.equal(postKindOf({ deck: null } as never), "video");
});

test("sinceOf: a send's time (the scheduled time when later); for a hand post the final approval, else the day before the plan date", () => {
  const row = { date: "2026-05-04" };
  assert.equal(sinceOf({ row, log: [], sent: { at: "2026-05-04T18:41:26.103Z", scheduledAt: "2026-05-04T23:00:00.000Z" } as never }), "2026-05-04T23:00:00.000Z");
  assert.equal(sinceOf({ row, log: [], sent: { at: "2026-05-04T14:37:59.878Z", scheduledAt: null } as never }), "2026-05-04T14:37:59.878Z");
  const approve: Event = { at: "2026-05-04T19:15:25.000Z", post: "p", kind: "final.approve" };
  assert.equal(sinceOf({ row, log: [approve, handPosted], sent: null }), "2026-05-04T19:15:25.000Z", "not the posted tick: it is often written before or after the upload");
  assert.equal(sinceOf({ row, log: [handPosted], sent: null }), "2026-05-03T00:00:00.000Z");
});

/* One handle's day: a morning slideshow (draft, caption rewritten on the phone), a hand-posted video, an evening slideshow. */
const slides = (n: number) => Array.from({ length: n }, () => ({}));
const day = [
  rec({ id: "video", uploadedAtFormatted: "2026-05-04T23:00:00.000Z", title: "My plant hated the window. This is how it learned to love it. Fern went from yellow to green #plants" }),
  rec({ id: "evening", uploadedAtFormatted: "2026-05-04T23:01:48.000Z", images: slides(5), title: "#plants #planttok #plantcare" }),
  rec({ id: "morning", uploadedAtFormatted: "2026-05-04T15:20:22.000Z", images: slides(8), title: "This is how you care for a fern as a first time plant parent! #plants" }),
  rec({ id: "old", uploadedAtFormatted: "2026-05-03T15:00:00.000Z", images: slides(8), title: "First time plant parent? Water your fern" }),
];

test("pickRecord: a video posted by hand is matched by caption among the videos only", () => {
  const t: MatchTarget = { caption: "My plant hated the window. This is how it learned to love it\n\nFern went from yellow to green #plants", since: "2026-05-04T19:15:25.000Z", kind: "video", slides: 1 };
  const pick = pickRecord(t, day, new Set(), "caption");
  assert.equal(pick?.status === "linked" && pick.record.id, "video");
});

test("pickRecord: a caption rewritten on the phone gives no caption match; the fallback finds the one slideshow of the same slide count", () => {
  const t: MatchTarget = { caption: "First time plant parent? Talk to your fern: what to say and when #plants", since: "2026-05-04T14:37:59.878Z", kind: "photo", slides: 8 };
  assert.equal(pickRecord(t, day, new Set(), "caption"), null, "the caption pass leaves it for the fallback");
  const pick = pickRecord(t, day, new Set(), "fallback");
  assert.equal(pick?.status === "linked" && pick.record.id, "morning");
  assert.equal(pick?.status === "linked" && pick.how, "shape");
  assert.equal(pickRecord({ ...t, slides: 6 }, day, new Set(), "fallback")?.status, "none", "no slideshow of 6 slides: nothing written");
});

test("pickRecord: a hashtags-only caption skips the post another post already links", () => {
  const t: MatchTarget = { caption: "#plants #fern #plantparents", since: "2026-05-04T14:38:15.196Z", kind: "photo", slides: 8 };
  assert.equal(pickRecord(t, day, new Set(), "fallback")?.status, "linked", "the evening post has 5 slides, so the shape still tells them apart");
  assert.equal(pickRecord({ ...t, slides: 0 }, day, new Set(), "fallback")?.status, "many", "two slideshows after the send and no slide count: nothing written");
  const pick = pickRecord({ ...t, slides: 0 }, day, new Set(["evening"]), "fallback");
  assert.equal(pick?.status === "linked" && pick.record.id, "morning", "the evening post is claimed by its own link");
  assert.equal(pick?.status === "linked" && pick.how, "time");
});

test("pickRecord: a short caption that reads as two posts of the day (80% each) takes the one of the same slide count, and never a linked one", () => {
  const posts = [rec({ id: "am", images: slides(7), title: "Signs your fern is too dry #planttok", uploadedAtFormatted: "2026-05-04T15:15:10.000Z" }), rec({ id: "pm", images: slides(8), title: "New plant owner? Save this: signs your new fern is settling in", uploadedAtFormatted: "2026-05-04T23:01:38.000Z" })];
  const t: MatchTarget = { caption: "Signs your fern is dry #plantcare", since: "2026-05-04T14:38:57.966Z", kind: "photo", slides: 7 };
  assert.ok(captionMatch(t.caption, posts[1].title) >= 0.8, "the evening caption shares the words");
  const pick = pickRecord(t, posts, new Set(), "caption");
  assert.equal(pick?.status === "linked" && pick.record.id, "am");
  assert.equal(pickRecord(t, [posts[0], { ...posts[1], images: slides(7) }], new Set(), "caption")?.status, "many", "two of the same shape read as the caption: nothing written");
  assert.equal(pickRecord(t, posts, new Set(["am"]), "caption"), null, "its record is taken; the evening post reads as the caption but has 8 slides, not 7");
});

test("pbLinkOf: an Instagram line written without its platform is not the TikTok link", () => {
  const log: Event[] = [
    { at: "t1", post: "p", kind: "outcome.sync", data: { source: "postbridge", views: 400, url: "https://www.tiktok.com/@x/video/789?utm_campaign=a" } },
    { at: "t2", post: "p", kind: "outcome.sync", data: { source: "postbridge", views: 10, url: "https://www.instagram.com/reel/AbC123/" } },
  ];
  assert.deepEqual(pbLinkOf(log), { url: "https://www.tiktok.com/@x/video/789", id: "789" });
});

test("savedRunsFetch: each handle from its latest completed saved run, marked with the run's time; no saved run is an error, never a paid call", async () => {
  const fetch = savedRunsFetch([
    { runId: "a", status: "COMPLETED", endpoint: "/apidojo/tiktok-profile-scraper", input: { body: { usernames: ["example.one"] } }, completedAt: "2026-05-05T13:49:38.581Z", output: [rec({ id: "1", views: 120 })] },
    { runId: "b", status: "COMPLETED", endpoint: "/apidojo/tiktok-profile-scraper", input: { body: { usernames: ["example.one"] } }, completedAt: "2026-05-03T06:59:00.000Z", output: [rec({ id: "1", views: 50 })] },
  ]);
  const posts = await fetch("@example.one", 10);
  assert.equal(posts[0].views, 120);
  assert.equal(outcomeOfMonid(posts[0], "u").syncedAt, "2026-05-05T13:49:38.581Z", "the numbers carry the time they were read");
  await assert.rejects(fetch("@example.two", 10), /no saved run/);
});
