---
name: atlas
description: Show the user what the research found. Starts the Atlas — an orb with one cluster per app, a page per app, account and post — on http://localhost:3210, and walks them through it by URL. Not a stage; run it whenever there is something new to look at.
---

# The Atlas

    scripts/atlas.sh            # rebuilds the index, serves http://localhost:3210
    scripts/atlas.sh --index    # rebuild the index only

The first run installs the Node dependencies and takes a minute or two; say so before
you start it. It needs Node 18+; if `node` is missing, say how to install it and stop.

## When to run it

- After `harvest` has finished for an app — the first moment there is something to see.
- After `deepen` and `teardown` — the videos, slides and the thirteen headings appear.
- Whenever the user asks what the research found. The Atlas is the answer; a list in
  the chat is not.

Start it in the background and wait for the "serving" line. It keeps running; re-index
with `--index` after any later scrape rather than restarting it.

## How to show it

Every view is a URL. Give the user the link, in this order, one at a time, and say what
they are looking at in one sentence each:

1. `http://localhost:3210/orb` — the sphere. One cluster per app; plate size is views.
   Drag to spin, click a plate to open that creator.
2. `http://localhost:3210/brand/<app>` — the app's front door: every account in its
   network in one carousel, the network totals, the teardown's thirteen headings.
3. `http://localhost:3210/account/<handle>` — one creator: the full post table, the
   cover grid, the hook bank.
4. `http://localhost:3210/post/<id>` — one post: the video or the slides, the verbatim
   on-screen text, the tags and the evidence for each.
5. `http://localhost:3210/thread/hook/<id>` — the same hook across every app studied.
6. `http://localhost:3210/map` — every URL that currently resolves, on one page.

The slideshow path's pages, the Organic Factory, read `apps/<slug>/` live:

7. `http://localhost:3210/` — the apps; `/app/<slug>` — the home base of one app: the
   canvas of the eight phases, what waits for whom, the read.
8. `/app/<slug>/niche` — the searches' spread and the scrolled batches (phase 4).
9. `/app/<slug>/strategy` — the account set and the app fit (phases 5 and 7).
10. `/app/<slug>/handles`, `/app/<slug>/handle/<handle>` — the identities and their
    steps (phase 6); the ticks and approvals are made here.
11. `/production/<slug>` — the studio, the board of the plan; `/app/<slug>/post/<date>-<short>-<n>`
    — one post: the deck, the candidates, the approvals, the send, the read (phase 8).

Say which page to open after each phase: the home base after `product`, the niche page
after `niche-search` and `niche-read`, the strategy page after `account-architecture`
and `app-fit`, the handle page during `handles`, the studio after `plan`, the post page
during production. `scripts/atlas.sh --index` rebuilds every index (the research, the
niche, the production); the handle pages and the log are read live.

The command bar at the top of every page takes an app name, an `@handle`, `hook: <name>`
or a post id. `/` focuses it.

## What it will not show

Only what is on disk. An account with no `HOOKS.md` has no hooks; a post with no cover has
no plate image and is drawn as text; an app with no `TEARDOWN.md` shows thirteen empty
headings. Say what is missing and which stage fills it — do not describe the Atlas as
complete when the index report says otherwise.

To put App Store facts on an app's page, write `research/<project>/<app>/app.json` with
`fullName`, `publisher` and an `appStore` object (`rating`, `ratingCount`, `revenue7d`,
`downloads7d`, `released`, `categories`, `source`, `checked`). Only with a source you can
name — the panel is evidence, not decoration.
