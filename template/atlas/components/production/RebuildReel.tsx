"use client";

/**
 * "Rebuild the reel": after a slide is edited, the slideshow's finals and its reel are out of date. One click makes them
 * again from the slides as they are now (/api/production/reel), with the seconds each slide is held.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

const MIN = 1, MAX = 12;
const ok = (v: string) => v.trim() !== "" && Number(v) >= MIN && Number(v) <= MAX;

export function RebuildReel({ slug, post, slides, hasProduct, hasReel, hold: hold0, hookHold: hook0, productHold: prod0 }: { slug: string; post: string; slides: number; hasProduct: boolean; hasReel: boolean; hold: number; hookHold: number; productHold: number }) {
  const router = useRouter();
  const [hold, setHold] = useState(String(hold0));
  const [hookHold, setHookHold] = useState(String(hook0));
  const [productHold, setProductHold] = useState(String(prod0));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const valid = ok(hold) && ok(hookHold) && (!hasProduct || ok(productHold));
  const length = Number(hookHold) + (hasProduct ? Number(productHold) : 0) + Math.max(0, slides - 1 - (hasProduct ? 1 : 0)) * Number(hold);

  const go = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/production/reel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: slug, post, hold: Number(hold), hookHold: Number(hookHold), productHold: Number(hasProduct ? productHold : hold) }) });
      const j = (await r.json()) as { error?: string; slides?: number; seconds?: number };
      if (!r.ok || j.error) setErr(j.error ?? "The reel could not be made.");
      else { setMsg(`Done: ${j.slides} slides, ${j.seconds} s.`); router.refresh(); }
    } catch { setErr("The server did not answer."); }
    finally { setBusy(false); }
  };
  const field = (label: string, v: string, set: (x: string) => void) => (
    <label className="reel__field">{label} <input type="number" min={MIN} max={MAX} step={0.5} value={v} onChange={(e) => set(e.target.value)} aria-invalid={!ok(v)} /> s</label>
  );
  return (
    <div className="reel">
      <div className="reel__fields">
        {field("Each slide", hold, setHold)}
        {field("Hook slide", hookHold, setHookHold)}
        {hasProduct ? field("Product slide", productHold, setProductHold) : null}
        {valid ? <span className="reel__len">about {Math.round(length)} s in all</span> : <span className="rail__err">Each time is {MIN} to {MAX} seconds.</span>}
      </div>
      <button type="button" className="pill pill--go" disabled={busy || !valid} onClick={go}>{busy ? "Making the reel… about half a minute" : hasReel ? "Rebuild the reel from the slides" : "Make the reel from the slides"}</button>
      <p className="reel__hint">{hasReel ? "Run this after you change a slide: the final slides, the Instagram set and this reel are made again. The send also cuts it again from the slides it sends." : "The slides with the cover text burned in, cut into one 9:16 video, with the music chosen above."}</p>
      {msg ? <p className="reel__done">{msg}</p> : null}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </div>
  );
}
