---
name: post
description: Phase 8, the send — one post through the provider PLAN.md names, after the final is approved, to every platform of its handle in one call (TikTok, and Instagram when the identity reposts there; Instagram is always published directly, with no music). Draft mode by default (the media lands in the TikTok inbox; the user picks the sound, types the cover, posts, ticks "posted"), or direct mode at a local time. A slideshow or a delivered character video. Dry run without --send; --request shows the exact requests. No Monid cost.
---

# Phase 8 — the send (post)

    node scripts/posting-send.mjs <slug> --post <key>                                   dry run: what would be sent
    node scripts/posting-send.mjs <slug> --post <key> --send                            draft mode
    node scripts/posting-send.mjs <slug> --post <key> --send --direct --at-local "19:00 America/New_York"
    node scripts/posting-send.mjs <slug> --date <date> --send                           every approved post of the day
    node scripts/posting-send.mjs <slug> --post <key> --only instagram --send           one leg only: a retry, or --only tiktok
    node scripts/posting-send.mjs <slug> --post <key> --request                         a video: the exact JSON, nothing sent

## Before the send

1. `final.approve` for the post is in the log; the compositor ran (`render`). Nothing
   is sent without the approval line; the script skips a post without it and says so.
2. `production/posting-accounts.json` exists and maps the post's handle on each of its
   platforms. Missing, or an account is `null` → run the `posting-provider` skill first,
   then come back. (An Instagram account not connected leaves that leg out, and the dry
   run says so; the TikTok leg still goes.)
3. Run the dry run and read it back to the user: the post, the slide count, the
   caption, the mode, and for direct mode the instant in both zones; then one line per
   leg (the platform and the account) when there is more than TikTok, and every line
   the dry run marks with `!`. Then one yes, which sends every leg, then `--send`.

## The two modes, and what each means on TikTok

- **Draft (the default).** The media lands as a notification in the TikTok inbox
  ("your content from Post Bridge is ready"), not in Drafts. The user opens it, picks
  the sound, types the cover text from `final/cover-text.txt`, posts, and ticks
  "posted" on the post page. Say exactly that. The service cannot return the posted
  url for a draft; `sync` finds it through Monid.
- **Direct.** The service publishes at the instant; TikTok adds a trending sound; the
  cover text is burned in (`render --burn-cover` runs inside the send). Comments on,
  public. Use it for the PM slot when nobody is on the phone.

## Instagram, the second leg

A post whose handle has an Instagram account (the `## Accounts` table) goes there too,
in the same Post Bridge post, at the same time as TikTok (Rahul, 2026-09-23). What
differs:

- **Always direct.** Instagram has no draft: Post Bridge's Instagram settings have no
  draft option, and Meta's API has none. The leg publishes the moment Post Bridge
  processes the post.
- **The timing.** A direct slot: one `scheduled_at` for both legs. A draft slot (the
  AM post by hand): the TikTok draft reaches the phone when the send runs, and Instagram
  publishes at that same moment. So send an AM post **at its slot time**, not earlier;
  the dry run says how many minutes early a send would be.
- **No music.** The kit sends no audio for Instagram. Once the post is live, the user
  adds the music by hand in the Instagram app: Edit, then Replace Audio, from
  Instagram's own library. Say this after the send, every time.
- **Its own slides and text.** The 4:5 JPEG set (the `render` skill), the cover text
  burned in, and the same caption as TikTok, tags included. There is no first comment.
- **10 slides at most.** A deck over 10 on a two-platform handle is not sent: the dry
  run says "cut the deck (the deck skill), or send TikTok alone with --only tiktok".
  Ask the user which; do not cut slides yourself.
- **Not on Instagram this time.** When the user says so, write a `leg.drop` line (the
  post page's control, or `{"post":"<key>","kind":"leg.drop","data":{"platform":"instagram"},"note":"<why>"}`
  in the log); `leg.add` puts it back.

## A video post

A `Kind: video` row goes the same way, after **Approve for posting** on its delivered file
(`pipeline/character/<video>/final/<video>.mp4`). What differs from a slideshow:

- **The media is the file, unchanged.** No compositor, no cover text to type or burn (the
  overlays are in the file), no Instagram set: one upload, the same media id on both legs.
  The send hashes the file and refuses unless it is the file of `delivery.json` and of the
  user's approval; a file delivered again needs a new approval.
- **The caption** is `plan.json` `publishing_note.caption`, then the row's `Tags` the
  caption does not already carry. No caption, no send. 2,200 characters at most; on
  Instagram 30 hashtags at most. The video is 3 s to 600 s and 300 MB at most.
- **Draft mode.** The video lands in the TikTok inbox. TikTok's inbox upload for a video
  may not carry the caption: tell the user to paste it from the post page. The user sets
  the sound, the cover frame and any label in TikTok, then posts and ticks "posted".
- **Direct mode.** Public, comments on, the file's own sound only: TikTok adds no music to
  a video, and the file is music-free (`music_note` is a note, never applied). Duet,
  stitch and the cover frame are TikTok's defaults; no AI-generated label is set (an open
  decision of the founder's; say so in the dry run read-back).
- **Instagram** gets the file as a Reel, published when the post is processed, with the
  file's own sound and Instagram's default cover. Say once that the music note is not
  applied there.
- `--request` (or `REQUEST_ONLY=1`) prints the upload request and the post body with a
  placeholder media id and sends nothing; it needs no key. Read it back before the first
  real video send of a workspace.
- The `posting.sent` line also carries `video` and `sha256`.

## The slots

The plan's slots are the handle's `Slots:` line, in the posting zone; the default
pair is **11 AM** by hand (draft mode, the chosen sound, the typed cover) and **7 PM**
scheduled (direct mode, TikTok's sound, the burned cover). Keep the hour once chosen:
accounts with a tight routine outperform loose ones by about 30%, the hour itself by
about 4×. The sound in draft mode is the handle's `Sound:` line (a library track, or
an uploaded clip that shows as "original sound"); in direct mode nobody chooses it.

A caption edited on the phone (a word dropped, the tags removed) happens; it does not
break the send, but it lowers the `sync` match, so say once: post the caption as
exported.

## What it writes

`posting.sent` in the log with `data.provider`, `data.mode`, the media ids and
`scheduledAt`, and `data.legs` (one per platform) when there is more than TikTok;
`posting.rescheduled` on a move. A failed send prints the service's error and exits 1:
show the error, do not retry blindly; a second send needs a fresh yes and `--force`.

A leg can fail on its own after the send (Instagram refuses a slide, an account needs a
reconnect). The `sync` writes it once as `posting.failed` with the platform's words, and
the post page names it; the other leg is not touched. The retry, after a fresh yes:
`--only instagram --send` (a failed leg counts as not sent; `--force` only when it was
sent and did not fail). A `needs_reconnect` account is not retried: say "reconnect
@<account> in Post Bridge", then run `posting-accounts.mjs <slug>` again.

## Finish

Say what went where and what the user does next on the phone (for an Instagram leg:
add the music in the Instagram app). Then, once "posted" is
ticked or the scheduled instant has passed, run the `sync` skill.
