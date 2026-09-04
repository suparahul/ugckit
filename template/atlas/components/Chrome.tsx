"use client";

/**
 * The persistent chrome: ticker, breadcrumb, control-layer scaffolding.
 *
 * Deliberately almost nothing. No saved path, no waypoints, no spacebar, no
 * presenter mode — the navigation is a voice command to Claude, who drives, so
 * the app only has to be *drivable*. What stays is a corpus counter so scale
 * never has to be re-stated, and a breadcrumb so a screen-read tells the driver
 * where the app actually is.
 */

import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

type Corpus = {
  networks: number;
  accounts: number;
  knownHandles: number;
  posts: number;
  totalViews: number;
  withHook: number;
  deepDives: number;
};

function views(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}

/** The corpus counter. Always visible, so scale never has to be re-stated. */
export function Ticker({ corpus }: { corpus: Corpus }) {
  const cells = [
    { label: "networks", value: String(corpus.networks) },
    { label: "accounts", value: String(corpus.accounts) },
    { label: "posts", value: corpus.posts.toLocaleString("en-US") },
    { label: "views", value: views(corpus.totalViews) },
  ];
  return (
    <dl className="ticker" aria-label="Corpus size">
      {cells.map((c) => (
        <div className="ticker__cell" key={c.label}>
          <dt>{c.label}</dt>
          <dd className="tabular">{c.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Breadcrumb derived from the URL, because the URL *is* the state — every piece
 * of state is a route and nothing hides in component memory. That means a screen
 * read of this line is always true, even after the orb has been spun by hand.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/search.json")
      .then((r) => r.json())
      .then((m: { entries: { id: string; name: string; href: string }[] }) => {
        const map: Record<string, string> = {};
        for (const e of m.entries) map[e.href] = e.name;
        setLabels(map);
      })
      .catch(() => {});
  }, []);

  const parts = pathname.split("/").filter(Boolean);
  const trail: { href: string; label: string }[] = [{ href: "/orb", label: "Atlas" }];

  if (parts[0] === "orb") {
    const cluster = params.get("cluster");
    if (cluster) trail.push({ href: `/orb?cluster=${cluster}`, label: cluster });
  } else if (parts.length) {
    let acc = "";
    for (const p of parts) {
      acc += `/${p}`;
      trail.push({ href: acc, label: labels[acc] || decodeURIComponent(p) });
    }
  }

  return (
    <nav className="crumb" aria-label="Breadcrumb">
      <ol>
        {trail.map((t, i) => (
          <li key={t.href + i}>
            {i > 0 && (
              <span className="crumb__sep" aria-hidden="true">
                /
              </span>
            )}
            {i === trail.length - 1 ? (
              <span aria-current="page">{t.label}</span>
            ) : (
              <Link href={t.href}>{t.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The shadow DOM control layer.
 *
 * A canvas exposes no accessibility nodes, and anything animated into place by
 * transform alone is invisible to a driver too. So every orb plate, carousel
 * card and concept node is ALSO a real focusable button with a stable
 * accessible name, in a list that is visually subdued but present — never
 * display:none, never hover-only, and never renumbered between reads.
 *
 * This is the bridge that makes a 3D scene drivable: the room sees the sphere
 * turn, the driver clicked a button.
 */
export function ControlLayer({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: { id: string; name: string; href?: string }[];
  onSelect?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`control${expanded ? " is-expanded" : ""}`} aria-label={title}>
      <button type="button" className="control__toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        {title} <span className="control__count tabular">{items.length}</span>
      </button>
      <ul className="control__list">
        {items.map((item) => (
          <li key={item.id}>
            {onSelect ? (
              <button type="button" className="control__item" onClick={() => onSelect(item.id)} data-control-id={item.id}>
                {item.name}
              </button>
            ) : (
              <Link className="control__item" href={item.href || "#"} data-control-id={item.id}>
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Marks the current route on <html> so global CSS can dress a single view
 * differently. Used by /orb, which is a title card: the chrome is still in the
 * DOM and still in the accessibility tree — the agent drives the session from
 * it — but it is clipped out of sight for the room.
 */
export function RouteFlag() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (pathname === "/orb") root.dataset.orb = "1";
    else {
      delete root.dataset.orb;
      delete root.dataset.reveal;
    }
  }, [pathname]);
  return null;
}
