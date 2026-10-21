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

## 5. The stage panels, one pass (2026-10-21, second round)

The rule: a stage panel shows what the user decides in that stage, plus the context needed to
decide; everything else folds or waits for its own stage. And no file is shown twice on one page
as if it were two things.

What each panel shows now, and what moved:

| stage | in view | folded (one click away) | gone from here |
|---|---|---|---|
| 3 Keyframes (gate A) | one card per generated shot: the keyframe, one plain line of what the shot is for, the cost a run, "Redo this keyframe"; the reference pose, small, labelled "Reference pose: the keyframe should match this pose"; one quiet line for the segments that need no keyframe; the cost line; Approve / Send back | "About this shot" (timing, framing, references, subjects, lines); "The decision as recorded" (the gate's words); the storyboard sheet as a link, only with two or more keyframes | the storyboard image (it repeated the keyframe); the card of the screen segment with its empty frame |
| 4–5 Takes (gate B) | the take in focus, the reference clip, the approved keyframe, the seam frame; the identity gate; the checks and Approve / Reject; the motion design's render and its gates while the decision is open | "About this shot, and the decision as recorded"; the contact sheet; the panels of a panel segment; "How it was made" (the screens, the story, the stills, the gates once approved) | the pose picture (the reference clip's first frame, shown beside the clip itself); the screen recording card with "Nothing to approve before the cut" (now one quiet line); the long motion-design paragraph |
| 6 Composite | the composite, then the approved take it is built on; Approve / Send back | the contact sheets | — |
| 7 Cut | the cut (the strip follows it), the checks and the watch-it-whole line while the decision is open; Approve / Send back / Regenerate one segment | "The file, the contact sheet, the checks and the decision as recorded" once approved | the file name and checksum in the caption |
| The video (the strip) | one card per segment that spans its beats: the range, the roles in words, one line per beat | "more": every beat's text, sound, app, the segment link, and every picture | the pictures in the cards (they repeated the panel's keyframe, the reaction clip, the delivered video); the strip's own player (the panel's player leads) |

Two reading fixes on the way: a segment with an approved take now shows that take in focus
(before, an older undecided take took the focus and the panel asked you to approve it), and the
approved tag says "approved: take 2", not the file name.

Measured at 1,280 px wide (`cleanup-screenshots/stages/`, before and after):

| page | before | after |
|---|---|---|
| Latte 10-21 AM, gate A | 2,406 px | 1,778 px |
| Mango 10-21 AM, gate A | 2,427 px | 1,818 px |
| Mango 10-19 (delivered), stage 3 | 2,853 px | 1,909 px |
| Mango 10-19, stage 4 | 3,497 px | 2,286 px |
| Leo 10-19, stage 5 | 3,341 px | 2,243 px |
| Mango 10-19, stage 6 | 1,933 px | 1,421 px |
| Mango 10-19, stage 7 | 2,583 px | 1,841 px |
| Mango 10-19, stage 8 | 2,067 px | 1,850 px |

Code: `lib/plain-words.ts` (`groupBeats`, `purposeLine`; tested), `components/production/Timeline.tsx`
(one card per segment, no pictures in the cards), `VideoProduction.tsx` (the panels),
`VideoView.tsx` (passes the beats to the panels), `app/production.css`. Nothing a button sends
changes; the decide route is not touched.

## 6. One document (2026-10-21, the redesign; mockup first)

The page so far was built from blocks that each describe the same video: a plan box with the
button, a strip of beats under it, stage panels that repeat the plan. At the storyboard stage
the new thing (the keyframe) was lost among the repeats, and the strip gave each beat too little
room to read. This section starts again from one idea.

**The video is one document, read top to bottom. Every stage adds to it.**

### 6.1 The layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ @hannah.catmom · main persona                                           ⋯ menu   │
│ leaving my cat with a sitter tomorrow and I JUST found this                      │
│ Day 36 · AM · video · 20 s · reaction      Plan ● · Keyframes · Generate · … (7) │
├══════════════════════════════════════════════════════════════════════════════════┤
│ DECISION BAR (sticky)  Approve the plan, revision 1, or send it back with a note. │
│                        warnings: 1 before production      [Approve plan] [Send back…] │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 0.0–3.25 s │ THE HOOK · the words on screen, big                │ media of the   │
│ the hook   │ what the viewer sees, in full                      │ current stage  │
│            │ the reaction, compact (handle, range, the beats)   │ for this part  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 3.25–8.25 s│ THE APP · Routine Reminders · rebuilt and animated │ quiet line, or │
│ the app    │ step 1 at 3.25 s: the screen appears · reads “…”   │ the render     │
│ appears    │ step 2 at 4.75 s: …                                │                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 8.25–20 s  │ THE RESULT · Routine Task Cards · the steps        │                │
│ the result │ The result, word for word: “5 of 5 done”           │                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ caption    │ the caption, the tags, the sound                   │                │
├──────────────────────────────────────────────────────────────────────────────────┤
│ ▸ Details · the plan as written, the segments, the files, the checks             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Full width. No box in the middle. No second list of beats anywhere: the rows are the only list
of the video's parts, and every stage reads the same rows.

### 6.2 The row anatomy

A row is one part of the video in time order: the hook, the reaction (when it is its own
part), each app screen, the card, the close, then the caption. A row has three columns:

| column | holds |
|---|---|
| time (left, 110 px) | the range, the role in words ("the hook", "the app appears", "the result"), and the segment code small |
| content (middle, the rest) | the words on screen in full; what the viewer sees, in full; for an app part, the source in one line ("rebuilt from the app's real screens and animated" or "a real screen recording"), then every step with its time and the strings the viewer reads at that step; for the result, the hero string word for word; the sound when there is one |
| media (right, 300 px) | what the current stage adds for this part, or one quiet line saying why there is nothing |

The row keeps its content from stage to stage. Only the media column changes. Technical fields
(framing, references, file names, digests, the gates' detail) are not in the row; they are in
Details at the end.

### 6.3 What each stage shows in the media column

| stage | hook / reaction part | app parts (screen, card) | supplied parts | the bar |
|---|---|---|---|---|
| 1 Plan | the reference clip, paused at its start, with the handle and range; or "no reference chosen" | nothing ("the picture comes with the keyframes" in grey) | the supplied file | Approve the plan, revision N · Send back… · the blocking inputs count when it is off |
| 2 Keyframes | the keyframe, large; the reference pose small under it, labelled; "Redo this keyframe…" | "The app screen needs no keyframe: it is rebuilt at the cut." (quiet) | "Supplied: no keyframe." | Approve the storyboard · the first runs cost $N · Send back… |
| 3 Generate | the keyframe, dimmed, with "generating… $N computed" | quiet | quiet | no decision: "The agent generates 01-x ($0.50 computed)." |
| 4 Review | the take, with the reference clip and the keyframe small beside it; the identity gate line; the checks; Approve this take / Reject… in the row | the motion render with its gates; Approve / Reject in the row | the source with Approve / Reject | "N items wait for you" with a jump to the first; no bar buttons (the decisions are per row) |
| 5 Composite | the approved take, quiet | the composite with Approve / Send back in the row | quiet | "N composites wait for you" with a jump |
| 6 Cut | one full-width row above the parts: the cut, playing; each part's media shows its approved take or composite, and a "play from 3.25 s" link that jumps the player | the same | the same | Approve the cut · Send back… · Regenerate one segment… |
| 7 Deliver | the same as the cut, with the delivered file in the top row | the same | the same | Approve for posting · Send back… · the posting rail (drafts, direct) · the reads strip once posted |

A part a stage does not touch stays in view with its content and one grey line in the media
column. Nothing is folded in a row; the only fold on the page is Details.

### 6.4 The decision bar

One bar per stage, sticky at the top under the head. It holds, in one line: what you are
deciding ("Approve the storyboard: 1 keyframe"), the cost when there is one ("Approving starts
the first runs: $0.50"), and the buttons (Approve, Send back…). When the stage's decisions are
per row (review, composite), the bar says what waits and links down to it. When nothing waits
for the user, the bar says whose turn it is and what the agent does, with no buttons. Kill this
post and the view switches stay in the ⋯ menu of the head.

Problems that block the decision sit directly under the bar, blocking first, one sentence each.

### 6.5 The mockup

Static HTML with the real content of two videos, served on http://localhost:3212:

- `hannah-plan.html`: Hannah 10-21 AM at the plan stage (the reference clip in the hook row, the two motion-designed app parts with every step and string, the hero string, the caption).
- `latte-keyframes.html`: Latte 10-21 AM at the keyframe stage (the real keyframe and the reference pose in the hook row, the two app parts quiet, the bar with the $0.50).

The mockup source is in `research/ai-ugc/mockup/` (serve the folder with any static server). Screenshots at 1,440 px: `cleanup-screenshots/mockup/`. The Atlas code does not change until the mockup is approved.

### 6.6 Built (2026-10-21)

The mockup was approved with two changes, and the layout is in the Atlas on `atlas-video-page-cleanup`:

- The stage indicator is its own row under the title: chevron breadcrumbs (Plan › Keyframes › Generate › Review › Composite › Cut › Deliver), each with its state word (done, your turn, agent, blocked, skipped, not yet), the current one filled in, each a link to that stage (`?stage=N`). `components/production/VideoStages.tsx` (StageCrumbs), drawn in the head of the post page.
- At the review and composite stages the Approve and Reject buttons stay in each row; the bar only says what waits and links down to the first item.

The files: `components/production/VideoView.tsx` (the bar, the rows, Details), `components/production/VideoProduction.tsx` (the media column per stage and the bar's buttons for the storyboard and the cut), `components/production/ReactionPickSlot.tsx` (the reaction in words, under the hook), `lib/plain-words.ts` (`stageLine`: the bar of a stage that is not the current one). The strip of beats (`Timeline.tsx`) is gone: the rows are the only list of the video's parts. Every decide line and every piece of data is unchanged. Screenshots at 1,440 px of every stage: `cleanup-screenshots/one-document/`.
