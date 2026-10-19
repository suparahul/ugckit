---
name: character-generate
description: P2 of the character pipeline — generate one segment of a character video through the ugc-character Supagen template. Spends real money; each run needs the user's yes to its computed cost. Refuses before any cost when the storyboard is not approved, the character is not live, or a reference is of a kind the pipeline does not allow.
---

# P2 — generate one segment

    ALLOW_REFS=1 CONFIRM=1 scripts/character/generate.sh <video> <nn>-<type>

One segment per run, from its folder `pipeline/character/<video>/segments/<nn>-<type>/`
(`prompt.txt`, `refs.json`): T, O, G, S, H, F or B. Only `character-assemble` knows the
whole video.

## Before the first run of a video

- **Gate A is approved:** `approval.json` `gate_a_storyboard.decision` is `approve` with
  the user's words (`character-shots`). The script refuses otherwise.
- **The character is `live`:** the video half, the voice reference and the
  twenty-generation gate are done (`persona-identity`, `character-voice`). The script
  refuses otherwise.
- **The model and the template agree.** `scripts/character/state.py model` shows the
  selected model and length; the active version of `ugc-character` in Supagen must be the
  same model at the same length. The REST endpoint ignores `version_number` and runs the
  ACTIVE version. A segment at another length needs a version at that length: create it
  over MCP in the shape of `scripts/character/templates.json` (messages only, `duration`
  null, the integer in `extensions.duration`, `"resolution": "768P"`, audio on), then
  change both together:

      activate_version(...)                                         # over MCP
      scripts/character/state.py model set <slug> <seconds>         # locally

## Get the yes, per run

Run it **without** `CONFIRM=1` first. It checks the gates, prints the model, the mode,
the generated and trimmed lengths and the computed cost, then refuses. Show the user that
output and wait for a yes. **A yes covers one run.** A re-run, or the next segment, needs
its own yes. Report the computed cost (`price_per_s` × seconds), never the figure Supagen
reports.

In the Atlas the yes is a click. The storyboard approval (`storyboard.approve`, recorded
at gate A) carries the computed cost of the first run of every segment: it is the yes to
each first run, when the cost generate.sh prints is not above the segment's figure on the
post page. A rejected take with "Generate it again" (`take.reject`, `data.decision`
`regenerate`, `data.cost_usd`) is the yes to one more run of that segment. Anything else
(a higher cost, a run nobody clicked for) needs the user's word here.

References are the standard mode of this pipeline, but each referenced run is still an
explicit opt-in: `ALLOW_REFS=1` goes on the command only after the yes.

## Run it in the background

Generation takes minutes. Start it with `run_in_background` and wait for the
notification. Do not poll with sleep.

## Guards in the script — do not work around them

- The storyboard approval, the character's `live` status, the reference kinds (never an
  app screen: the app is inserted at P4), and never supplied media (a plan asset or a
  file under `supplied/`), research footage or a reference reaction's post. C, M, R and P
  are never generated. An X segment (a silent reaction) carries no voice clip. Every X segment
  with a reference is a motion copy and runs on its route (the shot's `motion_copy.route`;
  a shot that names none takes `models.json` `motion_copy.default_route`), with the route's
  model and template. The clip is the one video part of the request, before the picture:
  - `motion`, **the default** (the founder's final decision, after the paid tests): Kling
    3.0 Pro Motion Control on Supagen, template `ugc-character-face-kling-motion`. It sends
    `prompt.txt` as the text part, the original clip (`shots.py reference`, padded to 3.0 s
    with its last frame), then the shot's keyframe, approved at gate A byte for byte
    (`approval.json` `gate_a_storyboard.keyframes_sha256`). The template sets
    `character_orientation` video and `keep_original_sound` false. $0.168 a second of
    output: a 3 s clip is $0.50. A run takes about 4 minutes.
  - `replace`, **the backup**: Wan 2.2 Animate, replace mode, on Supagen, template
    `ugc-character-face-animate-replace`. It sends the original clip (unpadded), then one
    picture of the character's face; no text part. $0.005 a source frame: 89 frames is
    $0.45. Use it only when the user names it after a failed motion take.
  - `animate` (Wan 2.2 Animate move: it timed out on Supagen) and `guided` (MiniMax H3
    reference-to-video, untested) are fallbacks. `edit` (Wan 2.7 Edit Video) is retired and
    refused: it kept the reference person's face.
  The route's template must exist in Supagen: at the first motion-copy reaction, create
  it from `scripts/character/templates.json` with its version and activate that version,
  as the `setup` skill does for `ugc-character` (free; no generation). After the download
  the script runs the identity gate (`identity.py`, with the `.venv` Python) and prints
  whose face is in the file. `capabilities.json` `bridge.motion_copy`
  is true: the founder approved the paid tests. Set it to false to stop every live
  motion-copy run. `REQUEST_ONLY=1` writes the request it would send, with placeholder
  file ids, and spends nothing.
- At most `max_reference_images` pictures (4 on the default model); the voice clip does
  not count.
- A continuing segment (its shot's `continuity.from`): the previous clip approved at
  gate B, its last frame taken from that file and unchanged (`continuity.py check`),
  `refs.json` carrying that frame once and first, and a model whose `models.json`
  `continuity.input` is `reference`. Otherwise it stops before any cost.
- The prompt under 5,000 characters, counted as characters; sent once, as message
  content.
- A model not in `models.json`, a length over its cap or under its minimum.

## A continuing segment

Generate the clips of a continuous take in order: the first one, then gate B for it (the
approval takes its last frame), then the next. The cost step adds one line, for example

    continuity  from 01-t: last-frame.png (sha256 7e92bbd786b0) as the first reference image,
                in the keyframe's place (UNVERIFIED: models.json continuity)

Say it to the user with the cost: on the H3 models the frame is a reference image, not a
first-frame setting, and no paid run has yet shown that the take opens on it. The script
writes `<take>.seed.json` beside the take: the frame it was seeded with. Gate B needs it.
If the first clip is approved again with another take, its last frame changes and the
continuing clip is generated again.

## When it fails

A validation failure costs nothing; say so. Show the real error. A wrong length or a
`"5s"` error means the integer is in `duration` instead of `extensions.duration`; a 401
means a mangled `.env` (`scripts/doctor.py`).

## Finish

The script records the stage and the computed cost in `pipeline/character/state.json`
and warns when the file has no sound track. The file is in
`segments/<nn>-<type>/generated/`. **Never report a generation as good before looking at
it.** The next stage is P3, gate B, for this segment only (`character-review`). A reject
regenerates this segment alone, from the same keyframe, with the one change the failure
calls for, and with its own yes.
