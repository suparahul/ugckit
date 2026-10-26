/**
 * Serves uploaded pictures and cards out of ../production/files, in place.
 * Same containment rule as the media route. A video (a slideshow's reel) is served in
 * byte ranges, so Safari plays it and any browser can seek without loading the whole file.
 *
 * Caching: a card keeps its name (cards/1-appstore.png) when it is re-rendered,
 * so the response is never marked immutable. It carries an ETag from the file's
 * size and mtime with `no-cache`: the browser keeps the bytes but asks every
 * time, and gets a 304 (no body) while the file is unchanged, or the new bytes
 * the moment it is overwritten.
 */

import { createReadStream, readFileSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { normalize } from "node:path";
import type { NextRequest } from "next/server";

import { fileAbs } from "@/lib/production";
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", mov: "video/quicktime" };
const VIDEO = new Set(["mp4", "mov"]);

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  /* The address leads with the app: <slug>/<post dir>/<sub>/<file>. */
  const rel = normalize(path.map(decodeURIComponent).join("/"));
  const abs = fileAbs(rel);
  if (!abs) return new Response("Forbidden", { status: 403 });
  let etag: string, size: number;
  try {
    const st = statSync(abs);
    size = st.size;
    if (!st.isFile()) throw new Error("not a file");
    etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const headers = { ETag: etag, "Cache-Control": "no-cache" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  const ext = abs.split(".").pop()?.toLowerCase() || "";
  const type = TYPES[ext] || "application/octet-stream";
  if (!VIDEO.has(ext)) return new Response(readFileSync(abs), { headers: { ...headers, "Content-Type": type } });
  /* A video: the asked range only (bytes=a-b, bytes=a-, bytes=-n), else the whole file as a stream. */
  const stream = (start: number, end: number) => Readable.toWeb(createReadStream(abs, { start, end })) as unknown as ReadableStream;
  const vh = { ...headers, "Content-Type": type, "Accept-Ranges": "bytes" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!m || (!m[1] && !m[2])) return new Response(stream(0, size - 1), { headers: { ...vh, "Content-Length": String(size) } });
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...vh, "Content-Range": `bytes */${size}` } });
  return new Response(stream(start, end), { status: 206, headers: { ...vh, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
}
