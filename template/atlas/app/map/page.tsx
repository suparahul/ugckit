/**
 * /map — every live URL in the app, on one page.
 *
 * This exists for the driver. Agent-operability is a hard requirement, and the
 * cheapest way to make an app drivable is to let it enumerate its own address
 * space: one screen-read here returns every route that currently resolves, with
 * a stable accessible name for each. Nothing is generated on the fly and nothing
 * renumbers between reads.
 *
 * It doubles as the answer to "what else is in here?".
 */

import Link from "next/link";
import type { Metadata } from "next";

import { allThreads, getBrands, getCorpus, views } from "@/lib/data";
import "./map.css";

export const metadata: Metadata = { title: "Map — The Atlas" };

export default function MapPage() {
  const brands = getBrands();
  const corpus = getCorpus();
  const threads = allThreads();

  const byDimension = new Map<string, typeof threads>();
  for (const t of threads) {
    const list = byDimension.get(t.dimension) || [];
    list.push(t);
    byDimension.set(t.dimension, list);
  }

  const accountCount = brands.reduce((s, b) => s + b.accounts.length, 0);

  return (
    <div className="page map">
      <header className="map__head">
        <h1 className="display">Map</h1>
        <p className="lede">
          Every route that currently resolves. {corpus.networks} networks, {accountCount} accounts,{" "}
          {corpus.posts.toLocaleString("en-US")} posts, {threads.length} threads.
        </p>
      </header>

      <section className="map__block">
        <h2 className="eyebrow">Named views</h2>
        <ul className="map__flat">
          {[
            ["/orb", "The orb — one cluster per app"],
            ["/map", "This page"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link href={href}>
                <code>{href}</code>
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="map__block">
        <h2 className="eyebrow">Networks &amp; accounts</h2>
        {brands.map((b) => (
          <div className="map__brand" key={b.id}>
            <h3>
              <Link href={`/brand/${b.id}`}>
                <code>/brand/{b.id}</code> {b.name}
              </Link>
              <span className="map__meta tabular">
                {b.stats.accountCount} accounts · {views(b.stats.totalViews)}
              </span>
            </h3>
            <ul className="map__handles">
              {b.accounts.map((a) => (
                <li key={a.handle}>
                  <Link href={`/account/${a.handle}`}>
                    @{a.handle}
                    <span className="tabular"> {views(a.stats.maxViews)}</span>
                    {a.isOwn && <em> · brand&rsquo;s own</em>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="map__block">
        <h2 className="eyebrow">Threads</h2>
        {[...byDimension.entries()].map(([dim, list]) => (
          <div className="map__brand" key={dim}>
            <h3>
              <code>/thread/{dim}/…</code>
            </h3>
            <ul className="map__handles">
              {list
                .sort((a, b) => b.brandCount - a.brandCount || b.count - a.count)
                .map((t) => (
                  <li key={t.id}>
                    <Link href={`/thread/${t.dimension}/${t.id}`}>
                      {t.label}
                      <span className="tabular">
                        {" "}
                        {t.count} · {t.brandCount}nw
                      </span>
                      {t.crossNetwork && <em> · crosses</em>}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

    </div>
  );
}
