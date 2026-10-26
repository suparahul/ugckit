#!/usr/bin/env node
/*
 * A design template slide from its spec (atlas/lib/infographic.ts) — the same code the post page's design editor runs.
 * For agents: start a slide from a template, change files/<post>/compose/slide-NN.json, render; the user edits the
 * rest on the post page (Edit design).
 *
 *   node scripts/compose.mjs <slug> <post key> <slide> --from <hub|cube|card|page|wall|list|clips>   start the slide from a starter:
 *                                                                              the app's own (apps/<slug>/brand/templates/<t>.json),
 *                                                                              else the kit's (assets/templates/<t>.json)
 *   node scripts/compose.mjs <slug> <post key> <slide> [--dry] [--svg out.svg]   render the TikTok picture (a candidate)
 *                                                                              and the Instagram 4:5 one when the spec has it
 *   node scripts/compose.mjs <slug> <post key> <slide> --video                  also render the animated post (MP4s)
 *
 * --dry prints where the design ends and writes nothing; --svg also writes the SVG for a look. The look (colours, type)
 * is the app's brand/style.json under the spec's own (atlas/lib/brand.ts). A video gets the post's music laid in when one
 * is chosen (the post page's Music, or the handle's `Music:` line).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* The store reads the workspace from ATLAS_ROOT (atlas/lib/root.ts): this file sits in <workspace>/scripts. */
process.env.ATLAS_ROOT ??= fileURLToPath(new URL("..", import.meta.url));
const { calloutGaps, readSpec, renderCallout, renderClips, renderInstagram, renderSpec, renderVideo, specPath, svgFor, writeSpec } = await import("../atlas/lib/infographic-store.ts");
const { allStates, appendEvent } = await import("../atlas/lib/production.ts");

const [slug, post, slideArg, ...rest] = process.argv.slice(2);
const slide = Number(slideArg);
if (!slug || !post || !slide) { console.error("usage: node scripts/compose.mjs <slug> <post key> <slide> [--from hub|cube|card|page|wall|list|clips] [--dry] [--svg out.svg] [--video] [--no-fit]"); process.exit(2); }
const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };

if (opt("--from")) {
  const name = opt("--from");
  const own = join(process.env.ATLAS_ROOT, "apps", slug, "brand", "templates", `${name}.json`);
  const kit = join(process.env.ATLAS_ROOT, "assets", "templates", `${name}.json`);
  const starter = /^[\w-]+$/.test(name) ? [own, kit].find((f) => existsSync(f)) : null;
  const to = specPath(slug, post, slide);
  if (!starter) { console.error(`no starter "${name}": neither ${own} nor ${kit} (the kit has hub, cube, card, page, wall, list, clips)`); process.exit(1); }
  if (existsSync(to)) { console.error(`${to} exists already: edit it, or move it away first`); process.exit(1); }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(starter, to);
  console.log(`${to}: started from ${starter}; change its words and assets, then run this again without --from`);
  process.exit(0);
}

const spec = readSpec(slug, post, slide);
if (!spec) { console.error(`no spec at ${specPath(slug, post, slide)} (or it does not parse)`); process.exit(1); }
if (opt("--svg")) writeFileSync(opt("--svg"), svgFor(slug, spec).svg);
if (rest.includes("--dry")) { const { contentEnd } = svgFor(slug, spec); console.log(`design ends at ${Math.round(contentEnd)} px (${(contentEnd / spec.size[1] * 100).toFixed(1)}%)`); process.exit(0); }

/* A hub with a callout fills the frame: the rows spread until the design ends near 74%, and the callout sits 2.5% under
   it, the bottom ~12% clear (a big empty band above the callout reads as unfinished). Done once, while the slide has no
   placed callout in the log; after that the spec and the editor are the user's. --no-fit skips it. */
const logFile = join(process.env.ATLAS_ROOT, "apps", slug, "production", "log.jsonl");
const placed = existsSync(logFile) && readFileSync(logFile, "utf8").split("\n").some((l) => {
  if (!l.includes('"slide.layout"') || !l.includes(`"${post}"`)) return false;
  try { const e = JSON.parse(l); return e.post === post && e.slide === slide && /"card"/.test(e.data?.layout ?? ""); } catch { return false; }
});
if (spec.template === "hub" && spec.content.callout?.headline && !placed && !rest.includes("--no-fit")) {
  const H = spec.size[1], target = 0.74 * H, end = () => svgFor(slug, spec).contentEnd;
  while (end() < target && spec.params.rowGap < 60) spec.params.rowGap += 2;
  while (end() < target && spec.params.iconSize < 184) spec.params.iconSize += 4;
  writeSpec(slug, post, slide, spec);
  const y = +Math.min(end() / H * 100 + 2.5, 79).toFixed(2);
  appendEvent(slug, { post, kind: "slide.layout", slide, actor: "agent", data: { layout: JSON.stringify({ blocks: [], card: { x: 13, y, w: 74 } }), note: "the callout directly under the design" } });
  console.log(`fit: rowGap ${spec.params.rowGap}, iconSize ${spec.params.iconSize}; design ends at ${(end() / H * 100).toFixed(1)}%, callout at ${y}%`);
}

const r = await renderSpec(slug, post, slide, spec, "agent");
console.log(`${r.file}: logged as the slide's candidate; design ends at ${(r.contentEnd / spec.size[1] * 100).toFixed(1)}%`);
if (spec.content.callout?.headline) console.log(`callout: ${await renderCallout(slug, post, spec.content.callout)}`);
const ig = await renderInstagram(slug, post, slide, spec);
if (ig) console.log(`instagram: ${ig}`);
if (rest.includes("--video")) {
  const layout = allStates(slug).find((s) => s.row.key === post)?.slides.find((s) => s.n === slide)?.layout ?? null;
  const card = { tiktok: layout?.noCard ? null : layout?.card ?? null, instagram: spec.variants?.instagram?.card ?? null, screen: layout?.screen ?? null };
  for (const w of calloutGaps(slug, post, spec, card)) console.warn(`warning: ${w}`);
  const handle = allStates(slug).find((s) => s.row.key === post)?.row.handle ?? null;
  const videos = spec.template === "clips" ? [await renderClips(slug, post, spec, card.tiktok, 30, card.screen, handle)] : await renderVideo(slug, post, spec, card, 30, handle);
  console.log(`video: ${videos.join(", ")}`);
}
