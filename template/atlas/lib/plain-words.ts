/**
 * Plain words for the video post page (research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 2):
 * the one status sentence of the head, the stage rail's state words, the beat roles, and
 * the lines of ready.json (video_plan.py) rewritten without paths, backticks or codes.
 * Pure: no file access, no node imports; the page and the tests import it.
 */

import type { Stage, StagesView, StageState } from "./video-stages.ts";

/* ----------------------------------------------------------------- the words */

/** The stage rail: one word per state. */
export const STATE_WORD: Record<StageState, string> = {
  done: "done",
  you: "your turn",
  agent: "agent",
  clicked: "recording",
  "sent back": "sent back",
  blocked: "blocked",
  stale: "stale",
  "not reached": "",
  "n/a": "skipped",
};

/** The beat roles of the plan, in words. */
const ROLE: Record<string, string> = {
  hook: "the hook",
  attention: "the hook",
  use_reveal: "the app appears",
  reveal: "the reveal",
  result: "the result",
  payoff: "the payoff",
  proof: "the proof",
  step: "a step",
  demo: "the demo",
  close: "the close",
  setup: "the setup",
};
export const roleWord = (role: string | null | undefined): string | null => (role ? ROLE[role] ?? role.replace(/_/g, " ") : null);

/** The first sentence of a description, at most `max` characters, for a one-line card. */
export function shortLine(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  const first = t.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? t;
  const cut = first.length > max ? `${first.slice(0, max).replace(/\s+\S*$/, "")}…` : first;
  return cut;
}

/* ------------------------------------------------------------- the problems */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stop = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
const quote = (s: string) => `“${s}”`;

/**
 * One line of ready.json (what blocks the lock, what blocks production) as a plain sentence:
 * what is wrong and what to do, with no path, no backtick and no script name. Lines the
 * patterns do not know are cleaned (backticks off, workspace paths named, a capital, a full
 * stop) and kept whole, so nothing is lost.
 */
export function plainProblem(line: string): string {
  let m: RegExpMatchArray | null;
  if ((m = line.match(/^screen (\S+): not in apps\/[^/]+\/screens\/screens\.json/)))
    return `Screen ${quote(m[1])} has no recording in the screen library. Record it, or switch the beat to motion design.`;
  if ((m = line.match(/^hero string of (\S+): copied from the real screen once it is indexed/)))
    return `The hero text of screen ${quote(m[1])} is taken from the real screen once it is recorded.`;
  if ((m = line.match(/^hero string of (\S+): the plan says (.+?); the real screen says (.+)$/)))
    return `The hero text of screen ${quote(m[1])}: the plan says ${m[2]}; the real screen says ${stop(m[3])}`;
  if ((m = line.match(/^asset (\S+): no file yet \(([^,)]+)(?:, ([^)]+))?\)/)))
    return `The file ${quote(m[1])} (${m[3] ? `${m[2].replace(/_/g, " ")}, ${m[3].replace(/_/g, " ")}` : m[2].replace(/_/g, " ")}) is not there yet.`;
  if ((m = line.match(/^asset (\S+): (\S+) is not on disk/)))
    return `The file ${quote(m[1])} is not on disk (${m[2].replace(/^.*\//, "")}).`;
  if ((m = line.match(/^asset (\S+): no sha256/)))
    return `The file ${quote(m[1])} is not pinned yet: the agent pins it, then reviews again.`;
  if ((m = line.match(/^asset (\S+): no permission_ref/)))
    return `The file ${quote(m[1])} has no permission on record.`;
  if ((m = line.match(/^reaction ref (\S+): post (\S+) is not in the workspace/)))
    return `The reaction's post ${m[2]} is not in the workspace.`;
  if ((m = line.match(/^reaction ref (\S+): the video of post (\S+) is not downloaded/)))
    return `The video of the reaction's post ${m[2]} is not downloaded yet.`;
  if ((m = line.match(/^reaction ref (\S+): no video_sha256/)))
    return `The reaction clip is not pinned yet: the agent pins it, then reviews again.`;
  if ((m = line.match(/^reaction ref (\S+): (\S+) changed since it was pinned/)))
    return `The reaction clip changed since it was pinned (${m[2].replace(/^.*\//, "")}).`;
  if ((m = line.match(/^(character|narrator) (\S+?)[:,]? (.*)$/)))
    return `The ${m[1]} ${m[2]} ${stop(m[3])}`;
  if ((m = line.match(/^(\S+): not runnable yet; needed by (.*)$/)))
    return `${cap(m[1].replace(/_/g, " "))} cannot run yet; needed by ${stop(m[2])}`;
  /* Unknown: cleaned, kept whole. */
  const cleaned = line
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\bapps\/[^/\s]+\/screens\/screens\.json\b/g, "the screen library")
    .replace(/\b(?:apps|pipeline|research)\/[\w./@-]+/g, (p) => p.replace(/^.*\//, ""))
    .replace(/\s+/g, " ")
    .trim();
  return stop(cap(cleaned));
}

/* --------------------------------------------------------------- the status */

export type Status = { who: "you" | "agent" | "blocked" | "done"; head: string; text: string };

const HEAD: Record<Status["who"], string> = { you: "Waiting for you", agent: "Agent's turn", blocked: "Blocked", done: "Done" };
const usd = (s: string) => s.match(/\$\d+(?:\.\d+)?/)?.[0] ?? null;
const n = (s: string) => Number(s.match(/^(\d+)/)?.[1] ?? 0);

/** What the agent does once a click of a stage is on record, in words. */
const AFTER: Record<string, string> = { plan: " and lock the plan", keyframes: " and generate the takes", cut: " and deliver the video" };

/**
 * The one line for a click the agent has not recorded yet: the decision and its time,
 * then what is waited for. With no click (the stage model alone knows one was made),
 * the same line without the time. The Atlas writes only a log line; the agent records
 * it with review.py or video_plan.py --from-atlas, so nothing here is automatic.
 */
export function pendingLine(c: { kind: string; at: string; note?: string | null } | null, key: string, today = new Date().toISOString().slice(0, 10)): string {
  const after = AFTER[key] ?? "";
  if (!c) return `Waiting for the agent to record your decision${after}.`;
  const verb = c.kind.endsWith(".reject") ? "Rejected" : c.kind.endsWith(".sendback") ? "Sent back" : "Approved";
  const when = `${c.at.slice(0, 10) === today ? "" : `${c.at.slice(0, 10)} `}${c.at.slice(11, 16)}`;
  return `${verb} at ${when}${c.note ? ` — “${c.note}”` : ""}. Waiting for the agent to record it${verb === "Approved" ? after : ""}.`;
}

/**
 * The one sentence under the title of a video post: whose turn it is and what to do, from
 * the stage model (lib/video-stages.ts). The stage's own words (`words`) are the agent's
 * vocabulary; this says the same in the user's.
 */
export function videoStatus(v: StagesView): Status {
  const s: Stage | undefined = v.stages[v.current - 1];
  const say = (who: Status["who"], text: string): Status => ({ who, head: HEAD[who], text });
  if (!s || v.who === "done") return say("done", "Delivered and approved for posting.");
  const w = s.words;
  switch (s.key) {
    case "plan":
      if (s.state === "agent") return say("agent", /brief/.test(w) ? "The agent writes the brief." : /script/.test(w) ? "The agent writes the script." : "The agent writes the review of the plan.");
      if (s.state === "blocked") { const k = n(w); return say("blocked", `${k} input${k === 1 ? " is" : "s are"} missing before the plan can be approved.`); }
      if (s.state === "clicked") return say("agent", pendingLine(null, "plan"));
      if (s.state === "sent back") return say("agent", "Sent back with your note. A new revision comes back here.");
      if (s.state === "stale" || /^changed after the lock/.test(w)) return say("you", "The plan changed after the lock. Accept the change and re-lock, or send it back with a note.");
      return say("you", "Approve the plan, or send it back with a note.");
    case "keyframes":
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      if (s.state === "clicked") return say("agent", pendingLine(null, "keyframes"));
      if (s.state === "sent back") return say("agent", "Sent back with your note. The keyframes come back here when they are redone.");
      if (s.state === "stale") return say("you", "A keyframe changed after you approved the storyboard. Approve it again.");
      if (s.state === "you") { const c = usd(w); return say("you", `Approve the storyboard${c ? ` and ${c} of first runs` : ""}, or send it back with a note.`); }
      return say("agent", "The agent writes the shots and makes the keyframes.");
    case "generate":
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", `The agent generates the takes${usd(w) ? ` (${usd(w)} computed)` : ""}.`);
    case "review": {
      if (s.state === "you") { const items = w.replace(/^waiting for you: /, "").split(", "); return say("you", `Review ${items.length === 1 ? "the take of" : `${items.length} takes:`} ${items.join(", ")}.`); }
      if (s.state === "clicked") return say("agent", pendingLine(null, "review"));
      if (s.state === "sent back") return say("agent", "A take was rejected. The agent generates it again.");
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", "The agent generates the takes that are still missing.");
    }
    case "composite":
      if (s.state === "you") return say("you", `Approve the composite of ${w.replace(/^waiting for you: /, "")}.`);
      if (s.state === "clicked") return say("agent", pendingLine(null, "composite"));
      if (s.state === "sent back") return say("agent", "The composite was sent back. The agent makes it again.");
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", "The agent puts the app into the phone.");
    case "cut":
      if (s.state === "you") return say("you", "Watch the cut. Approve it, or send it back.");
      if (s.state === "clicked") return say("agent", pendingLine(null, "cut"));
      if (s.state === "sent back") return say("agent", "The cut was sent back. The agent assembles it again.");
      if (s.state === "stale") return say("agent", "The plan changed after the cut. The agent assembles it again.");
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", "The agent assembles the cut.");
    case "deliver":
      if (s.state === "you") return say("you", "Watch the video. Approve it for posting, or send it back with a note.");
      if (s.state === "sent back") return say("agent", "Sent back with your note. It comes back here when the video is delivered again.");
      return say("agent", "The agent delivers the file.");
  }
}

/** The primary button's reason when it is off, in a few words; the panel lists the rest. */
export function plainBlock(reason: string | null): string | null {
  if (!reason) return null;
  const m = reason.match(/^(\d+) blocking input/);
  if (m) return `${m[1]} input${m[1] === "1" ? "" : "s"} missing`;
  if (/REVIEW\.md has no content digest/.test(reason)) return "the plan has no review yet";
  return reason;
}

/* ------------------------------------------------------------------ the beats */

/** One beat of the strip, as the grouping needs it: the segment it belongs to and its role. */
export type BeatLike = { id: string; start: number; end: number; segment: string | null; role: string | null };

/** The beats as cards: consecutive beats of one segment become one card that spans them,
 * so one generated clip is never shown twice as if it were two things. A beat with no
 * segment stays a card of its own. */
export function groupBeats<B extends BeatLike>(beats: B[]): { id: string; start: number; end: number; segment: string | null; beats: B[] }[] {
  const out: { id: string; start: number; end: number; segment: string | null; beats: B[] }[] = [];
  for (const b of beats) {
    const last = out[out.length - 1];
    if (last && b.segment && last.segment === b.segment) { last.beats.push(b); last.end = Math.max(last.end, b.end); continue; }
    out.push({ id: b.id, start: b.start, end: b.end, segment: b.segment, beats: [b] });
  }
  return out;
}

/** What a segment is for, in one line: the roles of its beats in words, then the first sentence of what the viewer sees. */
export function purposeLine(beats: { role: string | null; sees: string }[]): string | null {
  if (!beats.length) return null;
  const roles = [...new Set(beats.map((b) => roleWord(b.role)).filter(Boolean))] as string[];
  const sees = beats.map((b) => b.sees).find((s) => s && s !== "not written")?.replace(/ · framing: \w+$/, "") ?? null;
  const head = roles.length ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) + (roles.length > 1 ? `, then ${roles.slice(1).join(", ")}` : "") : null;
  if (!head && !sees) return null;
  return [head, sees ? shortLine(sees, 140) : null].filter(Boolean).join(": ");
}

/* ------------------------------------------------------- the bar of a stage */

const DONE_LINE: Record<Stage["key"], string> = {
  plan: "The plan is approved and locked.",
  keyframes: "The storyboard is approved.",
  generate: "Every take is generated.",
  review: "Every take is approved.",
  composite: "Every composite is approved.",
  cut: "The cut is approved.",
  deliver: "Approved for posting.",
};
const SKIP_LINE: Record<Stage["key"], string> = {
  plan: "Made outside the pipeline: no plan to approve.",
  keyframes: "No keyframe was needed.",
  generate: "Nothing to generate: no generated segment.",
  review: "Nothing to review.",
  composite: "No app insertion in the plan.",
  cut: "Made outside the pipeline: no cut.",
  deliver: "Nothing to deliver.",
};
const LATER: Record<string, string> = {
  "the plan is not locked yet": "the plan is approved first",
  "gate A first": "the storyboard is approved first",
  "gate C first": "the cut is approved first",
  "the plates are approved at gate B first": "the plates are approved at the review first",
};

/**
 * The decision bar of a stage that is not the current one (ATLAS-VIDEO-PAGE-CLEANUP.md § 6.4):
 * what the stage is now, in one sentence and with no button. A done stage says so (with its
 * date when the agent wrote one), a skipped stage says why, a stage not reached says what
 * comes first; any other state reads as if it were the current stage.
 */
export function stageLine(v: StagesView, n: number): Status {
  const s: Stage | undefined = v.stages[n - 1];
  if (!s) return videoStatus(v);
  const date = s.words.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  if (s.state === "done") return { who: "done", head: "Done", text: date ? DONE_LINE[s.key].replace(/ is approved\./, ` was approved on ${date}.`) : DONE_LINE[s.key] };
  if (s.state === "n/a") return { who: "done", head: "Skipped", text: SKIP_LINE[s.key] };
  if (s.state === "not reached") return { who: "agent", head: "Not yet", text: `${s.short} starts later: ${LATER[s.words] ?? (s.words || "the stages before it come first")}.` };
  return videoStatus({ ...v, current: n });
}
