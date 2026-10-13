"use client";

/**
 * The search box over the All posts grid and the Niche page. The search is a
 * URL like every other filter (`search=`): this component only writes it, a
 * short pause after the last key, and the server filters the posts by it
 * (lib/search.ts). Escape or the ✕ clears it. The paging param (`page`, or
 * the Niche page's `n`) drops out on every change.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const PAUSE_MS = 180;

export function PostSearch({ value, count, placeholder, drop = ["page"] }: { value: string; /** The matches line, from the server. */ count: string; placeholder: string; /** Params that go back to their default on a new search. */ drop?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(value);
  const [pending, start] = useTransition();
  const sent = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The URL moved without this box (a tab, the back button, a clear link): follow it. */
  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setText(value);
    }
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (v: string) => {
    const t = v.trim();
    sent.current = t;
    const u = new URLSearchParams(params?.toString() ?? "");
    if (t) u.set("search", t);
    else u.delete("search");
    for (const k of drop) u.delete(k);
    const q = u.toString();
    start(() => router.replace(`${path}${q ? `?${q}` : ""}`, { scroll: false }));
  };
  const type = (v: string) => {
    setText(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(v), PAUSE_MS);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setText("");
    push("");
  };

  return (
    <div className={`psearch${pending ? " is-pending" : ""}`} role="search">
      <label className="psearch__box">
        <span className="psearch__label">search</span>
        <input type="search" value={text} placeholder={placeholder} aria-label="Search the posts" autoComplete="off" spellCheck={false} onChange={(e) => type(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && text) { e.preventDefault(); clear(); } }} />
        {text ? <button type="button" className="psearch__clear" aria-label="Clear the search" onClick={clear}>✕</button> : null}
      </label>
      <span className="psearch__count" aria-live="polite">{count}</span>
    </div>
  );
}
