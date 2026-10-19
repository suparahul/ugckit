"use client";

/**
 * The stage panels of a locked video (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 5 and
 * § 6): shots and keyframes (gate A), generate and review takes (gate B, with the supplied
 * sources and the narration takes), composite, and the cut (gate C). One segment card for
 * every segment type; its data decides which panels it shows. Each control posts one line
 * to the log, as the slide actions do; the agent records the line (review.py ...
 * --from-atlas) and runs the next step. The Atlas never generates and never spends:
 * approving the storyboard, asking for a take again, or regenerating a segment from the cut
 * is the user's yes to the computed cost the agent then spends.
 */

import { useState } from "react";

import type { Click, Narration, Production, Segment, Source, Take } from "@/lib/video-production";
import { useDecide } from "./Actions";

const usd = (n: number | null) => (n === null ? "cost unknown" : `$${n.toFixed(2)}`);
const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
const base = (f: string) => f.replace(/^.*\//, "");
const at = (url: string, t: number | null | undefined) => (t ? `${url.split("#")[0]}#t=${t.toFixed(2)}` : url);

const CHECK_WORDS: Record<string, string> = {
  identity: "the face is the character's in every frame",
  no_source_identity: "nothing of the original creator: no face, hair, mark, handle or caption",
  silent: "no voice; no mouth that forms words",
  hands: "the hands are whole",
  performance: "the reaction follows the written expression beats at their times",
  follows_reference: "the reaction follows the clip's beats in order and time",
};
const ROUTE_WORDS: Record<string, string> = {
  motion: "face replace, motion route (Kling 3.0 Pro Motion Control)",
  replace: "face replace, replace route (Wan 2.2 Animate replace, the backup)",
  animate: "face replace, animate route (Wan 2.2 Animate move)",
  guided: "face replace, guided route (MiniMax H3, untested)",
};
/* What a type is, in words, for a segment that is not generated. */
const BUILT: Record<string, string> = { C: "supplied media", M: "panels", R: "the screen recording", P: "the screen recording, picture in picture" };

function ClickLine({ c, what }: { c: Click | null; what: string }) {
  if (!c) return null;
  const word = c.kind.endsWith(".approve") ? "approved" : c.kind.endsWith(".reject") ? "rejected" : "sent back";
  return (
    <p className="vprod__click">
      You {word} {what} in the Atlas {stamp(c.at)}{c.note ? <> — <em>“{c.note}”</em></> : null}.{" "}
      {!c.current ? "The file changed since: decide again." : c.recorded ? "Recorded." : "The agent records it next (review.py --from-atlas)."}
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

function Err({ e }: { e: string | null }) {
  return e ? <p className="rail__err" role="alert">{e}</p> : null;
}

/* ------------------------------------------------------------ stage 3: gate A */

export function StoryboardPanel({ post, p, live, seg }: { post: string; p: Production; live: boolean; seg: string | null }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
  const done = !own.length || (p.gateA?.decision === "approve" && p.gateA.current);
  const run = (kind: "storyboard.approve" | "storyboard.sendback", note?: string, segments?: string[]) =>
    decide({ post, kind, ...(note ? { note } : {}), data: (segments ? { segments } : {}) as any }).then((r) => { setErr(r); return r; });
  const shown = seg ? p.segments.filter((s) => s.name === seg) : p.segments;
  return (
    <section className="vprod__stage" aria-label="Shots and keyframes, gate A">
      <h3 className="vprod__h">Shots and keyframes <small>gate A · character-shots</small>
        <span className={`vprod__tag${done ? " is-done" : ""}`}>{done ? "approved" : p.gateA?.decision && p.gateA.decision !== "approve" ? p.gateA.decision : p.gateA?.decision === "approve" ? "keyframe changed since" : "not approved"}</span>
      </h3>
      {p.gateA?.words ? <p className="vprod__words">Gate A: “{p.gateA.words}”{p.gateA.date ? ` (${p.gateA.date})` : ""}</p> : null}
      {p.storyboard && !seg ? <a href={p.storyboard.url} target="_blank" rel="noreferrer"><img className="vprod__board" src={p.storyboard.url} alt="The storyboard" /></a> : null}
      <ul className="vprod__cards">
        {shown.map((s) => (
          <li key={s.name} className="vprod__card">
            <p className="vprod__segh tabular"><b>{s.name}</b> · {s.type}{s.faceReplace ? ` · ${ROUTE_WORDS[s.faceReplace.route] ?? s.faceReplace.route}` : ""}{s.generated ? ` · ${usd(s.cost)} a run` : ""}</p>
            <ShotFacts s={s} />
            <div className="vprod__media">
              {s.keyframe ? <figure><a href={s.keyframe.url} target="_blank" rel="noreferrer"><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /></a><figcaption>keyframe</figcaption></figure>
                : <span className="vprod__nokey">{!s.generated ? `no keyframe: ${BUILT[s.type] ?? s.type}${s.asset ? ` ${s.asset.id}` : s.screen ? ` ${s.screen.id}` : s.panels.length ? ` (${s.panels.length})` : ""}` : s.needsKeyframe ? "no keyframe yet" : "no keyframe: the clip leads"}</span>}
              {s.endStill ? <figure><img src={s.endStill} alt={`End still ${s.name}`} /><figcaption>end still</figcaption></figure> : null}
              {s.poseFrame ? <figure><img src={s.poseFrame} alt={`Pose picture ${s.name}`} /><figcaption>the pose picture (the clip&apos;s first frame)</figcaption></figure> : null}
            </div>
            {s.continues ? <p className="vprod__words">Opens on the last frame of {s.continues}, taken at its gate B.</p> : null}
            {live && s.generated && s.needsKeyframe && s.keyframe && !s.sharedFrom ? <SendBack label="Redo this keyframe…" busy={busy} placeholder="What to change in this keyframe." onSend={(n) => run("storyboard.sendback", n, [s.name])} /> : null}
          </li>
        ))}
      </ul>
      {own.length ? <p className="vprod__cost tabular">First runs: {usd(p.cost)} computed (list price × seconds, as generate.sh quotes it){p.spent ? ` · spent so far ${usd(p.spent)}` : ""}</p> : <p className="sr__hint">No generated segment: nothing to approve at gate A.</p>}
      <ClickLine c={p.gateAClick} what="the storyboard" />
      {live && own.length && !done ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy || own.some((s) => s.needsKeyframe && !s.keyframe)} onClick={() => run("storyboard.approve")}>Approve storyboard and {usd(p.cost)}</button>
          <SendBack label="Send back…" busy={busy} onSend={(n) => run("storyboard.sendback", n)} />
        </div>
      ) : null}
      <Err e={err} />
    </section>
  );
}

/** The shot in words: framing, planned length, the words it speaks, its references and subjects. */
function ShotFacts({ s }: { s: Segment }) {
  const bits = [
    s.start !== null && s.end !== null ? `${s.start.toFixed(1)}–${s.end.toFixed(1)} s in the plan` : null,
    s.framing ? `framing ${s.framing}` : null,
    s.seconds ? `${s.seconds} s generated` : null,
    s.refCount ? `${s.refCount} reference${s.refCount === 1 ? "" : "s"}` : null,
    s.subjects.length ? `subjects ${s.subjects.join(", ")}` : null,
    s.expressionBeats ? `${s.expressionBeats} expression beat${s.expressionBeats === 1 ? "" : "s"}` : null,
    s.audioFrom ? `sound from ${s.audioFrom}` : null,
  ].filter(Boolean);
  return (
    <>
      {bits.length ? <p className="vprod__facts">{bits.join(" · ")}</p> : null}
      {s.lines.length ? <p className="vprod__said">{s.lines.map((l, i) => <span key={i}>“{l}” </span>)}</p> : null}
    </>
  );
}

/* --------------------------------------------------- stages 4 and 5: gate B */

/** The take in focus: the newest one nobody decided yet; else the approved one; else the newest. */
const focusOf = (s: Segment): Take | null =>
  s.takes.find((t) => t.file !== s.gateB?.file && !(s.click?.current && s.click.file === t.file)) ?? s.approved ?? s.takes[0] ?? null;

function SegmentCard({ post, s, p, live }: { post: string; s: Segment; p: Production; live: boolean }) {
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
  const idOk = !s.faceReplace || t?.identity?.result === "PASS";
  const status = s.sharedFrom ? `shared: decided on ${s.sharedFrom}`
    : !s.generated ? `${BUILT[s.type] ?? s.type}: built at assembly`
    : s.approved ? `approved: ${base(s.approved.file)}`
    : !s.takes.length ? "no take yet"
    : decided ? (s.click?.kind === "take.reject" || (s.gateB && s.gateB.decision !== "approve") ? "rejected: a new take comes next" : "approved in the Atlas")
    : "take waiting for you";
  const send = (kind: "take.approve" | "take.reject", extra: Record<string, unknown>, note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { segment: s.name, file: t!.file, ...extra } as any }).then((r) => { setErr(r); if (!r) setPick(null); return r; });
  const src = s.asset ? p.sources.find((x) => x.id === s.asset!.id) : null;
  const nar = s.audioFrom?.startsWith("narration:") ? p.narration.find((x) => x.take === s.audioFrom!.slice(10)) : null;
  return (
    <li className="vprod__seg" id={`seg-${s.name}`}>
      <p className="vprod__segh tabular">
        <b>{s.name}</b> · {s.type}{s.faceReplace ? ` · ${ROUTE_WORDS[s.faceReplace.route] ?? s.faceReplace.route}` : ""}{s.continues ? ` · continues ${s.continues}` : ""}{s.generated ? ` · ${usd(s.cost)} a run` : ""}
        <span className={`vprod__tag${s.approved ? " is-done" : status === "take waiting for you" ? " is-you" : ""}`}>{status}</span>
      </p>
      <ShotFacts s={s} />
      {s.gateB?.words ? <p className="vprod__words">Gate B ({s.gateB.decision}{s.gateB.file ? `, ${base(s.gateB.file)}` : ""}): “{s.gateB.words}”{s.gateB.failure ? ` · failed: ${s.gateB.failure}` : ""}</p> : null}

      {/* The take, beside what it is judged against. */}
      {t ? (
        <div className="vprod__media">
          <figure>
            <video src={t.url} controls playsInline preload="metadata" aria-label={`Take ${base(t.file)}`} />
            <figcaption className="tabular">{base(t.file)} · {stamp(t.at)}{isApproved ? " · approved" : ""}</figcaption>
          </figure>
          {s.faceReplace?.reference ? <figure><video src={s.faceReplace.reference} controls playsInline preload="metadata" muted aria-label="The reference clip" /><figcaption>the reference clip (the motion only)</figcaption></figure> : null}
          {s.poseFrame ? <figure><img src={s.poseFrame} alt="The pose picture" /><figcaption>the pose picture</figcaption></figure> : null}
          {s.keyframe ? <figure><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /><figcaption>the approved keyframe</figcaption></figure> : null}
          {s.seam ? (
            <figure>
              {s.seam.lastFrame ? <img src={s.seam.lastFrame} alt={`Last frame of ${s.seam.from}`} /> : <span className="vprod__nokey">no last frame of {s.seam.from} yet</span>}
              <figcaption>last frame of {s.seam.from}{s.seam.verified ? "" : " · UNVERIFIED"}</figcaption>
            </figure>
          ) : null}
          {t.sheet ? <figure className="is-wide"><a href={t.sheet} target="_blank" rel="noreferrer"><img src={t.sheet} alt="Contact sheet" className="is-sheet" /></a><figcaption>contact sheet of the newest take (qc.py, 1 fps)</figcaption></figure> : null}
        </div>
      ) : null}
      {s.seam ? <p className="vprod__words">Continuity seam: {s.seam.seedDiff !== null ? `the first frame differs from the last frame of ${s.seam.from} by ${s.seam.seedDiff} (0 to 255)` : `measured at gate B (review.py: checks.seed_diff)`}{s.seam.verified ? "" : "; the model's continuity input is not verified by a paid run yet"}.</p> : null}
      {t && s.faceReplace ? (
        <p className={`vprod__id${t.identity?.result === "PASS" ? " is-ok" : t.identity ? " is-bad" : ""}`}>
          Identity gate: {t.identity
            ? <>{t.identity.result}{t.identity.character !== null ? ` · median ${t.identity.character} to the character, ${t.identity.reference ?? "?"} to the reference` : ""}{t.identity.closer !== null ? ` · closer to the character in ${Math.round(t.identity.closer * 100)}% of frames` : ""}{t.identity.why ? ` · ${t.identity.why}` : ""}</>
            : "not run on this take yet (generate.sh runs identity.py after the download)"}
        </p>
      ) : null}
      {s.plateGates ? <p className={`vprod__id${s.plateGates === "pass" ? " is-ok" : " is-bad"}`}>Insertion gates of the plate (flat-on first): {s.plateGates}</p> : null}
      {s.type === "T" ? <p className="sr__hint">Check the words against the frozen script above, and the voice against the character&apos;s voice reference.</p> : null}
      {s.type === "B" ? <p className="sr__hint">The people rule: {s.framing === "subject_only" ? "no person in the picture" : s.framing === "hands_only" ? "hands only, no face" : "as the shot says"}; count the subjects{s.subjects.length ? ` (${s.subjects.join(", ")})` : ""}.</p> : null}

      {/* The types built at assembly. */}
      {s.type === "C" && s.asset ? <p className="vprod__words">Supplied {s.asset.id}{s.asset.range ? `, ${s.asset.range.join("–")} s` : s.asset.still !== null ? `, still at ${s.asset.still} s` : ""}: {src ? (src.approved ? "approved at gate B" : "its source card is below") : "not in the plan's assets"}.</p> : null}
      {s.type === "M" && s.panels.length ? (
        <div className="vprod__panels" aria-label="The panels in the frame">
          <div className="vprod__frame916">{s.panels.map((pn) => pn.rect && pn.rect.length === 4 ? <span key={pn.id} className="vprod__rect" style={{ left: `${pn.rect[0] * 100}%`, top: `${pn.rect[1] * 100}%`, width: `${pn.rect[2] * 100}%`, height: `${pn.rect[3] * 100}%` }}>{pn.id}</span> : null)}</div>
          <ul className="vprod__plist">{s.panels.map((pn) => <li key={pn.id}><b>{pn.id}</b> · {pn.what}{pn.url ? <> · <a href={pn.url} target="_blank" rel="noreferrer">open</a></> : " · not served"}</li>)}</ul>
        </div>
      ) : null}
      {s.screen ? (
        <div className="vprod__media">
          {s.screen.url ? <figure><video src={s.screen.url} controls playsInline preload="metadata" muted aria-label={`Screen ${s.screen.id}`} /><figcaption>screen {s.screen.id}{s.screen.hero ? ` · hero “${s.screen.hero}”` : ""}</figcaption></figure> : <p className="sr__hint">Screen {s.screen.id}: not in the screen library yet.</p>}
          <p className="sr__hint">Nothing to approve before the cut: the recording is checked at gate C.</p>
        </div>
      ) : null}
      {nar ? <p className="vprod__words">Narration under it: take {nar.take} ({nar.approved ? "approved" : "its card is below"}).</p> : null}

      {s.takes.length > 1 ? (
        <details className="vprod__older">
          <summary>{s.takes.length} takes: look at another one</summary>
          <ul>{s.takes.map((x, i) => (
            <li key={x.file} className="tabular">
              take {s.takes.length - i} · <a href={x.url} target="_blank" rel="noreferrer">{base(x.file)}</a> · {stamp(x.at)}{x.file === s.gateB?.file ? ` · ${s.gateB.decision}` : ""}{x.identity ? ` · identity ${x.identity.result}` : ""}{" "}
              {live && !s.sharedFrom && x.file !== t?.file ? <button type="button" className="rail__kill" onClick={() => { setPick(x.file); setTicked([]); }}>look at this take</button> : x.file === t?.file ? <em>in view</em> : null}
            </li>
          ))}</ul>
        </details>
      ) : null}
      <ClickLine c={s.click} what={`a take of ${s.name}`} />
      {live && t && s.generated && !s.sharedFrom && !isApproved && !decided ? (
        <>
          {s.checks.length ? (
            <fieldset className="vprod__checks">
              <legend>Before you approve, check each one by eye</legend>
              {s.checks.map((c) => (
                <label key={c}><input type="checkbox" checked={ticked.includes(c)} onChange={(e) => setTicked(e.target.checked ? [...ticked, c] : ticked.filter((x) => x !== c))} /> {CHECK_WORDS[c] ?? c}</label>
              ))}
            </fieldset>
          ) : <p className="sr__hint">Look at the face, the hands, the mouth and the voice, the set and the light, and any text in the picture.</p>}
          <div className="sr__actions">
            <button type="button" className="pill pill--go" disabled={busy || !idOk || s.checks.some((c) => !ticked.includes(c))} onClick={() => send("take.approve", { checks: ticked })}>Approve this take{pick ? ` (take ${s.takes.length - s.takes.findIndex((x) => x.file === pick)})` : ""}</button>
            {!rejecting ? <button type="button" className="pill" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button> : null}
            {!idOk ? <span className="rail__why is-bad">{t.identity ? "the identity gate did not pass: tell the agent in words if you accept it" : "the identity gate has not run"}</span> : null}
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
    </li>
  );
}

function SourceCard({ post, x, live }: { post: string; x: Source; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const pending = x.click?.current && !x.click.recorded;
  const run = (kind: "source.approve" | "source.reject", note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { asset_id: x.id } }).then((r) => { setErr(r); return r; });
  return (
    <li className="vprod__seg">
      <p className="vprod__segh tabular"><b>{x.id}</b> · supplied {x.kind ?? "file"}{x.origin ? ` · ${x.origin}` : ""} · used by {x.segments.join(", ")}
        <span className={`vprod__tag${x.approved ? " is-done" : x.sha256 && !pending ? " is-you" : ""}`}>{x.approved ? "approved" : !x.sha256 ? "file not on disk" : pending ? "clicked: being recorded" : "waiting for you"}</span>
      </p>
      {x.url ? (
        <div className="vprod__media">
          <figure>{x.kind === "still" ? <img src={x.url} alt={x.id} /> : x.kind === "audio" ? <audio src={x.url} controls preload="metadata" /> : <video src={at(x.url, x.range?.[0])} controls playsInline preload="metadata" aria-label={x.id} />}
            <figcaption className="tabular">{x.file}{x.range ? ` · range ${x.range.join("–")} s` : ""}{x.sha256 ? ` · sha256 ${x.sha256.slice(0, 12)}` : ""}</figcaption></figure>
        </div>
      ) : <p className="sr__hint">{x.file ? `${x.file}: not served to the Atlas (put supplied files in pipeline/character/<video>/supplied/).` : "No file in the plan."}</p>}
      {x.decision?.words ? <p className="vprod__words">Gate B ({x.decision.decision}): “{x.decision.words}”</p> : null}
      <p className="sr__hint">Look at the exact range. The agent checks the checksum, the permission and the range when it records your click (review.py source).</p>
      <ClickLine c={x.click} what={`the source ${x.id}`} />
      {live && x.sha256 && !x.approved && !pending ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy} onClick={() => run("source.approve")}>Approve this source</button>
          <SendBack label="Reject…" busy={busy} placeholder="What is wrong with this file or its range." onSend={(n) => run("source.reject", n)} />
        </div>
      ) : null}
      <Err e={err} />
    </li>
  );
}

function NarrationCard({ post, x, live }: { post: string; x: Narration; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [natural, setNatural] = useState(false);
  const pending = x.click?.current && !x.click.recorded;
  const run = (kind: "narration.approve" | "narration.reject", note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { take: x.take, ...(kind === "narration.approve" ? { checks: natural ? ["natural_voice"] : [] } : {}) } as any }).then((r) => { setErr(r); return r; });
  return (
    <li className="vprod__seg">
      <p className="vprod__segh tabular"><b>narration {x.take}</b>{x.narrator ? ` · ${x.narrator}` : ""} · under {x.segments.join(", ")}
        <span className={`vprod__tag${x.approved ? " is-done" : x.sha256 && !pending ? " is-you" : ""}`}>{x.approved ? "approved" : !x.sha256 ? `no narration/${x.take}.wav yet` : pending ? "clicked: being recorded" : "waiting for you"}</span>
      </p>
      {x.url ? <audio src={x.url} controls preload="metadata" className="vprod__audio" /> : <p className="sr__hint">The kit makes no voice: the take is put in pipeline/character/&lt;video&gt;/narration/ from the approved narrator voice.</p>}
      {x.words.length ? <p className="vprod__said">{x.words.map((w, i) => <span key={i}>“{w}” </span>)}</p> : null}
      {x.decision?.words ? <p className="vprod__words">Gate B ({x.decision.decision}): “{x.decision.words}”</p> : null}
      <ClickLine c={x.click} what={`the narration take ${x.take}`} />
      {live && x.sha256 && !x.approved && !pending ? (
        <>
          <fieldset className="vprod__checks">
            <legend>The natural-voice check</legend>
            <label><input type="checkbox" checked={natural} onChange={(e) => setNatural(e.target.checked)} /> natural breaths, varied pauses, room sound, no flat text-to-speech cadence</label>
          </fieldset>
          <div className="sr__actions">
            <button type="button" className="pill pill--go" disabled={busy || !natural || !x.lines.length} onClick={() => run("narration.approve")}>Approve this take</button>
            <SendBack label="Reject…" busy={busy} placeholder="What is wrong with this take." onSend={(n) => run("narration.reject", n)} />
            {!x.lines.length ? <span className="rail__why">no voiceover line of the plan uses this take</span> : null}
          </div>
        </>
      ) : null}
      <Err e={err} />
    </li>
  );
}

export function TakesPanel({ post, p, live, seg }: { post: string; p: Production; live: boolean; seg: string | null }) {
  const segs = seg ? p.segments.filter((s) => s.name === seg) : p.segments;
  return (
    <section className="vprod__stage" aria-label="Generate and review takes, gate B">
      <h3 className="vprod__h">Generate and review takes <small>gate B · character-generate, character-review</small>
        {p.spent ? <span className="vprod__tag tabular">spent so far {usd(p.spent)}</span> : null}
      </h3>
      {p.state?.stages.generate?.status === "running" ? <p className="vprod__words">Generating now: {p.state.stages.generate.note ?? "a run"} (state.json).</p> : null}
      {p.state?.stages.generate?.status === "failed" ? <p className="rail__why is-bad">The last run failed: {p.state.stages.generate.note ?? "no note"} (state.json).</p> : null}
      {segs.length ? <ol className="vprod__segs">{segs.map((s) => <SegmentCard key={s.name} post={post} s={s} p={p} live={live} />)}</ol>
        : <p className="sr__hint">video.json lists the segments once character-shots writes it.</p>}
      {!seg && p.sources.length ? (
        <>
          <h4 className="vprod__sub">Supplied sources</h4>
          <ol className="vprod__segs">{p.sources.map((x) => <SourceCard key={x.id} post={post} x={x} live={live} />)}</ol>
        </>
      ) : null}
      {!seg && p.narration.length ? (
        <>
          <h4 className="vprod__sub">Narration takes</h4>
          <ol className="vprod__segs">{p.narration.map((x) => <NarrationCard key={x.take} post={post} x={x} live={live} />)}</ol>
        </>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------- stage 6: composite */

function CompositeCard({ post, s, live }: { post: string; s: Segment; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const c = s.composite;
  const pending = s.compositeClick?.current && s.compositeClick.kind === "composite.approve" && !s.compositeClick.recorded;
  const back = s.compositeClick?.current && s.compositeClick.kind === "composite.sendback";
  return (
    <li className="vprod__seg">
      <p className="vprod__segh tabular"><b>{s.name}</b> · {s.type} · the app in the phone
        <span className={`vprod__tag${s.compositeApproved ? " is-done" : c && !pending && !back ? " is-you" : ""}`}>{s.compositeApproved ? "approved" : !s.approved ? "the plate is approved at gate B first" : !c ? "not made yet (composite.sh)" : pending ? "clicked: being recorded" : back ? "sent back" : "waiting for you"}</span>
      </p>
      <div className="vprod__media">
        {s.approved ? <figure><video src={s.approved.url} controls playsInline preload="metadata" muted aria-label="The approved plate" /><figcaption>the approved plate</figcaption></figure> : null}
        {c ? <figure><video src={c.url} controls playsInline preload="metadata" aria-label={`Composite of ${s.name}`} /><figcaption className="tabular">{base(c.file)} · gates {c.gates}</figcaption></figure> : null}
        {c?.sheets.map((x) => <figure key={x.url}><a href={x.url} target="_blank" rel="noreferrer"><img src={x.url} alt={x.label} className="is-sheet" /></a><figcaption>{x.label}</figcaption></figure>)}
      </div>
      <ClickLine c={s.compositeClick} what={`the composite of ${s.name}`} />
      {live && c && !s.compositeApproved && !pending && !back ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy} onClick={() => decide({ post, kind: "composite.approve", data: { segment: s.name } }).then(setErr)}>Approve composite</button>
          <SendBack label="Send back…" busy={busy} placeholder="What is wrong: the grade, a corner, a tap out of time." onSend={(n) => decide({ post, kind: "composite.sendback", note: n, data: { segment: s.name } }).then((r) => { setErr(r); return r; })} />
          {c.failed.length ? <span className="rail__why is-bad">gates failed: {c.failed.join(", ")}</span> : null}
        </div>
      ) : null}
      <Err e={err} />
    </li>
  );
}

export function CompositePanel({ post, p, live, seg }: { post: string; p: Production; live: boolean; seg: string | null }) {
  const phones = p.segments.filter((s) => s.phone && !s.sharedFrom && (!seg || s.name === seg));
  return (
    <section className="vprod__stage" aria-label="Composite">
      <h3 className="vprod__h">Composite <small>the app in the phone · character-composite</small></h3>
      {phones.length ? <ol className="vprod__segs">{phones.map((s) => <CompositeCard key={s.name} post={post} s={s} live={live} />)}</ol> : <p className="sr__hint">n/a: no app insertion in the plan.</p>}
    </section>
  );
}

/* ----------------------------------------------------------------- stage 7: the cut */

export function CutPanel({ post, p, live }: { post: string; p: Production; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [grain, setGrain] = useState(false);
  const [regen, setRegen] = useState<string>("");
  const [why, setWhy] = useState("");
  const a = p.assembly;
  const done = p.gateC?.decision === "approve" && p.gateC.current;
  const pending = p.cutClick?.current && !p.cutClick.recorded;
  const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
  const open = own.filter((s) => !s.approved).map((s) => s.name);
  const rs = own.find((s) => s.name === regen) ?? null;
  return (
    <section className="vprod__stage" aria-label="The cut, gate C">
      <h3 className="vprod__h">The cut <small>gate C · character-assemble, then character-deliver</small>
        <span className={`vprod__tag${done ? " is-done" : a && !pending ? " is-you" : ""}`}>{done ? "approved" : !a ? "not assembled yet" : a.stale ? "stale: assembled from another revision" : pending ? "clicked: being recorded" : "waiting for you"}</span>
      </h3>
      {p.gateC?.words ? <p className="vprod__words">Gate C ({p.gateC.decision}): “{p.gateC.words}”{p.gateC.date ? ` (${p.gateC.date})` : ""}</p> : null}
      {a ? (
        <div className="vprod__media">
          <figure className="is-wide">
            <video src={grain && a.grain ? a.grain : a.url} controls playsInline preload="metadata" aria-label="The assembled cut" />
            <figcaption className="tabular">{base(a.file)}{a.duration ? ` · ${a.duration.toFixed(1)} s` : ""} · sha256 {a.sha256.slice(0, 12)}</figcaption>
          </figure>
          {a.sheet ? <figure className="is-wide"><a href={a.sheet} target="_blank" rel="noreferrer"><img src={a.sheet} alt="Contact sheet of the cut" className="is-sheet" /></a><figcaption>contact sheet</figcaption></figure> : null}
        </div>
      ) : <p className="sr__hint">assemble.sh writes assembly/&lt;video&gt;.mp4 once every segment is approved.</p>}
      {a?.checks.length ? (
        <ul className="vprod__checklist">{a.checks.map((c) => <li key={c.name} className={c.result === "FAIL" ? "is-bad" : ""}><b>{c.name}</b> {c.result || "—"}{c.detail ? ` · ${c.detail}` : ""}</li>)}</ul>
      ) : null}
      {a ? <p className="sr__hint">Watch it whole: the hero element and every overlay readable, the sound level, each cut, no green, no frame shown twice at a continuous cut.</p> : null}
      <ClickLine c={p.cutClick} what={p.cutClick?.segment ? `the cut (regenerate ${p.cutClick.segment})` : "the cut"} />
      {live && a && !done && !pending ? (
        <>
          <div className="sr__actions">
            {a.grain ? <label className="vprod__again"><input type="checkbox" checked={grain} onChange={(e) => setGrain(e.target.checked)} /> deliver the grain export</label> : null}
            <button type="button" className="pill pill--go" disabled={busy || a.stale || open.length > 0} onClick={() => decide({ post, kind: "cut.approve", data: { export: grain ? "grain" : "default" } }).then(setErr)}>Approve the cut</button>
            {open.length ? <span className="rail__why">not every segment is approved: {open.join(", ")}</span> : null}
            <SendBack label="Send back…" busy={busy} onSend={(n) => decide({ post, kind: "cut.sendback", note: n, data: {} }).then((r) => { setErr(r); return r; })} />
          </div>
          {own.length ? (
            <div className="vprod__form vprod__form--col">
              <label className="vprod__again">Regenerate one segment:{" "}
                <select value={regen} onChange={(e) => setRegen(e.target.value)} aria-label="The segment to regenerate">
                  <option value="">choose…</option>
                  {own.map((s) => <option key={s.name} value={s.name}>{s.name} ({usd(s.cost)})</option>)}
                </select>
              </label>
              {rs ? (
                <>
                  <textarea className="note" rows={2} placeholder={`What failed in ${rs.name}.`} value={why} onChange={(e) => setWhy(e.target.value)} aria-label="What failed" />
                  <span className="sr__actions">
                    <button type="button" className="pill" disabled={busy || !why.trim()} onClick={() => decide({ post, kind: "cut.sendback", note: why, data: { segment: rs.name } }).then((r) => { setErr(r); if (!r) { setRegen(""); setWhy(""); } })}>Regenerate {rs.name} ({usd(rs.cost)})</button>
                  </span>
                  <p className="sr__hint">This is your yes to one more run of {rs.name} at {usd(rs.cost)}; the segment goes back to gate B.</p>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      <Err e={err} />
    </section>
  );
}
