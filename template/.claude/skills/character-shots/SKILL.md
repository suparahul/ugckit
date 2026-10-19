---
name: character-shots
description: P1 of the character pipeline — from a locked, approved plan (v1, or v2 with its editorial contract, supplied media, narrators and overlays), cut the video into segments (talking, phone, silent action B, supplied C, panels M), write the shot files, video.json and each segment's prompt and refs.json, render the keyframes with the Codex image tool, run the prompt lint and the bridge check, and get the storyboard approved by the user (gate A). Free; no video is generated.
---

# P1 — the shots and the storyboard

The first production stage of a character video. Nothing here spends money: the
keyframes are made by Codex on the user's Codex plan, and every check is local. Its end is
gate A, **the storyboard approved by the user in this conversation**. No segment is
generated before that (`scripts/character/generate.sh` refuses).

Read first: `pipeline/character/<video>/plan.json` (the only input; never edit it), the
pinned character's `creator.json`, the handle's `world.json` and `HANDLE.md`,
`pipeline/character/model-failures.md` (the user's ledger) and
`docs/character-model-known.md` (what the kit knows about each model), and the templates
`docs/character/shot.example.json`, `video.example.json`, `approval.example.json`.

## 1. Check the plan and the character

    scripts/character/shots.py check <video>

It refuses a plan that is not approved, a plan whose beats show the app when
`app_insertion` is false, a screen that is not in `apps/<slug>/screens/SCREENS.md`, a pin
that is not `<character>@v<n>`, a character with no creator file, a status other than
`video-setup` or `live`, a set or an outfit that is not locked, and a missing hero, set
plate or outfit anchor. **Casting never runs here.** A missing character, anchors or set
plates is part A: say what is missing and run `persona-identity` (mode 3) first. When the
check passes it records the video in `pipeline/character/state.json`, with or without
app insertion as the plan says.

**A v2 plan** (`schema_version` 2) is also checked by the production bridge
(`scripts/character/bridge.py plan <video>`, run by `check`): its approval matches the
digest of this exact revision (`planning-approval.json`), the editorial values, beats in
order that cover the length, at most 15 words per 4 s per beat, every voiceover beat
bound to a narrator, every supplied asset on disk with its checksum, permission and
range, overlays long enough to read, a source credit over a third party's clip, the live
pairing of an input clip and its app recording. A v2 plan may pin no character
(`characters: []`) when no generated person or mascot appears; a real animal of the
world (`origin: real`) is only ever shown in supplied footage.

A plan is changed only by the planning system and the user. If the plan cannot be made as
written, say why and stop; do not adjust it. Report the infeasibility back to planning
(`video-lock`) with the beat and the reason: never relabel a silent beat as talk, never
generate what the plan supplies, never change the format to pass a check.

## 2. Cut the segments

Mark the cut points on the frozen script first, then give each segment its lines.

- **A join sits on a sentence end**, never inside a line while the face is visible, and
  is a visible change: another segment type, or the same set reframed by about 10%. The
  one exception is a continuous take (below): its join is not seen, so it is not reframed.
- **Length.** The model takes whole seconds from 5 to 15 (`models.json`). A segment
  planned at 3 or 4 s is generated at 5 s with `trim_to_seconds` set; nothing is planned
  under 3 s. At most 15 words per 4 s of the planned length.
- **One set and one light state per segment**; one outfit for the whole video.
- **The types.** T (talk) for every spoken line on camera. With `app_insertion` true, a
  beat that shows the app becomes O, G, S, H or F (a plate with a green phone, inserted
  at P4) or R, P (the real recording, no generation): choose by what the viewer must do
  (read → R or a large S hold; recognise → G or O; believe → F or H). H and F speak no
  line on camera; their audio is laid at assembly. **With `app_insertion` false, no
  segment shows the app** (no O, G, S, H, F, R or P), and there is no screen stage.
- **B, a silent generated action** (v2): hands only (a pinned human's hands, no face),
  pet only (the world's generated subjects, no person) or an approved mascot. Exact
  subject ids and count, the beat's set. No line on camera and no voice reference; a
  narration is laid at assembly (`audio_from`). **Never the app**: a beat that shows the
  app is O, G, S, H, F, R or P.
- **X, a silent reaction** (v2, a beat with `reaction`; founder, 2026-10-03: a reaction
  hook is never spoken): the handle's approved generated face reacts, framing_kind
  `face`, with no line, no `audio_from`, no voice reference and no lip sync; the hook is
  the plan's timed text overlay over it. One reaction beat per X segment. The shot
  copies the beat's `reaction` exactly. The prompt's PERFORMANCE writes each expression
  beat's face, eyes and head word for word, with its time from the segment's start ("At
  0.8 s, ..."), and says "No lip sync" and "She does not speak". The reference reaction
  (`reaction_refs`) gives the performance only: never name its post, its creator or its
  file in the prompt, and never attach the clip or a frame of it to a keyframe or a
  generation; the face stays the handle's own. A beat with `reaction: null` has no
  reference yet: stop and send it back to planning. This is the written route, used
  when the reference's `generation_input` is `none`.
- **X in face-replace mode** (the reference's `generation_input` is `face_replace`): the
  reference clip drives the motion and timing, and the face is the character's. The beat
  lasts the clip's range and has no set. Look at the range for burned-in text (the
  reference's `burned_in_text`, a handle, a watermark, a caption) and write
  `face_replace` in the shot: `{ref_id, route, clip: "segments/<nn>-x/source/reference.mp4",
  range_s, masks: [{rect, how, text, behind}]}`; a mask is `crop` at an edge, else `blur`
  or `box`, and a `blur` or `box` mask says in `behind` what the band hides ("the chin,
  the neck and the top of the shirt"). Then run
  `scripts/character/shots.py reference <video> <nn>-x`: it checks the post against its
  checksum, cuts the range, and writes the clip's first frame, `source/first-frame.png`.
  `trim_to_seconds` is the clip's length; `duration_seconds` is null. Never attach the
  research file itself.

  **The route is `motion`** (`models.json` `face_replace.default_route`, the founder's
  final decision after the paid tests): Kling 3.0 Pro Motion Control on Supagen. Write
  `"route": "motion"` (a shot that names no route takes it). Two steps:
  1. **The character's first frame** is the shot's keyframe (`keyframes/<nn>-x.png`),
     made by Codex like any keyframe, from the hero (kind `hero`) and the pose picture
     `segments/<nn>-x/source/first-frame.png` (kind `face_replace_frame`). Kling takes
     the room, the light and the camera of this picture, so copy the clip's first frame:
     its room and light, the camera height and angle, the clothes, the pose mid-motion and
     the mouth as it starts. A cropped portrait (a front anchor as it is) gave a still
     camera in a bright room and a reaction that read as a yawn. The `keyframe_prompt`
     pastes the identity lock's face and hair word for word, says "Exactly one person",
     calls the pictures "the first reference picture" and "the pose picture" (never a file
     name), and pastes, word for word, the band sentence of every `blur` or `box` mask
     (`bridge.band_sentence(masks, "picture")`): no band in the still. The user approves
     this still at gate A, and its checksum goes into `approval.json` (step 6).
  2. **The motion**: the generation references are the clip (kind `face_replace_clip`)
     and the keyframe (kind `keyframe`), in that order, nothing else. `shots.py reference`
     writes the ORIGINAL clip (no mask; Kling removes the text), held on its last frame to
     3.0 s (Kling takes 3 s or more; the take is trimmed to the range at assembly).
     `prompt.txt` is short (at most 600 characters, no file name): the person in the
     reference image performs the reference video's motion exactly, with the same
     expressions, mouth shapes, eye and head movements at the same moments; the face,
     hair, clothes and room as in the reference image; no captions and no on-screen text.

  **The backup is `replace`** (Wan 2.2 Animate, replace mode, on Supagen), only when the
  user names it after a failed motion take. Its generation references are the clip (kind
  `face_replace_clip`), then one picture of the character's face (kind `hero` or
  `anchor`, the one that shows the face and hair most clearly), nothing else. `shots.py
  reference` writes the original clip, unpadded and unmasked (the masks stay in the shot
  as a record of the text). No keyframe, no `keyframe_prompt`, no `prompt.txt`. In the paid
  test it got the face shape, the clothes and the room wrong; gate B checks them.

  `animate` (Wan 2.2 Animate move: the keyframe as on the motion route, no prompt) timed
  out on Supagen; `guided` (MiniMax H3 reference-to-video, a new clip guided by the masked
  clip, `duration_seconds` 5, trimmed to the clip) is untested. `edit` (Wan 2.7 Edit Video)
  is **retired**: it kept the reference person's face in every frame, and `shots.py
  validate` and `generate.sh` refuse it. A face-replace X neither continues a clip nor is
  continued (`continuity.py`). The failures of each model are in
  `docs/character-model-known.md`.
- **A full-screen app beat** has framing `app_screen`: it is R or P, never generated.
- **C, supplied media** (v2): the plan's clip (`source_range_s`, inside the asset's
  approved `trim_s`) or still (`still_s`). No casting, no keyframe, no prompt, no
  generation. Its own sound plays unless `audio` is `mute` or `audio_from` lays another.
  A clip that films a phone whose screen is replaced has `insert: {mode, screen_id}` and
  goes through the same insertion gates as a generated plate (step 3).
- **M, panels** (v2): a split-screen or picture-in-picture beat, its panels copied from
  the plan (`asset_id`, the `project` of an approved B, or a `screen_id`; the range, the
  `rect`, `crop` and `sync_offset_s`). A live demonstration keeps the measured offset of
  its input clip and its app recording.
- **Supplied media is never a reference.** No plan asset and nothing under `supplied/`
  is attached to a keyframe or a generation; `shots.py validate` and `generate.sh`
  refuse it. The same holds for research footage and a reference reaction's post.
- **A continuous take over two clips** (a beat longer than one clip, a movement across
  a join, or a plan beat with `continues_previous: true`): the second shot declares
  `"continuity": {"from": "<nn>-<type>"}`, the segment right before it in `video.json`.
  Its first frame is then that clip's last frame, taken from the file the user approves
  at gate B (`scripts/character/continuity.py`, run by `review.py` on the approval). Do
  not list a `neighbour-frame` yourself: `shots.py refs` puts the frame in the keyframe's
  place, first. Write the shot's keyframe as usual: it is the storyboard's picture of the
  opening, and the generation does not carry it. Both clips are T, B or X by the written
  route (never a phone plate, C, M, R, P or a face-replace X), in one set, with the same
  `punch_in`, and the continuing one has no `trim` in `video.json` (`trim_to_seconds`
  sets its end). The cut of the first clip is fixed when its frame is taken: set its
  `trim` or `trim_to_seconds` before gate B; a talking clip that is continued is not
  trimmed by word times at its end. A model with no continuity input
  (`models.json` `continuity.input` none, Wan 2.7 Edit Video) cannot continue a clip.
  Before gate A `validate` notes the frame as pending; after it, `validate` and
  `generate.sh` refuse a continuing shot whose previous clip has no approved last frame.
- **The references, at most four pictures on the default model**, in this order: the
  keyframe (for a continuing shot, the previous clip's last frame in its place), the
  hero, the sheet of each fixed subject in the shot, then one more (the angle anchor
  nearest the shot). The voice reference goes on every talking segment and does not
  count. The keyframe already carries the outfit and the set, so their pictures are not
  attached to the generation. Allowed kinds: `keyframe`, `hero`, `anchor`, `subject`,
  `set`, `neighbour-frame` (the last frame of the clip before, written by `shots.py
  refs`), `voice`. **Never an app screen, a screenshot or a recording.**

## 3. Write the files

Under `pipeline/character/<video>/`:

- `shots/<nn>-<type>.json` for each generated segment, from `shot.example.json`: the
  character and her version, the set and outfit, the framing, one action written as
  movement, a job for each hand, the fixed subjects with their true size, the phone (for
  O, G, S, H, F: `present` true, `screen` green, `screen_id`), `phone_motion` for H and F,
  `keyframe_prompt` and `keyframe_references` (the hero, the outfit anchor, the set
  plate, each fixed subject in the shot), `keyframe_end_prompt` for H, the negatives (the
  earned ones only from the ledger, at most five), and the `video` block with its
  references and their `kind`.
- `video.json` from `video.example.json`: the plan's pins, `app_insertion`, the outfit,
  and the segments in order with their lines (R and P carry a `screen_id`). For a v2
  plan also: `plan_revision` and `plan_sha256` (`bridge.py digest`), `beat_ids` on every
  segment, the plan's `overlays` copied exactly, `audio_from` for every narrated segment
  (`narration:<take>` for an original synthetic narrator, `asset:<id>` for a supplied
  voice, `<video>.<seg>` for the character's own approved performance). A shot file
  copies its beat's `action` word for word, its exact `fixed_subjects_in_shot`, its
  `set_ref` and `framing_kind`.

Then check them, and write each segment's `refs.json` (and, for a phone segment, a first
`insert.json` that P4 completes; for a C segment with a filmed phone, its plate):

    scripts/character/shots.py validate <video>
    scripts/character/shots.py refs <video>
    scripts/character/shots.py supplied <video>        # only for a C segment with insert

The refs.json of a continuing shot opens on
`pipeline/character/<video>/segments/<prev>/last-frame.png`. The file does not exist yet:
it is written when `<prev>` is approved at gate B.

For a v2 plan, `validate` ends with the bridge: each beat in its segments at the plan's
seconds (half a second, or a tenth of the beat, either way), the words, the performance
(a T segment only on on_camera beats), the actions, the subjects, the sets, the panels,
the narration sources, the overlays and the live pairing.

## 4. The keyframes

Say once a session: **"The keyframes are made by Codex on your Codex plan; the kit does
not compute that cost."**

- **Claude as the agent:** start the bridge with `run_in_background` and wait for the
  notification:

      scripts/character/keyframes.sh <video>            # or --only 02-g,04-t

  Not logged in to Codex: it exits 3 and prints `codex login`; give the user that one
  command, wait for "done", run it again.
- **Codex as the agent:** `scripts/character/shots.py job <video>`, then make each still
  inline as `keyframes/keyframes-instruction.txt` says, then
  `scripts/character/shots.py verify <video>` and `.venv/bin/python3
  scripts/character/shots.py storyboard <video>`.

Every still is 1080x1920 at `keyframes/<nn>-<type>.png` (and `<nn>-h-end.png` for H).
**Look at each one before the user does**, against the anchors: is it her (face, hair,
signature details); who is in the picture, by the shot's `framing_kind` (face: exactly
one person; hands only: one person's hands and forearms, no face; subject only: no
person at all, the subjects in their exact count); does it read as a camera-roll photo,
not an ad;
is the room right and not too tidy; is she holding what she should; hands counted; for
O, G, S, H, F the phone at its size and **flat-on to the lens** (an angled phone is
redone, never fixed later); for H the end still too; for F the other hand already raised
beside the phone. Redo a failed still with `--only`. Each keyframe that shows her face
counts toward her twenty-generation gate.

For every phone segment, measure the flat-on rule on the still itself:

    scripts/character/qc.py <video> <nn>-<type> --keyframe

It fits the green screen's corners and passes when the opposite edges are within 3%,
every corner within 3° of 90 and the long edges within 3° of vertical; for H it checks
the end still too, and that the push grows the screen to over half the frame width. A
still that fails is redone before gate A.

## 5. The prompts and the lint

Write `segments/<nn>-<type>/prompt.txt` for each generated segment, from `creator.json`,
the shot file and its `video` block, in this order of sections, each starting on its own
line with its name in capitals:

    (opening look, no name)   vertical 9:16 phone video, the set, the light, the flaws by name
    REFERENCES                one line per refs.json file, naming the file: what it controls, what it does not
                              (a continuing shot: "last-frame.png is the first frame: the last frame of <prev>")
    STRUCTURE                 shot count, exact cut times
    SUBJECT                   the identity lock, pasted; the outfit; the signature details; counts as numbers
    SETTING                   the set lock, pasted; "no other location"
    ANIMALS/PROPS             when a fixed subject is in the shot: its true size; each prop's owner
    SHOT n (a to b s)         action first, then the line in quotes with its delivery note; "End state: ..."
    THE PHONE SCREEN          O, G, S, H, F only (below)
    PERFORMANCE               "She speaks every line on camera with lip sync"; anti-monotone language
    AUDIO                     the voice reference binding; room sounds as events; no music
    DIALOGUE                  the frozen words, exactly
    CONSISTENCY               what cannot change: face, hair, outfit, props, counts, geography
    NO TEXT                   the base bans (no captions, no text, no voice-over on a shot where her face is visible, no silent talking head), then the earned ones; always last

**THE PHONE SCREEN**: the green spec (flat solid uniform chroma-key green, RGB 0 177 64,
edge to edge, no icons, no text, no reflection, the same shade in every frame; only the
screen is green; the edges stay clear, fingers on the sides and bottom; "the screen
lights her thumb faintly"). For O, G and S, the stability paragraph:

> The phone is completely stable throughout the shot: held rigid in one position,
> filling the same part of the frame in every frame. It does not drift, rotate, tilt,
> sway, shift toward or away from camera, or get re-gripped. Her wrist and forearm stay
> locked. The camera holds still on it. The screen stays fully visible, square-on and
> unobstructed at its edges from the first frame to the last.

and the flat-on sentence, word for word:

> The phone is held completely flat-on to the camera: the screen plane is square to the
> lens and upright, with no tilt, no turn and no perspective, from the first frame to the
> last.

For B there is no phone section: PERFORMANCE says "No one speaks" (or "She does not
speak"), ANIMALS/PROPS gives each subject's exact count ("exactly two cats") and true
size, a hands-only shot says "no face", and a subject-only shot says "No person in
frame" and never "exactly one person".

For H the push sentence replaces the stability paragraph; for F the finger sentence is
added. Fill the times and sizes from the shot's `phone_motion`:

> H: She holds the phone at chest height, completely flat-on to the camera, the screen
> square to the lens and upright. At 0.5 s she pushes it straight toward the lens in one
> smooth movement, keeping it flat-on with no turn and no tilt, until the screen fills
> about 60% of the frame width at 1.3 s, then holds it completely still to the end. Her
> face stays mostly hidden behind the phone. She does not speak.

> F: She holds the phone completely flat-on to the camera in her left hand, perfectly
> still. Her right hand is raised beside it from the first frame, index finger extended.
> At 1.0 s her index finger touches the lower middle of the screen and slides straight up
> about a third of the screen height in 0.6 s, then lifts off. The screen stays flat
> solid green under and around the finger: no glow, no ripple, no icon. The finger stays
> in front of the screen and never passes through the phone. She does not speak.

H and F are new shot types: their numbers are starting values until the first plates
are measured.

No generation parameter in a prompt (no duration, seed or ratio flags); they go through
the template. Under 5,000 characters. Then:

    scripts/character/lint_prompt.py <video>

Every check must pass. A failure is fixed in the prompt (or the shot), then the lint
runs again. On the motion route the lint reads the shot's `keyframe_prompt` and the short
`prompt.txt`; on the replace route there is no prompt to lint.

## 6. Gate A: the storyboard approval

    .venv/bin/python3 scripts/character/shots.py storyboard <video>

Show the user `keyframes/storyboard.jpg` and, per segment, one line: the type, the
planned and generated length, the lines it speaks, the references it will carry (for a
continuing segment: "opens on the last frame of <prev>, taken at gate B"), and the
computed cost of its generation (`price_per_s` × generated seconds, from `models.json`),
with the total. C and M segments cost nothing and have no keyframe: give their source
asset, range and panels, and the narration or sound laid under them. Ask for approval **by word**. A "redo <n>" goes back to step 4 for that
still only.

First, every session: `scripts/character/review.py pending <video>` lists each Atlas click
that no file records yet, with the command that records it. Record those before you ask
the user again.

The post page in the Atlas shows the same: the storyboard, every keyframe, the computed
cost per segment and the total, with Approve storyboard and Send back. When the user
clicks there, record the click:

    scripts/character/review.py storyboard <video> --from-atlas

It refuses when a keyframe changed after the click, and writes `gate_a_storyboard`: the
decision, the words, every keyframe's sha256 (`keyframes_sha256`), the approved cost and
the click. A send-back records "redo" with the user's note: redo the stills it names. A
**Redo this keyframe** click names its segments (`redo_segments` in `gate_a_storyboard`):
step 4 makes only those again (`keyframes.sh --only <nn>-<type>`). By word, the same command records it: `review.py storyboard <video> --decision approve
--words "<the user's words>"`.

On approval, write `approval.json` from `approval.example.json`: `gate_a_storyboard` with
each check you made (true or false), `prompt_lint` true, `decision` `approve`, and the
user's words quoted with the date. Copy the words into each shot's `keyframe_approved`.
For a face-replace X on the motion or animate route, `gate_a_storyboard.keyframes_sha256`
must hold `{"<nn>-x": "<sha256 of keyframes/<nn>-x.png>"}`: `generate.sh` runs only the
keyframe the user approved, byte for byte. `review.py storyboard` writes it for every
keyframe.
Then:

    scripts/character/state.py set <video> shots done "storyboard approved"

The next stage is `character-generate`, one segment at a time.
