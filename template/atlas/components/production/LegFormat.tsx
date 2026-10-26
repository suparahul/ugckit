"use client";

/**
 * Per platform, how a slideshow goes out: as the slideshow, or as its reel (a carousel reaches few people on Instagram;
 * the reel does better and carries the music). One `leg.format` line through /api/production/decide per click; the
 * send reads it (lib/production.ts legFormat, lib/postbridge-flow.ts). A leg already sent is shown, not changed.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { LegFormat as Format } from "@/lib/production";

export type LegFormatRow = { platform: "tiktok" | "instagram"; name: string; format: Format; locked: boolean };

export function LegFormat({ slug, post, rows }: { slug: string; post: string; rows: LegFormatRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (platform: string, format: Format) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/production/decide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: slug, post, kind: "leg.format", data: { platform, format } }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setErr(j.error ?? "It did not save."); else router.refresh();
    } catch {
      setErr("The server did not answer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="legfmt" role="group" aria-label="How each platform gets this post">
      {rows.map((r) => (
        <div key={r.platform} className="legfmt__row">
          <span className="legfmt__name">{r.name}</span>
          <span className="legfmt__seg" role="radiogroup" aria-label={`${r.name} format`}>
            {(["slideshow", "reel"] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={r.format === f} className={r.format === f ? "is-on" : ""} disabled={busy || r.locked || r.format === f} onClick={() => void pick(r.platform, f)}>
                {f === "slideshow" ? "Slideshow" : "Reel"}
              </button>
            ))}
          </span>
          {r.locked ? <small className="legfmt__note">already sent</small> : null}
        </div>
      ))}
      {err ? <p className="rail__err" role="alert">{err}</p> : null}
    </div>
  );
}
