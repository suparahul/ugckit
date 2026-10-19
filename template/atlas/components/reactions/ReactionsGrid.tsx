"use client";

/**
 * The Reactions page's grid: one card per library entry, the filters above it,
 * and, when the page was opened from a video ("Choose a reaction"), a "Use for
 * <video>" button on each card. The filters live in the URL, so a filtered
 * view can be shared and the back button works. A card shows the preview sheet;
 * ▶ plays the range from the post itself.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { RangePlayer } from "./RangePlayer";

export type Card = {
  id: string;
  status: "proposed" | "kept" | "retired";
  start: number;
  end: number;
  length: number;
  tags: string[];
  faceReplace: { ok: boolean | null; why: string } | null;
  written: { ok: boolean | null; why: string } | null;
  preview: string | null;
  video: string | null;
  handle: string;
  views: number | null;
  app: string;
  beats: number;
  hookText: string | null;
  note: string;
  uses: string[];
  by: "you" | "agent";
};

export type PickFor = { app: string; video: string; job: string | null; picked: string | null } | null;

const fitText = (f: Card["faceReplace"]) => (f?.ok === true ? "face replace: fits" : f?.ok === false ? `face replace: no — ${f.why}` : "face replace: not known yet");

export function ReactionsGrid({ cards, total, tags, jobs, apps, pick }: { cards: Card[]; total: number; tags: string[]; jobs: string[]; apps: string[]; pick: PickFor }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/reactions";
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(pick?.picked ?? null);

  const set = (k: string, v: string) => {
    const q = new URLSearchParams(params?.toString() ?? "");
    /* Opened for a video, the hook job filter starts on its job: "any" is kept as job= so it stays off. */
    if (v || (k === "job" && pick)) q.set(k, v);
    else q.delete(k);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const val = (k: string) => params?.get(k) ?? "";

  async function use(id: string) {
    if (!pick) return;
    setBusy(id);
    setMsg(null);
    const r = await fetch("/api/reactions/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: pick.app, video: pick.video, entry_id: id }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!r.ok) return setMsg(j.error ?? "The pick was not saved.");
    setPicked(id);
    setMsg(`Picked for ${pick.video}. The agent writes it into the brief when it plans the video (video-plan).`);
  }

  return (
    <>
      {pick ? (
        <p className="rx-pickbar" role="status">
          Choosing a reaction for <b>{pick.video}</b>
          {pick.job ? <> · hook job <code>{pick.job}</code></> : null}
          {picked ? <> · picked: <Link href={`/reactions/${picked}`}>{picked}</Link></> : null}
          {msg ? <span className="rx-pickbar__msg"> {msg}</span> : null}
        </p>
      ) : null}

      <div className="niche-filters rx-filters">
        <label>
          Tag
          <select value={val("tag")} onChange={(e) => set("tag", e.target.value)}>
            <option value="">any</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          Hook job
          <select value={params?.has("job") ? val("job") : pick?.job ?? ""} onChange={(e) => set("job", e.target.value)}>
            <option value="">any</option>
            {jobs.map((j) => <option key={j} value={j}>{j.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label>
          Route
          <select value={val("fit")} onChange={(e) => set("fit", e.target.value)}>
            <option value="">any</option>
            <option value="face_replace">face replace fits</option>
            <option value="written">written route fits</option>
          </select>
        </label>
        <label>
          Longest
          <select value={val("max")} onChange={(e) => set("max", e.target.value)}>
            <option value="">any length</option>
            {[2, 3, 5, 10].map((n) => <option key={n} value={String(n)}>{n} s</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={val("status")} onChange={(e) => set("status", e.target.value)}>
            <option value="">kept and proposed</option>
            <option value="kept">kept</option>
            <option value="proposed">proposed</option>
            <option value="retired">retired</option>
          </select>
        </label>
        {apps.length > 1 ? (
          <label>
            From
            <select value={val("from")} onChange={(e) => set("from", e.target.value)}>
              <option value="">every app</option>
              {apps.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        ) : null}
        <label className="rx-filters__check">
          <span>Not used</span>
          <input type="checkbox" checked={val("unused") === "1"} onChange={(e) => set("unused", e.target.checked ? "1" : "")} />
        </label>
        <span className="niche-filters__count">{cards.length} of {total}</span>
      </div>

      {!cards.length ? (
        <p className="niche-empty">{total ? "No entry matches these filters." : "The library is empty. Add a reaction from a post page (Add to reactions), or ask the agent to scan the research (reactions.py scan)."}</p>
      ) : (
        <ul className="rx-grid">
          {cards.map((c) => (
            <li key={c.id} className={`rx-card rx-card--${c.status}`}>
              <CardMedia c={c} />
              <div className="rx-card__body">
                <p className="rx-card__head">
                  <Link href={`/reactions/${c.id}`}>{c.handle}</Link> · <span className="tabular">{c.length} s</span> · {c.status === "kept" ? "kept" : c.status === "retired" ? "retired" : "proposed by the agent"}
                </p>
                <p className="rx-card__tags">{c.tags.length ? c.tags.join(" · ") : "no tags"}</p>
                <p className="rx-card__fit">{fitText(c.faceReplace)}</p>
                <p className="rx-card__meta">
                  {c.beats ? `${c.beats} expression beat${c.beats === 1 ? "" : "s"}` : "no beats yet"}
                  {c.uses.length ? ` · used in ${c.uses.length} video${c.uses.length === 1 ? "" : "s"}` : " · not used"}
                </p>
                {pick ? (
                  <button type="button" className="rx-btn" disabled={busy !== null || c.status === "retired"} aria-pressed={picked === c.id} onClick={() => use(c.id)}>
                    {picked === c.id ? "Picked" : busy === c.id ? "Saving…" : `Use for ${pick.video}`}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CardMedia({ c }: { c: Card }) {
  const [on, setOn] = useState(false);
  if (on && c.video) return <RangePlayer className="rx-card__media rx-player" src={c.video} start={c.start} end={c.end} label={`The reaction of ${c.handle}, ${c.start} to ${c.end} s`} />;
  return (
    <div className="rx-card__media">
      {c.preview ? <img src={c.preview} alt={`Frames of the reaction, ${c.start} to ${c.end} s`} loading="lazy" /> : <span className="rx-card__nopreview">no preview sheet yet</span>}
      {c.video ? <button type="button" className="niche-video__play" aria-label={`Play the reaction of ${c.handle}`} onClick={() => setOn(true)}><span>▶</span></button> : null}
    </div>
  );
}
