/**
 * Times in a named zone, with Intl only (no node modules: the band uses it in
 * the browser, the CLI and the flow on the server). Two zones matter: the
 * posting zone (where the accounts post) and the home zone (where the user
 * reads). Both come from the plan file's `Posting zone:` and `Home zone:`
 * lines; without them, the machine's zone. No environment variables.
 */

export const NY = "America/New_York";
export const KOLKATA = "Asia/Kolkata";

const machine = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const valid = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

export type Zones = { posting: string; home: string };
let zones: Zones = { posting: machine(), home: machine() };

/** The plan's zones. A zone Intl does not know is ignored and reported by the caller. */
export function setZones(posting?: string | null, home?: string | null): Zones {
  const p = posting && valid(posting) ? posting : machine();
  const h = home && valid(home) ? home : p;
  zones = { posting: p, home: h };
  return zones;
}
export const postingZone = () => zones.posting;
export const homeZone = () => zones.home;
export const getZones = () => zones;

/** Zones whose short name Intl (en-US) does not give as people write it. */
const SHORT: Record<string, string> = { "Asia/Kolkata": "IST", "Asia/Calcutta": "IST", "Europe/London": "UK", "Europe/Berlin": "CET", "Europe/Paris": "CET", "Europe/Madrid": "CET", "Europe/Rome": "CET", "Australia/Sydney": "AET", "Asia/Tokyo": "JST", "Asia/Singapore": "SGT", "Asia/Dubai": "GST" };

/** "ET", "IST", "GMT+2": the zone's short name. A US zone reads without its daylight letter (EDT → ET), the way the plan writes it. */
export function shortOf(tz: string, at = new Date()): string {
  if (SHORT[tz]) return SHORT[tz];
  try {
    const v = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((x) => x.type === "timeZoneName")?.value ?? tz;
    const m = v.match(/^([A-Z])[DS]T$/);
    return m ? `${m[1]}T` : v;
  } catch {
    return tz;
  }
}

/** The zones a time is printed in: the posting zone, and the home zone when it differs. */
export function ZONES(z: Zones = zones): { tz: string; short: string }[] {
  const out = [{ tz: z.posting, short: shortOf(z.posting) }];
  if (z.home !== z.posting) out.push({ tz: z.home, short: shortOf(z.home) });
  return out;
}

const parts = (d: Date, tz: string) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
};

/** The zone's offset from UTC at that instant, in minutes. */
export function offsetMinutes(d: Date, tz: string): number {
  const z = parts(d, tz);
  const asUtc = Date.UTC(z.y, z.mo - 1, z.d, z.h, z.mi, z.s);
  return Math.round((asUtc - d.getTime()) / 60_000);
}

/** The instant of a wall-clock time in a zone: "2026-09-17", "19:00", "America/New_York" → ISO UTC. */
export function zonedToUtc(date: string, hhmm: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  if (![y, mo, d, h, mi].every(Number.isFinite)) throw new Error(`Not a time: ${date} ${hhmm}`);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  /* Two passes: the offset at the guess, then at the corrected instant (a DST edge moves it once). */
  let t = guess - offsetMinutes(new Date(guess), tz) * 60_000;
  t = guess - offsetMinutes(new Date(t), tz) * 60_000;
  return new Date(t).toISOString();
}

/** "2026-09-17 19:00 ET" for an ISO instant. */
export function fmtIn(iso: string, tz: string, short?: string, weekday = false): string {
  const z = parts(new Date(iso), tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${weekday ? `${weekdayIn(iso, tz)} ` : ""}${z.y}-${pad(z.mo)}-${pad(z.d)} ${pad(z.h)}:${pad(z.mi)}${short ? ` ${short}` : ""}`;
}

/** "Wed 19:00 ET (Thu 04:30 IST)" — the weekday and time in the posting zone, the same instant in the home zone when it differs. */
export function fmtBoth(iso: string, z: Zones = zones): string {
  const at = new Date(iso);
  const one = `${weekdayIn(iso, z.posting)} ${fmtIn(iso, z.posting).slice(11)} ${shortOf(z.posting, at)}`;
  if (z.home === z.posting) return one;
  return `${one} (${weekdayIn(iso, z.home)} ${fmtIn(iso, z.home).slice(11)} ${shortOf(z.home, at)})`;
}

/** "19:00 America/New_York" (the date given) or "2026-09-17 19:00 America/New_York" → ISO UTC. The sugar of --at-local. */
export function parseAtLocal(text: string, date: string): string {
  const m = text.trim().match(/^(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}):(\d{2})\s+(\S+)$/);
  if (!m) throw new Error(`--at-local wants "HH:MM Zone/Name" or "YYYY-MM-DD HH:MM Zone/Name", got "${text}"`);
  const tz = m[4];
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { throw new Error(`Unknown zone "${tz}"`); }
  return zonedToUtc(m[1] ?? date, `${m[2].padStart(2, "0")}:${m[3]}`, tz);
}

/** An ISO time with its zone ("2026-09-17T19:00:00-04:00" or "…Z") → ISO UTC. A time without a zone is refused. */
export function parseAt(text: string): string {
  const t = text.trim();
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(t)) throw new Error(`--at wants an ISO time with its zone, e.g. 2026-09-17T19:00:00-04:00, got "${t}"`);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a time: "${t}"`);
  return d.toISOString();
}

/** "Wed" for an instant, in the zone. */
export function weekdayIn(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
}

/** Hours from now to an instant (the dry run prints it). */
export function hoursAhead(iso: string, now = new Date()): number {
  return (new Date(iso).getTime() - now.getTime()) / 3_600_000;
}

/** Tomorrow's date in the zone, "YYYY-MM-DD". */
export function tomorrowIn(tz: string, now = new Date()): string {
  return fmtIn(new Date(now.getTime() + 86_400_000).toISOString(), tz).slice(0, 10);
}
