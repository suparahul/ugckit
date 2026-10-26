#!/usr/bin/env node
/*
 * Add one picture to an app's asset library: cut a box out of a render, key its flat background to transparent,
 * save it under apps/<slug>/brand/assets/<id>.png and register it in assets.json (lib/infographic-store.ts reads it).
 * The library is what the design templates draw from, so an asset is generated once and reused.
 *
 *   node scripts/asset-cutout.mjs <slug> <id> <render.png> <x0,y0,x1,y1> [--kind icon|character|tile] [--note "…"]
 *
 * The background colour is the median of the box's four corners; a pixel's alpha ramps up with its distance from
 * it, and the colour is un-mixed so soft edges sit cleanly on any page.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(new URL("../atlas/package.json", import.meta.url));
const sharp = require("sharp");
const [slug, id, src, box, ...rest] = process.argv.slice(2);
if (!slug || !id || !src || !box) { console.error("usage: node scripts/asset-cutout.mjs <slug> <id> <render.png> <x0,y0,x1,y1> [--kind k] [--note n]"); process.exit(2); }
const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
const [x0, y0, x1, y1] = box.split(",").map(Number);
const w = x1 - x0, h = y1 - y0;
const raw = await sharp(src).extract({ left: x0, top: y0, width: w, height: h }).removeAlpha().raw().toBuffer();
const cb = [0, 1, 2].map((c) => { const v = [0, w - 1, (h - 1) * w, h * w - 1].map((q) => raw[q * 3 + c]).sort((a, b) => a - b); return (v[1] + v[2]) / 2; });
const rgba = Buffer.alloc(w * h * 4);
for (let q = 0; q < w * h; q++) {
  const d = Math.abs(raw[q * 3] - cb[0]) + Math.abs(raw[q * 3 + 1] - cb[1]) + Math.abs(raw[q * 3 + 2] - cb[2]);
  const a = Math.max(0, Math.min(1, (d - 12) / 30));
  for (let c = 0; c < 3; c++) rgba[q * 4 + c] = a > 0 ? Math.max(0, Math.min(255, Math.round((raw[q * 3 + c] - (1 - a) * cb[c]) / a))) : 0;
  rgba[q * 4 + 3] = Math.round(a * 255);
}
const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "apps", slug, "brand", "assets");
mkdirSync(dir, { recursive: true });
/* Trim the fully transparent margin, so the asset's box is the picture. */
const png = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
writeFileSync(join(dir, `${id}.png`), png.data);
const reg = join(dir, "assets.json");
const list = existsSync(reg) ? JSON.parse(readFileSync(reg, "utf8")) : [];
const entry = { id, file: `${id}.png`, w: png.info.width, h: png.info.height, kind: opt("--kind") ?? "icon", ...(opt("--note") ? { note: opt("--note") } : {}) };
const i = list.findIndex((a) => a.id === id);
if (i >= 0) list[i] = entry; else list.push(entry);
writeFileSync(reg, JSON.stringify(list, null, 2) + "\n");
console.log(`${id}: ${entry.w}×${entry.h} → apps/${slug}/brand/assets/${id}.png (${list.length} assets)`);
