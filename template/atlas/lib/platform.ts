/**
 * The platforms a post can go to, and the one rule every reader shares: a
 * file, a plan row or a log line that names no platform means TikTok. So
 * everything written before Instagram existed reads as it did.
 *
 * Instagram is a repost of the same deck: the research half stays TikTok only.
 * Pure: the scripts import it too (Node strips the types).
 */

export type Platform = "tiktok" | "instagram";

/** In display order: TikTok first, then Instagram. */
export const PLATFORMS: Platform[] = ["tiktok", "instagram"];

export const PLATFORM_NAME: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram" };

/**
 * The most slides one post takes. Instagram's API takes 10 in a carousel (Meta's
 * content publishing guide; Post Bridge: "instagram — 1–10"), although the app
 * takes 20. TikTok has no limit the kit enforces.
 */
export const MAX_SLIDES: Record<Platform, number | null> = { tiktok: null, instagram: 10 };

export const isPlatform = (x: unknown): x is Platform => x === "tiktok" || x === "instagram";

/** A platform name as written anywhere (`TikTok`, `instagram`, absent) → the platform; absent means TikTok. Null for a name the kit does not post to. */
export function platformOf(x: unknown): Platform | null {
  if (x === undefined || x === null || String(x).trim() === "") return "tiktok";
  const p = String(x).trim().toLowerCase();
  return isPlatform(p) ? p : null;
}

/** `tiktok, instagram` → both, in display order. Blank or a dash → null ("not stated here"). Unknown names are dropped. */
export function parsePlatforms(cell: string | null | undefined): Platform[] | null {
  const t = String(cell ?? "").replace(/`/g, "").trim();
  if (!t || /^[—–-]+$/.test(t)) return null;
  const named = new Set(t.split(/[,;/+&]|\band\b/).map((s) => s.trim().toLowerCase()).filter(isPlatform));
  const out = PLATFORMS.filter((p) => named.has(p));
  return out.length ? out : null;
}

/** The slide limit of a post that goes to these platforms: the smallest one, or null when none applies. */
export function slideLimit(platforms: Platform[]): number | null {
  const limits = platforms.map((p) => MAX_SLIDES[p]).filter((n): n is number => n !== null);
  return limits.length ? Math.min(...limits) : null;
}

/** The primary platform of a list: TikTok when it is there, else the first. */
export const primaryOf = (platforms: Platform[]): Platform => (platforms.includes("tiktok") || !platforms.length ? "tiktok" : platforms[0]);
