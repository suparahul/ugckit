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

The numbers, as the Atlas draws them (a change to one is a change to both): the font
is Helvetica Neue Bold, white, black outline; the sizes are a share of the width —
big 7.4%, medium 5.1% (5.6% on 9:16), small 4.3% (3.9% on 9:16), a boxed block 3.7%
in medium weight on a translucent brown box. The safe area is 4% top and bottom on
3:4, 8% top and 82% bottom on 9:16: TikTok lays the caption block over roughly the
lower 30% of a 9:16 photo in the feed and cuts it in the contained layout (measured
on two phones, 2026-09-16), which is why 3:4 is the default — a 3:4 slide shows whole
with the caption under it. The top stack starts at the top of the safe area, the
bottom stack ends at its bottom, the callout stack above the card. A 9:16 picture on
a 3:4 deck is centre-cropped, not regenerated.

**Slide style.** The compositor reads the deck's `Slide style` row and, for
`illustrated`, the handle's `Slide style:` line (font, colour, backing) and draws the
text in that look; absent or `photo`, the default above. The font must be installed on
the machine; a font that is not found falls back to Helvetica and the line says so.
(The Atlas's compositor holds this change; until it lands, every deck renders in the
default look — see the BUILD-LOG note of 2026-09-18.)

The cover is the one slide that changes with the send: draft mode leaves it text-free
and writes `cover-text.txt` for the user to type; direct mode burns it (`--burn-cover`,
run inside the send). The SEO handle's cover is always typed, whatever the mode: the
keyword must be in TikTok's own text layer.

Text-free slides (the words typed in TikTok) are the post page's export control
(`slide.text` = overlay); the compositor reads it from the log.

## Then look

Open two or three of the finals yourself: the text inside the safe area, the callout on
the right slide, the cat the right cat. Then the user approves the final on the post
page (`final.approve`). Nothing is sent without that line.

## Finish

Say the files and the dimension, then run the `post` skill (which runs
`posting-provider` first if no account is mapped yet).
