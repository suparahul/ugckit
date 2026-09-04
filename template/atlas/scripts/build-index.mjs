#!/usr/bin/env node
/**
 * build-index.mjs — walk research/ and emit one index.json.
 *
 * ugckit's research half writes research/<project>/<app>/<handle>/ — the same
 * files, the same join key — so this walks every project and every app and
 * makes one cluster per app. The app ledger in pipeline/state/pipeline.json is
 * the source of names, notes and which handles are the app's own; an optional
 * research/<project>/<app>/app.json adds App Store facts when the teardown
 * found them.
 *
 * Built to be re-run at any moment: it never mutates research/, it tolerates
 * every kind of partial state (an account with no HOOKS.md, a post with no
 * cover, an app with no TEARDOWN.md, a project with nothing scraped yet), and it
 * reports exactly what it found.
 *
 *   node scripts/build-index.mjs            # writes data/index.json + public/search.json
 *   node scripts/build-index.mjs --verbose  # per-account detail
 *
 * THE SPINE. Within one account there is a single primary key: rank N,
 * newest-first. It is the same N in all four sources, which is what lets us
 * join them without guessing:
 *
 *   posts.json  sorted by uploadedAt desc  -> element N-1
 *   index.tsv   column 1                   -> N
 *   HOOKS.md    table column 1             -> N
 *   covers/     NNN.jpg                    -> N
 *
 * Gaps are normal (a cover download can fail) and are carried as nulls rather
 * than shifting the sequence.
 */

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ATLAS = resolve(HERE, "..");
const ROOT = resolve(ATLAS, "..");
const MEDIA = join(ROOT, "research");
const STATE = join(ROOT, "pipeline", "state", "pipeline.json");
/* research/ is the source of truth and is read IN PLACE — nothing is ever copied,
 * moved or restructured, and scrapes are writing into it as this runs. Assets
 * are addressed by URL through the /media/[...path] route, which streams
 * straight out of ../research. Paths under it are <project>/<app>/<handle>/. */
const MEDIA_URL = "/media";
const PALETTE = ["#E1743B", "#6C5CE7", "#2D7D6B", "#C0392B", "#2980B9", "#8E6C2F", "#B03A6E", "#3C8D40"];
/* The full index is read server-side only — it is far too big to ship to the
 * browser. The compact manifest is what the command bar and the control layer
 * need, and it is the only part the client downloads. */
const OUT = join(ATLAS, "data", "index.json");
const OUT_SEARCH = join(ATLAS, "public", "search.json");

const VERBOSE = process.argv.includes("--verbose");

/* ------------------------------------------------------------------ config */

const brandsConfig = readLedger();
const hookRules = compileRules(readJSON(join(ATLAS, "data", "hook-rules.json")).rules);
const threadRules = readJSON(join(ATLAS, "data", "thread-rules.json"));

/* The @-tag mechanic is "the brand account is tagged". Its patterns are the app
 * names in the ledger, not a hand-written list. */
for (const r of threadRules.insertion.rules) {
  if (r.id === "account-tag") {
    r.patterns = brandsConfig.order.map((id) => `@\\s?${brandsConfig.brands[id].token}`);
  }
}
const insertionRules = compileRules(threadRules.insertion.rules);
const disclosureRules = compileRules(threadRules.disclosure.rules);
const originalSoundRe = new RegExp(threadRules.sound.originalPatterns.join("|"), "i");

/* Directories under research/<project>/ that are not apps, and under an app
 * that are not handles. */
const NOT_AN_APP = new Set(["searches", "covers", "comments"]);
const NOT_A_HANDLE = new Set(["searches", "covers", "comments"]);

/* ------------------------------------------------------------- the ledger */

/**
 * pipeline/state/pipeline.json holds every project's app ledger. Each app there
 * becomes a brand: `own` is every handle marked `own yes` in the ledger, or
 * whose handle contains the app's name. An app folder that exists on disk but
 * is not in the ledger is still indexed, with defaults, so nothing is hidden.
 */
function readLedger() {
  const cfg = { order: [], brands: {} };
  let state = null;
  try {
    state = readJSON(STATE);
  } catch {
    /* no state yet — an empty atlas is a valid atlas */
  }
  const projects = (state && state.projects) || {};
  const seen = new Map(); // app name -> project, to spot collisions
  for (const [project, p] of Object.entries(projects)) {
    const r = p.research || {};
    for (const [app, row] of Object.entries(r.apps || {})) {
      const id = seen.has(app) && seen.get(app) !== project ? `${project}-${app}` : app;
      seen.set(app, project);
      const token = app.toLowerCase().replace(/[^a-z0-9]/g, "");
      const handles = row.handles || {};
      const own = Object.entries(handles)
        .filter(([h, v]) => String(v.own || "") === "yes" || h.toLowerCase().replace(/[^a-z0-9]/g, "").includes(token))
        .map(([h]) => h);
      cfg.order.push(id);
      cfg.brands[id] = {
        id,
        dir: join(MEDIA, project, app),
        project,
        app,
        token,
        niche: r.niche || "",
        name: app,
        tagline: r.niche ? `${r.niche} · ${project}` : project,
        blurb: row.note || row.evidence || null,
        own,
        ledgerHandles: Object.keys(handles).length,
        accent: PALETTE[cfg.order.length % PALETTE.length],
        ...readAppJson(join(MEDIA, project, app)),
      };
    }
  }
  return cfg;
}

/** Optional hand- or agent-written facts: name, fullName, tagline, blurb, publisher, market, language, appStore. */
function readAppJson(dir) {
  try {
    return readJSON(join(dir, "app.json"));
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ helpers */

function readJSON(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function readText(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listDirs(p) {
  try {
    return readdirSync(p).filter((n) => !n.startsWith(".") && isDir(join(p, n)));
  } catch {
    return [];
  }
}

/** Compile a rule list's `patterns` / `bioPatterns` into regexes once. */
function compileRules(rules) {
  return rules.map((r) => ({
    ...r,
    re: r.patterns ? r.patterns.map((p) => new RegExp(p, "i")) : [],
    bioRe: r.bioPatterns ? r.bioPatterns.map((p) => new RegExp(p, "i")) : [],
  }));
}

/**
 * TikTok on-screen text elongates for emphasis — "I'm JUST NOWWW FINDING THIS"
 * is the corpus's single biggest post (29.2M) and is the same hook as "just now
 * finding this". So matching runs against a normalised copy with runs of three
 * or more repeated letters collapsed, while `map` carries every normalised
 * index back to its source index so the recorded evidence is still the verbatim
 * original slice. We match on the normalised text; we always quote the real one.
 */
function normalise(text) {
  const out = [];
  const map = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    let j = i + 1;
    while (j < text.length && text[j].toLowerCase() === ch.toLowerCase()) j++;
    const run = j - i;
    const keep = run >= 3 && /[a-z]/i.test(ch) ? 1 : run;
    for (let k = 0; k < keep; k++) {
      out.push(text[i + k]);
      map.push(i + k);
    }
    i = j;
  }
  return { text: out.join(""), map };
}

/**
 * Run compiled rules over text and return every hit, each carrying the exact
 * substring that matched. That evidence is the whole point — a tag in the app
 * is never an assertion, it is a quotation.
 */
function applyRules(rules, text, { key = "re" } = {}) {
  if (!text) return [];
  const norm = normalise(text);
  const hits = [];
  for (const rule of rules) {
    for (const re of rule[key] || []) {
      const m = norm.text.match(re);
      if (m) {
        // Map the normalised match back onto the original characters.
        const from = norm.map[m.index] ?? 0;
        const last = norm.map[m.index + m[0].length - 1] ?? from;
        hits.push({ id: rule.id, label: rule.label, evidence: text.slice(from, last + 1).trim(), note: rule.note || null });
        break;
      }
    }
  }
  return hits;
}

/**
 * The cover-reading pass writes a sentinel when a cover carries no legible
 * overlay. Those are not hooks and must never be quoted as one — a post with no
 * on-screen text is a real and interesting finding (most of UMax works this
 * way), but it is the absence that is the finding.
 */
const NO_HOOK = new Set([
  "no text", "no text visible", "no on-screen text", "no onscreen text", "no visible text",
  "none", "n/a", "na", "unreadable", "illegible", "-", "—", "–", "no hook", "no caption",
]);

function cleanHook(s) {
  if (!s) return null;
  const t = s.trim().replace(/^["'“‘]|["'”’]$/g, "").trim();
  if (!t) return null;
  return NO_HOOK.has(t.toLowerCase().replace(/[.*_]/g, "")) ? null : s.trim();
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/* ------------------------------------------------------- HOOKS.md parsing */

/**
 * HOOKS.md is a markdown table, emitted in batches with prose observations
 * between the chunks, so we scan every line rather than assuming one table.
 * Rows look like:  | 12 | 1496 | <hook> | <image description> | <same as prev> |
 *
 * The views column is a checksum: if it disagrees with the post at that rank we
 * drop the row rather than attach a hook to the wrong post. Silent misalignment
 * here would put a fabricated quote under a real number, which is the one
 * failure mode this app cannot have.
 */
function parseHooks(path, postsByRank) {
  const text = readText(path);
  if (!text) return { hooks: new Map(), rows: 0, rejected: 0 };

  const hooks = new Map();
  let rows = 0;
  let rejected = 0;

  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 3) continue;

    const rank = Number(cells[0]);
    if (!Number.isInteger(rank) || rank < 1) continue; // header or separator
    rows++;

    const views = Number(String(cells[1]).replace(/[^\d]/g, ""));
    const post = postsByRank.get(rank);
    if (!post) {
      rejected++;
      continue;
    }
    if (Number.isFinite(views) && views !== post.views) {
      rejected++; // checksum failed — refuse the join
      continue;
    }

    hooks.set(rank, {
      onScreen: cleanHook(cells[2]),
      imageDescription: cells[3] && cells[3] !== "—" && cells[3] !== "N/A" ? cells[3] : null,
    });
  }

  return { hooks, rows, rejected };
}

/* -------------------------------------------------- per-post notes.md parse */

/**
 * A deep-dived post has notes.md with fixed `## ` sections written by the
 * frame-reading pass. We keep the verbatim on-screen text separately because
 * that is the quotable asset; the rest is carried as rendered prose.
 */
function parseNotes(path) {
  const text = readText(path);
  if (!text) return null;

  const sections = {};
  let current = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      current = h[1];
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }

  const get = (name) => {
    const key = Object.keys(sections).find((k) => k.toLowerCase().includes(name));
    return key ? sections[key].join("\n").trim() : null;
  };

  const verbatimBlock = get("verbatim");
  // The transcription is wrapped in double quotes — and very often CONTAINS
  // double quotes, because these hooks quote a therapist or a friend. So take
  // everything between the first quote and the LAST one; a non-greedy match
  // stops at the first inner quote and silently truncates the hook.
  const quoted = verbatimBlock && verbatimBlock.match(/"([\s\S]*)"/);

  return {
    verbatim: cleanHook(quoted ? quoted[1] : verbatimBlock),
    structure: get("structure"),
    visualStyle: get("visual style"),
    notes: get("notes"),
    raw: text,
  };
}

/* --------------------------------------------------- brand document parsing */

/** Split a markdown doc into its `## ` sections, preserving order. */
function parseMarkdownSections(text) {
  if (!text) return [];
  const out = [];
  let current = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      current = { heading: h[1], slug: slug(h[1].replace(/^\d+\.\s*/, "")), body: [] };
      out.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return out.map((s) => ({ ...s, body: s.body.join("\n").trim() }));
}

/** The thirteen fixed teardown headings, in order, per METHOD.md step 7. */
const TEARDOWN_HEADINGS = [
  "The app",
  "Account architecture",
  "Launch cadence and lifecycle",
  "Format portfolio",
  "Hook patterns",
  "Product insertion",
  "Conversion strategy",
  "Engagement strategy",
  "Topic and niche selection",
  "Experiments they ran, and the results",
  "What transfers to our own app",
  "What we still don't know",
  "Method and cost",
];

/**
 * Teardowns are still being written. Rather than hide the gap, we emit all
 * thirteen slots every time and mark the ones that have no text yet — the brand
 * page renders them as visibly empty so the room can tell the difference
 * between "no analysis" and "no section".
 */
function buildTeardown(brandDir) {
  const text = readText(join(brandDir, "TEARDOWN.md"));
  const sections = parseMarkdownSections(text);
  const byIndex = new Map();
  for (const s of sections) {
    const n = s.heading.match(/^(\d+)\./);
    if (n) byIndex.set(Number(n[1]), s);
  }

  return TEARDOWN_HEADINGS.map((heading, i) => {
    const found = byIndex.get(i + 1) || sections.find((s) => slug(s.heading).includes(slug(heading)));
    return {
      n: i + 1,
      heading,
      slug: slug(heading),
      body: found ? found.body : null,
      present: Boolean(found && found.body),
    };
  });
}

/* ------------------------------------------------------------ account build */

function buildAccount(brandId, brandDir, handle, cfg) {
  const URL = `${MEDIA_URL}/${cfg.dir.slice(MEDIA.length + 1)}`;
  const dir = join(brandDir, handle);
  const postsPath = join(dir, "posts.json");
  if (!existsSync(postsPath)) return null;

  let raw;
  try {
    raw = readJSON(postsPath);
  } catch (e) {
    console.warn(`  ! ${brandId}/${handle}: posts.json unreadable (${e.message})`);
    return null;
  }
  if (!Array.isArray(raw) || !raw.length) return null;

  // THE SPINE: newest-first is rank 1. A record with no id cannot be addressed
  // by a route or joined to anything on disk, and one has already turned up in
  // a live scrape, so drop it here rather than letting it fail the whole build.
  // The scrape has also emitted the exact same post twice in one account
  // (justin.loves.food, id 7658799614518185247) — collapse exact-id repeats
  // before ranking so rank N stays one row per real post. If this shifts a
  // post's rank relative to what covers/NNN.jpg or HOOKS.md were built
  // against, the existing views-checksum join just drops that row rather than
  // misjoining it — no extra guard needed here.
  const seen = new Set();
  const deduped = raw.filter((p) => p && p.id && !seen.has(p.id) && seen.add(p.id));
  const sorted = deduped.sort((a, b) => b.uploadedAt - a.uploadedAt);
  if (!sorted.length) return null;
  const postsByRank = new Map(sorted.map((p, i) => [i + 1, p]));

  const { hooks, rows: hookRows, rejected: hookRejected } = parseHooks(join(dir, "HOOKS.md"), postsByRank);

  // Which covers actually landed. Cover NNN.jpg is rank N.
  const coverDir = join(dir, "covers");
  const covers = new Set();
  if (isDir(coverDir)) {
    for (const f of readdirSync(coverDir)) {
      const m = f.match(/^(\d+)\.jpg$/);
      if (m) covers.add(Number(m[1]));
    }
  }

  const channel = sorted[0].channel || {};
  const isOwn = (cfg.own || []).includes(handle);
  const handleConvention = applyRules(cfg.handleRules || [], handle)[0] || null;
  const bioDisclosure = applyRules(disclosureRules, channel.bio, { key: "bioRe" });

  const posts = sorted.map((p, i) => {
    const rank = i + 1;
    const hook = hooks.get(rank) || null;
    const caption = p.title || "";
    // Real scrape data carries nulls and non-strings inside these arrays, so
    // everything downstream is fed a cleaned list rather than being guarded
    // at each use site.
    const hashtags = (p.hashtags || []).filter((h) => typeof h === "string" && h);
    const hashtagText = hashtags.join(" ");
    const slideUrls = (p.images || []).filter(Boolean);

    // What's on disk for this post.
    const postDir = join(dir, p.id);
    const hasDir = isDir(postDir);
    const videoPath = hasDir && existsSync(join(postDir, "video.mp4")) ? `${URL}/${handle}/${p.id}/video.mp4` : null;
    const slides = hasDir
      ? readdirSync(postDir)
          .filter((f) => /^slide-\d+\.jpg$/.test(f))
          .sort()
          .map((f) => `${URL}/${handle}/${p.id}/${f}`)
      : [];
    const notes = hasDir ? parseNotes(join(postDir, "notes.md")) : null;

    // The hook we quote: the frame-read transcription is best, then the
    // cover-read table, then nothing. Never the caption — a caption is not a hook.
    const onScreen = (notes && notes.verbatim) || (hook && hook.onScreen) || null;
    const hookSource = notes && notes.verbatim ? "frames" : hook && hook.onScreen ? "cover" : null;

    // Hook taxonomy runs on the transcription first, caption second.
    const hookText = onScreen || caption;
    const hookTags = applyRules(hookRules, hookText);

    // Insertion mechanics.
    const insertion = applyRules(insertionRules, `${caption} ${hashtagText}`);
    const brandInHashtag = hashtags.some((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cfg.token || brandId));
    if (brandInHashtag && onScreen) {
      insertion.unshift({
        id: "hashtag-and-onscreen",
        label: "Hashtag + on-screen text",
        evidence: hashtags.find((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "").includes(cfg.token || brandId)),
        note: null,
      });
    }

    const disclosure = applyRules(disclosureRules, `${caption} ${hashtagText}`);
    const song = p.song || {};
    const soundOriginal = song.title ? originalSoundRe.test(song.title) : null;

    // Tiers drive what the post page can render. `deep` means there is an
    // asset or a frame-read to show, not merely a metrics row.
    const tier = notes || videoPath || slides.length ? "deep" : onScreen ? "hook" : "metrics";

    return {
      id: p.id,
      rank,
      brand: brandId,
      handle,
      url: p.postPage || `https://www.tiktok.com/@${handle}/video/${p.id}`,
      date: (p.uploadedAtFormatted || "").slice(0, 10),
      uploadedAt: p.uploadedAt,
      views: p.views || 0,
      likes: p.likes || 0,
      comments: p.comments || 0,
      shares: p.shares || 0,
      bookmarks: p.bookmarks || 0,
      caption,
      hashtags,
      onScreen,
      hookSource,
      imageDescription: hook ? hook.imageDescription : null,
      sound: song.title || null,
      soundArtist: song.artist || null,
      format: slideUrls.length > 0 || slides.length > 0 ? "slideshow" : "video",
      slideCount: slideUrls.length || slides.length || 0,
      cover: covers.has(rank) ? `${URL}/${handle}/covers/${String(rank).padStart(3, "0")}.jpg` : null,
      video: videoPath,
      slides,
      notes: notes ? { verbatim: notes.verbatim, structure: notes.structure, visualStyle: notes.visualStyle, notes: notes.notes } : null,
      tier,
      tags: {
        hook: hookTags,
        insertion,
        disclosure: disclosure.length ? disclosure : [{ id: "none", label: "No disclosure", evidence: null, note: null }],
        sound: soundOriginal === null ? [] : [{ id: soundOriginal ? "original" : "licensed", label: soundOriginal ? "Original sound" : "Licensed track", evidence: song.title, note: null }],
        format: [{ id: slideUrls.length || slides.length ? "slideshow" : "video", label: slideUrls.length || slides.length ? "Slideshow" : "Video", evidence: null, note: null }],
      },
    };
  });

  // Lifecycle arithmetic (METHOD step 5) — pure derivation, no new data.
  const views = posts.map((p) => p.views);
  const med = median(views);
  const top = posts.reduce((a, b) => (b.views > a.views ? b : a), posts[0]);
  const dates = posts.map((p) => p.uploadedAt).sort((a, b) => a - b);
  const firstAt = dates[0];
  const lastAt = dates[dates.length - 1];
  const spanDays = Math.max(1, Math.round((lastAt - firstAt) / 86400));
  const daysSinceLast = Math.round(Date.now() / 1000 - lastAt) / 86400;

  const totalEngagement = posts.reduce((s, p) => s + p.likes + p.comments + p.shares + p.bookmarks, 0);
  const totalViews = views.reduce((s, v) => s + v, 0);

  return {
    handle,
    brand: brandId,
    name: channel.name || handle,
    bio: channel.bio || null,
    url: channel.url || `https://www.tiktok.com/@${handle}`,
    verified: Boolean(channel.verified),
    followers: channel.followers ?? null,
    following: channel.following ?? null,
    totalVideos: channel.videos ?? null,
    totalLikes: channel.likes ?? null,
    isOwn,
    handleConvention: handleConvention
      ? { id: handleConvention.id, label: handleConvention.label, evidence: handleConvention.evidence }
      : isOwn
        ? { id: "brand-shaped", label: "Brand-shaped handle", evidence: handle }
        : { id: "none", label: "No convention", evidence: null },
    bioDisclosure,
    posts,
    stats: {
      postCount: posts.length,
      totalViews,
      medianViews: med,
      maxViews: top.views,
      // The Social Growth Engineers breakout signal — a better outlier metric
      // than raw views, because it is relative to the account's own baseline.
      xMedian: med ? Number((top.views / med).toFixed(1)) : null,
      topPostId: top.id,
      firstPost: new Date(firstAt * 1000).toISOString().slice(0, 10),
      lastPost: new Date(lastAt * 1000).toISOString().slice(0, 10),
      spanDays,
      postsPerWeek: Number(((posts.length / spanDays) * 7).toFixed(1)),
      active: daysSinceLast < 21,
      engagementRate: totalViews ? Number(((totalEngagement / totalViews) * 100).toFixed(2)) : 0,
      deepDives: posts.filter((p) => p.tier === "deep").length,
      withCover: posts.filter((p) => p.cover).length,
      withHook: posts.filter((p) => p.onScreen).length,
      slideshows: posts.filter((p) => p.format === "slideshow").length,
    },
    coverage: { hookRows, hookRejected },
  };
}

/* --------------------------------------------------------------- brand logos */

/**
 * Fetch the brand's own TikTok profile picture into media/<brand>/logo.jpg.
 *
 * This is the ONE thing the build writes into media/ — everything else there is
 * the scrapers' territory and is read only. It is done here rather than
 * hotlinked because the avatar URLs in posts.json are signed and expire within
 * days, so a link that works today is a broken centre plate at session time.
 *
 * Same shape as the covers the shallow pass fetches: curl, then `sips` to turn
 * the CDN's HEIC into a jpg the browser will actually render. Resumable — an
 * existing logo.jpg is left alone, so re-running costs nothing.
 */
function fetchBrandLogo(brandId, brandDir, cfg) {
  const URL = `${MEDIA_URL}/${brandDir.slice(MEDIA.length + 1)}`;
  const out = join(brandDir, "logo.jpg");
  if (existsSync(out) && statSync(out).size > 0) return `${URL}/logo.jpg`;

  // The brand's own account is the only honest source for its mark.
  for (const handle of cfg.own || []) {
    const postsPath = join(brandDir, handle, "posts.json");
    if (!existsSync(postsPath)) continue;
    let url = null;
    try {
      const posts = readJSON(postsPath);
      url = posts.map((p) => p?.channel?.avatar).find(Boolean) || null;
    } catch {
      continue;
    }
    if (!url) continue;

    const tmp = join(brandDir, ".logo.src");
    try {
      execFileSync("curl", ["-sL", "--max-time", "25", "-A", "Mozilla/5.0", url, "-o", tmp], { stdio: "ignore" });
      // ffmpeg, not sips: sips is macOS only and ffmpeg is already a hard dependency.
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", "scale='min(512,iw)':-2", "-q:v", "3", out], { stdio: "ignore" });
      if (existsSync(out) && statSync(out).size > 0) {
        console.log(`  + fetched ${brandId}/logo.jpg`);
        return `${URL}/logo.jpg`;
      }
    } catch {
      // A brand with no reachable logo keeps its typographic centre plate.
    } finally {
      try { execFileSync("rm", ["-f", tmp], { stdio: "ignore" }); } catch {}
    }
  }
  return null;
}

/* -------------------------------------------------------------- brand build */

/**
 * Handle conventions are counted, not authored: a suffix after the last dot
 * that two or more handles in one app share — `.lifts`, `.traveltips` — is a
 * convention, and its rule quotes the suffix. One handle is a name, not a
 * pattern.
 */
function conventionRules(handles) {
  const counts = new Map();
  for (const h of handles) {
    const m = h.toLowerCase().match(/[._]([a-z]{3,})\d*$/);
    if (m) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return compileRules(
    [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([suffix]) => ({
        id: `firstname-${suffix}`,
        label: `<firstname>.${suffix}`,
        patterns: [`[._]${suffix}\\d*$`],
        note: null,
      }))
  );
}

function buildBrand(brandId) {
  const cfg = brandsConfig.brands[brandId] || { id: brandId, name: brandId };
  const brandDir = cfg.dir;
  const rel = brandDir.slice(MEDIA.length + 1); // <project>/<app>

  const handles = listDirs(brandDir).filter((d) => !NOT_A_HANDLE.has(d));
  cfg.handleRules = conventionRules(handles);
  const accounts = [];
  for (const handle of handles) {
    const acc = buildAccount(brandId, brandDir, handle, cfg);
    if (acc) accounts.push(acc);
  }
  accounts.sort((a, b) => b.stats.maxViews - a.stats.maxViews);

  const allPosts = accounts.flatMap((a) => a.posts);
  const totalViews = allPosts.reduce((s, p) => s + p.views, 0);
  const topPost = allPosts.reduce((a, b) => (!a || b.views > a.views ? b : a), null);
  const dates = allPosts.map((p) => p.uploadedAt).sort((a, b) => a - b);

  // How many handles the ledger holds — the honest denominator, so a partial
  // network is never shown as a whole one.
  const knownHandles = Math.max(cfg.ledgerHandles || 0, accounts.length);

  const appStoreCapture = readdirSync(brandDir).find((f) => /^appstore.*\.(png|jpg)$/i.test(f));
  const logo = fetchBrandLogo(brandId, brandDir, cfg);

  const { dir: _dir, handleRules: _hr, ledgerHandles: _lh, ...pub } = cfg;
  return {
    id: brandId,
    ...pub,
    accounts,
    teardown: buildTeardown(brandDir),
    hasTeardown: existsSync(join(brandDir, "TEARDOWN.md")),
    notes: readText(join(brandDir, "NETWORK.md")) || readText(join(brandDir, "..", "NOTES.md")),
    appStoreCapture: appStoreCapture ? `${MEDIA_URL}/${rel}/${appStoreCapture}` : null,
    logo,
    stats: {
      accountCount: accounts.length,
      knownHandles,
      postCount: allPosts.length,
      totalViews,
      topPostId: topPost ? topPost.id : null,
      topPostViews: topPost ? topPost.views : 0,
      topPostHandle: topPost ? topPost.handle : null,
      medianViews: median(allPosts.map((p) => p.views)),
      firstPost: dates.length ? new Date(dates[0] * 1000).toISOString().slice(0, 10) : null,
      lastPost: dates.length ? new Date(dates[dates.length - 1] * 1000).toISOString().slice(0, 10) : null,
      deepDives: allPosts.filter((p) => p.tier === "deep").length,
      withCover: allPosts.filter((p) => p.cover).length,
      ownAccountCount: accounts.filter((a) => a.isOwn).length,
    },
  };
}

/* --------------------------------------------------------------- threads */

/**
 * A thread is every post in the corpus carrying one tag, across all brands.
 * This is the connective tissue: pulling a thread on a Potto post rails up the
 * same line on four unrelated apps. Threads are built once here so the app
 * never has to scan the corpus at request time.
 */
function buildThreads(brands) {
  const dimensions = ["hook", "insertion", "disclosure", "sound", "format"];
  const threads = {};

  for (const dim of dimensions) {
    threads[dim] = {};
    for (const brand of brands) {
      for (const acc of brand.accounts) {
        for (const post of acc.posts) {
          for (const tag of post.tags[dim] || []) {
            const t = (threads[dim][tag.id] ||= {
              dimension: dim,
              id: tag.id,
              label: tag.label,
              note: tag.note || null,
              posts: [],
              brands: new Set(),
            });
            t.posts.push({ id: post.id, brand: post.brand, handle: post.handle, views: post.views, evidence: tag.evidence });
            t.brands.add(post.brand);
          }
        }
      }
    }
  }

  // Handle convention lives on the account, not the post.
  threads.handleConvention = {};
  for (const brand of brands) {
    for (const acc of brand.accounts) {
      const c = acc.handleConvention;
      if (!c || !c.id) continue;
      const t = (threads.handleConvention[c.id] ||= {
        dimension: "handleConvention",
        id: c.id,
        label: c.label,
        note: null,
        accounts: [],
        brands: new Set(),
      });
      t.accounts.push({ handle: acc.handle, brand: acc.brand, followers: acc.followers, maxViews: acc.stats.maxViews });
      t.brands.add(acc.brand);
    }
  }

  // Cadence is a computed band, not a tag.
  threads.cadence = {};
  for (const brand of brands) {
    for (const acc of brand.accounts) {
      const ppw = acc.stats.postsPerWeek;
      const band = ppw >= 10 ? "high" : ppw >= 4 ? "steady" : ppw >= 1 ? "low" : "dormant";
      const label = { high: "10+ posts a week", steady: "4–10 a week", low: "1–4 a week", dormant: "Under one a week" }[band];
      const t = (threads.cadence[band] ||= { dimension: "cadence", id: band, label, note: null, accounts: [], brands: new Set() });
      t.accounts.push({ handle: acc.handle, brand: acc.brand, postsPerWeek: ppw, active: acc.stats.active });
      t.brands.add(acc.brand);
    }
  }

  // Finalise: sort by views, count, drop the Sets.
  for (const dim of Object.keys(threads)) {
    for (const id of Object.keys(threads[dim])) {
      const t = threads[dim][id];
      if (t.posts) t.posts.sort((a, b) => b.views - a.views);
      if (t.accounts) t.accounts.sort((a, b) => (b.maxViews || 0) - (a.maxViews || 0));
      t.brandCount = t.brands.size;
      t.brandList = [...t.brands];
      delete t.brands;
      t.count = (t.posts || t.accounts).length;
      // A thread that crosses networks is the interesting kind — this is what
      // makes "four unrelated apps, the same line" a fact rather than a claim.
      t.crossNetwork = t.brandCount > 1;
    }
  }

  return threads;
}

/* ------------------------------------------------------------------- orb */

/**
 * Plate selection for the orb. Only the top creators go on the globe — the rest
 * live on the brand home page. The globe is the invitation, not the index.
 *
 * A plate needs a cover to exist, so we take each account's best-performing
 * post that actually has one on disk. As covers land, plates fill in.
 */
function buildOrb(brands, opts = { perBrand: 36, perAccount: 2 }) {
  const clusters = [];

  for (const brand of brands) {
    const plates = [];
    for (const acc of brand.accounts) {
      if (!acc.posts.length) continue;
      // Prefer posts that HAVE a cover on disk, because a real thumbnail is the
      // point. But never drop an account for lacking one — covers are still
      // landing across the corpus, and a missing plate would silently shrink a
      // whole network's constellation and break the geography that carries the
      // argument. The orb paints a typographic plate instead.
      const withCover = acc.posts.filter((p) => p.cover);
      const pool = withCover.length ? withCover : acc.posts;
      const best = [...pool].sort((a, b) => b.views - a.views).slice(0, opts.perAccount);
      for (const post of best) {
        plates.push({
          kind: "post",
          postId: post.id,
          handle: acc.handle,
          brand: brand.id,
          views: post.views,
          cover: post.cover,
          isOwn: acc.isOwn,
          // The accessible name the driver reads and clicks.
          name: `${brand.name} · @${acc.handle} · ${formatViews(post.views)}${post.tags.hook[0] ? ` · ${post.tags.hook[0].id}` : ""}`,
          // A plate opens the ACCOUNT, not the post. The argument the orb makes
          // is about networks of creators, and the account page is where a
          // creator's whole run is legible — the post itself is one click on
          // from there.
          href: `/account/${acc.handle}`,
        });
      }
    }
    plates.sort((a, b) => b.views - a.views);

    clusters.push({
      id: brand.id,
      kind: "brand",
      label: brand.name,
      accent: brand.accent,
      niche: brand.niche || null,
      centre: {
        kind: "brand",
        brand: brand.id,
        name: `${brand.name} · the network · ${brand.stats.accountCount} accounts · ${formatViews(brand.stats.totalViews)}`,
        href: `/brand/${brand.id}`,
        // The brand's own TikTok avatar is the honest logo we hold. Where a
        // brand has no account at all (roamy), the orb falls back to type.
        avatar: brandAvatar(brand),
      },
      // Every account gets its best post before any account gets a second, so
      // the cap thins the tail rather than hiding whole accounts.
      plates: thinPlates(plates, opts.perBrand),
    });
  }

  return clusters;
}

/** Round-robin by account, best-first, so no account is dropped before the cap. */
function thinPlates(plates, cap) {
  const byAccount = new Map();
  for (const p of plates) {
    if (!byAccount.has(p.handle)) byAccount.set(p.handle, []);
    byAccount.get(p.handle).push(p);
  }
  const lanes = [...byAccount.values()].map((v) => v.sort((a, b) => b.views - a.views));
  lanes.sort((a, b) => b[0].views - a[0].views);
  const out = [];
  for (let round = 0; out.length < cap; round++) {
    let took = 0;
    for (const lane of lanes) {
      if (out.length >= cap) break;
      if (lane[round]) { out.push(lane[round]); took++; }
    }
    if (!took) break;
  }
  return out.sort((a, b) => b.views - a.views);
}

function brandAvatar(brand) {
  // The app's own logo is the way into the network. Only if it could not be
  // fetched does the orb fall back to a drawn text plate (brand.logo === null).
  return brand.logo || null;
}

function formatViews(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

/* ---------------------------------------------------------- search manifest */

/**
 * The compact manifest the browser actually downloads. Everything the command
 * bar can resolve and everything the shadow-DOM control layer has to name lives
 * here; the heavy per-post detail stays server-side. Keeping this small matters
 * — the command bar is the driver's most reliable lever and it must never wait.
 */
function buildSearch(index) {
  const entries = [];

  for (const b of index.brands) {
    entries.push({
      kind: "brand",
      id: b.id,
      name: b.name,
      href: `/brand/${b.id}`,
      terms: [b.id, b.name, b.fullName, b.tagline].filter(Boolean).join(" ").toLowerCase(),
      meta: `${b.stats.accountCount} accounts · ${formatViews(b.stats.totalViews)}`,
    });

    for (const a of b.accounts) {
      entries.push({
        kind: "account",
        id: a.handle,
        name: `@${a.handle}`,
        href: `/account/${a.handle}`,
        brand: b.id,
        terms: `${a.handle} ${a.name} ${b.name} ${b.id}`.toLowerCase(),
        meta: `${b.name} · ${formatViews(a.stats.maxViews)} top · ${a.stats.postCount} posts${a.isOwn ? " · brand's own" : ""}`,
        isOwn: a.isOwn,
      });
    }
  }

  for (const [dim, group] of Object.entries(index.threads)) {
    for (const t of Object.values(group)) {
      entries.push({
        kind: "thread",
        id: `${dim}/${t.id}`,
        name: t.label,
        href: `/thread/${dim}/${t.id}`,
        terms: `${t.label} ${t.id} ${dim}`.toLowerCase(),
        meta: `${t.count} ${t.posts ? "posts" : "accounts"} · ${t.brandCount} network${t.brandCount === 1 ? "" : "s"}`,
        crossNetwork: t.crossNetwork,
      });
    }
  }

  // The single biggest post per account is worth addressing by name, so the
  // driver can jump to a specific piece of evidence without knowing its id.
  for (const b of index.brands) {
    for (const a of b.accounts) {
      const top = a.posts.find((p) => p.id === a.stats.topPostId);
      if (!top) continue;
      entries.push({
        kind: "post",
        id: top.id,
        name: `@${a.handle} · ${formatViews(top.views)}`,
        href: `/post/${top.id}`,
        brand: b.id,
        terms: `${a.handle} ${top.id} ${(top.onScreen || top.caption || "").slice(0, 200)}`.toLowerCase(),
        meta: top.date,
      });
    }
  }

  return {
    generatedAt: index.generatedAt,
    corpus: index.corpus,
    entries,
    brands: index.brands.map((b) => ({
      id: b.id,
      name: b.name,
      accent: b.accent,
      accounts: b.accounts.map((a) => ({ handle: a.handle, isOwn: a.isOwn, maxViews: a.stats.maxViews })),
    })),
    orb: index.orb,
  };
}

/* ------------------------------------------------------------------- main */

function main() {
  const t0 = Date.now();
  const brandIds = brandsConfig.order.filter((id) => isDir(brandsConfig.brands[id].dir));

  // An app folder on disk that is not in the ledger still gets indexed, so a
  // network appears the moment its folder does.
  for (const project of listDirs(MEDIA)) {
    for (const app of listDirs(join(MEDIA, project))) {
      if (NOT_AN_APP.has(app)) continue;
      const dir = join(MEDIA, project, app);
      if (brandIds.some((id) => brandsConfig.brands[id].dir === dir)) continue;
      const hasPosts = listDirs(dir).some((h) => existsSync(join(dir, h, "posts.json")));
      if (!hasPosts) continue;
      const id = brandsConfig.brands[app] ? `${project}-${app}` : app;
      brandsConfig.brands[id] = {
        id, dir, project, app, token: app.toLowerCase().replace(/[^a-z0-9]/g, ""), niche: "", name: app,
        tagline: project, blurb: null, own: [], ledgerHandles: 0, accent: PALETTE[brandIds.length % PALETTE.length],
        ...readAppJson(dir),
      };
      brandIds.push(id);
      console.warn(`  ! ${project}/${app} is not in the app ledger — indexed with defaults`);
    }
  }

  const brands = brandIds.map(buildBrand).filter((b) => b.accounts.length);
  if (!brands.length) console.log("\n  nothing scraped yet — the atlas is empty until harvest.sh has run for at least one app");

  const allAccounts = brands.flatMap((b) => b.accounts);
  const allPosts = allAccounts.flatMap((a) => a.posts);
  const threads = buildThreads(brands);
  const orb = buildOrb(brands);

  const index = {
    generatedAt: new Date().toISOString(),
    corpus: {
      networks: brands.length,
      accounts: allAccounts.length,
      knownHandles: brands.reduce((s, b) => s + b.stats.knownHandles, 0),
      posts: allPosts.length,
      totalViews: allPosts.reduce((s, p) => s + p.views, 0),
      deepDives: allPosts.filter((p) => p.tier === "deep").length,
      withHook: allPosts.filter((p) => p.onScreen).length,
      withCover: allPosts.filter((p) => p.cover).length,
      videos: allPosts.filter((p) => p.video).length,
      slideSets: allPosts.filter((p) => p.slides.length).length,
      firstPost: allPosts.map((p) => p.date).filter(Boolean).sort()[0] || null,
      lastPost: allPosts.map((p) => p.date).filter(Boolean).sort().slice(-1)[0] || null,
    },
    brands,
    threads,
    orb,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(index));

  const search = buildSearch(index);
  mkdirSync(dirname(OUT_SEARCH), { recursive: true });
  writeFileSync(OUT_SEARCH, JSON.stringify(search));

  /* ------------------------------------------------------------- report */
  const c = index.corpus;
  const mb = (statSync(OUT).size / 1e6).toFixed(1);
  const skb = (statSync(OUT_SEARCH).size / 1e3).toFixed(0);
  console.log(`\n  data/index.json ${mb} MB (server)   public/search.json ${skb} KB (client)   ${Date.now() - t0}ms\n`);
  console.log(`  ${c.networks} networks · ${c.accounts} of ${c.knownHandles} known accounts · ${c.posts} posts · ${formatViews(c.totalViews)} views`);
  console.log(`  ${c.withHook} posts with a transcribed hook · ${c.deepDives} deep-dived · ${c.videos} videos · ${c.slideSets} slide sets`);
  console.log(`  ${c.withCover} covers on disk  ${c.withCover < c.posts ? `(${c.posts - c.withCover} missing — re-run harvest.sh for that app)` : "(complete)"}`);
  console.log(`  ${c.firstPost} → ${c.lastPost}\n`);

  for (const b of brands) {
    const s = b.stats;
    const td = b.teardown.filter((t) => t.present).length;
    console.log(
      `  ${b.id.padEnd(9)} ${String(s.accountCount).padStart(3)}/${String(s.knownHandles).padEnd(3)} accounts  ` +
        `${String(s.postCount).padStart(4)} posts  ${formatViews(s.totalViews).padStart(6)}  ` +
        `covers ${String(s.withCover).padStart(4)}  teardown ${td}/13` +
        (s.ownAccountCount ? "" : "  [no brand account]")
    );
  }

  const cross = Object.values(threads).flatMap((d) => Object.values(d)).filter((t) => t.crossNetwork);
  console.log(`\n  ${cross.length} cross-network threads:`);
  for (const t of cross.sort((a, b) => b.brandCount - a.brandCount || b.count - a.count).slice(0, 8)) {
    console.log(`    ${t.dimension}/${t.id}`.padEnd(34) + `${t.brandCount} networks · ${t.count} ${t.posts ? "posts" : "accounts"}`);
  }

  const rejected = allAccounts.reduce((s, a) => s + a.coverage.hookRejected, 0);
  if (rejected) console.log(`\n  ${rejected} HOOKS.md rows rejected on the views checksum (not joined — safe)`);

  if (VERBOSE) {
    console.log("");
    for (const a of allAccounts) {
      console.log(
        `    @${a.handle.padEnd(24)} ${String(a.stats.postCount).padStart(3)}p  ` +
          `med ${formatViews(a.stats.medianViews).padStart(5)}  max ${formatViews(a.stats.maxViews).padStart(6)}  ` +
          `x${a.stats.xMedian ?? "-"}  ${a.handleConvention.label}${a.isOwn ? "  [brand's own]" : ""}`
      );
    }
  }
  console.log("");
}

main();
