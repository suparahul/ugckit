#!/usr/bin/env bash
# Phase 4, the niche search (the `niche-search` skill): two doors per keyword, three with
# Instagram, through Monid one call at a time, into apps/<slug>/niche/.
#
#   scripts/niche-search.sh <slug> "<keyword>" ["<keyword>" ...]
#       PAGES=5          Photo tab pages per keyword (20 items each, $0.0015 a page),
#                        and Instagram pages per keyword and feed
#       WINDOWS="THIS_MONTH LAST_THREE_MONTHS"   the video door's windows
#       MAXITEMS=100     results per video search ($0.00045 each)
#       DOORS=photo,video   or photo | video to run one door only; add instagram
#                        (DOORS=photo,video,instagram, or DOORS=instagram alone) for the
#                        Instagram hashtag door
#       IG_FEEDS="top recent"   the Instagram door's feeds ($0.003 a page)
#
# The Photo tab door is TikHub fetch_search_photo: slideshows only, full counts including
# saves, no sort and no date parameter (both are local; the tab is not recency-sorted, and
# most of it is older than 90 days). Page 0 has no search_id; every later page passes
# extra.logid from page 0. TikTok spell-corrects the keyword (query_correct_info on page
# 0); the corrected phrase is recorded. The video door is the apidojo keyword search with
# MOST_LIKED and a date window, the same call as R1; it never returns a slideshow. The
# Instagram door is TikHub fetch_hashtag_posts on the keyword as a hashtag (spaces out),
# feed_type top and recent, paged on pagination_token (a page can come back empty and the
# next one full: only a missing token ends the feed). Instagram reports no saves and no
# shares, and no views on a photo or a carousel.
#
# Writes searches/photo.<kw>.p<N>.json, searches/<kw>.<WINDOW>.json,
# instagram/searches/hashtag.<tag>.<feed>.p<N>.json, the search log in NICHE.md, then runs
# scripts/niche-import.sh: the covers (covers/<postId>.jpg, instagram/covers/<id>.jpg,
# fetched now because the urls expire) and the Atlas's niche index. Files that exist and
# parse are reused and cost nothing, so a killed run resumes.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,20p "$0"; exit 2; }
SLUG=$1; shift
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
ROOT="$PROJ_ROOT"
NICHE="$ROOT/apps/$SLUG/niche"
mkdir -p "$NICHE/searches" "$NICHE/covers"
PAGES="${PAGES:-5}"; WINDOWS="${WINDOWS:-THIS_MONTH LAST_THREE_MONTHS}"; MAXITEMS="${MAXITEMS:-100}"; DOORS="${DOORS:-photo,video}"
IG_FEEDS="${IG_FEEDS:-top recent}"
PER_PAGE=0.0015
IG_PER_PAGE=0.003
TODAY=$(date +%Y-%m-%d)
LOG="$NICHE/NICHE.md"
PHOTO_CALLS=0; VIDEO_CALLS=0; IG_CALLS=0

# The search log: a row per call. NICHE.md is created with its head lines on the first run.
if [ ! -s "$LOG" ]; then
  cat > "$LOG" <<EOT
# The niche of $SLUG

Keywords:
Doors: Photo tab (TikHub fetch_search_photo), video (apidojo keyword search), instagram (TikHub fetch_hashtag_posts, when asked)

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

  # ------------------------------------------------------------ the Instagram door
  case ",$DOORS," in *,instagram,*)
    TAG=$(printf '%s' "$KW" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')
    mkdir -p "$NICHE/instagram/searches"
    for FEED in $IG_FEEDS; do
      echo "== $KW: Instagram door (#$TAG, $FEED, up to $PAGES pages) =="
      TOKEN=""; SEEN="$NICHE/instagram/searches/.hashtag.$TAG.$FEED.ids"; : > "$SEEN"
      for ((P=0; P<PAGES; P++)); do
        OUT="$NICHE/instagram/searches/hashtag.$TAG.$FEED.p$P.json"
        BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
        if [ "$P" -gt 0 ] && [ -z "$TOKEN" ]; then echo "  no pagination_token: the feed is done"; break; fi
        INPUT="{\"keyword\":\"$TAG\",\"feed_type\":\"$FEED\"${TOKEN:+,\"pagination_token\":\"$TOKEN\"}}"
        monid_run tikhub /api/v1/instagram/v2/fetch_hashtag_posts "$INPUT" "$OUT" || break
        [ "$BEFORE" = 0 ] && IG_CALLS=$((IG_CALLS + 1))
        read -r ITEMS NEW TOKEN < <(python3 - "$OUT" "$SEEN" <<'PY'
import json, sys
d = json.loads(open(sys.argv[1], encoding="utf-8").read(), strict=False); seen = set(open(sys.argv[2]).read().split())
o = d.get("output") or d
items = (o.get("data") or {}).get("items") or []
ids = [str(i.get("pk") or i.get("id") or "").split("_")[0] for i in items]
new = [i for i in ids if i and i not in seen]
open(sys.argv[2], "a").write("".join(i + "\n" for i in new))
print(len(items), len(new), o.get("pagination_token") or "-")
PY
)
        [ "$TOKEN" = "-" ] && TOKEN=""
        echo "  page $P: $ITEMS items, $NEW new"
        [ "$BEFORE" = 0 ] && logrow "$TODAY" "instagram" "#$TAG" "$FEED p$P" "$ITEMS" "$NEW" "" "\$$IG_PER_PAGE"
        true
      done
      rm -f "$SEEN"
    done
    ;;
  esac
done

# ------------------------------------------------------------ spend
USD=$(python3 -c "print(f'{$PHOTO_CALLS * $PER_PAGE + $VIDEO_CALLS * $MAXITEMS * $PER_RESULT + $IG_CALLS * $IG_PER_PAGE:.4f}')")
if [ "$PHOTO_CALLS" -gt 0 ] || [ "$VIDEO_CALLS" -gt 0 ] || [ "$IG_CALLS" -gt 0 ]; then spend "$SLUG" "$USD" "niche search: $PHOTO_CALLS Photo tab pages, $VIDEO_CALLS video searches (video at maxItems; the real count is in NICHE.md), $IG_CALLS Instagram pages"; fi

# ------------------------------------------------------------ covers, now, before the urls die; the index
"$SCRIPTS/niche-import.sh" "$SLUG" || echo "  covers or the index did not finish: run scripts/niche-import.sh $SLUG again, soon (the urls expire)" >&2
echo
echo "next: the spread is on http://localhost:3210/app/$SLUG/niche. The Photo tab is not recency-sorted:"
echo "      what wins now comes from the scroll. Run the niche-hunt skill."
