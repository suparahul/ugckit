import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMERA, cameraLines, cameraTexts, cameraZoom, parseCoverStyle } from "./camera-cover.ts";

test("the cover style line: camera, with or without the zoom buttons", () => {
  assert.deepEqual(parseCoverStyle("camera — the 3x3 grid"), { style: "camera", zoom: true });
  assert.deepEqual(parseCoverStyle("camera, no zoom"), { style: "camera", zoom: false });
  assert.equal(parseCoverStyle("mirror"), null);
  assert.equal(parseCoverStyle(null), null);
});

test("the hook's lines: lowercase, staggered, inside the margins, centred on the frame's middle", () => {
  const lines = cameraLines("5 Ways\nyour cat\nsays 'stop\npetting me'", "(most owners miss #2)", 3 / 4);
  assert.equal(lines.length, 5);
  assert.equal(lines[0].text, "5 ways");
  assert.deepEqual(lines.map((l) => l.big), [true, true, true, true, false]);
  assert.ok(lines[0].cx > 50 && lines[2].cx < 50, "right, then left");
  for (const l of lines) assert.ok(l.cx - l.width / 2 >= CAMERA.margin - 1e-9 && l.cx + l.width / 2 <= 100 - CAMERA.margin + 1e-9, l.text);
  const last = lines[lines.length - 1];
  const bottom = last.top + last.size * CAMERA.lineHeight * 0.75;
  assert.ok(Math.abs((lines[0].top + bottom) / 2 - CAMERA.centre) < 0.01);
});

test("a long line makes the big type smaller, never wider than the frame", () => {
  const [l] = cameraLines("a very long first line of the hook", "", 3 / 4);
  assert.ok(l.size < CAMERA.big);
  assert.ok(l.width <= 100 - 2 * CAMERA.margin + 1e-9);
});

test("the hook is the big block; the other words are the small lines; a screen block is left out", () => {
  const t = cameraTexts([
    { label: "On-image text (big)", text: "kitten play\nby age:", size: "big" },
    { label: "On-image text, under it (small)", text: "the toy, the time", size: "small" },
    { label: "The screen (in-app text)", text: "not slide text", size: "small" },
  ]);
  assert.deepEqual(t, { big: "kitten play\nby age:", small: "the toy, the time" });
});

test("the zoom buttons: .5, 1x active, 2, centred", () => {
  const z = cameraZoom();
  assert.deepEqual(z.map((b) => [b.label, b.active]), [[".5", false], ["1x", true], ["2", false]]);
  const right = z[2].left + z[2].d;
  assert.ok(Math.abs((z[0].left + right) / 2 - 50) < 0.01);
});
