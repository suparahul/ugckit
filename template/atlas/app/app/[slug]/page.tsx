/**
 * /app/<slug> — the home base.
 *
 * Opened first every day: is what we posted getting anywhere, what waits for
 * me today, and where the work is. The tracker names the phase in progress
 * and is the door into the canvas. Every other section is drawn in the state
 * its phase gives it: filled, in progress, or the room it will take. No
 * control on the page moves a phase: the agent does the work and the page
 * reports. The Review pills open the post page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApp, listApps } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { brandsOf, getPost } from "@/lib/data";
import { listHandles } from "@/lib/handles";
import { listBatches } from "@/lib/niche";
import { allStates, dateParts, getProduction, today } from "@/lib/production";
import { isPosted, numbersOf } from "@/lib/read";
import { Room, Section, n } from "@/components/factory/Bits";
import { AppCard, AppShow, BatchShow, HandleCard, HandleCardLater, PostedShow } from "@/components/factory/Cards";
import { Figures, figuresQuery } from "@/components/factory/Figures";
import { Tracker } from "@/components/factory/Tracker";
import { SchedBand, WaitCard, whoOf } from "@/components/factory/Wait";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = getApp(slug);
  return { title: `${app?.name ?? "Your app"} — Organic Factory` };
}

export default async function HomeBase({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const app = getApp(slug);
  /* /app/new is the blank home base of a workspace with no app yet. */
  if (!app && !(slug === "new" && !listApps().length)) notFound();
  const s = encodeURIComponent(slug);
  const canvas = canvasOf(slug);
  const S = (k: string) => canvas.phases.find((p) => p.key === k)?.state ?? "todo";
  const niche = app?.niche ?? null;
  const inNiche = niche ? `in ${niche}` : "in the niche";

  const todayIso = today();
  const prod = getProduction(slug);
  const states = allStates(slug);
  const handles = listHandles(slug);
  const handleOf = (short: string) => handles.find((h) => h.short === short) ?? null;
  const todays = states.filter((st) => st.row.date === todayIso && !st.killed);
  const waitingToday = todays.filter((st) => whoOf(st) === "you");
  const goingOut = todays.filter((st) => st.stage === "ready" && st.sent);
  const posted = states.filter(isPosted).sort((a, b) => (b.posted!.at > a.posted!.at ? 1 : -1));
  const recent = posted.filter((st) => st.row.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const postedYesterday = posted.filter((st) => st.row.date === yesterday);
  const viewsYesterday = postedYesterday.reduce((t, st) => t + (numbersOf(st)?.views ?? 0), 0);
  const p = dateParts(todayIso);

  /* The head's count line: what today holds, in the studio's idiom. */
  const counts: React.ReactNode[] = [];
  if (S("production") === "now" || S("production") === "done") {
    counts.push(`${p.weekday} ${p.d} ${p.month}`);
    if (waitingToday.length) counts.push(<Link key="w" className="is-waiting" href="#waiting">{waitingToday.length} waiting for you</Link>);
    else if (todays.length) counts.push(`${todays.length} planned today`);
    if (goingOut.length) counts.push(<><b>{goingOut.length}</b> going out today</>);
    if (postedYesterday.length) counts.push(<><b>{postedYesterday.length}</b> posted yesterday</>);
    if (viewsYesterday) counts.push(<><b>{n(viewsYesterday)}</b> views</>);
  } else if (canvas.now) {
    counts.push(`${canvas.now.title} in progress`);
  } else counts.push("Nothing yet. The kit is checking the machine.");

  /* The order of the waiting strip: yours first, then what goes out on its own, then the agent's. */
  const order = [...todays.filter((st) => whoOf(st) === "you"), ...todays.filter((st) => whoOf(st) === "set"), ...todays.filter((st) => whoOf(st) === "agent")].filter((st) => st.stage !== "posted" && st.stage !== "read");

  const batches = listBatches(slug);
  const newest = batches[0] ?? null;
  const brands = brandsOf(slug);
  const appShows = brands.map((b) => ({ brand: b, post: b.stats.topPostId ? getPost(b.stats.topPostId)?.post ?? null : null })).filter((x) => x.post);
  const complete = handles.filter((h) => h.complete).length;
  const studio = `/production/${s}`;

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">{app?.name ?? "Your app"}</h1>
          <p className="prod__counts">{counts.map((c, i) => <span key={i}>{i ? " · " : ""}{c}</span>)}</p>
        </div>
      </header>

      <Tracker canvas={canvas} />

      {S("production") === "now" || S("production") === "done" ? (
        <Figures slug={slug} states={states} handles={handles} q={figuresQuery(sp, states, todayIso)} base={`/app/${s}`} />
      ) : (
        <div className="figures"><p className="read__none">The numbers appear here after the first post goes out, at production.</p></div>
      )}

      {order.length ? (
        <Section id="waiting" title="Waiting for you" small={`today · ${waitingToday.length} of ${todays.length} need a look`} link={{ href: studio, label: "The studio" }}>
          <ul className="strip strip--wait">{order.map((st) => <li key={st.row.key}><WaitCard s={st} handle={handleOf(st.row.short)} /></li>)}</ul>
          <SchedBand states={todays} handles={handles} />
        </Section>
      ) : S("production") === "now" || S("production") === "done" ? (
        <Section title="Waiting for you" small="nothing today" link={{ href: studio, label: "The studio" }}>
          <Room text={prod.rows.some((r) => r.date > todayIso) ? "Nothing waits today. The next posts are in the studio." : "Nothing waits. The next week’s plan opens the studio again."} small="production" />
        </Section>
      ) : (
        <Section title="Waiting for you" small="production">
          <Room text="Posts wait here once the plan is written and the decks start." small="fills at production" />
        </Section>
      )}

      {handles.length ? (
        <Section title="Handles" small={`${complete} complete${handles.length - complete ? ` · ${handles.length - complete} in creation` : ""}${complete < 2 ? " · 1 more recommended" : ""}`} link={{ href: `/app/${s}/handles`, label: "All handles" }}>
          <ul className="strip strip--handles">
            {handles.map((h) => <li key={h.dir}><HandleCard h={h} states={states} href={`/app/${s}/handle/${encodeURIComponent(h.dir)}`} /></li>)}
            {complete < 2 ? <li><HandleCardLater name="@a second persona" role="persona handle · recommended, not created" href={`/app/${s}/handles`} /></li> : null}
          </ul>
        </Section>
      ) : S("accounts") !== "todo" ? (
        <Section title="Handles" small="handle identities" link={{ href: `/app/${s}/handles`, label: "All handles" }}>
          <Room text="The handles are created one at a time, in six steps, once the account architecture names them." small="fills at handle identities" />
        </Section>
      ) : (
        <Section title="Handles" small="handle identities">
          <Room text="The handles appear here once the account architecture names them." small="fills at handle identities" />
        </Section>
      )}

      {recent.length ? (
        <Section title="Posted recently" small="last 7 days · newest first · hover or tap to play" link={{ href: `${studio}?zoom=week`, label: "The week in the studio" }}>
          <ul className="strip">{recent.map((st) => <li key={st.row.key}><PostedShow s={st} handle={handleOf(st.row.short)} /></li>)}</ul>
        </Section>
      ) : posted.length ? (
        <Section title="Posted recently" small="nothing in the last 7 days" link={{ href: `${studio}?zoom=month`, label: "The month in the studio" }}>
          <Room text={`${posted.length} posted before that; the studio holds them.`} small="production" />
        </Section>
      ) : (
        <Section title="Posted recently" small="production">
          <Room text="The first post appears here with its slides." small="fills at production" />
        </Section>
      )}

      {newest && newest.posts.length ? (
        <Section title={`Creators ${inNiche}, most recent`} small={`from your scroll · ${newest.date}`} link={{ href: `/app/${s}/niche#scroll`, label: "Niche" }}>
          <ul className="strip">{newest.posts.slice(0, 6).map((bp) => <li key={bp.id}><BatchShow p={bp} href={`/app/${s}/niche#scroll`} /></li>)}</ul>
        </Section>
      ) : S("niche") === "now" ? (
        <Section title={`Creators ${inNiche}, most recent`} small="the niche · in progress" link={{ href: `/app/${s}/niche`, label: "Niche" }}>
          <Room text="The searches ran. The creators appear here once your scroll links are read." small="the niche · waiting for your links" />
        </Section>
      ) : (
        <Section title="Creators in the niche, most recent" small="the niche">
          <Room text="Creators from your own scroll appear here, with their slides." small="fills at the niche" />
        </Section>
      )}

      {appShows.length ? (
        <Section title={`Apps ${inNiche}, most recent`} small={`one held post per app · ${brands.length} in the ledger`} link={{ href: `/atlas?app=${s}`, label: "Atlas" }}>
          <ul className="strip">{appShows.map(({ brand, post }) => <li key={brand.id}><AppShow brand={brand} post={post!} /></li>)}</ul>
          <ul className="strip strip--apps strip--under" aria-label="The apps: a card opens the app’s home">{brands.map((b) => <li key={b.id}><AppCard brand={b} /></li>)}</ul>
        </Section>
      ) : S("apps") === "now" ? (
        <Section title={`Apps ${inNiche}, most recent`} small="competitor apps · in progress" link={{ href: `/atlas?app=${s}`, label: "Atlas" }}>
          <Room text="The apps are being found and torn down. Each appears here with one held post." small="competitor apps" />
        </Section>
      ) : (
        <Section title="Apps in the niche, most recent" small="competitor apps">
          <Room text="The apps in the niche appear here with one held post each." small="fills at competitor apps" />
        </Section>
      )}

      <Section title="The rest">
        <ul className="more">
          {S("production") !== "todo" ? <li><Link href={studio}>The studio</Link> · <b>{todays.length}</b> planned today</li> : null}
          {S("fit") !== "todo" ? <li><Link href={`/app/${s}/strategy`}>Strategy</Link>{prod.rows.length ? <> · plan <b>{prod.rows.length}</b> posts{prod.plan.range ? ` · ${prod.plan.range.from} → ${prod.plan.range.to}` : ""}</> : null}</li> : null}
          <li><Link href={`/posts?app=${s}`}>All posts</Link> · <b>{posted.length}</b> of ours · <b>{n(brands.reduce((t, b) => t + b.stats.postCount, 0))}</b> research</li>
          <li><Link href={`/atlas?app=${s}`}>Atlas</Link> · {brands.length} apps · {brands.reduce((t, b) => t + b.stats.accountCount, 0)} handles</li>
          <li><Link href={`/app/${s}/canvas`}>The canvas</Link> · <b>{canvas.done} of {canvas.phases.length}</b> phases done</li>
          {S("production") === "todo" ? <li className="is-later">Studio · Strategy · open when their phase fills</li> : null}
          <li className="is-later">Video production · later</li>
        </ul>
      </Section>
    </div>
  );
}
