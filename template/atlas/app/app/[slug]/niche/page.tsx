/**
 * /app/<slug>/niche — the niche of the app. One explorer over every post:
 * the searched posts, the batches and the posts from your own scroll (the
 * source pick tells them apart), one row of pickers with the search box and
 * the sort at its right end, every pick a URL, the platform too when the
 * searches hold Instagram posts. Then the findings the agent wrote, the
 * verdict open and one fold per note, the post table, the parameter values
 * and the accounts. Before the phase starts the page shows its state band
 * and the rooms. The search box (`search=`, lib/search.ts) narrows the grid
 * and the three tables together, and stays with every other filter.
 *
 * The curation marks (lib/niche-marks.ts, apps/<slug>/niche/marks.json): in
 * edit mode (`edit=1`) every tile carries Rule out and Study. A ruled-out
 * post leaves the explorer once saved, and the marks pick shows it again; a
 * Study post is fetched in full by the agent (niche-fetch). The ruled-out
 * posts never set the win bar.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getApp, listApps } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { day7Rows, readAccountTable, readFindings, readPostTable, readValues, type FindingBlock } from "@/lib/findings";
import { listHandles } from "@/lib/handles";
import { getNiche, listBatches, type BatchPost, type NichePost } from "@/lib/niche";
import { markKey, markViewOf, inMarkView, readMarks, shownMark, type MarkEntry } from "@/lib/niche-marks";
import { markWins, overFloor, WIN_VIEWS, type Rated } from "@/lib/niche-win";
import { isViewable, nichePostHref, windowLabel } from "@/lib/niche-posts";
import { PLATFORM_NAME, profileUrl, type Platform } from "@/lib/platform";
import { dateOpts, dateWindow, inWindow } from "@/lib/post-filters";
import { matches, quoted as quote, terms, tileFields } from "@/lib/search";
import { clip } from "@/lib/text";
import { dmy, n, pct, Room, Section } from "@/components/factory/Bits";
import { Anat } from "@/components/factory/Anat";
import { MarksProvider, MarkTile, MarkToggle } from "@/components/factory/NicheMarks";
import { NicheFilters, type Pick } from "@/components/factory/NicheFilters";
import { NicheVideo } from "@/components/factory/NicheVideo";
import { PostSearch } from "@/components/factory/PostSearch";
import { PlatformIcon, PlatformSwitch, viewOf } from "@/components/Platform";
import { StateBand } from "@/components/factory/StateBand";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Niche · ${getApp(slug)?.name ?? "Your app"} — Organic Factory` };
}

/* ------------------------------------------------------------- the tiles */

/** One post on the grid. A count the platform does not report is null (Instagram: saves, shares, a photo's views). */
type Tile = Rated & {
  id: string; src: "search" | "scroll" | "batch"; kw: string; win: string; date: string;
  /** Every row of the post (one per search, keyword, window or batch that found it): the filters match any of them. */
  rows: { src: "search" | "scroll" | "batch"; kw: string; win: string }[];
  handle: string; comments: number; shares: number | null; shrate: number; slides: number | null;
  cover: string | null; caption: string; url: string;
  /** A batch post: its video or slides on disk, or metadata only. */
  held?: "video" | "slides" | "metadata";
  /** The downloaded video.mp4 as a /media URL: the tile plays it. */
  video?: string | null;
  /** The slides or the video are on disk for viewing. */
  viewable: boolean;
  /** The curation mark on file (marks.json): out, study, or "" (unmarked, or a keep of yours). */
  mark?: "" | "out" | "study";
  marked?: MarkEntry;
};

const PAGE = 100;
/* The values a param has when the URL does not name it; a default drops out of every link. */
const DEFS: Record<string, string> = { kind: "both", min: String(WIN_VIEWS), sort: "views" };

const winLabel = windowLabel;
const cut = (t: string, max = 120) => clip(t, max);
const viewsLabel = (v: number) => (v ? `${v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}K`} and up` : "any");

/** Whether any row of the tile has this source, keyword or window. */
const on = (t: Tile, f: "src" | "kw" | "win", v: string) => t.rows.some((r) => r[f] === v);

function tilesOf(posts: NichePost[], scrolled: BatchPost[]): Tile[] {
  const seen = new Map<string, Tile>();
  const out: Tile[] = [];
  /* A batch post that was also read from your scroll keeps its scroll tile. */
  const fromScroll = new Set(scrolled.filter((p) => p.views).map((p) => p.id));
  for (const p of posts) {
    const platform: Platform = p.platform ?? "tiktok";
    const batch = p.window.startsWith("BATCH_");
    if (batch && fromScroll.has(p.id)) continue;
    const row = { src: batch ? "batch" as const : "search" as const, kw: p.keyword, win: p.window };
    const had = seen.get(`${platform}:${p.id}`);
    if (had) { had.rows.push(row); continue; }
    out.push({ id: p.id, platform, rows: [row], src: row.src, held: p.held, video: p.video ?? null, viewable: isViewable({ kind: p.mediaType, held: p.held, video: p.video }), kind: p.mediaType, kw: p.keyword, win: p.window, date: p.date, handle: p.handle, views: p.views, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, shrate: p.views && p.shares ? p.shares / p.views : 0, slides: p.slideCount, cover: p.coverLocal ? p.cover : null, caption: p.caption, url: p.url, win_: false, strength: null });
    seen.set(`${platform}:${p.id}`, out[out.length - 1]);
  }
  /* A post from your scroll keeps its tile even without counts: it is in the explorer like any other. */
  for (const p of scrolled) {
    if (seen.has(`tiktok:${p.id}`)) continue;
    out.push({ id: p.id, platform: "tiktok", rows: [{ src: "scroll", kw: "", win: "SCROLL" }], src: "scroll", kind: p.kind, kw: "", win: "SCROLL", date: p.date ?? "", handle: p.handle, views: p.views || null, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, shrate: p.views ? p.shares / p.views : 0, slides: p.slideCount || null, cover: p.slides[0] ?? null, video: p.video, viewable: isViewable({ kind: p.kind, slides: p.slides, video: p.video }), caption: p.caption, url: p.url, win_: false, strength: null });
    seen.set(`tiktok:${p.id}`, out[out.length - 1]);
  }
  return out;
}

/** The figures under a tile: TikTok's saves and shares; Instagram's likes (per view on a reel), its shares when reported, and comments. */
function Nums({ t }: { t: Tile }) {
  const w = t.win_ ? "is-win" : "";
  if (t.platform === "tiktok") return <p className="niche-tile__nums"><span className={w}><b>{pct(t.saves ?? 0, t.views ?? 0)}</b> saves/view</span><span><b>{n(t.saves ?? 0)}</b> saves</span><span><b>{n(t.shares ?? 0)}</b> shares</span></p>;
  const shares = t.shares !== null ? <span><b>{n(t.shares)}</b> shares</span> : null;
  if (t.likes === null) return <p className="niche-tile__nums"><span>likes hidden</span>{shares}<span><b>{n(t.comments)}</b> comments</span></p>;
  return t.views
    ? <p className="niche-tile__nums"><span className={w}><b>{pct(t.likes, t.views)}</b> likes/view</span><span><b>{n(t.likes)}</b> likes</span>{shares ?? <span><b>{n(t.comments)}</b> comments</span>}</p>
    : <p className="niche-tile__nums"><span className={w}><b>{n(t.likes)}</b> likes</span>{shares}<span><b>{n(t.comments)}</b> comments</span></p>;
}

/** The mark under a tile: a Study post says whether its content is on disk yet; a ruled-out one says who ruled it out and why. */
function MarkLine({ t }: { t: Tile }) {
  if (!t.mark || !t.marked) return null;
  const who = t.marked.by === "agent" ? `the agent${t.marked.rule ? `, rule ${t.marked.rule}` : ""}` : "you";
  if (t.mark === "study") return <p className="niche-tile__mark is-study"><b>★ Study</b> · {t.viewable ? "on disk, ready to read" : "to fetch"} · by {who}{t.marked.why ? `: ${t.marked.why}` : ""}</p>;
  return <p className="niche-tile__mark is-out"><b>✕ Ruled out</b> · by {who}{t.marked.why ? `: ${t.marked.why}` : ""}</p>;
}

/** A tile: the cover opens the post's detail page; "open" goes to the post on its platform. */
function TileCard({ t, mixed, slug }: { t: Tile; mixed: boolean; slug: string }) {
  const ext = { target: "_blank", rel: "noreferrer" } as const;
  const badge = t.kind === "video" ? (t.platform === "instagram" ? "reel" : "video") : t.platform === "instagram" && t.slides === 1 ? "photo" : t.slides ? `${t.slides} slides` : "slideshow";
  return (
    <MarkTile k={markKey(t.platform, t.id)} handle={t.handle} caption={t.caption} className={`niche-tile niche-tile--${t.kind}${t.win_ ? " is-win" : ""}`}>
{t.kind === "video" && t.video ? (
        <NicheVideo className="niche-tile__cover niche-video" src={t.video} poster={t.cover} label={`@${t.handle}`}>
          <span className="niche-tile__badge">{badge}</span>
        {t.src === "scroll" ? <span className="niche-tile__src">your scroll</span> : t.src === "batch" ? <span className="niche-tile__src">{t.held === "metadata" ? "metadata only" : `${t.held} on disk`}</span> : null}
        </NicheVideo>
      ) : (
      <Link className="niche-tile__cover" href={nichePostHref(slug, t.platform, t.id)} aria-label={`@${t.handle} on ${PLATFORM_NAME[t.platform]}: the post in detail`}>
        {t.cover ? <img src={t.cover} alt="" loading="lazy" /> : <span className="niche-tile__nocover">{t.kind}<small>cover not held on disk</small></span>}
        <span className="niche-tile__badge">{badge}</span>
        {t.src === "scroll" ? <span className="niche-tile__src">your scroll</span> : t.src === "batch" ? <span className="niche-tile__src">{t.held === "metadata" ? "metadata only" : `${t.held} on disk`}</span> : null}
      </Link>
      )}
      <div className="niche-tile__body">
        <div className="niche-tile__head"><a href={profileUrl(t.platform, t.handle)} {...ext}>{mixed ? <PlatformIcon p={t.platform} /> : null}@{t.handle}</a>{t.views !== null ? <strong>{n(t.views)}<small>views</small></strong> : <strong className="is-none">—<small>no views reported</small></strong>}</div>
        <Nums t={t} />
        <MarkLine t={t} />
        <p className="niche-tile__caption">{cut(t.caption) || "no caption"}</p>
        <div className="niche-tile__foot"><span>{[t.date ? dmy(t.date) : null, t.kw ? `#${t.kw}` : null, winLabel(t.win)].filter(Boolean).join(" · ")}</span><span><Link href={nichePostHref(slug, t.platform, t.id)}>detail</Link> · <a href={t.url} {...ext}>{PLATFORM_NAME[t.platform]} ↗</a></span></div>
      </div>
    </MarkTile>
  );
}

/* --------------------------------------------------------- the findings */

/** Inline markdown: **bold**, `code`, and bare @handles. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return <>{parts.map((p, i) => p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p.startsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}

const gist = (b: FindingBlock) => {
  const t = (b.lead || b.items[0]?.text || "").replace(/\*\*|`/g, "");
  return clip(t, 149);
};

function Fold({ title, gist, id, open, children }: { title: ReactNode; gist: string; id?: string; /** Open on arrival: a search found rows in it. */ open?: boolean; children: ReactNode }) {
  return (
    <details className="fold" id={id} open={open}>
      <summary><span className="fold__title">{title}</span><span className="fold__gist">{gist}</span></summary>
      <div className="fold__body">{children}</div>
    </details>
  );
}

/* --------------------------------------------------------------- the page */

export default async function NichePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const app = getApp(slug);
  if (!app && !(slug === "new" && !listApps().length)) notFound();
  const one = (k: string, def = "") => { const v = sp[k]; return ((Array.isArray(v) ? v[0] : v) ?? def) || def; };
  const s = encodeURIComponent(slug);
  const phase = canvasOf(slug).phases.find((p) => p.key === "niche")!;
  const raw = app?.niche ?? "The niche";
  const nicheName = raw.charAt(0).toUpperCase() + raw.slice(1);
  const niche = getNiche(slug);
  const batches = listBatches(slug);
  const read = batches.filter((b) => b.read);
  /* A post can sit in more than one batch; keep the first (newest) copy only. */
  const seen = new Set<string>();
  const scrolled = read.flatMap((b) => b.posts.filter((p) => p.slides.length || p.video)).filter((p) => !seen.has(p.id) && seen.add(p.id));
  const findings = readFindings(slug);
  const postTable = readPostTable(slug);
  const values = readValues(slug);
  const accounts = readAccountTable(slug);
  const ours = postTable ? day7Rows(slug, listHandles(slug).map((h) => h.handle)).length : 0;

  const band = phase.state !== "done" ? (
    <StateBand
      state={phase.state}
      text="The niche phase fills this page: two TikTok searches, the Photo tab for slideshows and the general search for recent videos (and the Instagram hashtags, if you say yes when the agent asks), then up to ten posts from your own scroll, pulled slide by slide and read. The findings are written into three files and shown here as they are."
      ask={phase.ask ?? (phase.state === "todo" ? "nothing yet; the phase starts once the app is read" : null)}
      phase="phase 4 · the niche"
    />
  ) : null;

  if (!niche && !batches.length && !findings) {
    return (
      <div className="page stack">
        <header className="prod__head"><div><h1 className="prod__title">{nicheName} <em>· the niche</em></h1><p className="prod__counts">Nothing read yet</p></div></header>
        {band}
        <Section title="The posts"><Room text="One tile per post, searched or from your own scroll: cover, handle, views, saves per view. The winners marked; your marks, Rule out and Study, in edit mode." small="fills at the niche" /></Section>
        <Section title="The findings"><Room text="What the posts taught, read slide by slide: the verdict, one fold per note, the post table." small="fills at the niche" n={2} /></Section>
      </div>
    );
  }

  /* ---- the filters, from the URL. An old `recent=1` link reads as the last 90 days. */
  const view = viewOf(sp.platform);
  const q = {
    platform: view === "both" ? "" : view,
    src: one("src"), kind: one("kind", DEFS.kind), kw: one("kw"), win: one("win"), min: one("min", DEFS.min),
    date: one("date", one("recent") === "1" ? "90d" : ""), from: one("from"), to: one("to"),
    marks: markViewOf(one("marks")), winners: one("winners"), held: one("held"), sort: one("sort", DEFS.sort),
    search: one("search").trim(), edit: one("edit") === "1" ? "1" : "",
  };
  const marks = readMarks(slug).marks;
  const tiles = tilesOf(niche?.posts ?? [], scrolled);
  for (const t of tiles) { t.marked = marks[markKey(t.platform, t.id)]; t.mark = shownMark(t.marked); }
  /* The bar is set by the posts not ruled out; every post is marked against it. */
  const rule = markWins(tiles, tiles.filter((t) => t.mark !== "out"));
  /* The search narrows the grid before the pickers, so their counts say what the search holds; it reads every keyword and window that found a post. The wins are marked on every tile first: a search never moves the bar. */
  const words = terms(q.search);
  const quoted = quote(q.search);
  const found = words.length ? tiles.filter((t) => matches(words, tileFields(t, t.rows.map((r) => r.kw), t.rows.map((r) => winLabel(r.win))))) : tiles;
  const rowsFound = (rows: string[][]) => (words.length ? rows.filter((r) => matches(words, r)) : rows);
  const postRows = postTable ? rowsFound(postTable.rows) : [];
  const valueRows = rowsFound(values.map((v) => [v.layer, v.param, v.value, v.seen, v.evidence]));
  const accountRows = accounts ? rowsFound(accounts.rows) : [];
  const hits = (k: number) => (words.length ? ` · ${k} ${k === 1 ? "row matches" : "rows match"} ${quoted}` : "");
  const onIg = tiles.some((t) => t.platform === "instagram");
  const min = Number(q.min) || 0;
  const days = dateWindow(q.date, q.from, q.to);
  const inView = (t: Tile) => view === "both" || t.platform === view;
  /* Every filter but the marks: the marks pick counts over these. */
  const passes = (t: Tile) =>
    inView(t) &&
    (!q.src || on(t, "src", q.src)) &&
    (q.kind === "both" || t.kind === q.kind) &&
    (!q.kw || on(t, "kw", q.kw)) &&
    (!q.win || on(t, "win", q.win)) &&
    overFloor(t, min, rule) &&
    inWindow(t.date, days) &&
    (q.winners !== "1" || t.win_) &&
    (q.held !== "1" || t.viewable);
  const filtered = found.filter(passes);
  const match = filtered.filter((t) => inMarkView(q.marks, t.mark ?? ""));
  /* "rate" is the rate against the post's own bar: saves per view over the TikTok median, likes over the Instagram one; within one platform it orders as the rate itself. Posts with no measure go last. */
  const key: Record<string, (t: Tile) => number | string> = { rate: (t) => t.strength ?? -1, views: (t) => t.views ?? -1, saves: (t) => t.saves ?? -1, likes: (t) => t.likes ?? -1, shrate: (t) => t.shrate, date: (t) => t.date };
  const k = key[q.sort] ?? key[DEFS.sort];
  match.sort((a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : 0));
  const shown = Math.min(match.length, Math.max(PAGE, Number(one("n")) || PAGE));
  const winsIn = match.filter((t) => t.win_).length;
  /* The pickers count the posts the marks pick shows (by default, the ones not ruled out). */
  const count = (f: (t: Tile) => boolean) => found.filter((t) => inView(t) && inMarkView(q.marks, t.mark ?? "") && f(t)).length;
  const marked = (m: "" | "out" | "study") => filtered.filter((t) => (t.mark ?? "") === m).length;
  const picks: Pick[] = [
    { key: "src", label: "source", def: "", opts: [{ v: "", label: "search, batches and your scroll" }, { v: "search", label: "search only", n: count((t) => on(t, "src", "search")) }, { v: "batch", label: "batches only", n: count((t) => on(t, "src", "batch")) }, { v: "scroll", label: "your scroll only", n: count((t) => on(t, "src", "scroll")) }] },
    { key: "kind", label: "kind", def: DEFS.kind, opts: [{ v: "both", label: "slideshows and videos" }, { v: "slideshow", label: "slideshows", n: count((t) => t.kind === "slideshow") }, { v: "video", label: "videos", n: count((t) => t.kind === "video") }] },
    { key: "kw", label: "keyword", def: "", opts: [{ v: "", label: (niche?.keywords.length ?? 0) === 2 ? "both" : "every keyword" }, ...(niche?.keywords ?? []).map((w) => ({ v: w, label: `#${w}`, n: count((t) => on(t, "kw", w)) }))] },
    { key: "win", label: "window", def: "", opts: [{ v: "", label: "every window" }, ...(niche?.windows ?? []).filter((w) => count((t) => on(t, "win", w))).map((w) => ({ v: w, label: winLabel(w), n: count((t) => on(t, "win", w)) }))] },
    { key: "date", label: "posted", def: "", opts: dateOpts },
    { key: "min", label: "views", def: DEFS.min, opts: [0, 10_000, 50_000, 100_000, 1_000_000].map((v) => ({ v: String(v), label: viewsLabel(v) })) },
    { key: "marks", label: "marks", def: "", opts: [{ v: "", label: "all but ruled out", n: marked("") + marked("study") }, { v: "study", label: "study", n: marked("study") }, { v: "unmarked", label: "unmarked", n: marked("") }, { v: "out", label: "ruled out", n: marked("out") }, { v: "all", label: "every post", n: filtered.length }] },
  ];
  const rateWord = view === "tiktok" || !onIg ? "saves/view" : view === "instagram" ? "likes against the bar" : "rate against its bar";
  const sortPick: Pick = { key: "sort", label: "sort by", def: DEFS.sort, opts: [{ v: "views", label: "views" }, { v: "rate", label: rateWord }, ...(view !== "instagram" ? [{ v: "saves", label: "saves" }] : []), ...(onIg && view !== "tiktok" ? [{ v: "likes", label: "likes" }] : []), ...(view !== "instagram" ? [{ v: "shrate", label: "shares/view" }] : []), { v: "date", label: "date" }] };
  const hrefOf = (params: Record<string, string>, more = "") => {
    const u = new URLSearchParams();
    for (const [kk, v] of Object.entries(params)) if (v && v !== (DEFS[kk] ?? "")) u.set(kk, v);
    if (more) u.set("n", more);
    const qs = u.toString();
    return `/app/${s}/niche${qs ? `?${qs}` : ""}${more ? "#wins" : ""}`;
  };
  const hrefWith = (params: Record<string, string>) => hrefOf(params);
  const moreHref = () => hrefOf(q, String(shown + PAGE));
  const sortWord = sortPick.opts.find((o) => o.v === q.sort)?.label ?? sortPick.opts[0].label;
  const byPlatform = niche?.totals.platforms ?? { tiktok: niche?.totals.posts ?? 0 };
  const study = tiles.filter((t) => t.mark === "study");
  const studyWaiting = study.filter((t) => !t.viewable).length;
  const ruledOut = tiles.filter((t) => t.mark === "out").length;

  const searchWord = niche ? `${niche.keywords.length === 2 ? "two" : niche.keywords.length} search${niche.keywords.length === 1 ? "" : "es"}` : "no search";
  const counts = [
    niche ? <><b>{n(niche.totals.posts)}</b> posts from {searchWord} (<b>{n(niche.totals.slideshows)}</b> slideshows · <b>{n(niche.totals.videos)}</b> videos · <b>{n(niche.totals.handles)}</b> handles{onIg ? <> · {(Object.entries(byPlatform) as [Platform, number][]).map(([pf, c], i) => <span key={pf}>{i ? " · " : ""}<b>{n(c)}</b> {PLATFORM_NAME[pf]}</span>)}</> : null})</> : "no search yet",
    scrolled.length ? <><b>{scrolled.length}</b> posts from your scroll, read slide by slide</> : batches.length ? <>{batches[0].links.length} links from your scroll, not read yet</> : "nothing from your scroll yet",
    ruledOut || study.length ? <><b>{n(ruledOut)}</b> ruled out · <b>{n(study.length)}</b> to study{studyWaiting ? <> ({n(studyWaiting)} not fetched yet)</> : null}</> : null,
    findings ? <>findings of {dmy(findings.date)}</> : "no findings yet",
  ].filter(Boolean);
  const latest = batches[0];
  const searchCount = words.length ? `${n(found.filter(inView).length)} of ${n(tiles.filter(inView).length)} posts match ${quoted}` : "";
  const handlesIn = latest ? latest.links.filter((l) => /^@/.test(l)).length : 0;
  const searchBox = (compact: boolean) => <PostSearch key="search" value={q.search} count={searchCount} compact={compact} placeholder={compact ? 'caption, handle, #keyword, id… "phrase"' : 'caption, handle, #keyword, post id, date… "exact phrase"'} drop={["n"]} />;
  const savedMarks: Record<string, "out" | "study"> = {};
  for (const t of tiles) if (t.mark) savedMarks[markKey(t.platform, t.id)] = t.mark;

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">{nicheName} <em>· the niche</em></h1>
          <p className="prod__counts">{counts.map((c, i) => <span key={i}>{i ? " · " : ""}{c}</span>)}</p>
        </div>
      </header>
      {band}

      {!tiles.length && (postTable || values.length || accounts) ? searchBox(false) : null}

      <section id="wins">
        <div className="section__head">
          <h2>
            The posts{" "}
            <details className="info">
              <summary aria-label="How a win is defined, and the marks">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.9" r="0.9" fill="currentColor" /><path d="M8 7.2v4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </summary>
              <div className="info__pop">
                <p><b>How a win is defined.</b> A post wins when at least 50,000 people saw it and its saves per view reach the niche median, <b>{(100 * rule.tiktok.median).toFixed(2)}%</b>. Saves count more than views: a saved post is one the viewer kept.</p>
                <p className="state">Today {rule.tiktok.wins} of {rule.tiktok.slideshows} {onIg ? "TikTok " : ""}slideshows win. The median is worked out again on every visit, over the {rule.tiktok.over} slideshows with 50,000 views or more that are not ruled out.</p>
                {onIg ? (
                  <>
                    <p><b>On Instagram</b> there are no saves, and a photo or a carousel shows no views, so Instagram is judged against itself, on likes or on shares: a post wins on either. On likes, a reel wins at 50,000 views or more with likes per view at the median of the Instagram reels that reached 50,000 views, <b>{(100 * rule.instagram.median).toFixed(2)}%</b>, and a photo or a carousel at <b>{n(rule.instagram.likesFloor)}</b> likes or more: what a reel has at 50,000 views and that median. A post whose likes are hidden does not win on likes. On shares, the same two rules with shares in place of likes{rule.instagram.sharesFloor !== null ? <>: <b>{(100 * rule.instagram.shareMedian).toFixed(2)}%</b> shares per view on a reel, <b>{n(rule.instagram.sharesFloor)}</b> shares on a photo or a carousel</> : null}.</p>
                    <p className="state">Today {rule.instagram.wins} of {rule.instagram.posts} Instagram posts win: {rule.instagram.likeWins} on likes, {rule.instagram.shareWins} on shares. {rule.instagram.withShares ? `${rule.instagram.withShares} Instagram posts report shares.` : "No Instagram post in these searches reports shares, so no post can win on shares yet."} The views floor holds a photo or a carousel to the likes a reel would have at that many views.</p>
                  </>
                ) : null}
                <p><b>The marks.</b> Edit marks puts two buttons on every post. <b>Rule out</b>: once you save, the post leaves this list; nothing is deleted, and the marks pick shows the ruled-out posts again. <b>Study</b>: the agent fetches the full slides or video and reads them. A post with no mark is kept and not downloaded. The marks are in <code>apps/{slug}/niche/marks.json</code>; ask the agent to clean up the rest the way you marked, and to keep the rules in <code>niche/CLEANUP.md</code> for every refresh.</p>
              </div>
            </details>
          </h2>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}><span className="eyebrow">{sortWord} first · {PAGE} at a time</span></div>
        </div>
        {tiles.length ? (
          <MarksProvider app={slug} edit={q.edit === "1"} saved={savedMarks}>
            {onIg ? <PlatformSwitch href={hrefWith({ ...q, platform: "" })} view={view} counts={{ both: found.length, tiktok: found.filter((t) => t.platform === "tiktok").length, instagram: found.filter((t) => t.platform === "instagram").length }} /> : null}
            <NicheFilters picks={picks} checks={[{ key: "winners", label: "winners only" }, { key: "held", label: "downloaded only" }]} values={q} sort={sortPick} range="date" search={searchBox(true)} tail={<MarkToggle key="marks" />} />
            <p className="state hx__count" aria-live="polite"><b>{n(match.length)}</b> match{searchCount ? <> ({searchCount})</> : null} · <b>{n(winsIn)}</b> win · showing <b>{n(shown)}</b>{match.length > shown ? <> · then {PAGE} more each time</> : null}{q.marks === "" && marked("out") ? <> · <b>{n(marked("out"))}</b> ruled out, hidden (<Link href={hrefWith({ ...q, marks: "out" })} scroll={false}>show them</Link>)</> : null}</p>
            {match.length ? <ul className="niche-grid">{match.slice(0, shown).map((t) => <TileCard key={`${t.platform}:${t.id}`} t={t} mixed={onIg} slug={slug} />)}</ul> : words.length ? <p className="niche-empty">No post matches {quoted} with these filters. <Link href={hrefWith({ ...q, search: "" })} scroll={false}>Clear the search</Link>, lower the views floor or widen the dates.</p> : <p className="niche-empty">No post matches these filters. Lower the views floor or widen the dates.</p>}
            {match.length > shown ? <p style={{ marginTop: 14 }}><Link className="read__again" href={moreHref()} scroll={false}>Show {Math.min(PAGE, match.length - shown)} more</Link></p> : null}
          </MarksProvider>
        ) : (
          <Room text="One tile per post, searched or from your own scroll: cover, handle, views, saves per view. The winners marked." small="fills once the searches run" />
        )}
        <div className="next" style={{ marginTop: 18 }}>
          <div className="next__left"><p className="next__text is-you"><span className="next__who">Your turn</span>{scrolled.length ? <>Your scroll is in this list: {scrolled.length} posts you pasted, the latest batch on {dmy(latest.date)} ({latest.links.length - handlesIn} post links{handlesIn ? ` and ${handlesIn === 1 ? "one handle" : `${handlesIn} handles`}` : ""}), every slide pulled and read; the source pick shows them alone. Bring the next batch when you have one: up to ten links from your scroll, pasted in the conversation.</> : latest ? <>You pasted {latest.links.length} links on {dmy(latest.date)}. The agent has not pulled and read them yet.</> : <>Bring posts from your own feed, up to ten links at a time, pasted in the conversation. The agent pulls every slide, the counts and the top comments, and reads them slide by slide.</>}</p></div>
        </div>
      </section>

      <Section id="findings" title="The findings" small={findings ? `from the read of ${dmy(findings.date)}` : undefined}>
        {findings ? (
          <>
            <p className="lede lede--full">{findings.title}. Read slide by slide on {dmy(findings.date)}. The verdict first; open a line to read it in full.</p>
            {findings.verdict ? (
              <div className="fnd__block fnd__block--verdict">
                <h3>{findings.verdict.title}</h3>
                {findings.verdict.lead ? <p><Inline text={findings.verdict.lead} /></p> : null}
                <ul>{findings.verdict.items.map((it, i) => <li key={i} className={it.mark ? `is-${it.mark}` : undefined}><Inline text={it.text} /></li>)}</ul>
              </div>
            ) : null}
            <div className="folds">
              {findings.blocks.map((b, i) => (
                <Fold key={i} title={<Inline text={b.title || `Note ${i + 1}`} />} gist={gist(b)}>
                  <h3><Inline text={b.title || `Note ${i + 1}`} /></h3>
                  {b.lead ? <p><Inline text={b.lead} /></p> : null}
                  {b.items.length ? <ul>{b.items.map((it, j) => <li key={j}><Inline text={it.text} /></li>)}</ul> : null}
                </Fold>
              ))}
              {postTable ? (
                <Fold id="posts-read" open={words.length > 0 && postRows.length > 0} title={`The ${postTable.rows.length - ours} posts, one row each${ours ? ` · ${ours} day-7 ${ours === 1 ? "row" : "rows"} of ours` : ""}${hits(postRows.length)}`} gist="who posts, slides, the hook, the text density, what is kept, where the product sits, the last slide’s ask, the numbers">
                  <Anat head={postTable.head} rows={postRows} keys={["#", "Handle / post", "Persona", "Slides", "Hook shape", "Text density", "Keepable", "Product slot", "Last-slide ask", "Views", "Saves/view"]} lede="One row per post read, one column per part of the post: who posts, how many slides, the hook, how dense the text is, what the viewer keeps, where the product sits, what the last slide asks. Blank means the slides do not say. After every post of ours goes out, one row is added seven days later, and it is compared with the rows that differ in one part only." />
                </Fold>
              ) : null}
              {values.length ? (
                <Fold id="values" open={words.length > 0 && valueRows.length > 0} title={`The values seen: ${values.length} across ${new Set(values.map((v) => v.param)).size} parameters${hits(valueRows.length)}`} gist={[...new Set(values.map((v) => v.value))].slice(0, 6).join(" · ")}>
                  <Anat head={["Layer", "Parameter", "Value", "Seen in", "Evidence"]} rows={valueRows} lede="Every part of a post has a list of values seen so far, with where each was seen. A value stays on the list once it is seen; a new niche or a new batch adds to it." />
                </Fold>
              ) : null}
              {accounts ? (
                <Fold id="accounts" open={words.length > 0 && accountRows.length > 0} title={`The accounts behind the posts${hits(accountRows.length)}`} gist={`${accounts.rows.length} accounts`}>
                  <Anat head={accounts.head} rows={accountRows} lede="One row per account behind the scrolled posts: how the handle is named, what the bio says, whether one persona holds, whether one format is locked, and what tier the account is." />
                </Fold>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="lede lede--full">What the posts from your scroll teach, read slide by slide: the verdict, one note per pattern, the post table, the parameter values, the accounts behind the posts. Written by the agent into three files and shown here as they are.</p>
            <Room text="The verdict, the notes, the post table." small="fills once the batch is read" n={2} />
          </>
        )}
      </Section>
    </div>
  );
}
