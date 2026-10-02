#!/usr/bin/env bash
# P1: the keyframes of one character video, made by one background `codex exec` process on
# the user's Codex plan (the bridge of scripts/codex-images.sh, for keyframes). Free: no
# Supagen, no Monid.
#
#   scripts/character/keyframes.sh <video> [--only 01-t,03-g]
#
# 1. The just-in-time check: `codex --version`, then `codex login status`. Not logged in ->
#    prints `codex login` and exits 3; the skill waits for the user's "done" and runs again.
# 2. shots.py job writes keyframes/keyframes-job.json and keyframes-instruction.txt from
#    the shot files (keyframe_prompt, keyframe_references; keyframe_end_prompt for H).
# 3. One `codex exec`, the instruction on stdin, every reference attached with -i, the
#    events in keyframes-events.jsonl, the last message in keyframes-result.md.
# 4. shots.py verify: every keyframe exists at 1080x1920. A failed still is named; the
#    re-run is the same command with --only.
#
# Start it with run_in_background and wait for the notification. Codex as the agent makes
# the same pictures inline from keyframes-instruction.txt instead.
set -uo pipefail

[ $# -ge 1 ] || { sed -n 2,19p "$0"; exit 2; }
VIDEO=$1; shift
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
KDIR="$ROOT/pipeline/character/$VIDEO/keyframes"
PY=python3; [ -x "$ROOT/.venv/bin/python3" ] && PY="$ROOT/.venv/bin/python3"
export UGCKIT_AGENT=codex

# ---------------------------------------------------------------- just in time
command -v codex >/dev/null 2>&1 || {
  echo "codex not found. The keyframes are made by Codex on your Codex plan:" >&2
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
"$PY" "$HERE/shots.py" job "$VIDEO" "$@" || exit 1
JOB="$KDIR/keyframes-job.json"
IARGS=()
while IFS= read -r f; do [ -n "$f" ] && IARGS+=(-i "$f"); done < <("$PY" -c \
  "import json,sys; print('\n'.join(json.load(open(sys.argv[1]))['attach']))" "$JOB")
N=$("$PY" -c "import json,sys; print(len(json.load(open(sys.argv[1]))['stills']))" "$JOB")

# ---------------------------------------------------------------- codex exec
echo "codex exec: $N still(s), $(( ${#IARGS[@]} / 2 )) reference file(s); about two minutes a picture"
START=$(date +%s)
codex exec -C "$ROOT" -s workspace-write --skip-git-repo-check --ephemeral --json \
  -o "$KDIR/keyframes-result.md" "${IARGS[@]}" - \
  < "$KDIR/keyframes-instruction.txt" > "$KDIR/keyframes-events.jsonl" 2> "$KDIR/keyframes-stderr.txt"
RC=$?
echo "codex exec exited $RC after $(( $(date +%s) - START )) s"
if ! grep -q '"turn.completed"' "$KDIR/keyframes-events.jsonl" 2>/dev/null; then
  echo "the event stream ended without turn.completed -- the last 20 events:" >&2
  tail -20 "$KDIR/keyframes-events.jsonl" | cut -c1-300 >&2
  grep -v 'rmcp::transport' "$KDIR/keyframes-stderr.txt" | tail -5 >&2
fi

# ---------------------------------------------------------------- verify
echo "== verify =="
"$PY" "$HERE/shots.py" verify "$VIDEO" "$@"
VRC=$?
if [ "$VRC" -ne 0 ] || [ "$RC" -ne 0 ]; then exit 1; fi
"$PY" "$HERE/shots.py" storyboard "$VIDEO" || true
echo "done: look at each keyframe, then show the user keyframes/storyboard.jpg (gate A)"
