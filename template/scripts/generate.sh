#!/usr/bin/env bash
# Stage 6: generate the recreation and bring the video back.
#
#   scripts/generate.sh <project> [template_slug] [prompt_file]
#
# REST, not MCP: generation runs for minutes and MCP tool calls abort at 60s.
# This is AGENTS.md rule 2 and it is not negotiable.
#
# This script SPENDS MONEY. It refuses to run without CONFIRM=1 so that no agent can
# bill you by reflex. It prints the computed cost first; approve, then re-run.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: $0 <project> [template_slug] [prompt_file]" >&2; exit 2; }
NAME=$1
SLUG=${2:-ugc-recreation}
PROJ="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT=${3:-$PROJ/pipeline/05-prompt/$NAME/prompt.txt}
OUT="$PROJ/pipeline/06-generated/$NAME"
mkdir -p "$OUT"

[ -f "$PROMPT" ] || { echo "missing $PROMPT -- run the 'script' skill first" >&2; exit 1; }
set -a; . "$PROJ/.env"; set +a
[ -n "${SUPAGEN_API_KEY:-}" ] || { echo "SUPAGEN_API_KEY not set -- run scripts/doctor.py" >&2; exit 1; }
[ -n "${SUPAGEN_WORKSPACE_ID:-}" ] || { echo "SUPAGEN_WORKSPACE_ID not set -- run scripts/doctor.py" >&2; exit 1; }

# fal caps video prompts at 5000 CHARACTERS. Em dashes are 3 bytes, so `wc -c` overcounts
# and rejects valid prompts -- count characters. AGENTS.md rule 5.
LEN=$(wc -m < "$PROMPT" | tr -d ' ')
[ "$LEN" -le 5000 ] || { echo "prompt is $LEN chars, over the 5000 limit -- trim $PROMPT" >&2; exit 1; }

REFS=${REFS:-$PROJ/pipeline/05-prompt/$NAME/refs.json}
USE_REFS=0
if [ -f "$REFS" ]; then
  if [ "${ALLOW_REFS:-0}" != "1" ]; then
    cat >&2 <<'WARN'
refs.json is present, which would switch this run to REFERENCE-TO-VIDEO.

Reference conditioning preserves style and motion but CANNOT reproduce text. App UI
comes back as a convincing pastiche with nonsense strings. If you are trying to show a
real app screen, use the green-screen composite flow instead (insert.json), which is
what this pipeline is built around.

If you genuinely want reference conditioning, re-run with ALLOW_REFS=1.
Otherwise delete or rename refs.json.
WARN
    exit 1
  fi
  USE_REFS=1
fi

# ---- cost, computed from list price x seconds. Reported costs are unreliable (rule 7).
# The model comes from pipeline.json, not from the template: the REST invoke endpoint
# ignores version_number and always runs whichever version is ACTIVE in Supagen, so the
# state file is the only place that knows which model is really going to run. Keep the
# two in step -- `state.py model set` and `activate_version` are one operation in
# two places, and the setup skill does both.
read -r MODEL DUR PRICE < <(python3 - "$PROJ" <<'COST'
import json, os, sys
root = sys.argv[1]
state = os.path.join(root, "pipeline", "state", "pipeline.json")
if not os.path.exists(state):
    sys.exit("no pipeline.json -- run the setup skill first")
m = (json.load(open(state)).get("model") or {})
if not m.get("slug"):
    sys.exit("no generation model selected -- run the setup skill, or:\n"
             "  scripts/state.py model set <slug> <seconds>")
spec = json.load(open(os.path.join(root, "scripts", "templates.json")))
lim = spec["known_model_limits"].get(m["slug"], {})
dur = m.get("duration_s") or 0
if lim.get("max_duration_s") and dur > lim["max_duration_s"]:
    sys.exit(f"FATAL: {m['slug']} caps at {lim['max_duration_s']}s but {dur}s is selected")
print(m["slug"], dur, lim.get("price_per_s") or 0)
COST
)

if [ "$PRICE" = "0" ]; then
  EST="unknown"
else
  EST=$(python3 -c "print(f'{$DUR * $PRICE:.2f}')")
fi

echo "project     $NAME"
echo "template    $SLUG"
echo "model       $MODEL   (whichever version is ACTIVE in Supagen is what runs)"
echo "prompt      $LEN chars"
echo "mode        $([ "$USE_REFS" = 1 ] && echo 'REFERENCE-TO-VIDEO (opted in)' || echo 'text-to-video')"
echo "duration    ${DUR}s"
echo "est. cost   \$$EST   (computed as list price x seconds, not the reported figure)"
echo

if [ "${CONFIRM:-0}" != "1" ]; then
  echo "Not generating. This would spend \$$EST." >&2
  echo "Re-run with CONFIRM=1 to proceed." >&2
  exit 3
fi

STAMP=$(date +%Y%m%d-%H%M%S)
REQ="$OUT/request-$STAMP.json"
RESP="$OUT/response-$STAMP.json"
MP4="$OUT/$NAME-$STAMP.mp4"
IDS="$OUT/refs-$STAMP.txt"
: > "$IDS"

if [ "$USE_REFS" = 1 ]; then
  echo "== uploading references =="
  python3 - "$REFS" <<'REFLIST' > "$OUT/reflist-$STAMP.txt"
import json, sys
spec = json.load(open(sys.argv[1]))
for kind in ("video", "audio", "image"):
    for f in spec.get(kind) or []:
        print(kind, f)
REFLIST
  while read -r KIND FILE; do
    [ -n "$KIND" ] || continue
    ABS="$PROJ/$FILE"
    [ -f "$ABS" ] || { echo "missing reference $ABS" >&2; exit 1; }
    UP=$(/usr/bin/curl -s -m 600 -X POST "https://supagen.dev/api/v1/files" \
      -H "Authorization: Bearer $SUPAGEN_API_KEY" \
      -F "workspace_id=$SUPAGEN_WORKSPACE_ID" -F "purpose=invocation_input" -F "file=@$ABS")
    FID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["file_id"])' "$UP") \
      || { echo "upload failed: $UP" >&2; exit 1; }
    echo "  $KIND $FILE -> $FID"
    echo "$KIND $FID" >> "$IDS"
  done < "$OUT/reflist-$STAMP.txt"
fi

python3 - "$REQ" "$SLUG" "$PROMPT" "$IDS" <<'BUILD'
import json, sys
req, slug, pf, idf = sys.argv[1:5]
prompt = open(pf).read().strip()
parts = [{"type": k, "source": {"file_id": v}}
         for k, v in (l.split() for l in open(idf).read().splitlines() if l.strip())]
# The prompt goes here and ONLY here. Supagen CONCATENATES rendered system_instructions
# with message text parts rather than choosing one, so a template that also renders
# {{prompt}} would send it twice and blow the char cap -- and the rendered copy arrives
# with its quotes HTML-escaped. Templates from templates.json are messages-only.
# AGENTS.md rule 4.
json.dump({
    "template_slug": slug,
    "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}] + parts}],
    "end_user": {"project_id": "ugckit", "feature": "recreation", "user_id": "local"},
}, open(req, "w"), indent=2)
BUILD

echo "== generating via $SLUG (this runs for minutes) =="
CODE=$(/usr/bin/curl -s -m 1800 -X POST "https://supagen.dev/api/v1/invoke" \
  -H "Authorization: Bearer $SUPAGEN_API_KEY" -H "Content-Type: application/json" \
  --data-binary @"$REQ" -o "$RESP" -w "%{http_code}")

URL=$(python3 - "$RESP" "$CODE" <<'PY'
import json, sys
d = json.load(open(sys.argv[1])); code = sys.argv[2]
if code != "200" or d.get("status") != "completed":
    print(f"FAILED http={code} status={d.get('status')}", file=sys.stderr)
    print(f"error: {str(d.get('error'))[:800]}", file=sys.stderr)
    sys.exit(1)
u = d.get("usage") or {}
print(f"invocation {d.get('invocation_id')} · {d.get('latency_ms')}ms · "
      f"reported ${u.get('cost_usd','?')} (reported costs are unreliable -- see rule 7)",
      file=sys.stderr)
print(d["output"][0]["content"][0]["source"]["url"])
PY
)

# Blob URLs are signed and short-lived -- download immediately; the local copy is durable.
/usr/bin/curl -s -f -m 600 "$URL" -o "$MP4"
echo "downloaded: $MP4"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration,size -of default=nw=1 "$MP4"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,channels -of default=nw=1 "$MP4" \
  || echo "WARNING: no audio stream in the generated file"

python3 "$PROJ/scripts/state.py" set "$NAME" generate done "$(basename "$MP4")" >/dev/null 2>&1 || true
python3 "$PROJ/scripts/state.py" cost "$NAME" "$EST" "$MODEL ${DUR}s" 2>/dev/null || true
echo
echo "Next: run the 'review' skill. Do not report this as good until you have looked at it."
