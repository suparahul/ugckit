---
name: apps
description: Stage R1 — find up to five apps in the niche that are promoting on TikTok. Keyword searches through Monid in rounds, with keyword expansion between rounds. A few cents a round.
---

# Stage R1 — apps

    scripts/apps.sh <project> "<keyword>" ["<keyword>" ...]

Writes `research/<project>/searches/*.json`, then rebuilds three tables from every
search ever run: `scan.tsv` (recurring terms), `handles.tsv` (one row per handle with
its best post) and `searches.tsv` (the search log).

## What this stage is for

The whole system studies **apps**: how each one is promoted on TikTok, by whom, with
what content. This stage decides which apps. Everything after it spends money on that
list, so a wrong app here is the most expensive mistake in the research half.

The target is **five apps** with real promotion in the niche. The user can ask for more.
At five, move on.

## Start

You need a niche phrase — from R0, or from the user, or from the app name they gave you.
Record it: `scripts/state.py niche <project> "<phrase>"`.

If the user named an app, that app goes in the ledger first, and the search still runs:
the point is to find its rivals.

    scripts/state.py init <project> --entry research
    scripts/state.py app <project> <app> "named by the user"

## Rounds

Each round is the same four steps. Expect two or three rounds; sometimes more.

1. **Show the keyword list and the cost, and wait for a yes.** Each keyword is two
   searches at 40 results — about $0.036 a keyword. Six keywords is about $0.22. Say the
   figure.
2. **Run it.** Then read `scan.tsv`. It is sorted by how many posts a term appears in.
3. **Decide which terms are apps.** An app shows as a hashtag, a `<name> app` phrase or
   a channel name, across **several handles**. One handle using a hashtag is an account,
   not an app. When a term looks like an app but you are not sure, open the best post's
   URL from `handles.tsv` and look. Add what you are sure of:

        scripts/state.py app <project> <app> "<evidence: N handles, hashtag #x, best post 1.2M>"
        scripts/state.py app-set <project> <app> round <n>

4. **Expand the keywords for the next round.** New keywords come from three places, and
   this is the part that finds the gold the first search missed:
   - the names of the apps just found, and `<name> app`
   - the pattern in the handles that promote them — `<firstname>.traveltips` means
     search `traveltips`; `<something>.lifts` means search `lifts`
   - the hashtags on the top posts that are not the niche word itself

   A keyword already searched costs nothing again, so repeat the whole list plus the new
   ones.

Stop when the ledger has five apps, or when a round adds no new app. Then say which.

## When the niche has few apps

Say it in plain words: "This niche has N apps with active TikTok promotion. That is not
many." Record what you saw anyway — `handles.tsv` already holds the biggest posts in the
niche, app or no app. Do not go deeper into them now; note in `NOTES.md` that the niche
content exists and is unstudied. Then continue with the apps you have.

## Write NOTES.md

`research/<project>/NOTES.md` — the working file. The search log with what each keyword
yielded, the app ledger with the evidence for each, and the terms you rejected and why.
Rejected terms matter: without them the next round re-examines them.

## Finish

    scripts/state.py set <project> apps done

Report: rounds run, keywords searched, computed spend, and the app ledger with one line
of evidence per app. Then run the `network` skill on the first app.
