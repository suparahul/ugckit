"use client";

/**
 * The video, beat by beat (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4.1, redrawn in
 * ATLAS-VIDEO-PAGE-CLEANUP.md § 3): one card per beat of the plan, left to right, 0 s first.
 * Each card shows one picture that is already on disk (a still, or a paused frame of a video
 * on disk; nothing is extracted), the time range, the role in words, and the first sentence
 * of what the viewer sees. The whole description, the on-screen text, the sound, the app,
 * the earlier pictures and the segment open under "more". No colour code: the open segment's
 * cards have a plain border. From gate C the strip follows the player of the stage panel
 * (data-cut-player), or its own when the panel has none: a click on a card's time jumps there.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { roleWord, shortLine } from "@/lib/plain-words";
import type { Checkpoint, Picture, Timeline as TL } from "@/lib/video-stages";

function Pic({ p, small }: { p: Picture; small?: boolean }) {
  const src = p.kind === "video" && p.at !== null ? `${p.url.split("#")[0]}#t=${p.at.toFixed(2)}` : p.url;
  return (
    <figure className={`tl__pic${small ? " is-small" : ""}`}>
      {p.kind === "image" ? <img src={src} alt={p.label} loading="lazy" /> : <video src={src} preload="metadata" muted playsInline controls aria-label={p.label} />}
      <figcaption>{p.label}</figcaption>
    </figure>
  );
}

function Card({ c, open, href, onTime }: { c: Checkpoint; open: boolean; href: string | null; onTime: ((t: number) => void) | null }) {
  const role = roleWord(c.role);
  const sees = c.sees === "not written" ? null : c.sees.replace(/ · framing: \w+$/, "");
  return (
    <li id={`tl-${c.id}`} className={`tl__cp${open ? " is-open" : ""}`}>
      {c.picture ? <Pic p={c.picture} /> : <p className="tl__nopic" title={c.noPicture ?? undefined}>no picture yet</p>}
      <p className="tl__head tabular">
        {onTime ? <button type="button" className="tl__time" onClick={() => onTime(c.start)} title="Play from here">{c.range}</button> : <b>{c.range}</b>}
        {role ? <span className="tl__role"> · {role}</span> : null}
      </p>
      <p className="tl__sees">{sees ? shortLine(sees) : <span className="is-blank">nothing written yet</span>}</p>
      <details className="tl__more">
        <summary>more</summary>
        <dl className="tl__lines">
          {sees ? <div><dt>sees</dt><dd>{sees}</dd></div> : null}
          <div><dt>text</dt><dd>{c.text.length ? c.text.map((t, i) => <span key={i} className="tl__text">“{t.text}”{t.placement ? ` (${t.placement}, ${t.range})` : ` (${t.range})`}</span>) : "none"}</dd></div>
          <div><dt>sound</dt><dd>{c.sound}</dd></div>
          <div><dt>app</dt><dd>{c.app}</dd></div>
          {c.segment ? <div><dt>segment</dt><dd>{href ? <Link href={href}>{c.segment}</Link> : c.segment}</dd></div> : null}
          {!c.picture && c.noPicture ? <div><dt>picture</dt><dd>{c.noPicture}</dd></div> : null}
        </dl>
        {c.earlier.length ? <div className="tl__earlier">{c.earlier.map((e) => <Pic key={`${e.url}${e.at}`} p={e} small />)}</div> : null}
      </details>
    </li>
  );
}

export function Timeline({ tl, openSeg, base, stage }: { tl: TL; openSeg: string | null; base: string; stage: number }) {
  const segHref = (seg: string) => `${base}?stage=${stage}&seg=${seg}#stages`;
  const own = useRef<HTMLVideoElement>(null);
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
  const player = external ?? own.current;
  const jump = tl.player ? (s: number) => { const v = external ?? own.current; if (v) { v.currentTime = s; void v.play().catch(() => undefined); } } : null;
  const at = tl.length ? Math.min(1, t / tl.length) : 0;
  return (
    <div className={`tl${tl.player ? " has-player" : ""}`}>
      {tl.player && !external ? (
        <figure className="tl__player">
          <video ref={own} src={tl.player.url} controls playsInline preload="metadata" onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} aria-label={tl.player.label} />
          <figcaption className="tabular">{tl.player.label} · {t.toFixed(1)} s</figcaption>
        </figure>
      ) : null}
      <div className="tl__strip">
        {tl.player && player && t > 0 ? <span className="tl__marker" style={{ left: `${at * 100}%` }} aria-hidden="true" /> : null}
        <ol className="tl__list">
          {tl.checkpoints.map((c) => <Card key={c.id} c={c} open={!!openSeg && c.segment === openSeg} href={c.segment ? segHref(c.segment) : null} onTime={jump} />)}
        </ol>
      </div>
    </div>
  );
}
