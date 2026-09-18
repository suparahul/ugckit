/**
 * "Export files": the finished post as a folder a person can post from by
 * hand — ~/Downloads/tiktok-<date>-<handle>-<n>/ with slide-01..NN.png,
 * cover-text.txt, caption.txt and a README.txt checklist. Re-runs the
 * compositor first, so the files match the log. Appends an `export` line
 * (data.dir) so the page can say "Exported to … · open". Server-side only.
 */

import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { allStates, appendEvent, filesRoot, fileKey, type PostState } from "./production.ts";

const run = promisify(execFile);

export const EXPORT_ROOT = join(homedir(), "Downloads");

/** ~/Downloads/tiktok-2026-09-16-hannah-1, shown as ~/Downloads/… */
export function exportDir(s: PostState): string {
  return join(EXPORT_ROOT, `tiktok-${fileKey(s.row.key)}`);
}

export const tilde = (p: string) => (p.startsWith(homedir()) ? "~" + p.slice(homedir().length) : p);

function readme(s: PostState, slides: number, coverLines: string, hashtags: string[]): string {
  const d = s.deck!;
  const { w, h } = s.dimension === "3:4" ? { w: 1080, h: 1440 } : { w: 1080, h: 1920 };
  const product = d.slides.find((x) => x.isProduct);
  const lines = [
    `${s.row.handle} — ${s.row.slot} post, ${s.row.date}`,
    `"${d.title}"`,
    `Post key ${s.row.key}. Deck: ${s.deckFile?.file ?? "production/decks/…"}.`,
    ``,
    `FILES`,
    `  slide-01.png … slide-${String(slides).padStart(2, "0")}.png   post in this order. ${w} x ${h} each. Slides 2–${slides} have the text burned in.`,
    `  cover-text.txt                slide 1 has no text in the PNG. Type this in the TikTok editor on slide 1`,
    `                                (big, white, outline), ${coverLines}.`,
    `  caption.txt                   the caption with the hashtags. Paste as is.`,
    ``,
    `POSTING CHECKLIST (from the deck)`,
    `  [ ] Photo mode, ${slides} slides, in order.`,
    `  [ ] Slide 1: type the cover text from cover-text.txt in the editor. No text on the PNG.`,
    d.sound ? `  [ ] Sound: ${d.sound}` : `  [ ] Sound: a library track. Never an original sound of the handle.`,
    `  [ ] Caption: paste caption.txt.${hashtags.length ? ` One line + ${hashtags.join(" ")}.` : ""}`,
    product ? `  [ ] The app appears only on slide ${product.n} (the sentence + the App Store card). Nothing on slide 1, nothing on the last slide.` : `  [ ] No product slot on this post.`,
    d.ask ? `  [ ] Last slide ask: ${d.ask}` : null,
    `  [ ] After posting: mark it posted in the Atlas ("Mark as manually posted"), and add the URL when you have it.`,
    ``,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

export type ExportReport = { dir: string; files: string[] };

export async function exportPost(slug: string, key: string, opts: { compose?: boolean } = {}): Promise<ExportReport> {
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state) throw new Error(`No post ${key}.`);
  if (!state.deck) throw new Error("No deck.");
  if (opts.compose !== false) {
    const { stdout } = await run("node", ["scripts/render-slides.mjs", slug, key], { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });
    if (/skipped/.test(stdout)) throw new Error(`The compositor skipped: ${stdout.trim().split("\n").find((l) => /skipped/.test(l))}`);
  }
  const src = join(filesRoot(slug), fileKey(key), "final");
  const slides = state.deck.slides.map((x) => `slide-${String(x.n).padStart(2, "0")}.png`);
  const names = [...slides, "cover-text.txt", "caption.txt"];
  const missing = names.filter((n) => !existsSync(join(src, n)));
  if (missing.length) throw new Error(`final/ is missing ${missing.join(", ")}.`);

  const dir = exportDir(state);
  mkdirSync(dir, { recursive: true });
  for (const n of names) copyFileSync(join(src, n), join(dir, n));
  const cover = readFileSync(join(src, "cover-text.txt"), "utf8").trim();
  const n = cover ? cover.split(/\n+/).length : 0;
  const coverLines = n ? `${n} line${n === 1 ? "" : "s"} as written` : "no cover text";
  writeFileSync(join(dir, "README.txt"), readme(state, slides.length, coverLines, state.deck.hashtags ?? []));
  appendEvent(slug, { post: key, kind: "export", actor: "agent", data: { dir } });
  return { dir, files: [...names, "README.txt"] };
}

/** Opens the post's last export folder in the Finder (macOS). Elsewhere the path is returned for the page to print. Only a folder under ~/Downloads that exists. */
export async function openExport(slug: string, key: string): Promise<string> {
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state?.exported) throw new Error("Not exported yet.");
  const dir = resolve(state.exported.dir);
  if (!dir.startsWith(EXPORT_ROOT + "/") || !existsSync(dir)) throw new Error(`The folder is gone: ${tilde(dir)}. Export again.`);
  if (process.platform === "darwin") await run("open", [dir]);
  return dir;
}
