#!/usr/bin/env bash
# P4: the real app on the green phone of one approved plate. Local, free.
#
#   scripts/character/composite.sh <video> <nn>-<type> [plate.mp4]
#   scripts/character/composite.sh <video> <nn>-<type> --propose-grade [plate.mp4]
#
# Only for a plan with app_insertion true and a phone segment (O, G, S, H, F) whose
# segments/<seg>/insert.json names its source (the screens skill). The plate is the one
# approved at gate B (approval.json), else the newest in generated/. Writes
# segments/<seg>/composite/<seg>-composite-<stamp>.mp4 at 1080x1920 and its track in
# composite/work/<stamp>/, then runs the insertion gates (qc.py --composite).
set -euo pipefail
[ $# -ge 2 ] || { sed -n 2,11p "$0"; exit 2; }
VIDEO=$1; SEG=$2; shift 2
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PY=python3; [ -x "$ROOT/.venv/bin/python3" ] && PY="$ROOT/.venv/bin/python3"
VDIR="$ROOT/pipeline/character/$VIDEO"
SDIR="$VDIR/segments/$SEG"
SPEC="$SDIR/insert.json"
PROPOSE=0
if [ "${1:-}" = "--propose-grade" ]; then PROPOSE=1; shift; fi

"$PY" - "$VDIR" "$SEG" "$SPEC" <<'PYEOF' || exit 1
import json, os, sys
vdir, seg, spec = sys.argv[1:4]
plan = json.load(open(os.path.join(vdir, "plan.json"))) if os.path.exists(os.path.join(vdir, "plan.json")) else {}
if plan.get("app_insertion") is not True:
    sys.exit("the plan has no app insertion: there is no screen stage (P4 is n/a)")
t = seg.split("-")[-1].upper()
if t not in ("O", "G", "S", "H", "F"):
    sys.exit(f"{seg} is not a phone segment (O, G, S, H, F); R and P are built at assembly")
if not os.path.exists(spec):
    sys.exit(f"no {os.path.relpath(spec, vdir)} -- character-shots starts it, the screens skill fills it")
s = json.load(open(spec))
if not s.get("source"):
    sys.exit("insert.json has no source: fill it from apps/<slug>/screens/screens.json (scripts/character/screens.py fill)")
PYEOF

PLATE=${1:-}
if [ -z "$PLATE" ]; then
  PLATE=$("$PY" - "$VDIR" "$VIDEO" "$SEG" <<'PYEOF'
import json, os, sys
vdir, video, seg = sys.argv[1:4]
p = os.path.join(vdir, "approval.json")
for e in (json.load(open(p)).get("gate_b_segments") or []) if os.path.exists(p) else []:
    if e.get("project") == f"{video}.{seg}" and e.get("decision") == "approve" and e.get("file"):
        print(os.path.join(vdir, "segments", seg, e["file"]) if not os.path.isabs(e["file"]) else e["file"])
        break
PYEOF
)
  if [ -z "$PLATE" ]; then
    PLATE=$(ls -t "$SDIR"/generated/*.mp4 2>/dev/null | head -1 || true)
    [ -n "$PLATE" ] && echo "no approved plate at gate B yet; using the newest: $PLATE"
  fi
fi
[ -n "$PLATE" ] && [ -f "$PLATE" ] || { echo "no plate in $SDIR/generated/" >&2; exit 1; }

OUT="$SDIR/composite"
if [ "$PROPOSE" = 1 ]; then
  mkdir -p "$OUT/work/propose"
  "$PY" "$HERE/screen_comp.py" --propose-grade "$PLATE" "$SPEC" "$ROOT" "$OUT/work/propose"
  exit $?
fi
STAMP=$(date +%Y%m%d-%H%M%S)
WORK="$OUT/work/$STAMP"; mkdir -p "$WORK"     # the track of this composite, for qc.py and assembly
FINAL="$OUT/$SEG-composite-$STAMP.mp4"
echo "== plate: $PLATE =="
"$PY" "$HERE/screen_comp.py" "$PLATE" "$SPEC" "$FINAL" "$ROOT" "$WORK"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration -of default=nw=1 "$FINAL"
echo "composite: $FINAL"
"$PY" "$HERE/qc.py" "$VIDEO" "$SEG" --composite "$FINAL" || {
  echo "a gate failed: see composite/qc/gates.json, the corner sheet and the failure table of the character-composite skill"; exit 1; }
