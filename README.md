# ugckit

Give it a reference video. Get back your own version of it — same structure, your script,
your character, optionally with a real app demo playing on a phone in the shot.

It is an agent, a set of skills, the scripts they drive, and a local review UI. You talk
to the agent; it runs the pipeline.

## Install

    git clone <this-repo> && cd ugckit
    ./install.sh ~/my-video-project

Or into the current directory:

    ./install.sh

The installer checks for ffmpeg, python 3.9+, curl and git, scaffolds the project,
creates a `.venv`, installs dependencies, and tells you how to wire up MCP. It is
idempotent — re-running upgrades the scripts and skills and never touches your `.env`,
your prompts, or anything you have generated.

## Then

    cd ~/my-video-project
    $EDITOR .env          # SUPAGEN_API_KEY, SUPAGEN_WORKSPACE_ID
    ./ugckit doctor       # confirms tools, deps, credentials and live auth
    claude                # or: codex — both read AGENTS.md

Ask the agent to run the **setup** skill first. It creates the required Supagen
templates in your workspace. Nothing generates until that is done.

## The pipeline

| Stage | What happens | Cost |
|---|---|---|
| 0 setup | verify environment, create Supagen templates | — |
| 1 ingest | trim the reference, measure cuts, contact sheets | free, local |
| 2 watch | Gemini describes the scene in six sections | ~$0.01 |
| 3 transcribe | local Whisper transcript + prosody numbers | free, local |
| 4 breakdown | reconcile all three into one spec | — |
| 5 script | write `prompt.txt` (+ `insert.json`) | — |
| 6 generate | make the video | $0.60 default |
| 7 review | measure cuts, green screen, dialogue, pitch | free, local |
| 8 composite | put a real app screen on the phone | free, local |
| 9 deliver | final check and handover | — |

Progress lives in `pipeline/state/pipeline.json`. The agent reads it before every action,
so you can stop and resume at any point.

## Three flows

Selected by which files exist in `pipeline/05-prompt/<project>/`:

- `prompt.txt` — **simple**: text-to-video, done.
- `+ insert.json` — **complex**: generate a green-screen plate, then composite a real
  screen recording onto the phone, with the thumb correctly occluding it.
- `+ refs.json` — **referenced**: hand reference clips to the model. Rarely what you want;
  read rule 1 in `AGENTS.md` first.

## The review UI

    ./ugckit ui        # http://127.0.0.1:7878

Projects on the left; assets, video player and the editable prompt on the right. The
feedback box appends to `pipeline/state/feedback.jsonl`, which the orchestrator reads at
every stage — so a note lands whether or not an agent is running. Binds to localhost
only and has no auth; do not expose it.

## Why the guardrails exist

`AGENTS.md` carries eight hard rules. Each cost real money or a wasted round trip to
learn, and the scripts enforce them rather than trusting anyone to remember:

- **Text-to-video is the default.** Reference-to-video cannot reproduce text — app UI
  comes back as a pastiche with nonsense strings. `generate.sh` refuses to switch modes
  without an explicit `ALLOW_REFS=1`.
- **The active version is the model that runs.** The REST invoke endpoint ignores
  `version_number` — tested — so switching model is `activate_version` plus
  `state.py model set`, and the scripts read the local record for cost and caps.
- **Generation goes over curl, never MCP** — MCP tool calls abort at 60s and generation
  takes minutes.
- **The prompt cap is 5000 characters, not bytes.** Em dashes are 3 bytes each, so a
  byte-counting check rejects valid prompts. Both `generate.sh` and the UI count
  characters.
- **`generate.sh` will not spend money without `CONFIRM=1`**, and prints the computed
  cost first. Reported costs have been observed wrong by 2× in both directions.
- **Duration goes in `extensions`**, because every fal model serialises an integer
  duration as `"20s"` and then rejects its own string.
- **The prompt is sent exactly once.** Supagen concatenates `system_instructions` with
  message content rather than choosing, so the templates are messages-only.

## Models

One template, one version per model. Switch with `activate_version` + `state.py model set`.

| Model | Max length | Price | A full run |
|---|---|---|---|
| **MiniMax H3 Max** (default) | 15s | $0.04/s | **$0.60** |
| Wan 3 Prime | 30s | $0.14/s | $2.80 at 20s |
| Gemini Omni Flash 1.1 | 10s | $0.10/s | $1.00 |

Length forces the choice. MiniMax unless you need more than 15 seconds.

## Requirements

ffmpeg · python 3.9+ · curl · git · a Supagen account and workspace ·
Claude Code or Codex

## Layout

    AGENTS.md              the orchestrator contract — read this first
    CLAUDE.md              pointer to AGENTS.md
    ugckit                 command dispatcher
    .claude/skills/        one skill per stage
    scripts/               the tools the skills drive
      templates.json       desired Supagen workspace state + known model limits
      prompts/             system instructions for the watching layer
      ui/                  the local review UI
    docs/                  annotated insert.json example
    pipeline/              your work, stage by stage
