/**
 * Where the workspace is.
 *
 * The Atlas lives at <workspace>/atlas and reads everything else in place:
 * apps/<slug>/ (the user's apps), research/ (the competitor corpus) and
 * pipeline/state/pipeline.json (the kit's ledger). ATLAS_ROOT overrides the
 * location for a check against another tree; nothing else reads it.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = process.env.ATLAS_ROOT ? resolve(process.env.ATLAS_ROOT) : resolve(process.cwd(), "..");
export const APPS_DIR = join(ROOT, "apps");
export const RESEARCH_DIR = join(ROOT, "research");
export const STATE_FILE = join(ROOT, "pipeline", "state", "pipeline.json");

/** The app's folder and the folders inside it, by name. */
export const appDir = (slug: string) => join(APPS_DIR, slug);

export const exists = (p: string) => existsSync(p);

export function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function listDirs(p: string): string[] {
  try {
    return readdirSync(p).filter((n) => !n.startsWith(".") && isDir(join(p, n))).sort();
  } catch {
    return [];
  }
}

export function listFiles(p: string): string[] {
  try {
    return readdirSync(p).filter((n) => !n.startsWith(".") && !isDir(join(p, n))).sort();
  } catch {
    return [];
  }
}

export function readText(p: string): string | null {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

export function readJson<T = unknown>(p: string): T | null {
  const t = readText(p);
  if (t === null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export function mtimeOf(p: string): number {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

/** The newest mtime under a folder, one level deep. 0 when it does not exist. */
export function newestIn(p: string): number {
  let m = mtimeOf(p);
  for (const f of [...listFiles(p), ...listDirs(p)]) m = Math.max(m, mtimeOf(join(p, f)));
  return m;
}

/* ------------------------------------------------------------- markdown */

/** `Key: value` head lines of a markdown file, before the first `## `. */
export function headLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of text.split("\n")) {
    if (/^##\s/.test(l)) break;
    const m = l.match(/^\**([A-Z][\w /-]*?)\**:\**\s*(.+?)\s*$/);
    if (m && !/^#/.test(l)) out[m[1].trim()] = m[2].replace(/^\*\*|\*\*$/g, "").trim();
  }
  return out;
}

/** The title of a markdown file: its first `# ` line. */
export function titleOf(text: string): string | null {
  const m = text.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].replace(/`/g, "").trim() : null;
}

/** The body of one `## Heading` section (up to the next `## `), or null. */
export function sectionOf(text: string, heading: RegExp): string | null {
  const lines = text.split("\n");
  let i = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l.replace(/^##\s+/, "")));
  if (i < 0) return null;
  const buf: string[] = [];
  for (i++; i < lines.length && !/^##\s/.test(lines[i]); i++) buf.push(lines[i]);
  return buf.join("\n").trim();
}

/** Every `## Heading` in a markdown file, with its body. */
export function sectionsOf(text: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  let cur: { heading: string; body: string[] } | null = null;
  for (const l of text.split("\n")) {
    const m = l.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (cur) out.push({ heading: cur.heading, body: cur.body.join("\n").trim() });
      cur = { heading: m[1], body: [] };
    } else if (cur) cur.body.push(l);
  }
  if (cur) out.push({ heading: cur.heading, body: cur.body.join("\n").trim() });
  return out;
}

/** A markdown table: the header cells and the rows. Escaped pipes inside cells are kept. */
export function tableOf(text: string): { head: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => /^\s*\|/.test(l));
  const split = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  if (!lines.length) return { head: [], rows: [] };
  const head = split(lines[0]);
  const rows = lines.slice(1).filter((l) => !/^\s*\|\s*-{2,}/.test(l)).map(split);
  return { head, rows };
}

/** The first table in a section, as rows keyed by the header. */
export function tableRows(text: string): Record<string, string>[] {
  const { head, rows } = tableOf(text);
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
