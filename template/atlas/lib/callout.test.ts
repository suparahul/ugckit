/** The callout read of a product slide (lib/callout.ts). Run with `npm test` (node --test). */

import assert from "node:assert/strict";
import { test } from "node:test";

import { calloutWhy, cardKind, dropsAppStoreCard, isScreenBlock, phoneLabel, phoneOf, screenOf, shownCards } from "./callout.ts";
import type { Slide } from "./production.ts";

const slide = (o: Partial<Slide>): Slide => ({ n: 4, label: "the Pawly slide", isProduct: true, blocks: [], prompt: null, position: null, why: null, cards: [], ...o });

test("a chroma-green phone is a phone in hand; the deck's numbers place it", () => {
  const s = slide({ prompt: "the phone is 56% of the frame width (its left edge at 22% of the width); its top edge at 32% of the frame height; it runs past the bottom edge. The whole screen is one flat chroma green.", why: 'The screen: "Step 1 of 5", "Litter Training Steps".' });
  const p = phoneOf(s)!;
  assert.deepEqual([p.kind, p.hand, p.cut, p.left, p.top, p.width], ["N", true, true, 22, 32, 56]);
  assert.equal(phoneLabel(p), "phone in hand · app screen: Litter Training Steps · not made yet");
  assert.equal(phoneLabel(p, "Pawly"), "phone in hand · Pawly screen: Litter Training Steps · not made yet");
});

test("a full-height phone is set beside the App Store card, with no hand", () => {
  const p = phoneOf(slide({ why: 'The feature that answers the question. The screen: "Ask Chat".', cards: ["the full-height phone (style E2) from 20% to 96%, with the chat screen; the App Store card in the side column"] }))!;
  assert.deepEqual([p.kind, p.hand, p.side, p.top], ["E2", false, "card", 20]);
  assert.equal(phoneLabel(p), "phone screen beside the App Store card · Ask Chat · not made yet");
});

test("the screen is named only by the deck's \"The screen:\" title, one word or more", () => {
  assert.equal(screenOf(slide({ why: 'The screen: "Dayprint".' })), "Dayprint");
  assert.equal(screenOf(slide({ why: "the chat screen answers it" })), null);
  assert.equal(screenOf(slide({ why: 'The screen: "the chat"' })), null);
});

test("no phone, no phone placeholder; the App Store card is named only when the item says so", () => {
  assert.equal(phoneOf(slide({ cards: ["the App Store card"], position: "the card in the lower third" })), null);
  assert.equal(cardKind("the App Store card"), "App Store image");
  assert.equal(cardKind("the in-app feature image"), "in-app image");
});

const CHROMA = "a hand holds the phone; the phone is 60% of the frame width; its top edge at 40% of the frame height; it runs past the bottom edge. The whole screen is one flat chroma green.";

test("a phone in a hand never shows the App Store card, even when the Cards list names it", () => {
  const s = slide({ prompt: CHROMA, cards: ["the App Store card"] });
  assert.equal(phoneOf(s)!.hand, true);
  assert.deepEqual(shownCards(s), []);
  assert.equal(dropsAppStoreCard(s), true);
  assert.equal(calloutWhy(s), "The app's one appearance in the deck: the product callout (a phone with the app's screen).");
});

test("a phone in a hand keeps its other cards, at their own card-file numbers", () => {
  const s = slide({ prompt: CHROMA, cards: ["the App Store card", "the in-app feature image"] });
  assert.deepEqual(shownCards(s), [{ item: "the in-app feature image", index: 2 }]);
});

test("a hand named in the deck's words, with no chroma prompt, is a phone in hand too", () => {
  const s = slide({ position: "the phone in the middle third", why: "Maya's phone in her hand shows the entry.", cards: ["the App Store card"] });
  assert.equal(phoneOf(s)!.hand, true);
  assert.deepEqual(shownCards(s), []);
});

test("a line plus the App Store card keeps the card", () => {
  const s = slide({ cards: ["the App Store card"], position: "the line directly above the card; the card in the lower third" });
  assert.deepEqual(shownCards(s), [{ item: "the App Store card", index: 1 }]);
  assert.equal(dropsAppStoreCard(s), false);
});

test("the phone beside the App Store card (E2) is unchanged: the picture holds the phone and the card", () => {
  const s = slide({ cards: ["the full-height phone (style E2) from 20% to 96%, with the chat screen; the App Store card in the side column"] });
  assert.equal(phoneOf(s)!.side, "card");
  assert.deepEqual(shownCards(s), []);
  assert.equal(dropsAppStoreCard(s), false);
});

test("a phone with no hand (set in by the compositor) keeps the App Store card", () => {
  const s = slide({ position: "the phone in the middle third", cards: ["the App Store card"] });
  assert.equal(phoneOf(s)!.hand, false);
  assert.deepEqual(shownCards(s), [{ item: "the App Store card", index: 1 }]);
});

test("the in-app text of a screen or a component is never slide text; only a screen marks a phone", () => {
  assert.equal(isScreenBlock("The screen (in-app text)"), true);
  assert.equal(isScreenBlock("The component (in-app text)"), true);
  assert.equal(isScreenBlock("On-image text, top (headline)"), false);
  const component = slide({ blocks: [{ label: "The component (in-app text)", hint: null, text: "Step 1 of 3", place: "top", size: "small", box: false }] });
  assert.equal(phoneOf(component), null);
  const screen = slide({ blocks: [{ label: "The screen (in-app text)", hint: null, text: "Is this normal?", place: "top", size: "small", box: false }] });
  assert.equal(phoneOf(screen)!.kind, "N");
});
