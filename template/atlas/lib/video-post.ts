/**
 * The rules of sending one video post (a delivered character video) through
 * the posting service. Pure: the flow (lib/postbridge-flow.ts) reads the file
 * and the state, then asks here what the post is and whether it may go.
 *
 * What differs from a slideshow, in one place:
 *   - the media is one file, final/<video>.mp4, the same on every leg (a TikTok
 *     video, an Instagram Reel); no compositor runs and nothing is rendered;
 *   - the file sent is the file approved: its sha256 now, delivery.json's and
 *     the final.approve line's must be one value;
 *   - the caption is plan.json publishing_note.caption, then the row's tags
 *     (the slideshow's caption.txt rule: the tags are added unless the caption
 *     carries them already);
 *   - direct mode adds no sound (TikTok's auto_add_music is for photo posts),
 *     and there is no cover text to burn: the overlays are in the file.
 *
 * The founder's decisions of 2026-10-04: the AI-generated label is on for every
 * video (TikTok's `is_aigc`, in both modes; Instagram has no such field in Post
 * Bridge, so the page reminds); the cover frame is each platform's default (the
 * hook text is on frame 1); a video whose plan has a music note goes as a TikTok
 * draft only, so the sound is added on the phone, and direct mode is refused for
 * it; duet and stitch stay on; Instagram gets the Reel at once, as slides do.
 *
 * The limits below are the platforms' published ones for API posts (TikTok's
 * Content Posting API, Meta's Reels publishing); Post Bridge's API document
 * states none of its own. They are checked here so a send fails before an
 * upload, not after.
 */

export const VIDEO_LIMITS = {
  /** TikTok and Instagram: a caption of 2,200 characters at most. */
  captionChars: 2200,
  /** Instagram: 30 hashtags at most in a caption. */
  igHashtags: 30,
  /** TikTok and Instagram Reels: 3 s at least. */
  minSeconds: 3,
  /** TikTok through the API: 10 minutes for most accounts (the account's own limit can be lower). */
  maxSeconds: 600,
  /** Instagram Reels through the API: 300 MB. TikTok takes 4 GB. */
  maxBytes: 300 * 1024 * 1024,
} as const;

/** A placeholder left in a plan (`<optional>`): not a value. */
export const placeholder = (s: string | null | undefined) => !s || !s.trim() || /^<.*>$/.test(s.trim());

/** The caption of a video post: the plan's caption, then the row's tags unless it carries every one. Null when the plan has none. */
export function videoCaption(caption: string | null | undefined, tags: string[] = []): string | null {
  if (placeholder(caption)) return null;
  const c = caption!.trim();
  const missing = tags.filter((t) => !c.includes(t));
  return missing.length ? [c, ...missing].join(" ") : c;
}

export type VideoSendCheck = {
  /** The caption the post carries, or null. */
  caption: string | null;
  /** Why the post is not sent, or null. */
  skip: string | null;
  /** Said before the send, not a reason to stop. */
  warnings: string[];
};

/**
 * Whether one delivered video may be sent, and what to say first. `sha256` is
 * the file's checksum computed now; `delivered` is delivery.json's; `approved`
 * is the hash of the final.approve line (null when not approved).
 */
export function checkVideoSend(v: {
  id: string;
  caption: string | null | undefined;
  tags?: string[];
  music: string | null | undefined;
  sha256: string | null;
  delivered: string | null;
  approved: string | null;
  bytes: number | null;
  duration: number | null;
  mode: "draft" | "direct";
  platforms: ("tiktok" | "instagram")[];
}): VideoSendCheck {
  const L = VIDEO_LIMITS;
  const caption = videoCaption(v.caption, v.tags);
  const tags = caption?.match(/#[\w]+/g)?.length ?? 0;
  const ig = v.platforms.includes("instagram");
  const tt = v.platforms.includes("tiktok");
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  const skip =
    v.sha256 === null ? `final/${v.id}.mp4 is missing`
    : !v.delivered ? "final/delivery.json has no sha256"
    : v.sha256 !== v.delivered ? `final/${v.id}.mp4 is not the delivered file (sha256 ${v.sha256.slice(0, 12)}, delivery.json says ${v.delivered.slice(0, 12)}): deliver it again (character-deliver)`
    : v.approved !== null && v.approved !== v.sha256 ? `the file is not the one approved for posting (sha256 ${v.sha256.slice(0, 12)}, approved ${v.approved.slice(0, 12)}): watch it and approve it again`
    : !caption ? "plan.json has no publishing_note.caption: video-lock writes it; a video is not sent without one"
    : caption.length > L.captionChars ? `the caption is ${caption.length} characters; TikTok and Instagram take ${L.captionChars}`
    : ig && tags > L.igHashtags ? `the caption has ${tags} hashtags; Instagram takes ${L.igHashtags}`
    : v.duration !== null && v.duration < L.minSeconds ? `the video is ${v.duration} s; TikTok and Instagram take ${L.minSeconds} s at least`
    : v.duration !== null && v.duration > L.maxSeconds ? `the video is ${v.duration} s; TikTok through the API takes ${L.maxSeconds} s at most`
    : v.bytes !== null && v.bytes > L.maxBytes ? `the file is ${mb(v.bytes)}; Instagram Reels through the API take ${mb(L.maxBytes)} at most`
    : v.mode === "direct" ? directBlock(v.music)
    : null;
  const warnings: string[] = [];
  if (!skip) {
    if (tt && v.mode === "draft") warnings.push(...videoReminders(v.music));
    if (tt && v.mode === "direct") warnings.push("A direct TikTok video plays its own sound only: TikTok adds no music. The AI-generated label is sent on.");
    if (ig) warnings.push(`On Instagram the video is a Reel, published at once with the file's own sound${!placeholder(v.music) ? ` (the music note “${v.music!.trim()}” is not applied there)` : ""}. Post Bridge has no AI label field for Instagram: turn on the AI label in the Instagram app.`);
  }
  return { caption, skip, warnings };
}

/** Why direct mode is refused for this video, or null: a music note means the sound is added on the phone, so a TikTok draft only. */
export function directBlock(music: string | null | undefined): string | null {
  return placeholder(music) ? null : `this video has a music note (“${music!.trim()}”), so it goes as a TikTok draft only: send it to the drafts and add the sound on the phone`;
}

/** A video with a music note stays off Instagram (the founder, 2026-10-04): he posts it there himself, with a sound. Null otherwise. */
export function instagramBlock(music: string | null | undefined): string | null {
  return placeholder(music) ? null : "this video has a music note, so it stays off Instagram: post it there yourself, with the sound";
}

/** What the user does on the phone with a TikTok draft of a video. Shown before the send and on the post page. */
export function videoReminders(music: string | null | undefined): string[] {
  return [
    "In TikTok, turn on the AI-generated label before you post: the draft may not carry it.",
    "TikTok's video inbox may not carry the caption: paste it from the caption block.",
    ...(placeholder(music) ? [] : [`Add the sound on the phone: “${music!.trim()}”.`]),
  ];
}
