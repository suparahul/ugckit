---
name: harvest
description: Stage R3 — the shallow pass. Metrics, cover frames and the verbatim on-screen hook off every cover, for every handle of an app. About two cents an account.
---

# Stage R3 — harvest

    scripts/harvest.sh <project> <app> --all [maxItems]

Runs every handle in that app's ledger, one account at a time. `maxItems` defaults to
50 posts. A single account: `scripts/harvest.sh <project> <app> <handle>`. One app at a
time; when it is done, the next app.

## Before you run it

State the bill: accounts × maxItems × $0.00045, so 20 accounts at 50 posts is about
$0.45. Get approval for the number of accounts, not for each account.

This is a long serial job — twenty accounts is twenty Monid calls plus a few hundred
image downloads and a headless read per twelve covers. **Start it in the background**
and wait for the notification. Do not run two copies to go faster; see rule 13.

## What it produces, per handle, in `research/<project>/<app>/<handle>/`

    posts.json     the raw scrape — the only copy you will get at this price
    index.tsv      rank, views, likes, comments, shares, bookmarks, date, video|photo, caption
    covers/NNN.jpg the cover frame of every post, rank 1 = newest = 001.jpg
    hooks-NN.md    a batch of twelve covers, read and transcribed
    HOOKS.md       the account's hook bank, rebuilt from the batches

The covers are downloaded in the same run as the metrics on purpose — those URLs expire
(rule 12). If a later stage needs an image that is not on disk, the account has to be
paid for again.

## The hook bank is the point

Everything else is arithmetic; the hook bank is the corpus. Each batch is read by a
separate headless Haiku session so that hundreds of covers never touch this conversation.
The transcription rule it is given, and the one you must hold it to: **verbatim.**
Original spelling, capitalisation, typos and emoji. A tidied hook is a useless hook —
the misspellings are frequently what the post is.

Batches are skipped when `hooks-NN.md` already exists, so a killed run resumes exactly
where it stopped.

## No `claude` CLI? Then you read the covers

The headless sessions are a convenience that keeps 50 images an account out of your
context. They are not the only way. When the script says `claude CLI not found`, the
work is yours, and it is not optional — a harvest without hooks is metrics with nothing
to learn from:

1. Open `<handle>/hooks.todo`. It holds one block per missing batch: the twelve cover
   files and the exact instructions, the same ones the headless session would get.
2. For each block, look at the twelve covers with your own image reading, and write the
   `hooks-NN.md` it names — one table, verbatim hooks, the `## Observations` paragraph.
   One batch at a time; do not load an account's fifty covers at once.
3. Re-run the same `harvest.sh` command. It rebuilds `HOOKS.md` from the batches and
   clears the todo. Then run the `atlas` skill as usual.

If a Claude Code user wants the cheaper path later, `npm install -g @anthropic-ai/claude-code`
puts `claude` on PATH and the script goes back to headless batches.

## Then actually look

Open two or three `HOOKS.md` files and read them. You are looking for the shape the
account repeats, and for covers that recur — a reposted winner is the single strongest
signal an account gives you about what it thinks worked.

## Finish

    scripts/state.py set <project> harvest done

Report: accounts harvested, posts indexed, covers on disk, computed spend, and the top
three accounts by total views. This is the first moment there is something to look at:
run the `atlas` skill so the user can see the covers and hooks, then continue with
`scripts/deepen.sh <project> <app> --rank`.
