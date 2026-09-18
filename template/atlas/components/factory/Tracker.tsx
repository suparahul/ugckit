/**
 * The tracker: the eight phases in one row, the one in progress named, a
 * "Now" sentence, the act the agent asked for in the conversation, and the
 * note that the order is a guide, not a gate. No control: the agent does the
 * work and reports here. The band is the door into the canvas — the head and
 * every phase open it, a phase at its own card.
 */

import Link from "next/link";

import type { Canvas } from "@/lib/canvas";
import { MarkRow, type MarkState } from "./Bits";

const MARK: Record<string, MarkState> = { done: "approved", now: "inhand", todo: "open" };
const WORD: Record<string, string> = { done: "done", now: "in progress", todo: "not started" };

export function Tracker({ canvas }: { canvas: Canvas }) {
  const href = `/app/${encodeURIComponent(canvas.slug)}/canvas`;
  return (
    <section className="track" aria-label="Where the work is">
      <div className="track__head">
        <h2><Link href={href}>Where the work is</Link></h2>
        <span className="eyebrow"><Link href={href}>{canvas.done} of {canvas.phases.length} done · open the canvas</Link></span>
      </div>
      <ol className="track__row">
        {canvas.phases.map((p) => (
          <li key={p.key}>
            <Link className={`track__step is-${p.state}`} href={`${href}#phase-${p.n}`} aria-label={`${p.title}, ${WORD[p.state]} · open on the canvas`}>
              <span className="track__n">{p.n}</span>
              <MarkRow states={[p.changedUpstream ? "stale" : MARK[p.state]]} label={p.changedUpstream ? "changed upstream" : WORD[p.state]} />
              <span className="track__t">{p.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="track__now"><span className="track__k">Now</span>{canvas.nowSentence}</p>
      {canvas.ask ? <p className="track__ask"><span className="track__k">Asked of you, in the conversation</span>{canvas.ask}</p> : null}
      <p className="track__note">The order is a guide, not a gate. The agent does the work and reports here; links from your scroll can come at any time, and production repeats every week.</p>
    </section>
  );
}
