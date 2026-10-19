"use client";

/**
 * Switch reaction, on a video's post page (stage 1 and stage 2): a panel at the right
 * of the page with the reaction library (GET /api/reactions), the filters of the
 * Reactions page (search, tag, hook job), and per card its preview sheet
 * and its range looping while the card is in view. Use this reaction writes the
 * reaction.pick line (POST /api/reactions/pick with the post), closes the panel and
 * refreshes the page, whose reaction card then shows "picked, not in the plan yet".
 * A plan already approved or locked is said before the click: the click also sends
 * the plan back for a new revision (the route writes the plan.sendback line).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { GridCard } from "@/lib/reactions";
import { matches, terms } from "@/lib/search";

type Lib = { cards: GridCard[]; tags: string[]; hook_jobs: Record<string, string[]> };

const PAGE = 24;

/** The range of the post's video, looping while the card is on screen; nothing loads before. */
function LoopInView({ src, start, end, label }: { src: string; start: number; end: number; label: string }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    const io = new IntersectionObserver(([x]) => {
      if (x.isIntersecting) {
        if (el.currentTime < start || el.currentTime > end) el.currentTime = start;
        void el.play().catch(() => undefined);
      } else if (!el.paused) el.pause();
    /* The panel scrolls, not the page: watch its box (a modal dialog's top layer). */
    }, { root: el.closest(".rxd__panel"), threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [start, end]);
  return (
    <video
      ref={v}
      className="rxd__clip"
      src={`${src}#t=${start}`}
      muted
      playsInline
      preload="metadata"
      aria-label={label}
      onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= end) e.currentTarget.currentTime = start; }}
      onEnded={(e) => { e.currentTarget.currentTime = start; void e.currentTarget.play().catch(() => undefined); }}
    />
  );
}

export function SwitchReaction({ app, video, post, job, gated, current, picked }: { app: string; video: string; post: string; job: string | null; gated: boolean; current: string | null; picked: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lib, setLib] = useState<Lib | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [hookJob, setHookJob] = useState(job ?? "");
  const [shown, setShown] = useState(PAGE);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    closeBtn.current?.focus();
    if (!lib) fetch("/api/reactions").then((r) => r.json()).then((j: Lib) => setLib(j)).catch(() => setErr("The library could not be read."));
  }, [open, lib]);
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !open) opener.current?.focus({ preventScroll: true });
    was.current = open;
  }, [open]);
  useEffect(() => setShown(PAGE), [q, tag, hookJob]);

  /* The same rules as the Reactions page (lib/reactions.ts filterEntries), on the cards in the browser. */
  type F = { q: string; tag: string; job: string };
  const pass = (c: GridCard, f: F) => {
    if (!lib) return false;
    const want = new Set([...(f.tag ? [f.tag] : []), ...(f.job ? lib.hook_jobs[f.job] ?? [] : [])]);
    return (!want.size || c.tags.some((t) => want.has(t)))
      && (!f.q.trim() || matches(terms(f.q), [c.text]));
  };
  const now: F = { q, tag, job: hookJob };
  const cards = useMemo(() => (lib ? lib.cards.filter((c) => pass(c, now)) : []), [lib, q, tag, hookJob]); // eslint-disable-line react-hooks/exhaustive-deps
  /* How many each option would show, the other filters as they are. */
  const n = (patch: Partial<F>) => (lib ? lib.cards.filter((c) => pass(c, { ...now, ...patch })).length : 0);
  const active: { words: string; clear: () => void }[] = [
    ...(q ? [{ words: `search “${q}”`, clear: () => setQ("") }] : []),
    ...(tag ? [{ words: `tag ${tag}`, clear: () => setTag("") }] : []),
    ...(hookJob ? [{ words: `hook job ${hookJob.replace(/_/g, " ")}`, clear: () => setHookJob("") }] : []),
  ];

  async function use(id: string) {
    setBusy(id);
    setErr(null);
    const r = await fetch("/api/reactions/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app, video, post, entry_id: id, send_back: gated }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!r.ok) return setErr(j.error ?? "The pick was not saved.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button ref={opener} type="button" className="rx-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Switch reaction</button>
      {/* A modal <dialog>: the browser's top layer, above the sticky section bar; Escape closes it. */}
      <dialog ref={dialog} className="rxd" aria-labelledby="rxd-title" onClose={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
        {open ? (
          <div className="rxd__panel">
            <header className="rxd__head">
              <h2 id="rxd-title">Switch the reaction <small>· {video}</small></h2>
              <button ref={closeBtn} type="button" className="rxd__close" aria-label="Close the panel" onClick={() => setOpen(false)}>×</button>
            </header>
            {gated ? (
              <p className="rxd__warn" role="note">
                <b>This plan is already approved or locked.</b> Use this reaction also sends the plan back for a new revision: video-plan and video-script write it again with the new reaction, and you approve the new revision.
              </p>
            ) : (
              <p className="rxd__hint">Use this reaction records your pick. video-plan copies it into the brief on its next run.</p>
            )}
            <div className="rxd__filters">
              <label>Search<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="handle, tag, text" /></label>
              <label>Tag
                <select value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">any</option>
                  {(lib?.tags ?? []).map((t) => <option key={t} value={t}>{t} ({n({ tag: t })})</option>)}
                </select>
              </label>
              <label>Hook job
                <select value={hookJob} onChange={(e) => setHookJob(e.target.value)}>
                  <option value="">any</option>
                  {Object.keys(lib?.hook_jobs ?? {}).map((j) => <option key={j} value={j}>{j.replace(/_/g, " ")} ({n({ job: j })})</option>)}
                </select>
              </label>
            </div>
            <p className="rx-active" role="status" aria-live="polite">
              <b className="tabular rxd__count">{lib ? `${cards.length} of ${lib.cards.length}` : "reading the library…"}</b>{lib ? " shown" : null}
              {active.map((a) => <button key={a.words} type="button" className="rx-chip" onClick={a.clear}>{a.words} ×</button>)}
              {active.length > 1 ? <button type="button" className="rx-chip rx-chip--clear" onClick={() => { setQ(""); setTag(""); setHookJob(""); }}>Clear all</button> : null}
            </p>
            {err ? <p className="rx-msg" role="alert">{err}</p> : null}
            <ul className="rxd__list">
              {cards.slice(0, shown).map((c) => {
                const isCurrent = c.id === current;
                const isPicked = c.id === picked && !isCurrent;
                return (
                  <li key={c.id} className="rxd__card">
                    <div className="rxd__media">
                      {c.video ? <LoopInView src={c.video} start={c.start} end={c.end} label={`The reaction of ${c.handle}, ${c.start} to ${c.end} s, in a loop`} /> : null}
                      {c.preview ? <img className="rxd__sheet" src={c.preview} alt={`Frames of the reaction of ${c.handle}`} loading="lazy" /> : null}
                    </div>
                    <div className="rxd__body">
                      <p className="rx-card__head"><Link href={`/reactions/${c.id}`} target="_blank">{c.handle}</Link> · <span className="tabular">{c.length} s</span> · {c.status === "kept" ? "kept" : "proposed by the agent"}</p>
                      <p className="rx-card__tags">{c.tags.length ? c.tags.join(" · ") : "no tags"}</p>
                      <p className="rx-card__meta">{c.beats ? `${c.beats} expression beat${c.beats === 1 ? "" : "s"}` : "no beats yet"}{c.uses.length ? ` · used in ${c.uses.length}` : ""}</p>
                      <button type="button" className="rx-btn" disabled={busy !== null || isCurrent} onClick={() => use(c.id)}>
                        {isCurrent ? "In the plan" : busy === c.id ? "Saving…" : isPicked ? "Picked · use it again" : gated ? "Use this reaction and send the plan back" : "Use this reaction"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {lib && cards.length > shown ? <button type="button" className="rx-btn rx-btn--quiet rxd__more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, cards.length - shown)} more</button> : null}
            {lib && !cards.length ? <p className="rxd__hint">No reaction matches these filters.</p> : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
