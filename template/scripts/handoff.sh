#!/usr/bin/env bash
# Stage R5 handoff: the winning post becomes the reference video for stage 1.
# Usage: scripts/handoff.sh <project> <app> <handle> <post-id>
set -euo pipefail

[ $# -ge 4 ] || { echo "usage: $0 <project> <app> <handle> <post-id>" >&2; exit 2; }
NAME=$1; APP=$2; HANDLE=${3#@}; ID=$4

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
DIR="$(research_dir "$NAME")/$APP"
SRC="$DIR/$HANDLE/$ID"
DEST="$PROJ_ROOT/pipeline/00-source/$NAME"

[ -d "$SRC" ] || { echo "no such post: $SRC" >&2; exit 1; }

# RULE 10: whether this is a photo post is a fact about the post, not about what
# happened to download. Ask posts.json, which is the only thing that knows.
SLIDES=$(python3 -c "
import json,sys
rows = json.load(open(sys.argv[1]))
for r in rows:
    if isinstance(r, dict) and str(r.get('id')) == sys.argv[2]:
        print(len(r.get('images') or [])); break
else:
    print(0)" "$DIR/$HANDLE/posts.json" "$ID" 2>/dev/null || echo 0)

if [ "${SLIDES:-0}" -gt 0 ]; then
  echo "$ID is a photo post — $SLIDES slides, no video." >&2
  echo "There is nothing for stage 1 to measure. Either pick the best *video* post from" >&2
  echo "$DIR/$HANDLE/manifest.tsv, or write the script from the teardown instead:" >&2
  echo "  scripts/state.py entry $NAME research   # then use the originate skill" >&2
  exit 1
fi

[ -s "$SRC/video.mp4" ] || { echo "no video.mp4 in $SRC — run: scripts/deepen.sh $NAME $APP $HANDLE" >&2; exit 1; }
verify_video "$SRC/video.mp4"

mkdir -p "$DEST"
cp "$SRC/video.mp4" "$DEST/reference.mp4"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration -of default=nw=1 "$DEST/reference.mp4"

python3 "$SCRIPTS/state.py" handle-set "$NAME" "$APP" "$HANDLE" winner "$ID" >/dev/null
python3 "$SCRIPTS/state.py" note "$NAME" "reference = $APP @$HANDLE/$ID (research-led pick)"

VIEWS=$(awk -F'\t' -v id="$ID" '$1==id {print $2}' "$DIR/$HANDLE/manifest.tsv" 2>/dev/null || true)
echo
echo "reference: $APP @$HANDLE/$ID${VIEWS:+  ($VIEWS views)}"
echo "wrote    : $DEST/reference.mp4"
echo
echo "next: scripts/ingest.sh pipeline/00-source/$NAME/reference.mp4 $NAME [start] [length]"
echo "      the teardown's read of this post is the brief; stage 1 measures it."
