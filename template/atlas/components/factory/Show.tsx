"use client";

/**
 * The slideshow preview: a frame that steps through a post's real slides.
 * Every slide is in the DOM; a click steps, a hover plays, Enter opens the
 * post. One picture is a plain door. `dim` 3:4 sits whole in the 9:16 frame.
 */

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const chev = (d: -1 | 1) => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
    <path d={d < 0 ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Show({ srcs, alt, href, body, bodyHref, scraped = false, kind, dim = "9:16", external = false }: { srcs: string[]; alt: string; href: string; body: ReactNode; bodyHref?: string; scraped?: boolean; kind?: string | null; dim?: "9:16" | "3:4"; external?: boolean }) {
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const one = srcs.length <= 1;
  const go = (k: number) => setI(((k % srcs.length) + srcs.length) % srcs.length);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const play = () => {
    if (one || typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setI((v) => (v + 1) % srcs.length), 900);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  const Body = bodyHref ? "a" : "div";
  const target = external ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <article className={`show${scraped ? " show--scraped" : ""}${one ? " show--one" : ""}${dim === "3:4" ? " show--34" : ""}`} data-n={srcs.length}>
      <div className="show__media" onMouseEnter={play} onMouseLeave={stop}>
        <a className="show__open" href={href} {...target} aria-label={one ? `${alt}: opens the post` : `${alt}: click steps through the slides, Enter opens the post`} onClick={(e) => { if (!one && e.detail) { e.preventDefault(); go(i + 1); } }}>
          {srcs.length ? srcs.map((s, k) => <img key={s} className="show__img" src={s} alt={`${alt}, slide ${k + 1} of ${srcs.length}`} hidden={k !== i} loading="lazy" />) : <span className="frame__empty" aria-hidden="true" />}
          {!one ? (
            <span className="show__dots" aria-hidden="true">
              {srcs.map((_, k) => <i key={k} className={k === i ? "is-on" : undefined} />)}
            </span>
          ) : null}
          {kind ? <span className="show__kind">{kind}</span> : null}
        </a>
        {!one ? (
          <span className="show__steps">
            <button type="button" className="show__step" aria-label="Previous slide" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(i - 1); }}>{chev(-1)}</button>
            <button type="button" className="show__step" aria-label="Next slide" onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(i + 1); }}>{chev(1)}</button>
            <span className="show__count" aria-live="polite">{i + 1} / {srcs.length}</span>
          </span>
        ) : null}
      </div>
      <Body className="show__body" {...(bodyHref ? { href: bodyHref } : {})}>{body}</Body>
    </article>
  );
}
