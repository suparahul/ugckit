---
name: images
description: Phase 8, the pictures — every candidate picture of one post, from the deck's prompts and the handle's references, made by Codex on the user's Codex plan. Codex as the agent makes them inline; Claude starts one codex exec in the background (the bridge). Just-in-time Codex login check at the first run. No Monid cost.
---

# Phase 8 — the pictures (images)

    scripts/images.sh <slug> <post> [--only 3,5]      writes images-job.json and prints the instruction (Codex inline)
    scripts/codex-images.sh <slug> <post> [--only 3,5]  the bridge: the check, the job, one codex exec, the verify (Claude)
    scripts/images.sh <slug> <post> --verify          the check of every slide's file; images-result.json; the log lines

`<post>` is the post key, `2026-09-17/hannah/1`. One post per call, serial. The deck
must exist and the plan approved (`plan.approve`) before the first picture.

The prompts come from the deck as written. A photo handle's prompts hold no text (the
compositor burns it); an illustrated handle's prompts hold the slide's words, so the
picture that comes back is the finished slide. For those, the verify checks the file
and the size as always; you check the spelling of every word in the picture, and a
misspelt slide is re-run with `--only`, never patched.

## Before the first run of a session: the cost and the check

Say once: **"The pictures are made by Codex on your Codex plan; the kit does not
compute that cost."** Then the just-in-time check, at every run because it is cheap:
`codex --version`, then `codex login status`. Logged in prints `Logged in using
ChatGPT` (exit 0) and you continue. Not logged in prints `Not logged in` (exit 1): give
the user the one command, `codex login`, wait for "done", check again. Never in Setup,
never stored. A missing `codex` is `npm install -g @openai/codex`.

## Which agent are you?

- **Codex.** Run `scripts/images.sh <slug> <post>`. It writes the job file and prints
  an instruction; follow it yourself: for each slide, one call of your image tool with
  the style prefix plus the prompt and the job's reference images attached, the file
  copied into `files/<post>/slide-NN/codex-<stamp>.png`, the resize to the job's size
  next to it (`-post.png`). Then `scripts/images.sh <slug> <post> --verify`.
- **Claude.** Run `scripts/codex-images.sh <slug> <post>` with `run_in_background` and
  wait for the notification; do not poll. It makes the check, writes the job, starts
  one `codex exec` (`-C <root> -s workspace-write --skip-git-repo-check --ephemeral
  --json -o images-result.md -i <every reference> -` with the instruction on stdin),
  then verifies. About two minutes a picture: a seven-slide post is about twelve
  minutes; say so.

## What is on disk after a run

`files/<post>/images-job.json` (what was asked: the slides, the prompts, the references,
the size, `requestedAt`), `slide-NN/codex-<stamp>.png` (the raw render) and
`codex-<stamp>-post.png` (the raw render at the post's exact size), `images-result.json`
(`slides`, `failed`, `agent`, `finishedAt`), `images-result.md` (the worker's last
message), `images-events.jsonl` (the run), and one log line per new valid candidate,
`{kind: "slide.upload", post, slide, file, actor: "agent", data: {source: "codex", job:
"images-job.json"}}`, the same `file` form the post page's upload writes, so the
candidate shows on the post page without an upload.

## Verify, then look

`--verify` checks, per slide: a file exists, is a real image, and its pixel size equals
the post's dimension (1080×1440 for 3:4, 1080×1920 for 9:16); the raw 1024×1536 render
is listed as a note, the `-post` file is the valid candidate. A slide with no valid
file is reported by number. Then **look at every picture yourself** against the
identity rule of the handle (the coat, the eye colour, the face): a wrong cat is a
defect, not a variant. Point the user at the post page to approve each slide or ask for
a new one (`slide.approve`, `slide.note` "ask for a new one").

## Re-run

The same call with `--only <n,n>`: the job file is rewritten with the subset, old
candidates are kept. A failed run: the script prints the failed slide numbers and the
last 20 events; re-run those slides only. Approval of one run is not approval of the
next.

## What was tested on this machine (2026-09-18, codex-cli 0.154.0, logged in with ChatGPT)

1. `codex exec` in a non-interactive run calls the built-in image tool under
   `-s workspace-write` and saves the file in the workspace: yes. The tool writes to
   `~/.codex/generated_images/<thread>/…png` first; the worker copies it to the path
   the instruction names. Three pictures of one post in one run, all on disk.
2. Images passed with `-i` reach the image model as identity references: yes. The
   generated tabby had the reference's coat, face and eye colour; the same face and
   the same two cats held across three slides of one run.
3. The tool returns 1024×1536 for a portrait request; 1080×1440 and 1080×1920 cannot
   be requested. The worker scales and centre-crops with ffmpeg in the post-process
   step; the verify accepts the `-post` file and lists the raw one as a note.
4. Time: 106 s and 108 s for one picture; 299 s for three in one run (serial inside
   the process). A seven-slide post is about twelve minutes.
5. The event that marks completion is `{"type":"turn.completed", "usage":…}` in the
   `--json` stream; the file `-o` names holds the worker's last message (the result
   lines). A run that ends without `turn.completed` is a failure; the bridge prints
   the last 20 events. What `-o` holds after a crash: not observed (no run crashed).
6. `codex login status` prints `Logged in using ChatGPT` (exit 0) when logged in and
   `Not logged in` (exit 1) when not (checked with an empty `CODEX_HOME`). An expired
   login was not observed.
7. `--ephemeral` works with the image tool: every test run used it.
8. One `codex exec` makes several pictures in one run (three tested); no loop of one
   process per slide is needed.
9. Two `codex exec` processes ran at the same time without a slowdown (one three-slide
   run and one one-slide run, 299 s and 108 s). The kit still runs one post per call.
10. Codex inline (the Codex agent following this skill, no bridge): tested once on one
    slide, `codex exec` given only "read this skill, follow it as Codex, slide 3 of
    this post". It said the cost line, ran `codex login status`, ran `images.sh …
    --only 3`, read the job file, read its own imagegen skill, made one picture with
    the four references attached (the golden British Longhair came back with the
    reference's coat, ruff and green eyes), copied the raw render from
    `~/.codex/generated_images/<thread>/` to `slide-03/codex-<stamp>.png`, made the
    `-post.png` with ffmpeg, wrote `images-result.md` by hand, then ran `images.sh …
    --verify`, which passed (`1 of 1 slides have a valid picture`) and appended the
    `slide.upload` line. 173 s in all, about a minute of reading and checks around
    the 106 s picture. The log line came from `--verify`, as this skill says; Codex
    did not write it by hand, and it must not: the verify is the one writer. One
    stray: it tried `identify` (ImageMagick, not installed) to print the sizes; the
    files were fine. Its own `sips` check passed.
Two more facts: `-i` takes a list of files, so the prompt must come on stdin (`-`),
never as the argument after `-i`; and `codex exec` reads stdin when it is not a
terminal, so a run with no stdin hangs on "Reading prompt from stdin". The bridge
does both right. The stderr carries an MCP transport error from an unrelated server
config; it is noise.
