/**
 * The current outcome record (lib/outcome.ts): the merge each sync makes at
 * write time, the backfill of an old log, and the write itself
 * (production.ts recordOutcome), with a slot card nobody marked posted
 * (tiktok-link.ts unmarkedOnTiktok). A temporary workspace (ATLAS_ROOT); no
 * network: Monid is a fake fetch. Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

globalThis.fetch = (async () => { throw new Error("no network in this test"); }) as typeof fetch;

const WS = mkdtempSync(join(tmpdir(), "atlas-outcome-ws-"));
const CWD = mkdtempSync(join(tmpdir(), "atlas-outcome-cwd-"));
process.env.ATLAS_ROOT = WS;
process.chdir(CWD);

const { backfillOutcome, mergeOutcome, sameOutcome, sourcesText } = await import("./outcome.ts");
const { allStates, appendEvent, legState, readLog, recordOutcome } = await import("./production.ts");
const { findLinks, syncsOnTiktok, unmarkedOnTiktok } = await import("./tiktok-link.ts");
type Event = import("./production.ts").Event;
type MonidPost = import("./tiktok-link.ts").MonidPost;

const monid = (at: string, views: number, saves: number) => ({ source: "monid", at, values: { views, likes: 1, comments: 0, saves, shares: 0 } });
const pb = (at: string, views: number) => ({ source: "postbridge", at, values: { views, likes: 2, comments: 1, shares: 3 } });

test("merge: a fetch replaces the fields it read, keeps the others, and marks each field's source and time", () => {
  const a = mergeOutcome(null, "tiktok", monid("2026-09-20T08:12:10.000Z", 310, 6));
  const b = mergeOutcome(a, "tiktok", pb("2026-09-21T09:20:00.000Z", 5120));
  assert.equal(b.views, 5120, "the newer read wins, whatever its source");
  assert.equal(b.saves, 6, "Post Bridge has no saves: the last known value stays");
  assert.deepEqual(b.fields.views, { source: "postbridge", at: "2026-09-21T09:20:00.000Z" });
  assert.deepEqual(b.fields.saves, { source: "monid", at: "2026-09-20T08:12:10.000Z" });
  assert.equal(b.by, "postbridge");
  assert.equal(sourcesText(b.fields), "views, likes, comments and shares from Post Bridge 2026-09-21 · saves from Monid 2026-09-20");
});

test("merge: an older read (a saved run replayed, a Post Bridge cooldown) does not replace a newer one", () => {
  const a = mergeOutcome(null, "tiktok", pb("2026-10-15T10:00:00Z", 900));
  const b = mergeOutcome(a, "tiktok", monid("2026-10-14T10:00:00Z", 400, 9));
  assert.equal(b.views, 900);
  assert.equal(b.saves, 9, "a field the record never had is taken");
  assert.equal(b.fields.views?.source, "postbridge");
});

test("merge: 0 views over real views is a failed read and changes nothing", () => {
  const a = mergeOutcome(null, "tiktok", monid("2026-10-14T10:00:00Z", 400, 9));
  const b = mergeOutcome(a, "tiktok", pb("2026-10-15T10:00:00Z", 0));
  assert.ok(sameOutcome(a, b));
  assert.equal(b.views, 400);
});

test("merge: Post Bridge's share_url is kept without its utm query", () => {
  const a = mergeOutcome(null, "tiktok", { ...pb("2026-10-15T10:00:00Z", 1), url: "https://www.tiktok.com/@x/video/7?utm_campaign=a" });
  assert.equal(a.url, "https://www.tiktok.com/@x/video/7");
});

test("backfill: an old log gives the newest number per field, in read-time order, whatever the line order", () => {
  const lines: Event[] = [
    { at: "2026-09-20T08:12:10.000Z", post: "p", kind: "outcome.sync", data: { source: "monid", views: 310, likes: 15, comments: 0, saves: 6, shares: 0, url: "https://www.tiktok.com/@x/photo/7", syncedAt: "2026-09-20T08:12:10.000Z" } },
    /* Written later, read earlier: Post Bridge's analytics time is before Monid's read. */
    { at: "2026-09-20T08:16:30.000Z", post: "p", kind: "outcome.sync", data: { source: "postbridge", views: 300, likes: 15, comments: 0, shares: 0, url: "", syncedAt: "2026-09-20T08:11:05.000+00:00" } },
    { at: "2026-09-21T09:30:00.000Z", post: "p", kind: "outcome.sync", data: { source: "postbridge", views: 5120, likes: 61, comments: 2, shares: 9, url: "", syncedAt: "2026-09-21T09:20:00.000+00:00" } },
  ];
  const r = backfillOutcome(lines, "tiktok")!;
  assert.equal(r.views, 5120);
  assert.equal(r.likes, 61);
  assert.equal(r.saves, 6);
  assert.equal(r.fields.saves?.source, "monid");
  assert.equal(r.url, "https://www.tiktok.com/@x/photo/7");
  const two = backfillOutcome(lines.slice(0, 2), "tiktok")!;
  assert.equal(two.views, 310, "the Monid read is the later read of the two");
});

/* ---------------------------------------------------------- the workspace */

const SLUG = "pawly";
const day = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const DATE = day(1);
const base = {
  slug: SLUG, day: 1, date: DATE, short: "maya", handle: "@maya.petmom", role: "main", format: "x",
  source: { raw: "", handle: null, id: null, views: null }, sourceRaw: "", sources: [],
  idea: { premise: null, product: null, feature: null, reasons: [], experiments: [], answer: null, record: null }, tags: [],
};
const AM = { ...base, key: `${DATE}/maya/1`, n: 1, slot: "AM", topic: "a slideshow", kind: "slideshow" as const };
const MID = { ...base, key: `${DATE}/maya/3`, n: 3, slot: "MID", topic: "Reaction: a video", kind: "video" as const, video: { type: "reaction", hook: null, hookJob: null, length: "15" } };
mkdirSync(join(CWD, "data"), { recursive: true });
writeFileSync(join(CWD, "data", `production-${SLUG}.json`), JSON.stringify({ generatedAt: "x", plan: { title: null, range: null, app: "Pawly", slug: SLUG, appStoreId: null, service: "postbridge", zones: { posting: null, home: null }, handles: {}, rules: [], tasks: {} }, rows: [AM, MID], decks: [], notes: [] }));
mkdirSync(join(WS, "apps", SLUG, "production"), { recursive: true });
writeFileSync(join(WS, "apps", SLUG, "production", "log.jsonl"), "");

const rec = (id: string, at: string, views: number, video: boolean): MonidPost => ({ id, postPage: "", uploadedAtFormatted: at, views, likes: 3, comments: 1, shares: 2, bookmarks: 5, title: "", ...(video ? {} : { images: [{}, {}] }), readAt: new Date().toISOString() });

test("recordOutcome: the first write of a leg starts from its old lines; a fetch with nothing new writes no line", () => {
  const P = AM.key;
  appendEvent(SLUG, { post: P, kind: "outcome.sync", actor: "sync", data: { source: "monid", views: 50, likes: 1, comments: 0, saves: 4, shares: 0, url: "", syncedAt: "2026-01-01T00:00:00.000Z" } });
  const one = recordOutcome(SLUG, P, "tiktok", pb("2026-01-02T00:00:00.000Z", 80));
  assert.equal(one.changed, true);
  assert.equal(one.current.saves, 4, "saves from the old Monid line");
  const again = recordOutcome(SLUG, P, "tiktok", pb("2026-01-02T00:00:00.000Z", 80));
  assert.equal(again.changed, false);
  const tt = legState(readLog(SLUG).filter((e) => e.post === P), "tiktok");
  assert.equal(tt.synced?.views, 80, "the reader takes the record as written");
  assert.equal(tt.synced?.saves, 4);
  assert.equal(tt.synced?.source, "postbridge");
  assert.equal(readLog(SLUG).filter((e) => e.kind === "outcome.current").length, 1);
});

test("a slot card nobody marked posted is read by the sync, linked from Monid, and keeps its current record", async () => {
  const mid = allStates(SLUG).find((s) => s.row.key === MID.key)!;
  assert.equal(unmarkedOnTiktok(mid), true);
  assert.equal(syncsOnTiktok(mid), true);
  assert.equal(unmarkedOnTiktok({ ...mid, row: { date: day(9) } }), false, "older than the window: not read");
  assert.equal(unmarkedOnTiktok({ ...mid, row: { date: day(-1) } }), false, "a future row is not live");
  assert.equal(unmarkedOnTiktok({ ...mid, row: { date: day(0) } }), false, "today's row: the next day's sync reads it");
  assert.equal(unmarkedOnTiktok({ ...mid, killed: { at: "", note: "" } }), false);

  const after = `${DATE}T15:00:00.000Z`;
  let records = [rec("111", after, 900, false), rec("222", after, 1200, true)];
  const fetch = async () => records;
  const noSaved = { savedRuns: async () => [] };
  const one = await findLinks(SLUG, { keys: [MID.key] }, fetch, noSaved);
  assert.equal(one[0].status, "linked");
  assert.equal(one[0].tiktokId, "222", "the one video, not the slideshow");
  const log = () => readLog(SLUG).filter((e) => e.post === MID.key);
  assert.equal(log().find((e) => e.kind === "posted")?.data?.manual, true, "written as posted by hand, so later syncs read it");
  assert.equal(legState(log(), "tiktok").synced?.views, 1200);

  records = [rec("111", after, 950, false), rec("222", after, 3400, true)];
  const two = await findLinks(SLUG, { keys: [MID.key] }, fetch, noSaved);
  assert.equal(two[0].status, "known");
  assert.equal(legState(log(), "tiktok").synced?.views, 3400, "every sync updates the record");
  assert.equal(legState(log(), "tiktok").synced?.saves, 5);
});

test("a live post shows as posted, also when an approval gate is still open", () => {
  const live = allStates(SLUG).find((s) => s.row.key === MID.key)!;
  assert.equal(live.idea.status === "approved", false, "no gate was clicked for this card");
  assert.equal(live.stage, "posted", "the `posted` line wins over the open idea gate");
  assert.match(live.sentence, /^posted /);
  const open = allStates(SLUG).find((s) => s.row.key === AM.key)!;
  assert.equal(open.stage, "idea", "without a `posted` line the gates still decide");
  appendEvent(SLUG, { post: AM.key, kind: "kill", note: "x" });
  appendEvent(SLUG, { post: AM.key, kind: "posted", data: { time: "10:00", manual: true } as unknown as Event["data"] });
  assert.equal(allStates(SLUG).find((s) => s.row.key === AM.key)!.stage, "killed", "a kill still wins over posted");
});
