/**
 * Streams files straight out of ../research.
 *
 * research/ is the source of truth and is read IN PLACE — nothing is ever copied
 * into public/. Scrapes are writing into that tree while the app is running, so
 * serving it live means a cover or an mp4 that lands mid-session is available on
 * the next request with no rebuild. (index.json still needs a re-run to *know*
 * about a new file; this route just means the bytes are never stale.)
 *
 * Video needs byte-range support or Safari and Chrome will not scrub an mp4.
 */

import { createReadStream, statSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";
import type { NextRequest } from "next/server";

const MEDIA_ROOT = resolve(process.cwd(), "..", "research");

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  m4a: "audio/mp4",
  md: "text/markdown; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
};

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;

  // Contain every request inside media/. A decoded `..` must not escape it.
  const rel = normalize(path.map(decodeURIComponent).join("/"));
  const abs = join(MEDIA_ROOT, rel);
  if (!abs.startsWith(MEDIA_ROOT + sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = statSync(abs);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    // A missing cover is the normal state for most of the corpus right now, so
    // this is an expected answer rather than an error worth logging.
    return new Response("Not found", { status: 404 });
  }

  const ext = abs.split(".").pop()?.toLowerCase() || "";
  const type = TYPES[ext] || "application/octet-stream";
  // Files in media/ are immutable once written, but new ones appear constantly,
  // so cache hard per-URL and never cache a negative.
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    // The orb composites covers into a canvas and hands it to WebGL. It runs in
    // a sandboxed iframe with an opaque origin, so without this the canvas is
    // tainted and the texture upload throws a security error.
    "Access-Control-Allow-Origin": "*",
  };

  const range = request.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
      }
      const stream = createReadStream(abs, { start, end });
      return new Response(stream as unknown as ReadableStream, {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }

  return new Response(createReadStream(abs) as unknown as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
