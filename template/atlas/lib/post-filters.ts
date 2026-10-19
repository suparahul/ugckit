/**
 * The sort and the date window of the All posts page, shared by the research
 * tabs and our posts. Every value is a URL param: `sort` (a metric), `order`
 * (`desc` or `asc`), `date` (a preset, or `custom` with `from` and `to`).
 * Nothing here knows an app or a handle; the options come from the posts.
 */

import type { PickOpt } from "@/components/factory/NicheFilters";

export type Metric = "date" | "views" | "likes" | "comments" | "shares" | "saves";
export const METRICS: Metric[] = ["date", "views", "likes", "comments", "shares", "saves"];
export const metricOf = (x: string, def: Metric): Metric => (METRICS.includes(x as Metric) ? (x as Metric) : def);
export const sortOpts: PickOpt[] = METRICS.map((m) => ({ v: m, label: `by ${m}` }));
export const orderOpts = (m: Metric): PickOpt[] => (m === "date" ? [{ v: "desc", label: "newest first" }, { v: "asc", label: "oldest first" }] : [{ v: "desc", label: "high to low" }, { v: "asc", label: "low to high" }]);

/** The day presets of the date pick, in days back from today. */
const PRESETS: { v: string; days: number; label: string }[] = [
  { v: "7d", days: 7, label: "last 7 days" }, { v: "30d", days: 30, label: "last 30 days" }, { v: "90d", days: 90, label: "last 90 days" },
  { v: "180d", days: 182, label: "last 6 months" }, { v: "365d", days: 365, label: "last year" },
];
export const dateOpts: PickOpt[] = [{ v: "", label: "all time" }, ...PRESETS.map((p) => ({ v: p.v, label: p.label })), { v: "custom", label: "custom range" }];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isDay = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);

/** The window a date pick names, as `YYYY-MM-DD` bounds (both inclusive); an open side is "". */
export function dateWindow(date: string, from: string, to: string, now = new Date()): { from: string; to: string } {
  const p = PRESETS.find((x) => x.v === date);
  if (p) {
    const start = new Date(now);
    start.setDate(start.getDate() - (p.days - 1));
    return { from: ymd(start), to: "" };
  }
  if (date === "custom") return { from: isDay(from) ? from : "", to: isDay(to) ? to : "" };
  return { from: "", to: "" };
}

/** A day inside the window. A post with no date is outside every set window. */
export const inWindow = (day: string, w: { from: string; to: string }) => (!w.from && !w.to) || (!!day && (!w.from || day.slice(0, 10) >= w.from) && (!w.to || day.slice(0, 10) <= w.to));

/** Compare two values for the sort; a missing number (no read yet) goes last in either order. */
export function compare(a: number | string | null, b: number | string | null, order: string): number {
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return order === "asc" ? c : -c;
}
