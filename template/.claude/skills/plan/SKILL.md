---
name: plan
description: Phase 7, the plan — writes production/PLAN.md: the head lines, the judgement rules, one block per handle, the posts table with a kind column, the day-7 read table. Offers the hashtag pool measurement once ($0.0015 a tag). Rebuilds the production index so the studio opens.
---

# Phase 7 — the plan

    scripts/hashtag-pool.sh <slug> "#tag" ...        optional, $0.0015 a tag
    scripts/hashtag-pool.sh <slug> --from-niche 40   the 40 most-used tags of the niche's posts, $0.06

Runs after `app-fit`. Takes the handle count and the cadence from `strategy/ACCOUNTS.md`,
the values from `strategy/APP-FIT.md`, the defaults from each `handles/<handle>/HANDLE.md`,
the source posts from `niche/anatomy.md` and the batches.

## The hashtag pool, offered once

Ask: measure the pool now, or start with a fixed block from the findings and measure
later. Measuring: one TikHub call per tag, $0.0015; the 40 most-used tags of the niche
are $0.06, a hand-picked list of 20 is $0.03. Say the figure, wait for the yes, run it.
It writes `strategy/HASHTAG-POOL.md` with the volumes and an empty tier column: fill the
tiers (G general, N niche, P post-specific, x out), then the Tags column below follows
the rotation rule: five per post, two general, two niche, one post-specific, no handle
repeating a set on consecutive posts; a persona-only tag stays on the persona handle
(#catmom went on Hannah alone); the SEO handle is outside the rotation, its tags come
from its keyword. Measured 2026-09-16: the general tags are one to three orders of
magnitude bigger than the niche ones (#cat 1.2T against #newcatowner 60M).

## Write `apps/<slug>/production/PLAN.md`

The Atlas reads this file by these exact conventions:

    # Week 1 plan — <YYYY-MM-DD> to <YYYY-MM-DD>

    App: <Name>                         (as in APP.md's first line; the deck checks name it)
    App Store id: <id>                  (from product.json; blank if none)
    Posting zone: America/New_York      (where the audience is; the slots are in this zone)
    Home zone: Asia/Kolkata             (where the user is; the board shows both)
    Posting service: postbridge         (the name only; the connection is made at the first send)
    Platforms: tiktok, instagram        (optional; see "Two platforms" below)

    ## Judgement rules
    | Rule | Value | Source |
    (below 3K views kill the format; above 10–15K replicate; a format under 3K gets a second
     try on another handle before it is dropped; zero views on the first 2–3 posts is not a
     verdict; day 7 is a format read, not an account read; no heavy bet — a deck over
     nine slides — on a handle until it clears about 500 views; no content idea repeats
     across handles in the same week)

    Rules that hold on every post: <one line; the callout on every post; the app never on
    slide 1; no download instruction; …>

    ## Handle blocks
    ### `@hannah.catmom` — main persona
    | Parameter | Fixed value for the week | Source |
    (short: the format lock, the product slot, the dimension, the cadence; the rest lives
     in HANDLE.md and a row here overrides it for the week only)

    ## Posts
    | Day | Date | Handle | Slot | Topic | Format / variation | Arm | Source | Tags | Kind |
    | 1 | 09-16 | hannah | AM | … | tip list, 7 slides | Catwise slide 3 | `@x`, 1,201,654, https://www.tiktok.com/@x/photo/… | #a #b #c #d #e | slideshow |
    (an optional last column, `Platforms`, after `Kind`: see "Two platforms")

    ## Day-7 read
    | Handle | Format verdict | Experiments to read | What settles each |

The posts table: `Handle` is the short name (the part of the handle before the first
dot); `Date` is `MM-DD` in the plan's year; `Source` carries the source post's handle,
its view count and its exact url ("no URL held" when none); `Kind` is `slideshow` or
`video` and sits last so the Atlas's column order holds. A row with `kind: video` names
the video pipeline as its maker (`originate`, stage 5) and joins production at `post`.
Two handles at two a day for seven days is 28 rows; write every row with a source.

## Two platforms

A post goes to every platform its handle has an account on: the `## Accounts` table of
`HANDLE.md` (no table: TikTok only). Instagram is a repost of the same deck, sent in the
same call at the same time; the research and the formats stay TikTok's. So nothing in
the plan is needed for Instagram to happen. Two optional places hold it back:

- the head line `Platforms: tiktok` keeps the whole week on TikTok (`Platforms: tiktok,
  instagram` allows both, which is the same as no line);
- the last column `Platforms` of one row (`tiktok`, `instagram`, or both) overrides it
  for that post. Blank or `—` means the head line.

**The 10-slide rule (Rahul, 2026-09-23).** Every row on a handle with both a TikTok and
an Instagram account is planned at **10 slides or fewer**, the CTA and the save ask
included: Instagram's API takes 10 in a carousel (the app takes 20; the API does not).
Say the count in the `Format / variation` cell ("tip list, 9 slides"). A handle on TikTok
only keeps no limit. The post page shows a failing check and the send stops for a deck
over 10 on a two-platform handle; nothing is cut by the kit.

**The tags.** The five tags of a row are measured on TikTok and used on both platforms.
On Instagram they go in the first comment, not the caption (the compositor splits them).
The pool is not measured on Instagram.

## Then the index

    cd atlas && ATLAS_ROOT=.. node scripts/build-production.mjs

(or `scripts/atlas.sh --index`). It prints every row it could not parse; fix the file,
not the parser. The board is at http://localhost:3210/production/<slug>.

## Finish

    scripts/state.py set <slug> strategy done

Report: handles, posts, the format lock per handle, the day-7 date, the spend on the
pool if any. Then, for the first post, run the `deck` skill.
