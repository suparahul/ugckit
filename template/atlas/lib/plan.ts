/**
 * The strategy files, read live for the strategy page: what the built plan
 * (data/production-<slug>.json) does not carry. production/PLAN.md gives the
 * revisions, the judgement rules, the standing rule and the day-7 read;
 * strategy/ACCOUNTS.md the account architecture; strategy/APP-FIT.md the
 * status counts and the experiment list. Nothing here decides anything.
 */

import { join } from "node:path";

import { appDir, readText, sectionOf, tableOf } from "./root";

export type Table = { head: string[]; rows: string[][] };

const table = (text: string | null): Table | null => {
  if (!text) return null;
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^\|/.test(l));
  if (i < 0) return null;
  let j = i;
  while (j < lines.length && /^\|/.test(lines[j])) j++;
  const t = tableOf(lines.slice(i, j).join("\n"));
  return t.head.length ? t : null;
};

export type PlanText = {
  /** `**Revised <date> …**` paragraphs, oldest first. */
  revisions: { date: string; text: string }[];
  rules: Table | null;
  /** The paragraph that starts "Rules that hold on every post". */
  standing: string | null;
  day7: { date: string | null; intro: string | null; table: Table | null; note: string | null } | null;
};

export function readPlanText(slug: string): PlanText | null {
  const md = readText(join(appDir(slug), "production", "PLAN.md"));
  if (!md) return null;
  const revisions = [...md.matchAll(/^\*\*Revised (\d{4}-\d{2}-\d{2})[^*]*\*\*\s*(.+)$/gm)].map((m) => ({ date: m[1], text: m[2].trim() }));
  const rulesSec = sectionOf(md, /^Judgement rules/i);
  const standing = rulesSec?.split("\n").find((l) => /^Rules that hold on every post/i.test(l))?.replace(/^Rules that hold on every post:?\s*/i, "").trim() ?? null;
  const d7 = sectionOf(md, /^Day-7 read/i);
  const day7 = d7
    ? {
        date: d7.match(/Read on (\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
        intro: d7.split("\n").find((l) => l.trim() && !/^\|/.test(l)) ?? null,
        table: table(d7),
        note: d7.split("\n").filter((l) => l.trim() && !/^\|/.test(l)).slice(1).join(" ").trim() || null,
      }
    : null;
  return { revisions, rules: table(rulesSec), standing, day7 };
}

export function readAccounts(slug: string): { table: Table | null; intro: string | null } | null {
  const md = readText(join(appDir(slug), "strategy", "ACCOUNTS.md"));
  if (!md) return null;
  const body = md.replace(/^#[^\n]*\n/, "");
  return { table: table(body), intro: body.split("\n").find((l) => l.trim() && !/^[#|]/.test(l)) ?? null };
}

export type FitSummary = { decided: number; adopted: number; experiment: number; total: number; experiments: Table | null };

/** The status column of APP-FIT.md's parameter tables, counted, and Part D's list. */
export function readFit(slug: string): FitSummary | null {
  const md = readText(join(appDir(slug), "strategy", "APP-FIT.md"));
  if (!md) return null;
  let decided = 0, adopted = 0, experiment = 0;
  for (const block of md.split(/\n(?=#)/)) {
    const t = table(block);
    if (!t) continue;
    const si = t.head.findIndex((h) => /^status$/i.test(h));
    if (si < 0) continue;
    for (const r of t.rows) {
      const v = (r[si] ?? "").toLowerCase();
      if (/^decided/.test(v)) decided++;
      else if (/adopted/.test(v)) adopted++;
      else if (/experiment/.test(v)) experiment++;
    }
  }
  const partD = md.split(/\n(?=# )/).find((b) => /^# Part D/i.test(b)) ?? null;
  return { decided, adopted, experiment, total: decided + adopted + experiment, experiments: table(partD) };
}
