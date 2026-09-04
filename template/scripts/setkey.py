#!/usr/bin/env python3
"""Write a value into .env without an editor, and without it reaching the shell
history, the terminal scrollback or the agent's transcript.

    scripts/setkey.py SUPAGEN_API_KEY

prompts for the value with echo off, then rewrites the file. Existing keys are
replaced in place; new ones are appended with a guaranteed newline before them --
`echo K=v >> .env` onto a file with no trailing newline welds two variables
together and the only symptom is a confusing 401.
"""
import getpass
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(ROOT, ".env")

ALLOWED = {
    "SUPAGEN_API_KEY": "Supagen API key — dashboard → Settings → API keys",
    "SUPAGEN_WORKSPACE_ID": "Supagen workspace id — the uuid in the dashboard URL",
}


def die(msg):
    sys.exit(f"\033[31m{msg}\033[0m")


def main():
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print("usage: ugckit key <NAME>\n\nnames:")
        for k, why in ALLOWED.items():
            print(f"  {k:<24} {why}")
        return 0 if len(sys.argv) == 2 else 2

    name = sys.argv[1].strip().upper()
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
        die(f"{name!r} is not a valid variable name")
    if name not in ALLOWED:
        print(f"note: {name} is not one of the keys ugckit reads "
              f"({', '.join(ALLOWED)}). Writing it anyway.")

    if not os.path.exists(ENV):
        example = os.path.join(ROOT, ".env.example")
        if os.path.exists(example):
            with open(example) as f:
                open(ENV, "w").write(f.read())
        else:
            open(ENV, "w").close()
        os.chmod(ENV, 0o600)
        print("created .env")

    print(f"\n{ALLOWED.get(name, name)}")
    print("Paste the value and press return. Nothing is echoed, and it is not")
    print("written to your shell history or shown to the agent.\n")
    try:
        value = getpass.getpass(f"{name}= ")
    except (EOFError, KeyboardInterrupt):
        die("\ncancelled — nothing written")

    # Paste often drags in a newline, a stray space, or the quotes people wrap
    # keys in when copying out of a doc. All three produce a 401 later.
    value = value.strip().strip('"').strip("'")
    if not value:
        die("empty value — nothing written")
    if "\n" in value or "\r" in value:
        die("that value contains a line break — copy just the key itself")

    with open(ENV) as f:
        lines = f.read().splitlines()

    pat = re.compile(rf"\s*(export\s+)?{re.escape(name)}\s*=")
    replaced = False
    for i, line in enumerate(lines):
        if pat.match(line):
            lines[i] = f"{name}={value}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{name}={value}")

    tmp = ENV + ".tmp"
    with open(tmp, "w") as f:
        f.write("\n".join(lines) + "\n")   # the trailing newline is the whole point
    os.chmod(tmp, 0o600)
    os.replace(tmp, ENV)
    os.chmod(ENV, 0o600)

    print(f"\n\033[32m✓\033[0m {name} {'updated' if replaced else 'added'} "
          f"({len(value)} chars, starts {value[:4]}…)")
    print("  next: ./ugckit doctor")
    return 0


if __name__ == "__main__":
    sys.exit(main())
