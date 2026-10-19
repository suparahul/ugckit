/**
 * The reaction library's writes from the page (lib/reactions.ts):
 *   {action: "add", video, start_s, end_s, tags, note}   Add to reactions, on a post page:
 *        video is the post's /media URL; the entry is kept, by you
 *   {action: "change", id, change: {status?, start_s?, end_s?, tags?, note?}}
 *        Keep, Retire, the range, the tags, the note, on the Reactions page
 * The library file is read again just before each write, so an entry the agent
 * wrote in the meantime stays. Nothing is generated and nothing is copied.
 */

import { NextResponse, type NextRequest } from "next/server";

import { addFromPost, changeEntry, STATUSES, validEntryId, workspacePathOf, type Change } from "@/lib/reactions";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const tagsOf = (v: unknown) => (Array.isArray(v) && v.every((t) => typeof t === "string") ? (v as string[]) : undefined);

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  if (body.action === "add") {
    const video = typeof body.video === "string" ? workspacePathOf(body.video) : null;
    const s = num(body.start_s), e = num(body.end_s);
    if (!video) return NextResponse.json({ error: "Only a post's video in research/ or a niche batch can go in the library." }, { status: 400 });
    if (s === undefined || e === undefined) return NextResponse.json({ error: "Set the start and the end of the reaction." }, { status: 400 });
    const r = addFromPost(video, s, e, tagsOf(body.tags) ?? [], typeof body.note === "string" ? body.note.trim() : "");
    if (typeof r === "string") return NextResponse.json({ error: r }, { status: 400 });
    return NextResponse.json({ ok: true, entry: r });
  }
  if (body.action === "change") {
    if (!validEntryId(body.id)) return NextResponse.json({ error: "No such entry." }, { status: 400 });
    const c = (body.change && typeof body.change === "object" ? body.change : {}) as Record<string, unknown>;
    const change: Change = {};
    if (c.status !== undefined) {
      if (!STATUSES.includes(c.status as never)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
      change.status = c.status as Change["status"];
    }
    if (c.start_s !== undefined) change.start_s = num(c.start_s) ?? NaN;
    if (c.end_s !== undefined) change.end_s = num(c.end_s) ?? NaN;
    if (c.tags !== undefined) change.tags = tagsOf(c.tags) ?? ["?"];
    if (c.note !== undefined) change.note = typeof c.note === "string" ? c.note.trim() : "";
    if (!Object.keys(change).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    const r = changeEntry(body.id, change);
    if (typeof r === "string") return NextResponse.json({ error: r }, { status: 400 });
    return NextResponse.json({ ok: true, entry: r });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
