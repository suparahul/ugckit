/**
 * A video post's body (research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 3 and § 6): the rail of
 * the seven stages, then one panel for one stage (?stage=N; the current one by default) with
 * its decision in its head. The plan panel (stage 1) is the whole video in time order: the
 * problems that block the approval, the idea, then each beat with the words on screen, the
 * reaction, the app's screen story step by step, the result word for word, and the caption.
 * The other stages show the strip of beats (Timeline) under their panel. Then the caption,
 * and one folded Details block with everything the main view does not repeat: REVIEW.md as
 * written, the segments, the brief's lists, the files. The stage panels of a locked video
 * (keyframes, takes, composites, the cut) are VideoProduction's.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import Markdown from "@/components/Markdown";
import { STATE_WORD, plainProblem, roleWord } from "@/lib/plain-words";
import type { PostState } from "@/lib/production";
import type { Checkpoint, StageKey, StagesView } from "@/lib/video-stages";
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
    plan: [s.state === "stale" ? "Approve the plan again" : "Approve the plan", s.state === "done" ? "The plan is approved" : "The plan"],
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

const SOURCE_WORDS = {
  motion_design: "Rebuilt from the app's real screens and animated, never filmed and never from a video model.",
  recording: "A real screen recording.",
  still: "A real still of the screen.",
};
const MUST_WORDS: Record<string, string> = { read: "The viewer must read it.", recognise: "The viewer must recognise it.", recognize: "The viewer must recognise it." };
const quiet = (sound: string) => sound === "silent" || sound === "no line" || /^(silent|no line) · music:/.test(sound);

/** One beat of the plan, open: the words on screen, what the viewer sees, the reaction, the app's story step by step, the result. */
function PlanBeat({ c, overlays, reaction }: { c: Checkpoint; overlays: Checkpoint["text"]; reaction: ReactNode }) {
  const role = roleWord(c.role);
  const sees = c.sees === "not written" ? null : c.sees.replace(/ · framing: \w+$/, "");
  const story = c.story;
  return (
    <li className={`plan__beat${story ? " is-app" : ""}`}>
      <p className="plan__range tabular"><b>{c.range}</b>{role ? <span> · {role.charAt(0).toUpperCase() + role.slice(1)}</span> : null}</p>
      {overlays.map((t, i) => <p key={i} className="plan__overlay">“{t.text}”<small> on screen{t.placement ? `, ${t.placement}` : ""}, {t.range}</small></p>)}
      {sees ? <p className="plan__sees">{sees}</p> : <p className="plan__sees is-blank">Nothing written yet.</p>}
      {!quiet(c.sound) ? <p className="plan__sound">{c.sound}</p> : null}
      {reaction}
      {story ? (
        <div className="plan__story">
          <p className="plan__source">{story.source ? SOURCE_WORDS[story.source] : "How the app is shown is not said yet."}{story.screens.length ? ` Screen: ${story.screens.join(", ")}.` : ""}{c.viewerMust && MUST_WORDS[c.viewerMust] ? ` ${MUST_WORDS[c.viewerMust]}` : ""}</p>
          {story.steps.length ? (
            <ol className="plan__steps">
              {story.steps.map((x, i) => (
                <li key={i}>
                  <p className="plan__step tabular"><b>{secs(c.start + x.at)} s</b> · {x.what}</p>
                  {x.reads.length ? <p className="plan__reads">{x.reads.map((w, j) => <span key={j} className="plan__read">“{w}”</span>)}</p> : null}
                </li>
              ))}
            </ol>
          ) : <p className="sr__hint">The screen story is not written yet.</p>}
          {c.hero ? <p className="plan__hero">The result, word for word: <b>“{c.hero}”</b></p> : null}
          {story.reason ? <details className="vprod__older"><summary>Why not a real recording</summary><p className="vprod__words">{story.reason}</p></details> : null}
        </div>
      ) : null}
    </li>
  );
}

/** The caption, the tags and the sound, as the viewer reads them. */
function Caption({ state }: { state: PostState }) {
  const v = state.video!;
  if (!v.plan) return null;
  const caption = v.plan.caption && !/^<.*>$/.test(v.plan.caption) ? v.plan.caption : null;
  return (
    <div className="tt vcaption">
      <div className="tt__handle">{state.row.handle}</div>
      <p className="tt__caption">
        {caption ?? <span className="is-blank">no caption in the plan</span>}{" "}
        {(state.row.tags ?? []).map((h) => <span key={h} className="tag">{h} </span>)}
      </p>
      <p className="tt__sound"><SoundIcon />{v.plan.music && !/^<.*>$/.test(v.plan.music) ? v.plan.music : "sound not chosen"}</p>
    </div>
  );
}

/** Stage 1, the plan: what blocks it, the idea, then the whole video in time order, open; the other hooks folded. */
function PlanStage({ state }: { state: PostState }) {
  const v = state.video!;
  const b = v.briefSummary;
  const beats = v.timeline?.checkpoints ?? [];
  if (!b && !beats.length) return <p className="sr__hint">{v.manual ? "Made outside the pipeline: the brief was written by hand to show the delivered file." : "The brief is not written yet."}</p>;
  const chosen = b?.hooks.find((h) => h.selected) ?? null;
  const others = (b?.hooks ?? []).filter((h) => !h.selected);
  const slot = b && hasReactionHook(v) && v.id ? (
    <ReactionPickSlot video={v.id} app={state.row.slug} post={state.row.key} current={b.reaction} locked={planGated(state)} job={hookJobOf(b)}>
      {b.reaction?.url ? <video className="vst__ref" src={`${b.reaction.url}#t=${(b.reaction.start ?? 0).toFixed(2)}`} controls preload="metadata" muted playsInline aria-label="The reaction reference" /> : undefined}
    </ReactionPickSlot>
  ) : null;
  /* The reaction sits under the beat that reacts: the one with a reference, else the first. */
  const reactionAt = beats.find((c) => c.reaction)?.id ?? beats[0]?.id ?? null;
  /* Each overlay is shown once, under the first beat it is on screen in. */
  const seen = new Set<string>();
  return (
    <div className="plan">
      {v.review ? <Problems state={state} /> : null}
      {b?.idea ? <p className="plan__idea"><b>The idea.</b> {b.idea}{b.viewerMoment ? <> <b>The viewer&apos;s moment.</b> {b.viewerMoment}</> : null}</p> : null}
      {beats.length ? (
        <ol className="plan__beats">
          {beats.map((c) => {
            const overlays = c.text.filter((t) => !seen.has(t.text));
            overlays.forEach((t) => seen.add(t.text));
            return <PlanBeat key={c.id} c={c} overlays={overlays} reaction={c.id === reactionAt ? slot : null} />;
          })}
        </ol>
      ) : (
        <>
          {chosen ? <p className="plan__overlay">“{chosen.text}”<small> the hook</small></p> : null}
          {slot}
          <p className="sr__hint">The script is not written yet: the beats appear here when it is.</p>
        </>
      )}
      <Caption state={state} />
      {others.length ? (
        <details className="vprod__older">
          <summary>The other hooks considered ({others.length})</summary>
          <ul className="vst__hooks">{others.map((h) => <li key={h.id}>“{h.text}”{h.note ? <small> — {h.note}</small> : null}</li>)}</ul>
        </details>
      ) : null}
      {b?.missing.length ? <p className="sr__hint">To answer a question of the brief or pick another hook, send the plan back with a note.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ stage 7 */

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
  const stage = v.stages && view?.stage && view.stage >= 1 && view.stage <= 7 ? view.stage : v.stages?.current ?? 1;
  const seg = view?.seg ?? null;
  const p = v.production ?? null;
  const live = !state.killed;
  const s = v.stages?.stages[stage - 1] ?? null;

  const panel = !s ? <p className="sr__hint">{v.review ? "The stages are not read yet." : "The plan is not written yet."}</p>
    : stage === 1 ? <PlanStage state={state} />
    : stage === 7 ? <DeliverStage state={state} />
    : !p ? <p className="sr__hint">This stage starts once the plan is locked.</p>
    : stage === 2 ? <StoryboardPanel post={row.key} p={p} live={live} seg={seg} tl={v.timeline ?? null} />
    : stage === 5 ? <CompositePanel post={row.key} p={p} live={live} seg={seg} />
    : stage === 6 ? <CutPanel post={row.key} p={p} live={live} />
    : <TakesPanel post={row.key} p={p} live={live} seg={seg} tl={v.timeline ?? null} />;

  return (
    <>
      {v.stages ? <StageRail v={v.stages} base={base} stage={stage} /> : null}
      <section className="vpanel" aria-label={s ? `Stage ${stage}: ${s.name}` : "The plan"}>
        <div className="vpanel__head">
          <h2 className="vpanel__h">
            {s ? panelTitle(s) : "The plan"}
            {s && STATE_WORD[s.state] && s.state !== "you" ? <small>{STATE_WORD[s.state]}</small> : null}
            {stage === 1 && v.review ? <small>revision {v.review.revision ?? "?"}</small> : null}
            {seg ? <small>segment {seg} · <Link href={`${base}?stage=${stage}#stages`}>show every segment</Link></small> : null}
          </h2>
          {rail && railStage === stage ? <div className="vpanel__rail">{rail}</div> : null}
        </div>
        {panel}
      </section>

      {stage !== 1 && v.timeline?.checkpoints.length ? (
        <section className="vtl" aria-label="The video, beat by beat">
          <h2 className="vtl__h">The video <small className="tabular">{v.timeline.length ? `${secs(v.timeline.length)} s · ` : ""}{v.timeline.checkpoints.length} beat{v.timeline.checkpoints.length === 1 ? "" : "s"}{!v.lock ? " · from the draft" : ""}</small></h2>
          <Timeline tl={v.timeline} openSeg={seg} base={base} stage={stage} />
        </section>
      ) : null}

      {stage !== 1 ? <Caption state={state} /> : null}

      <Details state={state} view={view} stage={stage} seg={seg} />
    </>
  );
}
