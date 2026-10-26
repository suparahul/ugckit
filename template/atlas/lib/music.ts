/**
 * The music library a reel can carry: assets/music/<group>/<track> (assets/music/README.md). A folder is a group; a
 * file at the top of assets/music is in the group "other". Read by the post page's Music dropdown and its route; the
 * mixing itself is scripts/add-audio.mjs.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./root.ts";

export const MUSIC_DIR = join(ROOT, "assets", "music");
const AUDIO = /\.(mp3|m4a|wav|aac|ogg)$/i;

/** A track: its path under assets/music (what a `music.set` line holds), the name shown, its group. */
export type MusicTrack = { file: string; label: string; group: string };

/** "px-vox-family-trip-230607.mp3" → "Family trip (vocals)": the source tags and the page id dropped. */
export function trackLabel(file: string): string {
  const base = file.split("/").pop()!.replace(AUDIO, "");
  const vox = /(^|-)vox-/.test(base);
  const words = base.replace(/^(\d+-)?(px-)?(vox-)?/, "").replace(/-\d{5,}$/, "").replace(/[-_]+/g, " ").trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}${vox ? " (vocals)" : ""}` || base;
}

/** Every track, the group named first listed first (a handle's `Music:` group), then the others by name. */
export function listTracks(first: string | null = null, dir: string = MUSIC_DIR): MusicTrack[] {
  if (!existsSync(dir)) return [];
  const out: MusicTrack[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      for (const f of readdirSync(join(dir, e.name))) if (AUDIO.test(f) && !f.startsWith(".")) out.push({ file: `${e.name}/${f}`, label: trackLabel(f), group: e.name });
    } else if (AUDIO.test(e.name)) out.push({ file: e.name, label: trackLabel(e.name), group: "other" });
  }
  const rank = (g: string) => (g === first ? 0 : g === "other" ? 2 : 1);
  out.sort((a, b) => rank(a.group) - rank(b.group) || a.group.localeCompare(b.group) || a.label.localeCompare(b.label) || a.file.localeCompare(b.file));
  /* Two tracks of a group with the same name ("Lullaby" from four Pixabay pages) are numbered, so the list tells them apart. */
  const seen = new Map<string, number>(), count = new Map<string, number>();
  for (const t of out) count.set(`${t.group}/${t.label}`, (count.get(`${t.group}/${t.label}`) ?? 0) + 1);
  for (const t of out) {
    const k = `${t.group}/${t.label}`;
    if ((count.get(k) ?? 0) < 2) continue;
    const i = (seen.get(k) ?? 0) + 1;
    seen.set(k, i);
    t.label = `${t.label} ${i}`;
  }
  return out;
}

/** The track a `music.set` line names, if it is still in the library: a path under assets/music, never outside it. */
export function isTrack(file: string, dir: string = MUSIC_DIR): boolean {
  return listTracks(null, dir).some((t) => t.file === file);
}

export const AUDIO_TYPE: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg" };
