/**
 * The reaction library (lib/reactions.ts): no route fit (every reaction is
 * made by motion copy), the user's changes named in set_by_you, the filter and its
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

test("the reaction card: a library entry by library_id, else the reference, the post's picture and the plan's beats", () => {
  const e = { ...described(rx.newEntry(src, 0.5, 2.5, ["regret"], "", AT)), id: "rx-tiktok-7600000000000000001-5", preview: "library/reactions/previews/x.jpg" };
  const lib = { version: 1 as const, entries: { [e.id]: e } };
  const fromLib = rx.reactionCardOf({ library_id: e.id, generation_input: "motion_copy" }, [], lib)!;
  assert.equal(fromLib.entryId, e.id);
  assert.equal(fromLib.preview, `/api/reactions/preview/${e.id}`);
  assert.equal(fromLib.video, "/media/demo/brand/some.handle/7600000000000000001/video.mp4");
  assert.deepEqual([fromLib.start, fromLib.end], [0.5, 2.5]);
  assert.ok(!("faceReplace" in fromLib) && !("planRoute" in fromLib), "the card names no route fit");
  assert.equal(fromLib.postHref, "/post/7600000000000000001");
  const differs = rx.reactionCardOf({ library_id: e.id, library_differs: "a shorter range", start_s: 1, end_s: 2 }, [], lib)!;
  assert.deepEqual([differs.start, differs.end], [1, 2]);

  const dir = "research/demo/brand/some.handle/7600000000000000001";
  mkdirSync(join(WS, dir), { recursive: true });
  writeFileSync(join(WS, dir, "sheet_01.png"), "png");
  const plan = { reaction_refs: [{ id: "rx1", start_s: 1 }], beats: [{ id: "b1", reaction: { ref_id: "rx1", expression_beats: [{ start_s: 0, end_s: 0.5, ref_s: [1, 1.5], face: "mouth open", eyes: "wide", head: "back" }] } }] };
  const beats = rx.planBeatsOf(plan, "rx1", 1);
  assert.deepEqual(beats.map((b) => [b.start_s, b.end_s]), [[0, 0.5]]);
  const ref = rx.reactionCardOf({ post_id: "7600000000000000001", platform: "tiktok", handle: "@some.handle", post_dir: dir, video: `${dir}/video.mp4`, start_s: 1, end_s: 2, burned_in_text: "\"NOW?\", top" }, beats, lib)!;
  assert.equal(ref.entryId, null);
  assert.equal(ref.sameIn, e.id, "the library has the same post over the range");
  assert.equal(ref.preview, `/media/${dir.slice("research/".length)}/sheet_01.png`);
  assert.deepEqual(ref.burnedIn, ['"NOW?", top']);
  assert.equal(ref.beats.length, 1);
  assert.equal(rx.reactionCardOf(null), null);
});

test("the search and the counts beside each filter option", () => {
  const mk = (id: string, tags: string[], len: number, handle: string, note = "") => ({ ...described(rx.newEntry({ ...src, handle }, 0, len, tags, note, AT)), id, length_s: len });
  const es = [mk("rx-tiktok-1-0", ["shock"], 2, "@a.one", "kitten hisses"), mk("rx-tiktok-2-0", ["regret"], 4, "@b.two"), mk("rx-tiktok-3-0", ["shock", "regret"], 3, "@c.three")];
  const jobs = { discovery_regret: ["regret"] };
  assert.deepEqual(rx.filterEntries(es, { q: "KITTEN" }, jobs).map((e) => e.id), ["rx-tiktok-1-0"], "the note, any case");
  assert.deepEqual(rx.filterEntries(es, { q: "c.three regret" }, jobs).map((e) => e.id), ["rx-tiktok-3-0"], "every word must match");
  const n = rx.facetCounts(es, { maxS: 3 }, jobs, ["shock", "regret"], ["demo"]);
  assert.deepEqual(n.tag, { shock: 2, regret: 1 }, "a tag counts with the length filter in force");
  assert.ok(!("fit" in n), "no route filter");
  assert.equal(n.job.discovery_regret, 1);
  assert.deepEqual(n.max, { "2": 1, "3": 2, "5": 3, "10": 3 });
  assert.equal(n.any.max, 3, "removing the length filter gives all three back");
  assert.equal(n.status.kept, 2, "an entry added from a post page is kept");
  assert.deepEqual(rx.filterEntries(es, { q: '"kitten hisses"' }, jobs).map((e) => e.id), ["rx-tiktok-1-0"], "a quoted phrase");
});

test("sourceOf reads the post folder and its notes", () => {
  assert.equal(src.post_id, "7600000000000000001");
  assert.equal(src.handle, "@some.handle");
  assert.equal(src.platform, "tiktok");
  assert.equal(src.views, 1234);
  assert.equal(src.date, "2026-04-08");
  assert.equal(src.notes, "research/demo/brand/some.handle/7600000000000000001/notes.md");
});

test("no route fit: a new or changed entry gets no fit field, and a hidden face hides no entry", () => {
  const e = rx.newEntry(src, 0, 2, ["surprise"], "", AT);
  assert.ok(!("fit" in e));
  const changed = rx.applyChange(described(e), { tags: ["regret"] }, TAGS, AT);
  assert.ok(typeof changed !== "string" && !("fit" in changed));
  const hidden = { ...described(e), framing: { people: 2, cuts: 1, face_hidden_s: 1.5 } };
  assert.equal(rx.filterEntries([hidden], {}, {}).length, 1);
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
  const a = { ...base, id: "rx-tiktok-1-0", status: "proposed" as const, tags: ["regret"] };
  const b = { ...base, id: "rx-tiktok-2-0", status: "kept" as const, tags: ["regret"] };
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
