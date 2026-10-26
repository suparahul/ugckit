/**
 * What /media serves, in one place: the route (app/media/[...path]/route.ts) refuses
 * every other path, and the pages build a URL only for a path it serves, so a picture
 * the route would refuse is a label ("not served"), never a broken image.
 *
 *   research/…                  the competitor corpus, in place
 *   apps/<slug>/…               the app's icon, a handle's references, the niche covers and
 *                               batches, the screen library (stills and recordings), the brand's
 *                               asset library (brand/assets/: the design templates' art and its assets.json)
 *   pipeline/character/<video>/ the pictures and the files the user judges in the Atlas:
 *                               the delivered file; the keyframes, an H end still and the
 *                               storyboard (gate A); each segment's pose picture, plate,
 *                               takes, qc pictures, last frame and composites, a motion-designed
 *                               screen's render and its step stills (gate B); the
 *                               narration takes; the supplied files; the cut and its contact
 *                               sheet (gate C). No plan, no approval, no shot, no prompt, no JSON.
 */

export const APP_SERVED = /^[^/]+\/(icon\.(jpg|jpeg|png|webp)$|handles\/[^/]+\/references\/|niche\/(covers|batches|instagram\/covers)\/|screens\/[\w-][\w.-]*\.(mp4|mov|png|jpe?g)$|brand\/assets\/[\w-][\w.-]*\.(png|jpe?g|webp|json)$)/;

export const FINAL_SERVED = new RegExp(
  "^([a-z0-9][a-z0-9-]*)/(" +
    "final/\\1\\.mp4" +
    "|keyframes/(\\d\\d-[a-z]\\.png|\\d\\d-h-end\\.png|storyboard\\.jpg)" +
    "|segments/\\d\\d-[a-z]/(generated|composite)/[\\w.-]+\\.mp4" +
    "|segments/\\d\\d-[a-z]/(generated|composite)/qc/[\\w.-]+\\.png" +
    "|segments/\\d\\d-[a-z]/source/(reference\\.mp4|plate\\.mp4|first-frame\\.png)" +
    "|segments/\\d\\d-[a-z]/last-frame\\.png" +
    "|segments/\\d\\d-[a-z]/motion/(render\\.mp4|stills/step-\\d\\d\\.png)" +
    "|narration/[\\w-][\\w.-]*\\.(wav|mp3|m4a)" +
    "|supplied/([\\w-][\\w.-]*/)*[\\w-][\\w.-]*\\.(mp4|mov|png|jpe?g|wav|mp3|m4a)" +
    "|assembly/([\\w.-]+\\.mp4|contact-sheet\\.png)" +
    ")$",
);

/** Whether /media serves this workspace-relative path. */
export function served(rel: string): boolean {
  if (!rel || rel.split("/").includes("..")) return false;
  if (rel.startsWith("research/")) return true;
  if (rel.startsWith("apps/")) return APP_SERVED.test(rel.slice(5));
  if (rel.startsWith("pipeline/character/")) return FINAL_SERVED.test(rel.slice("pipeline/character/".length));
  return false;
}

/** The /media URL of a workspace-relative path, or null when the route does not serve it. A sha256 busts the browser's cache when the file is redone. */
export function mediaUrl(rel: string | null | undefined, sha?: string | null): string | null {
  if (typeof rel !== "string") return null;
  const r = rel.replace(/^\.\//, "");
  if (!served(r)) return null;
  const path = r.startsWith("research/") ? r.slice("research/".length) : r;
  return `/media/${path.split("/").map(encodeURIComponent).join("/")}${sha ? `?v=${sha.slice(0, 12)}` : ""}`;
}
