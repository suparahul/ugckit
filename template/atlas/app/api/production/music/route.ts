/**
 * The reel's music, chosen on the post page (components/production/MusicPick.tsx).
 *
 * GET  ?track=<group>/<file>       the track itself, for the preview player
 * POST { app, post, track }        `track`: a path under assets/music, or "none". Lays the track under the post's reel
 *                                  (scripts/add-audio.mjs, mixed from the silent render, free) and writes one `music.set`
 *                                  line. A slideshow with no reel yet records the choice: the reel carries it when it is cut.
 */

import { NextResponse, type NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { createReadStream, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";

import { AUDIO_TYPE, isTrack, MUSIC_DIR } from "@/lib/music";
import { allStates, appendEvent, postVideo, validSlug } from "@/lib/production";
import { ROOT } from "@/lib/root";

export const dynamic = "force-dynamic";
const run = promisify(execFile);

export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("track") ?? "";
  if (!isTrack(t)) return NextResponse.json({ error: "No such track." }, { status: 404 });
  const abs = join(MUSIC_DIR, t);
  const body = Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream;
  return new NextResponse(body, { headers: { "Content-Type": AUDIO_TYPE[t.split(".").pop()!.toLowerCase()] ?? "application/octet-stream", "Content-Length": String(statSync(abs).size) } });
}

export async function POST(request: NextRequest) {
  let body: { app?: unknown; post?: unknown; track?: unknown };
  try { body = (await request.json()) as typeof body; } catch { return NextResponse.json({ error: "Body is not JSON." }, { status: 400 }); }
  const slug = typeof body.app === "string" ? body.app : "", post = typeof body.post === "string" ? body.post : "", track = typeof body.track === "string" ? body.track : "";
  if (!validSlug(slug) || !post) return NextResponse.json({ error: "app and post are required." }, { status: 400 });
  if (track !== "none" && !isTrack(track)) return NextResponse.json({ error: "Pick a track from the list." }, { status: 400 });
  const state = allStates(slug).find((s) => s.row.key === post);
  if (!state) return NextResponse.json({ error: "No such post." }, { status: 404 });
  if (state.posted || state.sent) return NextResponse.json({ error: "This post has already gone out; its sound is what went with it." }, { status: 400 });
  if (postVideo(slug, post)) {
    try {
      await run("node", [join(ROOT, "scripts", "add-audio.mjs"), slug, post, "--audio", track === "none" ? "none" : join(MUSIC_DIR, track)], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, ATLAS_ROOT: ROOT } });
    } catch (e) {
      const err = e as { stderr?: string; message?: string };
      return NextResponse.json({ error: `The music could not be added: ${(err.stderr || err.message || "unknown error").toString().trim().split("\n").slice(-2).join(" ")}` }, { status: 500 });
    }
  }
  appendEvent(slug, { post, kind: "music.set", actor: "user", data: { track } });
  return NextResponse.json({ ok: true, track, mixed: !!postVideo(slug, post) });
}
