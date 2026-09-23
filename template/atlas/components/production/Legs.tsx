/**
 * The post page's legs, under the title, when the post goes to more than
 * TikTok: the switch (both platforms · TikTok · Instagram) with each leg's
 * state word, the view the read follows, the failed leg in its platform's own
 * words, and the control that takes the Instagram leg off this post or puts
 * it back (a `leg.drop` / `leg.add` line). One TikTok leg: nothing is drawn.
 */

import { PLATFORMS, PLATFORM_NAME, type Platform } from "@/lib/platform";
import type { PostState } from "@/lib/production";
import type { View } from "@/lib/read";
import { PlatformSwitch } from "@/components/Platform";
import { LegToggle } from "./LegToggle";

type Word = { text: string; tone?: "waiting" | "approved" | "out" | "failed" };

/** One leg's state in a word or two: what the leg is waiting for, or where it is. */
export function legWord(s: PostState, p: Platform): Word {
  const leg = s.legs?.[p];
  if (s.killed) return { text: "killed" };
  if (leg?.dropped) return { text: "not on this post", tone: "out" };
  if (leg?.failed) return { text: "failed", tone: "failed" };
  if (leg?.posted) return { text: "posted", tone: "approved" };
  if (leg?.sent) return leg.sent.mode === "direct" && leg.sent.scheduledAt ? { text: "scheduled", tone: "approved" } : p === "tiktok" ? { text: "in drafts", tone: "waiting" } : { text: "sent", tone: "approved" };
  if (s.final.status === "approved") return { text: "ready to send", tone: "waiting" };
  return { text: "waiting for the final" };
}

export function Legs({ s, href, view }: { s: PostState; href: string; view: View }) {
  const platforms = PLATFORMS.filter((p) => (s.platforms ?? ["tiktok"]).includes(p) || s.legs?.[p]);
  if (!platforms.some((p) => p !== "tiktok")) return null;
  const words: Partial<Record<Platform, Word>> = {};
  for (const p of platforms) words[p] = legWord(s, p);
  const ig = s.legs?.instagram;
  const slides = s.deck?.slides.length ?? 0;
  const over = slides > 10 && !ig?.dropped;
  const note = ig?.failed
    ? <>Instagram refused it ({ig.failed.at.slice(0, 16).replace("T", " ")} UTC): <em>“{ig.failed.error}”</em> TikTok is not touched. To send it again: <code>node scripts/posting-send.mjs {s.row.slug} --post {s.row.key} --only instagram --send</code></>
    : over ? <>{slides} slides: Instagram takes 10. Cut the deck, or take Instagram off this post.</>
    : ig?.posted && !ig.synced ? <>Live on Instagram. Add the music in the Instagram app: Edit, then Replace Audio.</>
    : !ig?.sent && !ig?.dropped ? <>Instagram publishes directly, at the same time as TikTok, with no music: add it in the Instagram app afterwards.</>
    : null;
  return (
    <div className="legs">
      <PlatformSwitch href={href} view={view} words={words} label="The platforms of this post" note={note} />
      {ig && !ig.sent && !s.killed ? <LegToggle slug={s.row.slug} post={s.row.key} platform="instagram" dropped={!!ig.dropped} name={PLATFORM_NAME.instagram} /> : null}
      {ig?.link ? <a className="legs__open" href={ig.link} target="_blank" rel="noreferrer">open on Instagram →</a> : null}
    </div>
  );
}
