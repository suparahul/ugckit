#!/usr/bin/env node
/**
 * P5 helper: the captions and the title overlay of a character video, drawn in the house
 * style of the slides (Helvetica Neue Bold, white, a black outline, no box), each as a
 * transparent 1080 x 1920 PNG that assemble.py burns in at its times. Free.
 *
 *   node scripts/character/captions.mjs <job.json>
 *
 * The job: {"width":1080,"height":1920,"items":[{"lines":["…"],"out":"…png","y":0.72,
 * "anchor":"bottom"|"top","size":0.056}]}. `y` is the bottom (or the top) of the text
 * block as a share of the height; `size` a share of the width (5.6% is the slides'
 * medium on 9:16). The drawing uses the Atlas's sharp, as the slide renderer does.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ATLAS = join(ROOT, "atlas");
if (!existsSync(join(ATLAS, "node_modules"))) {
  console.error("the Atlas's dependencies are not installed yet: run  scripts/atlas.sh --index  once (a minute, ~370 MB)");
  process.exit(1);
}
const sharp = createRequire(join(ATLAS, "package.json"))("sharp");
const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const W = job.width ?? 1080, H = job.height ?? 1920;
const font = "Helvetica Neue, Helvetica, Arial, sans-serif";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const it of job.items) {
  const size = Math.round((it.size ?? 0.056) * W);
  const lh = Math.round(size * 1.18);
  const n = it.lines.length;
  const top = it.anchor === "top" ? Math.round(it.y * H) : Math.round(it.y * H) - n * lh;
  const stroke = Math.max(4, Math.round(size * 0.14));
  const text = it.lines.map((l, i) =>
    `<text x="${W / 2}" y="${top + (i + 1) * lh - Math.round(lh * 0.22)}" text-anchor="middle" font-family="${font}" font-weight="700" font-size="${size}" fill="#fff" stroke="#000" stroke-width="${stroke}" stroke-linejoin="round" paint-order="stroke fill">${esc(l)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${text}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(it.out);
}
console.log(`captions: ${job.items.length} picture(s)`);
