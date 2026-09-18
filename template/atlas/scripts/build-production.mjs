/**
 * Builds data/production-<slug>.json for every app under apps/ from the
 * authored plan and deck files.
 *
 * The production pipeline reads two things the agent writes in markdown:
 *
 *   apps/<slug>/production/PLAN.md   one row per planned post (the "## Posts"
 *                          table; "The 42 posts" is an alias), the handle
 *                          blocks, and the head lines App:, App Store id:,
 *                          Posting zone:, Home zone:, Posting service:
 *   apps/<slug>/production/decks/<date>-<handle>.md   one deck file per handle
 *                          per day, with the slide-by-slide copy, prompts,
 *                          caption, and the anatomy parameter table. <handle>
 *                          is the short name the plan uses (the part before
 *                          the first dot).
 *
 * Nobody authors JSON. This script reads the markdown by its own conventions —
 * the H1 per post, the item table, `### Slide N — label`, the bold labels with a
 * fenced block or a sentence after them — and prints exactly what it found and
 * what it could not read, the way build-index.mjs does. A deck it cannot parse
 * is reported, never silently skipped, and a plan row without a deck is a
 * normal state ("no deck yet"), not an error.
 *
 * Decisions, uploads and outcomes are NOT here: they are the user's own and live
 * in ../production/ (see lib/production.ts). This file is the authored truth.
 *
 *   node scripts/build-production.mjs [--verbose]
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const REPO = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(process.cwd(), "..");
const APPS = join(REPO, "apps");
const INDEX_FILE = resolve(process.cwd(), "data", "index.json");
const verbose = process.argv.includes("--verbose");

/* Set per app by build(): the plan file, the decks, the scrolled batches the
   plan's sources are resolved against, the niche data, and the app's name. */
let SLUG = null, PLAN_FILE = null, DECKS_DIR = null, BATCH_DIRS = [], NICHE_FILE = null, APP_RE = null;

let notes = [];
const warn = (s) => notes.push(s);

/* ------------------------------------------------------------- helpers */

const strip = (s) => s.replace(/`/g, "").trim();
const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());
const isRow = (line) => /^\|/.test(line) && !/^\|\s*-{3,}/.test(line);

/** `@handle`, 1,201,654  →  { handle, views }.  `@handle` id, 294,999 views → { handle, id, views } */
function parseSource(s) {
  /* An exact TikTok URL wins: it carries the handle and the id. */
  const um = s.match(/https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)\/(?:photo|video)\/(\d{15,})/);
  const url = um ? um[0] : null;
  const hm = s.match(/@([\w.]+)/);
  if (!hm) return { raw: s, handle: null, id: null, views: null, url };
  const after = s.slice(hm.index + hm[0].length).replace(/https?:\/\/\S+/g, " ");
  const idm = um ? [um[2], um[2]] : after.match(/\b(\d{15,})\b/);
  const rest = idm ? after.replace(idm[0], " ") : after;
  const vm = rest.match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?[KM])/);
  let views = null;
  if (vm) {
    const v = vm[1].replace(/,/g, "");
    views = /K$/.test(v) ? Math.round(parseFloat(v) * 1e3) : /M$/.test(v) ? Math.round(parseFloat(v) * 1e6) : Number(v);
  }
  return { raw: s, handle: um ? um[1] : hm[1], id: idm ? idm[1] : null, views, url };
}

/**
 * Every source a plan row names, in order: "`@pelinclh` slide 2, 3,586,238;
 * skeleton `@strongermobile`, 41,840,708". The word before a handle is its role
 * (model when none): skeleton, structure, topic. A part with no handle is a
 * reference to a document, kept as text.
 */
function parseSources(raw) {
  const out = [];
  /* Parts split at ";". Inside a part, ", and" before a second handle ("topic `@tommy_purrs` slide 5 …, and
     `@chuchutama` fountain card, 182,263") is a second source with the same role. */
  /* Split at ";" outside parentheses only: a parenthetical note stays with its source. */
  const splitTop = (t) => { const out = []; let depth = 0, cur = ""; for (const ch of t) { if (ch === "(") depth++; if (ch === ")") depth = Math.max(0, depth - 1); if (ch === ";" && !depth) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()).filter(Boolean); };
  for (const group of splitTop(strip(raw.replace(/\*\*/g, "")))) {
   let groupRole = null;
   for (const part of group.split(/,?\s+and\s+(?=`?@)/)) {
    const hm = part.match(/@([\w.]+)/);
    if (!hm) { if (part.trim()) out.push({ role: "reference", handle: null, id: null, views: null, slide: null, text: part.trim() }); continue; }
    const before = part.slice(0, hm.index).trim().toLowerCase();
    const role = groupRole ?? (/skeleton/.test(before) ? "skeleton" : /topic/.test(before) ? "topic" : /structure|shape|tables/.test(before) ? "structure" : "model");
    groupRole ??= role;
    const one = parseSource(part.slice(hm.index));
    const sm = part.match(/slides?\s+(\d+)/i);
    out.push({ role, handle: one.handle, id: one.id, views: one.views, url: one.url, slide: sm ? Number(sm[1]) : null, text: part.trim().replace(/\s*https?:\/\/\S+/g, "").replace(/\(\s*\)/g, "").replace(/[,\s]+$/, "") });
   }
  }
  return out;
}

/* What the corpus holds about a source post: the scrolled batch (raw stats,
   slides on disk, the read notes), the niche scrape (cover, url), and the
   Atlas index (an account page, a post page). Looked up by handle, and by id
   or nearest view count when the plan gives no id. */
let batchRaw = null, batchNotes = null, niche = null, atlasIndex = null;
const batchUrl = (dir) => `/media/apps/${SLUG}/niche/batches/${basename(dir)}`;
const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const num = (v) => (v == null || v === "" ? null : Number(String(v).replace(/,/g, "")));

function batchNoteSections() {
  const sections = {};
  const table = [];
  let cur = null;
  const lines = BATCH_DIRS.flatMap((d) => (existsSync(join(d, "BATCH.md")) ? readFileSync(join(d, "BATCH.md"), "utf8").split("\n") : []));
  for (const l of lines) {
    /* The batch table: | @handle | id | date | views | likes | comments | shares | saves | slides | … | sound | */
    const t = l.match(/^\|\s*@([\w.]+)\s*\|\s*(\d{15,})\s*\|/);
    if (t) {
      const c = cells(l);
      table.push({ handle: t[1], id: t[2], date: c[2], views: num(c[3]), likes: num(c[4]), comments: num(c[5]), shares: num(c[6]), saves: num(c[7]), slideCount: num(c[8]), sound: c[12] || null });
      continue;
    }
    const m = l.match(/^###\s+\d+\.\s+@([\w.]+)\s+—\s+"([^"]+)"\s+—\s+(.+)$/);
    if (m) { cur = { handle: m[1], title: m[2], meta: m[3], bullets: [] }; (sections[m[1]] ||= []).push(cur); continue; }
    if (/^##\s/.test(l) || /^###\s/.test(l)) { cur = null; continue; }
    if (cur && /^- /.test(l)) cur.bullets.push(l.replace(/^- /, "").replace(/\*\*/g, "").trim());
    else if (cur && /^\s+\d+ "/.test(l) && cur.bullets.length) cur.bullets[cur.bullets.length - 1] += "\n" + l.trim();
  }
  return { sections, table };
}

function resolveSource(src) {
  if (!src.handle) return src;
  /* The batch's raw scrape, plus every profile scrape beside it (`<handle>.profile.raw.json`). */
  batchRaw ||= BATCH_DIRS.flatMap((dir) => [
    ...(readJson(join(dir, "posts.raw.json")) || []),
    ...readdirSync(dir).filter((f) => /\.profile\.raw\.json$/.test(f)).flatMap((f) => { const j = readJson(join(dir, f)); return Array.isArray(j) ? j : j?.items || []; }),
  ]);
  batchNotes ||= batchNoteSections();
  niche ||= readJson(NICHE_FILE);
  atlasIndex ||= readJson(INDEX_FILE);
  /* Nearest by view count, and only within 15% of the plan's figure: a post the
     corpus does not hold stays unresolved rather than borrowing its neighbour. */
  const near = (list, views) => {
    if (!list.length) return null;
    if (views == null) return list.length === 1 ? list[0] : null;
    const best = [...list].sort((a, b) => Math.abs(num(a.views) - views) - Math.abs(num(b.views) - views))[0];
    return Math.abs(num(best.views) - views) <= views * 0.15 ? best : null;
  };
  const r = { ...src, title: null, date: null, likes: null, comments: null, shares: null, saves: null, sound: null, caption: null, hashtags: [], slides: [], cover: null, url: src.url || null, atlas: null, account: null, notes: [], pattern: null };

  /* The scrolled batch: the richest read. The batch table names every post's
     id; the raw scrape adds caption and sound for the ones it holds. */
  const row = src.id ? batchNotes.table.find((p) => p.id === src.id) : near(batchNotes.table.filter((p) => p.handle === src.handle), src.views);
  if (row) { r.id = row.id; r.views = row.views; r.likes = row.likes; r.comments = row.comments; r.shares = row.shares; r.saves = row.saves; r.date = row.date; r.sound = row.sound; }
  const raw = r.id ? batchRaw.find((p) => p.id === r.id) : near(batchRaw.filter((p) => p.channel && p.channel.username === src.handle), src.views);
  if (raw) {
    r.id = raw.id; r.title = raw.title || null; r.views = num(raw.views); r.likes = num(raw.likes); r.comments = num(raw.comments);
    r.shares = num(raw.shares); r.saves = num(raw.bookmarks); r.date = raw.uploadedAtFormatted ? raw.uploadedAtFormatted.slice(0, 10) : null;
    r.sound = raw.song ? [raw.song.title, raw.song.artist].filter(Boolean).join(" — ") : null;
    r.caption = raw.title || null; r.hashtags = Array.isArray(raw.hashtags) ? raw.hashtags : [];
    const postUrl = (u) => (u && /\/(photo|video)\/\d+/.test(u) ? u : null);
    r.url ||= postUrl(raw.postPage) || postUrl(raw.inputSource) || null;
  }
  if (r.id) {
    for (const b of BATCH_DIRS) {
      const dir = join(b, src.handle, r.id);
      if (existsSync(dir)) { r.slides = readdirSync(dir).filter((f) => /^slide-\d+\.(jpg|jpeg|png|webp)$/i.test(f)).sort().map((f) => `${batchUrl(b)}/${src.handle}/${r.id}/${f}`); break; }
    }
  }
  const secs = batchNotes.sections[src.handle] || [];
  /* The section header carries the views rounded ("3.59M views", "760K views"); match the resolved post's count the same way. */
  const short = (v) => (v == null ? null : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v));
  const sec = r.id ? secs.find((x) => x.id === r.id || (r.views && x.meta.includes(`${short(r.views)} views`))) || (secs.length === 1 ? secs[0] : null) : null;
  if (sec) {
    r.title ||= sec.title; r.notes = sec.bullets;
    const pat = sec.bullets.find((b) => /^Pattern:/.test(b));
    r.pattern = pat ? pat.replace(/^Pattern:\s*/, "") : null;
  }

  /* The niche scrape: a cover and a url when the batch has none. */
  if (niche && Array.isArray(niche.posts)) {
    const np = r.id ? niche.posts.find((p) => p.id === r.id) : near(niche.posts.filter((p) => p.handle === src.handle), src.views);
    if (np) { r.id ||= np.id; r.cover ||= np.coverLocal ? np.cover : null; r.url ||= np.url || null; r.views ??= num(np.views); r.date ||= np.date || null; r.caption ||= np.caption || null; }
  }

  /* The Atlas index: brand accounts with their own post pages. */
  if (atlasIndex && Array.isArray(atlasIndex.brands)) {
    for (const b of atlasIndex.brands) for (const a of b.accounts) {
      if (a.handle.replace(/^@/, "") !== src.handle) continue;
      r.account = `/account/${src.handle}`;
      const ap = r.id ? a.posts.find((p) => p.id === r.id) : near(a.posts, src.views);
      if (ap) {
        r.id ||= ap.id; r.atlas = `/post/${ap.id}`; r.views ??= num(ap.views); r.likes ??= num(ap.likes); r.comments ??= num(ap.comments);
        r.shares ??= num(ap.shares); r.saves ??= num(ap.bookmarks); r.date ||= ap.date || null; r.caption ||= ap.caption || null;
        r.sound ||= ap.sound || null; r.url ||= ap.url || null;
        if (!r.slides.length && Array.isArray(ap.slides) && ap.slides.length) r.slides = ap.slides;
        if (!r.cover && ap.cover && ap.cover !== "None") r.cover = ap.cover;
        if (ap.onScreen && ap.onScreen !== "None" && !r.notes.length) r.notes = [`On screen: ${ap.onScreen.replace(/\*\*/g, "")}`];
      }
    }
  }
  if (r.id && !r.url) r.url = `https://www.tiktok.com/@${src.handle}/photo/${r.id}`;
  if (!r.id) warn(`plan: source @${src.handle} (${src.role}, ${src.views ?? "no views"}) is not in the corpus — no post matched`);
  else if (!r.slides.length && !r.cover) warn(`plan: source @${src.handle} (${src.role}) has no slides or cover in the corpus`);
  return r;
}

/**
 * The idea a plan row carries, beyond its topic: the handle's format lock (the
 * premise every post on the handle shares), the product slot, the feature card
 * named in the arm ("<App> middle (Routine, task row)") or in the lock ("the
 * CatGPT answer card"), and the handle rows that say where the line comes from.
 * Today these come from the plan's handle blocks; the Atlas will write them
 * directly when plans are made inside it.
 */
function ideaOf(arm, h, slotKey) {
  const params = h ? h.params : {};
  const lock = params["Format lock"] || null;
  const paren = arm.match(/\(([^)]+)\)/);
  let feature = paren ? paren[1].trim() : null;
  /* "… + App Store card + a Learning Defining Behaviour card": the last named card. */
  if (!feature) { const cm = arm.match(/\+\s*(?:a|an|the)\s+([^+]*?\bcard)\s*$/i); feature = cm ? cm[1].trim() : null; }
  if (!feature && lock) { const fm = lock.match(/the ([A-Z][\w]* [\w ]*?card)/); feature = fm ? fm[1] : null; }
  const skip = /^(Format lock|Bio|Sound|Cadence|Caption|Images|Product slot|Last-slide ask|Identity)$/;
  const reasons = Object.entries(params).filter(([k]) => !skip.test(k)).map(([k, v]) => ({ label: k, text: v }));
  const answer = h?.answers?.[slotKey] ?? null;
  return { premise: lock, product: params["Product slot"] || null, feature, reasons, experiments: h ? h.experiments : [], answer, record: answer && h.record.length ? h.record : null };
}

/* ---------------------------------------------------------------- plan */

function readPlan() {
  if (!existsSync(PLAN_FILE)) {
    warn(`plan: ${PLAN_FILE} not found`);
    return { title: null, range: null, app: null, slug: null, handles: {}, rows: [], tasks: {}, rules: [] };
  }
  const text = readFileSync(PLAN_FILE, "utf8");
  const lines = text.split("\n");

  /* The app this plan produces for. An explicit `App: Name` line wins; else the
     bio instruction "Search <Name> in the App Store" names it. */
  const appLine = text.match(/^\**App:?\**:?\s*([A-Z][\w.-]*)/m);
  const appBio = text.match(/Search ([A-Z][\w.-]*) in the App Store/);
  const app = appLine ? appLine[1] : appBio ? appBio[1] : null;
  APP_RE = app ? new RegExp(`\\b${app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") : null;
  /* The head lines of 02-ATLAS-PORT-PLAN.md § 6: the store id, the two zones, the posting service. */
  const headLine = (name) => { const m = text.match(new RegExp(`^\\**${name}\\**:\\**\\s*(.+?)\\s*$`, "mi")); return m ? m[1].replace(/`/g, "").trim() : null; };
  const appStoreId = headLine("App Store id");
  const zones = { posting: headLine("Posting zone"), home: headLine("Home zone") };
  const service = (headLine("Posting service") || "postbridge").toLowerCase();
  if (!app) warn("plan: no `App: Name` line; the checks that name the app are skipped");

  const title = (lines.find((l) => l.startsWith("# ")) || "").replace(/^#\s*/, "");
  const range = title.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  const year = range ? range[1].slice(0, 4) : String(new Date().getFullYear());

  /* Handle blocks: `### \`@example.one\` — main persona` → short name "example". */
  const handles = {};
  let curHandle = null, table = null;
  const clean = (t) => strip(t.replace(/\*\*/g, "")).replace(/\s+/g, " ");
  for (const l of lines) {
    const m = l.match(/^###\s+`@([\w.]+)`\s+—\s+(.+)$/);
    if (m) {
      const short = m[1].split(".")[0];
      /* A handle may have more than one block (the identity options are a second one); merge, never overwrite. */
      handles[short] ??= { handle: `@${m[1]}`, short, role: m[2].trim(), params: {}, experiments: [], record: [], answers: {} };
      curHandle = handles[short]; table = null; continue;
    }
    if (/^##\s/.test(l)) { curHandle = null; table = null; continue; }
    if (!curHandle) continue;
    /* The parameter table (Parameter | Fixed value | Source) and the experiments
       table (Experiment | What changes | Schedule) under each handle block. */
    if (/^\|\s*Parameter\s*\|/.test(l)) { table = "params"; continue; }
    if (/^\|\s*Experiment\s*\|/.test(l)) { table = "experiments"; continue; }
    /* The brand handle's demo-cat record (Field | Value in the record) and the
       per-slot CatGPT answers (Day / slot | Slide 1 worry | Slide 2 answer, lines split at " / "). */
    if (/^\|\s*Field\s*\|/.test(l)) { table = "record"; continue; }
    if (/^\|\s*Day \/ slot\s*\|/.test(l)) { table = "answers"; continue; }
    if (!isRow(l)) { if (!/^\|/.test(l)) table = null; continue; }
    const c = cells(l);
    if (table === "params" && c.length >= 2) curHandle.params[clean(c[0])] = clean(c[1]);
    if (table === "experiments" && c.length >= 3) curHandle.experiments.push({ name: clean(c[0]), what: clean(c[1]), schedule: clean(c[2]) });
    if (table === "record" && c.length >= 2) curHandle.record.push({ field: clean(c[0]), value: clean(c[1]) });
    if (table === "answers" && c.length >= 3) {
      const k = clean(c[0]).match(/^(\d+)\s*(AM|PM)$/i);
      if (k) curHandle.answers[`${k[1]} ${k[2].toUpperCase()}`] = { worry: clean(c[1]).replace(/^"|"$/g, ""), lines: clean(c[2]).split(/\s\/\s/).map((x) => x.trim()).filter(Boolean) };
    }
  }

  /* Standing rules: the paragraph beginning "Rules that hold on every post:". */
  const rules = [];
  const ruleLine = lines.find((l) => /^Rules that hold on every post:/.test(l));
  if (ruleLine) {
    for (const part of ruleLine.replace(/^Rules that hold on every post:\s*/, "").split(/;\s*/)) {
      const clean = part.replace(/\([^)]*\)/g, "").replace(/`([^`]*)`/g, "$1").replace(/\s+/g, " ").replace(/\.$/, "").trim();
      if (clean) rules.push(clean);
    }
  }

  /* The posts table: the first table whose header starts with | Day | Date |. */
  const rows = [];
  let inTable = false;
  for (const l of lines) {
    if (/^\|\s*Day\s*\|\s*Date\s*\|/.test(l)) { inTable = true; continue; }
    if (inTable) {
      if (!isRow(l)) { if (rows.length) break; continue; }
      const c = cells(l);
      if (c.length < 8) continue;
      const [day, md, short, slot, topic, format, arm, source] = c;
      const h = handles[short];
      if (!h) warn(`plan: row for unknown handle "${short}" (${md} ${slot})`);
      const date = `${year}-${md}`;
      /* A handle may post any number of times a day: n is the post's order in
         the day for that handle, and the slot word (AM, PM, a time) is a label. */
      const n = rows.filter((r) => r.date === date && r.short === short).length + 1;
      rows.push({
        slug: SLUG,
        key: `${date}/${short}/${n}`,
        n,
        day: Number(day),
        date,
        short,
        handle: h ? h.handle : `@${short}`,
        role: h ? h.role : null,
        slot: slot.toUpperCase(),
        topic: strip(topic),
        format: strip(format.replace(/\*\*/g, "")),
        arm: strip(arm),
        source: parseSource(source),
        sourceRaw: strip(source.replace(/\*\*/g, "")),
        sources: parseSources(source).map(resolveSource),
        idea: ideaOf(strip(arm), h, `${Number(day)} ${slot.toUpperCase()}`),
      });
    }
  }

  /* Day tasks: in "## Today — <date>", the paragraph "Before the first post: a; b." */
  const tasks = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## Today — (\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    for (let j = i + 1; j < lines.length && !lines[j].startsWith("## "); j++) {
      const t = lines[j].match(/^Before the first post:\s*(.+)$/);
      if (t) {
        tasks[m[1]] = t[1].replace(/\.$/, "").split(/;\s*/).map((s) => strip(s.replace(/\*\*/g, "")));
      }
    }
  }

  return { title, range: range ? { from: range[1], to: range[2] } : null, app, slug: SLUG, appStoreId, zones, service, handles, rows, tasks, rules };
}

/* ---------------------------------------------------------------- decks */

/** Placement words → where the HTML overlay sits in the 9:16 frame. */
function placeOf(...texts) {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/upper third|top/.test(t)) return "top";
  if (/lower third|bottom/.test(t)) return "bottom";
  if (/middle|centred|centered|centre|center/.test(t)) return "middle";
  return "flow";
}
function sizeOf(...texts) {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (/\bbig\b|medium-big|large/.test(t)) return "big";
  if (/\bmedium\b/.test(t)) return "medium";
  return "small";
}

/**
 * One slide section: the lines between `### Slide N — label` and the next `###`
 * or `##`. Bold labels introduce blocks; each block's text is the fenced code
 * after it, the inline text after the colon, or the paragraph lines that
 * follow.
 */
function parseSlide(heading, body, postTextSize) {
  const hm = heading.match(/^###\s+Slide\s+(\d+)\s*—\s*(.+)$/);
  const n = hm ? Number(hm[1]) : null;
  const label = hm ? hm[2].trim() : heading.replace(/^#+\s*/, "");
  const slide = {
    n,
    label,
    isProduct: APP_RE ? APP_RE.test(label) : /\bproduct\b|\bcallout\b/i.test(label),
    blocks: [],
    prompt: null,
    position: null,
    why: null,
    cards: [],
  };

  let i = 0;
  while (i < body.length) {
    const line = body[i];
    const bm = line.match(/^\*\*([^*]+?)\*\*(.*)$/);
    if (!bm) { i++; continue; }
    const rawLabel = bm[1].replace(/[.:]\s*$/, "").trim();
    let rest = bm[2].replace(/^:\s*/, "").trim();
    // "**On-image text** (one block, centred, lower third):"
    let paren = null;
    const pm = rest.match(/^\(([^)]*)\)\s*:?\s*(.*)$/);
    if (pm) { paren = pm[1]; rest = pm[2].trim(); }
    let text = rest;
    i++;
    if (!text) {
      // fenced block?
      while (i < body.length && body[i].trim() === "") i++;
      if (i < body.length && /^```/.test(body[i])) {
        i++;
        const buf = [];
        while (i < body.length && !/^```/.test(body[i])) buf.push(body[i++]);
        i++;
        text = buf.join("\n").trimEnd();
      } else if (/^cards/i.test(rawLabel)) {
        const items = [];
        while (i < body.length && /^\d+\.\s/.test(body[i])) items.push(body[i++].replace(/^\d+\.\s*/, "").trim());
        slide.cards = items;
        continue;
      } else {
        const buf = [];
        while (i < body.length && body[i].trim() !== "" && !/^\*\*/.test(body[i]) && !/^#/.test(body[i])) buf.push(body[i++]);
        text = buf.join(" ").trim();
      }
    } else if (/^cards/i.test(rawLabel)) {
      const items = [];
      while (i < body.length && body[i].trim() === "") i++;
      while (i < body.length && /^\d+\.\s/.test(body[i])) items.push(body[i++].replace(/^\d+\.\s*/, "").trim());
      slide.cards = items;
      continue;
    }
    text = strip(text).replace(/^`|`$/g, "");

    if (/^image prompt/i.test(rawLabel)) {
      slide.prompt = text.replace(/^\[style prefix\]\s*/i, "");
    } else if (/^position and size/i.test(rawLabel)) {
      slide.position = text;
    } else if (/^why this slide/i.test(rawLabel)) {
      slide.why = text;
    } else if (/^cards/i.test(rawLabel)) {
      /* handled above */
    } else {
      slide.blocks.push({ label: rawLabel, hint: paren, text });
    }
  }

  /* Placement and size per block, from the block's own words first, then the
   * slide's position sentence. The hook slide is the one with big type. */
  for (const b of slide.blocks) {
    const own = `${b.label} ${b.hint || ""}`;
    /* The callout sentence sits directly above the product callout, in the lower third the prompt reserves. */
    let place = /above the cards?/i.test(own) ? "bottom" : placeOf(own);
    if (place === "flow") place = placeOf(slide.position);
    if (place === "flow" && slide.blocks.length === 1) place = "middle";
    b.place = place;
    /* Size: the block's own words, then the phrase of the slide's position
     * sentence or the post's "Text size" row that names this kind of block
     * (title, paragraph, headline), then the whole sentence for a lone block. */
    const kind = (own.match(/title|paragraph|headline|hook|mention|bullet/i) || [""])[0].toLowerCase();
    const phrases = `${slide.position || ""}; ${postTextSize || ""}`.split(/[;.]\s*/);
    const named = kind ? phrases.find((ph) => new RegExp(kind, "i").test(ph)) : null;
    b.size = sizeOf(own);
    if (b.size === "small" && named) b.size = sizeOf(named);
    if (b.size === "small" && slide.blocks.length === 1) b.size = sizeOf(slide.position);
    b.box = /box/i.test(own) || /\bbox\b/i.test(slide.position || "");
  }
  if (!slide.blocks.length) warn(`deck: slide ${n} "${label}" has no on-image text block`);
  if (!slide.prompt) warn(`deck: slide ${n} "${label}" has no image prompt`);
  return slide;
}

function sectionText(lines) {
  return lines
    .map((l) => l.replace(/^>\s?/, ""))
    .join("\n")
    .trim();
}

/** Parse one `# Post N — SLOT — "title"` section into a deck. */
function parsePost(heading, lines) {
  const hm = heading.match(/^#\s+Post\s+(\d+)\s*—\s*(AM|PM)\s*—\s*[“"](.+?)[”"]\s*$/);
  const post = {
    n: hm ? Number(hm[1]) : null,
    slot: hm ? hm[2] : null,
    title: hm ? hm[3] : heading.replace(/^#\s*/, ""),
    items: {},
    slides: [],
    caption: null,
    hashtags: [],
    ask: null,
    sound: null,
    mirror: null,
    anatomy: [],
    notes: [],
    dimension: "3:4",
    dimensionSet: false,
  };

  // Item table straight after the H1.
  let i = 0;
  while (i < lines.length && !isRow(lines[i]) && !lines[i].startsWith("#")) i++;
  while (i < lines.length && /^\|/.test(lines[i])) {
    if (isRow(lines[i])) {
      const [k, v] = cells(lines[i]);
      if (k && k !== "Item") post.items[k] = strip(v.replace(/\*\*/g, ""));
    }
    i++;
  }

  /* The slide dimension: a per-post parameter chosen before any picture is
   * made. "9:16" or "3:4" from the "Dimension" row; 3:4 when the row is
   * absent (decks written from 2026-09-17 on; 9:16 was the default through
   * 2026-09-16), and the check on the post page says so. */
  const dimRaw = post.items.Dimension ?? null;
  post.dimension = dimRaw && /^9\s*:\s*16\b/.test(dimRaw) ? "9:16" : "3:4";
  post.dimensionSet = dimRaw !== null && /^(9\s*:\s*16|3\s*:\s*4)\b/.test(dimRaw);
  if (dimRaw !== null && !post.dimensionSet) console.warn(`  ${post.title}: Dimension row "${dimRaw}" is not 9:16 or 3:4; using 3:4`);

  // Sections by ## and ### headings.
  const sections = [];
  let cur = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l) || /^###\s/.test(l)) {
      cur = { heading: l, body: [] };
      sections.push(cur);
    } else if (cur) cur.body.push(l);
  }

  for (const s of sections) {
    const h = s.heading;
    if (/^###\s+Slide\s+\d+/.test(h)) {
      post.slides.push(parseSlide(h, s.body, post.items["Text size"]));
    } else if (/^##\s+Caption/.test(h)) {
      const cap = sectionText(s.body);
      post.caption = cap;
      post.hashtags = (cap.match(/#[\w]+/g) || []);
    } else if (/^##\s+Last-slide ask/.test(h)) {
      post.ask = sectionText(s.body);
    } else if (/^##\s+Sound/.test(h)) {
      post.sound = sectionText(s.body);
    } else if (/^##\s+Lines that change/.test(h)) {
      const rows = s.body.filter(isRow).map(cells).filter((c) => c.length >= 3 && c[0] !== "Slide");
      post.mirror = { title: h.replace(/^##\s+/, ""), intro: s.body.filter((l) => l && !/^\|/.test(l)).join(" ").trim(), rows: rows.map((c) => ({ slide: c[0], from: strip(c[1]), to: strip(c[2]) })) };
    } else if (/^##\s+Anatomy parameters/.test(h)) {
      post.anatomy = s.body.filter(isRow).map(cells).filter((c) => c.length >= 2 && c[0] !== "Column").map(([k, v]) => ({ column: k, value: strip(v) }));
      const tags = s.body.find((l) => /^Experiment tags:/.test(l));
      if (tags) post.experimentTags = strip(tags.replace(/^Experiment tags:\s*/, "").replace(/\.$/, ""));
    } else if (/^##\s+Slides/.test(h)) {
      /* container heading */
    } else if (/^##\s/.test(h)) {
      post.notes.push({ title: h.replace(/^##\s+/, ""), text: sectionText(s.body) });
    }
  }

  const src = post.items.Source ? parseSource(post.items.Source) : null;
  post.source = src;
  post.sourceSlides = [];
  if (src && src.handle && src.id) {
    const b = BATCH_DIRS.find((d) => existsSync(join(d, src.handle, src.id)));
    if (b) {
      post.sourceSlides = readdirSync(join(b, src.handle, src.id))
        .filter((f) => /^slide-\d+\.(jpg|jpeg|png|webp)$/i.test(f))
        .sort()
        .map((f) => `${batchUrl(b).replace(/^\/media\//, "")}/${src.handle}/${src.id}/${f}`);
    } else {
      warn(`deck: source slides for @${src.handle} ${src.id} not on disk`);
    }
  }
  return post;
}

function readDeck(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const fm = basename(file).match(/^(\d{4}-\d{2}-\d{2})-([\w.-]+)\.md$/);
  if (!fm) { warn(`deck: ${basename(file)} is not named <date>-<handle>.md; skipped`); return null; }
  const [, date, short] = fm;

  const titleLine = lines.find((l) => l.startsWith("# ")) || "";
  const hm = titleLine.match(/`@([\w.]+)`/);
  const handle = hm ? `@${hm[1]}` : null;

  /* File-level sections before the first `# Post`: bio, rules, style prefix. */
  const firstPost = lines.findIndex((l) => /^#\s+Post\s+\d+/.test(l));
  const head = lines.slice(0, firstPost < 0 ? lines.length : firstPost);

  const deck = {
    file: `apps/${SLUG}/production/decks/${basename(file)}`,
    date,
    short,
    handle,
    intro: head.filter((l, idx) => idx > 0 && !l.startsWith("#") && !/^>/.test(l) && !/^-/.test(l) && l.trim()).slice(0, 2).join(" "),
    bio: null,
    rules: [],
    stylePrefix: null,
    styleNotes: [],
    posts: [],
    hash: createHash("sha1").update(text).digest("hex").slice(0, 12),
  };

  let sec = null;
  for (const l of head) {
    if (/^##\s/.test(l)) { sec = l.replace(/^##\s+/, ""); continue; }
    if (!sec) continue;
    if (/^Bio/i.test(sec) && /^>\s?/.test(l)) deck.bio = deck.bio ?? strip(l.replace(/^>\s?/, ""));
    else if (/^Rules that hold/i.test(sec) && /^-\s/.test(l)) deck.rules.push(strip(l.replace(/^-\s*/, "")));
    else if (/visual style/i.test(sec)) {
      const sm = l.match(/^>\s*\*\*Style prefix:\*\*\s*(.+)$/);
      if (sm) deck.stylePrefix = sm[1].trim();
      else if (l.trim() && !/^>/.test(l)) deck.styleNotes.push(l.trim());
    }
  }
  if (!deck.stylePrefix) warn(`deck: ${basename(file)} has no style prefix`);

  /* Posts: split on `# Post N` H1s. */
  let cur = null;
  for (let i = firstPost; i >= 0 && i < lines.length; i++) {
    const l = lines[i];
    if (/^#\s+Post\s+\d+/.test(l)) {
      if (cur) deck.posts.push(parsePost(cur.heading, cur.body));
      cur = { heading: l, body: [] };
    } else if (cur && l.trim() !== "---") cur.body.push(l);
  }
  if (cur) deck.posts.push(parsePost(cur.heading, cur.body));

  for (const p of deck.posts) {
    if (!p.slot) warn(`deck: ${basename(file)} post ${p.n} has no slot word in its heading`);
    const row = plan.rows.find((r) => r.date === date && r.short === short && r.slot === (p.slot || "").toUpperCase());
    if (!row) warn(`deck: ${basename(file)} post ${p.n} (${p.slot}) matches no plan row`);
    p.key = row ? row.key : `${date}/${short}/${p.n}`;
    p.hash = createHash("sha1").update(JSON.stringify({ s: p.slides, c: p.caption, a: p.ask })).digest("hex").slice(0, 12);
  }
  return deck;
}

/* ---------------------------------------------------------------- write */

let plan = null;

function build(slug) {
  SLUG = slug;
  const prod = join(APPS, slug, "production");
  PLAN_FILE = join(prod, "PLAN.md");
  DECKS_DIR = join(prod, "decks");
  const batches = join(APPS, slug, "niche", "batches");
  BATCH_DIRS = existsSync(batches) ? readdirSync(batches).filter((d) => !d.startsWith(".")).sort().map((d) => join(batches, d)).filter((d) => statSync(d).isDirectory()) : [];
  NICHE_FILE = resolve(process.cwd(), "data", `niche-${slug}.json`);
  notes = []; batchRaw = null; batchNotes = null; niche = null; atlasIndex = null; APP_RE = null;
  const OUT = resolve(process.cwd(), "data", `production-${slug}.json`);

  plan = readPlan();
  const deckFiles = existsSync(DECKS_DIR) ? readdirSync(DECKS_DIR).filter((f) => f.endsWith(".md") && !/^EXAMPLE/i.test(f)).sort() : [];
  const decks = deckFiles.map((f) => readDeck(join(DECKS_DIR, f))).filter(Boolean);

  const deckByKey = {};
  for (const d of decks) for (const p of d.posts) {
    if (deckByKey[p.key]) warn(`deck: two decks claim ${p.key} (${deckByKey[p.key].file} and ${d.file})`);
    deckByKey[p.key] = { file: d.file, deckHash: d.hash, postHash: p.hash };
    if (!plan.rows.find((r) => r.key === p.key)) warn(`deck: ${d.file} post ${p.n} (${p.key}) has no plan row`);
  }

  const out = {
    generatedAt: new Date().toISOString(),
    plan: { title: plan.title, range: plan.range, app: plan.app, slug, appStoreId: plan.appStoreId, service: plan.service, zones: plan.zones, handles: plan.handles, rules: plan.rules, tasks: plan.tasks },
    rows: plan.rows,
    decks,
    notes,
  };
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, verbose ? 2 : 0) + "\n");

  const withDeck = plan.rows.filter((r) => deckByKey[r.key]).length;
  console.log(`production ${slug}: ${plan.rows.length} plan rows, ${decks.length} deck file(s), ${withDeck} row(s) with a deck → data/production-${slug}.json`);
  for (const n of notes) console.log(`  · ${n}`);
  if (verbose) for (const d of decks) for (const p of d.posts) console.log(`  ${p.key}: ${p.slides.length} slides, ${p.sourceSlides.length} source slides, caption ${p.caption ? "yes" : "no"}`);
}

const slugs = existsSync(APPS) ? readdirSync(APPS).filter((d) => !d.startsWith(".") && d !== "EXAMPLE" && existsSync(join(APPS, d, "production", "PLAN.md"))).sort() : [];
if (!slugs.length) console.log(`production: no apps/<slug>/production/PLAN.md yet — the studio opens at the app fit and plan phase`);
for (const slug of slugs) build(slug);

/* A built file whose plan is gone is stale: the studio must not show a week that no longer exists. */
const DATA = resolve(process.cwd(), "data");
if (existsSync(DATA)) {
  for (const f of readdirSync(DATA)) {
    const m = f.match(/^production-([\w.-]+)\.json$/);
    if (m && !slugs.includes(m[1])) {
      unlinkSync(join(DATA, f));
      console.log(`production ${m[1]}: no PLAN.md any more — data/${f} removed`);
    }
  }
}
