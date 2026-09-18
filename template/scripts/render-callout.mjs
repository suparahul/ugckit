#!/usr/bin/env node
/**
 * Phase 8, the product callout (the `callout` skill): the one image the compositor
 * pastes on the product slide, rendered from apps/<slug>/product.json into
 * apps/<slug>/production/files/<post>/cards/1-<template>.png. Free.
 *
 *   node scripts/render-callout.mjs <slug> <post key>                          the App Store card (the first template)
 *   node scripts/render-callout.mjs <slug> <post key> --template appstore [--get] [--subtitle "…"]
 *   node scripts/render-callout.mjs <slug> <post key> --template feature --headline "…" --line "…"
 *                                                                              a feature card: the icon, a feature headline, one line
 *   node scripts/render-callout.mjs <slug> <post key> --template custom --from <png>
 *                                                                              a callout drawn for the day, copied in at the card size
 *   node scripts/render-callout.mjs <slug> --all [--template …]               every post folder under production/files/
 *
 * Every template is the same card: 834 × 204 px (278 × 68 pt at 3x), dark, rounded,
 * the icon at the left, because the compositor sizes the callout by that ratio
 * (lib/layout.ts CARD). The App Store card is atlas/scripts/lib/appstore-card.mjs, the
 * file the Atlas's card route and the compositor draw with; a line that does not fit
 * throws with the width in pt, so shorten the words rather than the card. A per-post
 * wording set on the post page renders to 1-appstore-<hash>.png beside the default.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { ATLAS, ROOT } from "./lib/atlas-run.mjs";

const args = process.argv.slice(2);
const slug = args[0];
if (!slug || slug.startsWith("--")) { console.error("usage: node scripts/render-callout.mjs <slug> <post key> [--template appstore|feature|custom] [--get] [--subtitle …] [--headline … --line …] [--from <png>] | <slug> --all"); process.exit(2); }
const value = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const template = value("--template") ?? "appstore";
const FILES = join(ROOT, "apps", slug, "production", "files");
const posts = args.includes("--all")
  ? (existsSync(FILES) ? readdirSync(FILES).filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d)) : [])
  : args[1] && !args[1].startsWith("--") ? [args[1].replace(/\//g, "-")] : [];
if (!posts.length) { console.error("name a post key (2026-09-16/hannah/2) or --all"); process.exit(2); }

if (!existsSync(join(ATLAS, "node_modules"))) { console.error("the Atlas's dependencies are not installed yet: run  scripts/atlas.sh --index  once"); process.exit(1); }
process.env.ATLAS_ROOT = ROOT;
const card = await import(join(ATLAS, "scripts", "lib", "appstore-card.mjs"));
const require = createRequire(join(ATLAS, "package.json"));
const sharp = require("sharp");
const { CARD_W, CARD_H } = card;

const product = (() => { try { return JSON.parse(readFileSync(join(ROOT, "apps", slug, "product.json"), "utf8")); } catch { return null; } })();
if (!product?.name) { console.error(`apps/${slug}/product.json is missing or has no name: the product skill fills it (scripts/product-facts.sh)`); process.exit(1); }
const iconPath = card.iconOf(slug);
if (!existsSync(iconPath)) { console.error(`the icon is missing (${iconPath}): scripts/product-facts.sh ${slug} --id <app store id>, or --typed with an icon file`); process.exit(1); }

/** The feature card: the same dark card and icon; a bold feature headline and one grey line instead of the store strings. */
async function renderFeatureCard({ headline, line, out }) {
  const S = 3, pad = 8 * S, icon = 52 * S, iconY = (CARD_H - icon) / 2, textX = pad + icon + 10 * S, room = CARD_W - textX - pad;
  const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const measure = async (t, size, weight) => { if (!t.trim()) return 0; const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W * 3}" height="${size * 2}"><text x="0" y="${size * 1.4}" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="#000">${esc(t)}</text></svg>`; const { info } = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true }); return info.width; };
  for (const [label, t, size, weight] of [["headline", headline, 14 * S, 600], ["line", line, 10 * S, 400]]) {
    const w = await measure(t, size, weight);
    if (w > room) throw new Error(`The ${label} is too long: ${Math.round(w / S)}pt, the room is ${Math.round(room / S)}pt. Shorten it by about ${Math.ceil(((w - room) / w) * t.length)} characters.`);
  }
  const iconB64 = (await sharp(iconPath).resize(icon, icon).png().toBuffer()).toString("base64");
  const r = Math.round(icon * 0.224);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CARD_W}" height="${CARD_H}">
  <defs><clipPath id="ic"><rect x="${pad}" y="${iconY}" width="${icon}" height="${icon}" rx="${r}" ry="${r}"/></clipPath><clipPath id="card"><rect width="${CARD_W}" height="${CARD_H}" rx="${12 * S}" ry="${12 * S}"/></clipPath></defs>
  <g clip-path="url(#card)"><rect width="${CARD_W}" height="${CARD_H}" fill="#141414"/>
    <image x="${pad}" y="${iconY}" width="${icon}" height="${icon}" clip-path="url(#ic)" xlink:href="data:image/png;base64,${iconB64}"/>
    <text x="${textX}" y="${30 * S}" font-family="${font}" font-weight="600" font-size="${14 * S}" fill="#ffffff">${esc(headline)}</text>
    <text x="${textX}" y="${47 * S}" font-family="${font}" font-weight="400" font-size="${10 * S}" fill="#9a9a9e">${esc(line)}</text>
  </g></svg>`;
  mkdirSync(resolve(out, ".."), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(out);
  return { w: CARD_W, h: CARD_H };
}

for (const post of posts) {
  const dir = join(FILES, post, "cards");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `1-${template}.png`);
  if (template === "appstore") {
    const text = { name: product.name, subtitle: value("--subtitle") ?? product.subtitle ?? "", button: args.includes("--get") ? "Get" : product.button ?? "Open" };
    const { w, h } = await card.renderAppStoreCard({ slug, ...text, out });
    console.log(`${post}: wrote cards/1-appstore.png (${w}×${h}, "${text.name}" · "${text.subtitle}" · ${text.button}, source ${product.source ?? "?"})`);
  } else if (template === "feature") {
    const headline = value("--headline"), line = value("--line");
    if (!headline || !line) { console.error("--template feature needs --headline and --line"); process.exit(2); }
    const { w, h } = await renderFeatureCard({ headline, line, out });
    console.log(`${post}: wrote cards/1-feature.png (${w}×${h}, "${headline}" · "${line}")`);
  } else if (template === "custom") {
    const from = value("--from");
    if (!from || !existsSync(from)) { console.error("--template custom needs --from <png>, a callout you drew for the day"); process.exit(2); }
    const meta = await sharp(from).metadata();
    await sharp(from).resize(CARD_W, CARD_H, { fit: "cover" }).png().toFile(out);
    console.log(`${post}: wrote cards/1-custom.png from ${from} (${meta.width}×${meta.height} fitted to ${CARD_W}×${CARD_H})`);
  } else { console.error(`unknown template "${template}": appstore, feature or custom`); process.exit(2); }
}
