/**
 * POST { post, force?, mode?, at? } — sends the post's finished slides through
 * Post Bridge, by the same sendPosts as scripts/postbridge-send.mjs: to the
 * account's drafts (mode "draft", the default) or as a direct post scheduled
 * at `at` (ISO with zone; mode "direct"). One real post per call, on Rahul's click.
 */

import { NextResponse, type NextRequest } from "next/server";

import { sendPosts } from "@/lib/postbridge-flow";
import { validSlug } from "@/lib/production";
import { parseAt } from "@/lib/when";

export async function POST(request: NextRequest) {
  let body: { app?: unknown; post?: unknown; force?: unknown; mode?: unknown; at?: unknown };
  try { body = (await request.json()) as typeof body; } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  if (typeof body.post !== "string" || !body.post) return NextResponse.json({ error: "post is required." }, { status: 400 });
  const direct = body.mode === "direct";
  let at: string | undefined;
  if (direct) {
    try { at = parseAt(String(body.at ?? "")); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 }); }
  }
  const { plans, results } = await sendPosts(slug, { keys: [body.post], force: body.force === true, mode: direct ? "direct" : "draft", at });
  const plan = plans[0];
  if (!plan) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (plan.skip) return NextResponse.json({ error: plan.skip }, { status: 400 });
  const r = results[0];
  if (!r?.ok) return NextResponse.json({ error: r?.error ?? "The send failed." }, { status: 502 });
  return NextResponse.json({ ok: true, id: r.id, status: r.status });
}
