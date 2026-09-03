#!/usr/bin/env bash
# Stage 1: prep the reference file, then measure it objectively.
# Usage: scripts/ingest.sh <input-video> <name> [start-seconds] [length-seconds]
#   start defaults to 0, length defaults to 30 (trim before you analyse).
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: $0 <input-video> <name> [start-seconds] [length-seconds]" >&2
  exit 2
fi

IN=$1
NAME=$2
SS=${3:-0}
LEN=${4:-30}

ROOT="$(cd "$(dirname "$0")/.." && pwd)/pipeline"
SRC="$ROOT/00-source/$NAME"
OBJ="$ROOT/01-objective/$NAME"
VRB="$ROOT/03-verbatim/$NAME"
mkdir -p "$SRC" "$OBJ/sheets" "$VRB"

echo "== probe source =="
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration,size -of default=nw=1 "$IN" | tee "$SRC/probe-source.txt"
HAS_AUDIO=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$IN" || true)
echo "audio_codec=${HAS_AUDIO:-none}" | tee -a "$SRC/probe-source.txt"

echo
echo "== trim to the segment being recreated (ss=${SS}s len=${LEN}s) =="
SEG="$SRC/seg.mp4"
ffmpeg -y -loglevel error -ss "$SS" -t "$LEN" -i "$IN" \
  -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "$SEG"

# Re-probe the segment: every downstream number must describe seg.mp4, not the original.
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of csv=p=0 "$SEG")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$SEG")
RFR=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SEG")
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SEG")
FPS=$(awk -F/ '{printf "%.3f", $1/$2}' <<<"$RFR")
printf 'width=%s\nheight=%s\nr_frame_rate=%s\nfps=%s\nduration=%s\n' \
  "$W" "$H" "$RFR" "$FPS" "$DUR" | tee "$SRC/probe-seg.txt"

echo
echo "== scene changes (scored, classified) =="
# One low-floor pass at 0.02, keeping the score, then classify. The SOP's single
# >0.30 pass reports zero cuts on same-room/same-wardrobe UGC, because a splice
# between two takes of the identical setup barely moves the global histogram.
# 0.30 is "obvious cut"; the real cut list needs the lower bands looked at.
ffmpeg -nostats -hide_banner -i "$SEG" \
  -vf "select='gt(scene,0.02)',metadata=print:key=lavfi.scene_score:file=-" \
  -f null - 2>/dev/null \
  | awk '/pts_time:/ {t=$0; sub(/.*pts_time:/,"",t); sub(/[^0-9.].*/,"",t)}
         /scene_score=/ {sc=$0; sub(/.*scene_score=/,"",sc); printf "%s\t%s\n", t, sc}' \
  > "$OBJ/scene-scores.tsv" || true

awk -F'\t' '$2>=0.30 {print $1}' "$OBJ/scene-scores.tsv" > "$OBJ/cuts-hard.txt"
awk -F'\t' '$2>=0.08 && $2<0.30 {print $1}' "$OBJ/scene-scores.tsv" > "$OBJ/cuts-probable.txt"
awk -F'\t' '$2<0.08 {print $1}' "$OBJ/scene-scores.tsv" > "$OBJ/cuts-candidate.txt"
cat "$OBJ/cuts-hard.txt" "$OBJ/cuts-probable.txt" | sort -n > "$OBJ/cuts.txt"

HARD=$(wc -l < "$OBJ/cuts-hard.txt" | tr -d ' ')
PROB=$(wc -l < "$OBJ/cuts-probable.txt" | tr -d ' ')
CAND=$(wc -l < "$OBJ/cuts-candidate.txt" | tr -d ' ')
CUTS=$(wc -l < "$OBJ/cuts.txt" | tr -d ' ')
STATES=$((HARD + PROB))
echo "$STATES" > "$OBJ/visual-states.txt"

printf '  hard      (>=0.30): %s   %s\n' "$HARD" "$(tr '\n' ' ' < "$OBJ/cuts-hard.txt")"
printf '  probable  (>=0.08): %s   %s\n' "$PROB" "$(tr '\n' ' ' < "$OBJ/cuts-probable.txt")"
printf '  candidate (>=0.02): %s   %s\n' "$CAND" "$(tr '\n' ' ' < "$OBJ/cuts-candidate.txt")"
echo "  -> VERIFY EVERY ONE OF THESE ON A CONTACT SHEET, candidates included."
echo "     A same-setup splice can score under 0.08 and is invisible at the SOP's 0.30."

echo
echo "== contact sheets =="
# Sheet fps: 3 for fast-cut short content, 2 for anything longer.
SHEET_FPS=$(awk -v d="$DUR" 'BEGIN{print (d<=15)?3:2}')
# Tile shape follows orientation. CELLS matters: it is the divisor in the Appendix B
# timestamp formula, and it is 16 for the 4x4 portrait sheet but 12 for the 3x4 landscape one.
if [ "$H" -ge "$W" ]; then
  SCALE="270:480"; TILE="4x4"; CELLS=16; ORIENT="portrait"
else
  SCALE="480:261"; TILE="3x4"; CELLS=12; ORIENT="landscape"
fi
ffmpeg -y -loglevel error -i "$SEG" \
  -vf "fps=${SHEET_FPS},scale=${SCALE},tile=${TILE}:padding=4:color=white" \
  "$OBJ/sheets/sheet_%02d.png"
SHEETS=$(ls "$OBJ/sheets" | wc -l | tr -d ' ')
echo "$SHEETS sheets ($ORIENT, ${TILE}, ${CELLS} cells, ${SHEET_FPS} fps)"

echo
echo "== motion energy (sustained < ~2.0 = dead frames) =="
ffmpeg -nostats -hide_banner -i "$SEG" \
  -vf "fps=4,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG" \
  -f null - 2>&1 | grep -oE "YAVG[=:][0-9.]+" | cut -d"=" -f2 | cut -d":" -f2 > "$OBJ/motion-yavg.txt" || true
awk '{s+=$1; n++} END{if(n) printf "samples=%d mean_yavg=%.2f\n", n, s/n}' "$OBJ/motion-yavg.txt"

echo
echo "== audio extract for Whisper =="
if [ -n "${HAS_AUDIO:-}" ]; then
  ffmpeg -y -loglevel error -i "$SEG" -vn -ac 1 -ar 16000 "$VRB/seg.wav"
  echo "wrote $VRB/seg.wav"
else
  echo "no audio stream — skipping Whisper input"
fi

# Manifest: the numbers the breakdown stage needs in order to read the sheets correctly.
cat > "$OBJ/manifest.json" <<JSON
{
  "name": "$NAME",
  "source": "$IN",
  "segment": { "start_s": $SS, "requested_len_s": $LEN, "actual_duration_s": $DUR },
  "video": { "width": $W, "height": $H, "fps": $FPS, "orientation": "$ORIENT" },
  "objective": {
    "hard_cuts": $HARD,
    "probable_cuts": $PROB,
    "candidate_changes": $CAND,
    "cut_list": [$(paste -sd, "$OBJ/cuts.txt" 2>/dev/null)],
    "visual_states": $STATES,
    "mean_motion_yavg": $(awk '{s+=$1;n++} END{printf "%.2f", (n? s/n : 0)}' "$OBJ/motion-yavg.txt")
  },
  "sheets": {
    "count": $SHEETS, "fps": $SHEET_FPS, "tile": "$TILE", "cells_per_sheet": $CELLS,
    "timestamp_formula": "t = ((sheet - 1) * $CELLS + (cell - 1)) / $SHEET_FPS"
  },
  "has_audio": $([ -n "${HAS_AUDIO:-}" ] && echo true || echo false)
}
JSON

echo
echo "== done =="
echo "segment : $SEG"
echo "sheets  : $OBJ/sheets/"
echo "manifest: $OBJ/manifest.json"
