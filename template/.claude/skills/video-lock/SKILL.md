---
name: video-lock
description: Video planning, step 4 — show the exact draft for the user's approval, then write pipeline/character/<video>/plan.json and planning-approval.json with their words, and stop at the handoff. Refuses while the contract fails or a real input is missing. Never starts production. No cost.
---

# Video planning, step 4 — the lock

    python3 scripts/planning/video_plan.py ready <plan.draft.json>
    python3 scripts/planning/video_plan.py pin   <plan.draft.json>      fills supplied files' sha256
    python3 scripts/planning/video_plan.py lock  <plan.draft.json> --digest <hex> --words "<the user's words>" --date YYYY-MM-DD

The one human gate of planning. Plan approval approves the words, the actions, the timing,
the cast and the sources of one revision. It does not approve a storyboard, a keyframe or a
cost: those are production gates.

## Steps

1. **Ready.** Run `ready`. *Blocking* inputs stop the lock: a screen not in the library, a
   hero string not copied from it, a supplied file not on disk, a missing permission, a live
   time not measured, a fact not verified. *Dependencies* do not stop the lock; production
   stops on them: a character not `live` (part A), a set or subject not in `world.json`, a
   narrator voice not approved, a bridge capability production has not declared. Say each
   one in one line with its owner. Never drop a requested format to pass.
2. **Pin.** When supplied files exist, run `pin`, then `video_plan.py review` again: the
   checksums are part of what is approved.
3. **Show.** Show `REVIEW.md` in full, with its revision and content digest. Ask for
   approval of that revision in the user's own words. A change request goes back to
   `video-script`; it is a new revision.
4. **Lock.** With the user's words and the date, run `lock` with the digest from the
   `REVIEW.md` they approved. The script refuses when the draft changed after the review,
   when the contract fails, when a blocking input is missing, or when an older plan for the
   same video has the same revision with other content. It writes
   `pipeline/character/<video>/planning-approval.json`
   (`{video_id, revision, content_sha256, words, date, evidence_snapshot_digest}`) and
   `plan.json` (the draft plus `approved: {words, date}`), each atomically.
5. **Stop.** Say the files, the revision and the dependencies left, and that production
   starts with `character-shots` (P1). Do not run `shots.py check` (it starts production
   state), `character-shots` or any other production step from here.

## Rules

- The words are the user's, quoted exactly. Never write approval words for them, never infer
  approval from silence or from "looks good" on an older revision.
- A changed approved plan (words, actions, timing, cast or narrator, sources, series state,
  layout, placement, overlays) is a new revision and a new approval. Production files of an
  older revision are stale.
- A dry run (`--dry-run`) writes the plan with `approved` words null and
  `"dry_run": true` in the approval file. Production refuses it. Use it only to show the
  handoff while inputs are missing.
- Planning state is the files: a draft without a plan is in review; a plan with its approval
  file is locked. There is no separate planning state; `pipeline/character/state.json`
  belongs to production.

## Finish

Report: the video id, the revision, the digest (12 characters), the approval words and date,
and the dependencies production will meet, one line each.
