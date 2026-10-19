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
- In a browser (headless Chrome screenshots): the studio day grid, a plan waiting (REVIEW.md,
  Approve plan), plan approved (lock
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
leg, `{ tiktok: { draft: true, is_aigc: true } }` or, direct, `{ draft: false,
privacy_status: "public", allow_comment: true, allow_duet: true, allow_stitch: true,
is_aigc: true }` with `scheduled_at`; Instagram gets `{ caption, media }`. The
`posting.sent` line also carries `video` and `sha256`. `--request` (or `REQUEST_ONLY=1`)
prints the exact bodies with a placeholder media id, needs no key and sends nothing.

### The founder's decisions (2026-10-04, third request), built

1. **The AI-generated label is on for every video post.** TikTok gets `is_aigc: true` in
   draft and in direct mode. Post Bridge's document does not say whether a TikTok draft
   carries it, so in draft mode the post page reminds: "In TikTok, turn on the
   AI-generated label before you post". Post Bridge has no AI label field for Instagram;
   the dry run says to turn it on in the Instagram app.
2. **The cover frame is each platform's default** (the hook text is on frame 1). No cover
   setting is sent.
3. **A video whose plan has a music note goes as a TikTok draft only.** Direct mode is
   refused before any call, with the reason; the page disables "Schedule direct post…"
   and says "No direct post: this video has a music note (…), so it goes as a TikTok
   draft only". In the drafts, the page reminds "Add the sound on the phone: “…”". A video
   with no music note may go direct.
4. **Duet and stitch stay on**, sent as `true` in direct mode.
5. **Instagram gets the Reel at once**, as slides do; "Do not post on Instagram" keeps one
   post off it. **Changed later the same day:** a video with a music note stays off
   Instagram by default. It goes as a TikTok draft only, and the founder posts it to
   Instagram himself, with the sound. The send leaves the Instagram leg out with that
   reason (`--only instagram` is refused too); the post page shows Instagram as "you post
   it", drops the "and Instagram" from the send button, and hides "Do not post on
   Instagram" for it. A video with no music note still goes to Instagram at once.

### Draft against direct, for a video

| | Draft (default) | Direct (scheduled) | What the Atlas does |
|---|---|---|---|
| Where it lands | the TikTok inbox; the user finishes and posts from the phone | Post Bridge publishes at the time | as for slides |
| Allowed for | every video | a video with no music note | refuses direct for a music note |
| Instagram | a video with no music note only | a video with no music note only | a music-note video stays off Instagram; the founder posts it there |
| Caption | TikTok's inbox upload of a video takes no caption in TikTok's API, so it may arrive empty | carried | the page says "paste it from the caption block" |
| Sound | the user adds it on the phone (the music note) | the file's own sound only; nothing is added | the page names the music note to add |
| Cover frame | TikTok's default (the user may change it in the app) | TikTok's default | sends no cover setting |
| AI-generated label | `is_aigc: true` sent; may not arrive | `is_aigc: true` | a reminder on the page in draft mode |
| Privacy, comments, duet, stitch | set in the app | public, comments on, duet and stitch on | as decided |
| Time | arrives when sent | `scheduled_at`, required | as for slides |
| Instagram leg | publishes when the send runs (no Instagram draft), no AI label field | at the same time | the slideshow's slot-time warning; the AI label reminder |
| The link and the outcomes | no link from Post Bridge; `sync` matches the caption through Monid (a pasted caption must be exact) | the link from Post Bridge | as for slides |

### A video against a slideshow

| | Slideshow | Video |
|---|---|---|
| Media | the slides, rendered by the compositor on each send | one file, unchanged; no compositor |
| What is checked | the deck hash in the approval | the file's sha256, against `delivery.json` and the approval |
| Caption | `final/caption.txt` from the deck | `publishing_note.caption` and the row's tags |
| Cover text | typed by hand (draft) or burned in (direct) | none: the overlays are in the file |
| Direct mode's sound | TikTok picks one (`auto_add_music: true`) | none added; a music note blocks direct mode |
| AI label | not set | `is_aigc: true` |
| Instagram | a 4:5 JPEG carousel, 10 at most; music added by hand afterwards | the same file as a Reel, its own sound, Instagram's default cover |
| TikTok draft caption | carried | may be dropped (above) |
| Limits | 10 slides with an Instagram leg | caption 2,200, 30 hashtags (Instagram), 3–600 s, 300 MB |
| Export | Export files | none: the file is `pipeline/character/<video>/final/<video>.mp4` |
| Post Bridge processing | images | `processing_enabled` left at its default (true): Post Bridge may re-encode the file before it posts it |

### Still to check on the first real send

One TikTok draft first: whether the caption and the AI label arrive, whether the size
limits hold, and how Post Bridge encodes the file.

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
| `template/atlas/lib/video-post.test.ts` (new), `package.json` | 12 tests: the rules and the founder's decisions, the request shapes, the selection, the preview, the mocked send in both modes, the music-note refusal, the Instagram drop, the dry run, the export refusal. |

## Production in the Atlas (built 2026-10-19)

The first build left production out (storyboards, segments, gates A and B, spend). It is now
on the post page, between the lock and the delivered file, so a video goes from the
approved plan to the delivered file with the Atlas as the place the user reviews and
approves. Nothing was generated and nothing was spent.

### The stages, before and after

| Stage | Before | Now |
|---|---|---|
| Video plan | shown (REVIEW.md) | unchanged |
| Plan approval | Approve plan, Send back; `video-lock --from-atlas` | unchanged |
| Shots and keyframes, gate A | not shown; the agent asked in the chat | the storyboard, every keyframe, the computed cost per segment and in total; **Approve storyboard and $x**, **Send back**; `review.py storyboard --from-atlas` pins every keyframe by its sha256 |
| Generate | not shown; a yes in the chat per run | each segment's computed cost; the storyboard approval is the yes to each first run, and a reject with "Generate it again" the yes to one more run (`character-generate`); the Atlas never runs or spends |
| Review, gate B | not shown | every take of every segment, the reference clip and the keyframe beside it, the identity gate of a face-replace take; the checks review.py needs as boxes; **Approve this take**, **Reject…** (what failed, the fix, generate again); `review.py segment --from-atlas` |
| Composite | not shown | a phone segment's composite and its gates; **Approve composite**; `review.py composite --from-atlas` |
| Assemble, gate C | not shown | the cut, its failed checks, stale when assembled from another revision; **Approve the cut** (and the grain export, when made), **Send back**; `review.py final --from-atlas`, then `deliver.sh` |
| Deliver | the player, Approve for posting | unchanged; the production stays below, folded, as the record |

The sentence under the title says the first stage that is not done and whose turn it is
(`productionStep`): "storyboard: waiting for you", "generating 01-x", "take 01-x: waiting
for you", "cut approved: being recorded", and so on.

### How a click becomes a record

The Atlas writes only log lines (`storyboard.approve|sendback`, `take.approve|reject`,
`composite.approve`, `cut.approve|sendback`), each with `data.video`. The server reads every
sha256 and cost from the files, never from the browser, and refuses early what review.py
would refuse (a missing check, a face-replace take without an identity PASS, a stale cut, a
cut while a segment is open). The agent records the line with `review.py ... --from-atlas`:
the file must still have the sha256 of the click, an agent's line (an `actor`) is never a
decision, and every gate runs as for words given in the chat. The record names the click
(`atlas_line_at`). The media route serves, besides the delivered file, only the keyframes,
the storyboard, the takes, the reference clips, the composites and the cut: never a plan,
an approval, a shot or a prompt.

### Files

| File | Change |
|---|---|
| `template/atlas/lib/video-production.ts` (new) | Reads the production; `productionStep`; the cost of one run (`runCost`, as generate.sh computes it). |
| `template/atlas/components/production/VideoProduction.tsx` (new), `VideoView.tsx`, `Actions.tsx`, `app/production.css` | The production panel; the log words. |
| `template/atlas/lib/production.ts`, `lib/video.ts` | The event kinds; `video.production`; the stage sentence and the next step. |
| `template/atlas/app/api/production/decide/route.ts` | The seven lines and their checks. |
| `template/atlas/app/media/[...path]/route.ts` | The production files. |
| `template/scripts/character/review.py` | `storyboard`, `--from-atlas` on storyboard, segment, composite and final; the sha256 of each recorded file. |
| `template/.claude/skills/character-shots`, `-generate`, `-review`, `-composite`, `-deliver`, `atlas`; `template/AGENTS.md` | The Atlas flow at each gate. |
| `template/atlas/lib/video-production.test.ts` (new), `lib/video.test.ts`; `tests/character-bridge/run.py` | 5 Atlas tests (175 in all); the harness records gate A and gate B from Atlas lines (277 expectations). |

### Still open here

- Approve and reject happen per take; there is no side-by-side compare of two takes.
- Shared segments (a `project` of another video) are shown and decided on their own video.
- A narrator's take and a supplied asset (gate B `narration`, `source`) are not on the page yet.

## Still open

- **Video export** is not built; the delivered file is the export.
- **Recreation video rows** are left out of the studio.
- At phone width the post page is wider than the screen; the slideshow page does the same, so
  this is older than this change.
- `video-plan` writes `strategy_ref.post` and `row_fields` from now on; a brief written before
  has neither, so its row is found by handle and date when it is the only one that day.
