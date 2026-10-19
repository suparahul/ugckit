/**
 * The reaction library (lib/reactions.ts): the fit (the same rule as
 * reactions.py), the user's changes named in set_by_you, the filter and its
 * order, the /media paths both ways, an entry added from a post, and the
 * reaction.pick line. One temporary workspace, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const WS = mkdtempSync(join(tmpdir(), "atlas-rx-"));
process.env.ATLAS_ROOT = WS;
const rx = await import("./reactions.ts");

const AT = "2026-10-19T10:00:00Z";
const TAGS = ["surprise", "regret", "shock"];
const src = rx.sourceOf("research/demo/brand/some.handle/7600000000000000001/video.mp4", "- URL: https://www.tiktok.com/@some.handle/video/7600000000000000001\n- Views: 1,234\n- Posted: 2026-04-08\n", null);
const described = (e: ReturnType<typeof rx.newEntry>) => ({ ...e, speech: "none" as const, framing: { people: 1, cuts: 0, face_hidden_s: 0 }, expression_beats: [{ start_s: 0, end_s: 1, face: "brows up", eyes: "at the phone", head: "back" }] });

test("sourceOf reads the post folder and its notes", () => {
  assert.equal(src.post_id, "7600000000000000001");
  assert.equal(src.handle, "@some.handle");
  assert.equal(src.platform, "tiktok");
  assert.equal(src.views, 1234);
  assert.equal(src.date, "2026-04-08");
  assert.equal(src.notes, "research/demo/brand/some.handle/7600000000000000001/notes.md");
});

test("computeFit: unknown until described; face replace refuses two people, speech, a cut, a hidden face", () => {
  const e = rx.newEntry(src, 0, 2, ["surprise"], "", AT);
  assert.equal(e.fit.face_replace?.ok, null);
  const d = described(e);
  assert.equal(rx.computeFit(d).face_replace.ok, true);
  assert.equal(rx.computeFit({ ...d, framing: { people: 2, cuts: 0, face_hidden_s: 0 } }).face_replace.ok, false);
  assert.equal(rx.computeFit({ ...d, speech: "speaks" }).face_replace.ok, false);
  assert.equal(rx.computeFit({ ...d, speech: "speaks" }).written.ok, false);
  assert.equal(rx.computeFit({ ...d, framing: { people: 1, cuts: 1, face_hidden_s: 0 } }).face_replace.ok, false);
  assert.equal(rx.computeFit({ ...d, framing: { people: 1, cuts: 0, face_hidden_s: 0.8 } }).face_replace.ok, false);
  assert.equal(rx.computeFit({ ...d, length_s: 0.5 }).face_replace.ok, false);
});

test("newEntry from a post page is kept, by you, with only the user's fields", () => {
  const e = rx.newEntry(src, 1.25, 3.5, ["surprise", "surprise"], "the jaw drop", AT);
  assert.equal(e.id, "rx-tiktok-7600000000000000001-13");
  assert.equal(e.status, "kept");
  assert.equal(e.length_s, 2.25);
  assert.deepEqual(e.tags, ["surprise"]);
  assert.deepEqual(e.set_by_you, ["status", "start_s", "end_s", "tags", "note"]);
  assert.equal(e.added.by, "you");
});

test("applyChange names each field in set_by_you and refuses a bad range or tag", () => {
  const e = { ...described(rx.newEntry(src, 0, 2, [], "", AT)), status: "proposed" as const, set_by_you: [] as string[] };
  const kept = rx.applyChange(e, { status: "kept" }, TAGS, AT);
  assert.ok(typeof kept !== "string");
  assert.equal(kept.status, "kept");
  assert.deepEqual(kept.set_by_you, ["status"]);
  const ranged = rx.applyChange(e, { start_s: 0.5, end_s: 1.2 }, TAGS, AT, 4);
  assert.ok(typeof ranged !== "string");
  assert.equal(ranged.length_s, 0.7);
  assert.deepEqual(ranged.expression_beats, [], "a beat past the new range is dropped");
  assert.equal(typeof rx.applyChange(e, { start_s: 2, end_s: 1 }, TAGS, AT), "string");
  assert.equal(typeof rx.applyChange(e, { end_s: 9 }, TAGS, AT, 4), "string");
  assert.equal(typeof rx.applyChange(e, { tags: ["nope"] }, TAGS, AT), "string");
  assert.equal(typeof rx.applyChange(e, { status: "gone" as never }, TAGS, AT), "string");
});

test("filterEntries hides retired, matches the hook job's tags, and puts kept first", () => {
  const base = described(rx.newEntry(src, 0, 2, ["surprise"], "", AT));
  const a = { ...base, id: "rx-tiktok-1-0", status: "proposed" as const, tags: ["regret"], fit: rx.computeFit(base) };
  const b = { ...base, id: "rx-tiktok-2-0", status: "kept" as const, tags: ["regret"], fit: rx.computeFit(base) };
  const c = { ...base, id: "rx-tiktok-3-0", status: "retired" as const, tags: ["regret"] };
  const d = { ...base, id: "rx-tiktok-4-0", status: "proposed" as const, tags: ["shock"] };
  const jobs = { discovery_regret: ["regret"] };
  assert.deepEqual(rx.filterEntries([a, b, c, d], { job: "discovery_regret" }, jobs).map((e) => e.id), ["rx-tiktok-2-0", "rx-tiktok-1-0"]);
  assert.deepEqual(rx.filterEntries([a, b, c, d], { status: "retired" }, jobs).map((e) => e.id), ["rx-tiktok-3-0"]);
  assert.deepEqual(rx.filterEntries([a, b, d], { unused: true }, jobs, { "rx-tiktok-2-0": ["v1"] }).map((e) => e.id).sort(), ["rx-tiktok-1-0", "rx-tiktok-4-0"]);
  assert.deepEqual(rx.filterEntries([a, b, d], { app: "other" }, jobs), []);
});

test("mediaUrl and workspacePathOf: research and niche batches only, both ways", () => {
  assert.equal(rx.mediaUrl("research/demo/b/h/1/video.mp4"), "/media/demo/b/h/1/video.mp4");
  assert.equal(rx.mediaUrl("apps/demo/niche/batches/2026-10-18/h/1/video.mp4"), "/media/apps/demo/niche/batches/2026-10-18/h/1/video.mp4");
  assert.equal(rx.mediaUrl("pipeline/character/v/final/v.mp4"), null);
  assert.equal(rx.workspacePathOf("/media/demo/b/h/1/video.mp4"), "research/demo/b/h/1/video.mp4");
  assert.equal(rx.workspacePathOf("/media/apps/demo/niche/batches/d/h/1/video.mp4"), "apps/demo/niche/batches/d/h/1/video.mp4");
  assert.equal(rx.workspacePathOf("/media/apps/demo/handles/x/references/face.png"), null);
  assert.equal(rx.workspacePathOf("/media/../../etc/passwd"), null);
});

test("addFromPost, changeEntry and the pick line, in a workspace", () => {
  const post = join(WS, "research", "demo", "brand", "some.handle", "7600000000000000001");
  mkdirSync(post, { recursive: true });
  writeFileSync(join(post, "video.mp4"), "not really a video");
  mkdirSync(join(WS, "docs", "character"), { recursive: true });
  writeFileSync(join(WS, "docs", "character", "reaction-tags.json"), JSON.stringify({ tags: TAGS, hook_jobs: {} }));
  const video = "research/demo/brand/some.handle/7600000000000000001/video.mp4";
  assert.equal(typeof rx.addFromPost("pipeline/x.mp4", 0, 1, [], ""), "string");
  assert.equal(typeof rx.addFromPost(video, 0, 1, ["nope"], ""), "string");
  const e = rx.addFromPost(video, 0, 1.5, ["surprise"], "");
  assert.ok(typeof e !== "string", String(e));
  assert.equal(e.source.video_sha256?.length, 64);
  assert.equal(typeof rx.addFromPost(video, 0, 1.5, [], ""), "string", "the same range twice is refused");
  const c = rx.changeEntry(e.id, { status: "retired", note: "too dark" });
  assert.ok(typeof c !== "string");
  assert.equal(rx.readLibrary().entries[e.id].status, "retired");

  mkdirSync(join(WS, "apps", "demo", "production", "video-plans", "maya-2026-10-20-rx"), { recursive: true });
  writeFileSync(join(WS, "apps", "demo", "production", "video-plans", "maya-2026-10-20-rx", "brief.json"), JSON.stringify({ anatomy: { hook: { job_id: "discovery_regret", channel: "reaction" } }, strategy_ref: { post: "2026-10-20/maya/1" }, reaction_reference: { library_id: e.id } }));
  const vids = rx.planningVideos();
  assert.deepEqual(vids.map((v) => [v.video, v.reaction, v.post]), [["maya-2026-10-20-rx", true, "2026-10-20/maya/1"]]);
  assert.deepEqual(rx.usesOf()[e.id], ["maya-2026-10-20-rx"]);
  rx.appendPick("demo", "maya-2026-10-20-rx", e.id, "2026-10-20/maya/1", "this one");
  const line = JSON.parse(readFileSync(join(WS, "apps", "demo", "production", "log.jsonl"), "utf8").trim());
  assert.equal(line.kind, "reaction.pick");
  assert.equal(line.actor, undefined);
  assert.deepEqual(line.data, { video: "maya-2026-10-20-rx", entry_id: e.id });
  assert.equal(rx.lastPick("demo", "maya-2026-10-20-rx"), e.id);
  rmSync(WS, { recursive: true, force: true });
});
