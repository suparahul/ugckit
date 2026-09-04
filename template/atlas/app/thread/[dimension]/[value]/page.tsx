/**
 * A thread — every post or account in the corpus carrying one tag.
 *
 * This is the move the session is built around. On a Potto post whose hook is
 * discovery-regret, one click rails up the other posts, across unrelated apps,
 * running near word-for-word the same line. The cross-network findings emerge
 * inductively, in the room, from something someone in the room chose to click —
 * rather than being asserted from a slide.
 *
 * So the page leads with the count of *networks*, not the count of posts, and
 * groups by brand: the argument is "this is not one company's trick".
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { allThreads, getBrand, getThread, threadAccounts, threadPosts, views } from "@/lib/data";
import { Cover, TikTokLink } from "@/components/Bits";
import "./thread.css";

export function generateStaticParams() {
  return allThreads().map((t) => ({ dimension: t.dimension, value: t.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ dimension: string; value: string }> }): Promise<Metadata> {
  const { dimension, value } = await params;
  const t = getThread(dimension, value);
  return { title: t ? `${t.label} — The Atlas` : "Not found" };
}

const DIMENSION_LABEL: Record<string, string> = {
  hook: "Hook type",
  insertion: "Insertion mechanic",
  disclosure: "Disclosure",
  sound: "Sound strategy",
  format: "Format",
  handleConvention: "Handle convention",
  cadence: "Cadence",
};

export default async function ThreadPage({ params }: { params: Promise<{ dimension: string; value: string }> }) {
  const { dimension, value } = await params;
  const thread = getThread(dimension, value);
  if (!thread) notFound();

  const posts = threadPosts(thread);
  const accounts = threadAccounts(thread);

  // Group by network — the whole point is what crosses between them.
  const byBrand = new Map<string, typeof posts>();
  for (const item of posts) {
    const list = byBrand.get(item.brand.id) || [];
    list.push(item);
    byBrand.set(item.brand.id, list);
  }

  const accountsByBrand = new Map<string, typeof accounts>();
  for (const item of accounts) {
    const list = accountsByBrand.get(item.brand.id) || [];
    list.push(item);
    accountsByBrand.set(item.brand.id, list);
  }

  return (
    <div className="page thread">
      <header className="thread__head">
        <p className="eyebrow">{DIMENSION_LABEL[dimension] || dimension}</p>
        <h1 className="display">{thread.label}</h1>

        <p className="thread__count">
          <strong className="tabular">{thread.count}</strong> {posts.length ? "posts" : "accounts"} across{" "}
          <strong className="tabular">{thread.brandCount}</strong> {thread.brandCount === 1 ? "network" : "networks"}
          {thread.crossNetwork && <span className="thread__cross">crosses networks</span>}
        </p>

        <ul className="thread__brands">
          {thread.brandList.map((id) => {
            const b = getBrand(id);
            return (
              <li key={id}>
                <Link className="chip" href={`/brand/${id}`}>
                  {b?.name || id}
                  <span className="chip__count">{(byBrand.get(id) || accountsByBrand.get(id) || []).length}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {thread.note && <p className="lede thread__note">{thread.note}</p>}
      </header>

      {/* Posts, grouped by network, each quoting the phrase that put it here. */}
      {posts.length > 0 &&
        [...byBrand.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([brandId, items]) => {
            const b = getBrand(brandId);
            return (
              <section className="thread__group" key={brandId} aria-labelledby={`g-${brandId}`}>
                <div className="section__head">
                  <h2 id={`g-${brandId}`} className="thread__brandname">
                    <Link href={`/brand/${brandId}`}>{b?.name || brandId}</Link>
                  </h2>
                  <p className="section__note tabular">{items.length} posts</p>
                </div>
                <ul className="thread__list">
                  {items.slice(0, 40).map(({ post, account, evidence }) => (
                    <li key={post.id}>
                      <Link className="titem" href={`/post/${post.id}`}>
                        <Cover post={post} className="titem__cover" />
                        <span className="titem__body">
                          <span className="titem__top">
                            <span className="titem__views tabular">{views(post.views)}</span>
                            <span className="titem__handle">
                              @{account.handle}
                              {account.isOwn && <em className="titem__own">the brand&rsquo;s own account</em>}
                            </span>
                          </span>
                          {/* The exact words that put this post in this thread. */}
                          {evidence && <span className="titem__evidence">“{evidence}”</span>}
                          {post.onScreen && <span className="titem__hook">{post.onScreen}</span>}
                          <span className="titem__date">{post.date}</span>
                        </span>
                      </Link>
                      <TikTokLink href={post.url} label="TikTok" />
                    </li>
                  ))}
                </ul>
                {items.length > 40 && <p className="section__note">+{items.length - 40} more in this network</p>}
              </section>
            );
          })}

      {/* Account-level threads: handle convention and cadence. */}
      {accounts.length > 0 &&
        [...accountsByBrand.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([brandId, items]) => {
            const b = getBrand(brandId);
            return (
              <section className="thread__group" key={brandId} aria-labelledby={`a-${brandId}`}>
                <div className="section__head">
                  <h2 id={`a-${brandId}`} className="thread__brandname">
                    <Link href={`/brand/${brandId}`}>{b?.name || brandId}</Link>
                  </h2>
                  <p className="section__note tabular">{items.length} accounts</p>
                </div>
                <ul className="thread__accounts">
                  {items.map(({ account }) => (
                    <li key={account.handle}>
                      <Link href={`/account/${account.handle}`}>
                        <span className="thread__ahandle">@{account.handle}</span>
                        <span className="thread__afigures tabular">
                          {account.followers === null ? "—" : views(account.followers)} followers ·{" "}
                          {views(account.stats.maxViews)} top · {account.stats.postsPerWeek}/wk
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
    </div>
  );
}
