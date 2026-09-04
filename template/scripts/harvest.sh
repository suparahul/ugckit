#!/usr/bin/env bash
# Stage R3: the shallow pass. Metrics, cover frames and the on-screen hook off every
# cover, for every handle of one app.
# Usage: scripts/harvest.sh <project> <app> [handle|--all] [maxItems]
#   maxItems defaults to 50. Around $0.02 an account at that setting.
#
# Serial by design (RULE 13) and resumable at every step: an account with posts.json
# is not re-scraped, a cover that is on disk is not re-downloaded, and a batch with a
# hooks-NN.md is not re-read. Interrupt it whenever; re-run it to continue.
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <project> <app> [handle|--all] [maxItems]" >&2; exit 2; }
NAME=$1; APP=$2
WHO=${3:---all}
MAX=${4:-50}

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
DIR="$(research_dir "$NAME")/$APP"
STATE="$SCRIPTS/state.py"
BATCH=12
python3 "$STATE" apps "$NAME" | cut -f1 | grep -qx "$APP" \
  || { echo "'$APP' is not in the app ledger -- run: scripts/state.py app $NAME $APP" >&2; exit 1; }

if [ "$WHO" = "--all" ]; then
  # Only handles with evidence are in the ledger. Rejected ones never reach here.
  HANDLES=$(python3 "$STATE" handles "$NAME" "$APP" | cut -f1)
  [ -n "$HANDLES" ] || { echo "no handles in the ledger for $APP — run the network skill first" >&2; exit 1; }
else
  HANDLES=${WHO#@}
fi

COUNT=0
for HANDLE in $HANDLES; do
  H="$DIR/$HANDLE"
  JSON="$H/posts.json"
  mkdir -p "$H/covers"
  echo
  echo "===== $HANDLE ====="

  BEFORE=$([ -s "$JSON" ] && echo 1 || echo 0)
  monid_run apify /apidojo/tiktok-profile-scraper \
    "{\"usernames\":[\"$HANDLE\"],\"maxItems\":$MAX}" "$JSON" || { echo "  skipping $HANDLE"; continue; }
  [ "$BEFORE" = 0 ] && COUNT=$((COUNT + 1))

  # index.tsv is the join key for everything else: rank 1 is the newest post and is
  # covers/001.jpg. RULE 12 — the cover urls in posts.json expire, so they are pulled
  # now, in the same session as the metrics, not later.
  python3 - "$JSON" "$H" <<'PY'
import json, os, sys
src, h = sys.argv[1], sys.argv[2]
rows = json.load(open(src))
rows = [r for r in rows if isinstance(r, dict)]
rows.sort(key=lambda r: (r.get("uploadedAtFormatted") or ""), reverse=True)
with open(os.path.join(h, "index.tsv"), "w") as f, \
     open(os.path.join(h, "covers.tsv"), "w") as c:
    f.write("rank\tviews\tlikes\tcomments\tshares\tbookmarks\tdate\tphoto\tcaption\n")
    for i, r in enumerate(rows, 1):
        cap = (r.get("title") or "").replace("\n", " ").replace("\t", " ")[:200]
        photo = len(r.get("images") or []) > 0
        f.write("\t".join(str(x) for x in [
            i, r.get("views") or 0, r.get("likes") or 0, r.get("comments") or 0,
            r.get("shares") or 0, r.get("bookmarks") or 0,
            (r.get("uploadedAtFormatted") or "")[:10], "photo" if photo else "video", cap]) + "\n")
        cover = ((r.get("video") or {}).get("cover")) or ""
        if not cover and photo:
            cover = (r["images"][0] or {}).get("url") or ""
        c.write(f"{i:03d}\t{cover}\n")
print(f"  {len(rows)} posts -> index.tsv")
PY

  GOT=0; MISS=0
  while IFS=$'\t' read -r RANK URL; do
    OUTJ="$H/covers/$RANK.jpg"
    [ -s "$OUTJ" ] && { GOT=$((GOT + 1)); continue; }
    if [ -n "$URL" ] && fetch_cdn "$URL" "$H/covers/$RANK.src" && \
       to_jpg "$H/covers/$RANK.src" "$OUTJ" 700; then
      GOT=$((GOT + 1))
    else
      MISS=$((MISS + 1))
    fi
    rm -f "$H/covers/$RANK.src"
  done < "$H/covers.tsv"
  echo "  covers: $GOT downloaded, $MISS missing"

  # The hook bank. A separate headless session per batch of 12 keeps the covers out of
  # the orchestrator's context — 50 images an account across 20 accounts does not fit.
  # `|| true` because an unmatched glob makes ls fail, and under `set -e` with pipefail
  # a failing pipeline inside an assignment kills the run mid-account, silently.
  TOTAL=$(ls "$H/covers"/*.jpg 2>/dev/null | wc -l | tr -d ' ' || true)
  if ! command -v claude >/dev/null 2>&1; then
    echo "  claude CLI not found — no hook transcription (hooks.todo written)."
    printf '%s\n' "$H/covers" > "$H/hooks.todo"
    TOTAL=0
  fi
  [ "${TOTAL:-0}" -gt 0 ] || echo "  no covers to read"
  N=0; B=0
  while [ $((N * BATCH)) -lt "${TOTAL:-0}" ]; do
    N=$((N + 1))
    HB=$(printf '%s/hooks-%02d.md' "$H" "$N")
    [ -s "$HB" ] && continue
    FILES=$(ls "$H/covers"/*.jpg 2>/dev/null | sed -n "$(( (N-1)*BATCH + 1 )),$(( N*BATCH ))p" | tr '\n' ' ' || true)
    [ -n "$FILES" ] || break
    echo "  reading batch $N ($HOOK_MODEL)"
    claude --model "$HOOK_MODEL" --allowedTools "Read,Write,Glob" -p \
"Read each of these cover images with the Read tool: $FILES

They are TikTok cover frames from @$HANDLE. The file number is the post rank; the metrics
for that rank are in $H/index.tsv (rank is column 1, views column 2).

Write $HB — nothing else, no commentary in your reply. It must contain one markdown table
with the columns: Post | Views | On-screen hook | Image | Same as previous.

Transcribe the on-screen hook VERBATIM: keep the original spelling, capitalisation, typos,
emoji and line breaks exactly as they appear. Do not translate, tidy or paraphrase. Write
'(no text)' when the cover has none and '(unreadable)' when you cannot make it out.
'Image' is one short clause describing what is pictured. 'Same as previous' is yes/no —
these accounts repost the same cover often and it matters.

End the file with an '## Observations' section: two or three sentences on what the hooks
of this batch have in common." >/dev/null 2>&1 || echo "  batch $N failed — re-run to retry"
    [ -s "$HB" ] && B=$((B + 1))
  done

  # One bank per account, rebuilt from the batches every time so it never half-exists.
  if ls "$H"/hooks-*.md >/dev/null 2>&1; then
    { echo "# @$HANDLE — hook bank"; echo;
      echo "Transcribed from covers/. Rank 1 is the newest post; metrics in index.tsv."; echo;
      cat "$H"/hooks-*.md; } > "$H/HOOKS.md"
    echo "  HOOKS.md: $(ls "$H"/hooks-*.md 2>/dev/null | wc -l | tr -d ' ' || true) batches"
  fi

  python3 "$STATE" handle-set "$NAME" "$APP" "$HANDLE" harvested yes >/dev/null
  VIEWS=$(python3 -c "
import json,sys
print(sum(r.get('views') or 0 for r in json.load(open(sys.argv[1])) if isinstance(r, dict)))" "$JSON")
  python3 "$STATE" handle-set "$NAME" "$APP" "$HANDLE" views "$VIEWS" >/dev/null
  echo "  total views: $VIEWS"
done

if [ "$COUNT" -gt 0 ]; then
  USD=$(python3 -c "print(f'{$COUNT * $MAX * $PER_RESULT:.4f}')")
  spend "$NAME" "$USD" "R3 harvest/$APP: $COUNT accounts x $MAX posts"
fi

echo
echo "next: scripts/deepen.sh $NAME $APP --rank"
