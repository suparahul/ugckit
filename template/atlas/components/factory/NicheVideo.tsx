"use client";

/**
 * A downloaded niche video. The cover (the poster) shows until play is pressed;
 * the <video> is mounted on that press, so a grid of 24 tiles opens no video
 * connection until the reader asks for one. A second video pauses the first.
 */

import { useEffect, useRef, useState } from "react";

let playing: HTMLVideoElement | null = null;

export function NicheVideo({ src, poster, label, className = "niche-video", children }: { src: string; poster?: string | null; label: string; className?: string; /** Badges laid over the cover. */ children?: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (playing === ref.current) playing = null; }, []);
  return (
    <div className={className}>
      {on ? (
        <video
          ref={ref}
          src={src}
          poster={poster ?? undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
          onPlay={(e) => { if (playing && playing !== e.currentTarget) playing.pause(); playing = e.currentTarget; }}
        >
          Your browser cannot play this mp4. It is at <a href={src}>{src}</a>.
        </video>
      ) : (
        <>
          {poster ? <img src={poster} alt="" loading="lazy" /> : null}
          <button type="button" className="niche-video__play" aria-label={`Play the video: ${label}`} onClick={() => setOn(true)}><span>▶</span></button>
          {children}
        </>
      )}
    </div>
  );
}
