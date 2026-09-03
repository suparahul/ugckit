---
name: ingest
description: Stage 1 — trim the reference video to the segment being recreated, then measure it objectively (cuts, contact sheets, motion, audio). Runs locally with ffmpeg; costs nothing.
---

# Stage 1 — ingest

    scripts/ingest.sh <input-video> <project> [start-seconds] [length-seconds]

Everything here is local ffmpeg. No API calls, no cost. Run it as many times as you like.

## Before you run it

Ask the user which **segment** they are recreating if the source is longer than about
30 seconds. Recreating a 3-minute video is not a thing any current model can do; the
unit of work is one continuous scene, typically 10–30s.

Check the real duration first — do not assume:

    ffprobe -v error -show_entries format=duration -of csv=p=0 <input>

## What it produces

    pipeline/00-source/<project>/seg.mp4        the trimmed segment; everything downstream describes THIS
    pipeline/01-objective/<project>/
      scene-scores.tsv                          every candidate cut with its score
      cuts-hard.txt / cuts-probable.txt / cuts-candidate.txt
      sheets/sheet_NN.png                       contact sheets
      motion-yavg.txt                           motion energy
      manifest.json                             the numbers every later stage reads
    pipeline/03-verbatim/<project>/seg.wav      audio for the transcribe stage

## Then actually look

**Open every contact sheet and verify every cut, candidates included.** A splice between
two takes of the same setup barely moves the histogram and can score under 0.08 — a
single >0.30 threshold reports zero cuts on same-room UGC, which is why the script scores
three bands instead. The measured cut list beats any model's opinion later.

Read timestamps off a sheet with the formula in `manifest.json`:
`t = ((sheet - 1) * cells_per_sheet + (cell - 1)) / sheet_fps`

Watch for a slow push-in that looks static in stills, and for outfit or room changes
between shots.

## Finish

    scripts/state.py init <project>
    scripts/state.py set <project> ingest done

Report: segment duration, resolution, fps, the cut list you actually believe, and
anything odd you saw in the sheets.
