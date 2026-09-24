/**
 * /app/<slug>/niche — the niche of the app. What wins across the searched
 * posts and the posts from your own scroll (one row of pickers, every pick
 * a URL, the platform too when the searches hold Instagram posts); the
 * scrolled posts as playable previews; the findings the agent
 * wrote, the verdict open and one fold per note, then the post table, the
 * parameter values and the accounts. Informative only. Before the phase
 * starts the page shows its state band and the rooms.
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
import { markWins, overFloor, WIN_VIEWS, type Rated } from "@/lib/niche-win";
import { PLATFORM_NAME, profileUrl, type Platform } from "@/lib/platform";
import { dmy, n, pct, Room, Section } from "@/components/factory/Bits";
import { Anat } from "@/components/factory/Anat";
import { BatchShow } from "@/components/factory/Cards";
import { NicheFilters, type Pick } from "@/components/factory/NicheFilters";
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
  id: string; src: "search" | "scroll"; kw: string; win: string; date: string;
  handle: string; comments: number; shares: number | null; shrate: number; slides: number | null;
  cover: string | null; caption: string; url: string;
};

const PAGE = 24;

const winLabel = (w: string) => ({ LAST_THREE_MONTHS: "last three months", PHOTO_TAB: "photo tab", THIS_MONTH: "this month", SCROLL: "your scroll", GENERAL: "general search", IG_TOP: "Instagram top", IG_RECENT: "Instagram recent" }[w] ?? w.toLowerCase().replace(/_/g, " "));
const cut = (t: string, max = 120) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const viewsLabel = (v: number) => (v ? `${v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1000}K`} and up` : "any");

function tilesOf(posts: NichePost[], scrolled: BatchPost[]): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  for (const p of posts) {
    const platform: Platform = p.platform ?? "tiktok";
    if (seen.has(`${platform}:${p.id}`)) continue;
    seen.add(`${platform}:${p.id}`);
    out.push({ id: p.id, platform, src: "search", kind: p.mediaType, kw: p.keyword, win: p.window, date: p.date, handle: p.handle, views: p.views, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, shrate: p.views && p.shares ? p.shares / p.views : 0, slides: p.slideCount, cover: p.coverLocal ? p.cover : null, caption: p.caption, url: p.url, win_: false, strength: null });
  }
  for (const p of scrolled) {
    if (seen.has(`tiktok:${p.id}`) || !p.views) continue;
    seen.add(`tiktok:${p.id}`);
    out.push({ id: p.id, platform: "tiktok", src: "scroll", kind: "slideshow", kw: "", win: "SCROLL", date: p.date ?? "", handle: p.handle, views: p.views, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, shrate: p.shares / p.views, slides: p.slideCount || null, cover: p.slides[0] ?? null, caption: p.caption, url: p.url, win_: false, strength: null });
  }
  return out;
}

/** The figures under a tile: TikTok's saves and shares; Instagram's likes (per view on a reel) and comments. */
function Nums({ t }: { t: Tile }) {
  const w = t.win_ ? "is-win" : "";
  if (t.platform === "tiktok") return <p className="niche-tile__nums"><span className={w}><b>{pct(t.saves ?? 0, t.views ?? 0)}</b> saves/view</span><span><b>{n(t.saves ?? 0)}</b> saves</span><span><b>{n(t.shares ?? 0)}</b> shares</span></p>;
  if (t.likes === null) return <p className="niche-tile__nums"><span>likes hidden</span><span><b>{n(t.comments)}</b> comments</span></p>;
  return t.views
    ? <p className="niche-tile__nums"><span className={w}><b>{pct(t.likes, t.views)}</b> likes/view</span><span><b>{n(t.likes)}</b> likes</span><span><b>{n(t.comments)}</b> comments</span></p>
    : <p className="niche-tile__nums"><span className={w}><b>{n(t.likes)}</b> likes</span><span><b>{n(t.comments)}</b> comments</span></p>;
}

function TileCard({ t, mixed }: { t: Tile; mixed: boolean }) {
  const ext = { target: "_blank", rel: "noreferrer" } as const;
  const badge = t.kind === "video" ? (t.platform === "instagram" ? "reel" : "video") : t.platform === "instagram" && t.slides === 1 ? "photo" : t.slides ? `${t.slides} slides` : "slideshow";
  return (
    <li className={`niche-tile niche-tile--${t.kind}${t.win_ ? " is-win" : ""}`}>
      <a className="niche-tile__cover" href={t.url} {...ext}>
        {t.cover ? <img src={t.cover} alt="" loading="lazy" /> : <span className="niche-tile__nocover">{t.kind}<small>cover not held on disk</small></span>}
        <span className="niche-tile__badge">{badge}</span>
        {t.src === "scroll" ? <span className="niche-tile__src">your scroll</span> : null}
      </a>
      <div className="niche-tile__body">
        <div className="niche-tile__head"><a href={profileUrl(t.platform, t.handle)} {...ext}>{mixed ? <PlatformIcon p={t.platform} /> : null}@{t.handle}</a>{t.views !== null ? <strong>{n(t.views)}<small>views</small></strong> : <strong className="is-none">—<small>no views reported</small></strong>}</div>
        <Nums t={t} />
        <p className="niche-tile__caption">{cut(t.caption) || "no caption"}</p>
        <div className="niche-tile__foot"><span>{[t.date ? dmy(t.date) : null, t.kw ? `#${t.kw}` : null, winLabel(t.win)].filter(Boolean).join(" · ")}</span><a href={t.url} {...ext}>open ↗</a></div>
      </div>
    </li>
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
  return t.length > 150 ? `${t.slice(0, 148).trimEnd()}…` : t;
};

function Fold({ title, gist, id, children }: { title: ReactNode; gist: string; id?: string; children: ReactNode }) {
  return (
    <details className="fold" id={id}>
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
  const scrolled = read.flatMap((b) => b.posts.filter((p) => p.slides.length));
  const findings = readFindings(slug);
  const postTable = readPostTable(slug);
  const values = readValues(slug);
  const accounts = readAccountTable(slug);
  const ours = postTable ? day7Rows(slug, listHandles(slug).map((h) => h.handle)).length : 0;

  const band = phase.state !== "done" ? (
    <StateBand
      state={phase.state}
      text="The niche phase fills this page: two searches through the Photo tab and the keywords, then up to ten posts from your own scroll, pulled slide by slide and read. The findings are written into three files and shown here as they are."
      ask={phase.ask ?? (phase.state === "todo" ? "nothing yet; the phase starts once the app is read" : null)}
      phase="phase 4 · the niche"
    />
  ) : null;

  if (!niche && !batches.length && !findings) {
    return (
      <div className="page stack">
        <header className="prod__head"><div><h1 className="prod__title">{nicheName} <em>· the niche</em></h1><p className="prod__counts">Nothing read yet</p></div></header>
        {band}
        <Section title="What wins"><Room text="One tile per searched post: cover, handle, views, saves per view. The winners marked." small="fills at the niche" /></Section>
        <Section title="From your own scroll"><Room text="The posts you bring from your feed, every slide pulled, playable here." small="fills at the niche" /></Section>
        <Section title="The findings"><Room text="What the posts taught, read slide by slide: the verdict, one fold per note, the post table." small="fills at the niche" n={2} /></Section>
      </div>
    );
  }

  /* ---- the filters, from the URL */
  const view = viewOf(sp.platform);
  const q = {
    platform: view === "both" ? "" : view,
    src: one("src"), kind: one("kind", "slideshow"), kw: one("kw"), win: one("win"), min: one("min", String(WIN_VIEWS)),
    recent: one("recent"), winners: one("winners"), sort: one("sort", "rate"),
  };
  const tiles = tilesOf(niche?.posts ?? [], scrolled);
  const rule = markWins(tiles);
  const onIg = tiles.some((t) => t.platform === "instagram");
  const min = Number(q.min) || 0;
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const inView = (t: Tile) => view === "both" || t.platform === view;
  const match = tiles.filter((t) =>
    inView(t) &&
    (!q.src || t.src === q.src) &&
    (q.kind === "both" || t.kind === q.kind) &&
    (!q.kw || t.kw === q.kw) &&
    (!q.win || t.win === q.win) &&
    overFloor(t, min, rule) &&
    (q.recent !== "1" || t.date >= since) &&
    (q.winners !== "1" || t.win_),
  );
  /* "rate" is the rate against the post's own bar: saves per view over the TikTok median, likes over the Instagram one; within one platform it orders as the rate itself. Posts with no measure go last. */
  const key: Record<string, (t: Tile) => number | string> = { rate: (t) => t.strength ?? -1, views: (t) => t.views ?? -1, saves: (t) => t.saves ?? -1, likes: (t) => t.likes ?? -1, shrate: (t) => t.shrate, date: (t) => t.date };
  const k = key[q.sort] ?? key.rate;
  match.sort((a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : 0));
  const shown = Math.min(match.length, Math.max(PAGE, Number(one("n")) || PAGE));
  const winsIn = match.filter((t) => t.win_).length;
  const count = (f: (t: Tile) => boolean) => tiles.filter((t) => inView(t) && f(t)).length;
  const picks: Pick[] = [
    { key: "src", label: "source", def: "", opts: [{ v: "", label: "search and your scroll" }, { v: "search", label: "search only", n: count((t) => t.src === "search") }, { v: "scroll", label: "your scroll only", n: count((t) => t.src === "scroll") }] },
    { key: "kind", label: "kind", def: "slideshow", opts: [{ v: "slideshow", label: "slideshows", n: count((t) => t.kind === "slideshow") }, { v: "video", label: "videos", n: count((t) => t.kind === "video") }, { v: "both", label: "both" }] },
    { key: "kw", label: "keyword", def: "", opts: [{ v: "", label: (niche?.keywords.length ?? 0) === 2 ? "both" : "every keyword" }, ...(niche?.keywords ?? []).map((w) => ({ v: w, label: `#${w}`, n: count((t) => t.kw === w) }))] },
    { key: "win", label: "window", def: "", opts: [{ v: "", label: "every window" }, ...(niche?.windows ?? []).filter((w) => count((t) => t.win === w)).map((w) => ({ v: w, label: winLabel(w), n: count((t) => t.win === w) }))] },
    { key: "min", label: "views", def: String(WIN_VIEWS), opts: [0, 10_000, 50_000, 100_000, 1_000_000].map((v) => ({ v: String(v), label: viewsLabel(v) })) },
  ];
  const rateWord = view === "tiktok" || !onIg ? "saves/view" : view === "instagram" ? "likes against the bar" : "rate against its bar";
  const sortPick: Pick = { key: "sort", label: "sort by", def: "rate", opts: [{ v: "rate", label: rateWord }, { v: "views", label: "views" }, ...(view !== "instagram" ? [{ v: "saves", label: "saves" }] : []), ...(onIg && view !== "tiktok" ? [{ v: "likes", label: "likes" }] : []), ...(view !== "instagram" ? [{ v: "shrate", label: "shares/view" }] : []), { v: "date", label: "date" }] };
  const hrefWith = (params: Record<string, string>) => {
    const u = new URLSearchParams();
    for (const [kk, v] of Object.entries(params)) { const def = kk === "kind" ? "slideshow" : kk === "min" ? String(WIN_VIEWS) : kk === "sort" ? "rate" : ""; if (v && v !== def) u.set(kk, v); }
    const qs = u.toString();
    return `/app/${s}/niche${qs ? `?${qs}` : ""}`;
  };
  const moreHref = () => {
    const u = new URLSearchParams();
    for (const [kk, v] of Object.entries(q)) { const def = kk === "kind" ? "slideshow" : kk === "min" ? String(WIN_VIEWS) : kk === "sort" ? "rate" : ""; if (v && v !== def) u.set(kk, v); }
    u.set("n", String(shown + PAGE));
    return `/app/${s}/niche?${u.toString()}#wins`;
  };
  const sortWord = sortPick.opts.find((o) => o.v === q.sort)?.label ?? rateWord;
  const byPlatform = niche?.totals.platforms ?? { tiktok: niche?.totals.posts ?? 0 };

  const searchWord = niche ? `${niche.keywords.length === 2 ? "two" : niche.keywords.length} search${niche.keywords.length === 1 ? "" : "es"}` : "no search";
  const counts = [
    niche ? <><b>{n(niche.totals.posts)}</b> posts from {searchWord} (<b>{n(niche.totals.slideshows)}</b> slideshows · <b>{n(niche.totals.videos)}</b> videos · <b>{n(niche.totals.handles)}</b> handles{onIg ? <> · {(Object.entries(byPlatform) as [Platform, number][]).map(([pf, c], i) => <span key={pf}>{i ? " · " : ""}<b>{n(c)}</b> {PLATFORM_NAME[pf]}</span>)}</> : null})</> : "no search yet",
    scrolled.length ? <><b>{scrolled.length}</b> posts from your scroll, read slide by slide</> : batches.length ? <>{batches[0].links.length} links from your scroll, not read yet</> : "nothing from your scroll yet",
    findings ? <>findings of {dmy(findings.date)}</> : "no findings yet",
  ];
  const latest = batches[0];
  const handlesIn = latest ? latest.links.filter((l) => /^@/.test(l)).length : 0;

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">{nicheName} <em>· the niche</em></h1>
          <p className="prod__counts">{counts.map((c, i) => <span key={i}>{i ? " · " : ""}{c}</span>)}</p>
        </div>
      </header>
      {band}

      <section id="wins">
        <div className="section__head">
          <h2>
            What wins{" "}
            <details className="info">
              <summary aria-label="How a win is defined">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.9" r="0.9" fill="currentColor" /><path d="M8 7.2v4.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </summary>
              <div className="info__pop">
                <p><b>How a win is defined.</b> A post wins when at least 50,000 people saw it and its saves per view reach the niche median, <b>{(100 * rule.tiktok.median).toFixed(2)}%</b>. Saves count more than views: a saved post is one the viewer kept.</p>
                <p className="state">Today {rule.tiktok.wins} of {rule.tiktok.slideshows} {onIg ? "TikTok " : ""}slideshows win. The median is worked out again on every visit, over the {rule.tiktok.over} slideshows with 50,000 views or more.</p>
                {onIg ? (
                  <>
                    <p><b>On Instagram</b> there are no saves, and a photo or a carousel shows no views, so Instagram is judged on likes, against itself. A reel wins at 50,000 views or more with likes per view at the median of the Instagram reels that reached 50,000 views, <b>{(100 * rule.instagram.median).toFixed(2)}%</b>. A photo or a carousel wins at <b>{n(rule.instagram.likesFloor)}</b> likes or more: what a reel has at 50,000 views and that median. A post whose likes are hidden does not win.</p>
                    <p className="state">Today {rule.instagram.wins} of {rule.instagram.posts} Instagram posts win. The views floor holds a photo or a carousel to the likes a reel would have at that many views.</p>
                  </>
                ) : null}
              </div>
            </details>
          </h2>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}><span className="eyebrow">{sortWord} first · {PAGE} on the first page</span></div>
        </div>
        {tiles.length ? (
          <>
            {onIg ? <PlatformSwitch href={hrefWith({ ...q, platform: "" })} view={view} counts={{ both: tiles.length, tiktok: tiles.filter((t) => t.platform === "tiktok").length, instagram: tiles.filter((t) => t.platform === "instagram").length }} /> : null}
            <NicheFilters picks={picks} checks={[{ key: "recent", label: "last 90 days" }, { key: "winners", label: "winners only" }]} values={q} sort={sortPick} />
            <p className="state hx__count" aria-live="polite"><b>{n(match.length)}</b> match · <b>{n(winsIn)}</b> win · showing <b>{n(shown)}</b>{match.length > shown ? <> · then {PAGE} more each time</> : null}</p>
            {match.length ? <ul className="niche-grid">{match.slice(0, shown).map((t) => <TileCard key={`${t.platform}:${t.id}`} t={t} mixed={onIg} />)}</ul> : <p className="niche-empty">No post matches these filters. Lower the views floor or widen the window.</p>}
            {match.length > shown ? <p style={{ marginTop: 14 }}><Link className="read__again" href={moreHref()} scroll={false}>Show {Math.min(PAGE, match.length - shown)} more</Link></p> : null}
          </>
        ) : (
          <Room text="One tile per searched post: cover, handle, views, saves per view. The winners marked." small="fills once the searches run" />
        )}
      </section>

      <Section id="scroll" title="From your own scroll" small={scrolled.length ? `${scrolled.length} posts · hover or tap to play` : undefined}>
        {scrolled.length ? (
          <>
            <p className="lede lede--full">
              These posts did not come from a search. You found them in your feed and pasted the links on {dmy(latest.date)}: {latest.links.length - handlesIn} post links{handlesIn ? ` and ${handlesIn === 1 ? "one handle" : `${handlesIn} handles`}` : ""}. The agent pulled every slide, the counts and the top comments, and read them slide by slide. They are the only posts in the niche read that way, and the findings below come from them. Hover or tap a card to step through its slides.
            </p>
            <ul className="sgrid">{scrolled.map((p) => <li key={p.id}><BatchShow p={p} href={p.url} /></li>)}</ul>
            <div className="next" style={{ marginTop: 14 }}>
              <div className="next__left"><p className="next__text is-you"><span className="next__who">Your turn</span>Bring the next batch when you have one: up to ten links from your scroll, pasted in the conversation. The agent fetches the slides, the counts and the comments, reads them, and adds to the findings.</p></div>
            </div>
          </>
        ) : latest ? (
          <>
            <p className="lede lede--full">You pasted {latest.links.length} links on {dmy(latest.date)}. The agent has not pulled and read them yet.</p>
            <Room text="The scrolled posts, every slide pulled, playable here." small="fills once the batch is read" />
          </>
        ) : (
          <>
            <p className="lede lede--full">The posts you bring from your own feed, up to ten links at a time, pasted in the conversation. The agent pulls every slide, the counts and the top comments, and reads them slide by slide. They are the posts the findings come from.</p>
            <Room text="The scrolled posts, every slide pulled, playable here." small="fills at the niche" />
          </>
        )}
      </Section>

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
                <Fold id="posts-read" title={`The ${postTable.rows.length - ours} posts, one row each${ours ? ` · ${ours} day-7 ${ours === 1 ? "row" : "rows"} of ours` : ""}`} gist="who posts, slides, the hook, the text density, what is kept, where the product sits, the last slide’s ask, the numbers">
                  <Anat head={postTable.head} rows={postTable.rows} keys={["#", "Handle / post", "Persona", "Slides", "Hook shape", "Text density", "Keepable", "Product slot", "Last-slide ask", "Views", "Saves/view"]} lede="One row per post read, one column per part of the post: who posts, how many slides, the hook, how dense the text is, what the viewer keeps, where the product sits, what the last slide asks. Blank means the slides do not say. After every post of ours goes out, one row is added seven days later, and it is compared with the rows that differ in one part only." />
                </Fold>
              ) : null}
              {values.length ? (
                <Fold id="values" title={`The values seen: ${values.length} across ${new Set(values.map((v) => v.param)).size} parameters`} gist={[...new Set(values.map((v) => v.value))].slice(0, 6).join(" · ")}>
                  <Anat head={["Layer", "Parameter", "Value", "Seen in", "Evidence"]} rows={values.map((v) => [v.layer, v.param, v.value, v.seen, v.evidence])} lede="Every part of a post has a list of values seen so far, with where each was seen. A value stays on the list once it is seen; a new niche or a new batch adds to it." />
                </Fold>
              ) : null}
              {accounts ? (
                <Fold id="accounts" title="The accounts behind the posts" gist={`${accounts.rows.length} accounts`}>
                  <Anat head={accounts.head} rows={accounts.rows} lede="One row per account behind the scrolled posts: how the handle is named, what the bio says, whether one persona holds, whether one format is locked, and what tier the account is." />
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
