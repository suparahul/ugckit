# Atlas: the video post page, cleaned up

Status: **built 2026-10-21** on branch `atlas-video-page-cleanup` (from `atlas-niche-video-player`).
Screenshots before and after: `research/ai-ugc/cleanup-screenshots/`.

The three pages audited (organic-factory, Catwise, 20 October):

| page | state | before | after |
|---|---|---|---|
| @hannah.catmom · "leaving my cat with a sitter tomorrow and I JUST found this" | plan approval, one dependency | 7,452 px | 1,751 px |
| @mangoandpepper · "3 weeks with my first kitten and I JUST found this??" | keyframes, gate A | 2,653 px | 2,427 px |
| @leo.catdad · "Meows non-stop at night" | plan approval, blocked by 4 inputs | 7,253 px | 1,485 px |

## 1. Audit: what is repeated, what is raw

**The same status, four times.** The head says "plan: waiting for you"; the YOUR TURN bar says
"Read revision 1 of the plan. Approve it, or send it back with a note. The agent then locks it
(video-lock)"; the stages block says "Now: Approved: read the plan; approve it, or send it back
with a note"; the panel heading says "2 · Plan approval — you — read the plan; approve it, or send
it back with a note". Stage 2 is named "Approved" while it waits, so "Now: Approved: read the plan"
contradicts itself.

**The content, four times.** The beats are in the left timeline (every beat with its whole
description, text, sound, app, 130 px a beat at least), in REVIEW.md "Beat timeline" (a nine-column
table), in REVIEW.md "The app demo" (step tables, word for word), and, after the lock, in "The
beats · the locked plan" beside the empty frame. The reaction is in the timeline's compact card,
in the stage panel's full card, and in REVIEW.md "The reaction". The segment table, the timeline
and the "Shots and keyframes" cards show the same segments three ways.

**The problems, twice.** "Blocking the lock" and "Dependencies for production" are in the stage
panel and again at the end of REVIEW.md, and the blocking list is repeated a third time in the
YOUR TURN bar's disabled-button reason, raw ("screen leo-…-capture: not in
apps/catwise/screens/screens.json (record it, then `screens`; …)"). On the Leo page that reason
breaks the bar's layout: the sentence is squeezed to one word a line.

**Raw text in the main view.** File names (plan.draft.json, REVIEW.md, screens.json,
pipeline/character/…/final/….mp4), digests ("digest 88511b2c5aeb" twice), skill and script
names ("video-lock", "character-shots", "gate A", "generate.sh", "state.json"), segment codes
("01-x X motion copy", "02-r R"), role codes ("use_reveal"), "n/a" and "–" cells, backticks.

**Walls of text.** The whole REVIEW.md (slots table, the raw PLAN.md row, facts, checks) is open
under everything; the timeline column is 360 px wide and holds 100-word descriptions.

## 2. What goes where

Removed from the main view (kept, folded, under **Details**):

- REVIEW.md in full, its revision and digest, the plan's source file.
- The segment table (segment, keyframe, take, gate B, composite, in the cut).
- The brief's choices, facts, screens and assets, limits, and the notes where state.json
  disagrees with the approvals.
- The "Now" sentence and the per-stage words in full.

Removed as duplicates (shown once elsewhere):

- The YOUR TURN bar's long sentence: one status sentence in the head.
- The panel heading's state words: the heading names the stage's action.
- The reaction card on the timeline: the stage panel shows it at stages 1 and 2; the
  timeline keeps the reference clip as the beat's picture.
- "The beats · the locked plan" beside the frame: the timeline is the beats.
- The empty 9:16 frame with its file path: the timeline carries the pictures until the file
  is delivered; the delivered file plays in the Deliver panel.
- The blocking list in the button's reason: the button says "4 inputs missing"; the list is in
  the panel, once, in plain words.

Plain words instead of codes:

- Stage names: Plan, Approve, Keyframes, Generate, Review, Composite, Cut, Deliver. The stage
  state words: done, your turn, agent, blocked, sent back, stale, recording, skipped.
- Beat roles: attention → "the hook", use_reveal → "the app appears", result → "the result".
- ready.json lines rewritten (`lib/plain-words.ts`): "Screen X has no recording in the screen
  library. Record it, or switch the beat to motion design." Everything else: no backticks,
  no paths, a capital and a full stop.
- The cost words stay ("$0.50 of first runs"): they are the user's yes to spending.

## 3. Layout

```
‹ Prev                 Tue 20 Oct · 11 of 15                Next ›
(face) @hannah.catmom · main persona · connected
leaving my cat with a sitter tomorrow and I JUST found this
AM · video · reaction · 20 s · 9:16                            ⋯ (view as plan · kill this post)
WAITING FOR YOU  Approve the plan, or send it back with a note.

1 Plan ✓ · 2 Approve ● your turn · 3 Keyframes · 4 Generate · 5 Review · 6 Composite · 7 Cut · 8 Deliver

┌ Approve the plan · revision 1 ─────────────────────── [Approve plan] Send back ┐
│ Before production                                                              │
│  ! The reaction clip has burned-in text ("i'm leaving for PARIS…"). Production  │
│    masks it; on the motion route only the motion is used. Or choose a clean clip.│
│ The reaction · @aurora.traveltips · 0–3.25 s   [card, once]  Switch reaction   │
└────────────────────────────────────────────────────────────────────────────────┘

The video · 20 s · 3 beats
[thumb] 0–3.3 s · the hook          [thumb] 3.3–8.3 s · the app appears   [thumb] 8.3–20 s · the result
Hannah in her small white kitchen,  Full screen: the lock screen of…      Full screen: Barnaby's Routine…
▸ more                              ▸ more                                ▸ more

Caption (once the plan is locked): @hannah.catmom · the caption · the sound

▸ Details · the plan as written (revision 1), the segments, the facts, the files
▸ Anatomy and rules
▸ Log · 0 lines
```

At stages 3 to 7 the panel is the stage's own cards (keyframes, takes, composites, the cut)
with their buttons at the bottom of the panel; the head's status line says whose turn it is.
At stage 8 the panel plays the delivered file beside Approve for posting; after the final
approval the posting rail (send to drafts, mark posted, outcomes) sits in the same place.
Killed, sent back and changed-since bands stay as they are. The slideshow page keeps its
decision bar; its Kill this post moves into the same ⋯ menu so the two pages match.

Nothing a button sends changes; the decide route is not touched. Every stage's panel is still
reachable from the rail (`?stage=N`), and every segment card by `?seg=`.

## 4. Result

Measured at 1,280 px wide, full page, in headless Chrome (`cleanup-screenshots/`):

| page | before | after | what the after page holds |
|---|---|---|---|
| Hannah, plan approval | 7,452 px | 1,751 px | head, status line, rail, the Approve panel (one warning, the reaction card, the buttons), three beat cards, three folded blocks |
| Mango, keyframes | 2,653 px | 2,427 px | the same, with the storyboard panel (two shot cards, the cost, the buttons) and the caption card |
| Leo, blocked | 7,253 px | 1,485 px | the four missing inputs in plain words, the button off with "4 inputs missing", three beat cards |
| Hannah 10-19, posted (extra) | — | 2,067 px | the reads strip, the Deliver panel with the file and the posting rail |

The Mango page was short before because its stage panel was already the storyboard; what
changed there is the removal of the segment table, the second beats list, the empty frame and
the raw codes.

Code: `lib/plain-words.ts` (the status sentence, the stage words, the problem lines; tested in
`lib/plain-words.test.ts`), `components/production/VideoView.tsx` (the panel, the strip, the
caption, Details), `VideoStages.tsx` (the rail, the segment table), `Timeline.tsx` (the cards),
`Actions.tsx` (`KillMenu`, `noKill`), the post page, `app/production.css`. Stage 2's short name
is "Approve" (`lib/video-stages.ts`); the two tests that asserted "Approved:" say "Approve:".

Not done: the slideshow page keeps its decision bar (only Kill this post moved into the ⋯ menu);
REVIEW.md itself is unchanged and still raw inside Details; the Next.js dev overlay in the
screenshots is the dev server's, not the page's.
