"use client";

/**
 * The orb, and the layer that makes it drivable.
 *
 * The scene is a WebGL canvas inside a sandboxed iframe — to a driver that is a
 * single opaque rectangle with no accessibility nodes in it at all. So every
 * plate is ALSO a real focusable <button> in THIS document, with a stable
 * accessible name, and clicking one flies the orb to that plate over the message
 * bridge. The room sees the sphere turn; the driver clicked a button.
 *
 * Nothing here is hover-only, nothing exists solely as an in-flight animation,
 * and the buttons do not renumber between reads.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrbPlateSpec } from "@/lib/orb-source";

export default function AtlasOrb({
  srcDoc,
  plates,
  clusters,
  focusCluster,
}: {
  srcDoc: string;
  plates: OrbPlateSpec[];
  clusters: { id: string; label: string; accent: string; count: number }[];
  focusCluster?: string;
}) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Orb loading");
  const [fault, setFault] = useState<string | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [settling, setSettling] = useState(true);
  const [openCluster, setOpenCluster] = useState<string | null>(focusCluster ?? null);

  // The bridge back: a plate click inside the canvas becomes a route change.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "atlas-orb-ready") {
        setReady(true);
        setStatus("Orb ready");
        // Acknowledge, so the scene stops announcing.
        frameRef.current?.contentWindow?.postMessage({ type: "atlas-orb-ack" }, "*");
      }
      // A warning is not a failure. The authored scene warns when some plates
      // could not be decoded, which is the normal state while covers are still
      // landing — it belongs in the status line, not in an alert.
      if (d.type === "atlas-orb-warn") setStatus(String(d.message));
      if (d.type === "atlas-orb-error") {
        setFault(`${d.message}${d.where ? ` (${d.where})` : ""}`);
        setStatus(`Orb fault: ${d.message}`);
      }
      if (d.type === "atlas-orb-select" && typeof d.href === "string") {
        const href = d.href;
        setStatus(`Opening ${d.name}`);
        // A click on a plate is the single most-used move in the session, so it
        // is not allowed to be flaky. router.push() from a cross-document
        // message handler occasionally lands mid-hydration and is dropped, and
        // there is no way to observe that from here — so the push gets a short
        // deadline, and if the URL has not moved by then the browser navigates
        // for real. Worst case we pay one page load; we never eat the click.
        router.push(href);
        window.setTimeout(() => {
          if (window.location.pathname + window.location.search !== href) window.location.assign(href);
        }, 350);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  // The overlay is a courtesy, not a status. React can miss an iframe's load
  // event (the event fires before the synthetic handler attaches), and the
  // handshake below can take a moment, so the overlay retires on its own
  // schedule rather than waiting on either. By then the sphere is either
  // painted or the fault message has replaced it.
  useEffect(() => {
    const id = setTimeout(() => setSettling(false), 2500);
    return () => clearTimeout(id);
  }, []);

  // Ask the scene whether it is up, until it answers. The iframe can finish
  // booting before this component hydrates, in which case its one-shot
  // announcement is sent into a window with no listener yet.
  useEffect(() => {
    if (ready) return;
    // No try limit: the scene may take a while on a cold cache, and giving up
    // would leave the control layer permanently reporting "loading".
    const id = setInterval(() => {
      frameRef.current?.contentWindow?.postMessage({ type: "atlas-orb-ping" }, "*");
    }, 400);
    return () => clearInterval(id);
  }, [ready]);

  const flyTo = (plate: OrbPlateSpec) => {
    frameRef.current?.contentWindow?.postMessage({ type: "atlas-orb-focus", tile: plate.tile }, "*");
    setStatus(`Flew to ${plate.name}`);
  };

  // A URL can ask for a cluster, so /orb?cluster=potto is a real, linkable state.
  useEffect(() => {
    if (!ready || !focusCluster) return;
    const idx = clusters.findIndex((c) => c.id === focusCluster);
    if (idx < 0) return;
    const centre = plates.find((p) => p.cluster === idx);
    if (centre) {
      frameRef.current?.contentWindow?.postMessage({ type: "atlas-orb-focus", tile: centre.tile }, "*");
      setStatus(`Spun to ${clusters[idx].label}`);
    }
  }, [ready, focusCluster, clusters, plates]);

  return (
    <div className="orb">
      <div className="orb__stage">
        <iframe
          ref={frameRef}
          className="orb__frame"
          title="Orb — every app you researched, one cluster each"
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          onLoad={() => {
            setFrameLoaded(true);
            frameRef.current?.contentWindow?.postMessage({ type: "atlas-orb-ping" }, "*");
          }}
        />
        {settling && !ready && !frameLoaded && !fault && <p className="orb__loading">Building the sphere…</p>}
        {fault && (
          <p className="orb__fault" role="alert">
            The sphere did not start: {fault}
            <br />
            Every plate is still reachable from the control layer below.
          </p>
        )}
      </div>

      {/* The control layer. Visually subdued, always present, never hover-only. */}
      <section className="orbctl" aria-label="Orb control layer">
        <p className="orbctl__intro">
          Every plate on the sphere is also a button here. Choosing one flies the orb to it; choosing it again opens it.
        </p>

        <ul className="orbctl__clusters">
          {clusters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`orbctl__cluster${openCluster === c.id ? " is-open" : ""}`}
                style={{ ["--accent" as string]: c.accent }}
                aria-expanded={openCluster === c.id}
                onClick={() => {
                  setOpenCluster((v) => (v === c.id ? null : c.id));
                  const idx = clusters.findIndex((x) => x.id === c.id);
                  const centre = plates.find((p) => p.cluster === idx);
                  if (centre) flyTo(centre);
                }}
              >
                {c.label}
                <span className="orbctl__n tabular">{c.count}</span>
              </button>
            </li>
          ))}
        </ul>

        {clusters.map((c, ci) =>
          openCluster === c.id ? (
            <ul className="orbctl__plates" key={c.id} aria-label={`${c.label} plates`}>
              {plates
                .filter((p) => p.cluster === ci)
                .map((p) => (
                  <li key={p.tile}>
                    <button type="button" className="orbctl__plate" onClick={() => flyTo(p)} data-tile={p.tile}>
                      {p.name}
                    </button>
                    <a className="orbctl__open" href={p.href}>
                      open
                    </a>
                  </li>
                ))}
            </ul>
          ) : null
        )}

        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  );
}
