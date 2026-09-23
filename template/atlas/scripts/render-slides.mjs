/**
 * The compositor: finished PNGs for one post, text burned in, at the post's
 * slide dimension (the deck's "Dimension" row: 9:16 → 1080 × 1920, 3:4 →
 * 1080 × 1440; 3:4 when the row is absent).
 *
 *   node scripts/render-slides.mjs <app slug> 2026-09-16/example/2   one post
 *   node scripts/render-slides.mjs --date 2026-09-16            every post of the day whose pictures are all approved
 *   node scripts/render-slides.mjs <key> --force                render even when a picture is not approved (uses the current one)
 *   node scripts/render-slides.mjs <key> --slide5=<file>         draw slide 5 from <file> (a path under production/files, or absolute)
 *                                                                instead of the approved picture; any slide number works (--slide3=…).
 *                                                                For a one-off export; the log is not touched.
 *   node scripts/render-slides.mjs <key> --burn-cover            slide 1 WITH its text, for a direct (scheduled) post through
 *                                                                Post Bridge, where nobody types it in TikTok. The slide's text
 *                                                                flag reads "baked" for this render only; the log is not touched.
 *   node scripts/render-slides.mjs <key> --instagram             also the Instagram set, in final/instagram/ (below). The TikTok
 *                                                                set is written as always, with or without --burn-cover.
 *
 * A deck whose item table says `| Slide style | illustrated |` has its text drawn into the
 * picture by the image generator: no text layer on any slide, --burn-cover included; the
 * callout card is still pasted on the product slide. An absent row, or `photo`, is the path above.
 *
 * Writes to ../production/files/<post>/final/:
 *   slide-NN.png     the approved picture, cover-fitted to the canvas (a 9:16
 *                    picture on a 3:4 deck is centre-cropped, and the log line says so), with
 *                    the slide's text blocks drawn on it. Slide 1 (the cover)
 *                    gets no text: it is typed in the TikTok editor by hand.
 *   cover-text.txt   slide 1's text, to type by hand.
 *   caption.txt      the caption and the hashtags.
 *   instagram/       with --instagram: the same slides as JPEG at 4:5 (1080 × 1350), the
 *                    shape Instagram's API takes (4:5 to 1.91:1, JPEG). A 3:4 slide loses
 *                    45 px at the top and at the bottom, outside the text's safe area; a
 *                    9:16 slide is fitted whole on a blurred copy of itself. The cover
 *                    always carries its text, since nobody types it on Instagram: the
 *                    post is rendered a second time with --burn-cover, into a scratch
 *                    folder, and that render is converted. caption.txt is the caption
 *                    without the hashtags; first-comment.txt holds the hashtags (Post
 *                    Bridge posts it as the first comment). A deck over 10 slides is
 *                    written with a warning: Instagram takes 10.
 *
 * Text style: Helvetica Neue Bold, white, with a black outline (TikTok's
 * "classic" look). Boxed blocks (the deck's "in a box") are the TikTok
 * background-box style: white on a translucent brown box. Position and size
 * come from the deck's blocks the way the Atlas replica draws them (the
 * same stacks, the same cqw sizes; see production.css .frame__*), unless a
 * `slide.layout` line in the log locked a layout for the slide: then every
 * block is drawn exactly where the user put it, with the words they locked.
 *
 * The product slide gets the product callout — the App Store card in
 * cards/1-*.png — pasted in the lower third, where the prompt kept the frame
 * plain, with the callout sentence in the stack directly above it.
 *
 * Only sharp is used; text is SVG. Line wrapping measures each candidate line
 * by rendering it, so no font-metrics library is needed.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import { cardHash, renderAppStoreCard } from "./lib/appstore-card.mjs";

const ROOT = resolve(process.cwd());
const WORKSPACE = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(ROOT, "..");
/* The first argument names the app: apps/<slug>/production/ holds the log and the files. */
const SLUG = process.argv[2] && /^[\w.-]+$/.test(process.argv[2]) && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/render-slides.mjs <app slug> <post key> [--force] [--slideN=<file>] | --date YYYY-MM-DD"); process.exit(1); }
const STORE = join(WORKSPACE, "apps", SLUG, "production");
const FILES = join(STORE, "files");
const LOG = join(STORE, "log.jsonl");
/* Files in the log are addressed as <slug>/<post dir>/<sub>/<name>; here they are relative to FILES. */
const local = (f) => (f && f.startsWith(`${SLUG}/`) ? f.slice(SLUG.length + 1) : f);

const W = 1080;
const cq = W / 100; // one cqw of the replica, in px

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
/* cqw, as lib/layout.ts FONT_SIZE_BY: keep the two in step. 9:16 is the original default; 3:4 is the default since 2026-09-17. */
const FONT_SIZE_BY = { "9:16": { big: 7.4, medium: 5.6, small: 3.9 }, "3:4": { big: 7.4, medium: 5.1, small: 4.3 } };
const BOX_FONT_SIZE = 3.7;
const BIG_FROM = 6.5; // a block at or above this size is drawn in the hook style (lib/layout.ts BIG_FROM)
/* The safe area and the card geometry, as lib/layout.ts frameOf() and CARD: keep the two in step. */
const CARD = { w: 80, ratio: 34 / 139 };
const SAFE_BY = { "9:16": { top: 8, bottom: 82 }, "3:4": { top: 4, bottom: 96 } };
const SIZE_BY = { "9:16": [1080, 1920], "3:4": [1080, 1440] };
function frameOf(dimension) {
  const [w, h] = SIZE_BY[dimension] ?? SIZE_BY["3:4"];
  const safe = SAFE_BY[dimension] ?? SAFE_BY["3:4"];
  const cardH = (CARD.w * CARD.ratio * w) / h, stackGap = (3 * w) / h;
  return { dimension, w, h, safe, cardH, stackGap, calloutStackBottom: safe.bottom - cardH - stackGap };
}
/** The frame of the post being drawn (set per post in renderPost): its height and its safe area. */
let FR = frameOf("3:4");
let H = FR.h;

/* ------------------------------------------------------------ inputs */

const prod = JSON.parse(readFileSync(join(ROOT, "data", `production-${SLUG}.json`), "utf8"));
const log = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const fileKey = (key) => key.replace(/\//g, "-");
const last = (a) => (a.length ? a[a.length - 1] : null);

function deckOf(key) {
  for (const d of prod.decks) for (const p of d.posts) if (p.key === key) return { deck: p, file: d };
  return null;
}

/** The slide's approved picture (the file the last approve line names, if it still exists), and its current one. */
function pictureOf(key, n, events) {
  const dir = join(FILES, fileKey(key), `slide-${String(n).padStart(2, "0")}`);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith(".")).sort() : [];
  const rel = (f) => `${fileKey(key)}/slide-${String(n).padStart(2, "0")}/${f}`;
  let current = files.length ? rel(last(files)) : null;
  let approved = null;
  for (const e of events.filter((e) => e.slide === n)) {
    if ((e.kind === "slide.upload" || e.kind === "slide.choose") && e.file) current = local(e.file);
    else if (e.kind === "slide.approve") approved = local(e.file) ?? current;
    else if (e.kind === "slide.reject") approved = null;
  }
  const ok = (f) => f && existsSync(join(FILES, f));
  return { approved: ok(approved) ? approved : null, current: ok(current) ? current : files.length ? rel(last(files)) : null };
}

function layoutOf(n, events) {
  const e = last(events.filter((e) => e.slide === n && (e.kind === "slide.layout" || e.kind === "slide.unlock")));
  if (!e || e.kind !== "slide.layout") return null;
  try { const j = JSON.parse(e.data?.layout ?? ""); return Array.isArray(j?.blocks) ? j : null; } catch { return null; }
}

function textFlagOf(n, events) {
  const e = last(events.filter((e) => e.slide === n && e.kind === "slide.text"));
  return e ? (e.data?.text === "baked" ? "baked" : "overlay") : n === 1 ? "overlay" : "baked";
}

function cardOf(key) {
  const dir = join(FILES, fileKey(key), "cards");
  if (!existsSync(dir)) return null;
  /* The post's default card; a card with a lock's own words (1-appstore-<hash>.png) is never the default. */
  const f = readdirSync(dir).filter((f) => /^1-/.test(f) && !/-[0-9a-f]{10}\.png$/.test(f)).sort().pop();
  return f ? join(dir, f) : null;
}

/**
 * The card a locked layout asks for: the post's own words drawn to
 * cards/1-appstore-<hash>.png (rendered here when the page has not yet), or
 * the default card. Returns { path, note }.
 */
async function cardFor(key, layout, defaultPath) {
  const c = layout?.card;
  if (!c || typeof c.name !== "string" || typeof c.subtitle !== "string" || typeof c.button !== "string") return { path: defaultPath, note: "" };
  const text = { name: c.name, subtitle: c.subtitle, button: c.button };
  const path = join(FILES, fileKey(key), "cards", `1-appstore-${cardHash(text)}.png`);
  if (!existsSync(path)) await renderAppStoreCard({ slug: SLUG, ...text, out: path });
  return { path, note: `card with this post's words ("${text.subtitle}")` };
}

/* --------------------------------------------------------------- text */

/* The emoji variation selector (U+FE0F, as in ➡️ and ❤️) makes Pango bail out; the bare glyph renders. */
const esc = (t) => t.replace(/[\uFE0E\uFE0F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const widths = new Map();
/** Width of one line in px at a font size, by rendering it once. */
async function measure(text, size, weight) {
  const k = `${weight}|${size}|${text}`;
  if (widths.has(k)) return widths.get(k);
  if (!text.trim()) { widths.set(k, 0); return 0; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3}" height="${Math.ceil(size * 2)}"><text x="0" y="${size * 1.3}" font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="#000">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true });
  widths.set(k, info.width);
  return info.width;
}

/** Greedy word wrap of one paragraph to a width. Explicit newlines in the deck are kept. */
async function wrap(text, size, weight, width) {
  const lines = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let line = words[0];
    for (const w of words.slice(1)) {
      const t = `${line} ${w}`;
      if ((await measure(t, size, weight)) <= width) line = t;
      else { lines.push(line); line = w; }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * One block's SVG and height. Style follows production.css .frame__t:
 *   plain   700 weight, white, black outline 0.35cqw at 55% (big: 0.6cqw, solid), line-height 1.18 (big 1.1)
 *   box     500 weight, white on rgba(78,52,30,.72), padding 3cqw 3.6cqw, radius 2cqw, left-aligned, line-height 1.35
 */
async function blockSvg(b, x, y, w, sizeCqw) {
  const size = sizeCqw * cq;
  const big = sizeCqw >= BIG_FROM;
  const weight = b.box ? 500 : 700;
  const lh = b.box ? 1.35 : big ? 1.1 : 1.18;
  const padX = b.box ? 3.6 * cq : 0, padY = b.box ? 3 * cq : 0;
  const lines = await wrap(b.text, size, weight, w - 2 * padX);
  const height = lines.length * size * lh + 2 * padY;
  const align = b.align === "left" ? "start" : "middle";
  const tx = b.align === "left" ? x + padX : x + w / 2;
  const stroke = b.box ? "" : big ? `stroke="#000" stroke-width="${0.6 * cq}"` : `stroke="rgba(0,0,0,0.55)" stroke-width="${0.35 * cq}"`;
  let svg = "";
  if (b.box) svg += `<rect x="${x}" y="${y}" width="${w}" height="${height}" rx="${2 * cq}" ry="${2 * cq}" fill="rgba(78,52,30,0.72)"/>`;
  const shadow = b.box ? "" : ` filter="url(#sh)"`;
  svg += `<text font-family="${FONT}" font-weight="${weight}" font-size="${size}" fill="#fff" text-anchor="${align}" ${stroke} stroke-linejoin="round" paint-order="stroke" letter-spacing="${-0.01 * size}"${shadow}>`;
  lines.forEach((l, i) => {
    /* The baseline sits about 0.8em below the line's top; centre each line in its line-height. */
    const by = y + padY + i * size * lh + size * lh / 2 + size * 0.35;
    svg += `<tspan x="${tx}" y="${by}">${esc(l) || " "}</tspan>`;
  });
  svg += `</text>`;
  return { svg, height };
}

/**
 * The deck's default layout, as the replica stacks it: groups by place, each
 * stack 88% wide at x = 6% (the callout stack 94% at 3%), blocks 3cqw apart; the top stack from the frame's safe.top
 * (8% on 9:16), the middle stack centred, the bottom stack ending at safe.bottom
 * (82%), or one gap above the callout card when that sits under it. The
 * bottom 18% stays empty for TikTok's caption and button column.
 */
async function defaultLayoutSvg(slide, hasCard) {
  const groups = { top: [], middle: [], bottom: [] };
  for (const b of slide.blocks) groups[b.place === "flow" ? "top" : b.place].push(b);
  const gap = 3 * cq;
  const isLeft = (t) => /^[•\-–]/m.test(t) || /\n[•\-–]/.test(t);
  let out = "";
  for (const place of ["top", "middle", "bottom"]) {
    const bs = groups[place];
    if (!bs.length) continue;
    /* The callout stack is 94% wide (production.css), so the sentence's trailing emoji does not strand on a line of its own. */
    const wide = hasCard && place === "bottom";
    const x = (wide ? 0.03 : 0.06) * W, w = (wide ? 0.94 : 0.88) * W;
    const parts = [];
    let total = 0;
    for (const b of bs) {
      const lb = { text: b.text, box: b.box, align: b.box || isLeft(b.text) ? "left" : "center" };
      const size = b.box ? BOX_FONT_SIZE : FONT_SIZE_BY[FR.dimension][b.size];
      const r = await blockSvg(lb, x, 0, w, size);
      parts.push({ b: lb, size, height: r.height });
      total += r.height;
    }
    total += gap * (bs.length - 1);
    let y = place === "top" ? (FR.safe.top / 100) * H : place === "middle" ? (H - total) / 2 : ((hasCard ? FR.calloutStackBottom : FR.safe.bottom) / 100) * H - total;
    for (const p of parts) {
      out += (await blockSvg(p.b, x, y, w, p.size)).svg;
      y += p.height + gap;
    }
  }
  return out;
}

async function lockedLayoutSvg(layout) {
  let out = "";
  for (const b of layout.blocks) {
    const x = (b.x / 100) * W, y = (b.y / 100) * H, w = (b.w / 100) * W;
    out += (await blockSvg({ text: b.text, box: !!b.box, align: b.align === "left" ? "left" : "center" }, x, y, w, b.fs)).svg;
  }
  return out;
}

/* ------------------------------------------------------------- render */

/* The Instagram shape: 4:5 JPEG. Meta's API takes 4:5 to 1.91:1, JPEG, 8 MB at most, 1440 px wide at most. */
const IG = { w: 1080, h: 1350, maxSlides: 10 };

/** One composed slide (a PNG buffer at W × H) → the Instagram JPEG. */
async function toInstagram(png, dimension) {
  if (dimension === "3:4") {
    /* 1440 → 1350: 45 px off the top and the bottom. The text's safe area starts 4% (58 px) from each edge. */
    return sharp(png).extract({ left: 0, top: Math.round((H - IG.h) / 2), width: IG.w, height: IG.h }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  }
  /* A taller slide is fitted whole: no text is cut. The sides show a blurred, darker copy of the slide. */
  const bg = await sharp(png).resize(IG.w, IG.h, { fit: "cover" }).blur(40).modulate({ brightness: 0.6 }).toBuffer();
  const fg = await sharp(png).resize(IG.w, IG.h, { fit: "inside" }).toBuffer();
  const m = await sharp(fg).metadata();
  return sharp(bg).composite([{ input: fg, left: Math.round((IG.w - m.width) / 2), top: Math.round((IG.h - m.height) / 2) }]).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/** The caption without its hashtags, and the hashtags: on Instagram they go to the first comment. */
function instagramText(deck) {
  const tags = [...new Set([...(deck.hashtags ?? []), ...((deck.caption ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [])])];
  const caption = (deck.caption ?? "").replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
  return { caption, firstComment: tags.join(" ") };
}

async function renderPost(key, { force = false, override = {}, burnCover = false, instagram = false, outDir: into = null } = {}) {
  const hit = deckOf(key);
  if (!hit) { console.log(`${key}: no deck`); return false; }
  const { deck, file } = hit;
  const events = log.filter((e) => e.post === key);
  const outDir = into ?? join(FILES, fileKey(key), "final");

  const pics = deck.slides.map((s) => ({ n: s.n, ...pictureOf(key, s.n, events) }));
  const missing = pics.filter((p) => !p.approved);
  if (missing.length && !force) { console.log(`${key}: skipped — slide${missing.length === 1 ? "" : "s"} ${missing.map((p) => p.n).join(", ")} not approved (use --force to draw the current picture)`); return false; }
  const cardPath = cardOf(key);
  const illustrated = /^illustrated/i.test(deck.items?.["Slide style"] ?? "");
  FR = frameOf(deck.dimension ?? "3:4");
  H = FR.h;
  mkdirSync(outDir, { recursive: true });

  for (const slide of deck.slides) {
    const pic = pics.find((p) => p.n === slide.n);
    const src = override[slide.n] ?? pic.approved ?? pic.current;
    if (!src) { console.log(`${key}: slide ${slide.n} has no picture; skipped`); continue; }
    const srcPath = isAbsolute(src) ? src : join(FILES, src);
    const meta = await sharp(srcPath).metadata();
    /* A picture of another shape is centre-cropped to the canvas; the line below says so. */
    const cropped = meta.width && meta.height && Math.abs(meta.width / meta.height - W / H) > 0.02 ? `${meta.width}×${meta.height} centre-cropped to ${FR.dimension}` : "";
    const base = sharp(srcPath).resize(W, H, { fit: "cover", position: "centre" });
    const layers = [];
    const hasCard = slide.cards.length > 0 && !!cardPath;
    /* Direct mode: the cover carries its text, in the deck's slide-1 style (or its locked layout), since no hand types it.
     * An illustrated deck (the item row `Slide style: illustrated`) has its text drawn into the picture by the generator:
     * no text layer on any slide, the callout card still on the product slide. An absent row, or `photo`, is today's path. */
    const flag = illustrated ? "overlay" : burnCover && slide.n === 1 ? "baked" : textFlagOf(slide.n, events);

    if (flag === "baked") {
      const layout = layoutOf(slide.n, events);
      const body = layout ? await lockedLayoutSvg(layout) : await defaultLayoutSvg(slide, slide.cards.length > 0);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="sh" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000" flood-opacity="0.6"/></filter></defs>${body}</svg>`;
      layers.push({ input: Buffer.from(svg), top: 0, left: 0 });
    }
    let cardNote = "";
    if (hasCard) {
      /* The card: where the locked layout put it (x, y, w in % of the frame; the height follows the 139:34 ratio), or the
       * default of production.css .frame__cards: 80% wide, centred, its bottom edge on the safe-area limit. Alone on the photo with a soft shadow. */
      const layout = flag === "baked" ? layoutOf(slide.n, events) : null;
      const { path, note } = await cardFor(key, layout, cardPath);
      cardNote = note;
      const lc = layout?.card;
      const cw = Math.round(((lc ? lc.w : CARD.w) / 100) * W), ch = Math.round(cw * CARD.ratio);
      const cardLeft = Math.round(lc ? (lc.x / 100) * W : (W - cw) / 2);
      const cardTop = Math.round(lc ? (lc.y / 100) * H : (FR.safe.bottom / 100) * H - ch);
      const card = await sharp(path).resize(cw, ch, { fit: "cover" }).png().toBuffer();
      const shadow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="b" x="-10%" y="-20%" width="120%" height="150%"><feGaussianBlur stdDeviation="${1.5 * cq}"/></filter></defs><rect x="${cardLeft}" y="${cardTop + 1.2 * cq}" width="${cw}" height="${ch}" rx="${3.6 * cq}" fill="rgba(0,0,0,0.28)" filter="url(#b)"/></svg>`;
      layers.push({ input: Buffer.from(shadow), top: 0, left: 0 });
      layers.push({ input: card, top: cardTop, left: cardLeft });
    }
    const out = join(outDir, `slide-${String(slide.n).padStart(2, "0")}.png`);
    await base.composite(layers).png().toFile(out);
    const note = illustrated ? "illustrated: text in the picture" : flag === "overlay" ? "cover, no text" : `${layoutOf(slide.n, events) ? "locked layout" : "deck layout"}${burnCover && slide.n === 1 ? ", cover text burned for a direct post" : ""}`;
    console.log(`${key}: wrote ${out} (${FR.dimension} ${W}×${H}, ${note}${hasCard ? `, product callout${cardNote ? ` (${cardNote})` : ""}` : ""}${cropped ? `, ${cropped}` : ""}${override[slide.n] ? `, picture overridden: ${override[slide.n]}` : ""})`);
  }

  if (instagram) await instagramSet(key, deck, outDir, { force, override, burned: burnCover || illustrated });

  const cover = deck.slides[0];
  if (cover) writeFileSync(join(outDir, "cover-text.txt"), cover.blocks.map((b) => b.text).join("\n\n") + "\n");
  const caption = [deck.caption ?? "", ...(deck.hashtags ?? [])].filter(Boolean);
  writeFileSync(join(outDir, "caption.txt"), (deck.caption && deck.hashtags.every((h) => deck.caption.includes(h)) ? deck.caption : caption.join(" ")) + "\n");
  console.log(`${key}: wrote cover-text.txt and caption.txt (${file.file})`);
  return true;
}

/**
 * final/instagram/: the slides as 4:5 JPEG with the cover text burned in. When the
 * render above already burned it (direct mode, or an illustrated deck), its PNGs are
 * converted; otherwise the post is rendered once more with --burn-cover into a scratch
 * folder, quietly, and that render is converted. The loop above is not touched.
 */
async function instagramSet(key, deck, outDir, { force, override, burned }) {
  const igDir = join(outDir, "instagram");
  mkdirSync(igDir, { recursive: true });
  let from = outDir, tmp = null;
  if (!burned) {
    tmp = mkdtempSync(join(tmpdir(), "ugckit-ig-"));
    const say = console.log;
    console.log = () => {};
    try { await renderPost(key, { force, override, burnCover: true, outDir: tmp }); } finally { console.log = say; }
    from = tmp;
  }
  const nn = (n) => String(n).padStart(2, "0");
  for (const slide of deck.slides) {
    const png = join(from, `slide-${nn(slide.n)}.png`);
    if (!existsSync(png)) continue;
    writeFileSync(join(igDir, `slide-${nn(slide.n)}.jpg`), await toInstagram(readFileSync(png), FR.dimension));
  }
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  const ig = instagramText(deck);
  writeFileSync(join(igDir, "caption.txt"), ig.caption + "\n");
  writeFileSync(join(igDir, "first-comment.txt"), ig.firstComment + "\n");
  console.log(`${key}: wrote the Instagram set in ${igDir} (${deck.slides.length} JPEG slides at 4:5 ${IG.w}×${IG.h}, cover text burned; caption.txt without the hashtags, first-comment.txt with them)`);
  if (deck.slides.length > IG.maxSlides) console.log(`${key}: WARNING — ${deck.slides.length} slides; Instagram takes ${IG.maxSlides}. A handle on TikTok and Instagram plans its decks at ${IG.maxSlides} slides or fewer: cut the deck.`);
}

const args = process.argv.slice(3);
const force = args.includes("--force");
const burnCover = args.includes("--burn-cover");
const instagram = args.includes("--instagram");
const override = Object.fromEntries(args.filter((a) => /^--slide\d+=/.test(a)).map((a) => { const m = a.match(/^--slide(\d+)=(.+)$/); return [Number(m[1]), m[2]]; }));
const dateI = args.indexOf("--date");
const keys = dateI >= 0 ? prod.rows.filter((r) => r.date === args[dateI + 1]).map((r) => r.key) : args.filter((a) => !a.startsWith("--"));
if (!keys.length) { console.error("usage: node scripts/render-slides.mjs <app slug> <post key> [--force] [--slideN=<file>] | --date YYYY-MM-DD"); process.exit(1); }
if (Object.keys(override).length && keys.length !== 1) { console.error("--slideN=<file> works with one post key only"); process.exit(1); }
for (const k of keys) await renderPost(k, { force, override, burnCover, instagram });
