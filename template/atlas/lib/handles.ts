/**
 * The handle identities of an app: apps/<slug>/handles/<handle>/HANDLE.md and
 * the references beside it, read live. The six steps that create a handle are
 * derived from the files (which exist), the log (which approvals were given)
 * and the posting-service account map (which handle is connected). Nothing
 * here records a state: the file is its own proof.
 */

import { join } from "node:path";

import { readLog, storeOf, type Event } from "./production";
import { appDir, exists, headLines, listDirs, listFiles, readJson, readText, sectionOf, tableRows, titleOf } from "./root";

export type Reference = { file: string; role: string; what: string; use: string; exists: boolean; url: string | null; approved: string | null; rejected: string | null };
export type StepState = "done" | "you" | "agent" | "open";
export type Step = { n: number; name: string; state: StepState; fact: string };

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
  account: { provider: string; id: string | number | null; username: string | null } | null;
  steps: Step[];
  complete: boolean;
  /** The first step not done, or null when complete. */
  next: Step | null;
  approvals: { persona: string | null; bio: string | null; defaults: string | null };
};

export type AccountsFile = { syncedAt?: string; accounts?: Record<string, { id?: number | string; platform?: string; username?: string; needs_reconnect?: boolean; provider?: string } | null> };

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
  const title = titleOf(md) ?? "";
  const fromTitle = title.match(/@([\w.]+)/)?.[1];
  const handle = `@${(head["Handle"] ?? "").replace(/^@/, "") || fromTitle || dir.replace(/^@/, "")}`;
  const mine = log.filter((e) => e.handle === handle || e.handle === handle.slice(1));
  const approvedAt = (kind: Event["kind"], file?: string) => day(last(mine.filter((e) => e.kind === kind && (!file || e.file === file)))?.at);

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

  const acct = accounts?.accounts?.[handle] ?? accounts?.accounts?.[handle.slice(1)] ?? null;
  const connected = !!acct && !acct.needs_reconnect;
  const connectedAt = approvedAt("account.connect") ?? day(accounts?.syncedAt);

  const approvals = { persona: approvedAt("persona.approve"), bio: approvedAt("bio.approve"), defaults: approvedAt("defaults.approve") };
  const taskDone = (task: string) => mine.some((e) => e.kind === "task.done" && String(e.data?.task ?? e.task ?? "") === task);

  /* The six steps. Done is decided from the files; the fact names the approval when the log has it. */
  const s1 = !!(head["Role"] && head["Tier"] && head["Created"]);
  const s2 = !!personaBody;
  const s3 = identityRefs.length > 0;
  const s4 = !!profileRef && !!bioQuote;
  const s5 = !!(head["Format"] && dimension && head["Slots"] && head["Cadence"]);
  const s6 = connected;
  const done = [s1, s2, s3, s4, s5, s6];
  const facts = [
    s1 ? `done${head["Created"] ? ` ${head["Created"]}` : ""}` : head["Role"] ? "the account is created on TikTok by you, then the date is written" : "the role and the name come first",
    s2 ? (approvals.persona ? `approved ${approvals.persona}` : "written · a look from you is asked") : "drafted by the agent from the findings",
    s3 ? `${references.filter((r) => r.approved).length ? `${references.filter((r) => r.approved).length} approved` : `${identityRefs.length} drawn`}${references.some((r) => r.exists && !r.approved && /identity|face|subject/i.test(r.role)) ? " · a look from you is asked" : ""}` : "the face and the subjects are drawn after the persona",
    s4 ? `${approvals.bio ? `approved ${approvals.bio}` : "written"}${taskDone("set on TikTok") ? " · set on TikTok" : ""}` : profileRef ? "the picture is here; the bio is next" : bioQuote ? "the bio is here; the picture is next" : "after the references",
    s5 ? (approvals.defaults ? `approved ${approvals.defaults}` : "written") : "proposed by the agent from the app fit",
    s6 ? `connected${connectedAt ? ` ${connectedAt}` : ""}${acct?.provider || acct?.platform ? ` · ${acct.provider ?? "Post Bridge"}` : ""}` : acct ? "needs a reconnect" : "connected at the first send",
  ];
  /* Whose turn: the first step not done. A step whose file exists waits for a look from you; one whose file is missing is the agent's. */
  const firstOpen = done.findIndex((d) => !d);
  const userSteps = new Set([1, 3, 4, 6]);
  const steps: Step[] = ["Role and name", "Persona", "References", "Profile picture and bio", "Defaults", "Connect"].map((name, i) => {
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
    profile: profileRef?.url ?? null, connected, account: acct ? { provider: acct.provider ?? (acct.platform ? "Post Bridge" : "unknown"), id: acct.id ?? null, username: acct.username ?? null } : null,
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
