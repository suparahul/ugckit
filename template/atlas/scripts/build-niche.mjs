#!/usr/bin/env node
/**
 * build-niche.mjs — one data/niche-<slug>.json per app, from the keyword
 * searches of the niche phase.
 *
 * Two shapes are read, both unchanged from the tools that write them:
 *   apps/<slug>/niche/searches/photo.<kw>.p<N>.json   TikHub fetch_search_photo pages
 *                                                     (item_list[], slides in imagePost.images)
 *   apps/<slug>/niche/searches/<kw>.<RANGE>.json      the apidojo keyword search array
 *   research/<slug>/searches/<slug>.<RANGE>.json      the R1 keyword searches apps.sh writes
 * Covers under apps/<slug>/niche/covers/<id>.jpg are served by /media. A post
 * found by two searches is one post with both names on it (the page merges).
 *
 *   node scripts/build-niche.mjs [--verbose]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ATLAS = resolve(HERE, "..");
const ROOT = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(ATLAS, "..");
const APPS = join(ROOT, "apps");
const RESEARCH = join(ROOT, "research");
const verbose = process.argv.includes("--verbose");

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const listJson = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => join(dir, f)) : []);

function build(slug) {
  const nicheDir = join(APPS, slug, "niche");
  const covers = join(nicheDir, "covers");
  const coverUrl = (id) => (existsSync(join(covers, `${id}.jpg`)) ? `/media/apps/${slug}/niche/covers/${id}.jpg` : null);
  const files = [...listJson(join(nicheDir, "searches")), ...listJson(join(RESEARCH, slug, "searches"))];
  if (!files.length) return null;
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

  /* The apidojo keyword files: <kw>.<RANGE>.json. In-file duplicates keep the row with the most views. */
  for (const file of files.filter((f) => !/\/photo\./.test(f))) {
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

  const ids = new Set(posts.map((p) => p.id));
  const slides = new Set(posts.filter((p) => p.mediaType === "slideshow").map((p) => p.id));
  const out = {
    builtAt: new Date().toISOString(),
    slug,
    files: files.length,
    totals: { rows: posts.length, posts: ids.size, slideshows: slides.size, videos: ids.size - slides.size, handles: new Set(posts.map((p) => p.handle)).size },
    keywords: [...new Set(posts.map((p) => p.keyword))].sort(),
    windows: [...new Set(posts.map((p) => p.window))].sort(),
    posts,
    notes,
  };
  mkdirSync(join(ATLAS, "data"), { recursive: true });
  writeFileSync(join(ATLAS, "data", `niche-${slug}.json`), JSON.stringify(out, null, verbose ? 1 : 0));
  console.log(`niche ${slug}: ${files.length} files, ${out.totals.rows} rows, ${out.totals.posts} posts (${out.totals.slideshows} slideshows, ${out.totals.videos} videos), ${out.totals.handles} handles → data/niche-${slug}.json`);
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
