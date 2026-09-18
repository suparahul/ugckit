/**
 * The App Store card of an app, rendered once from SVG with sharp, so the
 * product callout is a real store card and not a screenshot.
 *
 *   node scripts/render-appstore-card.mjs <app slug>           writes apps/<slug>/appstore-card.png
 *   node scripts/render-appstore-card.mjs <app slug> --copy    and copies it into every post's cards/1-appstore.png
 *   --get                                                       the button reads "Get" instead of "Open"
 *
 * The strings and the icon come from apps/<slug>/product.json (the app phase).
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultCardText, renderAppStoreCard } from "./lib/appstore-card.mjs";

/* usage: node scripts/render-appstore-card.mjs <app slug> [--get] [--copy] */
const SLUG = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
if (!SLUG) { console.error("usage: node scripts/render-appstore-card.mjs <app slug> [--get] [--copy]"); process.exit(1); }
const WORKSPACE = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(process.cwd(), "..");
const APP = join(WORKSPACE, "apps", SLUG);
const OUT = join(APP, "appstore-card.png");
const STORE = join(APP, "production", "files");

const text = defaultCardText(SLUG);
if (!text) { console.error(`apps/${SLUG}/product.json is missing or has no name: the app phase fills it.`); process.exit(1); }
if (process.argv.includes("--get")) text.button = "Get";
const { w, h } = await renderAppStoreCard({ slug: SLUG, ...text, out: OUT });
console.log(`wrote ${OUT} (${w}×${h}, "${text.name}" · "${text.subtitle}" · ${text.button})`);

if (process.argv.includes("--copy")) {
  if (!existsSync(STORE)) throw new Error(`${STORE} missing`);
  const posts = readdirSync(STORE).filter((d) => /^\d{4}-\d{2}-\d{2}-/.test(d));
  for (const d of posts) {
    const dir = join(STORE, d, "cards");
    mkdirSync(dir, { recursive: true });
    copyFileSync(OUT, join(dir, "1-appstore.png"));
    console.log(`copied → ${join(dir, "1-appstore.png")}`);
  }
}
