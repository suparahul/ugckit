/**
 * A post's own App Store card: the default card's shape with the three
 * strings a locked layout carries (name, subtitle, button). The editor calls
 * it while Rahul types, so a line that does not fit is said at once; the page
 * and the compositor read the file it writes.
 *
 *   GET /api/production/card?post=<key>&name=…&subtitle=…&button=…
 *   → { file: "<post>/cards/1-appstore-<hash>.png" }     (rendered once; served by /api/production/file/…)
 *   → { error: "The subtitle is too long: …" }  400        (nothing written)
 *
 * The cache name is the hash of the strings, so the default 1-appstore.png is
 * never overwritten and a card that was locked once stays on disk.
 */

import { existsSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";

import { allStates, customCardPath, fileAbs, validSlug } from "@/lib/production";
import { renderAppStoreCard } from "../../../../scripts/lib/appstore-card.mjs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = q.get("app") ?? "";
  if (!validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  const post = q.get("post") ?? "";
  const text = { name: (q.get("name") ?? "").trim().slice(0, 80), subtitle: (q.get("subtitle") ?? "").trim().slice(0, 80), button: (q.get("button") ?? "").trim().slice(0, 80) };
  if (!allStates(slug).some((s) => s.row.key === post)) return NextResponse.json({ error: "No such post." }, { status: 400 });
  const rel = customCardPath(slug, post, text);
  const abs = fileAbs(rel);
  if (!abs) return NextResponse.json({ error: "Bad address." }, { status: 400 });
  if (!existsSync(abs)) {
    try {
      await renderAppStoreCard({ slug, ...text, out: abs });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }
  return NextResponse.json({ file: rel });
}
