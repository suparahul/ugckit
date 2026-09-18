#!/usr/bin/env bash
# The Claude-to-Codex bridge (the `images` skill, SYSTEM.md § 9.1): one post's pictures,
# made by one background `codex exec` process on the user's Codex plan.
#
#   scripts/codex-images.sh <slug> <post> [--only 3,5]
#
# 1. The just-in-time check: `codex --version`, then `codex login status`. Not logged in ->
#    prints `codex login` and exits 3; the skill waits for the user's "done" and runs again.
# 2. scripts/images.sh writes images-job.json and prints the instruction.
# 3. One `codex exec` with the instruction on stdin (never as an argument: `-i` takes a
#    list of files and would swallow it), the references attached with -i, the events as
#    JSONL in images-events.jsonl, the last message in images-result.md.
# 4. scripts/images.sh --verify: every slide's file, its pixel size, images-result.json,
#    the log lines. A failed slide is reported by number with the last 20 events; the
#    re-run is the same command with --only <n,n>.
#
# Start it with run_in_background and wait for the notification; one post at a time.
# It uses the user's Codex plan; the skill says so once per session before the first run.
set -uo pipefail

[ $# -ge 2 ] || { sed -n 2,18p "$0"; exit 2; }
SLUG=$1; KEY=$2; shift 2
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
POSTDIR="$ROOT/apps/$SLUG/production/files/$(printf '%s' "$KEY" | tr '/' '-')"
export UGCKIT_AGENT=codex

# ---------------------------------------------------------------- just in time
command -v codex >/dev/null 2>&1 || {
  echo "codex not found. The pictures are made by Codex on your Codex plan:" >&2
  echo "    npm install -g @openai/codex" >&2
  echo "then:  codex login      and tell me when it is done." >&2; exit 3; }
echo "codex $(codex --version 2>/dev/null | head -1)"
STATUS=$(codex login status 2>&1 | tail -1)
echo "login: $STATUS"
case "$STATUS" in
  *"Logged in"*) ;;
  *) echo >&2; echo "Not logged in to Codex. Run this once, in your own terminal, and tell me when it is done:" >&2
     echo "    codex login" >&2; exit 3 ;;
esac

# ---------------------------------------------------------------- the job
"$SCRIPTS/images.sh" "$SLUG" "$KEY" "$@" > "$POSTDIR.instruction.tmp" || { rm -f "$POSTDIR.instruction.tmp"; exit 1; }
mkdir -p "$POSTDIR"
head -1 "$POSTDIR.instruction.tmp"
# The instruction is everything after the "== instruction" line.
sed -n '/^== instruction/,$p' "$POSTDIR.instruction.tmp" | tail -n +2 > "$POSTDIR/images-instruction.txt"
rm -f "$POSTDIR.instruction.tmp"
JOB="$POSTDIR/images-job.json"
REFS=$(python3 -c "import json,sys; print('\n'.join(r['file'] for r in json.load(open(sys.argv[1]))['references']))" "$JOB")
IARGS=()
while IFS= read -r f; do [ -n "$f" ] && IARGS+=(-i "$f"); done <<< "$REFS"
N=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))['slides']))" "$JOB")

# ---------------------------------------------------------------- codex exec
echo "codex exec: $N slide(s), ${#IARGS[@]} reference arg(s); about two minutes a picture (measured 2026-09-18: 106 s for one)"
START=$(date +%s)
codex exec -C "$ROOT" -s workspace-write --skip-git-repo-check --ephemeral --json \
  -o "$POSTDIR/images-result.md" "${IARGS[@]}" - \
  < "$POSTDIR/images-instruction.txt" > "$POSTDIR/images-events.jsonl" 2> "$POSTDIR/images-stderr.txt"
RC=$?
echo "codex exec exited $RC after $(( $(date +%s) - START )) s"
if ! grep -q '"turn.completed"' "$POSTDIR/images-events.jsonl" 2>/dev/null; then
  echo "the event stream ended without turn.completed -- the last 20 events:" >&2
  tail -20 "$POSTDIR/images-events.jsonl" | cut -c1-300 >&2
  grep -v 'rmcp::transport' "$POSTDIR/images-stderr.txt" | tail -5 >&2
fi

# ---------------------------------------------------------------- verify
echo "== verify =="
"$SCRIPTS/images.sh" "$SLUG" "$KEY" --verify
VRC=$?
if [ "$VRC" -ne 0 ] || [ "$RC" -ne 0 ]; then
  echo "the last 20 events:" >&2
  tail -20 "$POSTDIR/images-events.jsonl" | cut -c1-300 >&2
  exit 1
fi
echo "done: look at them on the post page, http://localhost:3210/app/$SLUG/post/$(printf '%s' "$KEY" | tr '/' '-')"
