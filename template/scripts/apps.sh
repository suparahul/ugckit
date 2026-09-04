#!/usr/bin/env bash
# Stage R1: find the apps in the niche. Keyword searches through Monid, then one scan of
# everything that came back: which names, hashtags and handles keep recurring.
#
#   scripts/apps.sh <project> <keyword> [keyword ...]
#   scripts/apps.sh <project> --expand [app ...]      # keywords for the next round
#
# Keywords should carry the word "app": "<niche> app", "best <niche> app". A problem
# phrase ("how to film youth sports") returns tutorials, not apps. --expand reads every
# search already run, finds the posts that name each confirmed app (ledger by default)
# and prints the hashtags, "<x> app" phrases and handle patterns around them -- that is
# where the next round's keywords come from.
#
# Run it in rounds. Each round the agent reads scan.tsv, decides which apps are real,
# expands the keyword list from what it saw, and runs again. A keyword that was already
# searched costs nothing the second time. MAXITEMS defaults to 40 -- larger than a
# normal search on purpose: this is where the whole research is aimed, so a cent more
# here is cheaper than a wrong account at R3.
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <project> <keyword> [keyword ...]" >&2; exit 2; }
NAME=$1; shift

. "$(cd "$(dirname "$0")" && pwd)/monid.sh"
DIR="$(research_dir "$NAME")"
mkdir -p "$DIR/searches"

MAXITEMS="${MAXITEMS:-40}"
CALLS=0

if [ "${1:-}" = "--expand" ]; then
  shift
  if [ $# -eq 0 ]; then
    # no names given: every app already in the ledger
    set -- $(python3 "$(dirname "$0")/state.py" apps "$NAME" 2>/dev/null | cut -f1)
    [ $# -gt 0 ] || { echo "no apps in the ledger yet -- scripts/state.py app $NAME <app>" >&2; exit 1; }
  fi
  python3 - "$DIR" "$@" <<'PY2'
import collections, glob, json, os, re, sys
d, apps = sys.argv[1], sys.argv[2:]
STOP = {"fyp", "foryou", "foryoupage", "viral", "tiktok", "trending", "fy", "xyzbca",
        "parati", "fypage", "foryourpage", "viralvideo", "capcut", "app", "apps", "the",
        "this", "that", "best", "new", "free", "my", "an", "a", "your", "our", "one"}
rows = []
for f in glob.glob(os.path.join(d, "searches", "*.json")):
    try:
        rows += [r for r in json.load(open(f)) if isinstance(r, dict)]
    except Exception:
        pass
seen = set()
rows = [r for r in rows if not (r.get("id") in seen or seen.add(r.get("id")))]
already = set()
for f in glob.glob(os.path.join(d, "searches", "*.json")):
    already.add(os.path.basename(f).split(".")[0])
def tags(r):
    return [h if isinstance(h, str) else str((h or {}).get("name") or "") for h in (r.get("hashtags") or [])]
suggest = []
for app in apps:
    key = re.sub(r"[^a-z0-9]", "", app.lower())
    if not key:
        continue
    hits = []
    for r in rows:
        ch = r.get("channel") or {}
        blob = re.sub(r"[^a-z0-9]", "", " ".join([r.get("title") or "", ch.get("name") or "",
                                                  ch.get("username") or ""] + tags(r)).lower())
        if key in blob:
            hits.append(r)
    print(f"== {app}: {len(hits)} posts name it, {len({(r.get('channel') or {}).get('username') for r in hits})} handles ==")
    if not hits:
        print("   nothing in the searches so far names this app -- search its name first")
        print()
        continue
    ht, ph, hn = collections.Counter(), collections.Counter(), collections.Counter()
    for r in hits:
        cap = r.get("title") or ""
        u = (r.get("channel") or {}).get("username") or ""
        for t in tags(r):
            t = t.lower().strip()
            if t and t not in STOP and key not in re.sub(r"[^a-z0-9]", "", t) and len(t) > 2:
                ht[t] += 1
        for m in re.finditer(r"\b([A-Za-z][A-Za-z0-9]{2,})\s+apps?\b", cap):
            w = m.group(1).lower()
            if key not in w and w not in STOP:
                ph[w + " app"] += 1
        # <name>.<word> / <name>_<word>: the word after the separator is a niche label
        m = re.match(r"^[a-z0-9]+[._]([a-z]{4,})$", u)
        if m and key not in m.group(1):
            hn[m.group(1)] += 1
    print("   hashtags on those posts:  " + "  ".join(f"#{t}({n})" for t, n in ht.most_common(12)))
    if ph:
        print("   '<x> app' in captions:    " + "  ".join(f"{t}({n})" for t, n in ph.most_common(8)))
    if hn:
        print("   handle patterns:          " + "  ".join(f"{t}({n})" for t, n in hn.most_common(6)))
    for kw in [app, f"{app} app", f"apps like {app}", f"{app} alternative"]:
        suggest.append(kw)
    for t, n in ht.most_common(4):
        if n >= 2:
            suggest.append(t if "app" in t else f"{t} app")
    for t, _ in ph.most_common(3):
        suggest.append(t)
    print()
out = []
for kw in suggest:
    slug = re.sub(r"[^a-z0-9-]", "", kw.lower().replace(" ", "-"))
    if slug not in already and kw not in out:
        out.append(kw)
print("suggested next round (not yet searched):")
print("   " + "  ".join(f'"{k}"' for k in out[:12]))
PY2
  exit 0
fi

# A round with no "app" in any keyword finds tutorials and tips, not products.
if ! printf '%s\n' "$@" | grep -qi '\bapps\?\b'; then
  echo "note: none of these keywords contains the word \"app\". Problem phrases surface" >&2
  echo "      tutorials; \"<niche> app\" surfaces apps. Add it unless this is a deliberate" >&2
  echo "      hidden-promoter round." >&2
fi

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

# The scan. Every search file ever run for this project, read together. Three tables:
#   scan.tsv     recurring terms -- hashtags, "<x> app" phrases, channel names. App
#                candidates come from here. The agent decides; the script counts.
#   handles.tsv  one row per handle with its best post and its hashtags.
#   searches.tsv the search log: keyword, range, rows, handles -- so a keyword that found
#                a word instead of a network is visible and not repeated.
echo
echo "== scan =="
python3 - "$DIR" <<'PY'
import collections, glob, json, os, re, sys
d = sys.argv[1]
STOP = {"fyp", "foryou", "foryoupage", "viral", "tiktok", "trending", "fy", "xyzbca",
        "parati", "fypage", "foryourpage", "viralvideo", "capcut", "app", "apps", "the",
        "this", "that", "best", "new", "free", "my", "an", "a"}
terms = collections.defaultdict(lambda: {"posts": 0, "views": 0, "handles": set(), "kind": ""})
best, seen, log = {}, set(), []

def add(term, kind, r, u):
    t = (term or "").lower().strip()
    if not t or t in STOP or len(t) < 3:
        return
    e = terms[t]
    e["posts"] += 1; e["views"] += r.get("views") or 0; e["handles"].add(u)
    if not e["kind"] or kind == "channel":
        e["kind"] = kind

for f in sorted(glob.glob(os.path.join(d, "searches", "*.json"))):
    try:
        rows = json.load(open(f))
    except Exception:
        continue
    rows = [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []
    stem = os.path.basename(f)[:-5]
    kw, _, rng = stem.rpartition(".")
    hs = set()
    for r in rows:
        ch = r.get("channel") or {}
        u = ch.get("username") or ""
        if not u:
            continue
        hs.add(u)
        if r.get("id") in seen:
            continue
        seen.add(r.get("id"))
        v = r.get("views") or 0
        if u not in best or v > (best[u]["r"].get("views") or 0):
            best[u] = {"r": r, "n": 0}
        best[u]["n"] += 1
        cap = r.get("title") or ""
        for h in r.get("hashtags") or []:
            add(h if isinstance(h, str) else (h or {}).get("name"), "hashtag", r, u)
        # "<name> app", "the <name> app", "app called <name>" -- the caption naming a product.
        for m in re.finditer(r"\b([A-Za-z][A-Za-z0-9]{2,})\s+app\b", cap):
            add(m.group(1), "phrase", r, u)
        for m in re.finditer(r"\bapp\s+(?:called|named|is)\s+([A-Za-z][A-Za-z0-9]{2,})", cap):
            add(m.group(1), "phrase", r, u)
        if ch.get("name"):
            add(re.sub(r"[^A-Za-z0-9 ]", "", ch["name"]), "channel", r, u)
    log.append((kw, rng, len(rows), len(hs)))

with open(os.path.join(d, "scan.tsv"), "w") as fh:
    fh.write("term\tkind\tposts\tviews\thandles\tsample_handles\n")
    for t, e in sorted(terms.items(), key=lambda kv: (-kv[1]["posts"], -kv[1]["views"])):
        if e["posts"] < 2 and e["kind"] == "hashtag":
            continue                 # a hashtag used once is not a signal
        fh.write("\t".join(str(x) for x in [
            t, e["kind"], e["posts"], e["views"], len(e["handles"]),
            " ".join(sorted(e["handles"])[:4])]) + "\n")

with open(os.path.join(d, "handles.tsv"), "w") as fh:
    fh.write("handle\tname\tfollowers\tposts_seen\tbest_views\tdate\thashtags\tcaption\n")
    for u, b in sorted(best.items(), key=lambda kv: -(kv[1]["r"].get("views") or 0)):
        r = b["r"]; ch = r.get("channel") or {}
        cap = (r.get("title") or "").replace("\n", " ").replace("\t", " ")[:160]
        fh.write("\t".join(str(x) for x in [
            u, (ch.get("name") or "").replace("\t", " "), ch.get("followers") or "",
            b["n"], r.get("views") or 0, (r.get("uploadedAtFormatted") or "")[:10],
            " ".join(h if isinstance(h, str) else str((h or {}).get("name", "")) for h in (r.get("hashtags") or [])[:8]), cap]) + "\n")

with open(os.path.join(d, "searches.tsv"), "w") as fh:
    fh.write("keyword\trange\trows\thandles\n")
    for row in log:
        fh.write("\t".join(str(x) for x in row) + "\n")

print(f"{len(log)} searches, {len(seen)} posts, {len(best)} handles")
print(f"-> {d}/scan.tsv  handles.tsv  searches.tsv")
print()
print("top terms:")
for t, e in sorted(terms.items(), key=lambda kv: (-kv[1]["posts"], -kv[1]["views"]))[:15]:
    if e["posts"] >= 2:
        print(f"  {t:<28} {e['kind']:<8} {e['posts']:>3} posts {e['views']:>12,} views  {len(e['handles'])} handles")
PY

if [ "$CALLS" -gt 0 ]; then
  USD=$(python3 -c "print(f'{$CALLS * $MAXITEMS * $PER_RESULT:.4f}')")
  spend "$NAME" "$USD" "R1 apps: $CALLS searches x $MAXITEMS results"
fi

echo
echo "next: read scan.tsv. A term that is an app, with several handles behind it, goes in"
echo "      the ledger: scripts/state.py app $NAME <app>. Then get the next round's keywords"
echo "      from the apps you confirmed: scripts/apps.sh $NAME --expand"
echo "      or move on: scripts/network.sh $NAME <app> \"<app name>\" ..."
