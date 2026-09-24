/**
 * Streams files straight out of ../research, and the served parts of ../apps.
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

import { APPS_DIR, RESEARCH_DIR } from "@/lib/root";

const MEDIA_ROOT = resolve(RESEARCH_DIR);
/* apps/<slug>/… is served too, read-only: the app's icon, a handle's
 * references, the niche covers (TikTok's and Instagram's) and the scrolled
 * batches. Only those folders. */
const APPS_ROOT = resolve(APPS_DIR);
const APP_SERVED = /^[^/]+\/(icon\.(jpg|jpeg|png|webp)$|handles\/[^/]+\/references\/|niche\/(covers|batches|instagram\/covers)\/)/;

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

/**
 * A Node file stream as a web ReadableStream, safe against a client hanging up.
 *
 * Casting the Node stream straight to a ReadableStream works until the client
 * disconnects mid-body — a video scrubbed, a page navigated away from. The
 * adapter's controller is closed by then, the file stream pushes one more
 * chunk into it, and the throw lands as an `uncaughtException` in the server
 * process. So every controller call is guarded, the file handle is destroyed
 * when the reader cancels, and backpressure is honoured.
 */
function fileStream(node: ReturnType<typeof createReadStream>): ReadableStream {
  return new ReadableStream({
    start(controller) {
      node.on("data", (chunk) => {
        try {
          controller.enqueue(new Uint8Array(chunk as Buffer));
        } catch {
          node.destroy();
          return;
        }
        if ((controller.desiredSize ?? 1) <= 0) node.pause();
      });
      node.on("end", () => { try { controller.close(); } catch { /* already closed */ } });
      node.on("error", (err) => { try { controller.error(err); } catch { /* already closed */ } });
    },
    pull() { node.resume(); },
    cancel() { node.destroy(); },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;

  // Contain every request inside media/. A decoded `..` must not escape it.
  const raw = normalize(path.map(decodeURIComponent).join("/"));
  const inApps = raw.startsWith("apps/");
  const rel = inApps ? raw.slice(5) : raw;
  const root = inApps ? APPS_ROOT : MEDIA_ROOT;
  const abs = join(root, rel);
  if (!abs.startsWith(root + sep) || (inApps && !APP_SERVED.test(rel))) {
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
      return new Response(fileStream(createReadStream(abs, { start, end })), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
      });
    }
  }

  return new Response(fileStream(createReadStream(abs)), {
    status: 200,
    headers: { ...headers, "Content-Length": String(stat.size) },
  });
}
