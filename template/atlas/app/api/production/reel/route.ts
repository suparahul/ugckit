/**
 * POST { app, post, hold, hookHold, productHold } — a slideshow's reel made again from its slides as they are now
 * (lib/reel.ts makeReel): the finals and the Instagram set, the reel's frames with the cover text burned in, then
 * video/reel-final.mp4 with the post's music. The seconds (1 to 12 each) are written down as a `reel.set` line.
 */

import { NextResponse, type NextRequest } from "next/server";

import { allStates, validSlug } from "@/lib/production";
import { holdOf, makeReel, HOLD_MAX, HOLD_MIN } from "@/lib/reel";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { app?: unknown; post?: unknown; hold?: unknown; hookHold?: unknown; productHold?: unknown };
  try { body = (await request.json()) as typeof body; } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = typeof body.app === "string" ? body.app : "", post = typeof body.post === "string" ? body.post : "";
  if (!validSlug(slug) || !post) return NextResponse.json({ error: "app and post are required." }, { status: 400 });
  const state = allStates(slug).find((s) => s.row.key === post);
  if (!state?.deck) return NextResponse.json({ error: "This post has no deck." }, { status: 400 });
  if (state.deck.slides.length < 2) return NextResponse.json({ error: "Only a slideshow of two or more slides can be cut into a reel." }, { status: 400 });
  if (state.posted || state.sent) return NextResponse.json({ error: "This post has already gone out; the reel is what went with it." }, { status: 400 });
  const hold = holdOf(body.hold), hookHold = holdOf(body.hookHold), productHold = holdOf(body.productHold ?? body.hold);
  if (hold === null || hookHold === null || productHold === null) return NextResponse.json({ error: `Each time is a number of seconds from ${HOLD_MIN} to ${HOLD_MAX}.` }, { status: 400 });
  try {
    const r = await makeReel(slug, state, { render: true, holds: { hold, hookHold, productHold } });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
