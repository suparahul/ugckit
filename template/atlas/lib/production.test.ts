/**
 * The legs of a post (lib/production.ts): one per platform, read from the log.
 * A line with no platform is TikTok's, so a log written before Instagram reads
 * as it did. No file, no network. Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlatforms, platformOf, primaryOf, slideLimit } from "./platform.ts";
import { legState, legsOfSent, platformsOf, slideLimitCheck, type Event, type PlanRow } from "./production.ts";

const P = "2026-09-23/hannah/1";
const ev = (at: string, kind: Event["kind"], data?: Event["data"], extra: Partial<Event> = {}): Event => ({ at: `2026-09-23T${at}:00.000Z`, post: P, kind, actor: "agent", ...(data ? { data } : {}), ...extra });

test("platform names: absent is TikTok, unknown is null, a cell lists both in order", () => {
  assert.equal(platformOf(undefined), "tiktok");
  assert.equal(platformOf("Instagram"), "instagram");
  assert.equal(platformOf("youtube"), null);
  assert.deepEqual(parsePlatforms("instagram, TikTok"), ["tiktok", "instagram"]);
  assert.equal(parsePlatforms("—"), null);
  assert.equal(parsePlatforms(""), null);
  assert.equal(primaryOf(["instagram"]), "instagram");
  assert.equal(primaryOf(["tiktok", "instagram"]), "tiktok");
});

test("the 10-slide rule: a check only when the post also goes to Instagram", () => {
  assert.equal(slideLimit(["tiktok"]), null);
  assert.equal(slideLimit(["tiktok", "instagram"]), 10);
  assert.deepEqual(slideLimitCheck(13, ["tiktok"]), []);
  assert.equal(slideLimitCheck(10, ["tiktok", "instagram"])[0].ok, true);
  const over = slideLimitCheck(13, ["tiktok", "instagram"])[0];
  assert.equal(over.ok, false);
  assert.match(over.label, /13 slides · Instagram takes 10: cut the deck/);
});

test("platformsOf: the row's cell, else the plan's line, else TikTok", () => {
  const row = { slug: "x" } as PlanRow;
  assert.deepEqual(platformsOf(row, {}), ["tiktok"]);
  assert.deepEqual(platformsOf(row, { platforms: ["tiktok", "instagram"] }), ["tiktok", "instagram"]);
  assert.deepEqual(platformsOf({ ...row, platforms: ["tiktok"] }, { platforms: ["tiktok", "instagram"] }), ["tiktok"]);
});

test("a log with no platform gives one TikTok leg, exactly as before", () => {
  const log = [
    ev("08:00", "posting.sent", { provider: "postbridge", id: "pb1", account: 97911, media: "m1 m2", status: "processing", mode: "draft" }),
    ev("09:00", "posted", { time: "09:00", url: "https://www.tiktok.com/@hannah.catmom/photo/1" }),
    ev("10:00", "outcome.sync", { source: "postbridge", views: 100, likes: 5, comments: 1, shares: 2, url: "", syncedAt: "2026-09-23T10:00:00Z", pbPost: "pb1" }),
    ev("11:00", "outcome.sync", { source: "monid", views: 120, likes: 6, comments: 1, shares: 2, saves: 4, url: "", syncedAt: "2026-09-23T11:00:00Z", pbPost: "" }),
  ];
  const tt = legState(log, "tiktok");
  assert.equal(tt.sent?.id, "pb1");
  assert.equal(tt.sent?.account, 97911);
  assert.equal(tt.sent?.mode, "draft");
  assert.deepEqual(tt.sent?.media, ["m1", "m2"]);
  assert.equal(tt.posted?.time, "09:00");
  assert.equal(tt.link, "https://www.tiktok.com/@hannah.catmom/photo/1");
  assert.equal(tt.synced?.source, "monid", "Monid first, as before");
  assert.equal(tt.synced?.saves, 4);
  const ig = legState(log, "instagram");
  assert.equal(ig.sent, null);
  assert.equal(ig.posted, null);
  assert.equal(ig.synced, null);
});

test("two legs: one send, one leg each; a failed Instagram leg leaves TikTok as it is", () => {
  const log = [
    ev("08:00", "posting.sent", { provider: "postbridge", id: "pb2", account: 97911, media: "m1", status: "processing", mode: "direct", legs: [
      { platform: "tiktok", account: 97911, mode: "direct", scheduledAt: "2026-09-23T13:00:00.000Z", status: "scheduled" },
      { platform: "instagram", account: 98014, mode: "direct", scheduledAt: "2026-09-23T13:00:00.000Z", status: "scheduled" },
    ] }),
    ev("13:05", "posted", { time: "13:00", url: "" }),
    ev("13:06", "posting.failed", { platform: "instagram", account: 98014, error: "The aspect ratio is not supported." }),
    ev("14:00", "outcome.sync", { platform: "instagram", source: "postbridge", views: 50, likes: 2, comments: 0, shares: 1, saves: null, url: "https://www.instagram.com/p/x/", syncedAt: "2026-09-23T14:00:00Z", pbPost: "pb2" }),
  ];
  assert.equal(legsOfSent(log[0]).length, 2);
  const tt = legState(log, "tiktok");
  const ig = legState(log, "instagram");
  assert.equal(tt.sent?.account, 97911);
  assert.equal(ig.sent?.account, 98014);
  assert.equal(ig.sent?.scheduledAt, "2026-09-23T13:00:00.000Z");
  assert.ok(tt.posted, "the posted line with no platform is TikTok's");
  assert.equal(ig.posted, null);
  assert.equal(tt.failed, null);
  assert.equal(ig.failed?.error, "The aspect ratio is not supported.");
  assert.equal(tt.synced, null, "the Instagram numbers are not TikTok's");
  assert.equal(ig.synced?.views, 50);
  assert.equal(ig.synced?.saves, null);
});

test("a retry clears the failure; leg.drop and leg.add toggle a leg", () => {
  const log = [
    ev("08:00", "posting.failed", { platform: "instagram", error: "needs reconnect" }),
    ev("09:00", "posting.sent", { provider: "postbridge", id: "pb3", media: "m1", legs: [{ platform: "instagram", account: 98014, mode: "direct", scheduledAt: null, status: "processing" }] }),
    ev("10:00", "leg.drop", { platform: "instagram" }, { note: "13 slides; Instagram takes 10" }),
  ];
  const ig = legState(log, "instagram");
  assert.equal(ig.failed, null);
  assert.equal(ig.sent?.id, "pb3");
  assert.equal(ig.dropped?.note, "13 slides; Instagram takes 10");
  assert.equal(legState(log, "tiktok").sent, null, "a send of the Instagram leg alone is not TikTok's");
  assert.equal(legState([...log, ev("11:00", "leg.add", { platform: "instagram" })], "instagram").dropped, null);
});

test("the read: views add up over the legs; saves come only from the leg that knows them; one platform's view reads its leg", async () => {
  const { numbersOf, numbersIn, readOf } = await import("./read.ts");
  const log = [
    ev("08:00", "posting.sent", { provider: "postbridge", id: "pb4", media: "m1", legs: [
      { platform: "tiktok", account: 1, mode: "direct", scheduledAt: null, status: "posted" },
      { platform: "instagram", account: 2, mode: "direct", scheduledAt: null, status: "posted" },
    ] }),
    ev("09:00", "posted", { time: "09:00", url: "" }),
    ev("09:00", "posted", { platform: "instagram", time: "09:00", url: "" }),
    ev("10:00", "outcome.sync", { source: "monid", views: 1000, likes: 50, comments: 5, shares: 3, saves: 20, url: "", syncedAt: "2026-09-23T10:00:00Z", pbPost: "" }),
    ev("10:30", "outcome.sync", { platform: "instagram", source: "postbridge", views: 400, likes: 30, comments: 2, shares: 1, saves: null, url: "", syncedAt: "2026-09-23T10:30:00Z", pbPost: "pb4" }),
  ];
  const tt = legState(log, "tiktok");
  const ig = legState(log, "instagram");
  const s = { platforms: ["tiktok", "instagram"], primary: "tiktok", legs: { tiktok: tt, instagram: ig }, sent: tt.sent, posted: tt.posted, synced: tt.synced, link: tt.link, outcomes: null, killed: null, log } as unknown as Parameters<typeof numbersOf>[0];
  const both = numbersOf(s)!;
  assert.equal(both.views, 1400);
  assert.equal(both.saves, 20, "Instagram's unknown saves add nothing");
  assert.equal(both.savesKnown, true);
  assert.deepEqual(both.legs, ["tiktok", "instagram"]);
  assert.equal(numbersIn(s, "tiktok")!.views, 1000);
  const igOnly = numbersIn(s, "instagram")!;
  assert.equal(igOnly.views, 400);
  assert.equal(igOnly.savesKnown, false);
  assert.equal(readOf([s], "instagram").views, 400);
  assert.equal(readOf([s]).views, 1400);
});
