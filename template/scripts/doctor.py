#!/usr/bin/env python3
"""Preflight. Run this before anything else, and any time something behaves oddly.

Checks tools, python deps, .env shape and live API auth. Never prints secret values --
only their length and prefix, so a mangled key is diagnosable without leaking it.

    scripts/doctor.py            # check everything
    scripts/doctor.py --quiet    # exit code only
"""
import json, os, shutil, subprocess, sys, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUIET = "--quiet" in sys.argv
FAIL, WARN = [], []


def say(*a):
    if not QUIET:
        print(*a)


def ok(label, detail=""):
    say(f"  \033[32m✓\033[0m {label}" + (f"  {detail}" if detail else ""))


def bad(label, fix):
    FAIL.append((label, fix))
    say(f"  \033[31m✗\033[0m {label}")


def warn(label, fix):
    WARN.append((label, fix))
    say(f"  \033[33m!\033[0m {label}")


say("\ntools")
for tool, fix in [
    ("ffmpeg",  "brew install ffmpeg   (or: apt install ffmpeg)"),
    ("ffprobe", "ships with ffmpeg"),
    ("curl",    "preinstalled on macOS and most Linux"),
    ("python3", "https://www.python.org/downloads/"),
    ("monid",   "npm install -g @monid-ai/cli   (research stages R1-R5)"),
    ("node",    "https://nodejs.org  (only the Atlas, `ugckit atlas`, needs it)"),
]:
    p = shutil.which(tool)
    if p:
        v = ""
        if tool == "node":
            try:
                v = subprocess.run([p, "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
                if int(v.lstrip("v").split(".")[0]) < 18:
                    warn(f"node {v} is too old for the Atlas", "need Node 18+ -- https://nodejs.org")
                    continue
            except Exception:
                pass
        if tool == "ffmpeg":
            try:
                out = subprocess.run([p, "-version"], capture_output=True, text=True, timeout=10).stdout
                v = out.split("\n")[0].split(" version ")[-1].split()[0]
            except Exception:
                pass
        ok(tool, v)
    elif tool in ("monid", "node"):
        warn(f"{tool} not found", fix)         # optional: only part of the pipeline needs it
    else:
        bad(f"{tool} not found", fix)

say("\npython environment")
VENV = os.path.join(ROOT, ".venv", "bin", "python3")
PY = VENV if os.path.exists(VENV) else sys.executable
if os.path.exists(VENV):
    ok(".venv", VENV)
else:
    bad(".venv missing", "python3 -m venv .venv && .venv/bin/pip install -r requirements.txt")

for mod, why in [("numpy", "frame maths"), ("cv2", "green-screen compositing"),
                 ("faster_whisper", "transcription"), ("fastapi", "the local UI"),
                 ("uvicorn", "the local UI")]:
    r = subprocess.run([PY, "-c", f"import {mod}"], capture_output=True)
    if r.returncode == 0:
        ok(mod, why)
    else:
        bad(f"{mod} missing ({why})", ".venv/bin/pip install -r requirements.txt")

say("\ncredentials")
ENV = os.path.join(ROOT, ".env")
env = {}
if not os.path.exists(ENV):
    bad(".env missing", "./ugckit key   -- it creates the file and asks you for the values")
else:
    raw = open(ENV).read()
    for i, line in enumerate(raw.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            bad(f".env line {i} has no '='", "each line must be KEY=value")
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    # The classic failure: `echo VAR=x >> .env` with no trailing newline on the previous
    # line welds two variables together. Catch it by shape, never by printing the value.
    for k, v in env.items():
        if len(v) > 120 and "=" in v:
            bad(f"{k} looks like two variables welded together ({len(v)} chars)",
                "./ugckit key  -- it rewrites the lines cleanly")

    for k, minlen in [("SUPAGEN_API_KEY", 20), ("SUPAGEN_WORKSPACE_ID", 20)]:
        v = env.get(k, "")
        if not v:
            bad(f"{k} not set", "./ugckit key" if k == "SUPAGEN_API_KEY" else
                "agent: list_workspaces over MCP, then  ./ugckit workspace <id>")
        elif len(v) < minlen:
            bad(f"{k} is only {len(v)} chars, expected >= {minlen}",
                "re-copy the whole value from Supagen, then ./ugckit key")
        else:
            ok(k, f"{len(v)} chars, starts {v[:6]}…")

    # The research half is optional -- a project that starts from a reference video the
    # user already has never touches Monid. Warn, never fail.
    mk = env.get("MONID_API_KEY", "")
    if not mk:
        warn("MONID_API_KEY not set", "the research stages need it -- key at "
                                      "https://app.monid.ai/access/api-keys, then ./ugckit key")
    elif not mk.startswith("monid_"):
        warn(f"MONID_API_KEY does not start with 'monid_' ({len(mk)} chars)",
             "expected monid_<stage>_<secret> -- re-copy it")
    else:
        ok("MONID_API_KEY", f"{len(mk)} chars, starts {mk[:12]}…")
        # The CLI has its own store; a key only in .env runs nothing.
        if shutil.which("monid"):
            r = subprocess.run(["monid", "keys", "list"], capture_output=True, text=True,
                               env={**os.environ, "NO_COLOR": "1"})
            if r.returncode != 0 or "monid_" not in (r.stdout + r.stderr):
                warn("monid CLI has no stored key", "./ugckit key  -- re-enter the Monid key; "
                                                    "it registers it with the CLI as well")
            else:
                ok("monid CLI has a stored key")

    lib = os.path.expanduser(env.get("LIBRARY_DIR", ""))
    if not lib:
        warn("LIBRARY_DIR not set", "only needed by the `originate` skill (research-led "
                                    "stage 5) -- point it at a research corpus checkout")
    elif not os.path.exists(os.path.join(lib, "library", "hooks.jsonl")):
        warn(f"LIBRARY_DIR has no library/hooks.jsonl ({lib})", "check the path")
    else:
        n = sum(1 for _ in open(os.path.join(lib, "library", "hooks.jsonl")))
        ok("LIBRARY_DIR", f"{n} hooks")

say("\nlive auth")
key, ws = env.get("SUPAGEN_API_KEY"), env.get("SUPAGEN_WORKSPACE_ID")
if key and ws:
    # POST /api/v1/files is the cheapest authenticated call that actually works.
    # (GET /api/v1/files returns 401 even with a valid key -- do not use it as a probe.)
    boundary = "----ugckitprobe"
    body = b""
    for name, val in [("workspace_id", ws), ("purpose", "invocation_input")]:
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{val}\r\n".encode()
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
             f"filename=\"probe.txt\"\r\nContent-Type: text/plain\r\n\r\nok\r\n").encode()
    body += f"--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://supagen.dev/api/v1/files", data=body, method="POST",
                                 headers={"Authorization": f"Bearer {key}",
                                          "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            json.loads(r.read())
            ok("Supagen API key accepted")
    except urllib.error.HTTPError as e:
        if e.code == 401:
            bad("Supagen rejected the API key (401)",
                "check .env for a mangled key -- see the welded-variable check above")
        else:
            bad(f"Supagen returned HTTP {e.code}", e.read()[:200].decode(errors="replace"))
    except Exception as e:
        warn(f"could not reach Supagen ({e})", "check your network, then re-run")
else:
    warn("skipping live auth check", "credentials incomplete")

mk = env.get("MONID_API_KEY", "")
if mk:
    # whoami is the cheapest authenticated call; balance is worth printing because
    # every research stage spends against it and an empty wallet fails as an HTML
    # error page that reads like something else entirely (AGENTS.md rule 13).
    def monid_get(path):
        req = urllib.request.Request(f"https://api.monid.ai/v1{path}",
                                     headers={"Authorization": f"Bearer {mk}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    try:
        who = monid_get("/auth/whoami")
        ws, user = who.get("workspace") or {}, who.get("user") or {}
        ok("Monid API key accepted",
           ws.get("name") or ws.get("slug") or user.get("email") or user.get("userId") or "")
        try:
            b = (monid_get("/wallet/balance") or {}).get("balance") or {}
            val = b.get("value")
            if val is not None:
                (ok if val > 0.10 else warn)(
                    f"Monid balance ${val:.2f} {b.get('currency','')}".rstrip(),
                    "top up at https://api.monid.ai/wallet")
        except Exception:
            pass                              # balance is a nicety, not a gate
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            bad(f"Monid rejected the API key ({e.code})",
                "check .env for a mangled key -- see the welded-variable check above")
        else:
            bad(f"Monid returned HTTP {e.code}", e.read()[:200].decode(errors="replace"))
    except Exception as e:
        warn(f"could not reach Monid ({e})", "check your network, then re-run")

say("\nMCP")
# We can see whether the server is configured. We cannot see whether the user has
# approved the OAuth connection in their browser -- only calling a tool proves that.
MCP_FILES = [(".mcp.json", "Claude Code"), (".cursor/mcp.json", "Cursor")]
SERVER = "https://mcp.supagen.dev/mcp"
found = []
for rel, agent in MCP_FILES:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        continue
    try:
        cfg = json.load(open(path)).get("mcpServers", {}).get("supagen", {})
    except Exception:
        warn(f"{rel} is not valid JSON", "delete it and re-run install.sh")
        continue
    if cfg.get("url") == SERVER:
        found.append(agent)
    else:
        warn(f"{rel} points somewhere unexpected",
             f"the server is {SERVER} over Streamable HTTP -- see docs/mcp-setup.md")
if found:
    ok("supagen server configured", " and ".join(found))
    warn("cannot verify OAuth approval from here",
         "in the agent: Claude Code /mcp, Cursor reload -- then call ping")
else:
    warn("no MCP config found",
         "see docs/mcp-setup.md -- server is " + SERVER + " over Streamable HTTP")

say("\ntemplates")
TPL = os.path.join(ROOT, "scripts", "templates.json")
state_path = os.path.join(ROOT, "pipeline", "state", "pipeline.json")
setup_done = False
if os.path.exists(state_path):
    try:
        setup_done = json.load(open(state_path)).get("setup", {}).get("status") == "done"
    except Exception:
        pass
if setup_done:
    ok("Supagen templates registered", "per pipeline.json")
else:
    warn("Supagen templates not yet set up",
         "run the `setup` skill -- it creates them in your workspace via MCP")

say("")
if FAIL:
    say(f"\033[31m{len(FAIL)} blocking problem(s):\033[0m")
    for label, fix in FAIL:
        say(f"  {label}\n      → {fix}")
if WARN:
    say(f"\033[33m{len(WARN)} warning(s):\033[0m")
    for label, fix in WARN:
        say(f"  {label}\n      → {fix}")
if not FAIL and not WARN:
    say("\033[32meverything checks out.\033[0m")
say("")
sys.exit(1 if FAIL else 0)
