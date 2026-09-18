/**
 * /production/<app>/<date>/<handle>/<n> — one post.
 *
 * The head says what this post is, what state it is in, and what happens next,
 * with the decision beside that sentence. The body follows the state: the deck
 * as written until the plan is approved, then the deck as it will appear. The
 * reference material (anatomy, rules, log) is folded closed under the body.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DecisionLog, DecisionRail } from "@/components/production/Actions";
import { Marks } from "@/components/production/Marks";
import { StateWord } from "@/components/production/Board";
import { AnatomyRail, curl, PlanningMode, ProducedMode, sourceLink } from "@/components/production/PostViews";
import { SendStatusLine } from "@/components/production/Bridge";
import { bridgeInfo, postingNotes, sendWarning, withStatusWords } from "@/lib/postbridge-flow";
import { allStates, dateParts, findRow, getProduction, nextStep, outcomesOpenAt, postingStep, postPath, postState, primaryAction, validSlug } from "@/lib/production";
import { getZones } from "@/lib/when";
import { handleByShort } from "@/lib/handles";
import { Face } from "@/components/factory/Bits";
import { Reads } from "@/components/factory/Reads";

export const dynamic = "force-dynamic";

type Params = { app: string; date: string; handle: string; n: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { app, date, handle, n } = await params;
  const row = validSlug(app) ? findRow(app, date, handle, n) : null;
  return { title: row ? `${row.topic} — The studio — Organic Factory` : "The studio — Organic Factory" };
}

const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;

export default async function ProductionPost({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { app, date, handle, n } = await params;
  const sp = await searchParams;
  if (!validSlug(app) || getProduction(app).plan.slug !== app) notFound();
  const row = findRow(app, date, handle, n);
  if (!row) notFound();
  const zones = getZones();
  const identity = handleByShort(app, row.short);

  const state = (await withStatusWords([postState(row)]))[0];
  const asPlan = sp.as === "plan";
  const mode = asPlan ? "planning" : state.mode;
  const slideNo = Number(Array.isArray(sp.slide) ? sp.slide[0] : sp.slide) || 1;
  const overlayOff = (Array.isArray(sp.overlay) ? sp.overlay[0] : sp.overlay) === "0";
  const base = postPath(row);
  const primary = primaryAction(state);
  const next = nextStep(state);
  const dp = dateParts(row.date);
  const dayWord = `${dp.weekday.slice(0, 3)} ${dp.d} ${dp.month.slice(0, 3)}`;
  const src = sourceLink(row.source.id ? row.source : state.deck?.source ?? row.source);
  /* After the final approval the rail sends to TikTok drafts: the account map and the key decide whether the button is offered. */
  const step = postingStep(state);
  const bridge = step ? bridgeInfo(state) : undefined;
  const notes = step ? postingNotes(state) : [];
  const warning = bridge ? sendWarning(state, bridge) : null;

  /* prev / next walk the day's posts in board order. */
  const day = allStates(app).filter((s) => s.row.date === row.date);
  const i = day.findIndex((s) => s.row.key === row.key);
  const prev = i > 0 ? day[i - 1] : null;
  const after = i >= 0 && i < day.length - 1 ? day[i + 1] : null;

  /* The band's stamp: the approval the change is measured from (deckChange). */
  const sinceAt = state.changed?.since === "final" ? state.final.at : state.plan.at;
  const openNote =
    state.stage === "idea" && state.idea.status === "sentback" ? state.idea
    : state.stage === "plan" && state.plan.status === "sentback" ? state.plan
    : state.stage === "final" && state.final.status === "sentback" ? state.final
    : null;

  return (
    <div className="page">
      <header className="post-head">
        <nav className="post-head__walk" aria-label="Posts of the day">
          {prev ? <Link href={postPath(prev.row)} rel="prev">‹ Prev</Link> : <span className="is-off">‹ Prev</span>}
          <Link href={`/production/${encodeURIComponent(app)}?zoom=day&date=${row.date}`} title="The day in the studio">{dayWord} · {i + 1} of {day.length}</Link>
          {after ? <Link href={postPath(after.row)} rel="next">Next ›</Link> : <span className="is-off">Next ›</span>}
        </nav>
        <Link className="post-head__who" href={`/app/${encodeURIComponent(app)}/handle/${encodeURIComponent(identity?.dir ?? row.handle.slice(1))}`} title="The handle this post is for">
          <Face src={identity?.profile ?? null} name={row.handle} />
          <span className="post-head__who-text"><b>{row.handle}</b><small>{[identity?.role ?? row.role, identity ? (identity.connected ? "connected" : "not connected") : null].filter(Boolean).join(" · ")}</small></span>
        </Link>
        <h1 className={`post-head__topic${state.killed ? " is-killed" : ""}`}>{curl(row.topic)}</h1>
        <p className="post-head__meta">
          <span>{row.slot}</span><span>·</span><span>{row.format}{state.deck ? ` · ${state.deck.slides.length} slides · ${state.dimension}` : ""}</span>
          <Marks state={state} size="lg" />
          <StateWord s={state} />
          {mode === "planning" ? (
            asPlan ? <Link className="post-head__mode" href={base}>back to the deck as it will appear</Link> : null
          ) : (
            <Link className="post-head__mode" href={`${base}?as=plan`}>view as plan</Link>
          )}
        </p>
        <div className="next" id="decision">
          <div className="next__left">
            <p className={`next__text is-${next.who}`}>
              <span className="next__who">{next.who === "you" ? "Your turn" : next.who === "agent" ? "Agent's turn" : "Done"}</span>
              {next.slide ? <Link href={`${base}?slide=${next.slide}`}>{next.text}</Link> : next.text}
            </p>
            {notes.length || step === "sent" ? (
              <ul className="next__notes">
                {step === "sent" && state.sent ? <SendStatusLine post={row.key} sent={state.sent} /> : null}
                {notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            ) : null}
          </div>
          <DecisionRail state={state} primary={primary} outcomesOpen={outcomesOpenAt(state)} readOnly={next.who === "agent"} bridge={bridge} warning={warning} zones={zones} />
        </div>
        <Reads s={state} />
        {openNote ? <p className="band">Sent back {openNote.at ? stamp(openNote.at) : ""} — <em>“{openNote.note}”</em></p> : null}
        {state.changed && !state.killed ? (
          <p className="band">
            {state.changed.slides.length ? (
              <>
                {state.changed.slides.length === 1 ? "Slide" : "Slides"}{" "}
                {state.changed.slides.map((n, i) => (
                  <span key={n}>{i ? ", " : ""}<Link href={`${base}?slide=${n}`}>{n}</Link></span>
                ))}{" "}
                changed since you approved the {state.changed.since === "final" ? "post" : "plan"}{sinceAt ? ` (${stamp(sinceAt)})` : ""}.
              </>
            ) : (
              <>The deck changed since you approved the {state.changed.since === "final" ? "post" : "plan"}{sinceAt ? ` (${stamp(sinceAt)})` : ""}.</>
            )}{" "}
            {state.changed.since === "final" ? "The final needs one more click: approve for posting again once it reads right." : "The plan stays approved; read the change on the way to the final approval."}
          </p>
        ) : null}
        {state.killed ? <p className="band">Killed {stamp(state.killed.at)} — <em>“{state.killed.note}”</em>. The page is read-only.</p> : null}
      </header>

      <div className="post-body">
        {mode === "planning" ? <PlanningMode state={state} readOnly={asPlan} src={src} slideNo={slideNo} /> : <ProducedMode state={state} slideNo={slideNo} src={src} overlayOff={overlayOff} readOnly={next.who === "agent"} />}
        <AnatomyRail state={state} src={src} />
        <DecisionLog log={state.log} />
      </div>
    </div>
  );
}
