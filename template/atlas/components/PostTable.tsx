"use client";

/**
 * The full post table, sortable by any metric.
 *
 * Sorting is a real <button> in every column header with aria-sort, so a driver
 * can say "sort by shares" and click one named node — and the row order is
 * announced rather than merely animating. Rows keep stable accessible names
 * (the post id never renumbers) which is what makes two consecutive screen
 * reads comparable.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Post } from "@/lib/data";
import { InlineMarkdown } from "./Markdown";

type Key = "rank" | "date" | "views" | "likes" | "comments" | "shares" | "bookmarks";

const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
  { key: "rank", label: "#", numeric: true },
  { key: "date", label: "Date", numeric: false },
  { key: "views", label: "Views", numeric: true },
  { key: "likes", label: "Likes", numeric: true },
  { key: "comments", label: "Comments", numeric: true },
  { key: "shares", label: "Shares", numeric: true },
  { key: "bookmarks", label: "Saves", numeric: true },
];

function n(v: number): string {
  return v.toLocaleString("en-US");
}

export default function PostTable({ posts }: { posts: Post[] }) {
  const [key, setKey] = useState<Key>("views");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...posts];
    copy.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [posts, key, dir]);

  const toggle = (k: Key) => {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir(k === "date" ? "desc" : "desc");
    }
  };

  return (
    <div className="ptable__wrap">
      <table className="ptable">
        <caption className="sr-only">
          Every scraped post, sortable. Currently sorted by {key}, {dir === "asc" ? "ascending" : "descending"}.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={key === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => toggle(c.key)} className={key === c.key ? "is-sorted" : ""}>
                  {c.label}
                  <span aria-hidden="true">{key === c.key ? (dir === "asc" ? " ↑" : " ↓") : ""}</span>
                </button>
              </th>
            ))}
            <th scope="col">On-screen hook</th>
            <th scope="col">Sound</th>
            <th scope="col">Format</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id}>
              <td className="tabular">{p.rank}</td>
              <td className="tabular">{p.date}</td>
              <td className="tabular ptable__lead">
                <Link href={`/post/${p.id}`}>{n(p.views)}</Link>
              </td>
              <td className="tabular">{n(p.likes)}</td>
              <td className="tabular">{n(p.comments)}</td>
              <td className="tabular">{n(p.shares)}</td>
              <td className="tabular">{n(p.bookmarks)}</td>
              <td className="ptable__hook">
                {p.onScreen ? (
                  <Link href={`/post/${p.id}`}>
                    <InlineMarkdown text={p.onScreen} />
                  </Link>
                ) : (
                  <span className="ptable__none">no on-screen text</span>
                )}
              </td>
              <td className="ptable__sound">{p.sound || "—"}</td>
              <td>{p.format}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
