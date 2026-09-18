/**
 * /app/<slug>/strategy — the plan file drawn, not dumped. The handle locks
 * as cards, the experiments with the days they run, the posts as a week
 * grid (a real slide where a post went out, today outlined), the judgement
 * rules, the day-7 read. Every row is the plan file's; the app fit is
 * counted; the account architecture shown when its file exists. Deferred
 * page: built as mocked, no more. Informative only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApp, listApps } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { listHandles } from "@/lib/handles";
import { readAccounts, readFit, readPlanText } from "@/lib/plan";
import { addDays, allStates, dateParts, getProduction, postPath, today } from "@/lib/production";
import { isPosted, numbersOf } from "@/lib/read";
import { Anat } from "@/components/factory/Anat";
import { dmy, Face, n, Room, Section, wdm } from "@/components/factory/Bits";
import { StateBand } from "@/components/factory/StateBand";
import { firstPicture } from "@/components/factory/Wait";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Strategy · ${getApp(slug)?.name ?? "Your app"} — Organic Factory` };
}

const cut = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const strip = (t: string) => t.replace(/\*\*|`/g, "");

/** The days an experiment runs, read from its schedule line: "days 3 PM and 6 PM", "days 1–4", "all week", "daily PM vs AM". */
function daysOf(schedule: string): Record<number, string> {
  const s = schedule.toLowerCase();
  const out: Record<number, string> = {};
  const all = /all week|all \d+ posts|every post|daily|every day/.test(s);
  if (all) { const slot = /daily pm|pm post/.test(s) && !/am/.test(s) ? "PM" : /daily am/.test(s) ? "AM" : "both"; for (let d = 1; d <= 7; d++) out[d] = slot; }
  for (const m of s.matchAll(/days?\s+(\d)\s*[–-]\s*(\d)/g)) for (let d = Number(m[1]); d <= Number(m[2]); d++) out[d] = out[d] ?? "both";
  for (const m of s.matchAll(/(?:day|days)\s+((?:\d\s*(?:am|pm|mid)?\s*(?:,|and|·)?\s*)+)/g)) {
    for (const one of m[1].matchAll(/(\d)\s*(am|pm|mid)?/g)) { const d = Number(one[1]); if (d >= 1 && d <= 7 && !/[–-]/.test(m[0])) out[d] = one[2] ? one[2].toUpperCase() : out[d] ?? "both"; }
  }
  return out;
}

export default async function StrategyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app && !(slug === "new" && !listApps().length)) notFound();
  const s = encodeURIComponent(slug);
  const canvas = canvasOf(slug);
  const accountsPhase = canvas.phases.find((p) => p.key === "accounts")!;
  const fitPhase = canvas.phases.find((p) => p.key === "fit")!;
  const prod = getProduction(slug);
  const plan = prod.plan;
  const text = readPlanText(slug);
  const fit = readFit(slug);
  const accounts = readAccounts(slug);
  const handles = listHandles(slug);
  const states = allStates(slug);
  const t = today();
  const faceOf = (short: string) => handles.find((h) => h.short === short)?.profile ?? null;
  const nameOf = (short: string) => plan.handles[short]?.handle ?? handles.find((h) => h.short === short)?.handle ?? `@${short}`;

  const band = fitPhase.state !== "done" ? (
    <StateBand state={fitPhase.state} text="The app fit and plan phase fills this page: every parameter fitted from the competitor apps and the niche, the account architecture before it, then the week’s plan — the handle locks, the experiments, the posts day by day, the judgement rules, the day-7 read." ask={fitPhase.ask ?? accountsPhase.ask ?? (fitPhase.state === "todo" ? "nothing yet; the phase starts once the handles exist" : null)} phase={accountsPhase.state !== "done" ? "phase 5 · account architecture" : "phase 7 · app fit and plan"} />
  ) : null;

  const shorts = Object.keys(plan.handles).length ? Object.keys(plan.handles) : [...new Set(prod.rows.map((r) => r.short))];
  const days = plan.range ? Array.from({ length: 7 }, (_, i) => addDays(plan.range!.from, i)) : [];
  const dayN = plan.range && t >= plan.range.from && t <= plan.range.to ? days.indexOf(t) + 1 : 0;
  const stateOf = (key: string) => states.find((x) => x.row.key === key) ?? null;
  const exps = shorts.flatMap((short) => (plan.handles[short]?.experiments ?? []).map((e) => ({ ...e, short })));
  const week = plan.range ? `${dateParts(plan.range.from).weekday.slice(0, 3)} ${dateParts(plan.range.from).d} – ${dateParts(plan.range.to).weekday.slice(0, 3)} ${dateParts(plan.range.to).d} ${dateParts(plan.range.to).month.slice(0, 3)}` : null;
  const weekWord = plan.title?.match(/week\s+(\d+)/i)?.[1] ?? null;
  const rev = text?.revisions ?? [];
  const d7 = text?.day7?.date ?? null;

  if (!prod.rows.length) {
    return (
      <div className="page stack">
        <header className="prod__head"><div><h1 className="prod__title">Strategy</h1><p className="prod__counts">{fit ? <><b>{fit.decided}</b> decided · <b>{fit.experiment}</b> experiment{fit.adopted ? <> · <b>{fit.adopted}</b> adopted (claimed)</> : null} · no plan yet</> : accounts ? "The account architecture is written · no app fit, no plan yet" : "No plan yet"}</p></div></header>
        {band}
        {accounts?.table ? (
          <Section title="The account architecture" small="how many handles, the role of each, the name pattern, the cadence">
            {accounts.intro ? <p className="lede lede--full">{strip(accounts.intro)}</p> : null}
            <Anat head={accounts.table.head} rows={accounts.table.rows} />
          </Section>
        ) : (
          <Section title="The account architecture"><Room text="How many handles, the role of each, the name pattern, the cadence." small="fills at account architecture" n={1} /></Section>
        )}
        {fit?.experiments ? (
          <Section title="The experiment list" small={`${fit.experiments.rows.length} rows · from the app fit`}>
            <Anat head={fit.experiments.head} rows={fit.experiments.rows} />
          </Section>
        ) : null}
        <Section title="The week’s plan"><Room text="The handle locks, the experiments with their days, the posts as a week grid, the judgement rules, the day-7 read." small="fills at app fit and plan" /></Section>
      </div>
    );
  }

  return (
    <div className="page stack">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">Strategy{weekWord ? <em> · week {weekWord}</em> : null}</h1>
          <p className="prod__counts">
            {week ? <>{week} · </> : null}<b>{shorts.length}</b> handles · <b>{prod.rows.length}</b> posts · <b>{exps.length}</b> experiments{d7 ? <> · day-7 read <b>{wdm(d7)}</b></> : null}{rev.length ? <> · revised {rev.length === 1 ? "once" : `${rev.length} times`}, last {dmy(rev[rev.length - 1].date)}</> : null}{fit ? <> · app fit <b>{fit.decided}</b> decided</> : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 16 }}><span className="state">strategy/APP-FIT.md · production/PLAN.md</span></div>
      </header>
      {band}
      {text?.standing ? (
        <div className="next">
          <div className="next__left"><p className="next__text"><span className="next__who">Standing rule</span>{cut(strip(text.standing), 320)}</p></div>
          <aside className="rail" aria-label="Doors"><div className="rail__row"><Link className="rail__kill" href={`/production/${s}`}>The studio</Link></div></aside>
        </div>
      ) : null}

      <Section title="The handles and their locks" small="one format per handle for the week">
        <ul className="locks">
          {shorts.map((short) => {
            const h = plan.handles[short];
            const mine = states.filter((x) => x.row.short === short);
            const pic = mine.map(firstPicture).find(Boolean) ?? null;
            const lock = h?.params["Format lock"] ?? h?.params["Format"] ?? null;
            const slot = h?.params["Product slot"] ?? null;
            const cad = h?.params["Cadence"] ?? null;
            const dim = h?.params["Dimension"]?.match(/\d+:\d+/)?.[0] ?? null;
            return (
              <li key={short} className="lock">
                {pic ? <img className="lock__pic" src={pic} alt="" /> : <span className="lock__pic plan__thumb--none" />}
                <span className="lock__who"><Face src={faceOf(short)} name={nameOf(short)} /><b>{nameOf(short)}</b><small>{h?.role ?? ""}</small></span>
                <span className="lock__text">{lock ? cut(strip(lock), 220) : "No format lock in the plan."}</span>
                {slot ? <span className="lock__row"><dt>product slot</dt><dd>{cut(strip(slot), 120)}</dd></span> : null}
                <span className="lock__row"><dt>cadence</dt><dd>{[cad ? strip(cad) : `${mine.length} posts`, dim ? `${dim}` : null].filter(Boolean).join(" · ")}</dd></span>
                <Link className="topbar__link" href={`/app/${s}/handle/${encodeURIComponent(nameOf(short).replace(/^@/, ""))}`}>The handle</Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {exps.length ? (
        <Section title="The experiments" small="what changes, on which days">
          <ul className="exps">
            {exps.map((e, i) => {
              const code = e.name.match(/^(E\d+|Cap|Conv)/i)?.[1] ?? e.name.match(/^(\w+)/)?.[1]?.slice(0, 4) ?? `E${i + 1}`;
              const name = e.name.replace(/^(E\d+)\s*/i, "").replace(/\s*\(.*\)\s*$/, "");
              const sched = daysOf(e.schedule ?? "");
              const settles = (e.schedule ?? "").split(/\.\s+|;\s+/).slice(1).join(" ").trim();
              return (
                <li key={`${e.short}-${i}`} className="exp">
                  <span className="exp__code">{code}</span>
                  <span className="exp__name">{name.charAt(0).toUpperCase() + name.slice(1)}<small>{nameOf(e.short)}</small></span>
                  <span className="exp__what">{strip(e.what)}</span>
                  {days.length ? (
                    <span className="exp__days" aria-label="Days it runs">
                      {days.map((d, k) => { const p = dateParts(d); return <span key={d} className={`exp__day${sched[k + 1] ? " is-on" : ""}${d === t ? " is-today" : ""}`} title={`${p.weekday.slice(0, 3)} ${p.d}${sched[k + 1] ? `: ${sched[k + 1]}` : ""}`}>{p.weekday.slice(0, 3)}<small>{sched[k + 1] && sched[k + 1] !== "both" ? sched[k + 1] : ""}</small></span>; })}
                    </span>
                  ) : null}
                  <span className="exp__settles">{settles ? `settles on: ${strip(settles)}` : `schedule: ${strip(e.schedule ?? "")}`}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {days.length ? (
        <Section title="The week, day by day" small={`${prod.rows.length} posts · the real slide where one went out · today outlined`} link={{ href: `/production/${s}?view=week`, label: "The week in the studio" }}>
          <div className="plan__wrap">
            <div className="plan">
              <div className="plan__corner" />
              {days.map((d, i) => { const p = dateParts(d); return <div key={d} className={`plan__day${d === t ? " is-today" : ""}`}>{p.weekday.slice(0, 3)} {p.d}<small>day {i + 1}</small></div>; })}
              {shorts.map((short) => (
                <div key={short} style={{ display: "contents" }}>
                  <div className="plan__handle"><Face src={faceOf(short)} name={nameOf(short)} /><b>{nameOf(short)}</b></div>
                  {days.map((d) => (
                    <div key={d} className={`plan__cell${d === t ? " is-today" : ""}`}>
                      {prod.rows.filter((r) => r.short === short && r.date === d).map((r) => {
                        const st = stateOf(r.key);
                        const posted = st ? isPosted(st) : false;
                        const nb = st ? numbersOf(st) : null;
                        const pic = st ? firstPicture(st) : null;
                        return (
                          <Link key={r.key} className={`plan__post${posted ? " is-posted" : ""}`} href={postPath(r)}>
                            <span className="plan__slot">{r.slot}</span>
                            {pic ? <img className="plan__thumb" src={pic} alt="" /> : <span className="plan__thumb plan__thumb--none" />}
                            <span className="plan__topic">{r.topic}</span>
                            <span className="plan__arm">{cut(strip(r.arm ?? "").split(";")[0], 26)}</span>
                            {nb ? <b className="plan__views">{n(nb.views)}</b> : null}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {dayN ? <p className="state" style={{ marginTop: 8 }}>Today is day {dayN} of 7.</p> : null}
        </Section>
      ) : null}

      {text?.rules ? (
        <Section title="Judgement rules" small="from the findings">
          <dl className="packaging">
            {text.rules.rows.map((r, i) => <div key={i} className="packaging__row"><dt>{strip(r[0] ?? "")}</dt><dd>{strip(r[1] ?? "")} {r[2] ? <small className="state">· {strip(r[2])}</small> : null}</dd></div>)}
          </dl>
        </Section>
      ) : null}

      {text?.day7?.table ? (
        <Section title="Day-7 read" small={d7 ? `${wdm(d7)} · views and ×median first` : "views and ×median first"}>
          <ul className="d7">
            {text.day7.table.rows.map((r, i) => {
              const short = r[0]?.match(/@([\w.]+)/)?.[1]?.split(".")[0] ?? "";
              return (
                <li key={i} className="d7__card">
                  <Face src={faceOf(short)} name={strip(r[0] ?? "")} />
                  <b>{strip(r[0] ?? "")}</b>
                  <span>{strip(r[1] ?? "")}</span>
                  {r[2] ? <small className="state">reads: {cut(strip(r[2]), 160)}</small> : null}
                </li>
              );
            })}
          </ul>
          {text.day7.note ? <p className="state" style={{ marginTop: 8 }}>{strip(text.day7.note)}</p> : null}
        </Section>
      ) : null}
    </div>
  );
}
