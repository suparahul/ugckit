---
name: character-motion
description: P2 of the character pipeline for a motion-designed app screen — an R or P segment whose beats have demo_source motion_design. Rebuild the app's real screens in HTML and CSS from PRODUCT-SCREENS.md and the app's own code and in-app text, animate the plan's screen story (taps, scrolls, the result appearing), render it locally at 1080x1920, run the gates, and show the user the render for gate B. Free, local; never a video model, never an invented screen or word.
---

# P2 — a motion-designed app screen

    scripts/character/motion_design.py start  <video> <nn>-<r|p>
    scripts/character/motion_design.py render <video> <nn>-<r|p>
    scripts/character/motion_design.py check  <video> <nn>-<r|p>
    scripts/character/review.py motion <video> <nn>-<r|p> --decision approve|reject --words "<the user's words>"

The third source of the app demo (founder, 2026-10-19), after a real screen recording and a
real still of the screen library. It needs no recording, which is the least effort for the
user, but it fills the frame and looks more like a promotion than a hand holding a phone. So
the plan chose it, and said why, only where no real recording shows the screen
(`demo_source_reason`, `video-plan` and `video-script`). This skill never chooses it: it
builds what the locked plan says.

**The method of the first two motion-designed posts** (organic-factory, 2026-10-14: the
Catwise reveal flow of `latte-3` and `hannah-3`, `apps/catwise/production/files/2026-10-14-*/demo/`):
one HTML page that rebuilds the app's real screens from the app's own source code (the
Flutter widgets of the reveal flow), in the app's logical points, colours, fonts and icons;
every movement computed from one clock (`window.seek(ms)`); recorded frame by frame by a
headless Chromium and encoded by ffmpeg. Those two demos were then joined to the reaction
by hand, outside the pipeline; the kit now makes the same render a segment of the video.

## Rules

- **Only the app's real screens.** Rebuild each screen the story names from its section of
  `apps/<slug>/PRODUCT-SCREENS.md` (its **Shows**, **Source**, **In-app text** and
  **Corrections** lines), the app's code (`rebuilt_from`), and its App Store screenshots or
  other real screenshots. The layout, the sizes, the colours, the fonts and the icons are the
  app's. Never a screen, a button or a state the app does not have.
- **Only the story's words.** Every visible string is one of the story's `shows` strings for
  that step, word for word: no invented label, no button text, no marketing line, no price.
  `check` reads the page's text at every step and refuses any other line (the status bar's
  clock is the phone's, not the app's).
- **Never a model's picture.** No video model, no image model, no keyframe, no frame of a
  generated take inside the screen. A picture inside the app (the owner's clip, a pet's
  photo) is a plan asset (`plan:<id>`, the user's own file) or a fixed subject's approved
  picture (`world:<id>`); fonts, icons and the app's own pictures are `app:<path>`. Each
  file in `assets/` has its line in `assets.json`.
- **Only local files.** No web font, no CDN, no remote picture. The renderer blocks every
  request that is not a local file and `check` refuses the render.
- **The story is the plan's.** `story.json` is copied from the locked plan; it is never
  edited here. A wrong story is a plan change (`video-script`, a new revision, `video-lock`).

## 1. Start

`motion_design.py start <video> <seg>` makes `segments/<seg>/motion/`: `story.json` from
the plan (the screens, what they are rebuilt from, the steps in seconds from the segment's
start, the fit, the hero string), the page template `index.html`
(`docs/character/motion-design.example.html`), `assets/` and `assets.json`. It prints what
to rebuild.

## 2. Write the page

Read the PRODUCT-SCREENS.md sections and the code paths the story names. Then rewrite
`index.html`:

- `window.SCREEN_PT = [w, h]`: the phone's logical size in points (the app's design size;
  393x852 for a 6.1-inch iPhone); `html` and `body` are exactly that size.
- `window.seek(ms)` draws the frame at `ms` and is the only thing that moves the page: no
  CSS transitions, no timers while `?record=1`. `window.DURATION` is the length in ms.
- One timeline line per story step, at its `at_s`: the screen appears, the thumb's dot
  comes in and the button presses (a tap), the list moves (a scroll), the card is thrown
  (a swipe), the text types, the result comes in. Use the app's own animation curves and
  durations where its code has them (the posts copied the app's entrance curve, its card
  landing and its word fade, and shortened the pauses to fit).
- The element that holds the hero string has `data-hero`.
- Copy the app's fonts and icons into `assets/` and list each in `assets.json`.

Open `index.html` in a browser to watch it loop; it plays itself without `?record=1`.

## 3. Render

`motion_design.py render <video> <seg>` writes `motion/render.mp4` (1080x1920, 30 fps, the
story's length, no sound), one still at the end of each step (`motion/stills/`) and
`render.json` (the page's, the assets' and the story's sha256). Fit `pad` (the default)
keeps the whole phone screen at the frame's height, the sides in the page's own background
colour, as the two posts were; `crop` fills the width and crops the height around the hero.

The renderer needs `playwright-core` (`npx -y playwright-core --version` once puts it in
the npx cache; or `PLAYWRIGHT_CORE=<its folder>`) and Google Chrome or Chromium (or
`CHROME=<executable>`). Free.

## 4. Check

`motion_design.py check <video> <seg>` runs the gates into `motion/gates.json`: the render
is current, its format, only local files, the assets' origins, every line of text in the
story, OCR of each step's strings on its still, the hero string on the `data-hero` element,
and no page error. Fix the page and render again until no gate fails. With no OCR engine,
`text_read` and `hero` are NOT RUN: the user reads the stills.

## 5. Gate B

Show the user the render and its stills, beside the story's steps (the Atlas shows all of
it at stage 5; `motion.approve` and `motion.reject` are their clicks). Record their words:

    review.py motion <video> <seg> --decision approve --words "<their words>" [--check text=pass --check hero=pass]

or `--from-atlas`. The approval is of this render's sha256; a new render needs a new
approval. A reject says what to change: change the page (never the story) and render again.
Assembly (`character-assemble`) lays the approved render in as it is, with the P bubble when
the segment is P.
