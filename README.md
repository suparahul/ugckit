# ugckit

Give it a reference video. Get back your own version of it — same structure, your script,
your character, optionally with a real app demo playing on a phone in the shot.

Or give it your product, a niche or an app name. It works out the niche, finds up to five
apps in it that promote on TikTok, finds who really promotes each one, pulls their content,
transcribes the on-screen hook off every post, and writes one teardown per app. The
best-performing post becomes the reference for the recreation pipeline, or the teardowns
become the brief for a script written from scratch. Niche in, finished video out.

It is an agent, a set of skills, the scripts they drive, and a local review UI. You talk
to the agent; it runs the pipeline.

## The easiest way in

Open any coding agent — Claude Code, Cursor, Codex — and paste this. It installs
everything and walks you through the rest, one step at a time.

```
Set up ugckit for me in a new folder called organic-factory, then take me through setup.

1. Run exactly this in the terminal:
   curl -fsSL https://raw.githubusercontent.com/suparahul/ugckit/main/install.sh | sh -s -- organic-factory

2. Go into the organic-factory folder, read AGENTS.md, and follow it.

3. Read .claude/skills/setup/SKILL.md in that folder and do everything it
   says, in order. Install and set up everything it names, then stop and ask
   me whether I want to generate from a reference video or start research.

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

    curl -fsSL https://raw.githubusercontent.com/suparahul/ugckit/main/install.sh | sh -s -- organic-factory

Or from a clone:

    git clone https://github.com/suparahul/ugckit && cd ugckit
    ./install.sh ~/organic-factory

The installer checks for ffmpeg, python 3.9+, curl and git, scaffolds the project,
creates a `.venv`, installs dependencies, and writes the Supagen MCP config. It is
idempotent — re-running upgrades the scripts and skills and never touches your `.env`,
your prompts, or anything you have generated.

### Upgrading

Run the same install command again, pointed at the same folder — from inside it,
`sh -s -- .`. It replaces the scripts, the skills, `AGENTS.md` and the Atlas, removes
anything this version retired, and never touches `.env`, your prompts, or anything you
have generated or scraped. Then `./ugckit doctor`. If you set a Monid key before this
version, doctor will tell you if the monid CLI still needs it: run `./ugckit key` once
more and re-enter it — it now registers the key with the CLI as well.

## Then

    cd ~/organic-factory
    ./ugckit key                        # asks for your two secrets; the agent sets the workspace id
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
| R0 product | read your website, doc or repo; write what the product is and which niche it is in | — |
| R1 apps | keyword searches in rounds, expanding the keywords each round, until five apps are found | ~$0.04 a keyword |
| R2 network | per app, the handles that really promote it — with evidence, or rejected | ~$0.02 a search |
| R3 harvest | metrics, cover frames, and the on-screen hook off every cover | ~$0.02 an account |
| R4 deepen | per app, top 5 accounts by views, their best posts as video or slides | free — reuses R3 |
| R5 teardown | one thirteen-heading analysis per app, then hand the winner to stage 1 | — |

The unit of research is the app. A niche is a short phrase — `cat care`, `looksmaxxing`.

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

## Two screens

- **Atlas** (`./ugckit atlas`, http://localhost:3210) — the research half. Opens after the
  first harvest and after each teardown.
- **Review UI** (`./ugckit ui`, http://127.0.0.1:7878) — the recreation half. Opens when a
  prompt exists, after every generation, and at delivery.

The agent starts both at the right moment and hands you the link.

## Two ways in

- **You have a reference video.** Stage 1 measures it, and stage 5 `script` writes the
  prompt from those measurements.
- **You have a product, a niche or an app name.** R0 works out the niche, R1 finds the
  apps, R2–R5 analyse how each one is promoted. Then either hand the best post to stage 1
  and carry on as above, or skip the reference half entirely and let stage 5 `originate`
  write the prompt from the teardowns and the hook library.

Both meet at stage 5, and stages 6–9 do not know or care which route was taken.

## Three flows

Selected by which files exist in `pipeline/05-prompt/<project>/`:

- `prompt.txt` — **simple**: text-to-video, done.
- `+ insert.json` — **complex**: generate a green-screen plate, then composite a real
  screen recording onto the phone, with the thumb correctly occluding it.
- `+ refs.json` — **referenced**: hand reference clips to the model. Rarely what you want;
  read rule 1 in `AGENTS.md` first.

## The Atlas

    ./ugckit atlas     # http://localhost:3210

Everything the research half scraped, on one surface: an orb with one cluster per app, a
front door per app with its whole network in one carousel and the thirteen-heading
teardown, a dossier per account, a page per post with the video or the slides and the
verbatim hook, and threads that pull the same hook across every app you studied. It reads
`research/` in place and starts empty; every app you harvest appears on the next run.
Needs Node 18+, which nothing else in ugckit does. Lifted from the organic-social Atlas.

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
Node 18+ for the Atlas · a Supagen account and workspace · Claude Code or Codex

## Layout

    AGENTS.md              the orchestrator contract — read this first
    CLAUDE.md              pointer to AGENTS.md
    ugckit                 command dispatcher
    .claude/skills/        one skill per stage
    scripts/               the tools the skills drive
      monid.sh             shared research plumbing — where rules 10-14 are enforced
      apps.sh network.sh   R1 and R2: find the apps, then who promotes each one
      library.py           query the hook library rather than reading it
      templates.json       desired Supagen workspace state + known model limits
      prompts/             system instructions for the watching layer
      ui/                  the local review UI
    docs/                  annotated insert.json example
    atlas/                 the research browser — `ugckit atlas`, Node 18+
    research/              what the research phase found: <project>/<app>/<handle>/
    pipeline/              your work, stage by stage
