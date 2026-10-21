/**
 * What changed between the locked plan and a newer draft, in the user's words
 * (ATLAS-VIDEO-PAGE-CLEANUP.md § 6): the lines the decision bar shows when the
 * plan went stale, so "the plan changed after the lock" never stands alone.
 * Pure: two plan objects in, sentences out. The source rows of PLAN.md, the
 * revision number and the brief references are bookkeeping, not changes the
 * user decides on, and are left out.
 */

type Change = { path: string; from: unknown; to: unknown };

/** Paths that are bookkeeping: a changed row or date of the source is not a change of the video. */
const SKIP = /(^|\.)(revision|brief_ref|source|section|row|post|post_key|digest|approved|evidence)(\.|\[|$)/;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function walk(a: unknown, b: unknown, path: string, out: Change[]) {
  if (SKIP.test(path)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) walk(a[i], b[i], `${path}[${i}]`, out);
    return;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], path ? `${path}.${k}` : k, out);
    return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path, from: a, to: b });
}

const q = (x: unknown): string => (x === undefined || x === null || x === "" ? "nothing" : typeof x === "string" ? `“${x}”` : Array.isArray(x) ? x.map(q).join(", ") : typeof x === "object" ? "other details" : String(x));
const nth = (i: string) => Number(i) + 1;

/** The place of a change, in words. */
function label(path: string, plan: any): string {
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^overlays\[(\d+)\]\.text$/))) return `The words on screen (text ${nth(m[1])})`;
  if ((m = path.match(/^overlays\[(\d+)\]\.(start_s|end_s)$/))) return `The ${m[2] === "start_s" ? "start" : "end"} of the words on screen (text ${nth(m[1])}), in seconds`;
  if ((m = path.match(/^overlays\[(\d+)\]\.(\w+)$/))) return `The ${m[2].replace(/_/g, " ")} of the words on screen (text ${nth(m[1])})`;
  if ((m = path.match(/^beats\[(\d+)\]\.action$/))) return `What the viewer sees in part ${nth(m[1])}`;
  if ((m = path.match(/^beats\[(\d+)\]\.(start_s|end_s)$/))) return `The ${m[2] === "start_s" ? "start" : "end"} of part ${nth(m[1])}, in seconds`;
  if ((m = path.match(/^beats\[(\d+)\]\.screen_story\.steps\[(\d+)\]\.shows(\[\d+\])?$/))) return `The app's text in part ${nth(m[1])}, step ${nth(m[2])}`;
  if ((m = path.match(/^beats\[(\d+)\]\.screen_story\.steps\[(\d+)\]\.(\w+)$/))) return `The ${m[3].replace(/_/g, " ")} of part ${nth(m[1])}, step ${nth(m[2])}`;
  if ((m = path.match(/^beats\[(\d+)\]\.lines\[(\d+)\]\.(text|line)$/))) return `A spoken line in part ${nth(m[1])}`;
  if ((m = path.match(/^beats\[(\d+)\]\.(\w+)/))) return `The ${m[2].replace(/_/g, " ")} of part ${nth(m[1])}`;
  if ((m = path.match(/^hero_strings\.(.+)$/))) return `The hero text of screen ${m[1]}`;
  if (path === "publishing_note.caption") return "The caption";
  if (path === "publishing_note.music_note") return "The music note";
  if ((m = path.match(/^publishing_note\.(\w+)/))) return `The ${m[1].replace(/_/g, " ")} of the post`;
  if (path === "format.length_s") return "The length, in seconds";
  if ((m = path.match(/^editorial\.hook_job|job_id$|\.job_id$/))) return "The hook's job";
  if ((m = path.match(/^assets\[(\d+)\]\.(\w+)/))) return `The ${m[2].replace(/_/g, " ")} of supplied file ${nth(m[1])}`;
  if ((m = path.match(/^reaction_reference\.(\w+)/))) return `The reaction's ${m[1].replace(/_/g, " ")}`;
  void plan;
  return `The ${path.replace(/\[(\d+)\]/g, (_, i) => ` ${nth(i)}`).replace(/[._]/g, " ")}`;
}

/**
 * The changes from the locked plan to the draft, one sentence each, the words on
 * screen first. A change inside a step's list of strings is reported once per step.
 */
export function planChanges(locked: any, draft: any): string[] {
  if (!locked || !draft) return [];
  const raw: Change[] = [];
  walk(locked, draft, "", raw);
  const seen = new Set<string>();
  const out: { key: string; text: string }[] = [];
  for (const c of raw) {
    const key = label(c.path, draft);
    const stepList = /screen_story\.steps\[\d+\]\.shows\[\d+\]$/.test(c.path);
    if (stepList) {
      if (seen.has(key)) continue;
      seen.add(key);
      /* The whole step's strings, before and after. */
      const at = c.path.replace(/\.shows\[\d+\]$/, ".shows");
      out.push({ key, text: `${key}: was ${q(get(locked, at))}; now ${q(get(draft, at))}.` });
      continue;
    }
    out.push({ key, text: `${key}: was ${q(c.from)}; now ${q(c.to)}.` });
  }
  const rank = (k: string) => (/words on screen/.test(k) ? 0 : /^The hook/.test(k) ? 1 : /^What the viewer sees/.test(k) ? 2 : /^The app's text/.test(k) ? 3 : /^The caption/.test(k) ? 4 : 5);
  return out.sort((a, b) => rank(a.key) - rank(b.key)).map((x) => x.text);
}

function get(o: any, path: string): unknown {
  return path.split(/\.|\[|\]\.?/).filter(Boolean).reduce((x, k) => (x === undefined || x === null ? undefined : x[k]), o);
}
