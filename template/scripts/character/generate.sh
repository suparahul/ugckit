#!/usr/bin/env bash
# P2: generate one segment of a character video and bring it back.
#
#   scripts/character/generate.sh <video> <segment> [template_slug] [prompt_file]
#
# <segment> is the folder name under pipeline/character/<video>/segments/, e.g. 01-t.
# A copy of scripts/generate.sh, pointed at pipeline/character/ and
# scripts/character/models.json. The recreation script is not changed.
#
# REST, not MCP: generation runs for minutes and MCP tool calls abort at 60s.
# This is AGENTS.md rule 2 and it is not negotiable.
#
# This script SPENDS MONEY. It refuses to run without CONFIRM=1 so that no agent can
# bill you by reflex. It prints the computed cost first; approve, then re-run.
#
# It also refuses, before any cost: a video whose storyboard (gate A) is not approved in
# approval.json; a pinned character whose status is not 'live'; a refs.json reference of
# a kind the character pipeline does not allow (an app screen is never a reference); a
# reference that is supplied media (the plan's assets); a segment that is not generated.
set -euo pipefail

[ $# -ge 2 ] || { echo "usage: $0 <video> <segment> [template_slug] [prompt_file]" >&2; exit 2; }
VIDEO=$1
SEG=$2
NAME="$VIDEO.$SEG"
SLUG=${3:-ugc-character}
PROJ="$(cd "$(dirname "$0")/../.." && pwd)"
SEGDIR="$PROJ/pipeline/character/$VIDEO/segments/$SEG"
PROMPT=${4:-$SEGDIR/prompt.txt}
OUT="$SEGDIR/generated"
mkdir -p "$OUT"

[ -f "$PROMPT" ] || { echo "missing $PROMPT -- run the 'character-shots' skill first" >&2; exit 1; }
set -a; . "$PROJ/.env"; set +a
[ -n "${SUPAGEN_API_KEY:-}" ] || { echo "SUPAGEN_API_KEY not set -- run scripts/doctor.py" >&2; exit 1; }
[ -n "${SUPAGEN_WORKSPACE_ID:-}" ] || { echo "SUPAGEN_WORKSPACE_ID not set -- run scripts/doctor.py" >&2; exit 1; }

# fal caps video prompts at 5000 CHARACTERS. Em dashes are 3 bytes, so `wc -c` overcounts
# and rejects valid prompts -- count characters. AGENTS.md rule 5.
LEN=$(wc -m < "$PROMPT" | tr -d ' ')
[ "$LEN" -le 5000 ] || { echo "prompt is $LEN chars, over the 5000 limit -- trim $PROMPT" >&2; exit 1; }

REFS=${REFS:-$SEGDIR/refs.json}
USE_REFS=0
if [ -f "$REFS" ]; then
  if [ "${ALLOW_REFS:-0}" != "1" ]; then
    cat >&2 <<'WARN'
refs.json is present, so this run is REFERENCE-TO-VIDEO.

In the character pipeline references are the standard mode, but each referenced run is
still an explicit opt-in. The references carry the person, the room and the voice; they
never carry the app: reference conditioning cannot reproduce text, and the app is
inserted at P4. Re-run with ALLOW_REFS=1 after the user's yes.
WARN
    exit 1
  fi
  USE_REFS=1
fi

# ---- the gates before any cost: the storyboard, the character, the kinds of reference.
python3 - "$PROJ" "$VIDEO" "$SEG" "$([ "$USE_REFS" = 1 ] && echo "$REFS")" <<'GATES' || exit 1
import json, os, re, sys
root, video, seg, refs = sys.argv[1:5]
vd = os.path.join(root, "pipeline", "character", video)
ap = os.path.join(vd, "approval.json")
a = (json.load(open(ap)).get("gate_a_storyboard") or {}) if os.path.exists(ap) else {}
if a.get("decision") != "approve" or not a.get("words") or "<" in str(a.get("words")):
    sys.exit("FATAL: the storyboard of this video is not approved (approval.json "
             "gate_a_storyboard: decision 'approve' with the user's words) -- run character-shots")
plan = json.load(open(os.path.join(vd, "plan.json")))
hdir = os.path.join(root, "apps", plan["app"], "handles", plan["handle"].lstrip("@"))
for pin in plan.get("characters") or []:
    m = re.fullmatch(r"(.+)@v(\d+)", pin)
    cdir = os.path.join(hdir, "characters", m.group(1)) if m else ""
    cur = os.path.join(cdir, "creator.json")
    c = json.load(open(cur)) if m and os.path.exists(cur) else {}
    if m and c.get("version") != f"v{m.group(2)}":
        old = os.path.join(cdir, "versions", f"v{m.group(2)}.json")
        c = json.load(open(old)) if os.path.exists(old) else {}
    if c.get("status") != "live":
        sys.exit(f"FATAL: {pin} is not live (status {c.get('status')!r}) -- the video half, the "
                 "voice reference and the twenty-generation gate come first (persona-identity)")
# C and M are supplied or composed at assembly; R and P are the real recording.
if seg.split("-")[-1].upper() in ("C", "M", "R", "P"):
    sys.exit(f"FATAL: {seg} is not generated (C, M, R and P are built at assembly)")
# The active Supagen version has one length; the segment must be planned at that length.
shot = os.path.join(vd, "shots", f"{seg}.json")
st = os.path.join(root, "pipeline", "character", "state.json")
if os.path.exists(shot) and os.path.exists(st):
    want = (json.load(open(shot)).get("video") or {}).get("duration_seconds")
    have = (json.load(open(st)).get("model") or {}).get("duration_s")
    if want and have and int(want) != int(have):
        sys.exit(f"FATAL: {seg} is planned at {want}s but the selected length is {have}s -- activate "
                 f"the ugc-character version at {want}s and run: scripts/character/state.py "
                 f"model set <slug> {want}")
if refs:
    allowed = {"keyframe", "hero", "anchor", "subject", "set", "neighbour-frame", "voice"}
    spec = json.load(open(refs))
    if "references" not in spec:
        sys.exit("FATAL: refs.json has no 'references' list -- write it with "
                 "scripts/character/shots.py refs")
    supplied = {os.path.realpath(os.path.join(root, a["path"])) for a in plan.get("assets") or []
                if isinstance(a.get("path"), str)}
    for r in spec["references"]:
        if r.get("kind") not in allowed or "/screens/" in r.get("file", ""):
            sys.exit(f"FATAL: refs.json reference {r.get('file')} of kind {r.get('kind')!r} is not "
                     f"allowed; only {', '.join(sorted(allowed))}. The app is never a reference.")
        if "/supplied/" in r.get("file", "") or os.path.realpath(os.path.join(root, r.get("file", ""))) in supplied:
            sys.exit(f"FATAL: refs.json reference {r.get('file')} is supplied media (the plan's assets). "
                     "Supplied footage goes into the video as it is; it never conditions a generation.")
        posts = {str(x.get(k)).strip().rstrip("/") for x in plan.get("reaction_refs") or []
                 for k in ("post_id", "post_dir", "video_path") if isinstance(x.get(k), str) and x[k].strip()}
        f = r.get("file", "")
        if f.startswith("research/") or "/research/" in f or any(p in f for p in posts):
            sys.exit(f"FATAL: refs.json reference {f} is research footage or a reference reaction. The "
                     "written performance carries a reaction; the clip never conditions a generation.")
        if seg.split("-")[-1].upper() == "X" and r.get("kind") == "voice":
            sys.exit(f"FATAL: {seg} is a silent reaction: no voice reference (a reaction hook is never spoken)")
GATES

# ---- cost, computed from list price x seconds. Reported costs are unreliable (rule 7).
# The model comes from pipeline/character/state.json, not from the template: the REST invoke endpoint
# ignores version_number and always runs whichever version is ACTIVE in Supagen, so the
# state file is the only place that knows which model is really going to run. Keep the
# two in step -- `state.py model set` and `activate_version` are one operation in
# two places, and the setup skill does both.
REFS_ARG=""; [ "$USE_REFS" = 1 ] && REFS_ARG="$REFS"
read -r MODEL DUR PRICE TRIM < <(python3 - "$PROJ" "$REFS_ARG" <<'COST'
import json, os, sys
root, refs = sys.argv[1], sys.argv[2]
state = os.path.join(root, "pipeline", "character", "state.json")
if not os.path.exists(state):
    sys.exit("no pipeline/character/state.json -- run: scripts/character/state.py model set <slug> <seconds>")
m = (json.load(open(state)).get("model") or {})
if not m.get("slug"):
    sys.exit("no generation model selected -- run:\n"
             "  scripts/character/state.py model set <slug> <seconds>")
spec = json.load(open(os.path.join(root, "scripts", "character", "models.json")))
lim = spec["known_model_limits"].get(m["slug"])
if lim is None:
    sys.exit(f"FATAL: {m['slug']} is not in scripts/character/models.json")
dur = m.get("duration_s") or 0
if lim.get("max_duration_s") and dur > lim["max_duration_s"]:
    sys.exit(f"FATAL: {m['slug']} caps at {lim['max_duration_s']}s but {dur}s is selected")
if lim.get("min_duration_s") and dur < lim["min_duration_s"]:
    sys.exit(f"FATAL: {m['slug']} takes at least {lim['min_duration_s']}s but {dur}s is selected"
             " -- generate at the minimum and trim at assembly (state.py model set does this)")
# A run with more pictures than the model takes is refused by the provider after upload.
if refs and lim.get("max_reference_images"):
    n = sum(1 for r in json.load(open(refs))["references"] if r.get("kind") != "voice")
    if n > lim["max_reference_images"]:
        sys.exit(f"FATAL: {m['slug']} takes at most {lim['max_reference_images']} reference "
                 f"images but refs.json lists {n} -- drop the least needed ones")
print(m["slug"], dur, lim.get("price_per_s") or 0, m.get("trim_to_s") or 0)
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
echo "duration    ${DUR}s$([ "$TRIM" != 0 ] && echo "   (trim to ${TRIM}s at assembly)")"
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
# Pictures first, in the order of refs.json (the keyframe leads), then the voice clip.
refs = json.load(open(sys.argv[1]))["references"]
for r in refs:
    if r["kind"] != "voice":
        print("image", r["file"])
for r in refs:
    if r["kind"] == "voice":
        print("audio", r["file"])
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
    "end_user": {"project_id": "ugckit", "feature": "character", "user_id": "local"},
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

python3 "$PROJ/scripts/character/state.py" set "$VIDEO" generate done "$SEG $(basename "$MP4")" >/dev/null 2>&1 || true
python3 "$PROJ/scripts/character/state.py" cost "$VIDEO" "$EST" "$SEG $MODEL ${DUR}s" 2>/dev/null || true
echo
echo "Next: run the 'character-review' skill. Do not report this as good until you have looked at it."
