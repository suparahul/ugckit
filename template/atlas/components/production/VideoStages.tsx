/**
 * The stages of a character video (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4,
 * research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 3): the rail of the eight stages, each
 * with a plain name and one state word; a click opens that stage's panel (?stage=N). The
 * segment table (one row per video.json segment, one cell per stage that works per
 * segment) is drawn in the folded Details of the page, not on the rail. Read only: every
 * decision is in the stage panel.
 */

import Link from "next/link";

import { STATE_WORD } from "@/lib/plain-words";
import type { Production, Segment } from "@/lib/video-production";
import { rangeOf, undecidedTake, type StagesView, type Timeline } from "@/lib/video-stages";

const MARK: Record<string, string> = { done: "✓", "n/a": "–", you: "●", clicked: "◐", "sent back": "↩", blocked: "✕", stale: "!", agent: "…", "not reached": "" };

export function StageRail({ v, base, stage }: { v: StagesView; base: string; stage: number }) {
  return (
    <ol className="vst__rail" id="stages" aria-label="The stages of the video">
      {v.stages.map((s) => (
        <li key={s.key} className={`vst__step is-${s.state.replace(/[^a-z]+/g, "-")}${s.n === stage ? " is-open" : ""}${s.n === v.current ? " is-current" : ""}`}>
          <Link href={`${base}?stage=${s.n}#stages`} aria-current={s.n === stage ? "step" : undefined} title={`${s.name}: ${s.state || "not reached"} — ${s.words}`}>
            <span className="vst__n tabular">{s.n}</span>
            <span className="vst__name">{s.short}</span>
            {STATE_WORD[s.state] ? <span className="vst__state">{MARK[s.state] ? `${MARK[s.state]} ` : ""}{STATE_WORD[s.state]}</span> : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function cells(s: Segment, p: Production): string[] {
  const gateA = p.gateA?.decision === "approve" && p.gateA.current;
  const key = !s.generated || !s.needsKeyframe ? "none needed" : !s.keyframe ? "not yet" : gateA ? "approved" : "made";
  const take = !s.generated ? "none needed" : s.sharedFrom ? "shared" : s.takes.length ? `${s.takes.length} take${s.takes.length === 1 ? "" : "s"}` : "none yet";
  const b = s.sharedFrom ? `decided on ${s.sharedFrom.split(".")[0]}`
    : !s.generated ? (s.type === "C" ? (p.sources.find((x) => x.id === s.asset?.id)?.approved ? "source approved" : "source: your turn") : "none needed")
    : s.approved ? "approved" : s.click?.current && !s.click.recorded ? "recording" : undecidedTake(s) ? "your turn" : s.gateB && s.gateB.decision !== "approve" ? "rejected" : "not yet";
  const comp = !s.phone ? "none needed" : s.compositeApproved ? "approved" : s.composite ? "your turn" : "not yet";
  const t = p.assembly?.times[s.name];
  const cut = t && t[0] !== null && t[1] !== null ? rangeOf(t[0]!, t[1]!) : p.assembly ? "in the cut" : "not yet";
  return [key, take, b, comp, cut];
}

/** The segments and where each one is, stage by stage. In Details. */
export function SegmentTable({ p, tl, base, stage, seg }: { p: Production; tl: Timeline | null; base: string; stage: number; seg: string | null }) {
  if (!p.segments.length) return null;
  return (
    <div className="vst__table" role="table" aria-label="Segments">
      <div className="vst__row vst__row--head" role="row">
        {["Segment", "Beats", "Keyframe", "Take", "Review", "Composite", "In the cut"].map((h) => <span key={h} role="columnheader">{h}</span>)}
      </div>
      {p.segments.map((s) => {
        const [key, take, b, comp, cut] = cells(s, p);
        const beats = tl?.checkpoints.filter((c) => c.segment === s.name) ?? [];
        return (
          <div key={s.name} role="row" className={`vst__row${seg === s.name ? " is-open" : ""}`}>
            <span role="cell" data-label="Segment"><Link href={`${base}?stage=${stage}&seg=${s.name}#stages`}><b>{s.name}</b>{s.motionCopy ? " · motion copy" : ""}</Link></span>
            <span role="cell" data-label="Beats" className="tabular">{beats.length ? beats.map((c) => <Link key={c.id} href={`${base}?stage=${stage}&seg=${s.name}#tl-${c.id}`}>{c.range}</Link>) : s.beatIds.join(", ") || "none"}</span>
            <span role="cell" data-label="Keyframe">{key}</span>
            <span role="cell" data-label="Take">{take}</span>
            <span role="cell" data-label="Review">{b}</span>
            <span role="cell" data-label="Composite">{comp}</span>
            <span role="cell" data-label="In the cut" className="tabular">{cut}</span>
          </div>
        );
      })}
    </div>
  );
}
