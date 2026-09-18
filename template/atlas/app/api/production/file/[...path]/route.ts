/**
 * Serves uploaded pictures and cards out of ../production/files, in place.
 * Same containment rule as the media route; no ranges, these are images.
 *
 * Caching: a card keeps its name (cards/1-appstore.png) when it is re-rendered,
 * so the response is never marked immutable. It carries an ETag from the file's
 * size and mtime with `no-cache`: the browser keeps the bytes but asks every
 * time, and gets a 304 (no body) while the file is unchanged, or the new bytes
 * the moment it is overwritten.
 */

import { readFileSync, statSync } from "node:fs";
import { normalize } from "node:path";
import type { NextRequest } from "next/server";

import { fileAbs } from "@/lib/production";
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  /* The address leads with the app: <slug>/<post dir>/<sub>/<file>. */
  const rel = normalize(path.map(decodeURIComponent).join("/"));
  const abs = fileAbs(rel);
  if (!abs) return new Response("Forbidden", { status: 403 });
  let etag: string;
  try {
    const st = statSync(abs);
    if (!st.isFile()) throw new Error("not a file");
    etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = { ETag: etag, "Cache-Control": "no-cache" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const ext = abs.split(".").pop()?.toLowerCase() || "";
  return new Response(readFileSync(abs), { headers: { ...headers, "Content-Type": TYPES[ext] || "application/octet-stream" } });
}
