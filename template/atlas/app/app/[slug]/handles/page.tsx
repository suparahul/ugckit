/**
 * /app/<slug>/handles — every handle of the app as one card: the face, the
 * role, the five-step marks, four numbers, its posts so far as thumbnails.
 * The recommended handle not yet created is dashed. Before the phase starts
 * the page shows its state band and the room the cards will take.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApp, listApps } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { listHandles } from "@/lib/handles";
import { allStates } from "@/lib/production";
import { isPosted, numbersOf } from "@/lib/read";
import { Face, n, pct, Room, Section } from "@/components/factory/Bits";
import { StepMarks } from "@/components/factory/Cards";
import { StateBand } from "@/components/factory/StateBand";
import { firstPicture } from "@/components/factory/Wait";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Handles · ${getApp(slug)?.name ?? "Your app"} — Organic Factory` };
}

export default async function HandlesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app && !(slug === "new" && !listApps().length)) notFound();
  const s = encodeURIComponent(slug);
  const handles = listHandles(slug);
  const states = allStates(slug);
  const phase = canvasOf(slug).phases.find((p) => p.key === "handles")!;
  const complete = handles.filter((h) => h.complete);
  const connected = handles.filter((h) => h.connected);
  const posted = states.filter(isPosted);
  const planned = states.filter((st) => !st.posted && !st.killed);

  if (!handles.length) {
    return (
      <div className="page stack">
        <header className="prod__head"><div><h1 className="prod__title">Handles</h1><p className="prod__counts">No handle yet</p></div></header>
        <StateBand state={phase.state === "done" ? "done" : phase.state} text="The handle identities phase fills this page, one handle at a time in five steps: role and name, persona, references, picture and bio, defaults. The posting service connects at the first send. It starts once the account architecture names the handles." ask={phase.ask ?? "the accounts created on TikTok, when the agent asks; a look at each persona and its references"} phase="phase 6 · handle identities" />
        <Section title="Handles">
          <Room text="One card per handle: the face, the state of its five steps, its numbers, its posts." small="fills at handle identities" />
        </Section>
      </div>
    );
  }

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">Handles</h1>
          <p className="prod__counts"><b>{complete.length}</b> complete · <b>{connected.length}</b> connected · <b>{posted.length}</b> posted · <b>{planned.length}</b> planned{complete.length < 2 ? " · 1 more recommended" : ""}</p>
        </div>
        <Link className="topbar__link" href={`/app/${s}/canvas#phase-6`}>Phase 6 on the canvas</Link>
      </header>
      {phase.state === "now" ? <StateBand state="now" text={phase.sentence} ask={phase.ask} phase="phase 6 · handle identities" /> : null}
      <Section title="Every handle" small="a card is a door">
        <ul className="hgrid">
          {handles.map((h) => {
            const mine = states.filter((st) => st.row.short === h.short);
            const mp = mine.filter(isPosted);
            const views = mp.reduce((t, st) => t + (numbersOf(st)?.views ?? 0), 0);
            const saves = mp.reduce((t, st) => t + (numbersOf(st)?.saves ?? 0), 0);
            const top = Math.max(0, ...mp.map((st) => numbersOf(st)?.views ?? 0));
            const plannedMine = mine.filter((st) => !st.posted && !st.killed);
            const stateWord = h.complete ? `complete${h.connected ? ` · connected${h.account?.provider ? ` through ${h.account.provider === "postbridge" ? "Post Bridge" : h.account.provider}` : ""}` : ""}` : `step ${h.next?.n ?? 5} of 5 · ${h.next?.fact ?? ""}`;
            return (
              <li key={h.dir}>
                <Link className={`hbig${h.complete ? "" : " hbig--later"}`} href={`/app/${s}/handle/${encodeURIComponent(h.dir)}`}>
                  <Face src={h.profile} name={h.handle} size=" face--lg" />
                  <span className="hbig__name">{h.handle}</span>
                  <span className="hbig__role">{[h.role, h.format].filter(Boolean).join(" · ") || "handle"}</span>
                  <span className="hbig__state"><StepMarks h={h} /><span className={`state${h.next?.state === "you" ? " is-waiting" : ""}`}>{stateWord}</span></span>
                  {mine.length ? (
                    <dl className="stats stats--sm">
                      <div><dd>{n(views)}</dd><dt>views</dt></div>
                      <div><dd>{n(top)}</dd><dt>top post</dt></div>
                      <div><dd>{pct(saves, views)}</dd><dt>saves/view</dt></div>
                      <div><dd>{mp.length} <small>/ {mine.length}</small></dd><dt>posted</dt></div>
                    </dl>
                  ) : null}
                  {mine.length ? (
                    <span className="hbig__thumbs" aria-label={`Posts: ${mp.length} posted, ${plannedMine.length} planned`}>
                      {mp.slice(0, 4).map((st) => { const pic = firstPicture(st); return <span key={st.row.key} className="hbig__thumb" title={st.row.topic}>{pic ? <img src={pic} alt={`${st.row.topic}, slide 1`} /> : null}</span>; })}
                      {plannedMine.slice(0, 4).map((st) => <span key={st.row.key} className="hbig__thumb hbig__thumb--plan" title={`Day ${st.row.day} ${st.row.slot}: ${st.row.topic}`}><small>{st.row.day}<br />{st.row.slot}</small></span>)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          {complete.length < 2 ? (
            <li>
              <span className="hbig hbig--later">
                <span className="face face--none face--lg" role="img" aria-label="A second persona: not created yet">not yet</span>
                <span className="hbig__name">@a second persona</span>
                <span className="hbig__role">persona handle · recommended by the architecture, not created</span>
                <span className="hbig__state"><span className="state">Create it on TikTok, then the five steps start. The plan recommends at least two handles at two posts a day; one is allowed.</span></span>
              </span>
            </li>
          ) : null}
        </ul>
      </Section>
    </div>
  );
}
