---
name: niche-search
description: Phase 4, first step — the automated niche search. Two doors per keyword through Monid: the Photo tab door for slideshows and the video door for videos, and an Instagram hashtag door when asked. Writes the search log and the covers under apps/<slug>/niche/, rebuilds the niche page. About two cents a keyword.
---

# Phase 4 — the niche search

    scripts/niche-search.sh <slug> "<keyword>" ["<keyword>" ...]
    PAGES=5 WINDOWS="THIS_MONTH LAST_THREE_MONTHS" MAXITEMS=100 DOORS=photo,video   (the defaults)
    DOORS=photo,video,instagram IG_FEEDS="top recent"                               (with Instagram)
    scripts/niche-import.sh <slug>     free: the covers not on disk yet, and the niche page again

Runs after the cross-app read (`apps-learnings`). It gives the spread of the niche:
what exists, sorted by views, slideshows and videos. It does not say what wins now;
the scroll does that (`niche-hunt`). Say that in one sentence when it finishes.

## The keywords

Two or three, proposed by you from `apps/<slug>/APP.md` (the niche phrase), the
teardowns and the competitor-app findings (`niche/learnings.md`): the hashtags the
niche's posts carry, in hashtag form without the `#` (`cattips`, `catmom`), not the
"app" phrases of phase 3. Show the list and wait for a yes.

## The two doors, and what each costs

| Door | Call | Returns | Cost |
|---|---|---|---|
| Photo tab | TikHub `fetch_search_photo`, 20 items a page, `PAGES` pages per keyword | slideshows only, with every slide's url and the full counts including saves | $0.0015 a page; five pages a keyword is $0.0075 |
| Video | apidojo keyword search, `MOST_LIKED`, one call per window | videos; it never returns a slideshow | $0.00045 a result; two windows at 100 is up to $0.09 a keyword |
| Instagram (only when `DOORS` names it) | TikHub `fetch_hashtag_posts`, the keyword as a hashtag, `top` and `recent`, about 30 items a page, `PAGES` pages per feed | photos, carousels and reels, with likes and comments; views on reels only; **no saves and no shares** | $0.003 a page; five pages of two feeds is $0.03 a keyword |

Two keywords at the defaults: about $0.20 ($0.015 + up to $0.18; measured $0.16 on
the first run, because a window returns fewer than 100). Say the figure, wait for the
yes, then run it in the background: it is serial on purpose (rule 13).

Three facts about the Photo tab door, so you do not look for parameters it does not
have: there is no sort and no date filter (both are local; extra params are ignored);
most of the tab is older than 90 days (about 10 recent posts per 100); TikTok
spell-corrects the keyword and the script records the corrected phrase in the log.

Run the Instagram door when an identity reposts on Instagram (a `## Accounts` table,
`docs/instagram.md`) or the user asks. Its `recent` feed is thin for a small tag (an empty
page can come before a full one; only a missing `pagination_token` ends the feed), and its
`top` feed is where the numbers are. The pages hold raw control characters inside
strings: read them with `strict=False` (Python) or `lenientJson` (`atlas/lib/niche-posts.ts`).

## What it writes

`apps/<slug>/niche/NICHE.md` (the keywords, the doors, the search log with one row
per call and its cost), `searches/photo.<kw>.p<N>.json`, `searches/<kw>.<WINDOW>.json`,
`instagram/searches/hashtag.<tag>.<feed>.p<N>.json`, `covers/<postId>.jpg` (the first
slide of every slideshow, the cover of every video) and `instagram/covers/<id>.jpg`
(the thumbnail of every Instagram post), all fetched now because the urls expire (rule
12; Instagram's `oe=` expiry is days away), and `atlas/data/niche-<slug>.json`. A file
that exists and parses is reused for free, so a killed run resumes.

Search pages that landed by another road (a TikHub general search,
`searches/general.<kw>.p<N>.json`, or an Instagram page pulled by hand) are read by the
niche page as they are: run `scripts/niche-import.sh <slug>` for their covers and the
page, at no cost.

## What wins, per platform

The niche page marks the winners. TikTok: 50,000 views or more and saves per view at the
median of the TikTok slideshows over 50,000 views. Instagram has no saves and no views on
a photo or a carousel, so it is judged against itself, on likes or on shares (either
wins): a reel at 50,000 views or more and likes per view at the median of the Instagram
reels over 50,000 views; a photo or a carousel at the likes such a reel has (50,000 ×
that median); the same two rules with shares, whenever posts report shares (the hashtag
pages of 2026-09-24 report none, so today only likes win). The rule is in
`atlas/lib/niche-win.ts`.

## Finish

Report: keywords, pages, results per door (slideshows, videos, handles; on Instagram
photos and carousels, reels), how many are from the last 90 days, the computed spend, and
the covers that could not be fetched.
Open http://localhost:3210/app/<slug>/niche. Then run the `niche-hunt` skill: the
recipe, or the hand-in if the user already has links.
