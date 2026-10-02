# AI UGC methodology — production quality

How to make a video of one repeatable character that looks and sounds real, with the
real app on screen. Written 2026-10-01, restructured the same day. Status: **proposal,
with the founder's decisions of 2026-10-01 applied** (§ 3, § 17). Nothing in this file is
built yet, no picture or video was generated to write it, and no money was spent. The
questions still open are in § 17.

**Where this file lives, and what ships.** This file, `SCRIPT-LEARNINGS.md` and
`sources/` are our working material for building the system. They live in the ugckit
repository under `research/ai-ugc/`, outside `template/`, so the installer never copies
them into a user's workspace. What reaches users is what this method turns into:
**skills, scripts and orchestrator updates in `template/`** (`template/.claude/skills/`,
`template/scripts/`, `template/AGENTS.md`). § 2.2 and § 16 name each one. Every path in
this file that starts with `apps/`, `pipeline/`, `scripts/`, `docs/` or `references/` is
a path in a user's workspace, as the kit installs it. `<slug>` is the app, `<handle>` the
account, `<character>` a character's id, `<video>` a video's id, `<set-id>` and
`<outfit-id>` a locked set and outfit.

**Scope: production quality only.** How the character is made to look real, how the
pictures and the models are chosen, how the voice is made, how the app is put on
screen, how a video is cut into segments that are generated separately, and how they
are joined, checked and exported. **What the video says is not here.** Hooks, the order
of the beats, where the app enters the timeline, how many variants a demo serves, and
how variants are tested are in `SCRIPT-LEARNINGS.md`, beside this file. This file starts
when the words are frozen.

It is a synthesis of six sources (`sources/README.md`) and of what the kit already knows
(`template/AGENTS.md`, the stage skills, `scripts/screen_comp.py`,
`scripts/templates.json`, and the measurements of earlier character-video generations
made with the kit). Where a claim comes from a source, the
source is named: **[Enzo]**, **[Vlad]**, **[Fekri]**, **[PC]** (portrait-clone),
**[Jason]**, **[Ultra]** (ugc-ultra-system), **[SD]** (the Seedance 2.5 guide inside Ultra).
Where it comes from us, it says **[repo]**: the kit's own code, rules or measurements. Numbers we did not measure are marked
*planning value*.

Contents: 1 the position · 2 the character pipeline, its input and the roster · 3 the decisions where sources disagree ·
4 casting · 5 creator file and shot file · 6 anchors · 7 voice and audio · 8 environment ·
9 motion and failure modes · 10 segments · **11 the app UI insertion playbook** (with
the motion shots, § 11.12) ·
12 the segment prompt · 13 assembly, captions, upscale, export · 14 QC, approval, keep
rate, cost · 15 the JSON templates · 16 the phased plan · 17 open production questions.

---

## 1. The position

Ten laws. Every later section is one of these applied.

1. **Lock first, vary second.** A video fails when the model must invent the person, the
   room, the voice, the camera and the action at once [Ultra]. We freeze the person, the
   voice, the set and the app screens in files. A video changes one thing.
2. **The feed is the test, not the frame.** One good picture proves nothing. The same
   face through twenty generations is the entry ticket [Enzo]. A character is not "live"
   before that.
3. **The identity is a picture; the text is a fence.** After casting, an approved image
   carries the face. The text lock is short, repeats only stable visible traits, and
   exists to stop the model from smoothing them away [Ultra]. Every extra word in an
   identity block is a word the model must obey [Enzo].
4. **No UI pixel is ever generated.** Every app pixel in a shipped video comes from a real
   capture of the real app. The model draws the hand, the phone body and flat green
   [repo, AGENTS rule 1]. § 11 is built on this.
5. **Decide in pictures, pay for motion once.** Every visual decision is approved as a
   still keyframe before any video is generated. A picture costs cents and seconds; a
   video costs dollars and minutes [Fekri].
6. **Generate between the cuts, cut where a character would cut.** A segment is one
   continuous performance in one place, made in one generation. A join never sits inside
   a sentence on a visible face (§ 3, decision 1; § 10).
7. **The mouth and the room come from the same model.** A voice that is on camera is
   generated with the picture, so it carries the room [Vlad]. A separate voice tool is a
   fallback for moments with no face, and it must pass a room match.
8. **Write actions, not states.** A line with no action gives a static face. A reach, a
   lift, a glance gives motion [Vlad]. Every hand has a job or is out of frame [Fekri].
9. **An object is in the first frame of its segment, or it is not in the segment.** A
   thing that enters mid-clip is invented on the spot; that is how hands and phones
   break (§ 3, decision 9).
10. **Realism is a gate, not a goal.** A video must pass the gate in § 14. Past the
    gate, more polish buys nothing [Vlad]; what the video says decides the rest, and
    that is the other file.

Two guard rails sit above the laws. The character is an original fictional person,
never a likeness of a real one [repo `persona-identity`; PC "Boundaries"]. The voice
reference is a real creator's clip chosen with the user in the voice reference setup
(§ 7.2); it is a reference for the model only, never a TTS clone. The export pass in § 13 makes a video look like phone footage; it is
not a way to hide that it is AI. Posting, and any disclosure label set at posting, is
outside the pipeline (§ 2; § 17, question 6).

---

## 2. The character video pipeline: its own system

**Character videos and recreation videos are two separate pipelines** (the founder,
2026-10-01: "two skills should be completely separate. Making character videos should
be a thing of its own. And, recreation videos should be, very different."). The
recreation pipeline (its ten stages, its skills, and its scripts `generate.sh`, `character/qc.py`,
`composite.sh`, `screen_comp.py`, `state.py` and the rest) is **not changed in any
way** by this method. The character pipeline has its own skills, its own scripts, its
own stages, its own state and its own Supagen template. Where it needs what a
recreation script does, it uses its **own copy** of that script, or a new script; it
never changes the recreation one. Every new gate in this file (the flat-on gate, the
motion gates, the natural-voice check, the storyboard gate) lives only in the character
pipeline.

**Scope: production only.** The pipeline starts when a video's script, storyline and
format are locked and approved. Deciding what a video should be is a separate system,
the **video planning system**, built later as its own skill set, like the slideshow
anatomy system: a detailed plan, the user approves it, then production starts. It is
not designed here; `SCRIPT-LEARNINGS.md` belongs to it. Production takes one input from
it: the **locked plan** (§ 2.5).

The character pipeline has two parts:

| Part | When it runs | What it does | Skills (new) |
|---|---|---|---|
| **A. Character definition** | once per character, then reused by every video; again only for a new version (§ 2.6) | casting, the anchors, the signature details, the voice reference setup | `persona-identity` (the one identity process, shared with the slideshow path), `character-voice` |
| **B. Production** | once per video | picks an existing, approved character from the handle's roster, then: shots and keyframes, generation, review, app insertion when the plan asks for it, assembly, the hand-over of the finished file | `character-shots`, `character-generate`, `character-review`, `character-composite`, `character-assemble`, `character-deliver`; and `screens`, once per app, only when a plan inserts the app |

**Casting never runs per video.** A production run that names a character with no
approved definition stops and asks for part A first.

**One identity process for slideshows and videos** (decided 2026-10-02). The founder:
"we should probably have a process to rewrite how the handle identities are created,
like, the visual identity specifically. Because that can benefit from the process that
we have come up with." and "Yes. We can unify the persona identity process." So the
casting method of § 4 to § 6 **is** the `persona-identity` skill. There is no separate
`character-cast` skill: stage D1 is `persona-identity`, and the `handles` skill calls the
same skill at its steps 3 and 4. Identity is made once per handle, in two halves:

- **The identity half**, at handle creation, for every handle with a rendered face:
  vibe references, the locked JSON (text only), four candidates, the hero approved by
  the user, the fixed subjects, the style photo, the profile picture. The slideshow
  needs only this half.
- **The video half**, just in time, when the handle's first character video is
  planned: the anchors (§ 6), the set plates, the signature details, the
  twenty-generation gate (§ 4.7), then `character-voice` (§ 7.2).

A handle with an already approved face reuses it and goes straight to the video half
(§ 4.6). What this changes for the slideshow path, and what it does not, is § 4.9.

**The pipeline ends at a created video** (decided 2026-10-02). Its last output is the
finished file. Posting, the posting provider, outcomes and any label set at posting are
outside it.

**App insertion is a per-plan option** (decided 2026-10-02). Each video is made exactly
as its plan says. A plan with `app_insertion: false` has no app segment (no O, G, S, H,
F, R or P), so `screens` and P4 do not run for it, and P5 assembles the talking
segments alone.

### 2.1 The stages

| Stage | Skill | Input | Output | Gate |
|---|---|---|---|---|
| D1 identity | `persona-identity` | the persona, the brief and the vibe references (§ 4) | the identity half: the hero (`references/face.png`), the fixed subjects, `creator.json`; the video half: the anchors, the set plates, the signature details | the hero and each anchor approved by the user; the twenty-generation gate (§ 4.7) before the first video |
| D2 voice | `character-voice` | clips from the niche and competitor research (§ 7.2) | `voice-reference.mp3` and its source | the user's approval; the natural-voice check |
| P1 shots | `character-shots` | the locked plan (§ 2.5) and the character | segments, shot files, prompts, keyframes, `video.json` | **A**, the storyboard (§ 14.1); the prompt lint |
| P2 generate | `character-generate` | one segment | one generation | the computed cost, then the user's yes |
| P3 review | `character-review` | one generation | keep, reject or regenerate | **B**, the segment checklist (§ 14.2) |
| P4 composite | `character-composite` | a kept plate and a screen from the library | the composite | the insertion gates (§ 11.10, § 11.12); skipped when the plan has no app insertion |
| P5 assemble | `character-assemble` | `video.json` and the kept segments | one file | the OCR test after the export pass (§ 13) |
| P6 deliver | `character-deliver` | the assembled file | the finished file in `pipeline/character/<video>/final/`; the pipeline ends here | **C**, the final checklist and the user's approval by word (§ 14.3) |

### 2.2 What it reads from the kit, without changing it

| Need | What already exists [repo] | How the character pipeline uses it |
|---|---|---|
| Real creator clips for the voice reference, frames for casting | `harvest`, `deepen`, `niche-fetch` save posts with their audio; `ingest` cuts frames; `transcribe.sh` gives word times | reads their output files |
| The handle and its identity | `apps/<slug>/handles/<handle>/HANDLE.md` and `references/`; the `handles` and `persona-identity` skills | **shares them**: `persona-identity` is the one identity process (§ 2, § 4.9); the handle's approved face is the hero of its character (§ 2.6, § 4.6) |
| Pictures without API spend | the Codex image tool through `scripts/codex-images.sh` and the `images` skill | calls it, unchanged (decision 4) |
| Generation with references, the cost line, the duration cap | `scripts/generate.sh`, `scripts/state.py model`, `scripts/templates.json` `known_model_limits` | **its own copy**, `scripts/character/generate.sh`, with its own model file `scripts/character/models.json` (same shape as `known_model_limits`) and its own Supagen template `ugc-character`, defined in `scripts/character/templates.json` and created in each workspace by the `setup` skill. The recreation files are not changed. |
| QC of a generation | `scripts/qc.py` (cuts, green, transcript, pitch spread, drift) | **its own copy**, `scripts/character/qc.py`, which adds the new gates |
| App insertion | `scripts/composite.sh`, `scripts/screen_comp.py`, the `insert.json` format | **its own copy**, `scripts/character/screen_comp.py`, which adds the upgrades of § 11.7 and § 11.12; its insert spec is a superset of `insert.json` (§ 15.5) |
| Review UI and feedback | `ugckit ui`, approval by word | approval by word now; the storyboard approval will need an Atlas UI (decision 7), designed later for the whole video pipeline |
| Posting and outcomes | `post`, `sync`, the weekly `read` | not used. Posting is outside the pipeline (decided 2026-10-02); the hand-over ends at the finished file |

### 2.3 What is new

Everything below ships as skills, scripts and orchestrator updates in `template/`. The
paths are in a user's workspace.

| New piece | Where it lives | Owner |
|---|---|---|
| The character roster of a handle | `apps/<slug>/handles/<handle>/characters/<character>/` (§ 2.6) | part A |
| `creator.json` (identity lock, signature details, voice profile, camera habits, the sets and fixed subjects it uses, outfits, version) | `characters/<character>/creator.json` | `persona-identity` |
| Casting files: the vibe references, the locked portrait JSON and its versions, the hero candidates | `characters/<character>/references/casting/` | `persona-identity` |
| The hero of the handle's identity character | `references/face.png`, the file the slideshow already uses | `persona-identity` |
| Anchors: angle views, expression sheet, hands, outfits (and the hero of any other character) | `characters/<character>/references/anchors/` | `persona-identity`, video half |
| The handle's world: the fixed subjects (a pet) and the sets (the rooms of the home) | `world.json`; pictures in `references/subject-<name>.png` and `references/sets/<set-id>.png` | `persona-identity` |
| Voice reference clip, its source, the room tones | `characters/<character>/references/voice/` | `character-voice`, the **voice reference setup** (§ 7.2) |
| Screen library: real recordings and screenshots of the app | `apps/<slug>/screens/` with `SCREENS.md` | `screens`, only for a plan with app insertion: the user provides the recordings; the agent checks and indexes them |
| The locked plan | `pipeline/character/<video>/plan.json` | written by the planning system, approved by the user; read-only to production |
| `video.json`, the shot files, the keyframes | `pipeline/character/<video>/` | `character-shots` (P1) |
| One folder per generated segment | `pipeline/character/<video>/segments/<nn>-<type>/` | P2 to P4 |
| The assembled file | `pipeline/character/<video>/assembled/` | `character-assemble` (P5) |
| The finished file, the end of the pipeline | `pipeline/character/<video>/final/` | `character-deliver` (P6) |
| `approval.json` | `pipeline/character/<video>/` | P1, P3, P6 |
| The pipeline's state | `pipeline/character/state.json` | the character scripts; the recreation `pipeline.json` is not touched |
| The scripts | `scripts/character/`: `generate.sh`, `qc.py`, `screen_comp.py`, `shots.py`, `keyframes.sh`, `lint_prompt.py`, `assemble.sh`, `state.py`, `models.json`, `templates.json` | the character skills |
| The failure ledger, per model | `pipeline/character/model-failures.md`, **the user's file**: written once by the installer (the § 9.4 table and one empty table per model), never overwritten by an upgrade | P3 writes, P1 reads |
| What the kit knows about each model | `docs/character-model-known.md`, **the kit's file**: the § 9.4 table, updated by every upgrade, never written by the pipeline | P1 reads |
| The orchestrator section for character videos (§ 2.4) | `template/AGENTS.md` | orchestrator update, shipped with the skills |

### 2.4 Segments, flows and references

A video is a list of **segments** (§ 10.2). Each generated segment is its own folder,
`pipeline/character/<video>/segments/<nn>-<type>/`, and is generated, reviewed and
composited alone; only `character-assemble` knows the whole video. A segment that serves
several videos (§ 10.5) lives under `pipeline/character/<character>-shared/` and is named
by each `video.json`. Earlier character videos made with the kit were already split this
way: two generations, the second taking frames and the voice of the first as references.

| Segment type | Files in the segment folder | Mode |
|---|---|---|
| character talks, no phone (T) | `prompt.txt` + `refs.json` | references |
| over the shoulder, face not visible (O) | `prompt.txt` + `insert.json`, and `refs.json` only when `back-shoulder.png` is needed | text-to-video by default |
| phone in hand or shown to camera, face visible (G, S) | `prompt.txt` + `insert.json` + `refs.json` | references, then insertion |
| phone push or finger interaction, a motion shot (H, F) | `prompt.txt` + `insert.json` + `refs.json` | references, then insertion (§ 11.12) |
| screen recording cutaway, picture-in-picture (R, P) | none; an entry in `video.json` | no generation |

**References are the standard mode of the character pipeline** (decided 2026-10-01,
the founder: "Reference is any day better"; § 17, question 1). The recreation rule 1 of
`template/AGENTS.md` (text-to-video by default, `refs.json` never on the agent's own
initiative) stays as it is, for the recreation pipeline. The lesson behind it is exact
and holds in both: **reference conditioning cannot reproduce text, so it is never the
way to show an app.** A repeatable character cannot come from text alone; text gives a
new person each time [Enzo, Vlad, Jason].

**Planned change:** a new section of `template/AGENTS.md` for the character pipeline,
shipped with its skills (§ 16), says:

> In the character pipeline, a segment may carry `refs.json` with only these roles: the
> character's anchors, the segment's approved keyframe, a set plate, the character's
> voice reference. Never an app UI, a screenshot or a screen recording as a reference.
> `scripts/character/generate.sh` refuses a `refs.json` with any other role, and asks
> for an explicit opt-in on each referenced run, like the recreation `ALLOW_REFS=1`.

**Shipped in Phase 2** (2026-10-02) as the section "Character videos" of
`template/AGENTS.md`, after the recreation table; rule 1 and the three flows are kept
and scoped to recreation. `refs.json` is now
`{"references": [{"kind", "file", "binding"}]}`, written by `scripts/character/shots.py
refs` from the shot file; the kinds are `keyframe`, `hero`, `anchor`, `subject`, `set`,
`neighbour-frame` and `voice`. `generate.sh` refuses any other kind and any file from the
screen library.

### 2.5 The input: a locked, approved plan

Production starts only from `pipeline/character/<video>/plan.json`, approved by the
user. P1 refuses to start without it, and no production stage edits it; a change goes
back to the planning system. The minimum fields:

| Field | What it holds |
|---|---|
| `video_id`, `app`, `handle` | the ids: `<video>`, `<slug>`, `<handle>` |
| `characters` | each character the video uses, with its pinned version: `["<character>@v<n>"]` (§ 2.6) |
| `format` | the dimension (9:16, the only size for now; more sizes are added later when needed), the target length in seconds |
| `app_insertion` | `true` or `false`. With `false`, no beat shows the app, and the screen stages do not run (§ 2) |
| `script` | the frozen lines, each with an id, its speaker (a character id, or `vo`), its delivery note |
| `beats` | in order: the line ids each beat carries; whether the app is on screen in it (only when `app_insertion` is `true`), and if so the screen id from `SCREENS.md` and what the viewer must do (read, recognise, believe; § 11.2) |
| `set` and `outfit` | per character, ids from her `creator.json` |
| `hero_strings` | per screen, the one string the viewer must read |
| `source` | what the plan came from: a reference post or a research brief |
| `approved` | the user's words and the date |

How the beats are cut into segments, which segment type shows the app, and every
production value in this file are P1's decisions, inside these fields.

### 2.6 Characters live at the handle level: the roster

Each app has handles; each handle holds the identity of its characters. A handle's
characters are a **roster**:

    apps/<slug>/handles/<handle>/
      HANDLE.md                      the human document; its ## Characters table lists the roster
      references/                    the handle-level files the slideshow already reads:
        face.png                     the hero of the handle's identity character
        subject-<name>.png           each fixed subject (a pet): the world's subjects
        style.png, profile.png       the style photo, the profile picture
        sets/<set-id>.png            the world's sets: the rooms of the home, empty (video half)
      world.json                     the world's locks: each fixed subject and each set (§ 15.8)
      characters/<character>/
        creator.json                 the definition, with its version (§ 15.1)
        references/casting/          the vibe references, the locked JSON versions, the hero candidates
        references/anchors/          views, expressions, hands, outfits/ (and hero.png for any other character)
        references/voice/            voice-reference.mp3, room tones
        versions/v<n>.json           a frozen copy of creator.json at each version

**The world** (decided 2026-10-02 as a place; its rules are expanded later). The
founder also wants consistency beyond the face: the house in interior shots and the
secondary subjects, such as a cat. They belong to the handle, not to one character:
two characters of one handle share the home and the pet. So the fixed subjects and the
sets live at the handle level, in `world.json` and `references/`, and each
`creator.json` names the ones its character uses by id. The subject pictures keep the
names the slideshow already reads (`references/subject-<name>.png`); the set plates go
in `references/sets/`, a sub-folder that neither the Atlas handle page nor the `images`
skill reads, so a slide never gets a set plate it did not ask for.

- **A persona handle has exactly one character**, and that character is the handle's
  identity. Its id is the persona's name. Its hero is `references/face.png`, the face
  the handle already uses: one file for the slides and the videos. A face made before
  this decision is written from that picture, not re-cast (§ 4.6). `HANDLE.md` and `creator.json` say the same thing; where they differ, the
  character is not live until the user settles it.
- **A multi-character handle has several characters**, each with her own folder,
  anchors and voice reference. One of them is the handle's identity character, whose
  hero is `references/face.png`; the hero of each other one is in her own
  `references/anchors/hero.png`. Nothing of a character is shared with another
  (§ 4.8); the world is shared.
- **A brand handle has no character.** Its identity is the app. It may still have a
  world (fixed subjects, sets). The
  handle's `HANDLE.md` says it is multi-character.
- **The locked plan names which character or characters a video uses** (§ 2.5).

**Adding a character later.** `persona-identity` runs for the handle with a new id; the
new character is not usable before she passes part A (hero, anchors, signature details,
voice reference, the twenty-generation gate). It adds a row to the `## Characters`
table of `HANDLE.md`. A persona handle cannot add a second character; to do so the user
first makes it a multi-character handle, and the persona character stays as one of the
roster.

**Versions.** `creator.json` carries `version` (`v1`, `v2`, …) and `status`
(`casting`: no approved hero yet; `identity`: the hero is approved, so slides may use
it, videos may not; `video-setup`: the video half and the voice reference are in
progress; `live`: videos may use it; `retired`). A change to identity (face, hair,
signature details, voice reference) is a new version: it is approved again and passes
the twenty-generation gate again. A new set or a new outfit is also a new version, with
no re-cast and no new gate. On every new version, the previous `creator.json` is frozen
as `versions/v<n>.json`, and anchors are added, never overwritten (a changed anchor gets
a new file name). A retired character keeps her folder.

**How a video refers to a character.** By id and version: `"<character>@v<n>"` in the
locked plan, copied into `video.json` and every shot file. A video keeps the version it
was planned with, even when a newer version exists; a segment shared by several videos
(§ 10.5) belongs to one version. A version that any video uses is never
deleted.

---

## 3. The decisions where the sources disagree

The founder reviewed this table on 2026-10-01. Each row states the result: **agreed**,
**changed** or **open**.

| # | Question | The positions | Our decision | The reason |
|---|---|---|---|---|
| 1 | Short stitched shots or one long locked generation? | [Enzo]: 6 s shots, one simple action each, stitched; a 30 s take drifts in the middle. [Vlad], [Fekri]: every join is a chance for face, light and room to shift; make it in one generation; Seedance 2.5 gives 30 s with six internal cuts. | **Agreed 2026-10-01.** **One generation per segment; a join only on a sentence boundary that is also a visible change.** A segment is 3 to 15 s, starts from an approved keyframe, and has its internal cuts written as stages. A part with no face (a screen recording) is always its own segment. | Both sides describe a real failure: drift inside a long take, mismatch across a join. They stop conflicting once the join is put where it costs nothing: at a cutaway with no face, or at a jump cut with a reframe. Short segments also make "regenerate this shot only" cheap, let one segment serve several videos, and each fits our 5,000-character prompt cap, which Fekri's single 30 s prompt does not. Our caps are 10 to 15 s on three of four models [repo `templates.json`]. If a 30 s single-pass model becomes available, adjacent talking segments in one set merge into one; a cutaway stays separate. § 10 has the rules. |
| 2 | ElevenLabs or in-model audio? | [Vlad]: in-model (Seedance, Omni) reads the room; ElevenLabs only over b-roll. [Jason]: clone the voice (Fish Audio) for the demo voice-over. [Enzo]: a voice-over spec with room tone, tool not named. | **Agreed 2026-10-01, for now.** **On-camera speech is always in-model, with the character's voice reference as the audio reference. The demo voice-over is also in-model: we generate the character saying the demo lines on camera once, and use that audio under the screen recording.** A TTS clone is a fallback only, with a room match. | A dry studio voice in a kitchen is the second most common tell [Vlad]. Our record agrees: the voice reference and per-line delivery notes worked [repo, measured]. The demo performance costs one generation per recording, is reused by every video that shows that recording, gives the same voice in the same room for free, and its picture is the face for picture-in-picture (§ 11.9). It also keeps a second vendor and a cloning step out of the pipeline. |
| 3 | Whose voice is the reference? | [Jason]: clip the audio of the trending video you liked and pass it as the reference; rhythm transfers. [Vlad]: generate one clip, pull its audio, reference that on the rest. | **Changed 2026-10-01: [Jason]'s way, as a setup step.** The voice reference is set up once per character, by the agent together with the user, before the character's first AI UGC video is generated: the **voice reference setup** (§ 7.2). The candidates are real creator clips found in the niche and competitor research. The user approves the clip. It is attached as the audio reference of every talking segment. A clip cut from our own approved generation ([Vlad]'s way) is a fallback only, when the research gives no usable clip. | The research already finds and saves the clips, so the setup is easy and costs nothing [repo]. A real clip carries real rhythm, breath and room, which a voice cast from text must find by trial. The focus is that the generated voice does not sound robotic or AI. The setup checks the first approved generation for that, and every talking segment is checked again at gate B (§ 7.2, § 14.2). |
| 4 | Which image model casts the character? | [Jason]: same JSON on five models; Gemini 3 Pro most real, GPT Image 2.5 keeps doll eyes; run GPT Image, Gemini 3 Pro and Seedream side by side. [Vlad]: Nano Banana or GPT Image, four at once. [Fekri]: GPT Image for the board. | **Changed 2026-10-01: no bake-off. The Codex image tool makes every picture of every character**: the casting candidates, the hero, the anchors and the keyframes. Future work: a fallback on the Supagen image generation models, for when Codex refuses or fails a shot (§ 16 Phase 6). | Codex is on the user's plan and already wired [repo]; the others cost API money and need a yes. Changing model between the hero and its keyframes is itself a drift source, so one tool makes all of a character's pictures. The model matters even with the right prompt [Jason], so the de-slop check (§ 4.4) and the founder's pick (§ 4.5) are where Codex is judged. A character whose face is already approved is not re-cast (§ 4.6). |
| 5 | Text-only face or image reference? | [PC], [Vlad], [Jason]: a fully locked JSON, no reference image, gives a new person with the same vibe. [Ultra]: once an image is bound, the image carries identity and text only reinforces. [Enzo]: creator file plus a start still. | **Agreed 2026-10-01.** **Both, in order.** Casting is text-only from a locked JSON. The vibe reference is one or more pictures: Pinterest pictures or frames of real creators are both valid, and several may be given. It is used only to write the locked JSON; the agent changes at least three identity traits (§ 4.3); it is never attached to the image tool. After the user approves the hero, the hero picture is attached as the identity reference of every later keyframe and video, and the creator file shrinks to a short lock. | Text-only casting is what makes the person new and not a copy. Image binding is what makes her the same on day 40. |
| 6 | Higgsfield or BytePlus for Seedance 2.5? | [Jason]: Seedance refuses hyper-real face references; Higgsfield has a bypass endpoint at 2 to 3 times the cost; BytePlus lets you register a digital character asset, with approval hurdles. [Enzo] runs on Higgsfield. | **Changed 2026-10-01: Supagen is the system. The default video model was MiniMax H3; since 2026-10-02 it is MiniMax H3 Max reference-to-video (the founder). The alternates are Seedance, Wan Prime, Kling and Gemini Omni, all through Supagen. No BytePlus registration and no Higgsfield in the default path.** The character pipeline keeps its own model file, `scripts/character/models.json`, in the shape of `known_model_limits` (§ 2.2). It ships with the two MiniMax reference models only. **Built 2026-10-01, price fixed and default changed 2026-10-02:** `template/scripts/character/models.json` holds `minimax-h3-max-reference-to-video` (the default: 5 to 15 s, $0.08/s, at most 4 reference images) and `minimax-h3-reference-to-video` (the second entry: 5 to 15 s, about $0.06/s at 768p, at most 9 reference images), both generated at 768p and upscaled once to 1080p at assembly, with the duration rules and the Supagen findings (§ 17, question 13). The MiniMax H3 Max text-to-video and image-to-video entries (O plates, and any segment with no references) are not in it yet; they are added on the founder's word. The alternates are added by the user, at their end, with a measured cap and price; no Kling or Seedance reference entry ships now. For reference, the kit's recreation `templates.json` today holds `minimax-h3-max-*`, `wan-3-prime-*` (with `-reference-to-video` in its limits), `gemini-omni-flash-1-1-*` and `seedance-2-fast-text-to-video`; it holds neither reference model of MiniMax. | One system means one upload path, one cost record and one set of quirks [repo `templates.json`, AGENTS rules 2 to 7]. An alternate is used when the failure ledger shows the MiniMax H3 models failing a segment type (§ 9.3). Limits that follow: Gemini Omni cannot take references through Supagen, so it is an alternate only for segments with no references; Seedance is in `templates.json` as text-to-video only, with no price; Kling needs a template version and a price before its first use. |
| 7 | Storyboard grid or separate keyframes? | [Fekri]: one annotated six-frame board, fed as the reference of a 30 s generation. [SD]: independent keyframe images align better than a grid. [Enzo]: one start still per shot. | **Agreed 2026-10-01.** **Separate keyframes, one per generated segment. The contact sheet of keyframes is the storyboard the founder approves.** The approval will need an Atlas UI, probably like the slideshow pipeline UI. Its design is out of scope here; it is done later for the whole video pipeline at once. | [SD] is the model's own guide and says the grid is the weaker input. Our segments are short, so each needs one start frame. Fekri's real point survives: decide in pictures first. |
| 8 | Long ban lists or none? | [SD]: negatives work only for subtitles and music. [Fekri]: about 100 generations say long ban lists help. [Ultra]: add a negative only after a failure. [PC]: full negatives always. | **Agreed 2026-10-01.** **Images: the full [PC] negative block, always. Video: a fixed base list of about 400 characters at the end of the prompt, plus at most five bans earned by a failure and recorded in the failure ledger.** | The image prompt has no length limit that matters. The video prompt has 5,000 characters [repo rule 5], and the start and the end of a prompt weigh most [Fekri], so the end is spent on bans that have earned their place. |
| 9 | Phone in the frame from frame 0, or nothing in the hands? | [Ultra] Mode B: phone in hand from frame 0. [Vlad]: the avatar holds nothing until the product beat. [Fekri]: no phone in any shot. | **Agreed 2026-10-01, with a hard rule added.** **A phone is always in the first frame of its own segment, already up and already green. A talking segment has no phone and free hands. Hard rule: the phone is held at a completely direct angle to the camera: the screen plane square to the lens, flat-on, no tilt and no perspective** (§ 11.5). This is the default for the static plates O, G and S. The motion shots H and F, added by the founder on 2026-10-01, have their own rules (§ 11.12): F keeps the phone flat-on in every frame; H is flat-on at its start and end holds. | The flat-on screen makes the insertion easy: the quad is a near rectangle, the type is not compressed, and the corner fit has the least to correct. An object that enters mid-clip is invented on the spot, which is how hands and phones break. Because the phone shot is its own segment, both rules hold at once. When in the video that segment sits is a script matter (`SCRIPT-LEARNINGS.md` § 7). |
| 10 | JSON to the model, or prose? | [Enzo], [PC]: JSON prompts. [Fekri], [SD], [repo]: labelled prose blocks. | **Agreed 2026-10-01.** **JSON is the spec on disk. Image models get the JSON. Video models get prose compiled from it, in our P1 section order.** | JSON forces the split between what may change and what may not [Enzo]. But JSON syntax wastes the 5,000 characters, and our section order is the one measured on our models. |
| 11 | Grain and a compression pass? | [Enzo]: 1080p, 2 to 3% grain, one pass through a messenger app. [PC]: grain and a re-encode on every still. [repo]: the kit's handle style already dropped grain and the underexposed look: "normal phone processing, sharp enough, true colours". | **Changed 2026-10-01: grain is tested.** **1080p, never 4K, one extra encode at a phone-like bitrate, done by ffmpeg. No added film grain by default. A 2 to 3% grain variant is a planned test on the first real use case in a consumer workspace (§ 14.7); the founder looks at the output and decides.** | The house style is a decision the founder already made on real posts, so the default stays until the test says otherwise. Sensor noise inside an inserted screen stays, because a clean screen in a phone plate reads as pasted [repo `insert.json` grade]. The grain variant is an export of the same segments, so the test costs no generation. |

---

## 4. Casting: reference-vibe cloning into a new person

Part A of the pipeline (§ 2): done once per character, then reused by every video;
never per video. Free: every picture is made with the Codex image tool on the
user's Codex plan (§ 3, decision 4). **This is also how every handle's visual identity
is made** (decided 2026-10-02): § 4.1 to § 4.5 are the identity half of the
`persona-identity` skill, which the `handles` skill runs for a slideshow handle too
(§ 2, § 4.9).

**4.1 The method.** Describe the vibe reference so completely that the image model has
no room to fall back on its defaults, then generate from the description alone
[Vlad, Jason, PC]. The composition and the vibe match; the individual does not.

**Where the look comes from.** The **vibe reference** is one or more pictures whose
look fits what the video will claim: age, styling, room, camera. Pinterest pictures are
a valid vibe reference, and so are frames of real creators; `deepen` already saves the
videos and `ingest` cuts the frames [repo]. Several references may be given; the
locked JSON then states which reference each vibe axis comes from. Match the face to
the claim: a 22-year-old on joint pain fails before a word is said [Vlad]. So the
casting brief states the claim first and the look second. The vibe reference is used
only to write the locked JSON and is never attached to the image tool (decision 5).

**Optional, strongly recommended, for every handle with a persona** (the founder,
2026-10-02). It applies to a slideshow handle and a video handle alike, to each persona
of a handle with several, and to each new character; a brand handle with no face and a
real persona (own camera) have no casting. The user may bring pictures (Pinterest is
fine). **When the user has none, `persona-identity` proposes some from the research**
[the founder: "it can actually use the competitor and niche research to propose
identity based on the persona handles it finds"]: the persona handles in the niche
`architecture.md` account table, in each app's `NETWORK.md` and in the teardowns,
filtered to those that show a person whose look fits the claim; their saved slides,
covers or a frame of a saved video, nothing new fetched; three to six proposed, each
with its handle, post and the reason it fits. The user picks, and only a pick is used.
A frame from the research shows a real person, so the divergence check of § 4.3 is
mandatory for it. When the user skips the step, the locked JSON is written from
`## Persona` alone and `vibe_references` says "none: skipped by the user"; the face is
then closer to the model's default person, and the skill says so.
After the user approves the hero, it is saved as the handle's `references/face.png`, and
that picture is attached as the identity reference of every later slide, keyframe and
video (§ 6). The JSON alone is never the identity: the pictures go to the image tool and
the video model as references.

**4.2 The locked JSON.** Use the portrait-clone schema in full
(`sources/04-portrait-clone-SKILL.md`): `critical_constraints` and `negative_prompt` at
the top, then subject, face (skin, eyes, brows, nose, mouth, make-up, ears), hair, neck,
hands, jewelry, accessories, body marks, outfit, pose, expression, scene, lighting,
camera, colour grading, style, output, generation parameters, post-processing. Its rules,
kept:

- Every attribute gets one value. No "or", no range, no "natural" without a number.
- Absence is locked too: glasses, hat, earrings, bag, second person, text are written
  as `none` and listed in the negative.
- Quantify: degrees, cm, mm, percent of frame, counts, a hex for every colour.
- Each trait that differs from the model's default "beautiful AI person" is escalated
  three times: precise in its field, one imperative line in `critical_constraints`, the
  default version in `negative_prompt`. The drift axes to check every time: eyes (big,
  round), face (V-line, doll, symmetric), body, clothing (tighter), hair (glossy,
  voluminous), skin (poreless), stance (model pose), look (idol), background
  (saturated), additions (earrings, props, text).
- The file is versioned (`_v1`, `_v2`) and always complete.

**4.3 Our one change to portrait-clone: diverge on purpose.** The skill aims at a
near-identical clone. We aim at a different person. After the audit, change at least
three **identity** axes away from the reference (for example face shape, eye shape and
spacing, nose, hair colour or cut, a body mark) and keep every **vibe** axis (age band,
styling, wardrobe class, room, light, camera, expression energy). Then check: place the
best candidate beside each reference. If a stranger would say "same person", it fails;
change two more axes and bump the version.

**4.4 De-slop, mandatory** [PC, Jason, Ultra]:

- No quality boosters in any positive field: 4K, 8K, ultra-detailed, photorealistic,
  masterpiece, sharp focus, flawless, stunning. They produce the over-sharpened HDR look.
  They go in the negative.
- No glamour words: flawless, ethereal, porcelain, dewy, model, cinematic, "natural
  beauty", bare "realistic".
- A capture pipeline instead of adjectives: front-facing phone camera, lens, distance,
  height, processing. Never pro-camera vocabulary for native UGC.
- Imperfections are always present and always located: pores on the nose and cheeks,
  faint redness at the nostrils, under-eye darkness, one brow slightly higher, flyaways
  at the crown, a crease in the sleeve. Located means locked, not random.
- A lived-in room: one thing slightly off. "Perfectly tidy room" is a negative [Enzo].
- Flat or natural grading, no sharpening, low micro-contrast.

- Generation parameters, where the model exposes them: guidance 4, 28 steps, a fixed
  seed, a fixed sampler [PC]. A high guidance value is one source of the waxy look.
- Post-processing of every still, matched to the medium it must pass for [PC]. A phone
  photo: mild noise-reduction smear in the shadows, a very faint edge halo, JPEG
  quality 85. A video still: downscale 50% bilinear and upscale back, JPEG quality 80.
  [PC] also adds 2 to 3% grain to a video still; we leave grain out by default
  until the grain test on the first real use case in a consumer workspace decides (§ 3, decision 11; § 14.7).
- `critical_constraints` ends with a `MEDIUM:` line: the image must read as an
  unretouched real capture in that medium, never as a render [PC].

**4.5 Choosing the hero** (decision 4). The locked JSON goes to the Codex image tool;
four candidates at once [Vlad]. No bake-off between models. Judge them on five
questions: doll eyes or not; skin texture at 100%; does it read as a phone photo; is it
the person the JSON describes; would it pass in a feed beside real posts. The user
picks the hero. Then the iteration mode of [PC]: diff the hero
against the JSON variable by variable; each difference is an under-locked variable.

**4.6 A face that already exists.** When a handle already has an approved face in
`references/face.png` (any persona handle made before 2026-10-02, or a face the user
brings), its character is **not re-cast**: that picture is the hero, and the process
goes straight to the video half (§ 2). The creator file is written **from the picture**:
describe only what is visible; invent no scar, mole or jewellery that is not there
[Ultra]. The locked JSON is written the same way, from the picture, so the next version
has a text lock too, and `casting.vibe_references` says "none: written from the
approved face". The status starts at `identity`. Her new angles are derived from that
face with the Codex image tool, like any character's (§ 6).

**4.7 The twenty-generation gate.** A character goes live for video after the same
face holds through twenty generated stills in different shots [Enzo]. The stills are
the first keyframes, and slide pictures that show the face count too, so the gate costs
nothing extra. The gate blocks only video production; it never blocks a slideshow post.

**4.8 One before four.** The first character of an app is held through the gate
before a second one starts her video half, on any handle [Enzo]. This never holds back
the identity half: a second slideshow handle gets its face as before. A multi-character handle adds its
characters one at a time (§ 2.6). Each later character gets her own folder, character
file, anchors and voice reference setup; nothing is shared between two characters.

**4.9 What the unified process changes for the slideshow path.** Decided 2026-10-02:
one identity process for both paths. Its effect on a slideshow handle:

| | Before | After |
|---|---|---|
| `handles` step 2, persona | `## Persona` | unchanged |
| `handles` step 3, references | `persona-identity` wrote prompts from `## Persona` and made `face.png`, `subject-<name>.png`, `style.png` | `persona-identity` runs the identity half: the casting brief from `## Persona`, the vibe references (optional, strongly recommended: the user's pictures, or frames of persona handles proposed from the competitor and niche research, § 4.1), the locked JSON with its de-slop and divergence checks, four face candidates, the user picks the hero; then the fixed subjects and the style photo, as before. A real subject (own camera) still skips it. |
| `handles` step 4, profile picture | from the face and the subjects | unchanged |
| The files the slideshow reads | `HANDLE.md` `## References` and `references/face.png`, `subject-<name>.png`, `style.png`, `profile.png` | the same files, the same names, the same table; the `images` skill and the Atlas handle page are not changed |
| New files | none | `characters/<character>/creator.json` (status `identity`), `characters/<character>/references/casting/`, `world.json`, and a `## Characters` table in `HANDLE.md` |
| Video-only work | none | none at handle creation: anchors, set plates, signature details, the gate and the voice wait for the first video |

**An existing handle migrates without re-casting.** Nothing is redone at upgrade. The
first time a character video is planned for a handle that has `references/face.png`
and no `characters/` folder, `persona-identity` writes the character from that face
(§ 4.6): `creator.json` at `v1`, status `identity`, the locked JSON written from the
picture, the `## Characters` table, and `world.json` from the existing
`subject-<name>.png` files and the `## Persona` text. Then the video half. A slideshow
handle that never makes a video never needs any of it.

**Out of scope for this work, and not changed:** a multi-character handle in the
slideshow path (§ 17 question 15). The `## References` table keeps the identity
character's face only, so the slides behave as today.

---

## 5. The creator file and the shot file

The whole method runs on one split [Enzo]: a file that never changes and a file that
changes every post.

**5.1 The creator file** (`characters/<character>/creator.json`, template § 15.1) holds
one character's identity only. Nothing about any one post. It carries its `version` and
`status` (§ 2.6).

- `identity_lock`: six short lines. Age appearance, face, eyes, brows, skin, hair. Kept
  boring; each word is an obligation.
- `signature_details`: chosen per character at casting, with the user; at most three, and
  each is large enough to survive video, at
  least 1% of the frame height in a chest-up shot (a hair clip, a necklace, a nail
  colour). A person who wears the same necklace in every video reads as a person; small
  repeated imperfections make a face lived-in and give the reviewer something to check
  [Enzo]. A detail too small to see flickers and becomes a defect.
- `voice_profile`: in the same file on purpose, so the script writer and the voice read
  the same identity [Enzo] (§ 7).
- `camera_habits`: device, lens, distance, height, processing. The camera is part of who
  she is; a shifting angle breaks the selfie read at once [Vlad].
- `fixed_subjects`: the ids, in the handle's `world.json`, of what always comes with her:
  a pet, a partner's hand, a product she always holds. The world holds each one's count,
  its reference picture and its true-size rule, as the handle's `HANDLE.md` states them.
- `sets`: the ids, in `world.json`, of the rooms she can be in (§ 8). `outfits`: the
  locked clothes she can wear.
- `never_change`: the list that every shot must obey.

`HANDLE.md` stays the human document of the handle. `creator.json` holds only what a
generator must obey. The `## Characters` table of `HANDLE.md` lists the roster: each
character's id, version, status and folder (§ 2.6).

**5.2 The shot file** (`shots/<seg>.json`, template § 15.2) holds what changes: the set,
the outfit, the action, each hand's job, the props, the phone state, the line.

**5.3 The priority order is the whole trick** [Enzo]. It tells the model what it may not
touch before it touches anything. Ours, fixed, top to bottom:

1. identity from the creator file and the anchors of the pinned version
2. fixed subjects (count, look, true size)
3. camera habits
4. the phone and its green screen, when the segment has one
5. the requested outfit only
6. the requested set only
7. the action

What we want to vary sits at the bottom, where the model has the least freedom.

**5.4 Negatives, in three layers.**

- **Identity negatives**, from the creator file, on every shot: different face, shorter
  or lighter hair, missing signature detail, age change, make-up change, second person.
- **Slop negatives**, fixed: plastic or airbrushed skin, beauty filter, studio or ring
  light, cinematic grade, perfectly tidy room, extra or fused fingers, text, captions,
  watermark, UI overlays.
- **Earned negatives**, from the failure ledger, at most five per prompt (§ 9.3).

**5.5 The merge.** Per generation: creator file fixed, shot file rotating. For a
picture, the two are merged into one JSON and sent as the prompt, with the anchors
attached. For a video, the compiler writes prose (§ 12). One name for one thing, pasted,
never paraphrased: a lock that is reworded per card drifts [Ultra].

---

## 6. The character sheet and the anchors

All derived from the hero by image-to-image, with the Codex image tool (decision 4).
They are the video half of `persona-identity`: made once, just in time for the first
video, and reused by every video; an anchor is added, never overwritten (§ 2.6). The
character's anchors live in `characters/<character>/references/anchors/`; the hero of
the handle's identity character is `references/face.png`; the set plates belong to the
world, in `references/sets/`.
Never from text again. Secondary views that come from the same base image hold; views
generated independently do not [Ultra].

| Anchor | What | Why |
|---|---|---|
| `references/face.png` (or `anchors/hero.png` for any other character) | the approved casting image, chest-up, selfie camera | the identity |
| `front.png`, `three-quarter-left.png`, `three-quarter-right.png`, `side.png` | neutral face, same light, plain framing | the model sees the head from the angles the shots use. One image per view; separate view images are more stable than a collage [SD]. |
| `back-shoulder.png` | from behind, over the shoulder | the over-the-shoulder demo (§ 11) shows hair and shoulder, not the face |
| `expressions.png` or six files | neutral, mid-sentence, real laugh with eye creasing, listening, surprised, looking away [Ultra] | talking keyframes start mid-sentence, not posed [Fekri] |
| `hands.png` | both hands, nails per the lock | hands are the most common failure in every model [Vlad]; the nails are a signature detail |
| `references/sets/<set-id>.png` (the world) | each set, empty, from the camera position used there | the room is checked like the face (§ 8) |
| `outfits/<outfit-id>.png` | each locked outfit, on her | wardrobe drift is a join giveaway |

Rules:

- Each anchor is approved by the user, by word, and the approval is written in
  `creator.json`. The Atlas handle page shows only the files of `references/`; showing the
  anchors there is the later Atlas UI (decision 7).
- When several images show one person, the prompt says so and states the count: "all
  images define one woman; exactly one person on screen" [SD].
- Each reference is bound by a sentence that says what it controls and what it does
  not: "@Image 2 defines the kitchen, its layout and its light. Do not use the people in
  it." An untagged image is used however the model likes [Fekri, SD].
- Use the fewest references that hold the shot. Stability falls as the count rises
  [SD]. A talking segment needs the keyframe, the hero, one angle and the voice
  reference.
- The **keyframe** of a segment is the main anchor of that segment: creator file plus
  shot file, rendered as a still, approved, then used as the start frame. The face is
  locked before any motion is added, and the video prompt describes only what moves
  [Enzo]. A keyframe has no text in it and looks like a paused phone video, mid-sentence
  [Fekri].

---

## 7. Voice and audio quality

**7.1 The voice profile** (in `creator.json`). Cast the voice the way the face is cast
[Fekri]: pitch, pace, accent, how sentences join, which words she leans on, her verbal
habits ("starts with 'okay so'", once), what she never says, and the sound not wanted
(announcer, narrator, radio, rising question tone, over-articulated consonants). The
numbers of pace, pauses and pitch spread come from the voice reference, measured by
`transcribe` [repo].

**7.2 The voice reference setup** (decision 3). Part A, stage D2 (`character-voice`): a
required step, once per character, before her first video; every later video reuses
it. No talking segment of a character is generated before her voice reference is
approved. A new voice reference is a new version of the character (§ 2.6). The agent does it together with the
user:

1. **Find the candidates.** The niche and competitor research has already saved real
   creator videos with their audio [repo `harvest`, `deepen`, `niche-fetch`]. The agent
   picks three to five clips whose voice fits the voice profile and the claim: age,
   accent, energy, the room.
2. **Cut them clean.** 8 to 15 s of one speaker, from the word times of `transcribe`
   [repo]: no music, no second voice, no sound effect, no edit inside the clip. Saved as
   mp3 (because `.m4a` uploads with the wrong type [repo]).
3. **The user listens and approves one.** The approval is recorded in `creator.json`
   with the user's words and the date, beside the clip's source: the post, the real
   creator's handle, the platform and the cut times.
4. **Save it** as `characters/<character>/references/voice/voice-reference.mp3`.
5. **Check that the first approved generation does not sound robotic or AI** (the
   **natural-voice check**). It passes when all of these are true: natural breaths
   before lines; pauses that vary in length; pitch that moves (`character/qc.py`: no 2 s window
   under 5 semitones [repo]); the room sound under the voice, not a dry studio voice; no
   flat TTS cadence, where every sentence has the same rhythm and the same fall at the
   end. If it fails, the clip is replaced by another candidate. Founder, 2026-10-01: "the
   focus should be on the voice not sounding robotic and ai. as long as that clears we
   are good."

Every talking segment then attaches the clip as the audio reference, bound in the
prompt as "the voice reference only: tone, pitch, accent, pace. Not its words" [Vlad;
earlier character prompts made with the kit already did this]. A voice is changed as rarely as a face.

**The fallback.** When the research gives no usable clip, or the user approves none, the
first talking generation is cast from the text profile and run until the user accepts
the voice; 8 to 15 s of her clean speech is then cut from it and approved as the voice
reference in step 3. This is the only case in which the reference comes from our own
generation.

**7.3 In-model, always, when the mouth is visible** (decision 2). The model that draws
the room voices the room: a car carries cabin tone, a bathroom a reflection [Vlad]. The
prompt names the sound as physical events, each on its own [SD]: `<a mug set on a wood
table>`, and states "no music" and "no subtitles".

**7.4 The demo voice-over.** The character says the demo lines on camera, in her set, in
one generation (the **demo performance**, segment type T, tagged `demo-vo`). Its audio
runs under the screen recording. No lips are visible there, so word timing is free:
`character-assemble` may trim pauses to fit the recording.

**7.5 Room-tone match.** One or two seconds of the set with nobody speaking are cut
from a generation and saved per set as `room-tone.wav`. `character-assemble` lays it under the
whole video, across every join and under the cutaway, so the room never drops to
digital silence. All segments are brought to one loudness. If a TTS fallback is ever
used, it gets the same bed, a small-room reverb and no studio compression [Enzo's
voice-over spec], and it is used only where no face is on screen.

**7.6 Marking up the lines so the audio sounds real** [Vlad, Enzo]. The words come
from the script. The imperfections are written into them, not hoped for:

- an interruption, a half sentence, one restart per 15 s at most;
- one audible breath before the line that must land;
- sentences that run into each other with short breaths, not clean pauses [Fekri];
- pace that differs by line: quicker on the first line, slower on the line that must
  land [Enzo];
- a delivery note on every line: which word lifts, where the beat falls [repo].

The test: read it aloud. Anything you would not say to a friend in a car is rewritten
[Vlad]. The measure: `character/qc.py` pitch spread, no 2 s window under 5 semitones [repo].

**7.7 Word budget.** 15 words per 4 seconds, 110 to 120 words for 30 s [Fekri]. Fewer
words fix bad lip sync faster than any instruction [Ultra].

---

## 8. Environment: chosen by the claim, ranked by the usable rate

**8.1 By the claim** [Vlad]. The setting makes the claim plausible. Car: private,
unscripted. Bathroom, bedroom: personal. Kitchen: food, supplements, home. Store aisle:
caught mid-shop. Desk: software, work. A pet owner talks in her home, with the pet.

**8.2 By the economics** [Vlad]. The setting also decides how often the model
succeeds. A small, contained, evenly lit space with a fixed camera fails less; a deep
room with several lights and background movement fails more. The real price of a
segment is:

    cost per usable segment = price per second × seconds ÷ usable rate

At the same price, 80% usable costs half of 40% usable. So the set is a cost decision.

**8.3 Sets are locked like faces.** The handle's world (`world.json`, § 2.6) has two or
three sets, each with an id, a plate (§ 6), a light state (source, direction, colour
temperature), a camera position and three named objects. The character sheet holds the
face; the reviewer checks the room [Vlad]. The sets come from the home the handle's
`HANDLE.md` describes, for example the sofa, a spot on the floor, the kitchen; each
character's `creator.json` names the ones she uses.

**8.4 Rank the sets by measured usable rate.** `approval.json` records keep or reject
per segment with its set id. After ten generations in a set, its rate is known. A set
under 40% is simplified (closer framing, one light, less depth) or retired. Start every
new character in her simplest set: a wall or a sofa back close behind her, one window,
phone propped.

**8.5 One light state per segment.** Light may change between segments (night to day is
a cut), never inside one [Fekri]. Background movement only where the set implies it
[Vlad].

---

## 9. Motion writing and per-model failure modes

**9.1 Actions, not states** [Vlad].

| A line with no action (static face) | The same line with an action (movement) |
|---|---|
| "It made tracking so easy." | She puts the mug down, leans toward the lens, says the line, glances away and back on the last word. |
| "I finally understand my dog." | She looks down to her left at the dog off frame, half laughs, then back to the lens. |

**9.2 The rules of a motion beat.**

- One state change per beat, and each beat ends in a **visible end state**: a position,
  an object in a hand. Never a mood [SD]. The end state is what the model steers toward
  [Fekri].
- Put the physical action before the spoken line, so the model does not blend the two
  [Ultra].
- Emotion is written as two to four observable cues: brows, breath, gaze, a hand. Not
  as an adjective [SD].
- Hands: every visible hand has a job and a place; a hand with no job is out of frame.
  Prefer one readable hand on a talking shot. No counting on fingers [Fekri]. The hands
  hold nothing until the segment that needs the object [Vlad].
- Ask for the flaws by name: micro-shake, drifting frame, one autofocus hunt, uneven
  exposure, a slight tilt. The models default to clean and steady [Fekri]. In an O, G
  or S segment, no camera tilt: it would tilt the screen against the flat-on rule
  (§ 11.5).
- No conflicting instructions: not "propped phone" and "handheld sway" in one beat
  [Ultra].
- A time range is a budget, not an edit point. Too little in a range and the model
  invents motion; too much and it drops beats [SD]. We still write exact cut times
  [repo] and measure them in P3.
- Eye contact holds through a line; blinks are natural; pacing has stumbles [Vlad].
- Physics is named for the action at hand: a weighted grip, fingers that keep contact,
  a screen that stays planar and does not bend through fingers [Ultra].
- A phone, when it is in the segment, is held flat-on to the lens from the first frame
  to the last: no tilt toward her, no turn, no perspective (§ 11.5). The one exception
  is the push of an H segment, which moves straight along the lens axis between two
  flat-on holds (§ 11.12).

**9.3 The failure ledger.** `pipeline/character/model-failures.md`, one table per model:
the failure, the date, the project, the prompt change that fixed it. P3 adds a row; P1
reads the model's table, and the model's row in `docs/character-model-known.md`, before
writing. A negative enters a prompt only from this ledger.

**Who owns which file** (the founder, 2026-10-02: a kit upgrade must never clash with
the user's rows). The kit splits its files into managed ones (`scripts/`, `.claude/`,
`docs/`, `atlas/`, replaced or merged at each upgrade; `brain/`, replaced and
read-only) and the user's (`apps/`, `pipeline/`, `research/`: the installer only makes
the folders, and writes a few starter files once with `copy_once`). So:
- **The ledger is the user's.** `pipeline/character/model-failures.md` ships in
  `template/pipeline/character/` and the installer writes it with `copy_once`: a new
  workspace gets the seed (§ 9.4 as a table "What was known before the first run", and
  one empty table per model), and an upgrade says "kept your …" and changes nothing.
  A model added to the kit later has no table in an existing ledger; P3 adds it, in the
  same shape, at that model's first rejected segment.
- **New kit knowledge reaches existing users through a managed file**, the pattern of
  `brain/` beside `apps/<slug>/niche/`: `docs/character-model-known.md` holds the § 9.4
  table as the kit knows it now, and every upgrade updates it. Nobody writes rows in it.
  P1 reads both files; where they disagree, a row the user measured wins over a kit row. Repair is by layer [Ultra]: face drift goes to the references and the keyframe;
plastic skin to the casting and the light; bad hands to a simpler shot; warped UI
cannot happen (§ 11); bad lip sync to fewer words; room or outfit drift to the exact
lock restated; a polished look to stripping cinema words.

**9.4 What is known today.**

| Model | Known failure or limit | Source |
|---|---|---|
| every model | hands first, then teeth, then eye movement | [Vlad] |
| every model | captions added unprompted; an animal that vanishes between shots; a hand or prop that swaps sides; a hallucinated object | [repo `review`] |
| MiniMax H3 Max, text-to-video and image-to-video (`minimax-h3-max-text-to-video`, `minimax-h3-max-image-to-video`) | 15 s, 768p, $0.04/s in `templates.json` (Supagen now lists $0.08/s and records $0.20 a run); not in the character `models.json` yet; the planned model for a segment with no references (an O plate); tuned for prompt adherence | [repo `templates.json`] |
| MiniMax H3 Max, reference-to-video (`minimax-h3-max-reference-to-video`) | **the default for every segment with references** (the founder, 2026-10-02). 5 to 15 s, whole seconds; 480p, 768p, 1080p (768p native, 1080p the provider's refinement); generated at 768p; **at most 4 reference images**, plus video and audio references; no video extension; $0.08/s (the founder's figure; Supagen lists the same). Its record says it generates sound, but its capability list says it has no audio output: open until the first run (§ 17 question 13). Not run yet: no measured failure and no measured output length. | [Supagen model record, read 2026-10-02] |
| MiniMax H3, reference-to-video (`minimax-h3-reference-to-video`) | 5 to 15 s, whole seconds; 480p, 768p, 2K, 4K; generated at 768p; at most 9 reference images; about $0.06/s at 768p (the founder, 2026-10-02; Supagen lists $0.13/s and records $0.65 a run, § 17 question 13); the default until 2026-10-02, **now the second entry in `models.json`**; takes the face, the sheets of fixed subjects, earlier frames and a voice clip. Earlier prompts needed guards against an extra animal, a wrong animal size and an object appearing from nowhere. | [repo, earlier character videos] |
| Wan 3 Prime, alternate (`wan-3-prime-*`) | the only one past 15 s (30 s); in reference mode the app UI came back as nonsense strings and the framing drifted from over-the-shoulder to frontal; green less flat (G std 14.6) | [repo, measured] |
| Gemini Omni Flash 1.1, alternate (`gemini-omni-flash-1-1-*`) | best per second, word-perfect dialogue, a true over-the-shoulder, the flattest green (G std 12.3); 10 s cap; a tripod hallucinated into shot; UI ghosting baked into the green; references cannot reach it through Supagen, so it serves only segments with no references | [repo, measured; `templates.json`] |
| Seedance, alternate (`seedance-2-fast-text-to-video` in `templates.json`: text-to-video, 15 s, 720p, no price yet) | from the sources, on Seedance 2.5 outside Supagen: 30 s in one pass; refuses hyper-real face references by default; mangles on-screen text, always; falls back to narrated b-roll unless on-camera speech is stated in the style, in each stage and in the constraints; counts drift first, so write them as numbers. Not measured here. | [Jason, Fekri; repo `templates.json`] |
| Kling, alternate | not in `templates.json` yet: no template version, no price, no measured failure. It needs both before its first use. | [repo `templates.json`] |

**9.5 The failure census** [Vlad]. For a new model or a new character: run the same
short script five times, note what breaks, write around it. An alternate model is
tried only through Supagen, and only when the ledger shows the MiniMax H3 models failing a segment
type (decision 6). It costs money and needs a
yes. The five-run census is not part of the test phase (§ 16 Phase 5, under $2); it
runs on the first real use case in a consumer workspace.

---

## 10. Segments: cut the video into parts and generate each one alone

**10.1 Why.** A long take drifts in the middle [Enzo]. A join on a talking face shows
[Vlad, Fekri]. Three of our four models stop at 10 to 15 s, and a prompt stops at 5,000
characters [repo]. So the video is cut into segments before anything is generated, each
segment is made in one generation, and the joins are put where they cost nothing
(§ 3, decision 1).

**10.2 The segment types.**

| Code | Segment | Character | Phone | Made by |
|---|---|---|---|---|
| T | talk | on camera, speaking | none | one generation, referenced |
| R | screen recording cutaway | not shown | fills the frame | a real recording, no generation |
| P | picture-in-picture | in a bubble | fills the frame | a real recording + the demo performance |
| O | over the shoulder | hair and shoulder | green, large | a plate + P4 |
| G | phone in hand | hand, part of her | green, small | a plate + P4 |
| S | shown to camera | on camera | green, static | a plate + P4, a still screenshot |
| H | phone push | behind the phone, mouth not visible | green, pushed toward the lens | a plate + P4, motion rules (§ 11.12) |
| F | finger interaction | behind the phone, mouth not visible | green, still; the other hand's finger scrolls, taps or swipes | a plate + P4, motion rules (§ 11.12) |

The **demo performance** is a T segment in which she says the voice-over lines of a
recording on camera. Its audio goes under R; its picture goes into the P bubble (§ 7.4).

**10.3 Where to cut.**

- A join sits on a sentence end. Never inside a sentence while the face is visible.
- A join is also a visible change: another segment type, or the same set with a
  reframe of about 10%. This is the jump cut every real creator makes.
- A cutaway with no face (R) is a free join on both sides.
- One generated segment is 3 to 15 s. Shorter, and the trim leaves nothing. Longer,
  and the model's cap or the drift decides for you.
- One segment has one set and one light state. Light changes at a cut, never inside a
  segment [Fekri].
- Cuts inside a segment are written as stages in its prompt, with exact times, each
  with one state change and a visible end state [SD; repo].
- Mark the cut points on the frozen script before P1 writes any prompt. Each
  segment gets the ids of the lines it speaks.

**10.4 What holds a video together across its segments.**

- **One outfit and one set family for the whole video.** Every talking segment of a
  video uses the same `outfit_ref`; a set change is allowed only at a join.
- **Every generated segment starts from its own approved keyframe**, and every keyframe
  is made from the same hero, the same outfit anchor and the same set plate (§ 6).
- **The same references on every segment:** the hero, one angle, the voice reference.
- **A frame of the neighbour.** The last frame of an approved segment may be attached to
  the next one as a reference for face, hair, clothes and light. An earlier two-part
  character video made with the kit did this with two frames of the first half [repo].
- **The voice reference on every talking segment**, so the voice does not change at a
  join (§ 7.2).
- **At most four pictures per run on the default model.** MiniMax H3 Max
  reference-to-video takes at most 4 reference images (`max_reference_images` in
  `models.json`; `generate.sh` refuses more). The voice clip is audio and does not
  count. Choose in this order: the segment's keyframe; the hero; the sheet of each fixed
  subject in the shot; then one more, the angle anchor or the frame of the neighbour.
  The keyframe already carries the outfit and the set, so their anchors are not
  attached again. A shot with two fixed subjects has no room for the fourth picture.
- **The room tone under all of it**, laid by `character-assemble` (§ 7.5).

**10.5 A segment can serve several videos.** Because the outfit, the set and the
voice are locked, a segment is not tied to one video. A recording, its demo performance
and a talking segment can be made once and named by several `video.json` files; each
shared segment is its own project. A video then pays only for the segments that are
unique to it (§ 14.6). Which segments are shared, and what differs between the videos,
is a script decision.

**10.6 The join in practice.** `character-assemble` makes hard cuts only. When two T segments
meet, it punches in about 10% on the second one. No transition effects, no generated
bridge between clips: a generated bridge is not a pixel-true splice [SD], and a real
creator does not use one.

**10.7 Regenerate one segment, not the video.** A reject at gate B (§ 14) names one
segment. Only that segment is generated again, from the same keyframe, with the one
change the failure calls for.

---

## 11. The app UI insertion playbook

App insertion is optional per video. A video with no phone skips this section. Whether
the app appears, and when, is a script decision. How it appears is decided here.

### 11.1 The law

**No UI pixel is generated.** Reference conditioning returns a convincing pastiche with
nonsense strings; it was tested here [repo rule 1, measured]. The model's own
guide agrees: for text, signs and product details that must be accurate, combine
prepared references, generation and post-production [SD "What it will not promise"].
Seedance mangles text and always will [Fekri]. So:

- The model draws a hand, a phone body, and a screen of flat green. Or no phone at all.
- Every app pixel comes from `apps/<slug>/screens/`.
- A model "edit" that replaces a screen with a reference image is the same failure with
  another name. Not used.
- A plate with no green is not rescued by tracking the phone some other way. No green,
  no insert: regenerate.

### 11.2 Choose the mode by what the viewer must do

Ask one question: must the viewer **read** the screen, **recognise** the app, or
**believe** she uses it?

| Viewer must | Mode | What it is | Generation | Legibility | Risk | Reuse |
|---|---|---|---|---|---|---|
| read | **R** cutaway | the recording fills the frame, her voice over it | none | full | none | any video, any character (new voice-over) |
| read, and see her | **P** picture-in-picture | the recording fills the frame, her face in a bubble | none new (uses the demo performance) | full | low | any video |
| read a little, and believe | **O** over the shoulder | camera behind her; the phone is large; face not visible | one plate | headline and large type; body text when the screen is over half the frame width | medium | any video |
| believe | **G** in hand | the camera looks straight at the screen in her hand (a top-down or over-the-hand view), phone small | one plate | recognition only | high | any video |
| recognise, with her face | **S** shown to camera | she holds the phone up to the lens, static, a still screenshot | one plate | one headline | high | any video |
| believe, with energy | **H** phone push | she thrusts the phone toward the lens; the screen grows from about a third to over half the frame width, then holds | one plate, a motion shot | on the end hold: large type; body text when the screen is over half the frame width | high | any video |
| see her use it | **F** finger interaction | the phone is still and flat-on to the lens; the other hand's finger scrolls, taps or swipes, and the app responds | one plate, a motion shot | the final state: large type; body text when the screen is over half the frame width | highest | any video |

**The default is R.** It is free, perfectly legible, and it is what a real creator does:
[Jason] makes the demo with no character for exactly this reason. Move down the table
only when the claim needs it. "I use this every day" needs a hand on a phone once; a
feature walk-through never does.

**The pairing that works best:** two seconds of O or G to show that the hand and the
phone are hers, a hard cut to R for the part that must be read, then back to her face.
Belief from the plate, reading from the recording.

**H and F** carry the same belief with more energy, and F shows her using the app. The
founder has seen them work in other apps (2026-10-01). They are the hardest plates
here, so a video uses them where the motion is the point, and still moves the reading
of body text to R.

### 11.3 When the character is in the shot

| Segment | Character | Why |
|---|---|---|
| she talks (T) | on camera, no phone | the face carries the shot; free hands move; no object to break |
| the screen must be read | not shown (R) or a bubble (P) | a face and readable UI do not fit one phone-sized frame |
| the phone is in her hand (O or G) | hand and phone, face not needed | identity risk is lowest when the face is out of frame |
| she shows the phone to the lens (S) | on camera with the phone, 3 s at most | the only face-plus-screen shot; static, a still, no gesture |
| she pushes the phone to the lens (H), or works it with a finger (F) | behind the phone; the mouth is not visible; no line on camera | the motion carries the shot; the audio comes from the demo performance or the next segment (§ 11.12) |

A face and a readable screen share a frame only in P and S. Never ask one generated
shot to carry lip sync, a hand gesture and a tracked screen at once.

### 11.4 The screen library

`apps/<slug>/screens/`, indexed by `SCREENS.md`, and only for a plan with app
insertion. **The user provides the recordings** (decided 2026-10-02): who records them,
on which phone, with which account and in which mode is not the pipeline's concern.
The agent only checks and indexes what the user gives. The recipe below is advice the
`screens` skill can show the user; it is not a pipeline step.

**The capture recipe.**

1. A demo account with real-looking, true data. What the screen shows must agree with
   what the script says ("two months in" needs two months of history). No fake counts,
   no invented reviews, no notification that never happened [Ultra].
2. Do Not Disturb on. Full battery, no call or recording indicator, no personal data.
3. Decide light or dark mode per app and keep it. A screen is emissive; in a daylight
   set a light UI sits best.
4. Record on the phone, native resolution, 60 fps if offered. Also take a still
   screenshot of each key state.
5. **One recording, one job.** At most three gestures. Start on a stable frame, hold
   0.5 s; pause at least 0.4 s after every tap; end on the result and hold 1 s. The
   pauses are what the time-warp stretches.
6. Slow, deliberate gestures on the real location of each control.
7. **For an F plate**, record the same gesture the plate will show: one scroll of about
   a third of the screen height, one swipe, or one tap that switches the screen, at the
   speed of a finger, not of a thumb flick. Also take a still of the start state and of
   the end state, and for a scroll a long screenshot of the scrolled content (§ 11.12).

**The index row**, per recording: id, the job shown, duration, the event list (time,
gesture, the screen region it lands in: these become `beats`), the **hero element**
(the one thing the viewer must read, its text and its rectangle in source pixels),
light or dark, app version, date. A recording expires when the app's UI changes.

### 11.5 Plate rules for O, G and S

The rules of the recreation stage 5 prompt are copied into P1, word for word: the green spec (flat RGB 0 177 64, edge
to edge, no icons, no reflection, the same shade in every frame, only the screen is
green), the long "the phone is completely stable" paragraph, the thumb mapped to the
recording beat for beat, the NO TEXT section [repo `script`]. Added by this method:

- **The phone is in the keyframe, already green.** The segment starts with the phone
  up, in its final position (decision 9). The keyframe is approved for screen size and
  for the flat-on angle before the plate is paid for.
- **Size is written as a number.** "The phone screen fills about half the frame width"
  for O. Without it the phone comes back at 10 to 14% of the frame [repo, measured].
- **Hard rule: the phone is flat-on to the lens** (decision 9). The phone is held at a
  completely direct angle to the camera: the screen plane is square to the lens, the
  screen is upright, and there is no tilt, no turn and no perspective, from the first
  frame to the last. The screen then sits in the frame as a near rectangle, so the
  insertion is easy and the type is not compressed. An angled screen is not fixed in
  compositing: the keyframe is redone. The framing of each mode follows from this rule:
  in O the camera sits behind her and looks straight at the screen; in G it looks
  straight down onto the screen in her hand; in S she holds the screen straight at the
  lens. The prompt sentence, pasted into `THE PHONE SCREEN` of every O, G and S prompt
  (§ 12): "The phone is held completely flat-on to the camera: the screen plane is
  square to the lens and upright, with no tilt, no turn and no perspective, from the
  first frame to the last." This rule and its 3 degree gate (§ 11.10) are the default
  for the static plates O, G and S. The motion shots H and F follow § 11.12.
- **The edges stay clear.** Fingers hold the phone by its sides and bottom, below the
  screen. The thumb rests on the bezel.
- **The gesture ladder.** Each gesture multiplies the chance of a bad plate. Choose the
  lowest rung that carries the demo:
  1. no gesture: a still screenshot, or a recording that plays by itself (a result
     loading, a card animating);
  2. one tap;
  3. one scroll;
  4. more than that: not in a plate. Use R.

  An F plate is rung 2 or 3 done by the other hand's index finger: one tap, one swipe
  or one scroll (§ 11.12).
- **Per mode.** O: text-to-video is enough; the face is not visible, so hair and outfit
  are locked in text, and with `back-shoulder.png` as a reference when text alone does
  not hold them (references are the standard mode of the character pipeline, § 2.4). G:
  hold no longer than the recording needs; 3 to 6 s. S: the phone is raised and still
  from the first frame, 3 s at most, a still screenshot, no thumb on the screen.
- **Light.** Name the screen as a light: "the screen lights her thumb faintly". It
  gives the composite a real cue to match.

### 11.6 The legibility budget

The export is 1080 px wide. An iPhone screen is 393 points wide. So the width of the
screen quad in the final frame sets what can be read. *Planning values, to be
calibrated on the first three inserts:*

| Screen width in the 1080 px frame | Share of frame width | What survives |
|---|---|---|
| under 280 px | under 26% | colour and layout: recognition only |
| 280 to 550 px | 26 to 51% | large titles and big numbers (34 pt and up) |
| over 550 px | over 51% | body text (17 pt) |

Our plates so far put the screen at 10.0 to 13.6% of the frame area [repo
measured], which is about 310 to 360 px wide at 1080: large type only. Therefore:

- A G shot never carries something that must be read. It carries the app's look.
- The **hero element** of each recording is named in `SCREENS.md`. The mode is chosen so
  the hero element is readable: if it is body text, the mode is R, P or a large O.
- In R and P, `character-assemble` punches in slowly on the hero rectangle (to about 1.25×), so
  the viewer reads one thing.
- Keep the hero element out of the platform's own interface: clear of the bottom fifth
  and the right edge of the frame.
- **The objective test:** OCR the hero rectangle in the final export, after the export
  pass. If the machine cannot read the hero text, a scrolling viewer cannot. Pass means
  the string matches `SCREENS.md`.

### 11.7 Tracking and replacement in post

**What the recreation compositor already does** [repo `screen_comp.py`], and the
character copy (`scripts/character/screen_comp.py`) keeps doing:

- scans the whole plate for green and lets detection define the insert window, because
  the model does not cut where the prompt asked;
- finds the true corners by fitting each edge to the **outer envelope** of the green,
  skipping the rounded corners, so a finger over an edge does not pull the line inward;
- rejects bad corner fits with a median filter and smooths only lightly, because the
  generated bezel really morphs (measured: the top/bottom width ratio swung 0.976 to
  1.298 in one shot) and the app must deform with it;
- uses a geometric alpha, a rounded rectangle warped by the same homography, joined
  with a strict green key, so the model's fake notch is covered and no green leaks;
- keeps occlusion: what is inside the screen, not green and not dark, is a finger and
  stays in front;
- despills green on the mask edge; grades the insert (blur, contrast, noise, a soft
  diagonal sheen);
- time-warps the recording piecewise through `beats` so each tap lands on the real
  thumb frame.

**What this method adds to the copy** (Phase 3, all local, no cost):

| Gap today | Change |
|---|---|
| The composite is made at plate resolution (768p or 720p), so the UI is limited by the plate. | Upscale the plate to 1080×1920 first, then warp the recording into the upscaled quad. The UI is rendered at full sharpness and then softened to match by `grade.blur`. |
| The recording is pre-scaled to a fixed 480 px width. Right for a small phone, too low for O. | Scale the source to twice the measured quad width. |
| The patch coordinates assume a source 1770 px wide. | Read the source width from the file. |
| The source must be a video with beats. | A `still` source kind: one screenshot, no time map. This is rung 1 of the gesture ladder and the S mode. |
| No legibility check. | The OCR test of § 11.6, in `character/qc.py`, on the composite and again on the final export. |
| No check that the screen is flat-on. | A flat-on check in `character/qc.py`, from the fitted quad: the ratio of opposite edges and the corner angles (§ 11.10). |
| The corner check exists for slides only (memory: zoom all four corners). | A corner sheet for video: the four corners at 400%, at four times across the insert, in the QC folder. |
| A locked phone still gets per-frame corners, which can shimmer by a fraction of a pixel. | A `locked` track mode: when drift is under 2% of screen width **and** the measured morph is small, use one median quad for the whole window. Otherwise per-frame, as today. |
| The grade is set by hand. | Measure the plate beside the bezel (sharpness, noise, black level) and propose `grade`; the agent confirms by eye. |

### 11.8 Sitting the screen in the plate

A perfectly clean screen in a phone-camera plate reads as fake [repo]. In order of
effect:

1. **Sharpness.** Match the plate, never exceed it. The insert is the sharpest thing in
   the frame by default; blur it until the bezel edge and the UI edges agree.
2. **Brightness and black level.** A screen in daylight is washed: lift the blacks a
   little and lower contrast. In a dim room it is the brightest object: let it be.
3. **Noise.** Add the plate's noise to the insert (`grade.noise`).
4. **Glass.** The sheen at 3 to 8% opacity (`grade.reflection`).
5. **Spill.** No green fringe on the thumb or the bezel; the despill already runs.
6. **Motion.** The phone does not move (§ 11.5). If it moved, the plate failed.
7. **Time.** Each tap in the recording lands within two frames of the thumb's contact.
   Re-measure `plate_t` on the real plate, every time [repo]. A plate with a gesture the
   recording does not have is regenerated, not patched.

### 11.9 Building R and P

**R, the cutaway.**

- The recording is taller than 9:16. Crop it to 9:16 around the hero element; the
  status bar and the home indicator are the first to go. If the job needs the full
  height, fit the height and fill the sides with a blurred copy.
- Under it: the demo performance audio and the room tone (§ 7.4, § 7.5).
- It passes the same export pass as the rest. A light blur (about 0.3 px) stops it
  from being far sharper than the generated segments around it. It may stay a little
  sharper: it is a screen recording, and viewers know what those look like.
- No added tap dots, no device frame, no zoom faster than a slow punch-in.

**P, picture-in-picture.**

- The same R base. The demo performance picture goes in a circle or a rounded
  rectangle, about 28% of the frame width, in a top corner, clear of the hero element.
- No matting, no cut-out: a bubble needs none, and a cut-out edge around hair is a new
  way to look fake.
- Lips are visible in the bubble, so here the audio is **not** trimmed; the recording
  is time-stretched to her words through `beats` instead.

### 11.10 The insertion gates

A composite ships only when all pass. Existing numbers are from `character/qc.py`; new ones are
*starting values*. These gates are for the static plates O, G and S. F passes them all,
with the motion gates of § 11.12 added. H passes them on its start and end holds, with
the motion gates of § 11.12 in between.

| Gate | Pass | Source |
|---|---|---|
| green flatness, within-frame G std | under about 10 | [repo] |
| phone drift | under 8% of screen width (locked); 8 to 20% only for G with no gesture; over 20% regenerate | [repo] |
| screen flat-on to the lens (hard rule) | from the fitted quad: opposite edges within 3% of each other, every corner within 3 degrees of 90, the long edges within 3 degrees of vertical; checked first on the keyframe, then on the plate | new |
| screen width in final frame | meets the tier the hero element needs (§ 11.6) | new |
| green left in the final frame | zero strict-key pixels | new |
| corner sheet | no gap, no overflow, rounded corners true, at all four times | [repo, the slideshow corner check], new for video |
| tap alignment | within 2 frames of thumb contact | new |
| OCR of the hero element | reads the string in `SCREENS.md` | new |
| content truth | every string on screen is real app output; the data agrees with the script | [Ultra] |

### 11.11 Failure and fix

| What you see | Cause | Fix, and the stage that owns it |
|---|---|---|
| the app slides against the bezel | the phone moved | P1: firmer stability paragraph; do not smooth harder [repo] |
| holes or ghosts in the insert | the green is not flat; the model drew UI into it | P1: restate the green spec; change model (Omni's green was flattest) |
| the app does not respond to a tap | a gesture in the plate that the recording does not have | P1: write the thumb from the event list; or move down the gesture ladder |
| type is unreadable | the screen is too small | wrong mode: move the reading to R; or a larger O |
| the screen is in perspective or tilted | the phone is not flat-on to the lens | P1: redo the keyframe with the flat-on sentence of § 11.5; a plate that fails the gate is regenerated, never corrected in compositing |
| the screen looks pasted | too sharp, too clean, too contrasty | P4: § 11.8 in order |
| a green edge | the quad is fitted inside the real edge | P4: widen `hue_tol`; check the corner sheet |
| the model put a notch or icons on the green | NO TEXT section missing or weak | P1; the geometric alpha covers a notch already |

### 11.12 The motion shots: the phone push (H) and the finger interaction (F)

Added on the founder's word, 2026-10-01: "we can have some more green screen shots like
the character thrusting the phone into the screen with their hand and maybe even
bringin their other finger and scrolling or switching the ui. i have seen that work in
other apps." **The sources say little about these shots.** [Ultra] gives two physics
lines that apply: the screen stays planar and does not warp through fingers, and
fingers keep contact with what they hold. Its own example changes a screen state with a
hard cut, not with a gesture. The rest of this section is our design. Every number in
it is a *starting value*, to be measured on the Phase 5 plates.

**What they are.**

- **H, the phone push.** She holds the phone flat-on to the lens at chest height, then
  thrusts it straight toward the camera, so the screen grows from about a third of the
  frame width to over half, then holds. One push. The UI plays as on a held phone.
- **F, the finger interaction.** She holds the phone flat-on to the lens in one hand,
  still, as in S. The index finger of the other hand scrolls, taps or swipes on the
  green screen, and the inserted UI scrolls or switches in sync with the finger. The
  phone does not move; only the finger moves.

One segment carries one motion: one push, or one finger gesture. A push followed by a
scroll is two segments joined by a hard cut, until both types have measured keep rates
(§ 14.5).

**Rules for both.**

- **No line is spoken on camera.** The phone hides most of her face, or the face is out
  of frame; the mouth is not visible. The audio over the segment is the demo
  performance or the line of the next segment, laid by `character-assemble` (§ 7.4). This keeps
  lip sync, a gesture and a tracked screen out of one shot (§ 11.3).
- **Everything is in the first frame** (law 9). The phone is up and already green. For
  F, the other hand is already raised beside the phone, index finger extended, just off
  the screen edge. Nothing enters the frame mid-clip.
- **The green spec, the edge rule and the NO TEXT section of § 11.5 stay.** The green
  stays flat under and around the finger: no glow, no ripple, no icon, no reflection.
  The holding hand keeps to the sides and bottom of the phone.
- **Reading happens on a hold.** Nothing must be read during the push. The end hold of
  H and the final state of F follow the legibility budget (§ 11.6).

**How the screen starts and ends flat-on.**

- **F:** the phone is flat-on in every frame. The full static gate of § 11.10 applies.
- **H:** a start hold of at least 0.5 s and an end hold of at least 1 s, both flat-on and
  both passing the gate of § 11.10. During the push, the screen moves straight along
  the lens axis: it grows, it does not turn. Up to 8 degrees from square is allowed
  during the push; over that, regenerate.
- At gate A, an H segment has two approved stills: the keyframe (the start position)
  and an end still (the end position and screen size). The end still is the target for
  the prompt and the reviewer. It is attached as an end frame only on a model that takes
  one; in `templates.json` only Gemini Omni image-to-video states an end frame, and Omni
  takes no references (decision 6).

**How the corners are tracked.** Per frame, always. The `locked` mode of § 11.7 is
never used on an H push; on F it is allowed only while the finger is off the screen.
The current tracker is tuned for a still phone [repo `screen_comp.py`, which the copy starts from]: a 9-frame
median, then a smoother of 7 to 31 frames, a fit rejected when it is over 4 px from the
median, frames dropped when their green area is under a quarter of the largest, and a
quad over 90% of the frame rejected. On a push these are wrong: the quad moves fast, so
the median and the smoother lag behind it, and the start screen is often under a
quarter of the end area, so the start hold would be dropped. A **`motion` track mode**
is needed: a 3-frame median, a 5-frame smoother or none, the area filter taken against
the neighbouring frames, and the quad predicted from the last frames when a hand hides
an edge. For F, a finger across the screen can split the green into two regions, and
today only the largest region is fitted; the tracker must join every green region
inside the phone's hull before it fits the edges.

**How the finger stays in front.** The occlusion matte comes from the green key:
inside the screen quad, a pixel that is not green is the finger and stays in front of
the app. Today the matte has one more condition: a pixel that is not green and darker
than `dark_max` counts as screen, so the app covers the model's notch and shaded edges
[repo `screen_comp.py`, which the copy starts from]. A finger in shadow, a darker skin tone or a dark nail can fall
under that line, and the app would be painted over the finger. For F, the dark
exception applies only in the notch zone at the top of the screen and in a thin band
along its edges; everywhere else, not-green is the finger. The matte edge is softened
by about 1 px, and green spill is removed from the whole finger, not only from the mask
edge as today.

**How the UI motion is timed to the finger.**

- The screen recording does the same gesture on the real app (§ 11.4, step 7).
- **Contact and release** are read from the plate: for a tap, contact is the frame where
  the fingertip stops on the screen; for a scroll or a swipe, the first frame where the
  fingertip moves along the screen. The fingertip is the point of the finger matte
  furthest into the screen. Today `plate_t` is found by eye; a fingertip tracker is new
  work.
- **A tap or a screen switch** lands within 2 frames of contact, as in § 11.10.
- **A scroll or a swipe** moves the content with the fingertip. The time map of `beats`
  is enough only when the recording's speed matches the finger. The check: the content
  under the fingertip moves with it, within 5% of the screen height. When it does not,
  the UI must be **driven by the finger**: the long screenshot (a scroll) or the two
  stills (a swipe) are offset by the tracked fingertip, frame by frame, and after the
  release a scroll keeps the momentum the recording shows. That is a new source kind,
  `finger-driven`, and it is new work.

**Motion blur on the inserted screen.** In a push, the bezel and the hand are blurred,
and a sharp screen inside a blurred bezel reads as pasted. The inserted screen gets a
blur along its own motion, taken from the corner movement between frames, about half
the movement per frame (a 180-degree shutter). In F the phone is still; the UI keeps
the blur its recording already has, and the finger is the plate's own pixels. Today
`grade.blur` is one fixed blur for every frame; motion blur is new work.

**The prompt sentences**, pasted into `THE PHONE SCREEN` (§ 12), with the times filled:

- H: "She holds the phone at chest height, completely flat-on to the camera, the screen
  square to the lens and upright. At 0.5 s she pushes it straight toward the lens in
  one smooth movement, keeping it flat-on with no turn and no tilt, until the screen
  fills about 60% of the frame width at 1.3 s, then holds it completely still to the
  end. Her face stays mostly hidden behind the phone. She does not speak."
- F: "She holds the phone completely flat-on to the camera in her left hand, perfectly
  still. Her right hand is raised beside it from the first frame, index finger
  extended. At 1.0 s her index finger touches the lower middle of the screen and slides
  straight up about a third of the screen height in 0.6 s, then lifts off. The screen
  stays flat solid green under and around the finger: no glow, no ripple, no icon. The
  finger stays in front of the screen and never passes through the phone. She does not
  speak."

**The motion gates**, added to § 11.10:

| Gate | H | F |
|---|---|---|
| flat-on | start and end holds pass § 11.10; at most 8 degrees from square during the push | every frame passes § 11.10 |
| phone drift | not measured during the push; each hold is under 8% of screen width | under 8% of screen width in every frame |
| corner track | no corner jumps more than 2% of screen width from where its neighbours predict; corner sheet at the start hold, mid-push and the end hold | corner sheet at four times, one of them at contact |
| finger occlusion | n/a | no app pixel on the finger and no green on it, on a finger sheet at 400% at contact, mid-gesture and release |
| UI sync | n/a | a tap or a switch within 2 frames of contact; scrolled content within 5% of screen height of the fingertip |
| motion blur | the screen's blur matches the bezel's at the fastest frame, by eye | n/a |
| hands | five fingers; the holding hand keeps its grip | five fingers on each hand; the finger never passes through the phone; the holding hand keeps its grip |
| reading | OCR of the hero element on the end hold | OCR of the hero element on the final state |

**Failure and fix:**

| What you see | Cause | Fix, and the stage that owns it |
|---|---|---|
| the start of the push has no app on it | the tracker dropped the small start frames | P4: the `motion` track mode |
| the app lags behind the phone during the push | the median and the smoother are too long | P4: the `motion` track mode; do not smooth harder |
| the screen turns or tilts during the push | the push is written as a gesture, not as a straight move | P1: restate "straight toward the lens, flat-on"; over 8 degrees, regenerate |
| a sharp screen in a blurred phone | no motion blur on the insert | P4: motion blur from the corner movement |
| the app is painted over the finger | the finger is darker than `dark_max` | P4: the dark exception only in the notch zone and the edge band |
| a green fringe on the finger | spill on the finger, not only at the mask edge | P4: despill the whole finger matte |
| the screen glows or ripples where the finger touches | the model drew a touch effect into the green | P1: restate "flat solid green under the finger"; regenerate |
| the content slides under the finger | the recording's scroll speed differs from the finger | P4: the `finger-driven` source; or re-record the gesture slower |
| the app switches before or after the tap | `plate_t` is off | P4: re-measure contact; the fingertip tracker |
| the finger passes through the phone, or a sixth finger | a hand failure | P1: a simpler gesture (a tap before a scroll); regenerate |
| the hand enters from outside the frame | the hand was not in the first frame | P1: redo the keyframe with the hand raised beside the phone |

**What our tools cannot do yet.** None of these exist today; each is Phase 3 work, in the character copies
(§ 16), local and free:

- the `motion` track mode in `character/screen_comp.py` (today: a 9-frame median, a 7 to 31 frame
  smoother, frames under a quarter of the largest green area dropped, quads over 90% of
  the frame rejected);
- joining several green regions before the edge fit (today: the largest region only);
- the finger matte with the dark exception kept to the notch zone and the edge band, and
  despill on the whole finger (today: every dark not-green pixel counts as screen, and
  despill runs on the mask edge only);
- a fingertip tracker that finds contact and release (today: `plate_t` by eye);
- the `finger-driven` source kind, a long screenshot moved by the fingertip (today: a
  recording time-warped through `beats` only);
- motion blur from the corner movement (today: one fixed `grade.blur`);
- the motion gates in `character/qc.py` (today: a push would be read as a 100%+ drift and
  failed; there is no finger sheet and no UI sync check);
- an end frame together with references: no model in `templates.json` states both.

---

## 12. The segment prompt

A segment's `prompt.txt` is compiled from `creator.json`, the shot file and the video
shot (§ 15.3). It keeps the section order of the recreation stage 5 prompt [repo],
with three adoptions.

    opening look            one paragraph: vertical 9:16 phone video, the set, the light, the flaws by name
    REFERENCES              only with refs.json: one sentence per file, what it controls, what it does not
    STRUCTURE               shot count, exact cut times
    SUBJECT                 the identity lock, pasted; the outfit; the signature details; the counts as numbers
    SETTING                 the set lock, pasted; "no other location"
    ANIMALS/PROPS           fixed subjects with true size; each prop's owner
    SHOT n (a to b s)       action first, then the line in quotes with its delivery note; "End state: ..."
    THE PHONE SCREEN        only with insert.json: the green spec, the stability paragraph, the flat-on sentence (§ 11.5);
                            for H the push sentence replaces the stability paragraph; for F the finger sentence is added (§ 11.12)
    PERFORMANCE             on-camera speech with lip sync; anti-monotone language; the scripted imperfections
    AUDIO                   the voice reference binding; the room sounds as events; no music
    DIALOGUE                the frozen words
    CONSISTENCY             what cannot change between cuts: face, hair, outfit, props, counts, geography
    NO TEXT                 the base ban list, then the earned bans; always last

The adoptions: `REFERENCES` comes first, each file bound alone with its exclusions [SD,
Fekri]; every shot ends in a visible **end state** [SD]; `CONSISTENCY` and the bans go
last, because the start and the end of a prompt weigh most [Fekri].

Rules of the compile:

- Under 5,000 characters, counted with `wc -m` [repo rule 5]. Identity is carried by
  the references, so `SUBJECT` is the short lock, not the casting JSON.
- "She speaks every line on camera with lip sync" is stated in `PERFORMANCE`, in each
  shot that has a line, and in the bans ("no voice-over on a shot where her face is
  visible, no silent talking head") [Fekri].
- No generation parameters in the prompt; ratio and duration go through the template
  and `extensions` [SD; repo rule 6].
- A free **prompt lint** runs before any spend: no booster or glamour word; every
  reference bound alone; every shot has an end state; every visible hand has a job; no
  conflicting camera words; words per second within budget; the character count; the
  flat-on sentence present in every O, G and S prompt, and no word that angles the
  phone ("tilts the phone", "turns the screen"); the push sentence in every H prompt
  and the finger sentence in every F prompt, each with its times; no spoken line in an
  H or F segment.

**Skin and look clauses** live in the opening look, and their opposites in the bans
[Fekri]: "realistic skin texture, visible pores around the nose and cheeks, natural
slight unevenness, a soft sheen on the nose and forehead, no filter quality"; then
"no doll skin, no porcelain skin, no airbrushed skin, no skin blur, no glossy plastic
finish". Style is never a mood word: "cinematic" leaves the model free; "soft window
light, visible sensor grain, no colour grading" does not [SD].

**Seedance notes, for when it is the alternate** [SD]. These come from the Seedance
2.5 guide. The Seedance id in `templates.json` today is `seedance-2-fast-text-to-video`,
text-to-video only (decision 6); check each note on it before relying on it.

- Dialogue goes in braces, with the language, the accent, the delivery and the speaker
  named before the line: `Dialogue language: American English. She says in natural,
  conversational American English: {…}`. Sound effects go in angle brackets, one event
  each. Music goes in round brackets; `(No music)` is valid.
- A first frame is declared in the prompt (`@Image 1 is the first frame`), and the
  output ratio locks to that image. A first and a last frame must have the same ratio.
- An edit of an existing video inherits its ratio and its duration, within about 0.3 s.
  It cannot be trimmed or extended inside the edit. Set 9:16 on the first generation.
- A forward extension describes the boundary frame first and the new action second, and
  says the subject stays one continuous instance.
- Limits: 50 materials in total; 30 images; 10 videos and 10 audio clips, each kind 30 s
  combined. Stability falls as the count rises; 1 to 8 subject images is the stable
  range.
- When a reference video already carries the motion, do not describe the motion again;
  the two conflict.
- Timestamps give each event a time budget. They are not frame-accurate edit points.

---

## 13. Assembly, captions, upscale and the export pass

P5, `character-assemble`. Local ffmpeg, no cost. Input: `video.json` (§ 15.6).

1. **Trim.** Generations leave silent gaps at the head and tail [Vlad]. Cut each
   talking segment from 0.15 s before its first word to 0.2 s after its last, using
   word times from faster-whisper [repo `transcribe.sh`].
2. **Join.** Hard cuts only. A punch-in of about 10% when two talking segments meet
   (§ 10.6). No transitions, no generated bridges.
3. **Sound.** One loudness for all segments. The room tone under everything. A fade of
   20 to 40 ms at each join. The demo performance audio under R. No music in the file:
   sound choice belongs to posting, which is outside the pipeline.
4. **Captions.** Nothing is ever generated as text in the picture [Enzo; repo NO TEXT].
   Captions are burned in post, with one fixed spec so every video looks like it came
   from the same phone [Enzo]. [Enzo]'s spec is Arial bold, white, black outline, 4 to
   7 words per line, centred, on a 1080×1920 canvas, clear of the platform's interface
   at the top and the bottom. Ours is the house style of the slides: Helvetica Neue
   Bold, white, black outline, no box [repo `render`]. Three to six words per caption,
   timed by the word times, **spelled from the frozen script** (the transcript gives
   the time, the script gives the spelling). Kept clear of the hero element.
5. **The title overlay.** An on-screen title line is a separate overlay, not a
   caption. It is burned into the file only when the plan asks for it; otherwise the
   file has none. Posting is outside the pipeline.
6. **Upscale, once.** Generated segments arrive at 768p or 720p [repo `templates.json`].
   Each is scaled to 1080×1920 one time, with a plain filter (lanczos), before the
   insert is composited (§ 11.7) and before the join. No AI upscaler and no sharpening:
   sharpening brings back the over-sharp HDR look that de-slop removes [PC]. The real
   screen recording is the only layer that is truly 1080 wide, which is one more reason
   the composite is made after the upscale.
7. **The export pass** (§ 3, decision 11). 1080×1920, 30 fps, H.264. One intermediate
   encode at a phone-like bitrate, then the final encode. Never 4K: 4K reads as produced
   [Enzo]. No added film grain by default. On the first real use case in a consumer workspace, each video is also exported
   once with 2 to 3% grain, as the grain test of § 14.7; the user compares the two
   exports and decides. The purpose is that the file looks like it
   came from a phone and that all segments share one texture. It is not for hiding
   that the video is AI.

8. **After the pass**, the OCR test of § 11.6 runs again on the final file.

---

## 14. QC, approval, keep rate and cost

**14.1 Three gates, cheapest first.**

| Gate | When | Costs | Checks |
|---|---|---|---|
| A. storyboard | end of P1, before any video | nothing on the Codex path | the keyframes: is it her (against the anchors); does she look like an ad; is the room right or too tidy; is she holding what she should; hands counted; the phone size for O, G, S, H, F, and the phone flat-on to the lens (§ 11.5) [Fekri]; for H, the end still too; for F, the other hand already raised beside the phone (§ 11.12). Plus the prompt lint. The user approves the contact sheet; that approval will need an Atlas UI (decision 7), not designed here. |
| B. segment | P3, per generation | the generation already paid | the list below, then keep, reject, or regenerate this segment only |
| C. final | P6, the assembled file | nothing | the final list below; the user's approval by word |

**14.2 The segment checklist.** Measured by `character/qc.py` where it can be, by eye on the
contact sheet where it cannot [repo: never report a video as good without looking].

- **Identity:** face, hair and each signature detail match the anchors in every second;
  exactly one person; fixed subjects correct in count, look and true size.
- **Hands:** five fingers, nothing melting, each hand doing its job.
- **Mouth:** lip sync holds; teeth normal; the transcript matches the script word for
  word.
- **Eyes:** on the lens through each line; natural blinks.
- **Voice:** matches the voice reference; passes the natural-voice check of § 7.2
  (natural breaths, varied pauses, moving pitch with no 2 s window under 5 semitones,
  the room sound, no flat TTS cadence).
- **Motion:** hands move while she talks; pacing has its stumbles; no slow motion.
- **Set:** the same room, light direction and camera position as the plate; nothing
  hallucinated into shot.
- **Text:** none in the picture.
- **Cuts:** within tolerance of the times asked.
- **Phone segments:** the gates of § 11.10, first of all the flat-on gate; for H and
  F, the motion gates of § 11.12 too.

**14.3 The final checklist** [Enzo, Vlad]: face holds across every segment; outfit and
set hold across every segment; voice and room agree across every join; no join inside
a sentence; the app's strings are real and readable where they must be; captions match
the script and the house style; decision:
approve, reject, or regenerate one segment. The script has its own checks, in
`SCRIPT-LEARNINGS.md` § 11.

**14.4 Nothing is handed over without a person approving** [Enzo]. Here that is the user's
words in the conversation, recorded with a quote [repo: approval by word], in
`approval.json`.

**14.5 Expected keep rate.** The sources: 60 to 70% kept, 45 generations for 30 usable
ads [Vlad]; 23 approved and 6 rejected out of 49, the rest pending, at about $2.02 a
clip [Enzo]. Rejections are mostly hands, a face that drifted just enough to notice,
or a label gone wrong mid-clip. The JSON lowers them; it does not reach zero [Enzo].

*Planning values until we have our own ten per row:*

| What | Plan on | Why |
|---|---|---|
| keyframes (stills) | 1 kept in 4 | [Vlad]: generate four, keep the best |
| T segments | 60% | the low end of [Vlad]; a simple set |
| O plates | 50% | no face, but the green and stability gates |
| G and S plates | 35 to 40% | face or hand plus phone; the strictest gates |
| H plates | 30% | a fast move of the phone; tracking and blur gates on top of the static ones |
| F plates | 25% | two hands, a finger on the screen, occlusion and sync gates; the hardest plate |
| R and P | 100% | no generation |

A segment type under 40% after ten generations is not retried. The prompt, the set or
the model is changed. That is the stop rule.

**14.6 Cost, computed.** From the price in `scripts/character/models.json`; these are
computed figures, not charges [repo rule 8]. Model: MiniMax H3 Max reference-to-video
(`minimax-h3-max-reference-to-video`), **$0.08/s at 768p**, the default (the founder,
2026-10-02). The model takes 5 to 15 s only, so a segment planned shorter than 5 s is
generated at 5 s and trimmed at assembly; it costs 5 s. Supagen records **$0.20 for
every run** of the H3 Max text-to-video and image-to-video models, at 10 s and at 15 s
alike, which is less than $0.08 × 5 s; no run of the reference model exists yet (§ 17,
question 13). So the computed figure, $0.08 × seconds, is the higher of the two, and the
figures below use it.

A 20 s video in four segments: T 4 s + T 6 s + R 6 s + T 4 s, with a 6 s demo
performance for the voice under R. In a set of ten videos, the first T is unique to
each video and the rest is shared (§ 10.5). This is a planning example, not a test.

| Item | Generated | One run, $0.08/s | At the keep rate |
|---|---|---|---|
| the T segment unique to a video | 5 s (trimmed to 4) | $0.40 | $0.67 at 60% |
| two shared T segments | 5 s + 5 s | $0.80 | $1.33 |
| demo performance (shared) | 6 s | $0.48 | $0.80 |
| R cutaway | none | $0.00 | $0.00 |
| **ten videos that share the rest** | | | **$8.80, about $0.88 per video** |
| the same on the second entry, MiniMax H3 at $0.06/s | | | $6.60, about $0.66 per video (or $14.08 at its $0.65 a run) |
| an O plate on MiniMax H3 Max text-to-video | | not computed: that model is not in `models.json` | |

A video with no app insertion has no R, P or plate segments; its cost is its T
segments only. For comparison, the sources report $2.02 per clip [Enzo], four clips
for $2.67 [Jason], and $6.93 for one 30 s generation [Fekri]. Every generation still
needs its own yes [repo rule 9].

**14.7 What is measured and written back.** Per generated segment, `approval.json`
keeps the decision, the failure class, the model and the set. From these: the keep rate
per segment type (it replaces the planning values of § 14.5), the usable rate per set
(written into the handle's `world.json`, § 8.4), and the rows of the failure ledger
(`pipeline/character/model-failures.md`, the user's file, § 9.3). A
production variable is tested alone: one model, one set, one grade or one grain
setting changes, and the script stays the same [Ultra: one axis at a time].

**The grain test** (decision 11), planned on the first real use case in a consumer workspace. Every video of it is
exported twice from the same segments: the default (no added grain) and a variant with
2 to 3% grain; nothing else changes. The user looks at both and decides. The default
changes only if the user picks the grain variant. No generation is paid for the test.

---

## 15. The JSON templates

Values in angle brackets are to be filled per character at casting, from her `HANDLE.md`
and her approved pictures. Nothing in these templates belongs to a real handle.

### 15.1 The creator file — `apps/<slug>/handles/<handle>/characters/<character>/creator.json`

Paths inside it are relative to the handle's folder, `apps/<slug>/handles/<handle>/`.

```json
{
  "character_id": "<character>",
  "handle": "<handle>",
  "handle_kind": "persona (the handle's one character and its identity) | multi-character",
  "identity_character": "<true when this character is the handle's identity: its hero is references/face.png>",
  "app": "<slug>",
  "version": "v<n>",
  "version_note": "<what changed from the previous version, and the user's approval with the date>",
  "status": "casting | identity | video-setup | live | retired",
  "image_model": "codex-image (the Codex image tool, for every picture of this character; decision 4)",
  "identity_lock": {
    "age_appearance": "<age band, from the claim the videos make>",
    "face": "<shape, jaw, cheekbones: written from the hero picture, visible traits only>",
    "eyes": "<colour, shape, from the picture>",
    "brows": "<from the picture>",
    "skin": "<tone and undertone>, visible pores on nose and cheeks, <make-up>",
    "hair": "<length, texture, colour, how it is worn>"
  },
  "signature_details": [
    "<chosen at casting, with the user; at most three; each at least 1% of frame height in a chest-up shot; only what the approved face shows or the user adds>"
  ],
  "fixed_subjects": ["<fixed-subject-id from world.json: what always comes with her>"],
  "voice_profile": {
    "tone": "<pitch and warmth>",
    "pace": "<words per second, and how sentences join>",
    "accent": "<one accent>",
    "verbal_habits": ["<one opener she uses, once per video>"],
    "never_says": ["guys", "game changer", "obsessed", "you need this"],
    "not_wanted": ["announcer tone", "narrator delivery", "rising question tone on statements", "over-articulated consonants"],
    "voice_reference": {
      "file": "characters/<character>/references/voice/voice-reference.mp3",
      "origin": "research | own-generation (fallback only)",
      "source": { "post": "<URL of the post>", "creator_handle": "<handle>", "platform": "tiktok | instagram", "found_in": "<the research file that lists the post>", "cut_s": ["<start>", "<end>"] },
      "candidates_heard": ["<the other clips the user heard>"],
      "approved": "<the user's words and the date>",
      "natural_voice_check": "<date; the first approved generation passed: natural breaths, varied pauses, moving pitch, room sound, no flat TTS cadence>"
    }
  },
  "camera_habits": {
    "device": "front-facing phone camera",
    "lens": "24-28mm equivalent, mild wide-angle distortion",
    "distance": "arm's length, or propped at eye level",
    "height": "eye level",
    "processing": "normal phone processing, true colours, no beauty filter",
    "flaws": ["subtle micro-shake", "slight off-centre tilt", "one autofocus hunt"]
  },
  "sets": ["<set-id from world.json: a room she can be in>"],
  "outfits": [
    { "id": "<outfit-id>", "what": "<the clothes, colours and how the hair is worn>", "reference": "characters/<character>/references/anchors/outfits/<outfit-id>.png" }
  ],
  "anchors": {
    "hero": "references/face.png (the identity character) | characters/<character>/references/anchors/hero.png",
    "front": "characters/<character>/references/anchors/front.png",
    "three_quarter_left": "characters/<character>/references/anchors/three-quarter-left.png",
    "three_quarter_right": "characters/<character>/references/anchors/three-quarter-right.png",
    "side": "characters/<character>/references/anchors/side.png",
    "back_shoulder": "characters/<character>/references/anchors/back-shoulder.png",
    "expressions": "characters/<character>/references/anchors/expressions.png",
    "hands": "characters/<character>/references/anchors/hands.png",
    "approved": ["<anchor name, the user's words and the date>"]
  },
  "casting": {
    "locked_prompt": "characters/<character>/references/casting/<character>_locked_v<n>.json",
    "vibe_references": ["<optional, strongly recommended (§ 4.1). One or more: a picture from the user (Pinterest is fine) or a frame of a persona handle proposed from the competitor and niche research and picked by the user, each with its source, saved in references/casting/; used only to write the locked JSON, never attached to the image tool. Or 'none: skipped by the user', or 'none: written from the approved face' (§ 4.6)>"],
    "hero_candidates": ["characters/<character>/references/casting/candidate-<n>.png"],
    "hero_approved": "<the user's words and the date>",
    "diverged_axes": ["<at least three identity axes changed from the vibe references>"],
    "twenty_generation_gate": "<date passed>"
  },
  "never_change": ["face", "hair", "signature_details", "skin texture", "voice_profile", "fixed_subjects", "camera_habits"],
  "identity_negative": ["different face", "<shorter, lighter or differently coloured hair, as the lock needs>", "missing signature detail", "age change", "make-up change", "second person", "<a fixed subject's count broken, e.g. a second pet>"],
  "disclosure": { "fictional_person": true }
}
```

### 15.2 The shot file — `pipeline/character/<video>/shots/<nn>-<type>.json`

```json
{
  "shot_id": "<video>.01-t",
  "character_ref": "<character>@v<n>",
  "character_file": "apps/<slug>/handles/<handle>/characters/<character>/creator.json",
  "segment_type": "T | O | G | S | H | F",
  "script_lines": "<ids of the frozen script lines this segment speaks; 'demo-vo' for a demo performance>",
  "set_ref": "<set-id>",
  "outfit_ref": "<outfit-id>",
  "framing": "medium chest-up, phone propped at eye level, face fills most of the frame",
  "action": "<one action, written as movement; ends in a visible state>",
  "hands": { "left": "<job and place, or 'out of frame'>", "right": "<job and place, or 'out of frame'>" },
  "props": ["<each prop, and whose hand it is in>"],
  "fixed_subjects_in_shot": ["<fixed-subject-id>"],
  "phone": { "present": false, "screen": "none | green", "angle": "flat-on: screen plane square to the lens, upright, no tilt, no perspective (hard rule)", "share_of_frame_width": null, "gesture_rung": null },
  "phone_motion": {
    "kind": "none | push | finger",
    "push": { "start_hold_s": [0.0, 0.5], "end_hold_s": [1.3, 4.0], "start_share_of_frame_width": 0.33, "end_share_of_frame_width": 0.6, "end_still": "keyframes/<nn>-h-end.png", "max_deg_from_square_during_push": 8 },
    "finger": { "hand": "right", "finger": "index", "gesture": "tap | scroll-up | scroll-down | swipe-left | swipe-right", "start_place": "raised beside the phone, off the screen edge", "contact_s": 1.0, "release_s": 1.6, "travel": "about a third of the screen height" },
    "on_camera_line": "none"
  },
  "keyframe": "pipeline/character/<video>/keyframes/01-t.png",
  "keyframe_approved": "<the user's words and the date>",
  "priority_order": [
    "identity from creator file and anchors",
    "fixed subjects: count, look, true size",
    "camera habits",
    "phone and green screen, when present",
    "requested outfit only",
    "requested set only",
    "the action"
  ],
  "negative_prompt": {
    "identity": "<from creator.json identity_negative>",
    "slop": ["plastic skin", "airbrushed skin", "beauty filter", "studio lighting", "ring light", "cinematic grade", "perfectly tidy room", "extra fingers", "fused fingers", "text", "captions", "watermark", "ui overlays"],
    "earned": ["<at most five, each with its row in pipeline/character/model-failures.md>"]
  }
}
```

Added in Phase 2: `phone.screen_id` (the `SCREENS.md` row of an O, G, S, H or F
segment), `keyframe_prompt`, `keyframe_references` (hero, outfit anchor, set plate, each
fixed subject in the shot; each with a `kind`), `keyframe_end_prompt` (H only), and a
`kind` on every entry of `video.references`. `docs/character/shot.example.json` has them.

### 15.3 The video shot — the `video` block of the same shot file; compiled to `prompt.txt`

```json
{
  "video": {
    "segment_project": "<video>.01-t",
    "flow": "referenced | complex | complex+refs",
    "model": "<slug in scripts/character/models.json; default minimax-h3-max-reference-to-video; the active version must match>",
    "duration_seconds": 5,
    "trim_to_seconds": "<the planned length when it is under the model's 5 s minimum, else null>",
    "start_frame": "keyframes/01-t.png",
    "references": [
      { "file": "keyframes/01-t.png", "role": "the first frame: composition, pose, set, light", "not": "nothing else" },
      { "file": "references/face.png", "role": "the character's face and hair (characters/<character>/references/anchors/hero.png for a character that is not the handle's identity)", "not": "its background" },
      { "file": "characters/<character>/references/voice/voice-reference.mp3", "role": "the voice only: tone, pitch, accent, pace", "not": "its words" }
    ],
    "camera": "phone propped at eye level, subtle micro-shake, no cuts",
    "phone_angle": "<O, G, S only: the flat-on sentence of § 11.5, pasted>",
    "beats": [
      { "t": "0.0-1.5", "action": "<physical action first>", "line": null, "end_state": "<what is visible>" },
      { "t": "1.5-4.0", "action": "<small action under the line>", "line": "<the frozen words>", "delivery": "<which word lifts, where it slows, the breath>", "end_state": "<what is visible>" }
    ],
    "speech": "on camera, lips in sync, eyes on the lens",
    "audio": { "room_events": ["<each sound as a physical event>"], "music": "none", "subtitles": "none" },
    "keep_fixed": ["face", "hair", "signature details", "outfit", "set layout", "light direction", "camera position", "exactly one person"],
    "word_count": 12,
    "words_per_second_max": 3.75
  }
}
```

### 15.4 The voice — the voice-over block of `video.json`

The standing profile is in `creator.json` (§ 15.1). This block is the per-video job.

```json
{
  "voiceover": {
    "character_ref": "<character>@v<n>",
    "script_ref": "<the frozen script of the video, or of the recording>",
    "source": "in-model | tts-fallback",
    "in_model": {
      "segment_project": "<character>-shared.<screen-id>-vo",
      "note": "the demo performance: she says the demo lines on camera in the set; the audio goes under R, the picture into P"
    },
    "delivery": "conversational; pace differs by line, as the delivery notes say",
    "imperfections": ["one small breath before the line that must land", "one restart", "no studio compression"],
    "room_tone": { "set": "<set-id>", "file": "characters/<character>/references/voice/room-tone-<set-id>.wav", "level_db": -45 },
    "fallback_rules": ["only where no face is on screen", "same room tone bed", "small-room reverb", "never a TTS clone of a real person's voice"],
    "checks": { "pitch_spread_semitones_min_per_2s": 5, "transcript_matches_script": true, "natural_voice": "natural breaths, varied pauses, moving pitch, room sound, no flat TTS cadence" }
  }
}
```

### 15.5 The app-insertion spec — `insert.json`, extended

Every existing key keeps its meaning (`docs/insert.example.json`). The new keys are
optional, so an old file still runs.

```json
{
  "mode": "over-shoulder | in-hand | show-to-camera | push | finger",
  "screen_id": "<row id in apps/<slug>/screens/SCREENS.md>",
  "source": "apps/<slug>/screens/<id>.mp4",
  "source_kind": "recording | still | finger-driven",
  "plate_window": [0.0, 4.0],
  "key": { "color": [0, 177, 64], "hue_tol": 26, "sat_min": 55, "val_min": 35, "dark_max": 105 },
  "beats": [
    { "app_t": 0.00, "plate_t": 0.00, "label": "start", "region": null },
    { "app_t": 1.20, "plate_t": 1.50, "label": "tap", "region": "lower third, centre" },
    { "app_t": 3.60, "plate_t": 4.00, "label": "end", "region": null }
  ],
  "gesture_rung": 2,
  "hero": {
    "text": "<the one string the viewer must read, exactly as the app shows it>",
    "rect_source_px": [0, 0, 0, 0],
    "needs": "recognition | large type | body text"
  },
  "legibility": { "min_screen_width_px_at_1080": 280, "ocr_must_read_hero": false },
  "track": { "mode": "per-frame | locked | motion", "locked_if_drift_pct_under": 2, "motion": { "median_frames": 3, "smooth_frames": 5, "area_filter": "against neighbours", "join_green_regions": true } },
  "occlusion": { "matte": "green key: not green inside the quad is the finger", "dark_exception": "notch zone and edge band only", "edge_soften_px": 1, "despill": "whole finger" },
  "finger": { "contact_frame": null, "release_frame": null, "tip_track": "the point of the finger matte furthest into the screen", "scroll_follow_tolerance_pct_screen_h": 5 },
  "motion_blur": { "on": false, "from": "corner movement between frames", "shutter_deg": 180 },
  "composite_resolution": "1080x1920",
  "patches": [],
  "grade": { "blur": 0.5, "brightness": 0.0, "contrast": 1.04, "saturation": 1.0, "reflection": 0.05, "noise": 5, "black_lift": 0.03 },
  "smooth": 7,
  "gates": {
    "green_g_std_max": 10,
    "drift_pct_max": 8,
    "flat_on": { "opposite_edge_diff_pct_max": 3, "corner_deg_from_90_max": 3, "long_edge_deg_from_vertical_max": 3 },
    "strict_green_pixels_in_final": 0,
    "tap_alignment_frames_max": 2,
    "motion": { "push_max_deg_from_square": 8, "corner_jump_pct_screen_w_max": 2, "finger_sheet": "no app pixel on the finger, no green on it", "scroll_follow_pct_screen_h_max": 5 }
  }
}
```

### 15.6 The edit — `pipeline/character/<video>/video.json`

Written by P1 from the locked plan (§ 2.5); nothing can be assembled without it. The
script-side fields of a video come from the plan, never from production.

```json
{
  "video_id": "<video>",
  "characters": ["<character>@v<n>"],
  "plan_ref": "pipeline/character/<video>/plan.json",
  "app": "<slug>",
  "handle": "<handle>",
  "dimension": "9:16",
  "app_insertion": "<true | false, from the plan; false means no O, G, S, H, F, R or P segment>",
  "script_ref": "<the frozen script; the user's words and the date>",
  "outfit_ref": "<outfit-id>",
  "segments": [
    { "n": 1, "type": "T", "project": "<video>.01-t", "script_lines": "<ids>", "shared": false },
    { "n": 2, "type": "T", "project": "<character>-shared.02-t", "script_lines": "<ids>", "shared": true, "punch_in": 1.10 },
    { "n": 3, "type": "R", "screen_id": "<id>", "crop": "9:16 around hero", "punch_in_to_hero": 1.25, "audio_from": "<character>-shared.<screen-id>-vo", "shared": true },
    { "n": 4, "type": "T", "project": "<character>-shared.04-t", "script_lines": "<ids>", "shared": true }
  ],
  "joins": { "cut": "hard", "audio_fade_ms": 30, "on_sentence_end": true },
  "sound": { "loudness": "one level for all segments", "room_tone": "characters/<character>/references/voice/room-tone-<set-id>.wav", "music": "none in file" },
  "captions": { "style": "house: Helvetica Neue Bold, white, black outline", "words_per_caption": "3-6", "text_source": "the frozen script" },
  "title_overlay": { "burn": "<true only when the plan asks for it>", "text": "<the line, or null>" },
  "export": { "upscale": "lanczos, once, to 1080x1920", "resolution": "1080x1920", "fps": 30, "intermediate_encode": true, "film_grain": false, "grain_test_variant": "<the first real use case only: true, a second export with 2 to 3% grain (§ 14.7)>" }
}
```

### 15.7 The approval check — `pipeline/character/<video>/approval.json`

```json
{
  "video_id": "<video>",
  "gate_a_storyboard": {
    "keyframes_match_anchors": null,
    "reads_as_camera_roll_not_ad": null,
    "hands_counted": null,
    "phone_size": null,
    "phone_flat_on_to_lens": null,
    "prompt_lint": null,
    "decision": "approve | redo keyframe <n>",
    "words": "<the user's words>"
  },
  "gate_b_segments": [
    {
      "project": "<video>.01-t",
      "file": "<the mp4>",
      "identity": "face, hair and signature details match the creator file in every second",
      "fixed_subjects": "count, look and true size",
      "hands": "five fingers, nothing melting",
      "mouth": "lip sync holds; transcript matches the script",
      "voice": "matches the voice reference; natural-voice check passes: natural breaths, varied pauses, pitch spread passes, room sound, no flat TTS cadence",
      "set": "same room, light and camera position; nothing hallucinated",
      "text_in_picture": "none",
      "cuts": "within tolerance",
      "insert_gates": "see insert.json gates, the flat-on gate first; n/a without a phone",
      "decision": "approve | reject | regenerate this segment only",
      "failure_class": "<for a reject: the ledger row it adds>",
      "set_id": "<set-id>"
    }
  ],
  "gate_c_final": {
    "face_holds_across_segments": null,
    "outfit_and_set_hold_across_segments": null,
    "voice_and_room_agree_across_joins": null,
    "no_join_inside_a_sentence": null,
    "ui_real_and_readable": "OCR of the hero element passes on the final file; n/a without app insertion",
    "captions": "match the frozen script and the house style",
    "decision": "approve | reject | regenerate segment <n>",
    "words": "<the user's words, quoted, with the date>"
  }
}
```

### 15.8 The world — `apps/<slug>/handles/<handle>/world.json`

The handle-level things that must stay the same across slides and videos, shared by
the handle's characters (§ 2.6). A place decided 2026-10-02; its rules are expanded
later. Paths are relative to the handle's folder.

```json
{
  "handle": "<handle>",
  "fixed_subjects": [
    {
      "id": "<fixed-subject-id>",
      "what": "<a pet, a product always held: visible traits only>",
      "reference": "references/subject-<name>.png",
      "count": "<exactly one>",
      "true_size": "<its size in proportion to a person and the furniture>",
      "approved": "<the user's words and the date>"
    }
  ],
  "sets": [
    {
      "id": "<set-id>",
      "plate": "references/sets/<set-id>.png",
      "room": "<the room, its furniture and what is behind the person>",
      "light": "<source, direction, colour temperature>",
      "camera_position": "<where the phone sits>",
      "objects": ["<three named objects that are always there>"],
      "usable_rate": null,
      "approved": "<the user's words and the date>"
    }
  ]
}
```

---

## 16. The phased plan

Each phase ends in something the founder can look at. Each phase ships as skills,
scripts and orchestrator updates in `template/`; this file and its sources stay outside
`template/`. **No phase changes the recreation pipeline**: its skills, its stages and
its scripts stay as they are (§ 2). Phases 0 to 4 cost nothing but the Codex plan.
Phase 5 is the first API spend: under $2 in total, and a yes per run.

**Phase 0 — the skeleton (no generation, no spend).**
`scripts/character/`: the copies of `generate.sh`, `qc.py`, `screen_comp.py` and the
state logic of `state.py`, renamed and pointed at `pipeline/character/` and
`scripts/character/models.json`; nothing in them changes behaviour yet.
`models.json` is already built (decision 6; § 17, questions 10 and 13): the copies read it. The JSON
templates of § 15 in `template/docs/`, and the failure ledger (seeded from § 9.4; since
2026-10-02 the user's file, § 9.3). Done when: the copies run on an old segment exactly as the
recreation scripts do, and the recreation scripts are byte-for-byte unchanged.

**Built 2026-10-02** (branch `ai-ugc-character-pipeline`):
- `scripts/character/generate.sh <video> <segment>`: the segment folder
  `pipeline/character/<video>/segments/<segment>/` (`prompt.txt`, `refs.json`,
  `generated/`), the model from `pipeline/character/state.json`, the limits and price
  from `models.json`, the default template `ugc-character`. New: it refuses a model not
  in `models.json` and a duration under the model's minimum, and it prints the trim
  length. The `refs.json` gate is the recreation one, unchanged until Phase 2.
- `scripts/character/qc.py <video> <segment>` and `scripts/character/screen_comp.py`:
  the recreation code, with only the paths changed.
- `scripts/character/state.py`: the state logic only (`init`, `set`, `note`, `cost`,
  `show`, `videos`, `model`), stages P1 to P6, `--app-insertion yes|no` (with `no`,
  P4 shows as n/a). `model set` with less than the minimum records the minimum and
  `trim_to_s`.
- `docs/character/`: `plan.example.json` (the locked plan of § 2.5, written by hand for
  the first video), `creator.example.json` (§ 15.1), `shot.example.json` (§ 15.2 with
  the `video` block of § 15.3), `video.example.json` (§ 15.6 with the `voiceover`
  block of § 15.4), `insert.example.json` (§ 15.5), `approval.example.json` (§ 15.7).
- The failure ledger: § 9.4 as the seed, and an empty table for
  `minimax-h3-reference-to-video`, first in `docs/`. Later on 2026-10-02 the default
  became `minimax-h3-max-reference-to-video`: it has its own empty table, `models.json`
  has both entries, and `generate.sh` refuses a `refs.json` with more pictures than the
  model takes. Then the ledger moved to the user's `pipeline/character/model-failures.md`
  (written once), and the kit's table to the managed `docs/character-model-known.md`
  (§ 9.3, § 17 question 16).
- `pipeline/character/`: the empty folder the installer makes.
- Evidence: on an old app-insertion plate, the copies and the recreation scripts gave
  the same `qc.py` report, the same contact sheet and a byte-identical composite (same
  checksum, with the grade noise seeded the same); the same model selection, limits,
  cost line and `refs.json` gate. Not in Phase 0: a composite wrapper, `assemble.sh`
  and `lint_prompt.py` (Phases 3 and 4), and the Supagen template `ugc-character`
  (created later on 2026-10-02, § 17 question 13).

**Phase 1 — part A, character definition, through the one identity process (Codex
plan only).** Decided 2026-10-02: `persona-identity` is the process (§ 2, § 4.9).
- `persona-identity`, rewritten from "listed, minimal" to the method of § 4 to § 6, in
  four modes: **new identity** (the identity half: the brief from `## Persona`, the vibe
  references, the locked JSON with the de-slop and divergence checks, four candidates,
  the hero approved as `references/face.png`, the fixed subjects, the style photo, then
  the profile picture at `handles` step 4); **from an existing face** (§ 4.6, the
  migration of § 4.9); **video half** (the anchors by image-to-image, the set plates,
  the signature details proposed and approved, `world.json`, the twenty-generation
  gate); **add a character or a version** (§ 2.6). It writes `creator.json`, the
  versions, `world.json` and the `## Characters` table in `HANDLE.md`. The Codex check
  and the bridge are the ones the skill already uses.
- `handles` steps 3 and 4 name the new identity half; the files and the table they
  write do not change.
- `character-voice`: the **voice reference setup** (§ 7.2), the clips from the
  research, cut clean, heard and approved by the user, and the natural-voice check with
  `scripts/character/qc.py` on the first approved talking generation.
- Templates: `docs/character/creator.example.json` with handle-relative paths, and
  `docs/character/world.example.json`.

Done when: one character is live, at `v1`, with an approved voice reference; and a new
slideshow handle gets the same `references/` files and table as before.

**Phase 2 — P1, the shots and the storyboard gate (Codex plan only).**
`character-shots`: reads the locked plan (§ 2.5) and the pinned character, cuts the
segments (§ 10), writes the shot files and `video.json`, renders the keyframes, runs
gate A and the prompt lint (`scripts/character/lint_prompt.py`, with the flat-on
check). The storyboard approval runs in the conversation until the Atlas UI of the video
pipeline exists; that UI is designed later, for the whole video pipeline (decision 7).
The orchestrator section of § 2.4 ships in `template/AGENTS.md` in this phase, with
`character-generate`, not before. Done when: one video has an approved storyboard,
from a hand-written locked plan (the planning system does not exist yet).

**Built 2026-10-02** (branch `ai-ugc-character-pipeline`), on the founder's word: "Let's
go ahead with phase two building. And once it is ready by the time will have something
from our local organic factory for you to test on."
- `character-shots` (P1): the plan and character check, the cut rules, the shot files
  and `video.json`, the keyframes, the prompt order with the fixed sentences pasted in
  (the stability paragraph, the flat-on sentence, the H and F sentences), the lint, and
  gate A by word into `approval.json`.
- `character-generate` (P2): one segment per run, a yes per run, `ALLOW_REFS=1` per
  referenced run; the active version and the selected length change together.
- `scripts/character/shots.py`: `check` (the plan is approved, 9:16, `app_insertion` a
  boolean, no app beat without app insertion, each screen in `SCREENS.md`, the pins
  resolve to a creator file at `video-setup` or `live`, the set, the outfit, the hero, the
  anchors and the fixed subjects exist; then `state.py init` with the plan's
  `app_insertion`), `validate` (`video.json` and the shot files against the plan: the
  types, no app type without app insertion, 5 to 15 s generated and 3 s or more planned,
  the lines in order and all carried, 15 words per 4 s, no line in H or F, a job for each
  hand, the phone of a phone segment, the reference kinds and the 4-picture limit, a
  keyframe reference on every segment, the voice on every talking one), `refs` (writes
  `refs.json`, and a first `insert.json` for a phone segment), `job` and `verify` (the
  keyframes, 1080x1920), `storyboard` (`keyframes/storyboard.jpg`).
- `scripts/character/keyframes.sh`: the Codex bridge of `codex-images.sh`, for keyframes.
- `scripts/character/lint_prompt.py`: the checks of § 12, plus the shot times within the
  generated length and the reference-picture limit.
- `generate.sh`, before any cost: gate A approved in `approval.json`; every pinned
  character `live`; the segment planned at the selected length; the reference kinds.
- `template/AGENTS.md` and `CLAUDE.md`: the character pipeline section (§ 2.4).
- Tested in the scratchpad only, with a hand-written plan and a scratch character whose
  pictures were plain placeholders (only the keyframes were made by Codex): a plan with
  no app insertion (two T segments) and one with app insertion (T, G, H and an R); each
  check refused a broken copy (an app beat without app insertion, a 4 s generation, a
  hand with no job, a screen as a reference, six pictures, a G segment without app
  insertion, a missing screen list); the lint found a booster word, a missing end state,
  a missing flat-on sentence, a word that angles the phone, a spoken line in H and shot
  times past the length; `generate.sh` stopped at each gate and, with all passed, printed
  $0.40 and refused without `CONFIRM=1`. No video was generated and nothing was spent.
- **Not done:** the "done when" of this phase (one video with an approved storyboard)
  needs a real character and the user's approval: the founder's first test from Organic
  Factory. The `ugc-character` template has only the 5 s version; a segment at another
  length needs its own version, created over MCP before its run.

**Phase 3 — the insertion upgrades in the character copy (local, free).**
The `screens` skill and `apps/<slug>/screens/SCREENS.md`. In
`scripts/character/screen_comp.py`: composite at 1080, source scale from the quad, the
source-width fix, the `still` source kind, the `locked` track mode, the proposed grade;
for the motion shots (§ 11.12) the `motion` track mode, the join of several green
regions, the finger matte with the dark exception kept to the notch zone and the edge
band, despill on the whole finger, the fingertip tracker, the `finger-driven` source
kind and motion blur. In `scripts/character/qc.py`: the flat-on gate, the strict-green
count, the corner sheet, the OCR test, the motion gates, the finger sheet and the UI
sync check. All can be developed against plates already on disk; the motion work is
proven only on the Phase 5 motion plate (run 3). Done when: an old plate passes the new gates,
or fails them with a clear reason.

**Phase 4 — P5 and P6, assembly and delivery (local, free).**
`character-assemble` and `scripts/character/assemble.sh`: trim, upscale, join, punch-in,
loudness, room tone, R and P building, captions, the export pass with its optional grain
variant, the final OCR. `character-deliver`: gate C and the finished file in `final/`, where the pipeline
ends. Done
when: segments already on disk assemble into one file from a `video.json`.

**Phase 5 — the small paid test (under $2 in total; each run needs a yes).**
The founder, 2026-10-02: "We can test on small video portions and the real test can
happen on an actual use case when we adopt this in my organic factory." So this phase
tests small portions only. The full test, the failure census of § 9.5 and the first
set of videos happen later, on the first real use case in a consumer workspace.

**Sized to the price.** The default model is MiniMax H3 Max reference-to-video at
**$0.08/s** (§ 14.6). It refuses less than 5 s, so every run here is **one 5 s clip,
9:16, 768p, $0.40**, with at most four reference pictures (§ 10.4). Supagen records
$0.20 a run for the H3 Max models it has run so far, so $0.40 is the higher figure and
the plan uses it. The plan holds at most **three runs**:

| Run | What it tests | Segment | Computed, $0.08/s |
|---|---|---|---|
| 1 | identity from the hero and one anchor, lip sync, the sound track, and the natural-voice check of § 7.2 with the approved voice reference | T, 5 s | $0.40 |
| 2 | flat green, flat-on to the lens, with a face reference: the flat-on gate | G, 5 s | $0.40 |
| 3 | the motion shot of § 11.12, a finger on the screen: the motion gates | F, 5 s; only after the Phase 3 motion work exists | $0.40 |
| **Total** | | | **$1.20** |

Rules: no retry inside the budget; a failed run is a finding for the failure ledger,
not a reason to pay again. Runs 2 and 3 are for app insertion; a user whose plans have
no app insertion runs run 1 only ($0.40). **The first run also settles three open
points** (§ 17, question 13): whether the model gives a sound track (if it gives none,
run 1 cannot test the voice; stop and ask before runs 2 and 3), the real output length,
and the billing (compare the cost Supagen records with the charge on the provider
account). After the billing is settled, one more 5 s run that repeats run 1 for the
voice check still fits under $2 ($1.60); if the charge is $0.20 a run, up to nine runs
fit ($1.80). The second entry, MiniMax H3 reference-to-video, and the alternate models
are not tested in this phase.

**Phase 6 — measured numbers.**
From the first real use case in a consumer workspace: set usable rates are written back into the handle's `world.json`, keep rates into each
character's `creator.json` (as a new version, § 2.6), and § 14.5 is replaced by measured numbers. Future work: a
fallback on the Supagen image generation models, for when the Codex image tool refuses
or fails a picture (decision 4). Every phase is written for the kit: no app, handle or
character of a user's workspace is named in any skill, script or template.

**Later, a separate system.** The video planning system (§ 2) that writes the locked
plan. Not designed here; `SCRIPT-LEARNINGS.md` is its holding file.

---

## 17. Open production questions for the founder

Questions about the script are in `SCRIPT-LEARNINGS.md` § 16.

1. **References for character videos. Decided 2026-10-01: yes.** "Reference is any
   day better." In the character pipeline a segment may carry `refs.json` for the
   character's anchors, the keyframe, a set plate and the voice reference, as the
   standard mode. The ban on any app UI, screenshot or screen recording as a reference
   stays. Recreation rule 1 is not changed; the character pipeline gets its own section
   of `template/AGENTS.md`, a planned change that ships with its skills (§ 2.4, § 16
   Phase 2).
2. **The character. Decided 2026-10-01: chosen per character at casting.** The method
   names no character. Each user casts her own (§ 4), or writes the creator file from a
   face already approved in her handle (§ 4.6). Whether her fixed subjects are in every
   video is set in her creator file.
3. **Signature details. Decided 2026-10-01: chosen per character at casting.** They are not
   decided for any named character here. `persona-identity` proposes two or three (a necklace, a hair
   clip, a nail colour) and the user approves them; they are then permanent (§ 5.1).
4. **The voice reference. Decided 2026-10-01.** The voice reference is a required
   setup step per character, done by the agent with the user before her first AI UGC
   video, from real creator clips found in the niche and competitor research, with the
   user's approval (decision 3, § 7.2). A clip from our own generation is a fallback
   only. A voice clip a handle already uses is one candidate in its setup; it is kept
   only if the user approves it there and its source is recorded.
5. **The dimension. Decided 2026-10-02: 9:16 is the default for now.** More sizes are
   added later, when needed. The plan's `format` names the size (§ 2.5).
6. **The AI-generated label. Decided 2026-10-02: out of scope.** Posting is outside the
   pipeline; its job ends at the finished file (§ 2). The pipeline sets no label and
   has no posting step.
7. **Grain. Decided 2026-10-01: test it.** The default stays none (the kit's handle
   style). A 2 to 3% grain variant is a planned test on the first real use case in a
   consumer workspace; the user looks at
   the output and decides (decision 11, § 14.7).
8. **The screen recordings. Decided 2026-10-02: the user provides them.** Not the
   pipeline's concern (§ 11.4). Not every video inserts the app: `app_insertion` is a
   per-plan option, and a video with no app segment skips the screen stages (§ 2, § 2.5).
9. **Money. Decided 2026-10-02: the whole paid test phase stays under $2.** Small
   portions only: at most three 5 s runs, $1.20 at $0.08/s on MiniMax H3 Max
   reference-to-video (§ 16 Phase 5). The real test happens later, on the first real use case in a consumer
   workspace. Each run still needs its own yes. The image part is decided 2026-10-01:
   no paid bake-off; the Codex image tool makes every character picture (decision 4).
10. **The video model. Decided 2026-10-01; default changed 2026-10-02.** Supagen is the
    system. MiniMax H3 was the default; since 2026-10-02 the default is **MiniMax H3 Max
    reference-to-video** (`minimax-h3-max-reference-to-video`, the founder), and MiniMax
    H3 reference-to-video stays in `models.json` as the second entry. Seedance, Wan
    Prime, Kling and Gemini Omni are the alternates, all through Supagen. No BytePlus
    registration and no Higgsfield (decision 6).
11. **The vibe reference. Decided 2026-10-01: yes.** One or more references (Pinterest
    pictures or real creator frames) are used only to write the locked JSON; the agent
    changes at least three identity traits (§ 4.3); a reference is never attached to
    the image tool. After the user approves the hero, the hero picture is the
    identity reference of every later keyframe and video (decision 5, § 4.1).
    **Extended 2026-10-02:** the step is optional but strongly recommended, for any
    handle that has a persona or several, not only for slideshow handles. When the user
    has no pictures, `persona-identity` proposes frames of the persona handles found by
    the competitor and niche research, and the user picks (§ 4.1, § 4.9).
12. **The kit and the pipelines. Decided 2026-10-01.** Character videos and
    recreation videos are separate pipelines; the recreation pipeline is not changed
    (§ 2). ugckit is the source system. This method, its
    script file and its sources live in the ugckit repository under `research/ai-ugc/`,
    outside `template/`, and are never shipped. What ships is skills, scripts and
    orchestrator updates in `template/`. The kit never names a user's app, handle or
    character.
13. **The model file. Built 2026-10-01; price fixed, Supagen read and default changed
    2026-10-02.** `template/scripts/character/models.json` holds two entries, both 5 to
    15 s, generated at 768p and upscaled once to 1080p at assembly, never 4K:
    - **`minimax-h3-max-reference-to-video`, the default:** **$0.08/s** (the founder;
      Supagen lists the same), at most **4 reference images**.
    - `minimax-h3-reference-to-video`, the second entry: about **$0.06/s at 768p** (the
      founder; Supagen lists $0.13/s), at most 9 reference images.

    The duration rules: whole seconds, **at least 5** (the minimum of both; a shorter
    planned segment is generated at 5 s and trimmed); the 15 s cap checked at model
    choice and before each generation; `duration` null with the integer in
    `extensions.duration`; cost = price × seconds; the active version and the selected
    model change together; `generate.sh` refuses a `refs.json` with more pictures than
    `max_reference_images`.
    What read-only checks of Supagen showed on 2026-10-02 (the model records of both
    reference models, the versions of the earlier templates, the invocation list and
    traces; no generation):
    1. **Billing. Partly settled.** MiniMax H3 reference-to-video: Supagen records
       exactly **$0.65 for every run**, seven runs asked at 5 to 15 s; that is its list
       price, $0.13/s, times the 5 s minimum. The H3 Max text-to-video and
       image-to-video models: **$0.20 for every run**, at 10 s and at 15 s alike, which
       is less than $0.08 × 5 s. **No run of H3 Max reference-to-video exists yet.** So
       Supagen's cost record is per run, not per second. What the provider charges
       cannot be read from Supagen; compare after the first run of the test (§ 16
       Phase 5). Until then the plan uses the computed $0.08 × seconds, the higher
       figure.
    2. **Template settings. Settled.** The earlier H3 Max template (text-to-video, 16:9,
       six versions at 5 to 15 s) and the earlier H3 reference template (9:16, three
       versions) both used `n` 1 and `extensions`
       `{ "duration": <seconds>, "resolution": "768P" }`; the H3 Max versions had audio
       on. **The `ugc-character` template is part of the kit** (the founder, 2026-10-02):
       its desired state is `template/scripts/character/templates.json`, beside
       `models.json` and in the shape of the recreation `scripts/templates.json`, which
       is not changed. The `setup` skill reads it after the recreation file and creates,
       through MCP, what is missing in each user's workspace: the template `ugc-character`
       (video output, messages only: no system instructions, no variables) and its version
       `v1-5s-9x16` (model `minimax-h3-max-reference-to-video`, `aspect_ratio` 9:16,
       `n` 1, `duration` null, `extensions` `{ "duration": 5, "resolution": "768P" }`,
       audio on), activated when the template has no active version. An existing
       `ugc-character` is kept: only versions missing by name are created. Setup then
       records the version in `pipeline/character/state.json` (`scripts/character/state.py
       model set minimax-h3-max-reference-to-video 5`), and `scripts/doctor.py` warns
       while that record is missing, which is also the case for a workspace set up
       before the template existed.
       **In the founder's workspace** it was created on 2026-10-02 by hand, with no
       generation and no spend: template id `4611b06f-5bfb-4766-97c6-93d383d2d1f6`,
       version 1 `v1-5s-9x16`, id `1b56fe91-398f-4c9b-bf37-7cb44d735820`, active, with
       exactly the settings above. These ids are not in any shipped file; setup finds
       the template there by its slug and creates nothing.
    3. **Resolution. Settled.** H3 Max reference takes 480p, 768p or 1080p (768p is
       native; 1080p is the provider's refinement, with no separate price listed). H3
       reference takes 480p, 768p, 2K or 4K. We send `"768P"` (uppercase) inside
       `extensions`, the value that worked in every H3 and H3 Max run, and upscale to
       1080p ourselves (the founder's rule).
    4. **Output length.** Settled by measurement for H3 reference: outputs run 0.1 to
       0.6 s long (5 s → 5.184 s, 6 s → 6.592 s, 15 s → 15.104 s). Not measured for H3
       Max reference; the first run measures it. Assembly trims to the planned length.
    5. **Sound. Open.** The H3 Max reference record says the model generates sound and
       keeps "the self-composed soundtrack", but its capability list says it has no
       audio output (H3 reference lists audio output). A talking segment needs the
       model's own speech. The first run (§ 16 Phase 5) checks for a sound track before
       any talking segment counts on it.
    6. **References.** H3 Max reference takes at most 4 reference images, plus video and
       audio references; it has no video extension. § 10.4 gives the order in which the
       four places are filled.
14. **One identity process. Decided 2026-10-02.** The casting method (§ 4 to § 6) is
    the `persona-identity` skill, for slideshow handles and character videos alike;
    there is no separate `character-cast`. Identity is made once per handle: the
    identity half at handle creation, the video half just in time for the first video.
    The hero of the handle's identity character is `references/face.png`, so the slides
    and the videos use one picture. The slideshow keeps its files, names and
    `## References` table; an existing handle migrates without re-casting (§ 4.9). The
    handle's world (fixed subjects such as a cat, the sets of the home) has its place in
    `world.json` and `references/`; its rules are expanded later.
15. **Slides with a second character. Out of scope for this work** (the founder,
    2026-10-02: "leave slideshows alone for now. It is a separate concern."). On a
    multi-character handle the `## References` table keeps the identity character's
    face only, and the slides behave as today (§ 4.9). Nothing in the slideshow path
    changes for a second character.
16. **The failure ledger. Kept, and moved to a folder the user owns** (the founder,
    2026-10-02: no kit upgrade may clash with the user's rows). The ledger is
    `pipeline/character/model-failures.md`: the installer writes the seed once
    (`copy_once`) and never again. The kit's own knowledge is
    `docs/character-model-known.md`, a managed file that every upgrade updates, so a
    new finding of the kit reaches an existing workspace without touching its rows
    (§ 9.3). `generate.sh` and `qc.py` do not read the ledger; P1 (`character-shots`)
    reads both files and P3 (`character-review`) writes the ledger only. Those two
    skills are built in Phases 2 and 3.
