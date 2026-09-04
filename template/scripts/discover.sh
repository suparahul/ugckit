#!/usr/bin/env bash
# Stage R1: find the network. Keyword searches through Monid, one at a time.
# Usage: scripts/discover.sh <project> <keyword> [keyword ...]
#   Each keyword is searched twice — ALL_TIME for the canon, LAST_THREE_MONTHS for
#   what is working now. Around $0.01 a search at 20 results.
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <project> <keyword> [keyword ...]" >&2; exit 2; }
NAME=$1; shift

. "$(cd "$(dirname "$0")" && pwd)/monid.sh"
DIR="$(research_dir "$NAME")"
mkdir -p "$DIR/searches"

MAXITEMS="${MAXITEMS:-20}"
CALLS=0

for KW in "$@"; do
  SLUG=$(printf '%s' "$KW" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
  for RANGE in ALL_TIME LAST_THREE_MONTHS; do
    OUT="$DIR/searches/$SLUG.$RANGE.json"
    echo "== $KW ($RANGE) =="
    BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
    monid_run apify /apidojo/tiktok-scraper \
      "{\"keywords\":[\"$KW\"],\"sortType\":\"MOST_LIKED\",\"dateRange\":\"$RANGE\",\"maxItems\":$MAXITEMS}" \
      "$OUT"
    [ "$BEFORE" = 0 ] && CALLS=$((CALLS + 1))
  done
done

# One table of every handle any search returned, with its best post. This is what
# stage R2 triages; nothing else in R1 is meant to be read directly.
echo
echo "== all-handles.tsv =="
python3 - "$DIR" <<'PY'
import glob, json, os, sys
d = sys.argv[1]
best = {}
for f in sorted(glob.glob(os.path.join(d, "searches", "*.json"))):
    try:
        rows = json.load(open(f))
    except Exception:
        continue
    for r in rows if isinstance(rows, list) else []:
        u = ((r.get("channel") or {}).get("username")) or ""
        if not u:
            continue
        v = r.get("views") or 0
        if u not in best or v > (best[u].get("views") or 0):
            best[u] = r
out = os.path.join(d, "all-handles.tsv")
with open(out, "w") as fh:
    fh.write("handle\tfollowers\tbest_views\tlikes\tdate\tcaption\n")
    for u, r in sorted(best.items(), key=lambda kv: -(kv[1].get("views") or 0)):
        ch = r.get("channel") or {}
        cap = (r.get("title") or "").replace("\n", " ").replace("\t", " ")[:160]
        fh.write("\t".join(str(x) for x in [
            u, ch.get("subscribers") or "", r.get("views") or 0, r.get("likes") or 0,
            (r.get("uploadedAtFormatted") or "")[:10], cap]) + "\n")
print(f"{len(best)} unique handles -> {out}")
PY

if [ "$CALLS" -gt 0 ]; then
  USD=$(python3 -c "print(f'{$CALLS * $MAXITEMS * $PER_RESULT:.4f}')")
  spend "$NAME" "$USD" "R1 discover: $CALLS searches x $MAXITEMS results"
fi

echo
echo "next: read $DIR/all-handles.tsv and run the triage skill."
echo "      captions are the evidence — a handle that names the app is a promoter."
