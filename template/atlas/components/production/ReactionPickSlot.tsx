/**
 * The reaction of a video with a reaction hook, in stage 1 and stage 2
 * (ATLAS-VIDEO-STAGES-PLAN.md § 5.1, REACTION-LIBRARY-PLAN.md § 5): the brief's
 * reaction_reference as a card (the library entry it names, else the reference and the
 * post's media), the user's last reaction.pick as a second card while video-plan has not
 * copied it into the brief ("picked, not in the plan yet"), and Switch reaction: the
 * library in a panel at the right of the page (components/reactions/SwitchReaction).
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { ReactionCardView } from "@/components/reactions/ReactionCardView";
import { SwitchReaction } from "@/components/reactions/SwitchReaction";
import { cardOfEntry, lastPick, readLibrary } from "@/lib/reactions";
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
  /** The plan is approved or locked: a switch also sends it back for a new revision. */
  locked?: boolean;
  /** The brief's hook job, the panel's first filter. */
  job?: string | null;
  /** Shown only when the reference has no card (no served video and no library entry). */
  children?: ReactNode;
};

export function ReactionPickSlot({ video, app, post, current, locked = false, job = null, children }: ReactionPickProps) {
  /* The user's last pick in the reaction library: video-plan writes it into the brief on its next run. */
  const picked = lastPick(app, video);
  const pending = picked && picked !== current?.libraryId ? readLibrary().entries[picked] ?? null : null;
  return (
    <div className="vst__slot" id="choose-reaction" data-slot="choose-reaction">
      <p className="vst__slot-h"><b>The reaction</b>{current ? ` · ${current.handle ?? "?"} · post ${current.post ?? "?"} · ${current.start ?? "?"}–${current.end ?? "?"} s` : " · none chosen yet"}</p>
      {current?.card ? <ReactionCardView c={current.card} label={current.libraryId ? "In the plan · from the reaction library" : "In the plan · not from the library"} /> : <>{current?.burnedInText ? <p className="sr__hint">Burned-in text: {current.burnedInText}</p> : null}{children}</>}
      {pending ? <ReactionCardView c={cardOfEntry(pending)} label="Picked, not in the plan yet: video-plan copies it into the brief on its next run" /> : null}
      {picked && !pending && picked !== current?.libraryId ? <p className="sr__hint">Picked {picked}, which is not in the library any more.</p> : null}
      {/* A div, not a p: the Switch reaction dialog holds blocks. */}
      <div className="sr__hint rx-switch">
        <SwitchReaction app={app} video={video} post={post} job={job} gated={locked} current={current?.libraryId ?? null} picked={picked} />
        {locked ? " The plan is approved or locked: switching sends it back for a new revision." : null}
        {" "}<Link href={`/reactions?pick=${encodeURIComponent(app)}/${encodeURIComponent(video)}`}>or open the whole library</Link>
      </div>
    </div>
  );
}
