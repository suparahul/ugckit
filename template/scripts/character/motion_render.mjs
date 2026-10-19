#!/usr/bin/env node
/**
 * The renderer of a motion-designed app screen (scripts/character/motion_design.py runs it).
 * Free, local: a headless Chromium draws the page frame by frame, ffmpeg encodes it. The
 * method of the first two motion-designed posts (organic-factory, 2026-10-14, demo/record.mjs):
 * every animation on the page is computed from one clock, so each frame calls
 * window.seek(ms) and takes a screenshot.
 *
 *   node motion_render.mjs <index.html> <out.mp4> --seconds <s> [--fit pad|crop]
 *        [--probe t1,t2,...] [--hero-at <t>] [--json <render-run.json>]
 *
 * The page's contract (docs/character/motion-design.example.html):
 *   window.SCREEN_PT = [w, h]   the phone screen in points (CSS px): the page is laid out at it
 *                               (absent: the body's size, as the pages of the two posts)
 *   window.seek(ms)             draws the frame at ms from the start; nothing else moves the page
 *   window.DURATION             the page's own length in ms (the render may hold its last frame)
 *   [data-hero]                 the element that holds the hero string, when the viewer reads one
 *   Only local files: every request that is not file:// is blocked and reported.
 *
 * Output: 1080x1920, 30 fps, H.264 (crf 14, yuv420p), no sound. --fit pad (the default)
 * scales the screen to 1920 high and pads the sides with the page's own background colour,
 * as the two posts were; --fit crop scales it to 1080 wide and crops the height around the
 * hero element (else the centre). --probe writes, for each time, the page's visible text
 * lines; --hero-at writes where the [data-hero] element is in the output frame at that time.
 *
 * playwright-core: $PLAYWRIGHT_CORE (its folder), else atlas/node_modules/playwright-core,
 * else the newest copy in the npx cache (`npx -y playwright-core --version` puts one there,
 * free). The browser: $CHROME, else Google Chrome or Chromium where the system keeps it, else
 * playwright's own Chromium.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const W = 1080, H = 1920, FPS = 30;

const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const [page_, out] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!page_ || !out || !opt("--seconds")) {
  console.error("usage: node motion_render.mjs <index.html> <out.mp4> --seconds <s> [--fit pad|crop] [--probe t,..] [--hero-at t] [--json f]");
  process.exit(2);
}
const SECONDS = Number(opt("--seconds"));
const FIT = opt("--fit", "pad");
const PROBE = (opt("--probe", "") || "").split(",").filter(Boolean).map(Number);
const HERO_AT = opt("--hero-at") != null ? Number(opt("--hero-at")) : null;
if (!(SECONDS > 0) || !["pad", "crop"].includes(FIT)) { console.error("--seconds is a number above 0; --fit is pad or crop"); process.exit(2); }

function playwrightDir() {
  const tries = [process.env.PLAYWRIGHT_CORE, join(ROOT, "atlas", "node_modules", "playwright-core")];
  const npx = join(homedir(), ".npm", "_npx");
  if (existsSync(npx)) {
    const found = readdirSync(npx).map((d) => join(npx, d, "node_modules", "playwright-core"))
      .filter((d) => existsSync(join(d, "package.json"))).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    tries.push(...found);
  }
  return tries.find((d) => d && existsSync(join(d, "package.json"))) ?? null;
}

function browserPath(pw) {
  const tries = [process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const own = (() => { try { return pw.executablePath(); } catch { return null; } })();
  tries.push(own);
  return tries.find((p) => p && existsSync(p)) ?? null;
}

const pwDir = playwrightDir();
if (!pwDir) {
  console.error("no playwright-core: set PLAYWRIGHT_CORE to its folder, or run  npx -y playwright-core --version  once (free)");
  process.exit(1);
}
const { chromium: pw } = createRequire(join(pwDir, "x.js"))("playwright-core");
const exe = browserPath(pw);
if (!exe) { console.error("no Chrome or Chromium found: set CHROME to its executable"); process.exit(1); }

const browser = await pw.launch({ executablePath: exe });
const blocked = [], errors = [];
async function open(viewport, dpr) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  await p.route("**/*", (r) => {
    const u = r.request().url();
    if (u.startsWith("file:") || u.startsWith("data:") || u.startsWith("blob:")) return r.continue();
    blocked.push(u);
    return r.abort();
  });
  p.on("pageerror", (e) => errors.push(String(e.message || e)));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(pathToFileURL(resolve(page_)).href + "?record=1");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  return { ctx, p };
}

// The screen's size in points, from the page itself.
let first = await open({ width: 400, height: 860 }, 1);
/* A page without SCREEN_PT (the two posts of 2026-10-14) is laid out at its body's size. */
const info = await first.p.evaluate(() => ({ pt: window.SCREEN_PT ?? [parseFloat(getComputedStyle(document.body).width), parseFloat(getComputedStyle(document.body).height)],
  seek: typeof window.seek, dur: window.DURATION, bg: getComputedStyle(document.body).backgroundColor }));
await first.ctx.close();
if (!Array.isArray(info.pt) || info.pt.length !== 2 || !(info.pt[0] > 0 && info.pt[1] > 0) || info.seek !== "function") {
  await browser.close();
  console.error("the page must set window.SCREEN_PT = [w, h] and window.seek(ms) (docs/character/motion-design.example.html)");
  process.exit(1);
}
const [wPt, hPt] = info.pt;
const dpr = FIT === "pad" ? Math.min(H / hPt, W / wPt) : W / wPt;
const vw = Math.ceil(wPt), vh = Math.ceil(hPt);
const pxW = Math.round(wPt * dpr / 2) * 2, pxH = Math.round(hPt * dpr / 2) * 2;
const rgb = (info.bg.match(/\d+(\.\d+)?/g) || ["0", "0", "0"]).slice(0, 3).map((x) => Math.round(Number(x)));
const padColor = "0x" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();

const { ctx, p } = await open({ width: vw, height: vh }, dpr);
const clip = { x: 0, y: 0, width: wPt, height: hPt };

// Where the hero is, in screen pixels, before the frame is placed.
async function heroAt(t) {
  await p.evaluate((ms) => window.seek(ms), t * 1000);
  return p.evaluate((d) => {
    const e = document.querySelector("[data-hero]");
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { text: e.innerText.replace(/\s+/g, " ").trim(), rect: [r.x * d, r.y * d, r.width * d, r.height * d] };
  }, dpr);
}
const hero = HERO_AT != null ? await heroAt(HERO_AT) : null;

// The placement of the screen in the 1080x1920 frame.
let place;
if (FIT === "pad") {
  const x = Math.round((W - pxW) / 2 / 2) * 2, y = Math.round((H - pxH) / 2 / 2) * 2;
  place = { vf: `scale=${pxW}:${pxH},pad=${W}:${H}:${x}:${y}:color=${padColor}`, dx: x, dy: y };
} else {
  const cy = hero ? hero.rect[1] + hero.rect[3] / 2 : pxH / 2;
  const y = Math.max(0, Math.min(pxH - H, Math.round(cy - H / 2))) & ~1;
  place = pxH >= H ? { vf: `scale=${pxW}:${pxH},crop=${W}:${H}:0:${y}`, dx: 0, dy: -y }
    : { vf: `scale=${pxW}:${pxH},pad=${W}:${H}:0:${(H - pxH) >> 1 & ~1}:color=${padColor}`, dx: 0, dy: (H - pxH) >> 1 & ~1 };
}

// The visible text at each probe time: what the frame says, for the story check.
const text = {};
for (const t of PROBE) {
  await p.evaluate((ms) => window.seek(ms), t * 1000);
  text[String(t)] = await p.evaluate(() => (document.body.innerText || "").split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean));
}

const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-vf", `${place.vf},setsar=1,format=yuv420p`, "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "14",
  "-tune", "animation", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const total = Math.round(SECONDS * FPS);
for (let f = 0; f < total; f++) {
  await p.evaluate((ms) => window.seek(ms), (f / FPS) * 1000);
  const png = await p.screenshot({ type: "png", clip });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
const code = await new Promise((r) => ff.on("close", r));
await ctx.close();
await browser.close();
if (code !== 0) { console.error(`ffmpeg failed (${code})`); process.exit(1); }

const run = {
  seconds: SECONDS, fps: FPS, frames: total, size: [W, H], fit: FIT, screen_pt: [wPt, hPt], dpr: Number(dpr.toFixed(4)),
  screen_px: [pxW, pxH], pad_color: padColor, page_duration_ms: info.dur ?? null,
  hero: hero ? { t: HERO_AT, text: hero.text, rect: [Math.round(hero.rect[0] + place.dx), Math.round(hero.rect[1] + place.dy), Math.round(hero.rect[2]), Math.round(hero.rect[3])] } : null,
  text, blocked, errors, browser: exe, playwright_core: pwDir,
};
const j = opt("--json");
if (j) writeFileSync(j, JSON.stringify(run, null, 2));
console.log(`wrote ${out}: ${total} frames, ${W}x${H}, fit ${FIT}${blocked.length ? `, ${blocked.length} request(s) blocked` : ""}`);
