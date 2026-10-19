/**
 * /posts?app=<slug> — every post of one app's research as a media-first grid,
 * with one tab of our own. Three tabs: the held posts (a cover, a video or
 * the slides on disk), the posts not held, and our posts (what went out, from
 * the log). Each tab sorts by a metric in either order and filters by handle,
 * date window and the other fields its posts carry (lib/post-filters.ts); the
 * handle, app and platform options come from the posts themselves. The
 * tiles play in place and expand for the text. Every filter is a URL; the page is a server component over data/index.json. The search
 * (`search=`) is one box over all three tabs and stays when the tab changes;
 * what it reads of a post is lib/search.ts.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { defaultApp, getApp } from "@/lib/apps";
import { brandsOf, captionBody, commas, views as shortViews, type Brand, type Post } from "@/lib/data";
import { listHandles } from "@/lib/handles";
import { allStates } from "@/lib/production";
import { PLATFORMS, PLATFORM_NAME, linePlatform, type Platform } from "@/lib/platform";
import { compare, dateOpts, dateWindow, inWindow, metricOf, orderOpts, sortOpts, type Metric } from "@/lib/post-filters";
import { isPosted, isPostedIn, numbersIn, postedDay } from "@/lib/read";
import { matches, postFields, quoted as quote, stateFields, stateTitle, terms } from "@/lib/search";
import { Room, Section } from "@/components/factory/Bits";
import { PostedShow } from "@/components/factory/Cards";
import { NicheFilters, type Pick } from "@/components/factory/NicheFilters";
import { PostSearch } from "@/components/factory/PostSearch";
import PostTile from "@/components/PostTile";
import "./posts.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All posts — Organic Factory" };

type SP = Record<string, string | string[] | undefined>;
const PER_PAGE = 48;

type Row = { p: Post; b: Brand; held: boolean; kind: "video" | "carousel" };

export default async function PostsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string, def = "") => { const v = sp[k]; return ((Array.isArray(v) ? v[0] : v) ?? def) || def; };
  const slug = one("app") || defaultApp()?.slug || null;
  const app = slug ? getApp(slug) : null;
  const s = slug ? encodeURIComponent(slug) : "";
  const brands = slug ? brandsOf(slug) : [];
  const tab = (["held", "unheld", "ours"].includes(one("tab")) ? one("tab") : "held") as "held" | "unheld" | "ours";
  const search = one("search").trim();
  const words = terms(search);
  /* The "title only" toggle (`title=1`): our posts by their name alone. */
  const titleOnly = one("title") === "1";

  const rows: Row[] = brands.flatMap((b) => b.accounts.flatMap((a) => a.posts.map((p) => ({ p, b, held: !!(p.cover || p.video || p.slides.length), kind: (p.format === "slideshow" ? "carousel" : "video") as "video" | "carousel" }))));
  const states = slug ? allStates(slug) : [];
  const handles = slug ? listHandles(slug) : [];
  const posted = states.filter(isPosted).sort((a, b) => (b.posted!.at > a.posted!.at ? 1 : -1));
  const planned = states.filter((st) => !st.posted && !st.killed).length;
  /* The search narrows every tab, and the tab counts say what each tab holds of it. */
  const found = words.length ? rows.filter((r) => matches(words, postFields(r.p, r.b))) : rows;
  const postedFound = words.length ? posted.filter((st) => matches(words, titleOnly ? stateTitle(st) : stateFields(st))) : posted;
  const nHeld = found.filter((r) => r.held).length;
  const quoted = quote(search);

  const tabHref = (t: string, keep = search) => `/posts?app=${s}${t === "held" ? "" : `&tab=${t}`}${keep ? `&search=${encodeURIComponent(keep)}` : ""}${titleOnly ? "&title=1" : ""}`;
  const tabs = (
    <nav className="tabs" aria-label="Set">
      <Link className={`tabs__tab${tab === "held" ? " is-on" : ""}`} aria-current={tab === "held" ? "true" : undefined} href={tabHref("held")}>Atlas · held <span className="tabs__n">{commas(nHeld)}</span></Link>
      <Link className={`tabs__tab${tab === "unheld" ? " is-on" : ""}`} aria-current={tab === "unheld" ? "true" : undefined} href={tabHref("unheld")}>Atlas · not held <span className="tabs__n">{commas(found.length - nHeld)}</span></Link>
      <Link className={`tabs__tab${tab === "ours" ? " is-on" : ""}`} aria-current={tab === "ours" ? "true" : undefined} href={tabHref("ours")}>Our posts <span className="tabs__n">{postedFound.length}</span></Link>
    </nav>
  );
  const head = (
    <header className="prod__head">
      <div>
        <h1 className="prod__title">All posts</h1>
        <p className="prod__counts"><b>{commas(rows.length)}</b> research posts{brands.length ? <> from {brands.length} {brands.length === 1 ? "app" : "apps"}</> : null} · <b>{posted.length}</b> of ours posted · <b>{planned}</b> planned</p>
      </div>
    </header>
  );

  /* ---- our posts */
  if (tab === "ours") {
    const handleOf = (short: string) => handles.find((h) => h.short === short) ?? null;
    const o = { handle: one("handle"), platform: one("platform"), kind: one("kind"), date: one("date"), from: one("from"), to: one("to"), sort: metricOf(one("sort"), "date"), order: one("order") === "asc" ? "asc" : "desc", tab: "ours", search, title: titleOnly ? "1" : "" };
    const pf = PLATFORMS.includes(o.platform as Platform) ? (o.platform as Platform) : null;
    const kindOf = (st: (typeof posted)[number]) => st.row.kind ?? "slideshow";
    const w = dateWindow(o.date, o.from, o.to);
    const shown = postedFound.filter((st) => (!o.handle || st.row.handle === o.handle) && (!pf || isPostedIn(st, pf)) && (!o.kind || kindOf(st) === o.kind) && inWindow(postedDay(st), w));
    /* The numbers of the platform picked, else of every leg together; a post with no read sorts last. */
    const value = (st: (typeof posted)[number], m: Metric): number | string | null => {
      /* The day and time the card shows (the plan's day, the posted clock), then the log time. */
      if (m === "date") { const p = (pf && st.legs?.[pf]?.posted) || st.posted; const t = /^(\d{1,2}):(\d{2})/.exec(p?.time ?? ""); return `${postedDay(st)} ${t ? `${t[1].padStart(2, "0")}:${t[2]}` : "99:99"} ${p?.at ?? ""}`; }
      const nb = numbersIn(st, pf ?? "both");
      return nb ? nb[m] : null;
    };
    shown.sort((a, b) => compare(value(a, o.sort), value(b, o.sort), o.order));
    const countBy = <T,>(xs: T[], key: (x: T) => string[]) => { const m = new Map<string, number>(); for (const x of xs) for (const k of key(x)) m.set(k, (m.get(k) ?? 0) + 1); return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
    const handleN = countBy(postedFound, (st) => [st.row.handle]);
    const platformN = countBy(postedFound, (st) => PLATFORMS.filter((x) => isPostedIn(st, x)));
    const kindN = countBy(postedFound, (st) => [kindOf(st)]);
    const picks: Pick[] = [
      { key: "handle", label: "handle", def: "", opts: [{ v: "", label: "every handle", n: postedFound.length }, ...handleN.map(([h, n]) => ({ v: h, label: h.startsWith("@") ? h : `@${h}`, n }))] },
      ...(platformN.length > 1 || pf ? [{ key: "platform", label: "platform", def: "", opts: [{ v: "", label: "every platform" }, ...platformN.map(([x, n]) => ({ v: x, label: PLATFORM_NAME[x as Platform] ?? x, n }))] }] : []),
      ...(kindN.length > 1 || o.kind ? [{ key: "kind", label: "kind", def: "", opts: [{ v: "", label: "both kinds" }, ...kindN.map(([k, n]) => ({ v: k, label: k === "video" ? "videos" : "slideshows", n }))] }] : []),
      { key: "date", label: "posted", def: "", opts: dateOpts },
    ];
    const sorts: Pick[] = [{ key: "sort", label: "sort", def: "date", opts: sortOpts }, { key: "order", label: "order", def: "desc", opts: orderOpts(o.sort) }];
    const narrowed = !!(o.handle || pf || o.kind || w.from || w.to);
    return (
      <div className="page stack">
        {head}
        <section id="ours">
          {tabs}
          {posted.length ? (
            <>
              <PostSearch value={search} placeholder={titleOnly ? 'the post’s name… "exact phrase"' : 'topic, caption, handle, date… "exact phrase"'} count={words.length ? `${commas(postedFound.length)} of ${commas(posted.length)} of ours match${titleOnly ? " by name" : ""}` : ""} titleOnly={titleOnly} />
              <NicheFilters picks={picks} checks={[]} values={{ ...o, app: slug ?? "" }} sort={sorts} range="date" keep={["app", "tab"]} anchor="ours" />
              {narrowed ? <p className="state hx__count">{commas(shown.length)} of {commas(postedFound.length)} · <Link href={tabHref("ours")}>clear the filters</Link></p> : null}
            </>
          ) : null}
          {shown.length ? (
            <ul className="sgrid" style={{ marginTop: 16 }}>{shown.map((st) => <li key={st.row.key}><PostedShow s={st} handle={handleOf(st.row.short)} view={pf ?? undefined} /></li>)}</ul>
          ) : postedFound.length ? (
            <p className="xempty">No post of ours matches these filters. <Link href={tabHref("ours")}>Clear the filters</Link>.</p>
          ) : posted.length ? (
            <p className="xempty">No post of ours matches {quoted}. <Link href={tabHref("ours", "")}>Clear the search</Link>, or try a research tab.</p>
          ) : (
            <Room text="Every post of ours that went out, newest first, with its numbers when the read is in." small={app ? "fills at production" : "fills once an app is named"} />
          )}
        </section>
      </div>
    );
  }

  /* ---- the research tabs, from the URL */
  const q = { brand: one("brand"), kind: one("kind"), hook: one("hook"), handle: one("handle"), platform: one("platform"), date: one("date"), from: one("from"), to: one("to"), sort: metricOf(one("sort"), "views"), order: one("order") === "asc" ? "asc" : "desc", tab: tab === "unheld" ? "unheld" : "", search };
  const defaults: Record<string, string> = { sort: "views", order: "desc" };
  const w = dateWindow(q.date, q.from, q.to);
  /* A research post's platform, read from its link (absent or unknown reads as TikTok). */
  const platformOfPost = (p: Post) => linePlatform({ url: p.url }) ?? "tiktok";
  const inTab = found.filter((r) => r.held === (tab === "held"));
  const inTabAll = words.length ? rows.filter((r) => r.held === (tab === "held")).length : inTab.length;
  const hooks = [...new Set(inTab.flatMap((r) => r.p.tags.hook.map((t) => t.label)))].sort();
  const handleN = [...inTab.reduce((m, r) => m.set(r.p.handle, (m.get(r.p.handle) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const platformN = [...inTab.reduce((m, r) => { const x = platformOfPost(r.p); return m.set(x, (m.get(x) ?? 0) + 1); }, new Map<string, number>())];
  const match = inTab.filter((r) => (!q.brand || r.b.id === q.brand) && (!q.kind || r.kind === q.kind) && (!q.hook || r.p.tags.hook.some((t) => t.label === q.hook)) && (!q.handle || r.p.handle === q.handle) && (!q.platform || platformOfPost(r.p) === q.platform) && inWindow(r.p.date, w));
  const value = (p: Post, m: Metric) => (m === "date" ? p.uploadedAt || (p.date ? Date.parse(p.date) / 1000 : null) : m === "saves" ? p.bookmarks : p[m]);
  match.sort((a, b) => compare(value(a.p, q.sort), value(b.p, q.sort), q.order));
  const page = Math.max(1, Number(one("page")) || 1);
  const pages = Math.max(1, Math.ceil(match.length / PER_PAGE));
  const slice = match.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const picks: Pick[] = [
    { key: "brand", label: "app", def: "", opts: [{ v: "", label: brands.length === 1 ? "the one app" : `all ${brands.length} apps`, n: inTab.length }, ...brands.map((b) => ({ v: b.id, label: b.fullName || b.name, n: inTab.filter((r) => r.b.id === b.id).length }))] },
    { key: "kind", label: "kind", def: "", opts: [{ v: "", label: "both kinds" }, { v: "carousel", label: "slideshows", n: inTab.filter((r) => r.kind === "carousel").length }, { v: "video", label: "videos", n: inTab.filter((r) => r.kind === "video").length }] },
    { key: "hook", label: "hook", def: "", opts: [{ v: "", label: "any hook" }, ...hooks.map((h) => ({ v: h, label: h, n: inTab.filter((r) => r.p.tags.hook.some((t) => t.label === h)).length }))] },
    { key: "handle", label: "handle", def: "", opts: [{ v: "", label: "every handle", n: inTab.length }, ...handleN.map(([h, n]) => ({ v: h, label: `@${h}`, n }))] },
    ...(platformN.length > 1 || q.platform ? [{ key: "platform", label: "platform", def: "", opts: [{ v: "", label: "every platform" }, ...platformN.map(([x, n]) => ({ v: x, label: PLATFORM_NAME[x as Platform] ?? x, n }))] }] : []),
    { key: "date", label: "posted", def: "", opts: dateOpts },
  ];
  const sortPicks: Pick[] = [{ key: "sort", label: "sort", def: "views", opts: sortOpts }, { key: "order", label: "order", def: "desc", opts: orderOpts(q.sort) }];
  const pageHref = (n: number, over: Partial<typeof q> = {}) => {
    const u = new URLSearchParams();
    if (slug) u.set("app", slug);
    for (const [k, v] of Object.entries({ ...q, ...over })) if (v && v !== defaults[k]) u.set(k, v);
    if (n > 1) u.set("page", String(n));
    return `/posts?${u.toString()}#grid`;
  };

  return (
    <div className="page stack xp">
      {head}
      <section id="grid">
        {tabs}
        {rows.length ? (
          <>
            <PostSearch value={search} placeholder="hook, caption, handle, post id, date… &quot;exact phrase&quot;" count={words.length ? `${commas(inTab.length)} of ${commas(inTabAll)} in this tab match` : ""} />
            <NicheFilters picks={picks} checks={[]} values={{ ...q, app: slug ?? "" }} sort={sortPicks} range="date" keep={["app", "tab"]} anchor="grid" />
            <p className="state hx__count">
              {q.handle ? <>@{q.handle} · <Link href={pageHref(1, { handle: "" })}>every handle</Link> · </> : null}
              {commas(slice.length)} of {commas(match.length)}{tab === "held" ? " · a tile plays in place; + opens the text" : " · the cover is not on disk; the text and the link are"}
            </p>
            {slice.length ? (
              <ul className="xgrid" style={{ marginTop: 12 }}>
                {slice.map((r, i) => {
                  const p = r.p;
                  const anchor = `card-${(page - 1) * PER_PAGE + i}`;
                  return (
                    <PostTile key={anchor} handle={p.handle} views={shortViews(p.views)} accent={r.b.accent || "var(--ember)"} media={{ video: p.video, slides: p.slides, cover: p.cover }} mediaType={r.kind} detailHref={`/post/${p.id}`} tikTokUrl={p.url} recovered={false}>
                      <div id={anchor} className="xcard__body">
                        <div className="xcard__id">
                          <span className="xcard__brand">{r.b.fullName || r.b.name}</span>
                          {p.format === "slideshow" ? <span className="xcard__badge">carousel{p.slideCount ? ` · ${p.slideCount} images` : ""}</span> : null}
                          <Link className="xcard__handle" href={`/posts?app=${s}${q.tab ? "&tab=unheld" : ""}&handle=${encodeURIComponent(p.handle)}`}>@{p.handle}</Link>
                          <span className="xcard__date">{p.date || "no date"}</span>
                        </div>
                        <p className="xcard__field"><span className="xcard__label">Views</span> {commas(p.views)} · {commas(p.likes)} likes · {commas(p.bookmarks)} saves · {commas(p.shares)} shares · {commas(p.comments)} comments</p>
                        {p.onScreen ? <p className="xcard__field"><span className="xcard__label">On screen</span> {p.onScreen}</p> : <p className="xcard__missing">No on-screen hook read on this post.</p>}
                        {p.caption ? <p className="xcard__field"><span className="xcard__label">Caption</span> {captionBody(p.caption)}</p> : null}
                        {p.tags.hook.length ? <p className="xcard__tags">{p.tags.hook.map((t) => t.label).join(" · ")}</p> : null}
                        {p.sound ? <p className="xcard__field"><span className="xcard__label">Sound</span> {p.sound}{p.soundArtist ? ` — ${p.soundArtist}` : ""}</p> : null}
                      </div>
                    </PostTile>
                  );
                })}
              </ul>
            ) : (
              <p className="xempty">No post in this tab matches{search ? <> {quoted}. <Link href={pageHref(1, { search: "" })}>Clear the search</Link>, try</> : ". Try"} the other tab, or clear a filter.</p>
            )}
            {pages > 1 ? (
              <nav className="xpager" aria-label="Pages">
                {page > 1 ? <Link href={pageHref(page - 1)}>← Previous</Link> : null}
                <span>Page {commas(page)} of {commas(pages)}</span>
                {page < pages ? <Link href={pageHref(page + 1)}>Next →</Link> : null}
              </nav>
            ) : null}
          </>
        ) : (
          <Section title="The research posts">
            <Room text="Every post the research holds, as a grid that plays in place. One tile per post, the text behind a fold." small="fills at competitor apps" />
          </Section>
        )}
      </section>
    </div>
  );
}
