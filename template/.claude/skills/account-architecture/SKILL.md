---
name: account-architecture
description: Phase 5, strategy part 1 — decide the account set before any handle exists. How many handles, the role of each, real or rendered subject, the name pattern, the cadence. Reads the brain and both sources of the findings. Writes strategy/ACCOUNTS.md. No script, no cost.
---

# Phase 5 — the account architecture (strategy, part 1)

No script. This is the part of the strategy that has to be decided before a handle
can be created; the rest of the strategy (`app-fit`, `plan`) waits until the handles
exist.

## Read, in this order

1. `brain/ACCOUNT-ARCHITECTURE.md`, the account rows: Layer 1 (naming), Layer 4 (tier:
   what a brand handle posts and never posts, what a persona handle never posts), Layer
   5 (handles per app, posts per day, launch shape, kill rule), Layer 7 (set-up).
2. `apps/<slug>/niche/architecture.md`, both sources: the `competitor apps` rows (what
   the apps in this niche run) and the `niche` rows (who posts the winning formats).
3. `apps/<slug>/niche/learnings.md`, both dated sections, for the account shape and
   the app slot; `apps/<slug>/APP.md`; the teardowns' heading 2.

Every value you propose names its source: `brain`, `competitor apps` or `niche`.

## Decide, with the user, one at a time

1. **How many handles.** The brain's recommendation: at least two handles at two posts a
   day each ("the slideshow game is about volume"). One is allowed; say the
   recommendation once and take the user's answer.
2. **The role of each.** The default from the architecture: a persona handle that never
   names the app, plus the brand handle whose bio carries the search instruction. Other
   sets: two personas; brand only. Say what the competitor apps and the niche run.
3. **The subject.** Rendered (the default: the pictures are generated, the identity
   stage makes the references) or real (the user's own camera; the references wait
   until a plan exists).
4. **The name pattern.** From Layer 1 and the niche's handles: `<firstname>.<niche
   word>` for a persona, the app's name for the brand.
5. **The cadence.** Two posts a day per handle is the recommendation.
6. **A video arm.** Only if phases 3 and 4 found a video format that clearly wins: note
   it here as "worth a plan row later"; it is not a handle decision.

## Write `apps/<slug>/strategy/ACCOUNTS.md`

    # Accounts — <App>
    Handles: 2
    Subject: rendered
    Cadence: 2/day each
    Decided: <date>

    ## The set
    | Handle | Role | Bio rule | Subject | Name pattern | Cadence | Status | Source |
    |---|---|---|---|---|---|---|---|
    | @<to name> | main persona | never names the app | rendered | <firstname>.<niche> | 2/day | proposed | brain Layer 4; niche: 7 of 9 winning posts are personas |
    | @<app name> | brand handle | "Search <App> in the App Store" | rendered | the app's name | 2/day | proposed | competitor apps: all three run a brand handle |

    ## Why this set
    Short prose, one paragraph per decision, each with its citation.

    ## Video arm
    One line: none | "<format>, <views>, worth a plan row later".

One row per planned handle. A handle's name is `@<to name>` until the `handles` skill
names it; the Organic Factory UI counts the rows that start with `@`. The user approves on the
strategy page (http://localhost:3210/app/<slug>/strategy → `accounts.approve` in the
log) or in the conversation; record the date either way.

## Finish

    scripts/state.py set <slug> accounts done

Report the set in three lines and run the `handles` skill for the first handle.
