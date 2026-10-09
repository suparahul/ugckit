---
name: callout
description: Phase 8, the product callout — makes the callout the deck chose, after the user's go-ahead on the deck. The deck has already chosen the template, the product screen (from PRODUCT-SCREENS.md) and its in-app text; this step never chooses again. Cards come from scripts/render-callout.mjs (App Store card, feature card, custom); phones and app components are built per post from the screen's source. Free.
---

# Phase 8 — the product callout

    node scripts/render-callout.mjs <slug> <post>                                   the App Store card
    node scripts/render-callout.mjs <slug> <post> --template feature --headline "…" --line "…"
    node scripts/render-callout.mjs <slug> <post> --template custom --from <png>
    node scripts/render-callout.mjs <slug> --all                                    every post folder

Runs once per post, after the user's go-ahead on the deck and before the render. **The
deck decides; this step builds** (Rahul, 2026-10-09). The deck's product slide names the
template, the screen (`The screen: "<Screen Name>"` in "Why this slide") and the in-app
text (the block labelled "The screen (in-app text)" or "The component (in-app text)"),
and the user has reviewed them. Make exactly that: never pick another screen, never
reword the in-app text. When the deck's choice cannot be built (the screen has no source,
the text does not fit the screen), stop, say why, and send the post back to the `deck`
skill and the user; do not choose a substitute.

The facts come from `apps/<slug>/product.json` (the `product` skill wrote it: name,
subtitle, button, icon, source); the card is evidence, so its source is printed with it,
and it is drawn from SVG, never by an image model (a generated store card comes back
with nonsense strings). The screen's source is its section in
`apps/<slug>/PRODUCT-SCREENS.md` (**Source**: the code file, a screenshot or a screen
library row). A post with no callout is "no callout", said as missing, never as "being
added". Card files go to `files/<post>/cards/1-<template>.png`, 834×204, the size the
compositor expects.

## The templates

The deck chooses one per post (the `deck` skill § The callout plan), with a strong bias
towards a phone that shows the app; the App Store card is the default when no screen
fits. Two pairings are wrong: a phone in a hand never shares the slide with the App Store
card (Atlas and the compositor drop the card: `atlas/lib/callout.ts` `shownCards`); a
callout slide never carries a line with no app at all. Each template below says how the
deck selects it and how it is made.

1. **App Store card** (the default). The dark card with the icon, the name on one line,
   the subtitle, the blue Open pill (the Thrive reference). `--get` for a "Get" pill,
   `--subtitle` to change the line for this post only. Deck: `**Cards:**` `1. the App
   Store card`. The compositor (`atlas/scripts/render-slides.mjs`) pastes it at 80% of the
   width, centred, its bottom on the safe-area bottom; a layout locked in Atlas
   (`slide.layout`) moves it. A wording changed on the post page renders to
   `1-appstore-<hash>.png` beside the default; the default is never overwritten.
2. **A line plus the App Store card.** The same card, with the deck's callout sentence
   above it: a block labelled "above the card" sits on the card.
3. **Phone in hand, no App Store card.** A hand holds the phone inside the real photo
   scene (persona handles). The image model makes the plate with the phone screen in flat
   chroma green; then put the screen in: build the screen as HTML from its source, with the
   deck's in-app text, and screenshot it (headless Chrome); find the green quad on the
   plate, warp the screen into it and composite through the green mask, so fingers over
   the screen stay in front (the method of `scripts/screen_comp.py`, which does this for
   video). Keep the script in `files/<post>/callout/`. Deck: the product slide's image
   prompt says "chroma", or the position names the phone, or the first Cards item names a
   phone. Placement in the prompt: "the phone is about N% of the frame width", "left edge
   at N% of the width", "top edge at about N% of the frame height", "running off the
   bottom edge"; the defaults are 66% wide, centred, from 38% down. "phone in her hand"
   makes Atlas draw the hand. Never list the App Store card in its `Cards:`.
4. **Phone beside the App Store card** (E2). The full-height phone on the left (from 4% to
   96% of the height by default, 4.4% from the left edge, a 9:16 phone) and the App Store
   card upright in the side column. Deck: the first Cards item says "full-height phone";
   the text says "the App Store card upright in the side column"; "from X% to Y%" sets
   the height. E1 is the same phone with the app icon and a line in the side column
   (write "E1" and `line "…"`; " / " breaks the line). Build: the screen as HTML with the
   deck's in-app text, screenshot it, then compose the slide (the phone frame, the screen,
   the upright card) with a script in `files/<post>/callout/`. With a full-height phone,
   no card file is expected and the compositor pastes no card: the slide picture holds
   the phone and the card.
5. **Product component.** The app's own card (a step list, a checklist) rendered from HTML
   with the deck's in-app text and laid directly on the photo, with a text line and no
   phone. Build: a per-post script in `files/<post>/card/`. Deck: no `Cards:` list; the
   words in a "The component (in-app text)" block.
6. **Feature card.** The card with a feature headline and one line instead of the store
   strings (`--template feature`), for a post whose callout is one feature. It says what
   the feature is; the sentence above it says what it did for the persona. A line that
   does not fit throws with the width in pt: shorten the words, never the card.
7. **Custom.** A callout drawn for the day (`--template custom --from <png>`, fitted to
   834×204), for example an illustrated sheet's callout or a pop-up for a video.

**The phone frame placeholders in Atlas** (`atlas/lib/callout.ts`,
`atlas/components/production/Frame.tsx`, `atlas/app/production.css`). Before a slide has
a picture, Atlas draws an empty, hatched phone where the deck puts it (style N or E) and
labels it: "phone in hand · app screen: <screen> · not made yet", or "phone screen beside
the App Store card · <screen> · not made yet". The screen name is the one quoted after
"The screen:" in the slide's "Why this slide". The placeholder is never filled by Atlas:
it goes away when the slide's picture exists, and that picture must already hold the
phone.

**The Composition spec.** Not a file and not a schema: a paragraph that starts with
"Composition spec" under a `### Slide N` heading of the deck, for a slide that is built
as one HTML picture. The deck agent writes it; the per-post compose script and
`atlas/scripts/build-production.mjs` read it. The parser takes the quoted words of `the
headline "…"`, `the lines "…" / "…"`, `the cover: "…"`, `the app sentence…: "…"` (or `the
<App> sentence…: "…"`, placed above the card) and `the save line bold: "…"`, and marks the
slide as composed, so Atlas shows no overlay text on it once the picture exists. It is
read only when the slide has no bold-label text blocks.

## The checks before the render

- The screen is the deck's screen and its text is the deck's in-app text, word for word.
- The screen looks like the app (its fonts, colours and layout from the source), with
  real-looking content and no placeholder strings.
- No placeholder ships: every callout is made before the user reviews the slides. A
  slide that says "not made yet" is not ready.
- Make the finished slide the chosen candidate on the post page, so the user does not
  have to switch before approving.

## Finish

Say which template, which screen and which words, then run the `render` skill.

## Before you finish

Did the user correct anything in this run? If yes, add the learning before you finish:
a dated, general entry in the section "Iterative learnings and improvements" of the skill
that produced the mistake (this one, or `deck`, `callout`, `images`, `plan`,
`slideshow-review`), and for a screen choice a dated line under that screen's
**Corrections** in `apps/<slug>/PRODUCT-SCREENS.md` (AGENTS.md, hard rule 16). Then tell
the user in one line which learning you added.

## Iterative learnings and improvements

A dated list that agents add to over time, from the user's feedback on real callouts.
Each entry is a rule for every future callout, not only for the post it came from. Add
new entries at the bottom under a new date heading (`### <date> — <what>`), with short IDs
(C1, C2, …) that the `slideshow-review` skill can cite. Where an entry disagrees with older
text in this file, the entry says so; the older text is not rewritten until the user
decides. A correction of which screen fits a story goes to `apps/<slug>/PRODUCT-SCREENS.md`;
the callout's position and its lead-in line are in the `deck` skill.
