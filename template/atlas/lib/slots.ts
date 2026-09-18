/**
 * The posting slots of a day: up to three per handle (the studio's day view
 * draws the third as an open card). A handle's `Slots:` line names its own
 * times ("AM 11:00, PM 19:00"); these are the defaults.
 */

export const SLOTS = ["AM", "MID", "PM"] as const;
export const SLOT_TIME: Record<string, string> = { AM: "11:00", MID: "15:00", PM: "19:00" };

/** "AM 11:00, PM 19:00" → { AM: "11:00", PM: "19:00" }. */
export function slotTimes(line: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = { ...SLOT_TIME };
  if (!line) return out;
  for (const m of line.matchAll(/\b(AM|MID|PM|\d)\s+(\d{1,2}:\d{2})/gi)) out[m[1].toUpperCase()] = m[2];
  return out;
}

/** The slot word of a plan row, normalised to AM · MID · PM when it is one of them. */
export const slotKey = (slot: string) => (/^am$/i.test(slot) ? "AM" : /^pm$/i.test(slot) ? "PM" : /^(mid|noon)$/i.test(slot) ? "MID" : slot.toUpperCase());
