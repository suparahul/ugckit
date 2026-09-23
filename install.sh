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
  # The whole history without the file contents (they are fetched when needed): an upgrade
  # looks up the version of a file the last install shipped, to merge the user's changes.
  git clone --filter=blob:none --branch "$BRANCH" "$REPO" "$TMP/ugckit" >/dev/null 2>&1 \
    || git clone --depth 1 --branch "$BRANCH" "$REPO" "$TMP/ugckit" >/dev/null 2>&1 \
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
# Optional: absence is reported but never blocks the install.
want() {
  if command -v "$1" >/dev/null 2>&1; then ok "$1"; else hm "$1 not found — $2"; fi
}
need ffmpeg  "brew install ffmpeg   (macOS)  |  sudo apt install ffmpeg   (Debian/Ubuntu)"
need ffprobe "ships with ffmpeg"
need curl    "preinstalled on macOS and most Linux"
need git     "https://git-scm.com/downloads"
want monid   "optional, only the research stages use it — npm install -g @monid-ai/cli"
want node    "optional, only the Atlas (ugckit atlas) needs it — https://nodejs.org"

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
# A ugckit install is a folder with AGENTS.md, .claude/skills and the ugckit file.
is_kit() { [ -e "$1/AGENTS.md" ] && [ -d "$1/.claude/skills" ] && [ -e "$1/ugckit" ]; }

# Data is a project under research/, an app under apps/, or the pipeline ledger.
has_data() {
  [ -n "$(find "$1/research" "$1/apps" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ] \
    || [ -f "$1/pipeline/state/pipeline.json" ]
}

# The upgrade trap: running the install command with the folder name as the argument
# while already inside that folder would make <name>/<name> and upgrade the empty copy.
# If this folder is already a ugckit install and the argument names nothing that exists,
# or names only the empty nested copy an earlier run made, the argument was the folder we
# are in. An existing install elsewhere is used as named.
if [ "$TARGET" != "." ] && is_kit "."; then
  if ! [ -e "$TARGET" ]; then
    hm "this folder is already a ugckit install and $TARGET does not exist here — upgrading this folder"
    TARGET="."
  elif [ "$TARGET" = "$(basename "$PWD")" ] && is_kit "$TARGET" && ! has_data "$TARGET"; then
    hm "this folder is already a ugckit install and $TARGET is only its empty nested copy — upgrading this folder"
    TARGET="."
  fi
fi

echo
b "scaffolding into $TARGET"
mkdir -p "$TARGET"
DEST="$(cd "$TARGET" && pwd)"

# A nested copy from an earlier run of that trap: <name>/<name>, a ugckit install with
# no data in it. Say so; the user removes it, not the installer.
NESTED="$DEST/$(basename "$DEST")"
if [ -d "$NESTED" ] && is_kit "$NESTED" && ! has_data "$NESTED"; then
  hm "found a nested copy at $NESTED (a ugckit install with no research, pipeline or apps data) — you can remove it"
fi

if [ "$DEST" = "$SRC" ]; then
  no "refusing to install the template over itself"; exit 1
fi

# An upgrade is the same command in the same folder. A managed file the user changed
# (an atlas/ tweak, a reworded skill, an app's own feature) is copied to
# .ugckit-backup/<old version>/<path>, and then it is not replaced but merged: the
# kit's changes since the version the last install shipped go into the user's file,
# and the user's changes stay. Where the two touch the same lines, the user's file is
# left as it is and the kit's version is written beside it as <path>.ugckit-new.
# "Changed by the user" is decided against .ugckit-manifest, the checksums of the files
# the previous install shipped; a folder installed before the manifest existed falls
# back to "differs from the file shipping now", which also counts the kit's own updates.
FIRST=1; [ -e "$DEST/AGENTS.md" ] && FIRST=0
OLD="$(cat "$DEST/.ugckit-version" 2>/dev/null || echo unknown)"
BACKUP="$DEST/.ugckit-backup/$OLD"
OLDMAN="$DEST/.ugckit-manifest"
SAVED="$(mktemp)"; NEWMAN="$(mktemp)"; KEPT="$(mktemp)"; MERGED="$(mktemp)"; CLASH="$(mktemp)"
sum() { cksum < "$1" | cut -d' ' -f1; }

# The kit's git history (the clone this installer runs from), to find the version of a
# file that the last install shipped: the one whose checksum the manifest holds.
KITGIT=""
if git -C "$SRC/.." rev-parse --git-dir >/dev/null 2>&1; then KITGIT="$(cd "$SRC/.." && pwd)"; fi
base_of() {  # <rel> <checksum> -> that version's content on stdout; fails when not found
  [ -n "$KITGIT" ] || return 1
  for c in $(git -C "$KITGIT" log --format=%H -- "template/$1" 2>/dev/null); do
    if [ "$(git -C "$KITGIT" show "$c:template/$1" 2>/dev/null | cksum | cut -d' ' -f1)" = "$2" ]; then
      git -C "$KITGIT" show "$c:template/$1"; return 0
    fi
  done
  return 1
}

# A managed file the user changed, in a folder with a manifest: keep it, merge the kit's
# changes into it, or leave it and put the kit's version beside it.
keep_or_merge() {
  rel="$1"; shipped="$2"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp "$DEST/$rel" "$BACKUP/$rel"
  base="$(mktemp)"
  if base_of "$rel" "$shipped" > "$base"; then
    if cmp -s "$base" "$SRC/$rel"; then
      echo "$rel" >> "$KEPT"                       # the kit did not change it: nothing to do
    else
      merged="$(mktemp)"; cp "$DEST/$rel" "$merged"
      if git merge-file -q "$merged" "$base" "$SRC/$rel" 2>/dev/null; then
        cp "$merged" "$DEST/$rel"; echo "$rel" >> "$MERGED"
      else
        cp "$SRC/$rel" "$DEST/$rel.ugckit-new"; echo "$rel" >> "$CLASH"
      fi
      rm -f "$merged"
    fi
  else
    cp "$SRC/$rel" "$DEST/$rel.ugckit-new"; echo "$rel" >> "$CLASH"   # the shipped version is not in the history
  fi
  rm -f "$base"
}

# Files we replace on upgrade: code and instructions.
# Files we never clobber: anything the user authored or generated.
copy_managed() {
  rel="$1"
  mkdir -p "$DEST/$(dirname "$rel")"
  if [ "$FIRST" = 0 ] && [ -f "$DEST/$rel" ]; then
    shipped=""
    if [ -f "$OLDMAN" ]; then shipped="$(awk -v r="$rel" 'substr($0, index($0, " ") + 1) == r { print $1 }' "$OLDMAN")"; fi
    changed=0
    if [ -n "$shipped" ]; then
      if [ "$(sum "$DEST/$rel")" != "$shipped" ] && ! cmp -s "$SRC/$rel" "$DEST/$rel"; then
        keep_or_merge "$rel" "$shipped"
        echo "$(sum "$SRC/$rel") $rel" >> "$NEWMAN"   # the kit's version, so the next upgrade finds the change again
        return
      fi
    elif ! cmp -s "$SRC/$rel" "$DEST/$rel"; then changed=1; fi
    if [ "$changed" = 1 ]; then
      mkdir -p "$BACKUP/$(dirname "$rel")"
      cp "$DEST/$rel" "$BACKUP/$rel"
      echo "$rel" >> "$SAVED"
    fi
  fi
  cp "$SRC/$rel" "$DEST/$rel"
  echo "$(sum "$SRC/$rel") $rel" >> "$NEWMAN"
}
copy_once() {
  rel="$1"
  if [ -e "$DEST/$rel" ]; then hm "kept your $rel"; return; fi
  mkdir -p "$DEST/$(dirname "$rel")"
  cp "$SRC/$rel" "$DEST/$rel"
}

# -prune keeps a developer's local __pycache__ out of a fresh install.
( cd "$SRC" && find scripts .claude docs atlas \
    \( -name __pycache__ -o -name .DS_Store -o -name node_modules -o -name .next \) -prune -o -type f -print ) | while read -r rel; do
  copy_managed "$rel"
done
ok "scripts, skills, docs and the atlas"

for f in AGENTS.md CLAUDE.md ugckit; do copy_managed "$f"; done
ok "AGENTS.md, CLAUDE.md, ugckit"

# Codex reads skills from .agents/skills (the repo-level folder of codex-cli 0.154), not
# from .claude/skills. One link, so there is one copy of every skill to maintain. A real
# folder already there is the user's; it is left alone and said.
if [ -L "$DEST/.agents/skills" ]; then
  :
elif [ -e "$DEST/.agents/skills" ]; then
  hm ".agents/skills exists and is not a link; Codex will not see .claude/skills through it"
else
  mkdir -p "$DEST/.agents" && ln -s ../.claude/skills "$DEST/.agents/skills" && ok ".agents/skills -> .claude/skills (Codex reads the same skills)"
fi

# The brain: three learnings files, replaced on every upgrade and read-only on disk so
# nobody edits the copy the next upgrade overwrites. The user's own findings go beside
# it, under apps/<slug>/niche/ (see apps/README.md).
( cd "$SRC" && find brain -type f -name '*.md' ) | while read -r rel; do
  [ -e "$DEST/$rel" ] && chmod u+w "$DEST/$rel"
  copy_managed "$rel"
  chmod 444 "$DEST/$rel"
done
ok "brain/ (read-only)"
copy_once "apps/README.md"

# Files an earlier version shipped and this one does not. Left in place, a retired skill
# is still a skill the agent can pick up, so they go. Only ever paths we authored.
RETIRED="
.claude/skills/discover
.claude/skills/triage
scripts/discover.sh
"
GONE=""
for rel in $RETIRED; do
  if [ -e "$DEST/$rel" ]; then rm -rf "$DEST/$rel"; GONE="${GONE:+$GONE, }$rel"; fi
done
[ -z "$GONE" ] || hm "removed retired: $GONE"

for f in .env.example .gitignore requirements.txt; do copy_once "$f"; done

( cd "$SRC" && find pipeline research -type d ) | while read -r d; do
  mkdir -p "$DEST/$d"
  [ -f "$DEST/$d/.gitkeep" ] || touch "$DEST/$d/.gitkeep"
done
ok "pipeline/ and research/ directories"

chmod +x "$DEST/ugckit" "$DEST"/scripts/*.sh "$DEST"/scripts/*.py 2>/dev/null || true

if [ ! -f "$DEST/.env" ]; then
  cp "$SRC/.env.example" "$DEST/.env"
  ok ".env created from template (empty — you fill it in)"
else
  hm "kept your existing .env"
fi

printf '%s\n' "$VERSION" > "$DEST/.ugckit-version"
mv "$NEWMAN" "$OLDMAN"
N="$(wc -l < "$SAVED" | tr -d ' ')"; rm -f "$SAVED"
if [ "$N" -gt 0 ]; then
  if [ "$OLD" = unknown ]; then
    hm "$N managed file(s) differed from this version and were replaced; the old versions are in .ugckit-backup/$OLD/ (an atlas/ tweak lives there too, under the same path; most of these are the kit's own updates, since this folder predates the manifest)"
  else
    hm "$N file(s) you had changed were replaced; your versions are in .ugckit-backup/$OLD/ (an atlas/ tweak lives there too, under the same path)"
  fi
fi
list() { sed 's/^/      /' "$1"; }
NK="$(wc -l < "$KEPT" | tr -d ' ')"; NM="$(wc -l < "$MERGED" | tr -d ' ')"; NC="$(wc -l < "$CLASH" | tr -d ' ')"
if [ "$NK" -gt 0 ]; then hm "$NK file(s) you had changed are kept as they are (this version does not change them):"; list "$KEPT"; fi
if [ "$NM" -gt 0 ]; then hm "$NM file(s) you had changed now have this version's changes merged in, and keep yours (before the merge: .ugckit-backup/$OLD/):"; list "$MERGED"; fi
if [ "$NC" -gt 0 ]; then
  no "$NC file(s) you had changed could not be merged. Yours are kept as they are; this version's file is beside each one as <file>.ugckit-new. Ask your agent to merge them (the setup skill, § 0):"
  list "$CLASH"
fi
rm -f "$KEPT" "$MERGED" "$CLASH"

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
# Supagen's MCP server is Streamable HTTP with OAuth -- there is no package to install
# and no token to paste. Both config files are project-scoped, so this touches nothing
# outside $DEST; approval happens in the agent, in the browser, on first use.
echo
b "Supagen MCP"
WROTE=""
[ -e "$DEST/.mcp.json" ]        || WROTE=".mcp.json (Claude Code)"
[ -e "$DEST/.cursor/mcp.json" ] || WROTE="${WROTE:+$WROTE, }.cursor/mcp.json (Cursor)"
copy_once ".mcp.json"
copy_once ".cursor/mcp.json"
[ -z "$WROTE" ] || ok "wrote $WROTE"

if command -v claude >/dev/null 2>&1; then
  hm "start Claude Code in $TARGET, then run /mcp to approve the connection"
else
  hm "Codex and other agents: see docs/mcp-setup.md for the config to add"
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
    2.  ./ugckit key                      it asks for your Supagen key and your
                                          Monid key, and hides what you type
                                          (the agent sets the workspace id itself)
    3.  ./ugckit doctor                   confirm everything is wired up
    4.  claude                            the agent reads AGENTS.md and takes over
                                          — ask it to run the setup skill first
        then /mcp                         approve the Supagen connection in the browser

  Three ways in. Give it a reference video and it recreates that. Give it your app and
  it walks the slideshow path: the competitor apps, the niche, the account set, the
  handles, the plan, then production, two slideshows a day per handle. Give it only a
  niche or an app name and it starts with the research and asks for the app later.

  The agent drives the pipeline. You mostly watch, review and give feedback:

    ./ugckit ui                           review UI at http://127.0.0.1:7878

  Setup creates Supagen templates in your workspace. Nothing generates until that
  is done — the setup skill walks you through it.

EOF
