---
name: niche-fetch
description: Phase 4, the fetch — everything the user brought in one batch, pulled through Monid: the posts' slides or video, the stats, the comments, the profiles of the handles; screenshots matched to posts by caption. About $0.03 for ten posts. Says the figure first.
---

# Phase 4 — the fetch (niche-fetch)

    scripts/niche-fetch.sh <slug> <date> --plan     what would be fetched, and the cost; spends nothing
    scripts/niche-fetch.sh <slug> <date>            fetch

`<date>` is the batch folder `niche-hunt` wrote, `apps/<slug>/niche/batches/<date>/`.

## Screenshots first

The script cannot read a picture; you can. Before the plan, open every screenshot the
user brought (`batches/<date>/screenshots/`) and read the handle and the caption on it.
Edit the screenshot's row in `LINKS.md` so its note starts with the handle and quotes
the caption: `@mias.diary7 "how to stop your cat waking you at 5am"`. The fetch pulls
that profile (30 posts) and matches the caption to one of its posts by word overlap.
A screenshot with no handle visible stays evidence only: say so in the batch read, and
leave the row as it is.

## Then the plan, the figure, the yes

Run `--plan`. It prints how many posts, profiles and screenshots it found, which short
links it will resolve, and the computed cost:

- a post: $0.00045 (one apidojo call with every post url in `startUrls`)
- a handle or a screenshot's handle: the profile, 30 posts, $0.0135
- the comments: $0.0015 a post (TikHub `fetch_video_comments`, 20 comments)
- the slides, the videos, the contact sheets and the transcripts: free

Ten posts and one profile: about $0.03. Say the figure and wait for the yes. Then run
it in the background; it is serial (rule 13) and resumable (a file that exists and
parses is reused).

## What it writes, under `batches/<date>/`

`resolved.tsv` (short link → full url), `posts.raw.json`, `<handle>.profile.raw.json`,
and per post `<handle>/<postId>/`: `post.json`, `comments.json`, `slide-NN.jpg` for a
slideshow (every slide, verified as a real image), or `video.mp4` (ffprobed, rule 14)
with `sheet-N.jpg` contact sheets at 1 fps and `transcript.txt` from the local Whisper
(the `deepen` and `transcribe` methods, free) for a video. From a profile it reads the
top three posts by views; from a link, that post.

## What can go wrong, and what to say

- **A short link does not resolve.** TikTok is blocked from some networks; the script
  tries `curl -sIL`, then unshorten.me (free, ten a day). A link it could not resolve
  is printed by name; ask the user for the full link (long-press → copy link on the
  post page shows the `/photo/<id>` form) and run again.
- **No slides downloaded.** The urls expired or the CDN host is blocked (rule 12): a
  VPN or another network, then the same command, soon.
- **A screenshot matched nothing.** Said by file name; it stays evidence only.
- **The comments endpoint answered with an error.** The post is still read from its
  slides; say the comment read is missing for it.

## Finish

Report: posts read (slideshows, videos), profiles pulled, screenshots matched or not,
slides on disk, links that did not resolve, the computed spend. Then run the
`niche-read` skill.
