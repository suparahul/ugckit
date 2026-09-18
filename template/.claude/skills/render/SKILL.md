---
name: render
description: Phase 8, the compositor — the finished slides of one post, text burned in, at the post's dimension, with the callout on the product slide, into files/<post>/final/. Runs before every send and export. Free.
---

# Phase 8 — the render

    node scripts/render-slides.mjs <slug> <post>                every picture approved
    node scripts/render-slides.mjs <slug> <post> --force        draw the current picture where none is approved (a preview)
    node scripts/render-slides.mjs <slug> --date <date>         every post of the day whose pictures are all approved
    node scripts/render-slides.mjs <slug> <post> --burn-cover   slide 1 with its text, for a direct (scheduled) send

Writes `files/<post>/final/slide-NN.png` at the post's dimension (3:4 → 1080×1440,
9:16 → 1080×1920; a picture of another shape is centre-cropped and the line says so),
`cover-text.txt` (slide 1's text, typed by hand in the TikTok editor in draft mode)
and `caption.txt` (the caption and the tags). The text style is TikTok's classic look:
white, bold, a black outline, no box unless the deck says "in a box"; the positions
and sizes are the deck's blocks, or the layout the user locked on the post page
(`slide.layout` in the log). The product slide gets the callout from `cards/1-*.png` in
the lower third with the callout sentence above it.

Text-free slides (the words typed in TikTok) are the post page's export control
(`slide.text` = overlay); the compositor reads it from the log.

## Then look

Open two or three of the finals yourself: the text inside the safe area, the callout on
the right slide, the cat the right cat. Then the user approves the final on the post
page (`final.approve`). Nothing is sent without that line.

## Finish

Say the files and the dimension, then run the `post` skill (which runs
`posting-provider` first if no account is mapped yet).
