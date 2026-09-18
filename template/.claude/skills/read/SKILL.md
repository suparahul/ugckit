---
name: read
description: Phase 8, the day-7 read — one row per posted post into niche/anatomy.md (source "own posts"), a verdict per handle and per format into PLAN.md's day-7 table by the judgement rules, the format lock for the next week. Reads the log's outcome.sync lines. No script, no cost. Never writes into brain/.
---

# Phase 8 — the day-7 read

No script. Runs once per plan week, on the day-7 date the plan names, after a `sync
--all`. This is the write-back: the user's findings files are the target, never the
brain.

## Read

The log's `outcome.sync` lines of the week (`apps/<slug>/production/log.jsonl`), the
plan's posts table and its judgement rules, the decks (the format and the arm of each
post), and `niche/anatomy.md`'s post table for the source posts' numbers.

## Write

1. **`niche/anatomy.md`, `## Post table`:** one row per posted post, the anatomy's
   columns as the deck set them (persona, slides, deck shape, hook shape, density,
   product slot, product form, ask, image origin, sound, caption) and the outcome
   columns from the sync (views, saves/view, shares/view, comments/view, app questions
   counted from the comments), `Source` = **`own posts`**, `Kind` = slideshow | video.
   Rows appended under the post table do not count as a change to the parameter
   tables: the strategy page reads "day-7 rows added", and the fit is re-read on the
   next plan, not unfilled.
2. **`production/PLAN.md`, `## Day-7 read`:** the verdict per handle and per format by
   the rules: below 3K views → kill the format; above 10–15K → replicate with small
   variations; a format under 3K gets a second try on another handle before it is
   dropped; zero views on the first two or three posts is not a verdict; day 7 is a
   format read, not an account read (the account rule is day 30). Each experiment
   row of `APP-FIT.md` Part D gets its reading and what settled it, or "not settled:
   n too small".
3. **The format lock for the next week,** per handle, as a line under the table.

Views and ×median first; then the metric the experiment names (saves/view on tip
lists); not engagement rate, not comments.

## Finish

Report the verdicts in one line per handle and the lock. Then propose the next week's
plan: run the `plan` skill again (`app-fit` only where a row changed).
