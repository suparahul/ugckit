/**
 * The template of a post (lib/template.ts): format · style, the styles each
 * format allows, the recipes, the plan's `Template` column
 * (scripts/build-production.mjs, run on a plan written to a temporary folder).
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { DEFAULT_STYLES, parseTemplate, readTemplateCell, recipeOf, styleLabel, stylesWith, templateLabel, templateOf, templateWord, validTemplate, withFormat, type Template, type TemplateLine } from "./template.ts";

/* An app with its own looks (apps/<slug>/brand/style.json "styles", lib/brand.ts). */
const APP = stylesWith({ slideshow: [{ key: "crayon", label: "Crayon drawing" }, { key: "cards", label: "Brand cards" }], reel: [{ key: "hub", label: "Signs hub" }] });

const K = "2026-09-30/maya/1";
const T = (format: string, style: string) => ({ format, style }) as Template;
const set = (at: string, t: Template, from = "", extra: Partial<TemplateLine> = {}): TemplateLine => ({ at: `2026-09-30T${at}:00.000Z`, post: K, kind: "template.set", data: { ...t, from }, ...extra });

test("the valid pairs, and a new format's style", () => {
  assert.ok(validTemplate(T("reel", "cube")));
  assert.ok(validTemplate(T("image", "card")));
  assert.ok(validTemplate(T("slideshow", "other")));
  assert.ok(!validTemplate(T("reel", "card")), "card is a single image");
  assert.ok(!validTemplate(T("slideshow", "cube")));
  assert.deepEqual(withFormat(T("slideshow", "illustrated"), "reel"), T("reel", "hub"), "a new format takes its first style");
  assert.deepEqual(withFormat(T("reel", "hub"), "image"), T("image", "hub"), "a style valid in both is kept");
  assert.deepEqual(withFormat(null, "slideshow"), T("slideshow", "photo"));
  assert.equal(templateWord(T("reel", "cube")), "reel · cube");
});

test("an app's own looks: first in the dropdown, a kit key renamed, the kit's others kept, other last", () => {
  assert.deepEqual(APP.slideshow.map((o) => o.key), ["crayon", "cards", "photo", "illustrated", "design", "other"]);
  assert.deepEqual(APP.reel.map((o) => o.key), ["hub", "cube", "wall", "clips", "other"]);
  assert.equal(styleLabel("hub", APP), "Signs hub");
  assert.equal(styleLabel("hub"), "Hub card");
  assert.ok(validTemplate(T("slideshow", "crayon"), APP));
  assert.ok(!validTemplate(T("slideshow", "crayon")), "not a kit look");
  assert.deepEqual(withFormat(null, "slideshow", APP), T("slideshow", "crayon"));
  assert.equal(templateLabel(T("slideshow", "cards"), APP), "Slideshow · Brand cards");
  assert.equal(stylesWith(null), DEFAULT_STYLES);
  assert.deepEqual(stylesWith({ slideshow: [{ key: "other", label: "Mine" }] }).slideshow.at(-1), DEFAULT_STYLES.slideshow.at(-1), "other stays the kit's, last");
});

test("the plan cell: two parts with · or /, the long words, the old triples and words, blank", () => {
  assert.deepEqual(parseTemplate("Reel · Cube"), T("reel", "cube"));
  assert.deepEqual(parseTemplate("`Single image / Card`"), T("image", "card"));
  /* The names the studio shows read back to their stored keys, the kit's and an app's. */
  assert.deepEqual(parseTemplate("slideshow · Photo story"), T("slideshow", "photo"));
  assert.deepEqual(parseTemplate("slideshow · design pages"), T("slideshow", "design"));
  assert.deepEqual(parseTemplate("slideshow · Crayon drawing", [], APP), T("slideshow", "crayon"));
  assert.deepEqual(parseTemplate("slideshow · brand-cards", [], APP), T("slideshow", "cards"));
  assert.equal(parseTemplate("slideshow · Crayon drawing"), null, "an app's look is unknown to another app");
  assert.deepEqual(parseTemplate("reel · App clips"), T("reel", "clips"));
  assert.deepEqual(parseTemplate("reel · cube chart"), T("reel", "cube"));
  assert.deepEqual(parseTemplate("reel · Hub card"), T("reel", "hub"));
  assert.deepEqual(parseTemplate("reel · Signs hub", [], APP), T("reel", "hub"));
  assert.deepEqual(parseTemplate("reel · Text wall"), T("reel", "wall"));
  assert.equal(parseTemplate("reel · Photo story"), null, "a style belongs to its format");
  assert.equal(parseTemplate("reel · card"), null, "an invalid pair is not read");
  assert.deepEqual(parseTemplate("slideshow · ai-ugc · photo"), T("slideshow", "photo"));
  assert.deepEqual(parseTemplate("slideshow · ai-ugc · crayon", [], APP), T("slideshow", "crayon"));
  assert.deepEqual(parseTemplate("reel · infographic · hub"), T("reel", "hub"));
  assert.deepEqual(readTemplateCell("reel · infographic · cube (cube-chart-video)"), { template: T("reel", "cube"), recipe: "cube-chart-video" });
  assert.deepEqual(parseTemplate("static · infographic · card"), T("image", "card"));
  assert.deepEqual(parseTemplate("reel · ai-ugc · ugc-video"), T("reel", "other"));
  assert.deepEqual(parseTemplate("hub"), T("reel", "hub"));
  assert.deepEqual(parseTemplate("cube"), T("reel", "cube"));
  assert.deepEqual(parseTemplate("card"), T("image", "card"));
  assert.deepEqual(parseTemplate("photos"), T("slideshow", "photo"));
  assert.deepEqual(readTemplateCell("cube-chart-video"), { template: T("reel", "cube"), recipe: "cube-chart-video" });
  assert.equal(parseTemplate("—"), null);
  assert.equal(parseTemplate(""), null);
});

test("recipes: a format file's Template line, the default for cube-chart-video, matched to the template", () => {
  const letters = recipeOf("letters", "# Format\nTemplate: slideshow · crayon\n", APP)!;
  const chart = recipeOf("cube-chart-video", "# Format\n")!;
  assert.deepEqual(letters.template, T("slideshow", "crayon"));
  assert.deepEqual(chart.template, T("reel", "cube"));
  assert.equal(recipeOf("nothing", "# Format\n"), null);
  assert.equal(recipeOf("letters", "# Format\nTemplate: slideshow · crayon\n"), null, "a look the app does not have");
  assert.equal(templateOf({ key: K, template: T("slideshow", "crayon") }, [], null, [letters, chart], APP).recipe, "letters");
  assert.equal(templateOf({ key: K, template: T("slideshow", "photo") }, [], null, [letters, chart], APP).recipe, null);
});

test("effective template: the plan's cell, else nothing; the latest valid template.set line wins", () => {
  assert.equal(templateOf({ key: K }, [], null).current, null);
  const p = templateOf({ key: K, template: "hub" }, [], null);
  assert.deepEqual([p.current, p.source], [T("reel", "hub"), "plan"]);
  const log = [set("09:00", T("image", "card")), set("10:00", T("reel", "cube"), "image · card"), set("10:30", T("slideshow", "cube")), { ...set("11:00", T("reel", "hub")), post: "2026-09-30/pawly/1" }];
  const t = templateOf({ key: K, template: T("reel", "hub") }, log, null);
  assert.deepEqual([t.current, t.source, t.from, t.at], [T("reel", "cube"), "log", "image · card", "2026-09-30T10:00:00.000Z"]);
});

test("rewrite: only while the deck still has the hash the change was made on", () => {
  const log = [set("09:00", T("reel", "cube"), "slideshow · photo", { hash: "deck-a" })];
  assert.equal(templateOf({ key: K }, log, "deck-a").rewrite, true);
  assert.equal(templateOf({ key: K }, log, "deck-b").rewrite, false, "a rewritten deck clears it");
  assert.equal(templateOf({ key: K }, log, null).rewrite, false, "no deck, nothing to rewrite");
  assert.equal(templateOf({ key: K }, [set("09:00", T("reel", "cube"))], "deck-a").rewrite, false, "set before any deck existed");
  const back = [...log, set("09:10", T("image", "cube"), "reel · cube", { hash: "deck-a" }), set("09:20", T("slideshow", "photo"), "image · cube", { hash: "deck-a" })];
  assert.equal(templateOf({ key: K }, back, "deck-a").rewrite, false, "changed back to what the deck was written for");
  assert.equal(templateOf({ key: K }, [set("09:00", T("reel", "hub"), "reel · infographic · hub", { hash: "deck-a" })], "deck-a").rewrite, false, "an old triple in from reads as its pair");
  /* A round trip in three-part lines: card → static hub → reel hub, back where the deck started. */
  const old = (at: string, format: string, style: string, from: string): TemplateLine => ({ at, post: K, kind: "template.set", hash: "ad0ae2576a1b", data: { format, type: "infographic", style, from } });
  const trip = [old("10:04:52", "slideshow", "card", "reel · infographic · hub"), old("10:04:54", "static", "hub", "slideshow · infographic · card"), old("10:05:03", "reel", "hub", "static · infographic · hub")];
  const rt = templateOf({ key: K, template: T("reel", "hub") }, trip, "ad0ae2576a1b");
  assert.deepEqual([rt.current, rt.rewrite], [T("reel", "hub"), false]);
  assert.equal(templateOf({ key: K, template: T("reel", "hub") }, trip.slice(0, 2), "ad0ae2576a1b").rewrite, true, "mid-trip, image · hub is not what the deck was written for");
});

test("the build: the Template column by its header, the recipe, the Kind check, an old plan without it", () => {
  const script = resolve(import.meta.dirname, "..", "scripts", "build-production.mjs");
  const root = mkdtempSync(join(tmpdir(), "tpl-"));
  try {
    const prod = join(root, "apps", "demo", "production");
    const fmt = join(root, "apps", "demo", "handles", "maya.petmom", "formats");
    /* The app's own looks: crayon is one of them. */
    mkdirSync(join(root, "apps", "demo", "brand"), { recursive: true });
    writeFileSync(join(root, "apps", "demo", "brand", "style.json"), JSON.stringify({ styles: { slideshow: [{ key: "crayon", label: "Crayon drawing" }] } }));
    mkdirSync(prod, { recursive: true });
    mkdirSync(fmt, { recursive: true });
    writeFileSync(join(fmt, "cube-chart-video.md"), "# Format\n");
    writeFileSync(join(fmt, "letters.md"), "# Format\n\nTemplate: slideshow · crayon\n");
    const plan = (head: string, rows: string[]) => `# Plan 2026-09-30 to 2026-10-06\n\nApp: Demo\n\n### \`@maya.petmom\` — main persona\n\n## Posts\n\n${head}\n|---|\n${rows.join("\n")}\n`;
    const build = () => {
      const out = execFileSync(process.execPath, [script], { cwd: root, env: { ...process.env, ATLAS_ROOT: root }, stdio: "pipe" }).toString();
      return { out, data: JSON.parse(readFileSync(join(root, "data", "production-demo.json"), "utf8")) };
    };
    const r = (slot: string, topic: string, tail: string) => `| 1 | 09-30 | maya | ${slot} | ${topic} | signs list | arm | \`@someone\`, 1,000 | #a | slideshow${tail} |`;

    writeFileSync(join(prod, "PLAN.md"), plan("| Day | Date | Handle | Slot | Topic | Format / variation | Arm | Source | Tags | Kind | Platforms | Template |", [
      r("AM", "One", " | tiktok | `reel · cube`"),
      r("PM", "Two", " |  | "),
      r("MID", "Three", " | | Slideshow / Crayon"),
      r("AM", "Four", " | | reel · other"),
      r("PM", "Five", " | | photos"),
    ]));
    writeFileSync(join(prod, "log.jsonl"), JSON.stringify({ at: "2026-09-30T08:00:00.000Z", post: "2026-09-30/maya/2", kind: "template.set", data: { format: "image", style: "card", from: "" } }) + "\n");
    let { out, data } = build();
    type Row = { topic: string; template?: Template; recipe?: string };
    assert.deepEqual(data.rows.map((x: Row) => [x.topic, x.template ? templateWord(x.template) : null, x.recipe ?? null]), [
      ["One", "reel · cube", "cube-chart-video"], ["Two", null, null], ["Three", "slideshow · crayon", "letters"], ["Four", "reel · other", null], ["Five", "slideshow · photo", null],
    ]);
    assert.deepEqual(data.rows[0].platforms, ["tiktok"]);
    assert.equal(templateWord(data.rows[1].templateSet), "image · card");
    assert.deepEqual(data.rows.map((x: { key: string }) => x.key)[1], "2026-09-30/maya/2");
    assert.equal(out.split("\n").filter((l) => /Kind says slideshow/.test(l)).length, 1, "only the video-pipeline reel is flagged");

    writeFileSync(join(prod, "PLAN.md"), plan("| Day | Date | Handle | Slot | Topic | Format / variation | Arm | Source | Tags | Kind |", [r("AM", "Old", "")]));
    ({ data } = build());
    assert.equal(data.rows.length, 1);
    assert.equal(data.rows[0].topic, "Old");
    assert.equal(data.rows[0].template, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
