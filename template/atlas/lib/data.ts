/**
 * Server-side access to the generated index.
 *
 * The whole corpus is ~7MB, far too much to ship to the browser, so it is read
 * once in the Node process and every page pulls what it needs from memory. The
 * browser only ever gets public/search.json, which is ~70KB.
 *
 * Nothing here touches research/ — that is the scrapers' territory and is read in
 * place, by URL, through app/media/[...path]/route.ts.
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------- types */

export type Tag = {
  id: string;
  label: string;
  /** The verbatim phrase that caused this tag. A tag is a quotation, never an assertion. */
  evidence: string | null;
  note: string | null;
};

/** What we actually hold for a post, which varies as the scrapes land. */
export type Tier =
  /** metrics + a transcribed hook + an asset (mp4, slides or a frame-read) */
  | "deep"
  /** metrics + a transcribed on-screen hook */
  | "hook"
  /** metrics only */
  | "metrics";

export type Post = {
  id: string;
  rank: number;
  brand: string;
  handle: string;
  url: string;
  date: string;
  uploadedAt: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  caption: string;
  hashtags: string[];
  onScreen: string | null;
  hookSource: "frames" | "cover" | null;
  imageDescription: string | null;
  sound: string | null;
  soundArtist: string | null;
  format: "video" | "slideshow";
  slideCount: number;
  cover: string | null;
  video: string | null;
  slides: string[];
  notes: { verbatim: string | null; structure: string | null; visualStyle: string | null; notes: string | null } | null;
  tier: Tier;
  tags: { hook: Tag[]; insertion: Tag[]; disclosure: Tag[]; sound: Tag[]; format: Tag[] };
};

export type AccountStats = {
  postCount: number;
  totalViews: number;
  medianViews: number;
  maxViews: number;
  /** The breakout signal — top post relative to the account's own baseline. */
  xMedian: number | null;
  topPostId: string;
  firstPost: string;
  lastPost: string;
  spanDays: number;
  postsPerWeek: number;
  active: boolean;
  engagementRate: number;
  deepDives: number;
  withCover: number;
  withHook: number;
  slideshows: number;
};

export type Account = {
  handle: string;
  brand: string;
  name: string;
  bio: string | null;
  url: string;
  verified: boolean;
  followers: number | null;
  following: number | null;
  totalVideos: number | null;
  totalLikes: number | null;
  /** The brand's own account. It sits in the carousel unmarked and at true size. */
  isOwn: boolean;
  handleConvention: { id: string; label: string; evidence: string | null };
  bioDisclosure: Tag[];
  posts: Post[];
  stats: AccountStats;
  coverage: { hookRows: number; hookRejected: number };
};

export type TeardownSection = {
  n: number;
  heading: string;
  slug: string;
  body: string | null;
  /** False while the teardown for this brand is still being written. */
  present: boolean;
};

export type Brand = {
  id: string;
  name: string;
  project?: string;
  app?: string;
  niche?: string;
  fullName?: string;
  tagline?: string;
  blurb?: string;
  publisher?: string | null;
  own?: string[];
  ownNote?: string;
  market?: string;
  marketNote?: string;
  language?: string[];
  accent?: string;
  appStore?: Record<string, unknown>;
  accounts: Account[];
  teardown: TeardownSection[];
  hasTeardown: boolean;
  notes: string | null;
  appStoreCapture: string | null;
  stats: {
    accountCount: number;
    knownHandles: number;
    postCount: number;
    totalViews: number;
    topPostId: string | null;
    topPostViews: number;
    topPostHandle: string | null;
    medianViews: number;
    firstPost: string | null;
    lastPost: string | null;
    deepDives: number;
    withCover: number;
    ownAccountCount: number;
  };
};

export type Thread = {
  dimension: string;
  id: string;
  label: string;
  note: string | null;
  posts?: { id: string; brand: string; handle: string; views: number; evidence: string | null }[];
  accounts?: { handle: string; brand: string; [k: string]: unknown }[];
  count: number;
  brandCount: number;
  brandList: string[];
  /** The interesting kind: the same pattern on unrelated apps. */
  crossNetwork: boolean;
};

export type Corpus = {
  networks: number;
  accounts: number;
  knownHandles: number;
  posts: number;
  totalViews: number;
  deepDives: number;
  withHook: number;
  withCover: number;
  videos: number;
  slideSets: number;
  firstPost: string | null;
  lastPost: string | null;
};

export type OrbPlate = {
  kind: "post";
  postId: string;
  handle: string;
  brand: string;
  views: number;
  cover: string;
  isOwn: boolean;
  name: string;
  href: string;
};

export type OrbCluster = {
  id: string;
  kind: string;
  label: string;
  accent?: string;
  niche?: string | null;
  centre: { kind: string; brand: string; name: string; href: string; avatar: string | null };
  plates: OrbPlate[];
};

export type Index = {
  generatedAt: string;
  corpus: Corpus;
  brands: Brand[];
  threads: Record<string, Record<string, Thread>>;
  orb: OrbCluster[];
};

/* ------------------------------------------------------------------ loading */

let cached: Index | null = null;
let cachedMtime = 0;

/** No index yet is a normal state — the atlas is empty until the research has run. */
const EMPTY: Index = {
  generatedAt: "",
  corpus: { networks: 0, accounts: 0, knownHandles: 0, posts: 0, totalViews: 0, deepDives: 0, withHook: 0, withCover: 0, videos: 0, slideSets: 0, firstPost: null, lastPost: null },
  brands: [],
  threads: {},
  orb: [],
};

/**
 * Read once, then re-read only when the file changes. `ugckit atlas --index`
 * runs while the server is up — after a harvest lands — and the next request
 * must see the new corpus without a restart. One stat per request is the price.
 */
export function getIndex(): Index {
  const path = join(process.cwd(), "data", "index.json");
  let mtime = 0;
  try {
    mtime = statSync(path).mtimeMs;
  } catch {
    cached = EMPTY; // `./ugckit atlas` rebuilds it; until then, render empty and say so
    cachedMtime = 0;
    return cached;
  }
  if (cached && mtime === cachedMtime) return cached;
  try {
    cached = JSON.parse(readFileSync(path, "utf8")) as Index;
    cachedMtime = mtime;
  } catch {
    cached = cached || EMPTY; // a half-written file mid-index: keep what we had
  }
  return cached;
}

/* ---------------------------------------------------------------- selectors */

export const getBrands = () => getIndex().brands;
export const getCorpus = () => getIndex().corpus;
export const getOrb = () => getIndex().orb;

export const getBrand = (id: string) => getIndex().brands.find((b) => b.id === id) || null;

export function getAccount(handle: string) {
  for (const brand of getIndex().brands) {
    const account = brand.accounts.find((a) => a.handle === handle);
    if (account) return { account, brand };
  }
  return null;
}

export function getPost(id: string) {
  for (const brand of getIndex().brands) {
    for (const account of brand.accounts) {
      const post = account.posts.find((p) => p.id === id);
      if (post) return { post, account, brand };
    }
  }
  return null;
}

export function getThread(dimension: string, id: string) {
  return getIndex().threads[dimension]?.[id] || null;
}

export function allThreads(): Thread[] {
  return Object.values(getIndex().threads).flatMap((group) => Object.values(group));
}

/** Resolve a thread's members to full posts, so a thread page can show real evidence. */
export function threadPosts(thread: Thread) {
  if (!thread.posts) return [];
  return thread.posts
    .map((ref) => {
      const found = getPost(ref.id);
      return found ? { ...found, evidence: ref.evidence } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

export function threadAccounts(thread: Thread) {
  if (!thread.accounts) return [];
  return thread.accounts
    .map((ref) => getAccount(ref.handle))
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

/* ----------------------------------------------------------------- format */

export function views(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return String(n);
}

export const commas = (n: number) => n.toLocaleString("en-US");

export function shortDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

/** Hashtags are stripped from the caption body so prose reads as prose. */
export function captionBody(caption: string): string {
  return caption.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
}
