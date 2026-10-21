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
  if ((m = line.match(/^reaction ref (\S+): burned-in text in the clip \((.+?), ([^)]+)\)\. (.*)$/)))
    return `The reaction clip has burned-in text (${m[2]}, ${m[3]}). ${stop(m[4].replace(/on the animate route/, "on the motion route"))}`;
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
      return say("agent", /brief/.test(w) ? "The agent writes the brief." : /script/.test(w) ? "The agent writes the script." : "The agent writes the review of the plan.");
    case "approval":
      if (s.state === "blocked") { const k = n(w); return say("blocked", `${k} input${k === 1 ? " is" : "s are"} missing before the plan can be approved.`); }
      if (s.state === "clicked") return say("agent", "You approved the plan. The agent locks it next.");
      if (s.state === "sent back") return say("agent", "Sent back with your note. A new revision comes back here.");
      if (s.state === "stale") return say("agent", "The plan changed after the lock. The agent locks the new revision.");
      return say("you", "Approve the plan, or send it back with a note.");
    case "keyframes":
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      if (s.state === "clicked") return say("agent", "You approved the storyboard. The agent records it, then generates the takes.");
      if (s.state === "sent back") return say("agent", "Sent back with your note. The keyframes come back here when they are redone.");
      if (s.state === "stale") return say("you", "A keyframe changed after you approved the storyboard. Approve it again.");
      if (s.state === "you") { const c = usd(w); return say("you", `Approve the storyboard${c ? ` and ${c} of first runs` : ""}, or send it back with a note.`); }
      return say("agent", "The agent writes the shots and makes the keyframes.");
    case "generate":
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", `The agent generates the takes${usd(w) ? ` (${usd(w)} computed)` : ""}.`);
    case "review": {
      if (s.state === "you") { const items = w.replace(/^waiting for you: /, "").split(", "); return say("you", `Review ${items.length === 1 ? "the take of" : `${items.length} takes:`} ${items.join(", ")}.`); }
      if (s.state === "clicked") return say("agent", "Your decision is being recorded.");
      if (s.state === "sent back") return say("agent", "A take was rejected. The agent generates it again.");
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", "The agent generates the takes that are still missing.");
    }
    case "composite":
      if (s.state === "you") return say("you", `Approve the composite of ${w.replace(/^waiting for you: /, "")}.`);
      if (s.state === "clicked") return say("agent", "You approved the composite. The agent records it.");
      if (s.state === "sent back") return say("agent", "The composite was sent back. The agent makes it again.");
      if (s.state === "blocked") return say("blocked", plainProblem(w));
      return say("agent", "The agent puts the app into the phone.");
    case "cut":
      if (s.state === "you") return say("you", "Watch the cut. Approve it, or send it back.");
      if (s.state === "clicked") return say("agent", "Your decision on the cut is being recorded.");
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
