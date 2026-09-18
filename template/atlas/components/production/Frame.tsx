/**
 * A slide frame (3:4 by default, 9:16 when the deck chose it): the one object
 * the pipeline reads at every review point.
 *
 *   sketch    planning mode — hatched, no picture, the on-image text set in its
 *             planned place and relative size, for the deck's rhythm.
 *   replica   produced mode — the current picture, the text laid over it as
 *             HTML in the planned place and size, the product cards in the
 *             lower half. A picture that is missing keeps the text over the
 *             hatch; a picture that needs a new one is dimmed and crossed.
 *
 * The text is HTML positioned from the deck's own words ("top", "lower third",
 * "big with outline"); the TikTok editor's font will differ, and the page says
 * so beside the frame. Nothing here is a render of the exported slide.
 */

import type { CardState, Dimension, Layout, LayoutCard, Slide, SlideState } from "@/lib/production";
import type { CSSProperties } from "react";
import { BIG_FROM, FONT_SIZE_BY, frameOf } from "@/lib/layout";
import { CrossIcon, LockIcon } from "./Marks";

const fileUrl = (rel: string) => `/api/production/file/${rel.split("/").map(encodeURIComponent).join("/")}`;

/**
 * The frame's shape and safe area as CSS variables, from lib/layout.ts
 * frameOf(): the aspect ratio, and where the stacks, the card and the
 * editor's band sit. production.css reads them with 3:4 defaults.
 */
export function frameStyle(dimension: Dimension = "3:4") {
  const f = frameOf(dimension);
  const fs = FONT_SIZE_BY[dimension];
  return {
    aspectRatio: f.css,
    "--safe-top": `${f.safe.top}%`,
    "--safe-bottom": `${100 - f.safe.bottom}%`,
    "--callout-bottom": `${(100 - f.calloutStackBottom).toFixed(2)}%`,
    "--fs-big": `${fs.big}cqw`,
    "--fs-medium": `${fs.medium}cqw`,
    "--fs-small": `${fs.small}cqw`,
  } as CSSProperties;
}

function Stacks({ slide, sketch }: { slide: Slide; sketch?: boolean }) {
  const groups: Record<"top" | "middle" | "bottom", Slide["blocks"]> = { top: [], middle: [], bottom: [] };
  for (const b of slide.blocks) groups[b.place === "flow" ? "top" : b.place].push(b);
  const isLeft = (t: string) => /^[•\-–]/m.test(t) || /\n[•\-–]/.test(t);
  return (
    <>
      {(["top", "middle", "bottom"] as const).map((place) =>
        groups[place].length ? (
          <div key={place} className={`frame__stack frame__stack--${place}`}>
            {groups[place].map((b) => {
              const i = slide.blocks.indexOf(b);
              return (
                <p key={i} data-block={i} className={`frame__t is-${b.size}${b.box ? " is-box" : ""}${isLeft(b.text) && !b.box ? " is-left" : ""}`} aria-label={sketch ? undefined : `${b.label}: ${b.text}`}>
                  {b.text}
                </p>
              );
            })}
          </div>
        ) : null,
      )}
    </>
  );
}

/** The class and inline style of one hand-placed block; shared by the replica and the editor. */
export function freeBlockProps(b: Layout["blocks"][number]) {
  return {
    className: `frame__t is-free${b.fs >= BIG_FROM ? " is-big" : ""}${b.box ? " is-box" : ""}${b.align === "left" && !b.box ? " is-left" : ""}`,
    style: { left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, fontSize: `${b.fs}cqw` } as const,
  };
}

/** The inline style of the hand-placed card; shared by the replica and the editor. The height follows the card's 139:34 ratio. */
export function freeCardStyle(c: LayoutCard) {
  return { left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%` } as const;
}

/** The blocks as Rahul locked them, each at its own place. */
function FreeBlocks({ layout }: { layout: Layout }) {
  return (
    <>
      {layout.blocks.map((b, i) => (
        <p key={i} data-block={i} {...freeBlockProps(b)}>{b.text}</p>
      ))}
    </>
  );
}

export function Sketch({ slide, total, dimension = "3:4" }: { slide: Slide; total?: number; dimension?: Dimension }) {
  const hasCards = slide.cards.length > 0;
  return (
    <div className={`frame is-sketch${hasCards ? " has-cards" : ""}`} style={frameStyle(dimension)} aria-label={`Sketch of slide ${slide.n}: text placement only`} role="img">
      <Stacks slide={slide} sketch />
      {total ? <span className="frame__no tabular" aria-hidden="true">{slide.n} / {total}</span> : null}
      {hasCards ? (
        <div className="frame__cards" aria-hidden="true">
          {slide.cards.map((_, i) => (
            <div key={i} className="frame__card is-empty">{i === 0 ? "product callout · App Store image" : "product callout · in-app image"}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Replica({
  slide,
  state,
  cards,
  total,
  text = "on",
  layout = null,
  dimension = "3:4",
}: {
  slide: Slide;
  state: SlideState;
  cards: CardState[];
  total: number;
  /** on: the text as it will be burned in. ghost: 30%. off: hidden. */
  text?: "on" | "ghost" | "off";
  /** A saved layout (a `slide.layout` line) draws the blocks where Rahul put them; null draws the deck's default stacks. */
  layout?: Layout | null;
  /** The post's slide dimension: the frame's shape and its safe area. */
  dimension?: Dimension;
}) {
  const hasCards = slide.cards.length > 0;
  const cls = ["frame"];
  if (text === "ghost") cls.push("is-ghost");
  if (text === "off") cls.push("is-textless");
  if (!state.current) cls.push("is-empty");
  if (state.status === "needsnew") cls.push("is-rejected");
  if (hasCards) cls.push("has-cards");
  return (
    <div className={cls.join(" ")} style={frameStyle(dimension)}>
      {state.current ? (
        <img className="frame__img" src={fileUrl(state.current)} alt={`Slide ${slide.n} picture: ${slide.prompt ?? ""}`} />
      ) : (
        <div className="frame__empty" aria-hidden="true" />
      )}
      {layout ? <FreeBlocks layout={layout} /> : <Stacks slide={slide} />}
      {layout ? <span className="frame__lock" role="img" aria-label="saved layout" title="saved layout"><LockIcon /></span> : null}
      {hasCards && layout?.card && (state.cardFile ?? cards.find((k) => k.index === 1)?.file) ? (
        /* The card where Rahul locked it, with the post's own strings when the layout carries them. */
        <div className="frame__card is-free" data-card="" style={freeCardStyle(layout.card)}>
          <img src={fileUrl(state.cardFile ?? cards.find((k) => k.index === 1)!.file!)} alt={`Product callout image 1: ${slide.cards[0]}${state.cardFile ? " (this post's own words)" : ""}`} />
        </div>
      ) : hasCards ? (
        <div className="frame__cards">
          {slide.cards.map((c, i) => {
            const held = cards.find((k) => k.index === i + 1)?.file ?? null;
            return held ? (
              <div key={i} className="frame__card" data-card={i === 0 ? "" : undefined}>
                <img src={fileUrl(held)} alt={`Product callout image ${i + 1}: ${c}`} />
              </div>
            ) : (
              <div key={i} className="frame__card is-empty">
                {i === 0 ? "product callout · App Store image · not made yet" : "product callout · in-app image · not made yet"}
              </div>
            );
          })}
        </div>
      ) : null}
      {state.status === "needsnew" ? (
        <span className="frame__x" role="img" aria-label="needs a new picture"><CrossIcon /></span>
      ) : null}
      <span className="frame__no tabular" aria-hidden="true">{slide.n} / {total}</span>
    </div>
  );
}

export { fileUrl };
