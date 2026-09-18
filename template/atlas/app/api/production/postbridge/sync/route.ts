/**
 * POST { post? } — the whole sync for every sent post (or the one named):
 * the TikTok link and the numbers through Monid (`posted.link`, `outcome.sync`),
 * then the Post Bridge analytics as the second source.
 * The same as node scripts/postbridge-sync.mjs.
 */

import { NextResponse, type NextRequest } from "next/server";

import { syncAll } from "@/lib/postbridge-flow";
import { validSlug } from "@/lib/production";

export async function POST(request: NextRequest) {
  let body: { app?: unknown; post?: unknown } = {};
  try { body = (await request.json()) as { app?: unknown; post?: unknown }; } catch { /* an empty body syncs every sent post of the app */ }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  try {
    const r = await syncAll(slug, typeof body.post === "string" && body.post ? { keys: [body.post] } : {});
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
