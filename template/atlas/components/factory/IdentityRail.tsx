"use client";

/**
 * The one decision of a handle in creation, in the head: approve the step
 * that waits for you, or ask for a new one with a note. Each click appends
 * one identity line to the log (persona.approve, reference.approve,
 * reference.reject, bio.approve, defaults.approve) through
 * /api/production/decide; the agent reads the log and continues.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Reference, Step } from "@/lib/handles";

export function IdentityRail({ slug, handle, step, references }: { slug: string; handle: string; step: Step; references: Reference[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const pending = references.filter((r) => r.exists && !r.approved && /identity|face|subject|style/i.test(r.role));
  const target = pending[0] ?? null;

  const kinds: Record<number, { approve: string; back: string | null; label: string; what: string }> = {
    2: { approve: "persona.approve", back: "persona.sendback", label: "Approve the persona", what: "the persona" },
    3: { approve: "reference.approve", back: "reference.reject", label: target ? `Approve ${/face/i.test(target.role) || /^face/.test(target.file) ? "the face" : target.file}` : "Approve", what: target ? target.file : "the reference" },
    4: { approve: "bio.approve", back: null, label: "Approve the picture and the bio", what: "the bio" },
    5: { approve: "defaults.approve", back: null, label: "Approve the defaults", what: "the defaults" },
  };
  const k = kinds[step.n];
  if (!k || step.state !== "you" || (step.n === 3 && !target)) return null;

  const send = async (kind: string, withNote: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { app: slug, handle, kind };
      if (step.n === 3 && target) body.file = target.file;
      if (withNote) body.note = note.trim();
      const r = await fetch("/api/production/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setErr(j.error ?? "The decision did not save.");
      else { setAsking(false); setNote(""); router.refresh(); }
    } catch {
      setErr("The server did not answer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="rail" aria-label="Decision">
      <div className="rail__inner">
        {asking ? (
          <form className="rail__row" onSubmit={(e) => { e.preventDefault(); if (note.trim()) void send(k.back!, true); }}>
            <input className="posting__url" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What to change about ${k.what}`} aria-label="Your note" autoFocus />
            <button type="submit" className="rail__go" disabled={busy || !note.trim()}>Send the note</button>
            <button type="button" className="rail__kill" onClick={() => setAsking(false)}>cancel</button>
          </form>
        ) : (
          <div className="rail__row">
            {k.back ? <button type="button" className="rail__kill" disabled={busy} onClick={() => setAsking(true)}>Ask for a new one</button> : null}
            <button type="button" className="rail__go" disabled={busy} onClick={() => void send(k.approve, false)}>{busy ? "Saving…" : k.label}</button>
          </div>
        )}
        {err ? <span className="rail__why is-bad">{err}</span> : null}
      </div>
    </aside>
  );
}
