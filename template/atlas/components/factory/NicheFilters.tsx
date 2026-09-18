"use client";

/**
 * The one row of pickers over the niche grid. Every pick is a URL: the
 * server filters the posts by the search params, this component only writes
 * them. A default value drops out of the URL.
 */

import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";

export type PickOpt = { v: string; label: string; n?: number };
export type Pick = { key: string; label: string; def: string; opts: PickOpt[] };
export type Check = { key: string; label: string };

export function NicheFilters({ picks, checks, values, sort, anchor = "wins", keep = [] }: { picks: Pick[]; checks: Check[]; values: Record<string, string>; sort?: Pick; anchor?: string; /** Params kept as they are, outside the picks (the app, the view). */ keep?: string[] }) {
  const router = useRouter();
  const path = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const defs = Object.fromEntries([...picks, ...(sort ? [sort] : [])].map((p) => [p.key, p.def]));
  const go = (key: string, v: string) => {
    const u = new URLSearchParams();
    const next = { ...values, [key]: v };
    for (const [k, val] of Object.entries(next)) {
      if (k === "n") continue;
      const def = defs[k] ?? "";
      if (val && (val !== def || keep.includes(k))) u.set(k, val);
    }
    bar.current?.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
    const q = u.toString();
    router.push(`${path}${q ? `?${q}` : ""}#${anchor}`, { scroll: false });
  };
  const one = (p: Pick) => {
    const cur = values[p.key] ?? p.def;
    const on = p.opts.find((o) => o.v === cur) ?? p.opts[0];
    return (
      <details key={p.key} className={`pick pick--lab${cur !== p.def ? " is-set" : ""}`}>
        <summary><small>{p.label}</small><b className="pick__val">{on?.label}</b></summary>
        <ul className="pick__list">
          {p.opts.map((o) => (
            <li key={o.v}>
              <a href={`#${anchor}`} aria-current={o.v === cur ? "true" : undefined} onClick={(e) => { e.preventDefault(); go(p.key, o.v); }}>
                {o.label}{o.n != null ? <span className="n">{o.n.toLocaleString("en-US")}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      </details>
    );
  };
  return (
    <div className="prod__bar filt" role="toolbar" aria-label="Filters" ref={bar}>
      {picks.map(one)}
      {checks.map((c) => (
        <label key={c.key} className="hx__check">
          <input type="checkbox" checked={values[c.key] === "1"} onChange={(e) => go(c.key, e.target.checked ? "1" : "")} /> {c.label}
        </label>
      ))}
      {sort ? <div className="filt__sort">{one(sort)}</div> : null}
    </div>
  );
}
