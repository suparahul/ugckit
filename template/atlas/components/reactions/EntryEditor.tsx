"use client";

/**
 * The entry view's player and controls: Keep, Retire, Edit range (Set start and
 * Set end from the player, or typed), Tags, Note, and Use for a video in
 * planning. Each save writes the fields the user changed, as theirs
 * (set_by_you), through /api/reactions; a pick writes a reaction.pick line.
 */

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { RangePlayer, type RangePlayerHandle } from "./RangePlayer";

type Video = { app: string; video: string; reaction: boolean; job: string | null };

export function EntryEditor({ id, status, start, end, tags, note, allTags, video, poster, handle, videos, picked }: { id: string; status: "proposed" | "kept" | "retired"; start: number; end: number; tags: string[]; note: string; allTags: string[]; video: string | null; poster: string | null; handle: string; videos: Video[]; picked: Record<string, string | null> }) {
  const router = useRouter();
  const player = useRef<RangePlayerHandle>(null);
  const [editing, setEditing] = useState(false);
  const [s, setS] = useState(String(start));
  const [e, setE] = useState(String(end));
  const [t, setT] = useState<string[]>(tags);
  const [n, setN] = useState(note);
  const [target, setTarget] = useState(videos.find((v) => v.reaction) ? `${videos.find((v) => v.reaction)!.app}/${videos.find((v) => v.reaction)!.video}` : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(change: Record<string, unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "change", id, change }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Not saved.");
    setMsg(done);
    setEditing(false);
    router.refresh();
  }

  async function use() {
    const [app, vid] = target.split("/");
    if (!app || !vid) return;
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/reactions/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app, video: vid, entry_id: id }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setMsg(r.ok ? `Picked for ${vid}. The agent writes it into the brief when it plans the video (video-plan).` : j.error ?? "Not saved.");
    if (r.ok) router.refresh();
  }

  const at = (set: (v: string) => void) => () => {
    const x = player.current?.time();
    if (x !== null && x !== undefined) set(String(x));
  };
  const toggle = (tag: string) => setT((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));
  const sv = Number(s), ev = Number(e);

  return (
    <div className="rx-entry__media">
      {video ? (
        <RangePlayer ref={player} className="rx-player rx-player--large" src={video} start={editing && Number.isFinite(sv) ? sv : start} end={editing && Number.isFinite(ev) && ev > sv ? ev : end} free={editing} poster={poster} autoPlay={!editing} label={`The reaction of ${handle}`} />
      ) : (
        <p className="niche-empty">The post's video is not on disk any more.</p>
      )}

      <div className="rx-controls" aria-label="Your decisions on this entry">
        <div className="rx-controls__row">
          <button type="button" className="rx-btn" disabled={busy || status === "kept"} onClick={() => save({ status: "kept" }, "Kept.")}>Keep</button>
          <button type="button" className="rx-btn rx-btn--quiet" disabled={busy || status === "retired"} onClick={() => save({ status: "retired" }, "Retired: hidden from the grid and from video-plan.")}>Retire</button>
          {status !== "proposed" ? <span className="rx-controls__state">{status === "kept" ? "You kept this entry." : "You retired this entry."}</span> : <span className="rx-controls__state">Proposed by the agent. Only you keep or retire it.</span>}
        </div>

        <div className="rx-controls__row">
          {!editing ? (
            <button type="button" className="rx-btn rx-btn--quiet" disabled={busy || !video} onClick={() => setEditing(true)}>Edit range</button>
          ) : (
            <>
              <label className="rx-time">Start <input inputMode="decimal" value={s} onChange={(x) => setS(x.target.value)} /> s</label>
              <button type="button" className="rx-btn rx-btn--quiet" onClick={at(setS)}>Set start here</button>
              <label className="rx-time">End <input inputMode="decimal" value={e} onChange={(x) => setE(x.target.value)} /> s</label>
              <button type="button" className="rx-btn rx-btn--quiet" onClick={at(setE)}>Set end here</button>
              <button type="button" className="rx-btn" disabled={busy || !(sv >= 0 && ev > sv)} onClick={() => save({ start_s: sv, end_s: ev }, "Range saved. Beats past the new end were dropped; ask the agent to describe it again.")}>Save range</button>
              <button type="button" className="rx-btn rx-btn--quiet" onClick={() => { setEditing(false); setS(String(start)); setE(String(end)); }}>Cancel</button>
              <p className="rx-hint">The player plays the whole post while you edit. Pause on the first and on the last face frame of the reaction.</p>
            </>
          )}
        </div>

        <fieldset className="rx-tags">
          <legend>Tags</legend>
          {allTags.map((tag) => (
            <label key={tag} className="rx-tag">
              <input type="checkbox" checked={t.includes(tag)} onChange={() => toggle(tag)} /> {tag}
            </label>
          ))}
          <button type="button" className="rx-btn rx-btn--quiet" disabled={busy || (t.length === tags.length && t.every((x) => tags.includes(x)))} onClick={() => save({ tags: t }, "Tags saved.")}>Save tags</button>
        </fieldset>

        <label className="rx-note">
          Note
          <textarea rows={2} value={n} onChange={(x) => setN(x.target.value)} placeholder="What this reaction is good for, or what is wrong with it" />
        </label>
        <button type="button" className="rx-btn rx-btn--quiet" disabled={busy || n === note} onClick={() => save({ note: n }, "Note saved.")}>Save note</button>

        <div className="rx-controls__row rx-use">
          {videos.length ? (
            <>
              <label>
                Use for
                <select value={target} onChange={(x) => setTarget(x.target.value)}>
                  <option value="">a video in planning…</option>
                  {videos.map((v) => (
                    <option key={`${v.app}/${v.video}`} value={`${v.app}/${v.video}`}>
                      {v.video}{v.reaction ? " · reaction hook" : ""}{picked[`${v.app}/${v.video}`] === id ? " · picked" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="rx-btn" disabled={busy || !target || status === "retired"} onClick={use}>Use this reaction</button>
            </>
          ) : (
            <span className="rx-hint">No video is in planning now. A pick is made from a video's plan (Choose a reaction) or here, while the video has a brief and no locked plan.</span>
          )}
        </div>
        {msg ? <p className="rx-msg" role="status">{msg}</p> : null}
      </div>
    </div>
  );
}
