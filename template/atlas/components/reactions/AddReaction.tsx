"use client";

/**
 * Add to reactions, on a post page: the reaction's start and end (taken from
 * the page's player, or typed), its tags and a note, saved as a kept entry of
 * the reaction library (/api/reactions). The agent then describes the
 * expression beats and makes the preview (reactions.py describe, fill). A post
 * whose video is not on disk offers "Fetch it first": the Study mark, which
 * niche-fetch downloads.
 */

import Link from "next/link";
import { useState } from "react";

import "@/app/reactions/reactions.css";

export function AddReaction({ video, tags, existing, studyKey, app }: { video: string | null; tags: string[]; existing: { id: string; start: number; end: number; status: string }[]; studyKey?: string; app?: string }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState("");
  const [e, setE] = useState("");
  const [t, setT] = useState<string[]>([]);
  const [n, setN] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [added, setAdded] = useState<{ id: string; start: number; end: number; status: string }[]>([]);
  const [busy, setBusy] = useState(false);

  /* The page's own player: the post page has one video in its asset column. */
  const now = () => {
    const v = document.querySelector<HTMLVideoElement>(".post__asset video");
    return v ? String(Math.round(v.currentTime * 100) / 100) : null;
  };
  const from = (set: (x: string) => void) => () => {
    const x = now();
    if (x === null) setMsg("Play the video first, then pause on the frame.");
    else set(x);
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", video, start_s: Number(s), end_s: Number(e), tags: t, note: n }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; entry?: { id: string; start_s: number; end_s: number; status: string } };
    setBusy(false);
    if (!r.ok || !j.entry) return setMsg(j.error ?? "Not saved.");
    setAdded((a) => [...a, { id: j.entry!.id, start: j.entry!.start_s, end: j.entry!.end_s, status: j.entry!.status }]);
    setOpen(false);
    setS("");
    setE("");
    setT([]);
    setN("");
    setMsg("Added. Ask the agent to describe it (reactions.py describe, fill).");
  }

  async function study() {
    if (!studyKey || !app) return;
    setBusy(true);
    const r = await fetch("/api/niche/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app, changes: [{ key: studyKey, mark: "study" }] }) });
    setBusy(false);
    setMsg(r.ok ? "Marked Study: the agent fetches the video (niche-fetch). Then add the reaction." : "The mark was not saved.");
  }

  const all = [...existing, ...added];
  const sv = Number(s), ev = Number(e);
  return (
    <section className="post__section rx-add" aria-label="Reaction library">
      <h2 className="eyebrow">Reaction library</h2>
      {all.length ? (
        <ul className="rx-add__list">
          {all.map((x) => (
            <li key={x.id}>
              <Link href={`/reactions/${x.id}`}>{x.start}–{x.end} s</Link> · {x.status}
            </li>
          ))}
        </ul>
      ) : null}
      {!video ? (
        studyKey ? (
          <button type="button" className="rx-btn rx-btn--quiet" disabled={busy} onClick={study}>Fetch it first</button>
        ) : (
          <p className="post__desc">The video of this post is not on disk, so it cannot go in the library.</p>
        )
      ) : !open ? (
        <button type="button" className="rx-btn" onClick={() => { setOpen(true); setMsg(null); }}>Add to reactions</button>
      ) : (
        <div className="rx-add__form">
          <p className="rx-hint">Play the video and pause on the first face frame of the reaction, then on the last one. A reaction hook is never spoken: choose a stretch with no speech.</p>
          <div className="rx-controls__row">
            <label className="rx-time">Start <input inputMode="decimal" value={s} onChange={(x) => setS(x.target.value)} /> s</label>
            <button type="button" className="rx-btn rx-btn--quiet" onClick={from(setS)}>Set start here</button>
            <label className="rx-time">End <input inputMode="decimal" value={e} onChange={(x) => setE(x.target.value)} /> s</label>
            <button type="button" className="rx-btn rx-btn--quiet" onClick={from(setE)}>Set end here</button>
          </div>
          <fieldset className="rx-tags">
            <legend>Tags</legend>
            {tags.map((tag) => (
              <label key={tag} className="rx-tag">
                <input type="checkbox" checked={t.includes(tag)} onChange={() => setT((c) => (c.includes(tag) ? c.filter((x) => x !== tag) : [...c, tag]))} /> {tag}
              </label>
            ))}
          </fieldset>
          <label className="rx-note">
            Note
            <textarea rows={2} value={n} onChange={(x) => setN(x.target.value)} placeholder="Optional" />
          </label>
          <div className="rx-controls__row">
            <button type="button" className="rx-btn" disabled={busy || !(sv >= 0 && ev > sv)} onClick={save}>{busy ? "Saving…" : "Add to the library"}</button>
            <button type="button" className="rx-btn rx-btn--quiet" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {msg ? <p className="rx-msg" role="status">{msg}</p> : null}
    </section>
  );
}
