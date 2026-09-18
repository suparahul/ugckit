/**
 * What waits: one card per post of the day, the ones waiting for you first.
 * The frame at the left shows the first picture as soon as one exists, and
 * the step's word until then; under it the marks and the state sentence from
 * lib/production (the whole vocabulary lives there). One pill per card: the
 * Review buttons open the post page; they do not move a phase.
 */

import Link from "next/link";

import type { Handle } from "@/lib/handles";
import { postPath, type PostState } from "@/lib/production";
import { slotKey, slotTimes } from "@/lib/slots";
import { Marks } from "@/components/production/Marks";
import { fileUrl } from "@/components/production/Frame";
import { Face, n } from "./Bits";

export type Who = "you" | "agent" | "set";

/** Whose turn a post is, for the strip's order and the card's edge. */
export function whoOf(s: PostState): Who {
  if (s.waiting) return "you";
  if (s.stage === "ready" && s.sent && s.sent.mode !== "direct") return "you";
  if (s.stage === "ready") return "set";
  return "agent";
}

export function pillOf(s: PostState): string | null {
  if (s.killed) return null;
  if (s.waiting) return s.stage === "idea" ? "Review the idea" : s.stage === "plan" ? "Review the plan" : "Review the final";
  if (s.stage === "ready" && s.sent && s.sent.mode !== "direct") return "Mark as posted";
  if (s.stage === "ready") return "Open the deck";
  return null;
}

/** The first picture of the post, as a URL, or null. */
export function firstPicture(s: PostState): string | null {
  const f = s.slides[0]?.approved ?? s.slides[0]?.current ?? null;
  return f ? fileUrl(f) : null;
}

export function WaitCard({ s, handle }: { s: PostState; handle: Handle | null }) {
  const who = whoOf(s);
  const sched = s.stage === "ready" && s.sent?.mode === "direct";
  const cls = { you: " is-you", agent: " is-agent", set: " is-set" }[who] + (sched ? " is-sched" : "");
  const slides = s.deck?.slides.length ?? null;
  const pic = firstPicture(s);
  const have = s.slides.filter((x) => x.status === "approved" || x.status === "candidate").length;
  let frame;
  if (pic) frame = <span className="wait__frame wait__frame--pic"><img src={pic} alt={`Slide 1 of ${s.row.topic}`} /><span className="wait__n">1 / {slides}</span></span>;
  else if (s.stage === "final") frame = <span className="wait__frame is-render" role="img" aria-label={`Pictures being made, ${have} of ${slides}`}><span className="wait__prog" style={{ "--p": `${slides ? Math.round((100 * have) / slides) : 0}%` } as React.CSSProperties} /><span>{have} of {slides}<br /><small>pictures</small></span></span>;
  else if (s.stage === "plan" || s.stage === "ready") frame = <span className="wait__frame" role="img" aria-label={`Deck written, ${slides} slides, no pictures yet`}><span>{slides} slides<br /><small>written</small></span></span>;
  else if (s.stage === "planned") frame = <span className="wait__frame" role="img" aria-label="Deck being written"><span>writing<br /><small>the deck</small></span></span>;
  else frame = <span className="wait__frame" role="img" aria-label="Idea only, no deck yet"><span>idea<br /><small>{s.dimension}</small></span></span>;
  const times = slotTimes(handle?.slots);
  const key = slotKey(s.row.slot);
  const when = sched && s.sent?.scheduledAt ? `goes out ${s.sent.scheduledAt.slice(11, 16)} UTC` : `${s.row.slot}${times[key] ? ` ${times[key]}` : ""}`;
  const pill = pillOf(s);
  const href = postPath(s.row);
  const src = s.row.source.handle ? `after @${s.row.source.handle}${s.row.source.views ? ` · ${n(s.row.source.views)} views` : ""}` : "";
  return (
    <article className={`wait${cls}`}>
      {frame}
      <span className="wait__under"><Marks state={s} /><span className={`state${who === "you" ? " is-waiting" : ""}${sched ? " is-sched" : ""}`}>{s.sentence}</span></span>
      <span className="wait__who"><Face src={handle?.profile ?? null} name={s.row.handle} />{s.row.handle}<small>· {when}</small></span>
      <span className="wait__topic"><Link href={href}>{s.row.topic}</Link></span>
      <span className="wait__format">{s.row.format}{slides ? ` · ${slides} slides` : ""} · {s.dimension}</span>
      <span className="wait__src">{src}</span>
      <span className="wait__act">{pill ? <Link className={`pill${who === "you" ? "" : " pill--quiet"}`} href={href}>{pill}</Link> : <span className="state">agent’s turn</span>}</span>
    </article>
  );
}

/** The posts that go out today without another decision: the highlighted line under the waiting strip. */
export function SchedBand({ states, handles }: { states: PostState[]; handles: Handle[] }) {
  const out = states.filter((s) => s.stage === "ready" && s.sent);
  if (!out.length) return null;
  const rest = states.filter((s) => !s.killed && s.stage !== "posted" && s.stage !== "read").length - out.length;
  return (
    <div className="sched">
      <p className="sched__k"><span className="sched__dot" aria-hidden="true" />Going out today · <b>{out.length}</b> {out.length === 1 ? "sent" : "sent"}{rest > 0 ? ` · ${rest} more once approved` : ""}</p>
      {out.map((s) => {
        const h = handles.find((x) => x.short === s.row.short) ?? null;
        const direct = s.sent?.mode === "direct";
        return (
          <Link key={s.row.key} className="sched__row" href={postPath(s.row)}>
            <Face src={h?.profile ?? null} name={s.row.handle} />
            <span className="sched__when">{s.row.slot}{direct && s.sent?.scheduledAt ? ` ${s.sent.scheduledAt.slice(11, 16)} UTC` : ""}</span>
            <b>{s.row.handle}</b>
            <span className="sched__topic">{s.row.topic}</span>
            <Marks state={s} />
            <span className="state is-sched">{direct ? "scheduled through the posting service" : "in TikTok drafts · post it from the phone"}</span>
          </Link>
        );
      })}
    </div>
  );
}
