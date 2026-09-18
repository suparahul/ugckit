/**
 * POST { post } — opens the post's export folder in the Finder (`open <dir>`),
 * for the cockpit on this machine only: the request must come from localhost.
 */

import { NextResponse, type NextRequest } from "next/server";

import { openExport, tilde } from "@/lib/export-flow";
import { validSlug } from "@/lib/production";

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export async function POST(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL.has(host)) return NextResponse.json({ error: "Only from this machine." }, { status: 403 });
  let body: { app?: unknown; post?: unknown };
  try { body = (await request.json()) as { app?: unknown; post?: unknown }; } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  if (typeof body.post !== "string" || !body.post) return NextResponse.json({ error: "post is required." }, { status: 400 });
  try {
    const dir = await openExport(slug, body.post);
    return NextResponse.json({ ok: true, dir, shown: tilde(dir) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
