#!/usr/bin/env python3
"""Fill in .env by asking, so nobody has to find and edit the file.

    ./ugckit key

with nothing after it. It asks for each value in turn, hides what you type, and
writes the file. Taking no arguments is deliberate: a name after `key` reads like
a blank to fill in, and the value people fill it in with is their secret, which
then sits in their shell history forever.
"""
import getpass
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, ".env")

# name, what to call it, where to find it, how short is too short
KEYS = [
    ("SUPAGEN_API_KEY", "your Supagen API key",
     "Supagen dashboard -> Settings -> API keys", 20),
    ("SUPAGEN_WORKSPACE_ID", "your Supagen workspace id",
     "the long id in your Supagen dashboard web address", 36),
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


def clean(value):
    # People paste with the quotes around it, or a space on the end. Both give a
    # 401 later with nothing to point at the cause.
    return value.strip().strip('"').strip("'").strip()


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        known = {k for k, _, _, _ in KEYS}
        if arg in ("-h", "--help"):
            print("usage: ./ugckit key      (no arguments — it asks you for each value)")
            return 0
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
    for name, what, where, minlen in KEYS:
        have = existing.get(name, "")
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
              f"starts {value[:4]}…)\n")

    if changed:
        print(f"Written to .env — {GREEN}done{OFF}. Next, check everything works:\n")
        print("    ./ugckit doctor\n")
    else:
        print("Nothing changed.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
