---
name: sync
description: Phase 8, the outcomes — the posted link from Post Bridge for a post it published live (no Monid call), else through Monid by matching the handle's latest posts to the caption, then the numbers (views, likes, comments, saves, shares), each fetch merged into the post's one current record (outcome.current); the service's own analytics merged the same way; per platform (an Instagram leg's link and numbers come from the service, with no Monid call). Under a cent per post.
---

# Phase 8 — the sync

    node scripts/posting-sync.mjs <slug> --post <key>
    node scripts/posting-sync.mjs <slug> --date <date>
    node scripts/posting-sync.mjs <slug> --all

Runs on demand, after each "posted" tick, and on the day-7 date before the `read`.

## What it does, and what it costs

**A post Post Bridge published live (a direct send) needs no Monid for its link.**
Post Bridge gives it: the post id in the post result (`platform_video_id`), else in the
analytics `share_url`. The sync builds `https://www.tiktok.com/@<handle>/photo/<id>`
(`/video/` for a video) and writes `posted.link` and `posted`. When Post Bridge has not
filled the id yet (a minute or two after the scheduled time), the sync says so; run it
again later. Never fall back to Monid for that post (AGENTS.md rule 15).
`--no-monid` makes no Monid call at all and still writes these links.

For every other post without a `posted.link` line (a draft published by hand from the
phone, a post marked posted by hand, and every slot card of the 7 days before today that
has no send and no `posted` line, since a video or slideshow posted from the phone and
never marked is one of them): the handle's latest posts through
Monid (the profile scraper, $0.00045 a post; a call reads a handful, so three posts are
under a cent), matched by the caption's first line (hashtags off, word overlap with
stems) and an upload time after the send. One match writes `posted.link` and `posted`
(when missing); several matches write nothing and print the candidates, so you ask the
user which url it is and they paste it (the post page's "posted link" field). A slot
card found live that way gets `posted` with `manual: true`, so every later sync reads
it. Then every linked post gets `outcome.sync` with views, likes, comments, saves,
shares, `data.source: "monid"`, when the numbers changed. Post Bridge's analytics are
read too when it has any (rarely for a hand-posted draft, and never saves).

## The numbers: one current record per post and platform

`outcome.sync` lines are the history: one per fetch whose numbers changed. The numbers
the Atlas shows are the leg's last `outcome.current` line, a full snapshot the sync
writes (`atlas/lib/outcome.ts`). Each fetch, from Monid or from Post Bridge, is merged
into it at write time: a field the fetch read is replaced, unless the record holds a
later read of it; a field it did not read (saves, from Post Bridge) keeps its last value;
each field names its source and read time. 0 views over real views is a failed read and
changes nothing. Neither source ranks above the other; the reader computes nothing.
A log written before the record existed: `node atlas/scripts/outcome-backfill.mjs <slug>`
once (it backs the log up first; the newest number per field across the old lines).

Say the figure before a run over many posts: a day of four posts is about a cent.

## An Instagram leg

A post sent to TikTok and Instagram is read per platform. The TikTok part is the one
above. **The Instagram leg needs no Monid call**, so the cost does not rise: Post Bridge
reports its link, its post time and its numbers. The sync writes, for that leg, `posted`
and `posted.link` once it is live, and one `outcome.sync` line with
`data.platform: "instagram"` (views, likes, comments, shares) whenever they change,
merged into the Instagram leg's own current record. A leg
that failed is written once as `posting.failed`, with Instagram's own words; say it to
the user and offer the retry (the `post` skill).

**Saves come only from TikTok, through Monid.** Instagram saves are not reported: no
source gives them (Post Bridge has no save field; the public scrapers on Monid cannot
see a save count, which Instagram shows only to the account owner). So saves/view is a
TikTok figure; on Instagram read views, likes, comments and shares. Post Bridge pulls
fresh numbers at most every 30 minutes per account.

## A post published on TikTok by hand

A post the user posted on TikTok themselves, with no send (its `posted` line has
`data.manual: true`), is read like a draft published from the phone: it counts for
the handle's Monid fetch, and it is matched after its final approval, video or
slideshow. The match reads only the handle's posts of the same kind (a slideshow has
images, a video has none) that no other post already links: by caption first, then,
for a post still open, the one post left of the same shape (the slide count). That
second step finds a draft whose caption was rewritten on the phone; the report says
"matched by kind, slide count and time" with the caption's score.

## The saved runs first, and nothing dropped

Every paid Monid fetch keeps Monid's raw output in `apps/<slug>/production/monid/`
(`<read time>-<username>.json`). Before the sync pays for a handle, each of its posts
with no link is looked for in the saved runs: that folder, plus the runs `monid runs
list` names, read with `monid runs get` (both free) and kept in the folder once. The
caption match runs for every such post; the time and shape match only for a post with
no send. A handle whose posts all settle there is not fetched; the report says "from a
saved Monid run". `--no-monid` still reads the folder (no call at all).

A Monid post of a handle that no planned post claims, uploaded since the handle's first
plan date, is written once as a `monid.unplanned` line (the handle, the TikTok id and
url, the kind, the numbers, the read time) and printed at the end of the sync. Tell the
user: it is a post outside the plan, or one the match could not place. When it belongs
to a slot card, paste its link on the post page; the next sync records its numbers.

`--monid-runs <id,id>` reads each handle's posts from those saved runs only, instead of
a new fetch, and keeps them in the folder. Use it to repair or re-read a day the sync
already paid for.

## Where the caption match fails

A caption edited on the phone (a word dropped, the tags removed) lowers the overlap; the
script prints the candidates with their score. Ask the user for the link rather than
guessing.

## Finish

Report each post: the link, the numbers, the read time; per platform when there are two. The board and the home base show
them. On the day-7 date, run the `read` skill.
