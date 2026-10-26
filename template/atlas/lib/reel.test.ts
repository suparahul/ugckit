/**
 * A slideshow's reel: how each platform gets it (legFormat), the seconds a slide is held, the handle's music group,
 * and the music library as the post page lists it. In a temporary workspace; ffmpeg is not run.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const WS = mkdtempSync(join(tmpdir(), "atlas-reel-ws-"));
process.env.ATLAS_ROOT = WS;

const { legFormat } = await import("./production.ts");
const { holdOf, musicGroupOf, reelHolds } = await import("./reel.ts");
const { isTrack, listTracks, trackLabel } = await import("./music.ts");

const line = (kind: string, data: Record<string, unknown>) => ({ at: "2026-10-20T10:00:00Z", post: "2026-10-20/maya/1", kind, data }) as never;

test("legFormat: TikTok the slideshow, Instagram the reel, a leg.format line wins", () => {
  assert.equal(legFormat([], "tiktok", true), "slideshow");
  assert.equal(legFormat([], "instagram", true), "reel");
  assert.equal(legFormat([], "instagram", false), "slideshow");
  const log = [line("leg.format", { platform: "instagram", format: "slideshow" }), line("leg.format", { platform: "tiktok", format: "reel" })];
  assert.equal(legFormat(log, "instagram", true), "slideshow");
  assert.equal(legFormat(log, "tiktok", true), "reel");
  assert.equal(legFormat([...log, line("leg.format", { platform: "instagram", format: "reel" })], "instagram", true), "reel");
});

test("hold times: 1 to 12 seconds; an empty or wrong field is refused, never read as 0", () => {
  assert.equal(holdOf(4), 4);
  assert.equal(holdOf("4.5"), 4.5);
  for (const bad of ["", null, undefined, 0, 13, "x"]) assert.equal(holdOf(bad), null);
  assert.deepEqual(reelHolds([]), { hold: 4, hookHold: 5, productHold: 5 });
  assert.deepEqual(reelHolds([line("reel.set", { hold: 3, hookHold: 6, productHold: 0 })]), { hold: 3, hookHold: 6, productHold: 5 });
});

test("the handle's Music: line names its group", () => {
  const dir = join(WS, "apps", "pawly", "handles", "maya.petmom");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "HANDLE.md"), "# Maya\nHandle: @maya.petmom\nMusic: Calm (soft, slow)\n\n## Persona\nMusic: upbeat\n");
  assert.equal(musicGroupOf("pawly", "@maya.petmom"), "calm");
  assert.equal(musicGroupOf("pawly", "@nobody"), null);
  assert.equal(musicGroupOf("pawly", "@../x"), null);
});

test("the music library: a group per folder, the handle's group first, labels without the source tags", () => {
  const m = join(WS, "music");
  mkdirSync(join(m, "calm"), { recursive: true });
  mkdirSync(join(m, "upbeat"), { recursive: true });
  for (const f of ["calm/px-lullaby-580738.mp3", "calm/px-lullaby-585979.mp3", "calm/01-soft-piano.mp3", "calm/px-vox-moon-song-361327.mp3", "upbeat/px-happy-pop-593047.mp3", "loose.m4a", "calm/notes.txt"]) writeFileSync(join(m, f), "x");
  const all = listTracks("upbeat", m);
  assert.deepEqual(all.map((t) => t.file), ["upbeat/px-happy-pop-593047.mp3", "calm/px-lullaby-580738.mp3", "calm/px-lullaby-585979.mp3", "calm/px-vox-moon-song-361327.mp3", "calm/01-soft-piano.mp3", "loose.m4a"]);
  assert.deepEqual(all.map((t) => t.group), ["upbeat", "calm", "calm", "calm", "calm", "other"]);
  assert.deepEqual(all.filter((t) => t.file.includes("lullaby")).map((t) => t.label), ["Lullaby 1", "Lullaby 2"]);
  assert.equal(trackLabel("px-vox-moon-song-361327.mp3"), "Moon song (vocals)");
  assert.equal(trackLabel("01-soft-piano.mp3"), "Soft piano");
  assert.equal(isTrack("calm/01-soft-piano.mp3", m), true);
  assert.equal(isTrack("../secret.mp3", m), false);
  assert.equal(isTrack("calm/notes.txt", m), false);
});
