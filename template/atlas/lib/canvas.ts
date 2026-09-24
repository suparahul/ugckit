/**
 * The canvas: the eight phases the workspace moves through, and the state of
 * each, derived from the files on disk and nothing else. The Atlas never
 * records "done" in the log, so the canvas cannot lie: a phase is done when
 * its files exist and parse, in progress when some do, not started otherwise.
 *
 * The phases are 04-SYSTEM-DESIGN's: setup · the app · competitor apps · the
 * niche · account architecture · handle identities · app fit and plan ·
 * production. The order is a guide, not a gate.
 */

import { join } from "node:path";

import { getApp, type App } from "./apps";
import { ledgerApps, readLedger } from "./ledger";
import { day7Rows } from "./findings";
import { listHandles } from "./handles";
import { allStates, getProduction, readLog, today } from "./production";
import { readPlanText } from "./plan";
import { appDir, exists, listDirs, listFiles, mtimeOf, newestIn, readJson, readText, RESEARCH_DIR, STATE_FILE } from "./root";

export type PhaseKey = "setup" | "app" | "apps" | "niche" | "accounts" | "handles" | "fit" | "production";
export type PhaseState = "done" | "now" | "todo";

export type Phase = {
  key: PhaseKey;
  n: number;
  title: string;
  /** What the phase is, in one line. */
  line: string;
  state: PhaseState;
  /** The state sentence for this app, from the facts. */
  sentence: string;
  /** Short facts: "5 apps", "2 of 5 teardowns". Plain text; a leading number reads bold on the page. */
  facts: string[];
  /** What the agent asked of you in the conversation, when the files say something waits. */
  ask: string | null;
  /** A phase before this one changed after this one was filled. */
  changedUpstream: string | null;
  /** The section of the app the phase fills, and its address. */
  page: { label: string; href: string } | null;
  what: { you: string; agent: string; shows: string };
  /** The newest file of the phase (0 when none). */
  at: number;
};

export type Canvas = { slug: string; app: App | null; phases: Phase[]; done: number; now: Phase | null; ask: string | null; nowSentence: string };

export const PHASES: { key: PhaseKey; title: string; line: string }[] = [
  { key: "setup", title: "Setup", line: "The kit checks the machine and asks which way in: a reference video, an app, or a niche." },
  { key: "app", title: "The app", line: "The store listing, the website or the repository read: the niche phrase, the hero features, the store facts." },
  { key: "apps", title: "Competitor apps", line: "Apps in the niche found, their networks harvested, one teardown each, then one read across all of them." },
  { key: "niche", title: "The niche", line: "The TikTok searches (and Instagram's, if you say yes), then the posts you bring from your own scroll, read slide by slide. The findings written." },
  { key: "accounts", title: "Account architecture", line: "How many handles, the role of each, the name pattern, the cadence." },
  { key: "handles", title: "Handle identities", line: "One handle at a time: persona, references, picture and bio, defaults." },
  { key: "fit", title: "App fit and plan", line: "Every parameter fitted from the two sources, then the week’s plan." },
  { key: "production", title: "Production", line: "Deck, pictures, callout, render, post, sync, and the read on day 7. Repeats every week." },
];

const what = (slug: string): Record<PhaseKey, Phase["what"]> => ({
  setup: { you: "nothing: the kit runs its own check", agent: ".env, pipeline.json, the folders", shows: "nothing yet" },
  app: { you: "the website, the repository path or the App Store link", agent: `apps/${slug}/APP.md, product.json, icon.jpg`, shows: "the head of the home base, the callout card" },
  apps: { you: "a yes on each round’s cost", agent: `the ledger, research/${slug}/…, one TEARDOWN.md per app, the cross-app findings`, shows: "the Atlas tab: the apps, the handles, the orb" },
  niche: { you: "up to ten post links, handles or screenshots from your own scroll", agent: "niche/searches/, niche/batches/<date>/, the findings learnings.md · anatomy.md · architecture.md", shows: "the niche page" },
  accounts: { you: "a yes, or a change, on the handle count and the roles", agent: "strategy/ACCOUNTS.md", shows: "the strategy page, part 1" },
  handles: { you: "the TikTok accounts; a look at the persona, the references, the picture and the bio", agent: "handles/<handle>/HANDLE.md and references/", shows: "the handles list, the handle page" },
  fit: { you: "decisions on the experiment rows", agent: "strategy/APP-FIT.md, production/PLAN.md", shows: "the strategy page, the studio" },
  production: { you: "a look at the ideas, the plans and the finals; the phone for a hand-posted draft", agent: "the decks, the pictures under production/files/, the log, the day-7 read", shows: "the studio, the post page, the read" },
});

const n = (v: number) => v.toLocaleString("en-US");

/** What a handle at step n asks of you, in the words of PLAN.md § 5.3. */
function handleAsk(handle: string, step: number): string {
  switch (step) {
    case 1: return `the TikTok account for ${handle}, created by hand`;
    case 2: return `a look at ${handle}’s persona, on the handle page`;
    case 3: return `a look at ${handle}’s references, on the handle page`;
    case 4: return `a look at ${handle}’s profile picture and bio, then both set on TikTok by hand`;
    default: return `a look at ${handle}’s defaults, on the handle page`;
  }
}
const plural = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

type NicheJson = { totals?: { posts?: number; slideshows?: number; videos?: number; handles?: number }; keywords?: string[] };

/** The findings files' newest dated section, "2026-09-12". */
function findingsDate(dir: string): string | null {
  const t = readText(join(dir, "learnings.md")) ?? "";
  const dates = [...t.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})/gm)].map((m) => m[1]).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function canvasOf(slug: string): Canvas {
  const app = getApp(slug);
  const dir = appDir(slug);
  const s = encodeURIComponent(slug);
  const W = what(slug);
  const ledger = readLedger();
  const project = ledger?.projects?.[slug] ?? null;

  /* ---- setup */
  const setupDone = exists(STATE_FILE);
  const setup: Omit<Phase, "state" | "changedUpstream"> = {
    key: "setup", n: 1, title: PHASES[0].title, line: PHASES[0].line,
    sentence: setupDone ? `The kit is installed and its state file is in place.${project?.entry ? ` The way in: ${project.entry === "research" ? "the app" : project.entry}.` : ""}` : "The kit is checking the machine: Node, the folders, the keys. Nothing else exists yet.",
    facts: setupDone ? [`state file present`, ...(project?.entry ? [`way in: ${project.entry === "research" ? "the app" : project.entry}`] : [])] : [],
    ask: setupDone ? null : "which way in: a reference video, an app, or a niche or app name",
    page: null, what: W.setup, at: mtimeOf(STATE_FILE),
  };

  /* ---- the app */
  const appDone = !!app?.hasAppMd && !!app.product?.source;
  const appStarted = !!app?.hasAppMd || !!project;
  const appPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "app", n: 2, title: PHASES[1].title, line: PHASES[1].line,
    sentence: appDone
      ? `${app!.name}${app!.niche ? `, ${app!.niche}` : ""}${app!.platform ? `, ${app!.platform}` : ""}. Store facts from ${app!.product!.source === "itunes" ? "the iTunes lookup" : app!.product!.source === "repo" ? "the repository" : app!.product!.source === "website" ? "the website" : "what you typed"}.`
      : app?.hasAppMd
        ? "APP.md is written. The callout facts (product.json) are not filled yet; stage 1 is filled when they name their source."
        : project?.research?.niche
          ? `The niche phrase is recorded: “${project.research.niche}”. The app itself is read once you give the listing, the website or the repository.`
          : "The listing and the website are read for the niche phrase, the hero features and the store facts.",
    facts: app?.hasAppMd ? [[app.name, app.niche, app.platform].filter(Boolean).join(" · "), ...(app.featureCount ? [`${app.featureCount} hero features`] : []), ...(app.product?.source ? [`store facts: ${app.product.source}`] : [])] : project?.research?.niche ? [`niche: ${project.research.niche}`] : [],
    ask: !app?.hasAppMd && !project ? "the website, the repository path or the App Store link" : app?.hasAppMd && !app.product?.source ? "the App Store link, so the callout facts can be fetched" : null,
    page: null, what: W.app, at: Math.max(mtimeOf(join(dir, "APP.md")), mtimeOf(join(dir, "product.json"))),
  };

  /* ---- competitor apps */
  const apps = ledgerApps(slug);
  const teardowns = apps.filter((a) => exists(join(RESEARCH_DIR, slug, a.name, "TEARDOWN.md"))).length;
  const handlesInLedger = apps.reduce((t, a) => t + a.handles.length, 0);
  const searches = listFiles(join(RESEARCH_DIR, slug, "searches")).length;
  const appsDone = apps.length > 0 && teardowns === apps.length;
  const appsStarted = apps.length > 0 || searches > 0;
  const appsPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "apps", n: 3, title: PHASES[2].title, line: PHASES[2].line,
    sentence: appsDone
      ? `${plural(apps.length, "app")} in the ledger, ${plural(teardowns, "teardown")}, ${plural(handlesInLedger, "handle")} found.`
      : apps.length
        ? `${plural(apps.length, "app")} in the ledger, ${teardowns} of ${apps.length} teardowns written.`
        : searches
          ? `${plural(searches, "keyword search", "keyword searches")} run; no app confirmed yet.`
          : "Apps in the niche are found from the niche phrase, their networks harvested, each torn down.",
    facts: apps.length ? [`${n(apps.length)} apps`, `${n(handlesInLedger)} handles`, `${n(teardowns)} of ${n(apps.length)} teardowns`] : searches ? [`${n(searches)} searches`] : [],
    ask: appsStarted && !appsDone ? "a yes on each round’s cost" : null,
    page: { label: "Atlas", href: `/atlas?app=${s}` }, what: W.apps, at: newestIn(join(RESEARCH_DIR, slug)),
  };

  /* ---- the niche */
  const ndir = join(dir, "niche");
  const nicheJson = readJson<NicheJson>(join(process.cwd(), "data", `niche-${slug}.json`));
  const nSearchFiles = listFiles(join(ndir, "searches")).filter((f) => f.endsWith(".json")).length;
  const batches = listDirs(join(ndir, "batches"));
  const batchesRead = batches.filter((b) => exists(join(ndir, "batches", b, "BATCH.md")));
  const linksBrought = batches.reduce((t, b) => t + ((readText(join(ndir, "batches", b, "LINKS.md")) ?? "").split("\n").filter((l) => /tiktok\.com|^@|^https?:/.test(l.trim())).length), 0);
  const trio = ["learnings.md", "anatomy.md", "architecture.md"].filter((f) => exists(join(ndir, f)));
  const fDate = findingsDate(ndir);
  const nicheDone = batchesRead.length > 0 && trio.length === 3;
  const nicheStarted = exists(ndir) && (nSearchFiles > 0 || batches.length > 0 || exists(join(ndir, "NICHE.md")) || trio.length > 0);
  /* The day-7 rows of ours in the post table: added by production, not a change to the findings. anatomy.md's
     mtime is left out of the phase's time once they exist, so nothing downstream reads "changed upstream" from them. */
  const ownRows = day7Rows(slug, listDirs(join(dir, "handles")).map((h) => (h.startsWith("@") ? h : `@${h}`)));
  const nicheAt = ownRows.length
    ? Math.max(mtimeOf(ndir), ...listFiles(ndir).filter((f) => f !== "anatomy.md").map((f) => mtimeOf(join(ndir, f))), ...listDirs(ndir).map((d) => newestIn(join(ndir, d))))
    : Math.max(newestIn(ndir), newestIn(join(ndir, "batches")));
  const searchedFacts = nicheJson?.totals ? [`${n(nicheJson.totals.slideshows ?? 0)} slideshows`, `${n(nicheJson.totals.videos ?? 0)} videos`] : nSearchFiles ? [`${plural(nSearchFiles, "search page")}`] : [];
  const nichePhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "niche", n: 4, title: PHASES[3].title, line: PHASES[3].line,
    sentence: nicheDone
      ? `${nicheJson?.totals?.posts ? `${n(nicheJson.totals.posts)} posts searched; ` : ""}${plural(batchesRead.length, "batch", "batches")} from your scroll read slide by slide; the findings written${fDate ? ` on ${fDate}` : ""}.`
      : batches.length
        ? `The searches ran. ${plural(linksBrought, "link")} brought in ${plural(batches.length, "batch", "batches")}; ${batchesRead.length ? `${batchesRead.length} read` : "the read is next"}${trio.length ? `; ${trio.length} of 3 findings files written` : ""}.`
        : nSearchFiles
          ? "The searches ran. The read waits for links from your scroll."
          : "Two searches, then the posts you bring from your scroll, read slide by slide.",
    facts: [...searchedFacts, ...(batches.length ? [`${n(linksBrought)} links brought`, `${n(batchesRead.length)} of ${n(batches.length)} batches read`] : nSearchFiles ? ["scroll: waiting"] : []), ...(fDate ? [`findings of ${fDate}`] : []), ...(ownRows.length ? [`${plural(ownRows.length, "day-7 row")} added`] : [])],
    ask: nicheStarted && !nicheDone && !batches.length ? "up to ten links from your own scroll, pasted in the conversation; the recipe is printed there" : null,
    page: { label: "Niche", href: `/app/${s}/niche` }, what: W.niche, at: nicheAt,
  };

  /* ---- account architecture */
  const accountsMd = readText(join(dir, "strategy", "ACCOUNTS.md"));
  const proposed = accountsMd ? (accountsMd.match(/^\|\s*`?@[\w.]+`?\s*\|/gm) ?? []).length : 0;
  const accountsPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "accounts", n: 5, title: PHASES[4].title, line: PHASES[4].line,
    sentence: accountsMd ? `The architecture is written${proposed ? `: ${plural(proposed, "handle")} named` : ""}.` : "How many handles, the role of each, the names, the cadence: decided from both sources.",
    facts: accountsMd ? (proposed ? [`${n(proposed)} handles named`] : ["written"]) : [],
    ask: null,
    page: { label: "Strategy", href: `/app/${s}/strategy` }, what: W.accounts, at: mtimeOf(join(dir, "strategy", "ACCOUNTS.md")),
  };

  /* ---- handle identities */
  const handles = listHandles(slug);
  const complete = handles.filter((h) => h.complete);
  const inHand = handles.filter((h) => !h.complete);
  const waitingHandles = inHand.filter((h) => h.next?.state === "you");
  const handlesPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "handles", n: 6, title: PHASES[5].title, line: PHASES[5].line,
    sentence: handles.length
      ? `${complete.length ? `${plural(complete.length, "handle")} complete` : "No handle complete yet"}${inHand.length ? `; ${inHand.map((h) => `${h.handle} at step ${h.next?.n ?? 5} of 5`).join(", ")}` : ""}.${complete.length === 1 ? " The plan recommends at least two handles at two posts a day; one is allowed." : ""}`
      : "One handle at a time, in five steps. The accounts are created on TikTok by you when the agent asks; the posting service connects at the first send.",
    facts: handles.length ? [`${n(complete.length)} complete`, ...(inHand.length ? [`${n(inHand.length)} in hand`] : []), `${n(handles.filter((h) => h.connected).length)} connected`] : [],
    ask: waitingHandles.length ? waitingHandles.map((h) => handleAsk(h.handle, h.next!.n)).join("; ") : null,
    page: { label: "Handles", href: `/app/${s}/handles` }, what: W.handles, at: newestIn(join(dir, "handles")),
  };

  /* ---- app fit and plan */
  const fitMd = readText(join(dir, "strategy", "APP-FIT.md"));
  const fitRows = fitMd ? fitMd.split("\n").filter((l) => /^\|/.test(l) && !/^\|\s*-{2,}/.test(l) && !/^\|\s*(Parameter|#|Layer|Row)\s*\|/i.test(l)).length : 0;
  const decided = fitMd ? (fitMd.match(/\|\s*decided\s*\|/gi) ?? []).length : 0;
  const experiments = fitMd ? (fitMd.match(/\|\s*experiment\s*\|/gi) ?? []).length : 0;
  const prod = getProduction(slug);
  const planRows = prod.rows.length;
  const planExists = exists(join(dir, "production", "PLAN.md"));
  const fitDone = !!fitMd && planRows > 0;
  const fitPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "fit", n: 7, title: PHASES[6].title, line: PHASES[6].line,
    sentence: fitDone
      ? `${fitRows ? `${plural(fitRows, "row")} fitted${decided ? `, ${decided} decided` : ""}${experiments ? `, ${plural(experiments, "experiment")}` : ""}. ` : ""}The plan: ${plural(planRows, "post")}${prod.plan.range ? ` from ${prod.plan.range.from} to ${prod.plan.range.to}` : ""}, ${plural(Object.keys(prod.plan.handles).length, "handle")}.`
      : fitMd
        ? `The app fit is written${fitRows ? ` (${plural(fitRows, "row")})` : ""}. ${planExists ? "The plan file exists but no post row parsed yet." : "The plan for the week is being written."}`
        : planExists
          ? "The plan is written before the app fit; the fit is next."
          : "Every parameter fitted from the competitor apps and the niche; then the week’s plan.",
    facts: [...(fitMd ? [`${n(fitRows)} rows`, ...(decided ? [`${n(decided)} decided`] : []), ...(experiments ? [`${n(experiments)} experiments`] : [])] : []), ...(planRows ? [`plan: ${n(planRows)} posts`] : planExists ? ["plan: being written"] : [])],
    ask: fitMd && experiments && !planRows ? `decisions on the ${experiments} experiment rows` : null,
    page: { label: "Strategy", href: `/app/${s}/strategy` }, what: W.fit, at: Math.max(mtimeOf(join(dir, "strategy", "APP-FIT.md")), mtimeOf(join(dir, "production", "PLAN.md"))),
  };

  /* ---- production */
  const log = readLog(slug);
  const posted = log.filter((e) => e.kind === "posted").length;
  const decks = listFiles(join(dir, "production", "decks")).filter((f) => f.endsWith(".md")).length;
  const t = today();
  const todayRows = prod.rows.filter((r) => r.date === t);
  const prodStarted = planRows > 0 || decks > 0 || log.length > 0;
  /* Production is done when the week is read: the day-7 read is in PLAN.md, or the plan's last day is past. Until then it is in progress, day N of 7. */
  const day7 = prodStarted ? (readPlanText(slug)?.day7 ?? null) : null;
  const weekOver = !!prod.plan.range && t > prod.plan.range.to;
  const prodDone = posted > 0 && (!!day7 || weekOver);
  const dayN = prod.plan.range && t >= prod.plan.range.from ? Math.floor((Date.parse(t) - Date.parse(prod.plan.range.from)) / 86400000) + 1 : null;
  const waiting = prodStarted && !prodDone ? allStates(slug).filter((x) => x.waiting && x.row.date <= t) : [];
  const waitToday = waiting.filter((x) => x.row.date === t).length;
  const waitPast = waiting.length - waitToday;
  const waitingPosts = waiting.length;
  const waitLine = waitToday ? `${waitToday} of today’s wait for a look from you on their post pages${waitPast ? `, ${waitPast} from earlier days too` : ""}` : waitPast ? `${waitPast} from earlier days wait for a look from you on their post pages` : "";
  const prodPhase: Omit<Phase, "state" | "changedUpstream"> = {
    key: "production", n: 8, title: PHASES[7].title, line: PHASES[7].line,
    sentence: prodDone
      ? `${day7 ? `The week is read${day7.date ? ` on ${day7.date}` : ""}: ` : "The week is over: "}${plural(posted, "post")} posted${ownRows.length ? `, ${plural(ownRows.length, "day-7 row")} in the findings` : ""}. Production starts again from the next plan.`
      : posted
        ? `${dayN && prod.plan.range && t <= prod.plan.range.to ? `Day ${dayN} of 7: ` : ""}${plural(posted, "post")} posted${todayRows.length ? `, ${plural(todayRows.length, "post")} planned today` : ""}${waitLine ? `, ${waitLine}` : ""}. The read comes on day 7.`
        : prodStarted
          ? `${decks ? `${plural(decks, "deck")} written; ` : ""}nothing posted yet${waitLine ? `; ${waitLine}` : ""}.`
          : "Opens with the plan: decks, pictures, callout, render, post, sync, the read on day 7.",
    facts: prodStarted ? [`${n(posted)} posted`, ...(todayRows.length ? [`${n(todayRows.length)} planned today`] : []), ...(decks ? [`${n(decks)} decks`] : []), ...(day7 ? [`read on ${day7.date ?? "day 7"}`] : []), ...(ownRows.length ? [`${plural(ownRows.length, "day-7 row")} added`] : [])] : [],
    ask: waitingPosts && !prodDone ? `a look at the ${waitingPosts === 1 ? "post" : "posts"} waiting on ${waitingPosts === 1 ? "its" : "their"} post ${waitingPosts === 1 ? "page" : "pages"}` : null,
    page: { label: "Studio", href: `/production/${s}` }, what: W.production, at: Math.max(mtimeOf(join(dir, "production", "log.jsonl")), newestIn(join(dir, "production", "decks"))),
  };

  const raw: { p: Omit<Phase, "state" | "changedUpstream">; done: boolean; started: boolean }[] = [
    { p: setup, done: setupDone, started: true },
    { p: appPhase, done: appDone, started: appStarted },
    { p: appsPhase, done: appsDone, started: appsStarted },
    { p: nichePhase, done: nicheDone, started: nicheStarted },
    { p: accountsPhase, done: !!accountsMd, started: false },
    { p: handlesPhase, done: complete.length > 0, started: handles.length > 0 },
    { p: fitPhase, done: fitDone, started: !!fitMd || planExists },
    { p: prodPhase, done: prodDone, started: prodStarted },
  ];
  /* Done from the files; in progress where some files exist; else the first phase not done is the one in progress. */
  let phases: Phase[] = raw.map(({ p, done, started }) => ({ ...p, state: done ? "done" : started ? "now" : "todo", changedUpstream: null }));
  if (!phases.some((p) => p.state === "now")) {
    const first = phases.find((p) => p.state === "todo");
    if (first) first.state = "now";
  }
  /* Changed upstream: a done phase whose newest file is older than a done phase before it. */
  phases = phases.map((p, i) => {
    if (p.state !== "done" || !p.at) return p;
    const newer = phases.slice(1, i).find((q) => q.state === "done" && q.at > p.at + 60_000 && q.key !== "setup");
    return newer ? { ...p, changedUpstream: newer.title } : p;
  });
  const nows = phases.filter((p) => p.state === "now");
  const now = nows.length ? nows[nows.length - 1] : null;
  const ask = nows.map((p) => p.ask).filter(Boolean).join("; ") || null;
  const nowSentence = nows.length ? nows.map((p) => p.sentence).join(" ") : "Every phase is done. Production repeats every week.";
  return { slug, app, phases, done: phases.filter((p) => p.state === "done").length, now, ask, nowSentence };
}
