---
name: setup
description: One-time hygiene setup — verify tools and credentials, then create the required Supagen templates in the user's workspace. Run this before any other stage; nothing works until it is done.
---

# Stage 0 — setup

Runs once per machine + workspace, not once per project. Work through it in order and
stop at the first thing that fails. Do not proceed to any other stage until
`scripts/state.py` reports setup done.

## 1. Preflight

    scripts/doctor.py

Fix everything it marks with a red ✗ before continuing. Common cases:

- **ffmpeg missing** → `brew install ffmpeg` (macOS) or `apt install ffmpeg`.
- **python deps missing** → `.venv/bin/pip install -r requirements.txt`.
- **.env missing** → `cp .env.example .env`, then tell the user to paste their key.

## 2. Credentials

The user needs two values in `.env`: `SUPAGEN_API_KEY` and `SUPAGEN_WORKSPACE_ID`.

**Give them the exact command. Do not tell them to "edit .env" or "open the file" —
plenty of people are not in an IDE and have no idea how.** Say this:

    ./ugckit key SUPAGEN_API_KEY
    ./ugckit key SUPAGEN_WORKSPACE_ID

Each prompts for the value with echo off and writes it in place. This is the only
route you should offer, because it also handles the three things that silently break
a hand-edited `.env`: a missing trailing newline welding two variables together, the
quotes people copy along with the key, and a stray trailing space.

Where the values come from:

- **API key** — Supagen dashboard → Settings → API keys.
- **Workspace id** — the uuid in the dashboard URL, or `list_workspaces` over MCP once
  it is connected.

**Never ask them to paste the key into the chat, and never print it.** If you must
inspect `.env`, redact:

    sed -E 's/(sk_[A-Za-z0-9]{6})[A-Za-z0-9_-]*/\1***REDACTED***/g' .env

## 3. MCP

**Read `docs/mcp-setup.md` and give the user the section for the agent they are
actually running — not all of them.** You know which one you are.

The essentials, so you do not get them wrong:

- The server is **`https://mcp.supagen.dev/mcp`, Streamable HTTP, OAuth 2.1**.
- There is **no npm package to install and no token to paste.** Any instruction
  involving `npx @supagen/mcp` or an API key in a header is wrong.
- `install.sh` already wrote `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor)
  into the project directory, so in those two the server is usually already registered.
- What is *not* automatic is **approval**. The user has to approve the OAuth connection
  in their browser once:
  - **Claude Code** — restart, then run `/mcp`.
  - **Cursor** — reload; the browser opens on first use.
  - **Codex** — add the block from `docs/mcp-setup.md` to `~/.codex/config.toml`,
    restart, approve on first use.
  - **Anything else** — give them the server URL and transport from the doc.

Then prove it: call `ping`, then `list_workspaces`. If the tools are not available to
you at all, the agent was started before the config existed — ask the user to restart it.
If `list_workspaces` returns their workspace, MCP is connected.

MCP is for **managing templates only**. Generation goes over curl (AGENTS.md rule 2),
which is why the API key in `.env` is still required even once MCP works.

## 4. Ask which model

Show the user the choice before creating anything. All three are text-to-video;
they differ in length, price and quality:

| Model | Max | Price | A full run | Notes |
|---|---|---|---|---|
| **MiniMax H3 Max** *(default)* | 15s | $0.04/s | **$0.60** | cheapest by far, 768p, tuned for prompt adherence |
| Wan 3 Prime | 30s | $0.14/s | $2.80 at 20s | the only one that goes past 15s |
| Gemini Omni Flash 1.1 | 10s | $0.10/s | $1.00 | best measured quality per second, but very short |

Recommend MiniMax H3 Max unless they need more than 15 seconds. Ask how long their
piece is first — length is what actually forces the choice.

## 5. Create the templates — the part that actually matters

Read `scripts/templates.json`. It is the desired state. **Two templates, and the
generation one carries a version per model** — switching model later is
`activate_version`, not a new template.

1. `list_templates`. Skip any template whose slug already exists.
2. `list_models` to resolve each `model_slug` → a real model id. **Resolve by slug; the
   `model_id_hint` may be stale.**
3. `create_template` with the given name, slug and output_type.
4. `create_version` for **every** version listed, so switching later costs nothing:
   - **Watching layer**: `system_instructions` is the full contents of
     `scripts/prompts/watching-layer.txt`; set temperature and max_tokens as specified.
   - **Generation versions**: pass `video_settings` exactly as written. Leave
     `system_instructions` unset and `variables` empty — messages-only, so the prompt is
     sent once and its quotes are not HTML-escaped (rule 4).
   - `duration` must be `null` with the integer inside `extensions` (rule 6). Copying
     the integer into `duration` is the commonest way to break this.
5. `activate_version` on the model the user chose.

## 6. Record the choice in BOTH places

    scripts/state.py model set <model-slug> <duration-seconds>

This is not bookkeeping. **The REST invoke endpoint ignores `version_number` and always
runs whatever version is ACTIVE** — tested: a request for version 99, which does not
exist, ran the active version anyway. So Supagen decides *which model runs* and the state
file decides *what cost is quoted and what duration cap is enforced*. If they drift apart,
`generate.sh` quotes the wrong price for the wrong model.

Changing model later is always both:

    activate_version(...)                                  # over MCP
    scripts/state.py model set <slug> <seconds>            # locally

## 7. Record setup as done

    scripts/state.py set - setup done

Then re-run `scripts/doctor.py` and confirm it is clean.

## 8. Tell the user what they have

Briefly: which templates were created, which model is active and what a run costs, how
to switch model, and that they can now run the `ingest` skill with a reference video.
Mention `ugckit ui`.
