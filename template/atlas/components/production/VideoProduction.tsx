"use client";

/**
 * The media column of the one-document video page (research/ai-ugc/ATLAS-VIDEO-PAGE-CLEANUP.md
 * § 6.3), and the buttons of the decision bar. Each row of the document is one part of the
 * video; the stage decides what its media column holds: the reference clip at the plan, the
 * keyframe at gate A, the take with its checks and Approve / Reject at gate B, the composite,
 * then the approved clip under the cut. A part the stage does not touch shows one quiet line
 * saying why. The bar holds the stage's own decision (the storyboard and its cost, the cut).
 * Each control posts one line to the log, as the slide actions do; the agent records the line
 * (review.py ... --from-atlas) and runs the next step. The Atlas never generates and never
 * spends: approving the storyboard, asking for a take again, or regenerating a segment from
 * the cut is the user's yes to the computed cost the agent then spends.
 */

import { useState } from "react";

import { cutAccepts, motionAccepts } from "@/lib/accept-fail";
import type { Click, Motion, Narration, Production, Segment, Source, Take } from "@/lib/video-production";
import type { Checkpoint, Picture } from "@/lib/video-stages";
import { useDecide } from "./Actions";

/* The identity gate passes a take: PASS, or NO FACE (no frame shows a face; the eye check decides). */
const identityOk = (r: string | null | undefined) => r === "PASS" || r === "NO FACE";

const usd = (n: number | null) => (n === null ? "cost unknown" : `$${n.toFixed(2)}`);
const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
const base = (f: string) => f.replace(/^.*\//, "");
const at = (url: string, t: number | null | undefined) => (t ? `${url.split("#")[0]}#t=${t.toFixed(2)}` : url);
/** A paused video shows its first frame, not black: the player opens a hair after 0 s. */
const frame = (url: string) => at(url, 0.05);
const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const CHECK_WORDS: Record<string, string> = {
  identity: "the person is the character; any face in view is the character's",
  no_source_identity: "nothing of the original creator: no face, hair, mark, handle or caption",
  silent: "no voice; no mouth that forms words",
  hands: "the hands are whole",
  performance: "the reaction follows the written expression beats at their times",
  follows_reference: "the reaction follows the clip's beats in order and time",
};
const ROUTE_WORDS: Record<string, string> = {
  motion: "motion copy",
  replace: "motion copy, replace route (the backup)",
  animate: "motion copy, animate route",
  guided: "motion copy, guided route (untested)",
};
/* What a segment is, in words: "Shot 1", "Screen 2"; the code (01-x) stays beside it, small. */
const KIND: Record<string, string> = { X: "Reaction shot", B: "Shot", T: "Talking head", O: "Shot", C: "Supplied clip", M: "Panels", R: "Screen", P: "Screen in the phone" };
export function SegName({ s }: { s: Pick<Segment, "name" | "type"> }) {
  const n = Number(s.name.slice(0, 2));
  return <><b>{KIND[s.type] ?? "Segment"} {n}</b> <span className="vprod__code">{s.name}</span></>;
}

/** One quiet line in the media column: why there is nothing to see or decide here. */
const Quiet = ({ children }: { children: React.ReactNode }) => <p className="row__quiet">{children}</p>;

function ClickLine({ c, what }: { c: Click | null; what: string }) {
  if (!c) return null;
  const word = c.kind.endsWith(".approve") ? "approved" : c.kind.endsWith(".reject") ? "rejected" : "sent back";
  return (
    <p className="vprod__click">
      You {word} {what} {stamp(c.at)}{c.note ? <> — <em>“{c.note}”</em></> : null}.{" "}
      {!c.current ? "The file changed since: decide again." : c.recorded ? "Recorded." : "The agent records it next."}
    </p>
  );
}

function SendBack({ label, busy, onSend, placeholder }: { label: string; busy: boolean; onSend: (note: string) => Promise<string | null>; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) return <button type="button" className="pill" disabled={busy} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span className="vprod__form">
      <textarea className="note" rows={2} placeholder={placeholder ?? "Say what to change."} value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Note: ${label}`} autoFocus />
      <button type="button" className="pill" disabled={busy || !note.trim()} onClick={() => onSend(note).then((r) => { if (!r) { setOpen(false); setNote(""); } })}>{label.replace(/…$/, "")}</button>
      <button type="button" className="rail__kill" onClick={() => setOpen(false)}>cancel</button>
    </span>
  );
}

/** A failed measured gate, approved at the user's discretion (2026-10-21): the note is required, and the
 * agent records the gate, its result and the words (review.py --accept-fail). */
function ApproveAnyway({ gates, busy, onSend }: { gates: string[]; busy: boolean; onSend: (note: string) => Promise<string | null> }) {
  return <SendBack label="Approve anyway…" busy={busy} placeholder={`Why you approve it although ${gates.join(", ")} did not pass. Your words are recorded with the gate.`} onSend={onSend} />;
}

function Err({ e }: { e: string | null }) {
  return e ? <p className="rail__err" role="alert">{e}</p> : null;
}

/** A picture of the timeline (a still, or a paused frame of a video on disk), as a figure. */
function Pic({ p, small, dim, caption }: { p: Picture; small?: boolean; dim?: boolean; caption?: string }) {
  const src = p.kind === "video" && p.at !== null ? `${p.url.split("#")[0]}#t=${p.at.toFixed(2)}` : p.url;
  return (
    <figure className={`${small ? "is-small" : ""}${dim ? " is-dim" : ""}`}>
      {p.kind === "image" ? <img src={src} alt={p.label} loading="lazy" /> : <video src={src} preload="metadata" muted playsInline controls aria-label={p.label} />}
      <figcaption>{caption ?? p.label}</figcaption>
    </figure>
  );
}

/** The pictures of a beat whose label starts with a word: "reference", "supplied". */
const picsOf = (c: Checkpoint, prefix: string) => [...(c.picture ? [c.picture] : []), ...c.earlier].filter((p) => p.label.startsWith(prefix));

/* What a part is, when it is not a generated shot, and why there is nothing for it at a stage. */
const laidIn = (s: Segment) =>
  s.type === "C" ? "the supplied file is laid in at the cut"
  : s.type === "M" ? "the panels are laid in at the cut"
  : s.motion ? "the app screen is rebuilt in code and rendered locally, then laid in at the cut"
  : "the screen recording is laid in at the cut";

export type MediaProps = {
  stage: number;
  c: Checkpoint;
  /** The segment that carries this part, and whether this is its first row (the media shows once per segment). */
  seg: Segment | null;
  first: boolean;
  p: Production | null;
  post: string;
  live: boolean;
};

/** The media column of one row: what the current stage adds for this part. */
export function RowMedia(props: MediaProps) {
  const { stage, seg, first } = props;
  if (stage === 1) return <PlanMedia {...props} />;
  if (!seg) return <Quiet>No segment carries this part yet: the shots are written once the plan is locked.</Quiet>;
  if (!first) return <Quiet>Same clip as the part above.</Quiet>;
  if (seg.sharedFrom) return <Quiet>Shared with {seg.sharedFrom}: decided there.</Quiet>;
  if (stage === 2) return <KeyframeMedia {...props} seg={seg} />;
  if (stage === 3) return <GenerateMedia {...props} seg={seg} />;
  if (stage === 4) return <ReviewMedia {...props} seg={seg} />;
  if (stage === 5) return <CompositeMedia {...props} seg={seg} />;
  return <CutMedia {...props} seg={seg} />;
}

/* --------------------------------------------------------------- stage 1: plan */

function PlanMedia({ c, first }: MediaProps) {
  const ref = picsOf(c, "reference")[0] ?? null;
  const sup = picsOf(c, "supplied");
  if (ref) {
    const r = c.reaction;
    return <Pic p={ref} caption={`The reference clip${r ? `, ${r.handle}, ${secs(r.start)}–${secs(r.end)} s` : ""}. The keyframe and the take come at the next stages.`} />;
  }
  if (sup.length) return <>{sup.map((p) => <Pic key={p.url + p.label} p={p} caption={`${p.label}: the file as supplied.`} />)}</>;
  if (c.story) return <Quiet>{first ? "No picture yet. The app part is rendered from the app's screens once the plan is approved; it is checked at the review stage." : "No picture yet. Rendered with the part above."}</Quiet>;
  return <Quiet>No picture at this stage.</Quiet>;
}

/* ------------------------------------------------------------ stage 2: gate A */

function KeyframeMedia({ post, c, seg: s, live }: MediaProps & { seg: Segment }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  if (!s.generated) return <Quiet>{s.type === "C" ? "Supplied file: no keyframe." : `No keyframe: ${laidIn(s)}.`}</Quiet>;
  const redo = (n: string) => decide({ post, kind: "storyboard.sendback", note: n, data: { segments: [s.name] } as any }).then((r) => { setErr(r); return r; });
  return (
    <>
      {s.keyframe ? <figure><a href={s.keyframe.url} target="_blank" rel="noreferrer"><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /></a><figcaption>The keyframe{s.keyframe.at ? ` · ${stamp(s.keyframe.at)}` : ""}: the take starts from this picture.</figcaption></figure>
        : <p className="vprod__nokey">{s.needsKeyframe ? "no keyframe yet" : "no keyframe: the clip leads"}</p>}
      {s.endStill ? <figure className="is-small"><img src={s.endStill} alt={`End still ${s.name}`} /><figcaption>the end still</figcaption></figure> : null}
      {s.poseFrame ? <figure className="is-small"><img src={s.poseFrame} alt={`Reference pose ${s.name}`} /><figcaption>Reference pose: the keyframe should match this pose</figcaption></figure> : null}
      {s.continues ? <Quiet>Opens on the last frame of {s.continues}, taken at its gate B.</Quiet> : null}
      {live && s.needsKeyframe && s.keyframe ? <div className="sr__actions"><SendBack label="Redo this keyframe…" busy={busy} placeholder="What to change in this keyframe." onSend={redo} /></div> : null}
      {c.segment !== s.name ? null : <Err e={err} />}
    </>
  );
}

/* --------------------------------------------------------------- stage 3: generate */

/** The take in focus: the newest one nobody decided yet and that is newer than the approved one; else the approved one; else the newest. */
const focusOf = (s: Segment): Take | null =>
  s.takes.find((t) => t.file !== s.gateB?.file && !(s.click?.current && s.click.file === t.file) && (!s.approved || t.at > s.approved.at)) ?? s.approved ?? s.takes[0] ?? null;
/** "take 2": the take's number, newest last. */
const takeNo = (s: Segment, file: string) => { const i = s.takes.findIndex((x) => x.file === file); return i < 0 ? base(file) : `take ${s.takes.length - i}`; };

function GenerateMedia({ seg: s, p }: MediaProps & { seg: Segment }) {
  if (!s.generated) return <Quiet>{s.motion ? "No paid run: the app screen is rebuilt in code and rendered locally." : `Nothing to generate: ${laidIn(s)}.`}</Quiet>;
  const t = focusOf(s);
  if (s.approved) return <figure><video src={frame(s.approved.url)} controls playsInline preload="metadata" aria-label={`The approved take of ${s.name}`} /><figcaption>{takeNo(s, s.approved.file)}, approved.</figcaption></figure>;
  if (t) return <figure><video src={frame(t.url)} controls playsInline preload="metadata" aria-label={`Take ${base(t.file)}`} /><figcaption>{takeNo(s, t.file)} · {stamp(t.at)}: review it at the next stage.</figcaption></figure>;
  const running = p?.state?.stages.generate?.status === "running" ? p.state.stages.generate.note : null;
  const failed = p?.state?.stages.generate?.status === "failed" ? p.state.stages.generate.note : null;
  const words = failed ? `The last run failed: ${failed ?? "no note"}.` : running ? `Generating now: ${running}.` : `Generating… ${usd(s.cost)} computed for one run.`;
  return s.keyframe ? <figure className="is-dim"><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /><figcaption>{words}</figcaption></figure> : <Quiet>{words}</Quiet>;
}

/* ------------------------------------------------------------ stage 4: gate B */

function ReviewMedia(props: MediaProps & { seg: Segment }) {
  const { seg: s, p, post, live } = props;
  if (s.generated) return <TakeReview {...props} />;
  if (s.motion) return <MotionDesign post={post} s={s} m={s.motion} live={live} />;
  if (s.type === "C" && s.asset) {
    const src = p?.sources.find((x) => x.id === s.asset!.id) ?? null;
    return src ? <SourceReview post={post} x={src} live={live} /> : <Quiet>Supplied {s.asset.id}: not in the plan&apos;s assets.</Quiet>;
  }
  if (s.type === "M" && s.panels.length) return <Panels s={s} />;
  return <Quiet>Nothing to review here: {laidIn(s)}. It is checked at the cut.</Quiet>;
}

/** The panels of a panel segment, laid in at the cut: their places in the frame. */
function Panels({ s }: { s: Segment }) {
  return (
    <details className="vprod__older">
      <summary>The panels in the frame ({s.panels.length}): laid in at the cut, checked there</summary>
      <div className="vprod__panels" aria-label="The panels in the frame">
        <div className="vprod__frame916">{s.panels.map((pn) => pn.rect && pn.rect.length === 4 ? <span key={pn.id} className="vprod__rect" style={{ left: `${pn.rect[0] * 100}%`, top: `${pn.rect[1] * 100}%`, width: `${pn.rect[2] * 100}%`, height: `${pn.rect[3] * 100}%` }}>{pn.id}</span> : null)}</div>
        <ul className="vprod__plist">{s.panels.map((pn) => <li key={pn.id}><b>{pn.id}</b> · {pn.what}{pn.url ? <> · <a href={pn.url} target="_blank" rel="noreferrer">open</a></> : " · not served"}</li>)}</ul>
      </div>
    </details>
  );
}

/** The shot in words: framing, planned length, the words it speaks, its references and subjects. */
function ShotFacts({ s }: { s: Segment }) {
  const bits = [
    s.framing ? `framing ${s.framing}` : null,
    s.seconds ? `${s.seconds} s generated` : null,
    s.motionCopy ? ROUTE_WORDS[s.motionCopy.route] ?? s.motionCopy.route : null,
    s.refCount ? `${s.refCount} reference${s.refCount === 1 ? "" : "s"}` : null,
    s.subjects.length ? `subjects ${s.subjects.join(", ")}` : null,
    s.expressionBeats ? `${s.expressionBeats} expression beat${s.expressionBeats === 1 ? "" : "s"}` : null,
    s.audioFrom ? `sound from ${s.audioFrom}` : null,
    s.cost !== null ? `${usd(s.cost)} a run` : null,
  ].filter(Boolean);
  return bits.length ? <p className="vprod__facts">{bits.join(" · ")}</p> : null;
}

/** A generated take at gate B: the take beside what it is judged against, the checks, Approve / Reject. */
function TakeReview({ post, seg: s, p, live }: MediaProps & { seg: Segment }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [what, setWhat] = useState("");
  const [fix, setFix] = useState("");
  const [again, setAgain] = useState(true);
  const [pick, setPick] = useState<string | null>(null);
  const t = (pick ? s.takes.find((x) => x.file === pick) : null) ?? focusOf(s);
  const decided = !!t && ((t.file === s.gateB?.file && !pick) || (s.click?.current && s.click.file === t.file));
  const isApproved = !!t && s.approved?.file === t.file;
  const idOk = !s.motionCopy || identityOk(t?.identity?.result);
  const status = s.approved ? `approved: ${takeNo(s, s.approved.file)}`
    : !s.takes.length ? "no take yet"
    : decided ? (s.click?.kind === "take.reject" || (s.gateB && s.gateB.decision !== "approve") ? "rejected: a new take comes next" : "approved in the Atlas")
    : "waiting for you";
  const send = (kind: "take.approve" | "take.reject", extra: Record<string, unknown>, note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { segment: s.name, file: t!.file, ...extra } as any }).then((r) => { setErr(r); if (!r) setPick(null); return r; });
  const nar = s.audioFrom?.startsWith("narration:") ? p?.narration.find((x) => x.take === s.audioFrom!.slice(10)) : null;
  return (
    <div className="take">
      <p className="take__status"><span className={`vprod__tag${s.approved ? " is-done" : status === "waiting for you" ? " is-you" : ""}`}>{status}</span></p>
      {s.gateB?.words && !s.approved ? <p className="vprod__words">Gate B ({s.gateB.decision}{s.gateB.file ? `, ${base(s.gateB.file)}` : ""}): “{s.gateB.words}”{s.gateB.failure ? ` · failed: ${s.gateB.failure}` : ""}</p> : null}
      {t ? (
        <>
          <figure>
            <video src={frame(t.url)} controls playsInline preload="metadata" aria-label={`Take ${base(t.file)}`} />
            <figcaption className="tabular">{takeNo(s, t.file)} · {stamp(t.at)}{isApproved ? " · approved" : ""}</figcaption>
          </figure>
          <div className="take__beside">
            {s.motionCopy?.reference ? <figure className="is-small"><video src={frame(s.motionCopy.reference)} controls playsInline preload="metadata" muted aria-label="The reference clip" /><figcaption>the reference clip: the take copies its motion</figcaption></figure> : null}
            {s.keyframe ? <figure className="is-small"><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /><figcaption>the keyframe: the take starts here</figcaption></figure> : null}
            {s.seam ? (
              <figure className="is-small">
                {s.seam.lastFrame ? <img src={s.seam.lastFrame} alt={`Last frame of ${s.seam.from}`} /> : <span className="vprod__nokey">no last frame of {s.seam.from} yet</span>}
                <figcaption>last frame of {s.seam.from}{s.seam.verified ? "" : " · UNVERIFIED"}</figcaption>
              </figure>
            ) : null}
          </div>
        </>
      ) : <Quiet>No take yet.</Quiet>}
      {s.seam ? <p className="vprod__words">Continuity seam: {s.seam.seedDiff !== null ? `the first frame differs from the last frame of ${s.seam.from} by ${s.seam.seedDiff} (0 to 255)` : `measured at gate B (review.py: checks.seed_diff)`}{s.seam.verified ? "" : "; the model's continuity input is not verified by a paid run yet"}.</p> : null}
      {t && s.motionCopy ? (
        <p className={`vprod__id${identityOk(t.identity?.result) ? " is-ok" : t.identity ? " is-bad" : ""}`}>
          Identity gate: {t.identity
            ? <>{t.identity.result}{t.identity.character !== null ? ` · median ${t.identity.character} to the character, ${t.identity.reference ?? "?"} to the reference` : ""}{t.identity.closer !== null ? ` · closer to the character in ${Math.round(t.identity.closer * 100)}% of frames` : ""}{t.identity.why ? ` · ${t.identity.why}` : ""}</>
            : "not run on this take yet (generate.sh runs identity.py after the download)"}
        </p>
      ) : null}
      {s.plateGates ? <p className={`vprod__id${s.plateGates === "pass" ? " is-ok" : " is-bad"}`}>Insertion gates of the plate (flat-on first): {s.plateGates}</p> : null}
      {s.type === "T" ? <p className="sr__hint">Check the words against the frozen script, and the voice against the character&apos;s voice reference.</p> : null}
      {s.type === "B" ? <p className="sr__hint">The people rule: {s.framing === "subject_only" ? "no person in the picture" : s.framing === "hands_only" ? "hands only, no face" : "as the shot says"}; count the subjects{s.subjects.length ? ` (${s.subjects.join(", ")})` : ""}.</p> : null}
      {nar ? <p className="vprod__words">Narration under it: take {nar.take} ({nar.approved ? "approved" : "its row is below"}).</p> : null}
      {s.takes.length > 1 ? (
        <details className="vprod__older">
          <summary>{s.takes.length} takes: look at another one</summary>
          <ul>{s.takes.map((x, i) => (
            <li key={x.file} className="tabular">
              take {s.takes.length - i} · <a href={x.url} target="_blank" rel="noreferrer">{base(x.file)}</a> · {stamp(x.at)}{x.file === s.gateB?.file ? ` · ${s.gateB.decision}` : ""}{x.identity ? ` · identity ${x.identity.result}` : ""}{" "}
              {live && x.file !== t?.file ? <button type="button" className="rail__kill" onClick={() => { setPick(x.file); setTicked([]); }}>look at this take</button> : x.file === t?.file ? <em>in view</em> : null}
            </li>
          ))}</ul>
        </details>
      ) : null}
      <ClickLine c={s.click} what={`a take of ${s.name}`} />
      <details className="vprod__older">
        <summary>About this shot{t?.sheet ? ", and the contact sheet" : ""}{s.gateB?.words && s.approved ? ", and the decision as recorded" : ""}</summary>
        <ShotFacts s={s} />
        {s.lines.length ? <p className="vprod__said">{s.lines.map((l, i) => <span key={i}>“{l}” </span>)}</p> : null}
        {s.gateB?.words && s.approved ? <p className="vprod__words">Gate B ({s.gateB.decision}{s.gateB.file ? `, ${base(s.gateB.file)}` : ""}): “{s.gateB.words}”{s.gateB.failure ? ` · failed: ${s.gateB.failure}` : ""}</p> : null}
        {t?.sheet ? <figure className="is-wide"><a href={t.sheet} target="_blank" rel="noreferrer"><img src={t.sheet} alt="Contact sheet" className="is-sheet" /></a><figcaption>contact sheet of this take (qc.py, 1 fps)</figcaption></figure> : null}
      </details>
      {live && t && !isApproved && !decided ? (
        <>
          {s.checks.length ? (
            <fieldset className="vprod__checks">
              <legend>Check each one by eye; a box you leave empty is recorded as not claimed</legend>
              {s.checks.map((c) => (
                <label key={c}><input type="checkbox" checked={ticked.includes(c)} onChange={(e) => setTicked(e.target.checked ? [...ticked, c] : ticked.filter((x) => x !== c))} /> {CHECK_WORDS[c] ?? c}</label>
              ))}
            </fieldset>
          ) : <p className="sr__hint">Look at the face, the hands, the mouth and the voice, the set and the light, and any text in the picture.</p>}
          <div className="sr__actions">
            <button type="button" className="pill pill--go" disabled={busy || !idOk} onClick={() => send("take.approve", { checks: ticked })}>Approve this take{pick ? ` (take ${s.takes.length - s.takes.findIndex((x) => x.file === pick)})` : ""}</button>
            {!rejecting ? <button type="button" className="pill" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button> : null}
            {!idOk && t.identity ? <ApproveAnyway gates={["the identity gate"]} busy={busy} onSend={(n) => send("take.approve", { checks: ticked, accept_fail: ["identity"] }, n)} /> : null}
            {!idOk ? <span className="rail__why is-bad">{t.identity ? "the identity gate did not pass: reject the take, or approve anyway with your note" : "the identity gate has not run"}</span> : null}
          </div>
          {rejecting ? (
            <div className="vprod__form vprod__form--col">
              <textarea className="note" rows={2} placeholder="What failed (it goes into the failure ledger)." value={what} onChange={(e) => setWhat(e.target.value)} aria-label="What failed" autoFocus />
              <textarea className="note" rows={1} placeholder="The fix, if you know it (optional)." value={fix} onChange={(e) => setFix(e.target.value)} aria-label="The fix" />
              <label className="vprod__again"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Generate it again ({usd(s.cost)} computed)</label>
              <span className="sr__actions">
                <button type="button" className="pill" disabled={busy || !what.trim()} onClick={() => send("take.reject", { decision: again ? "regenerate" : "reject", fix }, what).then((r) => { if (!r) { setRejecting(false); setWhat(""); setFix(""); } })}>Reject this take</button>
                <button type="button" className="rail__kill" onClick={() => setRejecting(false)}>cancel</button>
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      <Err e={err} />
    </div>
  );
}

const GATE_WORDS: Record<string, string> = {
  current: "the render is of the page, the assets and the story now",
  format: "1080x1920, 30 fps, the story's length",
  local_only: "only local files: no web address, no request out",
  assets: "every picture from the app, the plan or the world; none from a model",
  story_text: "every line of text is a string of the story: no invented words",
  text_read: "OCR reads each step's strings on its still",
  hero: "the hero string is on the hero element, and readable",
  page: "the page ran with no error",
};

/** A motion-designed screen (demo_source motion_design): the render, its gates, and gate B. The story is in the row's content. */
function MotionDesign({ post, s, m, live }: { post: string; s: Segment; m: Motion; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [eye, setEye] = useState<string[]>([]);
  const pending = m.click?.current && !m.click.recorded;
  const need = m.notRun.map((g) => (g === "text_read" ? "text" : g));
  /* What "Approve anyway" covers: the failed gates (never a stale render), and a gate not run that is not ticked. */
  const { stale, accept: anyway } = motionAccepts(m, eye);
  const run = (kind: "motion.approve" | "motion.reject", note?: string, accept?: string[]) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { segment: s.name, ...(kind === "motion.approve" ? { checks: eye, ...(accept?.length ? { accept_fail: accept } : {}) } : {}) } as any }).then((r) => { setErr(r); return r; });
  const gates = m.gates ? (
    <ul className="vprod__gates">{m.gates.map((g) => <li key={g.gate} className={g.result === "PASS" ? "is-ok" : g.result === "FAIL" ? "is-bad" : ""}><b>{g.result}</b> · {GATE_WORDS[g.gate] ?? g.gate}{g.detail ? ` — ${g.detail}` : ""}</li>)}</ul>
  ) : m.render ? <p className="sr__hint">The gates have not run on this render (motion_design.py check).</p> : null;
  const words = m.decision?.words ? <p className="vprod__words">Gate B ({m.decision.decision}): “{m.decision.words}”</p> : null;
  const status = m.approved ? "approved" : !m.render ? "not rendered yet" : !m.gates ? "gates not run" : m.failed.length ? "gates failed" : pending ? "clicked: being recorded" : "waiting for you";
  return (
    <div className="take">
      <p className="take__status"><span className={`vprod__tag${m.approved ? " is-done" : status === "waiting for you" ? " is-you" : ""}`}>motion design: {status}</span></p>
      {m.render ? (
        <figure><video src={frame(m.render.url)} controls playsInline preload="metadata" muted aria-label={`Motion design of ${s.name}`} /><figcaption className="tabular">the render · {m.seconds} s · {stamp(m.render.at)}{m.approved ? " · approved" : ""}</figcaption></figure>
      ) : <Quiet>Not rendered yet: the agent writes the page from the app&apos;s real screens, then renders and checks it.</Quiet>}
      <p className="sr__hint">{m.fit === "screen" ? "It is laid into the phone or the panel like a recording; a drawn screen in a filmed hand can look pasted on, so check the composite closely." : "It fills the frame, so it looks more like a promotion than a hand holding a phone."}</p>
      {/* The gates and the decision's words stay in view while the decision is open; closed, they fold. */}
      {!m.approved ? gates : null}
      {!m.approved ? words : null}
      <details className="vprod__older">
        <summary>How it was made: the screens, the stills{m.approved ? ", the gates" : ""}</summary>
        {m.reason ? <p className="vprod__words">Why not a real recording: <em>{m.reason}</em></p> : null}
        <p className="sr__hint">Screens: {m.screens.join(", ") || "none named"} · rebuilt from {m.rebuiltFrom.join("; ") || "nothing named"} · fit {m.fit} · {m.seconds} s{m.hero ? ` · hero “${m.hero}”` : ""}</p>
        {m.stills.length ? <div className="take__beside">{m.stills.map((x, i) => <figure key={x.url} className="is-small"><img src={x.url} alt={`Step ${i + 1}`} /><figcaption className="tabular">step {i + 1} · {x.at.toFixed(1)} s</figcaption></figure>)}</div> : null}
        {m.approved ? gates : null}
        {m.approved ? words : null}
      </details>
      <ClickLine c={m.click} what={`the motion design of ${s.name}`} />
      {live && m.render && m.gates && !m.approved && !pending ? (
        <>
          {need.length ? (
            <fieldset className="vprod__checks">
              <legend>No OCR engine ran: read the stills yourself (a box you leave empty is recorded as not claimed)</legend>
              {need.map((c) => <label key={c}><input type="checkbox" checked={eye.includes(c)} onChange={(e) => setEye(e.target.checked ? [...eye, c] : eye.filter((x) => x !== c))} /> {c === "text" ? "every step shows its strings, readable" : "the hero string is readable"}</label>)}
            </fieldset>
          ) : null}
          <div className="sr__actions">
            <button type="button" className="pill pill--go" disabled={busy || !!m.failed.length} onClick={() => run("motion.approve")}>Approve this motion design</button>
            <SendBack label="Reject…" busy={busy} placeholder="What is wrong: a screen, a word, the timing." onSend={(n) => run("motion.reject", n)} />
            {anyway.length ? <ApproveAnyway gates={anyway} busy={busy} onSend={(n) => run("motion.approve", n, anyway)} /> : null}
            {m.failed.length ? <span className="rail__why">{stale ? "the render is stale, of the wrong format or had a page error: the agent renders and checks again" : `failed gates: ${m.failed.join(", ")}`}</span> : null}
          </div>
        </>
      ) : null}
      <Err e={err} />
    </div>
  );
}

/** A supplied file at gate B: the exact range, Approve / Reject. In the row of its part, or in a row of its own. */
export function SourceReview({ post, x, live }: { post: string; x: Source; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const pending = x.click?.current && !x.click.recorded;
  const run = (kind: "source.approve" | "source.reject", note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { asset_id: x.id } }).then((r) => { setErr(r); return r; });
  return (
    <div className="take">
      <p className="take__status"><span className={`vprod__tag${x.approved ? " is-done" : x.sha256 && !pending ? " is-you" : ""}`}>{x.approved ? "approved" : !x.sha256 ? "file not on disk" : pending ? "clicked: being recorded" : "waiting for you"}</span></p>
      {x.url ? (
        <figure>{x.kind === "still" ? <img src={x.url} alt={x.id} /> : x.kind === "audio" ? <audio src={x.url} controls preload="metadata" /> : <video src={at(x.url, x.range?.[0])} controls playsInline preload="metadata" aria-label={x.id} />}
          <figcaption className="tabular">{x.id} · supplied {x.kind ?? "file"}{x.origin ? ` · ${x.origin}` : ""}{x.range ? ` · range ${x.range.join("–")} s` : ""} · used by {x.segments.join(", ")}</figcaption></figure>
      ) : <Quiet>{x.file ? `${x.file}: not served to the Atlas (put supplied files in pipeline/character/<video>/supplied/).` : "No file in the plan."}</Quiet>}
      {x.decision?.words ? <p className="vprod__words">Gate B ({x.decision.decision}): “{x.decision.words}”</p> : null}
      {!x.approved ? <p className="sr__hint">Look at the exact range. The agent checks the checksum, the permission and the range when it records your click.</p> : null}
      <ClickLine c={x.click} what={`the source ${x.id}`} />
      {live && x.sha256 && !x.approved && !pending ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy} onClick={() => run("source.approve")}>Approve this source</button>
          <SendBack label="Reject…" busy={busy} placeholder="What is wrong with this file or its range." onSend={(n) => run("source.reject", n)} />
        </div>
      ) : null}
      <Err e={err} />
    </div>
  );
}

/** A narrator's take at gate B: the natural-voice check, Approve / Reject. In a row of its own. */
export function NarrationReview({ post, x, live }: { post: string; x: Narration; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [natural, setNatural] = useState(false);
  const pending = x.click?.current && !x.click.recorded;
  const run = (kind: "narration.approve" | "narration.reject", note?: string, accept?: string[]) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { take: x.take, ...(kind === "narration.approve" ? { checks: natural ? ["natural_voice"] : [], ...(accept?.length ? { accept_fail: accept } : {}) } : {}) } as any }).then((r) => { setErr(r); return r; });
  return (
    <div className="take">
      <p className="take__status"><span className={`vprod__tag${x.approved ? " is-done" : x.sha256 && !pending ? " is-you" : ""}`}>{x.approved ? "approved" : !x.sha256 ? `no narration/${x.take}.wav yet` : pending ? "clicked: being recorded" : "waiting for you"}</span></p>
      {x.url ? <audio src={x.url} controls preload="metadata" className="vprod__audio" /> : <Quiet>The kit makes no voice: the take is put in pipeline/character/&lt;video&gt;/narration/ from the approved narrator voice.</Quiet>}
      {x.decision?.words ? <p className="vprod__words">Gate B ({x.decision.decision}): “{x.decision.words}”</p> : null}
      <ClickLine c={x.click} what={`the narration take ${x.take}`} />
      {live && x.sha256 && !x.approved && !pending ? (
        <>
          <fieldset className="vprod__checks">
            <legend>The natural-voice check (left empty, it is recorded as not claimed)</legend>
            <label><input type="checkbox" checked={natural} onChange={(e) => setNatural(e.target.checked)} /> natural breaths, varied pauses, room sound, no flat text-to-speech cadence</label>
          </fieldset>
          <div className="sr__actions">
            <button type="button" className="pill pill--go" disabled={busy || !x.lines.length} onClick={() => run("narration.approve")}>Approve this take</button>
            <SendBack label="Reject…" busy={busy} placeholder="What is wrong with this take." onSend={(n) => run("narration.reject", n)} />
            {!x.lines.length ? <span className="rail__why">no voiceover line of the plan uses this take</span> : null}
          </div>
        </>
      ) : null}
      <Err e={err} />
    </div>
  );
}

/* ----------------------------------------------------------- stage 5: composite */

function CompositeMedia({ post, seg: s, live }: MediaProps & { seg: Segment }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  if (!s.phone) {
    if (s.generated && s.approved) return <figure className="is-dim"><video src={frame(s.approved.url)} controls playsInline preload="metadata" muted aria-label={`The approved take of ${s.name}`} /><figcaption>The approved take. Nothing to composite: no app in this shot.</figcaption></figure>;
    return <Quiet>Nothing to composite here: {s.generated ? "no app in this shot" : laidIn(s)}.</Quiet>;
  }
  const c = s.composite;
  const pending = s.compositeClick?.current && s.compositeClick.kind === "composite.approve" && !s.compositeClick.recorded;
  const back = s.compositeClick?.current && s.compositeClick.kind === "composite.sendback";
  const status = s.compositeApproved ? "approved" : !s.approved ? "the plate is approved at the review first" : !c ? "not made yet (composite.sh)" : pending ? "clicked: being recorded" : back ? "sent back" : "waiting for you";
  return (
    <div className="take">
      <p className="take__status"><span className={`vprod__tag${s.compositeApproved ? " is-done" : status === "waiting for you" ? " is-you" : ""}`}>{status}</span></p>
      {c ? <figure><video src={frame(c.url)} controls playsInline preload="metadata" aria-label={`Composite of ${s.name}`} /><figcaption className="tabular">The composite: the app in the phone · gates {c.gates}</figcaption></figure> : null}
      {s.approved ? <figure className={c ? "is-small" : ""}><video src={frame(s.approved.url)} controls playsInline preload="metadata" muted aria-label="The approved plate" /><figcaption>the approved take: the plate the app is put into</figcaption></figure> : <Quiet>No plate yet: the take is approved at the review first.</Quiet>}
      {c?.sheets.length ? (
        <details className="vprod__older">
          <summary>The contact sheets ({c.sheets.length})</summary>
          {c.sheets.map((x) => <figure key={x.url} className="is-wide"><a href={x.url} target="_blank" rel="noreferrer"><img src={x.url} alt={x.label} className="is-sheet" /></a><figcaption>{x.label}</figcaption></figure>)}
        </details>
      ) : null}
      <ClickLine c={s.compositeClick} what={`the composite of ${s.name}`} />
      {live && c && !s.compositeApproved && !pending && !back ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy} onClick={() => decide({ post, kind: "composite.approve", data: { segment: s.name } }).then(setErr)}>Approve composite</button>
          <SendBack label="Send back…" busy={busy} placeholder="What is wrong: the grade, a corner, a tap out of time." onSend={(n) => decide({ post, kind: "composite.sendback", note: n, data: { segment: s.name } }).then((r) => { setErr(r); return r; })} />
          {c.failed.length ? <span className="rail__why is-bad">gates failed: {c.failed.join(", ")}</span> : null}
        </div>
      ) : null}
      <Err e={err} />
    </div>
  );
}

/* --------------------------------------------------------- stages 6 and 7: the cut */

/** Jump the page's one player (the cut, the delivered file) to a time. */
function playFrom(t: number) {
  const el = document.querySelector<HTMLVideoElement>("video[data-cut-player]");
  if (!el) return;
  el.currentTime = t;
  void el.play().catch(() => undefined);
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function CutMedia({ c, seg: s, p }: MediaProps & { seg: Segment }) {
  const t = p?.assembly?.times[s.name]?.[0] ?? c.start;
  const clip = s.compositeApproved && s.composite ? { url: s.composite.url, words: "The approved composite, as it is in the cut." }
    : s.approved ? { url: s.approved.url, words: `${takeNo(s, s.approved.file)}, approved, as it is in the cut.` }
    : s.motion?.render && s.motion.approved ? { url: s.motion.render.url, words: "The approved motion design, as it is in the cut." }
    : null;
  return (
    <>
      {clip ? <figure className="is-dim"><video src={frame(clip.url)} controls playsInline preload="metadata" muted aria-label={`The clip of ${s.name}`} /><figcaption>{clip.words}</figcaption></figure>
        : <Quiet>{s.generated ? "No approved take yet." : `In the cut: ${laidIn(s)}.`}</Quiet>}
      {p?.assembly || !p ? <p className="row__play"><button type="button" className="rail__kill" onClick={() => playFrom(t ?? c.start)}>Play the cut from {secs(t ?? c.start)} s</button></p> : null}
    </>
  );
}

/** The top row of the cut stage: the cut (or the delivered file), the checks that gate the approval, the hint. */
export function CutRow({ p, final, grain }: { p: Production; final: { url: string; duration: number | null; delivered: string | null } | null; grain?: boolean }) {
  const a = p.assembly;
  const done = p.gateC?.decision === "approve" && p.gateC.current;
  if (final) {
    return (
      <div className="cut">
        <video className="cut__video" src={final.url} controls playsInline preload="metadata" aria-label="The delivered video" data-cut-player="" />
        <p className="sr__hint">Delivered{final.delivered ? ` ${final.delivered.slice(0, 10)}` : ""}{final.duration ? ` · ${secs(final.duration)} s` : ""}. Every part below plays from its time in this file.</p>
      </div>
    );
  }
  if (!a) return <Quiet>The cut is assembled once every segment is approved.</Quiet>;
  return (
    <div className="cut">
      <video className="cut__video" src={grain && a.grain ? a.grain : a.url} controls playsInline preload="metadata" aria-label="The assembled cut" data-cut-player="" />
      <div className="cut__side">
        <p className="sr__hint tabular">The cut{a.duration ? ` · ${a.duration.toFixed(1)} s` : ""}{a.stale ? " · assembled from another revision of the plan" : ""}. Every part below plays from its time in this file.</p>
        {p.gateC?.words && !done ? <p className="vprod__words">Gate C ({p.gateC.decision}): “{p.gateC.words}”{p.gateC.date ? ` (${p.gateC.date})` : ""}</p> : null}
        {/* The checks gate the approval, so they stay in view until it is given; then they are in Details. */}
        {a.checks.length && !done ? (
          <ul className="vprod__checklist">{a.checks.map((c) => <li key={c.name} className={c.result === "FAIL" ? "is-bad" : ""}><b>{c.name}</b> {c.result || "—"}{c.detail ? ` · ${c.detail}` : ""}</li>)}</ul>
        ) : null}
        {!done ? <p className="sr__hint">Watch it whole: the hero element and every overlay readable, the sound level, each cut, no green, no frame shown twice at a continuous cut.</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the bar's buttons */

/** The decision bar's buttons for the stages whose decision is one for the whole video: the storyboard (gate A) and the cut (gate C). */
export function BarActions({ stage, post, p, live }: { stage: number; post: string; p: Production; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [grain, setGrain] = useState(false);
  const [regen, setRegen] = useState<string>("");
  const [why, setWhy] = useState("");
  const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
  if (stage === 2) {
    const done = !own.length || (p.gateA?.decision === "approve" && p.gateA.current);
    const run = (kind: "storyboard.approve" | "storyboard.sendback", note?: string) =>
      decide({ post, kind, ...(note ? { note } : {}), data: {} as any }).then((r) => { setErr(r); return r; });
    return (
      <div className="bar__act">
        {live && own.length && !done ? (
          <>
            <button type="button" className="btn" disabled={busy || own.some((s) => s.needsKeyframe && !s.keyframe)} onClick={() => run("storyboard.approve")}>Approve storyboard and {usd(p.cost)}</button>
            <SendBack label="Send back…" busy={busy} onSend={(n) => run("storyboard.sendback", n)} />
          </>
        ) : null}
        <ClickLine c={p.gateAClick} what="the storyboard" />
        <Err e={err} />
      </div>
    );
  }
  if (stage === 6) {
    const a = p.assembly;
    const done = p.gateC?.decision === "approve" && p.gateC.current;
    const pending = p.cutClick?.current && !p.cutClick.recorded;
    const open = own.filter((s) => !s.approved).map((s) => s.name);
    const rs = own.find((s) => s.name === regen) ?? null;
    /* review.py final: a changed supplied file always blocks; a failed overlay check may be approved anyway with a note. */
    const { blocked: supplied, overlays } = cutAccepts(a?.failed ?? []);
    return (
      <div className="bar__act bar__act--col">
        {live && a && !done && !pending ? (
          <>
            <div className="sr__actions">
              {a.grain ? <label className="vprod__again"><input type="checkbox" checked={grain} onChange={(e) => { setGrain(e.target.checked); const el = document.querySelector<HTMLVideoElement>("video[data-cut-player]"); if (el) { el.src = e.target.checked ? a.grain! : a.url; el.load(); } }} /> deliver the grain export (the player switches to it)</label> : null}
              <button type="button" className="btn" disabled={busy || a.stale || open.length > 0 || supplied.length > 0 || overlays.length > 0} onClick={() => decide({ post, kind: "cut.approve", data: { export: grain ? "grain" : "default" } }).then(setErr)}>Approve the cut</button>
              {overlays.length && !supplied.length && !a.stale && !open.length ? <ApproveAnyway gates={overlays} busy={busy} onSend={(n) => decide({ post, kind: "cut.approve", note: n, data: { export: grain ? "grain" : "default", accept_fail: ["overlays"] } as any }).then((r) => { setErr(r); return r; })} /> : null}
              <SendBack label="Send back…" busy={busy} onSend={(n) => decide({ post, kind: "cut.sendback", note: n, data: {} }).then((r) => { setErr(r); return r; })} />
              {own.length ? (
                <label className="vprod__again">Regenerate one segment:{" "}
                  <select value={regen} onChange={(e) => setRegen(e.target.value)} aria-label="The segment to regenerate">
                    <option value="">choose…</option>
                    {own.map((s) => <option key={s.name} value={s.name}>{s.name} ({usd(s.cost)})</option>)}
                  </select>
                </label>
              ) : null}
            </div>
            {open.length ? <span className="rail__why">not every segment is approved: {open.join(", ")}</span> : null}
            {supplied.length ? <span className="rail__why is-bad">the cut is not the plan&apos;s: {supplied.join(", ")}</span> : overlays.length ? <span className="rail__why is-bad">failed on the cut: {overlays.join(", ")}</span> : null}
            {rs ? (
              <div className="vprod__form vprod__form--col">
                <textarea className="note" rows={2} placeholder={`What failed in ${rs.name}.`} value={why} onChange={(e) => setWhy(e.target.value)} aria-label="What failed" />
                <span className="sr__actions">
                  <button type="button" className="pill" disabled={busy || !why.trim()} onClick={() => decide({ post, kind: "cut.sendback", note: why, data: { segment: rs.name } }).then((r) => { setErr(r); if (!r) { setRegen(""); setWhy(""); } })}>Regenerate {rs.name} ({usd(rs.cost)})</button>
                  <button type="button" className="rail__kill" onClick={() => setRegen("")}>cancel</button>
                </span>
                <p className="sr__hint">This is your yes to one more run of {rs.name} at {usd(rs.cost)}; the segment goes back to the review.</p>
              </div>
            ) : null}
          </>
        ) : null}
        <ClickLine c={p.cutClick} what={p.cutClick?.segment ? `the cut (regenerate ${p.cutClick.segment})` : "the cut"} />
        <Err e={err} />
      </div>
    );
  }
  return null;
}
