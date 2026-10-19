/**
 * /reactions — the reaction library of the workspace (lib/reactions.ts): real
 * reaction ranges of real posts, for a reaction hook's reference. A grid with
 * filters; a card opens the entry. Opened from a video in planning ("Choose a
 * reaction": ?pick=<app>/<video>), each card has "Use for <video>", which
 * writes a reaction.pick line that video-plan reads.
 */

import type { Metadata } from "next";

import { appOfPost, filterEntries, mediaUrl, planningVideos, readLibrary, readTags, usesOf, type Entry } from "@/lib/reactions";
import { ReactionsGrid, type Card, type PickFor } from "@/components/reactions/ReactionsGrid";
import "./reactions.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reactions — Organic Factory" };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function cardOf(e: Entry, uses: Record<string, string[]>): Card {
  return {
    id: e.id, status: e.status, start: e.start_s, end: e.end_s, length: e.length_s, tags: e.tags ?? [],
    faceReplace: e.fit?.face_replace ?? null, written: e.fit?.written ?? null,
    preview: e.preview ? `/api/reactions/preview/${e.id}` : null, video: mediaUrl(e.source.video),
    handle: e.source.handle, views: e.source.views, app: appOfPost(e.source.post_dir),
    beats: e.expression_beats?.length ?? 0, hookText: e.hook_text, note: e.note ?? "", uses: uses[e.id] ?? [], by: e.added?.by ?? "agent",
  };
}

export default async function ReactionsPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const lib = readLibrary();
  const { tags, hook_jobs } = readTags();
  const uses = usesOf();
  const entries = Object.values(lib.entries);

  const [pApp, pVideo] = one(q.pick).split("/");
  const v = pApp && pVideo ? planningVideos().find((x) => x.app === pApp && x.video === pVideo) : undefined;
  const pick: PickFor = v ? { app: v.app, video: v.video, job: v.job, picked: v.picked } : null;
  /* Opened for a video, the grid starts on its hook job, as video-plan would rank it. */
  const job = q.job !== undefined ? one(q.job) : pick?.job ?? "";

  const max = Number(one(q.max));
  const shown = filterEntries(entries, { tag: one(q.tag), job, fit: one(q.fit) as "face_replace" | "written" | "", maxS: Number.isFinite(max) && max > 0 ? max : null, status: one(q.status), app: one(q.from), unused: one(q.unused) === "1" }, hook_jobs, uses);
  const apps = [...new Set(entries.map((e) => appOfPost(e.source.post_dir)))].sort();
  const kept = entries.filter((e) => e.status === "kept").length;
  const proposed = entries.filter((e) => e.status === "proposed").length;

  return (
    <div className="page niche rx">
      <header className="niche-head">
        <h1>Reactions</h1>
        <p className="niche-totals">
          <strong>{kept}</strong> kept · <strong>{proposed}</strong> proposed by the agent · {entries.length - kept - proposed} retired. Real reactions from your research, each a range of a real post, played where it is.
        </p>
        <p className="rx-hint">A reaction hook is never spoken and never invented: video-plan takes its performance from one of these. Keep the good ones; retire the rest.</p>
      </header>
      <ReactionsGrid cards={shown.map((e) => cardOf(e, uses))} total={entries.length} tags={tags} jobs={Object.keys(hook_jobs)} apps={apps} pick={pick} />
    </div>
  );
}
