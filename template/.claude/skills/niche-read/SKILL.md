---
name: niche-read
description: Phase 4, the read — every slide, contact sheet and transcript of a batch read from disk, the batch file written, then the second source of the user's findings beside the brain, marked "niche". One counting script; the judging is yours. No cost.
---

# Phase 4 — the read (niche-read)

    scripts/niche-stats.py <slug> <date>        the batch table, the medians, the spread, the handles with 2+ posts
    scripts/niche-stats.py <slug> --searches    the same counts over the search files, TikTok and Instagram

The script counts. You judge, guided by the brain: read `brain/learnings-slideshows.md`
(the format definitions, the hook shapes, "Finding Ideas & Vetting Formats") before the
first slide, and `brain/SLIDESHOW-ANATOMY.md` for the columns. No roll-up script decides
which format is kept; you do, and you say why.

## 1. Read every post from disk

One post at a time, under `apps/<slug>/niche/batches/<date>/<handle>/<postId>/`: every
`slide-NN.jpg` in order with your own image reading, or every `sheet-N.jpg` and the
`transcript.txt` for a video; then `comments.json`. Do not load a whole batch of
slides at once. Transcribe the on-image text **verbatim**: original spelling,
capitalisation, typos, emoji.

## 2. Write `batches/<date>/BATCH.md`

The shape of the reference batch file, in this order:

1. `# <N> posts <the user> found while scrolling, pulled with Monid on <date>` and two
   lines: what the batch is, where the files are.
2. `## Method and cost` — the calls made and the computed spend (from the fetch report).
3. `## The table` — paste the script's table (it is in the batch file's column order,
   with `Kind` last), then the one-line summary under it.
4. `## Captions, hashtags, bios` — the script's second table.
5. `## Per-post notes (slides read from disk)` — `### <n>. @<handle> — "<hook>" — <views>
   views, <slides> slides` per post: the hook shape named by the brain's list, the
   slide-by-slide text verbatim, the structure, the visual style (image origin, subject,
   text density, text position), where the product sits if any, the last-slide ask, the
   sound, and a `Pattern:` line naming the format. A video post gets the same headings
   with the transcript quoted and the beats by timestamp.
6. `## Videos` — the video posts together: the formats seen, the hooks, the view counts.
7. `## What the comments show about promotion` — "what app is this" questions, the
   creator's answers, the sponsored disclosures, quoted.

## 3. Write the findings, the second source: `niche`

Three files under `apps/<slug>/niche/`, the brain's shape. `apps-learnings` created
them with the `competitor apps` sections and rows; you append. Every section and row
is marked **`niche`**.

- **`learnings.md`**: a dated section `## <date> — From the niche: <N> posts read slide
  by slide`. First paragraph `Source: niche — batch <date>, <N> slideshows, <M> videos,
  <H> handles`. Then bold-led blocks with bullets: the hook patterns seen (with view
  counts), slide counts, text density and saves/view, sound, visual patterns, the last
  slide, the engagement ratios, who posts (persona, theme page, brand, ambassador), what
  the app accounts do with the app, **what the videos teach** in its own block, and a
  last block **Confirms** …: what confirms the brain, what contradicts it, what is new.
  Where the niche and the competitor apps disagree, say so in one line and leave the
  decision to `app-fit`.
- **`anatomy.md`**: one row per post read under `## Post table`, the anatomy's columns
  exactly, then `Source` = `niche` and `Kind` = `slideshow` | `video`. A value the niche
  adds goes into that parameter's value table with `Seen in: <niche> (niche)`.
- **`architecture.md`**: one row per account behind the posts under `## Account table`,
  the architecture's columns, `Source` = `niche`.

Nothing is written into `brain/`. Every number comes from the table, every quote from a
slide.

## 4. Second round?

Ask once: another recipe round, more hand-ins, or enough for now. A second batch on
another date is a second folder and a second dated section.

## Finish

    scripts/state.py set <slug> niche done

Report the batch file, the three findings files with their row counts, and the two or
three findings the strategy will use (the format that repeats across handles, the
density-to-saves rule, the app slot the app accounts use). Stage 3 is filled when one
batch is read and the trio exists. Open http://localhost:3210/app/<slug>/niche. Then
run the `account-architecture` skill.
