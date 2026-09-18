---
name: niche-search
description: Phase 4, first step — the automated niche search. Two doors per keyword through Monid: the Photo tab door for slideshows and the video door for videos. Writes the search log and the covers under apps/<slug>/niche/, rebuilds the niche page. About two cents a keyword.
---

# Phase 4 — the niche search

    scripts/niche-search.sh <slug> "<keyword>" ["<keyword>" ...]
    PAGES=5 WINDOWS="THIS_MONTH LAST_THREE_MONTHS" MAXITEMS=100 DOORS=photo,video   (the defaults)

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

Two keywords at the defaults: about $0.20 ($0.015 + up to $0.18; measured $0.16 on
the first run, because a window returns fewer than 100). Say the figure, wait for the
yes, then run it in the background: it is serial on purpose (rule 13).

Three facts about the Photo tab door, so you do not look for parameters it does not
have: there is no sort and no date filter (both are local; extra params are ignored);
most of the tab is older than 90 days (about 10 recent posts per 100); TikTok
spell-corrects the keyword and the script records the corrected phrase in the log.

## What it writes

`apps/<slug>/niche/NICHE.md` (the keywords, the doors, the search log with one row
per call and its cost), `searches/photo.<kw>.p<N>.json`, `searches/<kw>.<WINDOW>.json`,
`covers/<postId>.jpg` (the first slide of every slideshow, the cover of every video,
fetched now because the urls expire, rule 12), and `atlas/data/niche-<slug>.json`.
A file that exists and parses is reused for free, so a killed run resumes.

## Finish

Report: keywords, pages, results per door (slideshows, videos, handles), how many are
from the last 90 days, the computed spend, and the covers that could not be fetched.
Open http://localhost:3210/app/<slug>/niche. Then run the `niche-hunt` skill: the
recipe, or the hand-in if the user already has links.
