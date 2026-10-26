/**
 * An app's look and words for the design templates and the callouts: apps/<slug>/brand/style.json, every key optional.
 *
 *   {
 *     "style":   { "bg": "#…", "ink": "#…", "accent": "#…", "font": "…", … }   the template look (lib/infographic.ts Style)
 *     "callout": { "title": "…", "tagline": "…", "name": "…", "line": "…", "button": "…",
 *                  "screens": [["screen-home", "Home"], …], "wordings": [["Bold line", "second line", "a name"], …] }
 *     "styles":  { "slideshow": [{ "key": "…", "label": "…", "desc": "…" }], "reel": […], "image": […] }   (lib/template.ts)
 *   }
 *
 * Without the file, or a key of it: the kit's neutral look (DEFAULT_STYLE), the kit's template styles, and the callout's
 * words from product.json (the `product` skill): the title and tagline are the store listing's name and subtitle, the
 * short name the part of the name before a colon or dash. Server only (node:fs).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_STYLE, EMPTY_BRAND_CALLOUT, type BrandCallout, type Style } from "./infographic.ts";
import { appDir } from "./root.ts";
import { stylesWith, type StyleSet } from "./template.ts";

export type Brand = { style: Style; callout: BrandCallout; styles: StyleSet };

const readJson = (f: string): Record<string, unknown> | null => {
  if (!existsSync(f)) return null;
  try { const j = JSON.parse(readFileSync(f, "utf8")); return j && typeof j === "object" ? j : null; } catch { return null; }
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const pairs = <N extends number>(v: unknown, n: N): string[][] => (Array.isArray(v) ? v.filter((x) => Array.isArray(x) && x.length >= n && x.every((y) => typeof y === "string")).map((x) => (x as string[]).slice(0, n)) : []);

export const brandFile = (slug: string) => join(appDir(slug), "brand", "style.json");

/* Read once per change of either file: the studio reads the brand for every post of a board. */
const cache = new Map<string, { at: string; brand: Brand }>();
const stamp = (f: string) => { try { return String(statSync(f).mtimeMs); } catch { return "-"; } };

export function readBrand(slug: string): Brand {
  const at = `${stamp(brandFile(slug))}|${stamp(join(appDir(slug), "product.json"))}`;
  const hit = cache.get(slug);
  if (hit && hit.at === at) return hit.brand;
  const brand = buildBrand(slug);
  cache.set(slug, { at, brand });
  return brand;
}

function buildBrand(slug: string): Brand {
  const j = /^[\w.-]+$/.test(slug) ? readJson(brandFile(slug)) ?? {} : {};
  const product = /^[\w.-]+$/.test(slug) ? readJson(join(appDir(slug), "product.json")) ?? {} : {};
  const st = j.style && typeof j.style === "object" ? (j.style as Record<string, unknown>) : {};
  const style = { ...DEFAULT_STYLE } as Style;
  for (const k of Object.keys(DEFAULT_STYLE) as (keyof Style)[]) if (typeof st[k] === "string" && st[k]) style[k] = st[k] as string;
  const c = j.callout && typeof j.callout === "object" ? (j.callout as Record<string, unknown>) : {};
  const title = str(c.title) || str(product.name);
  const callout: BrandCallout = {
    ...EMPTY_BRAND_CALLOUT,
    title, tagline: str(c.tagline) || str(product.subtitle),
    name: str(c.name) || title.split(/\s*[:–—-]\s/)[0].trim(), line: str(c.line) || str(product.subtitle),
    button: str(c.button), screens: pairs(c.screens, 2) as [string, string][], wordings: pairs(c.wordings, 3) as [string, string, string][],
  };
  return { style, callout, styles: stylesWith(j.styles && typeof j.styles === "object" ? (j.styles as Parameters<typeof stylesWith>[0]) : null) };
}
