"use client";

/**
 * The video, beat by beat (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4.1, redrawn in
 * ATLAS-VIDEO-PAGE-CLEANUP.md § 3): one card per segment, left to right, 0 s first; the
 * beats of one segment share the card, so one clip is never shown twice as two things.
 * A card shows the time range, the roles in words, and the first sentence of each beat; the
 * pictures (a still, or a paused frame of a video on disk; nothing is extracted) wait under
 * "more" with the on-screen text, the sound, the app and the segment, because the stage panel
 * shows the media that is decided there, and the plan stages show the reaction. When the stage
 * panel has a player (data-cut-player: the cut, the delivered file), the strip follows it and
 * a click on a card's time jumps there.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { groupBeats, roleWord, shortLine } from "@/lib/plain-words";
import type { Checkpoint, Picture, Timeline as TL } from "@/lib/video-stages";

const secs = (n: number) => (Number.isInteger(n) ? `${n}.0` : n.toFixed(1));
const rangeOf = (a: number, b: number) => `${secs(a)}–${secs(b)} s`;

function Pic({ p, small }: { p: Picture; small?: boolean }) {
  const src = p.kind === "video" && p.at !== null ? `${p.url.split("#")[0]}#t=${p.at.toFixed(2)}` : p.url;
  return (
    <figure className={`tl__pic${small ? " is-small" : ""}`}>
      {p.kind === "image" ? <img src={src} alt={p.label} loading="lazy" /> : <video src={src} preload="metadata" muted playsInline controls aria-label={p.label} />}
      <figcaption>{p.label}</figcaption>
    </figure>
  );
}

const seesOf = (c: Checkpoint) => (c.sees === "not written" ? null : c.sees.replace(/ · framing: \w+$/, ""));

type Group = ReturnType<typeof groupBeats<Checkpoint>>[number];

function Card({ g, open, href, onTime }: { g: Group; open: boolean; href: string | null; onTime: ((t: number) => void) | null }) {
  const roles = [...new Set(g.beats.map((b) => roleWord(b.role)).filter(Boolean))];
  const first = g.beats[0];
  const range = rangeOf(g.start, g.end);
  /* Every picture of the card: the first beat's, then the ones it replaced, then the other beats'. */
  const pics = g.beats.flatMap((b) => [...(b.picture ? [b.picture] : []), ...b.earlier]);
  return (
    <li id={`tl-${g.id}`} className={`tl__cp${open ? " is-open" : ""}`}>
      <p className="tl__head tabular">
        {onTime ? <button type="button" className="tl__time" onClick={() => onTime(g.start)} title="Play from here">{range}</button> : <b>{range}</b>}
        {roles.length ? <span className="tl__role"> · {roles.join(", then ")}</span> : null}
      </p>
      {g.beats.length === 1 ? (
        <p className="tl__sees">{seesOf(first) ? shortLine(seesOf(first)!) : <span className="is-blank">nothing written yet</span>}</p>
      ) : (
        <ul className="tl__beats">
          {g.beats.map((b) => <li key={b.id}><b className="tabular">{b.range}</b> {seesOf(b) ? shortLine(seesOf(b)!, 90) : <span className="is-blank">nothing written yet</span>}</li>)}
        </ul>
      )}
      <details className="tl__more">
        <summary>more</summary>
        {g.beats.map((b) => (
          <dl className="tl__lines" key={b.id}>
            {g.beats.length > 1 ? <div><dt>beat</dt><dd className="tabular">{b.range}{roleWord(b.role) ? ` · ${roleWord(b.role)}` : ""}</dd></div> : null}
            {seesOf(b) ? <div><dt>sees</dt><dd>{seesOf(b)}</dd></div> : null}
            <div><dt>text</dt><dd>{b.text.length ? b.text.map((t, i) => <span key={i} className="tl__text">“{t.text}”{t.placement ? ` (${t.placement}, ${t.range})` : ` (${t.range})`}</span>) : "none"}</dd></div>
            <div><dt>sound</dt><dd>{b.sound}</dd></div>
            <div><dt>app</dt><dd>{b.app}</dd></div>
            {!b.picture && b.noPicture ? <div><dt>picture</dt><dd>{b.noPicture}</dd></div> : null}
          </dl>
        ))}
        {g.segment ? <dl className="tl__lines"><div><dt>segment</dt><dd>{href ? <Link href={href}>{g.segment}</Link> : g.segment}</dd></div></dl> : null}
        {pics.length ? <div className="tl__earlier">{pics.map((e) => <Pic key={`${e.url}${e.at}${e.label}`} p={e} small />)}</div> : null}
      </details>
    </li>
  );
}

export function Timeline({ tl, openSeg, base, stage }: { tl: TL; openSeg: string | null; base: string; stage: number }) {
  const segHref = (seg: string) => `${base}?stage=${stage}&seg=${seg}#stages`;
  const [t, setT] = useState(0);
  const [external, setExternal] = useState<HTMLVideoElement | null>(null);
  /* The stage panel's player, when it has one: the strip follows it and jumps it. */
  useEffect(() => {
    const el = document.querySelector<HTMLVideoElement>("video[data-cut-player]");
    setExternal(el);
    if (!el) return;
    const on = () => setT(el.currentTime);
    el.addEventListener("timeupdate", on);
    return () => el.removeEventListener("timeupdate", on);
  }, [tl.player?.url]);
  if (!tl.checkpoints.length) return <p className="tl__empty">No beats yet: the strip fills when the script is written.</p>;
  const jump = external ? (s: number) => { external.currentTime = s; void external.play().catch(() => undefined); } : null;
  const at = tl.length ? Math.min(1, t / tl.length) : 0;
  const groups = groupBeats(tl.checkpoints);
  return (
    <div className={`tl${external ? " has-player" : ""}`}>
      <div className="tl__strip">
        {external && t > 0 ? <span className="tl__marker" style={{ left: `${at * 100}%` }} aria-hidden="true" /> : null}
        <ol className="tl__list">
          {groups.map((g) => <Card key={g.id} g={g} open={!!openSeg && g.segment === openSeg} href={g.segment ? segHref(g.segment) : null} onTime={jump} />)}
        </ol>
      </div>
    </div>
  );
}
