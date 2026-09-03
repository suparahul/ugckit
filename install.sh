#!/usr/bin/env bash
# ugckit installer — scaffolds a video recreation project in the current directory.
#
#   ./install.sh [target-dir]                                    # from a clone
#   curl -fsSL <raw-url>/install.sh | sh -s -- my-project        # standalone
#
# Idempotent: re-running upgrades scripts and skills and never touches your .env,
# your prompts or anything you have generated.
set -euo pipefail

REPO="${UGCKIT_REPO:-https://github.com/suparahul/ugckit}"
BRANCH="${UGCKIT_BRANCH:-main}"
TARGET="${1:-.}"

# Two ways in: run from a clone (template/ sits next to this script), or piped straight
# from curl, in which case there is no template/ and we fetch one into a temp dir.
SELF_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
if [ -n "$SELF_DIR" ] && [ -d "$SELF_DIR/template" ]; then
  SRC="$SELF_DIR/template"
  VERSION="$(cat "$SELF_DIR/VERSION" 2>/dev/null || echo dev)"
else
  command -v git >/dev/null 2>&1 || { echo "git is required to bootstrap; install it first" >&2; exit 1; }
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "fetching ugckit from $REPO ..."
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/ugckit" >/dev/null 2>&1 \
    || { echo "could not clone $REPO (branch $BRANCH)" >&2; exit 1; }
  SRC="$TMP/ugckit/template"
  VERSION="$(cat "$TMP/ugckit/VERSION" 2>/dev/null || echo dev)"
fi

b()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
no() { printf '  \033[31m✗\033[0m %s\n' "$*"; }
hm() { printf '  \033[33m!\033[0m %s\n' "$*"; }

echo
b "ugckit $VERSION"
echo

# ---------------------------------------------------------------- prerequisites
b "checking prerequisites"
MISSING=0
need() {
  if command -v "$1" >/dev/null 2>&1; then ok "$1"; else no "$1 not found — $2"; MISSING=1; fi
}
need ffmpeg  "brew install ffmpeg   (macOS)  |  sudo apt install ffmpeg   (Debian/Ubuntu)"
need ffprobe "ships with ffmpeg"
need curl    "preinstalled on macOS and most Linux"
need git     "https://git-scm.com/downloads"

if command -v python3 >/dev/null 2>&1; then
  PYV=$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')
  if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)'; then
    ok "python3 $PYV"
  else
    no "python3 $PYV is too old — need 3.9+"; MISSING=1
  fi
else
  no "python3 not found — https://www.python.org/downloads/"; MISSING=1
fi

if [ "$MISSING" = 1 ]; then
  echo
  no "install the missing tools above, then re-run."
  echo
  exit 1
fi

# ---------------------------------------------------------------- scaffold
echo
b "scaffolding into $TARGET"
mkdir -p "$TARGET"
DEST="$(cd "$TARGET" && pwd)"

if [ "$DEST" = "$SRC" ]; then
  no "refusing to install the template over itself"; exit 1
fi

# Files we replace on upgrade: code and instructions.
# Files we never clobber: anything the user authored or generated.
copy_managed() {
  rel="$1"
  mkdir -p "$DEST/$(dirname "$rel")"
  cp "$SRC/$rel" "$DEST/$rel"
}
copy_once() {
  rel="$1"
  if [ -e "$DEST/$rel" ]; then hm "kept your $rel"; return; fi
  mkdir -p "$DEST/$(dirname "$rel")"
  cp "$SRC/$rel" "$DEST/$rel"
}

( cd "$SRC" && find scripts .claude docs -type f ) | while read -r rel; do
  copy_managed "$rel"
done
ok "scripts, skills and docs"

for f in AGENTS.md CLAUDE.md ugckit; do copy_managed "$f"; done
ok "AGENTS.md, CLAUDE.md, ugckit"

for f in .env.example .gitignore requirements.txt; do copy_once "$f"; done

( cd "$SRC" && find pipeline -type d ) | while read -r d; do
  mkdir -p "$DEST/$d"
  [ -f "$DEST/$d/.gitkeep" ] || touch "$DEST/$d/.gitkeep"
done
ok "pipeline/ directories"

chmod +x "$DEST/ugckit" "$DEST"/scripts/*.sh "$DEST"/scripts/*.py 2>/dev/null || true

if [ ! -f "$DEST/.env" ]; then
  cp "$SRC/.env.example" "$DEST/.env"
  ok ".env created from template (empty — you fill it in)"
else
  hm "kept your existing .env"
fi

# ---------------------------------------------------------------- python env
echo
b "python environment"
if [ ! -d "$DEST/.venv" ]; then
  python3 -m venv "$DEST/.venv"
  ok "created .venv"
else
  ok ".venv already present"
fi
"$DEST/.venv/bin/pip" install --quiet --upgrade pip
echo "  installing dependencies (faster-whisper and opencv are large; this takes a minute)"
if "$DEST/.venv/bin/pip" install --quiet -r "$DEST/requirements.txt"; then
  ok "dependencies installed"
else
  no "dependency install failed — run: .venv/bin/pip install -r requirements.txt"
fi

# ---------------------------------------------------------------- mcp
echo
b "Supagen MCP"
if command -v claude >/dev/null 2>&1; then
  if claude mcp list 2>/dev/null | grep -qi supagen; then
    ok "already configured"
  else
    hm "not configured. Register it with:"
    echo "      claude mcp add supagen -- npx -y @supagen/mcp"
    echo "    (template management runs over MCP; generation runs over curl)"
  fi
else
  hm "claude CLI not found — install it, or use codex, which reads AGENTS.md too"
fi

# ---------------------------------------------------------------- git
if [ ! -d "$DEST/.git" ] && command -v git >/dev/null 2>&1; then
  ( cd "$DEST" && git init -q ) && ok "git repository initialised"
fi

# ---------------------------------------------------------------- done
cat <<EOF

$(b "installed.")

  Next:

    1.  cd $TARGET
    2.  put your Supagen key in .env      (SUPAGEN_API_KEY, SUPAGEN_WORKSPACE_ID)
    3.  ./ugckit doctor                   confirm everything is wired up
    4.  claude                            the agent reads AGENTS.md and takes over
                                          — ask it to run the setup skill first

  The agent drives the pipeline. You mostly watch, review and give feedback:

    ./ugckit ui                           review UI at http://127.0.0.1:7878

  Setup creates Supagen templates in your workspace. Nothing generates until that
  is done — the setup skill walks you through it.

EOF
