#!/usr/bin/env bash
# Phase 4, the niche search (the `niche-search` skill): two doors per keyword, through
# Monid one call at a time, into apps/<slug>/niche/.
#
#   scripts/niche-search.sh <slug> "<keyword>" ["<keyword>" ...]
#       PAGES=5          Photo tab pages per keyword (20 items each, $0.0015 a page)
#       WINDOWS="THIS_MONTH LAST_THREE_MONTHS"   the video door's windows
#       MAXITEMS=100     results per video search ($0.00045 each)
#       DOORS=photo,video   or photo | video, to run one door only
#
# The Photo tab door is TikHub fetch_search_photo: slideshows only, full counts including
# saves, no sort and no date parameter (both are local; the tab is not recency-sorted, and
# most of it is older than 90 days). Page 0 has no search_id; every later page passes
# extra.logid from page 0. TikTok spell-corrects the keyword (query_correct_info on page
# 0); the corrected phrase is recorded. The video door is the apidojo keyword search with
# MOST_LIKED and a date window, the same call as R1; it never returns a slideshow.
#
# Writes searches/photo.<kw>.p<N>.json, searches/<kw>.<WINDOW>.json, covers/<postId>.jpg
# (the first slide of a slideshow, the cover of a video, fetched now because the urls
# expire), the search log in NICHE.md, then rebuilds the Atlas's niche index. Files that
# exist and parse are reused and cost nothing, so a killed run resumes.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,20p "$0"; exit 2; }
SLUG=$1; shift
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
ROOT="$PROJ_ROOT"
NICHE="$ROOT/apps/$SLUG/niche"
mkdir -p "$NICHE/searches" "$NICHE/covers"
PAGES="${PAGES:-5}"; WINDOWS="${WINDOWS:-THIS_MONTH LAST_THREE_MONTHS}"; MAXITEMS="${MAXITEMS:-100}"; DOORS="${DOORS:-photo,video}"
PER_PAGE=0.0015
TODAY=$(date +%Y-%m-%d)
LOG="$NICHE/NICHE.md"
PHOTO_CALLS=0; VIDEO_CALLS=0

# The search log: a row per call. NICHE.md is created with its head lines on the first run.
if [ ! -s "$LOG" ]; then
  cat > "$LOG" <<EOT
# The niche of $SLUG

Keywords:
Doors: Photo tab (TikHub fetch_search_photo), video (apidojo keyword search)

## Search log

| Date | Door | Keyword | Page or window | Items | Unique ids | Corrected to | Cost |
|---|---|---|---|---|---|---|---|

## Notes

EOT
fi
logrow() { python3 - "$LOG" "$@" <<'PY'
import sys
log, row = sys.argv[1], "| " + " | ".join(sys.argv[2:]) + " |"
lines = open(log).read().split("\n")
# insert after the last table row of the search log
i = next(i for i, l in enumerate(lines) if l.startswith("## Search log"))
j = i + 1
while j < len(lines) and (lines[j].startswith("|") or not lines[j].strip()): j += 1
k = j - 1
while k > i and not lines[k].startswith("|"): k -= 1
lines.insert(k + 1, row)
open(log, "w").write("\n".join(lines))
PY
}
addkw() { python3 - "$LOG" "$1" <<'PY'
import re, sys
log, kw = sys.argv[1], sys.argv[2]
t = open(log).read()
m = re.search(r"^Keywords:(.*)$", t, re.M)
have = [k.strip() for k in (m.group(1) if m else "").split(",") if k.strip()]
if kw not in have: have.append(kw)
t = re.sub(r"^Keywords:.*$", "Keywords: " + ", ".join(have), t, count=1, flags=re.M)
open(log, "w").write(t)
PY
}

for KW in "$@"; do
  KWSLUG=$(printf '%s' "$KW" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
  addkw "$KW"

  # ------------------------------------------------------------ the Photo tab door
  case ",$DOORS," in *,photo,*)
    echo "== $KW: Photo tab door, up to $PAGES pages =="
    SEARCH_ID=""; SEEN="$NICHE/searches/.photo.$KWSLUG.ids"; : > "$SEEN"
    for ((P=0; P<PAGES; P++)); do
      OUT="$NICHE/searches/photo.$KWSLUG.p$P.json"
      BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
      if [ "$P" -gt 0 ] && [ -z "$SEARCH_ID" ]; then echo "  no search_id from page 0; stopping" >&2; break; fi
      INPUT="{\"keyword\":\"$KW\",\"count\":\"20\",\"offset\":\"$((P * 20))\"${SEARCH_ID:+,\"search_id\":\"$SEARCH_ID\"}}"
      monid_run tikhub /api/v1/tiktok/web/fetch_search_photo "$INPUT" "$OUT" || break
      [ "$BEFORE" = 0 ] && PHOTO_CALLS=$((PHOTO_CALLS + 1))
      # page facts: items, new ids, the search_id for the next page, the spell correction
      read -r ITEMS NEW SEARCH_ID CORR < <(python3 - "$OUT" "$SEEN" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); seen = set(open(sys.argv[2]).read().split())
items = d.get("item_list") or []
ids = [str(i.get("id")) for i in items if i.get("id")]
new = [i for i in ids if i not in seen]
open(sys.argv[2], "a").write("".join(i + "\n" for i in new))
sid = (d.get("extra") or {}).get("logid") or ((d.get("log_pb") or {}).get("impr_id")) or ""
qc = d.get("query_correct_info") or {}
corr = (qc.get("corrected_query") or "").replace(" ", "_") if qc.get("correct_level") else ""
print(len(items), len(new), sid or "-", corr or "-")
PY
)
      CORRTXT=""; [ "$CORR" = "-" ] || CORRTXT=$(printf '%s' "$CORR" | tr '_' ' ')
      echo "  page $P: $ITEMS items, $NEW new${CORRTXT:+, corrected to \"$CORRTXT\"}"
      [ "$BEFORE" = 0 ] && logrow "$TODAY" "photo" "$KW" "p$P" "$ITEMS" "$NEW" "$CORRTXT" "\$$PER_PAGE"
      [ "$SEARCH_ID" = "-" ] && SEARCH_ID=""
      true
      if [ "$ITEMS" -lt 20 ] || [ "$NEW" -eq 0 ]; then echo "  the tab is exhausted for this keyword"; break; fi
    done
    rm -f "$SEEN"
    ;;
  esac

  # ------------------------------------------------------------ the video door
  case ",$DOORS," in *,video,*)
    for RANGE in $WINDOWS; do
      OUT="$NICHE/searches/$KWSLUG.$RANGE.json"
      echo "== $KW: video door ($RANGE, up to $MAXITEMS) =="
      BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
      monid_run apify /apidojo/tiktok-scraper \
        "{\"keywords\":[\"$KW\"],\"sortType\":\"MOST_LIKED\",\"dateRange\":\"$RANGE\",\"maxItems\":$MAXITEMS}" "$OUT" || continue
      N=$(json_rows "$OUT")
      if [ "$BEFORE" = 0 ]; then VIDEO_CALLS=$((VIDEO_CALLS + 1)); logrow "$TODAY" "video" "$KW" "$RANGE" "$N" "$N" "" "\$$(python3 -c "print(f'{$N * $PER_RESULT:.4f}')")"; fi
      echo "  $N results"
    done
    ;;
  esac
done

# ------------------------------------------------------------ covers, now, before the urls die
echo "== covers =="
python3 - "$NICHE" <<'PY' > "$NICHE/searches/.covers.tsv"
import glob, json, os, sys
d = sys.argv[1]; out = {}
for f in glob.glob(os.path.join(d, "searches", "photo.*.json")):
    try: r = json.load(open(f))
    except Exception: continue
    for it in r.get("item_list") or []:
        imgs = ((it.get("imagePost") or {}).get("images") or [])
        u = (((imgs[0] if imgs else {}).get("imageURL") or {}).get("urlList") or [None])[0]
        if it.get("id") and u: out.setdefault(str(it["id"]), u)
for f in glob.glob(os.path.join(d, "searches", "*.json")):
    if os.path.basename(f).startswith("photo."): continue
    try: r = json.load(open(f))
    except Exception: continue
    for it in r if isinstance(r, list) else []:
        u = (it.get("video") or {}).get("cover") if isinstance(it, dict) else None
        if isinstance(it, dict) and it.get("id") and u: out.setdefault(str(it["id"]), u)
for k, u in out.items(): print(f"{k}\t{u}")
PY
HAVE=0; GOT=0; MISS=0
while IFS=$'\t' read -r ID URL; do
  [ -n "$ID" ] || continue
  if [ -s "$NICHE/covers/$ID.jpg" ]; then HAVE=$((HAVE + 1)); continue; fi
  if fetch_cdn "$URL" "$NICHE/covers/$ID.src"; then
    to_jpg "$NICHE/covers/$ID.src" "$NICHE/covers/$ID.jpg" 700 && GOT=$((GOT + 1)) || MISS=$((MISS + 1))
    rm -f "$NICHE/covers/$ID.src"
  else MISS=$((MISS + 1)); fi
done < "$NICHE/searches/.covers.tsv"
rm -f "$NICHE/searches/.covers.tsv"
echo "  $GOT fetched, $HAVE already on disk, $MISS not fetched$([ "$MISS" -gt 0 ] && echo ' (a blocked CDN host: another network or a VPN, then the same command)')"

# ------------------------------------------------------------ spend and the index
USD=$(python3 -c "print(f'{$PHOTO_CALLS * $PER_PAGE + $VIDEO_CALLS * $MAXITEMS * $PER_RESULT:.4f}')")
if [ "$PHOTO_CALLS" -gt 0 ] || [ "$VIDEO_CALLS" -gt 0 ]; then spend "$SLUG" "$USD" "niche search: $PHOTO_CALLS Photo tab pages, $VIDEO_CALLS video searches (video at maxItems; the real count is in NICHE.md)"; fi

if command -v node >/dev/null 2>&1 && [ -d "$ROOT/atlas" ]; then
  ( cd "$ROOT/atlas" && ATLAS_ROOT="$ROOT" node scripts/build-niche.mjs ) || echo "  the niche index did not build; run: scripts/atlas.sh --index" >&2
fi
echo
echo "next: the spread is on http://localhost:3210/app/$SLUG/niche. The Photo tab is not recency-sorted:"
echo "      what wins now comes from the scroll. Run the niche-hunt skill."
