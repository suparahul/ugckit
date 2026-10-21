# Blockers audit — 2026-10-21

**Principle.** The person who uses the kit decides what to make. The kit is a tool. It never
blocks a creative or format choice. It may warn, explain the trade-off and record the choice.

**Scope.** Every refusal in `template/scripts/character/*.py` (and the shell refusals of
`generate.sh` and the other P-step scripts), `template/scripts/planning/*.py`, and
`template/atlas` (the decide route, the other production routes, and the disabled buttons).
Line numbers are from the commit that adds this file.

**Already changed (2026-10-21, not part of this list).** `bridge.py` `check_live` and
`check_video_live`: a `live_use` video with no paired input, an unpaired recording, or a
motion-designed result is now a note, not a refusal. A declared pairing is still checked.

**The two groups.**

- **Group 1, integrity (keep).** It protects the user from a broken or wrong result: a missing
  file, a sha256 mismatch, a stale cut, money spent without a yes, a malformed field, an unknown
  id, an approval that does not match its digest, a permission, or a capability that production
  cannot make yet ("capability gap").
- **Group 2, choice override (do not change yet).** It refuses a choice the user made: a format,
  a demo source, a style, a pacing rule, or the approval of a take that failed a measured gate.
  "Borderline" marks an item with an integrity side too.

**Recommendations.** "warn + record": make it a note and record the choice in the plan or the
line. "keep, but let the user override with a recorded reason": the gate stays the default,
and the user can pass it with their words, as `review.py composite` and the plate insertion
gates of `review.py segment` already do. "remove": the rule has no integrity side.

## Summary

| Area | Refusals | Group 2 | Group 1 |
|---|---|---|---|
| `scripts/character/bridge.py` | 244 | 24 (12 borderline) | 220 |
| other `scripts/character/*` (shots, review, assemble, screens, …) | ~366 | 29 | ~337 |
| `scripts/planning/video_plan.py`, `reactions.py`, `scripts/character/demo.py` | 240 | 28 | 212 |
| `atlas` (routes, disabled buttons) | 108 | 18 (10 borderline) | 90 |

The Atlas counts a rule twice when the page disables the button and the route refuses again.

**The most important group-2 items:**

1. **Approval of a take that failed a measured gate**: identity (`review.py` 477, Atlas route
   230, `VideoProduction.tsx` 247), OCR text (`review.py` 484), motion-design gates
   (`review.py` 667, Atlas route 210), natural voice (`review.py` 717, `bridge.py` 466), gate C
   overlay checks (`review.py` 783, Atlas route 193). Keep the gate; add an override with the
   user's recorded words in the script, the route and the page.
2. **Motion design only when no recording exists** (`demo.py` 137 and 141, `video_plan.py` 270
   and 272): warn + record.
3. **Reaction rules** (never spoken, no narrator, face framing, the hook as a text overlay:
   `bridge.py` 746, 748, 751, 801, 804, 1165, 1167; `shots.py` 594, 598): warn + record.
4. **Pacing and length** (words per second `bridge.py` 541, `shots.py` 588; overlay read time
   `bridge.py` 873, `video_plan.py` 609; length bands `video_plan.py` 215): warn + record.
5. **Recipe structure** (`video_plan.py` 200, 202, 378, 546, 552, 555, 559) and the hook overlay
   in the first beat (`bridge.py` 903): warn + record.
6. **A progress_log series must show a day counter** (`bridge.py` 889): remove.
7. **Motion design only full screen** (`demo.py` 134): a capability gap today
   (`motion_design.py` renders 1080x1920 full frame only). It is what still stops the Leo
   drafts from motion-designing the capture screen that sits on the phone in beat b2.


## template/scripts/character/bridge.py

Audited on the current working tree (1505 lines). There are 239 `out.bad(...)` calls and 5 `sys.exit(...)` calls, so 244 refusals in all. The live_use notes in `check_live` (lines 954-966) and `check_video_live` (line 1434) are notes now, so this audit leaves them out. The other `out.bad` calls in those two functions are included. They check a pairing that the user declared.

Note: line 584 passes `out.bad` to `demo.check_beat(...)`. Those refusals live in `demo.py`, so this audit does not cover them.

### Group 2 — overrides a user choice (itemized)

| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 466 | `narrator {nid}: narrator status {...}; it must be 'live' (approved, and the natural-voice check passed)` | The user approved the voice, but a failed measured gate still blocks it. Borderline. | keep, but let the user override with a recorded reason. Record "used a voice that failed the natural-voice check". |
| 541 | `{tag}: {n_words} words in {e - s:g} s is over {MAX_WORDS_PER_S} words a second` | Fast speech is a pacing and style choice. | warn + record. Say that the line may sound rushed or that the lip sync may drift. |
| 569 | `{tag}: an original synthetic narrator never speaks over a visible human face` | A founder rule about style and honesty. Borderline: it also stops a fake voice from seeming to come from a real face. | keep, but let the user override with a recorded reason. |
| 603 | `{tag}: {sid} is a real animal; it is shown only in supplied footage, never generated` | The user may want to generate their own pet. Borderline: it is an honesty rule, and the likeness is also weak. | keep, but let the user override with a recorded reason. Warn that the animal will not look exactly like the real one. |
| 718 | `reaction ref {rid}: 'written' is the user's fallback after a failed motion take; written_reason holds...` | Written mode is the user's choice. The check asks them to justify it and blocks when there is no reason. | warn + record. Store a default reason when the field is empty. |
| 746 | `{tag}: a reaction is silent (silent_action, no line); a reaction hook is never spoken` | A founder creative rule (2026-10-03). A spoken reaction is a format choice. | warn + record. |
| 748 | `{tag}: a reaction has no voice and no narrator` | The same "never spoken" rule. A voice-over on a reaction is a choice. | warn + record. |
| 751 | `{tag}: a written reaction shows the face (framing face)` | A framing choice. The founder already relaxed this for motion copy. Borderline. | warn + record. Say that a written reaction without a face may show no expression. |
| 758 | `{tag}: no reference reaction yet (reaction null); a reaction is never invented...` | It forbids an invented reaction. Borderline: it also stops an unfinished plan. | keep, but let the user override with a recorded reason. An invented reaction is allowed when the user says so. |
| 801 | `{tag}: a reaction hook is never spoken; the hook channel is reaction (or text), not {ch!r}` | The hook channel is a creative choice. | warn + record. |
| 804 | `{tag}: a reaction hook runs the hook as a timed text overlay (role hook) over the face` | A creative rule: it requires a text overlay. | warn + record. |
| 865 | `{tag}: placement {...}; one of ... (never the lower band of the captions)` | Where to put an overlay is a layout choice. Borderline: the overlay can collide with the captions. | warn + record. Say that the overlay may sit under the captions. |
| 873 | `{tag}: {n} words for {e - s:g} s; it needs {need:.1f} s to be read` | Overlay length is a pacing choice, for example a quick flash. | warn + record. |
| 875 | `{tag}: the text is a hero string; the app's real words come from the real screen, never from an overlay` | It is a creative choice to repeat app copy as an overlay. Borderline. | warn + record. |
| 879 | `{tag}: a number on screen names its fact_refs (the sourced fact it states)` | Any digit triggers it, for example "3 tips" or "2am". Borderline: a real claim does need a source. | keep, but let the user override with a recorded reason, such as "not a claim". |
| 885 | `{tag}: a day counter belongs to a progress_log series` | It refuses a day_counter overlay outside a series. That is a creative use. | warn + record. |
| 889 | `a progress_log series shows its day_counter overlay` | It requires a day_counter overlay. | remove. Do not require any overlay. At most, add a note. |
| 903 | `the hook channel is {...}: a hook overlay starts in the first beat` | A creative rule about when the hook text appears. | warn + record. |
| 933 | `asset {aid}: the paired clip and recording are both shown (in the beats' source_asset_ids)` | It is the user's choice to show one side only. Borderline. | warn + record. Say that the pairing then proves nothing on screen. |
| 1165 | `{name}: a reaction is never spoken: no line, no audio_from, no voice` | The same rule as lines 746 and 748, at the video level. | warn + record. |
| 1167 | `{name}: a written reaction shows the face (framing_kind face)` | The same rule as line 751, at the video level. Borderline. | warn + record. |
| 1224 | `{name}: {x} is a real animal; never generated (supplied footage only)` | The same rule as line 603, at the video level. Borderline. | keep, but let the user override with a recorded reason. |
| 1429 | `live pairing of {aid}: the clip {cid} (C) and the recording (R or P) are both in video.json...` | The same rule as line 933, at the video level. Borderline. | warn + record. |
| 1444 | `{r['name']}: the result comes before its input ({c['name']})` | Showing the result first is a common hook order, so this is an editing choice. | warn + record. |

### Group 1 — integrity (keep)

**Schema and field values** (62): 222, 226, 230, 260, 269, 272, 274, 278, 282, 284, 286, 288, 291, 295, 298, 325, 329, 345, 350, 354, 356, 366, 371, 373, 382, 432, 436, 482, 493, 495, 498, 500, 502, 515, 608, 613, 617, 621, 700, 705, 707, 716, 721, 761, 765, 783, 809, 814, 820, 833, 841, 854, 857, 859, 882, 913, 922, 1248, 1350, 1370, 1376, 1379
- `schema_version is {...}; this production knows 2`
- `asset id {aid!r} is missing or used twice`
- `{tag}: panel {pid}: rect is [x, y, w, h] as shares of the 9:16 frame`
- Note: line 269 checks the editorial enums, including filming_format. That is a schema check, but it also limits formats to the known list. Line 841 only asks for the correct layout name.

**References and plan consistency** (74): 242, 300, 305, 309, 311, 313, 331, 384, 443, 447, 454, 459, 506, 535, 537, 546, 548, 551, 558, 563, 565, 573, 576, 578, 580, 582, 600, 605, 610, 626, 768, 825, 868, 916, 1056, 1060, 1064, 1066, 1081, 1137, 1143, 1146, 1151, 1169, 1176, 1179, 1181, 1186, 1196, 1198, 1204, 1208, 1215, 1220, 1227, 1229, 1234, 1237, 1239, 1251, 1255, 1257, 1261, 1276, 1285, 1289, 1294, 1296, 1298, 1300, 1361, 1363, 1397, 1399
- `{tag}: source asset {aid!r} is not in assets[]`
- `cast_kind {ck}, but the plan pins no character`
- `video.json overlays are not the plan's overlays, copied exactly`
- Note: line 1399 (`title_overlay stays off`) stops the text from being burned in twice. Line 551 (on_camera means framing face) follows from what on_camera means.

**Files and sha256** (11): 387, 391, 401, 404, 408, 410, 709, 726, 730, 732, 1366
- `asset {aid}: {p} is not on disk`
- `asset {aid}: {p} does not match its sha256 -- the file changed after the plan was locked`
- `{name}: motion_copy.clip is segments/{name}/source/reference.mp4 (shots.py reference), never the research file`

**Approvals and digests** (7): 464, 957, 964, 968, 971, 975, 1045
- `planning-approval.json is a dry run (dry_run true)...`
- `the plan's content does not match the approved digest...`
- `video.json is stale: plan_revision and plan_sha256 are those of another plan revision`

**Permissions, credits and honest claims** (12): 250, 293, 320, 333, 375, 377, 439, 449, 461, 887, 897, 919
- `asset {aid}: origin {o} needs permission_ref (the licence, the permission or the user's own note)`
- `beat {...}: {aid} is a {origin} clip; a source_credit overlay runs while it is on screen`
- `narrator {nid}: an original synthetic voice is never a clone of a real person`
- Note: line 250 (music is a note only) is about music rights. Line 333 (a counter alone is not progress) and line 919 (a live input must be the user's own capture) stop false claims.

**Timing and ranges** (24): 395, 412, 486, 489, 623, 711, 737, 786, 789, 795, 797, 829, 831, 862, 926, 928, 1073, 1117, 1125, 1244, 1246, 1420, 1439, 1442
- `{tag} starts at {s} s; the previous beat ends at {t} s...`
- `asset {aid}: trim_s ends at {trim[1]} s; the file is {dur:.2f} s`
- `the segments plan {total:.2f} s; the plan's length is {length} s`

**Capability gaps** (25): 519, 523, 526, 528, 554, 593, 595, 753, 755, 774, 777, 1148, 1158, 1163, 1184, 1264, 1267, 1269, 1272, 1279, 1354, 1357, 1382, 1384, 1388
- `{tag}: continues_previous joins two generated clips; {who} is supplied, panels or the app`
- `{name}: one segment, one demo source; its beats are {sorted(kinds)}`
- `{name}: motion_copy.route {route!r} is retired ...; use motion`
- Note: these refuse a choice that production cannot make yet. Line 753 (a reaction is the face alone: no panel, no app) and line 528 (continues_previous stays in the same set) are the nearest to group 2. Lines 1148, 1184 and 1279 also keep the real app from being generated.

**CLI and exits** (5): 1455, 1463, 1470, 1488, 1500
- `sys.exit(f"no pipeline/character/{video}/plan.json")`
- `sys.exit(1)` in `finish`, which ends the run when there are problems
- `sys.exit(__doc__)`, the usage message

### Counts

- Group 2 (overrides a user choice): **24** (borderline: 466, 569, 603, 751, 758, 865, 875, 879, 933, 1167, 1224, 1429)
- Group 1 (integrity): **220** (62 schema, 74 references, 11 files, 7 approvals, 12 permissions and claims, 24 timing, 25 capability gaps, 5 CLI)
- Total: **244** (239 `out.bad` and 5 `sys.exit`)

## Part: Refusal audit: planning files

Read-only audit of the working tree on 2026-10-21. Line numbers are current. bridge.py and the filming_format live_use pairing are left out.

Counts are refusal sites, counted by grep and rounded by hand, (each `out.no`, `bad`, `block.append` or `sys.exit` call). Notes (`out.note`, `note`, `dep.append`) are not refusals and are not counted. `dep.append` items do not block the lock.

| File | Refusal sites | Group 2 | Group 1 |
|---|---|---|---|
| template/scripts/planning/video_plan.py | 188 | 22 | 166 |
| template/scripts/planning/reactions.py | 26 | 2 | 24 |
| template/scripts/character/demo.py | 26 | 4 | 22 |
| **Total** | **240** | **28** | **212** |

---

## template/scripts/planning/video_plan.py

Refusal sites: 188 (22 group 2, 166 group 1). The exit codes at 1527 and 1531 only repeat the lists above them and are not counted.

### Group 2

| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 200 | `recipe {id} is for lanes {...}, not {lane}` | A recipe/lane pairing is a creative mix. The same file already only warns about a hook outside its listed formats (line 190). | warn + record. Do the same as line 190: a note and a reason in `choices`. |
| 202 | `recipe {id} is for formats {...}, not {ff}` | A recipe/format pairing is a creative mix. | warn + record. The same as line 200. |
| 378 | `recipe {id} does not take lane {..} with format {..}` | The same rule as 200/202, checked again in the plan contract. | warn + record. Read the reason from the brief's choices. |
| 215 | `anatomy.length_band {lb}; one of [...]` | Only 10, 15, 20, 30 and 35-60 s are allowed. A 12 s or 25 s video is refused. This is a length choice. | warn + record. Keep the bands as guidance and accept another length with a note. |
| 222 | `{n} hook alternatives; one to three` | The cap of 3 is a working habit. It is not about integrity. (Zero alternatives would break `selected_hook`, so a minimum of 1 can stay.) | warn + record. Keep the minimum of 1 and only warn above 3. |
| 225 | `hook alternative {id}: job {..}; alternatives stay within {job}` | A user may want to compare two hook jobs. Borderline. | warn + record. |
| 229 | `hook alternative {id}: channel {..}; a reaction hook is never spoken` | This comes from a recorded user decision (2026-10-03), but it is a format rule that blocks any spoken or other alternative. Borderline. | keep, but let the user override with a recorded reason. |
| 270 | `screen {sid}: motion design needs demo_source_reason (why no real recording)` | Recording the choice is fine. Asking the user to justify it ("why no real recording") is not. Borderline. | warn + record. Accept any reason, including "the user's choice", and make an empty reason a note. |
| 272 | `screen {sid} is a real {kind} in the library: use it, not motion design` | It refuses the user's choice of demo source. | warn + record. Say that a real recording exists and keep the user's choice (demo.py 145 already has the right note). |
| 342 | `format.dimension is 9:16` | It refuses any aspect ratio other than vertical. This is partly a capability gap, because production and motion_design render 1080x1920 only. Borderline. | keep, but say in the message that it is a capability gap ("production renders 9:16 only for now"), not a rule. |
| 491 | `beat {bid}: {n} words in {d} s, over 15 words per 4 s` | A speech-pace ceiling is pacing taste. Fast talkers exist. It may partly be a capability gap (lip sync or TTS fit per segment). Borderline. | warn + record. Make it a note, as line 493 already is near the ceiling. |
| 546 | `role {r} repeats; {recipe} has one {r} beat` | The recipe's beat structure is a template. Changing it is a creative choice. | warn + record. |
| 552 | `role {r!r} is not a beat of {recipe}` | The same: an extra beat type. | warn + record. |
| 555 | `role {r} is out of the order of {recipe}` | The same: reordering beats. | warn + record. |
| 559 | `{recipe} needs a {role} beat` | The same: dropping a beat. Borderline (the recipe may then no longer mean what its name says). | warn + record. |
| 609 | `overlay {oid}: {n} words for {d} s; it needs {x} s` | The read time (3 words/s, minimum 1 s) is readability taste. A flash overlay can be intentional. | warn + record. |
| 611 | `overlay {oid}: the app's real words come from the real screen, never an overlay` | Repeating the app's hero line as an overlay is a style choice. It is not false, because the words are the app's real words. Borderline. | warn + record. |
| 616 | `overlay {oid}: a day counter belongs to a progress_log series` | A "Day 1" overlay without a series is a style choice. Borderline: it could suggest a series that does not exist. | warn + record. |
| 723 | `reaction ref {rid}: "written" is only the user's fallback after a failed motion take` | The user can only choose the written route after a failed take. Asking for `written_reason` is fine, but the "only after a failed take" part refuses a choice made up front. | keep, but let the user override with a recorded reason. Accept any reason in `written_reason`. |
| 729 | `beat {b0}: a reaction hook is never spoken; the first beat is a silent_action` | This comes from a recorded user decision, but it is a format rule. A talking reaction hook is refused. Borderline. | keep, but let the user override with a recorded reason. |
| 744 | `beat {bid}: a reaction is silent: no line, no voice-over` | The same rule for every reaction beat. Borderline. | keep, but let the user override with a recorded reason. |
| 763 | `beat {bid}: {d} s; a motion-copy beat lasts its clip ... at normal speed` | It refuses a slow-motion or trimmed take. This is partly a capability gap, because motion copy follows the clip's own timing. Borderline. | keep, but say "production can only copy at the clip's speed for now". Move it to a note when retiming exists. |

Two items at the edge that I kept in group 1, and that may be worth a second look:
- **733/734** `a written reaction hook shows the reacting face`: this is definitional for the written route (a reaction with no clip needs a visible face). It is group 2 only if the user wants a hands-only reaction.
- **602** `placement ...; never the caption band`: this protects against an overlay colliding with the auto captions. It is integrity of the result, not a layout taste.

### Group 1 (keep)

**Malformed or missing fields, unknown values (controlled vocabulary, enums, required keys)**: 165, 169, 174, 177, 181, 185, 188, 192, 194, 197, 205, 207, 209, 212, 242, 244, 254, 260, 267, 331, 334, 338, 344, 347, 355, 363, 367, 369, 372, 375, 381, 383, 385, 388, 390, 392, 394, 397, 399, 411, 421, 431, 435, 437, 443, 445, 455, 457, 461, 469, 471, 477, 479, 481, 499, 521, 531, 597, 600, 602, 605, 707, 712, 714, 716, 718, 721, 739, 748, 752, 771, 774, 1026 (schema).
- "brief has no '{k}'"
- "anatomy.hook.job_id ... is not one of the twelve hook jobs" (the local patterns.json overlay is the way to add a job)
- "beat {bid}: performance {perf!r}"

**Internal consistency (two fields of the same plan disagree, or a definition is broken)**: 219 (length_s inside its own band; this follows from 215), 250, 415, 417, 425, 464, 473, 485, 487, 495, 497, 501, 517, 519, 533, 536, 564, 566, 568, 570, 573, 576, 580, 586, 588, 620, 622, 734, 765 (a motion copy's first frame comes from the clip, so set_id would be ignored), 777, 784, 786.
- "beat {bid} starts at {s} s; the beat before ends at {t} s"
- "the app is said in N line(s) ...; product.speech_count is ..."
- "hook channel {..}: a hook overlay starts in the first beat"

**Protects the user's own row choice (PLAN.md row fields)**: 305, 309, 311, 314, 316, 321, 323.
- "the row's {k} {v!r} is the user's decision: a choice ... with status user"
- "the row's video type is {v!r}; anatomy.filming_format is ..."
- "the row's hook is h1, verbatim, and the selected hook"

These refuse an agent drifting from the user's row, so they belong in group 1. One gap: if the user changes their mind in conversation, there is no way to say so. Let a choice with status user and a newer reason supersede the row.

**Facts and sources (no claim without a source, nothing invented)**: 257, 405, 423, 529, 614, 635, 893.
- "fact {id} has no source"
- "beat {bid}: a number is said; it needs fact_refs or the real screen"
- "professional_basis needs a verified supplied speaker or a sourced fact"

**Identity and honesty of the cast**: 506, 513, 736.
- "a synthetic narrator never speaks over a visible human face"
- "a generated face needs a pinned cast"

**Reaction reference is real, never made up**: 232, 237, 756, 868.
- "never write a made-up reaction"
- "beat {bid}: no reference reaction ... the performance is never made up"

**Missing file, unknown id, sha256 or library mismatch**: 247, 436 (absolute path), 510, 680, 683 (a retired library entry), 686, 689 (range differs; `library_differs` already allows an override), 691, 838, 853, 855, 857, 874, 876, 878, 880.
- "asset {aid}: {p} is not on disk"
- "reaction ref {rid}: {vp} changed since it was pinned"

**Real screen and hero string**: 523, 844, 846.
- "hero string of {sid}: the plan says ...; the real screen says ..."

**Permission and legal**: 860 ("asset {aid}: no permission_ref"), 863 (input and output times measured on the real capture).

**Stale catalogue, template text left in**: 276, 279, 349, 402.
- "the brief pins taxonomy ...; the catalogue is now ..."
- "template text left at {p}"

**Approval and lock integrity**: 934, 1320, 1325, 1328, 1330, 1353, 1361, 1367, 1374, 1376, 1383, 1395.
- "the draft's digest is {got}; the approval is for {want}"
- "the plan is not approved: the user's words and date (a dry run)"
- "the Atlas line was written by {actor}, not by the user"

**Command usage**: 1477, 1485, 1497, 1499.

**Demo source (delegated)**: 526 calls `demo.check_beat(..., out.no, ...)`. It is classified under demo.py below.

---

## template/scripts/planning/reactions.py

Refusal sites: 26 (2 group 2, 24 group 1). These are `sys.exit` calls and the `problems()` list that `check` exits on.

### Group 2

| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 204 | `{post_dir}: a library entry points into research/ or apps/<slug>/niche/batches/ only` | It refuses a reaction clip the user keeps anywhere else, such as their own folder. This is partly a capability gap, because the Atlas only serves videos from those two places. Borderline. | keep, but let the user override with a recorded reason, and say the Atlas cannot preview the clip. |
| 365 | `the post is not in research/ or an app's niche batches` | The same rule in `check`. | The same as 204. |

### Group 1 (keep)

**Malformed field, range or controlled vocabulary**: 206, 210, 214, 241 (through 270 and 375), 251, 260, 264, 361, 374, 378.
- "start_s and end_s: the exact range of the reaction in the post"
- "unknown tag(s) {bad}; the list is docs/character/reaction-tags.json" (the tag list is controlled vocabulary; the fix is to add tags to the file)
- "the range ends at {end_s} s; the video is {dur} s long"

**Missing file, unknown id, duplicate, sha256**: 126, 218, 239, 247, 368, 370, 372.
- "{post_dir}: no video in the folder; fetch the post first"
- "the video changed since its sha256 was written"

**Protects the user's own choice**: 363 ("kept, but not by the user: only the user keeps an entry"). `describe` also skips the fields in `set_by_you` without refusing.

**Aggregate exit**: 391 (`check` exits 1 when any entry has a problem; it covers the lines above).

**Command usage**: 446, 450, 456, 462.

---

## template/scripts/character/demo.py

Refusal sites: 26 `bad(...)` calls in `check_beat` (4 group 2, 2 of them borderline; 22 group 1). These calls are used by video_plan.py line 526 and by bridge.py.

### Group 2

| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 134 | `motion design is rendered full screen: framing app_screen ...; a phone plate or a panel shows a real recording` | It refuses motion design on a phone plate, in a split screen or as picture-in-picture. **This is partly a capability gap**: motion_design.py renders only a full 1080x1920 frame. The second half ("a phone plate or a panel shows a real recording") is a style rule. | keep while the gap exists, but reword it as a capability gap ("production cannot place motion design on a phone plate or a panel yet"). Make it a note once the composite can take the render. |
| 137 | `motion design needs demo_source_reason: why no real recording shows this screen` | It asks the user to justify a choice. Borderline. | warn + record. Accept any reason, and make an empty one a note. |
| 141 | `screen {sid} is a real {kind} in the screen library: demo_source ... (a real recording is preferred to motion design)` | It refuses the user's chosen demo source for a screen that has a recording. | warn + record. Keep the user's choice and note that a recording exists. Line 145 already does this for other screens. |
| 192 | `the first step is at 0 s (the screen is there from the beat's first frame)` | A lead-in before the first step could be intended. However, nothing is defined to render before it (blank frames). Borderline. | keep, but let the user override with a recorded reason, or render the first screen held from 0 s. |

### Group 1 (keep)

**Demo source consistency (wrong source kind, wrong field for the source)**: 115, 119, 122, 128, 130, 148.
- "a screen_story belongs to demo_source motion_design"
- "screen {sid} is a {kind} in the library; demo_source {ds} says otherwise"
- "a motion-designed screen is rendered, not supplied (no source_asset_ids)"

**No invented UI (source of truth is PRODUCT-SCREENS.md and the app's code)**: 157, 160, 164, 166.
- "PRODUCT-SCREENS.md does not exist: motion design rebuilds only the screens it describes"
- "screen {n!r} is not a heading of PRODUCT-SCREENS.md"

**Malformed or missing screen story fields**: 139, 151, 168, 171, 177, 179, 183, 185, 188, 190.
- "step {k}: at_s {at!r} is seconds from the beat's start"
- "step {k}: shows lists every in-app string visible at this step, word for word"

**Hero string matches the real screen text**: 197, 199.
- "hero string {hero!r} is not one of the strings its screen_story shows"

---

## Main points

1. The most important item is the **demo source pair**: demo.py 141 and video_plan.py 272 ("a real recording ... use it, not motion design"). Both should become notes, as demo.py 145 already does.
2. **Recipe rules** (200, 202, 378, 546, 552, 555, 559) block creative structure. The kit already has the right pattern at line 190 (a note plus a reason in `choices`).
3. **Length** (215) allows only five bands, so 25 s or 12 s cannot be planned.
4. **Pacing and readability ceilings** (491, 609) should be notes.
5. **Reaction format rules** (229, 723, 729, 744) come from recorded user decisions, but they leave no override path.
6. **Capability gaps** that are written as rules: demo.py 134 (motion design full screen only), 342 (9:16 only), 763 (motion copy at clip speed only), reactions.py 204/365 (served folders only). Keep them, but word them as "production cannot yet".

## Part: Refusal audit: template/scripts/character (all but bridge.py and demo.py)

Read-only audit of the working tree on branch `atlas-niche-video-player`, 2026-10-21. The line numbers are the current ones.

Rule used: the user decides what to make. The kit may warn, explain the trade-off and record the choice. It refuses only to protect the user from a broken or wrong result.

Already good, for reference: `review.py composite` (line 750 on) and the plate insertion gates in `review.py segment` (lines 518-523) **warn and record** when a gate failed ("recorded on the user's word"). That is the pattern the group 2 items below should follow.

---

## template/scripts/character/shots.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 431 | `{f} is supplied media -- it goes into the video as it is, never into a generation` | Borderline. Using your own supplied photo as a generation reference is a creative choice. It is a legal issue only when the permission does not cover it. | keep, but let the user override with a recorded reason. Refuse only when the asset's permission is "as-is only". |
| 580 | `trim_to_seconds {trim!r}; it is the planned length, 3 s or more and ...` | Borderline. The "3 s or more" floor is a pacing taste; a 2 s cut is a valid edit. (Trimming under the generated length is still integrity.) | warn + record. Keep "under the generated length" as a hard rule. |
| 588 | `{words} words in {planned} s is over {MAX_WORDS_PER_S} words a second` | Speaking speed is a creative choice (fast-talk formats exist). | warn + record. Say that the lip sync may suffer. |
| 594 | `an X segment is a silent reaction: no line, no audio_from (a reaction hook is never spoken)` | Borderline. "A reaction hook is never spoken" is a format rule. A spoken reaction can be offered as a T segment. | keep, but let the user override with a recorded reason, or point to T in the message. |
| 598 | `a written X segment shows the face (framing_kind face)` | Framing is a creative choice; motion copy already allows no face (founder, 2026-10-19). | warn + record. |
| 610 | `a B segment with a face is an approved mascot; a human face that acts silently is still a T ...` | Borderline. A silent human face shot is a valid creative choice; the rule sorts it into a type. | keep, but let the user override with a recorded reason (or re-type it as T on the user's yes). |
| 624 | `a {t} segment has no phone (the app is shown only by O, G, S, H, F, R or P)` | Borderline. A phone as a prop (screen dark or turned away) in a T or B shot is a staging choice. The real risk is a fake app screen. | warn + record. Require the prompt to say the screen is not visible. |
| 961, 1048 | `OCR still reads text on the masked clip: ...` | Borderline. This is the text gate on the motion-copy input. It protects against leaving the original creator's watermark (legal), but OCR also reads harmless text such as a sign in the room. | keep, but let the user override with a recorded reason ("the text is not a handle or watermark"). |
| 1000 | `the reference carries burned-in text (...); write motion_copy.masks in the shot first` | Borderline. This is the same text gate, from the research note. | keep, but let the user override with a recorded reason. |

### Group 1 (keep)
- **Missing file or prerequisite**: 116, 253, 258, 272, 295, 316, 330, 341, 352, 357, 458, 462, 474, 540, 693, 753, 764, 828, 846, 949, 976, 1080. Examples: `no ... plan.json -- production starts only from a locked, approved plan`, `no handle folder ...`, `{raw}: no approved anchors in creator.json`.
- **Approval or prerequisite stage**: 193, 280. Examples: `the plan is not approved: 'approved' needs the user's words and the date`, `status ...; P1 needs 'video-setup' or 'live'`.
- **Malformed field or unknown id**: 184, 190, 200, 203, 208, 212, 214, 219, 227, 236, 240, 268, 277, 308, 310, 326, 328, 337, 424, 427, 450, 454, 456, 494, 506, 515, 524, 526, 531, 535, 543, 602, 608, 616, 622, 626, 629, 771. Examples: `two script lines share an id`, `beat {i}: screen {sid} is not in SCREENS.md`, `hands.{side} has no job`.
- **Plan and video.json agree**: 223, 233, 243, 485, 487, 498, 510, 676. Examples: `beat {i} shows the app, but app_insertion is false`, `lines no segment carries: ...`.
- **Model capability (the model cannot do it)**: 198 (9:16 only for now), 464, 559, 563, 567, 569, 573, 577. Examples: `format.dimension is ...; 9:16 is the only size for now`, `{images} ... reference pictures; the model takes at most ...`, `motion_copy.route ... is retired`.
- **Segment type definition / technical (the pipeline needs it this way)**: 429 (the app is never a reference: reference conditioning cannot draw text; the app comes in at P4), 437, 440, 443, 445, 447, 591, 600, 604, 613, 620, 635, 639, 645, 648, 653, 656, 659. Examples: `a {t} segment has the phone up and green from the first frame`, `every generated segment starts from its own keyframe`.
- **Legal / identity (no copy of another creator)**: 433. Example: `{f} is research footage or the reference reaction -- never attached as it is`.
- **Checksum / stale**: 859, 957, 959, 997, 670 (continuity after gate A). Examples: `... is missing or does not match its sha256`, `reference.json was made from another clip, range or masks`.
- **Tool failure**: 870, 1025, 1030, 1064. Example: `ffmpeg could not cut the plate`.
- **CLI usage / exit after problems**: 96 (`finish()` exits 1 when there are problems), 1094, 1108.
- **Continuity rules**: the `bad` rows from `continuity.rules` (line 669) are listed under continuity.py.

---

## template/scripts/character/review.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 444 | `a motion-copy reaction is approved with --check identity=pass ...` | Borderline. Approval needs the user's own eye checks marked "pass". A user who sees a small flaw and accepts it cannot approve. | keep, but let the user override with a recorded reason (`--check identity=accepted:<why>`). |
| 477 | `identity gate {result}: ... A motion-copy reaction is not approved when a face it shows is measured as not the character's` | A measured gate (identity) refuses the user's approval. | keep, but let the user override with a recorded reason. Store the measurement next to the reason. |
| 484 | `OCR reads text on the file: ... a burned-in caption, handle or watermark of the reference is left` | A measured gate (OCR) refuses approval. OCR can read harmless text. | keep, but let the user override with a recorded reason ("not a handle or watermark"). |
| 491 | `a silent reaction is approved with --check ...=pass ...` | Borderline. The same as 444, for the written X reaction. | keep, but let the user override with a recorded reason. |
| 667 | `cannot approve: the gates failed (...); change the page, render and check again` | Any failed motion-design gate blocks approval. `story_text`, `text_read`, `hero` and `assets` are quality or creative checks. `current`, `format` and `page` are integrity checks. | keep for current/format/page; for story_text, text_read, hero and assets: keep, but let the user override with a recorded reason. |
| 673 | `cannot approve: {gate} was not run (...); the user reads the stills and says so: --check k=pass` | Borderline. When no OCR engine is installed, the user's only option is to say "pass". | warn + record. Accept a recorded "not checked" with the user's words. |
| 717 | `a synthetic narrator's take is approved only after the natural-voice check ...` | A QC gate on the voice. A flat or TTS cadence can be a deliberate style. | keep, but let the user override with a recorded reason. |
| 783 | `cannot approve: {failed} failed on the final file (assembly.json)` | Mixed. `overlays readable`, `overlays clear of heroes, captions and each other` and `overlays read back (OCR)` are layout and readability checks, so they are a choice. `overlays as planned` and `supplied files unchanged` are integrity checks. | keep for "as planned" and "supplied unchanged"; for readable, clear and OCR: keep, but let the user override with a recorded reason. |

### Group 1 (keep)
- **Approval authenticity / stale against the click**: 161, 165, 173, 175, 779, 824. Examples: `the last Atlas line was written by ..., not by the user: it is not a decision`, `... changed after the click ...: the user decides again`, `the file was assembled from another revision of the plan`.
- **The user's words required**: 415, 598, 651, 697, 735, 771, 814. Example: `an approval needs the user's words (--words)`.
- **Missing file / order of gates**: 294, 421, 424, 584, 606, 655, 664, 708, 738, 742, 746, 774, 819, 935. Examples: `no file in segments/{seg}/generated/`, `... has no approved plate at gate B; approve the plate first`, `no keyframe yet for ...`.
- **Unknown id / malformed**: 602, 702, 714, 748. Examples: `{asset_id} is not in the plan's assets[]`, `--lines names the voiceover lines of ...`.
- **Source integrity (checksum, permission, range)**: 627. Example: `cannot approve: the file does not match the plan's sha256` / `origin ... has no permission_ref`.
- **Length gates (the take does not fit its planned slot)**: 455, 464, 499. Example: `the file is ... s; the shot plans ... s (duration gate)`. Borderline: they are measured, but a take that is too short breaks the cut.
- **Continuity seed (stale)**: 506, 508, 512. Example: `... was seeded with another last frame of ...: regenerate`.
- **Wrong command for this narrator**: 704.
- **Tooling**: 473 (`the identity gate needs opencv`).
- **CLI usage**: 119, 251, 412, 595, 648, 694, 768, 811, 988, 997, 1019.

---

## template/scripts/character/assemble.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 222 | `the sound under it runs ... s; the picture is ... s. The take is too long for the planned beat` | Borderline. "The plan's timing is never stretched" is an editing rule. The user may prefer to hold the last frame, or to cut the audio. | keep, but let the user override with a recorded reason (hold the frame or cut the audio). |
| 1019 | `sys.exit(1 if failed else 0)` after the final checks; state set to `failed` | Borderline. The file is written, but the stage is marked failed even when only overlay readability, overlap or loudness failed, which are style checks. | warn + record. Mark the stage failed only on the integrity checks (format, sound track, overlays as planned, supplied unchanged). |

### Group 1 (keep)
- **Approval missing (no generation or approval skipped)**: 540, 548, 596, 619, 655. Examples: `{proj} has no approved file at gate B`, `no approved composite`.
- **Stale / revision**: 523, 560, 563. Examples: `video.json was written from another revision of the plan`, `its approved take was not seeded with the current last frame`.
- **Plan consistency / malformed**: 513, 545, 567, 575, 582, 588, 610, 626, 630, 635, 642, 649, 659. Examples: `a phone segment in a plan without app insertion`, `unknown type {t}`, `a P segment needs audio_from`.
- **Technical (the cut cannot be made)**: 696. Example: `the continuous cut leaves ... s`.
- **Tooling**: 90, 128, 913, 918. Examples: `ffmpeg failed`, `faster-whisper is not installed`, `node is not installed`.
- **Exit after problems / usage**: 507, 663.

---

## template/scripts/character/state.py

### Group 1 (keep)
- **Usage of the CLI**: 106, 114, 169, 174, 180, 188, 193, 210, 222. Example: `usage: state.py model set <model-slug> <duration-seconds>`.
- **Unknown id / malformed**: 60, 117, 120, 124, 191, 214. Examples: `unknown video ...`, `duration must be a whole number of seconds`.
- **Model capability**: 127, 130. Example: `{slug} caps at {max}s -- {dur}s would be rejected`.
- **Prerequisite**: 153. Example: `no model selected`.

---

## template/scripts/character/screens.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 175 | `marked expired (the app's UI changed) -- the user records it again` | Borderline. Showing an older UI can be a deliberate choice (a "before" shot, or a short-lived video). | warn + record. |
| 201 | `{n} gestures; one recording, one job, at most three gestures` | A rule for how to record the screen; a longer demo is a creative choice. | warn + record. |
| 204 | `the first gesture at ... s; hold a stable frame 0.5 s first` | A recording rule (timing taste). | warn + record. |
| 206 | `the last gesture at ...; end on the result and hold 1 s` | A recording rule. | warn + record. |
| 209 | `only ... s after the tap at ...; pause 0.4 s or more` | A recording rule. | warn + record. |
| 234 | `hero '...' read in the source: similarity ...` (bad when OCR does not match) | Borderline. An OCR gate on the user's own recording; OCR can misread. | keep, but let the user override with a recorded reason. |

### Group 1 (keep)
- **Missing file**: 164, 177, 247, 255, 271. Examples: `... is not on disk`, `no segments/{seg}/insert.json`.
- **Malformed field**: 180, 182, 189, 196, 199, 259. Examples: `mode is light or dark`, `hero rect ... is not inside the ... source`, `the events need times in seconds, in order`.
- **Wrong segment / plan consistency**: 261, 264. Example: `the plan has no app insertion`.
- **Exit after problems / usage**: 238, 361, 369.

---

## template/scripts/character/motion_design.py

### Group 1 (keep)
- **Wrong segment / unknown id**: 96, 100, 102, 105. Example: `{seg} is a {type} segment: motion design is an R or P segment`.
- **Missing or stale input**: 185, 187. Examples: `no .../index.html`, `story.json is not the plan's story now`.
- **Tooling**: 189, 201, 352. Examples: `the render needs node and ffmpeg`, `the render failed`.
- **Report exit code**: 361 (`sys.exit(1 if failed else 0)` after the gates are written). It blocks nothing; the approval refusal is review.py 667.
- **Usage**: 414, 418.

---

## template/scripts/character/screen_comp.py

### Group 1 (keep)
- **Missing input / malformed**: 91, 96, 120. Examples: `insert.json has no source`, `the source is missing`, `unknown source_kind`.
- **Technical (cannot composite)**: 262, 324, 356. Examples: `no green screen in the plate`, `finger-driven: no contact found`.
- **Usage**: 441, 446.

---

## template/scripts/character/continuity.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 257 | `set ...; the clip it continues is in ... (a continuous take stays in its set)` | Borderline. Moving to another room across a continuous cut (a walk-through) is a creative choice; the result may look odd. | warn + record. |
| 266 | `punch_in ... against ...: a continuous take keeps one framing across the cut` | A framing rule; a punch-in on a match cut is a common editing choice. | warn + record. |

### Group 1 (keep)
- **Malformed / wrong neighbour**: 236, 244, 260. Examples: `continuity is {"from": "<the previous segment>"}`, `continuity.from is ...; a clip continues from the segment right before it`.
- **Capability (a segment type or model that cannot continue)**: 250, 253, 269, 272. Examples: `only T, B and X ... continue or are continued`, `the model ... has no continuity input`.
- **Technical**: 263. Example: `a continuing segment starts at its first frame: no trim`.
- **CLI exits / report**: 304, 309, 319, 323, 327.

---

## template/scripts/character/identity.py

### Group 1 (keep)
- **Checksum**: 58. Example: `{name} does not match its checksum; it was removed`.
- **Missing file**: 134.
- **Usage / report exit code**: 203, 206 (exit 1 on FAIL; it blocks nothing by itself; the approval refusal is review.py 477).

---

## template/scripts/character/lint_prompt.py

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 428 | `sys.exit(1 if fails else 0)`. Every FAIL counts the same | Borderline. No script enforces it; the character-shots skill (SKILL.md:327) runs it before spend. Some checks are style choices: `no booster or glamour word` (227), `sections` order (221), `word budget` (267), `no conflicting camera words` (263), `short (an editing model)` (351). Others are integrity: length limit, `reference pictures within the limit`, `no copy of the reference`, `no generation parameter`. | warn + record for the style checks; keep exit 1 only for the integrity ones. |

### Group 1 (keep)
- **Usage**: 407, 419. Examples: the usage text, `no segment has a prompt.txt yet`.

---

## template/scripts/character/qc.py

### Group 1 (keep)
- **Usage / missing file**: 33, 44. Example: `no video in .../generated/`.
- **Report exit code**: 40 (passes screen_gates' code through; it blocks nothing, and `review.py` records failed insertion gates with a warning).

## template/scripts/character/ocr.py
No refusals.

## template/scripts/character/screen_gates.py
### Group 1 (keep)
- **Missing input**: 271 (`return 1`: `no composite, or no track of it`). The gates print PASS, FAIL or NOT RUN; nothing else refuses.

## template/scripts/character/screen_track.py
No refusals.

---

## template/scripts/character/generate.sh

### Group 2
| Line | Message (short, verbatim start) | Why it is a choice | Recommendation |
|---|---|---|---|
| 183 | `FATAL: {seg}: text is left on the reference clip (...): mask it before generation` | Borderline. The same OCR text gate as shots.py 961/1048, here before money is spent. | keep, but let the user override with a recorded reason (stored in reference.json and read here). |

### Group 1 (keep)
- **Spending without a yes**: 100-109 (`ALLOW_REFS=1 after the user's yes`), 521-527 (`CONFIRM=1`, exit 3), 124 (`the storyboard of this video is not approved`), 200 (`keyframes/{seg}.png is not the keyframe approved at gate A`).
- **Capability / founder paid test**: 524 (`motion copy is not approved for a live run (capabilities.json bridge.motion_copy is false)`), 55, 142 (R and P are never generated), 94 (prompt over 5000 characters), 160, 187, 261, 266, 270, 274, 279, 283, 338, 341, 343, 349, 354 (model limits, retired route), 461.
- **Prerequisite**: 137 (`{pin} is not live`). Borderline: it is a process gate (video half, voice, twenty-generation gate), but it protects the character's identity.
- **Missing / stale input**: 90, 175, 177, 181, 189, 198, 213, 246, 250, 608. Examples: `no masked reference clip`, `the reference clip is not the pinned range of the pinned file`.
- **Malformed refs / route shape**: 169, 195, 205, 208, 219, 225, 234, 243.
- **Legal (research or other creator's footage; supplied media as a reference)**: 222, 231. Note: 222 has the same borderline as shots.py 431.
- **Credentials**: 83, 84, 539.
- **Provider failure**: 500, 508, 556, 557, 559, 567, 574, 576, 588, 613, 619, 627, 633, 658.

## Other shell scripts (assemble.sh, deliver.sh, composite.sh, keyframes.sh)
- **assemble.sh**: no refusal of its own; it runs assemble.py.
- **deliver.sh**, all Group 1: 21 (no assembly.json), 24 (gate C not approved), 30 (the grain export was chosen but not made), 33, 35 (gate C approved another or older assembly: stale).
- **composite.sh**, all Group 1: 31, 34, 37 (wrong segment or no app insertion), 39, 42, 62 (missing input). Line 79 exits 1 when a gate failed, but the composite is kept, and `review.py composite` approves it with a recorded warning. That already follows the principle.
- **keyframes.sh**, Group 1: 44 (shots.py job failed: a reference is missing), 73 (the keyframe run or the verify step failed).

---

## Counts

Refusal sites are approximate. They count the `bad(...)`, `sys.exit(...)` and `("bad", ...)` lines, and include the usage exits and the exit after problems.

| File | Refusal sites | Group 2 | Group 1 |
|---|---|---|---|
| shots.py | ~120 | 9 (431, 580, 588, 594, 598, 610, 624, 961/1048, 1000) | ~111 |
| review.py | ~58 | 8 (444, 477, 484, 491, 667, 673, 717, 783) | ~50 |
| assemble.py | ~30 | 2 (222, 1019) | ~28 |
| state.py | 18 | 0 | 18 |
| screens.py | ~20 | 6 (175, 201, 204, 206, 209, 234) | ~14 |
| motion_design.py | 12 | 0 (the block is review.py 667) | 12 |
| screen_comp.py | 8 | 0 | 8 |
| continuity.py | 15 | 2 (257, 266) | 13 |
| identity.py | 4 | 0 (the block is review.py 477) | 4 |
| lint_prompt.py | 3 | 1 (428, style checks) | 2 |
| qc.py | 3 | 0 | 3 |
| ocr.py, screen_gates.py, screen_track.py | 1 | 0 | 1 |
| generate.sh | ~60 | 1 (183) | ~59 |
| deliver.sh, composite.sh, keyframes.sh | 14 | 0 | 14 |
| **Total** | **~366** | **29** | **~337** |

The most important group 2 items are the approvals blocked by a measured gate: review.py 477 (identity gate), 484 (OCR text on the take), 667 (motion-design gates), 717 (natural-voice check), 783 (overlay readability, overlap and OCR on the final file), and 444 and 491 (eye checks must say "pass"). review.py composite (around line 750) already shows the fix: approve, print a warning, and record the failed gates with the user's words.

## Part: Atlas audit: refusals and disabled buttons

Scope: `template/atlas` (read only). Paths below are relative to `template/atlas/`.
Rule used: Group 1 = protects the user (integrity). Group 2 = overrides a choice the user made.

## Counts

| Where | Group 2 | Group 1 (keep) |
|---|---|---|
| app/api/production/decide/route.ts | 6 (3 clear, 3 borderline) | 30 |
| other app/api/production/* routes (incl. the send checks in lib/postbridge-flow.ts, lib/video-post.ts) | 4 (2 clear, 2 borderline) | 27 |
| components/production/*.tsx (+ lib/production.ts primaryAction) | 8 (3 clear, 5 borderline) | 33 |
| **Total** | **18 (8 clear, 10 borderline)** | **90** |

The same rule often appears twice: the button is disabled in the UI and the route refuses again on the server. Both lines are listed. A fix must change both.

Top group-2 items:
1. Approve a take when the identity gate failed: route L230 + `VideoProduction.tsx` L247 (`!idOk`). The UI text says "tell the agent in words if you accept it", but nothing in the Atlas records that override.
2. Approve a motion design when a motion_design.py gate failed: route L210 + `VideoProduction.tsx` L319.
3. Approve the cut when an `overlays*` / `supplied*` check failed: route L193. The UI does not disable the button for this (L501), so the user finds out only from the 400 error.
4. A video with a music note: no direct post (`lib/video-post.ts` L110 `directBlock`, used in send L28 and the hidden buttons at `Bridge.tsx` L229/L254), and no Instagram leg (`instagramBlock` L115, `Actions.tsx` L146).
5. A card line that does not fit: the card route returns 400 (L35) and Save layout is disabled (`LayoutEditor.tsx` L186).

---

## app/api/production/decide/route.ts

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 230 | "The identity gate says ${result}… Reject this take." (`!identityOk(...)`) | The gate measured something, but the user is the one who looked at the take. A user may want a face that differs a little, or a stylised take. | keep, but let the user override with a recorded reason: accept `data.override = { reason }`, write `checks.identity_gate: "FAIL (accepted: …)"` to the line. |
| 210 | "Failed gates: ${m.failed.join}. Reject it, or the agent fixes the page first." | The measured gates (layout, contrast, timing…) failed, but the user may like the render. | keep, but let the user override with a recorded reason: record the failed gates and the reason on the `motion.approve` line. |
| 193 | "Failed on the cut: ${blocks}. Send it back." (`overlays*`, `supplied*` checks) | These are measured QC checks on the assembled file. The user watched it and may accept it. | keep, but let the user override with a recorded reason: also have the UI show this before the click. |
| 180 | "Tick the natural-voice check first." | Borderline. The tick is the user's own eye check, but it requires a "natural, not TTS" voice. A user who wants a flat or robotic voice has to tick a false box. | warn + record: allow approve without the tick and record `natural_voice: "not claimed"`. |
| 234 | "Tick every check first: ${miss}." (checks from `checksOf`: identity, hands, silent, performance, follows_reference) | Borderline. Some checks are style rules ("silent", "follows_reference"). The user has to say "pass" to a style they may not want. | warn + record: record every check the user did not tick as "not claimed" and do not refuse. |
| 214 | "Read the stills and tick: ${miss}." (OCR not run) | Borderline. This is an eye check on text the OCR did not read, and it is cheap to tick. Still, it refuses an approval of a look. | warn + record: record `text: "not checked"` and do not refuse. |

### Group 1 (keep) — 30

- Bad input / shape: L67 "Body is not JSON.", L70 "app is required.", L71 "Unknown kind.", L73 "handle is required.", L74 "post is required.", L76 "data.platform must be tiktok or instagram.", L116 "slide and data.layout (JSON) are required.", L117 "No such slide.", L88 "That picture is not a candidate of this slide.", L170 "No such supplied source", L176 "No such narration take", L198 "No generated segment … of this video.", L202 "No such segment.", L222 "No take … of …", L164-165 "No keyframe to redo for …".
- A reason must be recorded: L78 "Say what to change." (send-back, reject, kill). This records the choice and does not refuse it.
- Nothing to approve yet / missing file: L90 "No picture to approve.", L106 "No REVIEW.md with a content digest to approve yet.", L156 "This video's plan is not locked yet.", L161 "No keyframe yet for …" (this also guards the spend: gate A carries `cost_usd`), L171 "the file is not on disk.", L177 "No narration/….wav yet.", L181 "No voiceover line of the plan names this take's narrator.", L187 "No assembled file yet.", L206 "is not a motion-designed screen.", L207 "No render of … yet", L218 "No composite of … yet.", L126 "No deck to approve.".
- Gate not run (data missing, not a failed result): L209 "The gates have not run on this render", L229 "The identity gate has not run on this take".
- Stale / order of the record: L191 "The cut was assembled from another revision of the plan", L190 "Not every segment is approved: …". This is a chain rule. It becomes group 2 only through items 1-2 above.
- Wrong owner: L203 "…'s segment: decide it on that video.".
- Final gate (`finalBlock`, lib/production.ts L996-1004) via L122/L128 "Not yet: …": plan not locked, video not delivered, slide has no picture, slide waits for a new picture (the user sent it back), card image not made.
- Hashes and costs are read from disk, never from the client (L97-L113, L166, L199, L225). This is good integrity design and needs no change.

---

## app/api/production/card/route.ts

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 35 | renderAppStoreCard throw: "a line that does not fit the text column" ("The subtitle is too long: …") | Borderline. The copy the user wrote is refused for its length. The overflow is real, but whether to accept a tight or wrapped line is a style choice. | warn + record: render it anyway (shrink or wrap), return `{ file, warning }`. |

### Group 1 (keep) — 4
L24 "app is required.", L27 "No such post.", L30 "Bad address." (path), L35 when the error is "No icon at apps/…" (missing file; `scripts/lib/appstore-card.mjs` L83).

## app/api/production/postbridge/send/route.ts (+ lib/postbridge-flow.ts L180-230, lib/video-post.ts L80-117)

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| send L28 ← video-post.ts L98/L110 `directBlock` | "this video has a music note (…), so it goes as a TikTok draft only" | The user may choose to post direct without the music. This is a format and channel choice. | warn + record: allow direct and warn "the music note is not applied", record it on the send line. |
| send L28 / legs ← postbridge-flow.ts L201, video-post.ts L115 `instagramBlock` | "this video has a music note, so it stays off Instagram: post it there yourself" | The policy is recorded (founder, 2026-10-04), but it still removes a leg the user asked for. | warn + record: keep it as the default and allow "send to Instagram anyway". |
| video-post.ts L92 | "plan.json has no publishing_note.caption … a video is not sent without one" | Borderline. Posting with no caption is a valid creative choice. | warn + record. |
| postbridge-flow.ts L207/L222 `tooLong` | "N slides; Instagram takes 10: cut the deck…" | Borderline. This is a platform limit, but the user may want to send TikTok only. A path exists (`--only tiktok`), but the UI does not offer it. | keep, and offer "send TikTok alone" in the UI. |

### Group 1 (keep) — 17
- send L16/L18/L19 bad input, L23 `parseAt` bad time, L27 "No such post." (404), L30 send failed (502).
- postbridge-flow.ts: killed (the user's own choice), "the final is not approved", "the video is not delivered yet", time in the past, no API key, no account or reconnect needed, "sent already … --force to send again" (an override exists), "no platform left: every leg was taken off" (the user's own choice).
- video-post.ts L88-L91: file missing, delivery.json has no sha256, sha256 is not the delivered file, not the file approved for posting.
- video-post.ts L93-L97: caption length, hashtag count, min/max duration, size. These are hard API limits: the platform would refuse the post anyway.

## app/api/production/upload/route.ts — Group 2: none. Group 1 (keep) — 5
L30 app, L31 post, L32 "No file.", L33 "slide or card is required.", L37 "not an image".

## app/api/production/export/route.ts — Group 2: none. Group 1 (keep) — 4
L10 JSON, L12 app, L13 post, L18 export error (e.g. "The compositor skipped", lib/export-flow.ts L65).

## app/api/production/open/route.ts — Group 2: none. Group 1 (keep) — 5
L15 "Only from this machine." (403, security), L17, L19, L20, L25.

## app/api/production/file/[...path]/route.ts — Group 2: none. Group 1 (keep) — 2
L24 "Forbidden" (403, path traversal), L31 "Not found".

## app/api/production/postbridge/status, postbridge/sync — Group 2: none. Group 1 (keep) — 6
status L13, L16, L17 "Not sent yet.", L22 (502); sync L17, L22.

---

## components/production/VideoProduction.tsx

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 247 (+249, idOk at 155) | `disabled={… !idOk …}`, "the identity gate did not pass: tell the agent in words if you accept it" | The Approve button is closed after a failed measured gate. The only override is outside the Atlas and is not recorded by the Atlas. | keep, but let the user override with a recorded reason: "Approve anyway…" with a note, which sends the route's override (route L230). |
| 319 | `disabled={… !!m.failed.length …}`, "failed gates: …" | The same rule for a motion design. | keep, but let the user override with a recorded reason (route L210). |
| 247 | `s.checks.some((c) => !ticked.includes(c))` | Borderline. The style checks ("silent", "follows_reference") must be ticked. | warn + record (route L234). |
| 319 | `need.some((c) => !eye.includes(c))` | Borderline. The eye check of the text must be ticked. | warn + record (route L214). |
| 384 | `disabled={… !natural …}` | Borderline. The natural-voice style is required. | warn + record (route L180). |
| 501 | Approve the cut: no disable for a failed `overlays*`/`supplied*` check | This is not a disable, but the server refuses (route L193). The user clicks and only then gets a 400. | Show the failed checks next to the button, and add the override from route L193. |

### Group 1 (keep) — 14
`busy` on every button (L58, L62, L109, L248, L257, L319, L352, L384, L443, L501, L517). Empty note: L62, L257 `!what.trim()`, L517 `!why.trim()` (L517 is also the yes to a spend). Missing keyframe before spend: L109 `own.some(… !s.keyframe)` ("Approve storyboard and $X"). Missing voiceover line: L384 `!x.lines.length`. Stale cut and segments not yet approved: L501 `a.stale || open.length > 0`. Identity gate not run (L249, "the identity gate has not run").

## components/production/Actions.tsx (+ lib/production.ts primaryAction L1008-1020)

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 157 ← production.ts L1014 | Approve plan disabled: "N blocking input(s): …" (from scripts/planning/video_plan.py ready) | Borderline. Most entries are missing files or a missing sha256 (integrity). Some entries refuse a format choice: "beat …: no reference reaction" (a reaction beat the user wants without a reference), "hero string of …: the plan says X; the real screen says Y". | Split the list: keep the missing files and hashes as blocking; make the reference and hero-string entries warn + record. |
| 146 | `alsoInstagram = … && !(state.video && instagramBlock(...))` | The Instagram leg is removed silently for a video with a music note. | warn + record (see send route). |

### Group 1 (keep) — 12
L143 Un-kill `busy`. L157 `primary.disabled` when the post is killed, "REVIEW.md has no content digest yet", or `finalBlock` (nothing ready to approve). L171/L182/L266/L348 empty note on Send back, Kill, Ask, and Note. L226, L292, L367 `busy`. L255 approve is disabled when it is already approved or `!canDecide` (Deck.tsx L81: only at the final or ready stage). L260 `!canDecide`. L275 a candidate that is already current. The final "check crossed" (L163-L165) only warns and does not disable, which is good.

## components/production/Bridge.tsx

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 229, 254 | `{bridge.directBlock ? null : <button…>Schedule direct post…}` | The button is hidden for a video with a music note. This is a channel choice made for the user. | warn + record: show the button with the warning. |

### Group 1 (keep) — 9
L104, L119, L222, L246, L297 `busy`/`sending`. L143 `!at || past` ("That time is past."). L229, L230, L253, L254 `!bridge.canSend` (no key, no account, final not approved, video file mismatch: postbridge-flow.ts L85). Every send asks for "Yes, send" first (L222, L246), which is the yes to a real post.

## components/production/LayoutEditor.tsx

### Group 2

| Line | Message or condition (short, verbatim) | Why it is a choice | Recommendation |
|---|---|---|---|
| 186 | Save layout `disabled={… !!cardErr …}` | Borderline. Card copy that does not fit blocks saving the whole layout. | warn + record (see card route L35). |

### Group 1 (keep) — 4
L179-L181 type size and alignment buttons with no block selected. L186 `busy || cardBusy`.

## components/production/Deck.tsx — Group 2: none. Group 1 (keep) — 4
L127/L140 first and last slide arrows. L218/L219 `busy`. L81 `canDecide` (stage order, killed).

## components/production/LegToggle.tsx — Group 2: none. Group 1 (keep) — 1
L32 `busy`. Dropping or adding a leg is the user's own choice and is always allowed.

## components/production/Board.tsx, CellText, Frame, Legs, Marks, PostViews, ReactionPickSlot, Timeline, VideoStages, VideoView
There is no `disabled=` on an action here. The `"blocked"` states in lib/video-stages.ts (L98, L104, L122, L128, L137) are only labels. They come from the same sources as above (blocking inputs, state.json failed, missing character or narrator, generator not runnable) and do not disable anything by themselves.

## Note for a fix
Each group-2 gate has two sides: the server line in decide/route.ts, and the client disable in VideoProduction.tsx or Actions.tsx. review.py (`scripts/character/review.py ... --from-atlas`) then reads the line and may refuse again on its own, for example on a failed identity gate. An override must therefore reach all three places, or the user's recorded yes is refused later by the script.
