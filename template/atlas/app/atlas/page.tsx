/**
 * /atlas?app=<slug> — the research tab of one app, two views. The orb: the
 * Atlas's own sphere, framed as it is, scoped to the apps researched for this
 * app. The flat view: one card per torn-down app with its store facts and its
 * network in numbers, then an explorer of every handle the research holds,
 * filterable and sortable; every pick is a URL. Every number is from
 * data/index.json. Before the phase starts, the state band and the rooms.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { defaultApp, getApp } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { brandsOf, commas, views, type Account, type Brand } from "@/lib/data";
import { Face, Room, Section } from "@/components/factory/Bits";
import { NicheFilters, type Pick } from "@/components/factory/NicheFilters";
import { StateBand } from "@/components/factory/StateBand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atlas — Organic Factory" };

type SP = Record<string, string | string[] | undefined>;
type AppStore = { rating?: number; ratingCount?: string; revenue7d?: string; revenueNote?: string; downloads7d?: string; rank?: string | null; checked?: string; source?: string };

const ym = (iso: string | null) => (iso ? iso.slice(0, 7) : "—");
const NUM: Record<string, string> = { one: "one", two: "two", three: "three", four: "four", five: "five", six: "six" };
const wordN = (k: number) => Object.values(NUM)[k - 1] ?? String(k);

function AppCard({ b }: { b: Brand }) {
  const a = (b.appStore ?? {}) as AppStore;
  const posts = b.accounts.flatMap((x) => x.posts);
  const top = [...posts].filter((p) => p.cover).sort((x, y) => y.views - x.views).slice(0, 4);
  const own = b.stats.ownAccountCount;
  return (
    <li>
      <Link className="rcard" href={`/brand/${encodeURIComponent(b.id)}`} title={`${b.fullName || b.name}: the app’s home in the Atlas`}>
        <Face src={b.logo ?? null} name={b.name} square />
        <span className="rcard__name">{b.fullName || b.name}{b.market ? <small>{b.market}</small> : null}</span>
        <span className="rcard__tag">{b.blurb || b.tagline || b.niche || ""}</span>
        {b.appStore ? (
          <span className="rcard__chips">
            {typeof a.rating === "number" ? <span className="chip" title={`Apple App Store${a.checked ? `, read ${a.checked}` : ""}`}>★ {a.rating}{a.ratingCount ? ` · ${a.ratingCount}` : ""}</span> : null}
            <span className={`chip${a.revenue7d ? "" : " chip--none"}`} title={a.revenueNote || "App Store Tracker estimate, 7 days"}>{a.revenue7d || "—"} / 7d</span>
            <span className={`chip${a.downloads7d ? "" : " chip--none"}`} title="Downloads, 7 days, App Store Tracker estimate">{a.downloads7d || "—"} downloads</span>
            {a.rank ? <span className="chip">{a.rank}</span> : null}
          </span>
        ) : null}
        <dl className="stats stats--sm">
          <div><dd>{b.stats.accountCount}<small> / {b.stats.knownHandles}</small></dd><dt>accounts · known</dt></div>
          <div><dd>{commas(b.stats.postCount)}</dd><dt>posts held</dt></div>
          <div><dd>{views(b.stats.totalViews)}</dd><dt>views</dt></div>
          <div><dd>{views(b.stats.topPostViews)}</dd><dt>top post</dt></div>
        </dl>
        {top.length ? (
          <span className="rcard__covers" aria-label="The top posts">
            {top.map((p) => <span key={p.id} className="rcard__cover" title={`@${p.handle} · ${commas(p.views)} views`}><img src={p.cover!} alt="" loading="lazy" /><b>{views(p.views)}</b></span>)}
          </span>
        ) : null}
        <span className="rcard__foot">{b.hasTeardown ? "teardown written" : "teardown to come"} · {ym(b.stats.firstPost)} → {ym(b.stats.lastPost)} · {own} own {own === 1 ? "handle" : "handles"}</span>
      </Link>
    </li>
  );
}

export default async function AtlasPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string, def = "") => { const v = sp[k]; return ((Array.isArray(v) ? v[0] : v) ?? def) || def; };
  const slug = one("app") || defaultApp()?.slug || null;
  const app = slug ? getApp(slug) : null;
  const s = slug ? encodeURIComponent(slug) : "";
  const brands = slug ? brandsOf(slug) : [];
  const view = one("view", "flat") === "orb" ? "orb" : "flat";
  const phase = slug ? canvasOf(slug).phases.find((p) => p.key === "apps") ?? null : null;

  const base = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams();
    if (slug) u.set("app", slug);
    const v: Record<string, string | null> = { view: view === "orb" ? "orb" : null, brand: one("brand") || null, convention: one("convention") || null, active: one("active") || null, sort: one("sort") || null, ...patch };
    for (const [k, val] of Object.entries(v)) if (val) u.set(k, val);
    return `/atlas?${u.toString()}`;
  };

  if (!brands.length) {
    return (
      <div className="page stack">
        <header className="prod__head"><div><h1 className="prod__title">Atlas</h1><p className="prod__counts">{app ? "No app torn down yet" : "No app yet"}</p></div></header>
        {phase ? (
          <StateBand state={phase.state === "done" ? "done" : phase.state} text="The competitor apps phase fills this page: the apps in the niche found from the niche phrase, their networks harvested, one teardown each, then one read across all of them. Every claim one click from the post that proves it." ask={phase.ask ?? (phase.state === "todo" ? "nothing yet; the phase starts once the app is read" : null)} phase="phase 3 · competitor apps" />
        ) : null}
        <Section title="The apps"><Room text="One card per app torn down: the store facts, the network in numbers, the top posts." small="fills at competitor apps" /></Section>
        <Section title="The handles"><Room text="Every account the research holds, filterable and sortable." small="fills at competitor apps" n={1} /></Section>
      </div>
    );
  }

  const accounts: Account[] = brands.flatMap((b) => b.accounts);
  const posts = accounts.reduce((k, a) => k + a.stats.postCount, 0);
  const tv = accounts.reduce((k, a) => k + a.stats.totalViews, 0);
  const known = brands.reduce((k, b) => k + b.stats.knownHandles, 0);
  const first = brands.map((b) => b.stats.firstPost).filter(Boolean).sort()[0] ?? null;
  const last = brands.map((b) => b.stats.lastPost).filter(Boolean).sort().reverse()[0] ?? null;

  /* ---- the explorer, from the URL */
  const q = { brand: one("brand"), convention: one("convention"), active: one("active"), sort: one("sort", "max") };
  const conventions = [...new Set(accounts.map((a) => a.handleConvention.label))].sort();
  const rows = accounts.filter((a) => (!q.brand || a.brand === q.brand) && (!q.convention || a.handleConvention.label === q.convention) && (q.active !== "1" || a.stats.active));
  const keyOf: Record<string, (a: Account) => number> = { max: (a) => a.stats.maxViews, median: (a) => a.stats.medianViews, x: (a) => a.stats.xMedian ?? 0, followers: (a) => a.followers ?? 0, week: (a) => a.stats.postsPerWeek };
  const kf = keyOf[q.sort] ?? keyOf.max;
  rows.sort((a, b) => kf(b) - kf(a));
  const brandName = (id: string) => brands.find((b) => b.id === id)?.fullName || brands.find((b) => b.id === id)?.name || id;
  const picks: Pick[] = [
    { key: "brand", label: "app", def: "", opts: [{ v: "", label: `all ${wordN(brands.length)} apps`, n: accounts.length }, ...brands.map((b) => ({ v: b.id, label: b.fullName || b.name, n: b.accounts.length }))] },
    { key: "convention", label: "convention", def: "", opts: [{ v: "", label: "any convention" }, ...conventions.map((c) => ({ v: c, label: c, n: accounts.filter((a) => a.handleConvention.label === c).length }))] },
  ];
  const sorts: [string, string][] = [["max", "top post"], ["median", "median"], ["x", "×median"], ["followers", "followers"], ["week", "posts / week"]];
  const thumbOf = (a: Account) => a.posts.find((p) => p.id === a.stats.topPostId)?.cover ?? a.posts.find((p) => p.cover)?.cover ?? null;

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">Atlas</h1>
          <p className="prod__counts"><b>{brands.length}</b> {brands.length === 1 ? "app" : "apps"} torn down · <b>{accounts.length}</b> handles scraped of <b>{known}</b> known · <b>{commas(posts)}</b> posts · <b>{views(tv)}</b> views{first ? <> · {ym(first)} → {ym(last)}</> : null}</p>
        </div>
        <div className="settoggle" aria-label="View">
          <Link className={`settoggle__opt${view === "orb" ? " is-on" : ""}`} href={base({ view: "orb" })} aria-current={view === "orb" ? "true" : undefined}>orb</Link>
          <Link className={`settoggle__opt${view === "flat" ? " is-on" : ""}`} href={base({ view: null })} aria-current={view === "flat" ? "true" : undefined}>flat</Link>
        </div>
      </header>
      {phase && phase.state !== "done" ? <StateBand state={phase.state} text="The competitor apps phase is filling this page: apps found, networks harvested, teardowns written one by one." ask={phase.ask} phase="phase 3 · competitor apps" /> : null}

      {view === "orb" ? (
        <section className="rview" aria-label="The orb">
          <div className="orbwrap"><iframe className="orb__frame" src={`/orb?app=${s}&embed=1`} title="The Atlas orb: every plate is a held promoting post; drag to spin, hover to lift, click to dive" loading="lazy" /></div>
          <p className="state" style={{ marginTop: 8 }}>The Atlas’s own orb, framed as it is. The plates are the held posts of the {wordN(brands.length)} {brands.length === 1 ? "network" : "networks"}; a click dives to the post.</p>
        </section>
      ) : (
        <section className="rview" aria-label="The flat view">
          <Section title="The apps" small="a card opens the app’s home" link={{ href: `/app/${s}/canvas#phase-3`, label: "Phase 3 on the canvas" }}>
            <ul className="strip strip--apps">{brands.map((b) => <AppCard key={b.id} b={b} />)}</ul>
          </Section>
          <Section id="handles" title="The handles" small="every account the Atlas holds · a row opens the account" link={{ href: `/posts?app=${s}`, label: "All posts" }}>
            <NicheFilters picks={picks} checks={[{ key: "active", label: "active only" }]} values={{ ...q, app: slug ?? "" }} keep={["app"]} anchor="handles" />
            <div className="prod__bar" role="toolbar" aria-label="Sort" style={{ padding: "0 0 12px", justifyContent: "flex-end" }}>
              <div className="settoggle" aria-label="Sort">
                <span className="settoggle__label">by</span>
                {sorts.map(([k, label]) => <Link key={k} className={`settoggle__opt${q.sort === k ? " is-on" : ""}`} href={`${base({ sort: k === "max" ? null : k })}#handles`} aria-current={q.sort === k ? "true" : undefined}>{label}</Link>)}
              </div>
            </div>
            <p className="state hx__count" aria-live="polite"><b>{rows.length}</b> handles · the brand’s own handles sit in the list unmarked</p>
            <div className="plist__wrap" style={{ marginTop: 8 }}>
              <table className="plist plist--wide hx">
                <thead><tr><th>Handle</th><th style={{ textAlign: "right" }}>Followers</th><th style={{ textAlign: "right" }}>Posts</th><th style={{ textAlign: "right" }}>Median</th><th style={{ textAlign: "right" }}>Top post</th><th style={{ textAlign: "right" }}>×median</th><th style={{ textAlign: "right" }}>/ week</th><th style={{ textAlign: "right" }}>Engage.</th><th>State</th><th>Convention · disclosure</th></tr></thead>
                <tbody>
                  {rows.map((a) => {
                    const thumb = thumbOf(a);
                    return (
                      <tr key={a.handle}>
                        <td className="hx__who">{thumb ? <img className="hx__thumb" src={thumb} alt="" loading="lazy" /> : <span className="hx__thumb" />}<Link href={`/account/${encodeURIComponent(a.handle)}`}><b>@{a.handle}</b><small>{brandName(a.brand)}{a.name && a.name !== a.handle ? ` · ${a.name}` : ""}</small></Link></td>
                        <td className="plist__num">{a.followers != null ? views(a.followers) : "—"}</td>
                        <td className="plist__num">{commas(a.stats.postCount)}</td>
                        <td className="plist__num">{commas(a.stats.medianViews)}</td>
                        <td className="plist__num"><b>{views(a.stats.maxViews)}</b></td>
                        <td className="plist__num">{a.stats.xMedian != null ? `×${Math.round(a.stats.xMedian)}` : "—"}</td>
                        <td className="plist__num">{a.stats.postsPerWeek}</td>
                        <td className="plist__num">{a.stats.engagementRate.toFixed(2)}%</td>
                        <td className="plist__muted"><span className="state">{a.stats.active ? "active" : "dormant"}</span></td>
                        <td className="plist__muted">{a.handleConvention.label}<small>{a.bioDisclosure.length ? a.bioDisclosure.map((t) => t.label).join(", ") : "None"}</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </section>
      )}
    </div>
  );
}
