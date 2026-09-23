---
name: sync
description: Phase 8, the outcomes — the posted link through Monid by matching the handle's latest posts to the caption, then the numbers (views, likes, comments, saves, shares) as outcome.sync lines; the service's own analytics as a second source; per platform (an Instagram leg's link and numbers come from the service, with no Monid call). Under a cent per post.
---

# Phase 8 — the sync

    node scripts/posting-sync.mjs <slug> --post <key>
    node scripts/posting-sync.mjs <slug> --date <date>
    node scripts/posting-sync.mjs <slug> --all

Runs on demand, after each "posted" tick, and on the day-7 date before the `read`.

## What it does, and what it costs

For every sent post without a `posted.link` line: the handle's latest posts through
Monid (the profile scraper, $0.00045 a post; a call reads a handful, so three posts are
under a cent), matched by the caption's first line (hashtags off, word overlap with
stems) and an upload time after the send. One match writes `posted.link` and `posted`
(when missing); several matches write nothing and print the candidates, so you ask the
user which url it is and they paste it (the post page's "posted link" field). Then
every linked post gets `outcome.sync` with views, likes, comments, saves, shares,
`data.source: "monid"`, and the time the numbers changed. Post Bridge's analytics are
printed as a second source when it has any (rarely for a hand-posted draft, and never
saves).

Say the figure before a run over many posts: a day of four posts is about a cent.

## An Instagram leg

A post sent to TikTok and Instagram is read per platform. The TikTok part is the one
above. **The Instagram leg needs no Monid call**, so the cost does not rise: Post Bridge
reports its link, its post time and its numbers. The sync writes, for that leg, `posted`
and `posted.link` once it is live, and one `outcome.sync` line with
`data.platform: "instagram"` (views, likes, comments, shares) whenever they change. A leg
that failed is written once as `posting.failed`, with Instagram's own words; say it to
the user and offer the retry (the `post` skill).

**Saves come only from TikTok, through Monid.** Instagram saves are not reported: no
source gives them (Post Bridge has no save field; the public scrapers on Monid cannot
see a save count, which Instagram shows only to the account owner). So saves/view is a
TikTok figure; on Instagram read views, likes, comments and shares. Post Bridge pulls
fresh numbers at most every 30 minutes per account.

## Where the caption match fails

A caption edited on the phone (a word dropped, the tags removed) lowers the overlap; the
script prints the candidates with their score. Ask the user for the link rather than
guessing.

## Finish

Report each post: the link, the numbers, the read time; per platform when there are two. The board and the home base show
them. On the day-7 date, run the `read` skill.
