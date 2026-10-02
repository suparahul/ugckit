---
name: character-voice
description: The voice reference setup of one character, once, before her first character video — three to five real creator clips from the research, cut clean, heard and approved by the user, saved as the character's voice reference, then the natural-voice check on her first approved talking generation. Local and free; no generation.
---

# Character voice: the voice reference setup

Part A of the character pipeline, stage D2. Once per character, after the video half of
`persona-identity` and before her first video; every later video reuses it. **No
talking segment of a character is generated before her voice reference is approved.**
A new voice reference is a new version of the character (`persona-identity`, mode 4).

The clip is a reference for the video model only: tone, pitch, accent, pace. It is never
a voice clone and never a TTS voice. A voice is changed as rarely as a face.

Read first: `characters/<character>/creator.json` (`voice_profile`, and the claim in the
handle's `## Persona`).

## The steps, with the user

1. **Find the candidates.** The research has already saved real creator videos with
   their audio: `research/<project>/<app>/<handle>/<post>/video.mp4` (`deepen`) and
   `apps/<slug>/niche/batches/<date>/<handle>/<post>/video.mp4` with `transcript.txt`
   (`niche-fetch`). Pick three to five whose voice fits `voice_profile` and the claim:
   age, accent, energy, the room. Say which post each one is from.
2. **Cut them clean.** 8 to 15 s of one speaker: no music, no second voice, no sound
   effect, no edit inside the clip. First take the sound of each candidate post into the
   voice folder, then read its spoken-back lines (with times) and its pitch per 2 s
   window from the QC tool:

       V=apps/<slug>/handles/<handle>/characters/<character>/references/voice
       ffmpeg -y -i <video.mp4> -vn -ac 1 $V/source-<n>.wav
       .venv/bin/python3 scripts/character/qc.py - - $V/source-<n>.wav

   On an audio file the QC tool's picture lines (contact sheet, green screen, cuts) do
   not apply; ignore them and the ffmpeg error about the sheet. Then cut each clip as
   mp3 (an `.m4a` uploads with the wrong type):

       ffmpeg -y -ss <start> -to <end> -i <video.mp4> -vn -ac 1 -ar 44100 -b:a 192k \
         $V/candidate-<n>.mp3

   Listen to each yourself (the transcript of the cut, the pitch report) before the user
   does: a second voice or a music bed is a reject.
3. **The user listens and approves one.** Give the paths; the user plays them. Record
   the approval in `creator.json` `voice_profile.voice_reference`: `origin` `research`,
   the `source` (the post URL, the real creator's handle, the platform, the research
   file that lists the post, the cut times), `candidates_heard`, and `approved` with the
   user's words and the date.
4. **Save it** as `characters/<character>/references/voice/voice-reference.mp3`. Fill the
   numbers of `voice_profile` (pace, pauses, pitch spread) from the QC report of the
   approved clip. Keep the other candidates and the `source-<n>.wav` files until the
   natural-voice check passes; they are the replacements.
5. **The natural-voice check**, on the first approved talking generation of this
   character (P3, `character-review`). It passes when all are true: natural breaths
   before lines; pauses that vary in length; pitch that moves
   (`scripts/character/qc.py`: no 2 s window under 5 semitones); the room sound under
   the voice, not a dry studio voice; no flat TTS cadence, where every sentence has the
   same rhythm and the same fall at the end. Write the date and the result in
   `natural_voice_check`. If it fails, replace the clip with another candidate (step 3)
   as a new version.

When the voice reference is approved and the twenty-generation gate has passed
(`persona-identity`, mode 3), set `status` to `live` and update the `## Characters` row
of `HANDLE.md`.

## The fallback

Only when the research gives no usable clip, or the user approves none: the first
talking generation is made from the text profile alone, after the user's yes to its
cost, and run until the user accepts the voice. Then 8 to 15 s of her clean speech is
cut from it and approved as in step 3, with `origin` `own-generation (fallback only)`.
This is the only case in which the reference comes from our own generation.
