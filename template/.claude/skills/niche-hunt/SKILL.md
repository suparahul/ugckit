---
name: niche-hunt
description: Phase 4, the scroll — two modes. Recipe mode prints the seven-line scroll recipe for the user's phone. Hand-in mode takes what the user found on their own. Both write batches/<date>/LINKS.md verbatim. No script, no cost.
---

# Phase 4 — the scroll (niche-hunt)

No script. The search gave the spread; what wins now comes from the user's own scroll
in the TikTok phone app. The user brings links; you judge (`niche-read`). Never ask
the user to do the reading.

## Recipe mode

Print this, in these words, and stop:

> On your phone:
> 1. Open TikTok and tap search.
> 2. Type `<the keyword>` (the niche phrase, or a keyword from the search).
> 3. Tap the three dots at the top right, and set the date filter to the most recent.
> 4. Open the **Photos** tab and scroll.
> 5. Then open the **Videos** tab and scroll.
> 6. Bring back what you like: very high views, or content you think is very good.
>    Slideshows or videos.
> 7. Up to ten is a good number; five or twenty is fine too. Links, handles or
>    screenshots, any of them. Paste them here.

Then wait. Do not print tests to run or things to count; the scroll is the user's, the
counting is `niche-stats.py`'s and the judging is yours.

## Hand-in mode

The user searched on their own, before or without the recipe, and hands over links,
handles or screenshots. Take them as they are. Ask one thing only, for the record:
"what did you type into search?" Do not ask them to redo the scroll by the recipe.

## What both modes write

`apps/<slug>/niche/batches/<date>/LINKS.md`, `<date>` today. One line per thing the
user brought, **verbatim**: never rewrite, shorten or resolve a link here (a short
`tiktok.com/t/` link stays a short link; `niche-fetch` resolves it). The shape:

    # Batch <date>
    Searched: <what the user typed>
    Source: recipe | own search

    | # | What you brought | Source | Your note |
    |---|---|---|---|
    | 1 | https://www.tiktok.com/t/ZTUmD1jAE/ | recipe | very high views |
    | 2 | @mias.diary7 | own search | PawSolids ambassador? |
    | 3 | screenshots/IMG_0412.png | screenshot | |

`Source` per line is `recipe`, `own search` or `screenshot`. A screenshot is copied to
`batches/<date>/screenshots/` and its line points at the copy. The user's own words go
in the note column, unchanged. A second hand-in on the same day appends rows to the
same file.

Tick nothing yourself: the canvas's "links brought" count comes from this file.

## Finish

Say how many lines were written and of which kinds, then run the `niche-fetch` skill.
It will say the cost (about $0.03 for ten posts) before it fetches.
