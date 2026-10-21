/**
 * The stages of a character video (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4,
 * research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 6): one row of chevron breadcrumbs under
 * the title, one step per stage, each with its plain name and one state word, the current
 * one filled in; a click opens that stage (?stage=N). The segment table (one row per
 * video.json segment, one cell per stage that works per segment) is drawn in the folded
 * Details of the page. Read only: every decision is in the decision bar or in a row.
 */

import Link from "next/link";

import { STATE_WORD } from "@/lib/plain-words";
import type { Production, Segment } from "@/lib/video-production";
import { rangeOf, undecidedTake, type StagesView, type Timeline } from "@/lib/video-stages";

export function StageCrumbs({ v, base, stage }: { v: StagesView; base: string; stage: number }) {
  return (
    <ol className="crumbs" id="stages" aria-label="The stages of the video">
      {v.stages.map((s) => (
        <li key={s.key} className={`crumb is-${s.state.replace(/[^a-z]+/g, "-")}${s.n === stage ? " is-open" : ""}${s.n === v.current ? " is-now" : ""}`}>
          <Link href={`${base}?stage=${s.n}#stages`} aria-current={s.n === stage ? "step" : undefined} title={`${s.name}: ${s.state || "not reached"} — ${s.words}`}>
            <span className="crumb__name">{s.short}</span>
            <span className="crumb__state">{s.n === v.current && s.state === "you" ? "your turn" : STATE_WORD[s.state] || "not yet"}</span>
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
