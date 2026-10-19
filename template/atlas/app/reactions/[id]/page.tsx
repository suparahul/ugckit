/**
 * /reactions/<id> — one entry of the reaction library: the range played from
 * the post, the expression beats, the framing, the burned-in text, the source
 * post and the videos that use it; Keep, Retire, Edit range, Tags, Note and
 * Use for a video in planning (components/reactions/EntryEditor).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { atlasPostHref, mediaUrl, planningVideos, readLibrary, readTags, usesOf, validEntryId } from "@/lib/reactions";
import { EntryEditor } from "@/components/reactions/EntryEditor";
import "@/app/post/[id]/post.css";
import "../reactions.css";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function load(id: string) {
  return validEntryId(id) ? readLibrary().entries[id] ?? null : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const e = load(id);
  return { title: e ? `${e.source.handle} · ${e.start_s}–${e.end_s} s — Reactions` : "Not found" };
}

export default async function ReactionPage({ params }: { params: Params }) {
  const { id } = await params;
  const e = load(id);
  if (!e) notFound();
  const uses = usesOf()[e.id] ?? [];
  const videos = planningVideos();
  const picked = Object.fromEntries(videos.map((v) => [`${v.app}/${v.video}`, v.picked]));
  const s = e.source;
  const post = atlasPostHref(s.post_dir, s.platform, s.post_id);
  const fr = e.framing ?? {};

  return (
    <div className="page rx rx-entry">
      <header className="post__head">
        <p className="eyebrow">
          <Link href="/reactions">Reactions</Link> · {s.handle} · {e.start_s}–{e.end_s} s · {e.status === "proposed" ? "proposed by the agent" : e.status}
        </p>
        {e.hook_text ? (
          <>
            <blockquote className="post__hook verbatim">{e.hook_text}</blockquote>
            <p className="rx-hint">The original's hook, for study only. A plan writes its own hook; the original's text is removed in production.</p>
          </>
        ) : null}
      </header>

      <div className="rx-entry__body">
        <EntryEditor id={e.id} status={e.status} start={e.start_s} end={e.end_s} tags={e.tags ?? []} note={e.note ?? ""} allTags={readTags().tags} video={mediaUrl(s.video)} poster={null} handle={s.handle} videos={videos.map((v) => ({ app: v.app, video: v.video, reaction: v.reaction, job: v.job }))} picked={picked} />

        <div className="rx-entry__detail">
          {e.preview ? <img className="rx-entry__sheet" src={`/api/reactions/preview/${e.id}`} alt={`Frames of the reaction, ${e.start_s} to ${e.end_s} s`} /> : <p className="rx-hint">No preview sheet yet: the agent makes it with reactions.py fill.</p>}

          <section className="post__section">
            <h2 className="eyebrow">Expression beats</h2>
            {e.expression_beats?.length ? (
              <ol className="rx-beats">
                {e.expression_beats.map((b, i) => (
                  <li key={i}>
                    <span className="tabular">{b.start_s}–{b.end_s} s</span> {b.face}; eyes {b.eyes}; head {b.head}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rx-hint">Not described yet. The agent watches the range and writes them (reactions.py describe).</p>
            )}
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Framing and sound</h2>
            <dl className="rx-facts">
              <dt>Framing</dt><dd>{[fr.framing, fr.camera_distance, fr.camera].filter(Boolean).join(" · ") || "—"}</dd>
              <dt>People</dt><dd>{fr.people ?? "—"}</dd>
              <dt>Room</dt><dd>{fr.room || "—"}</dd>
              <dt>Cuts in the range</dt><dd>{fr.cuts ?? "—"}</dd>
              <dt>Face hidden</dt><dd>{fr.face_hidden_s !== null && fr.face_hidden_s !== undefined ? `${fr.face_hidden_s} s` : "—"}</dd>
              <dt>Speech</dt><dd>{e.speech ?? "—"}</dd>
            </dl>
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Method</h2>
            <p className="post__desc">Motion copy: the character copies the motion of this range. A visible face is not a requirement.</p>
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Burned-in text</h2>
            {e.burned_in_text?.length ? (
              <ul className="rx-beats">
                {e.burned_in_text.map((b, i) => <li key={i}>“{b.text}”{b.where ? ` · ${b.where}` : ""}{b.kind === "ocr" ? " · read by OCR, not checked" : ""}</li>)}
              </ul>
            ) : <p className="post__desc">None written.</p>}
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Source</h2>
            <p className="post__desc">
              {s.handle} · {s.platform}{s.views !== null ? ` · ${s.views.toLocaleString("en-US")} views` : ""}{s.date ? ` · ${s.date}` : ""}
              <br />
              {post ? <Link href={post}>The post in the Atlas</Link> : null}
              {post && s.url ? " · " : null}
              {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">Open on {s.platform === "instagram" ? "Instagram" : "TikTok"}</a> : null}
            </p>
            <p className="rx-hint"><code>{s.video}</code>{s.video_sha256 ? <> · sha256 <code>{s.video_sha256.slice(0, 12)}…</code></> : " · no sha256 yet"}</p>
            <p className="rx-hint">Added by {e.added?.by === "you" ? "you" : "the agent"} on {e.added?.at?.slice(0, 10)}{e.set_by_you?.length ? `. You set: ${e.set_by_you.join(", ")}.` : "."}</p>
          </section>

          <section className="post__section">
            <h2 className="eyebrow">Used in</h2>
            <p className="post__desc">{uses.length ? uses.join(", ") : "No video uses it yet."}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
