/**
 * The state of a section page at its top: not started, in progress, done.
 * Informative only: what fills the page, which phase, and what the agent
 * asked for in the conversation.
 */

import type { ReactNode } from "react";

import { MarkRow } from "./Bits";

export function StateBand({ state, text, ask, phase }: { state: "todo" | "now" | "done"; text: ReactNode; ask?: string | null; phase?: string }) {
  const word = { todo: "Not started", now: "In progress", done: "Done" }[state];
  const mark = { todo: "open", now: "inhand", done: "approved" }[state] as "open" | "inhand" | "approved";
  return (
    <section className={`band is-${state}`} aria-label="State">
      <div className="band__head"><MarkRow states={[mark]} label={word} /><b>{word}</b>{phase ? <span className="eyebrow">{phase}</span> : null}</div>
      <p className="band__text">{text}</p>
      {ask ? <p className="band__ask"><span className="track__k">Asked of you, in the conversation</span>{ask}</p> : null}
    </section>
  );
}
