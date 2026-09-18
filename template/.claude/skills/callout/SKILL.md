---
name: callout
description: Phase 8, the product callout — the one image the compositor pastes on the product slide, rendered from apps/<slug>/product.json: the App Store card (the first template), a feature card, or a custom callout drawn for the day. Free.
---

# Phase 8 — the product callout

    node scripts/render-callout.mjs <slug> <post>                                   the App Store card
    node scripts/render-callout.mjs <slug> <post> --template feature --headline "…" --line "…"
    node scripts/render-callout.mjs <slug> <post> --template custom --from <png>
    node scripts/render-callout.mjs <slug> --all                                    every post folder

Runs once per post, before the render. The facts come from `apps/<slug>/product.json`
(the `product` skill wrote it: name, subtitle, button, icon, source); the card is
evidence, so its source is printed with it. Writes
`files/<post>/cards/1-<template>.png`, 834×204, the size the compositor expects.

## The three templates

- **App Store card**: the dark card with the icon, the name on one line, the subtitle,
  the blue Open pill (the Thrive reference). The default. `--get` for a "Get" pill,
  `--subtitle` to change the line for this post only.
- **Feature card**: the same card with a feature headline and one line instead of the
  store strings, for a post whose callout is one feature (the deck's feature-to-format
  row). Word it as the deck's callout sentence's other half: the card says what the
  feature is, the sentence above it says what it did for the persona.
- **Custom**: a callout you drew for the day (a picture at any size, fitted to the
  card). Draw it with the same Codex bridge if you need a generated one.

A line that does not fit throws with the width in pt: shorten the words, never the
card. A wording changed on the post page renders to `1-appstore-<hash>.png` beside
the default; the default is never overwritten.

## Finish

Say which template and which words, then run the `render` skill.
