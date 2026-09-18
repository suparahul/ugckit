"use client";

/**
 * One tile in the media-first explorer grid.
 *
 * RAHUL'S INSTRUCTION, 2026-09-10: "the explore tab of the atlas does not need
 * the grid cards to be so texty. Make it a grid of content that I can play
 * right here (videos play inline and carousel slides available inline). The
 * text can be kept hidden for reveal where we can expand that card to take up
 * more columns and rows to reveal the information."
 *
 * So the collapsed tile is the media and almost nothing else: the cover frame
 * at full tile size, with the handle and the view count on a quiet bar at the
 * bottom. Every other fact — the bio, the verdict, the basis, the caption, the
 * transcript — is still rendered, by the server, into `children`, and it is
 * hidden until the tile is expanded.
 *
 * RAHUL, LATER THE SAME DAY: "the explorer expansion should happen to 3
 * columns with the post retaining its width and height". So expanding widens
 * the tile to three columns of the same grid and nothing else: the media keeps
 * the exact width and the exact height it has when the tile is collapsed, it
 * stays in the same column and the same row, and the two columns of new width
 * carry the text beside it. The media is never scaled, letterboxed or
 * re-cropped, and the tile stays one row tall.
 *
 * HOW THE MEDIA IS HELD STILL. The tile measures the grid before it opens: the
 * used column widths, the used row heights and the gap all come from the
 * container's computed style, so the tile learns which column and which row it
 * is in. It then pins itself to that row and to a run of three columns, and its
 * own inner grid gives the media a column of exactly the collapsed width
 * (the track, less the tile's two border pixels). The panel takes the rest.
 *
 * THE LAST TWO COLUMNS OF A ROW. Three columns do not fit to the right there,
 * so the tile grows to the LEFT instead and the panel opens on the left of the
 * media. The media still does not move. This is why the tile pins its row as
 * well as its columns: an item with a definite row and column is placed before
 * the auto-placed tiles, so the neighbours that were on its left move aside
 * rather than pushing it down a row.
 *
 * FEWER THAN THREE COLUMNS. The tile takes what the grid has. With two columns
 * it opens across both, with the panel on whichever side the media is not. With
 * one column there is no width to open into, so the panel stacks under the
 * media instead, and only there does the tile become taller than one row.
 *
 * WHY THE TEXT IS A CHILD AND NOT A PROP. It is built on the server out of the
 * same row every other screen reads, with the same words. Passing it as
 * rendered children means this component never re-states a verdict, and the
 * server keeps owning what a post says.
 *
 * -------------------------------------------------------------- performance
 *
 * A page of 48 tiles that each mounted a <video> would open 48 connections and
 * decode 48 first frames before the reader had asked for anything. Four
 * decisions avoid that, in order of how much they save:
 *
 *   1. NO <video> EXISTS UNTIL PLAY IS PRESSED. A collapsed video tile is an
 *      <img> of the cover and a play button. The video element is mounted on
 *      the first press, with `autoPlay`, so the press that mounts it is also
 *      the press that starts it. A page that is only scrolled therefore costs
 *      exactly what the old grid of cover thumbnails cost.
 *   2. ONE VIDEO PLAYS AT A TIME. A module-level registry holds the element
 *      that is playing; starting another pauses it. Two videos talking over
 *      each other is not something anybody wants in a room, and it also halves
 *      the decode load whenever a reader moves down the grid.
 *   3. A VIDEO THAT SCROLLS OUT OF VIEW PAUSES ITSELF. An IntersectionObserver
 *      pauses a playing tile once it is fully out of the viewport. The element
 *      stays mounted and keeps its position, so scrolling back and pressing
 *      play resumes rather than restarts.
 *   4. ONE <img> PER CAROUSEL, NOT ONE PER SLIDE. Stepping changes the `src`
 *      of a single element, so a 20-slide carousel costs one image until the
 *      reader steps through it. Slides are `loading="lazy"` and decoded async.
 *
 * The tile is keyboard-operable and screen-reader-legible: the bar is a real
 * <button> carrying aria-expanded, the play control is a real <button>, the
 * slide steppers are real <button>s with an aria-live counter, and Escape
 * collapses an expanded tile.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** The element that is currently playing, across every tile on the page. */
let nowPlaying: HTMLVideoElement | null = null;

function playExclusively(el: HTMLVideoElement) {
  if (nowPlaying && nowPlaying !== el) {
    try { nowPlaying.pause(); } catch { /* already gone from the DOM */ }
  }
  nowPlaying = el;
}

/**
 * Where an open tile pins itself in the grid.
 *
 * `row` and `start` are grid line numbers, `k` is how many columns it takes
 * (three, or all the grid has if it has fewer), and `mediaSub` is 1 when the
 * media keeps the leftmost of those columns and `k` when the tile had to grow
 * to the left instead.
 */
type Placement = { row: number; start: number; k: number; mediaSub: number };

/** The line numbers where each track of a used track list starts. */
function trackStarts(tracks: number[], gap: number): number[] {
  const out: number[] = [];
  let at = 0;
  for (const t of tracks) {
    out.push(at);
    at += t + gap;
  }
  return out;
}

/** The 1-based track whose start is nearest to `v`. */
function nearestTrack(starts: number[], v: number): number {
  let best = 0;
  for (let i = 1; i < starts.length; i += 1) {
    if (Math.abs(starts[i] - v) < Math.abs(starts[best] - v)) best = i;
  }
  return best + 1;
}

/** A used track list from computed style, e.g. "230px 230px 230px". */
function usedTracks(value: string): number[] {
  return value.split(" ").map(parseFloat).filter((n) => !Number.isNaN(n));
}

export type TileMedia = {
  /** The mp4 on disk, served by app/media/[...path]. Null when there is none. */
  video: string | null;
  /** The carousel's slides on disk, in order. Empty when there are none. */
  slides: string[];
  /** The cover frame. It is not media — it is the poster and the fallback. */
  cover: string | null;
};

export default function PostTile({
  handle,
  views,
  accent,
  media,
  mediaType,
  detailHref,
  tikTokUrl,
  recovered,
  children,
}: {
  handle: string;
  /** Already formatted, e.g. "1.5M". The tile never does arithmetic. */
  views: string;
  accent: string;
  media: TileMedia;
  /** "video", "carousel" or "unknown" — what the post is, decided server-side. */
  mediaType: string;
  detailHref: string;
  tikTokUrl: string;
  /** One of the posts no scrape contains. It is marked, never disguised. */
  recovered: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<Placement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [slide, setSlide] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLLIElement>(null);
  const panelId = useId();

  const hasVideo = Boolean(media.video);
  const hasSlides = media.slides.length > 0;

  /* Mounting the element and starting it are the same event, so the first
     press does not cost the reader a second one. */
  const onPlay = useCallback(() => {
    setPlaying(true);
    const el = videoRef.current;
    if (el) {
      playExclusively(el);
      void el.play().catch(() => { /* the reader can press the native control */ });
    }
  }, []);

  /* Once mounted, start it and claim the single playing slot. */
  useEffect(() => {
    if (!playing) return;
    const el = videoRef.current;
    if (!el) return;
    playExclusively(el);
    void el.play().catch(() => { /* autoplay refused; the controls are there */ });
  }, [playing]);

  /* Out of sight, out of decode. The element stays mounted and keeps its
     position, so coming back and pressing play resumes where it stopped. */
  useEffect(() => {
    if (!playing) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [playing]);

  /* Read the grid the tile is sitting in, and work out where an open tile has
     to be pinned so that the media does not move by a pixel. */
  const measure = useCallback((): Placement | null => {
    const li = rootRef.current;
    const grid = li?.parentElement;
    if (!li || !grid) return null;
    const cs = getComputedStyle(grid);
    const cols = usedTracks(cs.gridTemplateColumns);
    const rows = usedTracks(cs.gridTemplateRows);
    if (cols.length === 0 || rows.length === 0) return null;

    /* Offsets are taken from the grid's content box, which is where its tracks
       start, so a padded or bordered container cannot skew the arithmetic. */
    const gridBox = grid.getBoundingClientRect();
    const liBox = li.getBoundingClientRect();
    const x = liBox.left - (gridBox.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft));
    const y = liBox.top - (gridBox.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop));

    const column = nearestTrack(trackStarts(cols, parseFloat(cs.columnGap) || 0), x);
    const row = nearestTrack(trackStarts(rows, parseFloat(cs.rowGap) || 0), y);

    /* Three columns to the right where they fit, three to the LEFT where they
       do not, and fewer than three only when the grid itself has fewer. The
       media therefore keeps the column it is already in, at one end of the run
       or the other, and never lands in the middle of it. */
    let k = Math.min(3, cols.length);
    let start = column;
    if (column + k - 1 > cols.length) {
      start = column - k + 1;
      if (start < 1) {
        /* Not enough room on either side for three: take what is to the left. */
        k = column;
        start = 1;
      }
    }
    return { row, start, k, mediaSub: column - start + 1 };
  }, []);

  /* The measurement is taken after the tile has been marked open but before the
     browser paints, so the reader never sees an unplaced frame. Opening does not
     change the tile's left edge or its top edge, so measuring here reads the
     same numbers the collapsed tile had. */
  useLayoutEffect(() => {
    if (!open || place) return;
    setPlace(measure());
  }, [open, place, measure]);

  /* A resized window is a different grid: different column count, different
     track width. Dropping the placement makes the effect above measure again. */
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPlace(null));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setPlace(null);
  }, []);

  /* Escape collapses, which is what every reader tries first. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const step = (by: number) => {
    setSlide((i) => (i + by + media.slides.length) % media.slides.length);
  };

  return (
    <li
      ref={rootRef}
      className={`tile${open ? " is-open" : ""}${recovered ? " tile--recovered" : ""}`}
      /* `sub` is how many columns the open tile takes, `side` is where the text
         goes. Both are absent while the tile is collapsed, and absent for the
         one frame before the measurement lands. */
      data-sub={open && place ? place.k : undefined}
      data-side={open && place ? (place.mediaSub === 1 ? "right" : "left") : undefined}
      style={
        open && place
          ? {
              ["--accent" as string]: accent,
              gridColumn: `${place.start} / span ${place.k}`,
              gridRow: `${place.row}`,
            }
          : { ["--accent" as string]: accent }
      }
    >
      <div className="tile__media">
        {hasVideo && playing ? (
          <video
            ref={videoRef}
            className="tile__video"
            src={media.video ?? undefined}
            poster={media.cover ?? undefined}
            controls
            playsInline
            /* Nothing is fetched before the press that mounts this element. */
            preload="none"
            onPlay={(e) => playExclusively(e.currentTarget)}
          />
        ) : hasSlides ? (
          <>
            {/* One element for the whole carousel; stepping swaps its src. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tile__img"
              src={media.slides[slide]}
              alt={`Slide ${slide + 1} of ${media.slides.length}, posted by @${handle}`}
              loading="lazy"
              decoding="async"
            />
            {media.slides.length > 1 && (
              <div className="tile__steps">
                <button type="button" className="tile__step" onClick={() => step(-1)} aria-label="Previous slide">
                  ‹
                </button>
                <span className="tile__count" aria-live="polite">
                  {slide + 1}/{media.slides.length}
                </span>
                <button type="button" className="tile__step" onClick={() => step(1)} aria-label="Next slide">
                  ›
                </button>
              </div>
            )}
          </>
        ) : media.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="tile__img"
            src={media.cover}
            alt={`Cover of the post by @${handle}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          /* TAB TWO, AND NO COVER EITHER. There is nothing to show, so the tile
             says what it is rather than drawing an empty grey box: the handle
             set large, and the two words that explain the hole. */
          <div className="tile__blank">
            <span className="tile__blankhandle">@{handle}</span>
            <span className="tile__blanknote">{recovered ? "in no scrape" : "no cover on disk"}</span>
          </div>
        )}

        {hasVideo && !playing && (
          <button type="button" className="tile__play" onClick={onPlay} aria-label={`Play the video by @${handle}`}>
            <span aria-hidden="true">▶</span>
          </button>
        )}

        {/* One quiet mark, top left, saying what this tile is. Nothing else. */}
        {mediaType !== "unknown" && (
          <span className="tile__kind">{mediaType === "carousel" ? "carousel" : "video"}</span>
        )}
      </div>

      {/* The whole bar is the expand control: a real button, so Tab reaches it
          and Enter works, and it never competes with the play or step buttons
          above it for the same click. */}
      <button
        type="button"
        className="tile__bar"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="tile__handle">@{handle}</span>
        <span className="tile__views tabular">{views}</span>
        <span className="tile__chev" aria-hidden="true">
          {open ? "×" : "+"}
        </span>
      </button>

      {/* Rendered on the server, hidden until the tile is expanded. */}
      {/* The inner wrapper is taken out of flow when the panel sits beside the
          media, so the text can never lengthen the tile: the tile's height is
          the media plus the bar, exactly as it is when collapsed, and the text
          scrolls inside that height instead. */}
      <div className="tile__panel" id={panelId} hidden={!open}>
        <div className="tile__panelinner">
          <div className="tile__panelscroll">{children}</div>
          <p className="tile__panelfoot">
            <a href={detailHref}>Post detail →</a>
            <a href={tikTokUrl} target="_blank" rel="noreferrer">
              Open on TikTok ↗
            </a>
          </p>
        </div>
      </div>
    </li>
  );
}
