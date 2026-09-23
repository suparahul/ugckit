/**
 * The production pipeline's data: the authored plan and decks, plus the user's
 * own decisions, uploads and outcomes, joined into one state per post. One
 * app at a time: every reader takes the app's slug.
 *
 * Two sources, deliberately separate:
 *
 *   data/production-<slug>.json   built by scripts/build-production.mjs from
 *                          the markdown the agent authors under
 *                          apps/<slug>/production/ (PLAN.md, decks/*.md).
 *                          Read once per process, like the index.
 *   apps/<slug>/production/   written by the Atlas itself, and by nothing else:
 *                            log.jsonl   one JSON line per decision, append-only
 *                            files/      uploaded pictures and cards
 *                          Read at request time, so a decision shows on the
 *                          next render with no rebuild.
 *
 * Nothing here writes to research/ or to a file the agent wrote. The log is
 * never rewritten: a reversal is a new line, and every line stays.
 */

import { createHash } from "node:crypto";
import { cardTextOf, parseLayout, type CardText, type Dimension, type Layout } from "./layout.ts";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { appDir } from "./root.ts";
import { fmtBoth, setZones } from "./when.ts";
import { PLATFORMS, PLATFORM_NAME, platformOf, primaryOf, slideLimit, type Platform } from "./platform.ts";

/* ------------------------------------------------------------------- authored */

export type PlanRow = {
  /** The app the plan belongs to: apps/<slug>/. */
  slug: string;
  /** `date/short/n` — n is the post's order in the day for that handle. */
  key: string;
  n: number;
  day: number;
  date: string;
  short: string;
  handle: string;
  role: string | null;
  /** The plan's word for the slot: AM, PM, or a time. A label, not an address. */
  slot: string;
  topic: string;
  format: string;
  arm: string;
  source: { raw: string; handle: string | null; id: string | null; views: number | null };
  sourceRaw: string;
  /** Every source the plan names, resolved against the corpus. */
  sources: SourceRef[];
  /** The idea beyond the topic: what the post is, structurally, and why. */
  idea: Idea;
  /** The row's own `Platforms` cell, when it has one; else the plan's `Platforms:` line, else TikTok (platformsOf). */
  platforms?: Platform[];
};

/** A source post the plan points at, with what the corpus holds about it. */
export type SourceRef = {
  /** model: the post this one copies. skeleton / structure / topic: what it borrows. reference: a document, not a post. */
  role: "model" | "skeleton" | "structure" | "topic" | "reference";
  handle: string | null;
  id: string | null;
  views: number | null;
  /** The source slide the plan names ("slide 2"). */
  slide: number | null;
  /** The plan's own words for this source. */
  text: string;
  title?: string | null;
  date?: string | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  sound?: string | null;
  caption?: string | null;
  hashtags?: string[];
  /** Slide images, as /media/… paths. */
  slides?: string[];
  cover?: string | null;
  url?: string | null;
  /** The post's page in the Atlas, when the corpus holds it. */
  atlas?: string | null;
  account?: string | null;
  /** The read of the post from the batch notes, one bullet per line. */
  notes?: string[];
  /** The one-line "why it worked" from the read. */
  pattern?: string | null;
};

export type Idea = {
  /** The handle's format lock: what every post on the handle is. */
  premise: string | null;
  /** The product slot rule, when the handle has one. */
  product: string | null;
  /** The app feature card this post carries. */
  feature: string | null;
  /** The handle's rows that say where the line or the variation comes from. */
  reasons: { label: string; text: string }[];
  /** The handle's experiments this week: name, what changes, schedule. */
  experiments: { name: string; what: string; schedule: string }[];
  /** A two-slide meme's slide 2: the worry as the card's question and the CatGPT answer, line by line. */
  answer: { worry: string; lines: string[] } | null;
  /** The demo cat's record the answers cite, when the post has an answer. */
  record: { field: string; value: string }[] | null;
};

export type Block = {
  label: string;
  hint: string | null;
  text: string;
  place: "top" | "bottom" | "middle" | "flow";
  size: "big" | "medium" | "small";
  box: boolean;
};

export type Slide = {
  n: number;
  label: string;
  isProduct: boolean;
  blocks: Block[];
  prompt: string | null;
  position: string | null;
  why: string | null;
  cards: string[];
};

export type Deck = {
  key: string;
  n: number;
  slot: string;
  title: string;
  items: Record<string, string>;
  /** The slide dimension, from the item table's "Dimension" row; 3:4 when the row is absent. */
  dimension: Dimension;
  /** True when the deck file has the row (the "dimension set" check). */
  dimensionSet: boolean;
  slides: Slide[];
  caption: string | null;
  hashtags: string[];
  ask: string | null;
  sound: string | null;
  mirror: { title: string; intro: string; rows: { slide: string; from: string; to: string }[] } | null;
  anatomy: { column: string; value: string }[];
  experimentTags?: string;
  notes: { title: string; text: string }[];
  source: { raw: string; handle: string | null; id: string | null; views: number | null } | null;
  sourceSlides: string[];
  hash: string;
};

export type DeckFile = {
  file: string;
  date: string;
  short: string;
  handle: string | null;
  intro: string;
  bio: string | null;
  rules: string[];
  stylePrefix: string | null;
  styleNotes: string[];
  posts: Deck[];
  hash: string;
};

export type Production = {
  generatedAt: string;
  plan: {
    title: string | null;
    range: { from: string; to: string } | null;
    /** The app this plan produces for (one plan, one app; more apps mean more plans). */
    app: string | null;
    /** URL segment for the app: /production/<slug>. The folder name under apps/. */
    slug: string | null;
    /** The store id, from the `App Store id:` line. */
    appStoreId: string | null;
    /** The posting service, from `Posting service:`; postbridge when absent. */
    service: string;
    /** From `Platforms:`; absent means TikTok only. */
    platforms?: Platform[];
    /** From `Posting zone:` and `Home zone:`; null means the machine's zone. */
    zones: { posting: string | null; home: string | null };
    handles: Record<string, { handle: string; short: string; role: string; params: Record<string, string>; experiments: Idea["experiments"] }>;
    rules: string[];
    tasks: Record<string, string[]>;
  };
  rows: PlanRow[];
  decks: DeckFile[];
  notes: string[];
};

/* Cached on the file's mtime: a rebuild (npm run index) shows on the next request, no restart. */
const cache = new Map<string, { at: number; data: Production }>();

const EMPTY_PLAN: Production["plan"] = { title: null, range: null, app: null, slug: null, appStoreId: null, service: "postbridge", zones: { posting: null, home: null }, handles: {}, rules: [], tasks: {} };

/** The slug is a folder name under apps/; anything else is refused before it reaches a path. */
export const validSlug = (slug: string) => /^[\w.-]+$/.test(slug);

export function getProduction(slug: string): Production {
  if (!validSlug(slug)) return { generatedAt: "", plan: EMPTY_PLAN, rows: [], decks: [], notes: [`"${slug}" is not an app`] };
  const p = join(process.cwd(), "data", `production-${slug}.json`);
  if (!existsSync(p)) {
    return { generatedAt: "", plan: { ...EMPTY_PLAN, slug }, rows: [], decks: [], notes: [`data/production-${slug}.json missing — run npm run index`] };
  }
  const at = statSync(p).mtimeMs;
  const hit = cache.get(slug);
  if (hit && hit.at === at) { setZones(hit.data.plan.zones?.posting, hit.data.plan.zones?.home); return hit.data; }
  const data = JSON.parse(readFileSync(p, "utf8")) as Production;
  data.plan.zones ??= { posting: null, home: null };
  data.plan.service ??= "postbridge";
  data.plan.appStoreId ??= null;
  for (const r of data.rows) r.slug ??= slug;
  cache.set(slug, { at, data });
  setZones(data.plan.zones.posting, data.plan.zones.home);
  return data;
}

/** Every app with a built plan: the slugs of data/production-*.json. */
export function plannedApps(): string[] {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((f) => f.match(/^production-([\w.-]+)\.json$/)?.[1]).filter((x): x is string => !!x).sort();
}

/* ----------------------------------------------------------------------- log */

/** apps/<slug>/production/: the log, the uploads and the account map live here. */
export const storeOf = (slug: string) => join(appDir(slug), "production");
export const logOf = (slug: string) => join(storeOf(slug), "log.jsonl");
export const filesRoot = (slug: string) => join(storeOf(slug), "files");

/** `images.approve` and `images.sendback` are no longer written: the images
 * gate folded into the final one on 2026-09-16. They stay here so the old
 * lines in the log still type-check and print. */
export type EventKind =
  | "idea.approve"
  | "idea.sendback"
  | "plan.approve"
  | "plan.sendback"
  | "images.approve"
  | "images.sendback"
  | "final.approve"
  | "final.sendback"
  | "slide.upload"
  | "slide.choose"
  | "slide.approve"
  | "slide.reject"
  | "slide.note"
  | "slide.text"
  | "slide.layout"
  | "slide.unlock"
  | "card.upload"
  | "posted"
  | "outcomes"
  | "kill"
  | "unkill"
  | "task.tick"
  | "task.untick"
  | "postbridge.sent"
  | "postbridge.rescheduled"
  | "posting.sent"
  | "posting.rescheduled"
  | "posted.link"
  | "outcome.sync"
  /* One leg of a send failed on its platform (data.platform, data.error: the platform's words). */
  | "posting.failed"
  /* A leg taken off a post, or put back (data.platform, note). */
  | "leg.drop"
  | "leg.add"
  | "outcome.check"
  | "export"
  /* Identity events (the handle pages): the same log, `handle` instead of `post`. */
  | "persona.approve"
  | "persona.sendback"
  | "reference.approve"
  | "reference.reject"
  | "bio.approve"
  | "defaults.approve"
  | "account.connect"
  | "task.done";

/** `posting.sent` and `postbridge.sent` are one kind: the older name stays readable. */
export const isSent = (k: EventKind) => k === "posting.sent" || k === "postbridge.sent";
export const isRescheduled = (k: EventKind) => k === "posting.rescheduled" || k === "postbridge.rescheduled";

export type Event = {
  at: string;
  /** The post key for post events; `day/<date>` for day tasks; absent on identity events. */
  post?: string;
  /** The handle for identity events. */
  handle?: string;
  kind: EventKind;
  /** Who wrote the line. Absent means the user. Any other value names an agent (an upload, a note), never a decision. `demo` marks seeded test lines that are nobody's decision. */
  actor?: string;
  note?: string;
  slide?: number;
  card?: number;
  file?: string;
  hash?: string;
  data?: Record<string, string | number | null | LegData[]>;
  task?: string;
};

/**
 * One leg of a `posting.sent` line: the account of one platform the post went
 * to. A line without `legs` is one leg on `data.platform`, TikTok when absent.
 */
export type LegData = { platform: string; account: number; mode: string; scheduledAt: string | null; status: string };

/* Cached on the log's mtime and size: the log is appended between requests, never rewritten. */
const logCache = new Map<string, { at: number; size: number; events: Event[] }>();

export function readLog(slug: string): Event[] {
  if (!validSlug(slug)) return [];
  const p = logOf(slug);
  if (!existsSync(p)) return [];
  const st = statSync(p);
  const hit = logCache.get(slug);
  if (hit && hit.at === st.mtimeMs && hit.size === st.size) return hit.events;
  const events = readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l) as Event; } catch { return null; }
    })
    .filter((e): e is Event => !!e)
    .map((e) => (e.file && !e.file.startsWith(`${slug}/`) ? { ...e, file: withSlug(slug, e.file) } : e));
  logCache.set(slug, { at: st.mtimeMs, size: st.size, events });
  return events;
}

export function appendEvent(slug: string, e: Omit<Event, "at">): Event {
  if (!validSlug(slug)) throw new Error(`"${slug}" is not an app`);
  mkdirSync(storeOf(slug), { recursive: true });
  const full: Event = { at: new Date().toISOString(), ...e };
  appendFileSync(logOf(slug), JSON.stringify(full) + "\n");
  return full;
}

/** A post key `2026-09-15/catlover/am` as a safe directory name. */
export const fileKey = (key: string) => key.replace(/\//g, "-");

/**
 * A file under the store, addressed as `<slug>/<post dir>/<sub>/<name>`: the
 * slug leads so /api/production/file can find the app. A line written before
 * the slug was part of the address is read with it added.
 */
export const withSlug = (slug: string, rel: string) => (rel.startsWith(`${slug}/`) ? rel : `${slug}/${rel}`);
/** The absolute path of a file address (`<slug>/…`), or null when the address names another app or escapes the store. */
export function fileAbs(rel: string): string | null {
  const [slug, ...rest] = rel.split("/");
  if (!slug || !validSlug(slug) || !rest.length) return null;
  const root = resolve(filesRoot(slug));
  const abs = resolve(root, rest.join("/"));
  return abs.startsWith(root + "/") ? abs : null;
}

export function uploadedFiles(slug: string, key: string, sub: string): string[] {
  const dir = join(filesRoot(slug), fileKey(key), sub);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => !f.startsWith(".")).sort().map((f) => `${slug}/${fileKey(key)}/${sub}/${f}`);
}

/* --------------------------------------------------------------------- state */

/**
 * idea: the row waits for a yes before any deck is written. planned: the idea
 * is approved and the deck is being written. plan: the deck waits for a yes.
 * final: the plan is approved; pictures arrive, are judged, and the post is
 * approved for posting on the same screen. Three gates: idea, plan, final.
 */
export type Stage = "idea" | "planned" | "plan" | "final" | "ready" | "posted" | "read" | "killed";
export type Mode = "planning" | "produced";

export type PointState = {
  /** stale: approved, and an approved thing changed since. Only the final point goes stale; the plan never does (a deck change is shown, not re-asked). */
  status: "open" | "approved" | "sentback" | "stale";
  at: string | null;
  note: string | null;
};

export type SlideState = {
  n: number;
  /** approved: an approved file exists for the slide, whichever candidate is in view. candidate: pictures exist, none approved. */
  status: "empty" | "candidate" | "approved" | "needsnew";
  /** baked: the compositor burns the text into the final PNG (slides 2..n by default). overlay: the text is typed in the TikTok editor by hand (slide 1, the cover, for search). */
  text: "overlay" | "baked";
  /** The layout Rahul locked, or null: the deck's default layout applies. */
  layout: Layout | null;
  /** The card image drawn for this slide: the locked layout's own card (cards/1-appstore-<hash>.png, when rendered) or null for the post's default card. */
  cardFile: string | null;
  /** The candidate in view: the last upload or choose. */
  current: string | null;
  /** The file that holds the approval, or null. The approval belongs to the picture, not to the moment: browsing another candidate keeps it. */
  approved: string | null;
  candidates: string[];
  note: string | null;
  at: string | null;
  /** A hash of the slide's text and prompt, so a later deck edit can name the slide it touched. */
  hash: string;
  /** The slide's text changed after the plan was approved. Shown, never re-asked before the final click. */
  changed: boolean;
};

/** One product callout image: the post's default file, and for the App Store card (index 1) its default strings, the editor's starting point for a rewrite. */
export type CardState = { index: number; file: string | null; text?: CardText };

/**
 * The default card's strings, from apps/<slug>/product.json (the callout facts
 * the app phase writes: name, subtitle, button). Null when the file is absent:
 * the card slot then says which phase fills it. No fallback strings.
 */
export function defaultCardText(slug: string): CardText | null {
  try {
    const l = JSON.parse(readFileSync(join(appDir(slug), "product.json"), "utf8"));
    if (!l.name) return null;
    return { name: String(l.name), subtitle: String(l.subtitle ?? ""), button: String(l.button ?? "Open") };
  } catch {
    return null;
  }
}

export type { CardText, Dimension, Frame, Layout, LayoutBlock, LayoutCard } from "./layout.ts";
export { BOX_FONT_SIZE, CALLOUT_STACK_BOTTOM, CARD, CARD_H, DIMENSIONS, FONT_SIZE, SAFE, STACK_GAP, cardTextOf, frameOf, parseDimension, parseLayout } from "./layout.ts";

export type PostState = {
  row: PlanRow;
  deck: Deck | null;
  deckFile: DeckFile | null;
  stage: Stage;
  mode: Mode;
  idea: PointState;
  plan: PointState;
  final: PointState;
  /**
   * The deck changed after an approval that has not been read since: which
   * slides (or `unknown` when the approval line predates per-slide hashes),
   * and which approval it is measured from. `since: "plan"` between the plan
   * approval and the final approval; `since: "final"` when the deck changed
   * after the final approval (the final gate is then stale and wants one more
   * click). Null when nothing changed, when a final approval covers the
   * current deck, or once the post is posted. One rule: deckChange().
   */
  changed: { slides: number[]; unknown: boolean; since: "plan" | "final" } | null;
  slides: SlideState[];
  cards: CardState[];
  approvedSlides: number;
  posted: { at: string; time: string; url: string } | null;
  /** The last send to TikTok drafts through the posting service (a `posting.sent` line), or null. */
  sent: SentState | null;
  /** The TikTok URL once known: from the `posted.link` line (Monid) or the link typed with "Mark posted". */
  link: string | null;
  /** The last export of the finished files to ~/Downloads (an `export` line), or null. */
  exported: { at: string; dir: string } | null;
  /** The last synced numbers from Post Bridge (an `outcome.sync` line), or null. Shown in the Outcomes block; the day-7 form stays the fallback. */
  synced: SyncedState | null;
  /** The day-7 numbers Rahul typed, or null. */
  outcomes: Record<string, string | number> | null;
  killed: { at: string; note: string } | null;
  log: Event[];
  /** The sentence the board prints. The whole status vocabulary lives here. */
  sentence: string;
  waiting: boolean;
  /** True when any line in this post's log is seeded test data, not a decision. */
  demo: boolean;
  checks: { label: string; ok: boolean | null }[];
  /** The slide dimension of the post: the deck's, or 3:4 before a deck exists. */
  dimension: Dimension;
  /** Where the post goes: the row's cell, else the plan's line, else TikTok. */
  platforms: Platform[];
  /** The leg whose state is `sent`, `posted`, `link` and `synced`: TikTok when the post goes there. */
  primary: Platform;
  legs: Partial<Record<Platform, LegState>>;
};

/**
 * One platform's side of a post. `sent`, `posted`, `link` and `synced` on the
 * PostState are the primary leg's, so everything written for TikTok alone reads
 * the same. `failed` is the platform's error since the last send of this leg;
 * `dropped` is a `leg.drop` not undone by a later `leg.add`.
 */
export type LegState = {
  platform: Platform;
  sent: SentState | null;
  posted: { at: string; time: string; url: string } | null;
  link: string | null;
  synced: SyncedState | null;
  failed: { at: string; error: string } | null;
  dropped: { at: string; note: string } | null;
};

/** `mode` "draft" (the inbox; the phone publishes) or "direct" (Post Bridge publishes at `scheduledAt`, ISO UTC). Lines before the modes are drafts. */
export type SentState = { at: string; id: string; media: string[]; account: number; status: string; mode: "draft" | "direct"; scheduledAt: string | null };
/** The last synced numbers: from Monid (`source` "monid", with saves) when a Monid line exists, else from Post Bridge (no saves). */
export type SyncedState = { at: string; source: "monid" | "postbridge"; views: number; likes: number; comments: number; saves: number | null; shares: number; url: string; syncedAt: string; pbPost: string };

const last = <T,>(arr: T[]) => (arr.length ? arr[arr.length - 1] : null);

function pointState(events: Event[], approve: EventKind, sendback: EventKind, currentHash: string | null, staleIf?: (approvedAt: string) => boolean): PointState {
  const rel = events.filter((e) => e.kind === approve || e.kind === sendback);
  const e = last(rel);
  if (!e) return { status: "open", at: null, note: null };
  if (e.kind === sendback) return { status: "sentback", at: e.at, note: e.note ?? null };
  if (currentHash && e.hash && e.hash !== currentHash) return { status: "stale", at: e.at, note: null };
  if (staleIf && staleIf(e.at)) return { status: "stale", at: e.at, note: null };
  return { status: "approved", at: e.at, note: null };
}

export const slideHash = (s: Slide) => createHash("sha1").update(JSON.stringify({ b: s.blocks, p: s.prompt, c: s.cards })).digest("hex").slice(0, 12);
export const slideHashes = (deck: Deck) => deck.slides.map(slideHash).join(" ");

function slideStates(slug: string, deck: Deck, key: string, events: Event[], changedSlides: Set<number>): SlideState[] {
  return deck.slides.map((s) => {
    const files = uploadedFiles(slug, key, `slide-${String(s.n).padStart(2, "0")}`);
    const ev = events.filter((e) => e.slide === s.n && e.kind.startsWith("slide."));
    let current: string | null = last(files);
    /* The approval is a file. An approve line names it; an older line without
     * a file means the picture in view at the time (the last upload or choose
     * before it, else the folder's last file), so the existing log still reads. */
    let approved: string | null = null;
    let rejected = false;
    let note: string | null = null;
    let at: string | null = null;
    for (const e of ev) {
      if (e.kind === "slide.upload" && e.file) { current = e.file; rejected = false; note = null; at = e.at; }
      else if (e.kind === "slide.choose" && e.file) { current = e.file; rejected = false; note = null; at = e.at; }
      else if (e.kind === "slide.approve") { const f = e.file ?? current; if (f) { approved = f; rejected = false; note = null; at = e.at; } }
      else if (e.kind === "slide.reject") { rejected = !!current; approved = null; note = e.note ?? null; at = e.at; }
    }
    if (current && !files.includes(current)) current = last(files);
    if (approved && !files.includes(approved)) approved = null;
    const status: SlideState["status"] = !current ? "empty" : rejected ? "needsnew" : approved ? "approved" : "candidate";
    const textEv = last(ev.filter((e) => e.kind === "slide.text"));
    const text: SlideState["text"] = textEv ? (textEv.data?.text === "baked" ? "baked" : "overlay") : s.n === 1 ? "overlay" : "baked";
    const lockEv = last(ev.filter((e) => e.kind === "slide.layout" || e.kind === "slide.unlock"));
    const layout = lockEv && lockEv.kind === "slide.layout" ? parseLayout(lockEv.data?.layout) : null;
    const cardFile = layout?.card ? customCardFile(slug, key, cardTextOf(layout.card)) : null;
    return { n: s.n, status, current, approved, candidates: files, note, at, text, layout, cardFile, hash: slideHash(s), changed: changedSlides.has(s.n) };
  });
}

/** The cache name of a card with these strings: ten hex characters of their hash, the same as scripts/lib/appstore-card.mjs cardHash(). */
export const cardHash = (t: CardText) => createHash("sha1").update(`${t.name}\n${t.subtitle}\n${t.button}`).digest("hex").slice(0, 10);
/** The path (under files/) of a post's card with its own strings, or the default card's, and whether it exists. */
export function customCardPath(slug: string, key: string, t: CardText): string {
  return `${slug}/${fileKey(key)}/cards/1-appstore-${cardHash(t)}.png`;
}
function customCardFile(slug: string, key: string, t: CardText | null): string | null {
  if (!t) return null;
  const rel = customCardPath(slug, key, t);
  const abs = fileAbs(rel);
  return abs && existsSync(abs) ? rel : null;
}
/** A custom card in the cache (1-appstore-<hash>.png) is never a post's default card. */
const isCustomCard = (f: string) => /-[0-9a-f]{10}\.png$/.test(f);

function cardStates(slug: string, deck: Deck, key: string): CardState[] {
  const product = deck.slides.find((s) => s.isProduct && s.cards.length);
  if (!product) return [];
  const files = uploadedFiles(slug, key, "cards").filter((f) => !isCustomCard(f));
  const text = defaultCardText(slug);
  return product.cards.map((_, i) => ({
    index: i + 1,
    file: last(files.filter((f) => /\/cards\/(\d+)-/.test(f) && Number(f.match(/\/cards\/(\d+)-/)![1]) === i + 1)) ?? null,
    ...(i === 0 && text ? { text } : {}),
  }));
}

/** The app's name as a whole-word pattern, for the checks: "Catwise" matches "Catwise" and "catwise", not "cat". */
export function appPattern(app: string | null): RegExp | null {
  if (!app) return null;
  const esc = app.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  return esc ? new RegExp(`\\b${esc}\\b`, "i") : null;
}

function checksFor(row: PlanRow, deck: Deck, deckFile: DeckFile, app: RegExp | null, platforms: Platform[] = ["tiktok"]): PostState["checks"] {
  const all = deck.slides.flatMap((s) => s.blocks.map((b) => b.text)).join("\n");
  const slide1 = deck.slides[0] ? deck.slides[0].blocks.map((b) => b.text).join(" ") : "";
  const namesApp = /caption names the app/i.test(row.arm);
  const captionNames = app ? app.test(deck.caption || "") : false;
  const productSlide = deck.slides.find((s) => s.isProduct);
  return [
    { label: "app not on slide 1", ok: app ? !app.test(slide1) : null },
    { label: "no download word", ok: !/download/i.test(all + (deck.caption || "")) },
    namesApp ? { label: "caption names the app", ok: app ? captionNames : null } : { label: "caption does not name the app", ok: app ? !captionNames : null },
    { label: "one style prefix", ok: !!deckFile.stylePrefix },
    { label: deck.dimensionSet ? `dimension set: ${deck.dimension}` : "dimension set", ok: deck.dimensionSet },
    productSlide ? { label: `product on slide ${productSlide.n} of ${deck.slides.length}`, ok: productSlide.n !== 1 } : { label: "no product slot", ok: null },
    ...slideLimitCheck(deck.slides.length, platforms),
  ];
}

/** The 10-slide rule: a post that also goes to Instagram has 10 slides at most (Rahul, 2026-09-23). No check for TikTok alone. */
export function slideLimitCheck(slides: number, platforms: Platform[]): PostState["checks"] {
  const max = slideLimit(platforms);
  if (max === null) return [];
  const who = platforms.filter((p) => slideLimit([p]) !== null).map((p) => PLATFORM_NAME[p]).join(" and ");
  return [{ label: slides <= max ? `${slides} slides · ${who} takes ${max}` : `${slides} slides · ${who} takes ${max}: cut the deck`, ok: slides <= max }];
}

/** Where a row goes: its own cell, else the plan's `Platforms:` line, else TikTok. */
export function platformsOf(row: PlanRow, plan: Pick<Production["plan"], "platforms"> = getProduction(row.slug).plan): Platform[] {
  const list = row.platforms?.length ? row.platforms : plan.platforms?.length ? plan.platforms : ["tiktok" as Platform];
  return PLATFORMS.filter((p) => list.includes(p));
}

const onLeg = (e: Event, p: Platform) => platformOf(e.data?.platform) === p;

/** The legs of a `posting.sent` line: its `legs`, or one leg on `data.platform` (TikTok when absent). */
export function legsOfSent(e: Event): LegData[] {
  const d = e.data ?? {};
  if (Array.isArray(d.legs)) return d.legs;
  return [{ platform: platformOf(d.platform) ?? "tiktok", account: Number(d.account ?? 0), mode: d.mode === "direct" ? "direct" : "draft", scheduledAt: d.scheduledAt ? String(d.scheduledAt) : null, status: String(d.status ?? "") }];
}

/** One platform's side of a post, from the post's log lines. A line with no platform is TikTok's. */
export function legState(log: Event[], p: Platform): LegState {
  const sentEv = last(log.filter((e) => isSent(e.kind) && legsOfSent(e).some((l) => platformOf(l.platform) === p)));
  const leg = sentEv ? legsOfSent(sentEv).find((l) => platformOf(l.platform) === p)! : null;
  /* A `posting.rescheduled` line for the same service id moves the time. */
  const resched = sentEv ? last(log.filter((e) => isRescheduled(e.kind) && e.at > sentEv.at && e.data?.id === sentEv.data?.id && (e.data?.platform == null || onLeg(e, p)))) : null;
  const sent: SentState | null = sentEv?.data && leg
    ? { at: sentEv.at, id: String(sentEv.data.id ?? ""), media: String(sentEv.data.media ?? "").split(" ").filter(Boolean), account: Number(leg.account ?? 0), status: String(resched?.data?.status ?? leg.status ?? ""), mode: leg.mode === "direct" ? "direct" : "draft", scheduledAt: resched?.data?.scheduledAt ? String(resched.data.scheduledAt) : leg.scheduledAt ? String(leg.scheduledAt) : null }
    : null;
  const postedEv = last(log.filter((e) => e.kind === "posted" && onLeg(e, p)));
  const posted = postedEv ? { at: postedEv.at, time: String(postedEv.data?.time ?? hhmm(postedEv.at)), url: String(postedEv.data?.url ?? "") } : null;
  /* Monid first: it is the source that knows the link and the saves. */
  const mine = log.filter((e) => e.kind === "outcome.sync" && onLeg(e, p));
  const syncEv = last(mine.filter((e) => e.data?.source === "monid")) ?? last(mine);
  const synced: SyncedState | null = syncEv?.data
    ? { at: syncEv.at, source: syncEv.data.source === "monid" ? "monid" : "postbridge", views: Number(syncEv.data.views ?? 0), likes: Number(syncEv.data.likes ?? 0), comments: Number(syncEv.data.comments ?? 0), saves: syncEv.data.saves == null ? null : Number(syncEv.data.saves), shares: Number(syncEv.data.shares ?? 0), url: String(syncEv.data.url ?? ""), syncedAt: String(syncEv.data.syncedAt ?? syncEv.at), pbPost: String(syncEv.data.pbPost ?? "") }
    : null;
  /* The link: the `posted.link` line the sync wrote, else the link typed with "Mark posted". */
  const linkEv = last(log.filter((e) => e.kind === "posted.link" && e.data?.url && onLeg(e, p)));
  const link: string | null = linkEv ? String(linkEv.data!.url) : posted?.url || null;
  const failEv = last(log.filter((e) => e.kind === "posting.failed" && onLeg(e, p)));
  const failed = failEv && (!sentEv || failEv.at >= sentEv.at) ? { at: failEv.at, error: String(failEv.data?.error ?? failEv.note ?? "failed") } : null;
  const dropEv = last(log.filter((e) => (e.kind === "leg.drop" || e.kind === "leg.add") && onLeg(e, p)));
  const dropped = dropEv?.kind === "leg.drop" ? { at: dropEv.at, note: dropEv.note ?? String(dropEv.data?.note ?? "") } : null;
  return { platform: p, sent, posted, link, synced, failed, dropped };
}

const hhmm = (iso: string) => iso.slice(11, 16);

/**
 * The one rule for "the deck changed since you approved it".
 *
 * The approval it is measured from is the latest gate given: the last
 * `final.approve` when there is one after the last `plan.approve`, else the
 * plan approval. Each line carries the deck hash and, since 2026-09-16, one
 * hash per slide in `data.slides` (an older line without them can only say
 * that something changed). Nothing is reported when:
 *   - the plan is not approved, or the post is posted;
 *   - the measured line's hash equals the current deck's: a final approval
 *     given after a deck edit means the edit was read, and the band goes.
 * Between the plan and the final the result says `since: "plan"` (shown,
 * not re-asked). After a final approval it says `since: "final"`: the final
 * gate is stale and wants one more click, and the words say so.
 */
function deckChange(deck: Deck | null, log: Event[], plan: PointState, posted: boolean): PostState["changed"] {
  if (!deck || plan.status !== "approved" || posted) return null;
  const planEv = last(log.filter((e) => e.kind === "plan.approve"));
  const finalEv = last(log.filter((e) => e.kind === "final.approve" && (!planEv || e.at >= planEv.at)));
  const approval = finalEv ?? planEv;
  const since = finalEv ? "final" : "plan";
  if (!approval || !approval.hash || approval.hash === deck.hash) return null;
  const then = typeof approval.data?.slides === "string" ? String(approval.data.slides).split(" ") : null;
  if (!then) return { slides: [], unknown: true, since };
  const slides = deck.slides.filter((s, i) => then[i] !== slideHash(s)).map((s) => s.n);
  /* The caption or the ask changed, not a slide: still a change, named nowhere. */
  return { slides, unknown: slides.length === 0, since };
}

export function postState(row: PlanRow, all: Event[] = readLog(row.slug)): PostState {
  const slug = row.slug;
  const prod = getProduction(slug);
  const deckFile = prod.decks.find((d) => d.posts.some((p) => p.key === row.key)) ?? null;
  const deck = deckFile ? deckFile.posts.find((p) => p.key === row.key) ?? null : null;
  const log = all.filter((e) => e.post === row.key);
  const platforms = platformsOf(row, prod.plan);
  const primary = primaryOf(platforms);

  const killEv = last(log.filter((e) => e.kind === "kill" || e.kind === "unkill"));
  const killed = killEv && killEv.kind === "kill" ? { at: killEv.at, note: killEv.note ?? "" } : null;

  /* A deck on disk means the idea was approved, on paper or before this rule. */
  const ideaRaw = pointState(log, "idea.approve", "idea.sendback", null);
  const idea: PointState = ideaRaw.status === "open" && deck ? { status: "approved", at: null, note: null } : ideaRaw;

  /* A deck on disk is the plan, and the plan is read through its pictures:
   * the agent writes the deck and makes the pictures in one run, and Rahul's
   * look is at the slides, not at a gate before them (2026-09-18). So the plan
   * counts as approved once the deck exists, with no line, unless it was sent
   * back; a send-back holds until the deck is rewritten (its hash differs from
   * the one on the send-back line) or Rahul approves the plan by hand. The
   * plan never goes stale: a deck edit after approval is shown as `changed`
   * and re-asked only through the final point. See deckChange(). */
  const planRaw = pointState(log, "plan.approve", "plan.sendback", null);
  const planBack = last(log.filter((e) => e.kind === "plan.approve" || e.kind === "plan.sendback"));
  const rewritten = planRaw.status === "sentback" && !!deck && !!planBack?.hash && planBack.hash !== deck.hash;
  const plan: PointState = deck && (planRaw.status === "open" || rewritten) ? { status: "approved", at: null, note: null } : planRaw;
  const changed = deckChange(deck, log, plan, log.some((e) => e.kind === "posted" && onLeg(e, primary)));
  const changedSlides = new Set(changed?.slides ?? []);

  const slides = deck ? slideStates(slug, deck, row.key, log, changedSlides) : [];
  const cards = deck ? cardStates(slug, deck, row.key) : [];
  const approvedSlides = slides.filter((s) => s.status === "approved").length;

  /* The final approval covers the deck text (its hash) and every picture
   * approval at the time. It goes stale when Rahul approves a different
   * picture or asks for a new one after it, or the deck text changes. A new
   * candidate from the agent, or a look at an earlier one, changes nothing. */
  const lastSlideDecision = last(log.filter((e) => e.kind === "slide.approve" || e.kind === "slide.reject"))?.at ?? null;
  const final = pointState(log, "final.approve", "final.sendback", deck?.hash ?? null, (at) => !!lastSlideDecision && lastSlideDecision > at);

  const outEv = last(log.filter((e) => e.kind === "outcomes"));
  const outcomes = outEv ? (outEv.data as Record<string, string | number> | undefined) ?? null : null;
  const exportEv = last(log.filter((e) => e.kind === "export"));
  const exported = exportEv?.data?.dir ? { at: exportEv.at, dir: String(exportEv.data.dir) } : null;
  /* One leg per platform the post goes to, plus any leg the log holds for another (a send made before the plan changed).
     The primary leg is the post's `sent`, `posted`, `link` and `synced`. */
  const legs: PostState["legs"] = {};
  for (const p of PLATFORMS) {
    const l = legState(log, p);
    if (platforms.includes(p) || l.sent || l.posted || l.synced) legs[p] = l;
  }
  const { sent, posted, link, synced } = legs[primary] ?? legState(log, primary);

  let stage: Stage;
  if (killed) stage = "killed";
  else if (idea.status !== "approved") stage = "idea";
  else if (!deck) stage = "planned";
  else if (plan.status !== "approved") stage = "plan";
  /* A posted post is posted: a deck edit after the fact changes nothing on the phone, so the final gate is not reopened. */
  else if (final.status !== "approved" && !(posted && final.status === "stale")) stage = "final";
  else if (!posted) stage = "ready";
  /* Read: the day-7 numbers are typed, or a sync on or after day 7 brought them. */
  else if (!outcomes && !(synced && synced.at.slice(0, 10) >= addDays(posted.at.slice(0, 10), 7))) stage = "posted";
  else stage = "read";

  const mode: Mode = deck && plan.status === "approved" ? "produced" : "planning";

  let sentence: string;
  let waiting = false;
  const q = (s: string | null) => (s ? ` — “${s}”` : "");
  switch (stage) {
    case "idea":
      if (idea.status === "sentback") sentence = `idea: sent back${q(idea.note)}`;
      else { sentence = "idea: waiting for you"; waiting = true; }
      break;
    case "planned": sentence = "deck being written"; break;
    /* Only a sent-back plan stops here: a deck on disk is otherwise the plan, approved. */
    case "plan": sentence = `plan: sent back${q(plan.note)}`; break;
    case "final": {
      const missing = slides.filter((s) => s.status === "empty" || s.status === "needsnew").length;
      const cardsMissing = cards.filter((c) => !c.file).length;
      if (final.status === "sentback") sentence = `final: sent back${q(final.note)}`;
      else if (final.status === "stale") { sentence = "changed after approval: waiting for you"; waiting = true; }
      else if (missing) sentence = `pictures: ${slides.length - missing} of ${slides.length}`;
      else if (cardsMissing) sentence = `product callout: ${cards.length - cardsMissing} of ${cards.length} images`;
      else { sentence = "final: waiting for you"; waiting = true; }
      break;
    }
    case "ready": sentence = sent ? (sent.mode === "direct" && sent.scheduledAt ? `scheduled ${fmtBoth(sent.scheduledAt)} · direct` : `in TikTok drafts · ${row.handle} ${hhmm(sent.at)}`) : "ready"; break;
    case "posted": sentence = `posted ${posted!.time}`; break;
    case "read": sentence = "read"; break;
    case "killed": sentence = `killed${q(killed!.note)}`; break;
  }

  return {
    row, deck, deckFile, stage, mode, idea, plan, final, changed, slides, cards, approvedSlides,
    posted, sent, exported, synced, link, outcomes, killed, log, sentence, waiting, demo: log.some((e) => e.actor === "demo"),
    checks: deck && deckFile ? checksFor(row, deck, deckFile, appPattern(prod.plan.app), platforms) : [],
    dimension: deck?.dimension ?? "3:4",
    platforms, primary, legs,
  };
}

export function allStates(slug: string): PostState[] {
  const log = readLog(slug);
  return getProduction(slug).rows.map((r) => postState(r, log));
}

export function findRow(slug: string, date: string, short: string, n: string): PlanRow | null {
  return getProduction(slug).rows.find((r) => r.date === date && r.short === short && String(r.n) === n) ?? null;
}

/** The post page address. Every studio link and every walk link comes from here. */
export function postPath(row: Pick<PlanRow, "slug" | "date" | "short" | "n">): string {
  return `/production/${encodeURIComponent(row.slug)}/${row.date}/${row.short}/${row.n}`;
}

/** The studio address of an app. */
export function boardPath(slug: string): string {
  return `/production/${encodeURIComponent(slug)}`;
}

export function dayTasks(slug: string, date: string, all: Event[] = readLog(slug)): { text: string; done: boolean }[] {
  const tasks = getProduction(slug).plan.tasks[date] ?? [];
  return tasks.map((t) => {
    const ev = last(all.filter((e) => e.post === `day/${date}` && e.task === t && (e.kind === "task.tick" || e.kind === "task.untick")));
    return { text: t, done: !!ev && ev.kind === "task.tick" };
  });
}

/* ------------------------------------------------------------------- helpers */

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function dateParts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dt, weekday: WEEKDAYS[dt.getUTCDay()], month: MONTHS[m - 1] };
}

export const isoOf = (dt: Date) => dt.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const { dt } = dateParts(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return isoOf(dt);
}

/** Monday of the week containing iso. */
/**
 * The seven-day window a date belongs to. Inside the plan's range the week is
 * the plan's own (day 1 to day 7, whatever weekday it starts on); outside it,
 * the calendar week from Monday.
 */
export function weekStartOf(slug: string, iso: string): string {
  const range = getProduction(slug).plan.range;
  if (range && iso >= range.from) {
    const days = Math.floor((Date.parse(iso + "T00:00:00Z") - Date.parse(range.from + "T00:00:00Z")) / 86400000);
    const start = addDays(range.from, Math.floor(days / 7) * 7);
    if (start <= range.to) return start;
  }
  return mondayOf(iso);
}

export function mondayOf(iso: string): string {
  const { dt } = dateParts(iso);
  const day = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - day);
  return isoOf(dt);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export const STAGE_WORD: Record<Stage, string> = {
  idea: "idea",
  planned: "planned",
  plan: "plan",
  final: "final",
  ready: "ready",
  posted: "posted",
  read: "read",
  killed: "killed",
};

/** Why the final click cannot happen yet, or null when it can. The same rule on the server and in the rail. */
export function finalBlock(s: PostState): string | null {
  const empty = s.slides.filter((x) => x.status === "empty").length;
  const needs = s.slides.filter((x) => x.status === "needsnew").length;
  const cards = s.cards.filter((c) => !c.file).length;
  if (empty) return `${empty} slide${empty === 1 ? " has" : "s have"} no picture`;
  if (needs) return `${needs} slide${needs === 1 ? " waits" : "s wait"} for a new picture`;
  if (cards) return `product callout: ${cards} image${cards === 1 ? "" : "s"} not made yet`;
  return null;
}

/** The word after the primary button: what the state asks for next. */
export function primaryAction(s: PostState): { kind: EventKind | "posted" | "outcomes" | null; label: string; disabled: string | null } {
  if (s.killed) return { kind: null, label: "Killed", disabled: "This post was killed." };
  switch (s.stage) {
    case "idea": return { kind: "idea.approve", label: "Approve idea", disabled: null };
    case "planned": return { kind: null, label: "", disabled: null };
    /* Reached only after a send-back: the button clears it by hand; a rewritten deck clears it alone. */
    case "plan": return { kind: "plan.approve", label: "Approve plan", disabled: null };
    case "final": return { kind: "final.approve", label: "Approve for posting", disabled: finalBlock(s) };
    case "ready": return { kind: "posted", label: "Mark posted", disabled: null };
    case "posted": return { kind: "outcomes", label: "Record outcomes", disabled: null };
    case "read": return { kind: null, label: "Read", disabled: "Outcomes are recorded." };
    default: return { kind: null, label: "", disabled: null };
  }
}

/**
 * The one sentence that says what happens next and whose turn it is: Rahul's
 * or the agent's. The page shows it under the title so the next step is never
 * a guess. `slide` names the slide the sentence points at, when there is one.
 */
export function nextStep(s: PostState): { who: "you" | "agent" | "nobody"; text: string; slide: number | null } {
  const say = (who: "you" | "agent" | "nobody", text: string, slide: number | null = null) => ({ who, text, slide });
  if (s.killed) return say("nobody", "This post is killed. Un-kill it to continue.");
  switch (s.stage) {
    case "idea":
      return s.idea.status === "sentback"
        ? say("agent", "Sent back with your note. The idea comes back here when it is reworked.")
        : say("you", "Read the idea. Approve it, or send it back with a note. The deck is written after that.");
    case "planned": return say("agent", "The idea is approved. The deck is not written yet; it appears here when it is.");
    case "plan": return say("agent", "Sent back with your note. The plan comes back here when the deck is rewritten.");
    case "final": {
      if (s.final.status === "sentback") return say("agent", "Sent back with your note. It comes back here when the deck or the pictures are reworked.");
      const empty = s.slides.filter((x) => x.status === "empty").length;
      const needs = s.slides.filter((x) => x.status === "needsnew").length;
      const cards = s.cards.filter((c) => !c.file).length;
      const firstOpen = s.slides.find((x) => x.status === "candidate")?.n ?? null;
      if (empty || needs) return say("agent", `${empty + needs} slide${empty + needs === 1 ? " has" : "s have"} no picture yet. Read the deck and judge the pictures here; approve for posting once every slide has one.`, firstOpen);
      if (cards) return say("agent", `Every picture is here. The product callout is missing: ${cards} image${cards === 1 ? "" : "s"} not made yet.`, firstOpen);
      if (s.final.status === "stale") {
        const which = s.changed?.slides.length ? `Slide${s.changed.slides.length === 1 ? "" : "s"} ${s.changed.slides.join(", ")} changed` : "Something changed";
        return say("you", `${which} after you approved the post. Look again, then approve for posting.`, s.changed?.slides[0] ?? null);
      }
      return say("you", `Walk the ${s.slides.length} slides. Ask for a new one where a picture is wrong, then approve for posting. That approves every picture still open.`, firstOpen);
    }
    case "ready":
      return postingStep(s) === "sent"
        ? (s.sent!.mode === "direct" && s.sent!.scheduledAt
          ? say("you", `Scheduled for ${fmtBoth(s.sent!.scheduledAt)} on ${s.row.handle} · direct. The posting service publishes it; nothing to do until then.`)
          : say("you", `In TikTok drafts on ${s.row.handle} since ${hhmm(s.sent!.at)}. Post it from the phone, then mark it posted.`))
        : say("you", "Ready. Send it to TikTok drafts, or schedule a direct post.");
    case "posted": return say("you", `Posted ${s.posted!.time}. Outcomes open ${outcomesOpenAt(s)}.`);
    case "read": return say("nobody", "Done. Outcomes are recorded.");
    default: return say("nobody", "");
  }
}

/**
 * The three quiet states after the final approval, one rule: `send` (approved,
 * not sent to TikTok drafts), `sent` (in the drafts, waiting for the phone),
 * `posted` (live; outcomes at day 7). Null before the final approval.
 */
export type PostingStep = "send" | "sent" | "posted";
export function postingStep(s: PostState): PostingStep | null {
  if (s.killed) return null;
  if (s.stage === "posted" || s.stage === "read") return "posted";
  if (s.stage !== "ready") return null;
  return s.sent ? "sent" : "send";
}


export function outcomesOpenAt(s: PostState): string | null {
  if (!s.posted) return null;
  return addDays(s.posted.at.slice(0, 10), 7);
}
