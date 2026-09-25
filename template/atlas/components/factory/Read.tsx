/**
 * The read strip of the reporting layer: the period's totals as one count
 * line, the sentence with the source and read time, and the week's columns,
 * each a link to that day in the studio. Verbatim in structure from the
 * reporting mockups; the numbers come from lib/read.ts.
 */

import Link from "next/link";

import { readSentence, type Read } from "@/lib/read";
import { n, pct, wdm } from "./Bits";

/** The change against the previous period: "▲ 12% WoW", "new" when the previous period had none, nothing when both are zero. */
function Delta({ now, before, vs, points }: { now: number; before: number; vs: string; /** A ratio in percent: the change is in points, not a percent of a percent. */ points?: boolean }) {
  if (!now && !before) return null;
  if (!before) return <small className="read__delta is-up" title={`None in the previous period`}>new</small>;
  const d = points ? now - before : (100 * (now - before)) / before;
  const cls = d > 0 ? " is-up" : d < 0 ? " is-down" : "";
  const txt = points ? `${Math.abs(d).toFixed(2)} pt` : `${Math.abs(d) >= 10 ? Math.round(Math.abs(d)) : Math.abs(d).toFixed(1)}%`;
  return <small className={`read__delta${cls}`} title={`Previous period: ${points ? `${before.toFixed(2)}%` : n(before)}`}>{d > 0 ? "▲" : d < 0 ? "▼" : "="} {txt} {vs}</small>;
}

export function ReadTotals({ r, prev, vs }: { r: Read; /** The previous period's read, for the week-over-week or month-over-month change. */ prev?: Read; /** "WoW" or "MoM". */ vs?: string }) {
  const z = (v: number) => (v === 0 ? "is-zero" : undefined);
  const partial = r.savesViews !== undefined && r.savesViews !== r.views;
  const d = (k: "views" | "saves" | "shares" | "comments") => (prev && vs ? <Delta now={r[k]} before={prev[k]} vs={vs} /> : null);
  const ratio = (x: Read) => { const den = x.savesViews !== x.views ? x.savesViews : x.views; return den ? (100 * x.saves) / den : 0; };
  return (
    <p className="read__totals">
      <span><b>{n(r.views)}</b>views{d("views")}</span>
      {/* Saves are TikTok's: with Instagram in the views, saves/view divides by TikTok's views only and says so. */}
      {partial && !r.savesViews ? <span className="is-zero"><b>—</b>saves not reported</span> : <span className={z(r.saves)}><b>{n(r.saves)}</b>{r.saves === 1 ? "save" : "saves"}{d("saves")}</span>}
      <span className={z(r.shares)}><b>{n(r.shares)}</b>{r.shares === 1 ? "share" : "shares"}{d("shares")}</span>
      <span className={z(r.comments)}><b>{n(r.comments)}</b>{r.comments === 1 ? "comment" : "comments"}{d("comments")}</span>
      {partial && !r.savesViews ? null : <span className="is-ratio"><b>{pct(r.saves, partial ? r.savesViews : r.views)}</b>saves/view{partial ? " · TikTok" : ""}{prev && vs && prev.posted ? <Delta now={ratio(r)} before={ratio(prev)} vs={vs} points /> : null}</span>}
    </p>
  );
}

/** A column's label: the upper line and the small line under it. Default: the weekday and the date. */
type LabelOf = (key: string) => [string, string];
const dayLabel: LabelOf = (d) => { const w = wdm(d); return [w.slice(0, 3), w.slice(4).split(" ")[0]]; };

export function DaysNav({ days, views, shown, hrefFor, label, labelOf = dayLabel, nameOf = wdm }: { days: string[]; views: Record<string, number | "unread" | null>; shown: string | null; hrefFor: (iso: string) => string; label: string; /** For weeks or months: the column's two label lines. */ labelOf?: LabelOf; /** The column's name in its title, e.g. "Week of Mon 21 Sep". */ nameOf?: (key: string) => string }) {
  const nums = Object.values(views).filter((v): v is number => typeof v === "number");
  const mx = Math.max(1, ...nums);
  return (
    <nav className="days" aria-label={label}>
      {days.map((d) => {
        const v = views[d];
        const w = nameOf(d);
        const [wd, dd] = labelOf(d);
        let cls = "days__col" + (d === shown ? " is-shown" : "");
        let val = "", h: number | null = null, title = "";
        if (v === "unread") { cls += " is-unread"; title = `${w}: posted, no read yet`; }
        else if (v === null || v === undefined) { cls += " is-none"; title = `${w}: nothing posted`; }
        else { h = Math.max(6, Math.round((100 * v) / mx)); val = d === shown || v === mx ? n(v) : ""; title = `${w}: ${n(v)} views`; }
        return (
          <Link key={d} className={cls} href={hrefFor(d)} title={title} aria-label={title}>
            <span className="days__val">{val}</span>
            <span className="days__bar" style={h !== null ? { height: `${h}%` } : undefined} />
            <span className="days__d">{wd}<small>{dd}</small></span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ReadStrip({ r, sentence, days, views, shown, hrefFor, label, none, children, prev, vs, labelOf, nameOf }: { r: Read; sentence?: string; days?: string[]; views?: Record<string, number | "unread" | null>; shown?: string | null; hrefFor?: (iso: string) => string; label?: string; none?: string; /** Under the totals: the split per platform, when there are two. */ children?: React.ReactNode; prev?: Read; vs?: string; labelOf?: LabelOf; nameOf?: (key: string) => string }) {
  if (!r.posted) {
    return (
      <section className="read" aria-label="The read">
        <p className="read__none">{none ?? "Nothing posted yet. The read appears here after the first post."}</p>
        {days && views && hrefFor ? <DaysNav days={days} views={views} shown={shown ?? null} hrefFor={hrefFor} label={label ?? "Views by posting day"} labelOf={labelOf} nameOf={nameOf} /> : null}
      </section>
    );
  }
  return (
    <section className="read" aria-label="The read">
      <ReadTotals r={r} prev={prev} vs={vs} />
      {children}
      <p className="read__line">{sentence ?? readSentence(r)}</p>
      {days && views && hrefFor ? <DaysNav days={days} views={views} shown={shown ?? null} hrefFor={hrefFor} label={label ?? "Views by posting day; each day is a link to the studio"} labelOf={labelOf} nameOf={nameOf} /> : null}
    </section>
  );
}
