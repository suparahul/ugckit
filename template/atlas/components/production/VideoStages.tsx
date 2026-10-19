/**
 * Where a character video is (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 4): the spend so
 * far, the "Now" sentence, the rail of the eight stages with their state words (a click
 * opens that stage's panel, ?stage=N), the notes where state.json disagrees with the
 * approval files, and the segment table, one row per video.json segment with one cell per
 * stage that works per segment. Before video.json exists the table lists the plan's beats.
 * Read only: every decision is in the stage panel below.
 */

import Link from "next/link";

import type { Production, Segment } from "@/lib/video-production";
import { rangeOf, undecidedTake, type StagesView, type Timeline } from "@/lib/video-stages";

const MARK: Record<string, string> = { done: "✓", "n/a": "–", you: "●", clicked: "◐", "sent back": "↩", blocked: "✕", stale: "!", agent: "…", "not reached": "○" };
const usd = (n: number) => `$${n.toFixed(2)}`;

function cells(s: Segment, p: Production): string[] {
  const gateA = p.gateA?.decision === "approve" && p.gateA.current;
  const key = !s.generated || !s.needsKeyframe ? "n/a" : !s.keyframe ? "not yet" : gateA ? "✓ A" : "made";
  const take = !s.generated ? "n/a" : s.sharedFrom ? "shared" : s.takes.length ? `${s.takes.length} take${s.takes.length === 1 ? "" : "s"}` : "none yet";
  const b = s.sharedFrom ? `on ${s.sharedFrom.split(".")[0]}`
    : !s.generated ? (s.type === "C" ? (p.sources.find((x) => x.id === s.asset?.id)?.approved ? "✓ source" : "source: you") : "n/a")
    : s.approved ? "✓" : s.click?.current && !s.click.recorded ? "clicked" : undecidedTake(s) ? "● you" : s.gateB && s.gateB.decision !== "approve" ? "rejected" : "–";
  const comp = !s.phone ? "n/a" : s.compositeApproved ? "✓" : s.composite ? "● you" : "–";
  const t = p.assembly?.times[s.name];
  const cut = t && t[0] !== null && t[1] !== null ? rangeOf(t[0]!, t[1]!) : p.assembly ? "in the cut" : "–";
  return [key, take, b, comp, cut];
}

export function VideoStages({ v, p, tl, base, stage, seg }: { v: StagesView; p: Production | null; tl: Timeline | null; base: string; stage: number; seg: string | null }) {
  const href = (q: string) => `${base}?${q}#stages`;
  return (
    <section className="vst" id="stages" aria-label="The stages of the video">
      <p className="vst__now"><b>Now:</b> {v.now}{p?.spent ? <span className="vst__spent tabular">spent so far {usd(p.spent)} (state.json)</span> : null}</p>
      <ol className="vst__rail">
        {v.stages.map((s) => (
          <li key={s.key} className={`vst__step is-${s.state.replace(/[^a-z]+/g, "-")}${s.n === stage ? " is-open" : ""}${s.n === v.current ? " is-current" : ""}`}>
            <Link href={href(`stage=${s.n}`)} aria-current={s.n === stage ? "step" : undefined} title={`${s.name}: ${s.state} — ${s.words}`}>
              <span className="vst__n tabular">{s.n}</span>
              <span className="vst__name">{s.short}</span>
              <span className="vst__state">{MARK[s.state] ?? ""} {s.state}</span>
            </Link>
          </li>
        ))}
      </ol>
      {v.notes.length ? <ul className="vst__notes">{v.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {p?.segments.length ? (
        <div className="vst__table" role="table" aria-label="Segments">
          <div className="vst__row vst__row--head" role="row">
            {["Segment", "Beats", "Keyframe", "Take", "Gate B", "Composite", "In the cut"].map((h) => <span key={h} role="columnheader">{h}</span>)}
          </div>
          {p.segments.map((s) => {
            const [key, take, b, comp, cut] = cells(s, p);
            const beats = tl?.checkpoints.filter((c) => c.segment === s.name) ?? [];
            return (
              <div key={s.name} role="row" className={`vst__row${seg === s.name ? " is-open" : ""}`}>
                <span role="cell" data-label="Segment"><Link href={href(`stage=${stage}&seg=${s.name}`)}><b>{s.name}</b> {s.type}{s.faceReplace ? " face replace" : ""}</Link></span>
                <span role="cell" data-label="Beats" className="tabular">{beats.length ? beats.map((c) => <Link key={c.id} href={`${base}?stage=${stage}&seg=${s.name}#tl-${c.id}`}>{c.range}</Link>) : s.beatIds.join(", ") || "–"}</span>
                <span role="cell" data-label="Keyframe">{key}</span>
                <span role="cell" data-label="Take">{take}</span>
                <span role="cell" data-label="Gate B">{b}</span>
                <span role="cell" data-label="Composite">{comp}</span>
                <span role="cell" data-label="In the cut" className="tabular">{cut}</span>
              </div>
            );
          })}
        </div>
      ) : tl?.checkpoints.length ? (
        <p className="sr__hint">Segments not cut yet: the timeline shows the plan&apos;s {tl.checkpoints.length} beat{tl.checkpoints.length === 1 ? "" : "s"}.</p>
      ) : null}
    </section>
  );
}
