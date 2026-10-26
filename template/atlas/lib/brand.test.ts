/**
 * An app's look and callout words (lib/brand.ts): the kit's neutral defaults, product.json for the words,
 * apps/<slug>/brand/style.json over both, and the callouts drawn in that look (lib/infographic.ts calloutSvg).
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const WS = mkdtempSync(join(tmpdir(), "atlas-brand-ws-"));
process.env.ATLAS_ROOT = WS;

const { readBrand } = await import("./brand.ts");
const { calloutSvg, DEFAULT_STYLE } = await import("./infographic.ts");

const app = (slug: string, files: Record<string, unknown>) => {
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(WS, "apps", slug, f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ""), { recursive: true });
    writeFileSync(join(WS, "apps", slug, f), JSON.stringify(body));
  }
};

test("no files: the kit's look, the kit's styles, no words", () => {
  const b = readBrand("nothing");
  assert.deepEqual(b.style, DEFAULT_STYLE);
  assert.equal(b.callout.title, "");
  assert.deepEqual(b.styles.slideshow.map((o) => o.key), ["photo", "illustrated", "design", "other"]);
});

test("product.json gives the words; the short name is the part before a colon", () => {
  app("pawly", { "product.json": { name: "Pawly: Cat Care Tracker", subtitle: "Health, food & vet chat" } });
  const b = readBrand("pawly");
  assert.deepEqual([b.callout.title, b.callout.tagline, b.callout.name, b.callout.line], ["Pawly: Cat Care Tracker", "Health, food & vet chat", "Pawly", "Health, food & vet chat"]);
});

test("style.json: its colours over the kit's, its words over product.json, its screens and wordings, its styles", () => {
  app("pawly", {
    "brand/style.json": {
      style: { bg: "#000001", calloutFill: "#ABCDEF", nonsense: "x", ink: 3 },
      callout: { name: "Pawly", line: "the cat app", screens: [["screen-home", "Home"], ["bad"]], wordings: [["Bold", "rest", "First"]] },
      styles: { reel: [{ key: "signs", label: "Signs hub" }] },
    },
  });
  const b = readBrand("pawly");
  assert.equal(b.style.bg, "#000001");
  assert.equal(b.style.ink, DEFAULT_STYLE.ink, "a value that is not a string is ignored");
  assert.ok(!("nonsense" in b.style));
  assert.deepEqual([b.callout.title, b.callout.line], ["Pawly: Cat Care Tracker", "the cat app"]);
  assert.deepEqual(b.callout.screens, [["screen-home", "Home"]]);
  assert.deepEqual(b.callout.wordings, [["Bold", "rest", "First"]]);
  assert.equal(b.styles.reel[0].key, "signs");
  /* The logo-and-text callout and the store listing take the brand's colours; nothing of another app is drawn. */
  const card = calloutSvg({ headline: "Pawly", line: "the cat app" }, "", b.style);
  assert.ok(card.includes('fill="#ABCDEF"'));
  const store = calloutSvg({ kind: "store", variant: 1, headline: "", line: "" }, "", b.style);
  assert.ok(!/Coozy|Baby/i.test(store), "an empty title stays empty");
});
