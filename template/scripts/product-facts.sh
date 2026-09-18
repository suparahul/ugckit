#!/usr/bin/env bash
# Phase 2 (the app): the product callout facts, apps/<slug>/product.json and icon.jpg.
#
#   scripts/product-facts.sh <slug> --id <app store id> [--country us]    the iTunes lookup, free
#   scripts/product-facts.sh <slug> --repo <path>                          the store metadata in a repository
#   scripts/product-facts.sh <slug> --website <url>                        the site's title and description
#   scripts/product-facts.sh <slug> --typed "<name>" "<subtitle>" [icon]   what the user told you
#   scripts/product-facts.sh <slug> --subtitle "<text>"                    change the card's subtitle only
#
# The fallback chain, in order: the App Store id (the listing is the truth), the repo,
# the website, typed. The file records which one it came from (`source`), so the callout
# card is evidence and not decoration. Writes:
#   apps/<slug>/product.json   { name, subtitle, button, icon, source, fetchedAt, appStoreId?, url? }
#   apps/<slug>/icon.jpg       the icon (the store's artworkUrl512 for the iTunes source)
#   apps/<slug>/listing.json   the raw iTunes record, for the id source only
# The card draws `name` on one line and `subtitle` under it; a long subtitle is rejected
# by the card renderer with the width in pt, so keep it under about 45 characters.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,20p "$0"; exit 2; }
SLUG=$1; MODE=$2; shift 2
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/apps/$SLUG"
mkdir -p "$APP"
OUT="$APP/product.json"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

write_json() {  # name subtitle icon source [extra-json-fields]
  python3 - "$OUT" "$NOW" "$@" <<'PY'
import json, os, sys
out, now, name, subtitle, icon, source = sys.argv[1:7]
extra = json.loads(sys.argv[7]) if len(sys.argv) > 7 else {}
d = {}
if os.path.exists(out):
    try: d = json.load(open(out))
    except Exception: d = {}
d.update({"name": name, "subtitle": subtitle, "button": d.get("button") or "Open",
          "icon": icon, "source": source, "fetchedAt": now})
d.update(extra)
json.dump(d, open(out, "w"), indent=2, ensure_ascii=False); open(out, "a").write("\n")
print(f"wrote {out}: \"{d['name']}\" · \"{d['subtitle']}\" · {d['button']} · icon {d['icon'] or '(none)'} · source {source}")
PY
}

fetch_icon() {  # url
  local url="$1"
  [ -n "$url" ] && [ "$url" != "null" ] || return 1
  curl -sfL --max-time 60 -o "$APP/icon.src" "$url" || { rm -f "$APP/icon.src"; return 1; }
  # ffmpeg, not sips: sips is macOS only and ffmpeg is already a hard dependency.
  ffmpeg -y -loglevel error -i "$APP/icon.src" -vf "scale=512:512" -q:v 2 "$APP/icon.jpg" && rm -f "$APP/icon.src"
  [ -s "$APP/icon.jpg" ]
}

case "$MODE" in
  --id)
    ID=$1; COUNTRY=us
    [ "${2:-}" = "--country" ] && COUNTRY=$3
    [[ "$ID" =~ ^[0-9]+$ ]] || { echo "the App Store id is the number after /id in the listing URL" >&2; exit 2; }
    echo "== iTunes lookup id $ID ($COUNTRY), free =="
    curl -sfL --max-time 60 "https://itunes.apple.com/lookup?id=$ID&country=$COUNTRY" -o "$APP/lookup.json" \
      || { echo "the lookup did not answer -- check the network, then the same command" >&2; exit 1; }
    python3 - "$APP/lookup.json" "$APP/listing.json" <<'PY' || exit 1
import json, sys
d = json.load(open(sys.argv[1]))
r = (d.get("results") or [None])[0]
if not r:
    sys.exit("the lookup returned no app for that id -- is it the App Store id, and is the app live in that country?")
keep = {k: r.get(k) for k in ["trackId", "trackName", "sellerName", "artistName", "primaryGenreName",
        "averageUserRating", "userRatingCount", "contentAdvisoryRating", "artworkUrl512", "version",
        "price", "formattedPrice", "trackViewUrl", "releaseDate", "currentVersionReleaseDate",
        "description", "genres", "screenshotUrls"]}
keep["lookupSource"] = f"https://itunes.apple.com/lookup?id={r.get('trackId')}"
json.dump(keep, open(sys.argv[2], "w"), indent=2); open(sys.argv[2], "a").write("\n")
print(f"{r.get('trackName')} — {r.get('sellerName')} — {r.get('primaryGenreName')} — {len(r.get('screenshotUrls') or [])} screenshots")
PY
    rm -f "$APP/lookup.json"
    NAME=$(python3 -c "import json;print(json.load(open('$APP/listing.json'))['trackName'])")
    ART=$(python3 -c "import json;print(json.load(open('$APP/listing.json')).get('artworkUrl512') or '')")
    URL=$(python3 -c "import json;print(json.load(open('$APP/listing.json')).get('trackViewUrl') or '')")
    # The lookup does not return the store's subtitle line. The product page does, but it
    # is rendered client-side and blocked from some networks, so the agent reads it from
    # the listing page or the user, and sets it with --subtitle. Until then the card's
    # subtitle is the genre, which is true but dull; say so.
    SUB=$(python3 -c "import json,os;d=json.load(open('$OUT')) if os.path.exists('$OUT') else {};print(d.get('subtitle') or json.load(open('$APP/listing.json')).get('primaryGenreName') or '')")
    ICON=""
    if fetch_icon "$ART"; then ICON="icon.jpg"; echo "   icon.jpg from the store's artworkUrl512"; else echo "   icon not fetched (the artwork url did not answer)"; fi
    write_json "$NAME" "$SUB" "$ICON" itunes "{\"appStoreId\":\"$ID\",\"url\":\"$URL\"}"
    echo "   the store subtitle is not in the lookup: read it from the listing page's header and set it with"
    echo "   scripts/product-facts.sh $SLUG --subtitle \"<the store subtitle>\""
    ;;
  --repo)
    REPO=$1
    [ -d "$REPO" ] || { echo "no such folder: $REPO" >&2; exit 2; }
    echo "== reading the repository for store metadata =="
    python3 - "$REPO" <<'PY' > "$APP/repo-facts.txt"
import glob, os, re, sys
root = sys.argv[1]
hits = []
for pat in ["**/Info.plist", "**/app.json", "**/pubspec.yaml", "**/package.json", "**/strings.xml",
            "**/*store*description*.md", "**/*app-store*.md", "**/README.md", "**/AndroidManifest.xml"]:
    for f in glob.glob(os.path.join(root, pat), recursive=True):
        if "node_modules" in f or "/.git/" in f or "/build/" in f or "/Pods/" in f: continue
        hits.append(f)
for f in hits[:40]:
    print("==", os.path.relpath(f, root))
    try: t = open(f, errors="replace").read()
    except Exception: continue
    for m in re.finditer(r"(CFBundleDisplayName|CFBundleName|\"name\"|\bname:|app_name|title|subtitle|description)[^\n]{0,160}", t):
        print("  ", m.group(0).strip()[:180])
icons = [f for f in glob.glob(os.path.join(root, "**/*.png"), recursive=True) if re.search(r"icon", f, re.I) and "node_modules" not in f]
icons.sort(key=lambda f: -os.path.getsize(f))
for f in icons[:5]: print("icon?", os.path.relpath(f, root), os.path.getsize(f))
PY
    cat "$APP/repo-facts.txt"
    echo
    echo "read the lines above, pick the name, the subtitle and the icon file, then write them:"
    echo "   scripts/product-facts.sh $SLUG --typed \"<name>\" \"<subtitle>\" <icon path>     (source is recorded as repo)"
    echo "   PRODUCT_SOURCE=repo scripts/product-facts.sh $SLUG --typed ..."
    ;;
  --website)
    URL=$1
    echo "== reading $URL =="
    curl -sfL --max-time 60 -A "Mozilla/5.0" "$URL" -o "$APP/site.html" || { echo "the site did not answer" >&2; exit 1; }
    python3 - "$APP/site.html" <<'PY'
import html, re, sys
t = open(sys.argv[1], errors="replace").read()
def g(p):
    m = re.search(p, t, re.I | re.S); return html.unescape(m.group(1)).strip() if m else ""
print("title:      ", g(r"<title[^>]*>(.*?)</title>")[:120])
print("og:title:   ", g(r'property=["\']og:title["\'][^>]*content=["\']([^"\']*)')[:120])
print("description:", g(r'name=["\']description["\'][^>]*content=["\']([^"\']*)')[:200])
print("og:image:   ", g(r'property=["\']og:image["\'][^>]*content=["\']([^"\']*)'))
print("apple icon: ", g(r'rel=["\']apple-touch-icon[^"\']*["\'][^>]*href=["\']([^"\']*)'))
m = re.search(r"apps\.apple\.com/[^\"' ]*/id(\d+)", t)
print("app store id:", m.group(1) if m else "(none on the page)")
PY
    rm -f "$APP/site.html"
    echo
    echo "if the page names an App Store id, use it: scripts/product-facts.sh $SLUG --id <id>   (the listing beats the site)"
    echo "else write what you read: PRODUCT_SOURCE=website scripts/product-facts.sh $SLUG --typed \"<name>\" \"<subtitle>\" [icon url or path]"
    ;;
  --typed)
    NAME=${1:?name}; SUB=${2:?subtitle}; ICONSRC=${3:-}
    SRC="${PRODUCT_SOURCE:-typed}"
    ICON=""
    if [ -n "$ICONSRC" ]; then
      case "$ICONSRC" in
        http*) fetch_icon "$ICONSRC" && ICON="icon.jpg" ;;
        *) [ -f "$ICONSRC" ] || { echo "no such icon file: $ICONSRC" >&2; exit 2; }
           ffmpeg -y -loglevel error -i "$ICONSRC" -vf "scale=512:512" -q:v 2 "$APP/icon.jpg" && ICON="icon.jpg" ;;
      esac
    elif [ -s "$APP/icon.jpg" ]; then ICON="icon.jpg"; fi
    write_json "$NAME" "$SUB" "$ICON" "$SRC"
    [ -n "$ICON" ] || echo "   no icon: the callout card needs one -- give a file or a url as the third argument, or upload it on the app page"
    ;;
  --subtitle)
    [ -s "$OUT" ] || { echo "no product.json yet -- run --id, --repo, --website or --typed first" >&2; exit 1; }
    python3 - "$OUT" "$1" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); d["subtitle"] = sys.argv[2]
json.dump(d, open(sys.argv[1], "w"), indent=2, ensure_ascii=False); open(sys.argv[1], "a").write("\n")
print(f"subtitle = \"{d['subtitle']}\"")
PY
    ;;
  *) echo "unknown mode $MODE" >&2; sed -n 2,8p "$0"; exit 2 ;;
esac
