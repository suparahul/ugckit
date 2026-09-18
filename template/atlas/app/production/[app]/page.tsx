/**
 * /production/<app> — the studio.
 *
 * One page per app. Its state is the URL: zoom (month · week · day), view
 * (grid · list), date, account and state filters, sort. The head and the
 * toolbar never move; the body redraws by zoom and view. Ember marks only what
 * waits for you. Before the plan exists the page shows its state band and the
 * day grid drawn as the room it will take.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DayGrid, ListView, MonthGrid, WeekGrid, type SortKey } from "@/components/production/Board";
import { TaskList } from "@/components/production/Actions";
import { ReadStrip } from "@/components/factory/Read";
import { StateBand } from "@/components/factory/StateBand";
import { getApp } from "@/lib/apps";
import { canvasOf } from "@/lib/canvas";
import { listHandles } from "@/lib/handles";
import { withStatusWords } from "@/lib/postbridge-flow";
import { addDays, allStates, dateParts, dayTasks, getProduction, today, validSlug, weekStartOf, type PostState } from "@/lib/production";
import { dayViews, readOf, weekDays } from "@/lib/read";
import { SLOTS, SLOT_TIME, slotTimes } from "@/lib/slots";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ app: string }> }): Promise<Metadata> {
  const { app } = await params;
  return { title: `The studio · ${getApp(app)?.name ?? app} — Organic Factory` };
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type Zoom = "month" | "week" | "day";
type View = "grid" | "list";

const STATE_FILTERS: { id: string; label: string; test: (s: PostState) => boolean }[] = [
  { id: "waiting", label: "waiting for you", test: (s) => s.waiting },
  { id: "idea", label: "idea", test: (s) => s.stage === "idea" },
  { id: "writing", label: "deck being written", test: (s) => s.stage === "planned" },
  { id: "inhand", label: "in review", test: (s) => s.stage === "plan" || s.stage === "final" },
  { id: "ready", label: "ready", test: (s) => s.stage === "ready" && !s.sent },
  { id: "drafts", label: "in TikTok drafts", test: (s) => s.stage === "ready" && !!s.sent && s.sent.mode !== "direct" },
  { id: "scheduled", label: "scheduled direct", test: (s) => s.stage === "ready" && s.sent?.mode === "direct" },
  { id: "posted", label: "posted", test: (s) => s.stage === "posted" || s.stage === "read" },
  { id: "killed", label: "killed", test: (s) => s.stage === "killed" },
];

export default async function Studio({ params, searchParams }: { params: Promise<{ app: string }>; searchParams: Promise<SP> }) {
  const { app } = await params;
  const sp = await searchParams;
  if (!validSlug(app) || !getApp(app)) notFound();
  const prod = getProduction(app);
  const root = `/production/${encodeURIComponent(app)}`;
  const todayIso = today();
  const identities = listHandles(app);
  const times = Object.fromEntries(identities.map((h) => [h.short, slotTimes(h.slots)]));

  /* No plan yet: the state band and the day grid drawn as the room it will take. */
  if (!prod.rows.length) {
    const phase = canvasOf(app).phases.find((p) => p.key === "production")!;
    const rooms = identities.length ? identities.map((h) => ({ handle: h.handle, role: h.role ?? "handle" })) : [{ handle: "a persona handle", role: "from the account architecture" }, { handle: "a brand handle", role: "from the account architecture" }];
    return (
      <div className="page stack" style={{ gap: 0 }}>
        <header className="prod__head"><div><h1 className="prod__title">The studio</h1><p className="prod__counts">No plan yet</p></div></header>
        <StateBand state={phase.state === "done" ? "done" : phase.state} text="The studio opens when the plan is written, at app fit and plan. Then every day holds three slots per handle; the agent writes the decks, makes the pictures, renders and sends, and each post waits here for a look at its idea, its plan and its final." ask={phase.ask} phase="phase 8 · production" />
        <div className="day" style={{ "--slots": SLOTS.length, marginTop: 18 } as React.CSSProperties}>
          {rooms.map((r) => (
            <section key={r.handle} className="day__row"><div><h2 className="day__handle">{r.handle}<small>{r.role}</small></h2></div>
              <div className="day__posts">{SLOTS.map((k) => <div key={k} className="cell cell--thumb cell--open"><span className="cell__thumb is-empty" /><span className="cell__handle">{k} · {SLOT_TIME[k]}</span><span className="cell__topic">Open slot</span><span className="cell__format"><span className="state">fills from the plan</span></span></div>)}</div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  const zoom = (["month", "week", "day"].includes(one(sp.zoom)) ? one(sp.zoom) : "day") as Zoom;
  const view = (["grid", "list"].includes(one(sp.view)) ? one(sp.view) : "grid") as View;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : todayIso;
  const accounts = one(sp.account).split(",").filter(Boolean);
  const stateIds = one(sp.state).split(",").filter(Boolean);
  const sort = (["date", "account", "topic", "format", "state"].includes(one(sp.sort)) ? one(sp.sort) : "date") as SortKey;
  const dir = one(sp.dir) === "desc" ? "desc" : "asc";

  const handles = Object.values(prod.plan.handles);
  const shownHandles = accounts.length ? handles.filter((h) => accounts.includes(h.short)) : handles;

  /* The period the zoom shows. */
  const ym = date.slice(0, 7);
  const monday = weekStartOf(app, date);
  const inPeriod = (s: PostState) =>
    zoom === "month" ? s.row.date.startsWith(ym) : zoom === "week" ? s.row.date >= monday && s.row.date <= addDays(monday, 6) : s.row.date === date;

  const all = allStates(app);
  const filtered = await withStatusWords(all
    .filter(inPeriod)
    .filter((s) => !accounts.length || accounts.includes(s.row.short))
    .filter((s) => !stateIds.length || stateIds.some((id) => STATE_FILTERS.find((f) => f.id === id)?.test(s))));

  const counts = {
    planned: filtered.length,
    waiting: filtered.filter((s) => s.waiting).length,
    ready: filtered.filter((s) => s.stage === "ready" && !s.sent).length,
    drafts: filtered.filter((s) => s.stage === "ready" && !!s.sent && s.sent.mode !== "direct").length,
    scheduled: filtered.filter((s) => s.stage === "ready" && s.sent?.mode === "direct").length,
    posted: filtered.filter((s) => s.stage === "posted" || s.stage === "read").length,
  };

  /* URL helpers: change one thing, keep the rest. */
  const href = (patch: Partial<Record<"zoom" | "view" | "date" | "account" | "state" | "sort" | "dir", string | null>>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { zoom, view, date, account: accounts.join(","), state: stateIds.join(","), sort, dir };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
    const q = p.toString();
    return `${root}${q ? `?${q}` : ""}`;
  };
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]).join(",");
  const step = zoom === "month" ? (n: number) => { const p = dateParts(date); const d = new Date(Date.UTC(p.y, p.m - 1 + n, 1)); return d.toISOString().slice(0, 10); } : (n: number) => addDays(date, zoom === "week" ? 7 * n : n);

  const p = dateParts(date);
  const range = prod.plan.range;
  const planWeek = range && monday >= range.from && monday <= range.to ? Math.floor((Date.parse(monday + "T00:00:00Z") - Date.parse(range.from + "T00:00:00Z")) / (7 * 86400000)) + 1 : null;
  const period =
    zoom === "month" ? `${p.month} ${p.y}` : zoom === "week" ? `${planWeek ? `Week ${planWeek} · ` : ""}${dateParts(monday).weekday.slice(0, 3)} ${dateParts(monday).d} – ${dateParts(addDays(monday, 6)).weekday.slice(0, 3)} ${dateParts(addDays(monday, 6)).d} ${dateParts(addDays(monday, 6)).month}` : `${p.weekday} ${p.d} ${p.month}`;

  const order = new Map(prod.rows.map((r, i) => [r.key, i]));
  const pad = (n: number | undefined) => String(n ?? 0).padStart(4, "0");
  const sorted = [...filtered].sort((a, b) => {
    const k = (s: PostState) =>
      sort === "date" ? pad(order.get(s.row.key)) : sort === "account" ? `${s.row.handle} ${s.row.date} ${s.row.n}` : sort === "topic" ? s.row.topic : sort === "format" ? s.row.format : `${s.waiting ? 0 : 1} ${s.stage}`;
    return (k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0) * (dir === "asc" ? 1 : -1);
  });
  const tasks = zoom === "day" ? dayTasks(app, date) : [];
  /* The read of the period: the day's, or the week's, with the week's columns. */
  const week = weekDays(app, date);
  const readStates = all.filter((s) => !accounts.length || accounts.includes(s.row.short));
  const r = readOf(readStates.filter(inPeriod));
  const yesterday = readOf(readStates.filter((s) => s.row.date === addDays(date, -1)));
  const none = zoom === "day" ? `Nothing posted ${date === todayIso ? "yet today" : `on ${p.weekday} ${p.d} ${p.month}`}.${yesterday.posted ? ` The day before: ${yesterday.views.toLocaleString("en-US")} views on ${yesterday.posted} posts.` : ""}` : `Nothing posted in this ${zoom}.`;

  const accountWord = !accounts.length ? "all accounts" : accounts.length === 1 ? handles.find((h) => h.short === accounts[0])?.handle ?? accounts[0] : `${accounts.length} accounts`;
  const stateWord = !stateIds.length ? "every state" : stateIds.map((id) => STATE_FILTERS.find((f) => f.id === id)?.label ?? id).join(", ");
  const nAccount = (short: string) => all.filter(inPeriod).filter((s) => s.row.short === short).length;
  const nState = (f: (typeof STATE_FILTERS)[number]) => all.filter(inPeriod).filter((s) => !accounts.length || accounts.includes(s.row.short)).filter(f.test).length;

  return (
    <div className="page stack" style={{ gap: 0 }}>
      <header className="prod__head">
        <div>
          <h1 className="prod__title">{period}</h1>
          <p className="prod__counts">
            <b>{counts.planned}</b> planned
            {counts.waiting ? <> · <span className="is-waiting">{counts.waiting} waiting for you</span></> : null}
            {counts.ready ? <> · <b>{counts.ready}</b> ready</> : null}
            {counts.drafts ? <> · <b>{counts.drafts}</b> in drafts</> : null}
            {counts.scheduled ? <> · <b>{counts.scheduled}</b> scheduled</> : null}
            {counts.posted ? <> · <b>{counts.posted}</b> posted</> : null}
          </p>
        </div>
        <nav className="prod__nav" aria-label="Period">
          <Link href={href({ date: step(-1) })} aria-label={`Previous ${zoom}`}>‹</Link>
          {date === todayIso && zoom === "day" ? <span className="is-here">today</span> : <Link href={href({ date: todayIso, zoom: "day" })}>today</Link>}
          <Link href={href({ date: step(1) })} aria-label={`Next ${zoom}`}>›</Link>
        </nav>
      </header>

      <div className="prod__bar" role="toolbar" aria-label="Zoom, view and filters">
        <div className="settoggle" aria-label="Zoom">
          {(["month", "week", "day"] as Zoom[]).map((z) => (
            <Link key={z} href={href({ zoom: z })} className={`settoggle__opt${z === zoom ? " is-on" : ""}`} aria-current={z === zoom ? "true" : undefined}>{z}</Link>
          ))}
        </div>
        <div className="settoggle" aria-label="View">
          {(["grid", "list"] as View[]).map((v) => (
            <Link key={v} href={href({ view: v })} className={`settoggle__opt${v === view ? " is-on" : ""}`} aria-current={v === view ? "true" : undefined}>{v}</Link>
          ))}
        </div>
        <details className={`pick${accounts.length ? " is-set" : ""}`}>
          <summary aria-label={`Accounts: ${accountWord}`}>{accountWord}</summary>
          <ul className="pick__list" aria-label="Accounts">
            <li><Link href={href({ account: null })} aria-current={!accounts.length ? "true" : undefined}>all accounts</Link></li>
            {handles.map((h) => (
              <li key={h.short}>
                <Link href={href({ account: toggle(accounts, h.short) })} aria-current={accounts.includes(h.short) ? "true" : undefined}>
                  {h.handle} <span className="n">{nAccount(h.short)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
        <details className={`pick${stateIds.length ? " is-set" : ""}`}>
          <summary aria-label={`State: ${stateWord}`}>{stateWord}</summary>
          <ul className="pick__list" aria-label="State">
            <li><Link href={href({ state: null })} aria-current={!stateIds.length ? "true" : undefined}>every state</Link></li>
            {STATE_FILTERS.map((f) => (
              <li key={f.id}>
                <Link href={href({ state: toggle(stateIds, f.id) })} aria-current={stateIds.includes(f.id) ? "true" : undefined}>
                  {f.label} <span className="n">{nState(f)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {zoom !== "month" ? <ReadStrip r={r} days={week} views={dayViews(readStates, week)} shown={zoom === "day" ? date : null} hrefFor={(d) => href({ zoom: "day", date: d })} label="Views by posting day; each day is a link" none={none} /> : null}

      {view === "list" ? (
        <ListView states={sorted} sort={sort} dir={dir} hrefForSort={(k) => href({ sort: k, dir: k === sort && dir === "asc" ? "desc" : "asc" })} />
      ) : zoom === "month" ? (
        <MonthGrid states={filtered} ym={ym} todayIso={todayIso} hrefForDay={(iso) => href({ zoom: "day", date: iso })} />
      ) : zoom === "week" ? (
        <WeekGrid states={filtered} monday={monday} todayIso={todayIso} handles={shownHandles} />
      ) : (
        <>
          <DayGrid states={filtered} handles={shownHandles} times={times} />
          {tasks.length ? <TaskList date={date} tasks={tasks} /> : null}
        </>
      )}

      {zoom === "day" && view === "grid" && filtered.length === 0 && all.length ? (
        <p className="pending" style={{ marginTop: 18 }}>No post is planned for {p.weekday} {p.d} {p.month}{accounts.length ? " on the accounts chosen" : ""}.</p>
      ) : null}
    </div>
  );
}
