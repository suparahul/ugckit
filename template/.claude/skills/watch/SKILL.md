---
name: watch
description: Stage 2 — send the trimmed segment to the Supagen watching-layer template (Gemini) and get back the six-section scene report. Costs about a cent.
---

# Stage 2 — watch

    scripts/watch.sh <project>

Uploads `pipeline/00-source/<project>/seg.mp4` and invokes the `video-watching-layer`
template. Writes `pipeline/02-watching/<project>/analysis.md`.

Runs for 30–60s. Cost is around $0.01 — cheap enough that you do not need approval, but
say what it cost.

## The six sections

1 verbatim transcript · 2 delivery · 3 shot list · 4 physical details · 5 audio ·
6 on-screen text.

## This is a second opinion, not truth

Where it disagrees with stage 1's measured cut list, **the measurement wins.** Say so
in your report rather than quietly picking one.

Two specific failure modes to check for:

- **Captions reported as speech.** If the reference has burned-in captions, a weaker
  model transcribes those instead of listening. The tell is a "sentence" whose
  timestamps span many seconds, or section 1 being identical to section 6. Cross-check
  against the stage 3 Whisper transcript, which is ground truth for what was said.
- **A slow push-in described as "static".**

## Finish

    scripts/state.py set <project> watch done

If the transcript looks caption-shaped, say so explicitly — it changes what stage 4
should trust.
