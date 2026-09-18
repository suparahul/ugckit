"use client";

/**
 * Every control that writes: the decision line, the per-slide actions, the
 * slide notes, the day tasks. Pictures and cards are not uploaded here: coding
 * agents put them in through the API, and this page only judges them. Each one posts a line to the log (or a file to the
 * store) and refreshes the server render, so the mark it belongs to changes
 * and the log grows. No optimistic state, no modal, no "are you sure": every
 * decision is reversible by the opposite decision, and the log shows both.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { Event, EventKind, PostState, SlideState } from "@/lib/production";
import type { Zones } from "@/lib/when";
import { PostedRail, PostingRail, type BridgeInfo } from "./Bridge";
import { fileUrl } from "./Frame";
import { appFromPath } from "./scope";

type Decide = (e: Omit<Event, "at">) => Promise<string | null>;

export function useDecide(): [Decide, boolean] {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const decide = useCallback<Decide>(
    async (e) => {
      setBusy(true);
      try {
        const r = await fetch("/api/production/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: appFromPath(), ...e }) });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) return j.error ?? "The decision did not save.";
        router.refresh();
        return null;
      } catch {
        return "The server did not answer.";
      } finally {
        setBusy(false);
      }
    },
    [router],
  );
  return [decide, busy];
}

const KIND_WORD: Record<string, string> = {
  "idea.approve": "idea approved",
  "idea.sendback": "idea sent back",
  "plan.approve": "plan approved",
  "plan.sendback": "plan sent back",
  "images.approve": "images approved (old gate)",
  "images.sendback": "images sent back (old gate)",
  "final.approve": "approved for posting",
  "final.sendback": "final sent back",
  "slide.upload": "picture uploaded",
  "slide.choose": "picture chosen",
  "slide.approve": "picture approved",
  "slide.reject": "new picture asked",
  "slide.note": "note",
  "slide.text": "text flag",
  "slide.layout": "layout saved",
  "slide.unlock": "layout reset to default",
  "card.upload": "product callout image uploaded",
  posted: "posted",
  outcomes: "outcomes recorded",
  "postbridge.sent": "sent to TikTok drafts",
  "posted.link": "link found",
  "outcome.sync": "outcomes synced",
  export: "files exported",
  kill: "killed",
  unkill: "un-killed",
};

const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(2)}%` : "—");

export function DecisionRail({
  state,
  primary,
  outcomesOpen,
  readOnly,
  bridge,
  warning,
  zones,
}: {
  state: PostState;
  primary: { kind: EventKind | "posted" | "outcomes" | null; label: string; disabled: string | null };
  /** ISO date when the outcome form opens, or null when not posted. */
  outcomesOpen: string | null;
  /** The agent's turn: no approve, no send back; only kill. */
  readOnly?: boolean;
  /** After the final approval: the posting-service account and whether the send is offered. */
  bridge?: BridgeInfo;
  /** Under the send button: why the send is not offered, or null. */
  warning?: string | null;
  /** The plan's posting and home zones, for the direct-post row. */
  zones: Zones;
}) {
  const [decide, busy] = useDecide();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [killing, setKilling] = useState(false);
  const [sending, setSending] = useState(false);
  const post = state.row.key;
  const sendbackKind: EventKind | null =
    state.stage === "idea" ? "idea.sendback" : state.stage === "plan" ? "plan.sendback" : state.stage === "final" ? "final.sendback" : null;

  const run = async (e: Omit<Event, "at">) => {
    setErr(null);
    const r = await decide(e);
    if (r) setErr(r);
    else setNote("");
  };

  const today = new Date().toISOString().slice(0, 10);
  const outcomesReady = !!outcomesOpen && outcomesOpen <= today;

  return (
    <aside className="rail" aria-label="Decision">
      <div className="rail__inner">
        {state.killed ? (
          <div className="rail__row">
            <span className="rail__why is-bad">Killed {stamp(state.killed.at)} — <em>“{state.killed.note}”</em></span>
            <button type="button" className="rail__kill" disabled={busy} onClick={() => run({ post, kind: "unkill" })}>Un-kill this post</button>
          </div>
        ) : primary.kind === "posted" ? (
          <PostingRail post={post} handle={state.row.handle} sent={state.sent} link={state.link} exported={state.exported} bridge={bridge ?? { account: null, why: "POST_BRIDGE_API_KEY is not set in .env", canSend: false }} warning={warning ?? null} busy={busy} onDecide={run} zones={zones} />
        ) : primary.kind === "outcomes" ? (
          <PostedRail post={post} sent={state.sent} link={state.link} exported={state.exported} synced={state.synced}>
            {outcomesReady ? <OutcomesForm post={post} busy={busy} onDecide={run} synced={state.synced} /> : null}
          </PostedRail>
        ) : (
          <div className="rail__row">
            {primary.kind && !readOnly ? (
              <button
                type="button"
                className="rail__go"
                disabled={busy || !!primary.disabled}
                onClick={() => run({ post, kind: primary.kind as EventKind })}
              >
                {primary.label}
              </button>
            ) : null}
            {primary.disabled && primary.kind && !readOnly ? <span className={`rail__why${state.checks.some((c) => c.ok === false) && state.stage === "final" ? " is-bad" : ""}`}>{primary.disabled}</span> : null}
            {state.stage === "final" && state.checks.some((c) => c.ok === false) ? (
              <span className="rail__why is-bad">check crossed: {state.checks.filter((c) => c.ok === false).map((c) => c.label).join(", ")}</span>
            ) : null}
            {sendbackKind && !readOnly ? (
              sending ? (
                <span className="rail__note">
                  <textarea className="note" rows={1} placeholder="Say what to change." value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for send back" autoFocus />
                  <button type="button" className="pill" disabled={busy || !note.trim()} onClick={() => run({ post, kind: sendbackKind, note }).then(() => setSending(false))}>Send back</button>
                  <button type="button" className="rail__kill" onClick={() => { setSending(false); setNote(""); }}>cancel</button>
                </span>
              ) : (
                <button type="button" className="rail__kill" onClick={() => setSending(true)}>Send back</button>
              )
            ) : null}
            {state.stage !== "read" ? (
              killing ? (
                <span className="rail__row rail__end">
                  <input className="note" style={{ width: 240, height: 32, minHeight: 0 }} placeholder="Why this post is killed." value={note} onChange={(e) => setNote(e.target.value)} aria-label="Kill note" />
                  <button type="button" className="pill" disabled={busy || !note.trim()} onClick={() => run({ post, kind: "kill", note }).then(() => setKilling(false))}>Kill</button>
                  <button type="button" className="rail__kill" onClick={() => setKilling(false)}>cancel</button>
                </span>
              ) : (
                <button type="button" className="rail__kill rail__end" onClick={() => setKilling(true)}>Kill this post</button>
              )
            ) : null}
            {err ? <span className="rail__err" role="alert">{err}</span> : null}
          </div>
        )}
      </div>
    </aside>
  );
}

const OUTCOME_FIELDS: { key: string; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "saves", label: "Saves" },
  { key: "shares", label: "Shares" },
  { key: "comments", label: "Comments" },
  { key: "appQuestions", label: "“what app?” comments" },
  { key: "storeImpressions", label: "Store impressions per 100K" },
];

function OutcomesForm({ post, busy, onDecide, synced }: { post: string; busy: boolean; onDecide: (e: Omit<Event, "at">) => Promise<void>; synced: PostState["synced"] }) {
  /* The synced numbers start the form (saves too when they came from Monid); the two counts by hand stay empty. */
  const [v, setV] = useState<Record<string, string>>(synced ? { views: String(synced.views), shares: String(synced.shares), comments: String(synced.comments), ...(synced.saves != null ? { saves: String(synced.saves) } : {}) } : {});
  const n = (k: string) => Number(v[k] ?? 0);
  return (
    <form
      className="rail__form"
      onSubmit={(e) => {
        e.preventDefault();
        const data: Record<string, number> = {};
        for (const f of OUTCOME_FIELDS) data[f.key] = n(f.key);
        void onDecide({ post, kind: "outcomes", data });
      }}
    >
      {OUTCOME_FIELDS.map((f) => (
        <label key={f.key} className="rail__field is-num">
          {f.label}
          <input type="number" min={0} step="1" inputMode="numeric" value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} required={f.key === "views"} />
        </label>
      ))}
      <button type="submit" className="rail__go" disabled={busy}>Record outcomes</button>
      {synced ? <span className="rail__why">{synced.source === "monid" ? `views, saves, shares and comments from the Monid sync of ${synced.at.slice(0, 10)}` : `views, shares and comments from the Post Bridge sync of ${synced.at.slice(0, 10)}; saves are not in its analytics`}</span> : null}
      <span className="rail__computed">
        → saves/view <b>{pct(n("saves"), n("views"))}</b> · shares/view <b>{pct(n("shares"), n("views"))}</b> · comments/view <b>{pct(n("comments"), n("views"))}</b> (computed)
      </span>
    </form>
  );
}

/* ------------------------------------------------------- slide actions */

/**
 * Per-slide judgement. "Ask for a new one" is the decision that matters;
 * "Approve" is an optional mark, because the final click approves every
 * picture still open. Both are available while the post is in final or ready,
 * even while the agent is still making the other pictures.
 */
export function SlideActions({ post, slide, state, canDecide }: { post: string; slide: number; state: SlideState; canDecide: boolean }) {
  const [decide, busy] = useDecide();
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <div className="sr__actions">
        {state.current ? (
          /* The approval belongs to the picture in view. On an approved slide
           * with another candidate in view, approving moves it to this one. */
          <button type="button" className="pill pill--go" disabled={busy || state.current === state.approved || !canDecide} onClick={() => decide({ post, kind: "slide.approve", slide, file: state.current! }).then((r) => setErr(r))}>
            {state.current === state.approved ? "Approved" : state.approved ? "Approve this one" : "Approve"}
          </button>
        ) : null}
        {state.current && !asking ? (
          <button type="button" className="pill" disabled={busy || !canDecide} onClick={() => setAsking(true)}>Ask for a new one</button>
        ) : null}
      </div>
      {asking ? (
        <div className="sr__actions" style={{ marginTop: 8 }}>
          <textarea className="note" rows={2} placeholder="Say what is wrong with this picture." value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note for the new picture" />
          <button type="button" className="pill" disabled={busy || !note.trim()} onClick={() => decide({ post, kind: "slide.reject", slide, note }).then((r) => { setErr(r); if (!r) { setAsking(false); setNote(""); } })}>
            Ask
          </button>
          <button type="button" className="rail__kill" onClick={() => setAsking(false)}>cancel</button>
        </div>
      ) : null}
      {state.candidates.length > 1 ? (
        <div className="sr__cands" aria-label="Earlier pictures">
          {state.candidates.map((f) => (
            <button key={f} type="button" className={`sr__cand${f === state.current ? " is-current" : ""}${f === state.approved ? " is-approved" : ""}`} disabled={busy || f === state.current} onClick={() => decide({ post, kind: "slide.choose", slide, file: f }).then((r) => setErr(r))} aria-label={`${f === state.current ? "current picture" : "make this the current picture"}${f === state.approved ? ", holds the approval" : ""}`}>
              <img src={fileUrl(f)} alt="" />
              {f === state.approved ? <span className="sr__cand-ok" aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </div>
  );
}

/** Whether the compositor burns the slide's text in (baked) or it is typed in the TikTok editor by hand (overlay: the cover). One line to the log. */
export function SlideTextFlag({ post, slide, text }: { post: string; slide: number; text: "overlay" | "baked" }) {
  const [decide, busy] = useDecide();
  const next = text === "baked" ? "overlay" : "baked";
  return (
    <button type="button" className="rail__kill" disabled={busy} onClick={() => decide({ post, kind: "slide.text", slide, data: { text: next } })}>
      {next === "baked" ? "switch to burned-in text" : "switch to text-free image (you type the words in TikTok)"}
    </button>
  );
}

/** The dated decision log, newest first. Rendered under the post body, not in the rail. */
export function DecisionLog({ log }: { log: Event[] }) {
  const lines = log.slice().reverse();
  return (
    <details className="logblock">
      <summary>Log · {lines.length} {lines.length === 1 ? "line" : "lines"}</summary>
      <ol className="log" aria-label="Decision log">
        {lines.map((e, i) => (
          <li key={e.at + i}>
            <time dateTime={e.at}>{stamp(e.at)}</time>
            <span className="k">{KIND_WORD[e.kind] ?? e.kind}{e.slide ? ` · slide ${e.slide}` : ""}{e.actor === "demo" ? <span className="state__demo">test</span> : e.actor ? <span className="state__demo">agent</span> : null}</span>
            <span>{e.note ? <em>“{e.note}”</em> : (e.kind === "postbridge.sent" || e.kind === "posting.sent") ? `Post Bridge post ${e.data?.id ?? ""}${e.data?.mode === "direct" ? ` · direct, scheduled ${String(e.data?.scheduledAt ?? "").slice(0, 16).replace("T", " ")} UTC` : ""}` : e.kind === "outcome.sync" ? `${e.data?.source === "monid" ? "Monid" : "Post Bridge"}: ${Number(e.data?.views ?? 0).toLocaleString("en-US")} views · ${e.data?.likes ?? 0} likes · ${e.data?.comments ?? 0} comments${e.data?.saves != null ? ` · ${e.data.saves} saves` : ""} · ${e.data?.shares ?? 0} shares` : e.data?.url ? String(e.data.url) : ""}</span>
          </li>
        ))}
        {!lines.length ? <li className="is-more">No decisions yet.</li> : null}
      </ol>
    </details>
  );
}

/**
 * A note under one slide, in either mode. Dated, verbatim, written to the log
 * and shown here under its slide. Read-only views show the notes without the field.
 */
export function SlideNote({ post, slide, notes, readOnly }: { post: string; slide: number; notes: Event[]; readOnly?: boolean }) {
  const [decide, busy] = useDecide();
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="snote">
      {notes.length ? (
        <ul className="snote__list">
          {notes.map((e, i) => (
            <li key={e.at + i}>
              <time dateTime={e.at}>{stamp(e.at)}</time> <em>“{e.note}”</em>
              {e.actor === "demo" ? <span className="state__demo">test</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!readOnly ? (
        <form
          className="snote__form"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!note.trim()) return;
            void decide({ post, kind: "slide.note", slide, note: note.trim() }).then((r) => { setErr(r); if (!r) setNote(""); });
          }}
        >
          <textarea className="note" rows={1} placeholder={`A note on slide ${slide}.`} value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Note on slide ${slide}`} />
          <button type="submit" className="pill" disabled={busy || !note.trim()}>Note</button>
          {err ? <span className="rail__err" role="alert">{err}</span> : null}
        </form>
      ) : null}
    </div>
  );
}

export function TaskList({ date, tasks }: { date: string; tasks: { text: string; done: boolean }[] }) {
  const [decide, busy] = useDecide();
  return (
    <ul className="day__tasks" style={{ listStyle: "none", padding: 0 }}>
      <h2>Before the first post</h2>
      {tasks.map((t) => (
        <li key={t.text} className={`task${t.done ? " is-done" : ""}`}>
          <input
            type="checkbox"
            id={`task-${t.text.slice(0, 20).replace(/\W+/g, "-")}`}
            checked={t.done}
            disabled={busy}
            onChange={() => decide({ post: `day/${date}`, kind: t.done ? "task.untick" : "task.tick", task: t.text })}
          />
          <label htmlFor={`task-${t.text.slice(0, 20).replace(/\W+/g, "-")}`}><span>{t.text}</span></label>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------- slide stepping */

export function PhoneTick({ id, label }: { id: string; label: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem(id) === "1"); } catch { /* no storage */ }
  }, [id]);
  return (
    <span className={`check ${on ? "is-ok" : "is-na"}`}>
      <label>
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); try { localStorage.setItem(id, e.target.checked ? "1" : "0"); } catch { /* no storage */ } }} />
        {label}
      </label>
    </span>
  );
}

