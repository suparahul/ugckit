"use client";

/**
 * A locked video's production, under the frame: the storyboard (gate A), each
 * segment's takes (gate B), the composites of the phone segments, the cut (gate C).
 * Each control posts one line to the log, as the slide actions do; the agent records
 * the line in approval.json (review.py ... --from-atlas) and runs the next step. The
 * Atlas never generates and never spends: approving the storyboard, or asking for a
 * take again, is the user's yes to the computed cost the agent then spends.
 */

import { useState } from "react";

import type { Click, Production, Segment, Take } from "@/lib/video-production";
import { useDecide } from "./Actions";

const usd = (n: number | null) => (n === null ? "cost unknown" : `$${n.toFixed(2)}`);
const stamp = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
const base = (f: string) => f.replace(/^.*\//, "");

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

function ClickLine({ c, what }: { c: Click | null; what: string }) {
  if (!c) return null;
  const word = c.kind.endsWith(".approve") ? "approved" : c.kind === "take.reject" ? "rejected" : "sent back";
  return (
    <p className="vprod__click">
      You {word} {what} in the Atlas {stamp(c.at)}{c.note ? <> — <em>“{c.note}”</em></> : null}.{" "}
      {!c.current ? "The file changed since: decide again." : c.recorded ? "Recorded in approval.json." : "The agent records it next (review.py --from-atlas)."}
    </p>
  );
}

function SendBack({ label, busy, onSend }: { label: string; busy: boolean; onSend: (note: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open) return <button type="button" className="pill" disabled={busy} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span className="vprod__form">
      <textarea className="note" rows={2} placeholder="Say what to change." value={note} onChange={(e) => setNote(e.target.value)} aria-label={`Note: ${label}`} autoFocus />
      <button type="button" className="pill" disabled={busy || !note.trim()} onClick={() => onSend(note).then((r) => { if (!r) { setOpen(false); setNote(""); } })}>{label}</button>
      <button type="button" className="rail__kill" onClick={() => setOpen(false)}>cancel</button>
    </span>
  );
}

function Storyboard({ post, p, live }: { post: string; p: Production; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
  const done = !own.length || (p.gateA?.decision === "approve" && p.gateA.current);
  const run = (kind: "storyboard.approve" | "storyboard.sendback", note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: {} }).then((r) => { setErr(r); return r; });
  return (
    <section className="vprod__stage" aria-label="Storyboard, gate A">
      <h3 className="vprod__h"><span className="vprod__n">1</span> Storyboard <small>gate A · character-shots</small>
        <span className={`vprod__tag${done ? " is-done" : ""}`}>{done ? "approved" : p.gateA?.decision && p.gateA.decision !== "approve" ? p.gateA.decision : p.gateA?.decision === "approve" ? "keyframe changed since" : "not approved"}</span>
      </h3>
      {p.gateA?.words ? <p className="vprod__words">Gate A: “{p.gateA.words}”{p.gateA.date ? ` (${p.gateA.date})` : ""}</p> : null}
      {p.storyboard ? <a href={p.storyboard.url} target="_blank" rel="noreferrer"><img className="vprod__board" src={p.storyboard.url} alt="The storyboard" /></a> : null}
      {own.length ? (
        <ul className="vprod__keys">
          {own.map((s) => (
            <li key={s.name}>
              {s.keyframe ? <a href={s.keyframe.url} target="_blank" rel="noreferrer"><img src={s.keyframe.url} alt={`Keyframe ${s.name}`} /></a> : <span className="vprod__nokey">{s.needsKeyframe ? "no keyframe yet" : "no keyframe: the clip leads"}</span>}
              <span className="tabular">{s.name} · {usd(s.cost)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="sr__hint">No generated segment: nothing to approve at gate A.</p>}
      {own.length ? <p className="vprod__cost tabular">First runs: {usd(p.cost)} computed (list price × seconds, as generate.sh quotes it){p.spent ? ` · spent so far ${usd(p.spent)}` : ""}</p> : null}
      <ClickLine c={p.gateAClick} what="the storyboard" />
      {live && own.length && !done ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy || own.some((s) => s.needsKeyframe && !s.keyframe)} onClick={() => run("storyboard.approve")}>Approve storyboard and {usd(p.cost)}</button>
          <SendBack label="Send back" busy={busy} onSend={(n) => run("storyboard.sendback", n)} />
        </div>
      ) : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </section>
  );
}

/** The take in focus: the newest one nobody decided yet; else the approved one; else the newest. */
const focusOf = (s: Segment): Take | null =>
  s.takes.find((t) => t.file !== s.gateB?.file && !(s.click?.current && s.click.file === t.file)) ?? s.approved ?? s.takes[0] ?? null;

function TakeCard({ post, s, live }: { post: string; s: Segment; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [what, setWhat] = useState("");
  const [fix, setFix] = useState("");
  const [again, setAgain] = useState(true);
  const t = focusOf(s);
  const decided = t && (t.file === s.gateB?.file || (s.click?.current && s.click.file === t.file));
  const idOk = !s.faceReplace || t?.identity?.result === "PASS";
  const status = s.sharedFrom ? `shared: decided on ${s.sharedFrom}`
    : s.approved ? `approved: ${base(s.approved.file)}`
    : !s.takes.length ? "no take yet"
    : decided ? (s.click?.kind === "take.reject" || (s.gateB && s.gateB.decision !== "approve") ? "rejected: a new take comes next" : "approved in the Atlas")
    : "take waiting for you";
  const done = !!s.approved;
  const send = (kind: "take.approve" | "take.reject", extra: Record<string, unknown>, note?: string) =>
    decide({ post, kind, ...(note ? { note } : {}), data: { segment: s.name, file: t!.file, ...extra } as any }).then((r) => { setErr(r); return r; });
  return (
    <li className="vprod__seg">
      <p className="vprod__segh tabular">
        <b>{s.name}</b> · {s.type}{s.faceReplace ? ` · ${ROUTE_WORDS[s.faceReplace.route] ?? s.faceReplace.route}` : ""}{s.continues ? ` · continues ${s.continues}` : ""} · {usd(s.cost)} a run
        <span className={`vprod__tag${done ? " is-done" : status === "take waiting for you" ? " is-you" : ""}`}>{status}</span>
      </p>
      {s.gateB?.words ? <p className="vprod__words">Gate B ({s.gateB.decision}{s.gateB.file ? `, ${base(s.gateB.file)}` : ""}): “{s.gateB.words}”{s.gateB.failure ? ` · failed: ${s.gateB.failure}` : ""}</p> : null}
      {t ? (
        <div className="vprod__media">
          <figure>
            <video src={t.url} controls playsInline preload="metadata" aria-label={`Take ${base(t.file)}`} />
            <figcaption className="tabular">{base(t.file)} · {stamp(t.at)}</figcaption>
          </figure>
          {s.faceReplace?.reference ? (
            <figure>
              <video src={s.faceReplace.reference} controls playsInline preload="metadata" muted aria-label="The reference clip" />
              <figcaption>the reference clip (the motion only)</figcaption>
            </figure>
          ) : null}
          {s.keyframe ? (
            <figure>
              <img src={s.keyframe.url} alt={`Keyframe ${s.name}`} />
              <figcaption>the approved keyframe</figcaption>
            </figure>
          ) : null}
        </div>
      ) : null}
      {t && s.faceReplace ? (
        <p className={`vprod__id${t.identity?.result === "PASS" ? " is-ok" : t.identity ? " is-bad" : ""}`}>
          Identity gate: {t.identity
            ? <>{t.identity.result}{t.identity.character !== null ? ` · median ${t.identity.character} to the character, ${t.identity.reference ?? "?"} to the reference` : ""}{t.identity.closer !== null ? ` · closer to the character in ${Math.round(t.identity.closer * 100)}% of frames` : ""}{t.identity.why ? ` · ${t.identity.why}` : ""}</>
            : "not run on this take yet (generate.sh runs identity.py after the download)"}
        </p>
      ) : null}
      {s.takes.length > 1 ? (
        <details className="vprod__older">
          <summary>{s.takes.length} takes</summary>
          <ul>{s.takes.map((x) => <li key={x.file} className="tabular"><a href={x.url} target="_blank" rel="noreferrer">{base(x.file)}</a> · {stamp(x.at)}{x.file === s.gateB?.file ? ` · ${s.gateB.decision}` : ""}{x.identity ? ` · identity ${x.identity.result}` : ""}</li>)}</ul>
        </details>
      ) : null}
      <ClickLine c={s.click} what={`a take of ${s.name}`} />
      {live && t && !s.sharedFrom && !done && !decided ? (
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
            <button type="button" className="pill pill--go" disabled={busy || !idOk || s.checks.some((c) => !ticked.includes(c))} onClick={() => send("take.approve", { checks: ticked })}>Approve this take</button>
            {!rejecting ? <button type="button" className="pill" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button> : null}
            {!idOk ? <span className="rail__why is-bad">{t.identity ? "the identity gate did not pass" : "the identity gate has not run"}</span> : null}
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
      {s.phone && s.approved ? <Composite post={post} s={s} live={live} /> : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </li>
  );
}

function Composite({ post, s, live }: { post: string; s: Segment; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const c = s.composite;
  return (
    <div className="vprod__comp">
      <p className="vprod__segh">Composite (the app in the phone) <span className={`vprod__tag${s.compositeApproved ? " is-done" : ""}`}>{s.compositeApproved ? "approved" : c ? "waiting for you" : "not made yet (composite.sh)"}</span></p>
      {c ? (
        <div className="vprod__media">
          <figure>
            <video src={c.url} controls playsInline preload="metadata" aria-label={`Composite of ${s.name}`} />
            <figcaption className="tabular">{base(c.file)} · gates {c.gates}</figcaption>
          </figure>
        </div>
      ) : null}
      <ClickLine c={s.compositeClick} what={`the composite of ${s.name}`} />
      {live && c && !s.compositeApproved && !(s.compositeClick?.current) ? (
        <div className="sr__actions">
          <button type="button" className="pill pill--go" disabled={busy} onClick={() => decide({ post, kind: "composite.approve", data: { segment: s.name } }).then(setErr)}>Approve composite</button>
          {c.failed.length ? <span className="rail__why is-bad">gates failed: {c.failed.join(", ")}</span> : null}
        </div>
      ) : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </div>
  );
}

function Cut({ post, p, live }: { post: string; p: Production; live: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const [grain, setGrain] = useState(false);
  const a = p.assembly;
  const done = p.gateC?.decision === "approve" && p.gateC.current;
  const pending = p.cutClick?.current && !p.cutClick.recorded;
  const open = p.segments.filter((s) => s.generated && !s.sharedFrom && !s.approved).map((s) => s.name);
  return (
    <section className="vprod__stage" aria-label="The cut, gate C">
      <h3 className="vprod__h"><span className="vprod__n">3</span> The cut <small>gate C · character-assemble, then character-deliver</small>
        <span className={`vprod__tag${done ? " is-done" : a && !pending ? " is-you" : ""}`}>{done ? "approved" : !a ? "not assembled yet" : a.stale ? "stale: assembled from another revision" : pending ? "clicked: being recorded" : "waiting for you"}</span>
      </h3>
      {p.gateC?.words ? <p className="vprod__words">Gate C ({p.gateC.decision}): “{p.gateC.words}”{p.gateC.date ? ` (${p.gateC.date})` : ""}</p> : null}
      {a ? (
        <div className="vprod__media">
          <figure className="is-wide">
            <video src={grain && a.grain ? a.grain : a.url} controls playsInline preload="metadata" aria-label="The assembled cut" />
            <figcaption className="tabular">{base(a.file)}{a.duration ? ` · ${a.duration.toFixed(1)} s` : ""} · sha256 {a.sha256.slice(0, 12)}</figcaption>
          </figure>
        </div>
      ) : <p className="sr__hint">assemble.sh writes assembly/&lt;video&gt;.mp4 once every segment is approved.</p>}
      {a?.failed.length ? <p className="rail__why is-bad">Failed on the cut (assembly.json): {a.failed.join(", ")}</p> : null}
      <ClickLine c={p.cutClick} what="the cut" />
      {live && a && !done && !pending ? (
        <div className="sr__actions">
          {a.grain ? <label className="vprod__again"><input type="checkbox" checked={grain} onChange={(e) => setGrain(e.target.checked)} /> deliver the grain export</label> : null}
          <button type="button" className="pill pill--go" disabled={busy || a.stale || open.length > 0} onClick={() => decide({ post, kind: "cut.approve", data: { export: grain ? "grain" : "default" } }).then(setErr)}>Approve the cut</button>
          {open.length ? <span className="rail__why">not every segment is approved: {open.join(", ")}</span> : null}
          <SendBack label="Send back" busy={busy} onSend={(n) => decide({ post, kind: "cut.sendback", note: n, data: {} }).then((r) => { setErr(r); return r; })} />
        </div>
      ) : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </section>
  );
}

export function VideoProduction({ post, p, live }: { post: string; p: Production; live: boolean }) {
  const segs = p.segments;
  return (
    <div className="vprod">
      <Storyboard post={post} p={p} live={live} />
      <section className="vprod__stage" aria-label="Segments, gate B">
        <h3 className="vprod__h"><span className="vprod__n">2</span> Segments <small>generate and gate B · character-generate, character-review</small></h3>
        {segs.length ? (
          <ol className="vprod__segs">
            {segs.map((s) =>
              s.generated ? <TakeCard key={s.name} post={post} s={s} live={live} /> : (
                <li key={s.name} className="vprod__seg"><p className="vprod__segh tabular"><b>{s.name}</b> · {s.type} · built at assembly (no generation)</p></li>
              ),
            )}
          </ol>
        ) : <p className="sr__hint">video.json lists the segments once character-shots writes it.</p>}
      </section>
      <Cut post={post} p={p} live={live} />
    </div>
  );
}
