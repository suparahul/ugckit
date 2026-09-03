#!/usr/bin/env bash
# Stage 8: composite a real screen recording onto the green-screened phone in the plate.
# Only runs in the complex flow (pipeline/05-prompt/<name>/insert.json present).
# Usage: scripts/composite.sh <name> [plate.mp4]
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: $0 <name> [plate.mp4]" >&2; exit 2; }
NAME=$1
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$PROJ/pipeline/05-prompt/$NAME/insert.json"
[ -f "$SPEC" ] || { echo "missing $SPEC" >&2; exit 1; }

# default plate = newest generation for this name
PLATE=${2:-$(ls -t "$PROJ/pipeline/06-generated/$NAME"/*.mp4 2>/dev/null | head -1)}
[ -n "${PLATE:-}" ] && [ -f "$PLATE" ] || { echo "no plate found in pipeline/06-generated/$NAME" >&2; exit 1; }

OUT="$PROJ/pipeline/07-composite/$NAME"; WORK="$OUT/work"; mkdir -p "$WORK"
STAMP=$(date +%Y%m%d-%H%M%S)
FINAL="$OUT/$NAME-composite-$STAMP.mp4"

echo "== plate: $PLATE =="
"$PROJ/.venv/bin/python3" "$PROJ/scripts/screen_comp.py" "$PLATE" "$SPEC" "$FINAL" "$PROJ" "$WORK"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration -of default=nw=1 "$FINAL"
echo "final: $FINAL"
