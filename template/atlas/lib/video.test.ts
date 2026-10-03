/**
 * A video post in the studio: the plan row's video columns, the files a video
 * has, and the four states through the slideshow's gates (idea, plan, final).
 * A temporary workspace (ATLAS_ROOT) and a temporary working directory (the
 * built plan in data/) hold every file; nothing real is read or written.
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BRAIN = JSON.parse(readFileSync(join(HERE, "..", "..", "brain", "video-patterns.json"), "utf8"));

const WS = mkdtempSync(join(tmpdir(), "atlas-video-ws-"));
const CWD = mkdtempSync(join(tmpdir(), "atlas-video-cwd-"));
process.env.ATLAS_ROOT = WS;
process.chdir(CWD);

const { brainValues, columnsOf, isRecreation, kindOf, tagsOf, videoIdIn, videoIdeaOf } = await import("./video-row.ts");
const { beatsOf, readVideo, reviewHead, validVideoId, videoIdOf, videoPlanPoint } = await import("./video.ts");
const { finalBlock, postState, primaryAction } = await import("./production.ts");

const SLUG = "pawly";
const ID = "maya-2026-10-06-vettech";
const KEY = "2026-10-06/maya/1";
const DIGEST = "a".repeat(64);
const SHA = "b".repeat(64);

const w = (p: string, body: unknown) => {
  const abs = join(WS, p);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body));
};
const rm = (p: string) => rmSync(join(WS, p), { recursive: true, force: true });
const reset = () => { rm("apps"); rm("pipeline"); };

const row = {
  slug: SLUG, key: KEY, n: 1, day: 1, date: "2026-10-06", short: "maya", handle: "@maya.petmom", role: "main", slot: "PM",
  topic: "the vet-tech tip nobody gives you", format: "video-plan", arm: "Pawly payoff",
  source: { raw: "", handle: null, id: null, views: null }, sourceRaw: "", sources: [],
  idea: { premise: null, product: null, feature: null, reasons: [], experiments: [], answer: null, record: null },
  kind: "video" as const, video: { type: "talking_head", hook: null, hookJob: null, length: "15" }, tags: ["#a", "#b"], videoId: null,
};
mkdirSync(join(CWD, "data"), { recursive: true });
writeFileSync(join(CWD, "data", `production-${SLUG}.json`), JSON.stringify({ generatedAt: "x", plan: { title: null, range: null, app: "Pawly", slug: SLUG, appStoreId: null, service: "postbridge", zones: { posting: null, home: null }, handles: {}, rules: [], tasks: {}, platforms: ["tiktok"] }, rows: [row], decks: [], notes: [] }));

const PD = `apps/${SLUG}/production/video-plans/${ID}`;
const VD = `pipeline/character/${ID}`;
const REVIEW = (rev: number, dig = DIGEST) => `# Review — \`${ID}\`, revision ${rev}\n\n**Content digest:** \`${dig}\`\n\nApprove this exact revision.\n`;
const PLAN = {
  schema_version: 2, revision: 1, video_id: ID, format: { length_s: 6 },
  script: [{ id: "l1", speaker: "vo", line: "A cat that hides for two days needs a vet." }],
  beats: [
    { id: "b2", role: "result", start_s: 3, end_s: 6, lines: ["l1"], action: "she nods", performance: "on_camera" },
    { id: "b1", role: "attention", start_s: 0, end_s: 3, lines: [], action: "she stares at the lens", performance: "silent_action" },
  ],
  overlays: [{ id: "o1", text: "Nobody told me this", start_s: 0, end_s: 2.5 }],
  publishing_note: { caption: "what the vet tech said", bio_ref: null, music_note: null },
  approved: { words: "yes, lock it", date: "2026-10-04" },
};
const brief = (extra: Record<string, unknown> = {}) => w(`${PD}/brief.json`, { video_id: ID, handle: "@maya.petmom", date: "2026-10-06", strategy_ref: { post: KEY }, ...extra });
const draft = (rev: number) => { w(`${PD}/plan.draft.json`, { ...PLAN, approved: undefined, revision: rev }); w(`${PD}/REVIEW.md`, REVIEW(rev)); };
const lock = (rev = 1, extra: Record<string, unknown> = {}) => {
  w(`${VD}/plan.json`, { ...PLAN, revision: rev });
  w(`${VD}/planning-approval.json`, { video_id: ID, revision: rev, content_sha256: DIGEST, words: "yes, lock it", date: "2026-10-04", ...extra });
};
const deliver = (sha = SHA) => { w(`${VD}/final/${ID}.mp4`, "mp4"); w(`${VD}/final/delivery.json`, { video_id: ID, sha256: sha, duration_s: 6, delivered: "2026-10-05T10:00:00Z" }); };
type Ev = { at: string; post: string; kind: string; note?: string; hash?: string; data?: Record<string, unknown> };
const ev = (kind: string, extra: Partial<Ev> = {}): Ev => ({ at: "2026-10-04T12:00:00.000Z", post: KEY, kind, ...extra });
const state = (log: Ev[]) => postState(row as never, log as never);

/* ------------------------------------------------------------------ the row */

test("the plan row: Kind and the video columns by their headers; an old table reads as slideshows", () => {
  const brain = brainValues(BRAIN)!;
  assert.ok(brain.videoTypes.includes("talking_head") && brain.videoTypes.includes("reaction"));
  assert.equal(brain.hookJobs.length, 12);
  const head = ["Day", "Date", "Handle", "Slot", "Topic", "Format / variation", "Arm", "Source", "Tags", "Kind", "Video type", "Hook", "Hook job", "Length"];
  const cols = columnsOf(head);
  const c = ["1", "10-06", "maya", "PM", "tip", "video-plan", "arm", "src", "#a #b #c", "video", "Talking head", "Nobody told me this", "gratitude_discovery", "15s"];
  assert.equal(kindOf(c, cols), "video");
  assert.deepEqual(tagsOf(c, cols), ["#a", "#b", "#c"]);
  const { idea, warnings } = videoIdeaOf(c, cols, brain);
  assert.deepEqual(idea, { type: "talking_head", hook: "Nobody told me this", hookJob: "gratitude_discovery", length: "15" });
  assert.deepEqual(warnings, []);
  /* An old table: no Kind column, so every row is a slideshow. */
  assert.equal(kindOf(c.slice(0, 9), columnsOf(head.slice(0, 9))), "slideshow");
  /* Empty and dashed cells are video-plan's to choose; an unknown value is a warning, never a refusal. */
  const blank = videoIdeaOf(["", "", "", "", "", "", "", "", "", "video", "dance", "—", "", ""], cols, brain);
  assert.equal(blank.idea.hook, null);
  assert.match(blank.warnings.join(" "), /dance.*not in the video brain/);
  assert.match(videoIdeaOf(["", "", "", "", "", "", "", "", "", "video", "", "", "", ""], cols, brain).warnings.join(" "), /needs a Video type/);
  assert.equal(videoIdeaOf([...c.slice(0, 10), "face_to_demo", "", "", ""], cols, brain).idea.type, "hook_to_demo");
});

test("an old plan's id in Format / variation still counts; a recreation row is recognised", () => {
  assert.equal(videoIdIn("video-plan reaction, hannah-2026-10-05-reaction-h5"), "hannah-2026-10-05-reaction-h5");
  assert.equal(videoIdIn("nicole-w1-01-gratitude-vettech"), "nicole-w1-01-gratitude-vettech");
  assert.equal(videoIdIn("tip list, 7 slides"), null);
  assert.ok(isRecreation("originate, stage 5"));
  assert.ok(!isRecreation("video-plan"));
});

/* ---------------------------------------------------------------- the files */

test("the video id: the row's own, else the brief keyed to the post, else the one brief for the handle and day", () => {
  reset();
  assert.equal(videoIdOf(row), null);
  brief();
  assert.equal(videoIdOf(row), ID);
  assert.equal(videoIdOf({ ...row, videoId: "old-2026-10-01-x" }), "old-2026-10-01-x");
  reset();
  brief({ strategy_ref: {} });
  assert.equal(videoIdOf(row), ID);
  w(`apps/${SLUG}/production/video-plans/maya-2026-10-06-other/brief.json`, { video_id: "x", handle: "@maya.petmom", date: "2026-10-06", strategy_ref: {} });
  assert.equal(videoIdOf(row), null, "two briefs for the day and no post key: no guess");
  assert.ok(!validVideoId("../x") && !validVideoId("Maya-1") && validVideoId(ID));
});

test("REVIEW.md's revision and digest; the beats in order with their words, text and prompts", () => {
  assert.deepEqual(reviewHead(REVIEW(3)), { revision: 3, digest: DIGEST });
  assert.deepEqual(reviewHead("# something else"), { revision: null, digest: null });
  const beats = beatsOf(PLAN, [{ name: "01-t", beatIds: ["b2"], prompt: "SUBJECT\nher" }]);
  assert.deepEqual(beats.map((b) => b.id), ["b1", "b2"]);
  assert.deepEqual(beats[0].onScreen, ["Nobody told me this"]);
  assert.deepEqual(beats[1].said, [{ speaker: "vo", line: "A cat that hides for two days needs a vet." }]);
  assert.deepEqual(beats[1].prompts, [{ segment: "01-t", text: "SUBJECT\nher" }]);
});

test("readVideo: a dry run, words missing, or another revision is not a lock; prompts come from video.json", () => {
  reset(); brief(); draft(1);
  lock(1, { dry_run: true, words: null });
  assert.equal(readVideo(row).lock, null);
  lock(1, { revision: 2 });
  assert.equal(readVideo(row).lock, null);
  lock(1);
  w(`${VD}/video.json`, { segments: [{ n: 1, type: "T", beat_ids: ["b1", "b2"] }] });
  w(`${VD}/segments/01-t/prompt.txt`, "SUBJECT\nMaya\n");
  const v = readVideo(row);
  assert.equal(v.lock?.revision, 1);
  assert.equal(v.plan?.caption, "what the vet tech said");
  assert.equal(v.plan?.beats[0].prompts[0].segment, "01-t");
  assert.equal(v.final, null);
  deliver();
  assert.equal(readVideo(row).final?.url, `/media/pipeline/character/${ID}/final/${ID}.mp4?v=${SHA.slice(0, 12)}`);
});

/* ------------------------------------------------------------ the four states */

test("each state of a video post, through the slideshow's gates", () => {
  reset();
  let s = state([]);
  assert.equal(s.stage, "idea");
  assert.equal(s.sentence, "idea: waiting for you");

  s = state([ev("idea.approve")]);
  assert.equal(s.stage, "planned", "idea approved");
  assert.equal(s.sentence, "script being written");

  brief();
  assert.equal(state([]).stage, "planned", "a brief on disk counts as an approved idea, as a deck does");

  draft(1);
  s = state([]);
  assert.equal(s.stage, "plan");
  assert.ok(s.waiting);
  assert.deepEqual(primaryAction(s), { kind: "plan.approve", label: "Approve plan", disabled: null });

  s = state([ev("plan.approve", { data: { video: ID, revision: 1, digest: DIGEST } })]);
  assert.equal(s.stage, "final", "plan approved in the Atlas");
  assert.equal(s.sentence, "plan approved: lock being written");
  assert.equal(s.mode, "produced");
  assert.equal(finalBlock(s), "the plan is not locked yet");

  lock(1);
  s = state([]);
  assert.equal(s.stage, "final", "plan approved by the lock");
  assert.equal(s.sentence, "in production");
  assert.equal(finalBlock(s), "the video is not delivered yet");

  deliver();
  s = state([]);
  assert.equal(s.stage, "final", "ready for posting");
  assert.equal(s.sentence, "final: waiting for you");
  assert.equal(finalBlock(s), null);
  assert.equal(primaryAction(s).kind, "final.approve");
  assert.equal(s.dimension, "9:16");
  assert.deepEqual(s.checks, []);

  s = state([ev("final.approve", { hash: SHA })]);
  assert.equal(s.stage, "ready", "approved for posting");
  assert.equal(primaryAction(s).kind, "posted");

  s = state([ev("final.approve", { hash: SHA }), ev("posted", { at: "2026-10-06T18:00:00.000Z", data: { time: "18:00" } })]);
  assert.equal(s.stage, "posted");
});

test("a redelivered file makes the final stale; a final send-back holds", () => {
  reset(); brief(); draft(1); lock(1); deliver("c".repeat(64));
  let s = state([ev("final.approve", { hash: SHA })]);
  assert.equal(s.stage, "final");
  assert.equal(s.final.status, "stale");
  assert.equal(s.sentence, "changed after approval: waiting for you");
  s = state([ev("final.sendback", { note: "the hook text is late" })]);
  assert.equal(s.sentence, "final: sent back — “the hook text is late”");
});

test("the plan gate: an Atlas approval of another digest is not one; a send-back holds until a new revision; a newer draft after the lock re-asks", () => {
  reset(); brief(); draft(1);
  const s0 = state([ev("plan.approve", { data: { video: ID, revision: 1, digest: "d".repeat(64) } })]);
  assert.equal(s0.stage, "plan");
  const back = [ev("plan.sendback", { note: "shorter hook", data: { video: ID, revision: 1 } })];
  assert.equal(state(back).plan.status, "sentback");
  assert.equal(state(back).sentence, "plan: sent back — “shorter hook”");
  draft(2);
  assert.equal(state(back).plan.status, "open", "a new revision clears the send-back");
  lock(1);
  const s = state([]);
  assert.equal(s.plan.status, "stale");
  assert.equal(s.stage, "plan");
  assert.equal(s.sentence, "plan changed after the lock: waiting for you");
  assert.equal(videoPlanPoint(readVideo(row), [ev("plan.approve", { data: { video: ID, revision: 2, digest: DIGEST } })] as never).status, "approved");
});

test("a killed video post is killed; a slideshow row is untouched by any of this", () => {
  reset();
  assert.equal(state([ev("kill", { note: "no" })]).stage, "killed");
  const slide = postState({ ...row, kind: undefined, video: undefined } as never, [] as never);
  assert.equal(slide.video, null);
  assert.equal(slide.stage, "idea");
  assert.equal(slide.dimension, "3:4");
});
