/**
 * The saved Monid runs (lib/monid-archive.ts) and the sync's use of them
 * (tiktok-link.ts findLinks): a post with no link is looked for in the saved
 * runs before any paid fetch, and a Monid post no planned post claims is kept.
 * A temporary workspace (ATLAS_ROOT); no network: the paid fetch throws, and
 * the saved runs are given. Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

globalThis.fetch = (async () => { throw new Error("no network in this test"); }) as typeof fetch;

const WS = mkdtempSync(join(tmpdir(), "atlas-monid-ws-"));
const CWD = mkdtempSync(join(tmpdir(), "atlas-monid-cwd-"));
process.env.ATLAS_ROOT = WS;
process.chdir(CWD);

const { archiveDirOf, archivedRuns, keepRun, listedRunIds, rawFetchFile, recordsFor } = await import("./monid-archive.ts");
const { legState, readLog } = await import("./production.ts");
const { findLinks, unplannedOf } = await import("./tiktok-link.ts");
type MonidPost = import("./tiktok-link.ts").MonidPost;
type MonidRun = import("./tiktok-link.ts").MonidRun;

const SLUG = "pawly";
const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const DATE = day(2);
const base = {
  slug: SLUG, day: 1, date: DATE, short: "maya", handle: "@maya.petmom", role: "main", format: "x",
  source: { raw: "", handle: null, id: null, views: null }, sourceRaw: "", sources: [],
  idea: { premise: null, product: null, feature: null, reasons: [], experiments: [], answer: null, record: null }, tags: [],
};
const MID = { ...base, key: `${DATE}/maya/3`, n: 3, slot: "MID", topic: "Reaction: a video", kind: "video" as const, video: { type: "reaction", hook: null, hookJob: null, length: "15" } };
mkdirSync(join(CWD, "data"), { recursive: true });
writeFileSync(join(CWD, "data", `production-${SLUG}.json`), JSON.stringify({ generatedAt: "x", plan: { title: null, range: null, app: "Pawly", slug: SLUG, appStoreId: null, service: "postbridge", zones: { posting: null, home: null }, handles: {}, rules: [], tasks: {} }, rows: [MID], decks: [], notes: [] }));
mkdirSync(join(WS, "apps", SLUG, "production"), { recursive: true });
writeFileSync(join(WS, "apps", SLUG, "production", "log.jsonl"), "");

const rec = (id: string, at: string, views: number, video = true): MonidPost => ({ id, postPage: "", uploadedAtFormatted: at, views, likes: 3, comments: 1, shares: 2, bookmarks: 0, title: "", ...(video ? {} : { images: [{}] }) });
const runOf = (runId: string, completedAt: string, output: MonidPost[], name = "maya.petmom"): MonidRun => ({ runId, status: "COMPLETED", endpoint: "/apidojo/tiktok-profile-scraper", input: { body: { usernames: [name] } }, completedAt, output });
const noPaidCall = async () => { throw new Error("a paid fetch was made"); };

test("the folder: a raw fetch and a saved run read back as runs; each post once, at its latest read", () => {
  const raw = rawFetchFile(SLUG, "@Maya.PetMom", "2026-01-02T10:00:00.000Z");
  assert.ok(raw.startsWith(archiveDirOf(SLUG)), "inside the project, not a temporary folder");
  writeFileSync(raw, JSON.stringify([rec("1", "2026-01-01T09:00:00.000Z", 50)]));
  keepRun(SLUG, runOf("01ABCDEFGHJKMNPQRSTVWXYZ00", "2026-01-03T10:00:00.000Z", [rec("1", "2026-01-01T09:00:00.000Z", 80)]));
  keepRun(SLUG, runOf("01ABCDEFGHJKMNPQRSTVWXYZ00", "2026-01-03T10:00:00.000Z", []));
  assert.equal(readdirSync(archiveDirOf(SLUG)).length, 2, "a run is kept once");
  const runs = archivedRuns(SLUG);
  assert.equal(runs.length, 2);
  const recs = recordsFor(runs, "@maya.petmom");
  assert.equal(recs.length, 1);
  assert.equal(recs[0].views, 80);
  assert.equal(recs[0].readAt, "2026-01-03T10:00:00.000Z");
  assert.deepEqual(recordsFor(runs, "someone.else"), []);
});

test("listedRunIds: an array or the first array of an object; other endpoints and unfinished runs left out", () => {
  const rows = [{ runId: "A1", endpoint: "/apidojo/tiktok-profile-scraper", status: "COMPLETED" }, { id: "B2" }, { runId: "C3", endpoint: "/x/search", status: "COMPLETED" }, { runId: "D4", status: "RUNNING" }];
  assert.deepEqual(listedRunIds(rows).map((x) => x.id), ["A1", "B2"]);
  assert.deepEqual(listedRunIds({ runs: rows, cursor: "c" }).map((x) => x.id), ["A1", "B2"]);
  assert.deepEqual(listedRunIds("nothing"), []);
});

test("a slot card with no link is found in a saved run before any paid fetch; a post outside the plan is kept once", async () => {
  const readAt = `${day(1)}T10:55:20.167Z`;
  const runs = [runOf("01SAVEDRUN0000000000000000", readAt, [
    rec("700", `${DATE}T20:53:20.000Z`, 207),
    rec("701", `${DATE}T22:10:00.000Z`, 40, false),
  ])];
  const r = await findLinks(SLUG, { keys: [MID.key] }, noPaidCall, { savedRuns: async () => runs });
  assert.equal(r[0].status, "linked");
  assert.equal(r[0].tiktokId, "700");
  assert.match(r[0].note, /saved Monid run.*no paid call/);
  const log = readLog(SLUG);
  const mine = log.filter((e) => e.post === MID.key);
  assert.equal(mine.find((e) => e.kind === "posted")?.data?.manual, true);
  const tt = legState(mine, "tiktok");
  assert.equal(tt.synced?.views, 207);
  assert.equal(tt.synced?.syncedAt, readAt, "the read time of the run");
  const un = unplannedOf(log);
  assert.deepEqual(un.map((e) => e.data?.id), ["701"], "the slideshow no planned post claims is kept");
  assert.equal(un[0].handle, "@maya.petmom");

  /* A second sync: the post is linked, its numbers come from the paid fetch; the kept post is not written again. */
  const paid = async () => [rec("700", `${DATE}T20:53:20.000Z`, 900), rec("701", `${DATE}T22:10:00.000Z`, 60, false)];
  const again = await findLinks(SLUG, { keys: [MID.key] }, paid, { savedRuns: async () => runs });
  assert.equal(again[0].status, "known");
  assert.equal(legState(readLog(SLUG).filter((e) => e.post === MID.key), "tiktok").synced?.views, 900);
  assert.equal(readLog(SLUG).filter((e) => e.kind === "monid.unplanned").length, 1);
  assert.ok(!existsSync(join(archiveDirOf(SLUG), "nothing")));
});

test("--no-monid: the saved runs are still read, and no paid fetch is made", async () => {
  writeFileSync(join(WS, "apps", SLUG, "production", "log.jsonl"), "");
  const runs = [runOf("01SAVEDRUN0000000000000001", `${day(1)}T10:00:00.000Z`, [rec("800", `${DATE}T20:00:00.000Z`, 12)])];
  const r = await findLinks(SLUG, { keys: [MID.key] }, noPaidCall, { noMonid: true, savedRuns: async () => runs });
  assert.equal(r[0].status, "linked");
  assert.equal(r[0].tiktokId, "800");
});
