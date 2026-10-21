/**
 * A video post's body (research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 3): the rail of the
 * eight stages, then one panel for one stage (?stage=N; the current one by default) with its
 * decision in its head, then the video beat by beat (Timeline), the caption once the plan is
 * locked, and one folded Details block with everything the main view does not repeat:
 * REVIEW.md as written, the segments, the brief's lists, the files. The stage panels of a
 * locked video (keyframes, takes, composites, the cut) are VideoProduction's.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import Markdown from "@/components/Markdown";
import { STATE_WORD, plainProblem } from "@/lib/plain-words";
import type { PostState } from "@/lib/production";
import type { StageKey, StagesView } from "@/lib/video-stages";
import { SoundIcon } from "./Marks";
import { ReactionPickSlot } from "./ReactionPickSlot";
import { Timeline } from "./Timeline";
import { CompositePanel, CutPanel, StoryboardPanel, TakesPanel } from "./VideoProduction";
import { SegmentTable, StageRail } from "./VideoStages";

/** Which stage panel is open, and the segment card in it; base is the post page's path. */
export type VideoPanelView = { stage?: number; seg?: string; base?: string };

const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A video whose hook is a reaction: the brief has a reference, the hook channel is reaction, or a segment is an X. */
const hasReactionHook = (v: NonNullable<PostState["video"]>) => !!v.briefSummary?.reaction || !!v.briefSummary?.choices.some((c) => c.slot === "hook_channel" && c.value === "reaction") || !!v.timeline?.checkpoints.some((c) => c.segment?.endsWith("-x"));

/** The plan is approved or locked: a new reaction sends it back (app/api/reactions/pick). */
const planGated = (state: PostState) => !!state.video?.lock || state.plan.status === "approved" || state.plan.status === "stale";
const hookJobOf = (b: NonNullable<NonNullable<PostState["video"]>["briefSummary"]>) => b.choices.find((c) => c.slot === "hook_job")?.value ?? null;

/** The panel's title: the stage's action while it waits for the user, its name otherwise. */
function panelTitle(s: StagesView["stages"][number]): string {
  const you = s.state === "you" || s.state === "blocked" || s.state === "stale";
  const T: Record<StageKey, [string, string]> = {
    plan: ["The plan", "The plan"],
    approval: ["Approve the plan", s.state === "done" ? "The plan is locked" : "Approve the plan"],
    keyframes: ["Approve the storyboard", "Shots and keyframes"],
    generate: ["Generate the takes", "Generate the takes"],
    review: ["Review the takes", "The takes"],
    composite: ["Approve the composite", "The composite"],
    cut: ["Approve the cut", "The cut"],
    deliver: ["Approve for posting", "The delivered video"],
  };
  return T[s.key][you ? 0 : 1];
}

/* ------------------------------------------------------------------ stage 1 */

function PlanStage({ state }: { state: PostState }) {
  const v = state.video!;
  const b = v.briefSummary;
  if (!b) return <p className="sr__hint">{v.manual ? "Made outside the pipeline: the brief was written by hand to show the delivered file." : "The brief is not written yet."}</p>;
  const hooks = [...b.hooks].sort((x, y) => Number(y.selected) - Number(x.selected));
  return (
    <div className="vst__brief">
      {b.idea ? <p><b>The idea.</b> {b.idea}</p> : null}
      {b.viewerMoment ? <p><b>The viewer&apos;s moment.</b> {b.viewerMoment}</p> : null}
      {hooks.length ? <ul className="vst__hooks">{hooks.map((h) => <li key={h.id} className={h.selected ? "is-on" : ""}>“{h.text}”{h.selected ? <small> · chosen</small> : null}{h.note ? <small> — {h.note}</small> : null}</li>)}</ul> : null}
      {hasReactionHook(v) && v.id ? (
        <ReactionPickSlot video={v.id} app={state.row.slug} post={state.row.key} current={b.reaction} locked={planGated(state)} job={hookJobOf(b)}>
          {b.reaction?.url ? <video className="vst__ref" src={`${b.reaction.url}#t=${(b.reaction.start ?? 0).toFixed(2)}`} controls preload="metadata" muted playsInline aria-label="The reaction reference" /> : undefined}
        </ReactionPickSlot>
      ) : null}
      {b.missing.length ? <p className="sr__hint">To answer a question of the brief or pick another hook, send the plan back with a note.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ stage 2 */

/** The problems, once: what stops the approval first, then what production still needs. */
function Problems({ state }: { state: PostState }) {
  const r = state.video!.ready;
  if (!r) return <p className="sr__hint">The list of missing inputs is not written yet.</p>;
  if (!r.current) return <p className="sr__hint">The list of missing inputs is for an older revision of the plan.</p>;
  if (!r.blocking.length && !r.dependencies.length) return null;
  return (
    <div className="problems">
      {r.blocking.length ? (
        <>
          <h4 className="problems__h">Before the plan can be approved</h4>
          <ul className="problems__list">{r.blocking.map((x, i) => <li key={i} className="is-bad">{plainProblem(x)}</li>)}</ul>
        </>
      ) : null}
      {r.dependencies.length ? (
        <>
          <h4 className="problems__h">Before production</h4>
          <ul className="problems__list">{r.dependencies.map((x, i) => <li key={i} className="is-warn">{plainProblem(x)}</li>)}</ul>
        </>
      ) : null}
    </div>
  );
}

function ApprovalStage({ state }: { state: PostState }) {
  const v = state.video!;
  return (
    <div className="vst__brief">
      <Problems state={state} />
      {!v.review ? <p className="sr__hint">The plan is not written yet.</p> : null}
      {hasReactionHook(v) && v.id ? <ReactionPickSlot video={v.id} app={state.row.slug} post={state.row.key} current={v.briefSummary?.reaction ?? null} locked={planGated(state)} job={v.briefSummary ? hookJobOf(v.briefSummary) : null} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ stage 8 */

function DeliverStage({ state }: { state: PostState }) {
  const v = state.video!;
  if (!v.final) return <p className="sr__hint">Not delivered yet: the file appears here once the cut is approved.</p>;
  return (
    <div className="vdeliver">
      <video className="vdeliver__video" src={v.final.url} controls playsInline preload="metadata" aria-label="The delivered video" data-cut-player />
      <p className="sr__hint">Delivered{v.final.delivered ? ` ${v.final.delivered.slice(0, 10)}` : ""}{v.final.duration ? ` · ${secs(v.final.duration)} s` : ""}{v.manual ? " · made outside the pipeline, no gates ran" : ""}.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ details */

function Details({ state, view, stage, seg }: { state: PostState; view?: VideoPanelView; stage: number; seg: string | null }) {
  const v = state.video!;
  const b = v.briefSummary;
  const p = v.production ?? null;
  const base = view?.base ?? "";
  const rev = v.review ? `Revision ${v.review.revision ?? "?"}${v.lock ? (v.review.revision === v.lock.revision ? ", locked" : `, not locked (locked: revision ${v.lock.revision})`) : ", not locked"}` : "No review of the plan yet";
  return (
    <details className="anatomy vdetails">
      <summary>Details · the plan as written, the segments, the brief, the files</summary>
      {p ? (
        <section className="vdetails__sec">
          <h2>The segments</h2>
          <SegmentTable p={p} tl={v.timeline ?? null} base={base} stage={stage} seg={seg} />
          {p.notes.length ? <ul className="vst__notes">{p.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        </section>
      ) : null}
      {b ? (
        <section className="vdetails__sec">
          <h2>The brief</h2>
          <dl className="vdetails__rows">
            {b.choices.map((c) => <div key={c.slot} className="anatomy__row"><dt>{c.slot.replace(/_/g, " ")}</dt><dd>{c.value}{c.status === "user" ? " (yours)" : c.status ? ` (${c.status})` : ""}</dd></div>)}
            {b.facts.map((f) => <div key={f.id} className="anatomy__row"><dt>fact {f.id}</dt><dd>{f.text} · {f.verified ? "verified" : "not verified"}</dd></div>)}
            {b.screens.map((s) => <div key={`s${s.id}`} className="anatomy__row"><dt>screen</dt><dd>{s.id}{s.job ? ` · ${s.job}` : ""} · {s.status ?? "?"}</dd></div>)}
            {b.assets.map((a) => <div key={`a${a.id}`} className="anatomy__row"><dt>asset</dt><dd>{a.id}{a.what ? ` · ${a.what}` : ""} · {a.status ?? "?"}</dd></div>)}
            {b.missing.map((m, i) => <div key={`m${i}`} className="anatomy__row"><dt>missing</dt><dd><b>{m.owner ?? "?"}</b>: {m.what}{m.blocks ? ` (blocks ${m.blocks})` : ""}</dd></div>)}
            {b.limitations.map((l, i) => <div key={`l${i}`} className="anatomy__row"><dt>limit</dt><dd>{l}</dd></div>)}
          </dl>
        </section>
      ) : null}
      <section className="vdetails__sec">
        <h2>The files</h2>
        <dl className="vdetails__rows">
          {v.id ? <div className="anatomy__row"><dt>Video</dt><dd><code>{v.id}</code></dd></div> : null}
          <div className="anatomy__row"><dt>Plan</dt><dd>{rev}{v.review?.digest ? <> · digest <code>{v.review.digest.slice(0, 12)}</code></> : null}{v.timeline?.source ? <> · from <code>{v.timeline.source}</code></> : null}</dd></div>
          {v.lock ? <div className="anatomy__row"><dt>Lock</dt><dd>revision {v.lock.revision}{v.lock.date ? ` · ${v.lock.date}` : ""} · <em>“{v.lock.words}”</em></dd></div> : null}
          {v.final ? <div className="anatomy__row"><dt>Delivered</dt><dd><code>pipeline/character/{v.id}/final/{v.id}.mp4</code> · sha256 <code>{v.final.sha256.slice(0, 12)}</code></dd></div> : null}
          {p?.spent ? <div className="anatomy__row"><dt>Spent</dt><dd>${p.spent.toFixed(2)} so far</dd></div> : null}
        </dl>
      </section>
      {v.stages ? (
        <section className="vdetails__sec">
          <h2>The stages, in the agent&apos;s words</h2>
          <dl className="vdetails__rows">
            {v.stages.stages.map((s) => <div key={s.key} className="anatomy__row"><dt>{s.n} · {s.short}</dt><dd>{STATE_WORD[s.state] || "not reached"}{s.words ? ` — ${s.words}` : ""}</dd></div>)}
          </dl>
        </section>
      ) : null}
      {v.review ? (
        <section className="vdetails__sec">
          <h2>The plan as written · {rev.toLowerCase()}</h2>
          <Markdown text={v.review.text} className="vreview" />
        </section>
      ) : null}
    </details>
  );
}

/* --------------------------------------------------------------------- view */

export function VideoView({ state, view, rail, railStage }: { state: PostState; mode: "plan" | "produced"; view?: VideoPanelView; /** The decision rail, drawn in the head of the panel of `railStage`. */ rail?: ReactNode; railStage?: number | null }) {
  const v = state.video!;
  const { row } = state;
  const base = view?.base ?? "";
  const stage = v.stages && view?.stage && view.stage >= 1 && view.stage <= 8 ? view.stage : v.stages?.current ?? 1;
  const seg = view?.seg ?? null;
  const p = v.production ?? null;
  const live = !state.killed;
  const s = v.stages?.stages[stage - 1] ?? null;
  const caption = v.plan?.caption && !/^<.*>$/.test(v.plan.caption) ? v.plan.caption : null;

  const panel = !s ? <p className="sr__hint">{v.review ? "The stages are not read yet." : "The plan is not written yet."}</p>
    : stage === 1 ? <PlanStage state={state} />
    : stage === 2 ? <ApprovalStage state={state} />
    : stage === 8 ? <DeliverStage state={state} />
    : !p ? <p className="sr__hint">This stage starts once the plan is locked.</p>
    : stage === 3 ? <StoryboardPanel post={row.key} p={p} live={live} seg={seg} tl={v.timeline ?? null} />
    : stage === 6 ? <CompositePanel post={row.key} p={p} live={live} seg={seg} />
    : stage === 7 ? <CutPanel post={row.key} p={p} live={live} />
    : <TakesPanel post={row.key} p={p} live={live} seg={seg} tl={v.timeline ?? null} />;

  return (
    <>
      {v.stages ? <StageRail v={v.stages} base={base} stage={stage} /> : null}
      <section className="vpanel" aria-label={s ? `Stage ${stage}: ${s.name}` : "The plan"}>
        <div className="vpanel__head">
          <h2 className="vpanel__h">
            {s ? panelTitle(s) : "The plan"}
            {s && STATE_WORD[s.state] && s.state !== "you" ? <small>{STATE_WORD[s.state]}</small> : null}
            {stage === 2 && v.review ? <small>revision {v.review.revision ?? "?"}</small> : null}
            {seg ? <small>segment {seg} · <Link href={`${base}?stage=${stage}#stages`}>show every segment</Link></small> : null}
          </h2>
          {rail && railStage === stage ? <div className="vpanel__rail">{rail}</div> : null}
        </div>
        {panel}
      </section>

      {v.timeline?.checkpoints.length ? (
        <section className="vtl" aria-label="The video, beat by beat">
          <h2 className="vtl__h">The video <small className="tabular">{v.timeline.length ? `${secs(v.timeline.length)} s · ` : ""}{v.timeline.checkpoints.length} beat{v.timeline.checkpoints.length === 1 ? "" : "s"}{!v.lock ? " · from the draft" : ""}</small></h2>
          <Timeline tl={v.timeline} openSeg={seg} base={base} stage={stage} />
        </section>
      ) : null}

      {v.plan ? (
        <div className="tt vcaption">
          <div className="tt__handle">{row.handle}</div>
          <p className="tt__caption">
            {caption ?? <span className="is-blank">no caption in the plan</span>}{" "}
            {(row.tags ?? []).map((h) => <span key={h} className="tag">{h} </span>)}
          </p>
          <p className="tt__sound"><SoundIcon />{v.plan.music && !/^<.*>$/.test(v.plan.music) ? v.plan.music : "sound not chosen"}</p>
        </div>
      ) : null}

      <Details state={state} view={view} stage={stage} seg={seg} />
    </>
  );
}
