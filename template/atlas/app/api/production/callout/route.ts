/**
 * The App callout field's banner, for any post: one field for every callout and screenshot.
 *
 *   GET  ?app&post            → { callout, brand, icon }: the banner chosen for the post (cards/callout.json), or null;
 *                               the app's look and callout words (lib/brand.ts) and its icon, for the field and the preview
 *   POST { app, post, callout } → draws the banner to cards/1-custom.png (renderCallout) and records it;
 *        callout: null drops it (the post's App Store card, if any, is its card again)
 *
 * Where the banner sits, or which screenshot is on a slide, is the slide's layout (a slide.layout line), written by the
 * editors as before. The design editor (compose) draws its banner through /api/production/compose; this route is for
 * the photo and illustrated slides, so both offer the same banners.
 */
import { NextResponse, type NextRequest } from "next/server";

import { readBrand } from "@/lib/brand";
import { parseCallout } from "@/lib/infographic";
import { calloutOfPost, clearCallout, iconFile, renderCallout } from "@/lib/infographic-store";
import { allStates, validSlug } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = q.get("app") ?? "", post = q.get("post") ?? "";
  if (!validSlug(slug) || !post) return NextResponse.json({ error: "app and post are required." }, { status: 400 });
  const icon = iconFile(slug);
  return NextResponse.json({ callout: calloutOfPost(slug, post), brand: readBrand(slug), icon: icon ? `/media/apps/${encodeURIComponent(slug)}/${encodeURIComponent(icon.split("/").pop()!)}` : "" });
}

export async function POST(request: NextRequest) {
  let body: { app?: string; post?: string; callout?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = body.app ?? "", post = body.post ?? "";
  if (!validSlug(slug) || !post) return NextResponse.json({ error: "app and post are required." }, { status: 400 });
  if (!allStates(slug).some((s) => s.row.key === post)) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (body.callout === null) { clearCallout(slug, post); return NextResponse.json({ ok: true, callout: null }); }
  const c = parseCallout(body.callout);
  if (!c) return NextResponse.json({ error: "The callout does not parse." }, { status: 400 });
  try {
    const file = await renderCallout(slug, post, c);
    return NextResponse.json({ ok: true, callout: c, file });
  } catch (e) {
    return NextResponse.json({ error: `The banner could not be drawn: ${(e as Error).message}` }, { status: 500 });
  }
}
