---
name: character-deliver
description: P6 of the character pipeline, gate C — show the user the assembled file, record their decision with their words in approval.json, and copy the approved export to pipeline/character/<video>/final/. The pipeline ends at the finished file; nothing is posted. Free.
---

# P6 — deliver (gate C)

**Nothing is handed over without the user's approval, in their words.**

## 1. Show the user the file

The assembled file `pipeline/character/<video>/assembly/<video>.mp4`, its contact sheet,
and the checks of `assembly/assembly.json`. On the first real use case, both exports: the
default and `<video>-grain.mp4`; the user picks one (the grain test). Walk the final
checklist with them: the face, the outfit and the set hold across every segment; the
voice and the room agree across every join; no join inside a sentence; the app's strings
are real and readable; the captions match the frozen script and the house style; the
overlays are the plan's words at the plan's times, readable and clear of the app and the
captions; each supplied clip is the approved one.

## 2. Record their decision

    scripts/character/review.py final <video> --decision approve --words "<the user's words>" [--export grain]
    scripts/character/review.py final <video> --decision regenerate --segment <n> --words "<the user's words>"
    scripts/character/review.py final <video> --decision reject --words "<the user's words>"

For a v2 plan an approval is refused when the file was assembled from another revision
of the plan, or when an overlay or supplied-file check failed in `assembly.json`:
assemble again, or take the problem back to P1 or to planning.

A regenerate goes back to that segment alone: `character-generate` (a paid run, with its
own yes), `character-review`, then P4 and P5 again. A reject stops the video; say why in
the notes (`scripts/character/state.py note <video> "<why>"`).

## 3. Deliver

    scripts/character/deliver.sh <video>

It refuses unless gate C is approved with the user's words, and refuses an assembly made
after gate C. It copies the export the user chose to `final/<video>.mp4` and writes
`final/delivery.json` (the file, its checksum, the user's words, the segments, the
computed spend), and marks P6 done.

**The pipeline ends here.** Posting, sound choice and the caption text of the post are
outside it. The Atlas takes the file from `final/` as it is: the user approves it for
posting there (the approval names this `sha256`), and the `post` skill sends it ("A video
post"). Deliver again only with a changed file in mind: a new checksum makes that approval
stale, and the file is not sent until the user approves it again.
