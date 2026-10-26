/**
 * Infographic specs on disk, the asset library, and the renders.
 *
 *   apps/<slug>/brand/assets/assets.json            the library: [{id, file, w, h, kind, note}], files beside it
 *   production/files/<post>/compose/slide-NN.json   the slide's spec (lib/infographic.ts)
 *   production/files/<post>/slide-NN/compose-<hash>.png           each TikTok render, a candidate of the slide
 *   production/files/<post>/compose/slide-NN.instagram.png        the Instagram 4:5 layout, callout pasted
 *                                                                  (render-slides takes it for final/instagram/)
 *   production/files/<post>/video/compose-final.mp4               the animated post (TikTok), callout pasted
 *   production/files/<post>/video/instagram/compose-final.mp4     the same at 4:5
 *
 * A TikTok render is logged as a `slide.upload` (data.source "compose"), so the
 * slide's state machine, the approval and the compositor treat it like any
 * picture. The same spec renders to the same file name (the hash of the SVG),
 * so it is drawn only once. Server only (node:fs, sharp, ffmpeg).
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

import { byId, calloutSvg, CALLOUT_RATIO, CLIPS_DEFAULTS, clipsWindow, draw, forPlatform, parseSpec, toSvg, type Asset, type Callout, type ClipsSpec, type Placement, type Platform, type Spec } from "./infographic.ts";
import { readBrand } from "./brand.ts";
import { appendEvent, fileKey, filesRoot } from "./production.ts";
import { appDir, ROOT } from "./root.ts";

const require = createRequire(import.meta.url);
/** A video is exported silent; the post's chosen music (the latest `music.set`, else the handle's `Music:` group) is laid
 * under it after (scripts/add-audio.mjs writes video/reel-final.mp4, the newest *-final.mp4, which the page shows and the
 * send uploads). Never fatal: without a track the video stays silent. */
function bakeMusic(slug: string, post: string, handle: string | null = null): void {
  const group = handle ? musicGroupFor(slug, handle) : null;
  try { execFileSync("node", [join(ROOT, "scripts", "add-audio.mjs"), slug, post, ...(group ? ["--pool", group] : [])], { stdio: "ignore", timeout: 120000, env: { ...process.env, ATLAS_ROOT: ROOT } }); } catch { /* the video stays silent */ }
}
/** The handle's `Music:` line (HANDLE.md), as lib/reel.ts reads it; the post key's handle is its short. */
function musicGroupFor(slug: string, handle: string): string | null {
  const f = join(appDir(slug), "handles", handle.replace(/^@/, ""), "HANDLE.md");
  if (!/^@?[\w.-]+$/.test(handle) || !existsSync(f)) return null;
  return readFileSync(f, "utf8").match(/^Music:\s*([\w.-]+)/m)?.[1]?.toLowerCase() ?? null;
}
/** The spec in the app's look: the brand's style (apps/<slug>/brand/style.json) under the spec's own. */
export const branded = <S extends Spec>(slug: string, spec: S): S => ({ ...spec, style: { ...readBrand(slug).style, ...spec.style } });
const pad = (n: number) => String(n).padStart(2, "0");

export const assetsDir = (slug: string) => join(appDir(slug), "brand", "assets");

/** The app's icon (the file product.json names, else icon.jpg or icon.png), or null. */
export function iconFile(slug: string): string | null {
  let named = "";
  try { named = String(JSON.parse(readFileSync(join(appDir(slug), "product.json"), "utf8")).icon ?? ""); } catch { /* no product.json */ }
  for (const f of [named, "icon.jpg", "icon.png"].filter((x) => x && /^[\w.-]+$/.test(x))) if (existsSync(join(appDir(slug), f))) return join(appDir(slug), f);
  return null;
}

export function readAssets(slug: string): Asset[] {
  const f = join(assetsDir(slug), "assets.json");
  if (!existsSync(f)) return [];
  try { const j = JSON.parse(readFileSync(f, "utf8")); return Array.isArray(j) ? j : []; } catch { return []; }
}

/** A PNG's or JPEG's pixel size from its header, without decoding it. */
function imageSize(f: string): [number, number] | null {
  const b = readFileSync(f);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i + 9 < b.length && b[0] === 0xff && b[1] === 0xd8;) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
}

/**
 * The post's own pictures as assets, for a template that draws one (the `page` template): every generated or
 * uploaded picture under files/<post>/slide-NN/ that is not a template's own render. The id is
 * `post/<post dir>/slide-NN/<file>` and `file` is that path under the files root, so a spec names a picture by id.
 */
export function postPictures(slug: string, post: string): Asset[] {
  const root = join(filesRoot(slug), fileKey(post));
  if (!existsSync(root)) return [];
  const out: Asset[] = [];
  for (const sub of readdirSync(root).filter((d) => /^slide-\d+$/.test(d)).sort()) {
    for (const f of readdirSync(join(root, sub)).filter((n) => /\.(png|jpe?g)$/i.test(n) && !/^compose-/.test(n)).sort()) {
      const size = imageSize(join(root, sub, f));
      if (size) out.push({ id: `post/${fileKey(post)}/${sub}/${f}`, file: `${fileKey(post)}/${sub}/${f}`, w: size[0], h: size[1], kind: "picture" });
    }
  }
  return out;
}

/** The library plus every post picture a spec names (ids `post/…`), so a spec draws without knowing its post. */
export function assetsFor(slug: string, spec: Spec): Record<string, Asset> {
  const lib = byId(readAssets(slug));
  for (const m of JSON.stringify(spec.content).matchAll(/"post\/([^"\/]+)\/(slide-\d+)\/([^"\/]+)"/g)) {
    const f = join(filesRoot(slug), m[1], m[2], m[3]), size = existsSync(f) ? imageSize(f) : null;
    if (size) lib[`post/${m[1]}/${m[2]}/${m[3]}`] = { id: `post/${m[1]}/${m[2]}/${m[3]}`, file: `${m[1]}/${m[2]}/${m[3]}`, w: size[0], h: size[1], kind: "picture" };
  }
  return lib;
}

export const specPath = (slug: string, post: string, slide: number) => join(filesRoot(slug), fileKey(post), "compose", `slide-${pad(slide)}.json`);
export const instagramPath = (slug: string, post: string, slide: number) => join(filesRoot(slug), fileKey(post), "compose", `slide-${pad(slide)}.instagram.png`);

export function readSpec(slug: string, post: string, slide: number): Spec | null {
  const f = specPath(slug, post, slide);
  if (!existsSync(f)) return null;
  try { return parseSpec(JSON.parse(readFileSync(f, "utf8"))); } catch { return null; }
}

export function hasSpec(slug: string, post: string, slide: number): boolean {
  return existsSync(specPath(slug, post, slide));
}

export function writeSpec(slug: string, post: string, slide: number, spec: Spec): void {
  const f = specPath(slug, post, slide);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(spec, null, 2) + "\n");
}

/** Every asset as a data URI, read once per render: the renderer needs no server. */
function hrefFor(slug: string): (a: Asset) => string {
  const cache = new Map<string, string>();
  return (a: Asset) => {
    if (!cache.has(a.id)) {
      const p = a.id.startsWith("post/") ? join(filesRoot(slug), a.file) : join(assetsDir(slug), a.file);
      const mime = /\.jpe?g$/i.test(p) ? "image/jpeg" : "image/png";
      cache.set(a.id, existsSync(p) ? `data:${mime};base64,${readFileSync(p).toString("base64")}` : "");
    }
    return cache.get(a.id)!;
  };
}

export function svgFor(slug: string, spec: Spec, platform: Platform = "tiktok", t: number | null = null): { svg: string; contentEnd: number } {
  const d = draw(forPlatform(branded(slug, spec), platform), assetsFor(slug, spec), hrefFor(slug), t);
  return { svg: toSvg(d), contentEnd: d.contentEnd };
}

/**
 * Render the spec to the slide's TikTok candidate and log it. The same design is
 * the same file (named by the SVG's hash), so it is drawn only once. Returns the
 * file's store address, `<slug>/<post dir>/slide-NN/compose-<hash>.png`.
 */
export async function renderSpec(slug: string, post: string, slide: number, spec: Spec, actor?: string): Promise<{ file: string; contentEnd: number }> {
  const sharp = require("sharp");
  const { svg, contentEnd } = svgFor(slug, spec);
  const hash = createHash("sha1").update(svg).digest("hex").slice(0, 10);
  const sub = `slide-${pad(slide)}`;
  const name = `compose-${hash}.png`;
  const dir = join(filesRoot(slug), fileKey(post), sub);
  const abs = join(dir, name);
  const rel = `${slug}/${fileKey(post)}/${sub}/${name}`;
  if (!existsSync(abs)) {
    mkdirSync(dir, { recursive: true });
    await sharp(Buffer.from(svg), { density: 72 }).png().toFile(abs);
  }
  /* The render becomes the slide's candidate in view (a re-save of an earlier design brings that file back into view). */
  appendEvent(slug, { post, kind: "slide.upload", slide, file: rel, ...(actor ? { actor } : {}), data: { source: "compose", spec: `compose/${sub}.json` } });
  return { file: rel, contentEnd };
}

/** The post's default callout card, as the compositor picks it: the last `cards/1-*.png` that is not a lock's own words. */
export function cardFileOf(slug: string, post: string): string | null {
  const dir = join(filesRoot(slug), fileKey(post), "cards");
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).filter((n) => /^1-/.test(n) && !/-[0-9a-f]{10}\.png$/.test(n)).sort().pop();
  return f ? join(dir, f) : null;
}

/**
 * Why a spec with a callout would render without it: no placement for a
 * platform rendered (the keys of `card`), or no card file to paste. Empty when
 * the card lands. The scripts
 * print these, so a missing card is never silent.
 */
export function calloutGaps(slug: string, post: string, spec: Spec, card: { tiktok?: Placement | null; instagram?: Placement | null }): string[] {
  if (!spec.content.callout) return [];
  const out: string[] = [];
  if (!card.tiktok) out.push(`the spec has a callout but ${post} has no TikTok card placement (slide.layout card in the production index): the TikTok render has no card`);
  if ("instagram" in card && spec.variants?.instagram && !card.instagram) out.push(`the spec has a callout but its Instagram variant has no card placement: the Instagram render has no card`);
  if ((card.tiktok || card.instagram) && !cardFileOf(slug, post)) out.push(`no card file under ${join(filesRoot(slug), fileKey(post), "cards")} (1-*.png): the render has no card`);
  return out;
}

/** The callout pasted where a placement (percent of the frame) says, with the compositor's soft shadow. */
export async function withCard(png: Buffer, W: number, H: number, cardPath: string | null, place: Placement | null | undefined): Promise<Buffer> {
  if (!cardPath || !place || !existsSync(cardPath)) return png;
  const sharp = require("sharp");
  const cw = Math.round((place.w / 100) * W), ch = Math.round(cw * CALLOUT_RATIO), x = Math.round((place.x / 100) * W), y = Math.round((place.y / 100) * H), cq = W / 100;
  const card = await sharp(cardPath).resize(cw, ch, { fit: "cover" }).png().toBuffer();
  const shadow = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="b" x="-10%" y="-20%" width="120%" height="150%"><feGaussianBlur stdDeviation="${1.5 * cq}"/></filter></defs><rect x="${x}" y="${y + 1.2 * cq}" width="${cw}" height="${ch}" rx="${3.6 * cq}" fill="rgba(0,0,0,0.22)" filter="url(#b)"/></svg>`;
  return sharp(png).composite([{ input: Buffer.from(shadow), top: 0, left: 0 }, { input: card, top: y, left: x }]).png().toBuffer();
}

/**
 * The Instagram 4:5 layout (variants.instagram), with the callout pasted where
 * the variant places it. render-slides takes this file for final/instagram/
 * instead of fitting the TikTok slide into 4:5. Null when the spec has no variant.
 */
export async function renderInstagram(slug: string, post: string, slide: number, spec: Spec): Promise<string | null> {
  const v = spec.variants?.instagram;
  const out = instagramPath(slug, post, slide);
  if (!v) { rmSync(out, { force: true }); return null; }
  const sharp = require("sharp");
  const { svg } = svgFor(slug, spec, "instagram");
  const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await withCard(png, v.size[0], v.size[1], cardFileOf(slug, post), v.card));
  return out;
}

/**
 * The animated post: every frame drawn by the same template at its time,
 * the callout pasted where the slide's layout places it, then ffmpeg to an
 * H.264 MP4 (silent: the sound is picked in the app). Writes
 * video/compose-final.mp4 for TikTok (the post page's "finished video"), and
 * video/instagram/compose-final.mp4 when the spec has an Instagram layout.
 */
export async function renderVideo(slug: string, post: string, spec0: Spec, card: { tiktok?: Placement | null; instagram?: Placement | null; screen?: { id: string; x: number; y: number; w: number } | null }, fps = 30, handle: string | null = null): Promise<string[]> {
  const sharp = require("sharp");
  const spec = branded(slug, spec0);
  /* A wall over a generated video: the words are drawn once on a transparent page and laid over the clip, which loops seamlessly. */
  if (spec.template === "wall" && (spec.content as { video?: string }).video) return [await renderWallVideo(slug, post, spec as Extract<Spec, { template: "wall" }>, card.tiktok ?? null, fps, card.screen ?? null, handle)];
  /* A text wall has every word on screen from the first frame: a still held for its length, or a slow drift of its background. */
  const still = spec.template === "wall" && spec.anim?.kind !== "drift";
  const anim = spec.template === "wall"
    ? (spec.anim?.kind === "drift" ? spec.anim : { kind: "none" as const, duration: spec.anim?.duration ?? 6, stagger: 0.12 })
    : spec.anim && spec.anim.kind !== "none" ? spec.anim : { kind: "pop" as const, duration: 6, stagger: 0.12 };
  const withAnim = { ...spec, anim } as Spec;
  const cardPath = cardFileOf(slug, post);
  const outs: string[] = [];
  const platforms: Platform[] = spec.variants?.instagram ? ["tiktok", "instagram"] : ["tiktok"];
  const assets = assetsFor(slug, spec), href = hrefFor(slug);
  for (const platform of platforms) {
    const s = forPlatform(withAnim, platform);
    const [W, H] = s.size;
    const tmp = mkdtempSync(join(tmpdir(), "compose-video-"));
    const frames = still ? 1 : Math.round(anim.duration * fps);
    try {
      for (let i = 0; i < frames; i++) {
        const svg = toSvg(draw(s, assets, href, i / fps));
        const png = await sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
        writeFileSync(join(tmp, `f${String(i).padStart(4, "0")}.png`), await withScreen(await withCard(png, W, H, cardPath, platform === "instagram" ? card.instagram : card.tiktok), W, H, slug, card.screen));
      }
      const dir = join(filesRoot(slug), fileKey(post), "video", ...(platform === "instagram" ? ["instagram"] : []));
      mkdirSync(dir, { recursive: true });
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...(still ? ["-loop", "1", "-t", String(anim.duration)] : []), "-framerate", String(fps), "-i", join(tmp, "f%04d.png"), ...(still ? ["-r", String(fps)] : []), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-movflags", "+faststart", join(dir, "compose-final.mp4")]);
      outs.push(`${slug}/${fileKey(post)}/video/${platform === "instagram" ? "instagram/" : ""}compose-final.mp4`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  if (outs.some((o) => !o.includes("/instagram/"))) bakeMusic(slug, post, handle);
  return outs;
}

/**
 * A text wall over a generated background video. The clip (content.video, under the post's
 * files folder) is fitted to the frame, cut to the wall's length from its start (a hard loop: a cross-fade lays two moments of
 * the subject over each other), and the words (the dimmer and the paragraphs, on a transparent page) are laid over it. Silent; bakeMusic follows.
 */
export async function renderWallVideo(slug: string, post: string, spec0: Extract<Spec, { template: "wall" }>, card: Placement | null, fps = 30, screen: { id: string; x: number; y: number; w: number } | null = null, handle: string | null = null): Promise<string> {
  const sharp = require("sharp");
  const spec = branded(slug, spec0);
  const [W, H] = spec.size, dur = Math.max(2, spec.anim?.duration ?? 6), assets = assetsFor(slug, spec), href = hrefFor(slug);
  const bg = join(filesRoot(slug), fileKey(post), (spec.content as { video: string }).video);
  if (!existsSync(bg)) throw new Error(`the background video ${bg} is missing`);
  const d0 = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", bg]).toString().trim());
  const tmp = mkdtempSync(join(tmpdir(), "compose-wall-"));
  try {
    const png = await sharp(Buffer.from(toSvg(draw(spec, assets, href, null, { overlay: true }), { clear: true })), { density: 72 }).png().toBuffer();
    const ov = join(tmp, "ov.png");
    writeFileSync(ov, await withScreen(await withCard(png, W, H, cardFileOf(slug, post), card), W, H, slug, screen));
    /* A hard loop, no cross-fade: blending the end into the start lays two moments of the subject over each other. The clip is cut to the wall's length from its start; pick a length whose last frame resembles its first. */
    const L = Math.min(dur, d0);
    const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps}`;
    const dir = join(filesRoot(slug), fileKey(post), "video");
    mkdirSync(dir, { recursive: true });
    const fc = `[0:v]${fit},trim=0:${L},setpts=PTS-STARTPTS[loop];[loop][1:v]overlay=0:0:format=auto,format=yuv420p[vout]`;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", bg, "-loop", "1", "-i", ov, "-filter_complex", fc, "-map", "[vout]", "-t", String(L), "-r", String(fps), "-c:v", "libx264", "-crf", "17", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", join(dir, "compose-final.mp4")]);
    bakeMusic(slug, post, handle);
    return `${slug}/${fileKey(post)}/video/compose-final.mp4`;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The banner chosen for a post (cards/callout.json), or null when the post uses its App Store card or none. */
export function calloutOfPost(slug: string, post: string): Callout | null {
  const f = join(filesRoot(slug), fileKey(post), "cards", "callout.json");
  try { return existsSync(f) && existsSync(join(dirname(f), "1-custom.png")) ? (JSON.parse(readFileSync(f, "utf8")) as Callout) : null; } catch { return null; }
}
/** Drop the post's banner: the App Store card (cards/1-appstore.png), if any, is the post's card again. */
export function clearCallout(slug: string, post: string): void {
  const dir = join(filesRoot(slug), fileKey(post), "cards");
  for (const f of ["1-custom.png", "callout.json"]) if (existsSync(join(dir, f))) renameSync(join(dir, f), join(dir, `off-${Date.now()}-${f}`));
}

/** An app screenshot pasted on a frame where the slide's layout places it (x, y, w in % of the frame; the height follows the picture). */
export async function withScreen(png: Buffer, W: number, H: number, slug: string, shot: { id: string; x: number; y: number; w: number } | null | undefined): Promise<Buffer> {
  if (!shot) return png;
  const a = readAssets(slug).find((x) => x.id === shot.id);
  const f = a ? join(assetsDir(slug), a.file) : join(assetsDir(slug), `${shot.id}.png`);
  if (!existsSync(f)) return png;
  const sharp = require("sharp");
  const sw = Math.round((shot.w / 100) * W);
  let img = await sharp(f).resize({ width: sw }).png().toBuffer();
  const { height: sh = 0 } = await sharp(img).metadata();
  const left = Math.round((shot.x / 100) * W), top = Math.round((shot.y / 100) * H);
  const cl = Math.max(0, -left), ct = Math.max(0, -top), cw = Math.min(sw - cl, W - Math.max(0, left)), ch = Math.min(sh - ct, H - Math.max(0, top));
  if (cw <= 0 || ch <= 0) return png;
  if (cl || ct || cw < sw || ch < sh) img = await sharp(img).extract({ left: cl, top: ct, width: cw, height: ch }).png().toBuffer();
  return sharp(png).composite([{ input: img, top: Math.max(0, top), left: Math.max(0, left) }]).png().toBuffer();
}

/**
 * A callout drawn from its words to the post's default card, cards/1-custom.png (the file the compositor pastes,
 * lib/production.ts cardOf), in the app's look. Rewritten in place: the card follows the words.
 */
export async function renderCallout(slug: string, post: string, c: Callout): Promise<string> {
  const sharp = require("sharp");
  const icon = iconFile(slug);
  const href = icon ? `data:${/\.png$/i.test(icon) ? "image/png" : "image/jpeg"};base64,${readFileSync(icon).toString("base64")}` : "";
  /* The phone callout shows an app screen from the asset library (brand/assets/<file>). */
  let screenHref = "";
  if (c.screen) { /* the phone callout, and the peach store listing (variant 2), show an app screen */
    const a = readAssets(slug).find((x) => x.id === c.screen);
    const f = a ? join(assetsDir(slug), a.file) : "";
    if (f && existsSync(f)) screenHref = `data:${/\.jpe?g$/i.test(f) ? "image/jpeg" : "image/png"};base64,${readFileSync(f).toString("base64")}`;
  }
  const dir = join(filesRoot(slug), fileKey(post), "cards");
  mkdirSync(dir, { recursive: true });
  await sharp(Buffer.from(calloutSvg(c, href, readBrand(slug).style, screenHref)), { density: 72 }).png().toFile(join(dir, "1-custom.png"));
  rmSync(join(dir, "1-custom.phone"), { force: true });
  /* The look chosen in the App callout field, read back by both editors (one banner per post). */
  writeFileSync(join(dir, "callout.json"), JSON.stringify(c, null, 2));
  return `${slug}/${fileKey(post)}/cards/1-custom.png`;
}

/**
 * App clips (the `clips` template): each visible clip of the spec is downloaded once (production/files/<post>/
 * clips-src/), cut to `secs` seconds, fitted to 9:16, and the spec's overlay for that clip (its title, step, name and
 * line, the callout pasted) laid over it; the segments are joined into video/compose-final.mp4, silent (the sound is
 * picked in the app). A clip the user deleted (`hidden: ["clip-N"]`) is skipped. Every download is checked with ffprobe
 * (rule 14: never trust a file extension or an exit code).
 */
export async function renderClips(slug: string, post: string, spec0: ClipsSpec, card: Placement | null, fps = 30, screen: { id: string; x: number; y: number; w: number } | null = null, handle: string | null = null): Promise<string> {
  const sharp = require("sharp");
  const spec = branded(slug, spec0);
  const p = { ...CLIPS_DEFAULTS, ...spec.params };
  const framed = p.frame >= 0.5;
  const src = join(filesRoot(slug), fileKey(post), "clips-src");
  mkdirSync(src, { recursive: true });
  const hidden = spec.hidden ?? [];
  const vis = spec.content.items.map((it, i) => ({ it, i })).filter((x) => !hidden.includes(`clip-${x.i}`));
  if (!vis.length) throw new Error("every clip is deleted: nothing to render");
  const assets = assetsFor(slug, spec), href = hrefFor(slug), cardPath = cardFileOf(slug, post);
  const [W, H] = spec.size, win = clipsWindow(spec);
  const tmp = mkdtempSync(join(tmpdir(), "compose-clips-"));
  const overlay = async (focus: number, paste: boolean) => {
    const png = await sharp(Buffer.from(toSvg(draw(spec, assets, href, null, { focus, overlay: true }), { clear: true })), { density: 72 }).png().toBuffer();
    const out = join(tmp, `ov${focus}.png`);
    writeFileSync(out, paste ? await withScreen(await withCard(png, W, H, cardPath, card), W, H, slug, screen) : png);
    return out;
  };
  try {
    const segs: string[] = [];
    const still = async (focus: number, secs: number, paste: boolean) => {
      const seg = join(tmp, `seg-${focus}.mp4`);
      /* The intro and the end card are silent: every segment carries the same audio format so they join without a re-encode. */
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=black:s=${W}x${H}:r=${fps}:d=${secs}`, "-i", await overlay(focus, paste), "-f", "lavfi", "-t", String(secs), "-i", "anullsrc=r=44100:cl=stereo",
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[vout]", "-map", "[vout]", "-map", "2:a:0", "-c:v", "libx264", "-crf", "18", "-r", String(fps), "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-t", String(secs), seg]);
      segs.push(seg);
    };
    if (framed && (p.hook ?? 0) >= 0.5) {
      /* The video hook: a fast preview of the clips (a short excerpt of each, from about a third of the way in) plays in the window under the intro overlay. */
      const seg = join(tmp, "seg-hook.mp4"), per = Math.max(0.6, Math.round((p.introSecs / vis.length) * 100) / 100), parts: string[] = [];
      for (let k = 0; k < vis.length; k++) {
        const { it, i } = vis[k], f = join(src, `clip-${i}.mp4`);
        if (!existsSync(f)) execFileSync("curl", ["-sL", "--fail", "-m", "180", "-o", f, it.video]);
        const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim()) || 5;
        const part = join(tmp, `hook-${k}.mp4`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(Math.max(0, Math.min(dur * 0.33, dur - per - 0.1))), "-t", String(per), "-i", f, "-an", "-vf", `scale=${win.w}:${win.h}:force_original_aspect_ratio=increase,crop=${win.w}:${win.h},setsar=1,fps=${fps}`, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", part]);
        parts.push(part);
      }
      const list2 = join(tmp, "hook-list.txt"); writeFileSync(list2, parts.map((x) => `file '${x}'`).join("\n") + "\n");
      const mont = join(tmp, "hook-montage.mp4");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list2, "-c", "copy", mont]);
      /* A voiceover (content.intro.voice, an audio file under the post's files folder) is laid over the hook; the hook is as long as the voice needs. */
      const voiceRel = (spec.content.intro as { voice?: string } | undefined)?.voice, voiceAbs = voiceRel ? join(filesRoot(slug), fileKey(post), voiceRel) : null;
      const vdur = voiceAbs && existsSync(voiceAbs) ? Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", voiceAbs]).toString().trim()) || 0 : 0;
      const secs = Math.round(Math.max(per * vis.length, vdur > 0 ? vdur + 0.5 : 0) * 100) / 100;
      /* An instrumental bed (content.intro.music, a path under assets/music) under the hook, faded out over its last 0.6 s as the first clip starts. */
      const musicName = (spec.content.intro as { music?: string } | undefined)?.music, musicAbs = musicName ? join(ROOT, "assets", "music", musicName) : null;
      const useMusic = !!musicAbs && existsSync(musicAbs) && !(vdur > 0);
      const mont2 = join(tmp, "hook-montage-long.mp4");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stream_loop", "-1", "-i", mont, "-t", String(secs), "-c", "copy", mont2]);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mont2, "-i", await overlay(-1, false), ...(vdur > 0 ? ["-i", voiceAbs as string] : useMusic ? ["-i", musicAbs as string] : ["-f", "lavfi", "-t", String(secs), "-i", "anullsrc=r=44100:cl=stereo"]),
        "-filter_complex", `color=c=black:s=${W}x${H}:r=${fps}[bg];[bg][0:v]overlay=${win.x}:${win.y}:shortest=1[b];[b][1:v]overlay=0:0:format=auto,format=yuv420p[vout]`, "-map", "[vout]", "-map", "2:a:0", "-af", useMusic ? `aresample=44100,volume=0.8,afade=t=out:st=${Math.max(0, secs - 0.6).toFixed(2)}:d=0.6,apad` : "aresample=44100,apad", "-c:v", "libx264", "-crf", "18", "-r", String(fps), "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", "-t", String(secs), seg]);
      segs.push(seg);
    } else if (framed) await still(-1, p.introSecs, false);
    for (let k = 0; k < vis.length; k++) {
      const { it, i } = vis[k];
      const f = join(src, `clip-${i}.mp4`);
      if (!existsSync(f)) execFileSync("curl", ["-sL", "--fail", "-m", "180", "-o", f, it.video]);
      const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", f]).toString());
      if (!probe.streams?.some((s: { codec_type: string }) => s.codec_type === "video") || !(Number(probe.format?.duration) > 0.5)) { rmSync(f, { force: true }); throw new Error(`clip ${i + 1} (${it.label}) is not a video: deleted ${f}`); }
      const ov = await overlay(k, !framed), seg = join(tmp, `seg${k}.mp4`);
      /* Framed: the clip is fitted to the window on a black page and the overlay (the page, with the window cut out) laid over it. Full frame: the clip fills the frame under the overlay. */
      /* secs 0: the whole video, as long as it is. */
      const clipSecs = p.secs > 0 ? p.secs : Math.round(Number(probe.format.duration) * 100) / 100;
      const hasAudio = !!probe.streams?.some((s: { codec_type: string }) => s.codec_type === "audio");
      const [vw, vh, vx, vy] = framed ? [win.w, win.h, win.x, win.y] : [W, H, 0, 0];
      const fc = framed
        ? `color=c=black:s=${W}x${H}:r=${fps}[bg];[0:v]scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh},setsar=1,fps=${fps}[v];[bg][v]overlay=${vx}:${vy}:shortest=1[b];[b][1:v]overlay=0:0:format=auto,format=yuv420p[vout]`
        : `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${fps}[v];[v][1:v]overlay=0:0:format=auto,format=yuv420p[vout]`;
      /* The clip keeps its own sound; a clip with none gets silence. */
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-stream_loop", "-1", "-ss", String(it.start ?? 0), "-t", String(clipSecs), "-i", f, "-i", ov, ...(hasAudio ? [] : ["-f", "lavfi", "-t", String(clipSecs), "-i", "anullsrc=r=44100:cl=stereo"]),
        "-filter_complex", fc, "-map", "[vout]", "-map", hasAudio ? "0:a:0" : "2:a:0", "-af", "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo", "-t", String(clipSecs), "-c:v", "libx264", "-crf", "18", "-r", String(fps), "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2", seg]);
      segs.push(seg);
    }
    if (framed) await still(vis.length, p.outroSecs, true);
    const list = join(tmp, "list.txt");
    writeFileSync(list, segs.map((s) => `file '${s}'`).join("\n") + "\n");
    const dir = join(filesRoot(slug), fileKey(post), "video");
    mkdirSync(dir, { recursive: true });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", join(dir, "compose-final.mp4")]);
    bakeMusic(slug, post, handle);
    return `${slug}/${fileKey(post)}/video/compose-final.mp4`;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
