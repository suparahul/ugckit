# Video Anatomy — the slots of one planned video

An anatomy is a list of slots. Each slot has a fixed set of values. A video is planned by choosing one value per slot, inheriting the handle's defaults, selecting a beat recipe and filling its beats. Free writing fills the chosen slots; it never decides the structure. An experiment changes one slot and holds the rest.

The machine-readable copy of every value, hook job and recipe is `video-patterns.json` (taxonomy version on its first line). This file explains them. `learnings-video.md` gives the reasons. When the two disagree, `video-patterns.json` wins and this file is wrong.

**Evidence** names where a value was seen. **(observed)** means a post was read; **(claimed)** means a creator or article says so and no post was read; **(planned)** means a founder plan schedules it and no outcome exists yet; **(starter)** means the value is in the taxonomy so that a requested video can be described, with no evidence yet. A planned or starter value is a valid choice; it is not a proven winner. The cited corpus files are not shipped; the citations say where a value came from.

**Capability** says whether production can make the value today. `runnable`: the character pipeline makes it (P1 to P6). `bridge`: it needs a capability of the shared production bridge (see § Production capability); the plan is still valid and the lock reports the gap. A missing capability never changes the requested format.

**Rules to avoid overlap.** The filming format says how the video is shot; the recipe says the order of its jobs; the hook job says what the first beat does. Product role, name location, app presence and product timing are four separate slots: an app can be on screen and never named. `format` in `plan.json` means the canvas and the length; the filming format sits in `editorial.filming_format`. Account role, persona and cadence are properties of the handle, so they are inherited, never chosen per video.

---

## Layer 0 — Inherited

Read before any slot is chosen. A video never overrides these; an exception to an approved handle rule needs the user's explicit decision, dated.

| Input | Where it comes from |
|---|---|
| Account role, persona, cadence | `strategy/ACCOUNTS.md`, `handles/<handle>/HANDLE.md` |
| The requested video type, its date and row | the user's plan: `production/PLAN.md`, `strategy/HANDLE-STRATEGIES.md`, or an equivalent file the user names |
| Handle rules ("never the app's name in the hook", "CatWise is the payoff") | the same strategy file; these bound every slot below |
| Strategy disposition | `scheduled`, `candidate`, `stopped`, `avoid`; recorded beside the capability and the evidence, never merged with them |

## Layer 1 — Intent

### Objective

One primary objective, with the metric that reads it.

| Value | Metric | Evidence |
|---|---|---|
| `reach` | views against the handle's median | SCRIPT-LEARNINGS § 1 (claimed); slideshow outcome columns, `SLIDESHOW-ANATOMY.md` |
| `save_share` | saves/view, shares/view | `learnings-slideshows.md` § Saves (observed, slideshows) |
| `product_discovery` | "what app?" comments, profile visits | Potto, Roamy teardowns § 5–6 (observed) |
| `product_action` | taps on a real destination; paid only | SCRIPT-LEARNINGS § 4, § 14 (claimed, paid ads) |

### Distribution

| Value | Rule |
|---|---|
| `organic` | the default |
| `paid` | changes the eligible close (a `product_action` close needs a real destination), not the format |

### Story lane

| Value | What it is | Evidence |
|---|---|---|
| `pitch` | sells: a problem, a mechanism, one doubt answered | SCRIPT-LEARNINGS § 4–7 (claimed, paid-ad bias) |
| `discovery` | a person or a subject finds something useful; the product can be the last result | Potto, Roamy, Stronger teardowns (observed) |
| `everyday` | a task or a life moment; no problem, objection, app name or sales close is needed | UMax teardown § 4, § 6 (observed) |
| `education` | explains one thing and earns one action | founder coverage audit (planned); slideshow tip lists (observed, slideshows) |

A discovery can be a pitch. An everyday video does not need a product.

### Viewer moment and topic

Two text slots: one concrete situation ("four weeks of litter misses with a new cat") and one subject. Filled from product facts, the user's plan or a cited source. They are not a hook list.

### Experiment

| Value | Rule |
|---|---|
| `none` | default |
| `hook`, `proof`, `product_presence`, `close`, `cast` | one changed axis; names the base video; every other slot fixed. A hook that changes the body is a new body, not a hook test |

## Layer 2 — Structure

### Filming format

| Value | What is on screen | Evidence | Capability |
|---|---|---|---|
| `talking_head` | a face speaks to camera | SCRIPT-LEARNINGS § 8 (claimed); founder plan, education "why" videos (planned) | runnable (T); 35–60 s is several T segments joined at sentence ends |
| `hook_to_demo` | an attention beat (a face, a cat or a scene), then the real app | Potto, Roamy, Stronger (observed, product at about 2–6 s) | runnable with a generated face (T → R, P or a phone insertion); a supplied opener needs bridge C |
| `live_use` | the real input is captured while the app reads it; the input and the result are both shown | founder plan, brand handle (planned) | bridge C + live |
| `before_after` | state or approach A, then B; sequential or split screen | SCRIPT-LEARNINGS § 8 (claimed); founder plan, wrong way / right way (planned) | bridge B or C; split screen needs bridge composition |
| `text_over_action` | an action with timed text, no speaker | UMax (observed); Vent Now, photo mode (observed, not video) | bridge B or C + composition |
| `voiceover_action` | an action with a narrator's voice, no face speaking | SCRIPT-LEARNINGS § 9, demo with voice-over (claimed) | bridge B or C + narration |

Alias: `face_to_demo` is read as `hook_to_demo`. A POV opening is a hook framing, not a seventh format.

### Beat recipe

Ordered semantic beats, not shots. Several beats can share one production segment; a 2-second hook does not need a 2-second generation. Roles in brackets are optional; `×n` repeats.

| Recipe | Ordered beats | Lane and conditions |
|---|---|---|
| `pitch_proof` | callout → problem → mechanism → proof → close | pitch. The mechanism and the doubt come from facts. Paid may close on a product action |
| `discovery_demo` | attention → [discovery_line] → use_reveal → result → [payoff] | discovery. Gratitude, analogy, regret, quote and animal openings fill the same attention slot. The app may be the last result |
| `routine_log` | underway → action ×n → log_check → [continue] | everyday. App optional; zero spoken app names and no CTA allowed |
| `personal_note` | admission → experience → change → reflection | everyday or pitch. A product is optional; an invented testimonial is forbidden |
| `state_change` | state_a → intervention → state_b → takeaway | any lane. Comparison mode `before_after`, `wrong_right` or `best_worst`; no unsupported causal claim |
| `explain_action` | sign → explanation ×n → [app_aside] → action ×n → [close] | education. App absent, or one incidental mid-video line or screen. Health and risk facts cite real sources |
| `list_steps` | promise → item ×n → takeaway | education or discovery. Each item has its index, exact text and time; one app may take one numbered item |
| `setup_reveal` | situation → reveal → [response] | any lane. A notification, a forbidden reveal and a product punchline use this one structure |

Each beat has one job, a time interval, exact words if any, a visible action, its product visibility and a fact reference where a claim needs one.

### Length and canvas

| Value | Rule |
|---|---|
| `10`, `15`, `20`, `30` seconds | planning bands |
| `35–60` seconds | education and long voice-over; assembled from several segments |
| canvas | `9:16`, always |

A sourced exact duration inside a band is allowed after the feasibility check. Generated segments are planned at 3 s or more and generated at 5–15 s; no request exceeds a model's 15-second cap.

### Series

| Value | Rule |
|---|---|
| `standalone` | default |
| `progress_log` | stores `{series_id, subject_ids, routine_id, episode, day, previous_plan_ref, state_fact_refs}`; the counter shows the real day; real progress is evidenced, never generated |

## Layer 3 — Hook

### Hook job

What the first beat does. Each job has named fill slots. Fill them from the user's plan, product facts or a source. **Never invent an elapsed time, a result, a credential, a request or a quotation to fill a slot.**

| Job | Fill slots | Example (source) | Evidence |
|---|---|---|---|
| `discovery_regret` | familiar_activity, elapsed_time, discovery | "12 years of owning cats and I'm JUST NOW finding this??" | Potto § 5 (observed); Roamy § 4 (observed) |
| `imminent_need` | deadline, unfinished_job | "Vet appointment in 1 HOUR and I just found this" | Roamy § 4 (observed) |
| `confession_reframe` | belief_or_habit, correction | — | SCRIPT-LEARNINGS § 8, confession (claimed) |
| `quoted_challenge` | quote, response | "It's just a cat, it's fine", then the answer | SCRIPT-LEARNINGS § 5 (claimed); founder plan (planned) |
| `specific_promise` | task, useful_result | "This is the way to [outcome]" | slideshow numbered promise (observed, slideshows) |
| `peer_question` | shared_moment, question | — | SCRIPT-LEARNINGS § 5, yes-question (claimed) |
| `visible_result` | before, after | a person eats and the number appears | SCRIPT-LEARNINGS § 5, Cal AI (claimed) |
| `in_progress` | task, revealing_action | a task already underway; no hook sentence needed | UMax § 4, § 6 (observed) |
| `gratitude_discovery` | person_role, useful_discovery | "I could literally kiss the vet tech who showed me this" | founder plan (planned) |
| `category_analogy` | familiar_category, new_subject, shared_job | "Someone made a baby tracker but for cats??" | founder plan (planned) |
| `withheld_reveal` | audience, withheld_thing, payoff | "Do NOT show this to a cat mom" | founder plan (planned) |
| `explanation` | observed_sign_or_question, meaning, action | "This is the reason your cat…" | founder plan (planned); slideshow self-test (observed, slideshows) |

Phrasings that are not new jobs: "Everyone asks how I…" is `specific_promise` with an asked-for premise (the premise is sourced or plainly scripted). A day counter is `in_progress`. A warning is `specific_promise` with `negative` framing.

### Hook channel

| Value | Rule |
|---|---|
| `spoken` | the first line is said |
| `visual` | the first frame alone does the job; `in_progress` allows no hook sentence |
| `text` | a hook overlay starts in the first beat |
| `spoken_visual` | said, over a picture that also works alone |
| `text_visual` | a hook overlay over a picture that works alone |
| `reaction` | a silent reacting face with the hook as a text overlay from the first beat; never spoken (user decision, 2026-10-03) |

### Reaction hooks

A reaction hook is never spoken. The first beat is a `silent_action` on the `face`: no line, no voice-over. The hook is a text overlay that starts in that beat and stays up for words ÷ 3 s.

A reaction is never invented, so it does not look fake. `video-plan` picks a real reference reaction from the workspace's downloaded research (`research/<project>/<app>/<handle>/<post>/` or `apps/<slug>/niche/batches/<date>/<handle>/<post>/`, with its video): the post id and the exact time range. `video_plan.py reactions <slug>` lists the candidates. `video-script` writes the performance from it in the beat's `reaction` block: expression beats with their times, the face, the eyes, the head and the hands, the framing and the distance to the camera. The plan records the post in `reaction_refs`. No reference blocks the plan; nothing is written in its place.

The face is always the handle's approved character, never the reference creator's; the reference's sound is never used. **Face replace** (user decision, 2026-10-04) is the default (`generation_input: "face_replace"`): production gives the exact reference clip, trimmed to its range, to the video model, which replaces the face with the handle's approved character. The clip's room, clothes, hands and camera stay, so the reaction beat has no set and lasts exactly the clip's range at normal speed. The written expression beats stay in the plan, as the fallback (`"none"`: the character performs them) and as the review checklist. Prefer a range with no burned-in text: production crops text at an edge, but text mid-frame can only be blurred. A face-replace model is a production capability (`bridge.face_replace`); `ready` lists it while production has not declared it. The reference creator's permission is not required (`permission_ref` is optional and never blocks; user decision, 2026-10-04).

### Hook framing

Optional modifiers of a hook job, never extra hook families: `count`, `negative`, `audience_callout`, `lived_experience`, `professional_basis`. `professional_basis` needs a real, supplied, verified speaker or a sourced fact; a fictional persona or a synthetic voice carries no credential.

## Layer 4 — Product

### Product role

| Value | Rule |
|---|---|
| `absent` | the video still fulfils the handle's topic and objective |
| `incidental_tool` | used in passing, one line or one screen |
| `story_solution` | the answer the story arrives at |
| `main_subject` | the video is about the product |

### Name location

A set of `speech`, `overlay`, `caption`, `bio`, or empty. The spoken count is `0` or `1` by default. A name visible in the real UI is tracked apart from this slot. "Name the app once" is not a rule for everyday videos.

### App screen presence

| Value | Rule |
|---|---|
| `none` | no app on screen |
| `incidental_use` | the app in passing |
| `demonstration` | the app does its job on screen |
| `result` | the app's real output is the payoff |

Any visible real app needs `app_insertion: true`. A generated or drawn UI is never allowed.

### Product timing

`absent`, `opening`, `middle`, `closing`, `throughout`. The lock converts it to exact beat intervals.

### Viewer task on the app beat

`read`, `recognise`, `believe`. `read` needs the exact screen id and the hero string as the real app shows it.

### Proof

| Value | Rule |
|---|---|
| `none` | allowed for everyday and many education videos |
| `visible_action` | the action itself proves it |
| `real_screen_result` | the real app output, from the screen library |
| `sourced_fact` | a fact with a reference; every numeric claim needs one |

### Close

One primary ask at most: `none`, `payoff`, `save`, `share`, `follow`, `question`, `profile`, `product_action` (paid, with a real destination). A caption or bio placement matches the handle.

## Layer 5 — Cast and world

### Cast and framing

| Slot | Values | Rule |
|---|---|---|
| Cast kind | `human`, `mascot`, `none` | a generated cast is pinned `<character>@v<n>` and must be `live` |
| Framing per beat | `face`, `hands_only`, `subject_only`, `app_screen` | speech on camera shows the face; `app_screen` is a full-screen app beat (the real recording, layout `sequence`) |
| Real animal | a fixed subject (`origin: real`) or a supplied clip subject | shown only in supplied footage; never generated; never replaced by an invented human narrator |

### Narrator

`character`, `supplied_speaker`, `original_synthetic`, `none`, with the voice id and the source. An original synthetic voice never speaks over a visible human face and is never a clone of a real person. A mascot is not lip-synced; its narration can be a synthetic voice-over. No synthetic expert.

### World

Approved set ids and the exact fixed-subject ids, count and size per beat; one outfit per generated human per video. Supplied scenes use their source metadata, not fictional set plates. Shelves, a carrier, bowls and a two-cat scene are explicit asset requirements.

### Media origin and layout

Per beat: origin `generated`, `supplied`, `mixed`; layout `sequence`, `split_screen`, `picture_in_picture`. Supplied media is the user's camera, a permitted reference clip, a real recording or a still, with its source, checksum and permission pinned. Supplied footage is output media, never generation conditioning; the one exception is a reaction reference clip under face replace.

## Layer 6 — Audio and text

| Slot | Values | Rule |
|---|---|---|
| Performance per beat | `on_camera`, `voiceover`, `silent_action` | speech ceiling 15 words per 4 s; each spoken line belongs to one beat |
| Overlay role | `hook`, `paragraph`, `step_label`, `comparison_label`, `day_counter`, `source_credit` | exact text, start and end; on screen for at least words ÷ 3 s; never the lower caption band; never the app's real words or a clinical result |
| Music | a publishing note only | the production file has no music |

---

## Compatibility rules

1. **Handle rules first.** An approved handle rule bounds every slot. An exception needs the user's explicit, dated decision.
2. **Delayed product and a payoff close are starter defaults for organic pitch**, below the handle's strategy. "The app is the payoff" allows a closing product result; do not add an extra product-free beat.
3. **Everyday is not a pitch.** No forced naming, no problem, no CTA.
4. **Early demonstration is an option for discovery**, not a violation: Potto and Stronger show the product at about 2–6 s.
5. **The app is real or absent.** A routine can show a real logging screen with zero spoken names; it never shows a generated UI.
6. **Facts carry references.** A numeric claim, a health or risk claim and a product claim each name a fact or a real screen.
7. **Paid closes need a real destination.**
8. **An app-free video still serves the handle's topic and objective.**

## Production capability

Separate from the anatomy. Today P1 makes T talking segments without the app, and T, O, G, S, H, F, R and P with app insertion. The shared production bridge adds these capabilities:

| Id | Capability | Needed by |
|---|---|---|
| `bridge.B` | generated action: silent hands, pet-only action, an approved mascot | `before_after`, `text_over_action`, `voiceover_action` with generated media |
| `bridge.C` | supplied media: clips and stills beside R and P, trimmed, checksummed, subject-bound | any supplied beat: a real pet, shelves, a stitch excerpt, a verified expert |
| `bridge.narration` | a narrator apart from the face: character audio over action, a supplied voice, an original synthetic narrator | `voiceover_action`, any `voiceover` beat |
| `bridge.composition` | split screen, timed overlay tracks, source credits, series counters | overlays other than captions, `split_screen`, `picture_in_picture` of two sources |
| `bridge.live` | a real input clip paired with the app recording that read it, with measured times | `live_use` |
| `bridge.reaction` | a silent generated face of an approved character, performed from a real reference reaction | hook channel `reaction`, any beat with a `reaction` block |
| `bridge.face_replace` | the reference clip, trimmed, with its face replaced by the approved character | a reaction reference with `generation_input: "face_replace"` (the default) |

Never call a value runnable before its capability exists. Never replace a requested real cat with generated footage. Never relabel a silent action as talking to pass a check.

## How a video is planned

1. Read Layer 0. Record the source row and its disposition.
2. Map the requested type to the slots (`video-fit`). Inherit what the handle settles.
3. Choose one value per open slot, with a status: *evidence*, *claimed*, *experiment*, *user* (`video-plan`).
4. Select the recipe; fill each beat with exact words, action, time and proof (`video-script`).
5. Show the full draft; record the user's approval of that exact revision (`video-lock`).

## How to run an experiment

1. Pick one slot.
2. Hold every other slot at the base video's value.
3. Plan, approve and post. Record every slot value before posting.
4. Compare medians across posts that differ only in that slot, with the sample size beside the result. One outlier is not a result.
