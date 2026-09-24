/**
 * /app/<slug>/niche/post/<platform>/<id> — a niche post, the leaf of the niche page.
 *
 * The Atlas post page (app/post/[id]) with a niche post in it: the same layout,
 * the same parts (Cover, StatRow, StealThis, the link out) and the same styles.
 * A niche post is a search result, not a post the Atlas read: it has the counts,
 * the caption and the cover, and no on-screen hook, sound tags or threads. A count
 * the platform does not report (Instagram: saves, shares, a photo's views, hidden
 * likes) shows as a dash, never 0, as on the niche page.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getApp } from "@/lib/apps";
import { captionBody, shortDate, views } from "@/lib/data";
import { getNicheDetail } from "@/lib/niche";
import { nichePostHref, windowLabel, type NicheDetail } from "@/lib/niche-posts";
import { isPlatform, PLATFORM_NAME, profileUrl } from "@/lib/platform";
import { Cover, StatRow, StealThis, TikTokLink } from "@/components/Bits";
import { PlatformIcon } from "@/components/Platform";
import "@/app/post/[id]/post.css";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; platform: string; id: string }>;

function load(slug: string, platform: string, id: string) {
  if (!getApp(slug) || !isPlatform(platform)) return null;
  return getNicheDetail(slug, platform, decodeURIComponent(id));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, platform, id } = await params;
  const found = load(slug, platform, id);
  return { title: found ? `@${found.post.handle} · ${found.post.views !== null ? views(found.post.views) : `${found.post.likes ?? "—"} likes`} — Niche · ${getApp(slug)?.name ?? slug}` : "Not found" };
}

/** What the post is, in the platform's words. */
function formatOf(p: NicheDetail): string {
  if (p.platform === "instagram") return p.mediaType === "video" ? "reel" : p.slideCount === 1 ? "photo" : `carousel${p.slideCount ? ` · ${p.slideCount} slides` : ""}`;
  return p.mediaType === "slideshow" ? `slideshow${p.slideCount ? ` · ${p.slideCount} slides` : ""}` : "video";
}

const countLabel = (p: NicheDetail) => (p.views !== null ? views(p.views) : p.likes !== null ? `${views(p.likes)} likes` : "—");

export default async function NichePostPage({ params }: { params: Params }) {
  const { slug, platform, id } = await params;
  const found = load(slug, platform, id);
  if (!found) notFound();
  const { post: p, more } = found;
  const s = encodeURIComponent(slug);
  const name = PLATFORM_NAME[p.platform];
  const body = captionBody(p.caption);
  const where = p.src === "scroll" ? "From your own scroll: every slide was pulled and read." : `Found by the niche search: ${p.found.map((f) => `#${f.keyword} · ${windowLabel(f.window)}`).join("; ")}.`;
  const missing = [p.views === null ? "views" : null, p.likes === null ? "likes (hidden by the author)" : null, p.shares === null ? "shares" : null, p.saves === null ? "saves" : null].filter(Boolean);

  return (
    <div className="page post">
      <header className="post__head">
        <p className="eyebrow">
          <Link href={`/app/${s}/niche`}>The niche</Link> · <PlatformIcon p={p.platform} /> {name} ·{" "}
          <a href={profileUrl(p.platform, p.handle)} target="_blank" rel="noopener noreferrer">@{p.handle}</a>
          {p.date ? <> · {shortDate(p.date)}</> : null}
        </p>
        <p className="post__nohook">
          The on-screen text of this post has not been read. The search holds its counts, its caption and its cover; open it on {name} to see it whole.
        </p>
        <p className="post__tier">
          {where}
          {missing.length ? ` ${name} does not report ${missing.join(", ")} here: shown as a dash, not 0.` : ""}
        </p>
      </header>

      <div className="post__body">
        <div className="post__asset">
          {p.slides.length ? (
            <ul className="post__slides">
              {p.slides.map((src, i) => (
                <li key={src}>
                  <img src={src} alt={`Slide ${i + 1} of ${p.slides.length}`} loading="lazy" />
                  <span className="post__slideno tabular">
                    {i + 1}/{p.slides.length}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Cover post={{ cover: p.cover, onScreen: null, handle: p.handle, views: p.views }} className="cover--large" />
          )}

          <div className="post__assetfoot">
            <TikTokLink href={p.url} label={`Open on ${name}`} />
            <span className="post__format">{formatOf(p)}</span>
          </div>
        </div>

        <div className="post__detail">
          <StatRow post={{ views: p.views, likes: p.likes, comments: p.comments, shares: p.shares, bookmarks: p.saves }} size="lg" />

          {body && (
            <section className="post__section">
              <h2 className="eyebrow">Caption</h2>
              <p className="post__caption">{body}</p>
            </section>
          )}

          {p.hashtags.length > 0 && (
            <section className="post__section">
              <h2 className="eyebrow">Hashtags</h2>
              <p className="post__hashtags">{p.hashtags.map((h) => `#${h}`).join("  ")}</p>
            </section>
          )}

          <section className="post__section">
            <h2 className="eyebrow">Sound</h2>
            <p className="post__sound">{p.sound || "—"}</p>
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Platform</h2>
            <p className="post__desc">
              <PlatformIcon p={p.platform} /> {name}
              {p.code ? <> · shortcode <code>{p.code}</code></> : <> · id <code>{p.id}</code></>}
            </p>
          </section>
        </div>
      </div>

      <StealThis post={{ onScreen: null, caption: p.caption, hashtags: p.hashtags, sound: p.sound, url: p.url }} platformName={name} />

      {more.length ? (
        <nav className="post__siblings" aria-label="Other niche posts by this account">
          <h2 className="eyebrow">
            More from <a href={profileUrl(p.platform, p.handle)} target="_blank" rel="noopener noreferrer">@{p.handle}</a> in the niche
          </h2>
          <ul>
            {more.slice(0, 8).map((x) => (
              <li key={x.id}>
                <Link href={nichePostHref(slug, x.platform, x.id)}>
                  <span className="tabular">{countLabel(x)}</span>
                  <span className="post__siblinghook">{captionBody(x.caption) || x.date}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
