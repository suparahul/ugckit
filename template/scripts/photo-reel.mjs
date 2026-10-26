#!/usr/bin/env node
/*
 * A photo reel: a slideshow's slides cut into one 9:16 video. The frames are files/<post>/reel/slide-NN.png, the slides
 * with the cover text burned in and the callout pasted (node scripts/render-slides.mjs <slug> <post> --reel), else
 * final/ (in draft mode its slide 1 has no text: it is typed in TikTok). Instagram takes a slideshow badly; the same
 * slides as a reel go out well. Free, local, ffmpeg only.
 *
 *   node scripts/photo-reel.mjs <slug> <post key> [--hold 4] [--long 1] [--long-hold 5] [--at 1=6,4=7] [--fade 0.3]
 *                               [--pad white|#hex|auto] [--music <group>|none]
 *
 * Every slide is held --hold seconds, the slides in --long for --long-hold (the hook, so it can be read), and --at sets
 * single slides (the post page's hook and product fields; they win over --long), with a --fade crossfade between them.
 * A slide that is not 9:16 (a 3:4 slideshow) is fitted whole over a blurred copy of itself, or, with --pad, on a plain
 * colour (--pad auto: the colour of the first slide's corner; a slide on white paper looks muddy over a blurred page).
 * Writes files/<post>/video/reel-final.mp4, 1080×1920, 30 fps, H.264, which the post page shows and the send uploads to
 * every leg whose format is "reel" (lib/production.ts legFormat).
 *
 * The sound: the track chosen on the post page (the latest `music.set` line of the post), else one picked from
 * assets/music/<group>/ by --music (the handle's `Music:` line, passed by the Atlas), laid under by add-audio.mjs.
 * Without either the reel is silent and the sound is picked in the app. --music none keeps it silent. A TikTok photo
 * carousel cannot carry sound; only the reel does.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const USAGE = "usage: node scripts/photo-reel.mjs <slug> <post key> [--hold 4] [--long 1] [--long-hold 5] [--at 1=6,4=7] [--fade 0.3] [--pad white|#hex|auto] [--music <group>|none]";
const [slug, post, ...rest] = process.argv.slice(2);
if (!slug || !post || slug.startsWith("-") || post.startsWith("-")) { console.error(USAGE); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const seconds = (k, d) => {
  const v = Number(opt(k, d));
  if (!Number.isFinite(v) || v <= 0) { console.error(`${k} wants a number of seconds above 0, got "${opt(k, d)}"\n${USAGE}`); process.exit(2); }
  return v;
};
let pad = opt("--pad", null);
const hold = seconds("--hold", "4"), longHold = seconds("--long-hold", "5"), fade = Number(opt("--fade", "0.3"));
if (!Number.isFinite(fade) || fade < 0) { console.error(`--fade wants 0 or more seconds\n${USAGE}`); process.exit(2); }
const at = new Map(String(opt("--at", "")).split(",").filter(Boolean).map((x) => x.split("=").map(Number)));
for (const [n, s] of at) if (!(n >= 1) || !(s > 0)) { console.error(`--at wants slide=seconds pairs, like 1=6,4=7\n${USAGE}`); process.exit(2); }
const long = new Set(String(opt("--long", "1")).split(",").map(Number));

const dir = join(ROOT, "apps", slug, "production", "files", post.replace(/\//g, "-"));
const reelDir = join(dir, "reel");
const reelSlides = existsSync(reelDir) ? readdirSync(reelDir).filter((f) => /^slide-\d+\.png$/.test(f)) : [];
const finals = reelSlides.length >= 2 ? reelDir : join(dir, "final");
if (finals !== reelDir) console.log(`no reel frames in ${reelDir}: cutting final/ (render-slides --reel burns the cover text in)`);
const slides = existsSync(finals) ? readdirSync(finals).filter((f) => /^slide-\d+\.png$/.test(f)).sort() : [];
if (slides.length < 2) { console.error(`${finals}: fewer than two finished slides; render them first (node scripts/render-slides.mjs ${slug} ${post} --reel)`); process.exit(1); }

if (pad === "auto") {
  try {
    const raw = execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-i", join(finals, slides[0]), "-vf", "crop=1:1:3:3", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    pad = "#" + [...raw.subarray(0, 3)].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch { pad = "white"; }
}

const durs = slides.map((f) => { const n = Number(f.match(/\d+/)[0]); return at.get(n) ?? (long.has(n) ? longHold : hold); });
const inputs = slides.flatMap((f, i) => ["-loop", "1", "-t", String(durs[i] + fade), "-i", join(finals, f)]);
const fill = `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920`;
const fit = (i) => pad
  ? `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=${pad}`
  : `[${i}:v]split[b${i}][f${i}];[b${i}]${fill},boxblur=40:2,eq=brightness=-0.12[bb${i}];[f${i}]scale=1080:1920:force_original_aspect_ratio=decrease[ff${i}];[bb${i}][ff${i}]overlay=(W-w)/2:(H-h)/2`;
const probe = (f) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split(",").map(Number);
const prep = slides.map((f, i) => {
  const [w, h] = probe(join(finals, f));
  const body = Math.abs(w / h - 9 / 16) < 0.01 ? `[${i}:v]${fill}` : fit(i);
  return `${body},setsar=1,fps=30,format=yuv420p[s${i}]`;
});
const chain = [];
let last = "s0", t = 0;
for (let i = 1; i < slides.length; i++) {
  t += durs[i - 1];
  const out = i === slides.length - 1 ? "v" : `x${i}`;
  chain.push(`[${last}][s${i}]xfade=transition=fade:duration=${fade}:offset=${t.toFixed(3)}[${out}]`);
  last = out;
}
const total = durs.reduce((a, b) => a + b, 0);
mkdirSync(join(dir, "video"), { recursive: true });
const out = join(dir, "video", "reel-final.mp4");
execFileSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-y", ...inputs, "-filter_complex", [...prep, ...chain].join(";"), "-map", "[v]", "-t", String(total), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], { stdio: ["ignore", "inherit", "inherit"] });
const probed = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "csv=p=0", out]).toString().trim().replace(/\n/g, " ");
console.log(`${out}: ${slides.length} slides, ${total} s (${probed})`);

/* The sound: the post's own choice wins; else the handle's group; else silent. */
const chosenTrack = () => {
  const log = join(ROOT, "apps", slug, "production", "log.jsonl");
  if (!existsSync(log)) return null;
  let track = null;
  for (const l of readFileSync(log, "utf8").split("\n")) {
    if (!l.includes('"music.set"')) continue;
    try { const e = JSON.parse(l); if (e.kind === "music.set" && e.post === post && typeof e.data?.track === "string") track = e.data.track; } catch {}
  }
  return track;
};
const music = opt("--music", null);
const track = chosenTrack();
if (music === "none" || (!track && !music) || track === "none") {
  console.log(music === "none" || track === "none" ? "no music: the reel is silent" : "no music chosen: the reel is silent (pick a track on the post page, or set a Music: line in the handle's HANDLE.md)");
} else {
  const args = track ? ["--audio", join(ROOT, "assets", "music", track)] : ["--pool", music];
  try { execFileSync("node", [join(ROOT, "scripts", "add-audio.mjs"), slug, post, ...args], { stdio: ["ignore", "inherit", "pipe"] }); }
  catch (e) { console.error(`the music could not be added, so the reel stays silent: ${String(e.stderr || e.message).trim().split("\n").slice(-2).join(" ")}`); process.exit(1); }
}
