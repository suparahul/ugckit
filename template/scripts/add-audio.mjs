#!/usr/bin/env node
/*
 * Lay a sound under a post's video: a slideshow's reel (photo-reel.mjs) or a design template's video (compose-final.mp4,
 * lib/infographic-store.ts). A track of the music library, a sound effect, a voiceover. Free, local, ffmpeg only.
 * The post page's Music dropdown calls it, and so do photo-reel.mjs and the template export when a track or a group is set.
 *
 *   node scripts/add-audio.mjs <slug> <post key> [--audio <file|folder|none>] [--pool <group>] [--start 0] [--volume 0.8] [--fade 0] [--loop]
 *
 * The track: --audio, else the one chosen on the post page (the latest `music.set` line of the post: a path under
 * assets/music, or "none"), else one picked from assets/music/<--pool>/ (or all of assets/music without --pool) by a hash
 * of the post key, so the same post always gets the same track and different posts spread across the library. A track
 * picked that way is written down as a `music.set` line (actor agent), so the post page shows what is in the reel.
 *
 * The first run keeps the silent render as video/reel-silent.mp4 (the newest silent one: a fresh reel, or a template's
 * compose-final.mp4) and every run mixes from that copy, so another track or
 * volume never stacks audio. The audio is trimmed to the video (no fade-out unless --fade is given; TikTok and Instagram
 * play the sound to the last frame), and --loop repeats a clip shorter than the video. The video stream is copied, not
 * re-encoded. Writes video/reel-final.mp4. --audio none goes back to the silent render.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MUSIC = join(ROOT, "assets", "music");
const AUDIO = /\.(mp3|m4a|wav|aac|ogg)$/i;
const USAGE = "usage: node scripts/add-audio.mjs <slug> <post key> [--audio <file|folder|none>] [--pool <group>] [--start 0] [--volume 0.8] [--fade 0] [--loop]";
const [slug, post, ...rest] = process.argv.slice(2);
if (!slug || !post || slug.startsWith("-") || post.startsWith("-")) { console.error(USAGE); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const num = (k, d, min) => {
  const v = Number(opt(k, d));
  if (!Number.isFinite(v) || v < min) { console.error(`${k} wants a number of ${min} or more, got "${opt(k, d)}"\n${USAGE}`); process.exit(2); }
  return v;
};
const start = num("--start", "0", 0), volume = num("--volume", "0.8", 0), fade = num("--fade", "0", 0);
const loop = rest.includes("--loop"), pool = opt("--pool", "");

/** Every audio file under a folder, as paths relative to it ("calm/01-soft-piano.mp3"). */
const tracksIn = (d, sub = "") => {
  if (!existsSync(join(d, sub))) return [];
  return readdirSync(join(d, sub), { withFileTypes: true }).flatMap((e) =>
    e.name.startsWith(".") ? [] : e.isDirectory() ? tracksIn(d, join(sub, e.name)) : AUDIO.test(e.name) ? [join(sub, e.name)] : []).sort();
};

function chosen() {
  const log = join(ROOT, "apps", slug, "production", "log.jsonl");
  if (!existsSync(log)) return null;
  let t = null;
  for (const l of readFileSync(log, "utf8").split("\n")) {
    if (!l.includes('"music.set"')) continue;
    try { const e = JSON.parse(l); if (e.kind === "music.set" && e.post === post) t = e.data?.track ?? null; } catch {}
  }
  return t;
}
let audio = opt("--audio", null);
if (!audio) { const t = chosen(); audio = t === "none" ? "none" : t ? join(MUSIC, t) : pool ? join(MUSIC, pool) : MUSIC; }

const vdir = join(ROOT, "apps", slug, "production", "files", post.replace(/\//g, "-"), "video");
const final = join(vdir, "reel-final.mp4"), silent = join(vdir, "reel-silent.mp4"), composed = join(vdir, "compose-final.mp4");
const hasAudioStream = (f) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim() !== "";
/* The silent source: the newest of a fresh reel-final with no audio (photo-reel just ran), a template's compose-final
 * (drawn silent), and the silent copy an earlier run kept. */
const mtime = (f) => statSync(f).mtimeMs;
const fresh = [final, composed].filter((f) => existsSync(f) && !hasAudioStream(f)).sort((a, b) => mtime(b) - mtime(a))[0];
if (fresh && (!existsSync(silent) || mtime(fresh) > mtime(silent))) copyFileSync(fresh, silent);
if (!existsSync(silent)) { console.error(`no silent video in ${vdir}; run photo-reel (node scripts/photo-reel.mjs ${slug} ${post}) or export the design first`); process.exit(1); }

const probe = (f, entry) => execFileSync("ffprobe", ["-v", "error", "-show_entries", entry, "-of", "default=nw=1:nk=1", f], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
const dur = Number(probe(silent, "format=duration"));
if (!(dur > 0)) { console.error(`could not read the duration of ${silent}`); process.exit(1); }
const out = join(vdir, "reel-final.tmp.mp4");

if (audio === "none") {
  copyFileSync(silent, out); renameSync(out, final);
  console.log(`no music: ${final} is the silent render (${dur.toFixed(1)} s)`); process.exit(0);
}
let audioPath = resolve(audio), picked = null;
if (!existsSync(audioPath)) { console.error(`audio not found: ${audioPath}${pool ? ` (is there an assets/music/${pool}/ folder?)` : ""}`); process.exit(1); }
if (statSync(audioPath).isDirectory()) {
  const tracks = tracksIn(audioPath);
  if (!tracks.length) { console.error(`no tracks in ${audioPath} (mp3, m4a, wav, aac or ogg)`); process.exit(1); }
  let h = 0; for (const c of `${slug}/${post}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  audioPath = join(audioPath, tracks[h % tracks.length]);
  picked = relative(MUSIC, audioPath);
}
console.log(`track: ${relative(ROOT, audioPath)}`);

const filter = `[1:a]volume=${volume},atrim=0:${dur}${fade > 0 ? `,afade=t=out:st=${Math.max(0, dur - fade)}:d=${fade}` : ""}[a]`;
execFileSync("ffmpeg", [
  "-nostdin", "-y", "-v", "error", "-i", silent,
  ...(loop ? ["-stream_loop", "-1"] : []), "-ss", String(start), "-i", audioPath,
  "-filter_complex", filter, "-map", "0:v", "-map", "[a]",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(dur), "-movflags", "+faststart", out,
], { stdio: ["ignore", "inherit", "inherit"] });
renameSync(out, final);
if (picked && !picked.startsWith("..")) appendFileSync(join(ROOT, "apps", slug, "production", "log.jsonl"), JSON.stringify({ at: new Date().toISOString(), post, kind: "music.set", actor: "agent", data: { track: picked, auto: true } }) + "\n");
console.log(`audio laid in: ${final} (${dur.toFixed(1)} s, volume ${volume}, fade ${fade} s)`);
