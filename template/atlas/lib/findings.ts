/**
 * The findings of the niche: apps/<slug>/niche/{learnings,anatomy,architecture}.md,
 * the three files the agent writes beside the kit's own reading, in the same
 * shape. Read live and drawn from their files, not summarised:
 *
 *   learnings.md     dated sections (`## YYYY-MM-DD — title`); the newest is
 *                    the read shown: a source line, then one block per bold
 *                    lead with its bullets; a "Confirms …" block is the verdict.
 *   anatomy.md       `## Post table`: one row per post read; and the value
 *                    tables (`| Value | Seen in | …`) under each parameter.
 *   architecture.md  `## Account table`: one row per account behind the posts.
 */

import { join } from "node:path";

import { appDir, readText, sectionOf, tableOf } from "./root";

export type FindingBlock = { title: string; lead: string; items: { mark: "confirms" | "contradicts" | "new" | null; text: string }[] };
export type Findings = { date: string; title: string; source: string; verdict: FindingBlock | null; blocks: FindingBlock[]; sections: number };

/** The text as written, trimmed: **bold** and `code` stay and the page renders them. */
export const plain = (s: string) => s.trim();

export function readFindings(slug: string): Findings | null {
  const text = readText(join(appDir(slug), "niche", "learnings.md"));
  if (!text) return null;
  const heads = [...text.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.+?)\s*$/gm)];
  if (!heads.length) return null;
  const last = heads[heads.length - 1];
  const start = (last.index ?? 0) + last[0].length;
  const rest = text.slice(start);
  const end = rest.search(/^##\s/m);
  const body = (end >= 0 ? rest.slice(0, end) : rest).trim();
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const source = paras[0] && /^Source:/i.test(paras[0]) ? plain(paras[0].replace(/^Source:\s*/i, "")) : "";
  const blocks: FindingBlock[] = [];
  for (const p of paras.slice(source ? 1 : 0)) {
    const lines = p.split("\n");
    const m = lines[0].match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const title = m ? m[1].replace(/\.$/, "") : "";
    const lead = m ? m[2] : lines[0].startsWith("- ") ? "" : lines[0];
    const items = lines.slice(m || !lines[0].startsWith("- ") ? 1 : 0).filter((l) => /^-\s/.test(l)).map((l) => {
      const t = l.replace(/^-\s*/, "");
      const mv = t.match(/^(Confirms|Contradicts nothing outright|Contradicts|New):\s*(.*)$/);
      const mark = mv ? ((mv[1].split(" ")[0].toLowerCase() as "confirms" | "contradicts" | "new")) : null;
      return { mark, text: plain(mv ? `**${mv[1]}** ${mv[2]}` : t) };
    });
    blocks.push({ title, lead: plain(lead), items });
  }
  const vi = blocks.findIndex((b) => /^Confirms/i.test(b.title));
  const verdict = vi >= 0 ? blocks[vi] : null;
  return { date: last[1], title: last[2], source, verdict, blocks: blocks.filter((_, i) => i !== vi), sections: heads.length };
}

export type Table = { head: string[]; rows: string[][] };

/** The post table of anatomy.md: one row per post read. */
export function readPostTable(slug: string): Table | null {
  const text = readText(join(appDir(slug), "niche", "anatomy.md"));
  if (!text) return null;
  const sec = sectionOf(text, /^Post table/i);
  if (!sec) return null;
  const t = tableOf(sec);
  return t.head.length ? t : null;
}

/** Every parameter's values in anatomy.md: the layer, the parameter, the value, where it was seen, the evidence. */
export function readValues(slug: string): { layer: string; param: string; value: string; seen: string; evidence: string }[] {
  const text = readText(join(appDir(slug), "niche", "anatomy.md"));
  if (!text) return [];
  const out: { layer: string; param: string; value: string; seen: string; evidence: string }[] = [];
  let layer = "", param = "";
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s+Layer/.test(l)) layer = l.replace(/^##\s+/, "").split(/—|-/).pop()!.trim();
    else if (/^###\s/.test(l)) param = l.replace(/^###\s+/, "").trim();
    else if (/^\|\s*Value\s*\|/i.test(l)) {
      let j = i;
      while (j < lines.length && /^\|/.test(lines[j])) j++;
      const t = tableOf(lines.slice(i, j).join("\n"));
      for (const r of t.rows) if (r.length >= 2) out.push({ layer, param, value: r[0], seen: r[1] ?? "", evidence: r[2] ?? "" });
      i = j - 1;
    }
  }
  return out;
}

/** The account table of architecture.md. */
export function readAccountTable(slug: string): Table | null {
  const text = readText(join(appDir(slug), "niche", "architecture.md"));
  if (!text) return null;
  const sec = sectionOf(text, /^Account table/i);
  if (!sec) return null;
  const t = tableOf(sec);
  return t.head.length ? t : null;
}

/**
 * The day-7 rows: the rows of the post table that are ours, appended by the
 * day-7 read seven days after each of our posts went out. A row is ours when
 * its handle cell names one of the app's handles, or the row says so ("own
 * post", "ours"). Appending them is production's work, not a change to the
 * findings; the canvas reads them that way.
 */
export function day7Rows(slug: string, handles: string[]): string[][] {
  const t = readPostTable(slug);
  if (!t) return [];
  const mine = new Set(handles.map((h) => h.replace(/^@/, "").toLowerCase()));
  const col = t.head.findIndex((h) => /handle/i.test(h));
  return t.rows.filter((r) => {
    const cell = (col >= 0 ? r[col] : r.join(" ")) ?? "";
    const named = cell.match(/@([\w.]+)/)?.[1]?.toLowerCase();
    return (named && mine.has(named)) || /\b(own post|ours)\b/i.test(r.join(" "));
  });
}
