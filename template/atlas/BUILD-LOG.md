# Build log — the Atlas end product in the ugckit template

The approved design: `organic-social/ugckit-port/03-ATLAS-END-PRODUCT/` (PLAN.md, DATA.md,
BUILD.md, the mocks) and `04-SYSTEM-DESIGN/` (the eight phases). Naming decided 2026-09-18:
the product is **Organic Factory**; **Atlas** is the research tab; the board is **the studio**;
the niche tab reads **Niche**; the word "brain" appears nowhere in the UI.

Branch: `atlas-end-product`. Nothing under `organic-social/` changed. A check against real data
runs the dev server with `ATLAS_ROOT=<a scratch workspace built from organic-social's files>`.

## Phase 1 — the shared shell (done 2026-09-18)

- `components/Shell.tsx`: the one chrome on every route — the wordmark "Organic *Factory*", the
  workspace picker (`.pbar__ws`, one row per app under `apps/`, "All workspaces"), the sections
  Home · Studio · Niche · Handles · Strategy · All posts · Atlas with the current one in ink. The
  research leaf pages (`/orb`, `/brand`, `/account`, `/post`, `/thread`, `/map`) keep the command
  bar, the corpus counter and the breadcrumb on a second row.
- `app/layout.tsx` loads the shared stylesheets: the reference's `paper.css`, `chrome.css`,
  `components.css`, `production.css`; the mocks' `endproduct.css` and `reporting.css`; and
  `factory.css` (the few rules this build adds).
- `lib/root.ts` (the workspace root, `ATLAS_ROOT` override, markdown helpers), `lib/ledger.ts`
  (`pipeline/state/pipeline.json`), `lib/apps.ts` (`apps/<slug>/APP.md`, `product.json`, the icon).
- `lib/canvas.ts`: the eight phases and their state, derived from files only (done · now · todo,
  plus "changed upstream" from mtimes). `lib/handles.ts`: `HANDLE.md`, the references, the six steps.
- `lib/production.ts` and `scripts/build-production.mjs` ported from the reference with the app
  slug threaded through: `apps/<slug>/production/{PLAN.md,decks/,log.jsonl,files/}` →
  `data/production-<slug>.json`; the plan's `App Store id:`, `Posting zone:`, `Home zone:`,
  `Posting service:` lines; the app-name checks from the `App:` line; the card text from
  `product.json` (no fallback strings); `posting.sent` / `posting.rescheduled` with the old
  `postbridge.*` names still read; the identity event kinds of DATA.md § 3.
- `lib/when.ts` zones come from the plan (default: the machine's zone). `lib/postbridge.ts`
  reads `POST_BRIDGE_API_KEY` from the workspace `.env` first, then `atlas/.env.local`.
- `app/media/[...path]/route.ts` also serves `apps/<slug>/icon.*`, `handles/*/references/`,
  `niche/covers/`, `niche/batches/`, and uses the guarded stream adapter.
- `/` lists the apps (one app redirects to its home base).

## Phase 2 — the home base (done 2026-09-18)

- `/app/<slug>` (`app/app/[slug]/page.tsx`): the head with the day's line, the tracker
  (`components/factory/Tracker.tsx`: the eight phases in one row, the one in progress named, the
  "Now" sentence, "Asked of you, in the conversation", the note that the order is a guide), the
  numbers card with its period and account filters, the posts waiting for you (Review buttons kept),
  the handles, the recent posts with their slides, the creators of the scrolled batch, one held post
  per researched app. Before a section has content it is a room (`Room` in `Bits.tsx`) that names
  the phase that fills it. No button proceeds a phase.
- `/app/new` when no app exists; `/` lists the apps and redirects when there is one.

## Phase 3 — the canvas (done 2026-09-18)

- `/app/<slug>/canvas` (`app/app/[slug]/canvas/page.tsx`): the eight phases as cards from
  `lib/canvas.ts` — the mark, the state word (done · in progress · not started · changed upstream ·
  waiting on you), the sentence, the facts, the page link, "The agent asked you for", and
  "What fills this phase" (You bring · The agent writes · The page shows) behind a fold. `#phase-N`
  anchors; the home base band opens the canvas at a phase.

## Phase 4 — the section pages (done 2026-09-18)

- The studio: the reference's production board ported per app (`/production/<slug>`, day · week ·
  month, grid · list), the post page (`/post/<key>`) with its idea, plan, final and Review.
- The handles list (`/app/<slug>/handles`) and the handle page (`/app/<slug>/handle/<handle>`):
  five steps (Role and name · Persona · References · Profile picture and bio · Defaults); the
  posting-service connection is one line, made at the first send, not a step.
- The niche page (`/app/<slug>/niche`): what wins (the tiles, the win rule — 50,000 views and
  saves per view at or above the median, worked out per request — the picks and checks in the
  URL), from your own scroll (the batch, every slide playable), the findings (the verdict, the
  notes, the post table with the day-7 rows of ours counted apart, the values, the accounts).
  `lib/findings.ts` reads `learnings.md`, `anatomy.md`, `architecture.md` as they are.
- The Atlas tab (`/atlas?app=<slug>`): the orb framed (`/orb?app=…&embed=1`; `embed=1` drops the
  chrome, `app=` scopes the sphere to the app's networks) and the flat view — one card per app,
  the handles explorer with its picks, sort and table.
- All posts (`/posts?app=<slug>`): Atlas · held, Atlas · not held, Our posts; the reference tile.
- The strategy page (`/app/<slug>/strategy`): the standing rule, the handles and their locks, the
  experiments with their days, the week day by day, the judgement rules, the day-7 read.
  `lib/plan.ts` reads PLAN.md, ACCOUNTS.md and APP-FIT.md live.
- The command bar knows the sections (`home`, `canvas`, `studio`, `niche`, `handles`, `strategy`,
  `posts`, `atlas`, `@handle identity`); the breadcrumb root is the Atlas tab.
- Day-7 rows: rows of the anatomy post table whose handle is one of the app's count as
  "N day-7 rows added" on the niche and production phases, and do not move the niche phase's
  time, so nothing downstream reads "changed upstream" from them.

## Phase 5 — the stage states (done 2026-09-18)

- One workspace per moment was built from the harness (the app read; apps 2 of 6 torn down; the
  niche searched, no batch; the niche read; handles in creation; the app fit written, no plan;
  production on day 3; the week read) and every section page walked at each: the state band
  (`StateBand.tsx`) and the rooms before a phase starts, the band over the real partial content
  while it runs, the page alone when it is done.
- Production is in progress until the week is read (a `## Day-7 read` in PLAN.md, or the plan's
  last day past): "Day N of 7", the posts posted, the posts waiting for a look. The strategy page
  carries a phase-5 band before `ACCOUNTS.md` exists and a phase-7 band after it. The Atlas head
  counts the apps torn down of the apps in the ledger.
- `build-niche.mjs` and `build-production.mjs` remove a built `data/*.json` whose source files are
  gone, so a page never counts what no longer exists.

## Notes for whoever runs this

- `npm run build` runs `npm run index` first, without `ATLAS_ROOT`; a check against a harness
  uses `npx next build` and `ATLAS_ROOT=<harness> npm run index`.
- The reference workspace has no `ACCOUNTS.md` and only one handle file in the new shape; the
  phase-5 and handle checks used fixtures in the scratch workspace.
- The strategy page before a plan exists shows the account architecture table and the app-fit
  counts — a little beyond the mock, because the canvas sends phase 5 to this page.
