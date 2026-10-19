/**
 * The place for the reaction library's **Choose a reaction** button in stage 1 of a video
 * with a reaction hook (ATLAS-VIDEO-STAGES-PLAN.md § 5.1, REACTION-LIBRARY-PLAN.md § 5).
 * The reaction library work owns the button and its `reaction.pick` line; it renders here,
 * in `children` or in place of the placeholder below. This slot shows the reference the
 * brief has now, so the user sees what a pick would replace.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { lastPick } from "@/lib/reactions";
import type { BriefSummary } from "@/lib/video";
import "@/app/reactions/reactions.css";

export type ReactionPickProps = {
  /** The video id the pick is for (reaction.pick data.video). */
  video: string;
  /** The app slug, for the decision log. */
  app: string;
  /** The post key of the video row. */
  post: string;
  /** The reference the brief holds now, if any. */
  current: BriefSummary["reaction"];
  children?: ReactNode;
};

export function ReactionPickSlot({ video, app, current, children }: ReactionPickProps) {
  /* The user's last pick in the reaction library: video-plan writes it into the brief on its next run. */
  const picked = lastPick(app, video);
  return (
    <div className="vst__slot" id="choose-reaction" data-slot="choose-reaction">
      <p className="vst__slot-h"><b>The reaction</b>{current ? ` · ${current.handle ?? "?"} · post ${current.post ?? "?"} · ${current.start ?? "?"}–${current.end ?? "?"} s` : " · none chosen yet"}</p>
      {current?.burnedInText ? <p className="sr__hint">Burned-in text: {current.burnedInText}</p> : null}
      {children}
      <p className="sr__hint">
        <Link className="rx-btn" href={`/reactions?pick=${encodeURIComponent(app)}/${encodeURIComponent(video)}`}>Choose a reaction</Link>
        {picked ? <> · picked: <Link href={`/reactions/${picked}`}>{picked}</Link> (video-plan copies it into the brief)</> : null}
      </p>
    </div>
  );
}
