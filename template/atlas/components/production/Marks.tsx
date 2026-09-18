/**
 * The three review-point marks and the small drawn icons of the pipeline.
 *
 * One ring per gate — idea, plan, final — drawn as SVG so the same
 * glyph reads at 9px on the month grid and 14px in a post head. The ring's
 * state is a class, so colour lives in production.css with the rest of the
 * palette. Nothing here is an emoji or a unicode glyph standing in for an icon.
 */

import type { PointState, PostState } from "@/lib/production";

type MarkState = "open" | "inhand" | "approved" | "waiting" | "sentback" | "stale" | "sent" | "posted";

function markOf(p: PointState, inHand: boolean, waiting: boolean): MarkState {
  if (p.status === "approved") return "approved";
  if (p.status === "stale") return "stale";
  if (p.status === "sentback") return "sentback";
  if (inHand) return waiting ? "waiting" : "inhand";
  return "open";
}

/** Four marks: the three gates, then the post itself — open until the final, half (sent to TikTok drafts), full (posted). */
export function marksOf(s: PostState): MarkState[] {
  const inHand = (st: PostState["stage"]) => s.stage === st;
  const post: MarkState = s.stage === "posted" || s.stage === "read" ? "posted" : s.stage === "ready" && s.sent ? "sent" : "open";
  return [
    markOf(s.idea, inHand("idea"), s.waiting && s.stage === "idea"),
    markOf(s.plan, inHand("plan"), s.waiting && s.stage === "plan"),
    markOf(s.final, inHand("final") || s.stage === "ready" || s.stage === "posted" || s.stage === "read", s.waiting && s.stage === "final"),
    post,
  ];
}

const WORD: Record<MarkState, string> = {
  open: "open",
  inhand: "in hand",
  approved: "approved",
  waiting: "waiting for you",
  sentback: "sent back",
  stale: "stale",
  sent: "in TikTok drafts",
  posted: "posted",
};

export function Marks({ state, size = "sm" }: { state: PostState; size?: "sm" | "lg" }) {
  const marks = marksOf(state);
  const names = ["idea", "plan", "final", "post"];
  return (
    <span className={`marks${size === "lg" ? " marks--lg" : ""}`} role="img" aria-label={names.map((n, i) => `${n} ${WORD[marks[i]]}`).join(", ")}>
      {marks.map((m, i) => (
        <svg key={i} viewBox="0 0 12 12" className={`mark mark--${m}`} aria-hidden="true">
          <circle className="mark__fill" cx="6" cy="6" r="4.2" />
          {m === "inhand" || m === "waiting" ? <path className="mark__fill" d="M6 1.8 A4.2 4.2 0 0 1 10.2 6 L6 6 Z" /> : null}
          {m === "sent" ? <path className="mark__half" d="M6 1.8 A4.2 4.2 0 0 0 6 10.2 Z" /> : null}
          <circle className="mark__ring" cx="6" cy="6" r="4.9" />
        </svg>
      ))}
    </span>
  );
}

/**
 * One dot per post for the month grid: the post's whole state in one ring, so
 * a day cell reads at a glance which posts wait and which are done.
 */
export function Dot({ state }: { state: PostState }) {
  const m: MarkState | "killed" =
    state.stage === "killed" ? "killed"
    : state.stage === "posted" || state.stage === "read" ? "posted"
    : state.waiting ? "waiting"
    : state.stage === "ready" && state.sent ? "sent"
    : state.stage === "ready" ? "approved"
    : state.stage === "planned" ? "inhand"
    : state.idea.status === "sentback" || state.plan.status === "sentback" || state.final.status === "sentback" ? "sentback"
    : "inhand";
  return (
    <svg viewBox="0 0 12 12" className={`mark mark--${m}`} aria-hidden="true">
      <circle className="mark__fill" cx="6" cy="6" r="4.2" />
      {m === "inhand" ? <path className="mark__fill" d="M6 1.8 A4.2 4.2 0 0 1 10.2 6 L6 6 Z" /> : null}
      {m === "sent" ? <path className="mark__half" d="M6 1.8 A4.2 4.2 0 0 0 6 10.2 Z" /> : null}
      {m === "killed" ? <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /> : null}
      <circle className="mark__ring" cx="6" cy="6" r="4.9" />
    </svg>
  );
}

export function CheckIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return (
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
  );
  return ok ? (
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.4 4.8 9 9.9 3.4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
  );
}

export function Diamond() {
  return (
    <svg className="diamond" viewBox="0 0 12 12" width="10" height="10" aria-label="the product slide" role="img">
      <path d="M6 1 11 6 6 11 1 6Z" fill="currentColor" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="currentColor" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.4" fill="none" /></svg>
  );
}

export function CrossIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
  );
}

export function SoundIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 1.5v7.2a1.8 1.8 0 1 1-1-1.6V3.4l5-1.2v5.6a1.8 1.8 0 1 1-1-1.6V1.5z" fill="currentColor" /></svg>
  );
}
