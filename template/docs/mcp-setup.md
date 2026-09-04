# Connecting the Supagen MCP server

ugckit talks to Supagen two different ways, and only one of them is MCP:

- **MCP** — managing templates: `list_models`, `create_template`, `create_version`,
  `activate_version`. Short calls, done at setup and when switching model.
- **curl** — generation. A render runs for minutes and MCP tool calls abort at 60
  seconds, so `scripts/generate.sh` goes over REST with `SUPAGEN_API_KEY`.

So you need **both**: the MCP server connected *and* the key in `.env`. Neither
substitutes for the other.

## The server

    Server URL:  https://mcp.supagen.dev/mcp
    Transport:   Streamable HTTP
    Auth:        OAuth 2.1, registered automatically

There is **no token to copy and no npm package to install.** You add the URL, and the
first time your agent uses it, it opens a browser for you to approve the connection.
Supagen never shows you a token and you never paste one.

## Claude Code

`install.sh` already wrote `.mcp.json` in your project directory, so if you started
Claude Code from that directory the server is registered. Otherwise:

    claude mcp add supagen --transport http "https://mcp.supagen.dev/mcp"

Then **restart Claude Code and run `/mcp`.** It opens your browser to approve the
connection. Approve it, and the tools appear.

`.mcp.json` is project-scoped — it applies in this directory only. For every project,
add `--scope user` to the command above.

## Cursor

`install.sh` already wrote `.cursor/mcp.json`. **Reload Cursor.** On first use it opens
your browser to approve the connection.

For every project instead of just this one, put the same block in your global MCP
settings (Settings → MCP → Add).

## Claude desktop app, ChatGPT/Codex app, and other apps with no project folder

Desktop apps do not read a config file from your project, so the installer cannot set
them up. You add the server in the app's own settings:

**Claude desktop app** — Settings → Connectors → **Add custom connector**. Paste
`https://mcp.supagen.dev/mcp` as the URL, save, then click **Connect** next to it. Your
browser opens; approve, and it says Connected.

**Other apps** — look in Settings for **Connectors**, **MCP**, or **Integrations**, then
for "add server by URL" or "custom connector". Paste the same URL. Approval opens in
your browser.

If you cannot find it, use Claude Code, Cursor or Codex instead — the installer sets
those up for you.

## Codex

Codex reads `~/.codex/config.toml`. Add:

    [mcp_servers.supagen]
    url = "https://mcp.supagen.dev/mcp"

Then restart Codex and approve in the browser on first use.

Codex's MCP support has changed shape across releases — **check `codex mcp --help`
before assuming this works**, since some versions want the server added through that
subcommand, and older ones speak stdio only. On a stdio-only version, bridge it:

    [mcp_servers.supagen]
    command = "npx"
    args = ["-y", "mcp-remote", "https://mcp.supagen.dev/mcp"]

## Any other agent

Any MCP client that speaks Streamable HTTP can connect — point it at the server URL
above and check your agent's own MCP documentation for how it adds an HTTP transport
server. Registration and approval happen over OAuth, so there is no key to copy.

## Who does what

| | Who | Why |
|---|---|---|
| Writes the config file | `install.sh` | plain file write, no login involved |
| Tells you which steps apply to your agent | the agent, in the `setup` skill | it knows which client it is running in |
| Approves the OAuth connection | **you, in your browser** | it is signed in as you; the agent has no browser and no session |
| Confirms it worked | the agent | by calling `ping` — the only real proof |

Same split for credentials: the agent prints `./ugckit key`, **you** run it. It takes no
arguments, so there is no blank to fill in with your key by mistake, and it refuses a
piped value so an agent cannot feed it a key it should never have been given.

## Checking it worked

Ask your agent to call `ping`, then `list_workspaces`. If `list_workspaces` returns your
workspace, MCP is connected. If the tools aren't there at all, the agent was started
before the config was written — restart it.

`./ugckit doctor` reports whether the config file exists, but it cannot see whether your
agent has approved the OAuth connection. Only calling a tool proves that.
