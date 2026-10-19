/**
 * Use this reaction for a video in planning: one `reaction.pick` line in the
 * app's production log, {post?, kind: "reaction.pick", note?, data: {video,
 * entry_id}}, with no actor (the user's decision). video-plan reads the last one
 * for the video and writes the brief's reaction_reference from the entry; this
 * route writes no brief and no plan.
 */

import { NextResponse, type NextRequest } from "next/server";

import { appendPick, planningVideos, readLibrary, validEntryId } from "@/lib/reactions";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  if (!validEntryId(body.entry_id)) return NextResponse.json({ error: "No such entry." }, { status: 400 });
  const e = readLibrary().entries[body.entry_id];
  if (!e) return NextResponse.json({ error: "No such entry." }, { status: 400 });
  if (e.status === "retired") return NextResponse.json({ error: "This entry is retired. Keep it first, or pick another." }, { status: 400 });
  const v = planningVideos().find((x) => x.app === body.app && x.video === body.video);
  if (!v) return NextResponse.json({ error: "That video is not in planning (a brief and no locked plan)." }, { status: 400 });
  const line = appendPick(v.app, v.video, e.id, v.post, typeof body.note === "string" ? body.note.trim() : "");
  return NextResponse.json({ ok: true, line });
}
