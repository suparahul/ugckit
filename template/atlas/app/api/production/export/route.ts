/** POST { post } — writes the post's finished files to ~/Downloads/tiktok-<post>/ (lib/export-flow.ts). */

import { NextResponse, type NextRequest } from "next/server";

import { exportPost, tilde } from "@/lib/export-flow";
import { validSlug } from "@/lib/production";

export async function POST(request: NextRequest) {
  let body: { app?: unknown; post?: unknown };
  try { body = (await request.json()) as { app?: unknown; post?: unknown }; } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  if (typeof body.post !== "string" || !body.post) return NextResponse.json({ error: "post is required." }, { status: 400 });
  try {
    const r = await exportPost(slug, body.post);
    return NextResponse.json({ ok: true, dir: r.dir, shown: tilde(r.dir), files: r.files });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
