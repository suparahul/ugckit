/**
 * The board's bodies: month, week and day grids and the list. All server
 * rendered; every control is a link, so the board's whole state (zoom, view,
 * date, filters, sort) is the URL and the browser's back button works.
 */

import type { CSSProperties } from "react";
import Link from "next/link";

import { dateParts, postPath, type PostState } from "@/lib/production";
import { Dot, Marks } from "./Marks";

export const postHref = (s: PostState) => postPath(s.row);

export function StateWord({ s }: { s: PostState }) {
  const cls = ["state"];
  if (s.waiting) cls.push("is-waiting");
  if (s.stage === "ready") cls.push("is-ready");
  const m = s.sentence.match(/^(.*?)( — “(.*)”)?$/);
  return (
    <span className={cls.join(" ")}>
      {m ? m[1] : s.sentence}
      {m && m[3] ? <> — <em>“{m[3]}”</em></> : null}
      {s.demo ? <span className="state__demo" title="Test lines in the log, not a decision">test</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ month */

export function MonthGrid({ states, ym, todayIso, hrefForDay }: { states: PostState[]; ym: string; todayIso: string; hrefForDay: (iso: string) => string }) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - lead);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push(d.toISOString().slice(0, 10));
  }
  // Drop a trailing week that is entirely next month.
  const rows = cells.length / 7;
  const lastRow = cells.slice((rows - 1) * 7);
  const trimmed = lastRow.every((iso) => !iso.startsWith(ym)) ? cells.slice(0, (rows - 1) * 7) : cells;

  const byDate = new Map<string, PostState[]>();
  for (const s of states) byDate.set(s.row.date, [...(byDate.get(s.row.date) ?? []), s]);

  return (
    <div className="month" role="grid" aria-label={`${dateParts(ym + "-01").month} ${y}`}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
        <div key={w} className="month__wd" role="columnheader">{w}</div>
      ))}
      {trimmed.map((iso) => {
        const posts = byDate.get(iso) ?? [];
        const waiting = posts.filter((p) => p.waiting).length;
        const decks = posts.filter((p) => p.deck).length;
        const posted = posts.filter((p) => p.stage === "posted" || p.stage === "read").length;
        const ready = posts.filter((p) => p.stage === "ready").length;
        let sentence = "—";
        if (posts.length) {
          if (waiting) sentence = `${waiting} waiting for you`;
          else if (posted === posts.length) sentence = `${posted} posted`;
          else if (ready) sentence = `${ready} ready`;
          else if (!decks) sentence = `${posts.length} planned`;
          else sentence = `${decks} of ${posts.length} decks`;
        }
        const cls = ["month__day"];
        if (!iso.startsWith(ym)) cls.push("is-out");
        if (iso === todayIso) cls.push("is-today");
        if (waiting) cls.push("is-waiting");
        return (
          <Link key={iso} href={hrefForDay(iso)} className={cls.join(" ")} role="gridcell" aria-label={`${iso}: ${sentence}`}>
            <span className="month__num">
              <span>{Number(iso.slice(8))}</span>
              {iso === todayIso ? <small>today</small> : null}
            </span>
            <span className="month__dots" aria-hidden="true">
              {posts.map((p) => <Dot key={p.row.key} state={p} />)}
            </span>
            <span className={`month__sentence${waiting ? " is-waiting" : ""}`}>{sentence}</span>
            <span className="month__room" aria-hidden="true" />
          </Link>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- week */

/**
 * One row per handle, seven day columns. A day cell stacks that handle's posts
 * in order — two today, three or four when the plan says so — each a link.
 */
export function WeekGrid({ states, monday, todayIso, handles }: { states: PostState[]; monday: string; todayIso: string; handles: { handle: string; short: string }[] }) {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  const at = (short: string, date: string) => states.filter((s) => s.row.short === short && s.row.date === date).sort((a, b) => a.row.n - b.row.n);
  return (
    <div className="week__wrap">
      <div className="week" role="grid" aria-label={`Week of ${monday}`}>
        <div className="week__corner" />
        {days.map((iso) => {
          const p = dateParts(iso);
          return (
            <div key={iso} className={`week__col${iso === todayIso ? " is-today" : ""}`} role="columnheader">
              {p.weekday.slice(0, 3)} {p.d}{iso === todayIso ? " · today" : ""}
            </div>
          );
        })}
        {handles.map((h) => (
          <WeekRow key={h.short} label={h.handle} days={days} at={(d) => at(h.short, d)} />
        ))}
      </div>
    </div>
  );
}

function WeekRow({ label, days, at }: { label: string; days: string[]; at: (d: string) => PostState[] }) {
  return (
    <>
      <div className="week__row" role="rowheader">{label}</div>
      {days.map((d) => {
        const posts = at(d);
        if (!posts.length) return <div key={d} className="week__cell is-empty" role="gridcell">—</div>;
        return (
          <div key={d} className="week__cell" role="gridcell">
            {posts.map((s) => (
              <Link key={s.row.key} href={postHref(s)} className={`week__post${s.waiting ? " is-waiting" : ""}`}>
                <span className="week__slot">{s.row.slot}</span>
                <span className={`week__topic${s.stage === "killed" ? " is-killed" : ""}`}>{s.row.topic}</span>
                <span className="week__state"><Marks state={s} /><StateWord s={s} /></span>
              </Link>
            ))}
          </div>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------- day */

/**
 * One row per handle; the handle's posts of the day sit in that row in order,
 * however many there are. The slot word (AM, PM, a time) labels each cell.
 */
export function DayGrid({ states, handles }: { states: PostState[]; handles: { handle: string; short: string; role?: string }[] }) {
  /* The slot columns share the width equally; every row gets the same count, so the columns line up. */
  const slots = Math.max(1, ...handles.map((h) => states.filter((s) => s.row.short === h.short).length));
  return (
    <div className="day" style={{ "--slots": slots } as CSSProperties}>
      {handles.map((h) => {
        const posts = states.filter((s) => s.row.short === h.short).sort((a, b) => a.row.n - b.row.n);
        return (
          <section key={h.short} className="day__row" aria-label={h.handle}>
            <h2 className="day__handle">{h.handle}{h.role ? <small>{h.role}</small> : null}</h2>
            <div className="day__posts">
              {posts.length ? posts.map((s) => <Cell key={s.row.key} s={s} />) : <div className="week__cell is-empty">no post planned</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function Cell({ s }: { s: PostState }) {
  const cls = ["cell"];
  if (s.waiting) cls.push("is-waiting");
  if (s.stage === "killed") cls.push("is-killed");
  return (
    <Link href={postHref(s)} className={cls.join(" ")}>
      <span className="cell__handle">{s.row.slot}</span>
      <span className="cell__topic">{s.row.topic}</span>
      <span className="cell__format">{s.row.format}{s.deck ? ` · ${s.deck.slides.length} slides · ${s.dimension}` : ""}</span>
      <span className="cell__state"><Marks state={s} /><StateWord s={s} /></span>
      <span className="cell__room" aria-hidden="true" />
    </Link>
  );
}

/* ------------------------------------------------------------------- list */

export type SortKey = "date" | "account" | "topic" | "format" | "state";

export function ListView({ states, sort, dir, hrefForSort }: { states: PostState[]; sort: SortKey; dir: "asc" | "desc"; hrefForSort: (k: SortKey) => string }) {
  const cols: { k: SortKey | null; label: string }[] = [
    { k: "date", label: "date" },
    { k: null, label: "slot" },
    { k: "account", label: "account" },
    { k: "topic", label: "topic" },
    { k: "format", label: "format" },
    { k: null, label: "arm" },
    { k: "state", label: "state" },
    { k: null, label: "last note" },
  ];
  return (
    <div className="plist__wrap">
      <table className="plist">
        <caption className="sr-only">Every planned post in the period, sorted by {sort}, {dir === "asc" ? "ascending" : "descending"}.</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.label} scope="col" aria-sort={c.k === sort ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                {c.k ? <Link href={hrefForSort(c.k)} className={c.k === sort ? "is-sorted" : ""}>{c.label}{c.k === sort ? (dir === "asc" ? " ↑" : " ↓") : ""}</Link> : c.label}
              </th>
            ))}
            <th scope="col" className="plist__room" aria-label="reserved for statistics" />
          </tr>
        </thead>
        <tbody>
          {states.map((s) => {
            const lastNote = [...s.log].reverse().find((e) => e.note)?.note ?? null;
            return (
              <tr key={s.row.key} className={s.waiting ? "is-waiting" : ""}>
                <td className="tabular">{s.row.date.slice(5)}</td>
                <td>{s.row.slot}</td>
                <td>{s.row.handle}</td>
                <td className={`plist__topic${s.stage === "killed" ? " is-killed" : ""}`}><Link href={postHref(s)}>{s.row.topic}</Link></td>
                <td className="plist__muted">{s.row.format}</td>
                <td className="plist__muted">{s.row.arm}</td>
                <td><span className="week__state"><Marks state={s} /><StateWord s={s} /></span></td>
                <td className="plist__note">{lastNote ? `“${lastNote}”` : ""}</td>
                <td className="plist__room" />
              </tr>
            );
          })}
          {!states.length ? (
            <tr><td colSpan={9} className="plist__none">No post matches these filters in this period.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
