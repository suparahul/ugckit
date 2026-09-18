#!/usr/bin/env bash
# Phase 4, the fetch (the `niche-fetch` skill): everything the user brought in one batch,
# pulled through Monid into apps/<slug>/niche/batches/<date>/.
#
#   scripts/niche-fetch.sh <slug> <date> --plan     what would be fetched and what it costs; spends nothing
#   scripts/niche-fetch.sh <slug> <date>            fetch it
#
# Reads batches/<date>/LINKS.md (the niche-hunt skill writes it, verbatim). Each row is a
# post link, a handle, or a screenshot line the agent turned into "@handle" with the
# caption in its note. Then:
#   1. short links (tiktok.com/t/...) are resolved: curl -sIL first, then unshorten.me
#      (free, ten a day) when TikTok is blocked from this network -> resolved.tsv
#   2. one apidojo call with every post url in startUrls ($0.00045 a post) -> posts.raw.json;
#      one apidojo call per handle, the profile url, 30 posts ($0.0135) -> <handle>.profile.raw.json
#   3. a screenshot row is matched to a profile post by its caption (word overlap); no
#      match, or no handle on the row, and it stays evidence only, said in the report
#   4. TikHub fetch_video_comments per post, 20 comments ($0.0015) -> <handle>/<id>/comments.json
#   5. every slide from the signed urls, now (rule 12) -> slide-NN.jpg; a video post ->
#      video.mp4 (ffprobed, rule 14) + sheet-N.jpg contact sheets + transcript.txt (local
#      Whisper, free); post.json per post
# Ten posts and one profile: about $0.03. Files that exist are reused; a killed run resumes.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,22p "$0"; exit 2; }
SLUG=$1; DATE=$2; shift 2
PLAN=0; [ "${1:-}" = "--plan" ] && PLAN=1
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
ROOT="$PROJ_ROOT"
B="$ROOT/apps/$SLUG/niche/batches/$DATE"
LINKS="$B/LINKS.md"
[ -s "$LINKS" ] || { echo "no $LINKS -- the niche-hunt skill writes it from what the user brought" >&2; exit 1; }
PER_COMMENTS=0.0015; PROFILE_ITEMS=30
PY="$ROOT/.venv/bin/python3"; [ -x "$PY" ] || PY=python3

# ---------------------------------------------------------------- 1. read and resolve
python3 - "$LINKS" > "$B/.rows.tsv" <<'PY'
import re, sys
for l in open(sys.argv[1]):
    if not l.startswith("|"): continue
    c = [x.strip() for x in l.strip().strip("|").split("|")]
    if len(c) < 2 or not c[0].isdigit(): continue
    what, src, note = c[1].strip("`"), (c[2] if len(c) > 2 else ""), (c[3] if len(c) > 3 else "")
    kind = "post" if re.search(r"tiktok\.com/.*/(photo|video)/\d+", what) else "short" if re.search(r"tiktok\.com/t/|vm\.tiktok\.com|vt\.tiktok\.com", what) else "handle" if re.match(r"^@[\w.]+$", what) else "screenshot" if re.search(r"\.(png|jpe?g|webp)$", what, re.I) else "unknown"
    print("\t".join([c[0], kind, what, src, note]))
PY
RES="$B/resolved.tsv"; touch "$RES"
resolve() {  # short url -> full url, cached in resolved.tsv
  local u="$1" hit
  hit=$(awk -F'\t' -v u="$u" '$1==u {print $2}' "$RES" | head -1)
  [ -n "$hit" ] && { printf '%s' "$hit"; return 0; }
  [ "$PLAN" = 1 ] && { printf ''; return 0; }
  local full
  full=$(curl -sIL --max-time 20 -A "Mozilla/5.0" -o /dev/null -w '%{url_effective}' "$u" 2>/dev/null || true)
  case "$full" in *tiktok.com/*/photo/*|*tiktok.com/*/video/*) ;; *)
    # TikTok is blocked from some networks (the short link lands on /xx/about); a foreign resolver.
    full=$(curl -sf --max-time 30 "https://unshorten.me/json/$u" | python3 -c "import json,sys; print(json.load(sys.stdin).get('resolved_url',''))" 2>/dev/null || true) ;;
  esac
  full=${full%%\?*}
  case "$full" in *tiktok.com/*/photo/*|*tiktok.com/*/video/*) printf '%s\t%s\n' "$u" "$full" >> "$RES"; printf '%s' "$full" ;; *) printf '' ;; esac
}
POSTS=(); HANDLES=(); SHOTS=(); UNRESOLVED=()
while IFS=$'\t' read -r N KIND WHAT SRC NOTE; do
  case "$KIND" in
    post) POSTS+=("${WHAT%%\?*}") ;;
    short) if [ "$PLAN" = 1 ]; then POSTS+=("$WHAT"); else F=$(resolve "$WHAT"); if [ -n "$F" ]; then POSTS+=("$F"); else UNRESOLVED+=("$WHAT"); fi; fi ;;
    handle) HANDLES+=("${WHAT#@}") ;;
    screenshot) SHOTS+=("$WHAT") ;;
    *) UNRESOLVED+=("$WHAT") ;;
  esac
done < "$B/.rows.tsv"
# handles named in a screenshot row's note ("@handle ...") are fetched too
while IFS=$'\t' read -r N KIND WHAT SRC NOTE; do
  [ "$KIND" = screenshot ] || continue
  H=$(printf '%s' "$NOTE" | grep -o '@[A-Za-z0-9._]*' | head -1 | tr -d '@' || true)
  [ -n "$H" ] && HANDLES+=("$H")
done < "$B/.rows.tsv"
HANDLES=($(printf '%s\n' "${HANDLES[@]:-}" | grep -v '^$' | sort -u || true))

NP=${#POSTS[@]}; NH=${#HANDLES[@]}
USD_POSTS=$(python3 -c "print(f'{$NP * $PER_RESULT:.4f}')")
USD_PROF=$(python3 -c "print(f'{$NH * $PROFILE_ITEMS * $PER_RESULT:.4f}')")
echo "batch $DATE: $NP post link(s), $NH handle(s), ${#SHOTS[@]} screenshot(s), ${#UNRESOLVED[@]} not resolved"
for u in "${UNRESOLVED[@]:-}"; do [ -n "$u" ] && echo "  not resolved: $u"; done
if [ "$PLAN" = 1 ]; then
  SHORTS=$(awk -F'\t' '$2=="short"' "$B/.rows.tsv" | wc -l | tr -d ' ')
  echo "plan: $NP posts \$$USD_POSTS + $NH profiles at $PROFILE_ITEMS posts \$$USD_PROF + comments on about $((NP + NH)) posts \$$(python3 -c "print(f'{($NP + $NH) * $PER_COMMENTS:.4f}')") = about \$$(python3 -c "print(f'{$NP * $PER_RESULT + $NH * $PROFILE_ITEMS * $PER_RESULT + ($NP + $NH) * $PER_COMMENTS:.3f}')")"
  [ "$SHORTS" -gt 0 ] && echo "      ($SHORTS short link(s) are resolved at fetch time, free; a link that does not resolve is reported and skipped)"
  echo "      slides, videos, contact sheets and transcripts are free"
  exit 0
fi

# ---------------------------------------------------------------- 2. the calls
CALLS_RESULTS=0; CALLS_COMMENTS=0
if [ "$NP" -gt 0 ]; then
  OUT="$B/posts.raw.json"
  BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
  URLS=$(printf '%s\n' "${POSTS[@]}" | python3 -c "import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))")
  echo "== $NP posts (one call) =="
  monid_run apify /apidojo/tiktok-scraper "{\"startUrls\":$URLS,\"maxItems\":$NP}" "$OUT" || true
  [ "$BEFORE" = 0 ] && [ -s "$OUT" ] && CALLS_RESULTS=$((CALLS_RESULTS + NP))
fi
for H in "${HANDLES[@]:-}"; do
  [ -n "$H" ] || continue
  OUT="$B/$H.profile.raw.json"
  BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
  echo "== @$H profile ($PROFILE_ITEMS posts) =="
  monid_run apify /apidojo/tiktok-scraper "{\"startUrls\":[\"https://www.tiktok.com/@$H\"],\"maxItems\":$PROFILE_ITEMS}" "$OUT" || true
  [ "$BEFORE" = 0 ] && [ -s "$OUT" ] && CALLS_RESULTS=$((CALLS_RESULTS + PROFILE_ITEMS))
done

# ---------------------------------------------------------------- 3. which posts to read: the links, the top 3 of each profile, the screenshot matches
python3 - "$B" "${HANDLES[@]:-}" > "$B/.read.tsv" <<'PY'
import json, os, re, sys
b = sys.argv[1]; handles = [h for h in sys.argv[2:] if h]
rows = {}
def add(r, why):
    if not isinstance(r, dict) or not r.get("id"): return
    u = (r.get("channel") or {}).get("username") or ""
    rows.setdefault(str(r["id"]), (u, r, why))
p = os.path.join(b, "posts.raw.json")
if os.path.exists(p):
    try:
        for r in json.load(open(p)): add(r, "link")
    except Exception: print("posts.raw.json is not JSON", file=sys.stderr)
shots = []
for l in open(os.path.join(b, ".rows.tsv")):
    n, kind, what, src, note = (l.rstrip("\n").split("\t") + [""] * 5)[:5]
    if kind == "screenshot": shots.append((what, note))
def words(t): return set(w for w in re.findall(r"[a-z0-9']+", (t or "").lower()) if len(w) > 2)
for h in handles:
    p = os.path.join(b, f"{h}.profile.raw.json")
    if not os.path.exists(p): continue
    try: posts = [r for r in json.load(open(p)) if isinstance(r, dict)]
    except Exception: print(f"{h}.profile.raw.json is not JSON", file=sys.stderr); continue
    posts.sort(key=lambda r: -(r.get("views") or 0))
    for r in posts[:3]: add(r, f"profile top 3 @{h}")
    for shot, note in shots:
        if f"@{h}" not in note: continue
        cap = re.sub(r"@[\w.]+", "", note)
        best, score = None, 0
        for r in posts:
            w1, w2 = words(cap), words(r.get("title"))
            s = len(w1 & w2) / len(w1) if w1 else 0
            if s > score: best, score = r, s
        if best and score >= 0.6: add(best, f"screenshot {os.path.basename(shot)} matched ({int(score*100)}%)")
        else: print(f"screenshot {os.path.basename(shot)}: no post of @{h} matches its caption; kept as evidence only", file=sys.stderr)
for pid, (u, r, why) in rows.items():
    imgs = [i.get("url") for i in (r.get("images") or []) if isinstance(i, dict) and i.get("url")]
    print("\t".join([u, pid, "photo" if imgs else "video", str(r.get("views") or 0), ((r.get("video") or {}).get("url") or ""), "\x1f".join(imgs), why]))
PY

# ---------------------------------------------------------------- 4 and 5. comments, slides, videos, sheets, transcripts
NREAD=$(wc -l < "$B/.read.tsv" | tr -d ' ')
echo "== $NREAD posts to read =="
while IFS=$'\t' read -r H ID KIND VIEWS VURL IMGS WHY; do
  P="$B/$H/$ID"; mkdir -p "$P"
  echo "  -- @$H $ID  $KIND  $VIEWS views  ($WHY)"
  # post.json: the raw record of this post, from whichever file holds it
  python3 - "$B" "$H" "$ID" "$P/post.json" <<'PY'
import glob, json, sys
b, h, pid, out = sys.argv[1:5]
for f in [f"{b}/posts.raw.json"] + glob.glob(f"{b}/*.profile.raw.json"):
    try: rows = json.load(open(f))
    except Exception: continue
    for r in rows:
        if isinstance(r, dict) and str(r.get("id")) == pid:
            json.dump(r, open(out, "w"), indent=2); sys.exit(0)
PY
  OUT="$P/comments.json"
  BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
  monid_run tikhub /api/v1/tiktok/app/v3/fetch_video_comments "{\"aweme_id\":\"$ID\",\"count\":\"20\",\"cursor\":\"0\"}" "$OUT" || true
  [ "$BEFORE" = 0 ] && [ -s "$OUT" ] && CALLS_COMMENTS=$((CALLS_COMMENTS + 1))
  if [ "$KIND" = photo ]; then
    I=0; OLDIFS=$IFS; IFS=$'\x1f'
    for U in $IMGS; do
      I=$((I + 1)); SL=$(printf '%s/slide-%02d' "$P" "$I")
      [ -s "$SL.jpg" ] && continue
      if fetch_cdn "$U" "$SL.src"; then to_jpg "$SL.src" "$SL.jpg" 1080; fi
      rm -f "$SL.src"
    done
    IFS=$OLDIFS
    NS=$(ls "$P"/slide-*.jpg 2>/dev/null | wc -l | tr -d ' ' || true)
    BAD=0; for f in "$P"/slide-*.jpg; do [ -e "$f" ] || continue; ffprobe -v error "$f" >/dev/null 2>&1 || { BAD=$((BAD + 1)); rm -f "$f"; }; done
    echo "     ${NS:-0} slides$([ "$BAD" -gt 0 ] && echo ", $BAD not a real image and removed")"
    [ "${NS:-0}" -gt 0 ] || echo "     no slides downloaded -- the urls have expired or the CDN host is blocked (rule 12)"
  else
    if [ ! -s "$P/video.mp4" ]; then fetch_cdn "$VURL" "$P/video.mp4" || { echo "     video download failed"; continue; }; fi
    verify_video "$P/video.mp4" || continue
    ls "$P"/sheet-*.jpg >/dev/null 2>&1 || ffmpeg -y -loglevel error -i "$P/video.mp4" -vf "fps=1,scale=270:480,tile=4x4:padding=4:color=white" "$P/sheet-%d.jpg"
    if [ ! -s "$P/transcript.txt" ]; then
      ffmpeg -y -loglevel error -i "$P/video.mp4" -vn -ac 1 -ar 16000 "$P/.audio.wav" && "$PY" - "$P/.audio.wav" "$P/transcript.txt" <<'PY' || echo "     transcript failed (faster-whisper missing? .venv/bin/pip install -r requirements.txt)"
import sys
from faster_whisper import WhisperModel
m = WhisperModel("base.en", device="cpu", compute_type="int8")
segs, info = m.transcribe(sys.argv[1], vad_filter=True)
with open(sys.argv[2], "w") as f:
    for s in segs: f.write(f"[{s.start:5.2f} - {s.end:5.2f}] {s.text.strip()}\n")
PY
      rm -f "$P/.audio.wav"
    fi
    echo "     video.mp4 + $(ls "$P"/sheet-*.jpg 2>/dev/null | wc -l | tr -d ' ') sheet(s)$([ -s "$P/transcript.txt" ] && echo ' + transcript')"
  fi
done < "$B/.read.tsv"
rm -f "$B/.rows.tsv" "$B/.read.tsv"

USD=$(python3 -c "print(f'{$CALLS_RESULTS * $PER_RESULT + $CALLS_COMMENTS * $PER_COMMENTS:.4f}')")
[ "$CALLS_RESULTS" -gt 0 ] || [ "$CALLS_COMMENTS" -gt 0 ] && spend "$SLUG" "$USD" "niche batch $DATE: $CALLS_RESULTS results, $CALLS_COMMENTS comment calls" || true
echo
echo "next: the niche-read skill -- read every slide, sheet and transcript under $B from disk;"
echo "      scripts/niche-stats.py $SLUG $DATE does the counting."
