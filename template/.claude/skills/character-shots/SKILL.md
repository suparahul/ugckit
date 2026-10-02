---
name: character-shots
description: P1 of the character pipeline — from a locked, approved plan and a pinned character, cut the video into segments, write the shot files, video.json and each segment's prompt and refs.json, render the keyframes with the Codex image tool, run the prompt lint, and get the storyboard approved by the user (gate A). Free; no video is generated.
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

A plan is changed only by the planning system and the user. If the plan cannot be made as
written, say why and stop; do not adjust it.

## 2. Cut the segments

Mark the cut points on the frozen script first, then give each segment its lines.

- **A join sits on a sentence end**, never inside a line while the face is visible, and
  is a visible change: another segment type, or the same set reframed by about 10%.
- **Length.** The model takes whole seconds from 5 to 15 (`models.json`). A segment
  planned at 3 or 4 s is generated at 5 s with `trim_to_seconds` set; nothing is planned
  under 3 s. At most 15 words per 4 s of the planned length.
- **One set and one light state per segment**; one outfit for the whole video.
- **The types.** T (talk) for every spoken line on camera. With `app_insertion` true, a
  beat that shows the app becomes O, G, S, H or F (a plate with a green phone, inserted
  at P4) or R, P (the real recording, no generation): choose by what the viewer must do
  (read → R or a large S hold; recognise → G or O; believe → F or H). H and F speak no
  line on camera; their audio is laid at assembly. **With `app_insertion` false, every
  segment is T**, and there is no screen stage.
- **The references, at most four pictures on the default model**, in this order: the
  keyframe, the hero, the sheet of each fixed subject in the shot, then one more (the
  angle anchor nearest the shot, or the last frame of the neighbour segment). The voice
  reference goes on every talking segment and does not count. The keyframe already
  carries the outfit and the set, so their pictures are not attached to the generation.
  Allowed kinds: `keyframe`, `hero`, `anchor`, `subject`, `set`, `neighbour-frame`,
  `voice`. **Never an app screen, a screenshot or a recording.**

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
  and the segments in order with their lines (R and P carry a `screen_id`).

Then check them, and write each segment's `refs.json` (and, for a phone segment, a first
`insert.json` that P4 completes):

    scripts/character/shots.py validate <video>
    scripts/character/shots.py refs <video>

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
signature details); exactly one person; does it read as a camera-roll photo, not an ad;
is the room right and not too tidy; is she holding what she should; hands counted; for
O, G, S, H, F the phone at its size and **flat-on to the lens** (an angled phone is
redone, never fixed later); for H the end still too; for F the other hand already raised
beside the phone. Redo a failed still with `--only`. Each keyframe that shows her face
counts toward her twenty-generation gate.

## 5. The prompts and the lint

Write `segments/<nn>-<type>/prompt.txt` for each generated segment, from `creator.json`,
the shot file and its `video` block, in this order of sections, each starting on its own
line with its name in capitals:

    (opening look, no name)   vertical 9:16 phone video, the set, the light, the flaws by name
    REFERENCES                one line per refs.json file, naming the file: what it controls, what it does not
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
runs again.

## 6. Gate A: the storyboard approval

    .venv/bin/python3 scripts/character/shots.py storyboard <video>

Show the user `keyframes/storyboard.jpg` and, per segment, one line: the type, the
planned and generated length, the lines it speaks, the references it will carry, and the
computed cost of its generation (`price_per_s` × generated seconds, from `models.json`),
with the total. Ask for approval **by word**. A "redo <n>" goes back to step 4 for that
still only.

On approval, write `approval.json` from `approval.example.json`: `gate_a_storyboard` with
each check you made (true or false), `prompt_lint` true, `decision` `approve`, and the
user's words quoted with the date. Copy the words into each shot's `keyframe_approved`.
Then:

    scripts/character/state.py set <video> shots done "storyboard approved"

The next stage is `character-generate`, one segment at a time.
