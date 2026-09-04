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
]:
    p = shutil.which(tool)
    if p:
        v = ""
        if tool == "ffmpeg":
            try:
                out = subprocess.run([p, "-version"], capture_output=True, text=True, timeout=10).stdout
                v = out.split("\n")[0].split(" version ")[-1].split()[0]
            except Exception:
                pass
        ok(tool, v)
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

    for k, minlen in [("SUPAGEN_API_KEY", 20), ("SUPAGEN_WORKSPACE_ID", 36)]:
        v = env.get(k, "")
        if not v:
            bad(f"{k} not set", "./ugckit key")
        elif len(v) < minlen:
            bad(f"{k} is only {len(v)} chars, expected >= {minlen}",
                "re-copy the whole value from Supagen, then ./ugckit key")
        else:
            ok(k, f"{len(v)} chars, starts {v[:6]}…")

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
