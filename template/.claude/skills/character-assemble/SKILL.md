---
name: character-assemble
description: P5 of the character pipeline — one finished 1080x1920 file from video.json: trim each segment, upscale once, join with hard cuts, level the sound, lay the room tone, build the R and P segments from the screen library, the supplied C segments and the M panels, lay narration, burn the captions from the frozen script and the plan's timed overlays, run the export pass, and check the final file (OCR of every hero element and overlay, no green left, overlays as planned and clear). Local ffmpeg, free.
---

# P5 — assemble

    scripts/character/assemble.sh <video> [--grain] [--no-captions]

Input: `pipeline/character/<video>/video.json` (written at P1 from the plan). Every
generated segment must be approved at gate B, every phone segment's composite recorded
at P4, every supplied file approved at gate B with the checksum the plan pins, and every
narration take approved; the script stops before any encode when one is not, and when
`video.json` was written from another revision of a v2 plan. Output:
`assembly/<video>.mp4`, `assembly/assembly.json` (the timeline, the captions, the checks)
and `assembly/contact-sheet.png`. Nothing is posted: the pipeline ends at the finished
file.

## What it does, in order

1. **Trim.** A talking segment runs from 0.15 s before its first word to 0.2 s after its
   last, by faster-whisper word times. Otherwise the segment's `trim` in `video.json`
   (`[in, out]` in seconds), or the shot's `trim_to_seconds`.
2. **Upscale once**, lanczos, to 1080x1920 (a composite is already there). No AI upscaler,
   no sharpening.
3. **R**: the recording from its `trim` in point, cropped to 9:16 around the hero
   element, a slow punch-in to `punch_in_to_hero` (1.25), a 0.3 px blur. **P**: the same
   base with her demo performance in a round bubble, 28% of the width, in the top corner
   away from the hero element; its audio is not trimmed (her lips are visible).
   **C**: the supplied clip cut to `source_range_s` (a still held for `still_s`), scaled
   to cover 9:16 (`fit: pad` keeps the whole picture on black); a filmed phone uses its
   approved composite. **B**: the approved generation, like T, silent. **M**: each panel
   (a supplied asset, an approved B, or a screen recording) cut to its range, scaled into
   its `rect`, started `sync_offset_s` late and held on its last frame, on black; a
   screen panel's hero element is found and read by OCR like R's.
4. **Sound.** `audio_from` lays a voice under a segment: `<video>.<seg>`, another
   approved segment's voice (the demo performance under R, P, H, F, B or C);
   `asset:<id>`, a supplied voice or sound in its approved range (`audio_range_s`);
   `narration:<take>`, a narrator's approved take. A take longer than the picture of a B,
   C or M segment stops the assembly: the plan's timing is never stretched. A C clip
   keeps its own sound unless `audio` is `mute`; an M segment plays the panel marked
   `"audio": true`. One loudness for all segments
   (-16 LUFS), a 30 ms fade at each join, hard cuts only, and the room tone
   (`sound.room_tone`) looped under everything. No music.
5. **`punch_in`** (about 1.10) where two talking segments meet.
6. **Captions**, spelled from the frozen script and timed by the word times, 3 to 6 words
   each, in the house style of the slides (Helvetica Neue Bold, white, a black outline, no
   box), above the lower 18% of the frame, and moved to the top when the hero element
   is in the caption band. Drawn by `scripts/character/captions.mjs` with the Atlas's
   renderer (`scripts/atlas.sh --index` once, if it is not installed).
7. **The overlays.** A v2 video draws the plan's `overlays` (copied into `video.json`)
   at their exact times, in the style of their role: hook, paragraph, step label,
   comparison label (on its panel), day counter, source credit; placed `top`, `middle`,
   `upper_left`, `upper_right` or on a `panel`, never in the caption band. A legacy
   video draws `title_overlay` as one hook overlay, only when `burn` is true.
8. **The export pass**: one phone-like intermediate encode, then the final 1080x1920,
   30 fps, H.264. Never 4K. No added grain by default. On the first real use case, run
   with `--grain`: it also writes `<video>-grain.mp4` with 2 to 3% grain, from the same
   segments, for the grain test; the user compares the two at gate C.

## The checks after the pass

The size, the frame rate and the codec; the sound track; the loudness; **the OCR of every
hero element on the final file** (and on the grain file); no green left in the phone
segments. With overlays: **as planned** (the plan's, exactly), **readable** (up for
words / 3 s, 1 s at least, not cut by the end of the file), **clear** of every hero
element, every caption and each other, and **read back** by OCR on the final file. With
supplied media: the files still match the plan's sha256. A FAIL marks P5 failed, and
gate C refuses an approval while an overlay or supplied-file check fails.

Then **look**: the contact sheet, and the file at full size, at every join. The final
checklist, for gate C: the face holds across every segment; the outfit and the set hold;
the voice and the room agree across every join; no join inside a sentence; the app's
strings are real and readable where they must be; the captions match the frozen script
and the house style; each overlay says the plan's words at the plan's time; each panel
shows its source; a live demonstration shows the real input and its real result in step.

The next stage is `character-deliver` (gate C).
