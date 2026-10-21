/**
 * "Approve anyway" (2026-10-21): the measured gates an approval may pass at the user's
 * discretion, with a required note. The route (app/api/production/decide) and the page
 * (components/production/VideoProduction.tsx) share these rules; review.py --accept-fail
 * records the override. No node imports: the page imports it.
 */
import type { Motion } from "./video-production.ts";

/* The failed measured gates an approval may accept with the user's note (review.py
 * --accept-fail). The eye check of a gate not run is the user's claim: ticked it is recorded
 * as passed, unticked as not claimed; it never blocks. A stale render (current), a render of
 * the wrong format and a page error (page) are hard: never accepted. */
const eyeOf = (g: string) => (g === "text_read" ? "text" : g);
export const MOTION_HARD = ["current", "format", "page"];
export function motionAccepts(m: Pick<Motion, "failed" | "notRun">, ticked: string[]): { stale: boolean; accept: string[]; seen: string[] } {
  const stale = m.failed.some((g) => MOTION_HARD.includes(g));
  const seen = m.notRun.filter((g) => ticked.includes(eyeOf(g))).map(eyeOf);
  return { stale, seen, accept: stale ? [] : [...m.failed] };
}
/** The checks of the cut: the overlays not the plan's or a changed supplied file always block (the cut is
 * not the plan's); another failed overlay check (readable, clear, read back) may be approved anyway. */
const INTEGRITY_CUT = (k: string) => k === "overlays as planned" || k.startsWith("supplied");
export function cutAccepts(failed: string[]): { blocked: string[]; overlays: string[] } {
  return { blocked: failed.filter(INTEGRITY_CUT), overlays: failed.filter((k) => k.startsWith("overlays") && !INTEGRITY_CUT(k)) };
}

