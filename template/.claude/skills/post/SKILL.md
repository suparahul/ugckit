---
name: post
description: Phase 8, the send — one post through the provider PLAN.md names, after the final is approved. Draft mode by default (the media lands in the TikTok inbox; the user picks the sound, types the cover, posts, ticks "posted"), or direct mode at a local time. Dry run without --send. No Monid cost.
---

# Phase 8 — the send (post)

    node scripts/posting-send.mjs <slug> --post <key>                                   dry run: what would be sent
    node scripts/posting-send.mjs <slug> --post <key> --send                            draft mode
    node scripts/posting-send.mjs <slug> --post <key> --send --direct --at-local "19:00 America/New_York"
    node scripts/posting-send.mjs <slug> --date <date> --send                           every approved post of the day

## Before the send

1. `final.approve` for the post is in the log; the compositor ran (`render`). Nothing
   is sent without the approval line; the script skips a post without it and says so.
2. `production/posting-accounts.json` exists and maps the post's handle. Missing, or the
   handle is `null` → run the `posting-provider` skill first, then come back.
3. Run the dry run and read it back to the user in one line: the post, the account,
   the slide count, the caption, the mode, and for direct mode the instant in both
   zones. Then the yes, then `--send`.

## The two modes, and what each means on TikTok

- **Draft (the default).** The media lands as a notification in the TikTok inbox
  ("your content from Post Bridge is ready"), not in Drafts. The user opens it, picks
  the sound, types the cover text from `final/cover-text.txt`, posts, and ticks
  "posted" on the post page. Say exactly that. The service cannot return the posted
  url for a draft; `sync` finds it through Monid.
- **Direct.** The service publishes at the instant; TikTok adds a trending sound; the
  cover text is burned in (`render --burn-cover` runs inside the send). Comments on,
  public. Use it for the PM slot when nobody is on the phone.

## What it writes

`posting.sent` in the log with `data.provider`, `data.mode`, the media ids and
`scheduledAt`; `posting.rescheduled` on a move. A failed send prints the service's
error and exits 1: show the error, do not retry blindly; a second send needs a fresh
yes and `--force`.

## Finish

Say what went where and what the user does next on the phone. Then, once "posted" is
ticked or the scheduled instant has passed, run the `sync` skill.
