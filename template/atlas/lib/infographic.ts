/**
 * Infographic templates: a post's design as data, drawn the same way everywhere.
 *
 * The art (a character, icons) comes from the generator once and lives in the
 * app's asset library (apps/<slug>/brand/assets/assets.json); the layout and
 * every word live in a spec, files/<post>/compose/slide-NN.json. One pure
 * function turns a spec into an SVG: the post page draws it live while the user
 * moves sliders, and /api/production/compose (or scripts/compose.mjs) renders
 * the same SVG to the slide's PNG, to the Instagram 4:5 picture and to the
 * frames of the video. A change of size, spacing or wording is a new spec,
 * never a new generation.
 *
 * Isomorphic on purpose: no node imports, so the browser and the renderer
 * share it. Only erasable TypeScript, so scripts/*.mjs can import it.
 *
 * Templates:
 *   hub    a signs poster: a title, an optional definition, eight
 *          items in a 3–2–3 grid round a centre picture, a closing bubble.
 *   cube   the milestone chart (formats/cube-chart-video.md): a title, a pill,
 *          twelve pastel cubes in three rows of four, a picture on each.
 *   card   one "reasons why" card: a heading, a body, the
 *          art in the lower half, an optional inset; `cover` drops the card.
 *   page   a storybook slide: one generated
 *          picture filling the frame, an optional paper band over its top, the
 *          heading and lines typeset on it, an optional app screen. The picture is
 *          the post's own render (an asset id `post/<post dir>/slide-NN/<file>`),
 *          so the words, sizes and places are edited like any template.
 *
 * The callout card is not part of the picture: it is placed by the slide's
 * `slide.layout` card, as on any slide (the Instagram picture and the video
 * paste it themselves). Animation (`anim`) and the Instagram 4:5 layout
 * (`variants.instagram`) are part of the spec too.
 */

export type Asset = { id: string; file: string; w: number; h: number; kind?: string; note?: string };
export type Nudge = { dx: number; dy: number; s?: number };
/** The callout's words. kind "phone": a phone showing the app's screen, the name, a line and a store button. */
/** kind "store" (variant 1–3): the app's store listing, as a parent sees it: the title, the tagline, the rating, the App Store and Google Play badges. */
export type Callout = { headline: string; line: string; kind?: "peach" | "phone" | "store"; variant?: number; button?: string; screen?: string };
/** The brand's look (apps/<slug>/brand/style.json, lib/brand.ts): the page, the type, and the callout card's colours. */
export type Style = { bg: string; ink: string; soft: string; accent: string; font: string; bodyFont: string; bubbleFill: string; heart: string; card: string; cream: string; muted: string;
  /** The logo-and-text callout and the light store listings: their fill, outline, bold line and second line; the coloured store listing's gradient. */
  calloutFill: string; calloutLine: string; calloutInk: string; calloutSoft: string; gradFrom: string; gradTo: string };
export type Anim = { kind: "none" | "pop" | "float" | "pop-float" | "drift"; duration: number; stagger: number };
export type Placement = { x: number; y: number; w: number };
/** A second layout of the same design for another platform: its own size, and its own values where they differ. */
export type Variant = { size: [number, number]; params?: Record<string, number | boolean>; nudge?: Record<string, Nudge>; card?: Placement | null };
export type Platform = "tiktok" | "instagram";

type Base = {
  version: 1;
  size: [number, number];
  style: Partial<Style>;
  /** Per element, a hand move in px (and an optional scale), keyed by element id. */
  nudge: Record<string, Nudge>;
  /** Blocks the user deleted, by element id: drawn nowhere (the editor restores them). */
  hidden?: string[];
  anim?: Anim;
  variants?: { instagram?: Variant };
  /** A motion prompt kept with the design, for an agent that animates it with a video model (no tool of the kit spends on it). */
  motion?: string;
};

export type HubItem = { asset: string; label: string[] };
export type HubParams = {
  titleSize: number; titleTop: number; titleLeading: number;
  defSize: number; defGap: number;
  gridGap: number; rowGap: number; colInset: number;
  iconSize: number; labelSize: number; labelGap: number;
  centerSize: number; centerDrop: number;
  bubbleSize: number; bubbleGap: number;
  doodles: boolean;
};
export type HubSpec = Base & {
  template: "hub";
  content: {
    title: string[];
    /** [bold part, rest] per line; empty for none. */
    definition: [string, string][];
    center: string;
    /** Eight items: the top row left to right, the two beside the centre, the bottom row left to right. */
    items: HubItem[];
    bubble: string;
    /** The brand callout's words: drawn to cards/1-custom.png on save. */
    callout?: Callout;
  };
  params: HubParams;
};

/** unit: this cube's own unit line when it differs from the chart's ("month ·" on a 1 among "months ·"). */
export type Cube = { n: string; label: string[]; asset: string; unit?: string };
export type CubeParams = {
  titleSize: number; titleTop: number; titleLeading: number;
  pillSize: number; gridGap: number; margin: number; gap: number;
  cubeHeight: number; depth: number; rowGap: number;
  numberSize: number; unitSize: number; labelSize: number;
  /** size of a cube's single milestone text (a cube with no label lines): wrapped to the cube, the category under it */
  milestoneSize?: number;
  babySize: number; babySink: number;
  /** cubes per row (4 by default); a short last row is centred. Fewer, wider cubes hold more label lines. */
  cols: number;
  /** 1: the unit sits beside the number on one line (a big number, a small "months"), the label lines right under it. */
  unitInline?: number;
  /** spacing of a cube's text lines: number to unit line, as % of the unit size (stacked only; 130) */
  unitGap?: number;
  /** extra px between the number/unit and the first label line (0) */
  labelGap?: number;
  /** line spacing of the label lines, as % of the label size (125) */
  labelLeading?: number;
};
export type CubeSpec = Base & {
  template: "cube";
  /** blocks: optional 3D block art from the asset library, one per column in turn (block-yellow, block-lilac, …);
   *  without it the cubes are drawn flat. */
  /** logo: an asset drawn small and centred above the title. */
  content: { title: string[]; pill: string; unit: string; cubes: Cube[]; blocks?: string[]; logo?: string; callout?: Callout };
  params: CubeParams;
};

export type CardParams = {
  margin: number; pad: number; textTop: number;
  headingSize: number; headingLeading: number; bodySize: number; bodyLeading: number; bodyGap: number;
  artSize: number; artBottom: number; artX: number;
  insetSize: number; footerSize: number;
};
export type CardSpec = Base & {
  template: "card";
  content: { heading: string; body: string; art: string; inset: string; footer: string; cover: boolean; callout?: Callout };
  params: CardParams;
};

export type PageParams = {
  textTop: number; margin: number; headingSize: number; headingLeading: number;
  bodySize: number; bodyLeading: number; bodyGap: number;
  /** The paper band over the picture's top (0: none), its soft lower edge, both in px. */
  band: number; bandFade: number;
  /** The picture: its zoom (1 fills the frame) and its shift in px. */
  artScale: number; artX: number; artY: number;
  /** The app screen: its width and its centre, in % of the frame. */
  screenW: number; screenX: number; screenY: number;
};
export type PageSpec = Base & {
  template: "page";
  /** heading: the bold line(s); body: the smaller lines under it (newlines kept); art: the picture; screen: an app
   *  screenshot drawn as a rounded phone screen with a shadow (empty: none). */
  content: { heading: string; body: string; art: string; screen: string; callout?: Callout };
  params: PageParams;
};

export type WallParams = {
  textTop: number; margin: number; textSize: number; leading: number; firstScale: number; paraGap: number;
  /** 1: centred; 0: left. */ align: number;
  /** The paper panel behind the words (0: none) with its inner margin, and a dimmer over the background (0–80 %). */
  panel: number; panelPad: number; scrim: number;
  /** A paper wash over the whole background (0–100 %), so dark text reads on a busy picture. */
  wash: number;
  /** The background picture: zoom, shift, and how much it zooms in over the video (% at the end; the "drift"). */
  artScale: number; artX: number; artY: number; zoomEnd: number;
  screenW: number; screenX: number; screenY: number;
};
/** A wall of text: every word on screen at once, over one background. */
export type WallSpec = Base & {
  template: "wall";
  /** text: one paragraph per line; the first is the headline. art: the background (empty: plain paper); screen: an app screen. */
  content: { text: string; art: string; screen: string; callout?: Callout;
    /** Two more backgrounds: with a drift animation the three cross-fade, one after the other. */ art2?: string; art3?: string; art4?: string;
    /** A generated background video (a path under the post's files folder, e.g. `bg/story.mp4`): it plays under the words, looped; `art` is its still for the editor. */ video?: string };
  params: WallParams;
};

export type ListParams = {
  margin: number; pad: number; headingTop: number; headingSize: number; headingLeading: number; subSize: number;
  listGap: number; rowGap: number; rowPad: number; titleSize: number; lineSize: number;
  /** 0: numbers, 1: ticks, 2: none. */ badge: number;
  artSize: number; artX: number; artBottom: number; footerSize: number;
};
/** A list card: one card with a heading and a list of items (a checklist, signs, what to expect). */
export type ListSpec = Base & {
  template: "list";
  content: { heading: string; sub: string; items: { title: string; line: string }[]; art: string; screen: string; footer: string; callout?: Callout };
  params: ListParams;
};

export type ClipsParams = {
  margin: number; titleTop: number; titleSize: number; stepSize: number;
  labelSize: number; labelBottom: number; capSize: number; capGap: number; shade: number;
  /** Seconds each clip plays; 0: the whole video. */ secs: number;
  /** 1: the framed look (a coloured page, a name bar, a rounded window round the clip, an intro and an end card); 0: the clip fills the frame. */
  frame: number;
  /** The framed look: the window's top, its height and its side margin; the name bar's top and height; the seconds of the intro and the end card. */
  winTop: number; winH: number; winMargin: number; barTop: number; barH: number; introSecs: number; outroSecs: number;
  /** 1: the intro is a short video, a fast preview of the clips inside the window with the title laid over it (a plain-text intro card is a weak hook); 0: the plain intro card. */
  hook?: number;
  /** The video hook's own design (editable in the studio): title size, how far its last line stands above the window's bottom, the dimmer under it (%), the line under the video. */
  hookTitleSize?: number; hookTitleLift?: number; hookShade?: number; hookLineSize?: number;
};
export type ClipItem = { label: string; caption: string; video: string; thumb: string; start?: number };
/** App clips: a few short videos (the app's own, a demo), each with its name and a line over it. */
export type ClipsSpec = Base & {
  template: "clips";
  /** intro: the first card (a tag over a white card: title, line, bold line); outro: the end card's words (the callout is pasted on it, and only on it). */
  content: { title: string; items: ClipItem[]; callout?: Callout; intro?: { tag: string; title: string; line: string; bold: string; voice?: string; /** A file name in assets/music: an instrumental bed under the hook, faded out as the first clip starts. */ music?: string }; outro?: { title: string; line: string } };
  params: ClipsParams;
};

export type Spec = HubSpec | CubeSpec | CardSpec | PageSpec | WallSpec | ListSpec | ClipsSpec;
export type TemplateName = Spec["template"];

/** One placed element: its box in px, for the editor's hit areas, and its SVG. */
export type Placed = { id: string; label: string; x: number; y: number; w: number; h: number; svg: string;
  /** A picture that floats in the animation (a cube's picture): left out of the text lock. */ moving?: boolean;
  /** Drawn under a moving picture (a cube's top face): left out of the text lock too, so the picture can move over it. */ under?: boolean };
export type Drawn = { width: number; height: number; elements: Placed[]; contentEnd: number; bg: string };

/** The kit's neutral look: warm paper, near-black type, one accent. An app sets its own in apps/<slug>/brand/style.json (lib/brand.ts). */
export const DEFAULT_STYLE: Style = {
  bg: "#F6F1EB", ink: "#1F1B18", soft: "#57504A", accent: "#E07A4F",
  font: "Arial Rounded MT Bold, Arial", bodyFont: "Helvetica Neue, Arial", bubbleFill: "#FFFFFF", heart: "#B9D9A8",
  card: "#EDE4DA", cream: "#FBF8F4", muted: "#6E665F",
  calloutFill: "#F3ECE5", calloutLine: "#DCCFC3", calloutInk: "#1F1B18", calloutSoft: "#5F5650", gradFrom: "#E58A5A", gradTo: "#D46A3B",
};

/* ---------------------------------------------------------------- drawing kit */

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A width estimate for the rounded bold face: close enough for boxes, wrapping and the bubble's width. */
const textW = (t: string, size: number, k = 0.56) => t.length * size * k;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutBack = (x: number) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/** Greedy word wrap on the estimate; an explicit newline always breaks. */
export function wrap(text: string, size: number, width: number, k = 0.56): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (line && textW(t, size, k) > width) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

type Ctx = {
  W: number; H: number; st: Style; t: number | null; anim: Anim | null;
  /** Clips: which clip's captions are drawn (the others are not). */
  focus: number;
  push: (id: string, label: string, x: number, y: number, w: number, h: number, body: string, o?: { float?: boolean; under?: boolean; nudgeAs?: string }) => void;
  text: (x: number, y: number, t: string, size: number, fill: string, anchor?: string, family?: string, weight?: number) => string;
  image: (a: Asset | undefined, cx: number, cy: number, bw: number, bh: number, anchor?: "center" | "bottom") => { svg: string; w: number; h: number; top: number };
  /** An asset stretched to fill a box exactly (a cube's 3D block art). */
  fill: (a: Asset, x: number, y: number, w: number, h: number) => string;
  /** An asset scaled to cover a box, centred and cropped (a full-bleed picture). */
  cover: (a: Asset, x: number, y: number, w: number, h: number) => string;
  assetHref: (a: Asset) => string;
  assets: Record<string, Asset>;
  /** A clip's overlay for the video: no backgrounds, only the words. */
  overlay: boolean;
};

function makeCtx(spec: Spec, assets: Record<string, Asset>, href: (a: Asset) => string, t: number | null, els: Placed[], focus = 0, overlay = false): Ctx {
  const [W, H] = spec.size;
  const st = { ...DEFAULT_STYLE, ...(spec.template === "page" ? PAGE_STYLE : {}), ...spec.style };
  const anim = spec.anim && spec.anim.kind !== "none" && t !== null ? spec.anim : null;
  let order = 0;
  const push: Ctx["push"] = (id, label, x, y, w, h, body, o = {}) => {
    if (spec.hidden?.includes(o.nudgeAs ?? id) || spec.hidden?.includes(id)) return;
    const n = spec.nudge?.[o.nudgeAs ?? id] ?? { dx: 0, dy: 0 }, s = n.s ?? 1;
    const cx = x + w / 2, cy = y + h / 2;
    let tf = `translate(${n.dx} ${n.dy})${s !== 1 ? ` translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})` : ""}`;
    let opacity = 1;
    const k = order++;
    if (anim && t !== null) {
      /* Pop: each element in turn grows in from 80% and fades up; float: the pictures bob gently. */
      if (anim.kind === "pop" || anim.kind === "pop-float") {
        const p = clamp01((t - 0.15 - k * anim.stagger) / 0.45);
        const e = easeOutBack(p), sc = 0.8 + 0.2 * e;
        opacity = p;
        const ax = cx + n.dx, ay = cy + n.dy;
        tf = `translate(${ax} ${ay}) scale(${sc}) translate(${-ax} ${-ay}) ${tf}`;
      }
      if ((anim.kind === "float" || anim.kind === "pop-float") && o.float) {
        const period = anim.duration / Math.max(1, Math.round(anim.duration / 2.5));
        tf = `translate(0 ${(Math.sin((2 * Math.PI * t) / period + k * 0.9) * 7).toFixed(2)}) ${tf}`;
      }
    }
    els.push({ id, label, x: cx - (w * s) / 2 + n.dx, y: cy - (h * s) / 2 + n.dy, w: w * s, h: h * s, svg: `<g transform="${tf}"${opacity < 1 ? ` opacity="${opacity.toFixed(3)}"` : ""}>${body}</g>`, ...(o.float ? { moving: true } : {}), ...(o.under ? { under: true } : {}) });
  };
  const text: Ctx["text"] = (x, y, tx, size, fill, anchor = "middle", family = st.font, weight = 700) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${esc(family)}" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(tx)}</text>`;
  const image: Ctx["image"] = (a, cx, cy, bw, bh, anchor = "center") => {
    if (!a) return { svg: `<rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="18" fill="none" stroke="#c9a" stroke-dasharray="8 6"/>`, w: bw, h: bh, top: cy - bh / 2 };
    const k = Math.min(bw / a.w, bh / a.h), w = a.w * k, h = a.h * k;
    const top = anchor === "bottom" ? cy - h : cy - h / 2;
    return { svg: `<image href="${href(a)}" x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`, w, h, top };
  };
  const fill: Ctx["fill"] = (a, x, y, w, h) => `<image href="${href(a)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
  const cover: Ctx["cover"] = (a, x, y, w, h) => `<image href="${href(a)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
  return { W, H, st, t, anim: spec.anim && spec.anim.kind !== "none" ? spec.anim : null, focus, overlay, push, text, image, fill, cover, assetHref: href, assets };
}

const sparkPath = (x: number, y: number, r: number, fill: string) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="${fill}"/>`;

/* ---------------------------------------------------------------- hub */

export const HUB_DEFAULTS: HubParams = {
  titleSize: 88, titleTop: 160, titleLeading: 96,
  defSize: 32, defGap: 44,
  gridGap: 24, rowGap: 16, colInset: 185,
  iconSize: 160, labelSize: 35, labelGap: 14,
  centerSize: 300, centerDrop: 30,
  bubbleSize: 36, bubbleGap: 16,
  doodles: true,
};

function drawHub(spec: HubSpec, c: Ctx): number {
  const { W, st } = c, p = { ...HUB_DEFAULTS, ...spec.params }, ct = spec.content;
  const titleW = Math.max(...ct.title.map((l) => textW(l, p.titleSize)), 10);
  const titleTop = p.titleTop - p.titleSize * 0.8;
  let tsvg = ct.title.map((l, i) => c.text(W / 2, p.titleTop + i * p.titleLeading, l, p.titleSize, st.ink)).join("");
  if (p.doodles) {
    const L = W / 2 - titleW / 2 - 40, R = W / 2 + titleW / 2 + 40, t0 = p.titleTop - p.titleSize * 0.35;
    tsvg += `<g stroke="${st.accent}" stroke-width="7" stroke-linecap="round"><line x1="${L - 20}" y1="${t0}" x2="${L + 18}" y2="${t0 - 12}"/><line x1="${L - 18}" y1="${t0 + 36}" x2="${L + 20}" y2="${t0 + 36}"/><line x1="${R - 18}" y1="${t0 - 12}" x2="${R + 20}" y2="${t0}"/><line x1="${R - 20}" y1="${t0 + 36}" x2="${R + 18}" y2="${t0 + 36}"/></g>`;
    const ty = p.titleTop + (ct.title.length - 1) * p.titleLeading;
    tsvg += sparkPath(L - 10, ty - p.titleSize * 0.3, 18, st.accent) + sparkPath(R + 12, ty - p.titleSize * 0.2, 14, st.accent) + sparkPath(R + 26, ty - p.titleSize * 0.9, 9, st.accent);
  }
  const titleBottom = p.titleTop + (ct.title.length - 1) * p.titleLeading + p.titleSize * 0.25;
  c.push("title", "Title", W / 2 - titleW / 2 - 70, titleTop, titleW + 140, titleBottom - titleTop, tsvg);
  let y = titleBottom;

  if (ct.definition.length) {
    const lh = p.defSize * 1.32, y0 = y + p.defGap - p.defSize * 0.3;
    const dsvg = ct.definition.map(([b, r], i) =>
      `<text x="${W / 2}" y="${y0 + p.defSize * 0.8 + i * lh}" text-anchor="middle" font-size="${p.defSize}" fill="${st.soft}"><tspan font-family="${esc(st.font)}" font-weight="700" fill="${st.ink}">${esc(b)}</tspan><tspan xml:space="preserve" font-family="${esc(st.bodyFont)}" font-weight="400">${esc(r)}</tspan></text>`).join("");
    const dw = Math.max(...ct.definition.map(([b, r]) => textW(b + r, p.defSize)));
    c.push("def", "Definition", W / 2 - dw / 2, y0, dw, ct.definition.length * lh, dsvg);
    y = y0 + ct.definition.length * lh;
  }

  const iconH = p.iconSize * 0.8;
  const rowH = iconH + p.labelGap + p.labelSize * 1.15 * 2 + 16 + p.rowGap;
  const gridTop = y + p.gridGap;
  const cols = [p.colInset, W / 2, W - p.colInset];
  const cells: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]];
  let gridEnd = gridTop;
  cells.forEach(([r, col], k) => {
    const it = ct.items[k];
    if (!it) return;
    const top = gridTop + r * rowH + (r === 2 && col === 1 ? p.centerDrop : 0), cx = cols[col];
    const im = c.image(c.assets[it.asset], cx, top + iconH / 2, p.iconSize, iconH);
    const ly = top + iconH + p.labelGap;
    let s = im.svg;
    it.label.forEach((l, i) => { s += c.text(cx, ly + p.labelSize * 0.8 + i * p.labelSize * 1.15, l.trim(), p.labelSize, st.ink); });
    const uy = ly + p.labelSize * 0.8 + (it.label.length - 1) * p.labelSize * 1.15 + 20;
    s += `<path d="M${cx - 48} ${uy} Q${cx} ${uy - 6} ${cx + 48} ${uy}" stroke="${st.accent}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    const lw = Math.max(p.iconSize, ...it.label.map((l) => textW(l.trim(), p.labelSize)));
    c.push(`item-${k}`, `Tile ${k + 1}${it.label.length ? ` · ${it.label.join(" ")}` : ""}`, cx - lw / 2, top, lw, uy + 6 - top, s);
    gridEnd = Math.max(gridEnd, uy + 10);
  });

  const band0 = gridTop + iconH + p.labelGap + p.labelSize * 2.3 + 24;
  const band1 = gridTop + 2 * rowH + p.centerDrop - 10;
  const im = c.image(c.assets[ct.center], W / 2, (band0 + band1) / 2, p.centerSize * 1.2, p.centerSize);
  c.push("center", "Centre picture", W / 2 - im.w / 2, (band0 + band1) / 2 - im.h / 2, im.w, im.h, im.svg, { float: true });

  let end = gridEnd;
  if (ct.bubble) {
    const bw = textW(ct.bubble, p.bubbleSize) + 110, bh = p.bubbleSize * 2.4, bx = (W - bw) / 2, by = gridEnd + p.bubbleGap;
    const r = Math.min(30, bh / 2);
    let s = `<path d="M${bx + r} ${by} H${bx + bw - r} Q${bx + bw} ${by} ${bx + bw} ${by + r} V${by + bh - r} Q${bx + bw} ${by + bh} ${bx + bw - r} ${by + bh} H${bx + bw * 0.62} L${bx + bw * 0.6} ${by + bh + 22} L${bx + bw * 0.55} ${by + bh} H${bx + r} Q${bx} ${by + bh} ${bx} ${by + bh - r} V${by + r} Q${bx} ${by} ${bx + r} ${by}Z" fill="${st.bubbleFill}" stroke="${st.ink}" stroke-width="4" stroke-linejoin="round"/>`;
    s += c.text(W / 2, by + bh / 2 + p.bubbleSize * 0.35, ct.bubble, p.bubbleSize, st.ink);
    s += `<path d="M${bx + 4} ${by + 8} c-10 -16 -34 -8 -26 10 c6 12 26 22 26 22 c0 0 20 -10 26 -22 c8 -18 -16 -26 -26 -10z" fill="${st.heart}" stroke="${st.ink}" stroke-width="3"/>`;
    c.push("bubble", "Bubble", bx - 30, by - 20, bw + 30, bh + 44, s);
    end = by + bh + 22;
  }
  return end;
}

/* ---------------------------------------------------------------- cube */

export const CUBE_DEFAULTS: CubeParams = {
  titleSize: 72, titleTop: 150, titleLeading: 80,
  pillSize: 32, gridGap: 200, margin: 44, gap: 20,
  cubeHeight: 200, depth: 34, rowGap: 150,
  numberSize: 66, unitSize: 26, labelSize: 28,
  babySize: 190, babySink: 16, cols: 4,
  unitGap: 130, labelGap: 0, labelLeading: 125,
};
const CUBE_COLORS = ["#FFE7A3", "#E4D6F6", "#CDEBDC", "#D2E5F7"];
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

function drawCube(spec: CubeSpec, c: Ctx): number {
  const { W, st } = c, p = { ...CUBE_DEFAULTS, ...spec.params }, ct = spec.content;
  const titleW = Math.max(...ct.title.map((l) => textW(l, p.titleSize)), 10);
  let s = ct.title.map((l, i) => c.text(W / 2, p.titleTop + i * p.titleLeading, l, p.titleSize, st.ink)).join("");
  if (ct.logo && c.assets[ct.logo]) {
    const lh = p.titleSize * 0.62, lg = c.image(c.assets[ct.logo], W / 2, p.titleTop - p.titleSize * 1.05 - lh / 2, W * 0.4, lh);
    c.push("logo", "Logo", W / 2 - lg.w / 2, lg.top, lg.w, lg.h, lg.svg);
  }
  const ty = p.titleTop + (ct.title.length - 1) * p.titleLeading;
  let bottom = ty + p.titleSize * 0.25;
  if (ct.pill) {
    const pw = textW(ct.pill, p.pillSize) + 64, ph = p.pillSize * 1.7, py = ty + p.titleSize * 0.45;
    s += `<rect x="${W / 2 - pw / 2}" y="${py}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${st.card}"/>` + c.text(W / 2, py + ph / 2 + p.pillSize * 0.36, ct.pill, p.pillSize, st.ink);
    bottom = py + ph;
  }
  c.push("title", "Title", W / 2 - titleW / 2 - 20, p.titleTop - p.titleSize * 0.85, titleW + 40, bottom - (p.titleTop - p.titleSize * 0.85), s);

  const cols = Math.max(1, Math.round(p.cols || 4)), n = Math.min(ct.cubes.length, 12);
  const cw = (W - 2 * p.margin - (cols - 1) * p.gap - p.depth * 0.6) / cols, fh = p.cubeHeight, d = p.depth, dx = d * 0.6;
  const rowH = d + fh + p.rowGap;
  const top0 = bottom + p.gridGap;
  let end = top0;
  ct.cubes.slice(0, 12).forEach((cube, k) => {
    const r = Math.floor(k / cols), col = k % cols, inRow = Math.min(cols, n - r * cols);
    const x = p.margin + (cols - inRow) * (cw + p.gap) / 2 + col * (cw + p.gap), y = top0 + r * rowH;
    const base = CUBE_COLORS[k % 4];
    /* The top face is its own element, moved with the cube: the picture stands on it and may move over it in a video. */
    const block = ct.blocks?.length ? c.assets[ct.blocks[k % ct.blocks.length]] : undefined;
    let g: string;
    if (block) {
      /* The block art is the whole cube, top strip included: its top edge is the cube's top, so the picture still sits on it. */
      c.push(`cubetop-${k}`, `Cube ${k + 1} top`, x, y, cw + dx, d, "", { under: true, nudgeAs: `cube-${k}` });
      g = c.fill(block, x, y, cw + dx, d + fh);
    } else {
      c.push(`cubetop-${k}`, `Cube ${k + 1} top`, x, y, cw + dx, d, `<path d="M${x} ${y + d} L${x + dx} ${y} H${x + cw + dx} L${x + cw} ${y + d}Z" fill="${shade(base, 0.45)}"/>`, { under: true, nudgeAs: `cube-${k}` });
      g = `<path d="M${x + cw} ${y + d} L${x + cw + dx} ${y} V${y + fh} L${x + cw} ${y + d + fh}Z" fill="${shade(base, -0.12)}"/>`;
      g += `<rect x="${x}" y="${y + d}" width="${cw}" height="${fh}" rx="10" fill="${base}"/>`;
    }
    const cx = x + (block ? (cw + dx) / 2 : cw / 2), ug = (p.unitGap ?? 130) / 100;
    if (!cube.label.some((l) => l.trim()) && cube.n.trim()) {
      /* One single text (no heading and subheading): wrapped to the cube, the category under it. */
      const ms = p.milestoneSize ?? 30, ml = wrap(cube.n, ms, cw - 20), lh = ms * 1.18;
      const first = y + d + fh * 0.5 - ((ml.length - 1) * lh + p.unitSize * 1.4) / 2 + ms * 0.35;
      ml.forEach((l, i) => { g += c.text(cx, first + i * lh, l, ms, st.ink); });
      g += c.text(cx, first + (ml.length - 1) * lh + p.unitSize * 1.4, cube.unit ?? ct.unit, p.unitSize, st.soft, "middle", st.bodyFont, 400);
    } else if (p.unitInline) {
      const u = cube.unit ?? ct.unit, nw = textW(cube.n, p.numberSize, 0.6), uw = textW(u, p.unitSize, 0.55), sp = p.numberSize * 0.16;
      const left = cx - (nw + sp + uw) / 2, by = y + d + fh * 0.36;
      g += c.text(left + nw, by, cube.n, p.numberSize, st.ink, "end");
      g += c.text(left + nw + sp, by, u, p.unitSize, st.soft, "start", st.bodyFont, 700);
    } else {
    g += c.text(cx, y + d + fh * 0.36, cube.n, p.numberSize, st.ink);
    g += c.text(cx, y + d + fh * 0.36 + p.unitSize * ug, cube.unit ?? ct.unit, p.unitSize, st.soft, "middle", st.bodyFont, 400);
    }
    const lab0 = y + d + fh * 0.36 + (p.unitInline ? p.labelSize * 0.25 : p.unitSize * ug) + (p.labelGap ?? 0);
    cube.label.forEach((l, i) => { g += c.text(cx, lab0 + p.labelSize * 1.25 + i * p.labelSize * (p.labelLeading ?? 125) / 100, l.trim(), p.labelSize, st.ink); });
    c.push(`cube-${k}`, `Cube ${k + 1} · ${cube.n} ${cube.label.join(" ")}`, x, y + d, cw + dx, fh, g);
    const im = c.image(c.assets[cube.asset], cx + dx / 2, y + d * 0.55 + p.babySink, cw * 1.05, p.babySize, "bottom");
    c.push(`baby-${k}`, `Picture ${k + 1}`, cx + dx / 2 - im.w / 2, im.top, im.w, im.h, im.svg, { float: true });
    end = Math.max(end, y + d + fh);
  });
  return end;
}

/* ---------------------------------------------------------------- card */

export const CARD_DEFAULTS: CardParams = {
  margin: 56, pad: 58, textTop: 150,
  headingSize: 60, headingLeading: 68, bodySize: 36, bodyLeading: 48, bodyGap: 28,
  artSize: 560, artBottom: 30, artX: 50,
  insetSize: 190, footerSize: 26,
};

function drawCard(spec: CardSpec, c: Ctx): number {
  const { W, H, st } = c, p = { ...CARD_DEFAULTS, ...spec.params }, ct = spec.content;
  const cardX = p.margin, cardY = p.margin * 0.8, cardW = W - 2 * p.margin, cardH = H - cardY - p.margin - p.footerSize * 1.8;
  if (!ct.cover) {
    let s = `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="46" fill="${st.card}"/>`;
    const sy = cardY + cardH;
    s += `<path d="M${cardX} ${sy - 170} C ${cardX + 90} ${sy - 110}, ${cardX + 40} ${sy - 30}, ${cardX + 160} ${sy - 60} S ${cardX + 300} ${sy - 10}, ${cardX + 330} ${sy}" stroke="${st.cream}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.9"/>`;
    c.push("panel", "Card", cardX, cardY, cardW, cardH, s);
    if (ct.footer) {
      const fy = cardY + cardH + p.footerSize * 1.35;
      const f = c.text(cardX + 6, fy, ct.footer, p.footerSize, st.muted, "start", st.bodyFont, 400)
        + `<path d="M${cardX + cardW - 118} ${fy - p.footerSize * 0.8} h${p.footerSize * 0.62} v${p.footerSize * 0.95} l${-p.footerSize * 0.31} ${-p.footerSize * 0.24} l${-p.footerSize * 0.31} ${p.footerSize * 0.24}z" fill="none" stroke="${st.muted}" stroke-width="2.5" stroke-linejoin="round"/>`
        + c.text(cardX + cardW - 6, fy, "Save", p.footerSize, st.muted, "end", st.bodyFont, 400);
      c.push("footer", "Footer", cardX, fy - p.footerSize, cardW, p.footerSize * 1.3, f);
    }
  }
  /* The words: the heading big, the body under it, both left-aligned in the card (centred on a cover). */
  const tx = ct.cover ? W / 2 : cardX + p.pad, anchor = ct.cover ? "middle" : "start", tw = cardW - 2 * p.pad;
  const hl = wrap(ct.heading, p.headingSize, tw, 0.46);
  let s = hl.map((l, i) => c.text(tx, p.textTop + i * p.headingLeading, l, p.headingSize, st.ink, anchor)).join("");
  let y = p.textTop + (hl.length - 1) * p.headingLeading + p.headingSize * 0.3;
  c.push("heading", "Heading", ct.cover ? W / 2 - tw / 2 : tx, p.textTop - p.headingSize * 0.85, tw, y - (p.textTop - p.headingSize * 0.85), s);
  if (ct.body) {
    const bl = wrap(ct.body, p.bodySize, tw, 0.49), by = y + p.bodyGap + p.bodySize * 0.8;
    s = bl.map((l, i) => c.text(tx, by + i * p.bodyLeading, l, p.bodySize, st.soft, anchor, st.bodyFont, 400)).join("");
    c.push("body", "Body", ct.cover ? W / 2 - tw / 2 : tx, by - p.bodySize * 0.85, tw, (bl.length - 1) * p.bodyLeading + p.bodySize * 1.2, s);
    y = by + (bl.length - 1) * p.bodyLeading + p.bodySize * 0.3;
  }
  /* The art, standing on the card's lower edge; the inset circle beside it. */
  const ax = (p.artX / 100) * W, ab = (ct.cover ? H - p.margin : cardY + cardH) - p.artBottom;
  const im = c.image(c.assets[ct.art], ax, ab, cardW * 0.9, p.artSize, "bottom");
  c.push("art", "Picture", ax - im.w / 2, im.top, im.w, im.h, im.svg, { float: true });
  if (ct.inset) {
    const r = p.insetSize / 2, icx = cardX + cardW - p.pad - r, icy = im.top + r * 0.4;
    const ii = c.image(c.assets[ct.inset], icx, icy, r * 1.3, r * 1.3);
    const g = `<circle cx="${icx}" cy="${icy}" r="${r}" fill="${st.cream}" stroke="${st.accent}" stroke-width="4"/>${ii.svg}`
      + `<path d="M${icx - r - 8} ${icy + r * 0.5} Q ${icx - r - 70} ${icy + r * 0.8} ${icx - r - 90} ${icy + r * 1.6}" stroke="${st.accent}" stroke-width="6" fill="none" stroke-linecap="round"/>`
      + `<path d="M${icx - r - 102} ${icy + r * 1.42} L${icx - r - 90} ${icy + r * 1.6} L${icx - r - 72} ${icy + r * 1.5}" stroke="${st.accent}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    c.push("inset", "Inset", icx - r - 104, icy - r, 2 * r + 104, r * 2 + r * 0.7, g);
  }
  return y;
}

/* ---------------------------------------------------------------- page */

/** The storybook look's defaults: a paper band deep enough to hide words a generator drew in the top third. */
export const PAGE_DEFAULTS: PageParams = {
  textTop: 150, margin: 70, headingSize: 58, headingLeading: 66,
  bodySize: 36, bodyLeading: 46, bodyGap: 22,
  band: 0, bandFade: 60,
  artScale: 1, artX: 0, artY: 0,
  screenW: 40, screenX: 72, screenY: 60,
};
/** The storybook page keeps the brand faces (never a reference's font) and only changes the page to plain white paper. */
export const PAGE_STYLE: Partial<Style> = { bg: "#FFFFFF" };

function drawPage(spec: PageSpec, c: Ctx): number {
  const { W, H, st } = c, p = { ...PAGE_DEFAULTS, ...spec.params }, ct = spec.content;
  /* The picture fills the frame (zoomed and shifted by the sliders); it never moves in a video. */
  const a = c.assets[ct.art];
  if (a) {
    const aw = W * p.artScale, ah = H * p.artScale;
    c.push("art", "Picture", (W - aw) / 2 + p.artX, (H - ah) / 2 + p.artY, aw, ah, c.cover(a, (W - aw) / 2 + p.artX, (H - ah) / 2 + p.artY, aw, ah));
  }
  /* The paper band: plain page over the picture's top, fading into it, so typeset words sit on paper. */
  if (p.band > 0) {
    const g = `pb${Math.round(p.band)}`;
    const s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st.bg}" stop-opacity="1"/><stop offset="1" stop-color="${st.bg}" stop-opacity="0"/></linearGradient></defs>`
      + `<rect x="0" y="0" width="${W}" height="${p.band}" fill="${st.bg}"/><rect x="0" y="${p.band}" width="${W}" height="${p.bandFade}" fill="url(#${g})"/>`;
    c.push("band", "Paper band", 0, 0, W, p.band + p.bandFade, s);
  }
  const tw = W - 2 * p.margin;
  const hl = wrap(ct.heading, p.headingSize, tw, 0.5);
  let s = hl.map((l, i) => c.text(W / 2, p.textTop + i * p.headingLeading, l, p.headingSize, st.ink)).join("");
  let y = p.textTop + (hl.length - 1) * p.headingLeading + p.headingSize * 0.3;
  const hw = Math.min(tw, Math.max(...hl.map((l) => textW(l, p.headingSize, 0.5)), 10));
  c.push("heading", "Heading", W / 2 - hw / 2, p.textTop - p.headingSize * 0.85, hw, y - (p.textTop - p.headingSize * 0.85), s);
  if (ct.body) {
    const bl = wrap(ct.body, p.bodySize, tw, 0.47), by = y + p.bodyGap + p.bodySize * 0.8;
    s = bl.map((l, i) => c.text(W / 2, by + i * p.bodyLeading, l, p.bodySize, st.soft, "middle", st.bodyFont, 400)).join("");
    const bw = Math.min(tw, Math.max(...bl.map((l) => textW(l, p.bodySize, 0.47)), 10));
    c.push("body", "Lines", W / 2 - bw / 2, by - p.bodySize * 0.85, bw, (bl.length - 1) * p.bodyLeading + p.bodySize * 1.2, s);
    y = by + (bl.length - 1) * p.bodyLeading + p.bodySize * 0.3;
  }
  /* The app screen (a listing screenshot cropped to its phone, brand/assets screen-*): rounded corners, a soft shadow.
   * A framed phone (an asset whose id starts "phone-", scripts/phone-mockup.mjs) carries its own frame, transparency
   * and pop-out, so it is drawn as it is. */
  const sc = c.assets[ct.screen];
  if (sc && /^phone-/.test(ct.screen)) {
    const sw = (p.screenW / 100) * W, sh = sw * (sc.h / sc.w), sx = (p.screenX / 100) * W - sw / 2, sy = (p.screenY / 100) * H - sh / 2;
    c.push("screen", "App screen", sx, sy, sw, sh, `<image href="${c.assetHref(sc)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}"/>`);
  } else if (sc) {
    const sw = (p.screenW / 100) * W, sh = sw * (sc.h / sc.w), sx = (p.screenX / 100) * W - sw / 2, sy = (p.screenY / 100) * H - sh / 2, r = sw * 0.07;
    const id = "scr";
    const g = `<defs><clipPath id="${id}"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${r}"/></clipPath><filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${sw * 0.035}"/></filter></defs>`
      + `<rect x="${sx}" y="${sy + sw * 0.03}" width="${sw}" height="${sh}" rx="${r}" fill="rgba(0,0,0,0.25)" filter="url(#${id}s)"/>`
      + `<image href="${c.assetHref(sc)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
    c.push("screen", "App screen", sx, sy, sw, sh, g);
  }
  return y;
}


/* ---------------------------------------------------------------- wall */

export const WALL_DEFAULTS: WallParams = {
  textTop: 420, margin: 70, textSize: 52, leading: 66, firstScale: 1.25, paraGap: 34, align: 1,
  panel: 86, panelPad: 56, scrim: 0, wash: 0,
  artScale: 1, artX: 0, artY: 0, zoomEnd: 8,
  screenW: 34, screenX: 74, screenY: 84,
};

function drawWall(spec: WallSpec, c: Ctx): number {
  const { W, H, st } = c, p = { ...WALL_DEFAULTS, ...spec.params }, ct = spec.content;
  /* The backgrounds: one, or up to four that cross-fade over the video. Each scene breathes: it zooms in or out while it is on
   * (alternating), and the next fades in over it, as a slow photo reel does. */
  /* With a video background the renderer lays the words (this overlay) over the playing clip: no pictures here. */
  const arts = c.overlay ? [] : [["art", ct.art], ["art2", ct.art2 ?? ""], ["art3", ct.art3 ?? ""], ["art4", ct.art4 ?? ""]].filter(([, id]) => c.assets[id]);
  const drifting = c.anim?.kind === "drift" && c.t !== null, dur = Math.max(0.1, c.anim?.duration ?? 6), seg = dur / Math.max(1, arts.length), fade = Math.min(1.2, seg * 0.4);
  const tt = drifting ? (c.t as number) : 0;
  arts.forEach(([id, aid], k) => {
    const a = c.assets[aid], u = drifting ? Math.max(0, Math.min(1, (tt - (k * seg - fade)) / (seg + 2 * fade))) : 0;
    const z = p.artScale * (1 + (p.zoomEnd / 100) * (k % 2 === 0 ? u : 1 - u)), aw = W * z, ah = H * z, ax = (W - aw) / 2 + p.artX, ay = (H - ah) / 2 + p.artY;
    const x = drifting && k > 0 ? Math.max(0, Math.min(1, (tt - (k * seg - fade)) / fade)) : k === 0 ? 1 : 0;
    if (x > 0) c.push(id, k === 0 ? "Background" : `Background ${k + 1}`, ax, ay, aw, ah, `<g opacity="${x.toFixed(3)}">${c.cover(a, ax, ay, aw, ah)}</g>`);
  });
  /* The dimmer is a gradient, darkest where the words are (the top), lighter below, so the picture still shows. */
  if (p.scrim > 0) c.push("scrim", "Dimmer", 0, 0, W, H, `<defs><linearGradient id="wsc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="${(p.scrim / 100).toFixed(2)}"/><stop offset="0.8" stop-color="#000" stop-opacity="${(p.scrim * 0.6 / 100).toFixed(2)}"/><stop offset="1" stop-color="#000" stop-opacity="${(p.scrim * 0.35 / 100).toFixed(2)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#wsc)"/>`);
  if (p.wash > 0) c.push("wash", "Paper wash", 0, 0, W, H, `<rect width="${W}" height="${H}" fill="${st.bg}" opacity="${(p.wash / 100).toFixed(2)}"/>`);
  /* A deleted paragraph leaves no gap: the rest close up. A paragraph may start with "# " (the headline), "_ " (a soft italic line)
   * or "! " (a bold closing line); with none of them the first paragraph is the headline. */
  const hid = spec.hidden ?? [];
  const raw = ct.text.split("\n").map((tx, i) => ({ tx: tx.trim(), i })).filter((x) => x.tx);
  const marked = raw.some((x) => /^[#_!]\s/.test(x.tx));
  const paras = raw.filter((x) => !hid.includes(`line-${x.i}`)).map((x, k) => {
    const m = x.tx.match(/^([#_!])\s+(.*)$/);
    const kind = m ? (m[1] === "#" ? "h" : m[1] === "_" ? "i" : "b") : !marked && x.i === raw[0].i ? "h" : "p";
    return { tx: m ? m[2] : x.tx, i: x.i, kind, k };
  });
  const tw = W - 2 * p.margin - 2 * p.panelPad, centre = p.align >= 0.5, dark = p.panel >= 40 || p.wash >= 40;
  const laid = paras.map((x) => {
    const size = x.kind === "h" ? p.textSize * p.firstScale : x.kind === "i" ? p.textSize * 0.8 : p.textSize, lead = p.leading * (size / p.textSize);
    const kk = x.kind === "h" || x.kind === "b" ? 0.5 : 0.46;
    return { ...x, size, lead, kk, lines: wrap(x.tx, size, tw, kk) };
  });
  let total = laid.reduce((s, q) => s + q.lines.length * q.lead, 0) + Math.max(0, laid.length - 1) * p.paraGap;
  if (!laid.length) total = 0;
  const ph = total + 2 * p.panelPad;
  if (p.panel > 0 && laid.length) c.push("panel", "Panel", p.margin, p.textTop, W - 2 * p.margin, ph, `<rect x="${p.margin}" y="${p.textTop}" width="${W - 2 * p.margin}" height="${ph}" rx="44" fill="${st.cream}" opacity="${(p.panel / 100).toFixed(2)}"/>`);
  const ink = dark ? st.ink : "#FFFFFF", soft = dark ? st.soft : "#FFFFFF";
  let y = p.textTop + p.panelPad;
  laid.forEach((q) => {
    const x = centre ? W / 2 : p.margin + p.panelPad, anchor = centre ? "middle" : "start";
    const head = q.kind === "h" || q.kind === "b";
    /* Headlines, items and the closing line are full ink for legibility; only the italic soft line is softer. */
    let s = q.lines.map((l, j) => c.text(x, y + q.size * 0.8 + j * q.lead, l, q.size, q.kind === "i" ? soft : ink, anchor, head ? st.font : st.bodyFont, q.kind === "h" ? 800 : head ? 800 : 700)).join("");
    if (q.kind === "i") s = s.replace(/<text /g, '<text font-style="italic" ');
    if (!dark) s = `<defs><filter id="wsh" x="-5%" y="-5%" width="110%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dx="0" dy="2" result="o"/><feComponentTransfer><feFuncA type="linear" slope="0.65"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#wsh)">${s}</g>`;
    const bw = Math.min(tw, Math.max(...q.lines.map((l) => textW(l, q.size, q.kk)), 10));
    c.push(`line-${q.i}`, q.kind === "h" ? "Headline" : `Line ${q.i + 1}`, centre ? W / 2 - bw / 2 : p.margin + p.panelPad, y, bw, q.lines.length * q.lead, s);
    y += q.lines.length * q.lead + p.paraGap;
  });
  const sc = c.assets[ct.screen];
  if (sc && /^phone-/.test(ct.screen)) {
    const sw = (p.screenW / 100) * W, sh = sw * (sc.h / sc.w), sx = (p.screenX / 100) * W - sw / 2, sy = (p.screenY / 100) * H - sh / 2;
    c.push("screen", "App screen", sx, sy, sw, sh, `<image href="${c.assetHref(sc)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}"/>`);
  } else if (sc) {
    const sw = (p.screenW / 100) * W, sh = sw * (sc.h / sc.w), sx = (p.screenX / 100) * W - sw / 2, sy = (p.screenY / 100) * H - sh / 2, r = sw * 0.07, id = "wscr";
    c.push("screen", "App screen", sx, sy, sw, sh, `<defs><clipPath id="${id}"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${r}"/></clipPath></defs><rect x="${sx}" y="${sy + sw * 0.03}" width="${sw}" height="${sh}" rx="${r}" fill="rgba(0,0,0,0.25)"/><image href="${c.assetHref(sc)}" x="${sx}" y="${sy}" width="${sw}" height="${sh}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`);
  }
  return p.textTop + (laid.length ? ph : 0);
}

/* ---------------------------------------------------------------- list (a list card) */

export const LIST_DEFAULTS: ListParams = {
  margin: 56, pad: 44, headingTop: 160, headingSize: 64, headingLeading: 72, subSize: 30,
  listGap: 44, rowGap: 22, rowPad: 28, titleSize: 42, lineSize: 31, badge: 0,
  artSize: 230, artX: 82, artBottom: 24, footerSize: 26,
};

function drawList(spec: ListSpec, c: Ctx): number {
  const { W, H, st } = c, p = { ...LIST_DEFAULTS, ...spec.params }, ct = spec.content;
  const cardX = p.margin, cardY = p.margin * 0.8, cardW = W - 2 * p.margin, cardH = H - cardY - p.margin - p.footerSize * 1.8;
  c.push("panel", "Card", cardX, cardY, cardW, cardH, `<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="46" fill="${st.card}"/>`);
  const tw = cardW - 2 * p.pad;
  const hl = wrap(ct.heading, p.headingSize, tw, 0.48);
  let s = hl.map((l, i) => c.text(W / 2, p.headingTop + i * p.headingLeading, l, p.headingSize, st.ink)).join("");
  let y = p.headingTop + (hl.length - 1) * p.headingLeading + p.headingSize * 0.3;
  const hw = Math.min(tw, Math.max(...hl.map((l) => textW(l, p.headingSize, 0.48)), 10));
  c.push("heading", "Heading", W / 2 - hw / 2, p.headingTop - p.headingSize * 0.85, hw, y - (p.headingTop - p.headingSize * 0.85), s);
  if (ct.sub) {
    const pw = textW(ct.sub, p.subSize, 0.52) + 56, ph = p.subSize * 1.9, py = y + 24;
    c.push("sub", "Tag", W / 2 - pw / 2, py, pw, ph, `<rect x="${W / 2 - pw / 2}" y="${py}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${st.accent}"/>` + c.text(W / 2, py + ph * 0.68, ct.sub, p.subSize, "#FFFFFF"));
    y = py + ph;
  }
  const hid = spec.hidden ?? [];
  const vis = ct.items.map((it, i) => ({ it, i })).filter((x) => !hid.includes(`item-${x.i}`));
  /* One of the app's own activity pictures stands whole at the right of the list; the rows take the rest of the width. */
  const pic = ct.art.startsWith("post/") && c.assets[ct.art] ? c.assets[ct.art] : null, picW = pic ? Math.round(tw * 0.4) : 0;
  const rowW = tw - (pic ? picW + 22 : 0), textX = cardX + p.pad + (p.badge === 2 ? 28 : 112), room = cardX + p.pad + rowW - 28 - textX;
  const listTop = y + p.listGap;
  y += p.listGap;
  vis.forEach((x, k) => {
    const tl = wrap(x.it.title, p.titleSize, room, 0.5), ll = x.it.line ? wrap(x.it.line, p.lineSize, room, 0.47) : [];
    const h = 2 * p.rowPad + tl.length * p.titleSize * 1.15 + ll.length * p.lineSize * 1.3 + (ll.length ? 6 : 0), rx = cardX + p.pad;
    let g = `<rect x="${rx}" y="${y}" width="${rowW}" height="${h}" rx="34" fill="${st.cream}"/>`;
    if (p.badge !== 2) {
      const cx = rx + 56, cy = y + p.rowPad + p.titleSize * 0.55;
      g += `<circle cx="${cx}" cy="${cy}" r="30" fill="${st.accent}"/>` + (p.badge === 1
        ? `<path d="M${cx - 13} ${cy + 1} l9 10 l17 -20" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        : c.text(cx, cy + 12, String(k + 1), 34, "#FFFFFF"));
    }
    g += tl.map((l, j) => c.text(textX, y + p.rowPad + p.titleSize * 0.85 + j * p.titleSize * 1.15, l, p.titleSize, st.ink, "start")).join("");
    g += ll.map((l, j) => c.text(textX, y + p.rowPad + tl.length * p.titleSize * 1.15 + p.lineSize * 0.95 + 6 + j * p.lineSize * 1.3, l, p.lineSize, st.soft, "start", st.bodyFont, 400)).join("");
    c.push(`item-${x.i}`, `Item ${x.i + 1}`, rx, y, rowW, h, g);
    y += h + p.rowGap;
  });
  const end = y - p.rowGap;
  const cardBottom = cardY + cardH;
  if (pic) {
    const px = cardX + p.pad + rowW + 22, ph = Math.min(Math.round(picW * (pic.h / pic.w)), Math.round(H * 0.79 - listTop));
    c.push("art", "Picture", px, listTop, picW, ph, `<clipPath id="lap"><rect x="${px}" y="${listTop}" width="${picW}" height="${ph}" rx="34"/></clipPath><g clip-path="url(#lap)">${c.cover(pic, px, listTop, picW, ph)}</g><rect x="${px}" y="${listTop}" width="${picW}" height="${ph}" rx="34" fill="none" stroke="#FFFFFF" stroke-width="6"/>`);
  } else if (ct.art) {
    /* The picture never stands lower than 79% of the frame: TikTok's caption covers the bottom fifth. */
    const ax = (p.artX / 100) * W, im = c.image(c.assets[ct.art], ax, Math.min(cardBottom - p.artBottom, H * 0.79), p.artSize * 1.2, p.artSize, "bottom");
    c.push("art", "Picture", ax - im.w / 2, im.top, im.w, im.h, im.svg, { float: true });
  }
  if (ct.footer) c.push("footer", "Footer", cardX, cardBottom + p.footerSize * 0.35, cardW, p.footerSize * 1.3, c.text(cardX + 6, cardBottom + p.footerSize * 1.35, ct.footer, p.footerSize, st.muted, "start", st.bodyFont, 400));
  return end;
}

/* ---------------------------------------------------------------- clips */

export const CLIPS_DEFAULTS: ClipsParams = {
  margin: 56, titleTop: 150, titleSize: 46, stepSize: 30,
  labelSize: 52, labelBottom: 760, capSize: 38, capGap: 22, shade: 38, secs: 5,
  frame: 1, winTop: 300, winH: 860, winMargin: 90, barTop: 150, barH: 104, introSecs: 3, outroSecs: 3.5, hook: 0, hookTitleSize: 104, hookTitleLift: 70, hookShade: 66, hookLineSize: 48,
};

/** The framed look's window, in px: where the clip plays. */
export function clipsWindow(spec: ClipsSpec): { x: number; y: number; w: number; h: number; r: number } {
  const p = { ...CLIPS_DEFAULTS, ...spec.params };
  return { x: p.winMargin, y: p.winTop, w: spec.size[0] - 2 * p.winMargin, h: p.winH, r: 46 };
}
/** The pages of a framed reel, in order: -1 the intro, 0..n-1 the clips, n the end card. */
export const clipsPages = (spec: ClipsSpec) => spec.content.items.map((_, i) => i).filter((i) => !(spec.hidden ?? []).includes(`clip-${i}`)).length + 2;

const roundedPath = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

function drawClipsFramed(spec: ClipsSpec, c: Ctx, p: ClipsParams, vis: { it: ClipItem; i: number }[]): number {
  const { W, H, st } = c, ct = spec.content, n = vis.length, f = c.focus, mode = f < 0 ? "intro" : f >= n ? "outro" : "clip";
  const win = clipsWindow(spec), PILL = "#F7EBB5", cx = W / 2;
  /* Text on the page itself is white on a strong colour and ink on a light one. */
  const rgb = /^#([0-9a-f]{6})$/i.exec(st.bg)?.[1] ?? "EE7B4D", lum = (0.299 * parseInt(rgb.slice(0, 2), 16) + 0.587 * parseInt(rgb.slice(2, 4), 16) + 0.114 * parseInt(rgb.slice(4, 6), 16)) / 255;
  const onPage = lum > 0.62 ? st.ink : "#FFFFFF";
  const pill = (x: number, y: number, text: string, size: number) => {
    const w = textW(text, size, 0.52) + 54, h = size * 1.9;
    return { w, h, svg: `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${PILL}" stroke="#1F1B18" stroke-width="2"/>` + c.text(x, y + h * 0.68, text, size, st.ink, "middle", st.bodyFont, 600) };
  };
  /* The page: the colour, with a rounded window cut out of it when a clip plays (the video is laid under the overlay). */
  const full = `M0 0H${W}V${H}H0Z`;
  const hookIntro = mode === "intro" && (p.hook ?? 0) >= 0.5 && n > 0;
  let page = "";
  if ((mode === "clip" || hookIntro) && c.overlay) page = `<path d="${full} ${roundedPath(win.x, win.y, win.w, win.h, win.r)}" fill="${st.bg}" fill-rule="evenodd"/>`;
  else page = `<rect width="${W}" height="${H}" fill="${st.bg}"/>`;
  if ((mode === "clip" || hookIntro) && !c.overlay) {
    const cur = vis[Math.min(Math.max(f, 0), n - 1)], th = cur ? c.assets[cur.it.thumb] : undefined;
    page += `<clipPath id="cwin"><path d="${roundedPath(win.x, win.y, win.w, win.h, win.r)}"/></clipPath>` + (th ? `<g clip-path="url(#cwin)">${c.cover(th, win.x, win.y, win.w, win.h)}</g>` : `<path d="${roundedPath(win.x, win.y, win.w, win.h, win.r)}" fill="#F8F0C8"/>`);
  }
  c.push("page", "Page", 0, 0, W, H, page);
  if (hookIntro) {
    /* The video hook: the clips play in the window (made by the renderer); over the video's lower part a dark shading and the title in big white type, a tag above the window, one bold line under it. */
    const it = ct.intro ?? { tag: "Play ideas", title: ct.title, line: "", bold: "" };
    const tag = pill(cx, p.barTop - 40, it.tag || "Play ideas", 34);
    c.push("intro-tag", "Tag", cx - tag.w / 2, p.barTop - 40, tag.w, tag.h, tag.svg);
    const hs = p.hookTitleSize ?? 104, tl = wrap(it.title.replace(/\\n/g, "\n"), hs, win.w - 80, 0.5), lh = Math.round(hs * 1.08), ty = win.y + win.h - (p.hookTitleLift ?? 70) - (tl.length - 1) * lh;
    const shade = `<defs><linearGradient id="hk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${((p.hookShade ?? 66) / 100).toFixed(2)}"/></linearGradient><clipPath id="hkc"><path d="${roundedPath(win.x, win.y, win.w, win.h, win.r)}"/></clipPath></defs>`
      + `<g clip-path="url(#hkc)"><rect x="${win.x}" y="${win.y + win.h * 0.38}" width="${win.w}" height="${win.h * 0.62}" fill="url(#hk)"/></g>`;
    c.push("hook-title", "Hook title", win.x, ty - 88, win.w, tl.length * lh + 20, shade + tl.map((l, i) => c.text(cx, ty + i * lh, l, hs, "#FFFFFF", "middle", st.bodyFont, 800)).join(""));
    const hl = p.hookLineSize ?? p.capSize + 6, sub = [it.line, it.bold].filter(Boolean).join(" ").trim(), sl = sub ? wrap(sub, hl, win.w - 20, 0.5) : [], sy = win.y + win.h + 56;
    if (sl.length) c.push("hook-line", "Line under the video", win.x, sy - hl, win.w, sl.length * hl * 1.3 + 10, sl.map((l, i) => c.text(cx, sy + i * hl * 1.3, l, hl, onPage, "middle", st.bodyFont, 700)).join(""));
    return sy + sl.length * hl * 1.3;
  }
  if (mode === "intro") {
    const it = ct.intro ?? { tag: "Parent play tips", title: ct.title, line: "", bold: "" };
    const tw = W - 2 * win.x - 60, tl = wrap(it.title.replace(/\\n/g, "\n"), 104, tw, 0.5), ll = it.line ? wrap(it.line, 56, tw, 0.5) : [], bl = it.bold ? wrap(it.bold, 66, tw, 0.5) : [];
    const h = 130 + tl.length * 118 + (ll.length ? 24 + ll.length * 70 : 0) + (bl.length ? 34 + bl.length * 80 : 0), y0 = Math.round((H * 0.8 - h) / 2);
    c.push("intro-card", "Card", win.x, y0, W - 2 * win.x, h, `<rect x="${win.x}" y="${y0}" width="${W - 2 * win.x}" height="${h}" rx="46" fill="#FFFFFF" stroke="#1F1B18" stroke-width="2"/>`);
    const tag = pill(cx, y0 - 38, it.tag || "Parent play tips", 34);
    c.push("intro-tag", "Tag", cx - tag.w / 2, y0 - 38, tag.w, tag.h, tag.svg);
    let y = y0 + 52 + 84;
    c.push("intro-title", "Title", win.x + 30, y - 84, tw, tl.length * 118, tl.map((l, i) => c.text(cx, y + i * 118, l, 104, st.ink, "middle", st.bodyFont, 500)).join(""));
    y += tl.length * 118 - 20;
    if (ll.length) { c.push("intro-line", "Line", win.x + 30, y, tw, ll.length * 70, ll.map((l, i) => c.text(cx, y + 56 + i * 70, l, 56, st.ink, "middle", st.bodyFont, 400)).join("")); y += 24 + ll.length * 70; }
    if (bl.length) c.push("intro-bold", "Bold line", win.x + 30, y + 10, tw, bl.length * 80, bl.map((l, i) => c.text(cx, y + 66 + i * 80, l, 66, st.ink, "middle", st.bodyFont, 800)).join(""));
    return y0 + h;
  }
  if (mode === "outro") {
    const o = ct.outro ?? { title: "Find the right play for every age", line: "" };
    const tl = wrap(o.title, 78, W - 2 * win.x, 0.5);
    c.push("outro-title", "Title", win.x, 380, W - 2 * win.x, tl.length * 92, tl.map((l, i) => c.text(cx, 380 + 70 + i * 92, l, 78, onPage, "middle", st.font, 800)).join(""));
    if (o.line) c.push("outro-line", "Line", win.x, 380 + tl.length * 92 + 20, W - 2 * win.x, 60, c.text(cx, 380 + tl.length * 92 + 70, o.line, 44, onPage, "middle", st.bodyFont, 600));
    return 380 + tl.length * 92 + 90;
  }
  const cur = vis[Math.min(f, n - 1)];
  if (!cur) return 0;
  const bw = W - 2 * win.x, tag = pill(cx, p.barTop - 40, "Activity :", 32);
  c.push("label", "Activity name", win.x, p.barTop, bw, p.barH, `<rect x="${win.x}" y="${p.barTop}" width="${bw}" height="${p.barH}" rx="34" fill="#FFFFFF" stroke="#1F1B18" stroke-width="2"/>` + c.text(cx, p.barTop + p.barH * 0.66, cur.it.label, p.labelSize, st.ink, "middle", st.bodyFont, 500));
  c.push("tag", "Tag", cx - tag.w / 2, p.barTop - 40, tag.w, tag.h, tag.svg);
  const cl = cur.it.caption ? wrap(cur.it.caption, p.capSize, bw - 20, 0.5) : [], cy = win.y + win.h + 52;
  if (cl.length) c.push("caption", "Instruction", win.x, cy - p.capSize, bw, cl.length * p.capSize * 1.3 + 10, cl.map((l, i) => c.text(cx, cy + i * p.capSize * 1.3, l, p.capSize, onPage, "middle", st.bodyFont, 700)).join(""));
  return cy + cl.length * p.capSize * 1.3;
}

function drawClips(spec: ClipsSpec, c: Ctx): number {
  const { W, H, st } = c, p = { ...CLIPS_DEFAULTS, ...spec.params }, ct = spec.content;
  const hid = spec.hidden ?? [];
  const vis = ct.items.map((it, i) => ({ it, i })).filter((x) => !hid.includes(`clip-${x.i}`));
  if (p.frame >= 0.5) return drawClipsFramed(spec, c, p, vis);
  const cur = vis[Math.min(c.focus, vis.length - 1)];
  if (!c.overlay && cur) {
    const th = c.assets[cur.it.thumb];
    if (th) c.push("video", "Clip (a still)", 0, 0, W, H, c.cover(th, 0, 0, W, H));
  }
  if (p.shade > 0) c.push("shade", "Shading", 0, 0, W, H, `<defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="${(p.shade / 100).toFixed(2)}"/><stop offset="0.28" stop-color="#000" stop-opacity="0"/><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(p.shade / 100).toFixed(2)}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#cs)"/>`);
  const tw = W - 2 * p.margin, tl = wrap(ct.title, p.titleSize, tw - 80, 0.52);
  const bw = Math.min(tw, Math.max(...tl.map((l) => textW(l, p.titleSize, 0.52)), 10) + 80), bh = tl.length * p.titleSize * 1.2 + 44;
  c.push("title", "Title", W / 2 - bw / 2, p.titleTop, bw, bh, `<rect x="${W / 2 - bw / 2}" y="${p.titleTop}" width="${bw}" height="${bh}" rx="40" fill="${st.cream}" opacity="0.94"/>`
    + tl.map((l, i) => c.text(W / 2, p.titleTop + 22 + p.titleSize * 0.9 + i * p.titleSize * 1.2, l, p.titleSize, st.ink)).join(""));
  if (cur) {
    const sy = p.titleTop + bh + 22, st2 = `${vis.indexOf(cur) + 1} / ${vis.length}`, sw = textW(st2, p.stepSize, 0.56) + 44;
    c.push("step", "Step", W / 2 - sw / 2, sy, sw, p.stepSize * 1.8, `<rect x="${W / 2 - sw / 2}" y="${sy}" width="${sw}" height="${p.stepSize * 1.8}" rx="${p.stepSize * 0.9}" fill="${st.accent}"/>` + c.text(W / 2, sy + p.stepSize * 1.28, st2, p.stepSize, "#FFFFFF"));
    const ll = wrap(cur.it.label, p.labelSize, tw - 60, 0.5), cl = cur.it.caption ? wrap(cur.it.caption, p.capSize, tw - 60, 0.48) : [];
    const ch = cl.length * p.capSize * 1.3, lh = ll.length * p.labelSize * 1.15, top = H - p.labelBottom - lh - (cl.length ? p.capGap + ch : 0);
    c.push("label", "Activity name", p.margin, top - 18, tw, lh + 36, `<rect x="${p.margin}" y="${top - 18}" width="${tw}" height="${lh + 36}" rx="34" fill="#1F1B18" opacity="0.62"/>`
      + ll.map((l, i) => c.text(W / 2, top + p.labelSize * 0.82 + i * p.labelSize * 1.15, l, p.labelSize, "#FFFFFF")).join(""));
    if (cl.length) c.push("caption", "Line", p.margin, top + lh + p.capGap - 14, tw, ch + 28, `<rect x="${p.margin}" y="${top + lh + p.capGap - 14}" width="${tw}" height="${ch + 28}" rx="30" fill="#1F1B18" opacity="0.5"/>`
      + cl.map((l, i) => c.text(W / 2, top + lh + p.capGap + p.capSize * 0.9 + i * p.capSize * 1.3, l, p.capSize, "#FFFFFF", "middle", st.bodyFont, 700)).join(""));
    return top + lh + (cl.length ? p.capGap + ch : 0);
  }
  return 0;
}

/* ---------------------------------------------------------------- the registry */

export type Control = [key: string, label: string, min: number, max: number, step: number];
/** One editable text of a template: its label, its value as the editor shows it, and how an edit writes back. */
export type Field = { key: string; label: string; value: string; rows?: number; set: (s: Spec, v: string) => Spec };
/** One picture slot of a template: which asset fills it, and the kinds that fit (character, icon, tile). */
export type Slot = { key: string; label: string; value: string; kinds: string[]; set: (s: Spec, v: string) => Spec };

const setContent = <S extends Spec>(s: S, patch: Partial<S["content"]>): S => ({ ...s, content: { ...s.content, ...patch } });

/** A block with no drawn element of its own the user may still delete (a clip: its id is clip-N). */
export type Block = { id: string; label: string };
export const TEMPLATES: Record<TemplateName, { name: string; defaults: Record<string, number | boolean>; controls: Control[]; fields: (s: Spec) => Field[]; slots: (s: Spec) => Slot[]; blocks?: (s: Spec) => Block[] }> = {
  hub: {
    name: "Signs poster (hub)",
    defaults: HUB_DEFAULTS,
    controls: [
      ["titleSize", "Title size", 50, 130, 1], ["titleTop", "Title position", 90, 320, 2], ["titleLeading", "Title line spacing", 60, 150, 1],
      ["defSize", "Definition size", 20, 48, 1], ["defGap", "Space under title", 20, 140, 2], ["gridGap", "Space above tiles", 0, 120, 2],
      ["iconSize", "Tile size", 80, 320, 2], ["labelSize", "Tile text size", 22, 56, 1], ["labelGap", "Tile to text", 0, 80, 1],
      ["rowGap", "Space between rows", 0, 120, 2], ["colInset", "Side column position", 120, 300, 2], ["centerSize", "Centre picture size", 150, 560, 2],
      ["centerDrop", "Bottom-centre drop", 0, 120, 2], ["bubbleSize", "Bubble text size", 22, 56, 1], ["bubbleGap", "Space above bubble", 0, 100, 2],
    ],
    fields: (s) => {
      const h = s as HubSpec, ct = h.content;
      return [
        { key: "title", label: "Title (one line each)", value: ct.title.join("\n"), rows: 3, set: (x, v) => setContent(x as HubSpec, { title: v.split("\n") }) },
        { key: "def", label: "Definition (bold | rest, one line each)", value: ct.definition.map(([b, r]) => `${b} |${r}`).join("\n"), rows: 2,
          set: (x, v) => setContent(x as HubSpec, { definition: v.split("\n").filter((l) => l.trim()).map((l) => { const i = l.indexOf("|"); return (i < 0 ? [l, ""] : [l.slice(0, i).trimEnd(), l.slice(i + 1)]) as [string, string]; }) }) },
        ...ct.items.map((it, k): Field => ({ key: `item-${k}`, label: `Tile ${k + 1} (line / line)`, value: it.label.join(" / "),
          set: (x, v) => { const hx = x as HubSpec; return setContent(hx, { items: hx.content.items.map((y, j) => (j === k ? { ...y, label: v.split(/\s*\/\s*/) } : y)) }); } })), /* no trim while typing: a trailing space is the next word's gap (trimmed when drawn) */
        { key: "bubble", label: "Bubble", value: ct.bubble, set: (x, v) => setContent(x as HubSpec, { bubble: v }) },
      ];
    },
    slots: (s) => {
      const h = s as HubSpec;
      return [
        { key: "center", label: "Centre picture", value: h.content.center, kinds: ["character"], set: (x, v) => setContent(x as HubSpec, { center: v }) },
        ...h.content.items.map((it, k): Slot => ({ key: `item-${k}`, label: `Tile ${k + 1} · ${it.label.join(" ")}`, value: it.asset, kinds: ["icon", "tile", "character"],
          set: (x, v) => { const hx = x as HubSpec; return setContent(hx, { items: hx.content.items.map((y, j) => (j === k ? { ...y, asset: v } : y)) }); } })),
      ];
    },
  },
  cube: {
    name: "Chart (cubes)",
    defaults: CUBE_DEFAULTS,
    controls: [
      ["titleSize", "Title size", 44, 110, 1], ["titleTop", "Title position", 90, 320, 2], ["titleLeading", "Title line spacing", 50, 130, 1],
      ["pillSize", "Pill text size", 20, 48, 1], ["gridGap", "Space above cubes", 40, 300, 2], ["margin", "Side margin", 10, 120, 2],
      ["gap", "Space between cubes", 4, 60, 1], ["cubeHeight", "Cube height", 120, 320, 2], ["depth", "Cube depth", 10, 70, 1],
      ["rowGap", "Space between rows", 60, 300, 2], ["numberSize", "Number size", 36, 110, 1], ["unitSize", "Unit size", 16, 44, 1],
      ["labelSize", "Label size", 18, 44, 1], ["milestoneSize", "Single text size", 18, 44, 1], ["babySize", "Picture size", 100, 320, 2], ["babySink", "Picture sits lower", -40, 60, 1], ["cols", "Cubes per row", 2, 4, 1],
      ["unitGap", "Space number to months (stacked)", 80, 260, 2], ["labelGap", "Space above label", -30, 60, 1], ["labelLeading", "Label line spacing", 90, 200, 1],
    ],
    fields: (s) => {
      const q = s as CubeSpec, ct = q.content;
      return [
        { key: "title", label: "Title (one line each)", value: ct.title.join("\n"), rows: 2, set: (x, v) => setContent(x as CubeSpec, { title: v.split("\n") }) },
        { key: "pill", label: "Pill", value: ct.pill, set: (x, v) => setContent(x as CubeSpec, { pill: v }) },
        { key: "unit", label: "Unit under each number", value: ct.unit, set: (x, v) => setContent(x as CubeSpec, { unit: v }) },
        ...ct.cubes.flatMap((cb, k): Field[] => [
          { key: `cube-${k}`, label: `Cube ${k + 1} (number | line / line)`, value: `${cb.n} | ${cb.label.join(" / ")}`,
            set: (x, v) => { const qx = x as CubeSpec; const [n, rest = ""] = v.split(/\s*\|\s*/); return setContent(qx, { cubes: qx.content.cubes.map((y, j) => (j === k ? { ...y, n: n.trimStart(), label: rest.split(/\s*\/\s*/).filter((z, zi, all) => z.trim() || zi === all.length - 1) } : y)) }); } },
          /* The line right under the number is this cube's own when it differs from the chart's unit ("15 hrs · 3 naps" under "3–4"): its own field, so it can be edited. */
          { key: `cubeunit-${k}`, label: `Cube ${k + 1} line under the number`, value: cb.unit ?? ct.unit,
            set: (x, v) => { const qx = x as CubeSpec; return setContent(qx, { cubes: qx.content.cubes.map((y, j) => (j === k ? { ...y, unit: v } : y)) }); } },
        ]),
      ];
    },
    slots: (s) => (s as CubeSpec).content.cubes.map((q, k): Slot => ({ key: `cube-${k}`, label: `Cube ${k + 1} · ${q.n} ${q.label.join(" ")}`, value: q.asset, kinds: ["character"],
      set: (x, v) => { const qx = x as CubeSpec; return setContent(qx, { cubes: qx.content.cubes.map((y, j) => (j === k ? { ...y, asset: v } : y)) }); } })),
  },
  page: {
    name: "Storybook page",
    defaults: PAGE_DEFAULTS,
    controls: [
      ["textTop", "Text position", 60, 900, 2], ["headingSize", "Heading size", 28, 110, 1], ["headingLeading", "Heading line spacing", 30, 130, 1],
      ["bodySize", "Lines size", 18, 64, 1], ["bodyLeading", "Lines spacing", 22, 90, 1], ["bodyGap", "Space under heading", 0, 100, 1],
      ["margin", "Side margin", 20, 200, 2], ["band", "Paper band height", 0, 900, 2], ["bandFade", "Band fade", 0, 300, 2],
      ["artScale", "Picture zoom", 0.6, 1.6, 0.01], ["artX", "Picture left–right", -400, 400, 2], ["artY", "Picture up–down", -600, 600, 2],
      ["screenW", "Screen width %", 15, 80, 1], ["screenX", "Screen left–right %", 10, 90, 1], ["screenY", "Screen up–down %", 10, 90, 1],
    ],
    fields: (s) => {
      const k = s as PageSpec, ct = k.content;
      return [
        { key: "heading", label: "Heading", value: ct.heading, rows: 2, set: (x, v) => setContent(x as PageSpec, { heading: v }) },
        { key: "body", label: "Lines (new line = new line)", value: ct.body, rows: 3, set: (x, v) => setContent(x as PageSpec, { body: v }) },
      ];
    },
    slots: (s) => {
      const k = s as PageSpec;
      return [
        { key: "art", label: "Picture", value: k.content.art, kinds: ["picture"], set: (x, v) => setContent(x as PageSpec, { art: v }) },
        { key: "screen", label: "App screen (none for no screen)", value: k.content.screen, kinds: ["screen"], set: (x, v) => setContent(x as PageSpec, { screen: v }) },
      ];
    },
  },
  wall: {
    name: "Text wall",
    defaults: WALL_DEFAULTS,
    controls: [
      ["textTop", "Text position", 80, 1500, 2], ["textSize", "Text size", 28, 96, 1], ["leading", "Line spacing", 34, 130, 1],
      ["firstScale", "Headline size ×", 1, 1.8, 0.05], ["paraGap", "Space between lines", 0, 120, 2], ["align", "Left (0) or centred (1)", 0, 1, 1],
      ["margin", "Side margin", 20, 200, 2], ["panel", "Paper panel %", 0, 100, 1], ["panelPad", "Panel padding", 16, 140, 2], ["scrim", "Dark gradient behind the words %", 0, 90, 1], ["wash", "Paper wash over the background %", 0, 100, 1],
      ["artScale", "Background zoom", 1, 1.6, 0.01], ["artX", "Background left–right", -400, 400, 2], ["artY", "Background up–down", -600, 600, 2], ["zoomEnd", "Slow zoom in and out of each scene %", 0, 30, 1],
      ["screenW", "Screen width %", 15, 80, 1], ["screenX", "Screen left–right %", 10, 90, 1], ["screenY", "Screen up–down %", 10, 95, 1],
    ],
    fields: (s) => {
      const k = s as WallSpec;
      return [{ key: "text", label: "The wall (one line per paragraph; start a line with # for the headline, _ for a soft italic line, ! for a bold closing line)", value: k.content.text, rows: 14, set: (x, v) => setContent(x as WallSpec, { text: v }) }];
    },
    slots: (s) => {
      const k = s as WallSpec;
      return [
        { key: "art", label: "Background (none for plain paper)", value: k.content.art, kinds: ["picture"], set: (x, v) => setContent(x as WallSpec, { art: v }) },
        { key: "art2", label: "Second background (fades in; none for no second)", value: k.content.art2 ?? "", kinds: ["picture"], set: (x, v) => setContent(x as WallSpec, { art2: v }) },
        { key: "art3", label: "Third background (fades in; none for no third)", value: k.content.art3 ?? "", kinds: ["picture"], set: (x, v) => setContent(x as WallSpec, { art3: v }) },
        { key: "art4", label: "Fourth background (fades in; none for no fourth)", value: k.content.art4 ?? "", kinds: ["picture"], set: (x, v) => setContent(x as WallSpec, { art4: v }) },
        { key: "screen", label: "App screen (none for no screen)", value: k.content.screen, kinds: ["screen"], set: (x, v) => setContent(x as WallSpec, { screen: v }) },
      ];
    },
  },
  list: {
    name: "List card",
    defaults: LIST_DEFAULTS,
    controls: [
      ["headingTop", "Heading position", 110, 400, 2], ["headingSize", "Heading size", 32, 100, 1], ["headingLeading", "Heading line spacing", 36, 110, 1], ["subSize", "Tag size", 20, 48, 1],
      ["listGap", "Space above the list", 10, 140, 2], ["rowGap", "Space between items", 6, 70, 1], ["rowPad", "Item inner margin", 10, 60, 1],
      ["titleSize", "Item title size", 24, 64, 1], ["lineSize", "Item line size", 18, 48, 1], ["badge", "Number (0), tick (1), none (2)", 0, 2, 1],
      ["margin", "Card margin", 20, 120, 2], ["pad", "Inner margin", 20, 100, 2],
      ["artSize", "Picture size", 120, 560, 4], ["artX", "Picture left–right %", 10, 90, 1], ["artBottom", "Picture sits higher", 0, 300, 2], ["footerSize", "Footer size", 16, 40, 1],
    ],
    fields: (s) => {
      const k = s as ListSpec, ct = k.content;
      return [
        { key: "heading", label: "Heading", value: ct.heading, rows: 2, set: (x, v) => setContent(x as ListSpec, { heading: v }) },
        { key: "sub", label: "Tag under the heading (empty for none)", value: ct.sub, set: (x, v) => setContent(x as ListSpec, { sub: v }) },
        ...ct.items.map((it, i): Field => ({ key: `item-${i}`, label: `Item ${i + 1} (title | line)`, value: `${it.title} | ${it.line}`,
          set: (x, v) => { const lx = x as ListSpec; const j = v.indexOf("|"); const [ti, li] = j < 0 ? [v, ""] : [v.slice(0, j), v.slice(j + 1)];
            return setContent(lx, { items: lx.content.items.map((y, q) => (q === i ? { title: ti.trim(), line: li.trim() } : y)) }); } })),
        { key: "footer", label: "Footer (empty for none)", value: ct.footer, set: (x, v) => setContent(x as ListSpec, { footer: v }) },
      ];
    },
    slots: (s) => {
      const k = s as ListSpec;
      return [{ key: "art", label: "Picture (none for no picture)", value: k.content.art, kinds: ["character", "icon"], set: (x, v) => setContent(x as ListSpec, { art: v }) }];
    },
  },
  clips: {
    name: "App clips",
    defaults: CLIPS_DEFAULTS,
    controls: [
      ["titleTop", "Title position", 60, 500, 2], ["titleSize", "Title size", 30, 90, 1], ["stepSize", "Step chip size", 18, 48, 1],
      ["labelSize", "Clip name size", 34, 96, 1], ["labelBottom", "Name sits higher", 300, 900, 4], ["capSize", "Line size", 22, 60, 1], ["capGap", "Space name to line", 4, 60, 1],
      ["margin", "Side margin", 20, 160, 2], ["shade", "Top and bottom shading %", 0, 80, 1], ["secs", "Seconds per clip (0: the whole video)", 0, 20, 0.5],
      ["frame", "Framed (1) or full frame (0)", 0, 1, 1], ["winTop", "Window top", 200, 700, 2], ["winH", "Window height", 500, 1200, 2], ["winMargin", "Window side margin", 20, 200, 2],
      ["barTop", "Name bar top", 60, 400, 2], ["barH", "Name bar height", 70, 180, 2], ["introSecs", "Intro seconds", 1, 8, 0.5], ["outroSecs", "End card seconds", 1, 8, 0.5], ["hook", "Intro: video hook (1) or plain card (0)", 0, 1, 1], ["hookTitleSize", "Hook title size", 60, 150, 1], ["hookTitleLift", "Hook title: space above the window bottom", 20, 400, 2], ["hookShade", "Hook dimmer under the title %", 0, 90, 1], ["hookLineSize", "Hook line size (under the video)", 28, 80, 1],
    ],
    fields: (s) => {
      const k = s as ClipsSpec, ct = k.content;
      return [
        { key: "title", label: "Title", value: ct.title, rows: 2, set: (x, v) => setContent(x as ClipsSpec, { title: v }) },
        { key: "intro", label: "Intro (tag | title | line | bold line | music file from assets/music, one per line)", value: [ct.intro?.tag ?? "", ct.intro?.title ?? ct.title, ct.intro?.line ?? "", ct.intro?.bold ?? "", ct.intro?.music ?? ""].join("\n"), rows: 4,
          set: (x, v) => { const [tag = "", title = "", line = "", bold = "", music = ""] = v.split("\n"); return setContent(x as ClipsSpec, { intro: { tag, title, line, bold, ...((x as ClipsSpec).content.intro?.voice ? { voice: (x as ClipsSpec).content.intro?.voice } : {}), ...(music.trim() ? { music: music.trim() } : {}) } }); } },
        { key: "outro", label: "End card (title | line, one per line); the callout sits on it", value: [ct.outro?.title ?? "", ct.outro?.line ?? ""].join("\n"), rows: 2,
          set: (x, v) => { const [title = "", line = ""] = v.split("\n"); return setContent(x as ClipsSpec, { outro: { title, line } }); } },
        ...ct.items.map((it, i): Field => ({ key: `clip-${i}`, label: `Clip ${i + 1} (name | line)`, value: `${it.label} | ${it.caption}`,
          set: (x, v) => { const cx = x as ClipsSpec; const j = v.indexOf("|"); const [la, ca] = j < 0 ? [v, ""] : [v.slice(0, j), v.slice(j + 1)];
            return setContent(cx, { items: cx.content.items.map((y, q) => (q === i ? { ...y, label: la.trim(), caption: ca.trim() } : y)) }); } })),
      ];
    },
    slots: () => [],
    blocks: (s) => (s as ClipsSpec).content.items.map((it, i) => ({ id: `clip-${i}`, label: `Clip ${i + 1}: ${it.label}` })),
  },
  card: {
    name: "Reasons card",
    defaults: CARD_DEFAULTS,
    controls: [
      ["textTop", "Text position", 80, 500, 2], ["headingSize", "Heading size", 34, 96, 1], ["headingLeading", "Heading line spacing", 36, 110, 1],
      ["bodySize", "Body size", 22, 56, 1], ["bodyLeading", "Body line spacing", 26, 80, 1], ["bodyGap", "Space under heading", 0, 90, 1],
      ["pad", "Inner margin", 24, 120, 2], ["margin", "Card margin", 20, 120, 2], ["artSize", "Picture size", 200, 900, 4],
      ["artBottom", "Picture sits higher", 0, 500, 2], ["artX", "Picture left–right", 20, 80, 1], ["insetSize", "Inset size", 100, 300, 2],
      ["footerSize", "Footer size", 16, 40, 1],
    ],
    fields: (s) => {
      const k = s as CardSpec, ct = k.content;
      return [
        { key: "heading", label: "Heading", value: ct.heading, rows: 2, set: (x, v) => setContent(x as CardSpec, { heading: v }) },
        { key: "body", label: "Body", value: ct.body, rows: 3, set: (x, v) => setContent(x as CardSpec, { body: v }) },
        { key: "footer", label: "Footer handle (empty for none)", value: ct.footer, set: (x, v) => setContent(x as CardSpec, { footer: v }) },
      ];
    },
    slots: (s) => {
      const k = s as CardSpec;
      return [
        { key: "art", label: "Picture", value: k.content.art, kinds: ["character", "icon"], set: (x, v) => setContent(x as CardSpec, { art: v }) },
        { key: "inset", label: "Inset (none for no circle)", value: k.content.inset, kinds: ["icon", "tile"], set: (x, v) => setContent(x as CardSpec, { inset: v }) },
      ];
    },
  },
};

/* ---------------------------------------------------------------- draw */

/** The spec as drawn for one platform: the Instagram variant's size, values and moves over the base. */
export function forPlatform(spec: Spec, platform: Platform = "tiktok"): Spec {
  const v = platform === "instagram" ? spec.variants?.instagram : undefined;
  if (!v) return spec;
  return { ...spec, size: v.size, params: { ...spec.params, ...(v.params ?? {}) }, nudge: v.nudge ?? {} } as Spec;
}

/**
 * Lay out a spec. `assets` gives each asset's size; `href` gives the URL (the
 * browser) or the data URI (the renderer) an <image> points at; `t` is the
 * time in seconds for a frame of the animation (null: the still, everything in place).
 */
export function draw(spec: Spec, assets: Record<string, Asset>, href: (a: Asset) => string, t: number | null = null, o: { focus?: number; overlay?: boolean } = {}): Drawn {
  const els: Placed[] = [];
  const c = makeCtx(spec, assets, href, t, els, o.focus ?? 0, !!o.overlay);
  const end = spec.template === "hub" ? drawHub(spec, c) : spec.template === "cube" ? drawCube(spec, c) : spec.template === "card" ? drawCard(spec, c) : spec.template === "page" ? drawPage(spec, c)
    : spec.template === "wall" ? drawWall(spec, c) : spec.template === "list" ? drawList(spec, c) : spec.template === "clips" ? drawClips(spec, c) : 0;
  /* Where the design ends, moves included: the editor warns when the callout would sit on it. A card's picture is
   * meant to share its lower half with the callout, so a card ends where its words end. */
  const contentEnd = spec.template === "card" || spec.template === "page" ? Math.max(end, ...els.filter((e) => e.id === "heading" || e.id === "body").map((e) => e.y + e.h))
    : spec.template === "wall" || spec.template === "list" || spec.template === "clips" ? end : Math.max(end, ...els.map((e) => e.y + e.h));
  return { width: c.W, height: c.H, elements: els, contentEnd, bg: c.st.bg };
}

/** The whole picture as one SVG document. */
export function toSvg(d: Drawn, o: { lock?: boolean; clear?: boolean } = {}): string {
  /* lock: the text lock of a model-animated video — every element but the moving pictures and what lies under them,
   * on a transparent page, pasted over each generated frame so no word or cube face can drift. */
  const els = o.lock ? d.elements.filter((e) => !e.moving && !e.under) : d.elements;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}">${o.lock || o.clear ? "" : `<rect width="${d.width}" height="${d.height}" fill="${d.bg}"/>`}${els.map((e) => e.svg).join("")}</svg>`;
}

/* ---------------------------------------------------------------- parse */

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const calloutOf = (v: unknown): Callout | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const c = v as Callout;
  return { headline: String(c.headline ?? ""), line: String(c.line ?? ""), ...(c.kind === "phone" ? { kind: "phone" as const } : c.kind === "store" ? { kind: "store" as const, variant: [1, 2, 3, 4].includes(Number(c.variant)) ? Number(c.variant) : 1 } : {}),
    ...(typeof c.button === "string" && c.button ? { button: c.button } : {}), ...(typeof c.screen === "string" && c.screen ? { screen: c.screen } : {}) };
};

/** A spec is read from disk and posted by the editor: check its shape before it is drawn or saved. */
/** A callout from outside (the App callout field): its words and its look, nothing else. */
export function parseCallout(v: unknown): Callout | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const str = (x: unknown, n = 120) => (typeof x === "string" ? x.slice(0, n) : undefined);
  const headline = str(o.headline), line = str(o.line);
  if (headline === undefined || line === undefined) return null;
  const kind = o.kind === "phone" || o.kind === "store" || o.kind === "peach" ? o.kind : undefined;
  const variant = typeof o.variant === "number" && o.variant >= 1 && o.variant <= 9 ? Math.round(o.variant) : undefined;
  const screen = typeof o.screen === "string" && /^[\w-]{1,80}$/.test(o.screen) ? o.screen : undefined;
  const button = str(o.button, 60);
  return { headline, line, ...(kind ? { kind } : {}), ...(variant ? { variant } : {}), ...(screen ? { screen } : {}), ...(button !== undefined ? { button } : {}) };
}

export function parseSpec(v: unknown): Spec | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown> & { content?: Record<string, unknown> };
  if (!Array.isArray(s.size) || s.size.length !== 2 || !s.content || typeof s.content !== "object") return null;
  const tpl = s.template as TemplateName;
  if (!TEMPLATES[tpl]) return null;
  const c = s.content;
  const a = s.anim as Anim | undefined;
  const base = {
    version: 1 as const, size: [Number(s.size[0]), Number(s.size[1])] as [number, number],
    style: (s.style && typeof s.style === "object" ? s.style : {}) as Partial<Style>,
    nudge: (s.nudge && typeof s.nudge === "object" ? s.nudge : {}) as Record<string, Nudge>,
    ...(a && typeof a === "object" && ["none", "pop", "float", "pop-float", "drift"].includes(a.kind) ? { anim: { kind: a.kind, duration: num(a.duration, 6), stagger: num(a.stagger, 0.12) } } : {}),
    ...(Array.isArray(s.hidden) && s.hidden.length ? { hidden: strs(s.hidden) } : {}),
    ...(s.variants && typeof s.variants === "object" ? { variants: s.variants as Spec["variants"] } : {}),
    ...(typeof s.motion === "string" && s.motion.trim() ? { motion: s.motion } : {}),
  };
  const params = { ...TEMPLATES[tpl].defaults, ...((s.params && typeof s.params === "object" ? s.params : {}) as object) };
  const callout = calloutOf(c.callout);
  if (tpl === "hub") {
    if (!Array.isArray(c.items) || typeof c.center !== "string") return null;
    return { ...base, template: "hub", params: params as HubParams, content: {
      title: strs(c.title), definition: Array.isArray(c.definition) ? (c.definition as unknown[][]).map((d) => [String(d[0] ?? ""), String(d[1] ?? "")] as [string, string]) : [],
      center: c.center, items: (c.items as Record<string, unknown>[]).map((i) => ({ asset: String(i.asset ?? ""), label: strs(i.label) })), bubble: String(c.bubble ?? ""),
      ...(callout ? { callout } : {}) } };
  }
  if (tpl === "cube") {
    if (!Array.isArray(c.cubes)) return null;
    return { ...base, template: "cube", params: params as CubeParams, content: {
      title: strs(c.title), pill: String(c.pill ?? ""), unit: String(c.unit ?? "months"),
      cubes: (c.cubes as Record<string, unknown>[]).map((q) => ({ n: String(q.n ?? ""), label: strs(q.label), asset: String(q.asset ?? ""), ...(typeof q.unit === "string" ? { unit: q.unit } : {}) })),
      ...(Array.isArray(c.blocks) && c.blocks.length ? { blocks: strs(c.blocks) } : {}),
      ...(typeof c.logo === "string" && c.logo ? { logo: c.logo } : {}),
      ...(callout ? { callout } : {}) } };
  }
  if (tpl === "wall") {
    return { ...base, template: "wall", params: params as WallParams, content: { text: String(c.text ?? ""), art: String(c.art ?? ""), screen: String(c.screen ?? ""), ...(typeof c.video === "string" && c.video ? { video: c.video } : {}), ...(typeof c.art2 === "string" && c.art2 ? { art2: c.art2 } : {}), ...(typeof c.art3 === "string" && c.art3 ? { art3: c.art3 } : {}), ...(typeof c.art4 === "string" && c.art4 ? { art4: c.art4 } : {}), ...(callout ? { callout } : {}) } };
  }
  if (tpl === "list") {
    return { ...base, template: "list", params: params as ListParams, content: {
      heading: String(c.heading ?? ""), sub: String(c.sub ?? ""), art: String(c.art ?? ""), screen: String(c.screen ?? ""), footer: String(c.footer ?? ""),
      items: Array.isArray(c.items) ? (c.items as Record<string, unknown>[]).map((i) => ({ title: String(i.title ?? ""), line: String(i.line ?? "") })) : [],
      ...(callout ? { callout } : {}) } };
  }
  if (tpl === "clips") {
    return { ...base, template: "clips", params: params as ClipsParams, content: {
      title: String(c.title ?? ""),
      items: Array.isArray(c.items) ? (c.items as Record<string, unknown>[]).map((i) => ({ label: String(i.label ?? ""), caption: String(i.caption ?? ""), video: String(i.video ?? ""), thumb: String(i.thumb ?? ""), ...(typeof i.start === "number" ? { start: i.start } : {}) })) : [],
      ...(c.intro && typeof c.intro === "object" ? { intro: { tag: String((c.intro as Record<string, unknown>).tag ?? ""), title: String((c.intro as Record<string, unknown>).title ?? ""), line: String((c.intro as Record<string, unknown>).line ?? ""), bold: String((c.intro as Record<string, unknown>).bold ?? ""), ...(typeof (c.intro as Record<string, unknown>).voice === "string" && (c.intro as Record<string, unknown>).voice ? { voice: String((c.intro as Record<string, unknown>).voice) } : {}), ...(typeof (c.intro as Record<string, unknown>).music === "string" && (c.intro as Record<string, unknown>).music ? { music: String((c.intro as Record<string, unknown>).music) } : {}) } } : {}),
      ...(c.outro && typeof c.outro === "object" ? { outro: { title: String((c.outro as Record<string, unknown>).title ?? ""), line: String((c.outro as Record<string, unknown>).line ?? "") } } : {}),
      ...(callout ? { callout } : {}) } };
  }
  if (tpl === "page") {
    return { ...base, template: "page", params: params as PageParams, content: {
      heading: String(c.heading ?? ""), body: String(c.body ?? ""), art: String(c.art ?? ""), screen: String(c.screen ?? ""),
      ...(callout ? { callout } : {}) } };
  }
  return { ...base, template: "card", params: params as CardParams, content: {
    heading: String(c.heading ?? ""), body: String(c.body ?? ""), art: String(c.art ?? ""), inset: String(c.inset ?? ""),
    footer: String(c.footer ?? ""), cover: !!c.cover, ...(callout ? { callout } : {}) } };
}

/** The asset registry by id. */
export const byId = (list: Asset[]) => Object.fromEntries(list.map((a) => [a.id, a]));

/* ------------------------------------------------------------ the callout */

/**
 * What an app's callouts say and show (lib/brand.ts reads it): the store title and tagline (the listing's), the short
 * name and line of the logo-and-text and phone callouts, the store button, the app screens a phone callout can show
 * (asset ids of brand/assets, with a name), and saved wordings of the logo-and-text callout ([bold line, second line, name]).
 */
export type BrandCallout = { title: string; tagline: string; name: string; line: string; button: string; screens: [string, string][]; wordings: [string, string, string][] };
export const EMPTY_BRAND_CALLOUT: BrandCallout = { title: "", tagline: "", name: "", line: "", button: "", screens: [], wordings: [] };

/** The callout card's size: the compositor's card (834 × 204, 139:34), so it drops into the same slot as the App Store card. */
export const CALLOUT_W = 834, CALLOUT_H = 204;
export const CALLOUT_RATIO = CALLOUT_H / CALLOUT_W;

/**
 * The logo-and-text callout: the app icon, a bold line
 * and a second line, each fitted to one line by shrinking its size. The editor
 * draws it live; the store renders the same SVG to cards/1-custom.png.
 */
export function calloutSvg(c: Callout, iconHref: string, style: Partial<Style> = {}, screenHref = ""): string {
  const st = { ...DEFAULT_STYLE, ...style };
  if (c.kind === "phone") return phoneCalloutSvg(c, iconHref, screenHref, st);
  if (c.kind === "store") return storeCalloutSvg(c, iconHref, screenHref, st);
  const X = 162, room = CALLOUT_W - X - 30;
  /* The rounded bold face runs about 0.5 em a character, the regular body face about 0.47. */
  const fit = (t: string, max: number, k: number) => Math.max(18, Math.min(max, Math.floor(room / Math.max(1, t.length * k))));
  const s1 = fit(c.headline, 44, 0.52), s2 = fit(c.line, 36, 0.47);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CALLOUT_W}" height="${CALLOUT_H}" viewBox="0 0 ${CALLOUT_W} ${CALLOUT_H}">
<defs><clipPath id="ic"><rect x="24" y="40" width="124" height="124" rx="28"/></clipPath></defs>
<rect x="3" y="3" width="${CALLOUT_W - 6}" height="${CALLOUT_H - 6}" rx="44" fill="${st.calloutFill}" stroke="${st.calloutLine}" stroke-width="4"/>
<image href="${iconHref}" x="24" y="40" width="124" height="124" clip-path="url(#ic)" preserveAspectRatio="xMidYMid slice"/>
<text x="${X}" y="${c.line ? 92 : 114}" font-family="${esc(st.font)}" font-weight="800" font-size="${s1}" fill="${st.calloutInk}">${esc(c.headline)}</text>
${c.line ? `<text x="${X}" y="142" font-family="${esc(st.bodyFont)}" font-size="${s2}" fill="${st.calloutSoft}">${esc(c.line)}</text>` : ""}
</svg>`;
}

/**
 * The phone callout: the top of a phone showing the app,
 * cut off by the card's lower edge; the app's name in the accent, one line under it, and a store button. Drawn on a
 * clear page so it sits on any card; same 834 × 204 slot as the logo-and-text callout.
 */
function phoneCalloutSvg(c: Callout, iconHref: string, screenHref: string, st: Style): string {
  const X = 262, room = CALLOUT_W - X - 36;
  const fit = (tx: string, max: number, k: number) => Math.max(18, Math.min(max, Math.floor(room / Math.max(1, tx.length * k))));
  const logo = iconHref ? 58 : 0, hx = X + (logo ? logo + 14 : 0);
  const s1 = Math.max(18, Math.min(52, Math.floor((room - (logo ? logo + 14 : 0)) / Math.max(1, c.headline.length * 0.55)))), s2 = fit(c.line, 32, 0.47), btn = c.button || "Download on the App Store";
  const bs = fit(btn, 27, 0.5), bw = Math.min(room, Math.round(btn.length * bs * 0.5 + 100));
  const sx = 44, sw = 178, sy = 18, bez = 9;
  const screen = screenHref
    ? `<rect x="${sx + bez}" y="${sy + bez}" width="${sw - 2 * bez}" height="360" fill="#FFFFFF" clip-path="url(#ps)"/><image href="${screenHref}" x="${sx + bez}" y="${sy + bez}" width="${sw - 2 * bez}" height="360" clip-path="url(#ps)" preserveAspectRatio="xMidYMin meet"/>`
    : `<rect x="${sx + bez}" y="${sy + bez}" width="${sw - 2 * bez}" height="360" fill="${st.cream}" clip-path="url(#ps)"/>${iconHref ? `<image href="${iconHref}" x="${sx + sw / 2 - 34}" y="${sy + 60}" width="68" height="68" preserveAspectRatio="xMidYMid slice"/>` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CALLOUT_W}" height="${CALLOUT_H}" viewBox="0 0 ${CALLOUT_W} ${CALLOUT_H}">
<defs><clipPath id="ps"><rect x="${sx + bez}" y="${sy + bez}" width="${sw - 2 * bez}" height="360" rx="26"/></clipPath>
<clipPath id="pc"><rect x="3" y="3" width="${CALLOUT_W - 6}" height="${CALLOUT_H - 6}" rx="44"/></clipPath></defs>
<rect x="3" y="3" width="${CALLOUT_W - 6}" height="${CALLOUT_H - 6}" rx="44" fill="${st.bubbleFill}" stroke="${st.calloutLine}" stroke-width="4"/>
<g clip-path="url(#pc)"><rect x="${sx}" y="${sy}" width="${sw}" height="380" rx="38" fill="#1F1B18"/>
${screen}</g>
${logo ? `<clipPath id="plg"><rect x="${X}" y="24" width="${logo}" height="${logo}" rx="14"/></clipPath><image href="${iconHref}" x="${X}" y="24" width="${logo}" height="${logo}" clip-path="url(#plg)" preserveAspectRatio="xMidYMid slice"/>` : ""}
<text x="${hx}" y="${c.line ? 70 : 100}" font-family="${esc(st.font)}" font-weight="800" font-size="${s1}" fill="${st.accent}">${esc(c.headline)}</text>
${c.line ? `<text x="${X}" y="120" font-family="${esc(st.bodyFont)}" font-size="${s2}" fill="${st.soft}">${esc(c.line)}</text>` : ""}
<rect x="${X}" y="138" width="${bw}" height="56" rx="28" fill="${st.accent}"/>
<path d="M${X + 30} 156 v14 m-7 -7 l7 7 l7 -7 M${X + 22} 178 h16" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<text x="${X + 56}" y="176" font-family="${esc(st.font)}" font-weight="700" font-size="${bs}" fill="#fff">${esc(btn)}</text>
</svg>`;
}

/* ------------------------------------------------------------ the store-listing callout */

/** The Apple logo (Simple Icons, CC0), 24 × 24. */
const APPLE_PATH = "M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z";

/** A store badge: a black rounded button with only the store's mark (drawn, not the stores' own artwork). */
function badge(x: number, y: number, w: number, h: number, store: "apple" | "play", st: Style, onDark = false, text = false): string {
  const fill = onDark ? "#FFFFFF" : "#0B0B0C", ink = onDark ? "#0B0B0C" : "#FFFFFF";
  let mark: string;
  const mx = text ? x + 12 : 0;
  if (store === "apple") {
    const k = (0.52 * h) / 24;
    mark = `<g transform="translate(${text ? mx : x + (w - 24 * k) / 2} ${y + (h - 24 * k) / 2}) scale(${k})"><path d="${APPLE_PATH}" fill="${ink}"/></g>`;
  } else {
    const k = (0.5 * h) / 20;
    mark = `<g transform="translate(${(text ? mx + 3 * k : x + (w - 18.5 * k) / 2) - 3 * k} ${y + (h - 20 * k) / 2 - 2 * k}) scale(${k})"><polygon points="3,2 12.2,12 3,22" fill="#00A0FF"/><polygon points="3,2 15,8.5 12.2,12" fill="#00E27C"/><polygon points="15,8.5 21.5,12 15,15.5 12.2,12" fill="#FFCE00"/><polygon points="3,22 12.2,12 15,15.5" fill="#F4433B"/></g>`;
  }
  const s = h / 54, l1 = store === "apple" ? "Download on the" : "GET IT ON", l2 = store === "apple" ? "App Store" : "Google Play";
  const words = text ? `<text x="${x + 58 * s}" y="${y + 21 * s}" font-family="${esc(st.bodyFont)}" font-size="${12.5 * s}" fill="${ink}">${l1}</text><text x="${x + 58 * s}" y="${y + 43 * s}" font-family="${esc(st.font)}" font-weight="700" font-size="${(store === "apple" ? 26 : 22) * s}" fill="${ink}">${l2}</text>` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.28}" fill="${fill}" stroke="${onDark ? "none" : "#A6A6A6"}" stroke-width="1.5"/>${mark}${words}`;
}

const stars = (x: number, y: number, size: number, fill: string) => Array.from({ length: 5 }, (_, i) =>
  `<path transform="translate(${x + i * size * 1.12} ${y}) scale(${size / 24})" d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5l-6.3 3.7 1.5-7.1L1.8 9.2 9 8.4z" fill="${fill}"/>`).join("");

/**
 * The store-listing callout, three looks (834 × 204, the callout slot):
 *   1 white listing row: the app icon, the title, the tagline, the rating, the two store badges;
 *   2 the brand's callout colour, an app screen cropped on the left with the logo on it, the title, the tagline, the two badges;
 *   3 the brand's gradient, the icon, the title and tagline in white, the two badges as white pills.
 *   4 as 1, but the badges carry the store names ("Download on the App Store", "GET IT ON Google Play").
 * Versions 1–3 show the two store logos only; none shows a rating or a price.
 * headline = the store title, line = the tagline (the listing's subtitle: product.json, lib/brand.ts).
 */
function storeCalloutSvg(c: Callout, iconHref: string, screenHref: string, st: Style): string {
  const v = c.variant ?? 1, W = CALLOUT_W, H = CALLOUT_H;
  const title = c.headline, tag = c.line;
  const dark = v === 3, ink = dark ? "#FFFFFF" : st.calloutInk, soft = dark ? "rgba(255,255,255,0.88)" : st.calloutSoft;
  const bg = v === 1 || v === 4 ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="40" fill="#FFFFFF" stroke="#E4DAD3" stroke-width="3"/>`
    : v === 2 ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="40" fill="${st.calloutFill}" stroke="${st.calloutLine}" stroke-width="3"/>`
    : `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="40" fill="url(#og)"/>`;
  const icon = (x: number, y: number, s: number) => iconHref ? `<clipPath id="ic${x}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.225}"/></clipPath><image href="${iconHref}" x="${x}" y="${y}" width="${s}" height="${s}" clip-path="url(#ic${x})" preserveAspectRatio="xMidYMid slice"/><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.225}" fill="none" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>` : "";
  const X = v === 2 ? 236 : 208, room = W - X - 28;
  const fit = (tx: string, max: number, k: number) => Math.max(16, Math.min(max, Math.floor(room / Math.max(1, tx.length * k))));
  let left = "";
  if (v === 2) {
    /* an app screen, cropped to its top and cut by the card's lower edge, the logo on its corner */
    left = `<clipPath id="pcl"><rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="40"/></clipPath><g clip-path="url(#pcl)"><rect x="30" y="26" width="170" height="300" rx="34" fill="#1F1B18"/>`
      + (screenHref ? `<clipPath id="psc"><rect x="38" y="34" width="154" height="290" rx="27"/></clipPath><rect x="38" y="34" width="154" height="290" fill="#FFFFFF" clip-path="url(#psc)"/><image href="${screenHref}" x="38" y="34" width="154" height="290" clip-path="url(#psc)" preserveAspectRatio="xMidYMin meet"/>` : `<rect x="38" y="34" width="154" height="290" rx="27" fill="${st.cream}"/>`)
      + `</g>${icon(150, 12, 62)}`;
  } else left = icon(30, 27, 150);
  const s1 = fit(title, 34, 0.53), s2 = fit(tag, 26, 0.47);
  const named = v === 4, bw = named ? 196 : 104, bh = named ? 54 : 58, by = v === 2 ? 126 : named ? 124 : 120;
  const badges = badge(X, by, bw, bh, "apple", st, dark, named) + badge(X + bw + 14, by, bw, bh, "play", st, dark, named);
  const titleY = v === 2 ? 56 : 66, tagY = titleY + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${st.gradFrom}"/><stop offset="1" stop-color="${st.gradTo}"/></linearGradient></defs>
${bg}${left}
<text x="${X}" y="${titleY}" font-family="${esc(st.font)}" font-weight="800" font-size="${s1}" fill="${ink}">${esc(title)}</text>
<text x="${X}" y="${tagY}" font-family="${esc(st.bodyFont)}" font-size="${s2}" fill="${soft}">${esc(tag)}</text>
${badges}
</svg>`;
}
