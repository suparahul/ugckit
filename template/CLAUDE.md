# Claude Code entry point

The orchestrator contract lives in **[AGENTS.md](AGENTS.md)**. Read it fully before
acting on anything in this project — it carries hard rules that exist because breaking
them cost real money.

Skills for each pipeline stage are in `.claude/skills/`. Invoke them by name.

Research, R0–R5, when the user has a product, a niche or an app name rather than a
video (`product`, `apps`, `network`, `harvest`, `deepen`, `teardown`). The unit of
research is an app: find up to five in the niche, then study how each is promoted.

Recreation, 0–9 (`setup`, `ingest`, `watch`, `transcribe`, `breakdown`, `script`,
`generate`, `review`, `composite`, `deliver`) — plus `originate`, which is stage 5
written from research instead of from a reference video.

`atlas` is not a stage: it shows the user what the research found, in a browser. Run it
after a harvest, after a teardown, and whenever they ask what was found.

If this is a fresh checkout, start with the `setup` skill.
