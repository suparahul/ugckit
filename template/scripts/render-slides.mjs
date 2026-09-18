#!/usr/bin/env node
/**
 * Phase 8, the compositor (the `render` skill): the finished slides of one post, the
 * text burned in, at the post's dimension, into apps/<slug>/production/files/<post>/final/.
 *
 *   node scripts/render-slides.mjs <slug> <post key>              one post, every picture approved
 *   node scripts/render-slides.mjs <slug> <post key> --force      draw the current picture where none is approved
 *   node scripts/render-slides.mjs <slug> --date 2026-09-16       every post of the day whose pictures are all approved
 *   node scripts/render-slides.mjs <slug> <post key> --burn-cover slide 1 with its text, for a direct (scheduled) send
 *   node scripts/render-slides.mjs <slug> <post key> --slide5=<file>   one slide from another file, for a one-off export
 *
 * Writes final/slide-NN.png, cover-text.txt (slide 1's text, typed by hand in draft
 * mode) and caption.txt. The drawing is atlas/scripts/render-slides.mjs, the same file
 * the Atlas's export uses; this launcher rebuilds the production index and runs it
 * with the workspace as ATLAS_ROOT. Free.
 */
import { runAtlasScript } from "./lib/atlas-run.mjs";

const args = process.argv.slice(2);
if (args.length < 2 || args[0].startsWith("--")) {
  console.error("usage: node scripts/render-slides.mjs <slug> <post key> [--force] [--burn-cover] [--slideN=<file>] | <slug> --date YYYY-MM-DD");
  process.exit(2);
}
runAtlasScript("render-slides.mjs", args);
