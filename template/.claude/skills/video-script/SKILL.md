---
name: video-script
description: Video planning, step 3 — the brief into plan.draft.json and REVIEW.md: one full script with the exact words, the delivery, the visible action and the time of every beat, the timed overlays, the app screens and the proof. The video's equivalent of a deck's text before its pictures. One script, not a bank. video_plan.py checks the contract and writes REVIEW.md. No cost.
---

# Video planning, step 3 — the script

    python3 scripts/planning/video_plan.py check  <plan.draft.json>   the planning contract; must pass
    python3 scripts/planning/video_plan.py review <plan.draft.json>   writes REVIEW.md from the exact draft
    python3 scripts/planning/video_plan.py ready  <plan.draft.json>   what is still missing (changes nothing)

Input: `apps/<slug>/production/video-plans/<video>/brief.json`, checked. Output, in the same
folder: `plan.draft.json` (the v2 plan, without `approved`) and `REVIEW.md` (written by the
script, never by hand).

## Read, in this order

1. The brief, every field. The selected hook is the one written; the alternatives are not.
2. The recipe's beats in `brain/video-patterns.json` and the slot rules in
   `brain/VIDEO-ANATOMY.md`.
3. The character's voice profile (`creator.json` `voice_profile`: one opener, the words she
   never says) or the narrator's profile; the handle's `HANDLE.md` voice.
4. The real screens in `apps/<slug>/screens/screens.json`: the job, the events, the hero
   text exactly as the app shows it. Supplied clips: their source metadata and ranges.

## Write `plan.draft.json` — the v2 contract

Keep every v1 field of `docs/character/plan.example.json` with its meaning; add the v2
fields. Production's check is `scripts/character/bridge.py`; the schema, when shipped, is
`docs/character/plan.schema.json`.

    {
      "schema_version": 2, "revision": 1,
      "video_id": "...", "app": "<slug>", "handle": "@...",
      "characters": ["<id>@v<n>"] or [],
      "format": {"dimension": "9:16", "length_s": <number>},
      "app_insertion": true|false,
      "script": [{"id": "l1", "speaker": "<character id>|vo", "line": "<frozen words>",
                  "delivery": "<which word lifts, where it slows, the breath>"}],
      "beats": [{"id": "b1", "role": "<recipe role>", "start_s": 0, "end_s": 4,
                 "lines": ["l1"], "action": "<what the viewer sees>",
                 "performance": "on_camera|voiceover|silent_action",
                 "framing": "face|hands_only|subject_only", "layout": "sequence|split_screen|picture_in_picture",
                 "media_origin": "generated|supplied|mixed",
                 "app_on_screen": false, "screen_id": null, "viewer_must": null,
                 "fact_refs": [], "source_asset_ids": [], "subject_ids": [], "set_id": null}],
      "set": {"<character>": "<set-id>"}, "outfit": {"<character>": "<outfit-id>"},
      "hero_strings": {"<screen id>": "<exact string, or null until the real screen is indexed>"},
      "source": "<the plan row and the source post or research>",
      "editorial": {"objective", "distribution", "lane", "filming_format",
                    "hook": {"job_id", "channel", "framing": []}, "recipe_id",
                    "product": {"role", "name_locations": [], "speech_count", "timing"},
                    "app_presence", "proof": {"kind", "fact_refs": []}, "close", "cast_kind",
                    "narrator_ref", "series", "comparison_mode",
                    "experiment": {"axis", "base_video_id"}, "strategy_ref", "evidence_ids": [],
                    "taxonomy_version", "catalogue_digest"},
      "overlays": [{"id", "role", "text", "start_s", "end_s", "placement", "panel_id"}],
      "assets": [{"id", "kind", "origin", "path", "sha256", "source_url", "permission_ref",
                  "subject_ids", "set_ref", "trim_s", "screen_id", "paired_input_ref"}],
      "narrators": [{"id", "kind", "character_ref", "voice_ref", "source_ref", "credential_ref"}],
      "publishing_note": {"caption", "bio_ref", "music_note"}
    }

A value that only a real input can give (a hero string, a file path and checksum, a measured
live time) is `null`, never `<…>`, and the brief lists it under missing inputs. `ready`
reports every one.

## How to write it

- **Beats are the recipe's roles, in order.** Several beats may share a role where the
  recipe repeats it; a beat is a semantic job, not a shot. Beats meet end to start, from 0
  to the length; simultaneous media are panels inside one beat.
- **Exact words, a person's words.** Read every line aloud. At most 15 words per 4 s of its
  beat; leave room for a breath where the delivery needs it. The voice profile's never-say
  words never appear. No filler closer.
- **Every beat has an action**: what the viewer sees, concrete enough for P1 to cut and for a
  reviewer to check. Silent beats say what moves.
- **The app is real.** An app beat names its `screen_id` and `viewer_must`; the hero string
  is copied from the real screen, never from the plan's proposal. No overlay carries the
  app's words.
- **The name**: count the lines that say it; `speech_count` and `name_locations` agree with
  the words. The first beat does not name the app unless product timing is `opening`.
- **Numbers and claims** carry `fact_refs` to the brief's facts, or come from the real screen.
- **Overlays**: exact text, start and end, placement never in the caption band, up long
  enough to read (words ÷ 3 s). A spoken hook needs no hook overlay; a text hook needs one
  in the first beat.
- **Cast and world**: the exact fixed subjects of each beat, by id; one set and one outfit
  per generated character; a real animal only in supplied beats.
- **Feasibility, not shots.** Generated stretches of 3 s or more; supplied clips inside their
  ranges; a 35–60 s video in several segments joined at sentence ends. P1 decides the cut.

## Finish

1. `video_plan.py check` until it says ok.
2. `video_plan.py review` writes `REVIEW.md`: the slots and reasons, the full words, the beat
   timeline, the name and placement, the overlays, the bindings, the facts, what is still
   needed, and the content digest.
3. Show the user `REVIEW.md` in full. Changes go into the draft; raise `revision` once a
   revision has been shown, then `review` again. Then run `video-lock`.
