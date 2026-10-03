/**
 * A video idea in the studio plan: the posts table's `Kind` column and the
 * optional video columns, read by their headers so their order is free and an
 * old plan (no such columns) reads as before.
 *
 *   | … | Kind | Video type | Hook | Hook job | Length |
 *
 * Kind is `slideshow` (the default, and every row of an old plan) or `video`.
 * Video type is a filming format of the kit's video brain, or `reaction` (its
 * hook channel); Hook job is one of the brain's twelve hook jobs; Length is a
 * length band of the brain, or seconds. The controlled values are read from
 * brain/video-patterns.json, never listed here. A filled optional cell is the
 * user's decision (video-plan keeps it verbatim, status user); an empty one is
 * chosen by video-plan. Used by scripts/build-production.mjs; pure, no fs.
 */

export type Kind = "slideshow" | "video";

export type VideoIdea = {
  /** The brain's filming format, or `reaction`. Null when the cell is empty. */
  type: string | null;
  /** The hook text, verbatim. */
  hook: string | null;
  /** One of the twelve hook jobs. */
  hookJob: string | null;
  /** A length band ("15", "35-60") or seconds ("12"). */
  length: string | null;
};

export type BrainValues = { videoTypes: string[]; hookJobs: string[]; lengths: string[]; aliases: Record<string, string> };

/** The controlled values of the kit's video brain (the parsed brain/video-patterns.json). */
export function brainValues(patterns: unknown): BrainValues | null {
  const p = patterns as { slots?: Record<string, string[]>; aliases?: { filming_format?: Record<string, string> }; patterns?: { id: string; kind: string }[] } | null;
  if (!p?.slots?.filming_format) return null;
  const channels = p.slots.hook_channel ?? [];
  return {
    videoTypes: [...p.slots.filming_format, ...(channels.includes("reaction") ? ["reaction"] : [])],
    hookJobs: (p.patterns ?? []).filter((x) => x.kind === "hook").map((x) => x.id),
    lengths: p.slots.length_band ?? [],
    aliases: p.aliases?.filming_format ?? {},
  };
}

const HEADS = { kind: /^kind$/i, tags: /^tags$/i, type: /^video type$/i, hook: /^hook$/i, hookJob: /^hook job$/i, length: /^length$/i } as const;
export type Columns = Partial<Record<keyof typeof HEADS, number>>;

/** Where each optional column sits, from the table's header cells. */
export function columnsOf(head: string[]): Columns {
  const cols: Columns = {};
  head.forEach((h, i) => {
    const t = h.replace(/[`*]/g, "").trim();
    for (const [k, re] of Object.entries(HEADS)) if (re.test(t) && cols[k as keyof Columns] === undefined) cols[k as keyof Columns] = i;
  });
  return cols;
}

const cell = (c: string[], i: number | undefined): string | null => {
  if (i === undefined) return null;
  const v = (c[i] ?? "").replace(/`/g, "").replace(/\*\*/g, "").trim();
  return v && !/^[—–-]$/.test(v) ? v : null;
};

/** The row's tags (`#a #b`), as written. */
export const tagsOf = (c: string[], cols: Columns): string[] => (cell(c, cols.tags)?.match(/#[\w]+/g) ?? []);

export const kindOf = (c: string[], cols: Columns): Kind => (/^video$/i.test(cell(c, cols.kind) ?? "") ? "video" : "slideshow");

/** A recreation video (stage 5, `originate`): left out of the studio for now. */
export const isRecreation = (format: string) => /\boriginate\b/i.test(format);

/** The video id an old plan wrote in `Format / variation` (`video-plan reaction, hannah-2026-10-05-reaction-h5`). */
export function videoIdIn(text: string): string | null {
  return text.match(/\b([a-z0-9]+-(?:\d{4}-\d{2}-\d{2}|w\d+-\d{2})-[a-z0-9-]*[a-z0-9])\b/)?.[1] ?? null;
}

/** The row's video idea, and what is wrong with it against the brain (warnings, never a refusal). */
export function videoIdeaOf(c: string[], cols: Columns, brain: BrainValues | null): { idea: VideoIdea; warnings: string[] } {
  const raw: VideoIdea = { type: cell(c, cols.type), hook: cell(c, cols.hook), hookJob: cell(c, cols.hookJob), length: cell(c, cols.length) };
  const idea: VideoIdea = { ...raw, type: raw.type ? raw.type.toLowerCase().replace(/\s+/g, "_") : null, hookJob: raw.hookJob ? raw.hookJob.toLowerCase().replace(/\s+/g, "_") : null, length: raw.length ? raw.length.replace(/\s*s(ec(ond)?s?)?$/i, "").replace(/–/g, "-") : null };
  if (idea.type && brain?.aliases[idea.type]) idea.type = brain.aliases[idea.type];
  const warnings: string[] = [];
  if (!idea.type) warnings.push("a video row needs a Video type");
  else if (brain && !brain.videoTypes.includes(idea.type)) warnings.push(`Video type "${raw.type}" is not in the video brain (${brain.videoTypes.join(", ")})`);
  if (idea.hookJob && brain && !brain.hookJobs.includes(idea.hookJob)) warnings.push(`Hook job "${raw.hookJob}" is not one of the brain's hook jobs`);
  if (idea.length && brain && !brain.lengths.includes(idea.length) && !/^\d+(\.\d+)?$/.test(idea.length)) warnings.push(`Length "${raw.length}" is not a length band (${brain.lengths.join(", ")}) or seconds`);
  return { idea, warnings };
}
