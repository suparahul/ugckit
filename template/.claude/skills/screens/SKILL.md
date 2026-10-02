---
name: screens
description: The screen library of an app for character videos with app insertion — index the screen recordings and stills the user provides in apps/<slug>/screens/, describe each one with the user (the job, the events, the hero element), check them against the capture recipe and by OCR, and fill a phone segment's insert.json from its row. Free. Only for a plan with app_insertion true.
---

# The screen library

Every app pixel of a character video comes from `apps/<slug>/screens/`. **No UI pixel is
generated, and the app is never a reference**: the model draws a phone with a flat green
screen, or no phone at all, and the real app is put on it at P4. **The user provides the
recordings.** Who records them, on which phone and with which account is not the
pipeline's concern; this skill only checks and indexes what the user gives.

Only for a plan with `app_insertion` true. A plan without it has no screen stage.

## 1. Index

    scripts/character/screens.py index <slug>

It makes `apps/<slug>/screens/` when it is missing, adds every new recording (`.mp4`,
`.mov`) and still (`.png`, `.jpg`) to `screens.json`, measures the size, the length and the
frame rate, and writes `SCREENS.md` (the table people read and `shots.py check` uses). A
row the user has not described yet lists what is missing.

## 2. Describe each screen with the user

In `apps/<slug>/screens/screens.json` (the shape is `docs/character/screens.example.json`),
per row, from watching the recording with the user:

- `job`: the one job it shows. One recording, one job.
- `events`: each gesture, `{"t": <seconds>, "gesture": "tap" | "scroll" | "swipe",
  "region": "<where on the screen>", "label": "<what it does>"}`. They become the beats
  of `insert.json`.
- `hero`: the one thing the viewer must read: `text` exactly as the app shows it,
  `rect_source_px` `[x, y, w, h]` in the recording's own pixels, `t` the time it is on
  screen, and `needs`: `recognition`, `large type` or `body text`.
- `mode` (`light` or `dark`), `app_version`, `date`. A recording expires when the app's UI
  changes: set `"expired": true` and ask for a new one.
- For a finger shot (F): `stills.long` (a long screenshot, for a scroll) or `stills.start`
  and `stills.end` (for a swipe).
- `patches`: regions to cover, such as a notification banner, in source pixels.

**Content truth:** every string must be real app output, and the data must agree with the
script ("two months in" needs two months of history). No fake counts, no invented
reviews.

## 3. Check

    scripts/character/screens.py check <slug> [id ...]

The capture recipe, as checks: at most three gestures; a stable first frame held 0.5 s
before the first gesture; 0.4 s or more after each tap; the result held 1 s at the end;
the hero rect inside the source; and the hero string read by OCR in the source. A row
that fails is described again or recorded again. The recipe the user can follow, when
they ask how to record:

1. A demo account with real-looking, true data. Do Not Disturb on, full battery, no
   recording indicator, no personal data. One mode, light or dark, per app.
2. Record on the phone, native resolution, 60 fps if offered; also a still of each key
   state.
3. One recording, one job, at most three gestures. Hold 0.5 s first, pause 0.4 s after
   every tap, end on the result and hold 1 s. Slow, deliberate gestures on the real
   controls.
4. For a finger shot, the same gesture the plate will show (one scroll of about a third
   of the screen, one swipe, or one tap), at the speed of a finger; and the long
   screenshot or the start and end stills.

## 4. Choose the mode, and fill the insert

The mode follows what the viewer must do with the screen: **read** it → R (the default:
free and fully legible) or P; **recognise** the app with her face → S; **believe** she
uses it → G or O; with energy → H; see her use it → F. A G shot never carries something
that must be read: the hero element's need decides (body text means R, P or a large O).

For each phone segment (O, G, S, H, F) of the video:

    scripts/character/screens.py fill <slug> <screen-id> <video> <nn>-<type>

It writes the segment's `insert.json`: the mode, the source and its kind (`recording`; a
`still` for S; `finger-driven` for an F with a long screenshot or two stills), the beats
from the events, the hero element and its legibility tier, the track mode (`motion` for H
and F), the finger matte for F, motion blur for H, the default key, grade and gates. The
beats' `plate_t` is a first guess: P4 measures it again on the real plate.

R and P segments need no insert: `character-assemble` builds them from the row, with a
`screen_id` in `video.json`.
