/**
 * The kit's ledger: pipeline/state/pipeline.json.
 *
 * One project per user app (the project name is the app's slug). Under it,
 * research.niche is the niche phrase and research.apps is the ledger of
 * competitor apps with the handles found for each. Read live; the file is
 * small and state.py rewrites it whole.
 */

import { readJson, STATE_FILE } from "./root";

export type LedgerHandle = { own?: string; [k: string]: unknown };
export type LedgerApp = { note?: string; evidence?: string; handles?: Record<string, LedgerHandle>; [k: string]: unknown };
export type LedgerProject = {
  entry?: string;
  research?: { niche?: string; product?: string; apps?: Record<string, LedgerApp>; rejected?: Record<string, unknown>; rejected_apps?: Record<string, unknown> };
  stages?: Record<string, unknown>;
  [k: string]: unknown;
};
export type Ledger = { version?: number; projects?: Record<string, LedgerProject>; setup?: { status?: string } };

export function readLedger(): Ledger | null {
  return readJson<Ledger>(STATE_FILE);
}

export function ledgerProject(slug: string): LedgerProject | null {
  return readLedger()?.projects?.[slug] ?? null;
}

/** The competitor apps a project holds, minus the rejected ones. */
export function ledgerApps(slug: string): { name: string; row: LedgerApp; handles: string[] }[] {
  const r = ledgerProject(slug)?.research;
  if (!r) return [];
  const rejected = new Set(Object.keys(r.rejected_apps ?? {}));
  return Object.entries(r.apps ?? {})
    .filter(([name]) => !rejected.has(name))
    .map(([name, row]) => ({ name, row, handles: Object.keys(row.handles ?? {}) }));
}
