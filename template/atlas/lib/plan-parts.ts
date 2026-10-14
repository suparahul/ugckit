/**
 * The labelled parts of a plan row's Format / variation cell, split by
 * scripts/build-production.mjs (formatPartsOf) into `formatParts`. The day card
 * shows what the post is about (topic, angle, overwrites, slides); the post page
 * shows the rest under their labels: the format, the images and the handle rule,
 * which are about the handle and repeat on every row.
 */

import type { PlanRow } from "@/lib/production";

export type FormatPart = { label: string; text: string };

/** The labels the day card shows, in the cell's own order. */
const CARD = new Set(["topic", "angle", "overwrites", "slides"]);

/** The row's parts; empty for a cell written without labels. */
export const formatParts = (row: PlanRow): FormatPart[] => (row as PlanRow & { formatParts?: FormatPart[] | null }).formatParts ?? [];

const joined = (parts: FormatPart[]) => parts.map((p) => `${p.label} ${p.text}`).join(" · ");

/** The card's text: topic, angle, overwrites and slides; the whole cell when it has none of them. */
export function cardText(row: PlanRow): string {
  const parts = formatParts(row).filter((p) => CARD.has(p.label.toLowerCase()));
  return parts.length ? joined(parts) : row.format;
}

/** The parts the card leaves out (format, images, handle rule and any other label), for the post page. */
export const restParts = (row: PlanRow): FormatPart[] =>
  formatParts(row).some((p) => CARD.has(p.label.toLowerCase())) ? formatParts(row).filter((p) => !CARD.has(p.label.toLowerCase())) : [];
