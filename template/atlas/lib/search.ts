/**
 * The search box of the All posts page: one rule for every tab. The words of
 * the search are matched without case, each one anywhere in the post's text,
 * and a post matches when every word is found. Pure: the page uses it,
 * lib/search.test.ts checks it.
 */

import type { Brand, Post } from "./data.ts";
import type { PostState } from "./production.ts";

type Field = string | null | undefined;

/** The words of a search, lower case. An empty search has none and matches everything. */
export const terms = (search: string): string[] => search.toLowerCase().split(/\s+/).filter(Boolean);

/** True when every word is somewhere in the fields. A leading @ on a word is dropped, so "@handle" finds the handle. */
export function matches(words: string[], fields: Field[]): boolean {
  if (!words.length) return true;
  const text = fields.filter(Boolean).join("\n").toLowerCase();
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
