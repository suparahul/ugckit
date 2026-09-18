/**
 * The App Store card, the first template of the product callout: render a
 * card PNG from the three strings (name, subtitle, button) to a path. Plain JS with no Atlas
 * imports, so the CLI (scripts/render-appstore-card.mjs), the compositor
 * (scripts/render-slides.mjs) and the Atlas's card route
 * (app/api/production/card) all draw the same card.
 *
 * Shape (the Thrive reference, 2026-09-16): a dark rounded card 278 × 68pt at
 * 3x (834 × 204 px), corners 12pt and transparent; the icon 52pt at the left
 * with the store's corner mask; at the right the name on one line in white
 * 14pt semibold, the subtitle in 10pt grey under it, the blue 42 × 16pt pill
 * under that. Nothing wraps or is truncated:
 * a line that does not fit the text column throws, with the width in pt.
 *
 * Inputs, per app: apps/<slug>/product.json (the callout facts the app phase
 * writes: name, subtitle, button, icon, source) and the icon it names
 * (apps/<slug>/icon.jpg by default, the store's artworkUrl512).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ATLAS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROOT = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(ATLAS, "..");
const appDir = (slug) => join(ROOT, "apps", slug);
const productFile = (slug) => join(appDir(slug), "product.json");

const S = 3; // px per pt
export const CARD_W = 278 * S, CARD_H = 68 * S;
const pad = 8 * S, icon = 52 * S, iconY = (CARD_H - icon) / 2;
const textX = pad + icon + 10 * S, room = CARD_W - textX - pad;
const nameSize = 14 * S, subSize = 10 * S;
const pillW = 42 * S, pillH = 16 * S, pillY = 43 * S;
const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The default strings of an app's card, from product.json; null when the file is absent (the app phase fills it). */
export function defaultCardText(slug) {
  try {
    const p = JSON.parse(readFileSync(productFile(slug), "utf8"));
    return p.name ? { name: String(p.name), subtitle: String(p.subtitle ?? ""), button: String(p.button ?? "Open") } : null;
  } catch {
    return null;
  }
}

/** The icon file of an app: the one product.json names, else icon.jpg. */
export function iconOf(slug) {
  let name = "icon.jpg";
  try { name = JSON.parse(readFileSync(productFile(slug), "utf8")).icon || name; } catch { /* the default name */ }
  return join(appDir(slug), name);
}

/** The cache name of a card with these strings: ten hex characters of their hash, the same in lib/production.ts. */
export const cardHash = ({ name, subtitle, button }) => createHash("sha1").update(`${name}\n${subtitle}\n${button}`).digest("hex").slice(0, 10);

/** Width of one line of text in px, measured by rendering it: no metrics library needed. */
async function measure(text, size, weight) {
  if (!text.trim()) return 0;
  const t = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W * 3}" height="${size * 2}"><text x="0" y="${size * 1.4}" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="#000">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(t)).trim().png().toBuffer({ resolveWithObject: true });
  return info.width;
}

/** Says which line does not fit, or null. Same rule as the render, without drawing. */
export async function cardFitError({ name, subtitle, button }) {
  for (const [label, t, size, weight, max] of [["name", name, nameSize, 600, room], ["subtitle", subtitle, subSize, 400, room], ["button", button, 10.5 * S, 600, pillW - 8 * S]]) {
    if (!t || !t.trim()) return `The ${label} is empty.`;
    const w = await measure(t, size, weight);
    if (w > max) return `The ${label} is too long: ${Math.round(w / S)}pt, the room is ${Math.round(max / S)}pt. Shorten it by about ${Math.ceil(((w - max) / w) * t.length)} characters.`;
  }
  return null;
}

/** Renders the card to `out` (a PNG path) and returns { w, h }. Throws when a line does not fit. */
export async function renderAppStoreCard({ slug, name, subtitle, button, out }) {
  const err = await cardFitError({ name, subtitle, button });
  if (err) throw new Error(err);
  const iconFile = iconOf(slug);
  if (!existsSync(iconFile)) throw new Error(`No icon at apps/${slug}/${iconFile.split("/").pop()}: the app phase fetches it.`);
  const iconB64 = (await sharp(iconFile).resize(icon, icon).png().toBuffer()).toString("base64");
  /* The store's icon mask: a continuous-corner square. An SVG rect with r = 22.4% of the side is the usual approximation. */
  const r = Math.round(icon * 0.224);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${CARD_H}">
  <defs>
    <clipPath id="ic"><rect x="${pad}" y="${iconY}" width="${icon}" height="${icon}" rx="${r}" ry="${r}"/></clipPath>
    <clipPath id="card"><rect width="${CARD_W}" height="${CARD_H}" rx="${12 * S}" ry="${12 * S}"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${CARD_W}" height="${CARD_H}" fill="#141414"/>
    <image x="${pad}" y="${iconY}" width="${icon}" height="${icon}" clip-path="url(#ic)" xlink:href="data:image/png;base64,${iconB64}"/>
    <text x="${textX}" y="${22 * S}" font-family="${font}" font-weight="600" font-size="${nameSize}" fill="#ffffff">${esc(name)}</text>
    <text x="${textX}" y="${37 * S}" font-family="${font}" font-weight="400" font-size="${subSize}" fill="#9a9a9e">${esc(subtitle)}</text>
    <rect x="${textX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" ry="${pillH / 2}" fill="#1a8cff"/>
    <text x="${textX + pillW / 2}" y="${pillY + pillH / 2 + 3.7 * S}" text-anchor="middle" font-family="${font}" font-weight="600" font-size="${10.5 * S}" fill="#ffffff">${esc(button)}</text>
  </g>
</svg>`;
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out);
  return { w: CARD_W, h: CARD_H };
}
