---
name: character-assemble
description: P5 of the character pipeline — one finished 1080x1920 file from video.json: trim each segment, upscale once, join with hard cuts, level the sound, lay the room tone, build the R and P segments from the screen library, burn the captions from the frozen script, run the export pass, and check the final file (OCR of every hero element, no green left). Local ffmpeg, free.
---

# P5 — assemble

    scripts/character/assemble.sh <video> [--grain] [--no-captions]

Input: `pipeline/character/<video>/video.json` (written at P1 from the plan). Every
generated segment must be approved at gate B, and every phone segment's composite
recorded at P4; the script stops before any encode when one is not. Output:
`assembly/<video>.mp4`, `assembly/assembly.json` (the timeline, the captions, the checks)
and `assembly/contact-sheet.png`. Nothing is posted: the pipeline ends at the finished
file.

## What it does, in order

1. **Trim.** A talking segment runs from 0.15 s before its first word to 0.2 s after its
   last, by faster-whisper word times. Otherwise the segment's `trim` in `video.json`
   (`[in, out]` in seconds), or the shot's `trim_to_seconds`.
2. **Upscale once**, lanczos, to 1080x1920 (a composite is already there). No AI upscaler,
   no sharpening.
3. **R**: the recording cropped to 9:16 around the hero element, a slow punch-in to
   `punch_in_to_hero` (1.25), a 0.3 px blur. **P**: the same base with her demo
   performance in a round bubble, 28% of the width, in the top corner away from the hero
   element; its audio is not trimmed (her lips are visible).
4. **Sound.** `audio_from` (`<video>.<seg>`) lays another approved segment's voice under a
   segment: the demo performance under R, P, H or F. One loudness for all segments
   (-16 LUFS), a 30 ms fade at each join, hard cuts only, and the room tone
   (`sound.room_tone`) looped under everything. No music.
5. **`punch_in`** (about 1.10) where two talking segments meet.
6. **Captions**, spelled from the frozen script and timed by the word times, 3 to 6 words
   each, in the house style of the slides (Helvetica Neue Bold, white, a black outline, no
   box), above the lower 18% of the frame, and moved to the top when the hero element
   is in the caption band. Drawn by `scripts/character/captions.mjs` with the Atlas's
   renderer (`scripts/atlas.sh --index` once, if it is not installed).
7. **The title overlay**, only when `title_overlay.burn` is true.
8. **The export pass**: one phone-like intermediate encode, then the final 1080x1920,
   30 fps, H.264. Never 4K. No added grain by default. On the first real use case, run
   with `--grain`: it also writes `<video>-grain.mp4` with 2 to 3% grain, from the same
   segments, for the grain test; the user compares the two at gate C.

## The checks after the pass

The size, the frame rate and the codec; the sound track; the loudness; **the OCR of every
hero element on the final file** (and on the grain file); no green left in the phone
segments. A FAIL marks P5 failed.

Then **look**: the contact sheet, and the file at full size, at every join. The final
checklist, for gate C: the face holds across every segment; the outfit and the set hold;
the voice and the room agree across every join; no join inside a sentence; the app's
strings are real and readable where they must be; the captions match the frozen script
and the house style.

The next stage is `character-deliver` (gate C).
