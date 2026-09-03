# Claude Code entry point

The orchestrator contract lives in **[AGENTS.md](AGENTS.md)**. Read it fully before
acting on anything in this project — it carries hard rules that exist because breaking
them cost real money.

Skills for each pipeline stage are in `.claude/skills/`. Invoke them by name
(`setup`, `ingest`, `watch`, `transcribe`, `breakdown`, `script`, `generate`,
`review`, `composite`, `deliver`).

If this is a fresh checkout, start with the `setup` skill.
