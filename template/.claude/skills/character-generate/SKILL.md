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

References are the standard mode of this pipeline, but each referenced run is still an
explicit opt-in: `ALLOW_REFS=1` goes on the command only after the yes.

## Run it in the background

Generation takes minutes. Start it with `run_in_background` and wait for the
notification. Do not poll with sleep.

## Guards in the script — do not work around them

- The storyboard approval, the character's `live` status, the reference kinds (never an
  app screen: the app is inserted at P4), and never supplied media (a plan asset or a
  file under `supplied/`), research footage or a reference reaction's post. C, M, R and P
  are never generated. An X segment (a silent reaction) carries no voice clip. An X segment
  in face-replace mode carries only its masked clip (`shots.py reference`) and the
  character's face, on its route's model and template (the shot's
  `face_replace.route`: `edit`, Wan 2.7 Edit Video, the clip as the source video; or
  `guided`, MiniMax H3 reference-to-video, the clip as a video reference). The clip is
  the one video part of the request, before the face. A live face-replace run is refused
  until the founder approves a paid test (`capabilities.json` `bridge.face_replace`);
  `REQUEST_ONLY=1` writes the request it would send, with placeholder file ids, and
  spends nothing.
- At most `max_reference_images` pictures (4 on the default model); the voice clip does
  not count.
- The prompt under 5,000 characters, counted as characters; sent once, as message
  content.
- A model not in `models.json`, a length over its cap or under its minimum.

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
