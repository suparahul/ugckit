#!/usr/bin/env bash
# Stage 2: the watching layer.
# Supagen template `video-watching-layer`. Model is whatever version is active there.
# Usage: scripts/watch.sh <name>
#
# Goes over REST, not MCP: the MCP client aborts tool calls at 60s.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: $0 <name>" >&2; exit 2; }
NAME=$1
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
SEG="$PROJ/pipeline/00-source/$NAME/seg.mp4"
MAN="$PROJ/pipeline/01-objective/$NAME/manifest.json"
OUT="$PROJ/pipeline/02-watching/$NAME"
mkdir -p "$OUT"

[ -f "$SEG" ] || { echo "missing $SEG — run scripts/ingest.sh first" >&2; exit 1; }
set -a; . "$PROJ/.env"; set +a
[ -n "${SUPAGEN_API_KEY:-}" ] || { echo "SUPAGEN_API_KEY not set in .env -- run scripts/doctor.py" >&2; exit 1; }
[ -n "${SUPAGEN_WORKSPACE_ID:-}" ] || { echo "SUPAGEN_WORKSPACE_ID not set in .env -- run scripts/doctor.py" >&2; exit 1; }
WS="$SUPAGEN_WORKSPACE_ID"

# Segment facts only. The measured cut list is deliberately NOT sent: the analyzer has to
# stay an independent second opinion, or the Phase 4 cross-check has nothing to compare.
FACTS="Analyze this segment."
if [ -f "$MAN" ]; then
  FACTS=$(python3 -c "
import json;m=json.load(open('$MAN'))
v,s=m['video'],m['segment']
print(f\"Analyze this segment. Duration {s['actual_duration_s']}s, {v['width']}x{v['height']}, {v['fps']} fps, {v['orientation']}.\")")
fi

echo "== uploading $(du -h "$SEG" | cut -f1) =="
UP="$OUT/upload.json"
/usr/bin/curl -s -f -m 600 -X POST "https://supagen.dev/api/v1/files" \
  -H "Authorization: Bearer $SUPAGEN_API_KEY" \
  -F "workspace_id=$WS" -F "purpose=invocation_input" \
  -F "file=@${SEG};type=video/mp4" -o "$UP"
FILE_ID=$(python3 -c "import json;print(json.load(open('$UP'))['file_id'])")
echo "file_id: $FILE_ID"

echo "== analyzing (watching-layer active version) =="
REQ="$OUT/request.json"
python3 - "$REQ" "$FILE_ID" "$FACTS" <<'PY'
import json, sys
req, file_id, facts = sys.argv[1], sys.argv[2], sys.argv[3]
json.dump({
    "template_slug": "video-watching-layer",
    "messages": [{"role": "user", "content": [
        {"type": "video", "source": {"file_id": file_id}},
        {"type": "text", "text": facts}]}],
    "end_user": {"project_id": "ai-ugc", "feature": "watching-layer", "user_id": "rahul"},
}, open(req, "w"), indent=2)
PY

RESP="$OUT/response.json"
CODE=$(/usr/bin/curl -s -m 900 -X POST "https://supagen.dev/api/v1/invoke" \
  -H "Authorization: Bearer $SUPAGEN_API_KEY" -H "Content-Type: application/json" \
  --data-binary @"$REQ" -o "$RESP" -w "%{http_code}")

python3 - "$RESP" "$OUT/analysis.md" "$CODE" <<'PY'
import json, sys
resp, out, code = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(resp))
if code != "200" or d.get("status") != "completed":
    print(f"FAILED http={code} status={d.get('status')} error={d.get('error')}")
    sys.exit(1)
text = d["output"][0]["content"][0]["text"]
open(out, "w").write(text)
u = d.get("usage") or {}
print(f"invocation {d.get('invocation_id')} · {d.get('latency_ms')}ms · ${u.get('cost_usd','?')}")
print(f"wrote {out} ({len(text)} chars)")
PY

echo
echo "REMINDER: this is a second opinion. Where a scene boundary"
echo "disagrees with the measured cut list, the measured cut wins. Check the sheets for"
echo "slow push-ins called 'static' and for outfit/room changes it missed."
