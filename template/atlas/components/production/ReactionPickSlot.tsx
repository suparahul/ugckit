/**
 * The reaction of a video with a reaction hook, in the hook's row of the one-document page
 * (ATLAS-VIDEO-PAGE-CLEANUP.md § 6.2, REACTION-LIBRARY-PLAN.md § 5): the brief's
 * reaction_reference in words (the handle, the range, the library entry it names, its tags,
 * the expression beats the character copies), the user's last reaction.pick as a card while
 * video-plan has not copied it into the brief ("picked, not in the plan yet"), and Switch
 * reaction: the library in a panel at the right of the page (components/reactions/
 * SwitchReaction). The clip itself plays in the row's media column, not here.
 */

import Link from "next/link";

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
};

const secs = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

export function ReactionPickSlot({ video, app, post, current, locked = false, job = null }: ReactionPickProps) {
  /* The user's last pick in the reaction library: video-plan writes it into the brief on its next run. */
  const picked = lastPick(app, video);
  const pending = picked && picked !== current?.libraryId ? readLibrary().entries[picked] ?? null : null;
  const c = current?.card ?? null;
  return (
    <div className="rx" id="choose-reaction" data-slot="choose-reaction">
      <p className="rx__h">
        <b>The reaction</b>
        {current ? <> · {current.handle ?? "?"} · <span className="tabular">{current.start ?? "?"}–{current.end ?? "?"} s</span></> : " · none chosen yet"}
        {c?.entryId ? <> · <Link href={`/reactions/${c.entryId}`}>from the reaction library</Link>{c.status && c.status !== "kept" ? ` (${c.status})` : ""}</> : current ? " · not from the library" : null}
        {c?.tags.length ? <> · {c.tags.join(", ")}</> : null}
      </p>
      {c ? (
        c.beats.length ? (
          <>
            <p className="rx__lead">The character copies the motion of this clip, in time:</p>
            <ol className="rx-beats">{c.beats.map((b, i) => <li key={i}><span className="tabular">{secs(b.start_s)}–{secs(b.end_s)} s</span> {b.face}{b.eyes ? `; eyes ${b.eyes}` : ""}{b.head ? `; head ${b.head}` : ""}</li>)}</ol>
          </>
        ) : <p className="rx__lead">The character copies the motion of this clip. No expression beats are written yet.</p>
      ) : null}
      {pending ? <ReactionCardView c={cardOfEntry(pending)} label="Picked, not in the plan yet: video-plan copies it into the brief on its next run" /> : null}
      {picked && !pending && picked !== current?.libraryId ? <p className="sr__hint">Picked {picked}, which is not in the library any more.</p> : null}
      {/* A div, not a p: the Switch reaction dialog holds blocks. */}
      <div className="sr__hint rx-switch">
        <SwitchReaction app={app} video={video} post={post} job={job} gated={locked} current={current?.libraryId ?? null} picked={picked} />
        {locked ? " The plan is approved or locked: switching sends it back for a new revision." : null}
        {" "}<Link href={`/reactions?pick=${encodeURIComponent(app)}/${encodeURIComponent(video)}`}>or open the whole library</Link>
        {c?.postHref ? <> · <Link href={c.postHref}>the post</Link></> : null}
        {c?.url ? <> · <a href={c.url} target="_blank" rel="noopener noreferrer">open on {c.url.includes("instagram.com") ? "Instagram" : "TikTok"}</a></> : null}
      </div>
    </div>
  );
}
