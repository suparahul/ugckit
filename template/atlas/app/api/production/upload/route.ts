/**
 * A picture for one slide, or a product card, uploaded by hand.
 *
 * multipart/form-data: post (key), slide (number) or card (number), file.
 * Saved under ../production/files/<key>/slide-NN/<stamp>-<name> or
 * .../cards/<n>-<stamp>-<name>. Nothing is ever overwritten: every upload is a
 * new candidate and the old ones stay. A slide upload also appends a
 * `slide.upload` line to the log so the state machine sees the change. An
 * optional `actor` field names the agent that uploaded, when it is not Rahul.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

import { appendEvent, filesRoot, fileKey, validSlug } from "@/lib/production";

const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const slug = String(form.get("app") ?? "");
  const post = String(form.get("post") ?? "");
  const slide = form.get("slide") ? Number(form.get("slide")) : null;
  const card = form.get("card") ? Number(form.get("card")) : null;
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  const a = form.get("actor");
  const actor = typeof a === "string" && a && a !== "demo" ? a.slice(0, 40) : undefined;

  if (!slug || !validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  if (!post) return NextResponse.json({ error: "post is required." }, { status: 400 });
  if (!files.length) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (slide === null && card === null) return NextResponse.json({ error: "slide or card is required." }, { status: 400 });

  const saved: string[] = [];
  for (const f of files) {
    if (!OK_TYPES.has(f.type)) return NextResponse.json({ error: `${f.name}: not an image (${f.type || "unknown type"}).` }, { status: 400 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-60);
    const sub = slide !== null ? `slide-${String(slide).padStart(2, "0")}` : "cards";
    const name = slide !== null ? `${stamp}-${safe}` : `${card}-${stamp}-${safe}`;
    const dir = join(filesRoot(slug), fileKey(post), sub);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), Buffer.from(await f.arrayBuffer()));
    const rel = `${slug}/${fileKey(post)}/${sub}/${name}`;
    saved.push(rel);
    if (slide !== null) appendEvent(slug, { post, kind: "slide.upload", slide, file: rel, ...(actor ? { actor } : {}) });
    else appendEvent(slug, { post, kind: "card.upload", card: card!, file: rel, ...(actor ? { actor } : {}) });
  }
  return NextResponse.json({ ok: true, files: saved });
}
