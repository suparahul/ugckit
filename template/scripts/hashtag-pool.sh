#!/usr/bin/env bash
# Phase 7 (the `plan` skill): measure a hashtag pool through Monid, one TikHub call per
# tag, serial, $0.0015 a tag, into apps/<slug>/strategy/HASHTAG-POOL.md.
#
#   scripts/hashtag-pool.sh <slug> "#cattips" "#catcare" ["#tag" ...]
#   scripts/hashtag-pool.sh <slug> --from-niche [N]      the N most-used tags of the niche's posts (default 40)
#
# TikHub fetch_hashtag_search_result returns challenge_list[] with cha_name, view_count
# (TikTok's lifetime total for the tag, all formats) and user_count (posts); the figure
# kept is the exact-name match. The niche usage column counts the posts of niche/ (the
# searches and the batches) whose caption carries the tag, with their median views.
# A tag already measured (strategy/tags/<tag>.json) costs nothing again.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,12p "$0"; exit 2; }
SLUG=$1; shift
SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPTS/monid.sh"
ROOT="$PROJ_ROOT"
STRAT="$ROOT/apps/$SLUG/strategy"; TAGS="$STRAT/tags"
mkdir -p "$TAGS"
PER_TAG=0.0015

if [ "${1:-}" = "--from-niche" ]; then
  N=${2:-40}
  set -- $(python3 - "$ROOT/apps/$SLUG/niche" "$N" <<'PY'
import collections, glob, json, os, re, sys
d, n = sys.argv[1], int(sys.argv[2]); c = collections.Counter()
def tags_of(t): return set(x.lower() for x in re.findall(r"#([\w]+)", t or ""))
for f in glob.glob(os.path.join(d, "searches", "*.json")):
    try: j = json.load(open(f))
    except Exception: continue
    items = j.get("item_list") if isinstance(j, dict) else j
    for it in items or []:
        if not isinstance(it, dict): continue
        for t in tags_of(it.get("desc") or it.get("title") or ""): c[t] += 1
for f in glob.glob(os.path.join(d, "batches", "*", "*", "*", "post.json")):
    try: r = json.load(open(f))
    except Exception: continue
    for t in tags_of(r.get("title") or ""): c[t] += 1
print(" ".join("#" + t for t, _ in c.most_common(n)))
PY
)
  [ $# -gt 0 ] || { echo "no hashtags found under apps/$SLUG/niche -- run the niche search first" >&2; exit 1; }
  echo "the $# most-used tags of the niche: $*"
fi

CALLS=0
for RAW in "$@"; do
  TAG=$(printf '%s' "$RAW" | tr -d '#' | tr '[:upper:]' '[:lower:]')
  OUT="$TAGS/$TAG.json"
  BEFORE=$([ -s "$OUT" ] && echo 1 || echo 0)
  echo "== #$TAG =="
  monid_run tikhub /api/v1/tiktok/app/v3/fetch_hashtag_search_result "{\"keyword\":\"$TAG\",\"count\":\"20\",\"offset\":\"0\"}" "$OUT" || continue
  [ "$BEFORE" = 0 ] && CALLS=$((CALLS + 1))
done

python3 - "$ROOT/apps/$SLUG" "$(date +%Y-%m-%d)" <<'PY'
import collections, glob, json, os, re, statistics, sys
app, today = sys.argv[1], sys.argv[2]
niche = os.path.join(app, "niche")
posts = []
for f in glob.glob(os.path.join(niche, "searches", "*.json")):
    try: j = json.load(open(f))
    except Exception: continue
    if isinstance(j, dict):
        for it in j.get("item_list") or []:
            posts.append(((it.get("desc") or "").lower(), int(((it.get("statsV2") or {}).get("playCount")) or 0)))
    else:
        for it in j:
            if isinstance(it, dict): posts.append(((it.get("title") or "").lower(), it.get("views") or 0))
rows = []
for f in sorted(glob.glob(os.path.join(app, "strategy", "tags", "*.json"))):
    tag = os.path.basename(f)[:-5]
    try: j = json.load(open(f))
    except Exception: continue
    data = j.get("data") if isinstance(j, dict) and isinstance(j.get("data"), dict) else j
    lst = (data or {}).get("challenge_list") or []
    hit = next((c for c in lst if isinstance(c, dict) and (c.get("challenge_info") or c).get("cha_name", "").lower() == tag), None)
    info = (hit.get("challenge_info") or hit) if hit else None
    views = int((info or {}).get("view_count") or 0); n = int((info or {}).get("user_count") or 0)
    using = [v for cap, v in posts if re.search(r"#" + re.escape(tag) + r"\b", cap)]
    rows.append((tag, views, n, len(using), int(statistics.median(using)) if using else 0, hit is not None))
rows.sort(key=lambda r: -r[1])
def big(v):
    return f"{v/1e12:.2f}T" if v >= 1e12 else f"{v/1e9:.2f}B" if v >= 1e9 else f"{v/1e6:.1f}M" if v >= 1e6 else f"{v:,}"
out = os.path.join(app, "strategy", "HASHTAG-POOL.md")
with open(out, "w") as fh:
    fh.write(f"# Hashtag pool — measured {today}\n\n")
    fh.write("Measured through Monid, TikHub `fetch_hashtag_search_result`, one call per tag, $0.0015 a tag. `Views` is TikTok's lifetime total for the tag, all formats and languages; it says how big the audience under the tag is, not how many slideshows it holds. `Niche posts` counts the posts of the niche searches whose caption carries the tag, with their median views. The tier column is for the agent to fill: **G** general, **N** niche, **P** post-specific, **x** not in the pool.\n\n")
    fh.write("| # | Tag | Views (lifetime) | Posts | Tier | Niche posts using it | Median views of those |\n|---|---|---|---|---|---|---|\n")
    for i, (tag, views, n, using, med, ok) in enumerate(rows, 1):
        fh.write(f"| {i} | #{tag} | {big(views) if ok else 'no exact match'} | {big(n) if ok else '-'} | | {using} | {med:,} |\n")
    fh.write("\n## Rotation rule\n\nFive tags per post: two general, two niche, one post-specific, rotated so no handle repeats a set on consecutive posts. Fill the tier column, then the plan's Tags column follows this rule.\n")
print(f"{len(rows)} tags -> {out}")
for tag, views, n, using, med, ok in rows[:15]:
    print(f"  #{tag:<22} {big(views) if ok else 'no exact match':>10}  {using:>3} niche posts")
PY

[ "$CALLS" -gt 0 ] && spend "$SLUG" "$(python3 -c "print(f'{$CALLS * $PER_TAG:.4f}')")" "hashtag pool: $CALLS tags" || true
