# Sync report — organic-factory → ugckit, 2026-10-09

No commits, no pushes, no branch change. Every organic-factory (OF) file changed here has a
backup `<file>.bak-2026-10-09-sync`.

## How the updater sees this

`install.sh` merges a managed file in three ways. The base is the version the last install
shipped, which `.ugckit-manifest` names by checksum. An appended "Iterative learnings"
section conflicts against the old 0.4.1 base (tested). So OF's manifest now points 21
entries at the new ugckit files. Each synced OF file is the ugckit file plus OF's own
additions. A simulated upgrade from a scratch clone with these changes committed gave:
1 MERGED (a later test edit), 11 KEPT, 9 SAME, 0 clashes.
**Condition:** commit the ugckit template files as they are now. If one changes before the
commit, the installer cannot find that base and writes `<file>.ugckit-new` for that file.
`AGENTS.md` and `CLAUDE.md` keep their old manifest entries; both repos got byte-identical
line edits there, which merge cleanly.

## ugckit (template/) — changed

- Skills: `deck`, `callout` (rewritten generic), new `slideshow-review`, `images`, `render`,
  `review`, `plan`, `product`, `app-fit`, `video-plan`. The learnings section of `deck`,
  `callout`, `images`, `review`, `plan` and `slideshow-review` ships empty, with the note
  on how agents add dated entries.
- New ability: `apps/<slug>/PRODUCT-SCREENS.md` (the format is in the `product` skill and
  `docs/product-screens.example.md`). The deck chooses the screen and writes its in-app
  text in a `The screen (in-app text)` or `The component (in-app text)` block. The user
  reviews that block with the deck. Production builds only that screen. Corrections go
  back into the file.
- `AGENTS.md`, `CLAUDE.md`, `apps/README.md`.
- Atlas: new `lib/callout.ts` and `lib/callout.test.ts` (11 tests); `Frame.tsx`,
  `Deck.tsx`, `LayoutEditor.tsx`, `lib/production.ts`, `app/production.css`,
  `scripts/build-production.mjs` (Composition spec), `scripts/render-slides.mjs`,
  `lib/handles.ts` (the plan-short fix of 10-08), `package.json`.
- Tests: Atlas `npm test` 127/127 pass (116 before); type check clean;
  `tests/video-planning` 20/20. `tests/character-bridge` fails at `composite.sh`
  (no numpy for the system python). It failed the same way before these changes.

## organic-factory — changed

- Skills `deck`, `callout`, `images`, `review`, `plan`, `slideshow-review`: the ugckit body
  plus OF's learnings entries, kept word for word. A dated entry holds the CatWise text
  that left the body: the build scripts, the chat bubbles, "Catwise AI app", the R1–R3 IDs.
  The stale "not resolved" note on `shownCards` now says the fix is done.
- `render`, `product`, `app-fit`, `video-plan`: copied from ugckit. For `app-fit` this also
  brings in a kit update that OF had not received yet.
- New `apps/catwise/PRODUCT-SCREENS.md`: 8 screens (Life Entry Detail, CatGPT Chat,
  Routine Task Cards, Home Screen, Dayprint, Health Record OCR, Environment Checklist,
  Care Plans), each with its `cat-os/app/lib` source, when it fits and when it does not,
  its uses from 6 to 11 October, and Rahul's corrections.
- `docs/product-screens.example.md`, `AGENTS.md`, `CLAUDE.md`, `apps/README.md`,
  `.ugckit-manifest`, `production/LEARNINGS-2026-10-08.md` (one row).
- Atlas: `lib/callout.ts` hides a `The component…` block; `scripts/render-slides.mjs` does
  not burn screen blocks. `npm test` 109/109 pass; type check clean.

## Left out as CatWise-specific

Photo realism (realism v3, `REAL-PHOTO-METHOD.md`, round pupils), the handle files, the
plan rows, the `callout-preview` N1 retirement, the CatWise screens and their names, the
D/C/I/P/R learnings entries, the chat-bubble callout (`--template chat`, CatWise colours),
`fit_straight.py` and the per-post compose scripts.

## Where the two repos still differ, and why

- `callout.ts`: OF still uses "Catwise" as its label default and keeps the CatGPT and life
  entry keyword fallbacks. ugckit names a screen only from `The screen: "<Name>"`.
- Older OF-only Atlas features, from before 8 October, are not ported: ink lettering on
  illustrated callouts, "(wide)" blocks, chat bubbles, `**Source slide:**`, the
  caption-only-quoted-lines rule, a style prefix per post, `card: "chat"`. OF keeps them
  as local changes.
- OF `atlas/package.json` does not list `video.test.ts` and `video-post.test.ts`; one OF
  video test fails. This was not changed, and its manifest entry was not moved.
- `AGENTS.md` and `CLAUDE.md` still differ (the earlier `AGENTS.md.ugckit-new`, OF's
  "Approval by word", the video-planning text). This was there before and is out of scope.
- Many other drifted files (the posting, niche and character code) were not touched.
