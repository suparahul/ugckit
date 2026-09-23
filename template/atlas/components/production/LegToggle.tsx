"use client";

/**
 * "Do not post on Instagram" / "Post on Instagram again": one `leg.drop` or
 * `leg.add` line through /api/production/decide. The send reads it: a dropped
 * leg is left out, and the TikTok leg goes as before.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LegToggle({ slug, post, platform, dropped, name }: { slug: string; post: string; platform: string; dropped: boolean; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/production/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: slug, post, kind: dropped ? "leg.add" : "leg.drop", data: { platform } }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setErr(j.error ?? "The change did not save.");
      else router.refresh();
    } catch {
      setErr("The server did not answer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="legs__toggle">
      <button type="button" className="rail__kill" disabled={busy} onClick={() => void toggle()}>{busy ? "Saving…" : dropped ? `Post on ${name} again` : `Do not post on ${name}`}</button>
      {err ? <span className="rail__why is-bad">{err}</span> : null}
    </span>
  );
}
