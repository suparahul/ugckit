---
name: persona-identity
description: The one identity process of a handle, for slideshows and character videos. The identity half (vibe references, a locked JSON, four face candidates, the hero the user approves as references/face.png, the fixed subjects, the style photo, the profile picture) runs at handle creation; the video half (anchors, set plates, signature details, the twenty-generation gate) runs just in time for the first character video. Every picture is made by Codex on the user's Codex plan. No Monid cost.
---

# Persona identity: one process for slideshows and videos

A handle's visual identity is made **once**, by this skill, and used by every slide and
every video. The `handles` skill runs it at its steps 3 and 4 (the identity half). A
character video runs it again, once, before the first video (the video half). Casting
never runs per post or per video.

Read first: `HANDLE.md` (`## Persona`, the head lines, `## References`), the handle's
`world.json` and `characters/` if they exist, `brain/ACCOUNT-ARCHITECTURE.md` Layer 3
(persona fidelity), the niche findings. Templates: `docs/character/creator.example.json`
and `docs/character/world.example.json`.

## What lives where (paths under `apps/<slug>/handles/<handle>/`)

    references/face.png              the hero of the handle's identity character: the face
                                     of every slide and every video
    references/subject-<name>.png    each fixed subject (a pet): the handle's world
    references/style.png             the style photo
    references/profile.png           the profile picture
    references/sets/<set-id>.png     the rooms of the home, empty (video half; slides never get them)
    world.json                       the locks of the fixed subjects and the sets
    characters/<character>/
      creator.json                   the character's definition, version and status
      references/casting/            vibe references, locked JSON versions, hero candidates
      references/anchors/            front, three-quarter-left/right, side, back-shoulder,
                                     expressions, hands, outfits/ (and hero.png for a
                                     character that is not the handle's identity)
      references/voice/              the voice reference (`character-voice`)
      versions/v<n>.json             a frozen copy of creator.json at each version

The slideshow reads only `HANDLE.md` `## References` and the top level of
`references/`. Keep those names and that table exactly; the `images` skill attaches every
row except the profile picture to every slide, so never add an anchor or a set plate to
that table.

The status of a character, in `creator.json`: `casting` (no approved hero), `identity`
(the hero is approved; slides may use it, videos may not), `video-setup` (the video half
and the voice are in progress), `live` (videos may use it), `retired`.

## Which mode?

| The handle has | Run |
|---|---|
| no approved `references/face.png`, and a rendered persona | **1. New identity** |
| a real persona (own camera) | nothing: `handles` step 3 writes "own camera; references pending" |
| a brand handle (the app is the identity) | no face; only the world (fixed subjects), if any |
| an approved `face.png` but no `characters/` | **2. From an existing face**, when a character video is first planned |
| a character at `identity`, and a character video is planned | **3. The video half** |
| a new character, or a change to one | **4. Add a character or a version** |

## The Codex check and the bridge (every mode)

Say once a session: **"The pictures are made by Codex on your Codex plan; the kit does
not compute that cost."** Then `codex --version` and `codex login status`; not logged in
→ give the one command, `codex login`, wait for "done", check again.

Write a job file next to the pictures, in the shape of `images-job.json` (`slides` →
`files`: `[{name, prompt, references}]`): `references/identity-job.json` for the
identity half, `characters/<character>/references/anchors/anchors-job.json` for the
video half. **Codex as the agent:** make each picture inline with the image tool, the
job's references attached. **Claude as the agent:** start one `codex exec` in the
background, as `scripts/codex-images.sh` does (`-C <root> -s workspace-write
--skip-git-repo-check --ephemeral --json -o <result.md> -i <each reference> -`, the
instruction on stdin, naming every output path), and wait for the notification.
Afterwards every file must exist and be a real image (`ffprobe`). Then **look at each
one**: a wrong coat or a wrong eye colour here is a wrong week.

## 1. New identity (the identity half, at `handles` step 3)

1. **The casting brief.** From `## Persona`: the claim the handle makes first (who would
   believably say this: age band, life stage, home), then the look. A face that does not
   fit the claim fails before a word is said.
2. **The vibe references: optional, strongly recommended.** For every handle that has a
   persona, a slideshow handle or a video one, and for each new character. One or more
   pictures whose look fits the claim: age, styling, the room, the camera. They keep
   the face away from the model's default "beautiful AI person". First ask: "Do you have
   pictures whose look fits this persona? Pinterest pictures are fine." When the user
   has none, **propose some from the research**:
   - **Find the persona handles** the research found: the persona rows of
     `apps/<slug>/niche/architecture.md` `## Account table` (both sources), and the
     persona accounts in `research/<project>/<app>/NETWORK.md` and in heading 2 of each
     teardown. Keep only a handle that shows a person, and whose look fits the claim
     (`Persona fidelity` and the saved posts say so). A brand account, a theme page or
     a faceless persona is not a candidate.
   - **Take their saved pictures**, nothing new fetched: `slide-NN.jpg` and `cover.jpg`
     under `apps/<slug>/niche/batches/<date>/<handle>/<post>/` and
     `research/<project>/<app>/<handle>/<post>/`, or one frame of a saved `video.mp4`
     (`ffmpeg -y -ss <t> -i video.mp4 -frames:v 1 <out>.jpg`). Look at each one.
   - **Propose three to six**, each copied to
     `characters/<character>/references/casting/proposed-<n>.jpg`, with the handle, the
     post, the file and one line on why its look fits the claim. The user picks one or
     more, or none. Save each pick as `vibe-<n>.jpg` with its source; a proposed picture
     the user does not pick is never used.

   Pictures from the user go in the same folder as `vibe-<n>.<ext>`, with their source.
   **The user may skip this step.** Then the locked JSON is written from `## Persona`
   alone, `vibe_references` is `["none: skipped by the user"]`, and you say once that
   the face is then more likely to look like the model's default person. **A vibe
   reference is never attached to the image tool**; it is used only to write the JSON.
   A frame from the research shows a real person: the divergence check of step 3 is
   what makes ours a different one.
3. **The locked JSON** (`characters/<character>/references/casting/<character>_locked_v1.json`),
   the portrait-clone schema in full: `critical_constraints` and `negative_prompt`
   first, then subject, face (skin, eyes, brows, nose, mouth, make-up, ears), hair, neck,
   hands, jewellery, accessories, body marks, outfit, pose, expression, scene, lighting,
   camera, colour grading, style, output, generation parameters, post-processing.
   - One value per attribute: no "or", no range, no "natural" without a number. Absence
     is locked too (glasses, hat, earrings, bag, second person, text: `none`, and in the
     negative). Quantify: degrees, cm, percent of frame, counts, a hex for every colour.
   - Each trait that differs from the model's default "beautiful AI person" is written
     three times: precisely in its field, one imperative line in
     `critical_constraints`, the default version in `negative_prompt`. Check the drift
     axes every time: big round eyes, V-line or doll face, tighter clothes, glossy
     voluminous hair, poreless skin, model pose, idol look, saturated background, added
     earrings or props or text.
   - **Diverge on purpose**, when there are vibe references. Change at least three
     identity axes away from them (face shape, eye shape and spacing, nose, hair colour
     or cut, a body mark); keep every vibe axis (age band, styling, wardrobe class,
     room, light, camera, expression energy). Record them in `diverged_axes`.
   - **De-slop.** No quality boosters in a positive field (4K, 8K, ultra-detailed,
     photorealistic, masterpiece, sharp focus, flawless, stunning: they go in the
     negative). No glamour words (ethereal, porcelain, dewy, model, cinematic, "natural
     beauty", bare "realistic"). A capture pipeline instead: front-facing phone camera,
     lens, distance, height, normal phone processing. Imperfections located, not random
     (pores on the nose and cheeks, faint redness at the nostrils, one brow slightly
     higher, flyaways at the crown). A lived-in room, one thing slightly off. Flat
     grading, no sharpening. `critical_constraints` ends with a `MEDIUM:` line: an
     unretouched real phone photo, never a render.
   - The file is versioned (`_v1`, `_v2`) and always complete.
4. **Four candidates** at once from the locked JSON, with no reference attached,
   1024x1024, saved as `characters/<character>/references/casting/candidate-<n>.png`.
   Judge each on five questions: doll eyes or not; skin texture at full size; does it
   read as a phone photo; is it the person the JSON describes; would it pass in a feed
   beside real posts. Place the best beside each vibe reference: if a stranger would
   say "same person", change two more axes, bump the JSON version, make four more.
5. **The user picks the hero.** Copy it to `references/face.png`. Diff it against the
   JSON variable by variable; each difference is an under-locked variable: fix the JSON
   (next version) so the text and the picture agree.
6. **The fixed subjects** (the cat, a product always held): one picture each,
   `references/subject-<name>.png`, written from `## Persona` with its count and its true
   size, the hero attached only when the subject is shown with the person. Write each
   into `world.json` (`docs/character/world.example.json`).
7. **The style photo**, `references/style.png`: a real phone photo of the place, flat
   light, clutter, no person.
8. **Write the files.**
   - `characters/<character>/creator.json` from the template: `version` `v1`, `status`
     `identity`, `identity_character` `true`, `identity_lock` (six short lines written
     from the hero, visible traits only), `fixed_subjects` (ids from `world.json`),
     `casting` (the JSON, the vibe references, the diverged axes, the candidates, the
     user's approval of the hero with the date). The video fields stay as placeholders.
   - `HANDLE.md` `## References`, the same table as always (the `handles` skill shows
     it), and a `## Characters` table after it:

         ## Characters
         | Character | Version | Status | Folder |
         |---|---|---|---|
         | <character> | v1 | identity | characters/<character>/ |

The user approves each picture on the handle page (`reference.approve`, or
`reference.reject` with a note: regenerate that one only). **The profile picture** is
made at `handles` step 4: `references/profile.png` from the face and the subjects
attached, 1024x1024.

## 2. From an existing face (the migration; no re-cast)

For a handle whose `references/face.png` was approved before this process, or a face the
user brings. Nothing is redone and the slideshow files are not touched.

1. The face is the hero. Do not generate candidates.
2. Write the locked JSON **from the picture**: describe only what is visible; invent no
   scar, mole or jewellery that is not there. `vibe_references`: "none: written from the
   approved face".
3. `world.json` from the existing `references/subject-<name>.png` files and the subject
   lines of `## Persona`.
4. `creator.json` at `v1`, status `identity`, and the `## Characters` table, as in mode 1
   step 8. Then mode 3.

## 3. The video half (just in time, before the first character video)

Only when a character video is planned for this character. All by image-to-image from
the hero, with the Codex image tool; never from text again.

1. **The signature details.** Propose two or three (a necklace, a hair clip, a nail
   colour), each at least 1% of the frame height in a chest-up shot, only what the hero
   shows or the user adds. The user approves; they are then permanent.
2. **The anchors**, in `characters/<character>/references/anchors/`, each from the hero
   attached: `front.png`, `three-quarter-left.png`, `three-quarter-right.png`,
   `side.png` (neutral face, same light, plain framing; one image per view),
   `back-shoulder.png` (from behind, over the shoulder), `expressions.png` (neutral,
   mid-sentence, a real laugh with eye creasing, listening, surprised, looking away),
   `hands.png` (both hands, nails per the lock), and `outfits/<outfit-id>.png` for each
   locked outfit. When several pictures show one person, the prompt says so: "all
   images define one woman; exactly one person on screen".
3. **The sets** of the home, two or three, each empty, from the camera position used
   there: `references/sets/<set-id>.png`, written into `world.json` with its light state
   (source, direction, colour temperature), camera position and three named objects.
   Start with the simplest: a wall or a sofa back close behind, one window.
4. **Approval by word.** The user approves each anchor and set here, in the
   conversation; write the words and the date into `creator.json` (`anchors.approved`)
   and `world.json`. The Atlas handle page does not show these files yet.
5. **Status `video-setup`**, then run `character-voice`. The character goes `live` when
   the voice reference is approved and the **twenty-generation gate** has passed: the
   same face held through twenty generated stills in different shots. The first
   keyframes count, and so do slide pictures that show the face. The gate blocks only
   video production, never a slideshow post. Write the date in
   `casting.twenty_generation_gate`.

The first character of an app passes the gate before a second character starts her
video half, on any handle. This never holds back the identity half of another handle.

## 4. Add a character or a version

- **A new character** on a handle: mode 1 with a new id; her hero goes to
  `characters/<character>/references/anchors/hero.png`, not to `face.png`, unless she is
  the handle's identity. A persona handle has exactly one character; for a second one
  the user first makes it a multi-character handle (write that in `HANDLE.md`). Each
  character has her own folder, anchors and voice reference; the world is shared.
- **A new version.** A change to identity (face, hair, signature details, voice
  reference) is a new version: approved again, and through the gate again. A new set or
  outfit is also a new version, with no re-cast and no new gate. First freeze the current
  file as `versions/v<n>.json`, then bump `version`, write `version_note` (what changed,
  the user's words, the date) and update the `## Characters` row. Anchors are added,
  never overwritten: a changed anchor gets a new file name. A version that any video
  uses is never deleted.
