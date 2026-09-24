/**
 * Shortening text for the screen by whole characters (grapheme clusters), never
 * by UTF-16 units: `String.slice` can cut an emoji in half, and the lone surrogate
 * renders as "�" on the server and as a box in the browser, which React reports
 * as a hydration mismatch. Pure: the pages use it, lib/text.test.ts checks it.
 */

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** The characters of a string as the reader sees them: an emoji with its modifiers or a flag is one. */
export const graphemes = (t: string): string[] => (segmenter ? Array.from(segmenter.segment(t), (s) => s.segment) : Array.from(t));

/** At most `max` characters, the last one an ellipsis when the text was cut. */
export function clip(t: string, max: number): string {
  const g = graphemes(t);
  return g.length > max ? `${g.slice(0, max - 1).join("").trimEnd()}…` : t;
}

/** The first `n` characters, with no ellipsis. */
export const head = (t: string, n: number): string => graphemes(t).slice(0, n).join("");
