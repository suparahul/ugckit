# Atlas: every stage of a character video — plan

Status: **built 2026-10-19** on branch `atlas-niche-video-player`, in the order of § 10
(§ 11 says what was built and what is still open). Nothing spent, no paid API called.

> **Change, 2026-10-19 (founder):** every reaction shot is a **motion copy**: the character's
> approved first frame (made from the hero and the clip's first frame) is moved by the
> reference clip (Kling 3.0 Pro Motion Control). Nothing replaces a face, and a visible face
> is not required. The name "face replace" is retired; the data names are `motion_copy`
> (`generation_input`, the shot block, `models.json`), the kinds `motion_clip` and
> `pose_frame`, and `bridge.motion_copy`, and the scripts still read the old names. The
> written route is only a fallback the user names after a failed motion take.
>
> **Change, 2026-10-19 (founder):** the app demo has a third source, **motion design**: the
> app's real screens rebuilt in code and animated, rendered locally at 1080x1920
> (`motion_design.py`, the method of the two motion-designed posts of 2026-10-14). The plan
> picks it per full-screen app beat (`demo_source`, with its reason and `screen_story`), a
> real recording first. At stage 5 its segment card shows the story's steps, the render,
> its stills and its gates, and takes `motion.approve` and `motion.reject`; the timeline
> names how each app beat is shown ("by motion design", "a real recording").
> Where the text below says face replace, read motion copy.

The goal: at each stage of the character video pipeline, the user studies what the stage
made, approves it (or rejects it with a note), and the video moves on to the next stage. One
stage model and one set of screens for every video type. A type changes only which segments
and panels a stage shows. The plan's data and `video.json` drive that, not a separate page.

## 1. What this plan builds on

Read for this plan: the skills `video-plan`, `video-script`, `video-lock`, `character-shots`,
`character-generate`, `character-review`, `character-composite`, `character-assemble`,
`character-deliver`, `character-voice`; `scripts/character/state.py`, `review.py`,
`bridge.py`, `continuity.py`, `capabilities.json`, `models.json`;
`scripts/planning/video_plan.py`; `docs/character/*.example.json`;
`research/ai-ugc/ATLAS-VIDEO-UI-PLAN.md`; the Atlas post page and its production components;
the real folders in `organic-factory/pipeline/character/` and its `state.json`.

**Already in the Atlas** (some of it is uncommitted work in the tree today):

| Part | Where | What it does |
|---|---|---|
| Video row, idea, plan, final, posting | `lib/video.ts`, `lib/production.ts`, `VideoView.tsx` | Idea approval; `REVIEW.md` with **Approve plan** / **Send back** (`plan.approve` with `{video, revision, digest}`); the 9:16 frame with the beats and prompts; **Approve for posting** (`final.approve` with the file's sha256); Post Bridge send. |
| Production after the lock | `lib/video-production.ts`, `VideoProduction.tsx` (untracked) | Three blocks under the frame: storyboard (gate A), segments with takes (gate B) and composites, the cut (gate C). Lines `storyboard.approve/sendback`, `take.approve/reject`, `composite.approve`, `cut.approve/sendback`. `productionStep()` says whose turn it is. |
| The agent side | `review.py --from-atlas` (modified, uncommitted) | Reads the last user line of the kind for the video and segment, checks the file's sha256, runs every gate, and writes `approval.json`. `video_plan.py lock --from-atlas` does the same for the plan. |
| Media | `app/media/[...path]/route.ts` | Serves `final/<id>.mp4`, `keyframes/<nn>-<t>.png`, `storyboard.jpg`, `segments/<nn>-<t>/{generated,composite}/*.mp4`, `source/reference.mp4`, `assembly/*.mp4`. Nothing else under `pipeline/`. |

So the gates exist. What is missing is: (1) one view of all stages and where the video is;
(2) the brief, generate and deliver stages as stages; (3) the segment types the production
blocks do not show yet (supplied media, panels, narration, recordings, continuity seams);
(4) the decisions the agent side does not read from the Atlas yet (sources, narration, a
composite reject, a cut send-back for one segment, a redo of one keyframe, a pick of an
older take).

**What the real videos teach** (organic-factory, 2026-10-14):

- `latte-ragdoll-2026-10-14-reaction-x`, a face-replace reaction (one X segment, no app).
  Gate A was approved twice (the history is in `gate_a_storyboard.history`). Take 1 was
  rejected with a failure class and a fix. Take 2 was approved "good enough" although
  `identity.py` said FAIL and the length gate refused it. The approval was written into
  `approval.json` by hand. **`state.json` was not updated**: it still says `shots` pending
  and `review` "0 of 1 approved". The Atlas must read the gates from `approval.json` and
  show where `state.json` disagrees.
- `catwisecats-2026-10-11-cat-love-language`, an animated "sheet" video. It was made by
  `compose-sheet.py` and `animate-sheet.sh`, outside the character pipeline. Its
  `plan.json` and `final/delivery.json` are "manual display entries": no `video.json`, no
  `approval.json`, no `state.json` row, takes named `a-run1-raw.mp4` in `segments/01-sheet/`.
  The pipeline cannot make this type yet (§ 9).

## 2. Rules of the design

1. **One stage model.** Eight stages, the same for every video (§ 3). A stage that does not
   apply shows "n/a" with the reason (`composite` with no app insertion, as `state.py` does).
2. **The segment is the unit of difference.** `video.json` lists the segments. Each segment
   type has a fixed set of panels (§ 6). A reaction video is one X segment. A talking head
   is T segments. A pet-only video is B segments with narration takes. There is no type
   switch anywhere in the UI.
3. **The Atlas writes only log lines.** Each click appends one line to
   `apps/<slug>/production/log.jsonl`, as today. The server fills every sha256 and cost
   from the files, never from the client. The agent records the line with the existing
   command and `--from-atlas`, which writes the existing files: `planning-approval.json`,
   `plan.json`, `approval.json`, `model-failures.md`, `last-frame.json`, `state.json`. There
   is no new store.
4. **The files decide the state.** A gate is done when `approval.json` (or
   `planning-approval.json`) records it for the file on disk now. A click that the agent has
   not recorded yet shows as "clicked: being recorded". A file that changed after a click or
   an approval shows as "changed since: decide again".
5. **The Atlas never generates and never spends.** A click can be the user's yes to a
   computed cost. The agent spends it.

## 3. The stage model

| # | Stage | Pipeline | Made by | The user's decision | Done when (the file that proves it) |
|---|---|---|---|---|---|
| 1 | **Plan** (brief and script) | planning 2–3 | `video-plan`, `video-script` | none of its own: read; send back with a note | `REVIEW.md` with a content digest exists for the draft's revision |
| 2 | **Plan approval** | planning 4 | `video-lock` | Approve plan / Send back | `planning-approval.json` with words, not a dry run, for `plan.json`'s revision |
| 3 | **Shots and keyframes** (gate A) | P1 | `character-shots` | Approve storyboard and cost / Send back / Redo one keyframe | `approval.json` `gate_a_storyboard.decision` = approve and `keyframes_sha256` = the keyframes on disk |
| 4 | **Generate** | P2 | `character-generate` | none of its own: the yes is gate A or a "generate again" | each generated segment has a take that gate B has not decided, or an approved take |
| 5 | **Review takes** (gate B) | P3 | `character-review` | per take: Approve (with its checks) / Reject (what failed, generate again or not) / Pick another take; per source and narration take: Approve / Reject | every project, source and narration take that `review.py needs()` lists has an approve row |
| 6 | **Composite** (app insertion) | P4 | `character-composite` | per phone segment: Approve / Send back | every phone segment's gate B row has `composite` for the file on disk; n/a when `app_insertion` is false or no segment is a phone |
| 7 | **Assemble** (gate C) | P5 + gate C | `character-assemble`, `character-deliver` § 1–2 | Approve the cut (default or grain) / Send back / Regenerate one segment | `gate_c_final.decision` = approve, `sha256` = the assembled file, assembled from the locked plan's digest |
| 8 | **Deliver** | P6 + posting | `deliver.sh`; the Atlas posting gate | Approve for posting / Send back | `final/delivery.json` and a `final.approve` line with its sha256 |

Generate and Review are two stages in the rail but one panel (§ 5.4). A take appears, and
the user judges it in the same place.

### The state of one stage

Each stage shows one of these words. `productionStep()` already computes most of them; it
grows to cover stages 1, 2, 8, sources and narration.

| State | Meaning | Shown as |
|---|---|---|
| `not reached` | an earlier stage is not done | grey |
| `agent` | the agent works on it (a skill runs, or `state.json` says `running`) | "agent: <what>" |
| `you` | something waits for the user's decision | accent, "waiting for you" |
| `clicked` | a line exists that the agent has not recorded | "clicked: being recorded" |
| `sent back` | the last decision was a send-back or reject, and nothing new came yet | "sent back — <note>" |
| `blocked` | a dependency stops it (a character not `live`, a blocking input, a capability set to false, `state.json` `failed`) | red, the reason in one line |
| `stale` | done before, but its input changed (a new plan revision, a new keyframe, a new take of a continued clip) | amber, "changed since" |
| `done` | proved by the file in the table above | check mark |
| `n/a` | does not apply to this video | dash and the reason |

**`state.json`** gives `running` and `failed` (with its note) and the costs. It never
overrides `approval.json` for a gate. When they disagree (latte: gate A approved,
`shots` pending), the rail shows the file's state and a small note: "state.json says
pending; the agent runs `state.py set <video> shots done`".

## 4. The screens

Two places, both exist today. No new page.

1. **The studio board** (`/production/<app>`): the video tile shows the current stage
   number and word, for example "5 · take 02-g waiting for you". Today it shows "idea,
   script, plan, video, video ✓". Small change.
2. **The post page** (`/post/<id>`) of a video row: the overview and one stage panel.

```
┌ @latte.ragdoll · 2026-10-14 · video · reaction · 9:16 ─────────── spent $0.68 ─┐
│ Now: take 01-x is waiting for you.                                              │
│ ①Plan ✓ ②Approved ✓ ③Keyframes ✓ ④Generate ✓ ⑤Review ● ⑥Composite – ⑦Cut ○ ⑧Deliver ○ │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Segments                    keyframe   take        gate B     composite  in cut │
│ 01-x  X face replace 0–2 s  ✓ A        2 takes     ● you      n/a        –      │
├─────────────────────────────────────────────────────────────────────────────────┤
│ STAGE PANEL (the stage picked in the rail; the current stage by default)        │
│ ┌ timeline ────────────────────┐ what it made │ checks │ decision bar:          │
│ │ 0.0–2.0 s  hook · 01-x       │                         Approve · Reject/Send  │
│ │ [picture] sees: her face …   │                         back · note            │
│ │           text: "I just…"    │                                                │
│ │           sound: none, silent│                                                │
│ │           app: not on screen │                                                │
│ │ 2.0–… s   …                  │                                                │
│ └──────────────────────────────┘                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
│ The frame (final or empty) · the beats · the caption (as today)                 │
```

- **The header** keeps the row's title and adds the computed spend so far
  (`state.json videos.<id>.costs`, the figure `Production.spent` already reads).
- **The rail**: the eight stages with their state words. A click opens that stage's panel
  (`?stage=3`), so the user can look back at a done stage. The current stage opens by
  default. The "Now" sentence is `productionStep()`'s sentence.
- **The segment table**: one row per `video.json` segment, in order. Columns: the name and
  type, the beats and their times, then one cell per stage that works per segment
  (keyframe, take, gate B, composite, in the cut). A cell is a state word from § 3. A
  click on a row opens the segment card (§ 6) inside the current panel. Before
  `video.json` exists, the table shows the plan's beats instead, with "segments not cut
  yet".
- **The stage panel**: the timeline on its left (§ 4.1), then the same three parts at every
  stage: what the stage made (players, pictures, text), the checks (measured numbers and
  the checklist), and the decision bar.
- **The slot** under it stays as it is today (the frame, the beats, the caption). After
  delivery, the production panels fold into "Production record", as today.

On a phone, the rail scrolls sideways inside its own box, the table becomes one card per
segment, and the stage panel is one column, with the timeline first.

### 4.1 The timeline

A vertical strip on the left of the stage panel. It runs from 0 s at the top to the end of
the video at the bottom. It is the same strip at every stage and for every video type; only
its pictures change as the video moves on. It reads the plan; it writes nothing.

**One checkpoint per beat** of the plan (`plan.json beats[]`; before the lock,
`plan.draft.json` of the current revision; before a script exists, the strip says "no
beats yet" and stage 1 shows the brief). A checkpoint's height follows its length, with a
minimum height so that a 0.5 s beat is still readable. The time range is written as text
("0.0–2.0 s"), so the reader never measures it. A checkpoint carries:

| Line | What it says | From |
|---|---|---|
| Head | the time range, the beat's role (hook, step, payoff …), the segment that carries it (`01-x`) once `video.json` exists | `beats[].start_s`, `end_s`, `role`; `video.json` |
| sees | what the viewer sees, in one or two lines | `beats[].action`, `framing`, `layout` (for M: "three panels: …") |
| text | the on-screen text in that range, word for word, with its place | `overlays[]` whose range meets the beat's range: `text`, `placement` |
| sound | the voice or the sound: the spoken line and who speaks it, a narration take, "silent", the music note | `beats[].lines`, `script[]`, `narrators`, the shot's `audio_from`, `publishing_note` |
| app | where the app or product comes in: "not on screen", or the screen id and its hero string, or the supplied clip | `app_on_screen`, `screen_id`, `hero_strings`, `source_asset_ids` |

There is no colour code. A grey checkpoint means nothing; every meaning is in the words.
The checkpoint of the stage panel's open segment has a plain border, so the reader sees
which beats the panel talks about. A click on a checkpoint opens its segment card (§ 6).

**One picture per checkpoint, at no cost.** Every picture is a file that is already on
disk, or a frame that the browser shows from a video that is already on disk (a paused
`<video>` at a set time; no frame is extracted and nothing is generated). The picture
has a label in words under it ("reference", "hero", "keyframe", "take 2, approved"), because
the label replaces a colour. The strip takes the first picture that exists in this
order:

| Stage reached | The picture | File |
|---|---|---|
| Plan, plan approval (1–2) | a reaction beat: the reference clip at the start of its range | the post's video at `reaction_refs[].start_s` (research, served today) |
| | a beat with the app on screen: the screen | `apps/<slug>/screens/` still, or the recording at its first frame (`screens.json`) |
| | a supplied clip or still (C, an M panel) | the plan asset at `source_range_s` or `still_s` |
| | a beat with a fixed subject and no face (pet only) | `handles/<h>/references/subject-<name>.png` |
| | a beat with the character in it | the approved hero, `handles/<h>/references/face.png` (or the character's `hero.png`) |
| | none of these (an R or P recording before it exists, text only) | no picture: the label says why |
| Gate A done (3) | the keyframe of the segment that carries the beat | `keyframes/<nn>-<t>.png` |
| Gate B, a take approved (5) | the approved take, at the beat's time inside the segment; it plays on a click | `segments/<seg>/generated/<take>.mp4` |
| Composite approved (6) | the composite in place of the plate | `segments/<seg>/composite/*.mp4` |
| Gate C (7–8) | the whole strip plays the cut: one player beside the strip, a marker moves down it, a click on a checkpoint jumps to its start | `assembly/<video>.mp4`, then `final/<video>.mp4` |

A picture that a later stage replaced stays one click away ("show the reference"), so the
user can compare the take with what was planned. A beat whose picture is stale (a new
keyframe after the take) says so in its label.

**The segment table and the timeline show the same thing two ways.** The table is one
row per segment with the stage cells; the strip is one checkpoint per beat with the
content. A segment with two beats has two checkpoints and one row. The table's "beats and
their times" column links to the checkpoints.

**For every video type it is the same strip.** A face-replace reaction is one checkpoint
with the reference frame, then the hook text. A talking head shows the spoken lines. A
pet-only video shows the pet's picture and the narration lines. A video with app insertion
shows the screen at the beat where the app comes in. Nothing in the strip asks for the
type.

## 5. Each stage

For each stage: what the user sees, what the user can do, what the click writes and where,
and what it unlocks. "Line" is the log line; "agent" is the command that records it.

### 5.1 Plan (brief and script) — stage 1

- **See.** From `brief.json`: the idea, the viewer moment, the selected hook and up to two
  alternatives (`hook_alternatives`, each with its note), the recipe, the cast and
  narrator, the row fields the user filled (status `user`), the facts and whether each is
  verified, `screens_needed` and `assets_needed` with present or missing,
  `missing_inputs` grouped by owner (`founder` first), the reaction reference
  (`reaction_reference`: post id, range, burned-in text, with the research video at that
  range when the media route allows it). Then `REVIEW.md` in full with its revision and
  digest, as today.
- **Do.** Read. **Send back** with a note (the existing `plan.sendback`) is how the user
  answers a founder question or picks another hook alternative. There is no separate
  brief gate in the pipeline, and this plan adds none. For a reaction hook, **Choose a
  reaction** opens the reaction library (`REACTION-LIBRARY-PLAN.md` § 5) and writes a
  `reaction.pick` line.
- **Writes.** `plan.sendback` → `video-script` makes a new revision of `plan.draft.json`,
  `video_plan.py review` writes a new `REVIEW.md`. No production file.
- **Unlocks.** A `REVIEW.md` with a digest for the current revision opens stage 2.

### 5.2 Plan approval — stage 2

- **See.** `REVIEW.md` (revision, digest), then two lists: **blocking inputs** (they stop
  the lock) and **dependencies** (production stops on them: a character not `live`, a
  narrator not approved, a capability false in `capabilities.json`). Both come from
  `video_plan.py ready`. Today the Atlas cannot read them; § 8 adds a file.
- **Do.** Approve plan / Send back with a note (exist). Approve is disabled while a
  blocking input is listed, with the reason.
- **Writes.** `plan.approve` `{video, revision, digest}` → agent: `video_plan.py lock
  --from-atlas` → `pipeline/character/<video>/planning-approval.json` (with
  `approved_in.atlas_line_at`) and `plan.json` with `approved`. No `state.json` change
  (planning has no state; the files are the state).
- **Unlocks.** A real lock opens stage 3. The agent runs `character-shots`, and `shots.py
  check` records the video in `state.json`.

### 5.3 Shots and keyframes (gate A) — stage 3

- **See.** `keyframes/storyboard.jpg`. Per segment (the table plus cards): the keyframe,
  and for H the end still; the shot's type, framing kind (face, hands only, subject only),
  the planned and generated length, the lines it speaks, the references it will carry, and
  the computed cost of one run (`runCost()`). The face-replace X adds the pose picture
  (`source/first-frame.png`) beside its keyframe and the route. A phone segment adds the
  flat-on result of `qc.py --keyframe`. A continuing segment says "opens on the last frame
  of <prev>, taken at gate B". C, M, R and P say "no keyframe: <asset, range | panels |
  screen id>". The total cost of the first runs and the lint result (`lint_prompt.py`).
- **Do.** **Approve storyboard and $X** (exists). **Send back** with a note (exists).
  **Redo** on one keyframe card: a send-back that names the segments.
- **Writes.** `storyboard.approve` `{video, keyframes, cost_usd}` → agent: `review.py
  storyboard --from-atlas` → `approval.json` `gate_a_storyboard` (`decision`, `words`,
  `date`, `keyframes_sha256`, `cost_usd`, `approved_in.atlas_line_at`) and `state.py set
  <video> shots done`. A send-back with `data.segments` (new field) → `review.py
  storyboard --decision redo`; `character-shots` step 4 redoes only those keyframes with
  `keyframes.sh --only`.
- **Unlocks.** Gate A done opens stages 4 and 5. It is the yes to the first run of each
  generated segment at the cost shown (the rule in `character-generate`).

### 5.4 Generate and Review takes (gate B) — stages 4 and 5, one panel

- **See.** The segment table with the take column live. The segment card of the open
  segment (§ 6 says which panels each type shows): the newest undecided take in a player
  beside its keyframe (and the reference clip for a face-replace X), the measured checks
  (the qc contact sheet and numbers, the identity gate, the insert gates, the transcript
  against the frozen script), the checklist the user sees in `character-review`, and the
  list of every take with its time, its decision and its gate results. From
  `state.json`: a segment being generated now ("running", its note), a failed run with its
  error, and each run's computed cost. Below the segments: the **supplied sources** and
  the **narration takes** that `review.py needs()` lists, each as a small card.
- **Do.**
  - **Approve this take**, with the required checks ticked (exists). Disabled when the
    identity gate did not pass.
  - **Reject** with what failed, an optional fix, and "Generate it again ($X)" (exists).
  - **Pick another take**: "Approve this take" on any older take in the list. The server
    already accepts any take file; only the UI is new.
  - **Approve / Reject a source** (C clip or still, a panel's asset, a supplied voice):
    after a look at the exact range, with the checksum, permission and range results.
  - **Approve / Reject a narration take**, with the natural-voice check ticked.
- **Writes.**
  - `take.approve` `{video, segment, file, sha256, checks}` → `review.py segment
    --from-atlas` → `approval.json gate_b_segments[]` row; for a clip that the next one
    continues, `segments/<seg>/last-frame.png` and `last-frame.json`
    (`continuity.py`); `state.py` `review` running or done (`update_review_state`).
  - `take.reject` `{…, decision: regenerate|reject, fix, cost_usd}` → the same command →
    a reject row with `failure_class` and `fix`, and a row in
    `pipeline/character/model-failures.md`. With `regenerate`, it is the yes to one more
    run at `cost_usd`; the agent runs `generate.sh` for that segment.
  - `source.approve` / `source.reject` `{video, asset_id, sha256}` (new) → `review.py
    source --from-atlas` (new) → `gate_b_sources[]`.
  - `narration.approve` / `narration.reject` `{video, take, sha256, narrator, lines,
    checks}` (new) → `review.py narration --from-atlas` (new) → `gate_b_narration[]`.
- **Unlocks.** When every item of `needs()` is approved, `review.py` sets P3 done. The next
  stage is 6 when a phone segment exists, else 7. A continuing segment's generation
  unlocks only when the clip before it is approved (`continuity.py check`).

### 5.5 Composite (app insertion) — stage 6

Shown only when `video.json` has a phone segment (O, G, S, H, F, or C with `insert`). Else
the rail says "n/a: no app insertion in the plan".

- **See.** Per phone segment: the approved plate and the composite side by side, the
  corner sheet (`composite/qc/corner-sheet.png`), for F the finger sheet, the gate results
  from `composite/qc/gates.json` (no green left, hero OCR, screen width, UI sync), the
  screen id and the hero string from `insert.json`.
- **Do.** **Approve composite** (exists). **Send back** with a note (new): the composite
  is wrong (the grade, a corner, a tap out of time).
- **Writes.** `composite.approve` `{video, segment, file, sha256}` → `review.py composite
  --from-atlas` → `gate_b_segments[].composite` (`file`, `gates`, `hero`, `words`,
  `date`, `sha256`, `atlas_line_at`) and `state.py set <video> composite done` when every
  phone segment has one. `composite.sendback` (new) → the agent fixes `insert.json` and
  runs `composite.sh` again. `review.py composite` records no reject today, so the
  agent records the note with `state.py note <video> "<seg> composite: <note>"`.
- **Unlocks.** Every phone segment composited opens stage 7.

### 5.6 Assemble (gate C) — stage 7

- **See.** `assembly/<video>.mp4` in the 9:16 player, and the grain export when it exists
  (a toggle, as today). `assembly/contact-sheet.png`. The checks of `assembly.json`:
  size, codec, loudness, hero OCR, overlays as planned, readable, clear and read back,
  supplied files unchanged, each continuous cut's three numbers. The final checklist of
  `character-assemble` as text. "Stale" when `assembly.json plan_sha256` is not the lock's
  digest. The segment table shows each segment's time in the cut.
- **Do.** **Approve the cut** (default or grain) (exists). **Send back** with a note
  (exists). **Regenerate segment <n>** (new): pick one segment in the table and say what
  failed.
- **Writes.** `cut.approve` `{video, file, sha256, export}` → `review.py final
  --from-atlas` → `approval.json gate_c_final` (`decision`, `words`, `date`, `file`,
  `export_choice`, `final_checks`, `sha256`, `atlas_line_at`). `cut.sendback` → a reject
  row. `cut.sendback` with `data.segment` (new) → `review.py final --decision regenerate
  --segment <n>`; the segment goes back to stage 5 (a paid run needs its own yes: the
  line carries `cost_usd`, as `take.reject` does).
- **Unlocks.** Gate C approved: the agent runs `deliver.sh`, which opens stage 8.

### 5.7 Deliver — stage 8

- **See.** `final/<video>.mp4` in the frame (as today), `delivery.json` (sha256, the
  user's words at gate C, the segments, the computed spend), the caption and music note,
  the posting rules (draft only with a music note, the AI label).
- **Do.** **Approve for posting** / **Send back** (exist), then the send buttons (exist).
- **Writes.** `final.approve` with `hash` = the delivered sha256. This line is the Atlas's
  own posting gate; no pipeline file. `deliver.sh` has already written `final/`,
  `delivery.json` and `state.py deliver done`.
- **Unlocks.** Posting (the existing Post Bridge flow). A new delivery (a new sha256)
  makes the posting approval stale.

## 6. The segment card: one component, panels by type

One card for every segment. It shows the panels its data asks for. The type comes from
`video.json`; the details come from the shot file, the plan beat, and `models.json`.

| Panel | Shown when | Source |
|---|---|---|
| Keyframe (and H end still) | a generated segment that starts from a keyframe (`needsKeyframe`) | `keyframes/<nn>-<t>.png`, `<nn>-h-end.png` |
| Take player and take list | T, O, G, S, H, F, B, X, not shared | `segments/<seg>/generated/*.mp4` |
| Contact sheet and qc numbers | a take has a `generated/qc/` folder | `qc.py` output: length, sound, cuts, transcript, pitch spread |
| Transcript against the script | T | the qc transcript and `plan.json script[]` |
| Voice: natural-voice check | the character's first approved talking take | `creator.json natural_voice_check` |
| People rule and subjects | B (and every keyframe) | shot `framing_kind`, `fixed_subjects_in_shot` |
| Expression beats checklist | X by the written route | shot `reaction.expression_beats` |
| Reference clip, pose picture, identity gate | X in face-replace mode | `source/reference.mp4`, `source/first-frame.png`, `generated/qc/identity-<take>.json`, `source/reference.json` (OCR, masks) |
| Insert gates of the plate | O, G, S, H, F; C with `insert` | `generated/qc/gates.json` (flat-on first) |
| Composite | the same, after the plate is approved | `composite/`, `composite/qc/` |
| Source range and checks | C; each M panel with an `asset_id`; `audio_from asset:` | the plan asset's file at `source_range_s` or `still_s`; `bridge.py assets` results |
| Panels layout | M | each panel's `rect` drawn on a 9:16 box, each source playable |
| Screen recording | R, P | `apps/<slug>/screens/<id>.mp4`, the hero string; nothing to approve before the cut |
| Narration take | `audio_from narration:<take>` | `narration/<take>.wav`, its lines, natural-voice check |
| Continuity seam | the shot has `continuity.from` | the previous clip's `last-frame.png` beside the take's first frame, `checks.seed_diff`; the tag "UNVERIFIED" while `capabilities.json bridge.continuity.input_verified` is false |
| Shared segment | `project` of another video | a link: "decided on <video>" |
| Cost | every generated segment | `runCost()`; the spend lines of `state.json` |

**How each video type comes out of this** (no type switch):

| Video type | Its segments | What the stages show |
|---|---|---|
| Talking head | T (with app insertion: O, G, S, H, F, R, P) | keyframes; takes with transcript and voice; composites when the app is in it |
| Reaction (hook channel `reaction`) | X, then T, B or C after the hook | the face-replace panels or the expression checklist; the hook overlay in the cut |
| Pet-only or hands-only action | B (`subject_only`, `hands_only`) and narration takes | keyframes; takes with the people rule and subject counts; narration cards at stage 5 |
| Mascot | B with `cast_kind` mascot, narration | as above; the mascot's style lock in the checklist |
| Supplied or live demo | C, M | no keyframe, no generation; source cards at stage 5; panels in the cut |
| With app insertion | adds phone segments, R, P | stage 6 appears |
| Without app insertion | no phone segment | stage 6 is n/a |
| Continuous take | two T, B or X with `continuity.from` | the seam panel; the second segment waits on the first one's gate B |

## 7. How an Atlas approval reaches the agents

The click writes a line. The agent records the line with the stage's own command, and that
command writes the files the next stage reads. The skills already say "record the click
instead of asking again".

| Button | Line (`kind`, `data`) | Agent command | Files written | The next agent reads |
|---|---|---|---|---|
| Send back (plan) | `plan.sendback` `{video, revision}`, note | `video-script` (new revision) | `plan.draft.json`, `REVIEW.md` | — |
| Approve plan | `plan.approve` `{video, revision, digest}` | `video_plan.py lock --from-atlas` | `planning-approval.json`, `plan.json` | `shots.py check` |
| Approve storyboard and $X | `storyboard.approve` `{video, keyframes, cost_usd}` | `review.py storyboard --from-atlas` | `approval.json gate_a_storyboard`; `state.json` shots done | `generate.sh` (gate A, keyframe sha256) |
| Send back / Redo keyframe | `storyboard.sendback` `{video, keyframes, segments?}`, note | `review.py storyboard --from-atlas` (redo) | `gate_a_storyboard.decision` "redo: …" | `keyframes.sh --only` |
| Approve this take | `take.approve` `{video, segment, file, sha256, checks}` | `review.py segment --from-atlas` | `gate_b_segments[]`; `last-frame.json`; `state.json` review | `composite.sh`, `assemble.sh`, `continuity.py` |
| Reject take | `take.reject` `{…, decision, fix, cost_usd}`, note | `review.py segment --from-atlas`, then `generate.sh` | reject row; `model-failures.md` row | `generate.sh` (the yes to one run) |
| Approve / Reject source | `source.approve` / `source.reject` `{video, asset_id, sha256}` (new) | `review.py source --from-atlas` (new) | `gate_b_sources[]` | `assemble.sh` |
| Approve / Reject narration | `narration.approve` / `narration.reject` `{video, take, sha256, lines, checks}` (new) | `review.py narration --from-atlas` (new) | `gate_b_narration[]` | `assemble.sh` |
| Approve composite | `composite.approve` `{video, segment, file, sha256}` | `review.py composite --from-atlas` | `gate_b_segments[].composite`; `state.json` composite | `assemble.sh` |
| Send back composite | `composite.sendback` `{video, segment, file, sha256}`, note (new) | `state.py note`, then `composite.sh` | `state.json` notes | — |
| Approve the cut | `cut.approve` `{video, file, sha256, export}` | `review.py final --from-atlas` | `gate_c_final` | `deliver.sh` |
| Send back cut / Regenerate segment | `cut.sendback` `{video, file, sha256, segment?, cost_usd?}`, note | `review.py final --from-atlas` | `gate_c_final` reject or "regenerate segment n" | `generate.sh` for that segment |
| Approve for posting | `final.approve`, `hash` = sha256 | — (the Atlas posting gate) | log only | `post` skill, Post Bridge send |

**How the agent knows that a line waits.** Today the user tells the agent, or the agent
reads the log at the start of a session. This plan adds one read-only command (§ 8):
`review.py pending [<video>]` prints every user line that no file records yet, with the
command that records it. The `character-*` skills run it first. The page shows the same
list as "clicked: being recorded".

**Who may write a line.** Only a line with no `actor` is the user's decision (the rule of
`atlas_line()` and `lastClick()`). An agent never writes an approval line.

## 8. What to change (when this plan is built)

Another agent works in this tree now on the face-replace routes and Atlas fixes, and
`VideoProduction.tsx` and `video-production.ts` are uncommitted. Build after that work is
committed, on top of it.

**Atlas**

| File | Change |
|---|---|
| `lib/video-production.ts` | A `stages()` function: the eight stage states of § 3 from the files and the log; the `state.json` disagreement note; sources and narration takes from `video.json` and `plan.json` (the same list as `review.py needs()`); each segment's qc, gates, seam and source facts for § 6. `productionStep()` covers sources, narration, composite send-back and cut regenerate. |
| `lib/video.ts` | The brief's summary for stage 1; the `ready` file for stage 2. |
| `components/production/VideoStages.tsx` (new) | The rail, the "Now" sentence, the segment table. |
| `lib/video-production.ts`, `timeline()` (new) | The checkpoints of § 4.1: each beat's range, role, segment, sees, text, sound and app lines, and its picture by the order of § 4.1. Pure; tested with the fixtures. |
| `components/production/Timeline.tsx` (new) | The vertical strip; the picture label; the player beside it at gate C. |
| `components/production/VideoProduction.tsx` | Split into the stage panels; one `SegmentCard` with the panels of § 6; "approve" on any take in the list; the source, narration, redo, composite send-back and regenerate controls. |
| `components/production/VideoView.tsx`, the post page | The rail and the table above the slot; `?stage=`. |
| `components/production/Board.tsx` | The stage number and word on the video tile. |
| `app/api/production/decide/route.ts` | Kinds `source.approve`, `source.reject`, `narration.approve`, `narration.reject`, `composite.sendback`; `data.segments` on `storyboard.sendback`; `data.segment` and `cost_usd` on `cut.sendback`. Every sha256 read from disk. |
| `app/media/[...path]/route.ts` | Also serve: `keyframes/<nn>-h-end.png`; `segments/<seg>/source/first-frame.png`; `segments/<seg>/last-frame.png`; `segments/<seg>/generated/qc/*.png` and `composite/qc/*.png`; `segments/<seg>/source/plate.mp4`; `narration/*.wav`; `assembly/contact-sheet.png`; a plan asset's file under `supplied/`; for the timeline, `apps/<slug>/screens/` (stills and recordings; handle references and research are served today). Still no JSON, no plan, no prompt. |
| `lib/*.test.ts` | One fixture per video type of § 6, and the latte case (a hand-written approval, `state.json` behind). |

**Pipeline** (small, no generation)

| File | Change |
|---|---|
| `scripts/character/review.py` | `--from-atlas` on `source` and `narration`; `storyboard` redo keeps `data.segments`; `final` maps `cut.sendback` with a segment to `regenerate --segment`; a `pending` command. |
| `scripts/planning/video_plan.py` | `ready --json <file>` (or `review` writes it): the blocking inputs and dependencies beside `REVIEW.md`, so the Atlas can show them. |
| Skills `character-shots`, `-review`, `-composite`, `-deliver`, `video-lock` | One line each: run `review.py pending` first; the new kinds. |

## 9. What the pipeline cannot support yet

1. **Animated sheet videos** (catwise, 2026-10-04 to 10-11). They are made outside the
   character pipeline (`compose-sheet.py`, `animate-sheet.sh`) and entered by hand. No
   `video.json`, no gates, no state. The Atlas can show them only at stage 8 (the
   delivered file) with "made outside the pipeline". A real stage model for them needs a
   segment type for a composed, animated card (or a stage in front of P1 that makes it).
   A mascot made as a generated character (B with an approved mascot) is supported.
2. **Accept a take that fails a measured gate.** The user approved latte's take 2 with an
   identity FAIL and a length refusal; the row was written by hand. `review.py` has no
   override, so the Atlas keeps Approve disabled. If the founder wants this, `review.py`
   needs an explicit `--accept-fail <gate>` with the user's words, and the Atlas an
   "Approve anyway" with a required note. Until then, the Atlas says "the identity gate did
   not pass: tell the agent in words if you accept it".
3. **A run whose cost is above the figure the user approved.** `character-generate`
   needs the user's word in the conversation. The Atlas has no line for it. A
   `run.approve {video, segment, cost_usd}` line is possible later; not in this plan.
4. **Narration takes are made outside the kit.** The kit has no voice generator. The Atlas
   can approve a take only when its file is in `narration/`.
5. **Continuity is unverified.** `bridge.continuity.input_verified` is false. The seam
   panel shows the seed difference, but no threshold exists until a paid continuing run
   gives a first number.
6. **Founder questions in the brief** have no line of their own. The answer goes as a plan
   send-back note.
7. **`state.json` can fall behind** the approval files (latte). There is no command that
   rebuilds it from `approval.json`. The Atlas shows the disagreement; the agent fixes it
   with `state.py set`.
8. **A composite reject** is not recorded in `approval.json` (`review.py composite` only
   approves). The send-back lives in the log and in `state.json` notes.
9. **Part A** (casting, the character's video half, the voice reference) is not a stage of
   this video. A character that is not `live` shows as `blocked` at stage 3 with a link to
   the handle page, where the identity flow already lives.
10. **Recreation (`originate`) video rows** stay out of the studio, as in the earlier plan.

## 10. Build order

1. The rail, the stage states, the segment table and the timeline, read-only (no new line
   kind). This alone answers "where is this video now" and "what is in it" for every
   video in `pipeline/character/`.
2. The segment card with the panels of § 6 and the extra media paths.
3. The new lines and the `review.py --from-atlas` additions: pick a take, source,
   narration, redo one keyframe, composite send-back, regenerate one segment from the cut.
4. `review.py pending` and the skill lines.
5. Tests with one fixture per video type, then a browser pass on latte (a face-replace
   reaction, no app) and on a plan with app insertion.

## 11. What was built (2026-10-19)

| Part | Where |
|---|---|
| The eight stage states, the "Now" sentence, the state.json notes | `lib/video-stages.ts` `videoStages()`; filled in `postState()` |
| The timeline of § 4.1 | `lib/video-stages.ts` `timeline()`, `components/production/Timeline.tsx` |
| The rail and the segment table | `components/production/VideoStages.tsx`; `?stage=N` and `?seg=<nn>-<t>` on the post page |
| The stage panels and one segment card | `components/production/VideoView.tsx` (stages 1, 2, 8), `VideoProduction.tsx` (3 to 7) |
| The brief summary and the ready lists | `lib/video.ts` `briefSummaryOf()`, `ready.json` (`video_plan.py review`, `ready --json`) |
| The place for **Choose a reaction** | `components/production/ReactionPickSlot.tsx` (the reaction library fills it) |
| The board tile's stage | `components/production/Board.tsx` |
| The new lines | `source.*`, `narration.*`, `composite.sendback`, `storyboard.sendback` with `segments`, `cut.sendback` with `segment` and `cost_usd`; pick another take (the take list) |
| The media paths | `lib/media-paths.ts`, shared by the route and the pages |
| The agent side | `review.py source|narration --from-atlas`, the redo and the regenerate, `review.py pending`; one line in each skill |
| Tests | `lib/video-stages.test.ts` (one fixture per video type, and the hand-written approvals of 2026-10-14); `tests/character-bridge` (source and narration from the Atlas, `pending`) |

Still open:

- Stage 3 does not show the prompt lint result or the flat-on result of `qc.py --keyframe`:
  neither is written to a file yet.
- Stage 5 shows no transcript against the script: `qc.py` prints the transcript and writes
  no file. The card says to check the words by ear.
- The items of § 9 stay as they are.

