/**
 * An infographic slide's design (lib/infographic.ts).
 *
 * GET  ?app&post&slide   the spec and the asset library, for the post page's editor.
 * POST {app, post, slide, spec, card?, action?}
 *      saves the spec, renders it to the slide's candidate (logged as a
 *      `slide.upload`, data.source "compose"), redraws the brand callout from
 *      its words (cards/1-custom.png) when the spec has them, renders the
 *      Instagram 4:5 layout when the spec has one, and, when the editor moved
 *      the callout, records it as the slide's `slide.layout` card. Returns the file.
 *      action "video" does all that, then renders the animated post
 *      (video/compose-final.mp4, and video/instagram/ for the 4:5 layout),
 *      with the post's music laid in when one is chosen (scripts/add-audio.mjs).
 */

import { NextResponse, type NextRequest } from "next/server";

import { readBrand } from "@/lib/brand";
import { parseSpec } from "@/lib/infographic";
import { clearCallout, iconFile, postPictures, readAssets, readSpec, renderCallout, renderClips, renderInstagram, renderSpec, renderVideo, writeSpec } from "@/lib/infographic-store";
import { allStates, appendEvent, validSlug } from "@/lib/production";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = q.get("app") ?? "", post = q.get("post") ?? "", slide = Number(q.get("slide"));
  if (!validSlug(slug) || !post || !slide) return NextResponse.json({ error: "app, post and slide are required." }, { status: 400 });
  const spec = readSpec(slug, post, slide);
  if (!spec) return NextResponse.json({ error: "This slide has no design spec." }, { status: 404 });
  const assets = [
    ...readAssets(slug).map((a) => ({ ...a, url: `/media/apps/${encodeURIComponent(slug)}/brand/assets/${encodeURIComponent(a.file)}` })),
    /* The post's own pictures, for the page template's picture slot: served where the post page serves its slides. */
    ...postPictures(slug, post).map((a) => ({ ...a, url: `/api/production/file/${[slug, ...a.file.split("/")].map(encodeURIComponent).join("/")}` })),
  ];
  /* The app's look and callout words (apps/<slug>/brand/style.json, product.json), for the live preview and the App callout field. */
  const icon = iconFile(slug);
  return NextResponse.json({ spec, assets, brand: readBrand(slug), icon: icon ? `/media/apps/${encodeURIComponent(slug)}/${encodeURIComponent(icon.split("/").pop()!)}` : "" });
}

export async function POST(request: NextRequest) {
  let body: { app?: string; post?: string; slide?: number; spec?: unknown; card?: { x: number; y: number; w: number } | null; action?: string; dropCard?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = body.app ?? "", post = body.post ?? "", slide = Number(body.slide);
  if (!validSlug(slug) || !post || !slide) return NextResponse.json({ error: "app, post and slide are required." }, { status: 400 });
  const state = allStates(slug).find((s) => s.row.key === post);
  if (!state?.slides.some((s) => s.n === slide)) return NextResponse.json({ error: "No such slide." }, { status: 400 });
  const spec = parseSpec(body.spec);
  if (!spec) return NextResponse.json({ error: "The design does not parse." }, { status: 400 });

  writeSpec(slug, post, slide, spec);
  let file: string;
  try {
    file = (await renderSpec(slug, post, slide, spec)).file;
    /* The brand callout follows its words: redrawn from the spec on every save. */
    if (spec.content.callout?.headline) await renderCallout(slug, post, spec.content.callout);
    await renderInstagram(slug, post, slide, spec);
  }
  catch (e) { return NextResponse.json({ error: `The picture could not be drawn: ${(e as Error).message}` }, { status: 500 }); }

  /* The App callout field (one per slide): a banner placed by its card, a screenshot placed by its own box, or none.
   * The slide's layout keeps its other parts (text blocks, the other element) whichever changes. */
  const c = body.card;
  const prev = state.slides.find((s) => s.n === slide)?.layout ?? null;
  const shot = (body as { screen?: { id?: unknown; x?: unknown; y?: unknown; w?: unknown } | null }).screen;
  const screen = shot && typeof shot.id === "string" && /^[\w-]{1,80}$/.test(shot.id) && [shot.x, shot.y, shot.w].every((v) => typeof v === "number" && Number.isFinite(v))
    ? { id: shot.id, x: +(shot.x as number).toFixed(2), y: +(shot.y as number).toFixed(2), w: +(shot.w as number).toFixed(2) } : null;
  const placed = c && [c.x, c.y, c.w].every((v) => typeof v === "number" && Number.isFinite(v)) ? { ...(prev?.card ?? {}), x: +c.x.toFixed(2), y: +c.y.toFixed(2), w: +c.w.toFixed(2) } : null;
  const next = { blocks: prev?.blocks ?? [], ...(placed ? { card: placed } : {}), ...(screen ? { screen } : {}), ...(!placed && (body.dropCard || screen) ? { noCard: true } : {}) };
  if (!placed && !(body.dropCard || screen)) { /* nothing chosen in the field this time: keep the slide's layout as it is */ }
  else if (JSON.stringify(next) !== JSON.stringify({ blocks: prev?.blocks ?? [], ...(prev?.card ? { card: prev.card } : {}), ...(prev?.screen ? { screen: prev.screen } : {}), ...(prev?.noCard ? { noCard: true } : {}) })) {
    appendEvent(slug, { post, kind: "slide.layout", slide, data: { layout: JSON.stringify(next), note: "the App callout set in the design editor" } });
  }
  /* No banner in the design: the post's banner file is set aside (its App Store card, if any, is its card again). */
  if (!spec.content.callout?.headline) clearCallout(slug, post);
  if (body.action === "video") {
    const tiktokCard = placed ?? (body.dropCard || screen ? null : prev?.card ?? null);
    try {
      const videos = spec.template === "clips" ? [await renderClips(slug, post, spec, tiktokCard, 30, screen, state.row.handle)] : await renderVideo(slug, post, spec, { tiktok: tiktokCard, instagram: spec.variants?.instagram?.card ?? null, screen }, 30, state.row.handle);
      return NextResponse.json({ ok: true, file, videos });
    } catch (e) { return NextResponse.json({ error: `The video could not be made: ${(e as Error).message}` }, { status: 500 }); }
  }
  return NextResponse.json({ ok: true, file });
}
