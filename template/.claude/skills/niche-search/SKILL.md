---
name: niche-search
description: Phase 4, first step — the automated niche search. Two TikTok doors per keyword through Monid, the Photo tab door for slideshows and the general search door for recent posts, and, when the user says yes to the question this skill asks, the Instagram hashtag door. Writes the search log and the covers under apps/<slug>/niche/, rebuilds the niche page. About a cent and a half a keyword on TikTok.
---

# Phase 4 — the niche search

    scripts/niche-search.sh <slug> "<keyword>" ["<keyword>" ...]
    PAGES=5 GENERAL_TIME=30 DOORS=photo,general                (the defaults: TikTok alone)
    DOORS=photo,general,instagram IG_FEEDS="top recent"        (TikTok and Instagram, after a yes)
    scripts/niche-import.sh <slug>     free: the covers not on disk yet, and the niche page again

Runs after the cross-app read (`apps-learnings`). It gives the spread of the niche:
what exists, sorted by views, slideshows and videos. It does not say what wins now;
the scroll does that (`niche-hunt`). Say that in one sentence when it finishes.

## The keywords

Two or three, proposed by you from `apps/<slug>/APP.md` (the niche phrase), the
teardowns and the competitor-app findings (`niche/learnings.md`): the hashtags the
niche's posts carry, in hashtag form without the `#` (`cattips`, `catmom`), not the
"app" phrases of phase 3. Show the list and wait for a yes.

## Ask about Instagram, before the run

With the keywords agreed, ask one question, with its cost, and wait for the answer:

> Do you also want Instagram niche research along with TikTok? It reads the same
> keywords as Instagram hashtags (top and recent posts), $0.003 a page: five pages of
> two feeds is $0.03 a keyword, $0.06 for two.

Yes: `DOORS=photo,general,instagram`. No: the defaults, TikTok alone. Ask
it again at a later run only if the user brings it up.

## The doors, and what each costs

| Door | Monid call | Use it for | Returns | Cost |
|---|---|---|---|---|
| Photo tab | `tikhub /api/v1/tiktok/web/fetch_search_photo`, 20 a page, `PAGES` pages | slideshows (photo posts) | slideshows only, every slide's url, full counts including saves | $0.0015 a page; $0.0075 a keyword |
| General search | `tikhub /api/v1/tiktok/app/v3/fetch_general_search_result`, `sort_type` 1 (most likes), `publish_time` 30, count 20, `PAGES` pages | recent videos, sorted | mostly videos (a rare slideshow: `aweme_type` 150), full counts including saves | $0.0015 a page; up to $0.0075 a keyword |
| Instagram (after a yes) | `tikhub /api/v1/instagram/v2/fetch_hashtag_posts`, `feed_type` top and recent, about 30 a page, `PAGES` pages per feed | the same niche on Instagram | photos, carousels and reels, likes and comments; views on reels only; **no saves and no shares** | $0.003 a page; $0.03 a keyword |

TikTok, two keywords at the defaults: about $0.03 (up to 20 pages at $0.0015). With
Instagram: about $0.09. Say the figure, wait for the yes, then run it in the
background: it is serial on purpose (rule 13).

Three facts about the general search door: `publish_time` and `sort_type` are applied on
the server; pages overlap a little (de-duplicate by id), and the next page's `offset` is
the previous page's `cursor`, not `offset + count`.

Three facts about the Photo tab door, so you do not look for parameters it does not
have: there is no sort and no date filter (both are local; extra params are ignored);
most of the tab is older than 90 days (about 10 recent posts per 100); TikTok
spell-corrects the keyword and the script records the corrected phrase in the log.

The Instagram door runs only after a yes to the question above (an identity that
reposts on Instagram, `docs/instagram.md`, is a good reason to say yes). Its `recent` feed is thin for a small tag (an empty
page can come before a full one; only a missing `pagination_token` ends the feed), and its
`top` feed is where the numbers are. The pages hold raw control characters inside
strings: read them with `strict=False` (Python) or `lenientJson` (`atlas/lib/niche-posts.ts`).

## What it writes

`apps/<slug>/niche/NICHE.md` (the keywords, the doors, the search log with one row
per call and its cost), `searches/photo.<kw>.p<N>.json`, `searches/general.<kw>.p<N>.json`,
`instagram/searches/hashtag.<tag>.<feed>.p<N>.json`, `covers/<postId>.jpg` (the first
slide of every slideshow, the cover of every video) and `instagram/covers/<id>.jpg`
(the thumbnail of every Instagram post), all fetched now because the urls expire (rule
12; Instagram's `oe=` expiry is days away), and `atlas/data/niche-<slug>.json`. A file
that exists and parses is reused for free, so a killed run resumes.

Search pages that landed by another road (a page pulled by hand, an apidojo
`searches/<kw>.<WINDOW>.json`) are read by the niche page as they are:
run `scripts/niche-import.sh <slug>` for their covers and the page, at no cost.

## What wins, per platform

The niche page marks the winners. TikTok: 50,000 views or more and saves per view at the
median of the TikTok slideshows over 50,000 views. Instagram has no saves and no views on
a photo or a carousel, so it is judged against itself, on likes or on shares (either
wins): a reel at 50,000 views or more and likes per view at the median of the Instagram
reels over 50,000 views; a photo or a carousel at the likes such a reel has (50,000 ×
that median); the same two rules with shares, whenever posts report shares (when none do,
only likes win). The rule is in
`atlas/lib/niche-win.ts`.

## Finish

Report: keywords, pages, results per door (slideshows, videos, handles; on Instagram,
if it ran, photos and carousels, reels), how many are from the last 90 days, the computed spend, and
the covers that could not be fetched.
Open http://localhost:3210/app/<slug>/niche. Then run the `niche-hunt` skill: the
recipe, or the hand-in if the user already has links.
