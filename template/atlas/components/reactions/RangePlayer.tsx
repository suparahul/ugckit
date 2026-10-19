"use client";

/**
 * A post's video played over one range only, in a loop: the reaction as the
 * library entry holds it. The video stays where it is (a /media URL); the page
 * seeks to the start and jumps back at the end. Nothing is cut or copied.
 * `onTime` hands the player's current time to an editor (Set start / Set end).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type RangePlayerHandle = { time: () => number | null };

export const RangePlayer = forwardRef<RangePlayerHandle, { src: string; start: number; end: number; poster?: string | null; autoPlay?: boolean; free?: boolean; label: string; className?: string }>(function RangePlayer({ src, start, end, poster, autoPlay = true, free = false, label, className = "rx-player" }, ref) {
  const v = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({ time: () => (v.current ? Math.round(v.current.currentTime * 100) / 100 : null) }), []);
  useEffect(() => {
    const el = v.current;
    if (el && el.readyState >= 1) el.currentTime = start;
  }, [start, end]);
  return (
    <video
      ref={v}
      className={className}
      /* Only the start in the fragment: with an end, the browser pauses there by itself and the loop stops. */
      src={`${src}#t=${start}`}
      poster={poster ?? undefined}
      muted
      playsInline
      controls
      autoPlay={autoPlay}
      preload="metadata"
      aria-label={label}
      onLoadedMetadata={(e) => { e.currentTarget.currentTime = start; }}
      onTimeUpdate={(e) => {
        /* "free" lets the editor scrub the whole post to find a new range. */
        if (free) return;
        const el = e.currentTarget;
        if (el.currentTime >= end || el.currentTime < start - 0.25) {
          el.currentTime = start;
          if (!el.paused) void el.play().catch(() => undefined);
        }
      }}
      onEnded={(e) => {
        /* A range that runs to the end of the file. */
        if (free) return;
        e.currentTarget.currentTime = start;
        void e.currentTarget.play().catch(() => undefined);
      }}
    >
      Your browser cannot play this mp4. It is at <a href={src}>{src}</a>.
    </video>
  );
});
