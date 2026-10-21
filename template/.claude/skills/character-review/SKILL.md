---
name: character-review
description: P3 of the character pipeline, gate B — measure one generated segment with qc.py (and its phone screen's insertion gates), look at it against the character's anchors and the frozen script, and record keep, reject or regenerate in approval.json with the user's words; approve each supplied file (its checksum, permission and range), each narrator take (after the natural-voice check) and each motion-designed screen's render (after its gates). A reject adds a row to the user's failure ledger. Free.
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
- **X segments on the written fallback** (a silent reaction the user named after a failed
  motion take): the face is the character's (the anchors, every second), the hands are whole, the mouth never forms words and no voice is heard, and
  the reaction follows the written expression beats at their times. The face is never
  the reference creator's. `review.py` approves an X only with
  `--check identity=pass --check hands=pass --check silent=pass --check performance=pass`,
  and only when the file is as long as the shot plans (the duration gate).
- **X segments by motion copy** (every X with a reference): the motion is the clip's; look
  at the person. The character's face wherever a face is in view (a visible face is not
  needed); nothing of the original creator's face, hair or marks;
  no handle, watermark or caption of the reference (OCR reads the file and refuses any
  text); no band, blur or box left from a mask; no voice. Check the hair, the clothes and
  the room against the approved keyframe (motion route). First the identity gate,
  measured (free, local):

      .venv/bin/python3 scripts/character/identity.py <video> <nn>-x generated/<file>.mp4

  It compares eight frames inside the reaction's range (not the motion route's padding)
  with the character's hero and anchors, and with the same moments of the reference clip
  (OpenCV YuNet and SFace; 0.363 is "same person"). Only the frames that show a face are
  measured. PASS needs a median similarity to the character of 0.363 or more and the face
  closer to the character than to the clip's person in 75% of those frames. NO FACE (no
  frame shows a face) measures nothing: your eye check decides alone. Recommend a reject on
  a FAIL, whatever the face looks like at a glance: the retired edit route scored 0.18 to
  the character and 0.90 to the reference. The decision is the user's. The face models (about 39 MB) are fetched once into
  `scripts/character/face-models/` and checked by sha256. `qc.py` prints the same gate, and
  `review.py` runs it again. An approval over a FAIL (or a gate that could not run) is the
  user's (2026-10-21): it warns and records the gate, its result and their words in
  approval.json (`--accept-fail identity` says so; the Atlas: "Approve anyway" with a
  note). OCR text on the file is the same (`ocr`). The eye checks
  `--check identity=pass --check no_source_identity=pass --check silent=pass` are the
  user's claims: one not ticked is recorded as "not claimed", never refused. On the
  `motion`, `replace` and `animate` routes the file is within 0.25 s of the clip the model
  got (on the motion route, the range padded to 3.0 s; the take is trimmed to the range
  at assembly). On the `guided` route the
  take is a new clip: it is at least the clip's length (it is trimmed to it at assembly),
  and it needs `--check follows_reference=pass` too: the reaction follows the clip's
  expression beats in order and time within the trimmed length.

- **A clip that the next one continues** (the next shot's `continuity.from`): its
  approval takes its last frame, `segments/<nn>-<type>/last-frame.png` with
  `last-frame.json` (the frame, its sha256, the approved file's sha256, its time and the
  cut). Look at the end of the clip before you approve: the next clip starts from that
  exact picture. Approving another take later takes a new frame, and `review.py` warns
  when a continuing clip was approved from the old one: it is generated again.
  `scripts/character/continuity.py last-frame <video> <nn>-<type>` takes it again by hand
  (after a change of `trim` or `trim_to_seconds`).
- **A continuing clip**: it opens where the clip before it ends. Look at the join: the
  same pose, light, set and framing in its first second as at the end of the clip before.
  `review.py` approves it only when its `<take>.seed.json` (written by `generate.sh`)
  names the current last frame, and records `checks.seed_diff`: how far its first frame
  is from that frame (0 to 255; a few points is the same picture). No threshold is set
  yet: the first paid continuing run gives the first number.

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

**When the user decides in the Atlas** (the post page shows every take, the reference
clip, the keyframe and the identity gate, with Approve this take and Reject), record the
click instead of asking again:

    scripts/character/review.py segment <video> <nn>-<type> --from-atlas

It reads the last `take.approve` or `take.reject` line for that segment, refuses when the
take changed after the click (its sha256), and runs every gate as above (the identity
gate too). An approval carries the checks the user ticked; a reject carries what failed
(`--class`) and the fix. The words are the note, or say what was clicked. The same for a
phone segment's composite: `review.py composite <video> <nn>-<type> --from-atlas`. A take
the user picked from the older takes is approved the same way: the line names its file.
The supplied sources and the narration takes have their own cards and lines:
`review.py source <video> <asset-id> --from-atlas` and `review.py narration <video> <take>
--from-atlas` (the natural-voice check ticked, or recorded as not claimed); a motion-designed screen's render,
`review.py motion <video> <nn>-<r|p> --from-atlas`. First, every session: `scripts/character/review.py pending <video>` lists each Atlas click
that no file records yet, with the command that records it. Record those before you ask
the user again.

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

A motion-designed screen (an R or P whose beats have `demo_source` `motion_design`,
`character-motion`): no take and no model, a render of the app's real screens. Its gates
come first (`motion_design.py check`: no FAIL); then show the user the render and its
stills beside the story's steps, and record their words:

    scripts/character/review.py motion <video> <nn>-<r|p> --decision approve --words "<the user's words>"

With no OCR engine the text gates are NOT RUN: the user reads the stills, and the approval
carries `--check text=pass --check hero=pass`. The approval is of this render's sha256. A
reject says what to change in the page; the story stays the plan's.

When every generated segment, supplied source, narrator take and motion-designed render
that `video.json` uses is approved, `review.py` marks P3 done. For a
plan with app insertion, the next stage is `character-composite` for each phone segment;
without it, `character-assemble`.

## The keep rate

    scripts/character/review.py rates

The keep rate per segment type and the usable rate per set, from every video's
`approval.json`, beside the planning values. **The stop rule:** a segment type under 40%
after ten generations is not retried; the prompt, the set or the model changes. Write the
usable rate per set into the handle's `world.json`.
