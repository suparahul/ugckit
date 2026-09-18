/**
 * GET ?post=<key> — the Post Bridge status of the post's last send: queued,
 * draft created, or the platform's error. Reads the log for the Post Bridge id.
 */

import { NextResponse, type NextRequest } from "next/server";

import { sendStatus } from "@/lib/postbridge-flow";
import { allStates, validSlug } from "@/lib/production";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("app") ?? "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  const key = request.nextUrl.searchParams.get("post") ?? "";
  const state = allStates(slug).find((s) => s.row.key === key);
  if (!state) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (!state.sent) return NextResponse.json({ error: "Not sent yet." }, { status: 404 });
  try {
    const s = await sendStatus(state.sent.id);
    return NextResponse.json({ ok: true, id: state.sent.id, sentAt: state.sent.at, ...s });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
