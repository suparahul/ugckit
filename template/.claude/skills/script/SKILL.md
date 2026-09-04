---
name: script
description: Stage 5 — write prompt.txt (and insert.json for an app demo). The prompt is the product; almost every quality problem is fixed here rather than by regenerating.
---

# Stage 5 — script

Write `pipeline/05-prompt/<project>/prompt.txt`. **Under 5000 characters — count with
`wc -m`, not `wc -c`.** Em dashes are 3 bytes each, so byte count overcounts and will
reject a valid prompt.

## Choosing the flow

| The user wants | Create | Flow |
|---|---|---|
| a straight recreation | `prompt.txt` | simple |
| a real app/phone screen visible | `prompt.txt` + `insert.json` | complex |
| the model to imitate a supplied clip's style | `prompt.txt` + `refs.json` | referenced — read AGENTS.md rule 1 first |

**For an app demo, always use the green-screen + composite route.** Reference-to-video
cannot reproduce UI text: it returns a convincing pastiche with nonsense strings. This
has been tested. Do not offer it as an alternative for showing a real app.

## Structure that works

Sections, in this order, each a paragraph:

`opening look` · `STRUCTURE` (shot count, exact cut times) · `SUBJECT` · `SETTING` ·
`ANIMALS/PROPS` · one block per `SHOT` with second-by-second beats · `THE PHONE SCREEN`
if applicable · `PERFORMANCE` · `AUDIO` · `DIALOGUE` · `NO TEXT`.

## Things that measurably matter

- **Exact times, not adjectives.** "hard cut at exactly 5.0s" beats "then it cuts".
  Expect the model to land within ~50ms and check it in stage 7.
- **Per-line delivery direction.** A flat read comes from a flat prompt. Give each line
  its own note — which word lifts, where the beat falls, where it slows. Measured effect
  on one clip: the flattest 2-second window went from 4.26 to 10.09 semitones of pitch
  spread by adding delivery notes alone.
- **Anti-monotone language in PERFORMANCE:** "pitch, pace and volume change sentence to
  sentence and never settle into one flat repeating cadence. Audible breaths, a real
  pause between sentences."
- **Green screen spec, when compositing:** flat solid uniform chroma-key green,
  RGB 0 177 64, edge to edge, no app/icons/text/status bar/clock/wallpaper, no reflection
  or gradient, identical shade in every frame, and state that the phone body and hand
  look normal — only the screen is green.

- **The phone must be locked still.** This is the single biggest determinant of whether
  the composite looks real. Say it explicitly and at length:

      The phone is completely stable throughout the shot: held rigid in one position,
      filling the same part of the frame in every frame. It does not drift, rotate,
      tilt, sway, shift toward or away from camera, or get re-gripped. Her wrist and
      forearm stay locked. The camera holds still on it. The screen stays fully visible,
      square-on and unobstructed at its edges from the first frame to the last.

  Every degree the phone rotates and every pixel it drifts is a frame where the tracked
  quad moves, and the inserted app slides against the bezel. `review` measures this —
  a phone that wanders shows up as high area swing and centroid drift.

- **The thumb must map to the app recording, beat for beat.** The composite time-warps
  the recording onto the thumb, so an invented gesture has nothing to warp to. Write the
  thumb's actions from the recording, not from imagination:

  - Every tap and swipe in the prompt corresponds to a real event in the screen
    recording — same kind of gesture, in the same order.
  - Each one lands on **the part of the screen where that control actually is**. A tap on
    a bottom-row button must be in the lower third; a scroll must run up the middle.
  - Between events the thumb rests **completely still on the bezel**, off the screen — not
    hovering over it, not drifting.
  - Nothing extra. An unscripted gesture in the plate has no counterpart in the recording
    and will read as the app failing to respond.

  Watch the recording, list its events with timestamps, then write the thumb beats from
  that list and reuse the same list for `insert.json`.
- **NO TEXT section.** Models add captions unprompted. Exclude them explicitly, and
  exempt the app UI if there is one.
- **Continuity across cuts.** Say what stays constant — her voice, the lighting, which
  arm holds what. Models drop animals and swap hands between shots.

## insert.json

Copy the annotated example in `docs/insert.example.json`. The fields that matter:
`source` (the screen recording), `plate_window`, `key` (the chroma tolerances), and
`beats` — `app_t` is where an event sits in the recording, `plate_t` is where the prompt
asked the thumb to do it. After generating, **re-measure the thumb on the real plate and
correct `plate_t`**; the compositor piecewise time-warps the source so every beat lands
on the actual frame. That correction is what makes the timing look real despite model
drift.

## Before you hand off

    wc -m pipeline/05-prompt/<project>/prompt.txt
    scripts/state.py set <project> script done

Show the user the prompt and get agreement on the dialogue wording before generating.
If `ugckit ui` is not already running, start it in the background and give the user
http://127.0.0.1:7878 — the prompt is editable there, and the feedback box lands in
`pipeline/state/feedback.jsonl`, which you read at every stage.
Once approved, treat the words as frozen — change delivery direction, not wording, unless
they ask.
