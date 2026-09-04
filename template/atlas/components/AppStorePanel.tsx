/**
 * The revenue panel — a recreated App Store Tracker view.
 *
 * We hold one real capture (media/ventnow/appstoretracker-2026-09-03.png) but
 * recreate the UI rather than show screenshots: it is consistent across all five
 * brands, sharp at any size, and keeps the *feel* of a tool these builders
 * already trust. The real capture is still linked underneath, because the whole
 * app is evidence-first and a recreation should always be checkable against its
 * source.
 *
 * This is the section that answers "why should I care about this app" before
 * anything else — the money, then the machine that made it.
 */

import type { Brand } from "@/lib/data";

type AppStore = {
  source?: string;
  checked?: string;
  subtitle?: string;
  released?: string;
  releasedNote?: string;
  categories?: string[];
  rating?: number;
  ratingCount?: string;
  revenue7d?: string;
  revenueNote?: string;
  downloads7d?: string;
  version?: string;
  rank?: string | null;
  note?: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="ast__stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(rating) ? "is-on" : ""} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export default function AppStorePanel({ brand }: { brand: Brand }) {
  const a = (brand.appStore || {}) as AppStore;
  const hasMoney = Boolean(a.revenue7d || a.downloads7d);

  return (
    <section className="ast" aria-labelledby="appstore" style={{ ["--accent" as string]: brand.accent || "var(--ember)" }}>
      <h2 id="appstore" className="sr-only">
        App Store position
      </h2>

      <div className="ast__chrome">
        <div className="ast__brandmark" aria-hidden="true">
          {brand.name.slice(0, 1)}
        </div>
        <div className="ast__title">
          <p className="ast__name">{brand.fullName || brand.name}</p>
          {a.subtitle && <p className="ast__sub">{a.subtitle}</p>}
          <p className="ast__pub">
            {brand.publisher || "Publisher unknown"}
            {a.categories?.length ? ` · ${a.categories.join(", ")}` : ""}
          </p>
        </div>
        {typeof a.rating === "number" && (
          <div className="ast__rating">
            <Stars rating={a.rating} />
            <span className="ast__ratingnum tabular">
              {a.rating} {a.ratingCount ? `· ${a.ratingCount}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="ast__grid">
        <div className="ast__cell ast__cell--hero">
          <span className="ast__label">Est. revenue</span>
          <span className="ast__value tabular">{a.revenue7d || "—"}</span>
          <span className="ast__foot">{a.revenueNote || (a.revenue7d ? "7 days" : "no estimate held")}</span>
        </div>
        <div className="ast__cell ast__cell--hero">
          <span className="ast__label">Est. downloads</span>
          <span className="ast__value tabular">{a.downloads7d || "—"}</span>
          <span className="ast__foot">{a.downloads7d ? "7 days" : "no estimate held"}</span>
        </div>
        <div className="ast__cell">
          <span className="ast__label">Rank</span>
          <span className="ast__value ast__value--sm">{a.rank || "—"}</span>
        </div>
        <div className="ast__cell">
          <span className="ast__label">Released</span>
          <span className="ast__value ast__value--sm">{a.released || "—"}</span>
          {a.releasedNote && <span className="ast__foot">{a.releasedNote}</span>}
        </div>
      </div>

      {!hasMoney && (
        <p className="pending">
          No revenue estimate held for {brand.name} yet. App Store Tracker in a browser is still the only source for
          this — Monid has no usable rankings or revenue endpoint.
        </p>
      )}

      <footer className="ast__source">
        <span>
          Source: {a.source || "unknown"}
          {a.checked ? `, checked ${a.checked}` : ""}
        </span>
        {brand.appStoreCapture && (
          <a href={brand.appStoreCapture} target="_blank" rel="noopener noreferrer">
            the real capture ↗
          </a>
        )}
      </footer>

      {a.note && <p className="ast__note">{a.note}</p>}
    </section>
  );
}
