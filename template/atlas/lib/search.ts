/**
 * The search box of the All posts page and the Niche page: one rule for
 * every tab, grid and table. The words of
 * the search are matched without case, each one anywhere in the post's text,
 * and a post matches when every word is found. Words in double quotes are one
 * phrase, found only together and in that order; a quote left open runs to the
 * end, so the box reads as a phrase while it is being typed. Pure: the page
 * uses it, lib/search.test.ts checks it.
 */

import type { Brand, Post } from "./data.ts";
import type { BatchPost } from "./niche.ts";
import type { PostState } from "./production.ts";

type Field = string | null | undefined;

/** A quoted phrase (straight or curly quotes, the closing one optional), or one word outside quotes. */
const TERM = /["“”]([^"“”]*)(?:["“”]|$)|[^\s"“”]+/g;

/** The words and quoted phrases of a search, lower case, a phrase's spaces made single. An empty search has none and matches everything. */
export function terms(search: string): string[] {
  const out: string[] = [];
  for (const m of search.toLowerCase().matchAll(TERM)) {
    const t = m[1] === undefined ? m[0] : m[1].trim().replace(/\s+/g, " ");
    if (t) out.push(t);
  }
  return out;
}

/** The search as a sentence shows it: in curly quotes, unless it holds quotes of its own. */
export const quoted = (search: string): string => (/["“”]/.test(search) ? search : `“${search}”`);

/**
 * True when every word or phrase is somewhere in the fields. A leading @ is
 * dropped, so "@handle" finds the handle. A field's spaces and line breaks are
 * made single so a phrase finds its words across a line break, but never
 * across two fields.
 */
export function matches(words: string[], fields: Field[]): boolean {
  if (!words.length) return true;
  const text = fields.filter((f): f is string => !!f).map((f) => f.replace(/\s+/g, " ")).join("\n").toLowerCase();
  return words.every((w) => text.includes(w.replace(/^@(?=.)/, "")));
}

/** A research post: the on-screen hook, the caption, the handle, the app, the id and the date. */
export const postFields = (p: Post, b: Pick<Brand, "name" | "fullName">): Field[] => [p.onScreen, p.caption, p.handle, b.name, b.fullName, p.id, p.date];

/** One of our posts: the topic, the deck's title, caption and first slide words, the handle, the key and the dates. */
export const stateFields = (st: Pick<PostState, "row" | "deck" | "posted" | "link">): Field[] => [
  st.row.topic,
  st.deck?.title,
  st.deck?.caption,
  ...(st.deck?.slides[0]?.blocks.map((b) => b.text) ?? []),
  st.row.handle,
  st.row.short,
  st.row.key,
  st.row.format,
  st.row.date,
  st.posted?.at,
  st.link,
];

/** A post of the Niche grid: the caption, the handle, every keyword (as #kw) and window that found it, the id and the date. */
export const tileFields = (t: { caption: string; handle: string; id: string; date: string }, keywords: string[], windows: string[]): Field[] => [
  t.caption,
  t.handle,
  ...keywords.filter(Boolean).map((k) => `#${k}`),
  ...windows,
  t.id,
  t.date,
];

/** A post from your scroll: the caption, the handle, the sound, the id and the date. */
export const batchFields = (p: Pick<BatchPost, "caption" | "handle" | "sound" | "id" | "date">): Field[] => [p.caption, p.handle, p.sound, p.id, p.date];
