---
name: persona-identity
description: The identity pictures of a handle — the face reference, the subject references, the style photo, the profile picture — generated from the persona text with the same Codex bridge as the slide pictures. Listed and minimal; its full design is a later discussion.
---

# Persona identity (a production stage, not Atlas code)

**Listed, minimal.** The stage exists so the order of the slideshow path is complete
(`handles` step 3 and step 4). Its mechanics are the `images` skill's: the same
just-in-time Codex check, the same bridge. What is not decided yet: how the persona
text becomes the prompts, how many candidates per reference, what a style reference is
made from when the user has no photo. Until that discussion, do this:

1. **The check.** As in `images`: `codex --version`, `codex login status`; not logged
   in → print `codex login`, wait for "done". Say once: "this uses your Codex plan".
2. **The prompts.** Write them yourself from `## Persona`: one for the face (an original
   fictional face, described in five plain features, never a real person, never a
   named likeness), one per subject (the cat, the room), one for the style photo (a real
   phone photo of the place, flat light, clutter), and later one for the profile
   picture (the persona with the subjects, from the face and subject references).
3. **The run.** Write a small job file next to the references,
   `handles/<handle>/references/identity-job.json`, in the shape of `images-job.json`
   (`slides` → `files`: `[{name, prompt, references}]`, no dimension; ask the tool for
   1024x1024 for the face and the profile picture, portrait for the rest). Then the same
   `codex exec` line as `scripts/codex-images.sh` with the job's references attached and
   an instruction that names the output paths, or, when the agent is Codex, make them
   inline with the image tool. Save each as `references/<name>.png`.
4. **The check after.** Each file exists, is a real image (`ffprobe`), and matches the
   persona text; write the `## References` table in `HANDLE.md`; the user approves each
   on the handle page.

No Monid cost. The face and the subjects are the identity for every slide after this,
so a wrong coat or a wrong eye colour here is a wrong week: look at each one.
