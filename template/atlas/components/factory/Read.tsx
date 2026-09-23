/**
 * The read strip of the reporting layer: the period's totals as one count
 * line, the sentence with the source and read time, and the week's columns,
 * each a link to that day in the studio. Verbatim in structure from the
 * reporting mockups; the numbers come from lib/read.ts.
 */

import Link from "next/link";

import { readSentence, type Read } from "@/lib/read";
import { n, pct, wdm } from "./Bits";

export function ReadTotals({ r }: { r: Read }) {
  const z = (v: number) => (v === 0 ? "is-zero" : undefined);
  const partial = r.savesViews !== undefined && r.savesViews !== r.views;
  return (
    <p className="read__totals">
      <span><b>{n(r.views)}</b>views</span>
      {/* Saves are TikTok's: with Instagram in the views, saves/view divides by TikTok's views only and says so. */}
      {partial && !r.savesViews ? <span className="is-zero"><b>—</b>saves not reported</span> : <span className={z(r.saves)}><b>{n(r.saves)}</b>{r.saves === 1 ? "save" : "saves"}</span>}
      <span className={z(r.shares)}><b>{n(r.shares)}</b>{r.shares === 1 ? "share" : "shares"}</span>
      <span className={z(r.comments)}><b>{n(r.comments)}</b>{r.comments === 1 ? "comment" : "comments"}</span>
      {partial && !r.savesViews ? null : <span className="is-ratio"><b>{pct(r.saves, partial ? r.savesViews : r.views)}</b>saves/view{partial ? " · TikTok" : ""}</span>}
    </p>
  );
}

export function DaysNav({ days, views, shown, hrefFor, label }: { days: string[]; views: Record<string, number | "unread" | null>; shown: string | null; hrefFor: (iso: string) => string; label: string }) {
  const nums = Object.values(views).filter((v): v is number => typeof v === "number");
  const mx = Math.max(1, ...nums);
  return (
    <nav className="days" aria-label={label}>
      {days.map((d) => {
        const v = views[d];
        const w = wdm(d);
        const [wd, dd] = [w.slice(0, 3), w.slice(4).split(" ")[0]];
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

export function ReadStrip({ r, sentence, days, views, shown, hrefFor, label, none, children }: { r: Read; sentence?: string; days?: string[]; views?: Record<string, number | "unread" | null>; shown?: string | null; hrefFor?: (iso: string) => string; label?: string; none?: string; /** Under the totals: the split per platform, when there are two. */ children?: React.ReactNode }) {
  if (!r.posted) {
    return (
      <section className="read" aria-label="The read">
        <p className="read__none">{none ?? "Nothing posted yet. The read appears here after the first post."}</p>
        {days && views && hrefFor ? <DaysNav days={days} views={views} shown={shown ?? null} hrefFor={hrefFor} label={label ?? "Views by posting day"} /> : null}
      </section>
    );
  }
  return (
    <section className="read" aria-label="The read">
      <ReadTotals r={r} />
      {children}
      <p className="read__line">{sentence ?? readSentence(r)}</p>
      {days && views && hrefFor ? <DaysNav days={days} views={views} shown={shown ?? null} hrefFor={hrefFor} label={label ?? "Views by posting day; each day is a link to the studio"} /> : null}
    </section>
  );
}
