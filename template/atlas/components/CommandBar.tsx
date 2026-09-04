"use client";

/**
 * The command bar — the whole presenter layer.
 *
 * The agent drives the app for the user, so this is the single most reliable
 * lever in the build: one node, one string, one submit, no reading a cluttered
 * page and no clicking a point on a canvas. Everything the app can show is
 * reachable from here.
 *
 * It doubles as a live search the room watches being typed, so the results list
 * is deliberately legible rather than a hidden autocomplete.
 *
 * Grammar (all case-insensitive, all optional-colon):
 *   potto                     an app
 *   @mel.traveltips           account
 *   hook: discovery regret    thread on a dimension
 *   thread hook discovery     the same, spelled out
 *   post 7669281434133187870  a post by id
 *   orb / map                 named views
 *   open @handle              opens the real TikTok page in a new tab
 *   anything else             fuzzy search across everything
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Entry = {
  kind: "brand" | "account" | "thread" | "post";
  id: string;
  name: string;
  href: string;
  brand?: string;
  terms: string;
  meta: string;
  isOwn?: boolean;
  crossNetwork?: boolean;
};

type Manifest = { entries: Entry[]; corpus: Record<string, number> };

/** Named views that are not corpus entries. */
const VERBS: Record<string, string> = {
  orb: "/orb",
  globe: "/orb",
  home: "/orb",
  map: "/map",
  index: "/map",
};

const DIMENSIONS = ["hook", "insertion", "disclosure", "sound", "format", "handleConvention", "cadence"];

const DIMENSION_ALIASES: Record<string, string> = {
  hooks: "hook",
  mechanic: "insertion",
  mechanics: "insertion",
  insert: "insertion",
  disclose: "disclosure",
  sounds: "sound",
  formats: "format",
  handle: "handleConvention",
  handles: "handleConvention",
  convention: "handleConvention",
  naming: "handleConvention",
};

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Subsequence match — "disc reg" finds "discovery-regret". */
function fuzzy(needle: string, hay: string): number {
  if (!needle) return 0;
  if (hay.includes(needle)) return 100 - hay.indexOf(needle);
  let i = 0;
  let score = 0;
  for (const ch of hay) {
    if (ch === needle[i]) {
      i++;
      score++;
      if (i === needle.length) return score / 2;
    }
  }
  return -1;
}

export default function CommandBar() {
  const router = useRouter();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/search.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setStatus("search.json missing — run npm run index"));
  }, []);

  // "/" focuses the bar from anywhere. No other global shortcuts: the spec is
  // explicit that there is no presenter mode, no spacebar, no waypoints.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      // On the orb the bar starts clipped out of sight (never out of the
      // accessibility tree). Either key brings it back for a human; the agent
      // never needs to, because the input is focusable and named the whole time.
      const reveal = () => {
        document.documentElement.dataset.reveal = "1";
        inputRef.current?.focus();
      };
      if (e.key === "/" && !typing) {
        e.preventDefault();
        reveal();
      }
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        reveal();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
        delete document.documentElement.dataset.reveal;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    if (!manifest || !query.trim()) return [];
    const q = query.toLowerCase().trim();
    return manifest.entries
      .map((e) => ({ e, score: Math.max(fuzzy(q, e.terms), fuzzy(q, e.name.toLowerCase())) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || a.e.name.length - b.e.name.length)
      .slice(0, 9)
      .map((r) => r.e);
  }, [manifest, query]);

  /**
   * Turn one string into one destination. Explicit grammar wins over search, so
   * a call like `hook: discovery regret` is deterministic and cannot drift to a
   * fuzzy match as the corpus grows — which matters when it is being driven live.
   */
  const resolve = useCallback(
    (raw: string): { href: string; external?: boolean } | null => {
      const input = raw.trim();
      if (!input) return null;
      const lower = input.toLowerCase();

      if (VERBS[lower]) return { href: VERBS[lower] };

      // open @handle — the live moves leave the app on purpose.
      const openMatch = lower.match(/^open\s+@?([\w.]+)$/);
      if (openMatch) return { href: `https://www.tiktok.com/@${openMatch[1]}`, external: true };

      // dimension: value  |  thread dimension value
      const withColon = input.match(/^(\w+)\s*:\s*(.+)$/);
      const spelled = input.match(/^thread\s+(\w+)\s+(.+)$/i);
      const pair = withColon || spelled;
      if (pair) {
        const dim = DIMENSION_ALIASES[pair[1].toLowerCase()] || pair[1].toLowerCase();
        if (DIMENSIONS.includes(dim)) return { href: `/thread/${dim}/${slug(pair[2])}` };
        if (dim === "post") return { href: `/post/${pair[2].trim()}` };
        if (dim === "brand") return { href: `/brand/${slug(pair[2])}` };
        if (dim === "account" || dim === "handle") return { href: `/account/${pair[2].trim().replace(/^@/, "")}` };
      }

      const post = lower.match(/^post\s+(\d+)$/);
      if (post) return { href: `/post/${post[1]}` };
      if (/^\d{15,}$/.test(lower)) return { href: `/post/${lower}` };

      // @handle is unambiguous.
      if (lower.startsWith("@")) return { href: `/account/${input.slice(1).trim()}` };

      // Exact id matches on brand / account, then whatever search ranks first.
      const exact = manifest?.entries.find((e) => e.id.toLowerCase() === lower || e.name.toLowerCase() === lower);
      if (exact) return { href: exact.href };

      return results[active] ? { href: results[active].href } : results[0] ? { href: results[0].href } : null;
    },
    [manifest, results, active]
  );

  const go = useCallback(
    (raw: string) => {
      const target = resolve(raw);
      if (!target) {
        setStatus(`No match for "${raw}"`);
        return;
      }
      if (target.external) {
        window.open(target.href, "_blank", "noopener");
        setStatus(`Opened ${target.href} in a new tab`);
      } else {
        router.push(target.href);
        setStatus(`Went to ${target.href}`);
      }
      setQuery("");
      setOpen(false);
      setActive(0);
    },
    [resolve, router]
  );

  return (
    <div className="cmd">
      <form
        className="cmd__form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(query);
        }}
      >
        <label className="sr-only" htmlFor="atlas-command">
          Atlas command bar. Type an app, an @handle, a thread such as “hook: discovery regret”, a post id, or one of
          orb, map.
        </label>
        <span className="cmd__prompt" aria-hidden="true">
          &rsaquo;
        </span>
        <input
          id="atlas-command"
          ref={inputRef}
          className="cmd__input"
          type="text"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder="an app · @handle · hook: discovery regret · map"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
          }}
          aria-expanded={open && results.length > 0}
          aria-controls="atlas-command-results"
        />
        <button className="cmd__go" type="submit">
          Go
        </button>
      </form>

      {open && results.length > 0 && (
        <ul className="cmd__results" id="atlas-command-results" role="listbox" aria-label="Command bar matches">
          {results.map((r, i) => (
            <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`cmd__result${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  router.push(r.href);
                  setStatus(`Went to ${r.href}`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="cmd__kind">{r.kind}</span>
                <span className="cmd__name">
                  {r.name}
                  {r.isOwn && <em className="cmd__own"> brand&rsquo;s own</em>}
                </span>
                <span className="cmd__meta">{r.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* A screen-read of the app should say what just happened. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
