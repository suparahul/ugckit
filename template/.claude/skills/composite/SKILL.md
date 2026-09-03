---
name: composite
description: Stage 8 — composite a real screen recording onto the green-screened phone in the generated plate. Complex flow only. Local, no cost.
---

# Stage 8 — composite

    scripts/composite.sh <project> [plate.mp4]

Only for the complex flow (`insert.json` present). Local OpenCV, no API cost, so iterate
freely.

## How it works, and why

For every frame it finds the green quad, warps the screen recording into it, and
composites **through the green mask itself**. That last part is the whole reason for
green-screening rather than pasting a warped rectangle on top: anything not-green sitting
over the screen — a thumb — stays in front. You get real occlusion for free.

## Fix the beats before you run it

`plate_window` in `insert.json` is advisory. The model does not cut exactly where the
prompt asked, so:

1. Find where the green actually exists in the plate (`qc.py` reports the frames).
2. Watch the plate and note when the thumb **actually** taps and swipes.
3. Update `plate_t` for each beat to the real frame time. Leave `app_t` alone — that is
   where the event sits in the recording.

The compositor piecewise time-warps between beats, so every tap lands on the real thumb
frame. Skipping this is what makes an insert look pasted on.

## If the insert slides or swims

Almost always the plate, not the settings. Check in this order:

1. **Did the phone stay still?** `qc.py` reports green-area swing and centroid drift. A
   phone that rotates or drifts makes the quad move and no amount of smoothing fixes it —
   the app will slide against the bezel. Regenerate with a firmer stability instruction
   in the prompt (see the `script` skill) rather than trying to rescue it here.
2. **Do the thumb's gestures match the recording?** If the plate has a tap the recording
   does not, there is nothing to warp onto it and the app will look unresponsive at that
   moment. That is a stage 5 fix too.
3. Only then tune the settings below.

## Tuning

- **`key`** — widen `hue_tol` if the edges of the screen are not keying; raise `sat_min`
  if parts of the room key by mistake.
- **`smooth`** — Savitzky-Golay window on the quad. **Keep it small.** The generated phone
  morphs frame to frame and the app must deform with the bezel; over-smoothing makes the
  screen slide against the phone.
- **`grade`** — blur, contrast, reflection and noise to sit the insert in the plate. A
  perfectly clean screen in a phone-camera plate reads as fake.
- **`patches`** — cover regions of the recording that should not appear, like a
  notification banner.

## Finish

Review the result the same way as stage 7 — look at it, at full size, at the seams.

    scripts/state.py set <project> composite done
