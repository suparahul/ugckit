/**
 * The niche win rule (lib/niche-win.ts): no file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { IG_LIKES_FLOOR, markWins, overFloor, type Rated } from "./niche-win.ts";

const tt = (views: number, saves: number, kind: Rated["kind"] = "slideshow"): Rated => ({ platform: "tiktok", kind, views, likes: 0, saves, win_: false, strength: null });
const reel = (views: number, likes: number | null): Rated => ({ platform: "instagram", kind: "video", views, likes, saves: null, win_: false, strength: null });
const carousel = (likes: number | null): Rated => ({ platform: "instagram", kind: "slideshow", views: null, likes, saves: null, win_: false, strength: null });

test("TikTok: 50,000 views and saves per view at the median of the slideshows over 50,000", () => {
  const tiles = [tt(100_000, 1000), tt(100_000, 3000), tt(100_000, 5000), tt(10_000, 9000), tt(200_000, 8000, "video")];
  const rule = markWins(tiles);
  assert.equal(rule.tiktok.median, 0.03);
  assert.equal(rule.tiktok.over, 3);
  assert.deepEqual(tiles.map((t) => t.win_), [false, true, true, false, true]);
  assert.equal(rule.tiktok.wins, 2);
  assert.equal(tiles[1].strength, 1);
});

test("Instagram does not move the TikTok median, and TikTok does not move Instagram's", () => {
  const a = markWins([tt(100_000, 1000), tt(100_000, 3000), tt(100_000, 5000)]);
  const b = markWins([tt(100_000, 1000), tt(100_000, 3000), tt(100_000, 5000), reel(100_000, 90_000), carousel(50)]);
  assert.equal(a.tiktok.median, b.tiktok.median);
  assert.equal(b.instagram.median, 0.9);
});

test("Instagram reels: 50,000 views and likes per view at the reel median", () => {
  const tiles = [reel(100_000, 2000), reel(100_000, 4000), reel(100_000, 6000), reel(40_000, 20_000), reel(900_000, null)];
  const rule = markWins(tiles);
  assert.equal(rule.instagram.median, 0.04);
  assert.equal(rule.instagram.over, 3);
  assert.deepEqual(tiles.map((t) => t.win_), [false, true, true, false, false]);
  assert.equal(tiles[4].strength, null);
});

test("Instagram photos and carousels: the likes a reel has at 50,000 views and the median rate", () => {
  const tiles = [reel(100_000, 2000), reel(100_000, 4000), reel(100_000, 6000), carousel(1999), carousel(2000), carousel(null)];
  const rule = markWins(tiles);
  assert.equal(rule.instagram.likesFloor, 2000);
  assert.deepEqual(tiles.slice(3).map((t) => t.win_), [false, true, false]);
  assert.equal(tiles[4].strength, 1);
});

test("No reel over 50,000 views: the photo bar is IG_LIKES_FLOOR", () => {
  const tiles = [reel(10_000, 900), carousel(IG_LIKES_FLOOR)];
  const rule = markWins(tiles);
  assert.equal(rule.instagram.likesFloor, IG_LIKES_FLOOR);
  assert.equal(tiles[1].win_, true);
});

test("overFloor: views as they are; a post with no views by its likes at the Instagram rate", () => {
  const rule = markWins([reel(100_000, 4000)]);
  assert.equal(overFloor(tt(60_000, 0), 50_000, rule), true);
  assert.equal(overFloor(tt(40_000, 0), 50_000, rule), false);
  assert.equal(overFloor(carousel(2000), 50_000, rule), true);
  assert.equal(overFloor(carousel(1999), 50_000, rule), false);
  assert.equal(overFloor(carousel(null), 0, rule), true);
});

const reelS = (views: number, likes: number | null, shares: number | null): Rated => ({ ...reel(views, likes), shares });
const carouselS = (likes: number | null, shares: number | null): Rated => ({ ...carousel(likes), shares });

test("Instagram with no shares reported: no share bar, the likes rule alone decides", () => {
  const tiles = [reel(100_000, 2000), reel(100_000, 4000), reel(100_000, 6000), carousel(2000), carousel(10)];
  const rule = markWins(tiles);
  assert.equal(rule.instagram.sharesFloor, null);
  assert.equal(rule.instagram.shareWins, 0);
  assert.equal(rule.instagram.withShares, 0);
  assert.equal(rule.instagram.likeWins, 3);
  assert.deepEqual(tiles.map((t) => t.win_), [false, true, true, true, false]);
});

test("Instagram shares: a post wins on likes OR on shares", () => {
  const tiles = [
    reelS(100_000, 2000, 100), reelS(100_000, 4000, 200), reelS(100_000, 6000, 300), // likes/view 2%, 4%, 6%
    reelS(100_000, 1000, 500), // likes/view 1%, shares/view 0.5%: wins on shares only
    carouselS(10, 150), // 50,000 x the share median (0.3%) = 150 shares: wins on shares
    carouselS(10, 149), // under both bars
    carouselS(null, 400), // likes hidden, wins on shares
  ];
  const rule = markWins(tiles);
  assert.equal(rule.instagram.median, 0.04);
  assert.equal(rule.instagram.shareMedian, 0.003);
  assert.equal(rule.instagram.sharesFloor, 150);
  assert.equal(rule.instagram.withShares, 7);
  assert.deepEqual(tiles.map((t) => t.win_), [false, true, true, true, true, false, true]);
  assert.equal(rule.instagram.likeWins, 2);
  assert.equal(rule.instagram.shareWins, 4);
  assert.equal(rule.instagram.wins, 5);
  assert.ok(Math.abs(tiles[3].strength! - 0.005 / 0.003) < 1e-9); // the higher of the two bars
  assert.ok(Math.abs(tiles[6].strength! - 400 / 150) < 1e-9);
});
