"use client";

/**
 * The right column of the band after the final approval, in its three quiet
 * states (one rule: lib/production.ts postingStep). The primary action on top,
 * one row: the text actions to the left of the primary button; the sentence
 * and the one note line are the band's left column (page.tsx, postingNotes).
 *
 *   send    Export files · Mark as manually posted · Schedule direct post… · [Send to TikTok drafts]   (the account warning under the button)
 *           "Schedule direct post…" opens a row with a date and a New York time (default 19:00 the next day, the
 *           India time beside it) and [Schedule]: Post Bridge publishes it at that instant, cover text burned in.
 *   sent    open on TikTok (once the sync found the link) · add the link · Send again · Export files · [Mark posted]
 *   posted  open on TikTok · Export files again · [Sync outcomes]   (the day-7 form above, when open)
 *
 * "Sync outcomes" runs the whole sync (lib/postbridge-flow.ts syncAll): the
 * link and the numbers through Monid, then Post Bridge as the second source.
 *
 * The send calls the same lib function as scripts/postbridge-send.mjs.
 * "Export files" writes ~/Downloads/tiktok-<post>/ (lib/export-flow.ts) and
 * then shows "Exported to … · open"; "Mark as manually posted" only marks the post
 * posted, for posts that went out outside the pipeline.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { PBAccount } from "@/lib/postbridge";
import type { Event, SentState, SyncedState } from "@/lib/production";
import { fmtBoth, fmtIn, shortOf, tomorrowIn, weekdayIn, zonedToUtc, type Zones } from "@/lib/when";
import { appFromPath } from "./scope";

/** What the page computes server-side: the account and why the send is not offered. */
export type BridgeInfo = { account: PBAccount | null; why: string | null; canSend: boolean };

type Status = { word: "queued" | "scheduled" | "draft created" | "posted" | "error"; status: string; error: string | null; url: string | null };
type Decide = (e: Omit<Event, "at">) => Promise<void>;

const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/**
 * The live status of the last send, one small line: "Post Bridge says: draft created · id 5f2c… · 7 images · sent 09:02".
 * A direct post before its time needs no call: "Scheduled for Wed 19:00 ET (Thu 04:30 IST) · direct · id … · 7 images".
 */
export function SendStatusLine({ post, sent }: { post: string; sent: SentState }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pending = sent.mode === "direct" && !!sent.scheduledAt && new Date(sent.scheduledAt).getTime() > Date.now();
  const read = useCallback(async () => {
    if (pending) return;
    setErr(null);
    try {
      const r = await fetch(`/api/production/postbridge/status?app=${encodeURIComponent(appFromPath())}&post=${encodeURIComponent(post)}`, { cache: "no-store" });
      const j = (await r.json()) as Status & { error?: string };
      if (!r.ok) setErr(j.error ?? "Post Bridge did not answer.");
      else setStatus(j);
    } catch {
      setErr("The server did not answer.");
    }
  }, [post, pending]);
  useEffect(() => { void read(); }, [read]);
  if (pending) return <li>Scheduled for {fmtBoth(sent.scheduledAt!)} · direct · id {sent.id} · {sent.media.length} images · sent {sent.at.slice(11, 16)}</li>;
  return (
    <li className={status?.word === "error" || err ? "is-bad" : undefined}>
      Post Bridge says: {status ? `${status.word}${status.error ? ` — ${status.error}` : ""}` : err ?? "reading…"}{sent.mode === "direct" && sent.scheduledAt ? ` · direct, ${fmtBoth(sent.scheduledAt)}` : ""} · id {sent.id} · {sent.media.length} images · sent {sent.at.slice(11, 16)}
      {" "}<button type="button" className="next__link" onClick={() => void read()}>refresh</button>
    </li>
  );
}

/** "Export files" and, once done, "Exported to ~/Downloads/… · open". */
function ExportFiles({ post, exported }: { post: string; exported: { at: string; dir: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(exported ? tilde(exported.dir) : null);
  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/production/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: appFromPath(), post }) });
      const j = (await r.json()) as { error?: string; shown?: string };
      if (!r.ok) setNote(j.error ?? "The export failed.");
      else { setShown(j.shown ?? null); router.refresh(); }
    } catch {
      setNote("The server did not answer.");
    } finally {
      setBusy(false);
    }
  };
  const open = async () => {
    setNote(null);
    try {
      const r = await fetch("/api/production/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: appFromPath(), post }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setNote(j.error ?? "Could not open the folder.");
    } catch {
      setNote("The server did not answer.");
    }
  };
  return (
    <>
      <button type="button" className="rail__kill" disabled={busy} title="Writes the slides, cover text and caption to ~/Downloads" onClick={() => void run()}>{busy ? "exporting…" : shown ? "Export files again" : "Export files"}</button>
      {shown ? <span className="posting__exported">Exported to {shown} · <button type="button" className="next__link" onClick={() => void open()}>open</button></span> : null}
      {note ? <span className="posting__exported is-bad">{note}</span> : null}
    </>
  );
}

const tilde = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");

/** Marks the post posted: the time is now, the link optional. */
function MarkPosted({ post, busy, onDecide, primary, withLink }: { post: string; busy: boolean; onDecide: Decide; primary: boolean; withLink: boolean }) {
  const [url, setUrl] = useState("");
  return (
    <form className="posting__mark" onSubmit={(e) => { e.preventDefault(); void onDecide({ post, kind: "posted", data: { time: nowHHMM(), ...(url.trim() ? { url: url.trim() } : {}) } }); }}>
      {withLink ? <input className="posting__url" type="url" placeholder="https://www.tiktok.com/@…/photo/…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="TikTok link" autoFocus /> : null}
      <button type="submit" className={primary ? "rail__go" : "pill"} disabled={busy}>Mark posted</button>
    </form>
  );
}

/** The TikTok link, once the sync found it or Rahul typed it. */
function OpenOnTikTok({ link }: { link: string | null }) {
  return link ? <a className="rail__kill" href={link} target="_blank" rel="noreferrer" title={link}>open on TikTok</a> : null;
}

/** The direct-post row: a date and a time in the posting zone (default 19:00 tomorrow), the home-zone time beside, [Schedule]. */
function ScheduleDirect({ who, busy, zones, onSchedule, onCancel }: { who: string; busy: boolean; zones: Zones; onSchedule: (atUtc: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(() => tomorrowIn(zones.posting));
  const [time, setTime] = useState("19:00");
  let at: string | null = null;
  try { at = zonedToUtc(date, time, zones.posting); } catch { at = null; }
  const past = !!at && new Date(at).getTime() <= Date.now();
  const P = shortOf(zones.posting), H = shortOf(zones.home);
  return (
    <form className="posting__ask" onSubmit={(e) => { e.preventDefault(); if (at && !past) onSchedule(at); }}>
      Direct post on {who} at
      <input className="posting__url is-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={`Date, ${zones.posting}`} required />
      <input className="posting__url is-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={`Time, ${zones.posting}`} required />
      <span className="posting__zone" title={zones.home !== zones.posting ? `${zones.posting}; the same instant in ${zones.home}` : zones.posting}>{at ? (zones.home !== zones.posting ? `${weekdayIn(at, zones.posting)} ${P} = ${fmtIn(at, zones.home, H, true)}` : `${weekdayIn(at, zones.posting)} ${P}`) : P}</span>
      <button type="submit" className="pill" disabled={busy || !at || past} title="Post Bridge publishes it then: public, comments on, TikTok picks the sound; slide 1 text burned in">{busy ? "Scheduling…" : "Schedule"}</button>
      <button type="button" className="rail__kill" onClick={onCancel}>cancel</button>
      {past ? <span className="is-bad">That time is past.</span> : null}
    </form>
  );
}

export function PostingRail({
  post,
  handle,
  alsoInstagram = false,
  sent,
  link,
  exported,
  bridge,
  warning,
  busy,
  onDecide,
  zones,
}: {
  post: string;
  handle: string;
  /** The post also goes to Instagram in the same send: always published at once, with no music. */
  alsoInstagram?: boolean;
  sent: SentState | null;
  link: string | null;
  exported: { at: string; dir: string } | null;
  bridge: BridgeInfo;
  /** Under the send button: why the send is not offered, or null. */
  warning: string | null;
  busy: boolean;
  onDecide: Decide;
  /** The posting zone and the home zone, from the plan. */
  zones: Zones;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [byHand, setByHand] = useState(false);
  const [withLink, setWithLink] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (at?: string) => {
    setAsking(false);
    setSending(true);
    setErr(null);
    try {
      const r = await fetch("/api/production/postbridge/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: appFromPath(), post, force: !!sent, ...(at ? { mode: "direct", at } : {}) }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) setErr(j.error ?? "The send failed.");
      else { setScheduling(false); router.refresh(); }
    } catch {
      setErr("The server did not answer.");
    } finally {
      setSending(false);
    }
  };
  const who = bridge.account ? `@${bridge.account.username}` : handle;
  const schedule = <ScheduleDirect who={who} busy={sending} zones={zones} onSchedule={(at) => void send(at)} onCancel={() => setScheduling(false)} />;
  const cancelHand = () => { setByHand(false); setWithLink(false); };

  if (!sent) {
    return (
      <div className="posting">
        <div className="posting__row">
          {byHand ? (
            <span className="posting__ask">
              Mark as manually posted?
              <MarkPosted post={post} busy={busy} onDecide={onDecide} primary={false} withLink={withLink} />
              {!withLink ? <button type="button" className="rail__kill" onClick={() => setWithLink(true)}>add the link</button> : null}
              <button type="button" className="rail__kill" onClick={cancelHand}>cancel</button>
            </span>
          ) : asking ? (
            <span className="posting__ask">
              Send to the drafts of {who}{alsoInstagram ? " and publish on Instagram now (no music: add it in the Instagram app)" : ""}?
              <button type="button" className="pill" disabled={sending} onClick={() => void send()}>Yes, send</button>
              <button type="button" className="rail__kill" onClick={() => setAsking(false)}>cancel</button>
            </span>
          ) : scheduling ? schedule : (
            <>
              <ExportFiles post={post} exported={exported} />
              <button type="button" className="rail__kill" title="Marks it posted. Use Export files to get the images first." onClick={() => setByHand(true)}>Mark as manually posted</button>
              <button type="button" className="rail__kill" disabled={sending || !bridge.canSend} title={`Post Bridge publishes it at a set time${alsoInstagram ? ", on TikTok and Instagram together" : ""}; nobody types the cover text, so it is burned into slide 1`} onClick={() => setScheduling(true)}>Schedule direct post…</button>
              <button type="button" className="rail__go" disabled={sending || !bridge.canSend} onClick={() => setAsking(true)}>{sending ? "Sending…" : alsoInstagram ? "Send to TikTok drafts and Instagram" : "Send to TikTok drafts"}</button>
            </>
          )}
        </div>
        {warning && !byHand && !asking && !scheduling ? <p className="posting__under">{warning}</p> : null}
        {err ? <p className="posting__under is-bad" role="alert">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="posting">
      <div className="posting__row">
        {asking ? (
          <span className="posting__ask">
            A second draft on {who}?
            <button type="button" className="pill" disabled={sending} onClick={() => void send()}>Yes, send</button>
            <button type="button" className="rail__kill" onClick={() => setAsking(false)}>cancel</button>
          </span>
        ) : scheduling ? schedule : (
          <>
            <OpenOnTikTok link={link} />
            {!withLink && !link ? <button type="button" className="rail__kill" title="The TikTok link, once the post is live; optional" onClick={() => setWithLink(true)}>add the link</button> : null}
            <button type="button" className="rail__kill" disabled={sending || !bridge.canSend} title="A second draft on the account; the first stays on the phone" onClick={() => setAsking(true)}>{sending ? "sending…" : "Send again"}</button>
            <button type="button" className="rail__kill" disabled={sending || !bridge.canSend} title="A second send, direct at a set time; the first stays where it is" onClick={() => setScheduling(true)}>Schedule direct post…</button>
            <ExportFiles post={post} exported={exported} />
            <MarkPosted post={post} busy={busy} onDecide={onDecide} primary withLink={withLink} />
          </>
        )}
      </div>
      {err ? <p className="posting__under is-bad" role="alert">{err}</p> : null}
    </div>
  );
}

/** After posting: "open on TikTok", "Export files again" and, when the post went through Post Bridge, "Sync outcomes" as the primary. The day-7 form, when open, sits above. */
export function PostedRail({ post, sent, link, exported, synced, children }: { post: string; sent: SentState | null; link: string | null; exported: { at: string; dir: string } | null; synced: SyncedState | null; children?: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const sync = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await fetch("/api/production/postbridge/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: appFromPath(), post }) });
      const j = (await r.json()) as { error?: string; links?: { status: string; written: boolean; note: string }[]; reports?: { written: boolean; note: string }[]; postBridgeError?: string | null };
      if (!r.ok) setNote(j.error ?? "The sync failed.");
      else {
        const l = j.links?.[0];
        const rep = j.reports?.[0];
        const monid = !l ? "Not sent through Post Bridge: nothing to sync." : l.status === "linked" ? `Link found; ${l.note}.` : l.status === "error" ? l.note : `Monid: ${l.note}.`;
        const pb = j.postBridgeError ? `Post Bridge not read: ${j.postBridgeError}.` : rep ? (rep.written ? "Post Bridge: new numbers written." : `Post Bridge: ${rep.note}.`) : "";
        setNote(`${monid} ${pb}`.trim());
        router.refresh();
      }
    } catch {
      setNote("The server did not answer.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="posting">
      {children ? <div className="posting__row">{children}</div> : null}
      <div className="posting__row">
        <OpenOnTikTok link={link} />
        <ExportFiles post={post} exported={exported} />
        {sent ? <button type="button" className="rail__go" disabled={busy} title="Finds the TikTok link and pulls views, likes, comments, saves and shares through Monid into the log; Post Bridge analytics second" onClick={() => void sync()}>{busy ? "Syncing…" : "Sync outcomes"}</button> : null}
      </div>
      {synced ? <p className="posting__under">{synced.source === "monid" ? "Monid" : "Post Bridge"} {synced.at.slice(0, 10)}: {synced.views.toLocaleString("en-US")} views · {synced.likes.toLocaleString("en-US")} likes · {synced.comments.toLocaleString("en-US")} comments{synced.saves != null ? ` · ${synced.saves.toLocaleString("en-US")} saves` : ""} · {synced.shares.toLocaleString("en-US")} shares</p> : null}
      {note ? <p className="posting__under">{note}</p> : null}
    </div>
  );
}
