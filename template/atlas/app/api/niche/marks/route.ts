/**
 * The niche page's edit mode saves here: the changes the user made, applied as
 * theirs to apps/<slug>/niche/marks.json (lib/niche-marks.ts). The file is
 * read again just before the write, so a mark an agent wrote in the meantime
 * stays. Nothing else is touched: a ruled-out post leaves the explorer, and
 * nothing is deleted.
 */

import { join } from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { getApp } from "@/lib/apps";
import { applyChanges, MARKS, readMarks, shownMark, validKey, writeMarks, type MarkChange } from "@/lib/niche-marks";
import { validSlug } from "@/lib/production";
import { appDir, exists } from "@/lib/root";

export async function POST(request: NextRequest) {
  let body: { app?: unknown; changes?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!slug || !validSlug(slug) || !getApp(slug) || !exists(join(appDir(slug), "niche"))) return NextResponse.json({ error: "No niche for this app." }, { status: 400 });
  if (!Array.isArray(body.changes) || !body.changes.length) return NextResponse.json({ error: "No changes." }, { status: 400 });
  const changes: MarkChange[] = [];
  for (const c of body.changes as Record<string, unknown>[]) {
    const key = typeof c?.key === "string" ? c.key : "";
    const mark = c?.mark === null ? null : MARKS.includes(c?.mark as never) ? (c.mark as MarkChange["mark"]) : undefined;
    if (!validKey(key) || mark === undefined) return NextResponse.json({ error: `Bad change: ${JSON.stringify(c).slice(0, 120)}` }, { status: 400 });
    changes.push({ key, mark, handle: typeof c.handle === "string" ? c.handle.slice(0, 80) : undefined, caption: typeof c.caption === "string" ? c.caption : undefined });
  }
  const file = applyChanges(readMarks(slug), changes, new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  writeMarks(slug, file);
  const counts = { out: 0, study: 0 };
  for (const e of Object.values(file.marks)) { const m = shownMark(e); if (m) counts[m]++; }
  return NextResponse.json({ ok: true, saved: changes.length, ...counts });
}
