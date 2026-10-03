# Atlas: video content pieces next to slideshows — plan and build

Status: **built** on branch `ai-ugc-character-pipeline`, 2026-10-04, after the founder's decisions
(below). The first version of this file was the plan; this version records the decisions and what
was built. No production code under `template/scripts/character/` was changed. Nothing was spent.

Scope (the founder's three points): a studio plan row can be a video; a video goes through the
same four states as a slideshow (idea approved, plan approved, ready for posting, approved for
posting); the finished video shows in the slideshow's slot, with no slide navigator. Out of scope:
storyboards, segments, gates A and B, spend, generation progress, the idea decision.

## Founder decisions (2026-10-04)

1. **Video idea fields live in the plan row**, in explicit optional columns, generic for any
   user (nothing reads `HANDLE-STRATEGIES.md`). Required: handle, date and slot, `Kind` = `video`,
   `Video type`, the idea in one line (`Topic`). Useful: `Source`, the five `Tags`. Optional:
   `Hook` (text), `Hook job` (one of the twelve), `Length`. A filled optional field is a user
   decision that `video-plan` keeps verbatim with status `user`; an empty one is `video-plan`'s.
   No other anatomy slot is asked at the idea step. Old plans stay readable.
2. **Caption:** `plan.json` `publishing_note.caption`, shown where a slideshow shows its caption.
3. **After the lock**, beside the frame or the player: the locked plan's beats in order (time,
   the spoken line or the action, the on-screen text) and the per-shot prompts once production
   wrote them. No storyboard, gates, spend or generation progress.
4. (a) An **Approve plan** button in the Atlas, as for slideshows; `video-lock` accepts the Atlas
   `plan.approve` line as the user's approval. (b) Keep both: production gate C stays in
   production; **Approve for posting** is the Atlas posting approval. (c) **Mark posted** by hand
   is enough for videos; Send to drafts and Export are hidden for videos. (d) Recreation
   (`originate`) video rows are left out of the studio for now.

## The studio plan row

`apps/<slug>/production/PLAN.md`, posts table. The parser finds every column after `Arm` and
`Source` by its header, so order is free and an old table (no such columns) builds exactly as
before (checked: the real catwise plan builds byte-identical apart from `generatedAt`).

    | Day | Date | Handle | Slot | Topic | Format / variation | Arm | Source | Tags | Kind | Video type | Hook | Hook job | Length |

| Column | Values | Source of the controlled values |
|---|---|---|
| `Kind` | `slideshow` (default, also when the column is absent) or `video` | — |
| `Video type` | a `filming_format` (`talking_head`, `hook_to_demo`, `live_use`, `before_after`, `text_over_action`, `voiceover_action`; alias `face_to_demo`) or `reaction` (the hook channel) | `brain/video-patterns.json` `slots.filming_format`, `aliases`, `slots.hook_channel` |
| `Hook` | the hook text, verbatim | the user |
| `Hook job` | one of the twelve hook jobs | `brain/video-patterns.json` `patterns` of kind `hook` |
| `Length` | a length band (`10`, `15`, `20`, `30`, `35-60`) or seconds | `slots.length_band` |

An unknown value is a build warning, never a refusal. A `video` row whose `Format / variation`
names `originate` is left out (one build note). An old plan's video id in `Format / variation`
still counts.

**Which video a row is:** the id in `Format / variation` (old plans); else the brief whose
`strategy_ref.post` is the row's key `<date>/<short>/<n>` (`video-plan` now writes it); else the
one brief for the row's handle and date.

## The four states (the slideshow's stages, unchanged)

| Founder's state | Stage | Video rule | What moves it on |
|---|---|---|---|
| (waiting) | `idea` | no `idea.approve`, no `brief.json` | **Approve idea** (same button, same line) |
| **Idea approved** | `planned` | idea approved (or `brief.json` on disk, as a deck on disk counts), no `plan.draft.json` yet: "script being written" | the agent: `video-plan`, `video-script` |
| (plan waiting) | `plan` | draft and `REVIEW.md`, not approved: "plan: waiting for you"; or locked and the draft has a newer revision: "plan changed after the lock" | **Approve plan** writes `plan.approve` with `data: {video, revision, digest}` from `REVIEW.md`; **Send back** writes `plan.sendback` with `data.revision` (a new revision clears it) |
| **Plan approved** | `final`, no file | an Atlas approval of `REVIEW.md`'s digest ("plan approved: lock being written") or a real lock (`planning-approval.json`, not a dry run, with words, for `plan.json`'s revision: "in production") | the agent: `video-lock --from-atlas`, then production (gates A, B, C, `deliver.sh`) |
| **Ready for posting** | `final`, file present | `final/<video>.mp4` and `final/delivery.json`: "final: waiting for you" | **Approve for posting** (`final.approve`, `hash` = the file's `sha256`); **Send back** |
| **Approved for posting** | `ready` | `final.approve` whose hash is the delivered `sha256` (a redelivered file makes it stale) | **Mark posted** by hand |

`posted`, `read` and `killed` are the slideshow's.

## The slot

- Before the plan is approved: the idea panel (the row's video fields; an empty optional field
  reads "chosen by video-plan"), then `REVIEW.md` once it exists, with its revision and digest.
  "view as plan" shows `REVIEW.md` later too.
- After: a 9:16 frame on the left, with the delivered file in a `<video>` player
  (`/media/pipeline/character/<id>/final/<id>.mp4?v=<sha12>`), or an empty frame that says the
  video is in production. On the right, the locked plan's beats in order (time and role, the
  spoken lines with their speaker, the action, the overlays that start in the beat as "On
  screen") with each beat's production prompt folded under it (`video.json` segments by
  `beat_ids`, `segments/<nn>-<type>/prompt.txt`). Below, the caption block of a slideshow: the
  handle, `publishing_note.caption` and the row's tags, `publishing_note.music_note` or "sound
  not chosen". No slide navigator, no keys, no text toggle.
- The media route serves one more path, `pipeline/character/<id>/final/<id>.mp4` (byte ranges,
  as for research videos). Every other file under `pipeline/` is refused (403).

## What changed

| File | Change |
|---|---|
| `template/atlas/lib/video-row.ts` (new) | The posts table's `Kind`, `Tags` and video columns by header; the brain's controlled values; warnings. |
| `template/atlas/scripts/build-production.mjs` | Reads them; writes `kind`, `video`, `tags`, `videoId` on video rows only; leaves `originate` rows out. |
| `template/atlas/lib/video.ts` (new) | Reads a video's files at request time; the video id; `REVIEW.md`'s revision and digest; the beats with overlays and prompts; `videoPlanPoint`, the plan gate. |
| `template/atlas/lib/root.ts` | `CHARACTER_DIR`. |
| `template/atlas/lib/production.ts` | `PlanRow.kind/video/tags/videoId`, `PostState.video`; the video branch of the idea, plan and final gates, the stage sentences, `finalBlock`, `primaryAction`, `nextStep`; 9:16. |
| `template/atlas/app/api/production/decide/route.ts` | `plan.approve` records `{video, revision, digest}`; `plan.sendback` records the revision; `final.approve` records the file's `sha256`. |
| `template/atlas/app/media/[...path]/route.ts` | Serves the delivered file only. |
| `template/atlas/components/production/VideoView.tsx` (new), `PostViews.tsx` | The slot; the video fields in the idea panel. |
| `template/atlas/components/production/Actions.tsx`, `Bridge.tsx` | Mark posted (and add the link) only for a video; no Export after posting. |
| `template/atlas/lib/postbridge-flow.ts`, `lib/export-flow.ts` | The send and the export refuse a video post with a plain reason; no slide note on a video. |
| `template/atlas/components/production/Board.tsx`, the post page | "video · <type> · 9:16"; the empty thumbnail says idea, script, plan, video or video ✓. |
| `template/atlas/app/production.css` | The frame, the beats, `REVIEW.md`. |
| `template/scripts/planning/video_plan.py` | `lock --from-atlas` (`atlas_approval`: the last plan line for the video, by the user, for this revision and digest; words are the click's note or "Approve plan (clicked in the Atlas on revision N)"; the approval file gets `approved_in.atlas_line_at`); `check_row_fields` in `brief` (each filled row field kept, status `user`). |
| `template/.claude/skills/plan`, `video-plan`, `video-lock`, `atlas`; `template/AGENTS.md` | The video row and its columns; `strategy_ref.post` and `row_fields`; the Atlas approval; one line each. |
| `template/atlas/lib/video.test.ts` (new), `package.json`; `tests/video-planning/run.py` (new) | Tests. |

## Tests

- Atlas: `cd template/atlas && npm test`: 101 pass (92 before, 9 new in `lib/video.test.ts`: the
  columns, an old table, the id, `REVIEW.md`, the beats, the lock checks, every state, stale and
  send-back, a slideshow row untouched). `npx tsc --noEmit` clean.
- Planning: `python3 tests/video-planning/run.py`: 20 of 20 (`atlas_approval`, `check_row_fields`).
- Offline harness: `tests/character-bridge/run.py --venv <venv with opencv>`: 215 of 215, before
  and after.
- Lock end to end (scratch copy of the harness workspace): a send-back line, then a line with
  another digest, are refused; the real line locks, and `bridge.py plan` accepts the approval.
- Slideshow regression: the real catwise plan builds identical data.
- In a browser (headless Chrome screenshots; the gstack `/browse` skill is not installed on this
  machine): the studio day grid, a plan waiting (REVIEW.md, Approve plan), plan approved (lock
  being written), in production (empty frame, beats, prompts, caption), ready for posting (the
  player plays the file, Approve for posting), approved for posting (Mark posted only). The
  decide route, the send and export refusals and the media route (200, 206 on a range, 403 on
  `plan.json` and on an escape) were called directly.

## Still open

- **Sending a video through Post Bridge** (and an export) is not built: Mark posted by hand.
- **Recreation video rows** are left out of the studio.
- At phone width the post page is wider than the screen; the slideshow page does the same, so
  this is older than this change.
- `video-plan` writes `strategy_ref.post` and `row_fields` from now on; a brief written before
  has neither, so its row is found by handle and date when it is the only one that day.
