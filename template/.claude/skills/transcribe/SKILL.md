---
name: transcribe
description: Stage 3 — local Whisper transcript plus prosody measurements (pace, pauses, fillers). Runs offline, costs nothing, and is the ground truth for what was actually said.
---

# Stage 3 — transcribe

    scripts/transcribe.sh <project> [model]

Local faster-whisper. No API, no cost. Default model `base.en`; pass `small.en` or
`medium.en` for a harder accent.

## Two passes, on purpose

1. **VAD on** → clean verbatim transcript with timestamps.
2. **VAD off + word timestamps** → the pauses, breaths and hesitations pass 1 strips.

Pass 2 is what makes a prompt actionable. "Moderate pace" tells a generation model
nothing; **229 wpm overall / 244 articulation / 6% silence / longest pause 0.5s** tells it
exactly what to hit.

## Outputs

    pipeline/03-verbatim/<project>/transcript.txt / .json
    pipeline/03-verbatim/<project>/prosody.txt / .json

## Read it critically

- Whisper mishears brand names and homophones. Cross-check odd words against the contact
  sheets and the stage 2 report before quoting them.
- The filler list is a wordlist match — "like" and "so" are usually real words, not
  hesitations. Read them in context before reporting a count.
- A run of repeated words all stamped at the same instant at the end is a known Whisper
  hallucination; the script drops zero-duration tokens and tells you how many.

## Finish

    scripts/state.py set <project> transcribe done

Report the wpm figures and the pause list — stage 5 needs both.
