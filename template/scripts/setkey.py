#!/usr/bin/env python3
"""Fill in .env by asking, so nobody has to find and edit the file.

    ./ugckit key

with nothing after it. It asks for each secret in turn, hides what you type, and
writes the file. Taking no arguments is deliberate: a name after `key` reads like
a blank to fill in, and the value people fill it in with is their secret, which
then sits in their shell history forever.

The workspace id is not a secret and the user should never have to find it: the
agent reads it from `list_workspaces` over MCP and writes it with

    ./ugckit workspace <id>
"""
import getpass
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, ".env")

# name, what to call it, where to find it, how short is too short, required?
KEYS = [
    ("SUPAGEN_API_KEY", "your Supagen API key",
     "shown during Supagen onboarding, or: dashboard left menu -> Developer -> API keys", 20, True),
    # The research stages spend against this. Setup asks every user for it.
    ("MONID_API_KEY", "your Monid key",
     "https://app.monid.ai/access/api-keys  (create an account at app.monid.ai first)", 20, False),
]

RED, GREEN, DIM, OFF = "\033[31m", "\033[32m", "\033[2m", "\033[0m"


def die(msg):
    sys.exit(f"{RED}{msg}{OFF}")


def read_env():
    if not os.path.exists(ENV):
        return []
    with open(ENV) as f:
        return f.read().splitlines()


def write_env(lines):
    tmp = ENV + ".tmp"
    with open(tmp, "w") as f:
        f.write("\n".join(lines) + "\n")   # the trailing newline is the whole point
    os.chmod(tmp, 0o600)
    os.replace(tmp, ENV)
    os.chmod(ENV, 0o600)


def put(lines, name, value):
    pat = re.compile(rf"\s*(export\s+)?{re.escape(name)}\s*=")
    for i, line in enumerate(lines):
        if pat.match(line):
            lines[i] = f"{name}={value}"
            return lines, "updated"
    lines.append(f"{name}={value}")
    return lines, "added"


def register_monid(value):
    """The monid CLI keeps its own credential store and ignores the environment, so a
    key that only lives in .env does nothing for `monid run`. Register it here, in the
    one process that legitimately holds the value -- never through the agent."""
    if not shutil.which("monid"):
        print(f"{DIM}  monid CLI not installed yet -- when it is, run:  ./ugckit key  again{OFF}")
        return
    r = subprocess.run(["monid", "keys", "add", "-k", value, "-l", "ugckit"],
                       capture_output=True, text=True, env={**os.environ, "NO_COLOR": "1"})
    if r.returncode == 0:
        print(f"{GREEN}  registered with the monid CLI{OFF} (label: ugckit)")
    else:
        msg = (r.stderr or r.stdout).strip().splitlines()
        print(f"{RED}  could not register with the monid CLI:{OFF} {msg[-1] if msg else 'unknown error'}")
        print("  the research scripts will fail until it is -- try: ./ugckit key  again")


def clean(value):
    # People paste with the quotes around it, or a space on the end. Both give a
    # 401 later with nothing to point at the cause.
    return value.strip().strip('"').strip("'").strip()


def set_workspace(value):
    """Not a secret, so it may arrive on the command line -- from the agent, which got
    it from list_workspaces over MCP. Nobody should have to go looking for it."""
    value = clean(value)
    if not value or " " in value or len(value) < 20:
        die("that does not look like a workspace id (expected the long id list_workspaces returns)")
    if value.startswith(("sk_", "monid_")):
        die("that looks like an API key, not a workspace id -- keys go through: ./ugckit key")
    if not os.path.exists(ENV):
        example = os.path.join(ROOT, ".env.example")
        open(ENV, "w").write(open(example).read() if os.path.exists(example) else "")
        os.chmod(ENV, 0o600)
    lines, how = put(read_env(), "SUPAGEN_WORKSPACE_ID", value)
    write_env(lines)
    print(f"{GREEN}SUPAGEN_WORKSPACE_ID {how}{OFF} ({len(value)} characters)")
    return 0


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        known = {k for k, *_ in KEYS} | {"SUPAGEN_WORKSPACE_ID"}
        if arg in ("-h", "--help"):
            print("usage: ./ugckit key                (no arguments — it asks you for each secret)\n"
                  "       ./ugckit workspace <id>     (the agent sets this from list_workspaces)")
            return 0
        if arg == "--workspace":
            if len(sys.argv) < 3:
                die("usage: ./ugckit workspace <id>")
            return set_workspace(sys.argv[2])
        if arg in known:
            print(f"{DIM}note: you do not need to name the key. "
                  f"Just run: ./ugckit key{OFF}\n")
        else:
            # Almost certainly the secret itself, typed where the name went.
            die("Do not type your key on the command line — your terminal saves it\n"
                "in its history file, where anything on your machine can read it.\n\n"
                "Run this instead, with nothing after it:\n\n"
                "    ./ugckit key\n\n"
                "It will ask you for each value and hide what you type.\n\n"
                "Since the key is now in your history, treat it as leaked: create a\n"
                "new one in the Supagen dashboard and delete the old one.")

    if not sys.stdin.isatty():
        die("This needs a real terminal — it will not read values from a pipe.\n"
            "If you are a coding agent: do not run this. Tell the user to run\n"
            "    ./ugckit key\n"
            "in their own terminal, and wait for them. In Claude Code they can put\n"
            "! in front of it to run it inside the session.")

    if not os.path.exists(ENV):
        example = os.path.join(ROOT, ".env.example")
        open(ENV, "w").write(open(example).read() if os.path.exists(example) else "")
        os.chmod(ENV, 0o600)

    lines = read_env()
    existing = {}
    for line in lines:
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            existing[k.strip()] = v.strip()

    print("\nSetting up .env. Nothing you type is shown on screen, and none of it")
    print("is saved to your shell history.\n")

    changed = 0
    for name, what, where, minlen, required in KEYS:
        have = existing.get(name, "")
        if not required and not have:
            print(f"\n{name} — the research stages spend against it. Setup wants it; only skip")
            print("it if you know you will never run research from this folder.")
            if input("  Set it now? [Y/n] ").strip().lower() in ("n", "no"):
                print("  skipped.\n")
                continue
        if have:
            print(f"{name} is already set ({len(have)} characters).")
            if input("  Replace it? [y/N] ").strip().lower() not in ("y", "yes"):
                print("  kept.\n")
                continue

        print(f"\nPaste {what}.")
        print(f"{DIM}  Find it here: {where}")
        print(f"  Press return on an empty line to skip.{OFF}")
        try:
            value = clean(getpass.getpass("  paste here, then press return: "))
        except (EOFError, KeyboardInterrupt):
            print("\ncancelled.")
            break

        if not value:
            print("  skipped.\n")
            continue
        if len(value) < minlen:
            print(f"{RED}  That is only {len(value)} characters and {name} should be "
                  f"at least {minlen}.{OFF}")
            print("  Nothing was saved. Copy the whole value and run ./ugckit key again.\n")
            continue

        lines, how = put(lines, name, value)
        write_env(lines)
        changed += 1
        print(f"{GREEN}  saved{OFF} ({how}, {len(value)} characters, "
              f"starts {value[:4]}…)")
        if name == "MONID_API_KEY":
            register_monid(value)
        print()

    if changed:
        print(f"Written to .env — {GREEN}done{OFF}. Next, check everything works:\n")
        print("    ./ugckit doctor\n")
    else:
        print("Nothing changed.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
