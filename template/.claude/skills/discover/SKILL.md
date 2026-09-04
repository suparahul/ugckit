---
name: discover
description: Stage R1 — start from a niche or an app name and find who is promoting what. Keyword searches through Monid; about a cent a search.
---

# Stage R1 — discover

    scripts/discover.sh <project> "<keyword>" ["<keyword>" ...]

Writes `research/<project>/searches/<slug>.<RANGE>.json` and `all-handles.tsv`.

## Ask first, search second

You need one thing from the user: **a niche or an app name.** Nothing else. If they give
you a niche ("cat care apps"), ask which app or apps they want to look at, or offer to
search the niche and find out.

Then pick the keywords yourself and show them the list before spending anything:

- the app name exactly as it is spelled in the store, and the way people misspell it
- the app name with the category word ("stronger app", "stronger workout")
- one or two phrases the audience would use, not the marketer's phrase

Each keyword costs two searches — `ALL_TIME` for the canon and `LAST_THREE_MONTHS` for
what is working now. About $0.01 each, so four keywords is roughly $0.08. Say the figure
before you run it.

    scripts/state.py init <project>
    scripts/state.py niche <project> "<what the user asked for>"

## What comes back

`all-handles.tsv` is one row per unique handle with its best post: handle, followers,
best views, likes, date, caption. That is the whole output — the raw search JSON is
evidence, not reading material.

A search that returns 20 rows and 3 handles found the network. One that returns 20 rows
and 20 unrelated handles found a word, not a network — try a different keyword before
spending on the next stage.

## Finish

    scripts/state.py set <project> discover done

Report: keywords searched, unique handles found, computed spend, and the three handles
with the biggest posts. Then run the `triage` skill — do not start harvesting until the
handles have been sorted, because scraping noise costs the same as scraping a promoter.
