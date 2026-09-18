---
name: product
description: Phase 2 of the slideshow path (stage R0 of the research) — understand the user's own app before any research. Reads a store listing, a website, a document or a repo and writes apps/<slug>/APP.md with the facts, the market, the niche and the hero features, plus product.json and icon.jpg, the callout facts. One free script, no cost.
---

# Phase 2 — the app (R0)

You read what the user gives you and write `apps/<slug>/APP.md`. One script,
`scripts/product-facts.sh`, fetches the callout facts (`product.json`, `icon.jpg`).

Run it when the user has an app of their own. A user who only has a niche or an app
name runs it too, in the short form at the end: the niche phrase is recorded and the
rest waits until an app exists. The later phases need to know what the product is, the
callout needs its store facts, and many people do not know which niche they are in.

## The slug

`<slug>` is the app's name in lowercase, letters, digits and hyphens only: Catwise →
`catwise`, "My Cat Pal" → `my-cat-pal`. It is also the project name in
`pipeline/state/pipeline.json`, so `state.py init <slug>` and `apps.sh <slug>` use the
same word. Decide it once, here, and say it.

## What you take in

Any of these, in any mix. Read all of what is given, not the first page of it.

- **An App Store link.** The id is the number after `/id`. Run the lookup first; it is
  the truth for the name and the icon, and it is free:

      scripts/product-facts.sh <slug> --id <id>

  It writes `product.json` (source `itunes`), `icon.jpg` and `listing.json` (the raw
  record, with the description and the screenshot urls). The lookup does not carry the
  store's subtitle line; read it from the listing page's header (or ask the user for
  it) and set it: `scripts/product-facts.sh <slug> --subtitle "<text>"`. Read the
  description and the screenshots' captions for the sections below.
- **A website.** Fetch it. Then fetch the pages it links to: pricing, features, about,
  the store listing. `scripts/product-facts.sh <slug> --website <url>` prints the
  title, the description, the icon and any App Store id on the page; an id found there
  sends you back to `--id`.
- **A code repository.** Read the README, the store metadata, the paywall copy and the
  onboarding screens — that is where a product says what it is for. Skip the source.
  `scripts/product-facts.sh <slug> --repo <path>` lists the metadata lines and the
  icon candidates; then write what you read with `--typed` and
  `PRODUCT_SOURCE=repo` in front.
- **A document.** Read it in full.
- **Nothing but the user's words.** `scripts/product-facts.sh <slug> --typed "<name>"
  "<subtitle>" [icon]`; the source is recorded as `typed`.

The fallback chain is that order: id, repo, website, typed. `product.json` records
which one it came from in `source`; the Atlas shows the source next to the card. An
Android-only or not-yet-listed app has no lookup: use the repo or the site, and say so
in the gaps section.

## What you write

`apps/<slug>/APP.md`. Head lines first, then the sections, in this order, every time:

    # <Name>
    Slug: <slug>
    Niche: <phrase>
    One line: <what it is, in one sentence, no marketing words>
    Platform: iPhone | Android | both | web
    Repo: <path>            (optional)
    Website: <url>          (optional)
    App Store id: <id>      (optional; product.json's source when present)

1. **## What it is** — three to six sentences. Facts only. If a sentence would work on
   a landing page, rewrite it.
2. **## Who uses it, and for what** — the person and the moment or the problem.
3. **## Hero features** — one table, one row per feature the listing or the onboarding
   leads with, up to eight:

       | # | Feature | Screen | Reads as a still? |
       |---|---|---|---|
       | 1 | Behaviour translator | the clip read: Dayprint, typical behaviours | |

   The last column stays **blank**. Phase 7 (`app-fit`) fills it with the still-frame
   test, because that test needs the formats the niche phases find. Do not guess it.
4. **## Market and language** — the store category as the store names it (Health &
   Fitness, Lifestyle, …), the copy's language, the target country if known.
5. **## Niche** — one short phrase, two or three words, in the language people type into
   TikTok search. Examples: `mental wellness`, `cat care`, `looksmaxxing`, `travel
   planning`, `gym split`. Not a category, not a sentence, not a demographic. Ask: is
   this the phrase people would type? and wait for the yes.
6. **## Search words** — four to six phrases that find *apps*, each carrying the word
   "app": `<niche> app`, `<niche> apps`, `best <niche> app`, `app for <niche>`, and one
   or two with the niche's main noun swapped for a neighbour. These become the first
   keyword list for phase 3. Not problem phrases; those are kept for a later
   hidden-promoter round, at most two.
7. **## What I could not find** — named gaps. Never fill a gap with a guess.

Then record the niche where the scripts read it:

    scripts/state.py init <slug> --entry research
    scripts/state.py niche <slug> "<the phrase>"
    scripts/state.py app-set <slug> <app> note "our own app"   # only after phase 3 has the ledger

## Where the niche is not obvious

Some products sit between two niches. Pick the one whose audience already watches content
on TikTok — say which alternative you rejected and why, in one line under the Niche
heading. If you genuinely cannot decide, ask the user with both phrases side by side; do
not pick at random.

## No app yet

The user has only a niche or an app name. Record the phrase (`state.py init`, `state.py
niche`) and write nothing under `apps/` yet; phases 3 and 4 run on the phrase, and the
canvas shows stage 1 as waiting for the user. When the app exists, come back here.

## Finish

    scripts/state.py set <slug> product done

Report the niche phrase, the search-word list and the callout facts as written (name,
subtitle, source), and ask the user to confirm the phrase and the words before phase 3
spends on them. Stage 1 is filled when `APP.md` exists and `product.json` has a source:
open http://localhost:3210/app/<slug> if the Atlas runs.
