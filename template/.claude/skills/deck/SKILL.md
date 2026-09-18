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
row decides the canvas (3:4 when absent). The `Cards:` list marks the callout.

## Rules of the deck

- The source's hook line stays on slide 1 with the fewest changes; only the items the
  plan names are swapped. No step invented from outside the source's argument.
- The app mention or the CTA no later than slide 3 unless the plan row says otherwise
  (the user's rule of 2026-09-17: many viewers never reach slide 5); never on slide 1,
  never in the caption of a persona handle, no download instruction anywhere.
- Every slide is the handle's dimension (3:4 by default); every prompt names which
  subject is in frame and carries the prefix; no text rendered inside the image.
- The last slide asks for the save and gives the reason; nothing else.

## Finish

Rebuild the index (`cd atlas && ATLAS_ROOT=.. node scripts/build-production.mjs`) and read
what it could not parse. Point the user at the post page,
http://localhost:3210/app/<slug>/post/<date>-<short>-<n>, for the plan approval
(`plan.approve` in the log). Then run the `images` skill for that post.
