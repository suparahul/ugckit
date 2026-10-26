"use client";

/**
 * The reel's music: one dropdown over the library (assets/music, a group per folder, the handle's own group first), a
 * preview player, and "Apply music", which writes a `music.set` line and lays the track under the reel
 * (app/api/production/music). Picking only stages a track; nothing changes until it is applied.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MusicTrack } from "@/lib/music";

export function MusicPick({ app, post, tracks, current, hasReel, readOnly = false }: { app: string; post: string; tracks: MusicTrack[]; current: string; hasReel: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [applied, setApplied] = useState(current);
  const [sel, setSel] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const groups = [...new Set(tracks.map((t) => t.group))];

  const apply = async () => {
    setBusy(true); setErr(null); setDone(false);
    try {
      const r = await fetch("/api/production/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app, post, track: sel }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setErr(j.error ?? "The music could not be added.");
      else { setApplied(sel); setDone(true); router.refresh(); }
    } catch { setErr("The server did not answer."); }
    setBusy(false);
  };

  return (
    <div className="music" title="The sound of the reel. A TikTok photo carousel cannot carry sound; only the reel does.">
      <label className="music__field">
        <span className="music__k">Music</span>
        <select value={sel} disabled={busy || readOnly} onChange={(e) => { setSel(e.target.value); setDone(false); setErr(null); }}>
          <option value="none">No music</option>
          {/* A track chosen earlier that is no longer in the library (moved or renamed) stays listed, so the field says what is in the reel. */}
          {applied !== "none" && !tracks.some((t) => t.file === applied) ? <option value={applied} disabled>{`${applied} (not in assets/music)`}</option> : null}
          {groups.map((g) => (
            <optgroup key={g} label={g.charAt(0).toUpperCase() + g.slice(1)}>
              {tracks.filter((t) => t.group === g).map((t) => <option key={t.file} value={t.file}>{t.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {sel !== "none" && tracks.some((t) => t.file === sel) ? <audio className="music__preview" controls preload="none" src={`/api/production/music?track=${encodeURIComponent(sel)}`} /> : null}
      <button type="button" className="pill pill--go" disabled={busy || readOnly || sel === applied} onClick={apply}>{busy ? "Adding the music…" : "Apply music"}</button>
      {done && sel === applied ? <small className="music__note">{hasReel ? (sel === "none" ? "The reel is silent again." : "Applied: the reel above plays it (unmute the player).") : "Saved: the reel carries it when it is cut."}</small> : null}
      {err ? <span className="rail__err" role="alert">{err}</span> : null}
    </div>
  );
}
