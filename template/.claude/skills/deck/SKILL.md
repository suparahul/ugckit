---
name: deck
description: Phase 8, the deck — one file per handle per day, production/decks/<date>-<short>.md, with the item table and the slide-by-slide text and image prompts of each planned post, copied from its source post with the fewest changes. No script, no cost.
---

# Phase 8 — the deck

No script. One deck per handle per day, from the plan rows of that day, before any
picture is made. Read, in this order: the plan row (`production/PLAN.md`), the handle
file (`handles/<handle>/HANDLE.md`: the style prefix, the identity rule, the defaults),
the anatomy's best-seen row for the format (`niche/anatomy.md`, both sources), and the
source post's slides on disk (`niche/batches/<date>/<handle>/<id>/slide-NN.jpg`, or the
competitor's post under `research/<slug>/<app>/<handle>/<id>/`). Read the source slides
yourself before writing a line.

## The file: `apps/<slug>/production/decks/<date>-<short>.md`

`<short>` is the plan's handle short name. The Atlas parses the file by these
conventions; keep them exactly.

    # `@hannah.catmom` — day 2, 2026-09-17 — two slideshow posts
    <two or three sentences: the role, the rules of the day, the sources>

    ## Bio
    > <the bio, verbatim>

    ## Rules that hold on both posts
    - <one rule per bullet: the app's slot, the voice, the subject, the ask, the sound, the caption, the dimension>

    ## One visual style for both posts
    > **Style prefix:** <copied word for word from HANDLE.md § Style prefix>
    <notes: the input images, the flat, what a generator that returns 9:16 does>

    ---

    # Post 1 — AM — "How to stop your cat waking you at 5am"

    | Item | Value |
    |---|---|
    | Slot | AM |
    | Arm | <the plan row's arm, with the callout slide named> |
    | Source | `@mias.diary7` 7657658973415410977, 151,103 views, 9 slides, https://www.tiktok.com/@mias.diary7/photo/7657658973415410977 |
    | Slides | 8: hook → step ×2 → Catwise slide → step ×3 → save ask |
    | Dimension | 3:4 (1080×1440) |
    | Slide style | photo |
    | Density | headline + 2–3 lines per step |
    | Text position | headline in the upper third, the lines under it; the subject in the lower two thirds |
    | Text size | slide 1 big; slides 2–8 headline medium, lines small |
    | Callout slot | slide 4 of 8; the App Store card in the lower third, the sentence directly above it |

    ## Voice note — what changes from the source
    <one paragraph: what is kept word for word, what is swapped, why>

    ## Slides

    ### Slide 1 — hook
    **On-image text** (one block, centred, lower third of the frame):
    ```
    How to stop your cat
    waking you at 5am 😴
    ```
    **Position and size:** <where, which size, no box>
    **Image prompt:** [style prefix] <the scene: which subject is in frame, the room, the light, the framing>

    ### Slide 4 — the Catwise slide
    **Why this slide.** <the feature, the card, why here>
    **On-image text, top (headline):**
    ```
    ...
    ```
    **Cards:**
    1. the App Store card
    **Image prompt:** [style prefix] <a scene that keeps the lower third plain, so the card sits over it>

    ## Caption
    <one line + the plan row's five tags>

    ## Last-slide ask
    ## Sound

Rules the parser has: the post heading is `# Post N — AM|PM — "title"`; the slide
heading is `### Slide N — label`; a heading that contains the app's name marks the
product slide; text blocks are the fenced block after a bold label; the word "box" in a
placement sentence boxes every block of the slide; a top block is medium only when its
label says "(headline)" and the Text size row names "headline medium"; the image prompt
is the sentence after `**Image prompt:**`, with `[style prefix]` first; the Dimension
row decides the canvas (3:4 when absent); the Slide style row (`photo` when absent) is
copied from the handle's `Slide style:` line and carried into the index as an item, so
the compositor knows whether to burn the text. The `Cards:` list marks the callout.

An illustrated handle puts the text in the picture. Each slide's image prompt carries,
after the style prefix and the scene, the slide's text word for word in quotation
marks, where it sits, the lettering feel and the text colour (`… the words "How to stop
your cat waking you at 5am" hand-lettered across the top in warm cream`). The
**On-image text** block is still written (the post page, `cover-text.txt` and the
caption need it), but the compositor draws nothing on an illustrated slide except the
callout on the product slide: the picture is the finished slide. The product slide's
prompt keeps the lower third plain, as for a photo handle. Look at every picture for
the spelling: a generator's text is a candidate to reject, not to fix.

## Rules of the deck

- The source's hook line stays on slide 1 with the fewest changes; only the items the
  plan names are swapped. No step invented from outside the source's argument.
- One idea per slide sets the count; nothing else does. In the cat niche 12–14 slides
  had the best median save rate (1.7%) and the worst views (397K against 1.8M for two
  slides, 195 posts, 2026-09-16); across every app niche two-slide posts dominate and
  no 12+ deck reached 1M. A long deck costs pictures and views: on a fresh handle it
  waits until the handle clears about 500 views on a shorter one.
- **The 10-slide rule (Rahul, 2026-09-23).** A deck for a handle with both a TikTok and
  an Instagram account (the `## Accounts` table of its `HANDLE.md`) has **10 slides or
  fewer**, the CTA slide and the save ask included: Instagram's API takes 10 in a
  carousel. When the source has more ideas than fit, merge two per slide or drop the
  weakest; never plan on the kit cutting slides (it does not: the check on the post page
  fails and the send stops). A handle on TikTok only keeps no limit.
- The caption's first line repeats the cover text (4 of the 9 biggest tip posts of the
  scrolled batch do; search reads the caption for certain), then the plan row's five
  tags. The sync matches the posted link by that first line, so keep it exact. Write one
  caption for both platforms: on Instagram the compositor takes the tags out of it and
  posts them as the first comment (`final/instagram/caption.txt`, `first-comment.txt`).
- The SEO handle (the search-keyword tier, when `ACCOUNTS.md` has one): slide 1's text
  is the keyword and nothing else, and the keyword sits in the caption too; its cover is
  typed in TikTok, never burned, because search reads TikTok's own text layer. Its tags
  come from the keyword, not from the rotation.
- The app mention or the CTA no later than slide 3 unless the plan row says otherwise
  (the user's rule of 2026-09-17: many viewers never reach slide 5); never on slide 1,
  never in the caption of a persona handle, no download instruction anywhere.
- Every slide is the handle's dimension (3:4 by default); every prompt names which
  subject is in frame and carries the prefix; no text rendered inside the image.
- The last slide asks for the save and gives the reason; nothing else.

## Finish

Rebuild the index (`cd atlas && ATLAS_ROOT=.. node scripts/build-production.mjs`) and read
what it could not parse. A deck on disk is the plan: the Atlas counts the plan stage
done the moment the deck exists, and the user reads the deck through its pictures on
the post page, http://localhost:3210/production/<slug>/<date>/<short>/<n> (the written
deck alone is at `?as=plan`). Do not wait for a `plan.approve` line; run the `images`
skill for that post at once. The one stop: a `plan.sendback` line for this post in
`log.jsonl` whose `hash` is the deck's current hash — the user refused this deck, so
rewrite it from the note before any picture. A rewritten deck (a new hash) clears the
send-back by itself.
