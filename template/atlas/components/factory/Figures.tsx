/**
 * The numbers, in one card: the period and its arrows on the left, the
 * day · week · month toggle and the accounts picker on the right, then the
 * read strip of the period with the week's columns. Every filter is a URL.
 */

import Link from "next/link";

import type { Handle } from "@/lib/handles";
import { addDays, dateParts, type PostState } from "@/lib/production";
import { PLATFORMS, PLATFORM_NAME } from "@/lib/platform";
import { dayViews, isPosted, isPostedIn, readOf, readSentence, weekDays, type View } from "@/lib/read";
import { hasSecondPlatform, onPlatform, PlatformIcon, viewOf } from "@/components/Platform";
import { n } from "./Bits";
import { ReadStrip } from "./Read";

export type Period = "day" | "week" | "month";

export type FiguresQuery = { period: Period; day: string; account: string | null; /** One platform, or both; "both" when no post goes to more than TikTok. */ platform?: View };

/** The query of the numbers card, with the defaults: the latest posting day, all accounts. */
export function figuresQuery(sp: Record<string, string | string[] | undefined>, states: PostState[], todayIso: string): FiguresQuery {
  const one = (k: string) => { const v = sp[k]; return (Array.isArray(v) ? v[0] : v) ?? ""; };
  const period = (["day", "week", "month"].includes(one("period")) ? one("period") : "day") as Period;
  const postedDays = states.filter(isPosted).map((s) => s.row.date).filter((d) => d <= todayIso).sort();
  const latest = postedDays.length ? postedDays[postedDays.length - 1] : todayIso;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one("day")) ? one("day") : latest;
  const account = one("account") || null;
  const platform = hasSecondPlatform(states) ? viewOf(one("platform")) : "both";
  return { period, day, account, platform };
}

export function Figures({ slug, states, handles, q, base }: { slug: string; states: PostState[]; handles: Handle[]; q: FiguresQuery; base: string }) {
  const { period, day, account } = q;
  const view: View = q.platform ?? "both";
  const two = hasSecondPlatform(states);
  const onView = (s: PostState) => onPlatform(s, view);
  const mine = (account ? states.filter((s) => s.row.short === account) : states).filter(onView);
  const week = weekDays(slug, day);
  const ym = day.slice(0, 7);
  const inPeriod = (s: PostState) => (period === "day" ? s.row.date === day : period === "week" ? week.includes(s.row.date) : s.row.date.startsWith(ym));
  const shown = mine.filter(inPeriod);
  const r = readOf(shown, view);
  const p = dateParts(day);
  const w0 = dateParts(week[0]), w6 = dateParts(week[6]);
  const label = period === "day" ? `${p.weekday.slice(0, 3)} ${p.d} ${p.month.slice(0, 3)}` : period === "week" ? `${w0.weekday.slice(0, 3)} ${w0.d} – ${w6.weekday.slice(0, 3)} ${w6.d} ${w6.month.slice(0, 3)}` : `${p.month} ${p.y}`;
  const href = (patch: Partial<FiguresQuery>) => {
    const u = new URLSearchParams();
    const v = { period, day, account, platform: view, ...patch };
    if (v.period !== "day") u.set("period", v.period);
    u.set("day", v.day);
    if (v.account) u.set("account", v.account);
    if (v.platform && v.platform !== "both") u.set("platform", v.platform);
    return `${base}?${u.toString()}`;
  };
  const step = (k: number) => (period === "month" ? new Date(Date.UTC(p.y, p.m - 1 + k, 1)).toISOString().slice(0, 10) : addDays(day, period === "week" ? 7 * k : k));
  const isOn = (s: PostState) => (two ? isPostedIn(s, view) : isPosted(s));
  const posted = shown.filter(isOn).length;
  const planned = shown.filter((s) => !isOn(s) && !s.killed).length;
  const what = period === "day" ? `${n(posted)} posted` : period === "week" ? `${n(posted)} posted on ${new Set(shown.filter(isOn).map((s) => s.row.date)).size} of 7 days` : `${n(posted)} posted${planned ? ` · ${n(planned)} planned` : ""}`;
  /* Under the merged totals, the same figures once per platform. */
  const split = two && view === "both" ? PLATFORMS.map((p) => ({ p, r: readOf(shown.filter((s) => onPlatform(s, p)), p) })).filter((x) => x.r.posted) : [];
  const acctWord = account ? handles.find((h) => h.short === account)?.handle ?? account : "all accounts";
  const nOf = (short: string | null) => states.filter(inPeriod).filter((s) => !short || s.row.short === short).length;
  const views = dayViews(mine, week, view);
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
        {two ? (
          <div className="settoggle" aria-label="Platform">
            {(["both", ...PLATFORMS] as View[]).map((k) => (
              <Link key={k} className={`settoggle__opt${k === view ? " is-on" : ""}`} href={href({ platform: k })} scroll={false} aria-current={k === view ? "true" : undefined}>{k === "both" ? "both platforms" : <><PlatformIcon p={k} /> {PLATFORM_NAME[k]}</>}</Link>
            ))}
          </div>
        ) : null}
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
        <ReadStrip r={r} sentence={readSentence(r)} days={week} views={views} shown={period === "day" ? day : null} hrefFor={(d) => `/production/${encodeURIComponent(slug)}?zoom=day&date=${d}`} label="Views by posting day; each day is a link to the studio" none={period === "day" ? `Nothing posted ${label}.` : `Nothing posted in this ${period}.`} >
          {split.length > 1 ? (
            <div className="pfsplit" aria-label="The figures per platform">
              {split.map(({ p, r: x }) => (
                <span key={p} className="pfsplit__row">
                    <span className="pfsplit__name"><PlatformIcon p={p} /> {PLATFORM_NAME[p]}</span>
                    <span><b>{n(x.views)}</b> views</span><span className="pfsplit__sep">·</span>
                    <span><b>{n(x.likes)}</b> likes</span><span className="pfsplit__sep">·</span>
                    <span><b>{n(x.comments)}</b> comments</span><span className="pfsplit__sep">·</span>
                    <span><b>{n(x.shares)}</b> shares</span><span className="pfsplit__sep">·</span>
                    {x.savesViews ? <span><b>{n(x.saves)}</b> saves</span> : <span className="pfsplit__note">saves not reported</span>}
                </span>
              ))}
            </div>
          ) : null}
        </ReadStrip>
      </div>
    </div>
  );
}
