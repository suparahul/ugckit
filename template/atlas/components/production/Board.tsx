/**
 * The board's bodies: month, week and day grids and the list. All server
 * rendered; every control is a link, so the board's whole state (zoom, view,
 * date, filters, sort) is the URL and the browser's back button works.
 */

import type { CSSProperties } from "react";
import Link from "next/link";

import { dateParts, postPath, type PostState } from "@/lib/production";
import { numbersOf } from "@/lib/read";
import { SLOTS, SLOT_TIME, slotKey } from "@/lib/slots";
import { firstPicture } from "@/components/factory/Wait";
import { Dot, Marks } from "./Marks";

const n = (v: number) => v.toLocaleString("en-US");

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
              <WeekPost key={s.row.key} s={s} />
            ))}
          </div>
        );
      })}
    </>
  );
}

/** A week cell's post: the first picture as a thumbnail once one exists; the views once posted. */
function WeekPost({ s }: { s: PostState }) {
  const pic = firstPicture(s);
  const nb = s.posted ? numbersOf(s) : null;
  return (
    <Link href={postHref(s)} className={`week__post${s.waiting ? " is-waiting" : ""}${pic ? " week__post--pic" : ""}`}>
      {pic ? <img className="week__thumb" src={pic} alt="" /> : null}
      <span className="week__slot">{s.row.slot}</span>
      <span className={`week__topic${s.stage === "killed" ? " is-killed" : ""}`}>{s.row.topic}</span>
      <span className="week__state">{nb ? <span className="state"><b>{n(nb.views)}</b> views</span> : <><Marks state={s} /><StateWord s={s} /></>}</span>
    </Link>
  );
}

/* -------------------------------------------------------------------- day */

/**
 * One row per handle, three slots a day (11:00 · 15:00 · 19:00, or the
 * handle's own times): the plan fills two, the third is drawn as an open
 * card. A post whose slot word is not AM · MID · PM takes the next free slot
 * in its order. Every card carries the thumbnail slot of the week view.
 */
export function DayGrid({ states, handles, times = {} }: { states: PostState[]; handles: { handle: string; short: string; role?: string }[]; times?: Record<string, Record<string, string>> }) {
  return (
    <div className="day" style={{ "--slots": SLOTS.length } as CSSProperties}>
      {handles.map((h) => {
        const posts = states.filter((s) => s.row.short === h.short).sort((a, b) => a.row.n - b.row.n);
        const bySlot = new Map<string, PostState>();
        const rest: PostState[] = [];
        for (const s of posts) { const k = slotKey(s.row.slot); if ((SLOTS as readonly string[]).includes(k) && !bySlot.has(k)) bySlot.set(k, s); else rest.push(s); }
        for (const k of SLOTS) if (!bySlot.has(k) && rest.length) bySlot.set(k, rest.shift()!);
        const t = { ...SLOT_TIME, ...(times[h.short] ?? {}) };
        return (
          <section key={h.short} className="day__row" aria-label={h.handle}>
            <div><h2 className="day__handle">{h.handle}{h.role ? <small>{h.role}</small> : null}</h2></div>
            <div className="day__posts">
              {SLOTS.map((k) => { const s = bySlot.get(k); return s ? <Cell key={s.row.key} s={s} time={t[k]} /> : <OpenCell key={k} slot={k} time={t[k]} />; })}
              {rest.map((s) => <Cell key={s.row.key} s={s} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A planned post in the day view: the thumbnail slot at the left (the first picture once one exists), then the slot, the topic, the format and the state; the numbers once posted. */
export function Cell({ s, time }: { s: PostState; time?: string }) {
  const cls = ["cell", "cell--thumb"];
  if (s.waiting) cls.push("is-waiting");
  if (s.stage === "killed") cls.push("is-killed");
  const pic = firstPicture(s);
  const word = s.stage === "idea" ? "idea" : s.stage === "planned" ? "deck" : s.stage === "plan" ? "plan" : s.stage === "final" ? "pictures" : "deck";
  const nb = s.posted ? numbersOf(s) : null;
  const z = (v: number) => (v === 0 ? "is-zero" : undefined);
  return (
    <Link href={postHref(s)} className={cls.join(" ")}>
      <span className={`cell__thumb${pic ? "" : " is-empty"}`} aria-hidden="true">{pic ? <img src={pic} alt="" /> : <span className="cell__nopic">{word}</span>}</span>
      <span className="cell__handle">{s.row.slot}{time ? ` · ${time}` : ""}</span>
      <span className="cell__topic">{s.row.topic}</span>
      <span className="cell__format"><span className="state">{s.row.format}{s.deck ? ` · ${s.deck.slides.length} slides` : ""} · {s.dimension}</span></span>
      <span className="cell__state"><Marks state={s} /><StateWord s={s} /></span>
      {nb ? <span className="cell__read" aria-label={`${n(nb.views)} views, ${nb.saves} saves, ${nb.shares} shares`}><b>{n(nb.views)}</b><span className={z(nb.saves)}>{nb.saves} {nb.saves === 1 ? "save" : "saves"}</span><span className={z(nb.shares)}>{nb.shares} {nb.shares === 1 ? "share" : "shares"}</span></span> : null}
    </Link>
  );
}

/** The open slot of the day: the studio holds room for three posts per handle; the plan fills two. Informative only. */
function OpenCell({ slot, time }: { slot: string; time: string }) {
  return (
    <div className="cell cell--thumb cell--open" aria-label={`${slot} ${time}: open slot`}>
      <span className="cell__thumb is-empty" aria-hidden="true"><span className="cell__nopic">+</span></span>
      <span className="cell__handle">{slot} · {time}</span>
      <span className="cell__topic">Open slot</span>
      <span className="cell__format"><span className="state">third post of the day</span></span>
      <span className="cell__state"><span className="state">the plan holds two a day</span></span>
    </div>
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
