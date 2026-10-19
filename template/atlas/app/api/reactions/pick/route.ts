/**
 * Use this reaction for a video: one `reaction.pick` line in the app's production
 * log, {post?, kind: "reaction.pick", note?, data: {video, entry_id}}, with no actor
 * (the user's decision). video-plan reads the last one for the video and writes the
 * brief's reaction_reference from the entry; this route writes no brief and no plan.
 *
 * With `post` (the Switch reaction panel of a video's post page), the video's plan
 * gate decides: a plan already approved or locked is refused with needs_send_back
 * unless `send_back` is true, and then the pick is followed by a `plan.sendback`
 * line for the draft revision (the decision bar's Send back, with the switch as its
 * note), so video-plan and video-script write a new revision with the new reaction.
 * Without `post` (the /reactions page), only a video in planning can be picked for.
 */

import { NextResponse, type NextRequest } from "next/server";

import { allStates, appendEvent, validSlug } from "@/lib/production";
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
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const app = typeof body.app === "string" ? body.app : "";
  const video = typeof body.video === "string" ? body.video : "";

  if (typeof body.post === "string" && body.post) {
    if (!validSlug(app)) return NextResponse.json({ error: "app is required." }, { status: 400 });
    const st = allStates(app).find((x) => x.row.key === body.post && x.video?.id === video);
    if (!st?.video?.brief) return NextResponse.json({ error: "That post has no video brief to pick a reaction for." }, { status: 400 });
    const gated = !!st.video.lock || st.plan.status === "approved" || st.plan.status === "stale";
    if (gated && body.send_back !== true) return NextResponse.json({ error: "The plan is approved or locked: switching the reaction sends it back for a new revision.", needs_send_back: true }, { status: 409 });
    const line = appendPick(app, video, e.id, st.row.key, note);
    if (!gated) return NextResponse.json({ ok: true, line, sent_back: false });
    const back = appendEvent(app, {
      post: st.row.key,
      kind: "plan.sendback",
      note: `Switch the reaction to ${e.id} (${e.source.handle}, ${e.start_s}–${e.end_s} s), picked in the reaction library. Write a new revision with it.`,
      data: { video, revision: st.video.draft?.revision ?? null },
    });
    return NextResponse.json({ ok: true, line, sent_back: true, sendback: back });
  }

  const v = planningVideos().find((x) => x.app === app && x.video === video);
  if (!v) return NextResponse.json({ error: "That video is not in planning (a brief and no locked plan)." }, { status: 400 });
  const line = appendPick(v.app, v.video, e.id, v.post, note);
  return NextResponse.json({ ok: true, line });
}
