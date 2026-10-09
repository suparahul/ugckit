# Agent sessions closed on 2026-10-04

The founder closed every agent and terminal on 2026-10-04. This file records what each one was doing, so it can be resumed later.

To resume a Claude session in its directory:

    claude --resume <session-id>

## Terminal 8 — Atlas video UI plan (finished)

- Directory: `~/Documents/code-max/AI UGC/ugckit`, branch `ai-ugc-character-pipeline`
- Session: `797252b9-6efa-4b0e-b050-ba9991d6c844` (Claude Opus)
- Built Atlas video support (ideas, four states, player, beats, caption), commit c24d57d.
- Added video posting through Post Bridge, commits 3073fb5, da7098d, 47ebd12. Nothing real sent, nothing spent. All tests pass.
- Founder decisions built in: AI label on for every video; platform default cover; video with a music note goes only as a TikTok draft and stays off Instagram; duet and stitch on; other videos go to Instagram as Reels at once.
- Nothing open.

## Terminal 10 — video planning system plan (Codex, ended)

- Directory: `~/Documents/code-max/AI UGC/ugckit`, branch `ai-ugc-character-pipeline`
- Agent: Codex, launched by hand. Session id not known to the app.
- Wrote `research/ai-ugc/VIDEO-PLANNING-PLAN.md` from `VIDEO-PLANNING-BRIEF.md`. Last revision 2026-10-03 added §6, a coverage audit against CatWise `HANDLE-STRATEGIES.md` and `EXPERIMENT-UNIVERSE.excalidraw`. Every row is covered in the design.
- Not done (founder said not needed): a check of the built code against each §6 row.

## Terminal 12 — Organic Factory kit update (open question)

- Directory: `~/Documents/code-max/organic-factory` (no git history; backup of kit files made before the update)
- Session: `3dfb9d88-920d-4cfe-ac80-2fc26d7547b2` (Claude Opus)
- Installed the ugckit kit from the local branch `ai-ugc-character-pipeline`, merged ten `.ugckit-new` files by hand, ran migrate. Atlas runs at localhost:3210.
- Turned on face replace (`bridge.face_replace`) and created both Supagen face replace templates (Wan 2.7 Edit Video primary, MiniMax H3 secondary). Spent nothing. Tests pass.
- Open question, not answered: the Organic Factory price file quotes face replace too low. Supagen charges about $0.45 per edit route clip (file says $0.30) and about $0.65 per guided route clip. Should the prices be corrected before the paid test?
- Leftover: dry-run scratch folders `bridge-ws` and `dry-ws` in that session's scratchpad could not be deleted by the agent.

## Terminal 15 — production bridge build (finished)

- Directory: `~/Documents/code-max/AI UGC/ugckit`, branch `ai-ugc-character-pipeline`
- Session: `522e4551-1929-43e9-8874-60be053e3fd9` (Claude Opus)
- Built the production bridge, including face replace. Founder decision: `wan-2-7-edit-video` primary, `minimax-h3-reference-to-video` secondary.
- Last note: before the paid test, set `bridge.face_replace` true and create the `ugc-character-face-replace` template from `templates.json` (terminal 12 did this in Organic Factory).

## Terminal 16 — video planning skills build (finished)

- Directory: `~/Documents/code-max/AI UGC/ugckit`, branch `ai-ugc-character-pipeline`
- Session: `97c357ad-0ec8-4662-a5c9-32f991e02372` (Claude Opus)
- Built the four video skills (video-fit, video-plan, video-script, video-lock) and the brain files (video anatomy, 31 video patterns, video learnings).
- Founder decisions: reaction hooks use face replace; the reference clip is not a generation input for now; no creator permission needed for reaction clips; no final clip produced here. The founder runs the real test in Organic Factory.

## Terminal 6 — AI UGC methodology (finished, stopped at an earlier restart)

- Directory: `~/Documents/code-max/AI UGC/ugckit`. Resumable from the app.

## Open items across all work

- Branch `ai-ugc-character-pipeline` is not merged into main. A plain `ugckit update` elsewhere gets none of the video work until it is merged.
- `VIDEO-PLANNING-BRIEF.md` and `VIDEO-PLANNING-PLAN.md` had no commit at last check.
- Proposed kit job (not started): research tags to the video formats, hooks and insertion types; a step that writes the local overlay from niche research; collect posts that fit no pattern as candidates; a skill that turns a liked reference into a local pattern.
- CatWise: add video rows to `production/PLAN.md`, then run video-fit once before the first video plan.
- Task saved under ugckit: "Handle strategies into Atlas, skillify extras".
