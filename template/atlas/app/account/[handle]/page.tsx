/**
 * The account page — the dossier.
 *
 * Depth 3: quiet, sober, text-first. No 3D, no motion. This is where they read.
 * The full post table sortable by any metric, a cover grid, the bio, and the
 * notes we wrote.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getAccount, getBrands, commas, shortDate, views } from "@/lib/data";
import { Cover, Pending, TikTokLink } from "@/components/Bits";
import PostTable from "@/components/PostTable";
import "./account.css";

export function generateStaticParams() {
  return getBrands().flatMap((b) => b.accounts.map((a) => ({ handle: a.handle })));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} — The Atlas` };
}

export default async function AccountPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const found = getAccount(handle);
  if (!found) notFound();
  const { account: a, brand } = found;
  const s = a.stats;

  // The grid is a wall of covers, not the feed — read as evidence it should
  // lead with the account's best work, not its most recent.
  const withCover = [...a.posts].filter((p) => p.cover).sort((x, y) => y.views - x.views);

  return (
    <div className="page stack">
      <header className="ahead">
        <div className="ahead__id">
          <p className="eyebrow">
            <Link href={`/brand/${brand.id}`}>{brand.name}</Link> network
          </p>
          <h1 className="display">@{a.handle}</h1>
          {a.name && a.name !== a.handle && <p className="ahead__name serif">{a.name}</p>}
          {a.bio && <p className="ahead__bio">{a.bio}</p>}
          <div className="ahead__links">
            <TikTokLink href={a.url} />
            <Link className="chip" href={`/thread/handleConvention/${a.handleConvention.id}`}>
              {a.handleConvention.label}
            </Link>
            {a.bioDisclosure.map((d) => (
              <Link className="chip" key={d.id} href={`/thread/disclosure/${d.id}`}>
                {d.label}
                {d.evidence && <span className="chip__ev">“{d.evidence}”</span>}
              </Link>
            ))}
          </div>
        </div>

        <dl className="ahead__stats">
          {[
            ["followers", a.followers === null ? "—" : commas(a.followers)],
            ["posts scraped", commas(s.postCount)],
            ["median views", views(s.medianViews)],
            ["top post", views(s.maxViews)],
            ["× median", s.xMedian === null ? "—" : `×${s.xMedian}`],
            ["posts / week", String(s.postsPerWeek)],
            ["engagement", `${s.engagementRate}%`],
            ["status", s.active ? "active" : "dormant"],
          ].map(([label, value]) => (
            <div key={label}>
              <dd className="tabular">{value}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </header>

      <p className="ahead__span">
        Posting {shortDate(s.firstPost)} → {shortDate(s.lastPost)} · {s.spanDays} days ·{" "}
        {a.totalVideos !== null && a.totalVideos > s.postCount
          ? `${commas(a.totalVideos)} posts on the account, top ${commas(s.postCount)} scraped`
          : `${commas(s.postCount)} posts`}
      </p>

      {/* The cover grid — the profile grid, as a whole, which is where format
          consistency becomes visible. */}
      <section aria-labelledby="grid">
        <div className="section__head">
          <h2 id="grid" className="eyebrow">
            The grid
          </h2>
          <p className="section__note tabular">
            {withCover.length} of {s.postCount} covers on disk, best first
          </p>
        </div>
        {withCover.length ? (
          <ul className="grid">
            {withCover.map((p) => (
              <li key={p.id}>
                <Link href={`/post/${p.id}`} title={p.onScreen || p.caption}>
                  <Cover post={p} />
                  <span className={`grid__format grid__format--${p.format}`}>
                    {p.format === "slideshow" ? `${p.slideCount || ""} slides`.trim() : "video"}
                  </span>
                  <span className="grid__views tabular">{views(p.views)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Pending>
            No covers on disk for @{a.handle} yet. They arrive with the next <code>run-brand.sh</code> pass —{" "}
            <code>shallow-pass.sh</code> now keeps them. Every metric and hook below is already complete.
          </Pending>
        )}
      </section>

      {/* The full post table, sortable by any metric. */}
      <section aria-labelledby="posts">
        <div className="section__head">
          <h2 id="posts" className="eyebrow">
            Every post
          </h2>
          <p className="section__note">{s.withHook} with a transcribed on-screen hook</p>
        </div>
        <PostTable posts={a.posts} />
      </section>
    </div>
  );
}
