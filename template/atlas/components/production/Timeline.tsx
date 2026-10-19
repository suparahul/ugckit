"use client";

/**
 * The timeline (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4.1): a vertical strip from
 * 0 s at the top to the end of the video, one checkpoint per beat of the plan. Each
 * checkpoint says its time range in words, its role and its segment, then what the viewer
 * sees, the on-screen text, the sound and the app, and shows one picture that is already on
 * disk: a still, or a paused frame of a video on disk (the #t= fragment; nothing is
 * extracted). A label in words names each picture. No colour code: the open segment's
 * checkpoints have a plain border, nothing else changes. The same strip at every stage and
 * for every video type. From gate C, one player beside the strip plays the cut, a marker
 * moves down it, and a click on a checkpoint's time jumps there.
 */

import Link from "next/link";
import { useRef, useState } from "react";

import type { Checkpoint, Picture, Timeline as TL } from "@/lib/video-stages";

/* A checkpoint is as tall as its length, and never too short to read. */
const PX_PER_S = 34;
const MIN_PX = 132;

function Pic({ p }: { p: Picture }) {
  const src = p.kind === "video" && p.at !== null ? `${p.url.split("#")[0]}#t=${p.at.toFixed(2)}` : p.url;
  return (
    <figure className="tl__pic">
      {p.kind === "image" ? <img src={src} alt={p.label} loading="lazy" /> : <video src={src} preload="metadata" muted playsInline controls aria-label={p.label} />}
      <figcaption>{p.label}</figcaption>
    </figure>
  );
}

function Point({ c, open, href, onTime }: { c: Checkpoint; open: boolean; href: string | null; onTime: ((t: number) => void) | null }) {
  const dur = Math.max(0, c.end - c.start);
  return (
    <li id={`tl-${c.id}`} className={`tl__cp${open ? " is-open" : ""}`} style={{ minHeight: Math.max(MIN_PX, dur * PX_PER_S) }}>
      <p className="tl__head tabular">
        {onTime ? <button type="button" className="tl__time" onClick={() => onTime(c.start)} title="Play the cut from here">{c.range}</button> : <b>{c.range}</b>}
        {c.role ? <span> · {c.role}</span> : null}
        {c.segment ? <span> · {href ? <Link href={href}>{c.segment}</Link> : c.segment}</span> : null}
      </p>
      <div className="tl__body">
        <div className="tl__picbox">
          {c.picture ? <Pic p={c.picture} /> : <p className="tl__nopic">{c.noPicture}</p>}
          {c.earlier.length ? (
            <details className="tl__earlier">
              <summary>show the {c.earlier.map((e) => e.label.split(",")[0]).join(", ")}</summary>
              {c.earlier.map((e) => <Pic key={`${e.url}${e.at}`} p={e} />)}
            </details>
          ) : null}
        </div>
        <dl className="tl__lines">
          <div><dt>sees</dt><dd>{c.sees}</dd></div>
          <div><dt>text</dt><dd>{c.text.length ? c.text.map((t, i) => <span key={i} className="tl__text">“{t.text}”{t.placement ? ` (${t.placement}, ${t.range})` : ` (${t.range})`}</span>) : "none"}</dd></div>
          <div><dt>sound</dt><dd>{c.sound}</dd></div>
          <div><dt>app</dt><dd>{c.app}</dd></div>
        </dl>
      </div>
    </li>
  );
}

export function Timeline({ tl, openSeg, base, stage }: { tl: TL; openSeg: string | null; base: string; stage: number }) {
  const segHref = (seg: string) => `${base}?stage=${stage}&seg=${seg}#stages`;
  const video = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  if (!tl.checkpoints.length) return <p className="tl__empty">No beats yet: the strip fills when the script is written (plan.draft.json).</p>;
  const jump = tl.player ? (s: number) => { if (video.current) { video.current.currentTime = s; void video.current.play().catch(() => undefined); } } : null;
  /* The marker: the share of the video played, down the strip. */
  const at = tl.length ? Math.min(1, t / tl.length) : 0;
  return (
    <div className={`tl${tl.player ? " has-player" : ""}`}>
      <p className="tl__src">The timeline · {tl.length ? `${tl.length.toFixed(1)} s` : "length unknown"} · from {tl.source ?? "no plan"}</p>
      {tl.player ? (
        <figure className="tl__player">
          <video ref={video} src={tl.player.url} controls playsInline preload="metadata" onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} aria-label={tl.player.label} />
          <figcaption className="tabular">{tl.player.label} · {t.toFixed(1)} s</figcaption>
        </figure>
      ) : null}
      <div className="tl__strip">
        {tl.player ? <span className="tl__marker" style={{ top: `${at * 100}%` }} aria-hidden="true" /> : null}
        <ol className="tl__list">
          {tl.checkpoints.map((c) => <Point key={c.id} c={c} open={!!openSeg && c.segment === openSeg} href={c.segment ? segHref(c.segment) : null} onTime={jump} />)}
        </ol>
      </div>
    </div>
  );
}
