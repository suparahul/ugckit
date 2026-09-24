/**
 * The reads block of a posted post: the numbers of the latest read, the
 * sentence with the sources and times, and the series of reads since posting
 * as a small line. Every point is an `outcome.sync` or `outcomes` line in
 * the log.
 */

import type { PostState } from "@/lib/production";
import { platformOf } from "@/lib/platform";
import { numbersIn, type View } from "@/lib/read";
import { n, pct } from "./Bits";

function Series({ reads, postedAt }: { reads: { at: string; views: number }[]; postedAt: string }) {
  const t0 = Date.parse(postedAt);
  const pts = reads.map((r) => ({ t: Math.max(Date.parse(r.at), t0), v: r.views, at: r.at }));
  const W = 280, H = 78, padx = 24, top = 16, base = 56;
  const tmax = Math.max(...pts.map((p) => p.t), t0 + 1);
  const vmax = Math.max(1, ...pts.map((p) => p.v));
  const x = (t: number) => padx + ((W - 2 * padx) * (t - t0)) / (tmax - t0);
  const y = (v: number) => base - ((base - top) * v) / vmax;
  const line = [[x(t0), base], ...pts.map((p) => [x(p.t), y(p.v)])].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  const hhmm = (iso: string) => iso.slice(11, 16);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Views at each read: ${pts.map((p) => `${p.at.slice(0, 16).replace("T", " ")} UTC ${n(p.v)}`).join(", ")}`}>
      <line className="series__base" x1="0" y1={base} x2={W} y2={base} />
      <polyline className="series__line" points={line} />
      {pts.map((p, i) => <circle key={i} className={`series__dot${i === pts.length - 1 ? " is-last" : ""}`} cx={x(p.t).toFixed(1)} cy={y(p.v).toFixed(1)} r="4.5"><title>{`${p.at.slice(0, 16).replace("T", " ")} UTC · ${n(p.v)} views`}</title></circle>)}
      {pts.length > 1 ? <text className="series__lbl" x={x(pts[0].t).toFixed(1)} y={(y(pts[0].v) - 8).toFixed(1)} textAnchor="middle">{n(pts[0].v)}</text> : null}
      <text className="series__lbl is-last" x={x(pts[pts.length - 1].t).toFixed(1)} y={(y(pts[pts.length - 1].v) - 8).toFixed(1)} textAnchor="end">{n(pts[pts.length - 1].v)}</text>
      <text className="series__t" x={x(t0).toFixed(1)} y={base + 13} textAnchor="start">posted {hhmm(postedAt)}</text>
      {/* A time label only where it does not sit on the one before it. */}
      {pts.reduce<{ last: number; out: React.ReactNode[] }>((acc, p, i) => {
        const px = x(p.t);
        const lastOne = i === pts.length - 1;
        if (!lastOne && px - acc.last < 60) return acc;
        acc.out.push(<text key={i} className="series__t" x={px.toFixed(1)} y={base + 13} textAnchor={lastOne ? "end" : "middle"}>{hhmm(p.at)}</text>);
        return { last: px, out: acc.out };
      }, { last: x(t0) + 60, out: [] }).out}
    </svg>
  );
}

/**
 * `view`: one platform's read, or "both" (the legs added up; the series and the
 * saves stay TikTok's, since no source gives Instagram's saves). A post with one
 * TikTok leg reads TikTok's numbers only.
 */
export function Reads({ s, view = "both" }: { s: PostState; view?: View }) {
  const leg = view === "both" ? s.primary ?? "tiktok" : view;
  const posted = leg === (s.primary ?? "tiktok") ? s.posted : s.legs?.[leg]?.posted ?? null;
  if (!posted) return null;
  const nb = numbersIn(s, view);
  const two = view !== "both" || (nb?.legs?.length ?? 1) > 1;
  /* Saves: TikTok's alone. On the Instagram view there are none to show. */
  const saves = leg === "instagram" ? null : two ? numbersIn(s, "tiktok") : nb;
  const reads = s.log.filter((e) => e.kind === "outcome.sync" && e.data && (platformOf(e.data.platform) ?? "tiktok") === leg).map((e) => ({ at: String(e.data!.syncedAt ?? e.at), views: Number(e.data!.views ?? 0), source: String(e.data!.source ?? "postbridge") }));
  const monid = reads.filter((r) => r.source === "monid");
  const series = monid.length ? monid : reads;
  const z = (v: number) => (v === 0 ? " is-zero" : "");
  const opens = s.posted ? new Date(Date.parse(s.posted.at.slice(0, 10)) + 7 * 86400000).toISOString().slice(0, 10) : null;
  return (
    <section className="reads" aria-label="The read">
      {nb ? (
        <p className="reads__nums">
          <span className="is-lead"><b>{n(nb.views)}</b>views</span>
          <span className={z(nb.likes)}><b>{n(nb.likes)}</b>likes</span>
          <span className={z(nb.comments)}><b>{n(nb.comments)}</b>{nb.comments === 1 ? "comment" : "comments"}</span>
          {saves ? <span className={z(saves.saves)}><b>{n(saves.saves)}</b>{saves.saves === 1 ? "save" : "saves"}{two ? " · TikTok" : ""}</span> : <span className="is-zero"><b>—</b>saves not reported</span>}
          <span className={z(nb.shares)}><b>{n(nb.shares)}</b>{nb.shares === 1 ? "share" : "shares"}</span>
          {saves ? <span className={`is-ratio${z(saves.saves)}`}><b>{pct(saves.saves, saves.views)}</b>saves/view{two ? " · TikTok" : ""}</span> : null}
        </p>
      ) : null}
      <p className="reads__line">
        {nb
          ? `Read ${reads.length === 1 ? "once" : reads.length === 2 ? "twice" : `${reads.length} times`}${monid.length ? " through Monid" : ""}, last ${nb.at.slice(0, 10)} ${nb.at.slice(11, 16)} UTC${reads.some((r) => r.source === "postbridge") && monid.length ? " · Post Bridge agrees" : ""}${s.outcomes ? " · the day-7 numbers are typed" : opens ? ` · on day 7 (${opens}) two counts are typed by hand: “what app?” comments and store impressions` : ""}`
          : `Posted ${posted.time}. No read yet; the sync brings the numbers.`}
      </p>
      {series.length ? <div className="series"><Series reads={series} postedAt={posted.at} /></div> : null}
    </section>
  );
}
