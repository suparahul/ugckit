/**
 * The reaction library: library/reactions/reactions.json at the workspace root,
 * read live on every visit. scripts/planning/reactions.py writes the agent's
 * entries (status proposed); this file writes the user's: an entry added from a
 * post page (status kept), and the fields the user changes on the Reactions page
 * (Keep, Retire, the range, the tags, the note). The file is read again just
 * before every write, so an entry the agent wrote in the meantime stays. A field
 * the user set is listed in `set_by_you`, and an agent never changes it.
 *
 *   {"version": 1, "entries": {"rx-tiktok-7626442321860644127-0": {
 *     "id", "status": "proposed | kept | retired",
 *     "source": {"platform", "post_id", "handle", "url", "post_dir", "video", "video_sha256", "notes", "views", "date"},
 *     "start_s", "end_s", "length_s",            seconds in the post
 *     "expression_beats": [{"start_s", "end_s", "face", "eyes", "head"}],   seconds from start_s
 *     "framing": {"framing", "camera_distance", "camera", "people", "room", "cuts", "face_hidden_s"},
 *     "speech": "none | mouths words | speaks", "burned_in_text": [{"text", "where", "start_s", "end_s", "kind"}],
 *     "hook_text", "tags": [], "fit": {"face_replace": {"ok", "why"}, "written": {"ok", "why"}},
 *     "preview": "library/reactions/previews/<id>.jpg", "note", "added": {"by", "at", "from"},
 *     "set_by_you": [], "updated_at"}}}
 *
 * The video is never copied: an entry points to the post in research/ or in an
 * app's niche batches, and the page plays the range from there through /media.
 * The shape is docs/character/reaction.example.json; the tags and the tags of
 * each hook job are docs/character/reaction-tags.json. Picking an entry for a
 * video appends one `reaction.pick` line to the app's production log; video-plan
 * reads it and writes the brief's reaction_reference.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, sep } from "node:path";

import { APPS_DIR, CHARACTER_DIR, ROOT, readJson, readText } from "./root.ts";

export type Fit = { ok: boolean | null; why: string };
export type ExpressionBeat = { start_s: number; end_s: number; face: string; eyes: string; head: string };
export type Framing = { framing?: string | null; camera_distance?: string | null; camera?: string | null; people?: number | null; room?: string | null; cuts?: number | null; face_hidden_s?: number | null };
export type Entry = {
  id: string;
  status: "proposed" | "kept" | "retired";
  source: { platform: string; post_id: string; handle: string; url: string | null; post_dir: string; video: string; video_sha256: string | null; notes: string | null; views: number | null; date: string | null };
  start_s: number;
  end_s: number;
  length_s: number;
  expression_beats: ExpressionBeat[];
  framing: Framing;
  speech: "none" | "mouths words" | "speaks" | null;
  burned_in_text: { text: string; where: string | null; start_s?: number; end_s?: number; kind?: string }[];
  hook_text: string | null;
  tags: string[];
  fit: { face_replace?: Fit; written?: Fit };
  preview: string | null;
  note: string;
  added: { by: "you" | "agent"; at: string; from: string };
  set_by_you: string[];
  updated_at: string;
};
export type Library = { version: 1; entries: Record<string, Entry> };
export type TagFile = { tags: string[]; hook_jobs: Record<string, string[]> };
export const STATUSES = ["proposed", "kept", "retired"] as const;

export const LIB_DIR = join(ROOT, "library", "reactions");
export const LIB_FILE = join(LIB_DIR, "reactions.json");
const TAGS_FILE = join(ROOT, "docs", "character", "reaction-tags.json");

/* ------------------------------------------------------------------ pure */

/** The same rule as reactions.py compute_fit: face replace wants one face in view, silent, no cut, 1 to 30 s. */
export function computeFit(e: Pick<Entry, "framing" | "expression_beats" | "speech" | "length_s">): { face_replace: Fit; written: Fit } {
  const fr = e.framing ?? {};
  const beats = e.expression_beats ?? [];
  const ln = e.length_s;
  const unknown = ([["speech", e.speech], ["people", fr.people], ["cuts", fr.cuts], ["face_hidden_s", fr.face_hidden_s]] as const).filter(([, v]) => v === null || v === undefined).map(([k]) => k);
  let face: Fit;
  if (unknown.length) face = { ok: null, why: `not described yet: ${unknown.join(", ")}` };
  else {
    const no: string[] = [];
    if (fr.people !== 1) no.push(`${fr.people} people in the frame`);
    if (e.speech !== "none") no.push(`speech: ${e.speech}`);
    if (fr.cuts) no.push(`${fr.cuts} cut(s) inside the range`);
    if (typeof fr.face_hidden_s === "number" && fr.face_hidden_s > 0.3) no.push(`the face is hidden or the eyes closed for ${fr.face_hidden_s} s`);
    if (typeof ln === "number" && (ln < 1 || ln > 30)) no.push(`${ln} s long`);
    face = { ok: !no.length, why: no.length ? no.join("; ") : `one face, silent, no cut, ${ln} s` };
  }
  const written: Fit = e.speech === "speaks" ? { ok: false, why: "the person speaks; a reaction hook is never spoken" } : !beats.length ? { ok: null, why: "no expression beats yet" } : { ok: true, why: `${beats.length} expression beat(s)` };
  return { face_replace: face, written };
}

export const fitWord = (f: Fit | undefined) => (f?.ok === true ? "fits" : f?.ok === false ? "no" : "not known yet");

export const entryId = (platform: string, postId: string, startS: number) => `rx-${platform}-${postId}-${Math.round(startS * 10)}`;

export const validEntryId = (id: unknown): id is string => typeof id === "string" && /^rx-[a-z]+-[\w.-]{1,80}-\d{1,6}$/.test(id);

/** research/x → /media/x; apps/<slug>/niche/batches/… → /media/apps/…; anything else is not served. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const p = path.split(sep).join("/");
  if (p.startsWith("research/")) return "/media/" + p.slice("research/".length).split("/").map(encodeURIComponent).join("/");
  if (/^apps\/[^/]+\/niche\/batches\//.test(p)) return "/media/" + p.split("/").map(encodeURIComponent).join("/");
  return null;
}

/** The reverse of mediaUrl: a /media URL of a post's video into its workspace path, or null. */
export function workspacePathOf(url: string): string | null {
  const m = url.match(/^\/media\/(.+)$/);
  if (!m) return null;
  let raw: string;
  try {
    raw = normalize(m[1].split("/").map(decodeURIComponent).join("/"));
  } catch {
    return null;
  }
  if (raw.startsWith("..") || raw.includes(`${sep}..${sep}`)) return null;
  const path = raw.startsWith("apps/") ? raw : `research/${raw}`;
  return servedPostPath(path) ? path : null;
}

/** A library entry points only into research/ or an app's niche batches (reactions.py served()). */
export const servedPostPath = (p: string) => (p.startsWith("research/") || /^apps\/[^/]+\/niche\/batches\//.test(p)) && !p.split("/").includes("..");

/** The app a post belongs to: research/<slug>/… or apps/<slug>/…. */
export const appOfPost = (postDir: string) => postDir.split("/")[1] ?? "";

export type Filter = { tag?: string; job?: string; fit?: "face_replace" | "written" | ""; maxS?: number | null; status?: string; app?: string; unused?: boolean };

/** The entries a filter keeps, best first: kept, then the tags matched, then face replace fits, then views (reactions.py ranked). */
export function filterEntries(entries: Entry[], f: Filter, jobs: Record<string, string[]>, uses: Record<string, string[]> = {}): Entry[] {
  const want = new Set<string>([...(f.tag ? [f.tag] : []), ...(f.job ? jobs[f.job] ?? [] : [])]);
  const out = entries.filter((e) => {
    if (f.status ? e.status !== f.status : e.status === "retired") return false;
    if (want.size && !e.tags.some((t) => want.has(t))) return false;
    if (f.fit && e.fit?.[f.fit]?.ok !== true) return false;
    if (f.maxS && e.length_s > f.maxS) return false;
    if (f.app && appOfPost(e.source.post_dir) !== f.app) return false;
    if (f.unused && (uses[e.id]?.length ?? 0) > 0) return false;
    return true;
  });
  const score = (e: Entry): number[] => [e.status === "kept" ? 1 : 0, e.tags.filter((t) => want.has(t)).length, e.fit?.face_replace?.ok === true ? 1 : 0, e.source.views ?? 0];
  return out.sort((a, b) => {
    const x = score(a), y = score(b);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i];
    return a.id.localeCompare(b.id);
  });
}

export type Change = { status?: Entry["status"]; start_s?: number; end_s?: number; tags?: string[]; note?: string };

/** The user's change to one entry: validated, applied, and each field named in set_by_you. Returns an error string or the new entry. */
export function applyChange(e: Entry, c: Change, tags: string[], at: string, videoLength: number | null = null): Entry | string {
  const next: Entry = { ...e, set_by_you: [...(e.set_by_you ?? [])] };
  const mine = (k: string) => { if (!next.set_by_you.includes(k)) next.set_by_you.push(k); };
  if (c.status !== undefined) {
    if (!STATUSES.includes(c.status)) return `status is one of ${STATUSES.join(", ")}`;
    next.status = c.status;
    mine("status");
  }
  if (c.start_s !== undefined || c.end_s !== undefined) {
    const s = c.start_s ?? e.start_s, en = c.end_s ?? e.end_s;
    if (!(Number.isFinite(s) && Number.isFinite(en) && s >= 0 && s < en)) return "The range starts before it ends, from 0 s.";
    if (videoLength !== null && en > videoLength + 0.05) return `The video is ${videoLength.toFixed(2)} s long.`;
    next.start_s = Math.round(s * 100) / 100;
    next.end_s = Math.round(en * 100) / 100;
    next.length_s = Math.round((next.end_s - next.start_s) * 100) / 100;
    mine("start_s");
    mine("end_s");
    /* The beats were read from the old range: those that fall outside the new one are dropped, and the agent describes it again. */
    next.expression_beats = (e.expression_beats ?? []).filter((b) => b.end_s <= next.length_s + 0.05);
  }
  if (c.tags !== undefined) {
    const bad = c.tags.filter((t) => !tags.includes(t));
    if (bad.length) return `Unknown tag: ${bad.join(", ")}.`;
    next.tags = [...new Set(c.tags)];
    mine("tags");
  }
  if (c.note !== undefined) {
    next.note = c.note.slice(0, 1000);
    mine("note");
  }
  next.fit = computeFit(next);
  next.updated_at = at;
  return next;
}

/** platform, post id, handle, url, views and date from a post folder's notes.md and post.json text (reactions.py source_of). */
export function sourceOf(video: string, notes: string | null, postJson: string | null): Entry["source"] {
  const postDir = dirname(video).split(sep).join("/");
  const postId = basename(postDir);
  const handle = basename(dirname(postDir));
  const platform = `/${postDir}/`.includes("/instagram/") ? "instagram" : "tiktok";
  const src: Entry["source"] = { platform, post_id: postId, handle: "@" + handle.replace(/^@/, ""), url: null, post_dir: postDir, video, video_sha256: null, notes: notes !== null ? `${postDir}/notes.md` : null, views: null, date: null };
  if (notes) {
    src.url = notes.match(/URL:\s*(\S+)/)?.[1] ?? null;
    const v = notes.match(/Views:\s*([\d,]+)/)?.[1];
    src.views = v ? Number(v.replace(/,/g, "")) : null;
    src.date = notes.match(/Posted:\s*(\d{4}-\d\d-\d\d)/)?.[1] ?? null;
  }
  if (postJson) {
    try {
      const p = JSON.parse(postJson) as Record<string, unknown>;
      src.url ??= typeof p.inputSource === "string" ? p.inputSource : typeof p.url === "string" ? p.url : null;
      if (src.views === null && typeof p.views === "number") src.views = p.views;
    } catch { /* a post.json that does not parse leaves the notes' values */ }
  }
  if (!src.url && platform === "tiktok") src.url = `https://www.tiktok.com/${src.handle}/video/${postId}`;
  return src;
}

/** A new entry the user added from a post page: kept, by you, with only what the user gave. */
export function newEntry(src: Entry["source"], startS: number, endS: number, tags: string[], note: string, at: string): Entry {
  const e: Entry = {
    id: entryId(src.platform, src.post_id, startS), status: "kept", source: src,
    start_s: Math.round(startS * 100) / 100, end_s: Math.round(endS * 100) / 100, length_s: Math.round((endS - startS) * 100) / 100,
    expression_beats: [], framing: { framing: null, camera_distance: null, camera: null, people: null, room: null, cuts: null, face_hidden_s: null },
    speech: null, burned_in_text: [], hook_text: null, tags: [...new Set(tags)], fit: {}, preview: null, note,
    added: { by: "you", at, from: "atlas" }, set_by_you: ["status", "start_s", "end_s", "tags", ...(note ? ["note"] : [])], updated_at: at,
  };
  e.fit = computeFit(e);
  return e;
}

/* -------------------------------------------------------------- the files */

export function readTags(): TagFile {
  return readJson<TagFile>(TAGS_FILE) ?? { tags: [], hook_jobs: {} };
}

export function readLibrary(): Library {
  const lib = readJson<Library>(LIB_FILE);
  return lib && typeof lib === "object" && lib.entries ? lib : { version: 1, entries: {} };
}

export function writeLibrary(lib: Library): void {
  mkdirSync(LIB_DIR, { recursive: true });
  const tmp = join(LIB_DIR, `.tmp-${process.pid}-${Date.now()}`);
  writeFileSync(tmp, JSON.stringify(lib, null, 2) + "\n");
  renameSync(tmp, LIB_FILE);
}

export const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/** The video's length by ffprobe (free, local), or null when ffprobe is not there. */
export function videoLength(abs: string): number | null {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", abs], { encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "ignore"] });
    const n = Number(out.trim());
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Add an entry from a post page. The video must be a post's video on disk, in research/ or a niche batch. */
export function addFromPost(video: string, startS: number, endS: number, tags: string[], note: string): Entry | string {
  if (!servedPostPath(video)) return "Only a post's video in research/ or a niche batch can go in the library.";
  const abs = join(ROOT, video);
  if (!existsSync(abs)) return "The video is not on disk. Fetch the post first.";
  const known = readTags().tags;
  const bad = tags.filter((t) => !known.includes(t));
  if (bad.length) return `Unknown tag: ${bad.join(", ")}.`;
  if (!(Number.isFinite(startS) && Number.isFinite(endS) && startS >= 0 && startS < endS)) return "The range starts before it ends, from 0 s.";
  const len = videoLength(abs);
  if (len !== null && endS > len + 0.05) return `The video is ${len.toFixed(2)} s long.`;
  const dir = dirname(abs);
  const src = sourceOf(video, readText(join(dir, "notes.md")), readText(join(dir, "post.json")));
  src.video_sha256 = sha256File(abs);
  const e = newEntry(src, startS, endS, tags, note.slice(0, 1000), nowIso());
  const lib = readLibrary();
  if (lib.entries[e.id]) return `This range is in the library already (${e.id}).`;
  lib.entries[e.id] = e;
  writeLibrary(lib);
  return e;
}

/** The user's change to one entry, written at once. */
export function changeEntry(id: string, c: Change): Entry | string {
  const lib = readLibrary();
  const e = lib.entries[id];
  if (!e) return "No such entry.";
  const range = c.start_s !== undefined || c.end_s !== undefined;
  const next = applyChange(e, c, readTags().tags, nowIso(), range ? videoLength(join(ROOT, e.source.video)) : null);
  if (typeof next === "string") return next;
  lib.entries[id] = next;
  writeLibrary(lib);
  return next;
}

/** The videos that use each entry: the briefs' reaction_reference and the locked plans' reaction_refs. Computed, never stored. */
export function usesOf(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (id: unknown, video: string) => {
    if (typeof id !== "string" || !id) return;
    (out[id] ??= []).includes(video) || out[id].push(video);
  };
  for (const slug of dirsIn(APPS_DIR)) {
    const plans = join(APPS_DIR, slug, "production", "video-plans");
    for (const v of dirsIn(plans)) {
      const b = readJson<any>(join(plans, v, "brief.json"));
      add(b?.reaction_reference?.library_id, v);
      const d = readJson<any>(join(plans, v, "plan.draft.json"));
      for (const r of d?.reaction_refs ?? []) add(r?.library_id, v);
    }
  }
  for (const v of dirsIn(CHARACTER_DIR)) {
    const p = readJson<any>(join(CHARACTER_DIR, v, "plan.json"));
    for (const r of p?.reaction_refs ?? []) add(r?.library_id, v);
  }
  return out;
}

export type PlanningVideo = { app: string; video: string; post: string | null; job: string | null; reaction: boolean; picked: string | null };

/** The videos in planning (a brief, no locked plan yet), with a reaction hook first: the ones an entry can be picked for. */
export function planningVideos(): PlanningVideo[] {
  const out: PlanningVideo[] = [];
  for (const slug of dirsIn(APPS_DIR)) {
    const plans = join(APPS_DIR, slug, "production", "video-plans");
    for (const v of dirsIn(plans)) {
      const b = readJson<any>(join(plans, v, "brief.json"));
      if (!b) continue;
      const locked = readJson<any>(join(CHARACTER_DIR, v, "plan.json"));
      if (locked?.approved?.words) continue;
      const hook = b.anatomy?.hook ?? {};
      out.push({ app: slug, video: v, post: typeof b.strategy_ref?.post === "string" ? b.strategy_ref.post : null, job: typeof hook.job_id === "string" ? hook.job_id : null, reaction: hook.channel === "reaction", picked: lastPick(slug, v) });
    }
  }
  return out.sort((a, b) => Number(b.reaction) - Number(a.reaction) || a.video.localeCompare(b.video));
}

const logOf = (slug: string) => join(APPS_DIR, slug, "production", "log.jsonl");

/** The entry of the last user `reaction.pick` line for a video, or null. */
export function lastPick(slug: string, video: string): string | null {
  const text = readText(logOf(slug));
  if (!text) return null;
  let id: string | null = null;
  for (const ln of text.split("\n")) {
    if (!ln.includes('"reaction.pick"')) continue;
    try {
      const e = JSON.parse(ln);
      if (e.kind === "reaction.pick" && !e.actor && e.data?.video === video) id = e.data.entry_id ?? null;
    } catch { /* a torn line is skipped, as everywhere in the log */ }
  }
  return id;
}

/** The user's pick of an entry for a video in planning: one line in the app's production log. video-plan reads it. */
export function appendPick(slug: string, video: string, entryIdOf: string, post: string | null, note: string): Record<string, unknown> {
  const line: Record<string, unknown> = { at: new Date().toISOString(), ...(post ? { post } : {}), kind: "reaction.pick", ...(note ? { note: note.slice(0, 1000) } : {}), data: { video, entry_id: entryIdOf } };
  mkdirSync(dirname(logOf(slug)), { recursive: true });
  appendFileSync(logOf(slug), JSON.stringify(line) + "\n");
  return line;
}

function dirsIn(p: string): string[] {
  try {
    return readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
  } catch {
    return [];
  }
}

/** The library entries of one post, for its post page. */
export function entriesOfPost(platform: string, postId: string): { id: string; start: number; end: number; status: string }[] {
  return Object.values(readLibrary().entries)
    .filter((e) => e.source.platform === platform && e.source.post_id === postId)
    .map((e) => ({ id: e.id, start: e.start_s, end: e.end_s, status: e.status }));
}
