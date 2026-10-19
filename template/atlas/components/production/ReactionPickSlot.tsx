/**
 * The reaction of a video with a reaction hook, in stage 1 and stage 2
 * (ATLAS-VIDEO-STAGES-PLAN.md § 5.1, REACTION-LIBRARY-PLAN.md § 5): the brief's
 * reaction_reference as a card (the library entry it names, else the reference and the
 * post's media), the user's last reaction.pick as a second card while video-plan has not
 * copied it into the brief ("picked, not in the plan yet"), and Choose a reaction.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { ReactionCardView } from "@/components/reactions/ReactionCardView";
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
  /** The plan is locked: a pick changes nothing until the plan is sent back. */
  locked?: boolean;
  /** Shown only when the reference has no card (no served video and no library entry). */
  children?: ReactNode;
};

export function ReactionPickSlot({ video, app, current, locked = false, children }: ReactionPickProps) {
  /* The user's last pick in the reaction library: video-plan writes it into the brief on its next run. */
  const picked = lastPick(app, video);
  const pending = picked && picked !== current?.libraryId ? readLibrary().entries[picked] ?? null : null;
  return (
    <div className="vst__slot" id="choose-reaction" data-slot="choose-reaction">
      <p className="vst__slot-h"><b>The reaction</b>{current ? ` · ${current.handle ?? "?"} · post ${current.post ?? "?"} · ${current.start ?? "?"}–${current.end ?? "?"} s` : " · none chosen yet"}</p>
      {current?.card ? <ReactionCardView c={current.card} label={current.libraryId ? "In the plan · from the reaction library" : "In the plan · not from the library"} /> : <>{current?.burnedInText ? <p className="sr__hint">Burned-in text: {current.burnedInText}</p> : null}{children}</>}
      {pending ? <ReactionCardView c={cardOfEntry(pending)} label="Picked, not in the plan yet: video-plan copies it into the brief on its next run" /> : null}
      {picked && !pending && picked !== current?.libraryId ? <p className="sr__hint">Picked {picked}, which is not in the library any more.</p> : null}
      <p className="sr__hint">
        {locked ? "The plan is locked: another reaction needs the plan sent back first (the decision bar at the top). " : null}
        <Link className="rx-btn" href={`/reactions?pick=${encodeURIComponent(app)}/${encodeURIComponent(video)}`}>{current || picked ? "Choose another reaction" : "Choose a reaction"}</Link>
      </p>
    </div>
  );
}
