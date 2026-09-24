#!/usr/bin/env node
/**
 * build-niche.mjs — one data/niche-<slug>.json per app, from the keyword
 * searches of the niche phase.
 *
 * These shapes are read, all unchanged from the tools that write them:
 *   apps/<slug>/niche/searches/photo.<kw>.p<N>.json   TikHub fetch_search_photo pages
 *                                                     (item_list[], slides in imagePost.images)
 *   apps/<slug>/niche/searches/general.<kw>[.<variant>].p<N>.json
 *                                                     TikHub fetch_general_search_result pages
 *                                                     (data[].aweme_info), window GENERAL
 *   apps/<slug>/niche/searches/<kw>.<RANGE>.json      the apidojo keyword search array
 *   research/<slug>/searches/<slug>.<RANGE>.json      the R1 keyword searches apps.sh writes
 *   apps/<slug>/niche/instagram/searches/hashtag.<kw>.<top|recent>.p<N>.json
 *                                                     TikHub Instagram fetch_hashtag_posts pages
 *                                                     (output.data.items[]), windows IG_TOP, IG_RECENT
 * Covers under apps/<slug>/niche/covers/<id>.jpg (TikTok) and
 * niche/instagram/covers/<id>.jpg (Instagram) are served by /media;
 * scripts/niche-import.sh fetches them. A post found by two searches is one post
 * with both names on it (the page merges). The Instagram pages hold raw control
 * characters inside strings, so every file is read leniently (lib/niche-posts.ts).
 *
 *   node scripts/build-niche.mjs [--verbose]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generalItems, generalPost, igItems, igPost, lenientJson } from "../lib/niche-posts.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ATLAS = resolve(HERE, "..");
const ROOT = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(ATLAS, "..");
const APPS = join(ROOT, "apps");
const RESEARCH = join(ROOT, "research");
const verbose = process.argv.includes("--verbose");

const readJson = (p) => { try { return lenientJson(readFileSync(p, "utf8")); } catch { return null; } };
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => join(dir, f)) : []);

function build(slug) {
  const nicheDir = join(APPS, slug, "niche");
  /* A cover on disk, by platform: TikTok's in niche/covers/, Instagram's in niche/instagram/covers/. */
  const coverUrl = (id, platform = "tiktok") => {
    const rel = platform === "instagram" ? `instagram/covers/${id}.jpg` : `covers/${id}.jpg`;
    return existsSync(join(nicheDir, rel)) ? `/media/apps/${slug}/niche/${rel}` : null;
  };
  const igFiles = listJson(join(nicheDir, "instagram", "searches")).filter((f) => /\/hashtag\.[^/]+\.json$/.test(f));
  const files = [...listJson(join(nicheDir, "searches")), ...listJson(join(RESEARCH, slug, "searches"))];
  if (!files.length && !igFiles.length) return null;
  const posts = [];
  const notes = [];

  /* The Photo tab pages, grouped by keyword and de-duplicated across pages. */
  const photoByKw = new Map();
  for (const file of files.filter((f) => /\/photo\./.test(f))) {
    const kw = file.split("/").pop().split(".")[1];
    const res = readJson(file);
    if (!res) { notes.push(`${file.split("/").pop()}: not JSON`); continue; }
    const list = photoByKw.get(kw) ?? new Map();
    for (const it of res.item_list ?? []) if (it?.id && !list.has(it.id)) list.set(it.id, it);
    photoByKw.set(kw, list);
  }
  for (const [keyword, list] of photoByKw) {
    for (const it of list.values()) {
      const images = it.imagePost?.images ?? [];
      const s = it.statsV2 ?? {};
      const n = (k) => Number(s[k] ?? it.stats?.[k] ?? 0);
      const views = n("playCount"), saves = n("collectCount");
      const handle = it.author?.uniqueId ?? "";
      const local = coverUrl(it.id);
      posts.push({ id: it.id, keyword, window: "PHOTO_TAB", handle, mediaType: "slideshow", slideCount: images.length, views, likes: n("diggCount"), comments: n("commentCount"), saves, shares: n("shareCount"), saveRate: views > 0 ? saves / views : 0, date: new Date((it.createTime ?? 0) * 1000).toISOString().slice(0, 10), caption: (it.desc ?? "").replace(/\s+/g, " ").trim(), cover: local ?? images[0]?.imageURL?.urlList?.[0] ?? it.imagePost?.cover?.imageURL?.urlList?.[0] ?? null, coverLocal: !!local, url: `https://www.tiktok.com/@${handle}/photo/${it.id}` });
    }
  }

  /* The general search pages, grouped by keyword; a post on two pages keeps the row with the most views. */
  const generalByKw = new Map();
  for (const file of files.filter((f) => /\/general\./.test(f))) {
    const kw = file.split("/").pop().split(".")[1];
    const res = readJson(file);
    if (!res) { notes.push(`${file.split("/").pop()}: not JSON`); continue; }
    const list = generalByKw.get(kw) ?? new Map();
    for (const a of generalItems(res)) {
      const p = generalPost(a, kw);
      const prev = list.get(p.id);
      if (!prev || p.views > prev.views) list.set(p.id, p);
    }
    generalByKw.set(kw, list);
  }
  for (const list of generalByKw.values()) {
    for (const p of list.values()) {
      const local = coverUrl(p.id);
      posts.push({ ...p, cover: local ?? p.cover, coverLocal: !!local });
    }
  }

  /* The Instagram hashtag pages: hashtag.<kw>.<top|recent>.p<N>.json, de-duplicated per keyword and feed. */
  const igByKey = new Map();
  for (const file of igFiles) {
    const [, kw, feed] = file.split("/").pop().split(".");
    const res = readJson(file);
    if (!res) { notes.push(`instagram/${file.split("/").pop()}: not JSON`); continue; }
    const key = `${kw}\t${feed}`;
    const list = igByKey.get(key) ?? new Map();
    for (const it of igItems(res)) {
      const p = igPost(it, kw, `IG_${String(feed).toUpperCase()}`);
      if (p && !list.has(p.id)) list.set(p.id, p);
    }
    igByKey.set(key, list);
  }
  for (const list of igByKey.values()) {
    for (const p of list.values()) {
      const local = coverUrl(p.id, "instagram");
      posts.push({ ...p, cover: local ?? p.cover, coverLocal: !!local });
    }
  }

  /* The apidojo keyword files: <kw>.<RANGE>.json. In-file duplicates keep the row with the most views. */
  for (const file of files.filter((f) => !/\/(photo|general)\./.test(f))) {
    const [keyword, window] = file.split("/").pop().replace(/\.json$/, "").split(".");
    const rows = readJson(file);
    if (!Array.isArray(rows)) { notes.push(`${file.split("/").pop()}: not an array`); continue; }
    const byId = new Map();
    for (const r of rows) { if (!r?.id) continue; const prev = byId.get(r.id); if (!prev || (r.views ?? 0) > (prev.views ?? 0)) byId.set(r.id, r); }
    for (const r of byId.values()) {
      const images = Array.isArray(r.images) ? r.images : [];
      const slideshow = images.length > 0;
      const views = Number(r.views ?? 0), saves = Number(r.bookmarks ?? 0);
      const local = coverUrl(r.id);
      posts.push({ id: r.id, keyword, window: window ?? "SEARCH", handle: r.channel?.username ?? "", mediaType: slideshow ? "slideshow" : "video", slideCount: slideshow ? images.length : null, views, likes: Number(r.likes ?? 0), comments: Number(r.comments ?? 0), saves, shares: Number(r.shares ?? 0), saveRate: views > 0 ? saves / views : 0, date: (r.uploadedAtFormatted ?? "").slice(0, 10), caption: (r.title ?? "").replace(/\s+/g, " ").trim(), cover: local ?? (slideshow ? images[0]?.url : r.video?.cover) ?? null, coverLocal: !!local, url: r.postPage ?? (r.channel?.username ? `https://www.tiktok.com/@${r.channel.username}/${slideshow ? "photo" : "video"}/${r.id}` : "") });
    }
  }

  const key = (p) => `${p.platform ?? "tiktok"}:${p.id}`;
  const ids = new Set(posts.map(key));
  const slides = new Set(posts.filter((p) => p.mediaType === "slideshow").map(key));
  const platforms = {};
  for (const k of ids) { const pf = k.split(":")[0]; platforms[pf] = (platforms[pf] ?? 0) + 1; }
  const out = {
    builtAt: new Date().toISOString(),
    slug,
    files: files.length + igFiles.length,
    totals: { rows: posts.length, posts: ids.size, slideshows: slides.size, videos: ids.size - slides.size, handles: new Set(posts.map((p) => `${p.platform ?? "tiktok"}:${p.handle}`)).size, platforms },
    keywords: [...new Set(posts.map((p) => p.keyword))].sort(),
    windows: [...new Set(posts.map((p) => p.window))].sort(),
    posts,
    notes,
  };
  mkdirSync(join(ATLAS, "data"), { recursive: true });
  writeFileSync(join(ATLAS, "data", `niche-${slug}.json`), JSON.stringify(out, null, verbose ? 1 : 0));
  const split = Object.keys(platforms).length > 1 || platforms.instagram ? `; ${Object.entries(platforms).map(([pf, c]) => `${c} ${pf === "instagram" ? "Instagram" : "TikTok"}`).join(", ")}` : "";
  console.log(`niche ${slug}: ${out.files} files, ${out.totals.rows} rows, ${out.totals.posts} posts (${out.totals.slideshows} slideshows, ${out.totals.videos} videos${split}), ${out.totals.handles} handles → data/niche-${slug}.json`);
  for (const nte of notes) console.log(`  · ${nte}`);
  return out;
}

const slugs = new Set([
  ...(existsSync(APPS) ? readdirSync(APPS).filter((d) => !d.startsWith(".") && d !== "EXAMPLE") : []),
  ...(existsSync(RESEARCH) ? readdirSync(RESEARCH).filter((d) => !d.startsWith(".") && existsSync(join(RESEARCH, d, "searches"))) : []),
]);
let built = 0;
const kept = new Set();
for (const slug of [...slugs].sort()) if (build(slug)) { built++; kept.add(slug); }
if (!built) console.log("niche: no searches yet under apps/<slug>/niche/searches/ or research/<slug>/searches/ — the niche page opens at the niche phase");

/* A built file whose searches are gone is stale: the niche page must not count posts that no longer exist. */
const DATA = join(ATLAS, "data");
if (existsSync(DATA)) {
  for (const f of readdirSync(DATA)) {
    const m = f.match(/^niche-([\w.-]+)\.json$/);
    if (m && !kept.has(m[1])) {
      unlinkSync(join(DATA, f));
      console.log(`niche ${m[1]}: no searches any more — data/${f} removed`);
    }
  }
}
