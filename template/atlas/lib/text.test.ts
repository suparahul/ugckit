/**
 * Shortening by whole characters (lib/text.ts): no file, no network.
 * Run with `npm test` (node --test).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { clip, head } from "./text.ts";

/** True when the string holds a surrogate with no partner: half an emoji. */
const loneSurrogate = (t: string) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(t);

test("clip: an emoji at the cut point is kept whole or dropped, never split", () => {
  const caption = `${"a".repeat(117)} world. 🥹 more after the cut`;
  // 🥹 is at UTF-16 units 125 and 126: a cut by units at 126 keeps half of it.
  assert.equal(loneSurrogate(caption.slice(0, 126)), true);
  for (let max = 110; max <= 130; max++) assert.equal(loneSurrogate(clip(caption, max)), false, `max ${max}`);
  assert.equal(clip("ab🥹cd", 4), "ab🥹…");
});

test("clip: a joined emoji and a flag count as one character", () => {
  assert.equal(clip("hi 👩‍👩‍👧 there", 5), "hi 👩‍👩‍👧…");
  assert.equal(clip("🇮🇳🇮🇳🇮🇳", 2), "🇮🇳…");
});

test("clip: short text as it is; the ellipsis counts in the length", () => {
  assert.equal(clip("short", 120), "short");
  assert.equal(clip("abcdef", 4), "abc…");
  assert.equal(clip("ab   cdef", 5), "ab…");
});

test("head: the first n characters, whole", () => {
  assert.equal(head("🥹🥹🥹", 2), "🥹🥹");
  assert.equal(loneSurrogate(head("x🥹", 2)), false);
});
