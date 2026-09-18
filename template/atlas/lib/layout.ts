/**
 * The hand-placed text layout of one slide. No node imports: the replica, the
 * editor (client), the state machine (server) and scripts/render-slides.mjs
 * all read this one model.
 */

import type { Block } from "./production.ts";

/**
 * One text block placed by hand: where it sits, how wide it is, how big the
 * type is, and the words. x, y and w are percentages of the frame (x, w of the
 * width; y of the height); fs is the font size as a percentage of the frame
 * width (the replica's cqw), so the same numbers draw the 300px replica and
 * the 1080px final. A `slide.layout` line carries one Layout as JSON in
 * data.layout; the last such line per slide is the locked layout, until a
 * `slide.unlock` line after it.
 */
export type LayoutBlock = { x: number; y: number; w: number; fs: number; text: string; align: "left" | "center"; box: boolean };
/**
 * The product callout card placed by hand: x, y, w in % of the frame (the
 * height follows the card's 139:34 ratio), and, when Rahul rewrote them, the
 * card's own three strings. Without the strings the default card is drawn.
 */
export type LayoutCard = { x: number; y: number; w: number; name?: string; subtitle?: string; button?: string };
export type Layout = { blocks: LayoutBlock[]; card?: LayoutCard | null };
export type CardText = { name: string; subtitle: string; button: string };

/** The card's own strings when the layout carries them (all three), else null: the default card. */
export function cardTextOf(card: LayoutCard | null | undefined): CardText | null {
  if (!card || typeof card.name !== "string" || typeof card.subtitle !== "string" || typeof card.button !== "string") return null;
  return { name: card.name, subtitle: card.subtitle, button: card.button };
}

/**
 * The slide dimension, a per-post parameter chosen before any picture is made
 * (the "Dimension" row of the deck's item table; 3:4 when the row is absent).
 */
export type Dimension = "9:16" | "3:4";
export const DIMENSIONS: Dimension[] = ["9:16", "3:4"];
export const parseDimension = (raw: unknown): Dimension => (raw === "9:16" ? "9:16" : "3:4");

/** The product callout card: 80% of the frame width, 834 × 204 (139:34). */
export const CARD = { w: 80, ratio: 34 / 139 };

/**
 * Everything the replica, the editor and the compositor need to draw one
 * frame of a dimension. Vertical numbers are % of the frame height; cqw
 * values (font sizes, the 3cqw stack gap) are % of the width, so they convert
 * through the aspect ratio.
 *
 * The safe area: on 9:16 TikTok's caption and its button column cover the
 * bottom of the picture and the tabs sit over the top, so no text block and
 * no card goes under 82% or above 8%. On 3:4 the picture is letterboxed and
 * the caption sits below it, so the margins are a small 4% at each end.
 */
export type Frame = {
  dimension: Dimension;
  /** The output canvas, and the replica's aspect-ratio. */
  w: number; h: number; css: string;
  safe: { top: number; bottom: number };
  /** The card's height in % of the frame height. */
  cardH: number;
  /** The gap between stacked blocks, 3cqw, in % of the frame height. */
  stackGap: number;
  /** Where the bottom stack ends on a callout slide: one gap above the card. */
  calloutStackBottom: number;
};
const SAFE_BY: Record<Dimension, { top: number; bottom: number }> = { "9:16": { top: 8, bottom: 82 }, "3:4": { top: 4, bottom: 96 } };
const SIZE_BY: Record<Dimension, [number, number]> = { "9:16": [1080, 1920], "3:4": [1080, 1440] };
export function frameOf(dimension: Dimension = "3:4"): Frame {
  const [w, h] = SIZE_BY[dimension];
  const safe = SAFE_BY[dimension];
  const cardH = (CARD.w * CARD.ratio * w) / h;
  const stackGap = (3 * w) / h;
  return { dimension, w, h, css: dimension === "3:4" ? "3 / 4" : "9 / 16", safe, cardH, stackGap, calloutStackBottom: safe.bottom - cardH - stackGap };
}
/** The 3:4 frame's numbers, for callers that predate the parameter. */
export const SAFE = frameOf("3:4").safe;
export const CARD_H = frameOf("3:4").cardH;
export const STACK_GAP = frameOf("3:4").stackGap;
export const CALLOUT_STACK_BOTTOM = frameOf("3:4").calloutStackBottom;

/** The replica's default font sizes, in cqw, by the deck's size word and the
 * post's dimension. TikTok fits both shapes to the phone's width, so one cqw is
 * the same physical size on either. The 9:16 row is the original default (the
 * 2026-09-16 finals are drawn from it plus Rahul's hand-set layouts). The 3:4
 * row is what Rahul locked by hand on the 2026-09-16 posts, measured from
 * production/log.jsonl and the finals on 2026-09-17: headlines 4.7–5.6 (5.1 on
 * most slides), lines 3.9–4.7 (4.3 on most), so the day-2 defaults start where
 * day 1 ended. */
export const FONT_SIZE_BY: Record<Dimension, Record<Block["size"], number>> = {
  "9:16": { big: 7.4, medium: 5.6, small: 3.9 },
  "3:4": { big: 7.4, medium: 5.1, small: 4.3 },
};
/** The 3:4 sizes, for callers that predate the parameter. */
export const FONT_SIZE: Record<Block["size"], number> = FONT_SIZE_BY["3:4"];
export const BOX_FONT_SIZE = 3.7;
/** A hand-placed block at or above this size (cqw) is drawn in the hook style: heavier weight, solid outline. */
export const BIG_FROM = 6.5;

export function parseLayout(raw: unknown): Layout | null {
  if (typeof raw !== "string") return null;
  try {
    const j = JSON.parse(raw) as Layout;
    if (!j || !Array.isArray(j.blocks)) return null;
    const blocks = j.blocks
      .filter((b) => b && typeof b.x === "number" && typeof b.y === "number" && typeof b.w === "number" && typeof b.fs === "number" && typeof b.text === "string")
      .map((b) => ({ x: b.x, y: b.y, w: b.w, fs: b.fs, text: b.text, align: b.align === "left" ? "left" as const : "center" as const, box: !!b.box }));
    const c = j.card;
    let card: LayoutCard | null = null;
    if (c && typeof c.x === "number" && typeof c.y === "number" && typeof c.w === "number") {
      card = { x: c.x, y: c.y, w: c.w };
      const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) : null);
      const name = str(c.name), subtitle = str(c.subtitle), button = str(c.button);
      if (name !== null && subtitle !== null && button !== null) Object.assign(card, { name, subtitle, button });
    }
    return card ? { blocks, card } : { blocks };
  } catch {
    return null;
  }
}
