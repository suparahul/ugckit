/**
 * A video post's body as one document (research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md § 6): the
 * video is read top to bottom, and every stage adds to it. The backbone is a vertical list of
 * the video's parts in time order, one full-width row each: the time and the role on the left,
 * what the viewer sees and reads in the middle (the words on screen in full, the reaction, the
 * app's screen story step by step, the result word for word), and the media of the stage that
 * is open on the right (VideoProduction: the reference clip at the plan, the keyframe at gate A,
 * the take with Approve / Reject at gate B, the composite, the approved clip under the cut). One
 * decision bar for the open stage, sticky at the top: one sentence, the cost, the buttons; when
 * the decisions are per row (review, composite) the bar only says what waits. The breadcrumbs of
 * the seven stages are drawn in the head of the page (VideoStages). The only fold is Details at
 * the end: REVIEW.md as written, the segments, the brief, the files, the decisions as recorded.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import Markdown from "@/components/Markdown";
import { STATE_WORD, pendingLine, plainProblem, roleWord, stageLine, type Status } from "@/lib/plain-words";
import type { PostState } from "@/lib/production";
import type { Checkpoint } from "@/lib/video-stages";
import type { Segment } from "@/lib/video-production";
import { SoundIcon } from "./Marks";
import { ReactionPickSlot } from "./ReactionPickSlot";
import { BarActions, CutRow, NarrationReview, RowMedia, SourceReview } from "./VideoProduction";
import { SegmentTable } from "./VideoStages";

/** Which stage is open (?stage=N), and the segment to mark in it (?seg=<nn>-<type>); base is the post page's path. */
export type VideoPanelView = { stage?: number; seg?: string; base?: string };

/** The decision bar's parts from the page: the rail of the stage whose action it is, the status sentence of the current stage, the notes under it. */
export type VideoBar = { rail: ReactNode; railStage: number | null; status: Status | null; notes: ReactNode };

const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const usd = (n: number | null) => (n === null ? "an unknown amount" : `$${n.toFixed(2)}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A video whose hook is a reaction: the brief has a reference, the hook channel is reaction, or a segment is an X. */
const hasReactionHook = (v: NonNullable<PostState["video"]>) => !!v.briefSummary?.reaction || !!v.briefSummary?.choices.some((c) => c.slot === "hook_channel" && c.value === "reaction") || !!v.timeline?.checkpoints.some((c) => c.segment?.endsWith("-x"));

/** The plan is approved or locked: a new reaction sends it back (app/api/reactions/pick). */
const planGated = (state: PostState) => !!state.video?.lock || state.plan.status === "approved" || state.plan.status === "stale";
const hookJobOf = (b: NonNullable<NonNullable<PostState["video"]>["briefSummary"]>) => b.choices.find((c) => c.slot === "hook_job")?.value ?? null;

/* ------------------------------------------------------------------ the bar */

/** The problems, once, under the bar: what stops the approval first, then what production still needs. */
function Problems({ state }: { state: PostState }) {
  const r = state.video!.ready;
  if (!r) return <p className="bar__hint">The list of missing inputs is not written yet.</p>;
  if (!r.current) return <p className="bar__hint">The list of missing inputs is for an older revision of the plan.</p>;
  if (!r.blocking.length && !r.dependencies.length) return null;
  return (
    <ul className="bar__notes">
      {r.blocking.map((x, i) => <li key={`b${i}`} className="is-bad">Before the plan can be approved: {plainProblem(x)}</li>)}
      {r.dependencies.map((x, i) => <li key={`d${i}`}>Before production: {plainProblem(x)}</li>)}
    </ul>
  );
}

/** Where a gate B item waits: the row of the beat its segment carries, else the item's own row. */
function waitHref(item: string, beats: Checkpoint[]): string {
  const name = item.replace(/ \(motion design\)$/, "");
  const c = beats.find((x) => x.segment === name);
  return c ? `#tl-${c.id}` : `#item-${name}`;
}

function DecisionBar({ state, stage, bar, beats, base }: { state: PostState; stage: number; bar?: VideoBar; beats: Checkpoint[]; base: string }) {
  const v = state.video!;
  const vs = v.stages!;
  const s = vs.stages[stage - 1];
  const p = v.production ?? null;
  const current = stage === vs.current;
  const st: Status = current && bar?.status ? bar.status : stageLine(vs, stage);
  /* A click of this stage the agent has not recorded: the bar's one line carries the decision and its time; the buttons are hidden meanwhile (VideoProduction). */
  const click = s.state !== "clicked" ? null
    : stage === 1 ? (state.plan.at ? { kind: "plan.approve", at: state.plan.at, note: null, current: true, recorded: false } : null)
    : stage === 2 ? p?.gateAClick ?? null
    : stage === 6 ? p?.cutClick ?? null
    : null;
  const text = click && click.current && !click.recorded ? pendingLine(click, s.key) : st.text;
  /* A stale plan: the lock is the agent's; what changed since it is listed under the bar (lib/plan-changes.ts). */
  const stale = stage === 1 && !!v.lock && !!v.draft && v.draft.revision > v.lock.revision && s.state !== "done";
  const tl = v.timeline ?? null;
  const changedRows = tl?.was ? tl.checkpoints.filter((c) => c.was) : [];
  const captionChanged = !!tl?.was && ("caption" in tl.was || "music" in tl.was);
  /* Gate B and the composite decide per row: the bar says what waits and points at the first. */
  const waiting = (stage === 4 || stage === 5) && s.state === "you" ? s.words.replace(/^waiting for you: /, "").split(", ") : [];
  const cost = stage === 2 && current && (s.state === "you" || s.state === "stale") && p && p.cost !== null && !/\$/.test(st.text) ? ` Approving starts the first runs: ${usd(p.cost)}.` : stage === 3 && p?.spent ? ` Spent so far: ${usd(p.spent)}.` : "";
  const rail = bar && bar.railStage === stage ? bar.rail : null;
  return (
    <div className={`bar is-${st.who}`} id="decide" aria-label="The decision">
      <div className="bar__row">
        <span className="bar__turn">{st.head}</span>
        <span className="bar__say">{text}{cost}</span>
        {waiting.length ? <a className="bar__jump" href={waitHref(waiting[0], beats)}>Go to {waiting.length === 1 ? "it" : "the first"} ↓</a> : null}
        {rail ? <div className="bar__act">{rail}</div> : null}
        {!rail && current && p && (stage === 2 || stage === 6) ? <BarActions stage={stage} post={state.row.key} p={p} live={!state.killed} /> : null}
        {!current ? <Link className="bar__now" href={`${base}?stage=${vs.current}#stages`}>Go to the current stage, {vs.stages[vs.current - 1].short}</Link> : null}
      </div>
      {stale ? (
        <div className="bar__changes">
          <p className="bar__hint">
            Revision {v.draft!.revision} of the plan differs from locked revision {v.lock!.revision}{v.lock!.date ? ` (${v.lock!.date})` : ""}.{" "}
            {changedRows.length ? <>The changed parts are marked below, the old beside the new: {changedRows.map((c, i) => <span key={c.id}>{i ? ", " : ""}<a href={`#tl-${c.id}`}>{c.range}</a></span>)}{captionChanged ? <>, <a href="#tl-caption">the caption</a></> : null}.</> : captionChanged ? <>The caption changed: it is marked below.</> : <>No part of the video changed.</>}
            {tl?.was?.removed.length ? ` Parts of the locked plan that are gone: ${tl.was.removed.join("; ")}.` : ""}
          </p>
          {tl?.was?.technical.length ? <details className="bar__fold"><summary>Technical changes only: {tl.was.technical.join(", ")}</summary><p className="bar__hint">Bookkeeping, not the video: nothing to review in it.</p></details> : null}
          <p className="bar__hint">The lock itself is written by the agent. After you accept, tell it: “lock {v.id} from the Atlas”.</p>
        </div>
      ) : null}
      {bar?.notes}
      {stage === 1 && v.review ? <Problems state={state} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ the rows */

const SOURCE_WORDS = {
  motion_design: ["Rebuilt from the app's real screens and animated", ", never filmed and never from a video model."],
  recording: ["A real screen recording", "."],
  still: ["A real still of the screen", "."],
};
const MUST_WORDS: Record<string, string> = { read: "the viewer must read it", recognise: "the viewer must recognise it", recognize: "the viewer must recognise it" };
const quiet = (sound: string) => sound === "silent" || sound === "no line" || /^(silent|no line) · music:/.test(sound);

/** The locked plan's value beside the draft's: one quiet line, "was: …". */
const Was = ({ head, children }: { head?: string; children: ReactNode }) => <p className="row__was"><b>was{head ? `, ${head}` : ""}:</b> {children}</p>;

/** One part of the video: the time, what the viewer sees and reads, the media of the open stage. */
function BeatRow({ state, c, overlays, seg, first, stage, open, reaction }: { state: PostState; c: Checkpoint; overlays: Checkpoint["text"]; seg: Segment | null; first: boolean; stage: number; open: boolean; reaction: ReactNode }) {
  const v = state.video!;
  const role = roleWord(c.role);
  const sees = c.sees === "not written" ? null : c.sees.replace(/ · framing: \w+$/, "");
  const story = c.story;
  const kind = [role ? cap(role) : story ? "The app" : "A part", story?.screens.length ? story.screens.join(", ") : null].filter(Boolean).join(" · ");
  const src = story ? (story.source ? SOURCE_WORDS[story.source] : null) : null;
  const w = c.was;
  const oldSees = w?.sees !== undefined ? (w.sees === "not written" ? null : w.sees.replace(/ · framing: \w+$/, "")) : undefined;
  return (
    <li className={`row${open ? " is-open" : ""}${story ? " is-app" : ""}${w ? " is-changed" : ""}`} id={`tl-${c.id}`} data-seg={c.segment ?? undefined}>
      <div className="row__t">
        <b className="tabular">{c.range}</b>
        {w?.range ? <Was>{w.range}</Was> : null}
        {role ?? (story ? "the app" : null)}
        {c.segment ? <span className="row__code">{c.segment}</span> : null}
      </div>
      <div className="row__c">
        <p className="row__kind">{kind}{c.viewerMust && MUST_WORDS[c.viewerMust] ? <small>{MUST_WORDS[c.viewerMust]}</small> : null}{w?.new ? <small className="row__changed">new in revision {v.draft?.revision ?? "?"}</small> : w ? <small className="row__changed">changed in revision {v.draft?.revision ?? "?"}</small> : null}</p>
        {overlays.map((t, i) => <p key={i} className="row__on">“{t.text}”<small>on screen{t.placement ? `, ${t.placement}` : ""}, {t.range}</small></p>)}
        {w?.text ? (w.text.length ? w.text.map((t, i) => <Was key={`w${i}`} head="the words on screen">“{t.text}”, {t.range}</Was>) : <Was head="the words on screen">none</Was>) : null}
        {story ? <p className="row__src">{src ? <><b>{src[0]}</b>{src[1]}</> : "How the app is shown is not said yet."}</p> : null}
        {sees ? <p className="row__sees">{sees}</p> : <p className="row__sees is-blank">Nothing written yet.</p>}
        {oldSees !== undefined ? <Was head="what the viewer sees">{oldSees ?? "nothing written"}</Was> : null}
        {!quiet(c.sound) ? <p className="row__sound">{c.sound}</p> : null}
        {w?.sound !== undefined ? <Was head="the sound">{w.sound}</Was> : null}
        {w?.app !== undefined ? <Was head="the app">{w.app}</Was> : null}
        {reaction}
        {story ? (
          story.steps.length ? (
            <ol className="row__steps">
              {story.steps.map((x, i) => (
                <li key={i}>
                  <b className="tabular">{secs(c.start + x.at)} s</b>
                  <div>
                    <span>{x.what}</span>
                    {x.reads.length ? <div className="row__reads">{x.reads.map((r, j) => <span key={j}>“{r}”</span>)}</div> : null}
                    {w?.steps?.[i] ? (w.steps[i]!.what ? <Was head="this step">{w.steps[i]!.what}{w.steps[i]!.reads.length ? <>: {w.steps[i]!.reads.map((r) => `“${r}”`).join(", ")}</> : null}</Was> : <Was head="this step">not in the locked plan</Was>) : null}
                  </div>
                </li>
              ))}
              {w?.stepsGone?.map((x, i) => <li key={`g${i}`} className="is-gone"><b className="tabular">gone</b><div><Was head="a step of the locked plan">{x.what}{x.reads.length ? <>: {x.reads.map((r) => `“${r}”`).join(", ")}</> : null}</Was></div></li>)}
            </ol>
          ) : <p className="sr__hint">The screen story is not written yet.</p>
        ) : null}
        {c.hero ? <p className="row__hero">The result, word for word: <b>“{c.hero}”</b></p> : null}
        {w?.hero !== undefined ? <Was head="the result">{w.hero ? `“${w.hero}”` : "none"}</Was> : null}
      </div>
      <div className="row__m">
        <RowMedia stage={stage} c={c} seg={seg} first={first} p={v.production ?? null} post={state.row.key} live={!state.killed} />
      </div>
    </li>
  );
}

/** The caption, the tags and the sound, as the viewer reads them: the last row. */
function CaptionRow({ state }: { state: PostState }) {
  const v = state.video!;
  const was = v.timeline?.was ?? null;
  const written = was ? v.timeline : v.plan ?? v.timeline ?? null;
  if (!written) return null;
  const caption = written.caption && !/^<.*>$/.test(written.caption) ? written.caption : null;
  const changed = !!was && ("caption" in was || "music" in was);
  return (
    <li className={`row row--caption${changed ? " is-changed" : ""}`} id="tl-caption">
      <div className="row__t"><b>Caption</b>what the viewer reads under the video</div>
      <div className="row__c">
        {changed ? <p className="row__kind"><small className="row__changed">changed in revision {v.draft?.revision ?? "?"}</small></p> : null}
        <p className="row__caption">
          {caption ?? <span className="is-blank">no caption in the plan</span>}{" "}
          {(state.row.tags ?? []).map((h) => <span key={h} className="tag">{h} </span>)}
        </p>
        {was && "caption" in was ? <Was head="the caption">{was.caption && !/^<.*>$/.test(was.caption) ? was.caption : "none"}</Was> : null}
        <p className="row__music"><SoundIcon />{written.music && !/^<.*>$/.test(written.music) ? written.music : "sound not chosen"}</p>
        {was && "music" in was ? <Was head="the sound">{was.music && !/^<.*>$/.test(was.music) ? was.music : "not chosen"}</Was> : null}
      </div>
      <div className="row__m" />
    </li>
  );
}

/* ------------------------------------------------------------------ details */

function Details({ state, view, stage, seg }: { state: PostState; view?: VideoPanelView; stage: number; seg: string | null }) {
  const v = state.video!;
  const b = v.briefSummary;
  const p = v.production ?? null;
  const base = view?.base ?? "";
  const others = (b?.hooks ?? []).filter((h) => !h.selected);
  const rev = v.review ? `Revision ${v.review.revision ?? "?"}${v.lock ? (v.review.revision === v.lock.revision ? ", locked" : `, not locked (locked: revision ${v.lock.revision})`) : ", not locked"}` : "No review of the plan yet";
  const keyed = p ? p.segments.filter((s) => s.generated && !s.sharedFrom && s.keyframe).length : 0;
  const decisions = p ? [
    p.gateA?.words ? `Gate A (${p.gateA.decision}): “${p.gateA.words}”${p.gateA.date ? ` (${p.gateA.date})` : ""}` : null,
    ...p.segments.filter((s) => s.gateB?.words).map((s) => `Gate B, ${s.name} (${s.gateB!.decision}): “${s.gateB!.words}”${s.gateB!.failure ? ` · failed: ${s.gateB!.failure}` : ""}`),
    ...p.segments.filter((s) => s.motion?.decision?.words).map((s) => `Gate B, ${s.name} motion design (${s.motion!.decision!.decision}): “${s.motion!.decision!.words}”`),
    p.gateC?.words ? `Gate C (${p.gateC.decision}): “${p.gateC.words}”${p.gateC.date ? ` (${p.gateC.date})` : ""}` : null,
  ].filter(Boolean) as string[] : [];
  return (
    <details className="anatomy vdetails" id="details">
      <summary>Details · the plan as written, the other hooks, the segments, the brief, the files, the decisions as recorded</summary>
      {others.length ? (
        <section className="vdetails__sec">
          <h2>The other hooks considered</h2>
          <ul className="vst__hooks">{others.map((h) => <li key={h.id}>“{h.text}”{h.note ? <small> — {h.note}</small> : null}</li>)}</ul>
          {b?.missing.length ? <p className="sr__hint">To answer a question of the brief or pick another hook, send the plan back with a note.</p> : null}
        </section>
      ) : null}
      {p ? (
        <section className="vdetails__sec">
          <h2>The segments</h2>
          <SegmentTable p={p} tl={v.timeline ?? null} base={base} stage={stage} seg={seg} />
          {keyed >= 2 && p.storyboard ? <p className="sr__hint"><a href={p.storyboard.url} target="_blank" rel="noreferrer">Open the storyboard sheet</a>: every keyframe on one page.</p> : null}
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
          {p?.assembly ? <div className="anatomy__row"><dt>Cut</dt><dd><code>{p.assembly.file.replace(/^.*\//, "")}</code> · sha256 <code>{p.assembly.sha256.slice(0, 12)}</code>{p.assembly.sheet ? <> · <a href={p.assembly.sheet} target="_blank" rel="noreferrer">contact sheet</a></> : null}</dd></div> : null}
          {p?.assembly?.checks.length ? <div className="anatomy__row"><dt>Checks of the cut</dt><dd>{p.assembly.checks.map((c) => `${c.name} ${c.result || "—"}${c.detail ? ` (${c.detail})` : ""}`).join(" · ")}</dd></div> : null}
          {v.final ? <div className="anatomy__row"><dt>Delivered</dt><dd><code>pipeline/character/{v.id}/final/{v.id}.mp4</code> · sha256 <code>{v.final.sha256.slice(0, 12)}</code></dd></div> : null}
          {p?.spent ? <div className="anatomy__row"><dt>Spent</dt><dd>${p.spent.toFixed(2)} so far</dd></div> : null}
        </dl>
      </section>
      {decisions.length ? (
        <section className="vdetails__sec">
          <h2>The decisions as recorded</h2>
          <ul className="vst__notes">{decisions.map((d) => <li key={d}>{d}</li>)}</ul>
        </section>
      ) : null}
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

export function VideoView({ state, view, bar }: { state: PostState; mode: "plan" | "produced"; view?: VideoPanelView; bar?: VideoBar }) {
  const v = state.video!;
  const { row } = state;
  const base = view?.base ?? "";
  const stage = v.stages && view?.stage && view.stage >= 1 && view.stage <= 7 ? view.stage : v.stages?.current ?? 1;
  const seg = view?.seg ?? null;
  const p = v.production ?? null;
  const b = v.briefSummary;
  const beats = v.timeline?.checkpoints ?? [];

  if (!v.stages) return <p className="sr__hint">{v.review ? "The stages are not read yet." : v.manual ? "Made outside the pipeline: the brief was written by hand to show the delivered file." : "The brief is not written yet."}</p>;

  /* The reaction, under the beat that reacts: the one with a reference, else the first. */
  const reaction = b && hasReactionHook(v) && v.id ? <ReactionPickSlot video={v.id} app={row.slug} post={row.key} current={b.reaction} locked={planGated(state)} job={hookJobOf(b)} /> : null;
  const reactionAt = beats.find((c) => c.reaction)?.id ?? beats[0]?.id ?? null;
  /* Each overlay is shown once, under the first beat it is on screen in; each segment's media once, in its first row. */
  const seen = new Set<string>();
  const shown = new Set<string>();
  const chosen = b?.hooks.find((h) => h.selected) ?? null;
  /* Gate B items with no row of their own: narration takes, and supplied files no beat carries. */
  const carried = new Set(beats.map((c) => (c.segment ? p?.segments.find((s) => s.name === c.segment)?.asset?.id ?? null : null)).filter(Boolean));
  const extraSources = stage === 4 && p ? p.sources.filter((x) => !carried.has(x.id)) : [];
  const narration = stage === 4 && p ? p.narration : [];

  return (
    <>
      <DecisionBar state={state} stage={stage} bar={bar} beats={beats} base={base} />
      <ol className="doc" id="doc" aria-label="The video, part by part">
        {b?.idea || b?.viewerMoment ? (
          <li className="row is-top">
            <div className="row__t"><b>The idea</b></div>
            <div className="row__c"><p className="row__sees">{b.idea}{b.viewerMoment ? <> <b>The viewer&apos;s moment.</b> {b.viewerMoment}</> : null}</p></div>
          </li>
        ) : null}
        {(stage === 6 || stage === 7) && p ? (
          <li className="row is-top is-cut">
            <div className="row__t"><b>{stage === 7 && v.final ? "Delivered" : "The cut"}</b>{v.timeline?.length ? <span className="tabular">{secs(v.timeline.length)} s</span> : null}</div>
            <div className="row__c"><CutRow p={p} final={stage === 7 ? v.final : null} /></div>
          </li>
        ) : null}
        {beats.length ? beats.map((c, i) => {
          const overlays = c.text.filter((t) => !seen.has(t.text));
          overlays.forEach((t) => seen.add(t.text));
          const sg = c.segment ? p?.segments.find((s) => s.name === c.segment) ?? null : null;
          const first = c.segment ? !shown.has(c.segment) : !(beats[i - 1]?.story && c.story);
          if (c.segment) shown.add(c.segment);
          return <BeatRow key={c.id} state={state} c={c} overlays={overlays} seg={sg} first={first} stage={stage} open={!!seg && c.segment === seg} reaction={c.id === reactionAt ? reaction : null} />;
        }) : (
          <li className="row is-top">
            <div className="row__t"><b>The hook</b></div>
            <div className="row__c">
              {chosen ? <p className="row__on">“{chosen.text}”<small>the hook</small></p> : null}
              {reaction}
              <p className="sr__hint">The script is not written yet: the parts of the video appear here when it is.</p>
            </div>
          </li>
        )}
        {extraSources.map((x) => (
          <li key={x.id} className="row" id={`item-${x.id}`}>
            <div className="row__t"><b>Supplied</b>{x.kind ?? "file"}<span className="row__code">{x.id}</span></div>
            <div className="row__c"><p className="row__kind">A supplied file</p><p className="row__sees">{x.file ?? x.id}{x.range ? `, ${x.range.join("–")} s` : x.still !== null ? `, still at ${x.still} s` : ""}; used by {x.segments.join(", ") || "no segment"}.</p></div>
            <div className="row__m"><SourceReview post={row.key} x={x} live={!state.killed} /></div>
          </li>
        ))}
        {narration.map((x) => (
          <li key={x.take} className="row" id={`item-${x.take}`}>
            <div className="row__t"><b>Narration</b>{x.narrator ?? "the narrator"}<span className="row__code">{x.take}</span></div>
            <div className="row__c"><p className="row__kind">The voice under {x.segments.join(", ") || "the video"}</p>{x.words.length ? <p className="row__sees">{x.words.map((w, i) => <span key={i}>“{w}” </span>)}</p> : <p className="row__sees is-blank">No line of the plan uses this take.</p>}</div>
            <div className="row__m"><NarrationReview post={row.key} x={x} live={!state.killed} /></div>
          </li>
        ))}
        <CaptionRow state={state} />
      </ol>
      <Details state={state} view={view} stage={stage} seg={seg} />
    </>
  );
}
