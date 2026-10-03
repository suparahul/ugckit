/**
 * A video post's slot: the slideshow's place on the page, with no slide
 * navigator. Two modes, as the deck has:
 *
 *   plan       REVIEW.md, the exact revision the user approves (video_plan.py review).
 *   produced   the 9:16 frame: the delivered file in a player, or an empty
 *              frame while the video is in production. Beside it the locked
 *              plan's beats in order (time, the words or the action, the
 *              on-screen text) with each beat's production prompt once
 *              character-shots wrote it, then the caption as a slideshow shows
 *              its caption. No storyboard, gate, cost or generation progress.
 */

import Markdown from "@/components/Markdown";
import type { PostState } from "@/lib/production";
import { frameStyle } from "./Frame";
import { SoundIcon } from "./Marks";

const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function VideoView({ state, mode }: { state: PostState; mode: "plan" | "produced" }) {
  const v = state.video!;
  const { row } = state;

  if (mode === "plan" || !v.plan) {
    return (
      <section className="rep" aria-label="The plan as written">
        <div className="rep__top">
          <p className="rep__count tabular">
            {v.review ? `Revision ${v.review.revision ?? "?"}${v.lock && v.review.revision === v.lock.revision ? ", locked" : ", not locked"}` : "No REVIEW.md yet"}
            {v.review?.digest ? ` · digest ${v.review.digest.slice(0, 12)}` : ""}
          </p>
        </div>
        {v.review ? <Markdown text={v.review.text} className="vreview" /> : <p className="sr__hint">The plan appears here when video-script writes REVIEW.md.</p>}
      </section>
    );
  }

  const caption = v.plan.caption && !/^<.*>$/.test(v.plan.caption) ? v.plan.caption : null;
  return (
    <section className="rep" aria-label="The video as it will appear">
      <div className="rep__top">
        <p className="rep__count tabular">
          Locked revision {v.lock?.revision ?? "?"}
          {v.plan.lengthS ? ` · ${secs(v.plan.lengthS)} s` : ""} · {v.plan.beats.length} beat{v.plan.beats.length === 1 ? "" : "s"}
          {v.final ? ` · delivered${v.final.delivered ? ` ${v.final.delivered.slice(0, 10)}` : ""}` : ""}
        </p>
      </div>
      <div className="rep__body">
        <div className="rep__frame">
          <div className="frame vframe" style={frameStyle("9:16")}>
            {v.final ? (
              <video className="vframe__video" src={v.final.url} controls playsInline preload="metadata" aria-label={`The video ${v.id}`} />
            ) : (
              <p className="vframe__empty">The video is in production. It shows here when it is delivered.<small>pipeline/character/{v.id}/final/{v.id}.mp4</small></p>
            )}
          </div>
          {v.final ? <p className="rep__textflag"><strong>File:</strong> pipeline/character/{v.id}/final/{v.id}.mp4{v.final.duration ? ` · ${secs(v.final.duration)} s` : ""} · sha256 {v.final.sha256.slice(0, 12)}</p> : null}
        </div>

        <div className="rep__side">
          <div className="sr">
            <div className="sr__h"><span className="sr__title"><b>The beats</b> · the locked plan</span></div>
            <ol className="vbeats">
              {v.plan.beats.map((b) => (
                <li key={b.id} className="vbeat">
                  <p className="vbeat__h tabular"><b>{secs(b.start)}–{secs(b.end)} s</b>{b.role ? ` · ${b.role}` : ""}</p>
                  {b.said.length ? b.said.map((l, i) => <p key={i} className="vbeat__said">{l.speaker ? <span className="vbeat__who">{l.speaker}</span> : null}“{l.line}”</p>) : null}
                  {b.action ? <p className="vbeat__action">{b.said.length ? "" : "Action: "}{b.action}</p> : null}
                  {b.onScreen.map((t, i) => <p key={i} className="vbeat__screen">On screen: “{t}”</p>)}
                  {b.prompts.map((p) => (
                    <details key={p.segment} className="vbeat__prompt">
                      <summary>Prompt · segment {p.segment}</summary>
                      <pre>{p.text}</pre>
                    </details>
                  ))}
                </li>
              ))}
            </ol>
            {!v.plan.beats.some((b) => b.prompts.length) ? <p className="sr__hint">The per-shot prompts appear under each beat when production writes them.</p> : null}
          </div>

          <div className="tt">
            <div className="tt__handle">{row.handle}</div>
            <p className="tt__caption">
              {caption ?? <span className="is-blank">no caption in the plan</span>}{" "}
              {(row.tags ?? []).map((h) => <span key={h} className="tag">{h} </span>)}
            </p>
            <p className="tt__sound"><SoundIcon />{v.plan.music && !/^<.*>$/.test(v.plan.music) ? v.plan.music : "sound not chosen"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
