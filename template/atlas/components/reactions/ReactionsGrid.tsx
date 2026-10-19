"use client";

/**
 * The Reactions page's grid: one card per library entry, the filters above it,
 * and, when the page was opened from a video ("Choose a reaction"), a "Use for
 * <video>" button on each card. The filters live in the URL, so a filtered
 * view can be shared and the back button works. Each option says how many
 * entries it would show (the server's facetCounts), the active filters are
 * listed above the grid with a way to remove each one, and the grid dims while
 * the server sends the new set: the first cards often stay the same, since the
 * best entries match most filters. A card shows the preview sheet; ▶ plays the
 * range from the post itself.
 */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import type { FacetCounts, GridCard } from "@/lib/reactions";
import { RangePlayer } from "./RangePlayer";

export type Card = GridCard;

export type PickFor = { app: string; video: string; job: string | null; picked: string | null } | null;

const fitText = (f: Card["faceReplace"]) => (f?.ok === true ? "face replace: fits" : f?.ok === false ? `face replace: no — ${f.why}` : "face replace: not known yet");

const STATUS_WORD: Record<string, string> = { kept: "kept", proposed: "proposed", retired: "retired" };

export function ReactionsGrid({ cards, total, tags, jobs, apps, pick, counts }: { cards: Card[]; total: number; tags: string[]; jobs: string[]; apps: string[]; pick: PickFor; counts: FacetCounts }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/reactions";
  const params = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(pick?.picked ?? null);
  const [pending, start] = useTransition();

  const go = (q: URLSearchParams) => start(() => router.replace(`${pathname}${q.size ? `?${q.toString()}` : ""}`, { scroll: false }));
  const set = (k: string, v: string) => {
    const q = new URLSearchParams(params?.toString() ?? "");
    /* Opened for a video, the hook job filter starts on its job: "any" is kept as job= so it stays off. */
    if (v || (k === "job" && pick)) q.set(k, v);
    else q.delete(k);
    go(q);
  };
  const val = (k: string) => params?.get(k) ?? "";
  const jobNow = params?.has("job") ? val("job") : pick?.job ?? "";
  const c = (n: number | undefined) => ` (${n ?? 0})`;
  /* The filters in force, in words, each with the count it would give back when removed. */
  const active: { k: string; words: string; back: number }[] = [
    ...(val("q") ? [{ k: "q", words: `search “${val("q")}”`, back: counts.any.q }] : []),
    ...(val("tag") ? [{ k: "tag", words: `tag ${val("tag")}`, back: counts.any.tag }] : []),
    ...(jobNow ? [{ k: "job", words: `hook job ${jobNow.replace(/_/g, " ")}`, back: counts.any.job }] : []),
    ...(val("fit") ? [{ k: "fit", words: val("fit") === "face_replace" ? "face replace fits" : "written route fits", back: counts.any.fit }] : []),
    ...(val("max") ? [{ k: "max", words: `${val("max")} s or shorter`, back: counts.any.max }] : []),
    ...(val("status") ? [{ k: "status", words: STATUS_WORD[val("status")] ?? val("status"), back: counts.any.status }] : []),
    ...(val("from") ? [{ k: "from", words: `from ${val("from")}`, back: counts.any.app }] : []),
    ...(val("unused") === "1" ? [{ k: "unused", words: "not used", back: counts.any.unused }] : []),
  ];
  const clearAll = () => {
    const q = new URLSearchParams();
    if (params?.get("pick")) q.set("pick", params.get("pick")!);
    if (params?.get("app")) q.set("app", params.get("app")!);
    if (pick) q.set("job", "");
    go(q);
  };

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
          Search
          <input key={val("q")} type="search" defaultValue={val("q")} placeholder="handle, tag, text; Enter" onKeyDown={(e) => { if (e.key === "Enter") set("q", e.currentTarget.value.trim()); }} onBlur={(e) => { if (e.currentTarget.value.trim() !== val("q")) set("q", e.currentTarget.value.trim()); }} />
        </label>
        <label>
          Tag
          <select value={val("tag")} onChange={(e) => set("tag", e.target.value)}>
            <option value="">any</option>
            {tags.map((t) => <option key={t} value={t}>{t}{c(counts.tag[t])}</option>)}
          </select>
        </label>
        <label>
          Hook job
          <select value={jobNow} onChange={(e) => set("job", e.target.value)}>
            <option value="">any</option>
            {jobs.map((j) => <option key={j} value={j}>{j.replace(/_/g, " ")}{c(counts.job[j])}</option>)}
          </select>
        </label>
        <label>
          Route
          <select value={val("fit")} onChange={(e) => set("fit", e.target.value)}>
            <option value="">any</option>
            <option value="face_replace">face replace fits{c(counts.fit.face_replace)}</option>
            <option value="written">written route fits{c(counts.fit.written)}</option>
          </select>
        </label>
        <label>
          Longest
          <select value={val("max")} onChange={(e) => set("max", e.target.value)}>
            <option value="">any length</option>
            {[2, 3, 5, 10].map((n) => <option key={n} value={String(n)}>{n} s or shorter{c(counts.max[String(n)])}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={val("status")} onChange={(e) => set("status", e.target.value)}>
            <option value="">kept and proposed</option>
            <option value="kept">kept{c(counts.status.kept)}</option>
            <option value="proposed">proposed{c(counts.status.proposed)}</option>
            <option value="retired">retired{c(counts.status.retired)}</option>
          </select>
        </label>
        {apps.length > 1 ? (
          <label>
            From
            <select value={val("from")} onChange={(e) => set("from", e.target.value)}>
              <option value="">every app</option>
              {apps.map((a) => <option key={a} value={a}>{a}{c(counts.app[a])}</option>)}
            </select>
          </label>
        ) : null}
        <label className="rx-filters__check">
          <span>Not used{c(counts.unused)}</span>
          <input type="checkbox" checked={val("unused") === "1"} onChange={(e) => set("unused", e.target.checked ? "1" : "")} />
        </label>
      </div>

      <p className="rx-active" role="status" aria-live="polite">
        <b className="tabular">{pending ? "Updating…" : `${cards.length} of ${total}`}</b>{pending ? null : " shown"}
        {active.map((a) => (
          <button key={a.k} type="button" className="rx-chip" onClick={() => set(a.k, "")} aria-label={`Remove the filter: ${a.words} (${a.back} shown without it)`}>{a.words} ×</button>
        ))}
        {active.length > 1 ? <button type="button" className="rx-chip rx-chip--clear" onClick={clearAll}>Clear all</button> : null}
        {!active.length ? <span className="rx-active__none"> · no filter</span> : null}
      </p>

      {!cards.length ? (
        <p className="niche-empty">{total ? "No entry matches these filters." : "The library is empty. Add a reaction from a post page (Add to reactions), or ask the agent to scan the research (reactions.py scan)."}</p>
      ) : (
        <ul className={`rx-grid${pending ? " is-pending" : ""}`} aria-busy={pending}>
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
