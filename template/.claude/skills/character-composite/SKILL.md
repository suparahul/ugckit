---
name: character-composite
description: P4 of the character pipeline — put the real app on the green phone of an approved plate (O, G, S, H, F) at 1080x1920, then run the insertion gates (no green left, the corner sheet, OCR of the hero element, and for F the finger occlusion and the UI sync) and record the composite with the user's word. Local, free. Skipped when the plan's app_insertion is false.
---

# P4 — the app on the phone

    scripts/character/composite.sh <video> <nn>-<type> [plate.mp4]

**Only for a plan with `app_insertion` true**, for each phone segment (O, G, S, H, F)
whose plate is approved at gate B (`character-review`), and for a C segment whose
supplied clip films a phone (`insert` in `video.json`): its plate is
`segments/<nn>-c/source/plate.mp4` (`shots.py supplied`), and it passes the gates of its
insert mode (in-hand as G, show-to-camera as S, finger as F...), the flat-on gate first,
unchanged. A real recording that fails them is filmed again. A plan without app insertion has
no P4 (`state.py` shows it as n/a). R and P are not composited; `character-assemble`
builds them. Local OpenCV and ffmpeg, so iterate freely.

## How it works

For every frame it finds the green quad, warps the real app into it and composites
through the green key, so what is not green over the screen (a thumb, a finger) stays in
front. The plate is first **upscaled once to 1080x1920** (lanczos), and the app is warped
into the upscaled quad, so the UI is rendered at full sharpness and then softened to match
the plate by `grade`. The source is scaled to twice the widest quad. The track of each
composite is kept in `composite/work/<stamp>/` for the gates and for assembly.

## 1. Fill the insert

`insert.json` comes from the screen row (`screens` skill: `screens.py fill`). Check:

- **`source_kind`**: `recording` (time-warped through the beats), `still` (one
  screenshot: the S mode and rung 1 of the gesture ladder), or `finger-driven` (F: the
  long screenshot moved by the fingertip for a scroll; two stills for a swipe).
- **`track.mode`**: `per-frame` (the default), `locked` (one median quad, used only when
  the phone drifts under 2% of its width and the bezel does not morph; it refuses
  otherwise and says why), `motion` (H and F: a short median and smoother, the area
  judged against the neighbouring frames, a lost fit predicted from the last frames, and
  green regions joined when a finger splits the screen).
- **F:** `occlusion.dark_exception` "notch zone and edge band only": a dark pixel is
  screen only in the notch zone and a thin band along the edges, so a finger in shadow, a
  darker skin tone or a dark nail stays in front; the despill covers the whole finger.
- **H:** `motion_blur.on`: the app is blurred along its own movement, half the movement
  per frame, so a sharp screen does not sit in a blurred phone.

## 2. Measure the beats on the real plate

The model does not cut or tap where the prompt asked. Watch the plate and correct
`plate_t` of each beat to the frame where the thumb really taps or scrolls; leave `app_t`
alone (it is where the event sits in the recording). For F, the fingertip tracker finds
contact and release itself and prints them; confirm them on the finger sheet, or set
`finger.contact_frame` and `finger.release_frame`.

## 3. Propose the grade

    scripts/character/composite.sh <video> <nn>-<type> --propose-grade

It measures the plate in a ring just outside the screen (sharpness, noise, black level)
and the app warped into the quad, and proposes `grade`: the blur that brings the app's
sharpness to the plate's, the plate's noise, a black lift. It is a proposal: put it in
`insert.json` and confirm it by eye on the corner sheet. In order of effect: sharpness
(never sharper than the plate), brightness and black level, noise, the glass sheen at 3
to 8%, no green spill.

## 4. Run it and read the gates

The composite writes `segments/<seg>/composite/<seg>-composite-<stamp>.mp4`, then runs:

    scripts/character/qc.py <video> <nn>-<type> --composite [file]

- **no green left**: no pixel of the plate's green left near the screen;
- **the corner sheet** (`composite/qc/corner-sheet.png`): the four corners at four times
  (for F one at contact; for H on the holds and mid-push). Look for a gap, an overflow,
  or a corner that is not round;
- **OCR of the hero element**: the string in `SCREENS.md` read on the composite (on the
  end hold for H, on the final state for F);
- **screen width** against the hero element's need;
- F: **no app pixel on the finger** and **no green on it** (measured against the plate),
  the **finger sheet** at contact, mid-gesture and release, plate beside composite, and
  **UI sync**: a tap within 2 frames of contact; scrolled content within 5% of the screen
  height of the fingertip.

The tap alignment of a recording on O, G and S is checked by eye: each tap lands within
2 frames of the thumb.

## 5. If it fails

| What you see | Cause | Fix |
|---|---|---|
| the app slides against the bezel | the phone moved | P1: a firmer stability paragraph; regenerate; do not smooth harder |
| holes or ghosts in the insert | the green is not flat | P1: restate the green spec; regenerate |
| the app does not respond to a tap | a gesture the recording does not have | P1, or a lower rung of the gesture ladder |
| the screen in perspective or tilted | not flat-on | P1: redo the keyframe; never corrected here |
| the screen looks pasted | too sharp, too clean | the grade, in the order of step 3 |
| a green edge | the quad fitted inside the real edge | widen `key.hue_tol`; check the corner sheet |
| the start of a push has no app | the small start frames were dropped | `track.mode` `motion` |
| the app lags the phone in a push | too much smoothing | `track.mode` `motion` |
| a sharp screen in a blurred phone | no motion blur | `motion_blur.on` |
| the app painted over the finger | the finger is darker than `dark_max` | the F occlusion (step 1) |
| the content slides under the finger | the recording's scroll speed differs | `finger-driven`, or record the gesture slower |

## 6. Record the composite

Show the user the composite and the sheets, then:

    scripts/character/review.py composite <video> <nn>-<type> --file composite/<file>.mp4 \
        --words "<the user's words>"

Assembly uses this file. When every phone segment of the video has one, P4 is done.
