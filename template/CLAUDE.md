# Claude Code entry point

The orchestrator contract lives in **[AGENTS.md](AGENTS.md)**. Read it fully before
acting on anything in this project — it carries hard rules that exist because breaking
them cost real money.

Skills for each pipeline stage are in `.claude/skills/`. Invoke them by name.

Research, R1–R5, when the user has a niche or an app name rather than a video
(`discover`, `triage`, `harvest`, `deepen`, `teardown`).

Recreation, 0–9 (`setup`, `ingest`, `watch`, `transcribe`, `breakdown`, `script`,
`generate`, `review`, `composite`, `deliver`) — plus `originate`, which is stage 5
written from research instead of from a reference video.

If this is a fresh checkout, start with the `setup` skill.
