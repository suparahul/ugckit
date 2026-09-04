/**
 * Shared server components. Everything here is evidence-first: a number is
 * always next to the thing it describes, a tag is always a link to the thread
 * that contains it, and anything a real person wrote is quoted verbatim and
 * made copyable rather than paraphrased.
 */

import Link from "next/link";
import type { Post, Tag } from "@/lib/data";
import { commas, shortDate, views } from "@/lib/data";
import CopyButton from "./CopyButton";

/** The five metrics, in the order the platform shows them. */
export function StatRow({ post, size = "sm" }: { post: Post; size?: "sm" | "lg" }) {
  const cells = [
    ["views", post.views],
    ["likes", post.likes],
    ["comments", post.comments],
    ["shares", post.shares],
    ["saves", post.bookmarks],
  ] as const;
  return (
    <dl className={`stats stats--${size}`}>
      {cells.map(([label, value]) => (
        <div key={label}>
          <dd className="tabular">{size === "lg" ? commas(value) : views(value)}</dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tags as chips. Every one is a thread — this is the connective tissue that
 * makes the app a tool rather than a gallery. A chip carrying evidence shows it,
 * because the tag is a quotation, never an assertion.
 */
export function TagChips({
  tags,
  dimension,
  showEvidence = false,
}: {
  tags: Tag[];
  dimension: string;
  showEvidence?: boolean;
}) {
  if (!tags.length) return null;
  return (
    <ul className="chips">
      {tags.map((t) => (
        <li key={t.id}>
          <Link className="chip" href={`/thread/${dimension}/${t.id}`}>
            {t.label}
            {showEvidence && t.evidence && <span className="chip__ev">“{t.evidence}”</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Open on TikTok. On every card and every header, per the spec. */
export function TikTokLink({ href, label = "Open on TikTok" }: { href: string; label?: string }) {
  return (
    <a className="tiktok" href={href} target="_blank" rel="noopener noreferrer">
      {label}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}

/**
 * A post cover, or an honest stand-in. Most of the corpus has no cover on disk
 * yet — covers only started being kept recently — so rather than a broken image
 * or a grey box, a missing cover prints the post's own numbers. It still reads
 * as evidence.
 */
export function Cover({ post, className = "" }: { post: Post; className?: string }) {
  if (post.cover) {
    return (
      <img
        className={`cover ${className}`}
        src={post.cover}
        alt={post.onScreen ? `Cover: ${post.onScreen.slice(0, 110)}` : `Post by @${post.handle}, ${views(post.views)} views`}
        loading="lazy"
        width={525}
        height={700}
      />
    );
  }
  return (
    <span className={`cover cover--none ${className}`} aria-label={`No cover yet for this post — ${views(post.views)} views`}>
      <span className="cover__views tabular">{views(post.views)}</span>
      <span className="cover__note">cover not yet fetched</span>
    </span>
  );
}

/** A post as a card, for grids and rails. */
export function PostCard({ post, showHandle = false }: { post: Post; showHandle?: boolean }) {
  return (
    <article className="pcard">
      <Link className="pcard__link" href={`/post/${post.id}`}>
        <Cover post={post} />
        <span className="pcard__body">
          {showHandle && <span className="pcard__handle">@{post.handle}</span>}
          <span className="pcard__views tabular">{views(post.views)}</span>
          {post.onScreen && <span className="pcard__hook">{post.onScreen}</span>}
          <span className="pcard__date">
            {shortDate(post.date)} · {post.format}
          </span>
        </span>
      </Link>
      <TikTokLink href={post.url} label="TikTok" />
    </article>
  );
}

/**
 * Steal this. Everything copyable verbatim — captions, hooks, hashtag sets,
 * sound names. The room is made of tinkerers; they should leave with the raw
 * material, not a description of it.
 */
export function StealThis({ post }: { post: Post }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "On-screen hook", value: post.onScreen },
    { label: "Caption", value: post.caption || null },
    { label: "Hashtags", value: post.hashtags.length ? post.hashtags.map((h) => `#${h}`).join(" ") : null },
    { label: "Sound", value: post.sound },
    { label: "TikTok URL", value: post.url },
  ];
  const present = rows.filter((r) => r.value);

  return (
    <section className="steal" aria-labelledby="steal-heading">
      <div className="section__head">
        <h2 id="steal-heading" className="eyebrow">
          Steal this
        </h2>
        <CopyButton
          label="Copy all"
          value={present.map((r) => `${r.label}\n${r.value}`).join("\n\n")}
        />
      </div>
      <dl className="steal__list">
        {present.map((r) => (
          <div className="steal__row" key={r.label}>
            <dt>{r.label}</dt>
            <dd>
              <span className="steal__value">{r.value}</span>
              <CopyButton label="Copy" value={r.value!} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A gap in the corpus, shown rather than hidden. */
export function Pending({ children }: { children: React.ReactNode }) {
  return <p className="pending">{children}</p>;
}
