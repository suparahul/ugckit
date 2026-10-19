# Reaction library — plan

Status: **plan, not built.** Written 2026-10-19 on branch `atlas-niche-video-player`. No code
changed, nothing spent, no paid API called.

The goal: a library of real reaction clips that each user builds up in their own workspace.
A reaction hook takes its performance from one entry. The rules stay as they are (user
decisions, 2026-10-03 and 2026-10-04): a reaction hook is never spoken, it is performed from
a real reference and never invented, and face replace is the default route.

> **Change, 2026-10-19 (founder):** every reaction shot is a **motion copy**: the character's
> approved first frame (made from the hero and the clip's first frame) is moved by the
> reference clip (Kling 3.0 Pro Motion Control). Nothing replaces a face, and a visible face
> is not required. The name "face replace" is retired; the data names are `motion_copy`
> (`generation_input`, the shot block, `models.json`), the kinds `motion_clip` and
> `pose_frame`, and `bridge.motion_copy`, and the scripts still read the old names. The
> written route is only a fallback the user names after a failed motion take. The route
> **fit is removed** from the library: no `fit` field, no `--fit` filter, no fit on the cards.
> Where the text below says face replace or fit, read it in this light.

## 1. What exists today

Read for this plan: `scripts/planning/video_plan.py` (`reactions`, the brief check of
`reaction_reference`, `check_reaction`, `ready`, `pin`); the skills `video-plan`,
`character-shots`, `character-generate`; `scripts/character/models.json face_replace`,
`shots.py reference`, `docs/character-model-known.md`; the kit Atlas `lib/niche*.ts`,
`niche-marks.ts` and the media route; the organic-factory workspace.

- **`video_plan.py reactions <slug> [--grep]`** walks `research/<slug>/` and
  `apps/<slug>/niche/batches/`. It lists each post folder that has a video and a
  `notes.md` whose lines match a word list (react, shock, surprise, disbelief, gasp, jaw,
  hand to mouth …), sorted by views. It keeps no record. Each new plan repeats the search,
  the reading of notes and the contact sheet, and the choice of a range.
- **The brief** holds the choice in `reaction_reference` (`post_id`, `platform`, `handle`,
  `post_dir`, `video`, `notes`, `start_s`, `end_s`, `burned_in_text`, `why`,
  `candidates_seen`). The plan copies it into `reaction_refs[]` (with `video_sha256`,
  `generation_input` `face_replace` or `none`) and the beat's `reaction` (`framing`,
  `camera_distance`, `expression_beats[]` with `start_s`, `end_s`, `ref_s`, `face`,
  `eyes`, `head`). No reference: the missing input `reaction_reference` blocks the lock.
- **Face replace** (`models.json`): the `motion` route (Kling 3.0 Pro Motion Control) takes
  the exact range, padded to 3 s, up to 30 s. Known failures: frames with closed eyes or a
  hand over the mouth drift toward the reference person's face; the output takes the room
  and camera of the keyframe, copied from the clip's first frame. A face-replace clip
  neither continues nor is continued. `shots.py reference` checks the checksum, cuts the
  range and reads burned-in text by OCR.
- **The kit Atlas** shows niche posts (`lib/niche.ts`, batches with `video.mp4`) and
  writes curation marks to `apps/<slug>/niche/marks.json` (`out`, `study`, `keep`; `by`
  you or agent). The media route serves `research/` and `apps/<slug>/niche/batches/` in
  place. There is no reaction view.

**The seed in organic-factory** (read 2026-10-19):

| What | Count |
|---|---|
| Posts in the brands index (`atlas/data/index.json`) | 17,096 (14,511 videos) |
| Posts in the cat niche (`atlas/data/niche-catwise.json`) | 5,178 (2,468 videos) |
| Videos on disk | 1,244 under `research/catwise/<brand>/<handle>/<post>/`, 52 under `apps/catwise/niche/batches/` |
| Folders with `notes.md` | 210 in `research/`, 20 in the niche batches |
| Folders with frame contact sheets (`sheet_*.png`) | 856 |
| Posts with a reaction label | 0: no field marks a reaction (`tags.format` is only video or slideshow; the 15 hook rules have no reaction rule; `stitch-reaction` and `reveal-to-someone-else` in `LABELS.md` are used on no post) |
| `video_plan.py reactions catwise` today | 91 downloaded posts whose notes match the word list |
| Of these, notes that say "reaction" | 63 |
| Hook timing in the notes ("Hook (0–2 s): …", free text) | 78 `notes.md` files |

**Estimate.** About 90 candidates, all from brand accounts (prettier, roamy, potto,
jobstep, stronger …). Many match only a word ("dramatic reactions", a skeptic line).
A clip fits only when one face reacts, without speech, for 1–5 s. By that test, the
estimate is 20 to 35 entries. The cat niche gives almost none: its 92 "real moment" posts
are URL only, and "reaction" there is a cat's reaction in a caption. About 1,000 videos on
disk have no `notes.md`. The word scan cannot see them, but 856 folders have contact
sheets, so an agent can look at those sheets (free) to find more.

## 2. Rules of the design

1. **The library is an index, not a copy.** An entry points to the post's video in place
   (`research/` or `apps/<slug>/niche/batches/`), with its sha256. Video files are never
   copied, never moved, never written to a research folder (the `video-plan` rule).
2. **Workspace data, kit code.** The kit ships the code, the schema, the tag list and an
   empty library. It never ships an entry or a clip: they are other creators' posts.
3. **An entry is a real range of a real post.** Nothing in an entry is written from
   memory. The expression beats are read from the frames of that range.
4. **The user's word wins.** Like the niche marks: `by` is `you` or `agent`; an agent
   never changes or deletes a field the user set.
5. **Free.** ffmpeg, the existing `ocr` module, and the agent looking at contact sheets.
   No generation, no paid API.

## 3. One entry

One file holds all entries: `library/reactions/reactions.json`, `{"version": 1,
"entries": {"<id>": {...}}}`. The id is `rx-<platform>-<post id>-<start in tenths>`, so
two ranges of one post are two entries.

```json
{
  "id": "rx-tiktok-7626442321860644127-0",
  "status": "proposed | kept | retired",
  "source": {
    "platform": "tiktok", "post_id": "7626442321860644127", "handle": "@kailyn.lifts",
    "url": "https://www.tiktok.com/@kailyn.lifts/video/7626442321860644127",
    "post_dir": "research/catwise/stronger/kailyn.lifts/7626442321860644127",
    "video": "<post_dir>/video.mp4", "video_sha256": "…", "notes": "<post_dir>/notes.md",
    "views": 13160469, "date": "2026-…"
  },
  "start_s": 0.0, "end_s": 2.1, "length_s": 2.1,
  "expression_beats": [
    {"start_s": 0.0, "end_s": 0.8, "face": "brows up, mouth opens", "eyes": "at the phone",
     "head": "pulls back"},
    {"start_s": 0.8, "end_s": 2.1, "face": "hand to forehead, a slow smile", "eyes": "to the lens",
     "head": "tilts left"}
  ],
  "framing": {"framing": "chest-up, centred", "camera_distance": "arm's length",
              "camera": "selfie, handheld", "people": 1, "room": "gym floor, bright"},
  "speech": "none | mouths words | speaks",
  "burned_in_text": [{"text": "4 years at the gym and NOW I find this?!!??", "where": "top third",
                      "start_s": 0.0, "end_s": 2.1, "kind": "hook | caption | handle | watermark"}],
  "hook_text": "4 years at the gym and NOW I find this?!!??",
  "tags": ["surprise", "regret"],
  "fit": {
    "face_replace": {"ok": false, "why": "a hand over the forehead from 0.8 s (drift risk)"},
    "written": {"ok": true, "why": "clear beats, one face"}
  },
  "preview": "library/reactions/previews/rx-tiktok-7626442321860644127-0.jpg",
  "note": "",
  "added": {"by": "you | agent", "at": "2026-10-19T…", "from": "atlas | agent-scan | conversation"},
  "set_by_you": ["start_s", "end_s", "tags", "status"]
}
```

- **Times.** `start_s` and `end_s` are seconds in the post. Each expression beat's times
  are seconds from `start_s`, the shape of the plan's `expression_beats` without
  `ref_s`, which `video-script` computes as `start_s + t`.
- **Tags** come from one fixed list in the kit (`surprise`, `shock`, `disbelief`, `regret`,
  `relief`, `delight`, `confusion`, `cringe`, `realisation`, `smug`, `tears`, `jaw drop`,
  `hand to mouth`, `slow reveal`). Each tag names a visible thing. The video-plan hook jobs
  map to tags in the same file, so a plan can ask for a hook job.
- **`hook_text`** is the burned-in hook in the original, for study only. A plan never
  copies it. The plan writes its own hook, and the burned-in text is the thing that the
  masks or the motion route remove.
- **`fit`** is computed by `reactions.py fill` and the agent can correct it.
  - **Face replace fits** when there is one person, the face shows in every frame, the
    eyes are open and no hand covers the mouth or the eyes for more than 0.3 s,
    `speech` is `none`, and the clip is 1 to 30 s long.
  - **The written route fits** when the beats can be written clearly, with any number of
    cuts or hands.
  - **Speech.** A clip that `speaks` fits neither route as a hook, because the hook is
    never spoken. It stays in the library only to be studied.
- **The preview** is one contact sheet of the range (ffmpeg `fps=4,tile`, about 30 KB). It
  is made locally and is free. The Atlas plays the range itself from the source video,
  with a media fragment (`#t=start,end`). No trimmed clip is stored.

## 4. How entries get added

All three ways write the same file through the same script,
`scripts/planning/reactions.py` (new in the kit, free, local):

    reactions.py scan <slug> [--sheets]  propose entries: the word scan of today's
                                         `video_plan.py reactions`, plus the hook timing in
                                         notes.md; --sheets also lists folders with a
                                         contact sheet and no notes, for the agent to look at
    reactions.py add <post_dir> <start> <end> [--tags a,b] [--by you|agent]
    reactions.py fill <id>               sha256, length, preview sheet, OCR of the burned-in
                                         text, the computed fit; leaves the beats to the agent
    reactions.py check                   every entry: its file exists, the sha256 matches,
                                         the range is inside the video, the beats lie inside
                                         the range, the tags are in the list
    reactions.py list [--tag] [--fit face_replace|written] [--max-s] [--status]

1. **From a post in the Atlas (the user).** The niche post view and the research post view
   get an **Add to reactions** button when the post's video is on disk. The user sets the
   in and out points on the player (the current time and two buttons), picks tags, and adds
   a note. The Atlas route writes an entry with `status` `kept`, `by` `you`, and only the
   source, the range, the tags and the note. A post with no video on disk shows "fetch it
   first", which sets the existing `study` mark, so `niche-fetch` downloads it. Then the
   agent runs `reactions.py fill` and writes the expression beats from the sheet. The
   entry shows "needs beats" until then.
2. **By an agent.** `reactions.py scan`, then for each candidate the agent looks at the
   contact sheet (the `video-plan` command, in a scratch folder). It writes the range and
   the beats with `add` (`by` agent, `status` `proposed`), then runs `fill`. This is how
   the seed is made: in organic-factory, one pass over the 91 candidates, and then over
   the contact sheets without notes when the user asks for more.
3. **By the user in a conversation** ("add this TikTok"). `ingest` or `niche-fetch`
   downloads the post into research, then the agent works as in the second way, with `by`
   `you` for what the user said.

An agent never sets `kept`. The user keeps or retires an entry in the Atlas.

## 5. Browsing and picking in the Atlas

A new page, **Reactions** (`/reactions`), in the Atlas menu next to the niche. It reads
`library/reactions/reactions.json` on each visit.

- **The grid.** One card per entry: the preview sheet, which plays the range when the
  pointer is on it or on a tap. Under it: the length, the tags, the fit in words ("face
  replace: fits" or "face replace: no — a hand over the mouth"), "proposed by the agent"
  or "kept", and "used in 2 videos". Filters: the tag, the fit, the longest length, the
  status, the source app, and "not used yet". Retired entries are hidden until the
  filter shows them.
- **The entry view.** The source video loops the range. Under it are the beats as a
  short list with times, the framing, the burned-in text with its place, the source
  post's notes line and its link, and the videos that use the entry. The page finds
  these videos in the briefs and the plans (`library_id`). Nothing stores them.
  Buttons: **Keep**, **Retire**, **Edit range** (the same in and out control), **Tags**,
  and **Note**. Each button writes the entry and sets `by` `you` on that field.
- **Picking for a video.** From the entry view: **Use for…** gives a list of the video
  rows in planning (stage 1 of the stages plan). From stage 1 of a video with a reaction
  hook, **Choose a reaction** opens the grid with the filters of the hook already set.
  The pick writes one line, `reaction.pick {video, entry_id}` with a note, to
  `apps/<slug>/production/log.jsonl`. It does not write the brief. `video-plan` (or
  `video-script` for a plan) reads the line and writes `reaction_reference`. The planning
  review then shows the new revision, as for any other send-back.

## 6. How video-plan picks one into `reaction_reference`

- `video_plan.py reactions <slug>` reads the library first. It lists entries with
  `status` `kept`, then `proposed`. It filters them by the hook job's tags, by the route
  (face replace by default, so `fit.face_replace.ok`), and by length (the hook beat's
  band). Retired entries are left out. Below them it prints the research scan of today,
  for posts that are not in the library yet. The command stays read-only.
- The skill's order: a `reaction.pick` line for this video, then a `kept` entry, then a
  `proposed` entry, then a research post. If the agent uses a research post, it first adds
  the post as an entry (`reactions.py add`, `by` agent). Then "No reference, no plan" stays
  as it is today.
- **`reaction_reference` gets one new field, `library_id`.** The other fields are copied
  from the entry: `post_id`, `platform`, `handle`, `post_dir`, `video`, `notes`,
  `start_s`, `end_s`, and `burned_in_text` as text with its place. `candidates_seen`
  lists the ids of the other entries that the agent looked at. The `why` field stays the
  agent's own words.
- `video-script` copies the entry's beats into the beat's `reaction` (`ref_s` =
  `start_s` + t). It sets `generation_input` from the fit: `face_replace` when it fits,
  else `none` (the written route), with the reason in the review.
- **Checks** (`video_plan.py brief` and `check`): with a `library_id`, the entry exists,
  is not retired, and has the same range and sha256, or the brief says why it differs.
  `pin` takes the sha256 from the entry and checks it against the file.
- Production does not change. `shots.py reference` still cuts the range from the post and
  checks the sha256. The stages plan's timeline and stage 1 show the entry's preview and
  range.

## 7. Where the files live

| Place | What | Shipped by the kit |
|---|---|---|
| `template/scripts/planning/reactions.py` | scan, add, fill, check, list | yes |
| `template/scripts/planning/video_plan.py` | `reactions` reads the library; `library_id` checks | yes (changed) |
| `template/docs/character/reaction.example.json` | the entry shape, the tag list, hook job to tags | yes |
| `template/.claude/skills/video-plan/SKILL.md` | the order of § 6; add when a research post is used | yes (changed) |
| `template/.claude/skills/niche-read/SKILL.md` | one line: a post with a reaction goes to `reactions.py add` | yes (changed) |
| `template/atlas/lib/reactions.ts`, `app/reactions/`, `app/api/reactions/route.ts` | read and write the library; the page | yes |
| `template/atlas` niche and research post views | **Add to reactions** | yes (changed) |
| `template/atlas/app/media/[...path]/route.ts` | also serve `library/reactions/previews/` | yes (changed) |
| `template/atlas/app/api/production/decide/route.ts` | kind `reaction.pick` | yes (changed) |
| `library/reactions/reactions.json` | the entries | **no**: made empty on the first add, in the user's workspace |
| `library/reactions/previews/<id>.jpg` | the contact sheets | **no**: workspace only; `.gitignore` leaves them out (they are made again by `fill`) |
| the source videos | in `research/` and `apps/<slug>/niche/batches/`, in place | no |

`library/` is at the workspace root. The library is not under `research/`, because no
agent writes there, and it is not under one app, because a reaction suits every app. The
kit's update leaves `library/` alone, as it leaves `apps/` alone.

## 8. Gaps

1. **The organic-factory Atlas is a different shape.** Its brands index
   (`atlas/data/index.json`) holds notes, `onScreen` text and contact sheets that the kit
   Atlas does not have. The seed pass reads the files on disk (`notes.md`, `sheet_*.png`),
   not that index, so it works in any kit workspace.
2. **Most candidates have no notes.** About 1,000 videos on disk have no `notes.md`. Only
   the contact-sheet pass (`--sheets`), with the agent looking at each sheet, finds
   reactions there. It is free but slow. Do it only when the user asks for more.
3. **Pet reactions.** The rule is for a human or mascot face. A cat's reaction is not a
   reaction hook today. The library can hold such clips with the tag `pet`, but no route
   uses them.
4. **Permission.** `permission_ref` stays optional (founder, 2026-10-04). The library
   records the source and the link, and nothing more.
5. **Hook timing in notes is free text.** `scan` reads "Hook (0–2 s)" only as a first
   range. The agent sets the true range from the frames.

## 9. Build order

1. `reactions.py` (`add`, `fill`, `check`, `list`), the example file, and `video_plan.py
   reactions` reading the library. Test with a fixture library.
2. The seed pass in organic-factory: `scan`, then the agent writes beats for the
   candidates that fit (about 20–35 entries).
3. The Atlas Reactions page and the entry view, read-only, then Keep, Retire, Edit range,
   and Tags.
4. **Add to reactions** in the post views, and the `reaction.pick` line with its
   `video-plan` step.
