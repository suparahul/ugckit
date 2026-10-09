/**
 * What a product slide's callout is, read from the deck's own words, for the empty
 * preview (components/production/Frame.tsx), the post page (Deck.tsx), the card states
 * (lib/production.ts) and the export (scripts/render-slides.mjs): a phone with an app
 * screen (styles E and N), and the cards of the slide's Cards list. A pure read of the
 * Slide; no file, no network. The templates: the `callout` skill § The templates.
 *
 *   E   the full-height phone at the left, the side column at its right. The Cards item
 *       says "the full-height phone"; the position says "from 25% to 96%".
 *   N   a phone in a hand in the middle of the picture. The deck gives its place in the
 *       image prompt ("62% of the frame width … top edge at 22% … runs past the bottom
 *       edge") or, when the slide is composed in HTML, as pixels in the position.
 *
 * The App Store card is never assumed: it exists when the Cards list names it, or, for E,
 * when the deck says the card stands in the side column. A phone in a hand (N with a hand)
 * never shows the App Store card, even when the Cards list names it (shownCards).
 *
 * The screen's name is the one the deck quotes after "The screen:" in "Why this slide",
 * the name of a row of apps/<slug>/PRODUCT-SCREENS.md (the `product` skill).
 */

import type { Dimension } from "./layout.ts";
import type { Slide } from "./production.ts";

export type PhoneSlot = {
  kind: "E1" | "E2" | "N";
  /** Percent of the frame. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The phone runs off the bottom edge of the frame. */
  cut: boolean;
  /** A hand holds the phone inside the picture (the image prompt has the chroma-green screen). */
  hand: boolean;
  /** What the screen shows, from the deck; null when the deck does not say. */
  screen: string | null;
  /** E1: the line beside the icon. */
  line: string | null;
  /** E: what the side column holds. */
  side: "icon" | "card" | null;
};

const PX: Record<Dimension, [number, number]> = { "9:16": [1080, 1920], "3:4": [1080, 1440] };
const num = (m: RegExpMatchArray | null, i = 1) => (m ? +m[i] : null);
const DASH = "[–-]";

/** The screen's name: the first quoted title in Title Case after "The screen:" in the slide's "Why this slide". */
export function screenOf(slide: Slide): string | null {
  const after = (slide.why ?? "").split(/\bThe screen:/)[1]?.slice(0, 400);
  for (const q of after?.match(/"[^"]{3,40}"/g) ?? []) {
    const t = q.slice(1, -1);
    if (/^[A-Z][\w&']*(\s+[A-Z][\w&']*)*$/.test(t) && !/^Step \d/.test(t)) return t;
  }
  return null;
}

/**
 * The placeholder's words: which phone layout, and the screen it will show, named from the deck.
 * In a hand (N): inside the picture. Beside the card (E): set by the compositor, no hand.
 * A phone the compositor sets into an N slide without a hand in the picture is only "phone".
 */
export function phoneLabel(slot: Pick<PhoneSlot, "kind" | "hand" | "screen">, app = "app") {
  if (slot.kind !== "N") return `phone screen beside the App Store card · ${slot.screen ?? `${app} screen`} · not made yet`;
  return `${slot.hand ? "phone in hand" : "phone"} · ${app} screen${slot.screen ? `: ${slot.screen}` : ""} · not made yet`;
}

function eSlot(slide: Slide): PhoneSlot | null {
  const item = slide.cards[0] ?? "";
  const pos = slide.position ?? "";
  if (!/full-height phone/i.test(item) && !/phone on the left at full height|phoneFull/i.test(pos)) return null;
  const range = (s: string) => s.match(/from (\d+(?:\.\d+)?)% to (\d+(?:\.\d+)?)%/) ?? s.match(new RegExp(`phone[^;]*?from (?:about )?(\\d+(?:\\.\\d+)?)% to (\\d+(?:\\.\\d+)?)%`));
  const px = pos.match(new RegExp(`phone[^;]*\\(x \\d+${DASH}\\d+, y (\\d+)${DASH}(\\d+)\\)`));
  const m = range(item) ?? range(pos);
  const H = PX["3:4"][1];
  const top = m ? +m[1] : px ? (+px[1] / H) * 100 : 4;
  const height = (m ? +m[2] : px ? (+px[2] / H) * 100 : 96) - top;
  const text = `${item}\n${pos}\n${slide.why ?? ""}`;
  const kind = /\bE1\b/.test(text) ? "E1" : "E2";
  const card = /app store card[^.;]*(side|right) column|(side|right) column[^.;]*app store card|the card in the (right|side) column|cardUpright/i.test(text) || /side column the app store card/i.test(item);
  return {
    kind, left: 4.4, top, height, width: height * (4 / 3) * 0.471, cut: false, hand: false, screen: screenOf(slide),
    line: item.match(/line [“"]([^”"]+)[”"]/)?.[1]?.replace(/\s+\/\s+/g, "\n") ?? null,
    side: kind === "E1" ? "icon" : card ? "card" : null,
  };
}

function nSlot(slide: Slide, dimension: Dimension): PhoneSlot | null {
  const pos = slide.position ?? "";
  const prompt = slide.prompt ?? "";
  const named = slide.blocks.some((b) => /^the (phone|screen)\b/i.test(b.label));
  if (!slide.isProduct || !(/chroma/i.test(prompt) || /\bphone\b/i.test(pos) || named || /\bphone\b/i.test(slide.cards[0] ?? ""))) return null;
  const [W, H] = PX[dimension];
  const px = pos.match(new RegExp(`phone (\\d+) px wide \\(x (\\d+)${DASH}(\\d+)`));
  const pxTop = num(pos.match(/\btop at y (\d+)/));
  let left: number | null = null, width: number | null = null, top: number | null = null, bottom: number | null = null;
  let cut = /cut by the bottom edge|runs past the bottom edge|running off the bottom edge/i.test(`${pos} ${prompt}`);
  if (px) { left = (+px[2] / W) * 100; width = (+px[1] / W) * 100; if (pxTop !== null) top = (pxTop / H) * 100; }
  else {
    width = num(prompt.match(/phone is (?:about )?(\d+(?:\.\d+)?)% of the frame width/i));
    left = num(prompt.match(/left edge at (\d+(?:\.\d+)?)% of the width/i));
    top = num(prompt.match(/top edge (?:LOW, )?at (?:about )?(\d+(?:\.\d+)?)% of the frame height/i));
    bottom = num(prompt.match(/bottom edge at (?:about )?(\d+(?:\.\d+)?)%/i));
  }
  if (top === null && /middle third/i.test(pos)) { top = 100 / 3; bottom = 200 / 3; }
  top ??= 38;
  if (bottom === null || cut) { bottom = 100; cut = true; }
  const height = bottom - top;
  width ??= 66;
  // A phone is portrait: when the deck's numbers give a squat box, keep the deck's height and centre.
  const heightPx = (height / 100) * H;
  if (!cut && heightPx < 1.6 * ((width / 100) * W)) {
    const centre = (left ?? (100 - width) / 2) + width / 2;
    width = ((heightPx / 2) / W) * 100;
    left = centre - width / 2;
  }
  const hand = /chroma/i.test(prompt)
    || /phone (held )?in (a|her|his|their|the|one) hand|hands? holds? (a|the|her|his|their) (smart)?phone/i.test(`${slide.why ?? ""} ${pos} ${slide.cards[0] ?? ""}`)
    || /hand hold(s|ing) (up )?(a|an|the|her|his|their) (smartphone|phone|iPhone)/i.test(prompt);
  return { kind: "N", hand, left: left ?? (100 - width) / 2, top, width, height, cut, screen: screenOf(slide), line: null, side: null };
}

/** The slide's phone, or null when its callout has no phone. */
export const phoneOf = (slide: Slide, dimension: Dimension = "3:4"): PhoneSlot | null => eSlot(slide) ?? nSlot(slide, dimension);

/** One card the slide shows: the deck's Cards item and its 1-based place in that list (the number of its card file). */
export type ShownCard = { item: string; index: number };

const isAppStoreItem = (item: string) => /app store/i.test(item);

/**
 * The cards the slide shows, in the preview and in the export.
 * E: none; the slide's own picture holds the phone and the card.
 * A phone in a hand: every card except the App Store card. A phone in a hand and the App
 * Store card on one slide "makes no sense" (Rahul, 2026-10-09), so the card is dropped even
 * when the deck's Cards list names it. A line plus the card, and E2, are not touched.
 */
export function shownCards(slide: Slide, dimension: Dimension = "3:4"): ShownCard[] {
  const phone = phoneOf(slide, dimension);
  if (phone && phone.kind !== "N") return [];
  const all = slide.cards.map((item, i) => ({ item, index: i + 1 }));
  return phone?.hand ? all.filter((c) => !isAppStoreItem(c.item)) : all;
}

/** True when the slide's Cards list names an App Store card that the phone in a hand drops. */
export const dropsAppStoreCard = (slide: Slide, dimension: Dimension = "3:4") =>
  slide.cards.some(isAppStoreItem) && !shownCards(slide, dimension).some((c) => isAppStoreItem(c.item)) && phoneOf(slide, dimension)?.kind === "N";

/**
 * True for a block that holds the in-app text of the screen or the component the deck chose ("The screen (in-app
 * text)", "The component (in-app text)", "The phone"): words inside the app's own picture, made by the callout step,
 * never drawn as slide text. Only "The screen" and "The phone" mark a phone (nSlot); a component has none.
 */
export const isScreenBlock = (label: string) => /^the (phone|screen|component)\b/i.test(label);

/** The name of a Cards item, from the deck's own words; the App Store image only when the item says so. */
export function cardKind(item: string): string {
  if (/app store/i.test(item)) return "App Store image";
  if (/\bscreen\b|\bcrop/i.test(item)) return "app screen";
  if (/in-app/i.test(item)) return "in-app image";
  return item.replace(/^the\s+/i, "").split(/[;:(,]/)[0].trim().slice(0, 40) || "callout image";
}

/** The one-line account of the callout, for a slide the deck gives no "Why this slide" for. */
export function calloutWhy(slide: Slide, dimension: Dimension = "3:4"): string {
  const phone = phoneOf(slide, dimension);
  const kinds = (phone && phone.kind !== "N" ? slide.cards.filter((c) => !/full-height phone/i.test(c)) : shownCards(slide, dimension).map((c) => c.item)).map(cardKind);
  const appStore = kinds.includes("App Store image") || phone?.side === "card";
  const rest = kinds.filter((k) => k !== "App Store image");
  const parts = [...(phone ? [`a phone with the app's screen${phone.screen ? ` (${phone.screen})` : ""}`] : []), ...(appStore ? ["the App Store image"] : []), ...rest];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "no card";
  return `The app's one appearance in the deck: the product callout (${list}).`;
}
