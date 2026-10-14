/**
 * The camera cover: slide 1 drawn as a phone camera screen. A slide carries it with a
 * `**Cover style:** camera` line in the deck (`camera, no zoom` leaves out the zoom
 * buttons). Over the picture, in code and never by the image model:
 *
 *   the grid    the camera's 3x3 grid, thin white lines at 1/3 and 2/3 of each side
 *   the zoom    the camera's ".5  1x  2" buttons, "1x" active in the camera's yellow
 *   the hook    the slide's big block, lowercase, pale yellow, no outline and no box, one
 *               or two words a line as the deck breaks it, the lines staggered (right,
 *               middle, left, right) over the middle of the frame; the slide's other
 *               blocks as small lines under it (a bracketed part of the hook)
 *
 * One layout for the compositor (scripts/render-slides.mjs) and the post page's frame
 * (components/production/Frame.tsx), so the preview matches the burned slide. Positions
 * are in % of the frame, sizes in cqw (% of the frame width).
 */

import { isScreenBlock } from "./callout.ts";

export const CAMERA = {
  font: "TikTok Sans",
  fontFile: "public/fonts/TikTokSans36pt-SemiBold.ttf",
  fontWeb: "/fonts/TikTokSans36pt-SemiBold.woff2",
  weight: 600,
  ink: "#F4EEAC",
  zoomInk: "#FFD60A",
  grid: { opacity: 0.55, width: 0.19 },
  big: 12,
  small: 5.4,
  lineHeight: 1.05,
  /* The width of a line, as a share of the size per character (TikTok Sans SemiBold, lowercase, measured 0.455; kept wide). */
  charWidth: 0.48,
  /* Each big line's centre, in % of the width from the middle: right, middle, left, right. */
  stagger: [10, -2, -12, 10],
  smallShift: 8,
  /* The stack is centred on this height, in % of the frame. */
  centre: 50,
  margin: 4,
  zoom: { top: 90, d: 6.4, active: 7.2, gap: 2.4, fs: 2.4 },
} as const;

export type CameraCover = { style: "camera"; zoom: boolean };

export type CameraLine = { text: string; big: boolean; size: number; cx: number; top: number; width: number };

/** The `**Cover style:**` line's value, or null when it names no style this module draws. */
export function parseCoverStyle(text: string | null | undefined): CameraCover | null {
  if (!text || !/^\s*camera\b/i.test(text)) return null;
  return { style: "camera", zoom: !/\bno zoom\b/i.test(text) };
}

const estWidth = (text: string, size: number) => text.length * CAMERA.charWidth * size;

/**
 * The hook's lines, laid out: each with its size (cqw), its centre (% of the width), its
 * top (% of the height) and its estimated width (% of the width). `big` is the big block's
 * text, `small` the small lines under it; `aspect` is the frame's width over its height.
 */
export function cameraLines(big: string, small: string, aspect: number): CameraLine[] {
  const split = (t: string) => t.split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean);
  const bigLines = split(big), smallLines = split(small);
  const room = 100 - 2 * CAMERA.margin;
  const fit = (lines: string[], max: number) => Math.min(max, ...lines.map((l) => room / (l.length * CAMERA.charWidth)));
  const bs = bigLines.length ? fit(bigLines, CAMERA.big) : CAMERA.big;
  const ss = smallLines.length ? fit(smallLines, CAMERA.small) : CAMERA.small;
  const place = (text: string, size: number, shift: number) => {
    const width = estWidth(text, size);
    const half = width / 2;
    const cx = Math.min(100 - CAMERA.margin - half, Math.max(CAMERA.margin + half, 50 + shift));
    return { cx, width };
  };
  const out: CameraLine[] = [];
  /* Heights in % of the frame height: a cqw size times the aspect. */
  const bh = bs * CAMERA.lineHeight * aspect, sh = ss * CAMERA.lineHeight * aspect, gap = bigLines.length && smallLines.length ? 0.25 * bs * aspect : 0;
  const total = bigLines.length * bh + gap + smallLines.length * sh;
  let y = CAMERA.centre - total / 2;
  bigLines.forEach((text, i) => {
    out.push({ text, big: true, size: bs, top: y, ...place(text, bs, CAMERA.stagger[i % CAMERA.stagger.length]) });
    y += bh;
  });
  y += gap;
  for (const text of smallLines) {
    out.push({ text, big: false, size: ss, top: y, ...place(text, ss, CAMERA.smallShift) });
    y += sh;
  }
  return out;
}

/** The zoom buttons: three circles side by side, centred, the middle one ("1x") active and a little bigger. */
export function cameraZoom() {
  const z = CAMERA.zoom;
  const ds = [z.d, z.active, z.d];
  const total = ds.reduce((a, b) => a + b, 0) + 2 * z.gap;
  let x = 50 - total / 2;
  return [".5", "1x", "2"].map((label, i) => {
    const b = { label, active: i === 1, left: x, d: ds[i] };
    x += ds[i] + z.gap;
    return b;
  });
}

/** The big block and the small lines of a camera cover slide: the first block that names "big" (else the first block) is the hook. */
export function cameraTexts<B extends { text: string; size?: string; label?: string }>(blocks: B[]): { big: string; small: string } {
  const shown = blocks.filter((b) => !isScreenBlock(b.label ?? ""));
  const hook = shown.find((b) => b.size === "big") ?? shown[0];
  return { big: hook?.text ?? "", small: shown.filter((b) => b !== hook).map((b) => b.text).join("\n") };
}
