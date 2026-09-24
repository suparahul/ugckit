/**
 * The cards of the home base and the handles page: a handle as a card, a
 * posted post as a playable preview, a creator's post from your scroll, a
 * researched app's held post, and the app card. Server components except the
 * preview itself (Show.tsx).
 */

import Link from "next/link";

import type { Brand, Post } from "@/lib/data";
import type { Handle } from "@/lib/handles";
import type { BatchPost } from "@/lib/niche";
import { postPath, uploadedFiles, type PostState } from "@/lib/production";
import { numbersIn, numbersOf, type View } from "@/lib/read";
import { head } from "@/lib/text";
import { Account, LegSplit } from "@/components/Platform";
import { fileUrl } from "@/components/production/Frame";
import { firstPicture } from "./Wait";
import { Face, MarkRow, dmy, n, pct, short, wdm, word } from "./Bits";
import { Show } from "./Show";

/** The slides of a posted post: the rendered finals when they exist, else the approved candidates, else the first picture. */
export function slidesOf(s: PostState): string[] {
  const finals = uploadedFiles(s.row.slug, s.row.key, "final").filter((f) => /\/slide-\d+\.(png|jpe?g|webp)$/i.test(f)).map(fileUrl);
  if (finals.length) return finals;
  const approved = s.slides.map((x) => x.approved ?? x.current).filter((x): x is string => !!x).map(fileUrl);
  if (approved.length) return approved;
  const one = firstPicture(s);
  return one ? [one] : [];
}

/**
 * The format's name without its note: the words before the first `,` `;` `:` or `(`.
 * A plan row's format cell often carries the whole reasoning ("paragraph density,
 * 9 slides: hook, one food per slide …"), which made the grid cards grow to ten
 * lines (Rahul, 2026-09-23). The card shows the name; the whole cell is its tooltip
 * and stays on the post page.
 */
export function formatHead(format: string): string {
  return format.split(/[,;:(]/)[0].trim() || format;
}

/** `view`: the numbers of one platform, or of both with the split line under them. Absent: the post's numbers, as before two platforms. */
export function PostedShow({ s, handle, view }: { s: PostState; handle: Handle | null; view?: View }) {
  const srcs = slidesOf(s);
  const nb = numbersIn(s, view ?? "both");
  /* Saves are TikTok's: none on the Instagram view. */
  const saves = view === "instagram" ? null : view === "both" ? numbersIn(s, "tiktok") : nb;
  const when = s.posted ? `${wdm(s.row.date)}, ${s.posted.time}` : wdm(s.row.date);
  const z = (v: number) => (v === 0 ? "is-zero" : undefined);
  const body = (
    <>
      <span className="show__when"><b>{when}</b><small>{s.row.handle} · {s.row.slot}</small></span>
      <span className="show__topic">{s.row.topic}</span>
      {nb ? (
        <span className="show__nums"><span><b>{n(nb.views)}</b> views</span>{saves ? <span className={z(saves.saves)}>{word(saves.saves, "save")}</span> : view === "instagram" ? <span className="is-zero">saves not reported</span> : null}<span className={z(nb.shares)}>{word(nb.shares, "share")}</span></span>
      ) : (
        <span className="show__nums"><span className="is-zero">posted, no read yet</span></span>
      )}
      {view === "both" ? <LegSplit s={s} /> : null}
      <span className="show__state"><span className="state state--short" title={s.row.format}>{formatHead(s.row.format)}{srcs.length ? ` · ${srcs.length} slides` : ""}</span></span>
    </>
  );
  void handle;
  return <Show srcs={srcs} alt={`${s.row.topic} by ${s.row.handle}`} href={postPath(s.row)} bodyHref={postPath(s.row)} body={body} kind={s.dimension} dim={s.dimension} />;
}

export function BatchShow({ p, href }: { p: BatchPost; href: string }) {
  const body = (
    <>
      <span className="show__handle"><span>@{p.handle}</span><small>{p.date ? dmy(p.date) : ""}{p.slideCount ? ` · ${p.slideCount} slides` : ""}</small></span>
      <span className="show__hook">{p.caption || "no caption"}</span>
      <span className="show__nums"><span><b>{n(p.views)}</b> views</span><span>{word(p.saves, "save")}</span><span>{pct(p.saves, p.views)} saves/view</span></span>
    </>
  );
  return <Show srcs={p.slides.slice(0, 6)} alt={`${p.caption || p.id} by @${p.handle}`} href={p.url} external body={body} bodyHref={href} scraped kind="scrolled" />;
}

/** One held post of a researched app: the top post of its network. */
export function AppShow({ brand, post }: { brand: Brand; post: Post }) {
  const srcs = post.slides.length ? post.slides.slice(0, 6) : post.cover ? [post.cover] : [];
  const kind = post.format === "video" ? "video" : `${post.slideCount || srcs.length} slides`;
  const body = (
    <>
      <span className="show__handle"><span>{brand.name} <small>· @{post.handle}</small></span><small>{dmy(post.date)}</small></span>
      <span className="show__hook">{post.onScreen ?? post.caption.split(" #")[0]}</span>
      <span className="show__nums"><span><b>{n(post.views)}</b> views</span><span>{word(post.bookmarks, "save")}</span><span>{pct(post.bookmarks, post.views)} saves/view</span></span>
    </>
  );
  return <Show srcs={srcs} alt={`${head(post.caption, 60)} by @${post.handle}, promoting ${brand.name}`} href={`/post/${post.id}`} bodyHref={`/post/${post.id}`} body={body} scraped kind={kind} />;
}

export function AppCard({ brand }: { brand: Brand }) {
  const st = brand.stats;
  return (
    <Link className="hcard hcard--app" href={`/brand/${encodeURIComponent(brand.id)}`} title={`${brand.name}: the app’s home in the Atlas`}>
      <Face src={brand.logo ?? null} name={brand.name} square word="no logo" />
      <span className="hcard__name">{brand.name}</span>
      <span className="hcard__role">in the ledger · {brand.hasTeardown ? "teardown written" : "no teardown yet"}</span>
      <dl className="stats stats--sm">
        <div><dd>{st.accountCount}</dd><dt>handles</dt></div>
        <div><dd>{n(st.postCount)}</dd><dt>posts held</dt></div>
        <div><dd>{short(st.topPostViews)}</dd><dt>top post</dt></div>
      </dl>
    </Link>
  );
}

export function HandleCard({ h, states, href }: { h: Handle; states: PostState[]; href: string }) {
  const mine = states.filter((s) => s.row.short === h.short);
  const posted = mine.filter((s) => !!s.posted && !s.killed);
  const views = posted.reduce((t, s) => t + (numbersOf(s)?.views ?? 0), 0);
  const planned = mine.filter((s) => !s.posted && !s.killed).length;
  const ig = (h.accounts ?? []).find((a) => a.platform === "instagram") ?? null;
  return (
    <Link className="hcard" href={href}>
      <span className={`hcard__dot${h.connected ? " is-ok" : ""}`} role="img" aria-label={h.connected ? "Connected to the posting service" : "Not connected yet"} title={h.connected ? "Connected to the posting service · turns ember when the connection needs you" : "Not connected to the posting service yet"} />
      <Face src={h.profile} name={h.handle} />
      {ig ? <><Account p="tiktok" name={h.handle} className="hcard__name" /><Account p="instagram" name={ig.account} /></> : <span className="hcard__name">{h.handle}</span>}
      <span className="hcard__role">{h.role ?? "handle"} · {h.complete ? "complete" : `step ${h.next?.n ?? 5} of 5`}</span>
      <dl className="stats stats--sm">
        <div><dd>{n(views)}</dd><dt>views</dt></div>
        <div><dd>{posted.length}</dd><dt>posted</dt></div>
        <div><dd>{planned}</dd><dt>planned</dt></div>
      </dl>
    </Link>
  );
}

export function HandleCardLater({ name, role, line, href }: { name: string; role: string; line?: string; href: string }) {
  return (
    <Link className="hcard hcard--later" href={href}>
      <span className="face face--none" role="img" aria-label={`${name}: not created yet`}>not yet</span>
      <span className="hcard__name">{name}</span>
      <span className="hcard__role">{role}</span>
      <span className="state" style={{ marginTop: 8 }}>{line ?? "Create it on TikTok, then the five steps start."}</span>
    </Link>
  );
}

/** The five-step marks of a handle in one row. */
export function StepMarks({ h }: { h: Handle }) {
  const states = h.steps.map((s) => (s.state === "done" ? "approved" : s.state === "you" ? "waiting" : s.state === "agent" ? "inhand" : "open")) as ("approved" | "waiting" | "inhand" | "open")[];
  return <MarkRow states={states} label={h.complete ? "five steps done" : `step ${h.next?.n ?? 5} of 5`} />;
}
