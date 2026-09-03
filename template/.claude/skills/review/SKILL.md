---
name: review
description: Stage 7 — QC a generated video. Measures cuts, green-screen quality, spoken dialogue and pitch spread, then you look at the frames and give a verdict.
---

# Stage 7 — review

    scripts/qc.py <project> [video.mp4]

## What it measures

- **Cuts** detected vs the times the prompt asked for, with the error in ms.
- **Green screen**, if present: area, colour, within-frame flatness, frame-to-frame drift.
  Flatness is what keying cares about; a within-frame G std above ~10 means UI ghosting
  is baked into the green and will punch holes in the composite.
- **Dialogue transcribed back** for diffing against `prompt.txt`.
- **Pitch spread per 2-second window.** A window under ~5 semitones reads as monotone.
  This is how you locate a complaint like "it goes robotic after the third line" instead
  of guessing.

## Then look at the frames

**Open the contact sheet.** Measurements cannot catch:

- an object hallucinated into shot (a camera tripod is a recurring one),
- an animal that vanishes between shots,
- a hand swapping sides, or a prop changing hands,
- on-screen text the prompt excluded,
- framing that drifted from what was asked (over-the-shoulder becoming front-facing).

Pull extra frames at any moment you are unsure:

    ffmpeg -y -ss <t> -i <video> -frames:v 1 -vf scale=540:-2 /tmp/f.png

## Reporting

Give a verdict, not a description. State what worked with the number that proves it, and
what failed with the timestamp where it fails. If something is wrong, say which stage
owns the fix — almost always stage 5, the prompt.

Check `pipeline/state/feedback.jsonl` for open notes from the UI and address them.

    scripts/state.py set <project> review done
