/**
 * The niche of an app: apps/<slug>/niche/. Two parts are read here.
 *
 *   The searches: data/niche-<slug>.json, built by scripts/build-niche.mjs
 *   from niche/searches/ (the Photo tab pages and the apidojo keyword files).
 *   The batches: niche/batches/<date>/, what you brought from your own scroll
 *   and the agent pulled through Monid — LINKS.md (verbatim), posts.raw.json,
 *   <handle>/<id>/slide-NN.jpg, BATCH.md (the read). Read live.
 *
 * The findings trio (learnings.md, anatomy.md, architecture.md) is read by
 * the niche page itself, section by section.
 */

import { join } from "node:path";

import { appDir, exists, listDirs, listFiles, mtimeOf, readJson, readText, tableOf } from "./root";

export type NichePost = {
  id: string;
  keyword: string;
  window: string;
  handle: string;
  mediaType: "slideshow" | "video";
  slideCount: number | null;
  views: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  saveRate: number;
  date: string;
  caption: string;
  /** A /media URL when the cover is held on disk. */
  cover: string | null;
  coverLocal: boolean;
  url: string;
};

export type NicheData = {
  builtAt: string;
  slug: string;
  files: number;
  totals: { rows: number; posts: number; slideshows: number; videos: number; handles: number };
  keywords: string[];
  windows: string[];
  posts: NichePost[];
  notes?: string[];
};

const cache = new Map<string, { at: number; data: NicheData }>();

export function getNiche(slug: string): NicheData | null {
  if (!/^[\w.-]+$/.test(slug)) return null;
  const p = join(process.cwd(), "data", `niche-${slug}.json`);
  const at = mtimeOf(p);
  if (!at) return null;
  const hit = cache.get(slug);
  if (hit && hit.at === at) return hit.data;
  const data = readJson<NicheData>(p);
  if (!data) return null;
  cache.set(slug, { at, data });
  return data;
}

/* --------------------------------------------------------------- batches */

export type BatchPost = {
  handle: string;
  id: string;
  date: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  slideCount: number;
  caption: string;
  sound: string | null;
  /** The slides on disk, as /media URLs. */
  slides: string[];
  url: string;
};

export type Batch = {
  date: string;
  dir: string;
  /** The lines of LINKS.md that carry a link or a handle, verbatim. */
  links: string[];
  /** BATCH.md exists: the agent read the posts. */
  read: boolean;
  posts: BatchPost[];
};

const num = (v: unknown) => Number(String(v ?? "0").replace(/,/g, "")) || 0;

function readBatch(slug: string, date: string): Batch {
  const dir = join(appDir(slug), "niche", "batches", date);
  const base = `/media/apps/${encodeURIComponent(slug)}/niche/batches/${encodeURIComponent(date)}`;
  const links = (readText(join(dir, "LINKS.md")) ?? "").split("\n").map((l) => l.trim()).filter((l) => /tiktok\.com|^@[\w.]+|^https?:\/\//.test(l) && !/^#/.test(l));
  const read = exists(join(dir, "BATCH.md"));
  type Raw = { id?: string; title?: string; views?: unknown; likes?: unknown; comments?: unknown; shares?: unknown; bookmarks?: unknown; uploadedAtFormatted?: string; song?: { title?: string; artist?: string } | null; channel?: { username?: string } | null; images?: unknown[]; inputSource?: string; postPage?: string };
  const raws: Raw[] = [];
  const rawFile = readJson<Raw[] | { items?: Raw[] }>(join(dir, "posts.raw.json"));
  if (Array.isArray(rawFile)) raws.push(...rawFile);
  for (const f of listFiles(dir).filter((f) => /\.profile\.raw\.json$/.test(f))) {
    const j = readJson<Raw[] | { items?: Raw[] }>(join(dir, f));
    raws.push(...(Array.isArray(j) ? j : j?.items ?? []));
  }
  const posts = new Map<string, BatchPost>();
  /* The BATCH.md table names every post that was read; the raw scrape adds the caption and the sound. */
  const table = read ? tableOf((readText(join(dir, "BATCH.md")) ?? "").split("\n").filter((l) => /^\|/.test(l)).join("\n")) : { head: [], rows: [] as string[][] };
  for (const r of table.rows) {
    const m = r[0]?.match(/@([\w.]+)/);
    const id = r[1]?.match(/\d{15,}/)?.[0];
    if (!m || !id) continue;
    posts.set(id, { handle: m[1], id, date: r[2] || null, views: num(r[3]), likes: num(r[4]), comments: num(r[5]), shares: num(r[6]), saves: num(r[7]), slideCount: num(r[8]), caption: "", sound: r[12] || null, slides: [], url: `https://www.tiktok.com/@${m[1]}/photo/${id}` });
  }
  for (const raw of raws) {
    if (!raw.id) continue;
    const handle = raw.channel?.username ?? raw.inputSource?.match(/@([\w.]+)/)?.[1] ?? "";
    const have = posts.get(raw.id);
    const p: BatchPost = have ?? { handle, id: raw.id, date: raw.uploadedAtFormatted?.slice(0, 10) ?? null, views: num(raw.views), likes: num(raw.likes), comments: num(raw.comments), shares: num(raw.shares), saves: num(raw.bookmarks), slideCount: Array.isArray(raw.images) ? raw.images.length : 0, caption: "", sound: null, slides: [], url: `https://www.tiktok.com/@${handle}/photo/${raw.id}` };
    p.caption ||= raw.title ?? "";
    p.sound ||= raw.song ? [raw.song.title, raw.song.artist].filter(Boolean).join(" — ") : null;
    if (!have && handle) posts.set(raw.id, p);
  }
  for (const p of posts.values()) {
    const d = join(dir, p.handle, p.id);
    if (exists(d)) {
      const files = listFiles(d).filter((f) => /^slide-\d+\.(jpe?g|png|webp)$/i.test(f)).sort();
      p.slides = files.map((f) => `${base}/${encodeURIComponent(p.handle)}/${p.id}/${f}`);
      if (!p.slideCount) p.slideCount = files.length;
    }
  }
  /* A batch with no table and no raw file: the folders themselves. */
  if (!posts.size) {
    for (const h of listDirs(dir)) for (const id of listDirs(join(dir, h))) {
      const files = listFiles(join(dir, h, id)).filter((f) => /^slide-\d+\.(jpe?g|png|webp)$/i.test(f)).sort();
      posts.set(id, { handle: h, id, date: null, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, slideCount: files.length, caption: "", sound: null, slides: files.map((f) => `${base}/${encodeURIComponent(h)}/${id}/${f}`), url: `https://www.tiktok.com/@${h}/photo/${id}` });
    }
  }
  /* The posts that were read (the table's rows, with slides on disk) first, newest first; the rest of a profile scrape after them. */
  const rank = (p: BatchPost) => (p.slides.length ? 0 : 1);
  return { date, dir, links, read, posts: [...posts.values()].sort((a, b) => rank(a) - rank(b) || (b.date ?? "").localeCompare(a.date ?? "")) };
}

/** Every batch, newest first. */
export function listBatches(slug: string): Batch[] {
  if (!/^[\w.-]+$/.test(slug)) return [];
  return listDirs(join(appDir(slug), "niche", "batches")).sort().reverse().map((d) => readBatch(slug, d));
}
