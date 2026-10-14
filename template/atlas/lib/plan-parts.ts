/**
 * The labelled parts of a plan row's Format / variation cell, split by
 * scripts/build-production.mjs (formatPartsOf) into `formatParts`. The day card
 * shows what the post is about (topic, angle, overwrites, slides); the idea view
 * shows the format part. The images and the handle rule are about the handle, not
 * the post, so no post view shows them; they stay in the data.
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

/** The text under the cell's format label, for the idea view; the whole cell when it has no such label. */
export const formatText = (row: PlanRow): string => formatParts(row).find((p) => p.label.toLowerCase() === "format")?.text ?? row.format;
