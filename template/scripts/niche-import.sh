#!/usr/bin/env bash
# The niche page from what is already on disk: no Monid call, no cost. Run it whenever
# search files land in apps/<slug>/niche/ by any road (niche-search.sh runs it at its end).
#
#   scripts/niche-import.sh <slug>
#
# 1. Covers not yet on disk are fetched from the signed urls in the search files (the free
#    CDN, rule 12), now, before the urls die:
#      TikTok     searches/photo.*, searches/general.*, searches/<kw>.<WINDOW>.json -> covers/<id>.jpg
#      Instagram  instagram/searches/hashtag.*                                      -> instagram/covers/<id>.jpg
#    A url past its expiry (TikTok x-expires, Instagram oe) is skipped, not tried.
# 2. atlas/data/niche-<slug>.json is rebuilt (atlas/scripts/build-niche.mjs), which reads
#    every search shape itself, the TikHub general search and the Instagram hashtag pages too.
set -euo pipefail

[ $# -eq 1 ] || { sed -n 2,13p "$0"; exit 2; }
SLUG=$1
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
ROOT="$PROJ_ROOT"
NICHE="$ROOT/apps/$SLUG/niche"
[ -d "$NICHE/searches" ] || [ -d "$NICHE/instagram/searches" ] || { echo "no searches under $NICHE yet (run scripts/niche-search.sh first)" >&2; exit 1; }
mkdir -p "$NICHE/covers"
[ -d "$NICHE/instagram/searches" ] && mkdir -p "$NICHE/instagram/covers"

echo "== covers =="
LIST="$(mktemp)"; trap 'rm -f "$LIST"' EXIT
# One line per cover still to fetch: <folder under niche/>\t<id>\t<url>. The Instagram pages
# hold raw control characters inside strings, so every file is read with strict=False.
python3 - "$NICHE" <<'PY' > "$LIST"
import glob, json, os, re, sys, time
d = sys.argv[1]; now = time.time(); out = {}; stale = 0

def load(f):
    try: return json.loads(open(f, encoding="utf-8").read(), strict=False)
    except Exception: return None

def live(u):
    m = re.search(r"[?&]x-expires=(\d+)", u) or None
    if m: return int(m.group(1)) > now
    m = re.search(r"[?&]oe=([0-9A-Fa-f]+)", u)
    return not m or int(m.group(1), 16) > now

def add(folder, pid, u):
    global stale
    if not pid or not u: return
    key = (folder, str(pid))
    if key in out or os.path.exists(os.path.join(d, folder, f"{pid}.jpg")): return
    if not live(u): stale += 1; return
    out[key] = u

for f in sorted(glob.glob(os.path.join(d, "searches", "*.json"))):
    r = load(f); name = os.path.basename(f)
    if r is None: continue
    if name.startswith("photo."):
        for it in r.get("item_list") or []:
            imgs = (it.get("imagePost") or {}).get("images") or []
            add("covers", it.get("id"), (((imgs[0] if imgs else {}).get("imageURL") or {}).get("urlList") or [None])[0])
    elif name.startswith("general."):
        for x in r.get("data") or []:
            a = (x or {}).get("aweme_info") or {}
            img = ((a.get("image_post_info") or {}).get("images") or [{}])[0]
            u = (((img.get("display_image") or {}).get("url_list") or [None])[0]
                 or ((img.get("owner_watermark_image") or {}).get("url_list") or [None])[0]
                 or (((a.get("video") or {}).get("cover") or {}).get("url_list") or [None])[0])
            add("covers", a.get("aweme_id"), u)
    elif isinstance(r, list):
        for it in r:
            if isinstance(it, dict): add("covers", it.get("id"), ((it.get("images") or [{}])[0] or {}).get("url") or (it.get("video") or {}).get("cover"))

for f in sorted(glob.glob(os.path.join(d, "instagram", "searches", "hashtag.*.json"))):
    r = load(f)
    if not isinstance(r, dict): continue
    items = ((r.get("output") or r).get("data") or {}).get("items") or []
    for it in items:
        iv = it.get("image_versions")
        cands = iv if isinstance(iv, list) else (iv or {}).get("items") or ((it.get("image_versions2") or {}).get("candidates")) or []
        add(os.path.join("instagram", "covers"), str(it.get("pk") or it.get("id") or "").split("_")[0], it.get("thumbnail_url") or (cands[0] if cands else {}).get("url"))

for (folder, pid), u in out.items(): print(f"{folder}\t{pid}\t{u}")
print(f"{stale} covers not on disk have an expired url", file=sys.stderr)
PY
GOT=0; MISS=0
while IFS=$'\t' read -r DIR ID URL; do
  [ -n "$ID" ] || continue
  if fetch_cdn "$URL" "$NICHE/$DIR/$ID.src"; then
    to_jpg "$NICHE/$DIR/$ID.src" "$NICHE/$DIR/$ID.jpg" 700 && GOT=$((GOT + 1)) || MISS=$((MISS + 1))
    rm -f "$NICHE/$DIR/$ID.src"
  else MISS=$((MISS + 1)); fi
done < "$LIST"
echo "  $GOT fetched, $MISS not fetched$([ "$MISS" -gt 0 ] && echo ' (a blocked CDN host: another network or a VPN, then the same command, soon)')"
echo "  on disk: $(ls "$NICHE/covers" | grep -c '\.jpg$' || true) TikTok covers$([ -d "$NICHE/instagram/covers" ] && echo ", $(ls "$NICHE/instagram/covers" | grep -c '\.jpg$' || true) Instagram covers")"

echo "== the niche index =="
if command -v node >/dev/null 2>&1 && [ -d "$ROOT/atlas" ]; then
  ( cd "$ROOT/atlas" && ATLAS_ROOT="$ROOT" node --no-warnings scripts/build-niche.mjs ) || { echo "  the niche index did not build; run: scripts/atlas.sh --index" >&2; exit 1; }
else
  echo "  no node or no atlas/: the index is built at the next scripts/atlas.sh --index"
fi
echo
echo "the niche page: http://localhost:3210/app/$SLUG/niche"
