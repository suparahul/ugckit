/**
 * The parts Instagram adds to the Organic Factory UI, shared by every page:
 * the two drawn platform icons, one account line (icon, then the id), the
 * platform switch, and the small split line under a post (the TikTok figure,
 * then the Instagram one). Server components.
 *
 * The view is the `?platform=` parameter, read on the server, as every filter
 * of the UI is: `tiktok`, `instagram`, or absent for both. A page renders one
 * set of figures. A post with one TikTok leg draws nothing new anywhere.
 */

import Link from "next/link";

import { PLATFORMS, PLATFORM_NAME, type Platform } from "@/lib/platform";
import type { PostState } from "@/lib/production";
import { numbersIn, type View } from "@/lib/read";

/** The view a page was asked for: `?platform=tiktok|instagram`, else both. */
export function viewOf(param: string | string[] | undefined): View {
  const v = Array.isArray(param) ? param[0] : param;
  return v === "tiktok" || v === "instagram" ? v : "both";
}

/**
 * A post in a view: every post in "both"; in one platform's view, a post that
 * goes there (not taken off) and either has that leg sent or is not posted yet.
 * A TikTok post from before the identity had Instagram is not an Instagram post.
 */
export function onPlatform(s: PostState, view: View): boolean {
  if (view === "both") return true;
  if (!(s.platforms ?? ["tiktok"]).includes(view) || s.legs?.[view]?.dropped) return false;
  const leg = s.legs?.[view];
  return !!(leg?.sent || leg?.posted || leg?.failed) || !s.posted;
}

/** True when any of these posts goes to more than TikTok: only then does a page draw the platform parts. */
export const hasSecondPlatform = (states: Pick<PostState, "platforms">[]) => states.some((s) => (s.platforms ?? ["tiktok"]).some((p) => p !== "tiktok"));

export function PlatformIcon({ p, title }: { p: Platform; title?: string }) {
  const label = title ?? PLATFORM_NAME[p];
  return p === "tiktok" ? (
    <svg className="pf pf--tt" viewBox="0 0 16 16" role="img" aria-label={label}>
      <path d="M8.6 2.2v7.9a2.5 2.5 0 1 1-2.5-2.5" />
      <path d="M8.6 2.2c.35 1.9 1.65 3.15 3.7 3.35" />
    </svg>
  ) : (
    <svg className="pf pf--ig" viewBox="0 0 16 16" role="img" aria-label={label}>
      <rect x="2.3" y="2.3" width="11.4" height="11.4" rx="3.3" />
      <circle cx="8" cy="8" r="2.7" />
      <circle className="pf__dot" cx="11.3" cy="4.7" r="0.75" />
    </svg>
  );
}

/** One account: the platform icon, then the id. */
export function Account({ p, name, className, children }: { p: Platform; name: string; className?: string; children?: React.ReactNode }) {
  return (
    <span className={`acct acct--${p === "tiktok" ? "tt" : "ig"}${className ? ` ${className}` : ""}`}>
      <PlatformIcon p={p} />
      <span>{name}{children}</span>
    </span>
  );
}

/**
 * The switch: both platforms · TikTok · Instagram, each a link that sets
 * `?platform=` on `href` (the page's own address with its other parameters).
 * `counts` puts a number on each side; `words` puts a state word instead (the post page).
 */
export function PlatformSwitch({ href, view, counts, words, note, label = "Show one platform or both" }: {
  href: string;
  view: View;
  counts?: Partial<Record<View, number>>;
  words?: Partial<Record<Platform, { text: string; tone?: "waiting" | "approved" | "out" | "failed" }>>;
  note?: React.ReactNode;
  label?: string;
}) {
  const url = (v: View) => {
    const [path, q = ""] = href.split("?");
    const u = new URLSearchParams(q);
    if (v === "both") u.delete("platform"); else u.set("platform", v);
    const s = u.toString();
    return s ? `${path}?${s}` : path;
  };
  const opt = (v: View, body: React.ReactNode) => (
    <Link key={v} href={url(v)} scroll={false} className={`settoggle__opt${view === v ? " is-on" : ""}`} aria-current={view === v ? "true" : undefined}>
      {body}
      {counts?.[v] !== undefined ? <span className="settoggle__n">{counts[v]}</span> : null}
    </Link>
  );
  return (
    <div className={`pfbar${words ? "" : " pfbar--filter"}`}>
      <div className="settoggle" role="group" aria-label={label}>
        {opt("both", "both platforms")}
        {PLATFORMS.map((p) => opt(p, <><PlatformIcon p={p} /> {PLATFORM_NAME[p]}{words?.[p] ? <span className={`legword${words[p]!.tone ? ` is-${words[p]!.tone}` : ""}`}> · {words[p]!.text}</span> : null}</>))}
      </div>
      {note ? <p className="pfbar__note">{note}</p> : null}
    </div>
  );
}

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(n));

/**
 * The small line under a post: each leg's views, or its state when it has no
 * read yet ("failed", "not on Instagram", "waiting"). Null for a post with one
 * TikTok leg: a TikTok-only week shows no split line.
 */
export function LegSplit({ s, className }: { s: PostState; className?: string }) {
  const platforms = s.platforms ?? ["tiktok"];
  const others = PLATFORMS.filter((p) => p !== "tiktok" && (platforms.includes(p) || s.legs?.[p]));
  if (!others.length) return null;
  const cell = (p: Platform) => {
    const leg = s.legs?.[p];
    if (leg?.dropped) return <span key={p} className="is-off" title={leg.dropped.note || undefined}><PlatformIcon p={p} /> not on {PLATFORM_NAME[p]}</span>;
    if (leg?.failed) return <span key={p} className="is-failed" title={leg.failed.error}><PlatformIcon p={p} /> failed</span>;
    const nb = numbersIn(s, p);
    if (nb) return <span key={p}><PlatformIcon p={p} /> <b>{short(nb.views)}</b></span>;
    if (leg?.posted) return <span key={p}><PlatformIcon p={p} /> posted</span>;
    if (leg?.sent) return <span key={p}><PlatformIcon p={p} /> {leg.sent.mode === "direct" && leg.sent.scheduledAt ? "scheduled" : "sent"}</span>;
    /* Posted before this leg existed (or without it): it is not on that platform. */
    if (s.posted && p !== (s.primary ?? "tiktok")) return <span key={p} className="is-off"><PlatformIcon p={p} /> not on {PLATFORM_NAME[p]}</span>;
    return <span key={p}><PlatformIcon p={p} /> —</span>;
  };
  return <span className={`legsplit${className ? ` ${className}` : ""}`}>{["tiktok" as Platform, ...others].filter((p) => p !== "tiktok" || platforms.includes("tiktok") || s.legs?.tiktok).map(cell)}</span>;
}
