#!/usr/bin/env node
/*
 * Cut one art sheet into the asset library (the infographic skill): the sheet's flat background is keyed away by a
 * flood fill from the edges (so a white bottle or a cream blanket inside a picture stays solid), each separate picture
 * is found, and they are named in reading order (rows top to bottom, left to right) with the ids sheets.json gives.
 *
 *   node scripts/asset-sheet-cut.mjs <slug> <sheet-name> [--min-area 4000]
 *
 * Writes apps/<slug>/brand/assets/<id>.png (trimmed, transparent) and updates assets.json. When the count of pictures
 * found is not the count asked for, it says so and writes nothing: re-draw the sheet or cut it by hand with
 * scripts/asset-cutout.mjs and a box.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../atlas/package.json", import.meta.url));
const sharp = require("sharp");
const [slug, name, ...rest] = process.argv.slice(2);
if (!slug || !name) { console.error("usage: node scripts/asset-sheet-cut.mjs <slug> <sheet-name>"); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); if (i < 0) return d; const v = Number(rest[i + 1]); if (!Number.isFinite(v) || v <= 0) { console.error(`${k} wants a number above 0, got "${rest[i + 1]}"`); process.exit(2); } return v; };
const root = fileURLToPath(new URL("..", import.meta.url));
const adir = join(root, "apps", slug, "brand", "assets");
const spec = JSON.parse(readFileSync(join(adir, "sheets.json"), "utf8"));
const sheet = spec.sheets.find((s) => s.name === name);
if (!sheet) { console.error(`no sheet ${name} in sheets.json`); process.exit(2); }

/* A sheet drawn with a transparent background is laid on the asked-for grey first, so its faint stray pixels key away too. */
const { data, info } = await sharp(join(adir, "sheets", `${name}.png`)).flatten({ background: "#ECECEC" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
const px = (p, c) => data[p * 3 + c];
const corners = [0, W - 1, (H - 1) * W, N - 1];
const bg = [0, 1, 2].map((c) => { const v = corners.map((p) => px(p, c)).sort((a, b) => a - b); return (v[1] + v[2]) / 2; });
const dist = (p) => Math.abs(px(p, 0) - bg[0]) + Math.abs(px(p, 1) - bg[1]) + Math.abs(px(p, 2) - bg[2]);

/* The background: every pixel close to the background colour that the edges can reach. */
const TOL = 36, isBg = new Uint8Array(N), stack = [];
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
while (stack.length) {
  const p = stack.pop();
  if (isBg[p] || dist(p) > TOL) continue;
  isBg[p] = 1;
  const x = p % W;
  if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1);
  if (p >= W) stack.push(p - W); if (p < N - W) stack.push(p + W);
}
/* Alpha: 0 on the clean background, a ramp on its soft rim, 1 inside the pictures; colours un-mixed on the rim. */
const rgba = Buffer.alloc(N * 4);
for (let p = 0; p < N; p++) {
  const a = isBg[p] ? Math.max(0, Math.min(1, (dist(p) - 10) / (TOL - 10))) : 1;
  for (let c = 0; c < 3; c++) rgba[p * 4 + c] = a > 0 ? Math.max(0, Math.min(255, Math.round((px(p, c) - (1 - a) * bg[c]) / a))) : 0;
  rgba[p * 4 + 3] = Math.round(a * 255);
}

/* The separate pictures: components of the foreground on a coarse grid, joined across small gaps (a moon's stars
 * belong to the moon). When two pictures stand so close they join, the join is made tighter until the count is right.
 * A picture's box is its own pixels' extent, not the joined area's. */
const S = 4, gw = Math.ceil(W / S), gh = Math.ceil(H / S), g = new Uint8Array(gw * gh);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isBg[y * W + x]) g[Math.floor(y / S) * gw + Math.floor(x / S)] = 1;
function components(R) {
  const dil = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (g[y * gw + x]) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh) dil[Y * gw + X] = 1; }
  const lab = new Int32Array(gw * gh).fill(-1), out = [];
  for (let i = 0; i < gw * gh; i++) {
    if (!dil[i] || lab[i] >= 0) continue;
    const id = out.length, st = [i]; lab[i] = id; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    while (st.length) {
      const q = st.pop(), x = q % gw, y = (q - x) / gw;
      if (g[q]) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      for (const r of [x > 0 ? q - 1 : -1, x < gw - 1 ? q + 1 : -1, q - gw, q + gw]) if (r >= 0 && r < gw * gh && dil[r] && lab[r] < 0) { lab[r] = id; st.push(r); }
    }
    if (n) out.push({ x0: x0 * S, y0: y0 * S, x1: Math.min(W, (x1 + 1) * S), y1: Math.min(H, (y1 + 1) * S), n: n * S * S });
  }
  return out.filter((c) => c.n >= opt("--min-area", 4000));
}
const want = sheet.ids.length;
let pics = [];
for (const R of [3, 2, 1, 0]) { pics = components(R); if (pics.length >= want) break; }
pics = pics.sort((a, b) => b.n - a.n).slice(0, want);
if (pics.length !== want) { console.error(`${name}: found ${pics.length} pictures, sheets.json names ${want}. Nothing written; re-draw the sheet or cut by hand (scripts/asset-cutout.mjs).`); process.exit(1); }
/* Reading order: rows by the centre's height, left to right inside a row. */
pics.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
const rows = [];
for (let r = 0; r < sheet.rows; r++) rows.push(pics.slice(r * sheet.cols, (r + 1) * sheet.cols).sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1)));
const ordered = rows.flat();

const reg = join(adir, "assets.json");
const list = existsSync(reg) ? JSON.parse(readFileSync(reg, "utf8")) : [];
const full = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
const buf = await full.png().toBuffer();
for (let i = 0; i < want; i++) {
  const c = ordered[i], id = sheet.ids[i], pad = 6;
  const left = Math.max(0, c.x0 - pad), top = Math.max(0, c.y0 - pad), width = Math.min(W, c.x1 + pad) - left, height = Math.min(H, c.y1 + pad) - top;
  /* Two steps: in one pipeline sharp trims the whole sheet before it extracts, and a box near the edge falls outside. */
  const box = await sharp(buf).extract({ left, top, width, height }).png().toBuffer();
  const out = await sharp(box).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  writeFileSync(join(adir, `${id}.png`), out.data);
  const entry = { id, file: `${id}.png`, w: out.info.width, h: out.info.height, kind: sheet.kind, note: `sheet ${name}, ${i + 1} of ${want}` };
  const k = list.findIndex((a) => a.id === id);
  if (k >= 0) list[k] = entry; else list.push(entry);
  console.log(`  ${id}: ${entry.w}×${entry.h}`);
}
writeFileSync(reg, JSON.stringify(list, null, 2) + "\n");
console.log(`${name}: ${want} assets cut (${list.length} in the library)`);
