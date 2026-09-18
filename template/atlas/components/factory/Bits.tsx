/**
 * The small pieces every end-product page is built from: a row of marks, a
 * section with its head, a room drawn where a section will appear, a face.
 * Server components; nothing here holds state.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export type MarkState = "open" | "inhand" | "approved" | "waiting" | "sentback" | "stale" | "sent" | "posted" | "killed";

/** A row of the pipeline's ring marks, for any list of states. */
export function MarkRow({ states, label, lg = false }: { states: MarkState[]; label: string; lg?: boolean }) {
  return (
    <span className={`marks${lg ? " marks--lg" : ""}`} role="img" aria-label={label}>
      {states.map((m, i) => (
        <svg key={i} viewBox="0 0 12 12" className={`mark mark--${m}`} aria-hidden="true">
          <circle className="mark__fill" cx="6" cy="6" r="4.2" />
          {m === "inhand" || m === "waiting" ? <path className="mark__fill" d="M6 1.8 A4.2 4.2 0 0 1 10.2 6 L6 6 Z" /> : null}
          {m === "sent" ? <path className="mark__half" d="M6 1.8 A4.2 4.2 0 0 0 6 10.2 Z" /> : null}
          {m === "killed" ? <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /> : null}
          <circle className="mark__ring" cx="6" cy="6" r="4.9" />
        </svg>
      ))}
    </span>
  );
}

/** A section: the title, a small word at the right, one link. */
export function Section({ title, small, link, id, children, className }: { title: ReactNode; small?: ReactNode; link?: { href: string; label: string } | null; id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={className}>
      <div className="section__head">
        <h2>{title}</h2>
        <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
          {small ? <span className="eyebrow">{small}</span> : null}
          {link ? <Link className="topbar__link" href={link.href}>{link.label}</Link> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A section with nothing in it yet: what will appear, and which phase fills it. Drawn as the space it will take. */
export function Room({ text, small, n = 3 }: { text: ReactNode; small?: ReactNode; n?: number }) {
  return (
    <ul className="strip strip--empty">
      <li>
        <div className="pending">
          {text}
          {small ? <small>{small}</small> : null}
        </div>
      </li>
      {Array.from({ length: Math.max(0, n - 1) }, (_, i) => (
        <li key={i}><div className="pending" /></li>
      ))}
    </ul>
  );
}

/** A handle's profile picture as a circle, or the hatched circle with a word when there is none. */
export function Face({ src, name, size = "", word = "no pic", square = false }: { src: string | null; name: string; size?: "" | " face--lg"; word?: string; square?: boolean }) {
  const cls = `face${square ? " face--sq" : ""}${size}`;
  if (src) return <img className={cls} src={src} alt={name} />;
  return (
    <span className={`${cls} face--none`} role="img" aria-label={`${name}: no profile picture yet`}>
      {word}
    </span>
  );
}

export const n = (v: number) => v.toLocaleString("en-US");
export const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(2)}%` : "0.00%");
export const word = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;
export const short = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 10_000 ? `${Math.round(v / 1000)}K` : n(v));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "8 Jul 26" */
export function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}
/** "Wed 17 Sep" */
export function wdm(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}
/** A fact like "6 posted" with the number in bold; a fact without a leading number prints as it is. */
export function Fact({ text }: { text: string }) {
  const m = text.match(/^(\d[\d,.]*(?: of \d[\d,.]*)?)\s(.*)$/);
  if (m) return <span><b>{m[1]}</b> {m[2]}</span>;
  const k = text.match(/^(.*?):\s(.+)$/);
  if (k) return <span>{k[1]}: <b>{k[2]}</b></span>;
  return <span>{text}</span>;
}
