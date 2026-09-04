#!/usr/bin/env bash
# Stage R2: for one app, find the handles that really promote it.
#
#   scripts/network.sh <project> <app> <keyword|url> [...]     search; write candidates.tsv
#   scripts/network.sh <project> <app> --comments <post-url> [...]   read the comments of posts
#
# Keywords are the app's name in its variants. An argument that starts with https:// is
# a TikTok page -- a hashtag page, or the app's sound page, which lists every post that
# used it, named or not. Both cost about $0.00045 a result.
#
# --comments is for the hidden promoters: the app is on the screen but not in the
# caption, and the comments ask "what app is this". It reads the top comments of the
# posts you name and prints the ones that mention an app or ask for one. A different
# endpoint, billed per call: $0.00375 a post, whatever the count.
set -euo pipefail

[ $# -ge 3 ] || { echo "usage: $0 <project> <app> <keyword|url> [...]  |  --comments <post-url> [...]" >&2; exit 2; }
NAME=$1; APP=$2; shift 2

. "$(cd "$(dirname "$0")" && pwd)/monid.sh"
DIR="$(research_dir "$NAME")/$APP"
STATE="$(cd "$(dirname "$0")" && pwd)/state.py"
python3 "$STATE" apps "$NAME" | cut -f1 | grep -qx "$APP" \
  || { echo "'$APP' is not in the app ledger -- run: scripts/state.py app $NAME $APP" >&2; exit 1; }
MAXITEMS="${MAXITEMS:-40}"
CALLS=0

# ---------------------------------------------------------------- comments
if [ "$1" = "--comments" ]; then
  shift
  mkdir -p "$DIR/comments"
  MAXC="${MAXC:-40}"
  PER_CALL_COMMENTS=0.00375
  for URL in "$@"; do
    ID=$(printf '%s' "$URL" | sed -E 's#.*/(video|photo)/([0-9]+).*#\2#')
    OUT="$DIR/comments/$ID.json"
    echo "== comments of $ID =="
    BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
    monid_run apify /scraptik/tiktok-comments-scraper-api \
      "{\"listComments_awemeId\":\"$ID\",\"listComments_count\":$MAXC}" "$OUT" || continue
    [ "$BEFORE" = 0 ] && CALLS=$((CALLS + 1))
    AUTHOR=$(printf '%s' "$URL" | sed -nE 's#.*/@([^/]+)/.*#\1#p')
    python3 - "$OUT" "$APP" "$AUTHOR" <<'PY'
import json, re, sys
raw = json.load(open(sys.argv[1]))
app, author = sys.argv[2].lower(), sys.argv[3].lower()
pages = raw if isinstance(raw, list) else [raw]
rows = []
for pg in pages:
    for c in (pg.get("comments") or []) if isinstance(pg, dict) else []:
        rows.append((c, False))
        for r in c.get("reply_comment") or []:
            rows.append((r, True))
ask = re.compile(r"\b(what|which|wat|whats|name|called|link)\b.{0,40}(\bapp\b|\?)|\bapp\b.{0,20}\?", re.I)
hits = []
for c, is_reply in rows:
    t = (c.get("text") or "").replace("\n", " ").strip()
    u = ((c.get("user") or {}).get("unique_id") or "").lower()
    tag = []
    if app and app in re.sub(r"[^a-z0-9]", "", t.lower()): tag.append("NAMES-APP")
    if ask.search(t): tag.append("asks")
    if author and u == author: tag.append("AUTHOR-REPLY" if is_reply else "AUTHOR")
    # A like from the author is only a signal on a comment that is already about the app.
    if tag and c.get("is_author_digged"): tag.append("author-liked")
    if tag:
        hits.append((c.get("digg_count") or 0, " ".join(tag), u, ("  > " if is_reply else "") + t[:110]))
total = pages[0].get("total") if pages and isinstance(pages[0], dict) else ""
print(f"  {len(rows)} comments read of {total}, {len(hits)} of interest")
for likes, tag, u, t in sorted(hits, key=lambda h: -h[0])[:20]:
    print(f"  {likes:>6} {tag:<26} @{u:<22} {t}")
PY
  done
  if [ "$CALLS" -gt 0 ]; then
    USD=$(python3 -c "print(f'{$CALLS * $PER_CALL_COMMENTS:.4f}')")
    spend "$NAME" "$USD" "R2 network/$APP: comments of $CALLS posts"
  fi
  exit 0
fi

# ---------------------------------------------------------------- searches
mkdir -p "$DIR/searches"
for KW in "$@"; do
  case "$KW" in
    https://*) SLUG=$(printf '%s' "$KW" | sed -E 's#https?://[^/]+/##' | tr '[:upper:]/?=&' '[:lower:]----' | tr -cd 'a-z0-9-' | cut -c1-60)
               INPUT="{\"startUrls\":[\"$KW\"],\"maxItems\":$MAXITEMS}"
               RANGES="PAGE" ;;
    *)         SLUG=$(printf '%s' "$KW" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')
               RANGES="ALL_TIME LAST_THREE_MONTHS" ;;
  esac
  for RANGE in $RANGES; do
    OUT="$DIR/searches/$SLUG.$RANGE.json"
    echo "== $KW ($RANGE) =="
    [ "$RANGE" = PAGE ] || INPUT="{\"keywords\":[\"$KW\"],\"sortType\":\"MOST_LIKED\",\"dateRange\":\"$RANGE\",\"maxItems\":$MAXITEMS}"
    BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
    monid_run apify /apidojo/tiktok-scraper "$INPUT" "$OUT"
    [ "$BEFORE" = 0 ] && CALLS=$((CALLS + 1))
  done
done

# candidates.tsv: one row per handle, with the evidence columns the decision needs.
#   names_app   the caption or a hashtag contains the app's name, in how many posts
#   in_handle   the handle or the display name contains it
#   in_sound    the post's sound is the app's own original sound
# A row with zeros in all three is a candidate for `reject`, or for --comments if the
# post is big enough to matter.
echo
echo "== candidates =="
python3 - "$DIR" "$APP" <<'PY'
import glob, json, os, re, sys
d, app = sys.argv[1], sys.argv[2]
tok = re.sub(r"[^a-z0-9]", "", app.lower())
def has(s):
    if isinstance(s, dict): s = s.get("name")
    return tok in re.sub(r"[^a-z0-9]", "", (s or "").lower())
H = {}
for f in sorted(glob.glob(os.path.join(d, "searches", "*.json"))):
    try:
        rows = json.load(open(f))
    except Exception:
        continue
    for r in rows if isinstance(rows, list) else []:
        if not isinstance(r, dict):
            continue
        ch = r.get("channel") or {}
        u = ch.get("username") or ""
        if not u:
            continue
        e = H.setdefault(u, {"name": ch.get("name") or "", "followers": ch.get("followers") or "",
                             "posts": 0, "names": 0, "sound": 0, "best": None, "ids": set()})
        if r.get("id") in e["ids"]:
            continue
        e["ids"].add(r.get("id")); e["posts"] += 1
        if has(r.get("title")) or any(has(h) for h in r.get("hashtags") or []):
            e["names"] += 1
        song = r.get("song") or {}
        if has(song.get("title")) or has(song.get("artist")):
            e["sound"] += 1
        if e["best"] is None or (r.get("views") or 0) > (e["best"].get("views") or 0):
            e["best"] = r
out = os.path.join(d, "candidates.tsv")
with open(out, "w") as fh:
    fh.write("handle\tname\tfollowers\tposts\tnames_app\tin_handle\tin_sound\tbest_views\tbest_url\tcaption\n")
    for u, e in sorted(H.items(), key=lambda kv: (-(kv[1]["names"] + kv[1]["sound"] > 0), -(kv[1]["best"].get("views") or 0))):
        b = e["best"]
        cap = (b.get("title") or "").replace("\n", " ").replace("\t", " ")[:160]
        fh.write("\t".join(str(x) for x in [
            u, e["name"].replace("\t", " "), e["followers"], e["posts"], e["names"],
            "yes" if has(u) or has(e["name"]) else "no", e["sound"],
            b.get("views") or 0, b.get("postPage") or "", cap]) + "\n")
yes = sum(1 for e in H.values() if e["names"] or e["sound"] or has(e["name"]))
print(f"{len(H)} handles -> {out}")
print(f"{yes} carry the app's name in a caption, hashtag, handle or sound; {len(H) - yes} do not")
PY

if [ "$CALLS" -gt 0 ]; then
  USD=$(python3 -c "print(f'{$CALLS * $MAXITEMS * $PER_RESULT:.4f}')")
  spend "$NAME" "$USD" "R2 network/$APP: $CALLS searches x $MAXITEMS results"
fi

echo
echo "next: read $DIR/candidates.tsv. Evidence in, no evidence out:"
echo "      scripts/state.py handle $NAME $APP <handle> \"<the evidence>\""
echo "      scripts/state.py reject $NAME <handle> \"<why>\""
echo "      a big post with no name anywhere: scripts/network.sh $NAME $APP --comments <best_url>"
