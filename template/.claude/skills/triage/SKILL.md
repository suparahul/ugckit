---
name: triage
description: Stage R2 — sort the handles discover returned into promoters, competitors and noise, and write the ledger. No script, no cost, and it decides what every later stage spends.
---

# Stage R2 — triage

No script. You read `research/<project>/all-handles.tsv` and decide, one handle at a
time. This is free and everything after it is not, so it is worth doing properly.

## The three buckets

| Bucket | What it means | Evidence |
|---|---|---|
| `promoter` | posts for this app — the brand's own account, a persona account, or a rented creator | the caption names the app, links it, or the same phrasing recurs across posts |
| `competitor` | promotes a rival in the same niche | names a different app in the same category |
| `noise` | mentions the word, sells nothing | organic users, unrelated meanings of the keyword |

Write all three down, noise included. A handle you dismissed is a decision, and without
it recorded the next run re-examines it.

    scripts/state.py handle <project> <handle> promoter "captions name the app"
    scripts/state.py handle <project> <handle> noise "different meaning of the keyword"
    scripts/state.py handles <project>

## Where the caption is not enough

A handful will be genuinely ambiguous — a persona account that never names the app reads
like an organic user. Open those profiles and look at the grid: a persona posts the same
face, the same set, the same beat, several times a week. An organic user does not. Ask
the user to look if you cannot.

Do not guess to fill the bucket. `noise` with a note beats `promoter` on a hunch — a
wrong promoter costs a full account scrape at stage R3 and pollutes the teardown.

## Then write NOTES.md

`research/<project>/NOTES.md` — the working file that runs alongside the whole research
phase. It holds the search log (keyword, range, results, spend, what it yielded) and the
three bucket tables with the evidence sentence for each handle. Everything in the ledger,
plus the reasoning that put it there.

## Finish

    scripts/state.py set <project> triage done

Report the counts and read the promoter list back to the user with the evidence for each,
then say what harvesting them will cost — roughly $0.02 an account. Get agreement on the
list before running R3; that list is the bill.
