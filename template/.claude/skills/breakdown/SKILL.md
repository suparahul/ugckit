---
name: breakdown
description: Stage 4 — reconcile the measurements, the watching report and the transcript into one shot-by-shot spec. No tools, pure synthesis. This is where disagreements get resolved.
---

# Stage 4 — breakdown

No script. You write `pipeline/04-breakdown/<project>/breakdown.md` yourself from three
sources that will not fully agree.

## Precedence when they conflict

1. **Measured frames win** — the stage 1 cut list, contact sheets and manifest.
2. **Whisper wins on what was said** — stage 3, not the watching layer.
3. **The watching layer wins on description** — wardrobe, room, lighting, what a hand is
   doing. That is what it is for.

Never resolve a conflict silently. Write down that they disagreed and which you took.

## What the document must contain

- **Structure:** every shot with exact in/out times from the measured cuts, and the
  framing of each.
- **Subject:** appearance, wardrobe, what each hand is doing, where they are looking.
- **Setting:** the room, named objects and their positions, lighting direction, colour.
- **Dialogue:** verbatim, with the pause and pace numbers attached.
- **Audio:** mic, room tone, music, effects.
- **On-screen text:** inventoried so it can be EXCLUDED. Flag separately any text that is
  physically in the scene (a product label, a screen being filmed) — that is handled
  differently from an overlay.
- **What to change:** the user's tweaks — new script, different character, an app insert.

## Ask before you finish

Confirm with the user: the segment, the tweaks, and whether they want an app/phone
insert. The answer decides the flow in stage 5.

    scripts/state.py set <project> breakdown done
