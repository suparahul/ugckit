"use client";

/**
 * A wide table with its key columns shown and the rest behind one toggle:
 * the post table of anatomy.md, the value tables, the account table.
 */

import { useState } from "react";

const RIGHT = /^(#|slides|views|saves\/view|shares\/view|comments\/view|posts|followers)$/i;

export function Anat({ head, rows, keys, lede }: { head: string[]; rows: string[][]; keys?: string[]; lede?: string }) {
  const [all, setAll] = useState(!keys);
  const isKey = (h: string) => !keys || keys.some((k) => k.toLowerCase() === h.toLowerCase());
  const cls = (h: string) => `${isKey(h) ? "is-key" : "is-more"}${RIGHT.test(h) ? " plist__num" : ""}`;
  const cell = (v: string) => {
    const m = v.match(/^\[([^\]]+)\]\((https?:[^)]+)\)$/);
    if (m) return <a href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a>;
    return v.replace(/`/g, "");
  };
  const more = keys ? head.filter((h) => !isKey(h)).length : 0;
  return (
    <>
      {lede ? <p className="lede lede--full">{lede}</p> : null}
      <p className="state" style={{ margin: "0 0 8px" }}>
        {rows.length} rows · {head.length} columns
        {more ? <> · <button type="button" className="read__again" onClick={() => setAll((v) => !v)}>{all ? `Show the ${head.length - more} key columns` : `Show all ${head.length} columns`}</button></> : null}
      </p>
      <div className="plist__wrap" style={{ marginTop: 0 }}>
        <table className={`plist plist--wide anat${all ? " is-all" : ""}`}>
          <thead><tr>{head.map((h, i) => <th key={i} className={cls(h)} style={RIGHT.test(h) ? { textAlign: "right" } : undefined}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{head.map((h, j) => <td key={j} className={cls(h)}>{cell(r[j] ?? "")}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
