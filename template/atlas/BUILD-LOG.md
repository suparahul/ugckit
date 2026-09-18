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

## Left

- Phase 2: the home base with the stage tracker (`/app/<slug>`, `/app/new`).
- Phase 3: the canvas (`/app/<slug>/canvas`, `#phase-N`).
- Phase 4: Atlas (`/atlas`, orb + flat), niche, handles, handle, handle-new, studio, post, all posts.
- Phase 5: the stage states of every section page (not started · in progress · done).
- `install.sh`: scaffold `apps/README.md` once.
