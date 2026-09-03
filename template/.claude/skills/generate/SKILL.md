---
name: generate
description: Stage 6 — generate the video. Spends real money, so it requires explicit user approval and refuses to run without it.
---

# Stage 6 — generate

    CONFIRM=1 scripts/generate.sh <project> [template_slug]

## Which model runs

Whatever version is **active** on the `ugc-recreation` template in Supagen. The REST
endpoint ignores `version_number`, so there is no per-call override. To switch:

    activate_version(...)                             # over MCP
    scripts/state.py model set <slug> <seconds>       # keep the local record in step

`generate.sh` reads the local record for the cost quote and the duration cap, so both
must change together.

## Get approval first

Run it **without** `CONFIRM=1` first. It prints the mode, duration and computed cost, then
refuses. Show the user that output and wait for a yes. Approval of one run is not approval
of the next — a re-run needs a fresh yes.

Report cost as computed (list price × seconds), not as the figure Supagen reports.
Reported figures have been observed wrong by 2× in both directions and sometimes $0.00.

## Run it in the background

Generation takes 2–4 minutes. Start it with `run_in_background` and wait for the
notification. Do not poll with sleep.

## Guards already in the script — do not work around them

- Refuses a prompt over 5000 characters, counted correctly.
- Refuses to run reference-to-video just because `refs.json` exists; that needs
  `ALLOW_REFS=1` and a deliberate decision. Read AGENTS.md rule 1 before setting it.
- Refuses a duration above the model's measured cap.
- Sends the prompt exactly once, as message content.

## When it fails

A validation failure costs nothing — say so, so the user is not worried about money.
Show the real error. The usual causes:

- **`string_too_long`** — the prompt was sent twice because the template has
  `system_instructions` or `variables`. The template is wrong, not the prompt.
- **duration rejected as `"20s"`** — the integer was put in `duration` instead of
  `extensions.duration`.
- **401** — a mangled `.env`; run `scripts/doctor.py`.

## Finish

The script records state and cost itself. Then **go to the `review` skill.** Never
report a generation as good before looking at it.
