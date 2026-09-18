/**
 * /posts?app=<slug> — every post of one app's research as a media-first grid,
 * with one tab of our own. Three tabs: the held posts (a cover, a video or
 * the slides on disk), the posts not held, and our posts (what went out, from
 * the log). The tiles play in place and expand for the text. Every filter is
 * a URL; the page is a server component over data/index.json.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { defaultApp, getApp } from "@/lib/apps";
import { brandsOf, captionBody, commas, views as shortViews, type Brand, type Post } from "@/lib/data";
import { listHandles } from "@/lib/handles";
import { allStates } from "@/lib/production";
import { isPosted } from "@/lib/read";
import { Room, Section } from "@/components/factory/Bits";
import { PostedShow } from "@/components/factory/Cards";
import { NicheFilters, type Pick } from "@/components/factory/NicheFilters";
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

  const rows: Row[] = brands.flatMap((b) => b.accounts.flatMap((a) => a.posts.map((p) => ({ p, b, held: !!(p.cover || p.video || p.slides.length), kind: (p.format === "slideshow" ? "carousel" : "video") as "video" | "carousel" }))));
  const states = slug ? allStates(slug) : [];
  const handles = slug ? listHandles(slug) : [];
  const posted = states.filter(isPosted).sort((a, b) => (b.posted!.at > a.posted!.at ? 1 : -1));
  const planned = states.filter((st) => !st.posted && !st.killed).length;
  const nHeld = rows.filter((r) => r.held).length;

  const tabHref = (t: string) => `/posts?app=${s}${t === "held" ? "" : `&tab=${t}`}`;
  const tabs = (
    <nav className="tabs" aria-label="Set">
      <Link className={`tabs__tab${tab === "held" ? " is-on" : ""}`} aria-current={tab === "held" ? "true" : undefined} href={tabHref("held")}>Atlas · held <span className="tabs__n">{commas(nHeld)}</span></Link>
      <Link className={`tabs__tab${tab === "unheld" ? " is-on" : ""}`} aria-current={tab === "unheld" ? "true" : undefined} href={tabHref("unheld")}>Atlas · not held <span className="tabs__n">{commas(rows.length - nHeld)}</span></Link>
      <Link className={`tabs__tab${tab === "ours" ? " is-on" : ""}`} aria-current={tab === "ours" ? "true" : undefined} href={tabHref("ours")}>Our posts <span className="tabs__n">{posted.length}</span></Link>
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
    return (
      <div className="page stack">
        {head}
        <section>
          {tabs}
          {posted.length ? (
            <ul className="sgrid" style={{ marginTop: 16 }}>{posted.map((st) => <li key={st.row.key}><PostedShow s={st} handle={handleOf(st.row.short)} /></li>)}</ul>
          ) : (
            <Room text="Every post of ours that went out, newest first, with its numbers when the read is in." small={app ? "fills at production" : "fills once an app is named"} />
          )}
        </section>
      </div>
    );
  }

  /* ---- the research tabs, from the URL */
  const q = { brand: one("brand"), kind: one("kind"), hook: one("hook"), handle: one("handle"), sort: one("sort", "views"), tab: tab === "unheld" ? "unheld" : "" };
  const inTab = rows.filter((r) => r.held === (tab === "held"));
  const hooks = [...new Set(inTab.flatMap((r) => r.p.tags.hook.map((t) => t.label)))].sort();
  const match = inTab.filter((r) => (!q.brand || r.b.id === q.brand) && (!q.kind || r.kind === q.kind) && (!q.hook || r.p.tags.hook.some((t) => t.label === q.hook)) && (!q.handle || r.p.handle === q.handle));
  match.sort((a, b) => (q.sort === "date" ? b.p.date.localeCompare(a.p.date) : b.p.views - a.p.views));
  const page = Math.max(1, Number(one("page")) || 1);
  const pages = Math.max(1, Math.ceil(match.length / PER_PAGE));
  const slice = match.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const picks: Pick[] = [
    { key: "brand", label: "app", def: "", opts: [{ v: "", label: brands.length === 1 ? "the one app" : `all ${brands.length} apps`, n: inTab.length }, ...brands.map((b) => ({ v: b.id, label: b.fullName || b.name, n: inTab.filter((r) => r.b.id === b.id).length }))] },
    { key: "kind", label: "kind", def: "", opts: [{ v: "", label: "both kinds" }, { v: "carousel", label: "slideshows", n: inTab.filter((r) => r.kind === "carousel").length }, { v: "video", label: "videos", n: inTab.filter((r) => r.kind === "video").length }] },
    { key: "hook", label: "hook", def: "", opts: [{ v: "", label: "any hook" }, ...hooks.map((h) => ({ v: h, label: h, n: inTab.filter((r) => r.p.tags.hook.some((t) => t.label === h)).length }))] },
  ];
  const sortPick: Pick = { key: "sort", label: "sort", def: "views", opts: [{ v: "views", label: "by views" }, { v: "date", label: "by date" }] };
  const pageHref = (n: number) => {
    const u = new URLSearchParams();
    if (slug) u.set("app", slug);
    for (const [k, v] of Object.entries(q)) if (v && !(k === "sort" && v === "views")) u.set(k, v);
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
            <NicheFilters picks={picks} checks={[]} values={{ ...q, app: slug ?? "" }} sort={sortPick} keep={["app", "tab", "handle"]} anchor="grid" />
            <p className="state hx__count">
              {q.handle ? <>@{q.handle} · <Link href={pageHref(1).replace(`&handle=${encodeURIComponent(q.handle)}`, "").replace(`handle=${encodeURIComponent(q.handle)}&`, "")}>every handle</Link> · </> : null}
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
              <p className="xempty">No post in this tab matches. Try the other tab, or clear a filter.</p>
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
