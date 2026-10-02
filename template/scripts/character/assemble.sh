#!/usr/bin/env bash
# P5: one finished file from pipeline/character/<video>/video.json. Local ffmpeg, free.
#
#   scripts/character/assemble.sh <video> [--grain] [--no-captions]
#
# Every generated segment must be approved at gate B (and a phone segment's composite
# recorded); R and P are built from apps/<slug>/screens/. Trims, upscales once to
# 1080x1920, joins with hard cuts, levels the sound, lays the room tone, burns the
# captions from the frozen script, runs the export pass and checks the final file.
# --grain also writes the 2 to 3% grain variant (the grain test). Writes
# pipeline/character/<video>/assembly/<video>.mp4 and assembly.json. Nothing is posted.
set -uo pipefail
[ $# -ge 1 ] || { sed -n 2,11p "$0"; exit 2; }
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PY=python3; [ -x "$ROOT/.venv/bin/python3" ] && PY="$ROOT/.venv/bin/python3"
"$PY" "$HERE/state.py" set "$1" assemble running >/dev/null
"$PY" "$HERE/assemble.py" "$@"
RC=$?
[ $RC -eq 0 ] && echo "done: LOOK at the file and the contact sheet, then gate C with the user (character-deliver)"
exit $RC
