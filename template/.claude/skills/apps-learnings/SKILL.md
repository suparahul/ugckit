---
name: apps-learnings
description: Phase 3, last step — the cross-app read. Reads every teardown of the ledger against the others and writes the first source of the user's findings beside the brain, marked "competitor apps", slideshows and videos alike. No script, no cost.
---

# Phase 3 — the cross-app read (apps-learnings)

No script. The `teardown` skill describes one app at a time and says "the cross-app
learnings are a later stage". This is that stage. Run it once every app in the ledger
has its `TEARDOWN.md`, before the niche phase.

## What you read

Every `research/<slug>/<app>/TEARDOWN.md`, side by side, with the files under them:
`index.tsv` and `slides.tsv` per handle (the numbers), the contact sheets and slides
`deepen` pulled (`<handle>/<postId>/`), every `notes.md`, every `HOOKS.md`. Read the
brain first: `brain/learnings-slideshows.md` gives you the format definitions and the
hook shapes to name things by; `brain/SLIDESHOW-ANATOMY.md` and
`brain/ACCOUNT-ARCHITECTURE.md` give you the columns. Then read the app: `apps/<slug>/APP.md`.

## What you write

Three files under `apps/<slug>/niche/`, in the brain's shape, so that every later
phase reads the brain and these together with one reading rule. Create them if they
do not exist; the niche phase appends its own sections and rows later. Every section
and every row names its source: **`competitor apps`**.

1. **`learnings.md`** — a dated section, `## <YYYY-MM-DD> — From the competitor apps`.
   Its first paragraph is `Source: competitor apps — <the app names>, <N> accounts,
   <M> posts read`. Then one bold-led block per finding with bullets, the way the
   brain's dated sections are written, and a last block that starts **Confirms** …:
   what the read confirms in the brain, what it contradicts, what is new. Say, in
   their own blocks:
   - what the competitor apps' slideshows do (the formats, the hook shapes, the slot
     the app sits on, which handle names it and which never does);
   - what their videos do (the formats that work, quoted with view counts, `kind:
     video` on every one), even when production starts with slideshows;
   - the account shape (brand plus personas, or personas only), with the numbers.
2. **`anatomy.md`** — the headings of `brain/SLIDESHOW-ANATOMY.md` (the layers, the
   parameter headings, `## Post table`), the tables empty where you saw nothing. Under
   `## Post table`, one row per top post read, the anatomy's columns exactly, plus two
   columns at the end: `Source` (`competitor apps`) and `Kind` (`slideshow` | `video`).
   Where a parameter's value was seen here and is not in the brain, add a row to that
   parameter's value table with `Seen in: <niche> (competitor apps)`.
3. **`architecture.md`** — the headings of `brain/ACCOUNT-ARCHITECTURE.md`; under
   `## Account table`, one row per competitor account read, the architecture's columns
   exactly, plus `Source` (`competitor apps`).

Every number is quoted from a file and every hook verbatim, as in `teardown`. Nothing
is written into `brain/`.

## Where the sample is thin

Two apps with one account each is a thin read. Say so in the section's first block, not
only in a caveat, and keep the section short. A niche with few apps (`apps/SKILL.md`
§ When the niche has few apps) still gets the section: what the few apps do, marked
thin.

## Finish

    scripts/state.py set <slug> apps-learnings done

Report the three files, the number of post rows and account rows, and the one or two
findings the strategy will lean on (the app's slot, the handle that names it, the best
video format if any). Then run the `niche-search` skill.
