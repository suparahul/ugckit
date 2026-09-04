# ugckit

Give it a reference video. Get back your own version of it — same structure, your script,
your character, optionally with a real app demo playing on a phone in the shot.

Or give it nothing but a niche or an app name. It finds who is promoting what, pulls their
content, transcribes the on-screen hook off every post, writes a teardown of the whole
network, and hands the best-performing post to the recreation pipeline as the reference.
Niche in, finished video out.

It is an agent, a set of skills, the scripts they drive, and a local review UI. You talk
to the agent; it runs the pipeline.

## The easiest way in

Open any coding agent — Claude Code, Cursor, Codex — and paste this. It installs
everything and walks you through the rest, one step at a time.

```
Set up ugckit for me in a new folder called ugc, then take me through setup.

1. Run exactly this in the terminal:
   curl -fsSL https://raw.githubusercontent.com/suparahul/ugckit/main/install.sh | sh -s -- ugc

2. Go into the ugc folder, read AGENTS.md, and follow it.

3. Read .claude/skills/setup/SKILL.md in that folder and do everything it
   says, in order.

How to treat me while you do this:
- Assume I have never used a terminal. Give me ONE command at a time, written out
  exactly as I should type it, and wait until I say it worked.
- Never ask me to paste my API key into this chat.
- When I have to click something in a browser or a settings menu, tell me exactly
  where to click.
- Tell me before anything costs money, and how much.
```

That is all a first-time user needs. Everything below is the manual version.

## Install

One line, nothing to clone:

    curl -fsSL https://raw.githubusercontent.com/suparahul/ugckit/main/install.sh | sh -s -- my-video-project

Or from a clone:

    git clone https://github.com/suparahul/ugckit && cd ugckit
    ./install.sh ~/my-video-project

The installer checks for ffmpeg, python 3.9+, curl and git, scaffolds the project,
creates a `.venv`, installs dependencies, and writes the Supagen MCP config. It is
idempotent — re-running upgrades the scripts and skills and never touches your `.env`,
your prompts, or anything you have generated.

## Then

    cd ~/my-video-project
    ./ugckit key                        # asks for each value it needs
    ./ugckit doctor                     # tools, deps, credentials, live auth
    claude                              # or: codex — both read AGENTS.md

Ask the agent to run the **setup** skill first. It creates the required Supagen
templates in your workspace. Nothing generates until that is done.

### Connecting MCP

Template management runs over Supagen's MCP server — `https://mcp.supagen.dev/mcp`,
Streamable HTTP, OAuth. **There is no package to install and no token to paste.** The
installer writes `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor) into the
project, so all that is left is approving the connection: in Claude Code restart and
run `/mcp`; in Cursor reload and approve on first use. Codex and everything else are
covered in [`docs/mcp-setup.md`](template/docs/mcp-setup.md).

Generation does *not* go over MCP — it uses `SUPAGEN_API_KEY` over curl, because a
render runs for minutes and MCP calls abort at 60 seconds. You need both.

## The pipeline

Two halves. The research half is optional — skip it when you already have the video you
want recreated.

| Stage | What happens | Cost |
|---|---|---|
| R1 discover | keyword searches through Monid to find who is promoting what | ~$0.01 a search |
| R2 triage | sort the handles into promoters, competitors and noise | — |
| R3 harvest | metrics, cover frames, and the on-screen hook off every cover | ~$0.02 an account |
| R4 deepen | top 5 accounts by views, their best posts as video or slides | free — reuses R3 |
| R5 teardown | the thirteen-heading analysis, then hand the winner to stage 1 | — |

A full app teardown is a few cents of Monid. The expensive resources are turns and
attention, not API calls.

| Stage | What happens | Cost |
|---|---|---|
| 0 setup | verify environment, create Supagen templates | — |
| 1 ingest | trim the reference, measure cuts, contact sheets | free, local |
| 2 watch | Gemini describes the scene in six sections | ~$0.01 |
| 3 transcribe | local Whisper transcript + prosody numbers | free, local |
| 4 breakdown | reconcile all three into one spec | — |
| 5 script | write `prompt.txt` (+ `insert.json`) | — |
| 5 originate | *or* write it from research instead of from a video | — |
| 6 generate | make the video | $0.60 default |
| 7 review | measure cuts, green screen, dialogue, pitch | free, local |
| 8 composite | put a real app screen on the phone | free, local |
| 9 deliver | final check and handover | — |

Progress lives in `pipeline/state/pipeline.json`. The agent reads it before every action,
so you can stop and resume at any point. That matters most in the research half: a harvest
over twenty accounts runs for a long time, and every stage of it is resumable — an account
already scraped is not paid for twice, a cover already on disk is not fetched again.

## Two ways in

- **You have a reference video.** Stage 1 measures it, and stage 5 `script` writes the
  prompt from those measurements.
- **You have a niche or an app name.** R1–R5 find and analyse the network. Then either
  hand the best post to stage 1 and carry on as above, or skip the reference half entirely
  and let stage 5 `originate` write the prompt from the teardown and the hook library.

Both meet at stage 5, and stages 6–9 do not know or care which route was taken.

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

`AGENTS.md` carries fourteen hard rules. Each cost real money or a wasted round trip to
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

Five of the fourteen are about the research half, and they share a shape: the failure
looks like success and the run carries on.

- **A photo post is not a video**, and TikTok hands you a `video.url` for it anyway —
  what is behind it is the sound. The slides are in `posts.json`, in the `images` array.
  In the reference corpus the single biggest post, at 41.8M views, is a photo post.
- **Never yt-dlp a link Monid already returned**; it re-solves the page, fails, and leaves
  every folder created and empty.
- **Every URL in `posts.json` expires**, so covers, slides and videos are pulled in the
  same session as the metrics.
- **One Monid call at a time.** Concurrent calls return HTML error pages that look exactly
  like running out of credit. `monid.sh` takes a lock and checks the response is JSON.
- **Never trust an extension or a non-empty folder.** Every download is ffprobed for a real
  video stream and deleted if it has none.

## Models

One template, one version per model. Switch with `activate_version` + `state.py model set`.

| Model | Max length | Price | A full run |
|---|---|---|---|
| **MiniMax H3 Max** (default) | 15s | $0.04/s | **$0.60** |
| Wan 3 Prime | 30s | $0.14/s | $2.80 at 20s |
| Gemini Omni Flash 1.1 | 10s | $0.10/s | $1.00 |

Length forces the choice. MiniMax unless you need more than 15 seconds.

## Requirements

ffmpeg · python 3.9+ · curl · git · [monid](https://monid.ai) (`npm install -g @monid-ai/cli`) ·
a Supagen account and workspace · Claude Code or Codex

## Layout

    AGENTS.md              the orchestrator contract — read this first
    CLAUDE.md              pointer to AGENTS.md
    ugckit                 command dispatcher
    .claude/skills/        one skill per stage
    scripts/               the tools the skills drive
      monid.sh             shared research plumbing — where rules 10-14 are enforced
      library.py           query the hook library rather than reading it
      templates.json       desired Supagen workspace state + known model limits
      prompts/             system instructions for the watching layer
      ui/                  the local review UI
    docs/                  annotated insert.json example
    research/              what the research phase found, one folder per project
    pipeline/              your work, stage by stage
