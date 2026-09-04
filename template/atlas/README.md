# The Atlas

A local web app that puts everything the research half scraped on one surface: an orb
with one cluster per app, a front door per app, a dossier per account, a page per post,
and threads that pull the same hook or mechanic across every app you studied.

    ./ugckit atlas            # installs on first run, rebuilds the index, serves http://localhost:3210
    ./ugckit atlas --index    # rebuild the index only

Do not run it by hand from this folder unless you know why; `ugckit atlas` does the
same thing and checks Node first.

## The one thing to know

**`../research` is the source of truth and is read in place.** Nothing is copied. Covers,
videos and slides stream straight out of `research/<project>/<app>/<handle>/` through
`app/media/[...path]/route.ts`. The index (`data/index.json`, `public/search.json`) needs a
re-run to *know* about new files — `./ugckit atlas` always re-runs it.

The app ledger in `pipeline/state/pipeline.json` supplies the names, the niche, and which
handles are an app's own. An optional `research/<project>/<app>/app.json` adds App Store
facts (`fullName`, `publisher`, `appStore.{rating,ratingCount,revenue7d,downloads7d,...}`)
when the teardown found them; the panel is hidden when the file is absent.

## The spine

Within one account there is a single primary key — **rank N, newest-first** — and it is
the same N in `posts.json` (sorted by `uploadedAt` desc), `index.tsv` (column 1),
`HOOKS.md` (table column 1) and `covers/NNN.jpg`. `HOOKS.md`'s views column is a checksum:
a row that disagrees with the post at that rank is dropped rather than joined.

Partial state is normal. Every view renders what exists and says what is missing.

## Routes

| route | |
|---|---|
| `/orb` · `/orb?cluster=<app>` | the sphere; a cluster is a linkable state |
| `/brand/<app>` | the app's front door: the network, the totals, the teardown |
| `/account/<handle>` | the dossier |
| `/post/<id>` | the leaf: the video or the slides, the verbatim hook, the tags |
| `/thread/<dimension>/<value>` | everything carrying one tag, across all apps |
| `/map` | every live URL in the app, on one page |

The command bar at the top takes an app name, an `@handle`, `hook: <name>`, a post id,
`orb` or `map`, and `open @handle` to open the real TikTok page. `/` focuses it.

## Honesty

Every tag is a quotation, not an assertion. Format, disclosure, sound and cadence are
exact. Hook classification is heuristic — rules in `data/hook-rules.json` — and every
tagged post shows the exact phrase that matched; anything unmatched stays `unclassified`.
Handle conventions and the @-tag mechanic are derived from the ledger and the handles at
index time, never hand-listed.

## Lineage

Lifted from the organic-social Atlas. The ThreeUI sources under `src/shaders/` are kept
verbatim; `lib/orb-source.ts` adapts them (portrait covers, a clustered position solver,
a re-light for cream paper). The session-specific pages of the original — the
fundamentals cluster, the concept pages, the step path and the close template — are not
here: this Atlas shows your research and nothing else.
