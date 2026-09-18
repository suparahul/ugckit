---
name: app-fit
description: Phase 7, strategy part 2 — walk every parameter of both brain sheets for this app, the brain and the two sources of findings read together, decide one value each or mark an experiment, and write strategy/APP-FIT.md. No script, no cost.
---

# Phase 7 — the app fit (strategy, part 2)

No script. Runs after the handles exist. Two inputs, always named: what works for the
competitor apps (phase 3) and what works in the niche in general (phase 4). Slideshow
rows and video rows are both in the walk; production starts with slideshows unless a
plan row says otherwise.

## Read, in this order

1. The brain: `brain/SLIDESHOW-ANATOMY.md` and `brain/ACCOUNT-ARCHITECTURE.md`, every
   parameter heading; `brain/learnings-slideshows.md` for the reasons.
2. The findings trio, both sources: `niche/anatomy.md` (the post table, the added
   values), `niche/architecture.md`, `niche/learnings.md` (both dated sections).
3. The app: `apps/<slug>/APP.md`, `product.json`; then `strategy/ACCOUNTS.md`,
   `handles/*/HANDLE.md`, the teardowns.

## Write `apps/<slug>/strategy/APP-FIT.md`

The shape of the reference file, in this order:

- **Head:** `# App fit — <App> on the slideshow anatomy and the account architecture`,
  the date, and the status legend: *decided* (one value on evidence), *adopted
  (claimed)* (a source's claim no account tests), *experiment* (the evidence does not
  decide; candidates listed), *decided (user)* (the user's call, dated).
- **## The app, as an input.** `### What <App> is` (a table from `APP.md`), `### The
  hero features` — the table of `APP.md` with the **"Reads as a still?"** column now
  filled: for each feature, does its screen say what it does in one frozen frame, yes
  or no, with the reason. Then `### Feature-to-format map`: each feature that reads as
  a still paired with the format from the findings that carries it, with the source
  post's views.
- **## Part A — the post** (Layers 0 to 5 of the anatomy): one table, one row per
  parameter: `| Parameter | Value | Status | Source | Evidence |`. `Source` is
  `competitor apps`, `niche` or `brain`. Where the two sources disagree, the row is an
  **experiment** with one arm from each, unless the user decides it now.
- **## Part B — the account** (Layers 1 to 7 of the architecture): the same table.
- **## Part C — the account set:** one line, "decided in `strategy/ACCOUNTS.md`", and
  the handle names.
- **## Part D — experiments:** one row per experiment row above: `| # | Parameter | Arm
  1 | Arm 2 | What settles it | Metric |`. A video format from either source that does
  not beat the best slideshow format on views goes here as a later arm, not to week 1.
- **## Part E — the first posts:** one row per handle per slot for the first two days,
  each copying a source post by view count (handle, source post, views, url, the
  format, the change made).

## The walk, with the user

Walk the experiment rows one by one in the conversation: the user picks an arm, or
keeps the row as an experiment with two paired posts. Each decision is dated in the
row. Do not ask about rows the evidence decided; say how many were decided and from
which source, then the first experiment.

## Finish

Report: rows decided, adopted, experiments, and the feature-to-format map in three
lines. Then run the `plan` skill. Stage 5 is filled when this file and `PLAN.md`
exist; the strategy page shows the status counts.
