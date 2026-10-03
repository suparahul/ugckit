---
name: video-plan
description: Video planning, step 2 — one finalised video idea (a handle, a date and the row in the user's plan) into brief.json — every anatomy slot chosen, the recipe, the cast, set and narrator, the facts, the screens and assets needed, the missing inputs, and up to three hook alternatives inside the chosen hook job. No script for the writing; video_plan.py checks it. No cost.
---

# Video planning, step 2 — the brief

    python3 scripts/planning/video_plan.py catalogue <slug>     the taxonomy version and digest to pin
    python3 scripts/planning/video_plan.py brief <brief.json>    the check; must pass
    python3 scripts/planning/video_plan.py reactions <slug> [--grep <word>]
                                                                 real reaction posts in research

Input: one finalised idea — the handle, the date (or the row number of an undated week) and
the row of the user's plan. The idea is already chosen; this step does not choose it.
`strategy/VIDEO-FIT.md` must have the handle's section for this video type; if not, run
`video-fit` first.

## Read, in this order

1. The fit: the handle's section of `strategy/VIDEO-FIT.md` for this video type.
2. The row: the exact row of the user's plan, verbatim, and the handle's hook table.
3. The brain: the hook job and the recipe in `brain/video-patterns.json`, the slots in
   `brain/VIDEO-ANATOMY.md`; the local overlay when it exists.
4. The handle's world, characters, narrators; the app's screen library and `APP.md`.

## The video id

`<short>-<YYYY-MM-DD>-<few words>` for a dated row (`hannah-2026-10-05-reaction-h5`);
`<short>-w<week>-<nn>-<few words>` for an undated one (`nicole-w1-01-gratitude-vettech`).
Lowercase, digits and hyphens. It is the folder name here and under `pipeline/character/`.

## Write `apps/<slug>/production/video-plans/<video>/brief.json`

    {
      "brief_version": 1,
      "video_id": "...", "app": "<slug>", "product_name": "<as APP.md>", "handle": "@...",
      "date": "YYYY-MM-DD or null",
      "strategy_ref": {"file": "...", "section": "...", "row": "<the row, verbatim>",
                       "disposition": "scheduled|candidate|stopped|avoid"},
      "taxonomy_version": "...", "catalogue_digest": "sha256:...", "local_overlay": null,
      "idea": "<one line>", "viewer_moment": "<one concrete situation>", "topic": "...",
      "metric": "<how the objective is read>",
      "anatomy": {
        "objective": "...", "distribution": "organic", "lane": "...", "filming_format": "...",
        "hook": {"job_id": "...", "channel": "...", "framing": [], "fill": {<the job's slots>}},
        "recipe_id": "...", "proof": {"kind": "...", "fact_refs": []},
        "product": {"role": "...", "name_locations": [], "speech_count": 0, "timing": "..."},
        "app_presence": "...", "viewer_task": "read|recognise|believe|null", "close": "...",
        "cast": {"kind": "human|mascot|none", "visibility": "face|hands_only|subject_only",
                 "characters": ["<id>@v<n>"], "narrator": null},
        "media": {"origin": "generated|supplied|mixed", "layout": "sequence|..."},
        "world": {"set_ids": [], "outfit_ids": [], "subject_ids": []},
        "series": "standalone", "comparison_mode": null,
        "length_band": "10|15|20|30|35-60", "length_s": 10,
        "experiment": {"axis": "none", "base_video_id": null}
      },
      "choices": [{"slot": "...", "value": "...", "status": "user|evidence|claimed|experiment|inherited",
                   "source_ids": [], "reason": "..."}],
      "hook_alternatives": [{"id": "h1", "job_id": "<the chosen job>", "text": "...", "channel": "...",
                             "fill": {...}, "note": "why, and what it changes"}],
      "selected_hook": "h1",
      "reaction_reference": {"post_id": "...", "platform": "tiktok", "handle": "@...",
                             "post_dir": "research/<project>/<app>/<handle>/<post>",
                             "video": "<post_dir>/video.mp4", "notes": "<post_dir>/notes.md",
                             "start_s": 0.0, "end_s": 2.9, "why": "...", "candidates_seen": []},
                            (only with hook channel "reaction"; null when none is found)
      "facts": [{"id": "f1", "claim": "...", "source": "<title, url or section>", "verified": false}],
      "screens_needed": [{"screen_id": "...", "job": "...", "hero_proposed": "...", "status": "indexed|missing"}],
      "assets_needed": [{"id": "...", "kind": "clip|still|screen|audio", "origin": "...", "what": "...",
                         "path": null, "status": "present|missing"}],
      "missing_inputs": [{"id": "...", "what": "...", "owner": "founder|part_a|capture|production",
                          "blocks": "lock|production"}],
      "capability": {"route": "<e.g. T → R>", "requires": [], "gaps": []},
      "limitations": ["..."]
    }

## Rules

- **The plan's words first.** A hook the plan writes is hook alternative h1, verbatim. Up to
  two more alternatives, inside the same hook job and the same body, each a different idea
  (not a changed noun), each with its reason. Never more than three; never a bank.
- **Fill slots from the plan, product facts or a source.** An elapsed time, a result, a
  credential, a request or a quotation that nobody gave is a missing input, not a fill.
- **Every slot has a value and a status.** Inherited and `user` slots name their source; an
  `experiment` slot says what the test is. Exactly one experiment axis at most.
- **Real or missing.** A screen not in the library is `missing` with the hero text the plan
  proposes, marked proposed. A real cat with no footage yet is a missing `capture`. A
  character not `live` is a `part_a` dependency; planning never starts casting.
- **Founder questions stay the founder's.** Where the plan leaves a decision open (face or
  hands, which cat, an identity), choose the option that needs the fewest new inputs, mark
  the choice `experiment` or `user`-pending with the recommendation, and list it under
  missing inputs with owner `founder`.
- **Facts are cited.** A health, risk, product or numeric claim is a fact with a source;
  `verified` stays false until someone checks it against the source.
- **A reaction hook is never spoken** (user decision, 2026-10-03). A row that says reaction,
  a reacting face or "I just found this??" takes hook channel `reaction`: a silent face, the
  hook as text. Every hook alternative is a `reaction` text.
- **A reaction comes from a real reference, never from the writer** (user decision,
  2026-10-03). Run `video_plan.py reactions <slug>` (add `--grep` with the hook's words). It
  lists downloaded posts in `research/<project>/…/<post>/` and
  `apps/<slug>/niche/batches/<date>/<handle>/<post>/` whose notes describe a reaction. Read
  the notes of the best matches. Look at the frames: `ffmpeg -t 5 -i <video> -vf
  "fps=4,scale=270:-1,tile=6x3" -frames:v 1 <scratch>/sheet.jpg` writes one contact sheet to
  a scratch folder, free and local. Pick the post whose reaction does the same hook job, with
  no speech, and fits the handle's set. Write its post id and the exact range of the
  reaction (the first and last face frame) in `reaction_reference`, and the others you saw
  in `candidates_seen`. Never write to a research folder.
- **No reference, no plan.** When no downloaded post fits, `reaction_reference` is null and
  the missing input `{"id": "reaction_reference", "owner": "founder", "blocks": "lock"}`
  says what to download. Never describe a made-up reaction.
- **The reference gives the performance, never the identity.** The face is the handle's
  approved character. Whether production may give the clip itself to the model is not
  decided; list it as a founder question, never decide it.
- Pin `taxonomy_version` and `catalogue_digest` from `video_plan.py catalogue <slug>`.

## Finish

Run `video_plan.py brief <brief.json>` until it says ok. Show the user the brief in a few
lines: the idea, the hook (selected and alternatives), the recipe, the cast, the missing
inputs. A choice that needs their decision is asked now, with the recommendation. Then run
`video-script`.
