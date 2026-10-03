---
name: character-review
description: P3 of the character pipeline, gate B — measure one generated segment with qc.py (and its phone screen's insertion gates), look at it against the character's anchors and the frozen script, and record keep, reject or regenerate in approval.json with the user's words; approve each supplied file (its checksum, permission and range) and each narrator take (after the natural-voice check). A reject adds a row to the user's failure ledger. Free.
---

# P3 — review one segment (gate B)

After every `character-generate` run, for **that segment only**. Nothing here spends
money. A segment is kept, rejected, or regenerated alone, from the same keyframe, with the
one change its failure calls for.

Read first: the segment's shot file `shots/<nn>-<type>.json` and `prompt.txt`, the pinned
character's `creator.json` and anchors, the frozen script in `plan.json`,
`pipeline/character/model-failures.md` and `docs/character-model-known.md`.

## 1. Measure

    scripts/character/qc.py <video> <nn>-<type>

It writes a contact sheet and frames in `segments/<seg>/generated/qc/` and prints: the
length and the sound track (no sound is a defect), the cuts, the dialogue heard back, the
pitch spread per 2 s, and the green screen. For a phone segment (O, G, S, H, F) it also
runs the insertion gates of the plate (`qc/gates.json`):

- **flat-on to the lens** in every frame (O, G, S, F) or on the start and end holds (H):
  opposite edges within 3%, every corner within 3° of 90, the long edges within 3° of
  vertical. **This is the hard rule.** A plate that fails it is regenerated, never fixed
  in compositing.
- **phone drift** under 8% of the screen width (8 to 20% only for a G with no gesture);
- **screen width** against the hero element's need (recognition, large type 280 px,
  body text 550 px, in the 1080 frame);
- H: a start hold of 0.5 s or more and an end hold of 1 s or more, the push at most 8°
  from square, no corner jump over 2% of the screen width;
- F: the corner track, and every frame flat-on.

The numbers are starting values; the first real plates calibrate them.

## 2. Look

**Open the contact sheet and the frames. Never report a segment as good before looking at
it.** The checklist (the user sees the same list):

- **Identity:** face, hair and each signature detail match the anchors in every second;
  exactly one person; each fixed subject correct in count, look and true size.
- **Hands:** five fingers, nothing melting, each hand doing its job from the shot file.
- **Mouth:** the lip sync holds; the teeth are normal; the words heard back match the
  frozen script word for word.
- **Eyes:** on the lens through each line; natural blinks.
- **Voice:** matches the voice reference; the natural-voice check (`character-voice`):
  natural breaths, varied pauses, no 2 s window under 5 semitones, the room sound, no flat
  TTS cadence.
- **Motion:** the hands move while she talks; no slow motion.
- **Set:** the same room, light and camera position as the set plate; nothing
  hallucinated (a tripod is a recurring one).
- **Text:** none in the picture.
- **Phone segments:** the gates above, then by eye: the green flat and edge to edge, the
  holding hand below the screen, for F the finger never through the phone.
- **B segments** (a silent generated action): who is in the picture, by the shot's
  `framing_kind`: hands only, one person's hands and forearms and no face; subject only,
  no person, no hand, no body part. Each subject in its exact count and true size, two
  cats as two. The set as planned. No phone and no screen. No mouth moving as if
  speaking. A mascot: its style lock in every second. The face, voice and mouth checks do
  not apply; the hands, the set and the motion do.
- **X segments** (a silent reaction): the face is the character's (the anchors, every
  second), the hands are whole, the mouth never forms words and no voice is heard, and
  the reaction follows the written expression beats at their times. The face is never
  the reference creator's. `review.py` approves an X only with
  `--check identity=pass --check hands=pass --check silent=pass --check performance=pass`,
  and only when the file is as long as the shot plans (the duration gate).

Pull a frame where you are unsure:

    ffmpeg -y -ss <t> -i <video> -frames:v 1 -vf scale=540:-2 <scratch>/f.png

## 3. Decide with the user, and record it

Give a verdict, not a description: what worked, with the number that proves it; what
failed, with the time where it fails and the stage that owns the fix. Then show the user
the file and ask for their word. Record it:

    scripts/character/review.py segment <video> <nn>-<type> --decision approve \
        --words "<the user's words>" --set <set-id>
    scripts/character/review.py segment <video> <nn>-<type> --decision reject \
        --class "<the failure, in one line>" --fix "<the prompt change, if known>" \
        --words "<the user's words>"

- **approve**: the file is kept for assembly. With `--fixed-by "<change>"` on the approval
  of a regenerated segment, the ledger's open rows of this segment say what fixed them.
- **reject** or **regenerate**: always with `--class`. It adds a row under the model's
  table in `pipeline/character/model-failures.md` (the user's file; the table is made at
  the model's first reject). The next run of this segment changes one thing, the one the
  failure calls for, by layer: face drift to the references and the keyframe; plastic
  skin to the light; bad hands to a simpler shot; bad lip sync to fewer words; room or
  outfit drift to the exact lock restated; a polished look to cinema words removed; a
  plate that is not flat-on to a redone keyframe.
- Each regeneration is a new paid run: it goes back to `character-generate`, with its own
  computed cost and its own yes.

## Supplied media and narrator takes

Supplied media (a C segment, a panel, a supplied voice) has **source checks, not the
checks of a generated picture**: the file is the plan's (its sha256), its permission is
recorded, its range is inside the file. Look at the range and listen to it, then:

    scripts/character/review.py source <video> <asset-id> --decision approve --words "<the user's words>"

It refuses an approval when the file changed after the plan was locked, a third party's
or a supplied file has no permission, or the range runs past the file. A changed file is
a new plan revision, not a new approval. A C segment whose clip films a phone also gets a
plate (`shots.py supplied`), measured with `qc.py <video> <nn>-c segments/<nn>-c/source/plate.mp4`
and approved like a generated plate (`review.py segment <video> <nn>-c --file
source/plate.mp4`): the flat-on and tracking gates of its mode hold, unchanged. A filmed
phone that fails them needs a new recording, not relaxed QC.

A narrator's take (`character-voice`, narrator mode):

    scripts/character/review.py narration <video> <take> --narrator <id> --lines l2,l3 \
        --decision approve --words "<the user's words>" --check natural_voice=pass

When every generated segment, supplied source and narrator take that `video.json` uses is
approved, `review.py` marks P3 done. For a
plan with app insertion, the next stage is `character-composite` for each phone segment;
without it, `character-assemble`.

## The keep rate

    scripts/character/review.py rates

The keep rate per segment type and the usable rate per set, from every video's
`approval.json`, beside the planning values. **The stop rule:** a segment type under 40%
after ten generations is not retried; the prompt, the set or the model changes. Write the
usable rate per set into the handle's `world.json`.
