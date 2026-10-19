/**
 * One reaction as a card (lib/reactions.ts ReactionCard): the range playing in a loop
 * from the source post, the preview sheet, the handle, the tags, the expression beats,
 * the burned-in text and the route fit, with a link to its /reactions entry. Stage 1 and
 * stage 2 show it for the brief's reaction_reference and for a pick that video-plan has
 * not copied yet; the timeline shows it on the reaction checkpoint (compact). No file
 * access here: the Timeline is a client component.
 */

import Link from "next/link";

import type { Fit, ReactionCard } from "@/lib/reactions";
import { RangePlayer } from "./RangePlayer";
import "@/app/reactions/reactions.css";

const word = (f: Fit | null) => (f?.ok === true ? "fits" : f?.ok === false ? "no" : "not known");
const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export function ReactionCardView({ c, label, compact = false }: { c: ReactionCard; label: string; compact?: boolean }) {
  const beats = c.beats.length ? (
    <ol className="rx-beats">
      {c.beats.map((b, i) => (
        <li key={i}><span className="tabular">{secs(b.start_s)}–{secs(b.end_s)} s</span> {b.face}{b.eyes ? `; eyes ${b.eyes}` : ""}{b.head ? `; head ${b.head}` : ""}</li>
      ))}
    </ol>
  ) : <p className="rxc__none">No expression beats written yet.</p>;
  return (
    <figure className={`rxc${compact ? " rxc--compact" : ""}`} aria-label={`${label}: the reaction of ${c.handle}, ${secs(c.start)} to ${secs(c.end)} s`}>
      <p className="rxc__label">{label}</p>
      <div className="rxc__media">
        {c.video ? <RangePlayer className="rxc__player" src={c.video} start={c.start} end={c.end} label={`The reaction of ${c.handle}, ${secs(c.start)} to ${secs(c.end)} s, in a loop`} /> : <p className="rxc__none">The post&apos;s video is not served here.</p>}
        {c.preview ? <img className="rxc__sheet" src={c.preview} alt={`Frames of the reaction of ${c.handle}`} loading="lazy" /> : null}
      </div>
      <figcaption className="rxc__body">
        <p className="rxc__head">
          <b>{c.handle}</b> · <span className="tabular">{secs(c.start)}–{secs(c.end)} s</span>
          {c.entryId ? <> · <Link href={`/reactions/${c.entryId}`}>{c.entryId}</Link>{c.status ? ` (${c.status})` : ""}</> : " · not in the reaction library"}
        </p>
        {!c.entryId && c.sameIn ? <p className="rxc__hint">The library has this post: <Link href={`/reactions/${c.sameIn}`}>{c.sameIn}</Link>.</p> : null}
        <p className="rxc__tags">{c.tags.length ? c.tags.join(" · ") : "no tags"}</p>
        <p className="rxc__fit">
          Face replace: {word(c.faceReplace)}{c.faceReplace?.why ? ` — ${c.faceReplace.why}` : ""}. Written route: {word(c.written)}{c.written?.why ? ` — ${c.written.why}` : ""}.
          {c.planRoute ? ` The plan uses: ${c.planRoute === "face_replace" ? "face replace" : c.planRoute === "none" ? "the written route" : c.planRoute}.` : ""}
        </p>
        {compact ? <details className="rxc__more"><summary>Expression beats ({c.beats.length})</summary>{beats}</details> : beats}
        <p className="rxc__text">Burned-in text: {c.burnedIn.length ? c.burnedIn.join(" · ") : "none written"}</p>
        <p className="rxc__links">
          {c.entryId ? <Link href={`/reactions/${c.entryId}`}>The library entry</Link> : null}
          {c.entryId && c.postHref ? " · " : null}
          {c.postHref ? <Link href={c.postHref}>The post</Link> : null}
          {(c.entryId || c.postHref) && c.url ? " · " : null}
          {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">Open on {c.url.includes("instagram.com") ? "Instagram" : "TikTok"}</a> : null}
        </p>
      </figcaption>
    </figure>
  );
}
