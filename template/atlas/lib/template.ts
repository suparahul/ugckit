/**
 * The template of a post: two parameters, decided per plan row.
 *
 *   format   what gets published: slideshow · reel · image (a single image)
 *   style    what it looks like, depends on the format (stored key → name shown). The kit's own:
 *              slideshow → photo (Photo story) · illustrated (Illustrated) · design (Design pages) · other
 *              reel      → hub (Hub card) · cube (Cube chart) · wall (Text wall) · clips (App clips) · other
 *              image     → hub · cube · card (Card) · other
 *            An app adds its own looks in apps/<slug>/brand/style.json ("styles", lib/brand.ts): they come
 *            first in the dropdown, and a key the kit has too takes the app's name and line.
 *
 * The plan cell may use the shown name (`slideshow · photo story`) or the stored key; both read.
 * A slideshow is always a slideshow in the plan: its Instagram leg as a reel of the same slides is
 * the post page's per-platform picker, not a template.
 *
 * hub, cube, card, wall, clips and the design pages are the templates of lib/infographic.ts (the
 * `infographic` skill); photo and illustrated are decks of generated pictures (the `images` skill).
 *
 * A handle format file (apps/<slug>/handles/<handle>/formats/<name>.md) is not
 * a choice in the studio: it is the recipe the deck skill reads when the post's
 * template matches it. It declares its template on a `Template: reel · cube`
 * line, else by RECIPE_DEFAULTS.
 *
 * The plan's `Template` column (the last one, found by its header) is the
 * default: `<format> · <style>` (`·` or `/`, any case; "single image" reads too).
 * The older values still read: the three-part triples and the single words
 * (LEGACY). A `template.set` line in the log, written from the studio's two
 * dropdowns, overrides it, and the latest line wins. Blank means not decided.
 * The line carries the deck's hash when a deck existed: while the deck still has
 * that hash, the deck was written for the old template and must be rewritten.
 *
 * Isomorphic and pure: no node imports, so the client dropdowns, the build
 * script and the tests share it. Every function that checks a style takes the
 * app's style set (stylesWith); without it, the kit's own.
 */

export const FORMATS = ["slideshow", "reel", "image"] as const;
export type Format = (typeof FORMATS)[number];
export const FORMAT_LABEL: Record<Format, string> = { slideshow: "Slideshow", reel: "Reel", image: "Single image" };

/** One look a format allows: its stored key, the name shown, and one line on what the viewer sees. */
export type StyleOption = { key: string; label: string; desc?: string };
/** The looks of each format, in the dropdown's order: the first is the default. */
export type StyleSet = Record<Format, StyleOption[]>;

const OTHER: StyleOption = { key: "other", label: "Other", desc: "Anything else; say what in the plan row" };
export const DEFAULT_STYLES: StyleSet = {
  slideshow: [
    { key: "photo", label: "Photo story", desc: "Slideshow of generated photos, one line of text burned in on each slide" },
    { key: "illustrated", label: "Illustrated", desc: "Slideshow of generated drawings with the words drawn into the picture" },
    { key: "design", label: "Design pages", desc: "Slideshow of template pages (page, list or card), every word and size editable" },
    OTHER,
  ],
  reel: [
    { key: "hub", label: "Hub card", desc: "Reel: one card, a picture in the middle and eight items around it, held as a video" },
    { key: "cube", label: "Cube chart", desc: "Reel: one animated chart of cubes, a number, a unit and a label on each" },
    { key: "wall", label: "Text wall", desc: "Reel: about 6 seconds, the whole text on screen at once over one background (still or gently moving)" },
    { key: "clips", label: "App clips", desc: "Reel: three to five short videos with a name and a line over each" },
    OTHER,
  ],
  image: [
    { key: "hub", label: "Hub card", desc: "A single card, a picture in the middle and eight items around it" },
    { key: "cube", label: "Cube chart", desc: "A single chart of cubes" },
    { key: "card", label: "Card", desc: "A single designed card" },
    OTHER,
  ],
};

/** The kit's looks with an app's own (lib/brand.ts): the app's first, then the kit's it does not name, "other" last. */
export function stylesWith(extra?: Partial<Record<Format, StyleOption[]>> | null): StyleSet {
  if (!extra) return DEFAULT_STYLES;
  const out = {} as StyleSet;
  for (const f of FORMATS) {
    const mine = (extra[f] ?? []).filter((o) => o && typeof o.key === "string" && o.key && o.key !== "other").map((o) => ({ key: o.key, label: String(o.label || o.key), ...(o.desc ? { desc: String(o.desc) } : {}) }));
    const keys = new Set(mine.map((o) => o.key));
    out[f] = [...mine, ...DEFAULT_STYLES[f].filter((o) => !keys.has(o.key))];
  }
  return out;
}

const keysOf = (styles: StyleSet, f: Format) => styles[f].map((o) => o.key);
/** The name shown for a style key, from any format of the set. */
export function styleLabel(style: string, styles: StyleSet = DEFAULT_STYLES): string {
  for (const f of FORMATS) { const o = styles[f].find((x) => x.key === style); if (o) return o.label; }
  return style;
}

export type Template = { format: Format; style: string };
/** A handle format file as a recipe: its name and the template it makes. */
export type Recipe = { name: string; template: Template };

/** The recipes a format file names by default, when it has no `Template:` line. */
export const RECIPE_DEFAULTS: Record<string, Template> = { "cube-chart-video": { format: "reel", style: "cube" } };

/** The older values of the Template column: the single words and the styles of the three-part model. */
const LEGACY_WORD: Record<string, Template> = {
  hub: { format: "reel", style: "hub" },
  cube: { format: "reel", style: "cube" },
  card: { format: "image", style: "card" },
  photos: { format: "slideshow", style: "photo" },
  photo: { format: "slideshow", style: "photo" },
  "cube-chart-video": { format: "reel", style: "cube" },
};

export function validTemplate(t: { format?: unknown; style?: unknown } | null | undefined, styles: StyleSet = DEFAULT_STYLES): t is Template {
  return !!t && typeof t.format === "string" && typeof t.style === "string" && (FORMATS as readonly string[]).includes(t.format) && keysOf(styles, t.format as Format).includes(t.style);
}

/** A format chosen: its first style, unless the current style is valid there too. */
export function withFormat(t: Template | null, format: Format, styles: StyleSet = DEFAULT_STYLES): Template {
  return { format, style: t && keysOf(styles, format).includes(t.style) ? t.style : styles[format][0].key };
}

/** `reel · cube`: the log's `from`, the grid's label. */
export const templateWord = (t: Template | null) => (t ? `${t.format} · ${t.style}` : "");
/** `Reel · Cube chart`, for reading. */
export const templateLabel = (t: Template | null, styles: StyleSet = DEFAULT_STYLES) => (t ? `${FORMAT_LABEL[t.format]} · ${styleLabel(t.style, styles)}` : "not decided");
export const sameTemplate = (a: Template | null, b: Template | null) => templateWord(a) === templateWord(b);

const normFormat = (s: string) => (s === "single image" || s === "single-image" ? "image" : s);
/** A style as the plan may write it, read back to its key: the key itself, its shown name, or either with dashes. */
function normStyle(s: string, styles: StyleSet): string {
  const flat = (x: string) => x.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  for (const f of FORMATS) for (const o of styles[f]) if (flat(o.key) === flat(s) || flat(o.label) === flat(s)) return o.key;
  return s;
}

/** A two-part or an old three-part value, without the bracket. */
function parseParts(body: string, styles: StyleSet): Template | null {
  const parts = body.split(/\s*[·/]\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 2) {
    const t = { format: normFormat(parts[0]), style: normStyle(parts[1], styles) };
    return validTemplate(t, styles) ? t : null;
  }
  if (parts.length === 3) {
    /* The three-part model: format · type · style. */
    const [format, , style] = parts;
    const own = { format: "slideshow", style: normStyle(style, styles) };
    if (validTemplate(own, styles)) return own;
    if (style === "card") return { format: "image", style: "card" };
    if (style === "ugc-video") return { format: "reel", style: "other" };
    if (style === "cube" || style === "hub") return { format: format === "static" ? "image" : "reel", style };
  }
  return null;
}

/**
 * A plan cell as a template and, when it names one, the recipe: `<format> ·
 * <style>`, an old triple, an old word, or a recipe name, with an optional
 * `(<recipe>)` after it. Blank, `—` or anything unreadable is null.
 */
export function readTemplateCell(cell: string | null | undefined, recipes: Recipe[] = [], styles: StyleSet = DEFAULT_STYLES): { template: Template; recipe: string | null } | null {
  const v = (cell ?? "").replace(/[`*]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v || /^[—–-]+$/.test(v)) return null;
  const m = v.match(/^(.*?)\s*\(([\w.-]+)\)\s*$/);
  const body = m ? m[1] : v;
  const named = m ? m[2] : null;
  const parts = parseParts(body, styles);
  if (parts) return { template: parts, recipe: named };
  if (/[·/]/.test(body)) return null;
  const r = recipes.find((x) => x.name === body);
  if (r) return { template: r.template, recipe: r.name };
  const w = LEGACY_WORD[body];
  return w ? { template: { ...w }, recipe: RECIPE_DEFAULTS[body] ? body : null } : null;
}
export const parseTemplate = (cell: string | null | undefined, recipes: Recipe[] = [], styles: StyleSet = DEFAULT_STYLES) => readTemplateCell(cell, recipes, styles)?.template ?? null;

/** A format file's recipe: its `Template:` line, else the default for its name; null when neither. */
export function recipeOf(name: string, text: string | null, styles: StyleSet = DEFAULT_STYLES): Recipe | null {
  const line = text?.match(/^\**Template:?\**:?\s*(.+)$/im)?.[1];
  const t = line ? parseTemplate(line, [], styles) : null;
  const template = t ?? RECIPE_DEFAULTS[name] ?? null;
  return template ? { name, template } : null;
}

/** The recipe for a template: the named one when it still matches, else the first format file that makes it. */
export function recipeFor(t: Template | null, recipes: Recipe[], named: string | null = null): string | null {
  if (!t) return null;
  const n = named ? recipes.find((r) => r.name === named) : null;
  if (n && sameTemplate(n.template, t)) return n.name;
  return recipes.find((r) => sameTemplate(r.template, t))?.name ?? null;
}

export type TemplateLine = { at: string; post?: string; kind: string; hash?: string; data?: Record<string, unknown> };

/** A `template.set` line's template (data.format, data.style); an older line's three parts read too; null when invalid. */
export function lineTemplate(e: TemplateLine, styles: StyleSet = DEFAULT_STYLES): Template | null {
  const d = e.data ?? {};
  const t = { format: d.format, style: d.style };
  if (validTemplate(t, styles)) return t;
  return typeof d.type === "string" && typeof d.format === "string" && typeof d.style === "string" ? parseParts(`${d.format} · ${d.type} · ${d.style}`, styles) : null;
}

export type TemplateState = {
  /** The effective template: the latest `template.set` line, else the plan's column; null when neither says. */
  current: Template | null;
  /** The plan's own `Template` cell, read. */
  plan: Template | null;
  source: "log" | "plan" | null;
  /** The latest `template.set` line: when, and what it replaced (`format · style`, "" for none). */
  at: string | null;
  from: string | null;
  /** The template changed after the deck was written and the deck has not been rewritten since. */
  rewrite: boolean;
  /** The handle's format file that makes this template, for the deck skill; null when none. */
  recipe: string | null;
  /** The app's looks per format (the kit's and the app's own), for the studio's dropdowns. */
  styles: StyleSet;
};

/**
 * The effective template of one post. `row.template` is the plan's cell as
 * built (or its raw text); `row.recipe` the recipe it named. `log` may hold
 * any lines; only this post's valid `template.set` lines count. `deckHash` is
 * the current deck's hash (null when there is no deck yet).
 */
export function templateOf(row: { key: string; template?: Template | string | null; recipe?: string | null }, log: TemplateLine[], deckHash: string | null, recipes: Recipe[] = [], styles: StyleSet = DEFAULT_STYLES): TemplateState {
  const cell = typeof row.template === "string" ? readTemplateCell(row.template, recipes, styles) : null;
  const plan = cell ? cell.template : validTemplate(row.template as Template | null, styles) ? (row.template as Template) : null;
  const named = cell ? cell.recipe : row.recipe ?? null;
  const sets = log.filter((e) => e.post === row.key && e.kind === "template.set" && lineTemplate(e, styles));
  const ev = sets.length ? sets[sets.length - 1] : null;
  const current = ev ? lineTemplate(ev, styles) : plan;
  const from = ev ? (typeof ev.data?.from === "string" ? ev.data.from : "") : null;
  /* The deck was written before the change when a line names the deck's hash and the deck still has it. It was
     written for the `from` of the first such line: a change back to that template needs no rewrite. */
  const first = deckHash ? sets.find((e) => e.hash === deckHash) : null;
  const written = first ? (typeof first.data?.from === "string" ? first.data.from : "") : null;
  const rewrite = !!ev && !!first && ev.hash === deckHash && templateWord(parseTemplate(written, [], styles)) !== templateWord(current);
  return { current, plan, source: ev ? "log" : plan ? "plan" : null, at: ev?.at ?? null, from, rewrite, recipe: recipeFor(current, recipes, named), styles };
}
