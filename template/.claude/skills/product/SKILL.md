---
name: product
description: Stage R0, optional — understand the user's own product before any research. Reads a website, a document, a repo or a store listing and writes PRODUCT.md with the facts, the market and the niche. No script, no cost.
---

# Stage R0 — product

No script. You read what the user gives you and write `research/<project>/PRODUCT.md`.

Optional: a user who only wants to study a niche skips it. Run it when the user has an
app of their own, because the later stages need to know what the product is, and because
many people do not know which niche they are in. This stage answers that.

## What you take in

Any of these, in any mix. Read all of what is given, not the first page of it.

- **A website.** Fetch it. Then fetch the pages it links to: pricing, features, about,
  the app store listing. Search the web for the product name once, for reviews and the
  store page.
- **A document.** Read it in full.
- **A code repository.** Read the README, the store metadata, the paywall copy and the
  onboarding screens — that is where a product says what it is for. Skip the source.
- **A store listing.** The description, the screenshots' captions, the top reviews.

## What you write

`PRODUCT.md`, with these headings, in this order, every time:

1. **What it does** — three to six sentences. Facts only. No marketing words: if a
   sentence would work on a landing page, rewrite it.
2. **Who uses it, and for what** — the person and the moment or the problem.
3. **Market category** — as the app stores name it (Health & Fitness, Productivity, …).
4. **Niche** — one short phrase, two or three words, in the language people type into
   TikTok search. Examples: `mental wellness`, `cat care`, `looksmaxxing`, `travel
   planning`, `gym split`. Not a category, not a sentence, not a demographic.
5. **Search words** — four to six phrases that find *apps*, each carrying the word
   "app": `<niche> app`, `<niche> apps`, `best <niche> app`, `app for <niche>`, and one
   or two with the niche's main noun swapped for a neighbour (`sports video app` next
   to `youth sports app`). These become the first keyword list for R1. Not problem
   phrases: "how to film youth sports" finds tutorials, "youth sports app" finds apps.
   Problem phrases are kept for a later hidden-promoter round in R1; list at most two.
6. **What I could not find** — named gaps. Never fill a gap with a guess.

Then record the niche where the scripts read it:

    scripts/state.py init <project> --entry research
    scripts/state.py niche <project> "<the phrase>"
    scripts/state.py app-set <project> <app> note "our own app"   # only after R1 has the ledger

## Where the niche is not obvious

Some products sit between two niches. Pick the one whose audience already watches content
on TikTok — say which alternative you rejected and why, in one line under heading 4. If
you genuinely cannot decide, ask the user with both phrases side by side; do not pick at
random.

## Finish

    scripts/state.py set <project> product done

Report the niche phrase and the search-word list, and ask the user to confirm both before
R1 spends on them.
