/**
 * A slideshow's reel, made from the slides as they are now: scripts/render-slides.mjs --reel writes the reel's frames
 * (reel/, the cover text burned in), scripts/photo-reel.mjs cuts video/reel-final.mp4 from them, and lays the post's music under it
 * (the `music.set` line, else the handle's `Music:` group). Used by the post page's "Rebuild the reel" and by the send,
 * which cuts it again from the slides it sends, so a slide edited after the last cut never goes out in an old reel.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import { appendEvent, type Event, type PostState } from "./production.ts";
import { appDir, headLines, readText, ROOT } from "./root.ts";

const run = promisify(execFile);

export type ReelHolds = { hold: number; hookHold: number; productHold: number };
export const HOLD_MIN = 1, HOLD_MAX = 12;

/** One field of seconds: a number from 1 to 12, else null (an empty or wrong field is refused, never read as 0). */
export function holdOf(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x >= HOLD_MIN && x <= HOLD_MAX ? x : null;
}

/** The seconds a slide is held: the post's last `reel.set` line, else 4 s a slide and 5 s on the hook and the product slide. */
export function reelHolds(log: Event[]): ReelHolds {
  const saved = [...log].reverse().find((e) => e.kind === "reel.set")?.data;
  return { hold: holdOf(saved?.hold) ?? 4, hookHold: holdOf(saved?.hookHold) ?? 5, productHold: holdOf(saved?.productHold) ?? 5 };
}

/** The handle's `Music:` line (HANDLE.md): the folder of assets/music its reels pick a track from, or null. */
export function musicGroupOf(slug: string, handle: string): string | null {
  const dir = handle.replace(/^@/, "");
  if (!/^[\w.-]+$/.test(dir) || dir.includes("..")) return null;
  const md = readText(join(appDir(slug), "handles", dir, "HANDLE.md"));
  return md ? headLines(md)["Music"]?.trim().split(/\s+/)[0]?.toLowerCase() || null : null;
}

const tail = (e: unknown, n: number) => {
  const err = e as { stderr?: string; stdout?: string; message?: string };
  return (err.stderr || err.stdout || err.message || "unknown error").toString().trim().split("\n").slice(-n).join(" ");
};

/**
 * Renders the reel's frames and cuts the reel (photo-reel.mjs). With `render`, the finals are made again first. With `holds`, they are
 * written down as a `reel.set` line (actor user) and used. Throws with the scripts' last lines.
 */
export async function makeReel(slug: string, state: PostState, opts: { render?: boolean; holds?: ReelHolds } = {}): Promise<{ slides: number; seconds: number; note: string }> {
  const key = state.row.key;
  const deck = state.deck;
  if (!deck || deck.slides.length < 2) throw new Error("Only a slideshow of two or more slides can be cut into a reel.");
  const env = { ...process.env, ATLAS_ROOT: ROOT };
  /* The finals again (the post page's rebuild), then always the reel's own frames: the cover text burned in. */
  const render = async (extra: string[]) => {
    try { await run("node", [join(ROOT, "scripts", "render-slides.mjs"), slug, key, "--force", ...extra], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, env }); }
    catch (e) { throw new Error(`The slides could not be rendered: ${tail(e, 3)}`); }
  };
  if (opts.render) await render(state.platforms.includes("instagram") ? ["--instagram"] : []);
  await render(["--reel"]);
  if (opts.holds) appendEvent(slug, { post: key, kind: "reel.set", actor: "user", data: { ...opts.holds } });
  const { hold, hookHold, productHold } = opts.holds ?? reelHolds(state.log);
  const product = deck.slides.find((s) => s.isProduct)?.n ?? 0; /* final/slide-NN is numbered by the slide's own n */
  const at = [`1=${hookHold}`, ...(product > 1 ? [`${product}=${productHold}`] : [])].join(",");
  const music = musicGroupOf(slug, state.row.handle);
  try {
    const r = await run("node", [join(ROOT, "scripts", "photo-reel.mjs"), slug, key, "--hold", String(hold), "--at", at, "--pad", "auto", ...(music ? ["--music", music] : [])], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, env });
    const n = deck.slides.length;
    const seconds = hookHold + (product > 1 ? productHold : 0) + (n - 1 - (product > 1 ? 1 : 0)) * hold;
    return { slides: n, seconds, note: r.stdout.trim().split("\n").pop() ?? "" };
  } catch (e) {
    throw new Error(`The reel could not be made: ${tail(e, 2)}`);
  }
}
