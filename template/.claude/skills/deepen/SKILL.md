---
name: deepen
description: Stage R4 — mark the top 5 accounts by total views and pull their best posts as real video or as slides. Costs no Monid; it reuses what harvest already paid for.
---

# Stage R4 — deepen

    scripts/deepen.sh <project> --rank      rank the harvested accounts, mark the top 5
    scripts/deepen.sh <project> --deep      pull the top 3 posts of each marked account

## The ranking is arithmetic, not judgement

Top 5 by **total network views** — not followers, not how good the content looks to you.
Follower counts on seeded accounts are meaningless and your taste is not evidence. Run
`--rank`, read the table, and only override it if the user asks.

## What a deep dive pulls

Per post, into `research/<project>/<handle>/<post-id>/`:

- a **video post** → `video.mp4` from the signed CDN link in `posts.json`, ffprobed to
  prove it has a video stream, plus 4x4 contact sheets at 1 fps
- a **photo post** → every slide as `slide-NN.jpg`, taken from the post's `images` array
- either way → `notes.md`: the post, the verbatim on-screen text, the structure beat by
  beat, the visual style, and why it worked

The contact sheets are deleted once `notes.md` exists. The mp4 and the slides stay — for
a photo post the slides *are* the asset, and every URL expires.

## Photo posts are not a footnote

Read rule 10 before you touch this stage. A photo post has no video, TikTok hands you a
`video.url` for it anyway, and what is behind that URL is the sound. The largest post in
the reference corpus — 41.8M views — is a photo post, and so are several of the next
biggest. `slides.tsv` lists every one an account has, sorted by views. If an account's
best posts are slideshows, that is the finding, not an obstacle.

## Then actually look

Read every `notes.md` and open the contact sheets of the biggest post yourself. You are
about to write a teardown from these; a summary you have not checked is where invented
detail gets in.

Check each one against `index.tsv`: does the hook in `notes.md` match the hook the cover
showed? Where they disagree, the frames win — the cover is one moment, the video is all
of them.

## Finish

    scripts/state.py set <project> deepen done

Report: accounts deepened, posts pulled, how many were slideshows, and any download that
failed verification. Then run the `teardown` skill.
