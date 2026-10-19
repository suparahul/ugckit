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
 *     "hook_text", "tags": [],
 *     "preview": "library/reactions/previews/<id>.jpg", "note", "added": {"by", "at", "from"},
 *     "set_by_you": [], "updated_at"}}}
 *
 * The video is never copied: an entry points to the post in research/ or in an
 * app's niche batches, and the page plays the range from there through /media.
 * The shape is docs/character/reaction.example.json; the tags and the tags of
 * each hook job are docs/character/reaction-tags.json. Picking an entry for a
 * video appends one `reaction.pick` line to the app's production log; video-plan
 * reads it and writes the brief's reaction_reference. Every reaction is made by
 * motion copy: the character copies the motion of the range, so an entry has no
 * route fit, and a visible face is not a requirement.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, sep } from "node:path";

import { APPS_DIR, CHARACTER_DIR, ROOT, readJson, readText } from "./root.ts";
import { matches, terms } from "./search.ts";

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

export type Filter = { tag?: string; job?: string; maxS?: number | null; status?: string; app?: string; unused?: boolean; q?: string };

/** The words a search looks in: the handle, the tags, the note, the hook and the burned-in text, the beats. */
export const searchText = (e: Pick<Entry, "id" | "source" | "tags" | "note" | "hook_text" | "burned_in_text" | "expression_beats">) =>
  [e.id, e.source.handle, ...(e.tags ?? []), e.note ?? "", e.hook_text ?? "", ...(e.burned_in_text ?? []).map((b) => b.text), ...(e.expression_beats ?? []).map((b) => `${b.face} ${b.eyes} ${b.head}`)].join(" ").toLowerCase();

/** The Atlas's search (lib/search.ts): every word, and every "quoted phrase", somewhere in the entry's text. */
export const matchesSearch = (text: string, q: string | undefined) => !q || matches(terms(q), [text]);

/** The entries a filter keeps, best first: kept, then the tags matched, then views (reactions.py ranked). */
export function filterEntries(entries: Entry[], f: Filter, jobs: Record<string, string[]>, uses: Record<string, string[]> = {}): Entry[] {
  const want = new Set<string>([...(f.tag ? [f.tag] : []), ...(f.job ? jobs[f.job] ?? [] : [])]);
  const out = entries.filter((e) => {
    if (f.status ? e.status !== f.status : e.status === "retired") return false;
    if (want.size && !e.tags.some((t) => want.has(t))) return false;
    if (f.maxS && e.length_s > f.maxS) return false;
    if (f.app && appOfPost(e.source.post_dir) !== f.app) return false;
    if (f.unused && (uses[e.id]?.length ?? 0) > 0) return false;
    if (f.q && !matchesSearch(searchText(e), f.q)) return false;
    return true;
  });
  const score = (e: Entry): number[] => [e.status === "kept" ? 1 : 0, e.tags.filter((t) => want.has(t)).length, e.source.views ?? 0];
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
  return {
    id: entryId(src.platform, src.post_id, startS), status: "kept", source: src,
    start_s: Math.round(startS * 100) / 100, end_s: Math.round(endS * 100) / 100, length_s: Math.round((endS - startS) * 100) / 100,
    expression_beats: [], framing: { framing: null, camera_distance: null, camera: null, people: null, room: null, cuts: null, face_hidden_s: null },
    speech: null, burned_in_text: [], hook_text: null, tags: [...new Set(tags)], preview: null, note,
    added: { by: "you", at, from: "atlas" }, set_by_you: ["status", "start_s", "end_s", "tags", ...(note ? ["note"] : [])], updated_at: at,
  };
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

/** How many entries each option of each filter would show, the other filters as they are: the counts beside the options. */
export type FacetCounts = { tag: Record<string, number>; job: Record<string, number>; max: Record<string, number>; status: Record<string, number>; app: Record<string, number>; unused: number; any: Record<string, number> };

export function facetCounts(entries: Entry[], f: Filter, jobs: Record<string, string[]>, tags: string[], apps: string[], uses: Record<string, string[]> = {}): FacetCounts {
  const n = (patch: Filter) => filterEntries(entries, { ...f, ...patch }, jobs, uses).length;
  return {
    tag: Object.fromEntries(tags.map((t) => [t, n({ tag: t })])),
    job: Object.fromEntries(Object.keys(jobs).map((j) => [j, n({ job: j })])),
    max: Object.fromEntries([2, 3, 5, 10].map((m) => [String(m), n({ maxS: m })])),
    status: Object.fromEntries(STATUSES.map((s) => [s, n({ status: s })])),
    app: Object.fromEntries(apps.map((a) => [a, n({ app: a })])),
    unused: n({ unused: true }),
    /* Each filter set back to "any": what removing it would show. */
    any: { tag: n({ tag: "" }), job: n({ job: "" }), max: n({ maxS: null }), status: n({ status: "" }), app: n({ app: "" }), unused: n({ unused: false }), q: n({ q: "" }) },
  };
}

/* ------------------------------------------------------- the reaction card */

/** One reaction as the stage panels and the timeline show it: a library entry, or a plan's reference with no entry. */
export type ReactionCard = {
  /** The library entry, or null for a reference that is not in the library. */
  entryId: string | null;
  status: Entry["status"] | null;
  handle: string;
  start: number;
  end: number;
  /** The post's video, served (/media/…); the card plays start–end of it in a loop. */
  video: string | null;
  /** The entry's preview sheet, or a sheet or the cover in the post's folder. */
  preview: string | null;
  tags: string[];
  beats: { start_s: number; end_s: number; face: string; eyes: string; head: string }[];
  burnedIn: string[];
  /** The post in the Atlas, and the post on its platform. */
  postHref: string | null;
  url: string | null;
  /** For a reference with no library_id: an entry of the same post, if the library has one. */
  sameIn: string | null;
};

/** Where a post is in the Atlas: a niche batch post has its niche page; a research post has /post/<id>. */
export function atlasPostHref(dir: string, platform: string, id: string): string | null {
  const m = dir.match(/^apps\/([^/]+)\/niche\/batches\//);
  if (m) return `/app/${encodeURIComponent(m[1])}/niche/post/${platform}/${encodeURIComponent(id)}`;
  return dir.startsWith("research/") ? `/post/${encodeURIComponent(id)}` : null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() && !/^<.*>$/.test(v.trim()) ? v : null);

export function cardOfEntry(e: Entry): ReactionCard {
  const s = e.source;
  return {
    entryId: e.id, status: e.status, handle: s.handle, start: e.start_s, end: e.end_s, video: mediaUrl(s.video),
    preview: e.preview ? `/api/reactions/preview/${e.id}` : null, tags: e.tags ?? [], beats: e.expression_beats ?? [],
    burnedIn: (e.burned_in_text ?? []).map((b) => `“${b.text}”${b.where ? `, ${b.where}` : ""}`),
    postHref: atlasPostHref(s.post_dir, s.platform, s.post_id), url: s.url, sameIn: null,
  };
}

/** A picture of the post already on disk: a contact sheet, else the cover. */
function postPicture(dir: string): string | null {
  if (!servedPostPath(dir)) return null;
  for (const f of ["sheet-1.jpg", "sheet_01.png", "sheet_01.jpg", "sheet-1.png", "cover.jpg", "cover.png", "thumbnail.jpg"]) {
    if (existsSync(join(ROOT, dir, f))) return mediaUrl(`${dir}/${f}`);
  }
  return null;
}

/**
 * The card of a brief's reaction_reference or a plan's reaction_refs item. With a
 * library_id the library entry gives it (the reference's range when the plan has
 * library_differs); else the reference's own fields, the post's video and a picture from
 * its folder. `beats` are the plan's expression beats for it, when the caller has them.
 */
export function reactionCardOf(r: any, beats: ReactionCard["beats"] = [], lib: Library = readLibrary()): ReactionCard | null {
  if (!r || typeof r !== "object") return null;
  const e = validEntryId(r.library_id) ? lib.entries[r.library_id] : undefined;
  if (e) {
    const c = cardOfEntry(e);
    const s = num(r.start_s), z = num(r.end_s);
    return { ...c, ...(r.library_differs && s !== null && z !== null ? { start: s, end: z } : {}) };
  }
  const dir = String(r.post_dir ?? "");
  const video = text(r.video) ?? text(r.video_path);
  const platform = String(r.platform ?? "tiktok");
  const postId = String(r.post_id ?? "");
  const start = num(r.start_s) ?? 0;
  const end = num(r.end_s) ?? start;
  const same = Object.values(lib.entries).find((x) => x.source.platform === platform && x.source.post_id === postId && x.start_s < end && x.end_s > start);
  const bt = text(r.burned_in_text);
  return {
    entryId: null, status: null, handle: String(r.handle ?? "?"), start, end, video: video ? mediaUrl(video) : null,
    preview: dir ? postPicture(dir) : null, tags: same?.tags ?? [], beats, burnedIn: bt ? [bt] : [],
    postHref: dir && postId ? atlasPostHref(dir, platform, postId) : null,
    url: postId && r.handle ? `https://www.tiktok.com/@${String(r.handle).replace(/^@/, "")}/video/${postId}` : null, sameIn: same?.id ?? null,
  };
}

/** A plan's expression beats for one reference (beats[].reaction with that ref_id), timed from the reference's start (ref_s). */
export function planBeatsOf(plan: any, refId: string, refStart: number): ReactionCard["beats"] {
  const out: ReactionCard["beats"] = [];
  for (const b of plan?.beats ?? []) {
    if (b?.reaction?.ref_id !== refId) continue;
    for (const x of b.reaction.expression_beats ?? []) {
      const at = Array.isArray(x?.ref_s) ? x.ref_s.map((t: unknown) => (num(t) === null ? null : (t as number) - refStart)) : [num(x?.start_s), num(x?.end_s)];
      const [s, z] = [at[0] === null ? null : Math.round(at[0] * 100) / 100, at[1] === null ? null : Math.round(at[1] * 100) / 100];
      if (s === null || z === null) continue;
      out.push({ start_s: s, end_s: z, face: String(x.face ?? ""), eyes: String(x.eyes ?? ""), head: String(x.head ?? "") });
    }
  }
  return out;
}

/** One card of the library grid: the Reactions page and the Switch reaction panel of a post page. */
export type GridCard = {
  id: string;
  status: Entry["status"];
  start: number;
  end: number;
  length: number;
  tags: string[];
  preview: string | null;
  video: string | null;
  handle: string;
  views: number | null;
  app: string;
  beats: number;
  hookText: string | null;
  note: string;
  uses: string[];
  by: "you" | "agent";
  /** searchText(), for a search in the browser. */
  text: string;
};

export function gridCardOf(e: Entry, uses: Record<string, string[]>): GridCard {
  return {
    id: e.id, status: e.status, start: e.start_s, end: e.end_s, length: e.length_s, tags: e.tags ?? [],
    preview: e.preview ? `/api/reactions/preview/${e.id}` : null, video: mediaUrl(e.source.video),
    handle: e.source.handle, views: e.source.views, app: appOfPost(e.source.post_dir),
    beats: e.expression_beats?.length ?? 0, hookText: e.hook_text, note: e.note ?? "", uses: uses[e.id] ?? [], by: e.added?.by ?? "agent",
    text: searchText(e),
  };
}
