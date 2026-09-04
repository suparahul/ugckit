/**
 * The post page — the leaf.
 *
 * Quiet, sober, text-first. Cover, the mp4 where we have it, caption verbatim,
 * the transcribed on-screen hook, the full metric row, sound, hashtags, date, an
 * open-on-TikTok link, and a Steal this panel with everything copyable.
 *
 * What the corpus holds for a post varies — most posts are metrics plus a hook
 * read off the cover; about a hundred have been deep-dived with an mp4 or slides
 * and a frame-by-frame read. The page renders the tier it actually has and says
 * which, rather than implying every post was watched.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { getPost, commas, shortDate, views, captionBody } from "@/lib/data";
import { Cover, StatRow, StealThis, TagChips, TikTokLink } from "@/components/Bits";
import Markdown from "@/components/Markdown";
import "./post.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = getPost(id);
  return { title: found ? `@${found.post.handle} · ${views(found.post.views)} — The Atlas` : "Not found" };
}

const TIER_NOTE = {
  deep: "Deep-dived — the video or slides were watched frame by frame.",
  hook: "The on-screen hook was read off the post's cover image.",
  metrics: "Metrics only so far. The hook pass has not reached this post.",
} as const;

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = getPost(id);
  if (!found) notFound();
  const { post: p, account: a, brand } = found;

  const body = captionBody(p.caption);
  // Anything longer than a headline is a transcript, not a hook.
  const shortHook = p.onScreen && p.onScreen.length <= 200 ? p.onScreen : "";
  const longHook = p.onScreen && !shortHook ? p.onScreen : "";

  return (
    <div className="page post">
      <header className="post__head">
        <p className="eyebrow">
          <Link href={`/brand/${brand.id}`}>{brand.name}</Link> · <Link href={`/account/${a.handle}`}>@{a.handle}</Link> ·{" "}
          {shortDate(p.date)}
        </p>
        {shortHook ? (
          // A single spoken line earns the hero treatment. A frame-by-frame
          // transcript is not a headline — it runs to hundreds of words and
          // shoved a wall of text above the video, so it renders down in the
          // detail column under On-screen text instead.
          <blockquote className="post__hook verbatim">
            <Markdown text={shortHook} />
          </blockquote>
        ) : !p.onScreen ? (
          <p className="post__nohook">
            No on-screen text on this post. That is a finding, not a gap — some networks put the product on the screen and
            nothing else.
          </p>
        ) : null}
        <p className="post__tier">
          {TIER_NOTE[p.tier]}
          {p.hookSource === "cover" && " Transcribed from the cover, not the full video."}
        </p>
      </header>

      <div className="post__body">
        <div className="post__asset">
          {p.video ? (
            <video className="post__video" src={p.video} controls preload="metadata" poster={p.cover || undefined} playsInline>
              Your browser cannot play this mp4. It is at <a href={p.video}>{p.video}</a>.
            </video>
          ) : p.slides.length ? (
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
            <Cover post={p} className="cover--large" />
          )}

          <div className="post__assetfoot">
            <TikTokLink href={p.url} />
            <span className="post__format">
              {p.format}
              {p.format === "slideshow" && p.slideCount ? ` · ${p.slideCount} slides` : ""}
              {p.video ? " · mp4 held" : ""}
            </span>
          </div>
        </div>

        <div className="post__detail">
          <StatRow post={p} size="lg" />

          {longHook && (
            <section className="post__section">
              <h2 className="eyebrow">On-screen text</h2>
              <Markdown className="prose post__onscreen" text={longHook} />
            </section>
          )}

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
            <p className="post__sound">
              {p.sound || "—"}
              {p.soundArtist ? ` · ${p.soundArtist}` : ""}
            </p>
            <TagChips tags={p.tags.sound} dimension="sound" />
          </section>

          {/* Pull a thread. Every tag here rails up the same pattern across the
              whole corpus, which is how the cross-network findings emerge from
              something someone in the room chose to click. */}
          <section className="post__section">
            <h2 className="eyebrow">Threads</h2>
            <div className="post__threads">
              <TagChips tags={p.tags.hook} dimension="hook" showEvidence />
              <TagChips tags={p.tags.insertion} dimension="insertion" showEvidence />
              <TagChips tags={p.tags.disclosure} dimension="disclosure" showEvidence />
              <TagChips tags={p.tags.format} dimension="format" />
            </div>
          </section>

          {p.imageDescription && (
            <section className="post__section">
              <h2 className="eyebrow">What the cover shows</h2>
              <p className="post__desc">{p.imageDescription}</p>
            </section>
          )}
        </div>
      </div>

      {p.notes && (
        <section className="post__notes">
          <h2 className="eyebrow">Read frame by frame</h2>
          {p.notes.structure && (
            <div className="post__note">
              <h3>Structure</h3>
              <Markdown className="prose" text={p.notes.structure} />
            </div>
          )}
          {p.notes.visualStyle && (
            <div className="post__note">
              <h3>Visual style</h3>
              <Markdown className="prose" text={p.notes.visualStyle} />
            </div>
          )}
          {p.notes.notes && (
            <div className="post__note">
              <h3>Notes</h3>
              <Markdown className="prose" text={p.notes.notes} />
            </div>
          )}
        </section>
      )}

      <StealThis post={p} />

      <nav className="post__siblings" aria-label="Other posts by this account">
        <h2 className="eyebrow">
          More from <Link href={`/account/${a.handle}`}>@{a.handle}</Link>
        </h2>
        <ul>
          {a.posts
            .filter((x) => x.id !== p.id)
            .sort((x, y) => y.views - x.views)
            .slice(0, 8)
            .map((x) => (
              <li key={x.id}>
                <Link href={`/post/${x.id}`}>
                  <span className="tabular">{views(x.views)}</span>
                  <span className="post__siblinghook">{x.onScreen || captionBody(x.caption) || x.date}</span>
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
}
