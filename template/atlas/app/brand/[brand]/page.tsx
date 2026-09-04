/**
 * The brand home page — the network's front door.
 *
 * One scrolling page, in a fixed order, because the order carries the argument:
 * the money first (why should I care about this app), then the machine that
 * made it. Section 3 is the load-bearing one — the brand's own account sits in
 * the creator carousel unmarked and at true size, so scrolling past 386
 * followers between personas doing millions lands as a gut-punch rather than a
 * bullet point.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getBrand, getBrands, commas, shortDate, views } from "@/lib/data";
import { Pending, TikTokLink } from "@/components/Bits";
import AccountCarousel from "@/components/AccountCarousel";
import AppStorePanel from "@/components/AppStorePanel";
import Teardown from "@/components/Teardown";
import "./brand.css";

export function generateStaticParams() {
  return getBrands().map((b) => ({ brand: b.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const b = getBrand(brand);
  return { title: b ? `${b.name} — The Atlas` : "Not found" };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const b = getBrand(brand);
  if (!b) notFound();

  const s = b.stats;
  const top = b.accounts.flatMap((a) => a.posts).find((p) => p.id === s.topPostId);

  return (
    <div className="page stack">
      {/* 1 — Identity row. Quiet. */}
      <header className="identity">
        <div>
          <h1 className="display">{b.name}</h1>
          {b.tagline && <p className="identity__tag serif">{b.tagline}</p>}
        </div>
        <div className="identity__meta">
          {b.market && <span>{b.market}</span>}
          {b.language && <span>{b.language.join(" · ")}</span>}
        </div>
      </header>

      {/* 2 — The money, before anything else. Only when app.json holds it: the
          panel is evidence, and an empty recreation of a tracker is decoration. */}
      {b.appStore && <AppStorePanel brand={b} />}

      {/* 3 — Every account in the network, the brand's own included, unmarked. */}
      <section aria-labelledby="creators">
        <div className="section__head">
          <h2 id="creators" className="eyebrow">
            The network — {s.accountCount} accounts
          </h2>
          <p className="section__note">
            {s.knownHandles > s.accountCount
              ? `${s.knownHandles - s.accountCount} more handles found and not yet scraped`
              : "every handle found has been scraped"}
          </p>
        </div>
        <AccountCarousel
          accounts={b.accounts.map((a) => ({
            handle: a.handle,
            name: a.name,
            href: `/account/${a.handle}`,
            maxViews: a.stats.maxViews,
            videos: a.stats.postCount - a.stats.slideshows,
            slideshows: a.stats.slideshows,
            convention: a.handleConvention.label,
            insertion: a.posts.find((p) => p.tags.insertion.length)?.tags.insertion[0]?.label ?? "—",
            disclosure: a.bioDisclosure[0]?.label ?? a.posts.find((p) => p.tags.disclosure[0]?.id !== "none")?.tags.disclosure[0]?.label ?? "None",
            cover: a.posts.find((p) => p.cover)?.cover ?? null,
            isOwn: a.isOwn,
          }))}
        />
        {b.ownNote && <p className="section__note section__note--wide">{b.ownNote}</p>}
      </section>

      {/* 4 — Network totals. Big type, few numbers. */}
      <section aria-labelledby="totals">
        <div className="section__head">
          <h2 id="totals" className="eyebrow">
            Network totals
          </h2>
        </div>
        <div className="totals">
          <div className="metric">
            <span className="metric-value tabular">{s.accountCount}</span>
            <span className="metric-label">accounts</span>
          </div>
          <div className="metric">
            <span className="metric-value tabular">{commas(s.postCount)}</span>
            <span className="metric-label">posts</span>
          </div>
          <div className="metric">
            <span className="metric-value tabular">{views(s.totalViews)}</span>
            <span className="metric-label">total views</span>
          </div>
          <div className="metric">
            <span className="metric-value tabular">{views(s.medianViews)}</span>
            <span className="metric-label">median post</span>
          </div>
          <div className="metric">
            {top ? (
              <Link className="metric-value tabular metric-value--link" href={`/post/${top.id}`}>
                {views(s.topPostViews)}
              </Link>
            ) : (
              <span className="metric-value tabular">—</span>
            )}
            <span className="metric-label">top post{s.topPostHandle ? ` · @${s.topPostHandle}` : ""}</span>
          </div>
          <div className="metric">
            <span className="metric-value metric-value--date">
              {s.firstPost ? shortDate(s.firstPost) : "—"} → {s.lastPost ? shortDate(s.lastPost) : "—"}
            </span>
            <span className="metric-label">date range</span>
          </div>
        </div>
      </section>

      {/* 5 — The teardown, summarised graphically. Full text one click deeper. */}
      <Teardown brand={b} />

      {/* 6 — Ends by pushing them onto the platform. */}
      <section className="cta">
        <h2 className="display">
          Go <em>look</em> at it.
        </h2>
        <p className="lede">
          The grid is the evidence this app can&rsquo;t fake — cover consistency, face on thumbnail, text placement.
          Open a real profile.
        </p>
        <ul className="cta__list">
          {b.accounts.slice(0, 6).map((a) => (
            <li key={a.handle}>
              <TikTokLink href={a.url} label={`@${a.handle}`} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
