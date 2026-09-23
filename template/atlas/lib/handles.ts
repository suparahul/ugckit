/**
 * The handle identities of an app: apps/<slug>/handles/<handle>/HANDLE.md and
 * the references beside it, read live. The five steps that create a handle are
 * derived from the files (which exist), the log (which approvals were given)
 * and the posting-service account map (which handle is connected). Nothing
 * here records a state: the file is its own proof.
 */

import { join } from "node:path";

import { declaredAccounts, handleOf, type DeclaredAccount } from "./accounts";
import { PLATFORM_NAME, type Platform } from "./platform";
import { accountsOf, type AccountsFile } from "./postbridge";
import { readLog, storeOf, type Event } from "./production";
import { appDir, exists, headLines, listDirs, listFiles, readJson, readText, sectionOf, tableRows } from "./root";

export type Reference = { file: string; role: string; what: string; use: string; exists: boolean; url: string | null; approved: string | null; rejected: string | null };
export type StepState = "done" | "you" | "agent" | "open";
export type Step = { n: number; name: string; state: StepState; fact: string };

/** One declared account of an identity, with its connection on the posting service. */
export type HandleAccount = DeclaredAccount & {
  connected: boolean;
  needsReconnect: boolean;
  /** The posting service's id and username, when the map has the account. */
  id: string | number | null;
  username: string | null;
  provider: string | null;
  /** The connection in words: "connected 15 Sep · Post Bridge", "needs a reconnect", "connects at the first send". */
  connection: string;
};

export type Handle = {
  slug: string;
  /** The folder name under handles/. */
  dir: string;
  /** `@name`. */
  handle: string;
  /** The plan's short name: the part before the first dot. */
  short: string;
  platform: string | null;
  role: string | null;
  tier: string | null;
  created: string | null;
  format: string | null;
  dimension: string | null;
  slots: string | null;
  postingZone: string | null;
  cadence: string | null;
  sound: string | null;
  warmup: string | null;
  persona: string | null;
  bio: string | null;
  bioRule: string | null;
  references: Reference[];
  defaults: { param: string; value: string; source: string }[];
  stylePrefix: string | null;
  identityRule: string | null;
  postProcess: string | null;
  /** The profile picture as a /media URL, or null. */
  profile: string | null;
  connected: boolean;
  /** The posting-service connection in words: it is made at the first send, not as a step. */
  connection: string;
  account: { provider: string; id: string | number | null; username: string | null } | null;
  /** Every account the identity posts from, TikTok first: the `## Accounts` table, or the one account of the head lines. */
  accounts: HandleAccount[];
  /** The platforms of those accounts. */
  platforms: Platform[];
  steps: Step[];
  complete: boolean;
  /** The first step not done, or null when complete. */
  next: Step | null;
  approvals: { persona: string | null; bio: string | null; defaults: string | null };
};

export type { AccountsFile };

export function readAccounts(slug: string): AccountsFile | null {
  return readJson<AccountsFile>(join(storeOf(slug), "posting-accounts.json")) ?? readJson<AccountsFile>(join(storeOf(slug), "postbridge-accounts.json"));
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);
const last = <T,>(a: T[]) => (a.length ? a[a.length - 1] : null);

function readHandle(slug: string, dir: string, log: Event[], accounts: AccountsFile | null): Handle | null {
  const base = join(appDir(slug), "handles", dir);
  const md = readText(join(base, "HANDLE.md"));
  if (md === null) return null;
  const head = headLines(md);
  const handle = handleOf(md, dir);
  const mine = log.filter((e) => e.handle === handle || e.handle === handle.slice(1));
  /* readLog() prefixes every `file` with the slug for the production files; a reference line names its file bare, so match the tail. */
  const sameFile = (a: string | undefined, b: string) => !!a && (a === b || a.endsWith(`/${b}`));
  const approvedAt = (kind: Event["kind"], file?: string) => day(last(mine.filter((e) => e.kind === kind && (!file || sameFile(e.file, file))))?.at);

  const refDir = join(base, "references");
  const refRows = tableRows(sectionOf(md, /^References/i) ?? "");
  const onDisk = listFiles(refDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const named = new Set<string>();
  const references: Reference[] = refRows
    .map((r) => {
      const fileCell = r["File"] ?? Object.values(r)[0] ?? "";
      const file = fileCell.replace(/`/g, "").replace(/^.*references\//, "").trim();
      if (!file) return null;
      named.add(file);
      return {
        file,
        role: (r["Role"] ?? "").replace(/\*\*/g, ""),
        what: r["What it is"] ?? "",
        use: r["Used for"] ?? r["What the generator uses it for"] ?? "",
        exists: exists(join(refDir, file)),
        url: exists(join(refDir, file)) ? `/media/apps/${encodeURIComponent(slug)}/handles/${encodeURIComponent(dir)}/references/${encodeURIComponent(file)}` : null,
        approved: approvedAt("reference.approve", file),
        rejected: approvedAt("reference.reject", file),
      };
    })
    .filter((r): r is Reference => !!r);
  /* A picture on disk the table does not name yet: shown, with its role read from its name. */
  for (const f of onDisk) {
    if (named.has(f)) continue;
    const role = /^profile\./.test(f) ? "profile picture" : /^style/.test(f) ? "style" : /^face/.test(f) ? "identity · when in frame" : /^subject/.test(f) ? "identity · subject" : "reference";
    references.push({ file: f, role, what: "", use: "", exists: true, url: `/media/apps/${encodeURIComponent(slug)}/handles/${encodeURIComponent(dir)}/references/${encodeURIComponent(f)}`, approved: approvedAt("reference.approve", f), rejected: approvedAt("reference.reject", f) });
  }
  const profileRef = references.find((r) => /profile/i.test(r.role) && r.exists) ?? references.find((r) => /^profile\./.test(r.file) && r.exists) ?? null;
  const identityRefs = references.filter((r) => /identity|face|subject/i.test(r.role) && r.exists);

  const personaBody = sectionOf(md, /^Persona/i);
  const bioBody = sectionOf(md, /^Bio/i);
  const bioQuote = bioBody?.split("\n").find((l) => /^>\s?/.test(l))?.replace(/^>\s?/, "").trim() ?? null;
  const bioRule = bioBody?.split("\n").find((l) => /^Rule/i.test(l))?.replace(/^Rule( line)?:\s*/i, "").trim() ?? null;
  const defaultsRows = tableRows(sectionOf(md, /^Defaults/i) ?? "").map((r) => ({ param: r["Parameter"] ?? Object.values(r)[0] ?? "", value: r["Value"] ?? Object.values(r)[1] ?? "", source: r["Source"] ?? "" }));
  const styleBody = sectionOf(md, /^Style prefix/i) ?? sectionOf(md, /visual style/i);
  const stylePrefix = styleBody?.match(/\*\*Style prefix:\*\*\s*(.+)/)?.[1]?.trim() ?? null;
  const dimension = head["Dimension"] ?? sectionOf(md, /^Default dimension/i)?.match(/(\d+\s*:\s*\d+)/)?.[1]?.replace(/\s/g, "") ?? null;

  /* The connection of each declared account. The primary one is the handle's `connected`, `connection` and `account`. */
  const onService = accountsOf(accounts, handle);
  const connectLine = (p: Platform) => day(last(mine.filter((e) => e.kind === "account.connect" && (e.data?.platform ?? "tiktok") === p))?.at);
  const handleAccounts: HandleAccount[] = declaredAccounts(md, dir).map((d) => {
    const a = onService[d.platform] ?? null;
    const ok = !!a && !a.needs_reconnect;
    const at = connectLine(d.platform) ?? day(accounts?.syncedAt);
    return { ...d, connected: ok, needsReconnect: !!a?.needs_reconnect, id: a?.id ?? null, username: a?.username ?? null, provider: a ? a.provider ?? (a.platform ? "Post Bridge" : "unknown") : null, connection: ok ? `connected${at ? ` ${at}` : ""} · ${a!.provider ?? "Post Bridge"}` : a ? "needs a reconnect" : "connects at the first send" };
  });
  const primaryAccount = handleAccounts.find((a) => a.role === "primary") ?? handleAccounts[0];
  const acct = onService[primaryAccount.platform] ?? null;
  const connected = !!acct && !acct.needs_reconnect;
  const connectedAt = approvedAt("account.connect") ?? day(accounts?.syncedAt);

  const approvals = { persona: approvedAt("persona.approve"), bio: approvedAt("bio.approve"), defaults: approvedAt("defaults.approve") };
  const taskDone = (task: string) => mine.some((e) => e.kind === "task.done" && String(e.data?.task ?? e.task ?? "") === task);

  /* The five steps. Done is decided from the files; the fact names the approval when the log has it.
     Connecting the posting service is not a step: it happens at the first send, and `connected` says so. */
  const s1 = !!(head["Role"] && head["Tier"] && head["Created"]);
  const s2 = !!personaBody;
  /* A brand handle or a theme page has style references only, by design: its step 3 is done once one reference is approved. */
  const styleOnly = /brand handle|theme page/i.test(head["Tier"] ?? "");
  const approvedRefs = references.filter((r) => r.approved).length;
  const s3 = identityRefs.length > 0 || (styleOnly && approvedRefs > 0);
  const s4 = !!profileRef && !!bioQuote;
  const s5 = !!(head["Format"] && dimension && head["Slots"] && head["Cadence"]);
  const done = [s1, s2, s3, s4, s5];
  const facts = [
    s1 ? `done${head["Created"] ? ` ${head["Created"]}` : ""}` : head["Role"] ? `the account is created on ${handleAccounts.map((a) => PLATFORM_NAME[a.platform]).join(" and ")} by you, then the date is written` : "the role and the name come first",
    s2 ? (approvals.persona ? `approved ${approvals.persona}` : "written · a look from you is asked") : "drafted by the agent from the findings",
    s3 ? `${approvedRefs ? `${approvedRefs} approved` : `${identityRefs.length} drawn`}${references.some((r) => r.exists && !r.approved && /identity|face|subject/i.test(r.role)) ? " · a look from you is asked" : ""}` : styleOnly ? (references.some((r) => r.exists) ? "the style references are here · a look from you is asked" : "the style references are drawn after the persona") : "the face and the subjects are drawn after the persona",
    s4 ? `${approvals.bio ? `approved ${approvals.bio}` : "written"}${taskDone("set on TikTok") ? " · set on TikTok" : ""}` : profileRef ? "the picture is here; the bio is next" : bioQuote ? "the bio is here; the picture is next" : "after the references",
    s5 ? (approvals.defaults ? `approved ${approvals.defaults}` : "written") : "proposed by the agent from the app fit",
  ];
  /* Whose turn: the first step not done. A step whose file exists waits for a look from you; one whose file is missing is the agent's. */
  const firstOpen = done.findIndex((d) => !d);
  const userSteps = new Set([1, 3, 4]);
  const steps: Step[] = ["Role and name", "Persona", "References", "Profile picture and bio", "Defaults"].map((name, i) => {
    const n = i + 1;
    let state: StepState = done[i] ? "done" : i === firstOpen ? (userSteps.has(n) ? "you" : "agent") : "open";
    if (i === firstOpen && n === 2 && personaBody) state = "you";
    return { n, name, state, fact: facts[i] };
  });

  return {
    slug, dir, handle, short: handle.slice(1).split(".")[0],
    platform: head["Platform"] ?? null, role: head["Role"] ?? null, tier: head["Tier"] ?? null, created: head["Created"] ?? null,
    format: head["Format"] ?? null, dimension, slots: head["Slots"] ?? null, postingZone: head["Posting zone"] ?? null, cadence: head["Cadence"] ?? null, sound: head["Sound"] ?? null, warmup: head["Warm-up"] ?? null,
    persona: personaBody, bio: bioQuote, bioRule, references, defaults: defaultsRows,
    stylePrefix, identityRule: sectionOf(md, /^Identity rule/i), postProcess: sectionOf(md, /^Post-process/i),
    profile: profileRef?.url ?? null, connected, connection: connected ? `connected${connectedAt ? ` ${connectedAt}` : ""}${acct?.provider || acct?.platform ? ` · ${acct.provider ?? "Post Bridge"}` : ""}` : acct ? "needs a reconnect" : "connects at the first send", account: acct ? { provider: acct.provider ?? (acct.platform ? "Post Bridge" : "unknown"), id: acct.id ?? null, username: acct.username ?? null } : null,
    accounts: handleAccounts, platforms: handleAccounts.map((a) => a.platform),
    steps, complete: done.every(Boolean), next: steps.find((s) => s.state !== "done") ?? null, approvals,
  };
}

/** Every handle of an app, in folder order. */
export function listHandles(slug: string): Handle[] {
  if (!/^[\w.-]+$/.test(slug)) return [];
  const log = readLog(slug);
  const accounts = readAccounts(slug);
  return listDirs(join(appDir(slug), "handles"))
    .filter((d) => !/^EXAMPLE$/i.test(d))
    .map((d) => readHandle(slug, d, log, accounts))
    .filter((h): h is Handle => !!h);
}

export function getHandle(slug: string, name: string): Handle | null {
  const want = name.replace(/^@/, "");
  return listHandles(slug).find((h) => h.dir === name || h.dir === want || h.handle.slice(1) === want) ?? null;
}

/** The handle a plan row posts on, by its short name. */
export function handleByShort(slug: string, short: string): Handle | null {
  return listHandles(slug).find((h) => h.short === short) ?? null;
}
