import { test } from "node:test";
import assert from "node:assert/strict";

import { draw, forPlatform, parseSpec, toSvg, wrap, type Asset, type CardSpec, type CubeSpec, type HubSpec, type PageSpec, type Spec } from "./infographic.ts";

const hub = parseSpec({
  template: "hub", size: [1080, 1920],
  content: {
    title: ["What a Growth", "Spurt or Leap"], definition: [["Leap", " = a jump"]], center: "baby",
    items: Array.from({ length: 8 }, (_, i) => ({ asset: "tile", label: [`Label ${i}`, "two"] })), bubble: "Not a bad week.",
  },
  params: { labelSize: 40 }, nudge: { "item-2": { dx: 30, dy: -10 } },
}) as HubSpec;
const assets: Record<string, Asset> = { baby: { id: "baby", file: "b.png", w: 500, h: 600 }, tile: { id: "tile", file: "t.png", w: 200, h: 140 } };
const href = (a: Asset) => a.file;

test("parseSpec: a hub spec parses with the defaults filled in; anything else is refused", () => {
  assert.ok(hub);
  assert.equal(hub.params.labelSize, 40);
  assert.equal(hub.params.titleSize, 88);
  assert.equal(parseSpec({ template: "nope", size: [1, 1], content: {} }), null);
  assert.equal(parseSpec(null), null);
});

test("hub: one element per part, a nudge moves its element, every word is in the SVG", () => {
  const plain = draw({ ...hub, nudge: {} }, assets, href);
  const moved = draw(hub, assets, href);
  assert.deepEqual(plain.elements.map((e) => e.id), ["title", "def", "item-0", "item-1", "item-2", "item-3", "item-4", "item-5", "item-6", "item-7", "center", "bubble"]);
  const a = plain.elements.find((e) => e.id === "item-2")!, b = moved.elements.find((e) => e.id === "item-2")!;
  assert.equal(b.x - a.x, 30);
  assert.equal(b.y - a.y, -10);
  const svg = toSvg(moved);
  for (const w of ["What a Growth", "Label 7", "Not a bad week.", "Leap"]) assert.ok(svg.includes(w), w);
  assert.ok(moved.contentEnd > 1000 && moved.contentEnd < 1920);
});

test("hub: bigger tiles push the design down", () => {
  const small = draw({ ...hub, params: { ...hub.params, iconSize: 120 } }, assets, href);
  const big = draw({ ...hub, params: { ...hub.params, iconSize: 220 } }, assets, href);
  assert.ok(big.contentEnd > small.contentEnd);
});

test("cube: twelve cubes and twelve pictures, the numbers and labels in the SVG", () => {
  const cube = parseSpec({ template: "cube", size: [1080, 1920], content: { title: ["Baby Gross Motor"], pill: "0–24 months", unit: "months", cubes: Array.from({ length: 12 }, (_, i) => ({ n: String(i + 1), label: ["Lifts", "head"], asset: "baby" })) } }) as CubeSpec;
  const d = draw(cube, assets, href);
  assert.equal(d.elements.filter((e) => e.id.startsWith("cube-")).length, 12);
  assert.equal(d.elements.filter((e) => e.id.startsWith("baby-")).length, 12);
  const svg = toSvg(d);
  for (const w of ["Baby Gross Motor", "0–24 months", ">12<", "Lifts"]) assert.ok(svg.includes(w), w);
});

test("card: the heading wraps inside the card, a cover drops the card", () => {
  const card = parseSpec({ template: "card", size: [1080, 1440], content: { heading: "Reason #1: Finding their voice and a lot more words here", body: "Around 4–6 months.", art: "baby", inset: "tile", footer: "@coozy.app" } }) as CardSpec;
  const d = draw(card, assets, href);
  assert.ok(d.elements.some((e) => e.id === "panel") && d.elements.some((e) => e.id === "inset"));
  assert.ok((toSvg(d).match(/<text[^>]*font-size="60"/g) ?? []).length >= 2, "the long heading wraps to two lines or more");
  const cover = draw({ ...card, content: { ...card.content, cover: true } }, assets, href);
  assert.ok(!cover.elements.some((e) => e.id === "panel"));
  assert.ok(wrap("a b c d e f", 10, 20).length > 1);
});

test("anim: at the start of a pop an element is invisible, at the end it is in place", () => {
  const s = { ...hub, nudge: {}, anim: { kind: "pop" as const, duration: 6, stagger: 0.1 } };
  const first = draw(s, assets, href, 0).elements.find((e) => e.id === "title")!;
  const last = draw(s, assets, href, 5.9).elements.find((e) => e.id === "title")!;
  assert.ok(first.svg.includes('opacity="0.000"'));
  assert.ok(!last.svg.includes("opacity="));
  assert.ok(!draw(s, assets, href).elements[0].svg.includes("opacity="), "the still (no time) is not animated");
});

test("forPlatform: the Instagram variant takes its size, its values and its own moves", () => {
  const s = { ...hub, variants: { instagram: { size: [1080, 1350] as [number, number], params: { iconSize: 100 }, nudge: {} } } };
  const v = forPlatform(s, "instagram") as HubSpec;
  assert.deepEqual(v.size, [1080, 1350]);
  assert.equal(v.params.iconSize, 100);
  assert.equal(v.params.labelSize, 40);
  assert.deepEqual(v.nudge, {});
  assert.equal(forPlatform(s, "tiktok"), s);
});

test("calloutGaps: a callout with no placement or no card file is said, never silent", async () => {
  const { calloutGaps } = await import("./infographic-store.ts");
  const spec = { content: { callout: { headline: "Get the app" } }, variants: { instagram: {} } } as unknown as Spec;
  const place = { x: 13, y: 67.5, w: 74 };
  assert.deepEqual(calloutGaps("no-such-app", "2026-01-01/x/1", { ...spec, content: {} } as unknown as Spec, {}), []);
  const none = calloutGaps("no-such-app", "2026-01-01/x/1", spec, { tiktok: null, instagram: null });
  assert.equal(none.length, 2);
  assert.match(none[0], /no TikTok card placement/);
  assert.match(none[1], /Instagram variant has no card placement/);
  /* Placed, but no card file for the post; the Instagram check only when that platform renders. */
  const noFile = calloutGaps("no-such-app", "2026-01-01/x/1", spec, { tiktok: place });
  assert.equal(noFile.length, 1);
  assert.match(noFile[0], /no card file/);
});

test("cube: cols sets the cubes per row and centres a short last row", () => {
  const spec = parseSpec({ template: "cube", size: [1080, 1920], params: { cols: 2 }, content: { title: ["Rhythm"], pill: "0–12 months", unit: "months ·", cubes: Array.from({ length: 5 }, (_, i) => ({ n: String(i), label: ["a", "b", "c", "d"], asset: "baby" })) } }) as CubeSpec;
  const d = draw(spec, assets, href);
  const boxes = d.elements.filter((e) => /^cube-\d+$/.test(e.id));
  assert.equal(boxes.length, 5);
  assert.ok(Math.abs(boxes[0].y - boxes[1].y) < 1, "two in the first row");
  assert.ok(boxes[2].y > boxes[0].y, "the third starts a new row");
  const last = boxes[4], W = 1080;
  assert.ok(Math.abs(last.x + last.w / 2 - W / 2) < 30, "the lone last cube is centred");
});

test("page: the picture full-bleed, the band, the words and the screen", () => {
  const spec = parseSpec({ template: "page", size: [1080, 1440], params: { band: 300 }, content: { heading: "Eating his fists\nnonstop", body: "Reality: he found his hands.", art: "pic", screen: "scr" } }) as PageSpec;
  const lib = { pic: { id: "pic", file: "p.png", w: 1080, h: 1440 }, scr: { id: "scr", file: "s.png", w: 1242, h: 1620, kind: "screen" } };
  const d = draw(spec, lib, (a) => a.file);
  const ids = d.elements.map((e) => e.id);
  assert.deepEqual(ids, ["art", "band", "heading", "body", "screen"]);
  const svg = toSvg(d);
  assert.ok(svg.includes("Eating his fists") && svg.includes("nonstop") && svg.includes("Reality: he found his hands."));
  assert.ok(d.contentEnd < 400, "the design ends where the words end, not at the picture's bottom");
});

/* ---- the text wall, the list card, the clips, deleted blocks, the phone callout */

const wall = parseSpec({
  template: "wall", size: [1080, 1920],
  content: { text: "To the mom who thinks her baby is behind\nMilestones are guideposts, not deadlines.\nEvery baby gets there in their own time.\nYou are doing great.", art: "", screen: "" },
}) as Spec;

test("wall: one element per paragraph plus the panel, all at once; a deleted block closes the gap", () => {
  const d = draw(wall, assets, href);
  assert.deepEqual(d.elements.map((e) => e.id), ["panel", "line-0", "line-1", "line-2", "line-3"]);
  const without = draw({ ...wall, hidden: ["line-1"] } as Spec, assets, href);
  assert.deepEqual(without.elements.map((e) => e.id), ["panel", "line-0", "line-2", "line-3"]);
  assert.ok(without.contentEnd < d.contentEnd, "the panel shrinks when a line is deleted");
  assert.ok(toSvg(d).includes("guideposts"));
  assert.ok(!toSvg(without).includes("guideposts"));
});

test("wall: the background moves only when asked and only over time; scenes alternate zooming in and out", () => {
  const two = parseSpec({ ...(wall as object), content: { ...(wall as Spec).content, art: "baby", art2: "tile" }, params: { zoomEnd: 10 }, anim: { kind: "drift", duration: 8, stagger: 0.1 } }) as Spec;
  const w = (s: Spec, t: number | null, id: string) => draw(s, assets, href, t).elements.find((e) => e.id === id)?.w ?? 0;
  assert.equal(w(two, null, "art"), 1080, "a still is the unzoomed first picture");
  assert.equal(w(two, null, "art2"), 0, "the second picture is not drawn in a still");
  assert.ok(w(two, 3.5, "art") > w(two, null, "art"), "the first scene zooms in over its time");
  assert.equal(w(two, 0.5, "art2"), 0, "the second fades in only from its start");
  assert.ok(w(two, 7.9, "art2") < w(two, 5, "art2"), "the second scene zooms out");
});

const list = parseSpec({
  template: "list", size: [1080, 1440],
  content: { heading: "Leap 4: signs", sub: "from the app", items: [{ title: "More clingy", line: "wants to be held" }, { title: "Shorter naps", line: "" }, { title: "Fussy at changes", line: "routine feels new" }], art: "", screen: "", footer: "@coozy.app" },
}) as Spec;

test("list: an item per row, numbered in order; deleting one renumbers and closes up", () => {
  const d = draw(list, assets, href);
  assert.deepEqual(d.elements.map((e) => e.id), ["panel", "heading", "sub", "item-0", "item-1", "item-2", "footer"]);
  const gone = draw({ ...list, hidden: ["item-1"] } as Spec, assets, href);
  assert.ok(!gone.elements.some((e) => e.id === "item-1"));
  assert.ok(gone.contentEnd < d.contentEnd);
  assert.match(toSvg(gone), />2<\/text>/, "the third item is now number 2");
});

const clips = parseSpec({
  template: "clips", size: [1080, 1920], params: { frame: 0 },
  content: { title: "3 activities for your 4 month old", items: [
    { label: "Peek-a-Boo Fun", caption: "watch for smiles", video: "u1", thumb: "" }, { label: "Floor Time Exploration", caption: "", video: "u2", thumb: "" }, { label: "Soft Rattle DIY Shake", caption: "", video: "u3", thumb: "" }] },
}) as Spec;

test("clips: the focused clip's name is drawn, the step counts visible clips, a deleted clip is skipped", () => {
  assert.match(toSvg(draw(clips, assets, href, null, { focus: 1, overlay: true }), { clear: true }), /Floor Time Exploration/);
  assert.ok(!toSvg(draw(clips, assets, href, null, { focus: 1, overlay: true }), { clear: true }).includes("fill=\"#F6F1EB\"/>"), "an overlay has no page colour");
  const d = draw({ ...clips, hidden: ["clip-0"] } as Spec, assets, href, null, { focus: 0, overlay: true });
  assert.match(toSvg(d), /Floor Time Exploration/);
  assert.match(toSvg(d), /1 \/ 2/);
});

test("parseSpec keeps hidden blocks and the phone callout", () => {
  const s = parseSpec({ ...(wall as object), hidden: ["line-2"], content: { ...(wall as Spec).content, callout: { headline: "Pawly", line: "the cat care app", kind: "phone", button: "Download on the App Store" } } }) as Spec;
  assert.deepEqual(s.hidden, ["line-2"]);
  assert.equal((s.content as { callout?: { kind?: string } }).callout?.kind, "phone");
  assert.equal(parseSpec({ ...(wall as object), hidden: [] }) ? (parseSpec({ ...(wall as object), hidden: [] }) as Spec).hidden : "x", undefined);
});

test("clips, framed: an intro, one page per clip, an end card; the window is cut out of the overlay; a deleted clip drops a page", () => {
  const f = parseSpec({ template: "clips", size: [1080, 1920], style: { bg: "#EE7B4D" },
    content: { title: "x", intro: { tag: "Parent play tips", title: "3 Activities", line: "to do with your 4 month old", bold: "to improve social development" }, outro: { title: "Find the right play for every age", line: "" },
      items: [{ label: "Peek-a-Boo Fun", caption: "Cover your face", video: "u", thumb: "" }, { label: "Mirror Peek Window", caption: "", video: "u", thumb: "" }] } }) as Spec;
  const ids = (n: number) => draw(f, assets, href, null, { focus: n, overlay: true }).elements.map((e) => e.id);
  assert.deepEqual(ids(-1).filter((i) => i.startsWith("intro")), ["intro-card", "intro-tag", "intro-title", "intro-line", "intro-bold"]);
  assert.ok(ids(0).includes("label") && ids(0).includes("caption") && !ids(1).includes("caption"));
  assert.ok(ids(2).some((i) => i === "outro-title"), "the page after the last clip is the end card");
  assert.match(toSvg(draw(f, assets, href, null, { focus: 0, overlay: true }), { clear: true }), /fill-rule="evenodd"/);
  assert.ok(!toSvg(draw(f, assets, href, null, { focus: -1, overlay: true }), { clear: true }).includes("evenodd"), "the intro has no window");
  const one = { ...f, hidden: ["clip-0"] } as Spec;
  assert.match(toSvg(draw(one, assets, href, null, { focus: 0, overlay: true }), { clear: true }), /Mirror Peek Window/);
});
