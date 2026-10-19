/**
 * A video post's slot: the slideshow's place on the page, with no slide
 * navigator. Two modes, as the deck has:
 *
 *   plan       REVIEW.md, the exact revision the user approves (video_plan.py review).
 *   produced   the 9:16 frame: the delivered file in a player, or an empty
 *              frame while the video is in production. Beside it the locked
 *              plan's beats in order (time, the words or the action, the
 *              on-screen text) with each beat's production prompt once
 *              character-shots wrote it, then the caption as a slideshow shows
 *              its caption.
 *
 * Above the slot, in both modes, the stages (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md):
 * the "Now" sentence, the rail of the eight stages and the segment table (VideoStages),
 * then the panel of one stage (?stage=N; the current one by default) with the timeline on
 * its left (Timeline) and what the stage made, its checks and its decisions on the right
 * (the brief and the reaction slot, the ready lists, VideoProduction's panels, the
 * delivered file).
 */

import Link from "next/link";

import Markdown from "@/components/Markdown";
import type { PostState } from "@/lib/production";
import { frameStyle } from "./Frame";
import { SoundIcon } from "./Marks";
import { ReactionPickSlot } from "./ReactionPickSlot";
import { Timeline } from "./Timeline";
import { CompositePanel, CutPanel, StoryboardPanel, TakesPanel } from "./VideoProduction";
import { VideoStages } from "./VideoStages";

/** Which stage panel is open, and the segment card in it; base is the post page's path. */
export type VideoPanelView = { stage?: number; seg?: string; base?: string };

const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A video whose hook is a reaction: the brief has a reference, the hook channel is reaction, or a segment is an X. */
const hasReactionHook = (v: NonNullable<PostState["video"]>) => !!v.briefSummary?.reaction || !!v.briefSummary?.choices.some((c) => c.slot === "hook_channel" && c.value === "reaction") || !!v.timeline?.checkpoints.some((c) => c.segment?.endsWith("-x"));

/** Stage 1: the brief in lists, and the place for the reaction pick. */
function PlanStage({ state }: { state: PostState }) {
  const v = state.video!;
  const b = v.briefSummary;
  const reactionHook = hasReactionHook(v);
  if (!b) return <p className="sr__hint">{v.manual ? "Made outside the pipeline: the brief was written by hand to show the delivered file." : "No brief.json yet: video-plan writes it."}</p>;
  return (
    <div className="vst__brief">
      {b.idea ? <p><b>Idea:</b> {b.idea}</p> : null}
      {b.viewerMoment ? <p><b>The viewer&apos;s moment:</b> {b.viewerMoment}</p> : null}
      {b.hooks.length ? <><h4 className="vprod__sub">Hooks</h4><ul>{b.hooks.map((h) => <li key={h.id}>{h.selected ? <b>selected · </b> : null}“{h.text}”{h.note ? <small> — {h.note}</small> : null}</li>)}</ul></> : null}
      {b.choices.length ? <><h4 className="vprod__sub">Choices</h4><ul>{b.choices.map((c) => <li key={c.slot}><b>{c.slot}</b>: {c.value}{c.status === "user" ? " (yours)" : c.status ? ` (${c.status})` : ""}</li>)}</ul></> : null}
      {b.facts.length ? <><h4 className="vprod__sub">Facts</h4><ul>{b.facts.map((f) => <li key={f.id}>{f.text} · {f.verified ? "verified" : "not verified"}</li>)}</ul></> : null}
      {b.screens.length || b.assets.length ? <><h4 className="vprod__sub">Screens and assets</h4><ul>{b.screens.map((s) => <li key={`s${s.id}`}>screen {s.id}{s.job ? ` · ${s.job}` : ""} · {s.status ?? "?"}</li>)}{b.assets.map((a) => <li key={`a${a.id}`}>{a.id}{a.what ? ` · ${a.what}` : ""} · {a.status ?? "?"}</li>)}</ul></> : null}
      {b.missing.length ? <><h4 className="vprod__sub">Missing inputs</h4><ul>{b.missing.map((m, i) => <li key={i}><b>{m.owner ?? "?"}</b>: {m.what}{m.blocks ? ` (blocks ${m.blocks})` : ""}</li>)}</ul></> : null}
      {reactionHook && v.id ? (
        <ReactionPickSlot video={v.id} app={state.row.slug} post={state.row.key} current={b.reaction} locked={!!v.lock}>
          {b.reaction?.url ? <video className="vst__ref" src={`${b.reaction.url}#t=${(b.reaction.start ?? 0).toFixed(2)}`} controls preload="metadata" muted playsInline aria-label="The reaction reference" /> : undefined}
        </ReactionPickSlot>
      ) : null}
      {b.limitations.length ? <><h4 className="vprod__sub">Limits</h4><ul>{b.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></> : null}
      <p className="sr__hint">To answer a question here or pick another hook, send the plan back with a note (the decision bar at the top).</p>
    </div>
  );
}

/** Stage 2: what stops the lock and what stops production (ready.json). */
function ApprovalStage({ state }: { state: PostState }) {
  const v = state.video!;
  const r = v.ready;
  return (
    <div className="vst__brief">
      <p>{v.review ? `REVIEW.md, revision ${v.review.revision ?? "?"}${v.review.digest ? `, digest ${v.review.digest.slice(0, 12)}` : ""}` : "No REVIEW.md yet."}{v.lock ? ` · locked revision ${v.lock.revision}, “${v.lock.words}”${v.lock.date ? ` (${v.lock.date})` : ""}` : ""}</p>
      {!r ? <p className="sr__hint">No ready.json: the agent runs video_plan.py review (or ready --json) to list the blocking inputs here.</p> : (
        <>
          {!r.current ? <p className="rail__why">ready.json is for another digest: the agent runs video_plan.py review again.</p> : null}
          <h4 className="vprod__sub">Blocking the lock ({r.blocking.length})</h4>
          {r.blocking.length ? <ul>{r.blocking.map((x, i) => <li key={i} className="is-bad">{x}</li>)}</ul> : <p className="sr__hint">none: Approve plan is open.</p>}
          <h4 className="vprod__sub">Dependencies for production ({r.dependencies.length})</h4>
          {r.dependencies.length ? <ul>{r.dependencies.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="sr__hint">none.</p>}
        </>
      )}
      {hasReactionHook(v) && v.id ? <ReactionPickSlot video={v.id} app={state.row.slug} post={state.row.key} current={v.briefSummary?.reaction ?? null} locked={!!v.lock} /> : null}
      <p className="sr__hint">Approve plan and Send back are in the decision bar at the top of the page.</p>
    </div>
  );
}

/** The rail, the table, and the open stage's panel beside the timeline. */
function Stages({ state, view }: { state: PostState; view?: VideoPanelView }) {
  const v = state.video!;
  if (!v.stages) return null;
  const base = view?.base ?? "";
  const stage = view?.stage && view.stage >= 1 && view.stage <= 8 ? view.stage : v.stages.current;
  const seg = view?.seg ?? null;
  const p = v.production ?? null;
  const live = !state.killed;
  const s = v.stages.stages[stage - 1];
  const notLocked = <p className="sr__hint">This stage starts once the plan is locked.</p>;
  return (
    <>
      <VideoStages v={v.stages} p={p} tl={v.timeline ?? null} base={base} stage={stage} seg={seg} />
      <section className="vst__panel" aria-label={`Stage ${stage}: ${s.name}`}>
        <aside className="vst__tl">{v.timeline ? <Timeline tl={v.timeline} openSeg={seg} base={base} stage={stage} /> : null}</aside>
        <div className="vst__main">
          <h3 className="vst__ph">{stage} · {s.name} <small>{s.state} — {s.words}</small>{seg ? <> · <Link href={`${base}?stage=${stage}#stages`}>show every segment</Link></> : null}</h3>
          {stage === 1 ? <PlanStage state={state} />
            : stage === 2 ? <ApprovalStage state={state} />
            : stage === 8 ? <p className="vst__brief">{v.final ? <>Delivered{v.final.delivered ? ` ${v.final.delivered.slice(0, 10)}` : ""}: the file is in the frame below (sha256 {v.final.sha256.slice(0, 12)}). Approve for posting is in the decision bar at the top.{v.manual ? " Made outside the pipeline: no gates ran." : ""}</> : "Not delivered yet: deliver.sh writes final/ after gate C."}</p>
            : !p ? notLocked
            : stage === 3 ? <StoryboardPanel post={state.row.key} p={p} live={live} seg={seg} />
            : stage === 6 ? <CompositePanel post={state.row.key} p={p} live={live} seg={seg} />
            : stage === 7 ? <CutPanel post={state.row.key} p={p} live={live} />
            : <TakesPanel post={state.row.key} p={p} live={live} seg={seg} />}
        </div>
      </section>
    </>
  );
}

export function VideoView({ state, mode, view }: { state: PostState; mode: "plan" | "produced"; view?: VideoPanelView }) {
  const v = state.video!;
  const { row } = state;

  if (mode === "plan" || !v.plan) {
    return (
      <>
      <Stages state={state} view={view} />
      <section className="rep" aria-label="The plan as written">
        <div className="rep__top">
          <p className="rep__count tabular">
            {v.review ? `Revision ${v.review.revision ?? "?"}${v.lock && v.review.revision === v.lock.revision ? ", locked" : ", not locked"}` : "No REVIEW.md yet"}
            {v.review?.digest ? ` · digest ${v.review.digest.slice(0, 12)}` : ""}
          </p>
        </div>
        {v.review ? <Markdown text={v.review.text} className="vreview" /> : <p className="sr__hint">The plan appears here when video-script writes REVIEW.md.</p>}
      </section>
      </>
    );
  }

  const caption = v.plan.caption && !/^<.*>$/.test(v.plan.caption) ? v.plan.caption : null;
  return (
    <>
    <Stages state={state} view={view} />
    <section className="rep" aria-label="The video as it will appear">
      <div className="rep__top">
        <p className="rep__count tabular">
          Locked revision {v.lock?.revision ?? "?"}
          {v.plan.lengthS ? ` · ${secs(v.plan.lengthS)} s` : ""} · {v.plan.beats.length} beat{v.plan.beats.length === 1 ? "" : "s"}
          {v.final ? ` · delivered${v.final.delivered ? ` ${v.final.delivered.slice(0, 10)}` : ""}` : ""}
        </p>
      </div>
      <div className="rep__body">
        <div className="rep__frame">
          <div className="frame vframe" style={frameStyle("9:16")}>
            {v.final ? (
              <video className="vframe__video" src={v.final.url} controls playsInline preload="metadata" aria-label={`The video ${v.id}`} />
            ) : (
              <p className="vframe__empty">The video is in production: each stage is above. It shows here when it is delivered.<small>pipeline/character/{v.id}/final/{v.id}.mp4</small></p>
            )}
          </div>
          {v.final ? <p className="rep__textflag"><strong>File:</strong> pipeline/character/{v.id}/final/{v.id}.mp4{v.final.duration ? ` · ${secs(v.final.duration)} s` : ""} · sha256 {v.final.sha256.slice(0, 12)}</p> : null}
        </div>

        <div className="rep__side">
          <div className="sr">
            <div className="sr__h"><span className="sr__title"><b>The beats</b> · the locked plan</span></div>
            <ol className="vbeats">
              {v.plan.beats.map((b) => (
                <li key={b.id} className="vbeat">
                  <p className="vbeat__h tabular"><b>{secs(b.start)}–{secs(b.end)} s</b>{b.role ? ` · ${b.role}` : ""}</p>
                  {b.said.length ? b.said.map((l, i) => <p key={i} className="vbeat__said">{l.speaker ? <span className="vbeat__who">{l.speaker}</span> : null}“{l.line}”</p>) : null}
                  {b.action ? <p className="vbeat__action">{b.said.length ? "" : "Action: "}{b.action}</p> : null}
                  {b.onScreen.map((t, i) => <p key={i} className="vbeat__screen">On screen: “{t}”</p>)}
                  {b.prompts.map((p) => (
                    <details key={p.segment} className="vbeat__prompt">
                      <summary>Prompt · segment {p.segment}</summary>
                      <pre>{p.text}</pre>
                    </details>
                  ))}
                </li>
              ))}
            </ol>
            {!v.plan.beats.some((b) => b.prompts.length) ? <p className="sr__hint">The per-shot prompts appear under each beat when production writes them.</p> : null}
          </div>

          <div className="tt">
            <div className="tt__handle">{row.handle}</div>
            <p className="tt__caption">
              {caption ?? <span className="is-blank">no caption in the plan</span>}{" "}
              {(row.tags ?? []).map((h) => <span key={h} className="tag">{h} </span>)}
            </p>
            <p className="tt__sound"><SoundIcon />{v.plan.music && !/^<.*>$/.test(v.plan.music) ? v.plan.music : "sound not chosen"}</p>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
