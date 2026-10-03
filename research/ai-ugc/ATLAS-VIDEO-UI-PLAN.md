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
   is enough for videos; Send to drafts and Export are hidden for videos. *Superseded the same
   day by the founder's second request: videos are sent through Post Bridge (§ Video posting
   below); Export stays hidden.* (d) Recreation
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
| **Approved for posting** | `ready` | `final.approve` whose hash is the delivered `sha256` (a redelivered file makes it stale) | **Send to TikTok drafts**, **Schedule direct post…**, or **Mark as manually posted** (§ Video posting) |

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

## Video posting through Post Bridge (built 2026-10-04, second request)

The slideshow's send, with the video's file. Nothing real was sent: every test uses a mocked
client, and the dry runs make no call.

**Sources.** Post Bridge's OpenAPI document (`https://api.post-bridge.com/openapi.json`, read
2026-10-04) and the client in `lib/postbridge.ts`: the upload is the slideshow's (`POST
/v1/media/create-upload-url` with `video/mp4`, its size and name, then a `PUT` of the bytes);
TikTok takes "1 `video`, or one or more `image`s"; Instagram takes "1–10 `image`/`video`"
(one video is a Reel); `tiktok.video_cover_timestamp_ms`, `allow_duet`, `allow_stitch` and
`is_aigc` exist, and `auto_add_music` is "PHOTO POSTS ONLY — has no effect on video posts";
`instagram.video_cover_timestamp_ms` and `cover_image` exist. The document states no size or
length limit. The limits below are the platforms' own for API posts (TikTok's Content Posting
API, Meta's Reels publishing), from their documents as known; TikTok's site did not answer
from here, so they are not checked against a live page.

**What a send does.** `selectSends` hashes `final/<video>.mp4` and refuses unless the hash is
`delivery.json`'s and the `final.approve` line's; the caption is `publishing_note.caption`
then the row's tags it does not carry (no caption, no send); the limits are checked
(caption 2,200 characters, 30 hashtags with an Instagram leg, 3 s to 600 s, 300 MB). The send
hashes the bytes again, uploads them once, and creates one post: the same media id on every
leg, `{ tiktok: { draft: true } }` or, direct, `{ draft: false, privacy_status: "public",
allow_comment: true }` with `scheduled_at`; Instagram gets `{ caption, media }`. The
`posting.sent` line also carries `video` and `sha256`. `--request` (or `REQUEST_ONLY=1`)
prints the exact bodies with a placeholder media id, needs no key and sends nothing.

### Draft against direct, for a video

| | Draft (default) | Direct (scheduled) | What the Atlas does |
|---|---|---|---|
| Where it lands | the TikTok inbox; the user finishes and posts from the phone | Post Bridge publishes at the time | as for slides |
| Caption | TikTok's inbox upload of a video takes no caption in TikTok's API, so it may arrive empty | carried | says "paste it from the caption block" in draft mode; to confirm on the first real draft |
| Sound | the user may add a TikTok sound in the app | the file's own sound only; nothing is added | warns; the plan's `music_note` is never applied |
| Cover frame | chosen in the app | TikTok's default | sends no `video_cover_timestamp_ms` (**decision**) |
| Privacy, comments, duet, stitch | set in the app | public, comments on; duet and stitch at TikTok's default (on) | as for slides, plus duet and stitch left on (**decision**) |
| AI-generated label | the user's toggle in the app | not set | sends no `is_aigc`; the dry run says so (**decision**) |
| Time | arrives when sent | `scheduled_at`, required | as for slides |
| Instagram leg | publishes when the send runs (no Instagram draft) | at the same time | the slideshow's warning: send at the slot time |
| The link and the outcomes | no link from Post Bridge; `sync` matches the caption through Monid (a pasted caption must be exact) | the link from Post Bridge | as for slides |

### A video against a slideshow

| | Slideshow | Video |
|---|---|---|
| Media | the slides, rendered by the compositor on each send | one file, unchanged; no compositor |
| What is checked | the deck hash in the approval | the file's sha256, against `delivery.json` and the approval |
| Caption | `final/caption.txt` from the deck | `publishing_note.caption` and the row's tags |
| Cover text | typed by hand (draft) or burned in (direct) | none: the overlays are in the file |
| Direct mode's sound | TikTok picks one (`auto_add_music: true`) | none added (photo-only setting) |
| Instagram | a 4:5 JPEG carousel, 10 at most; music added by hand afterwards | the same file as a Reel, its own sound, Instagram's default cover; the Atlas says nothing about adding music |
| TikTok draft caption | carried | may be dropped (above) |
| Limits | 10 slides with an Instagram leg | caption 2,200, 30 hashtags (Instagram), 3–600 s, 300 MB |
| Export | Export files | none: the file is `pipeline/character/<video>/final/<video>.mp4` |
| Post Bridge processing | images | `processing_enabled` left at its default (true): Post Bridge may re-encode the file before it posts it |

### Decisions for the founder

1. **The AI-generated label** (`is_aigc`, TikTok direct posts). Not set now. TikTok asks for a
   label on realistic AI-generated content; the character videos are generated people.
2. **The cover frame.** Not set now (each platform's default). Options: a fixed time, or a
   frame chosen per video in the plan.
3. **Music on a direct post.** The file is music-free by the pipeline's rule, so a direct
   video posts with the voice only. Options: post music videos in draft mode only, or let
   the pipeline mix the music in.
4. **Duet and stitch** stay on (TikTok's default).
5. **Instagram for videos.** Each video goes to Instagram at once when the handle has an
   account, as slides do; `leg.drop` or `--only tiktok` keeps one off.
6. **The first real send** should be one draft, to check the caption question, the size
   limits and Post Bridge's re-encoding, before a direct post.

### Changed files

| File | Change |
|---|---|
| `template/atlas/lib/video-post.ts` (new) | The caption, the limits, the checks and the warnings. |
| `template/atlas/lib/postbridge.ts` | `legsPost` `kind: "video"`; `postBody`; the cover fields in the types. |
| `template/atlas/lib/postbridge-flow.ts` | The video branch of `selectSends`, `sendPost` (`sendVideo`), `bridgeInfo` (`videoSkip`), `sendWarning`, `postingNotes`; `videoRequest`, `requestPreviews`; an injectable client for tests. |
| `template/atlas/lib/video.ts` | `finalFileOf`. |
| `template/atlas/lib/production.ts` | The ready sentence is the slideshow's. |
| `template/atlas/scripts/postbridge-send.mjs` | The video's dry-run lines; `--request` / `REQUEST_ONLY=1`. |
| `template/atlas/components/production/Bridge.tsx`, `Legs.tsx`, the post page | The slideshow's send buttons for a video, no Export; the video's words. |
| `template/.claude/skills/post`, `character-deliver`, `atlas`; `template/AGENTS.md` | "A video post"; the hand-over from `final/`. The recreation `deliver` skill is unchanged: recreation rows stay out of the studio. |
| `template/atlas/lib/video-post.test.ts` (new), `package.json` | 10 tests: the rules, the request shapes, the selection, the preview, the mocked send in both modes, the dry run, the export refusal. |

## Still open

- **Video export** is not built; the delivered file is the export.
- **Recreation video rows** are left out of the studio.
- At phone width the post page is wider than the screen; the slideshow page does the same, so
  this is older than this change.
- `video-plan` writes `strategy_ref.post` and `row_fields` from now on; a brief written before
  has neither, so its row is found by handle and date when it is the only one that day.
