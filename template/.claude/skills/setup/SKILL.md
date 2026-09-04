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
- **.env missing** → `./ugckit key` creates it (step 2).

Two tools are yellow `!`, not red, because only part of the pipeline needs them. Ask
the one question from AGENTS.md's quick start now — **a reference video, or a product,
niche or app name?** — because the answer decides whether these matter today:

- **monid missing** → `npm install -g @monid-ai/cli`. Needed for the research half
  (R1–R5). Skip it for a user who has a reference video.
- **node missing** → https://nodejs.org. Needed only for the Atlas, which is how a
  research user sees what was found. Same rule.

## 2. Credentials

Two values have to end up in `.env`: `SUPAGEN_API_KEY` and `SUPAGEN_WORKSPACE_ID`. A
research user needs a third, `MONID_API_KEY`, from https://monid.ai → Keys; the same
command asks for it and also registers it with the monid CLI, which keeps its own store
and ignores `.env`. `doctor.py` checks both places.

There is one command, and it takes no arguments:

    ./ugckit key

It asks for each value in turn and hides what the user types. **Give them exactly that,
character for character.** Do not write `./ugckit key SUPAGEN_API_KEY` — a name after
`key` reads like a blank to fill in, and what people fill it in with is the secret
itself, which then sits in their shell history.

**Do not tell them to "edit .env" or "open the file".** Many users are not in an editor
and will not know how.

**You cannot run this yourself, and must not try.** It exits non-zero when its input is
not a terminal, because for you to pipe a value in, the value has to be in your context
first — which is the thing being avoided. So:

1. Tell them where the values are: **API key** — Supagen dashboard → Settings → API
   keys. **Workspace id** — the long id in the dashboard web address. **Monid key**, if
   they are doing research — monid.ai → Keys; they also need credit there, a few
   dollars covers many teardowns.
2. Give them `./ugckit key`. In Claude Code they can put `!` in front of it to run it
   inside the session.
3. **Wait.** Do not move on until they say they are done.
4. Verify with `scripts/doctor.py` — never by reading `.env`.

Besides hiding the value, the command fixes the three things that silently break a
hand-edited `.env`: a missing trailing newline welding two variables into one, and the
quotes or trailing space people copy along with the key. All three show up later as a
401 with nothing pointing at the cause.

**Never ask them to paste the key into the chat, and never print it.** If you must
inspect `.env`, redact:

    sed -E 's/(sk_[A-Za-z0-9]{6})[A-Za-z0-9_-]*/\1***REDACTED***/g' .env

## 3. MCP

**Work out where you are running first, then give only the steps for that.** The user
may be in a terminal, or in a desktop app with no terminal at all. Do not read them a
list of four options.

The facts, so you do not get them wrong:

- The server is **`https://mcp.supagen.dev/mcp`, Streamable HTTP, OAuth 2.1**.
- There is **no npm package and no token to paste.** Any instruction mentioning
  `npx @supagen/mcp`, or an API key in a header, is wrong.
- `install.sh` already wrote `.mcp.json` and `.cursor/mcp.json` into the project, so in
  Claude Code and Cursor the server is registered. **Registered is not connected.**

### You cannot do the approval

It is a browser login as the user. You have no browser. What you *can* do is make the
client ask for it: **call `ping`.** If the connection is not approved, that call fails,
and the client itself shows a login or Authenticate button. Use that. Call `ping`
first, then tell them what they should now be seeing.

### Where they click

- **Claude Code** — restart it, then type `/mcp`, select supagen, choose Authenticate.
  The browser opens; approve; return to the terminal.
- **Cursor** — reload the window. The browser opens on first use.
- **Codex** — the block from `docs/mcp-setup.md` goes in `~/.codex/config.toml`; give
  them `./ugckit key`-style precision here too, one step at a time. Restart, approve.
- **A desktop app with no project folder** (Claude desktop, and similar) — the installer
  could not configure it. Settings → Connectors → Add custom connector → paste
  `https://mcp.supagen.dev/mcp` → save → Connect → approve in the browser.
- **Anything else** — give them the server URL and transport from `docs/mcp-setup.md`
  and tell them to look for Connectors, MCP or Integrations in settings.

### Then prove it

Call `ping`, then `list_workspaces`. If `list_workspaces` returns their workspace, MCP
is connected and you can continue. If the supagen tools are not available to you at all,
the client was started before the config existed — ask them to restart it. Do not
guess: `doctor.py` can see the config file but cannot see whether the login happened.

MCP manages templates only. Generation goes over curl (AGENTS.md rule 2), which is why
`SUPAGEN_API_KEY` is still needed after MCP works.

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

## 8. Tell the user what they have, and where they go next

Briefly: which templates were created, which model is active and what a run costs, how
to switch model. Then the fork, in one sentence each:

- **They have a reference video** → the `ingest` skill. Mention `ugckit ui` for review.
- **They have their own product** → the `product` skill (R0). It reads their website,
  document or repo and settles the niche.
- **They have a niche or an app name** → the `apps` skill (R1). Say what a first round
  costs before running it.

For either research path, say that after the first harvest the Atlas opens in their
browser (`ugckit atlas`) and that is where they will see what was found.
