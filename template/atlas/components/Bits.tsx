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
import { head } from "@/lib/text";

/** A count, or an em dash when the platform does not report it (a niche post on Instagram: no saves, no shares, no views on a photo, hidden likes). Never 0 for "not reported". */
const count = (value: number | null, size: "sm" | "lg") => (value === null ? "—" : size === "lg" ? commas(value) : views(value));

/** The five counts of a post; null is "not reported". An Atlas post always has all five. */
export type Counts = { views: number | null; likes: number | null; comments: number | null; shares: number | null; bookmarks: number | null };

/** The five metrics, in the order the platform shows them. */
export function StatRow({ post, size = "sm" }: { post: Counts; size?: "sm" | "lg" }) {
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
          <dd className="tabular">{count(value, size)}</dd>
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

/** Open on TikTok (or, with its label, on Instagram). On every card and every header, per the spec. */
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
export function Cover({ post, className = "" }: { post: Pick<Post, "cover" | "onScreen" | "handle"> & { views: number | null }; className?: string }) {
  if (post.cover) {
    return (
      <img
        className={`cover ${className}`}
        src={post.cover}
        alt={post.onScreen ? `Cover: ${head(post.onScreen, 110)}` : `Post by @${post.handle}${post.views === null ? "" : `, ${views(post.views)} views`}`}
        loading="lazy"
        width={525}
        height={700}
      />
    );
  }
  return (
    <span className={`cover cover--none ${className}`} aria-label={`No cover yet for this post${post.views === null ? "" : ` — ${views(post.views)} views`}`}>
      <span className="cover__views tabular">{count(post.views, "sm")}</span>
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
export function StealThis({ post, platformName = "TikTok" }: { post: Pick<Post, "onScreen" | "caption" | "hashtags" | "sound" | "url">; platformName?: string }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "On-screen hook", value: post.onScreen },
    { label: "Caption", value: post.caption || null },
    { label: "Hashtags", value: post.hashtags.length ? post.hashtags.map((h) => `#${h}`).join(" ") : null },
    { label: "Sound", value: post.sound },
    { label: `${platformName} URL`, value: post.url },
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
