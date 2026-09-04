---
name: teardown
description: Stage R5 — write the thirteen-heading analysis of the whole network, then hand the single best-performing post to stage 1 as the reference video. No script for the writing; pure synthesis.
---

# Stage R5 — teardown

No script for the document. You write `research/<project>/TEARDOWN.md` yourself from what
R1–R4 collected. There is a script for the handoff at the end.

## The thirteen headings

Fixed, in this order, every time. They are fixed so that two teardowns can be read
against each other — a heading with nothing under it says "we did not find this", which
is itself a finding. Do not add, drop or reorder them.

1. **The app** — what it does, who for, and whatever store numbers you have.
2. **Account architecture** — the network's shape in a paragraph, then the tiers: brand
   account, persona accounts, rented creators. Handle-naming conventions give the game away.
3. **Launch cadence and lifecycle** — a row per account: posts, active window, best post,
   alive or dead. Then the kill rule you can read off it.
4. **Format portfolio** — every format tried, who uses it, its best post, and a verdict.
5. **Hook patterns** — the reusable structures, quoted verbatim, with view counts as
   evidence. This is the section the `originate` skill will actually use.
6. **Product insertion** — where the app appears in the creative and in the caption,
   quoted verbatim. Including "it does not" where that is the answer.
7. **Conversion strategy** — the whole path from view to install: bio link, pinned
   comment, comment-keyword triggers, forced engagement, caption SEO.
8. **Engagement strategy** — per account, the like/comment/share/save split and what it
   reveals. A high save rate and a low comment rate is a different machine to the reverse.
9. **Topic and niche selection** — which niche each account locked itself into.
10. **Experiments they ran, and the results** — the A/B comparisons already sitting in the
    data: the same hook first-person and third-person, a repost's decay, a format switch.
11. **What transfers to our own app** — numbered, and end with a one-line recipe.
12. **What we still don't know** — the gaps. Be specific and do not paper over them.
13. **Method and cost** — which stages ran, over how many accounts, and the computed spend.

Open with a short block before heading 1: date, evidence (accounts, posts, spend), the
working files, and a sample caveat saying plainly what the scrape did and did not cover.

## Sourcing

`NOTES.md`, the ledger (`scripts/state.py handles <project>`), every `HOOKS.md`,
`index.tsv`, `manifest.tsv`, `slides.tsv`, and every deep-dive `notes.md`.

**Every number is quoted from a file, and every hook is quoted verbatim.** If you cannot
point at where a claim came from, it belongs under heading 12, not stated as fact. Round
nothing to make a point land better. Where the sample is thin — one account, five posts —
say the sample is thin in the sentence that makes the claim, not only in the caveat.

## Then pick the winner and hand it over

The last job of this stage is to choose the single post most worth recreating and give it
to stage 1:

    scripts/handoff.sh <project> <handle> <post-id>

It copies the post's `video.mp4` to `pipeline/00-source/<project>/reference.mp4`, ffprobes
it, records the pick, and prints the `ingest.sh` line to run next.

Choose on views first, then on whether it is recreatable: a post whose whole effect is a
face and a phone is worth recreating; one that turns on a specific person's following is
not. Say which you picked and why in one sentence.

**If the best post is a slideshow, `handoff.sh` will refuse it, and it is right to.**
There is no video for stage 1 to measure. Two honest options — hand over the best *video*
post instead, or drop the reference half entirely and write the script from this teardown:

    scripts/state.py entry <project> research      # then use the `originate` skill

## Finish

    scripts/state.py set <project> teardown done

Report the thirteen headings' one-line findings, the total computed spend for the whole
research phase, and the post you handed over.
