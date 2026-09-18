/**
 * The numbers, in one card: the period and its arrows on the left, the
 * day · week · month toggle and the accounts picker on the right, then the
 * read strip of the period with the week's columns. Every filter is a URL.
 */

import Link from "next/link";

import type { Handle } from "@/lib/handles";
import { addDays, dateParts, type PostState } from "@/lib/production";
import { dayViews, isPosted, readOf, readSentence, weekDays } from "@/lib/read";
import { n } from "./Bits";
import { ReadStrip } from "./Read";

export type Period = "day" | "week" | "month";

export type FiguresQuery = { period: Period; day: string; account: string | null };

/** The query of the numbers card, with the defaults: the latest posting day, all accounts. */
export function figuresQuery(sp: Record<string, string | string[] | undefined>, states: PostState[], todayIso: string): FiguresQuery {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) ?? ""; };
  const period = (["day", "week", "month"].includes(one("period")) ? one("period") : "day") as Period;
  const postedDays = states.filter(isPosted).map((s) => s.row.date).filter((d) => d <= todayIso).sort();
  const latest = postedDays.length ? postedDays[postedDays.length - 1] : todayIso;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one("day")) ? one("day") : latest;
  const account = one("account") || null;
  return { period, day, account };
}

export function Figures({ slug, states, handles, q, base }: { slug: string; states: PostState[]; handles: Handle[]; q: FiguresQuery; base: string }) {
  const { period, day, account } = q;
  const mine = account ? states.filter((s) => s.row.short === account) : states;
  const week = weekDays(slug, day);
  const ym = day.slice(0, 7);
  const inPeriod = (s: PostState) => (period === "day" ? s.row.date === day : period === "week" ? week.includes(s.row.date) : s.row.date.startsWith(ym));
  const shown = mine.filter(inPeriod);
  const r = readOf(shown);
  const p = dateParts(day);
  const w0 = dateParts(week[0]), w6 = dateParts(week[6]);
  const label = period === "day" ? `${p.weekday.slice(0, 3)} ${p.d} ${p.month.slice(0, 3)}` : period === "week" ? `${w0.weekday.slice(0, 3)} ${w0.d} – ${w6.weekday.slice(0, 3)} ${w6.d} ${w6.month.slice(0, 3)}` : `${p.month} ${p.y}`;
  const href = (patch: Partial<FiguresQuery>) => {
    const u = new URLSearchParams();
    const v = { period, day, account, ...patch };
    if (v.period !== "day") u.set("period", v.period);
    u.set("day", v.day);
    if (v.account) u.set("account", v.account);
    return `${base}?${u.toString()}`;
  };
  const step = (k: number) => (period === "month" ? new Date(Date.UTC(p.y, p.m - 1 + k, 1)).toISOString().slice(0, 10) : addDays(day, period === "week" ? 7 * k : k));
  const posted = shown.filter(isPosted).length;
  const planned = shown.filter((s) => !s.posted && !s.killed).length;
  const what = period === "day" ? `${n(posted)} posted` : period === "week" ? `${n(posted)} posted on ${new Set(shown.filter(isPosted).map((s) => s.row.date)).size} of 7 days` : `${n(posted)} posted${planned ? ` · ${n(planned)} planned` : ""}`;
  const acctWord = account ? handles.find((h) => h.short === account)?.handle ?? account : "all accounts";
  const nOf = (short: string | null) => states.filter(inPeriod).filter((s) => !short || s.row.short === short).length;
  const views = dayViews(mine, week);
  return (
    <div className="figures" id="figures">
      <div className="figures__bar" role="toolbar" aria-label="Period and accounts">
        <span className="figures__whens">
          <span className="figures__when">
            <nav className="prod__nav" aria-label={period}>
              <Link href={href({ day: step(-1) })} scroll={false} aria-label={`Previous ${period}`}>‹</Link>
              <span className="is-here">{label}</span>
              <Link href={href({ day: step(1) })} scroll={false} aria-label={`Next ${period}`}>›</Link>
            </nav>
          </span>
        </span>
        <div className="settoggle" aria-label="Period">
          {(["day", "week", "month"] as Period[]).map((k) => (
            <Link key={k} className={`settoggle__opt${k === period ? " is-on" : ""}`} href={href({ period: k })} scroll={false} aria-current={k === period ? "true" : undefined}>{k}</Link>
          ))}
        </div>
        <details className={`pick${account ? " is-set" : ""}`}>
          <summary aria-label={`Accounts: ${acctWord}`}>{acctWord}</summary>
          <ul className="pick__list">
            <li><Link href={href({ account: null })} scroll={false} aria-current={!account ? "true" : undefined}>all accounts<span className="n">{nOf(null)}</span></Link></li>
            {handles.map((h) => (
              <li key={h.short}><Link href={href({ account: h.short })} scroll={false} aria-current={account === h.short ? "true" : undefined}>{h.handle}<span className="n">{nOf(h.short)}</span></Link></li>
            ))}
          </ul>
        </details>
      </div>
      <div className="figures__set">
        <p className="figures__what">{what}{r.lastAt ? ` · read ${r.lastAt.slice(0, 10)} ${r.lastAt.slice(11, 16)} UTC` : ""} · <Link href={`/production/${encodeURIComponent(slug)}?view=list&zoom=${period}&date=${day}`} title="Every post of the period as a list in the studio">every post →</Link></p>
        <ReadStrip r={r} sentence={readSentence(r)} days={week} views={views} shown={period === "day" ? day : null} hrefFor={(d) => `/production/${encodeURIComponent(slug)}?zoom=day&date=${d}`} label="Views by posting day; each day is a link to the studio" none={period === "day" ? `Nothing posted ${label}.` : `Nothing posted in this ${period}.`} />
      </div>
    </div>
  );
}
