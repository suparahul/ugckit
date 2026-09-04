#!/usr/bin/env bash
# The Atlas: everything the research half scraped, on one surface.
#
#   scripts/atlas.sh            install on first run, rebuild the index, serve on :3210
#   scripts/atlas.sh --index    rebuild the index only, print what it found
#
# Node 18+ is optional for ugckit as a whole -- only this needs it. node_modules lives in
# atlas/ and is ignored by git; the first run installs it (a minute, ~370 MB).
set -euo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
ATLAS="$ROOT/atlas"
PORT="${ATLAS_PORT:-3210}"

command -v node >/dev/null 2>&1 || {
  echo "node not found -- the Atlas needs Node 18+: https://nodejs.org (or: brew install node)" >&2; exit 1; }
MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$MAJOR" -ge 18 ] || { echo "node $(node --version) is too old -- need 18+" >&2; exit 1; }
[ -d "$ATLAS" ] || { echo "no atlas/ folder -- re-run install.sh" >&2; exit 1; }

cd "$ATLAS"
if [ ! -d node_modules ]; then
  echo "first run: installing the Atlas dependencies (a minute or two, ~370 MB, once)"
  npm install --no-fund --no-audit --loglevel=error
fi

echo "== indexing research/ =="
node scripts/build-index.mjs

[ "${1:-}" = "--index" ] && exit 0

echo
echo "== serving http://localhost:$PORT  (Ctrl-C stops it) =="
echo "   the index is rebuilt every time this starts; while it runs, re-index with: scripts/atlas.sh --index"
exec npx next dev -p "$PORT"
