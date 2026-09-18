/**
 * /app/<slug>/handle/<handle> — the handle identity page.
 *
 * Complete: the research account page's shape — the head with the face, the
 * bio and the numbers; the grid of its posts, playable where posted, drawn as
 * slots where planned; the read; the post table; the identity folded under.
 * In creation: the same head, the one decision that waits for you, the six
 * steps, and every part of the identity — filled as ink, or as a pending slot
 * that names the step that fills it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApp } from "@/lib/apps";
import { getHandle, type Handle } from "@/lib/handles";
import { allStates, getProduction, postPath, type PostState } from "@/lib/production";
import { dayViews, isPosted, numbersOf, readOf, weekDays } from "@/lib/read";
import { dmy, Face, n, pct, Section, wdm } from "@/components/factory/Bits";
import { PostedShow } from "@/components/factory/Cards";
import { IdentityRail } from "@/components/factory/IdentityRail";
import { ReadStrip } from "@/components/factory/Read";
import { Marks } from "@/components/production/Marks";
import { StateWord } from "@/components/production/Board";
import "@/app/account/[handle]/account.css";

export const dynamic = "force-dynamic";

type P = { slug: string; handle: string };

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const { slug, handle } = await params;
  const h = getHandle(slug, handle);
  return { title: `${h?.handle ?? handle} · ${getApp(slug)?.name ?? slug} — Organic Factory` };
}

const STEP_MARK = { done: "approved", you: "waiting", agent: "inhand", open: "open" } as const;

function Steps({ h }: { h: Handle }) {
  return (
    <ol className="steps">
      {h.steps.map((st) => (
        <li key={st.n} className={st.state === "open" ? "is-open" : undefined}>
          <span className="steps__n">{st.n}</span>
          <span className="steps__name">{st.name}</span>
          <span className={`steps__fact${st.state === "you" ? " is-you" : ""}`}>
            <span className="marks" role="img" aria-label={st.fact}><svg viewBox="0 0 12 12" className={`mark mark--${STEP_MARK[st.state]}`} aria-hidden="true"><circle className="mark__fill" cx="6" cy="6" r="4.2" />{st.state === "you" || st.state === "agent" ? <path className="mark__fill" d="M6 1.8 A4.2 4.2 0 0 1 10.2 6 L6 6 Z" /> : null}<circle className="mark__ring" cx="6" cy="6" r="4.9" /></svg></span> {st.fact}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Refs({ h }: { h: Handle }) {
  if (!h.references.length) return <div className="pending">The face and the subject references are drawn at step 3, from the persona; the style reference ships with the kit or is uploaded.</div>;
  return (
    <ul className="refs">
      {h.references.map((r) => (
        <li key={r.file}>
          {r.url ? <img className="cover" src={r.url} alt={r.what || r.file} /> : <div className="pending refs__none">{r.what || r.file}<small>not on disk yet</small></div>}
          <span className="refs__role">{r.role || "reference"}{r.exists && !r.approved && !r.rejected && /identity|face|subject|style/i.test(r.role) ? <> · <span className="state is-waiting">waits for you</span></> : r.approved ? <> · approved {r.approved}</> : r.rejected ? <> · a new one asked {r.rejected}</> : null}</span>
          {r.what ? <span className="refs__cap">{r.what}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Prose({ text }: { text: string }) {
  /* Markdown, lightly: paragraphs, tables as rows, bold, quotes. */
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        if (/^\s*\|/.test(b)) {
          const rows = b.split("\n").filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*-{2,}/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
          const [head, ...body] = rows;
          return (
            <dl className="packaging" key={i}>
              {body.map((r, j) => <div className="packaging__row" key={j}><dt>{r[0]}</dt><dd>{r.slice(1).filter(Boolean).join(" · ")}</dd></div>)}
              {!body.length && head ? <div className="packaging__row"><dt>{head[0]}</dt><dd>{head.slice(1).join(" · ")}</dd></div> : null}
            </dl>
          );
        }
        if (/^>\s?/.test(b)) return <blockquote className="verbatim" key={i}>{b.replace(/^>\s?/gm, "").replace(/\*\*/g, "")}</blockquote>;
        const parts = b.replace(/`/g, "").split(/(\*\*[^*]+\*\*)/g);
        return <p key={i}>{parts.map((p, j) => (p.startsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : p))}</p>;
      })}
    </div>
  );
}

export default async function HandlePage({ params }: { params: Promise<P> }) {
  const { slug, handle } = await params;
  const app = getApp(slug);
  const h = getHandle(slug, handle);
  if (!app || !h) notFound();
  const s = encodeURIComponent(slug);
  const prod = getProduction(slug);
  const states = allStates(slug).filter((st) => st.row.short === h.short);
  const posted = states.filter(isPosted).sort((a, b) => (b.posted!.at > a.posted!.at ? 1 : -1));
  const planned = states.filter((st) => !st.posted && !st.killed);
  const r = readOf(states);
  const views = r.views;
  const top = Math.max(0, ...posted.map((st) => numbersOf(st)?.views ?? 0));
  const median = (() => { const v = posted.map((st) => numbersOf(st)?.views ?? 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; })();
  const range = prod.plan.range;
  const days = range ? weekDays(slug, range.from) : [];
  const provider = h.account?.provider === "postbridge" ? "Post Bridge" : h.account?.provider ?? "the posting service";
  const next = h.next;

  const head = (
    <header className={h.complete ? "ahead" : "prod__head"}>
      <div className={h.complete ? "ahead__id" : "handle-head"}>
        {h.complete ? (
          <div className="handle-head">
            <Face src={h.profile} name={h.handle} size=" face--lg" />
            <div>
              <p className="eyebrow"><Link href={`/app/${s}/handles`}>{app.name}</Link> handles</p>
              <h1 className="display" style={{ margin: 0 }}>{h.handle}</h1>
              <p className="ahead__name serif">{[h.persona?.match(/\*\*([^*]+)\*\*/)?.[1], h.role].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        ) : (
          <>
            <Face src={h.profile} name={h.handle} size=" face--lg" word={next ? `no picture · step ${next.n}` : "no picture"} />
            <div>
              <h1 className="prod__title">{h.handle}</h1>
              <p className="prod__counts">{[h.role ?? "handle", h.created ? `created ${h.created}` : null, h.connected ? `connected through ${provider}` : "not connected"].filter(Boolean).join(" · ")} · {next ? <span className={next.state === "you" ? "is-waiting" : undefined}>step {next.n} of 6 · {next.state === "you" ? "your turn" : next.state === "agent" ? "the agent’s turn" : "open"}</span> : <b>complete</b>}</p>
            </div>
          </>
        )}
        {h.complete && h.bio ? <p className="ahead__bio verbatim">{h.bio}</p> : null}
        {h.complete ? (
          <div className="ahead__links">
            <a className="chip" href={`https://www.tiktok.com/${h.handle}`} target="_blank" rel="noreferrer">TikTok ↗</a>
            {h.tier ? <span className="chip">{h.tier}</span> : null}
            <span className="chip">{h.connected ? `connected · ${provider}` : "not connected"}</span>
            <span className="chip">complete · 6 of 6 steps</span>
            {h.format ? <Link className="chip" href={`/app/${s}/strategy`}>format: {h.format.split("(")[0].trim()}</Link> : null}
          </div>
        ) : null}
      </div>
      {h.complete ? (
        <dl className="ahead__stats">
          <div><dd className="tabular">{posted.length} <small>/ {states.length}</small></dd><dt>posted · planned</dt></div>
          <div><dd className="tabular">{n(views)}</dd><dt>views</dt></div>
          <div><dd className="tabular">{n(top)}</dd><dt>top post</dt></div>
          <div><dd className="tabular">{n(median)}</dd><dt>median views</dt></div>
          <div><dd className="tabular">{pct(r.saves, views)}</dd><dt>saves/view</dt></div>
          <div><dd className="tabular">{h.cadence ?? "—"}</dd><dt>cadence</dt></div>
        </dl>
      ) : (
        <Link className="topbar__link" href={`/app/${s}/handles`}>All handles</Link>
      )}
    </header>
  );

  const identity = (
    <>
      <details className="anatomy" open={!h.complete || undefined}>
        <summary>References · {h.references.filter((x) => x.exists).length}{h.references.length ? ", attached to every generation" : " · step 3"}</summary>
        <Refs h={h} />
      </details>
      <details className="anatomy">
        <summary>Persona{h.approvals.persona ? ` · approved ${h.approvals.persona}` : h.persona ? " · written" : " · step 2"}</summary>
        {h.persona ? <Prose text={h.persona} /> : <div className="pending">Drafted by the agent at step 2 from the findings and the app fit: name, voice, named reader, subject, place.</div>}
      </details>
      <details className="anatomy">
        <summary>Bio{h.approvals.bio ? ` · approved ${h.approvals.bio}` : h.bio ? " · written" : " · step 4"}</summary>
        {h.bio ? <><p className="bio verbatim">{h.bio}</p>{h.bioRule ? <p className="state" style={{ marginTop: 8 }}>{h.bioRule}</p> : null}</> : <div className="pending">The bio is drafted at step 4, by the tier’s rule: a persona bio never names the app. You approve it, then set it on TikTok by hand.</div>}
      </details>
      <details className="anatomy">
        <summary>Defaults{h.approvals.defaults ? ` · approved ${h.approvals.defaults}` : h.format ? " · written" : " · step 5"} · a plan block may override for one week</summary>
        {h.format || h.defaults.length ? (
          <dl className="packaging">
            {[["Format", h.format], ["Dimension", h.dimension], ["Slots", [h.slots, h.postingZone].filter(Boolean).join(" ")], ["Cadence", h.cadence], ["Sound", h.sound]].filter(([, v]) => v).map(([k, v]) => <div className="packaging__row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            {h.defaults.map((d) => <div className="packaging__row" key={d.param}><dt>{d.param}</dt><dd>{d.value}{d.source ? <small className="state"> · {d.source}</small> : null}</dd></div>)}
          </dl>
        ) : <div className="pending">Written by the agent at step 5: format, dimension, slots, cadence, product slot, last slide, sound, caption, image origin.</div>}
      </details>
      {h.stylePrefix || h.identityRule || h.postProcess ? (
        <details className="anatomy">
          <summary>Image rules · the style prefix, the identity rule, the post-process step</summary>
          <div className="prose">
            {h.stylePrefix ? <p><b>Style prefix</b>, in front of every image prompt, unchanged: <em>{h.stylePrefix.replace(/\*\*/g, "")}</em></p> : null}
            {h.identityRule ? <Prose text={h.identityRule} /> : null}
            {h.postProcess ? <Prose text={h.postProcess} /> : null}
          </div>
        </details>
      ) : null}
      <details className="anatomy" open={!h.complete || undefined}>
        <summary>The six steps · {h.complete ? "complete" : `${h.steps.filter((x) => x.state === "done").length} of 6 done`}</summary>
        <Steps h={h} />
      </details>
    </>
  );

  if (!h.complete) {
    const turn = next?.state === "you"
      ? next.n === 1 ? `Create ${h.handle} on TikTok by hand; the agent then writes the role, the tier and the date.`
        : next.n === 2 ? "Read the persona. Approve it, or ask for a new one with a note. The references are drawn after that."
        : next.n === 3 ? "Look at the references. Approve each, or ask for a new one. Then the agent generates the profile picture and drafts the bio."
        : next.n === 4 ? "Approve the profile picture and the bio, then set both on TikTok by hand."
        : next.n === 5 ? "Read the defaults. Approve them, or say what to change."
        : `Connect ${h.handle} in ${provider}; the agent writes the account map at the first send.`
      : next?.state === "agent" ? `${next.name}: the agent writes it and reports here.` : null;
    return (
      <div className="page stack column">
        {head}
        {turn ? (
          <div className="next">
            <div className="next__left"><p className={`next__text is-${next!.state === "you" ? "you" : "agent"}`}><span className="next__who">{next!.state === "you" ? "Your turn" : "Agent’s turn"}</span>{turn}</p></div>
            {next!.state === "you" ? <IdentityRail slug={slug} handle={h.handle} step={next!} references={h.references} /> : null}
          </div>
        ) : null}
        <Section title="Identity" small="what every generation carries">{identity}</Section>
        {states.length ? (
          <Section title="Posts" small={`${posted.length} posted · ${planned.length} planned`} link={{ href: `/production/${s}`, label: "The studio" }}>
            <PostTable states={states} />
          </Section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page stack">
      {head}
      {range ? <p className="ahead__span">Posting {wdm(range.from)} → {wdm(range.to)} · {posted.length} posted, {planned.length} planned{range ? ` · day-7 read ${dmy(new Date(Date.parse(range.from) + 7 * 86400000).toISOString().slice(0, 10))}` : ""}</p> : null}
      <Section title="The grid" small={`${posted.length} posted · hover or tap to play · ${planned.length} planned`} link={{ href: `/production/${s}?zoom=week`, label: "The week" }}>
        {states.length ? (
          <ul className="pgrid">
            {posted.map((st) => <li key={st.row.key}><PostedShow s={st} handle={h} /></li>)}
            {planned.map((st) => (
              <li key={st.row.key}>
                <Link className="slot" href={postPath(st.row)}>
                  <span className="slot__frame">{st.row.day}<small>{wdm(st.row.date).slice(0, 3)} · {st.row.slot}</small></span>
                  <span className="slot__topic">{st.row.topic}</span>
                  <span className="slot__fmt">{st.row.format.split(",")[0].slice(0, 40)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="pending">No post planned for this handle yet. The plan names it at app fit and plan.</div>}
      </Section>
      {posted.length ? (
        <Section title="The read" small={range ? "this plan" : undefined}>
          <ReadStrip r={r} days={days} views={dayViews(states, days)} shown={null} hrefFor={(d) => `/production/${s}?zoom=day&date=${d}`} />
        </Section>
      ) : null}
      {states.length ? (
        <Section title="Posts" small={`${states.length}${range ? " · this plan" : ""}`} link={{ href: `/production/${s}`, label: "The studio" }}>
          <PostTable states={states} />
        </Section>
      ) : null}
      <Section title="Identity" small="what every generation carries">{identity}</Section>
    </div>
  );
}

function PostTable({ states }: { states: PostState[] }) {
  return (
    <div className="plist__wrap" style={{ marginTop: 0 }}>
      <table className="plist plist--wide">
        <thead><tr><th>Day</th><th>Post</th><th>Format</th><th>State</th><th style={{ textAlign: "right" }}>Views</th><th style={{ textAlign: "right" }}>Saves/view</th></tr></thead>
        <tbody>
          {states.map((st) => {
            const nb = numbersOf(st);
            return (
              <tr key={st.row.key} className={st.waiting ? "is-you" : undefined}>
                <td className="plist__handle">{st.row.day}<small>{dmy(st.row.date)} · {st.row.slot}</small></td>
                <td className="plist__topic"><Link href={postPath(st.row)}>{st.row.topic}</Link></td>
                <td className="plist__muted">{st.row.format.split(";")[0].slice(0, 48)}</td>
                <td><span className="week__state"><Marks state={st} /><StateWord s={st} /></span></td>
                <td className="plist__num">{nb ? <b>{n(nb.views)}</b> : "—"}</td>
                <td className="plist__num">{nb ? pct(nb.saves, nb.views) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
