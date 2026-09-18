/**
 * Which app a production page is about, read from the address on the client:
 * /production/<slug>/… . Every call the page makes to /api/production/* names
 * the app this way, so one route serves every app.
 */
export function appFromPath(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/^\/(?:production|app)\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
