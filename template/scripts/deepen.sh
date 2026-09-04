#!/usr/bin/env bash
# Stage R4: the deep dive. Top accounts by total views, their best posts pulled as real
# video or as slides.
#
#   scripts/deepen.sh <project> <app> --rank [topN=5]     rank the app's harvested accounts, mark the top N
#   scripts/deepen.sh <project> <app> <handle> [topN=3]   pull that account's top N posts
#   scripts/deepen.sh <project> <app> --deep [topN=3]     every account marked deep
#
# Costs no Monid: it reuses the posts.json that R3 already paid for. RULE 12 applies
# anyway — those urls expire, so run this in the same week as the harvest.
set -euo pipefail

[ $# -ge 3 ] || { echo "usage: $0 <project> <app> <--rank|--deep|handle> [topN]" >&2; exit 2; }
NAME=$1; APP=$2; WHO=$3; TOPN=${4:-}

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
DIR="$(research_dir "$NAME")/$APP"
STATE="$SCRIPTS/state.py"

# ---------------------------------------------------------------- ranking
if [ "$WHO" = "--rank" ]; then
  TOPN=${TOPN:-5}
  echo "== $APP: ranking by total account views =="
  # Total views, not followers and not judgement. The ledger already carries the totals
  # harvest computed; this only decides where the line falls.
  python3 "$STATE" handles "$NAME" "$APP" | awk -F'\t' '$4=="yes"' | sort -t$'\t' -k3,3nr \
    > "$DIR/deep.tsv" || true
  [ -s "$DIR/deep.tsv" ] || { echo "nothing harvested yet — run: scripts/harvest.sh $NAME $APP" >&2; exit 1; }
  I=0
  while IFS=$'\t' read -r H _APP VIEWS REST; do
    I=$((I + 1))
    if [ "$I" -le "$TOPN" ]; then
      python3 "$STATE" handle-set "$NAME" "$APP" "$H" deep yes >/dev/null
      printf '  %2d. %-28s %12s  deep\n' "$I" "$H" "$VIEWS"
    else
      printf '  %2d. %-28s %12s\n' "$I" "$H" "$VIEWS"
    fi
  done < "$DIR/deep.tsv"
  echo
  echo "next: scripts/deepen.sh $NAME $APP --deep"
  exit 0
fi

TOPN=${TOPN:-3}
if [ "$WHO" = "--deep" ]; then
  HANDLES=$(python3 "$STATE" handles "$NAME" "$APP" | awk -F'\t' '$5=="yes" {print $1}')
  [ -n "$HANDLES" ] || { echo "no accounts marked deep — run: $0 $NAME $APP --rank" >&2; exit 1; }
else
  HANDLES=${WHO#@}
fi

for HANDLE in $HANDLES; do
  H="$DIR/$HANDLE"
  JSON="$H/posts.json"
  echo
  echo "===== $HANDLE ====="
  [ -s "$JSON" ] || { echo "  no posts.json — run: scripts/harvest.sh $NAME $APP $HANDLE" >&2; continue; }

  # manifest.tsv is every post; slides.tsv is every photo post. Both come out of the
  # posts.json already on disk — RULE 10: the slides are in the images array, there is
  # no carousel endpoint to call.
  python3 - "$JSON" "$H" "$TOPN" <<'PY'
import json, os, sys
src, h, topn = sys.argv[1], sys.argv[2], int(sys.argv[3])
rows = [r for r in json.load(open(src)) if isinstance(r, dict)]
rows.sort(key=lambda r: -(r.get("views") or 0))
def cap(r):
    return (r.get("title") or "").replace("\n", " ").replace("\t", " ")[:200]
with open(os.path.join(h, "manifest.tsv"), "w") as f:
    f.write("id\tviews\tlikes\tcomments\tshares\tbookmarks\tdate\tkind\tslides\turl\tcaption\n")
    for r in rows:
        n = len(r.get("images") or [])
        f.write("\t".join(str(x) for x in [
            r.get("id"), r.get("views") or 0, r.get("likes") or 0, r.get("comments") or 0,
            r.get("shares") or 0, r.get("bookmarks") or 0,
            (r.get("uploadedAtFormatted") or "")[:10], "photo" if n else "video", n,
            r.get("postPage") or "", cap(r)]) + "\n")
photos = [r for r in rows if len(r.get("images") or []) > 0]
with open(os.path.join(h, "slides.tsv"), "w") as f:
    f.write("id\tviews\tslides\tdate\turl\tcaption\n")
    for r in photos:
        f.write("\t".join(str(x) for x in [
            r.get("id"), r.get("views") or 0, len(r["images"]),
            (r.get("uploadedAtFormatted") or "")[:10], r.get("postPage") or "", cap(r)]) + "\n")
# The shortlist is the top N overall, whatever they are. An account's biggest post is
# often a slideshow, and dropping it because it has no video url is how you miss the
# 41.8M-view post entirely.
with open(os.path.join(h, "shortlist.tsv"), "w") as f:
    for r in rows[:topn]:
        imgs = [i.get("url") for i in (r.get("images") or []) if i.get("url")]
        f.write("\t".join([str(r.get("id")), "photo" if imgs else "video",
                           str(r.get("views") or 0),
                           ((r.get("video") or {}).get("url") or ""),
                           "\x1f".join(imgs)]) + "\n")
print(f"  {len(rows)} posts, {len(photos)} of them photo posts")
PY

  while IFS=$'\t' read -r ID KIND VIEWS VURL IMGS; do
    P="$H/$ID"
    mkdir -p "$P"
    echo "  -- $ID  $KIND  $VIEWS views"

    if [ "$KIND" = "photo" ]; then
      # RULE 10: the video.url on a photo post is the sound. Take the images array.
      I=0
      OLDIFS=$IFS; IFS=$'\x1f'
      for U in $IMGS; do
        I=$((I + 1))
        S=$(printf '%s/slide-%02d' "$P" "$I")
        [ -s "$S.jpg" ] && continue
        if fetch_cdn "$U" "$S.src"; then to_jpg "$S.src" "$S.jpg" 1080; fi
        rm -f "$S.src"
      done
      IFS=$OLDIFS
      NS=$(ls "$P"/slide-*.jpg 2>/dev/null | wc -l | tr -d ' ' || true)
      echo "     ${NS:-0} slides"
      [ "${NS:-0}" -gt 0 ] || echo "     no slides downloaded — the image urls have expired (RULE 12)"
    else
      # RULE 11: the signed CDN link Monid returned. RULE 14: prove it is a video.
      if [ ! -s "$P/video.mp4" ]; then
        fetch_cdn "$VURL" "$P/video.mp4" || { echo "     download failed"; continue; }
      fi
      verify_video "$P/video.mp4" || continue
      if ! ls "$P"/sheet_*.png >/dev/null 2>&1; then
        ffmpeg -y -loglevel error -i "$P/video.mp4" \
          -vf "fps=1,scale=270:480,tile=4x4:padding=4:color=white" "$P/sheet_%02d.png"
      fi
      echo "     video.mp4 + $(ls "$P"/sheet_*.png 2>/dev/null | wc -l | tr -d ' ' || true) contact sheet(s)"
    fi

    NOTES="$P/notes.md"
    [ -s "$NOTES" ] && { rm -f "$P/notes.todo"; continue; }
    # `|| true` on every glob-into-substitution: an unmatched glob makes ls fail, and
    # under `set -e` with pipefail that kills the whole run mid-account, silently.
    if [ "$KIND" = "photo" ]; then
      FILES=$(ls "$P"/slide-*.jpg 2>/dev/null | tr '\n' ' ' || true)
      EXTRA="This is a photo post — a slideshow, not a video. The slides are in order."
    else
      FILES=$(ls "$P"/sheet_*.png 2>/dev/null | tr '\n' ' ' || true)
      EXTRA="These are 4x4 contact sheets at 1 frame per second, read left to right, top to bottom."
    fi
    [ -n "$FILES" ] || continue
    PROMPT="Read these with the Read tool: $FILES

$EXTRA They are one TikTok post by @$HANDLE with $VIEWS views ($ID).

Write $NOTES — nothing else, no commentary in your reply — with exactly these sections:

## Post
one line: handle, views, video or photo post, how many slides or roughly how long.

## Verbatim on-screen text
every piece of text that appears, in order, transcribed EXACTLY: original spelling,
capitalisation, typos, emoji. Do not translate or tidy. Note where each one appears.

## Structure
beat by beat — what happens and when. For a video give timestamps in seconds; for a
slideshow give the slide number.

## Visual style
shot type, setting, who is on camera, how it was filmed and cut, any app or UI on screen.

## Notes
why this one worked, in two or three sentences, grounded in what you can actually see.

Add a '## Problems' section only if something is unreadable or missing."
    if command -v claude >/dev/null 2>&1; then
      echo "     writing notes.md ($HOOK_MODEL)"
      claude --model "$HOOK_MODEL" --allowedTools "Read,Write,Glob" -p "$PROMPT" >/dev/null 2>&1 \
        || echo "     notes failed — re-run to retry"
    else
      # No claude CLI: the agent running this does the reading itself. The sheets stay
      # until notes.md exists, because they are what it has to read.
      printf '%s\n' "$PROMPT" > "$P/notes.todo"
      echo "     claude CLI not found — notes.todo written: read the frames yourself, write notes.md"
    fi
    # The frames were scaffolding. The mp4 and the slides are the asset and stay.
    [ -s "$NOTES" ] && rm -f "$P"/sheet_*.png "$P/notes.todo"
  done < "$H/shortlist.tsv"
done

echo
echo "next: the teardown skill — it reads HOOKS.md, index.tsv and every notes.md."
