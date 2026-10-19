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
# reference that is supplied media (the plan's assets); a segment that is not generated;
# research footage. The one exception is an X segment by motion copy (founder,
# 2026-10-04): its input is the trimmed, masked copy of the reference clip that
# shots.py reference writes (kind motion_clip). The shot's motion_copy.route picks
# the model (models.json motion_copy.routes):
#   replace  Wan 2.2 Animate, replace mode, on Supagen (founder, 2026-10-06): the ORIGINAL
#            clip (trimmed, no mask) and one picture of the character's face; the model puts
#            the character into the clip and keeps the rest. No prompt. identity.py runs after.
#   motion   Kling 3.0 Pro Motion Control on Supagen (founder, 2026-10-07): the approved first
#            frame and the original clip padded to 3.0 s, a short prompt.txt; the template
#            sets character_orientation video and keep_original_sound false.
#   animate  Wan 2.2 Animate, move mode, on Supagen (founder, 2026-10-07; fal.ai before):
#            the shot's keyframe, the character's first frame approved at gate A (its
#            checksum in approval.json gate_a_storyboard.keyframes_sha256), moved by the
#            clip's pose and expression. No prompt. After the download, identity.py runs.
#   guided   MiniMax H3 reference-to-video on Supagen, the clip as a video reference and the
#            character's face (untested).
#   edit     Wan 2.7 Edit Video: retired (2026-10-04, the output kept the reference's face);
#            refused.
# A live motion-copy run is refused while capabilities.json bridge.motion_copy is false;
# REQUEST_ONLY=1 writes the request it would send, with placeholder files, and spends nothing.
#
# A continuing segment (shot continuity.from) opens on the last frame of the clip before it:
# refused, before any cost, while that clip has no approved last frame (continuity.py), when
# refs.json does not carry that frame first, or when the model has no continuity input
# (models.json known_model_limits.<model>.continuity). The frame goes as the model's input
# says; on the H3 models that is the first reference image, UNVERIFIED until a paid run.
# The frame sent is recorded beside the take (<take>.seed.json) for gate B.
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
rm -f "$OUT/.continuity"

set -a; . "$PROJ/.env"; set +a
# Who runs this segment: Supagen, or fal.ai for a motion-copy route with provider fal; and
# whether it takes a prompt (a motion-copy route with prompt false takes none).
read -r PROVIDER NEEDPROMPT < <(python3 - "$PROJ" "$VIDEO" "$SEG" <<'PROV'
import json, os, sys
root, video, seg = sys.argv[1:4]
p = os.path.join(root, "pipeline", "character", video, "shots", f"{seg}.json")
d = json.load(open(p)) if seg.lower().endswith("-x") and os.path.exists(p) else {}
fx = d.get("motion_copy") or d.get("face_replace") or {}   # face_replace: a shot written before 2026-10-19
spec = json.load(open(os.path.join(root, "scripts", "character", "models.json")))
if fx and not fx.get("route"):
    fx["route"] = (spec.get("motion_copy") or spec.get("face_replace") or {}).get("default_route")   # motion (founder, 2026-10-07)
rt = ((spec.get("motion_copy") or spec.get("face_replace") or {}).get("routes") or {}).get(fx.get("route")) or {}
print(rt.get("provider") or "supagen", 0 if rt.get("provider") == "fal" or rt.get("prompt") is False else 1)
PROV
)
if [ "$PROVIDER" != fal ]; then
  [ -n "${SUPAGEN_API_KEY:-}" ] || { echo "SUPAGEN_API_KEY not set -- run scripts/doctor.py" >&2; exit 1; }
  [ -n "${SUPAGEN_WORKSPACE_ID:-}" ] || { echo "SUPAGEN_WORKSPACE_ID not set -- run scripts/doctor.py" >&2; exit 1; }
fi
if [ "$NEEDPROMPT" = 0 ]; then
  # The animate and replace routes send no prompt: the pictures and the clip are the request.
  LEN=0
else
  [ -f "$PROMPT" ] || { echo "missing $PROMPT -- run the 'character-shots' skill first" >&2; exit 1; }
  # fal caps video prompts at 5000 CHARACTERS. Em dashes are 3 bytes, so `wc -c` overcounts
  # and rejects valid prompts -- count characters. AGENTS.md rule 5.
  LEN=$(wc -m < "$PROMPT" | tr -d ' ')
  [ "$LEN" -le 5000 ] || { echo "prompt is $LEN chars, over the 5000 limit -- trim $PROMPT" >&2; exit 1; }
fi

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
python3 - "$PROJ" "$VIDEO" "$SEG" "$([ "$USE_REFS" = 1 ] && echo "$REFS")" <<'GATES' > "$OUT/.route" || exit 1
import json, os, re, sys
# The reference kinds before 2026-10-19, read as the new ones (bridge.OLD_KIND).
OLD_KIND = {"face_replace_clip": "motion_clip", "face_replace_frame": "pose_frame"}
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
# A motion-copy shot runs on its route's own template and model, not on state.json's.
shot = os.path.join(vd, "shots", f"{seg}.json")
st = os.path.join(root, "pipeline", "character", "state.json")
tp = seg.split("-")[-1].upper()
shotd = json.load(open(shot)) if os.path.exists(shot) else {}
fx = shotd.get("motion_copy", shotd.get("face_replace")) if tp == "X" else None   # face_replace: before 2026-10-19
mspec = json.load(open(os.path.join(root, "scripts", "character", "models.json")))
mspec = mspec.get("motion_copy") or mspec.get("face_replace") or {}
if isinstance(fx, dict) and not fx.get("route"):
    # A shot that names no route takes models.json motion_copy.default_route (motion, founder 2026-10-07).
    fx["route"] = mspec.get("default_route")
if os.path.exists(shot) and os.path.exists(st) and not fx:
    want = (json.load(open(shot)).get("video") or {}).get("duration_seconds")
    have = (json.load(open(st)).get("model") or {}).get("duration_s")
    if want and have and int(want) != int(have):
        sys.exit(f"FATAL: {seg} is planned at {want}s but the selected length is {have}s -- activate "
                 f"the ugc-character version at {want}s and run: scripts/character/state.py "
                 f"model set <slug> {want}")
# A motion-copy reaction: the reference clip, trimmed and masked, is the motion input.
fr ={x.get("id"): x for x in plan.get("reaction_refs") or []}.get((fx or {}).get("ref_id")) if fx else None
# motion_copy, the default (a missing one too); face_replace is its name before 2026-10-19.
fr_mode = bool(fr) and fr.get("generation_input") in (None, "motion_copy", "face_replace")
clip_rel = f"pipeline/character/{video}/segments/{seg}/source/reference.mp4"
if fx and not fr_mode:
    sys.exit(f"FATAL: {seg} names a motion-copy clip, but its reference's generation_input is written (the user's fallback)")
if fr_mode:
    import hashlib
    rjp = os.path.join(vd, "segments", seg, "source", "reference.json")
    cp = os.path.join(root, clip_rel)
    if not refs:
        sys.exit(f"FATAL: {seg} is a motion-copy reaction: refs.json carries its clip and the character's face")
    if not (os.path.exists(rjp) and os.path.exists(cp)):
        sys.exit(f"FATAL: {seg}: no masked reference clip -- run scripts/character/shots.py reference {video} {seg}")
    rj = json.load(open(rjp))
    if hashlib.sha256(open(cp, "rb").read()).hexdigest() != rj.get("sha256") \
            or rj.get("source_sha256") != fr.get("video_sha256") or rj.get("range_s") != [fr.get("start_s"), fr.get("end_s")]:
        sys.exit(f"FATAL: {seg}: the reference clip is not the pinned range of the pinned file -- run shots.py reference again")
    if rj.get("text_left"):
        sys.exit(f"FATAL: {seg}: text is left on the reference clip ({rj['text_left']}): mask it before generation")
    kinds = [OLD_KIND.get(r.get("kind"), r.get("kind")) for r in json.load(open(refs)).get("references") or []]
    rt0 = (mspec.get("routes") or {}).get(fx.get("route")) or {}
    if rt0.get("retired"):
        sys.exit(f"FATAL: {seg}: motion_copy.route {fx.get('route')!r} is retired: {rt0['retired']} Nothing was spent.")
    if rt0.get("clip") == "original" and not rj.get("original"):
        sys.exit(f"FATAL: {seg}: reference.mp4 is the masked copy; the {fx.get('route')} route takes the original "
                 "clip -- run shots.py reference again")
    if rt0.get("first_frame") == "keyframe":
        # The approved first frame: this exact keyframe, by its checksum, at gate A.
        kf = os.path.join(vd, "keyframes", f"{seg}.png")
        if kinds != ["motion_clip", "keyframe"]:
            sys.exit(f"FATAL: {seg}: the {fx.get('route')} route carries the clip and the shot's keyframe, nothing else "
                     "(shots.py refs)")
        if not os.path.exists(kf):
            sys.exit(f"FATAL: {seg}: no keyframes/{seg}.png -- make it (keyframes.sh) and get it approved at gate A")
        if (a.get("keyframes_sha256") or {}).get(seg) != hashlib.sha256(open(kf, "rb").read()).hexdigest():
            sys.exit(f"FATAL: {seg}: keyframes/{seg}.png is not the keyframe approved at gate A (approval.json "
                     "gate_a_storyboard.keyframes_sha256). Show it to the user and record the approval again.")
    elif rt0.get("clip") == "original":
        # replace: the original clip, then one picture of the character's face.
        if len(kinds) != 2 or kinds[0] != "motion_clip" or kinds[1] not in ("hero", "anchor"):
            sys.exit(f"FATAL: {seg}: the {fx.get('route')} route carries the clip, then one picture of the character's "
                     "face (hero or anchor), nothing else (shots.py refs)")
    elif kinds.count("motion_clip") != 1 or "hero" not in kinds:
        sys.exit(f"FATAL: {seg}: a motion-copy run carries its clip once and the character's face (hero)")
if refs:
    allowed = {"keyframe", "hero", "anchor", "subject", "set", "neighbour-frame", "voice", "motion_clip"}
    spec = json.load(open(refs))
    if "references" not in spec:
        sys.exit("FATAL: refs.json has no 'references' list -- write it with "
                 "scripts/character/shots.py refs")
    supplied = {os.path.realpath(os.path.join(root, a["path"])) for a in plan.get("assets") or []
                if isinstance(a.get("path"), str)}
    for r in spec["references"]:
        if OLD_KIND.get(r.get("kind"), r.get("kind")) not in allowed or "/screens/" in r.get("file", ""):
            sys.exit(f"FATAL: refs.json reference {r.get('file')} of kind {r.get('kind')!r} is not "
                     f"allowed; only {', '.join(sorted(allowed))}. The app is never a reference.")
        if "/supplied/" in r.get("file", "") or os.path.realpath(os.path.join(root, r.get("file", ""))) in supplied:
            sys.exit(f"FATAL: refs.json reference {r.get('file')} is supplied media (the plan's assets). "
                     "Supplied footage goes into the video as it is; it never conditions a generation.")
        if OLD_KIND.get(r.get("kind"), r.get("kind")) == "motion_clip" and not (fr_mode and r.get("file") == clip_rel):
            sys.exit(f"FATAL: refs.json reference {r.get('file')} is a motion-copy clip; only an X segment in "
                     f"motion copy carries one, as {clip_rel}. Research footage is never an input.")
        posts = {str(x.get(k)).strip().rstrip("/") for x in plan.get("reaction_refs") or []
                 for k in ("post_id", "post_dir", "video_path") if isinstance(x.get(k), str) and x[k].strip()}
        f = r.get("file", "")
        if f.startswith("research/") or "/research/" in f or any(p in f for p in posts):
            sys.exit(f"FATAL: refs.json reference {f} is research footage or a reference reaction. It is "
                     "never attached as it is; a motion-copy reaction uses its trimmed, masked copy.")
        if seg.split("-")[-1].upper() == "X" and r.get("kind") == "voice":
            sys.exit(f"FATAL: {seg} is a silent reaction: no voice reference (a reaction hook is never spoken)")
# Continuity: the previous clip's approved last frame, unchanged, first in refs.json.
sys.path.insert(0, os.path.join(root, "scripts", "character"))
import continuity
cprev = continuity.source_of(shotd)
nf = [r for r in (json.load(open(refs)).get("references") or [] if refs else []) if r.get("kind") == "neighbour-frame"
      and isinstance(r.get("continuity"), dict)]
if cprev or nf:
    if fr_mode:
        sys.exit(f"FATAL: {seg} is a motion-copy reaction: its frames are the clip's; it does not continue a clip")
    ok, why, info = continuity.state(video, seg)
    if not ok or not cprev:
        sys.exit(f"FATAL: {seg} continues from {cprev}: {why or 'the shot names no continuity.from'}. Nothing was spent.")
    want = continuity.frame_rel(video, cprev)
    first = (json.load(open(refs)).get("references") or [{}])[0] if refs else {}
    if not refs or [r.get("file") for r in nf] != [want] or first.get("file") != want:
        sys.exit(f"FATAL: {seg} continues from {cprev}: refs.json carries {want} once, first, in the keyframe's "
                 f"place -- run scripts/character/shots.py refs {video} {seg}. Nothing was spent.")
    open(os.path.join(vd, "segments", seg, "generated", ".continuity"), "w").write(
        json.dumps({"from": cprev, "file": want, "sha256": info["sha256"], "out_s": info["out_s"]}))
# Last: the motion-copy route (shot motion_copy.route) names the model and the template.
# Printed for the cost step: route model template clip_s duration_s.
if fr_mode:
    spec_ = json.load(open(os.path.join(root, "scripts", "character", "models.json")))
    routes = (spec_.get("motion_copy") or spec_.get("face_replace") or {}).get("routes") or {}
    route = fx.get("route")
    if route not in routes:
        sys.exit(f"FATAL: {seg}: motion_copy.route {route!r}; it is one of {', '.join(sorted(routes))} "
                 "(models.json motion_copy.routes). Nothing was spent.")
    rt = routes[route]
    lim = spec_["known_model_limits"].get(rt["model"]) or {}
    if rt["mode"] not in lim.get("modes", []):
        sys.exit(f"FATAL: {seg}: {rt['model']!r} has no {rt['mode']} mode in models.json. Nothing was spent.")
    clip_s = round(fr["end_s"] - fr["start_s"], 3)
    sv_ = lim.get("source_video") or {}
    if not sv_.get("min_s", 0) <= clip_s <= sv_.get("max_s", 1e9):
        sys.exit(f"FATAL: {seg}: the clip is {clip_s:g} s; {rt['model']} takes a video of {sv_.get('min_s')} "
                 f"to {sv_.get('max_s')} s")
    imgs = [k for k in kinds if k not in ("motion_clip", "voice")]
    if lim.get("max_reference_images") and len(imgs) > lim["max_reference_images"]:
        sys.exit(f"FATAL: {seg}: {rt['model']} takes {lim['max_reference_images']} reference image(s) beside "
                 f"the clip; refs.json lists {len(imgs)}: keep the character's face (hero)")
    dur = (shotd.get("video") or {}).get("duration_seconds")
    if rt["length"] == "exact":
        if dur not in (None, "null"):
            sys.exit(f"FATAL: {seg}: the {route} route has no length of its own (the clip's); duration_seconds is null")
        # pad_to_s (motion): the clip is held on its last frame to that length, and billed on it.
        dur = max(clip_s, rt.get("pad_to_s") or 0)
    elif dur != rt.get("duration_s") or dur < clip_s:
        sys.exit(f"FATAL: {seg}: the {route} route generates {rt.get('duration_s')} s (its template version) and "
                 f"trims to the clip's {clip_s:g} s; the shot plans duration_seconds {dur!r}")
    print(route, rt["model"], rt.get("template") or "fal:" + lim["endpoint"], clip_s, dur)
GATES
FRINFO=$(cat "$OUT/.route"); rm -f "$OUT/.route"

# ---- cost, computed from list price x seconds. Reported costs are unreliable (rule 7).
# The model comes from pipeline/character/state.json, not from the template: the REST invoke endpoint
# ignores version_number and always runs whichever version is ACTIVE in Supagen, so the
# state file is the only place that knows which model is really going to run. Keep the
# two in step -- `state.py model set` and `activate_version` are one operation in
# two places, and the setup skill does both.
REFS_ARG=""; [ "$USE_REFS" = 1 ] && REFS_ARG="$REFS"
if [ -n "$FRINFO" ]; then
  # Motion copy: the route's model and template (models.json motion_copy.routes).
  read -r FR_ROUTE MODEL FR_TPL FR_CLIP DUR <<< "$FRINFO"
  SLUG=$FR_TPL
  read -r PRICE TRIM BILLED < <(python3 - "$PROJ" "$FR_ROUTE" "$MODEL" "$FR_CLIP" "$DUR" "$SEGDIR/source/reference.mp4" <<'FRCOST'
import json, math, os, subprocess, sys
root, route, model = sys.argv[1:4]
clip, dur, src = float(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
spec = json.load(open(os.path.join(root, "scripts", "character", "models.json")))
exact = (spec.get("motion_copy") or spec["face_replace"])["routes"][route]["length"] == "exact"
lim = spec["known_model_limits"][model]
if lim.get("price_per_frame"):
    # Billed per frame of the source clip.
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", src], capture_output=True, text=True)
    frames = int(r.stdout.strip() or 0) or math.ceil(clip * 30)
    print(lim["price_per_frame"], 0 if exact else clip, frames)
elif lim.get("price_per_video_s"):
    # fal.ai bills frames / 16 "video seconds": the frames of the driving clip.
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_frames", "-of", "csv=p=0", src], capture_output=True, text=True)
    frames = int(r.stdout.strip() or 0) or math.ceil(clip * 30)
    print(lim["price_per_video_s"], 0 if exact else clip, round(frames / 16, 4))
else:
    # Quoted on whole output seconds, rounded up: the higher figure until a bill shows otherwise.
    print(lim.get("price_per_s") or 0, 0 if exact else clip, math.ceil(dur - 1e-6))
FRCOST
)
else
  read -r MODEL DUR PRICE TRIM < <(python3 - "$PROJ" "$REFS_ARG" "$OUT/.continuity" <<'COST'
import json, os, sys
root, refs, cont = sys.argv[1], sys.argv[2], sys.argv[3]
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
# A continuing run: the frame reaches the model only through its declared input.
cin = (lim.get("continuity") or {}).get("input")
if os.path.exists(cont) and cin != "reference":
    sys.exit(f"FATAL: {m['slug']} has continuity input {cin!r} (models.json known_model_limits.{m['slug']}.continuity): "
             "only 'reference' has a request shape here; a clip on this model cannot continue. Nothing was spent.")
print(m["slug"], dur, lim.get("price_per_s") or 0, m.get("trim_to_s") or 0)
COST
)
  BILLED=$DUR
fi

if [ "$PRICE" = "0" ]; then
  EST="unknown"
else
  EST=$(python3 -c "print(f'{$BILLED * $PRICE:.2f}')")
  # Frame billing has fractions of a cent: quote the cent above.
  if [ "$PROVIDER" = fal ] || [ "$NEEDPROMPT" = 0 ]; then
    EST=$(python3 -c "import math; print(f'{math.ceil($BILLED * $PRICE * 100 - 1e-9) / 100:.2f}')")
  fi
fi

if [ -n "$FRINFO" ]; then
  if [ "$PROVIDER" = fal ]; then MODE="MOTION COPY, $FR_ROUTE route (the approved keyframe, moved by the clip's pose and expression; fal.ai)"
  elif [ "$FR_ROUTE" = replace ]; then MODE="MOTION COPY, replace route (the character put into the original clip; Supagen)"
  elif [ "$FR_ROUTE" = animate ]; then MODE="MOTION COPY, animate route (the approved first frame, moved by the original clip; Supagen)"
  elif [ "$FR_ROUTE" = motion ]; then MODE="MOTION COPY, motion route (Kling motion control: the approved first frame, the original clip's motion; Supagen)"
  else MODE="MOTION COPY, guided route (the clip guides a new clip; trimmed to the clip at assembly)"; fi
else
  MODE=$([ "$USE_REFS" = 1 ] && echo 'REFERENCE-TO-VIDEO (opted in)' || echo 'text-to-video')
fi
echo "project     $NAME"
echo "template    $SLUG"
if [ "$PROVIDER" = fal ]; then
  echo "model       $MODEL   (fal.ai, called directly)"
  echo "prompt      none (the model takes the keyframe and the clip)"
else
  echo "model       $MODEL   (whichever version is ACTIVE in Supagen is what runs)"
  if [ "$NEEDPROMPT" = 0 ]; then echo "prompt      none (the model takes the clip and the picture)"
  else echo "prompt      $LEN chars"; fi
fi
echo "mode        $MODE"
echo "duration    ${DUR}s$([ "$TRIM" != 0 ] && echo "   (trim to ${TRIM}s at assembly)")"
if [ "$PROVIDER" = fal ]; then
  echo "est. cost   \$$EST   (computed: ${BILLED} billed video seconds, frames / 16, x \$$PRICE)"
elif [ "$NEEDPROMPT" = 0 ] && [ -n "$FRINFO" ]; then
  echo "est. cost   \$$EST   (computed: ${BILLED} source frames x \$$PRICE, not the reported figure)"
else
  echo "est. cost   \$$EST   (computed as list price x ${BILLED} s, not the reported figure)"
fi
if [ -f "$OUT/.continuity" ]; then
  python3 - "$PROJ" "$MODEL" "$OUT/.continuity" <<'CONT'
import json, os, sys
root, model, cont = sys.argv[1:4]
c = json.load(open(cont))
lim = json.load(open(os.path.join(root, "scripts", "character", "models.json")))["known_model_limits"][model]
st = (lim.get("continuity") or {}).get("status", "UNVERIFIED")
print(f"continuity  from {c['from']}: {os.path.basename(c['file'])} (sha256 {c['sha256'][:12]}) as the first "
      f"reference image, in the keyframe's place ({st}: models.json continuity)")
CONT
fi
echo

STAMP=$(date +%Y%m%d-%H%M%S)
[ "${REQUEST_ONLY:-0}" = 1 ] && STAMP=draft
REQ="$OUT/request-$STAMP.json"
RESP="$OUT/response-$STAMP.json"
MP4="$OUT/$NAME-$STAMP.mp4"
IDS="$OUT/refs-$STAMP.txt"
: > "$IDS"

# The frame a continuing take is seeded with, beside the take: gate B checks it is current.
write_seed() {
  [ -f "$OUT/.continuity" ] || return 0
  python3 - "$OUT/.continuity" "$MODEL" "$MP4" <<'SEED' > "${MP4%.mp4}.seed.json"
import json, os, sys
c = json.load(open(sys.argv[1]))
c.update({"_comment": "Written by generate.sh: the last frame this take was seeded with.", "model": sys.argv[2],
          "take": os.path.basename(sys.argv[3])})
print(json.dumps(c, indent=2))
SEED
}

if [ "$USE_REFS" = 1 ]; then
  python3 - "$REFS" <<'REFLIST' > "$OUT/reflist-$STAMP.txt"
import json, sys
# A motion-copy clip first (the source video, or the video reference), then the pictures
# in the order of refs.json (the keyframe leads), then the voice clip.
refs = json.load(open(sys.argv[1]))["references"]
for r in refs:
    if r["kind"] in ("motion_clip", "face_replace_clip"):   # face_replace_clip: before 2026-10-19
        print("video", r["file"])
for r in refs:
    if r["kind"] not in ("voice", "motion_clip", "face_replace_clip"):
        print("image", r["file"])
for r in refs:
    if r["kind"] == "voice":
        print("audio", r["file"])
REFLIST
fi

build_request() {
python3 - "$REQ" "$SLUG" "$PROMPT" "$IDS" "$NEEDPROMPT" <<'BUILD'
import json, sys
req, slug, pf, idf, need = sys.argv[1:6]
# A route with no prompt (replace) sends no text part at all.
prompt = open(pf).read().strip() if need == "1" else ""
parts = [{"type": k, "source": {"file_id": v}}
         for k, v in (l.split() for l in open(idf).read().splitlines() if l.strip())]
# At most one video part, and it leads: on an edit model it is the source video.
if sum(x["type"] == "video" for x in parts) > 1 or any(x["type"] == "video" for x in parts[1:]):
    sys.exit("FATAL: a request carries one video part, before the pictures")
# The prompt goes here and ONLY here. Supagen CONCATENATES rendered system_instructions
# with message text parts rather than choosing one, so a template that also renders
# {{prompt}} would send it twice and blow the char cap -- and the rendered copy arrives
# with its quotes HTML-escaped. Templates from templates.json are messages-only.
# AGENTS.md rule 4.
json.dump({
    "template_slug": slug,
    "messages": [{"role": "user", "content": ([{"type": "text", "text": prompt}] if prompt else []) + parts}],
    "end_user": {"project_id": "ugckit", "feature": "character", "user_id": "local"},
    # Poll mode: a sync call is cut by Supagen's gateway at 5 minutes (504, 2026-10-06)
    # while the job runs on.
    "mode": "poll",
}, open(req, "w"), indent=2)
BUILD
}

# fal.ai (the animate route): {video_url, image_url, resolution}. The clip drives, the
# keyframe is the subject. The urls are fal storage urls, or placeholders for REQUEST_ONLY.
build_fal_request() {
python3 - "$REQ" "$PROJ" "$MODEL" "$1" "$2" <<'FALBUILD'
import json, os, sys
req, root, model, video_url, image_url = sys.argv[1:6]
lim = json.load(open(os.path.join(root, "scripts", "character", "models.json")))["known_model_limits"][model]
json.dump({"endpoint": lim["endpoint"],
           "input": {"video_url": video_url, "image_url": image_url, "resolution": lim.get("resolution", "720p")}},
          open(req, "w"), indent=2)
FALBUILD
}
FAL_CLIP=""; FAL_KF=""
if [ "$PROVIDER" = fal ]; then
  while read -r KIND FILE; do
    case "$KIND" in video) FAL_CLIP=$FILE ;; image) FAL_KF=$FILE ;; esac
  done < "$OUT/reflist-$STAMP.txt"
fi

# REQUEST_ONLY=1: the request this run would send, with placeholder file ids. No upload,
# no run, nothing spent; it works while the motion-copy stop below is on.
if [ "${REQUEST_ONLY:-0}" = 1 ] && [ "$PROVIDER" = fal ]; then
  build_fal_request "offline:$FAL_CLIP" "offline:$FAL_KF" || exit 1
  echo "request written: $REQ (REQUEST_ONLY: no upload, no run, nothing spent)"
  exit 0
fi
if [ "${REQUEST_ONLY:-0}" = 1 ]; then
  [ "$USE_REFS" = 1 ] && while read -r KIND FILE; do
    [ -n "$KIND" ] && echo "$KIND offline:$FILE" >> "$IDS"
  done < "$OUT/reflist-$STAMP.txt"
  build_request || exit 1
  write_seed
  echo "request written: $REQ (REQUEST_ONLY: no upload, no run, nothing spent)"
  exit 0
fi

# The stop before spend (founder, 2026-10-04): no live motion-copy run until the founder
# approves a paid test and capabilities.json bridge.motion_copy is true.
# MOTION_COPY_TEST=1 is that paid test itself: the founder's words for it are recorded in
# approval.json gate_a_storyboard.cost, and capabilities.json turns true only after it passes.
# FACE_REPLACE_TEST and bridge.face_replace are the names before 2026-10-19, still read.
if [ -n "$FRINFO" ] && ! python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); sys.exit(0 if c.get("bridge.motion_copy", c.get("bridge.motion_copy")) is True else 1)' \
    "$PROJ/scripts/character/capabilities.json"; then
  if [ "${MOTION_COPY_TEST:-${FACE_REPLACE_TEST:-0}}" = 1 ]; then
    echo "MOTION_COPY_TEST=1: the founder's paid test of the $FR_ROUTE route (capabilities.json bridge.motion_copy is false)."
  else
    echo "FATAL: motion copy is not approved for a live run (capabilities.json bridge.motion_copy is false)." >&2
    echo "The founder approves the paid test first (MOTION_COPY_TEST=1). Nothing was spent. REQUEST_ONLY=1 shows the request." >&2
    exit 1
  fi
fi

if [ "${CONFIRM:-0}" != "1" ]; then
  echo "Not generating. This would spend \$$EST." >&2
  echo "Re-run with CONFIRM=1 to proceed." >&2
  exit 3
fi
write_seed

if [ "$PROVIDER" = fal ]; then
  [ -n "${FAL_KEY:-}" ] || { echo "FAL_KEY not set in .env -- the animate route calls fal.ai directly. Add it" \
    "in your own terminal (never in the chat): echo 'FAL_KEY=<key>' >> .env" >&2; exit 1; }
  # Upload to fal storage (free), then the queue: submit, poll, fetch. REST with curl (rule 2).
  fal_upload() {
    local f=$PROJ/$1 ct init up url
    case "$f" in *.png) ct=image/png ;; *.jpg|*.jpeg) ct=image/jpeg ;; *.mov) ct=video/quicktime ;; *) ct=video/mp4 ;; esac
    [ -f "$f" ] || { echo "missing $f" >&2; return 1; }
    init=$(/usr/bin/curl -s -m 60 -X POST "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3" \
      -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
      -d "{\"content_type\": \"$ct\", \"file_name\": \"$(basename "$f")\"}")
    up=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["upload_url"])' "$init" 2>/dev/null) \
      || { echo "fal upload refused: ${init:0:300}" >&2; return 1; }
    url=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["file_url"])' "$init")
    /usr/bin/curl -s -f -m 600 -X PUT "$up" -H "Content-Type: $ct" --data-binary @"$f" >/dev/null \
      || { echo "fal upload failed for $1" >&2; return 1; }
    echo "$url"
  }
  echo "== uploading to fal storage =="
  CLIP_URL=$(fal_upload "$FAL_CLIP") || exit 1; echo "  video $FAL_CLIP"
  KF_URL=$(fal_upload "$FAL_KF") || exit 1; echo "  image $FAL_KF"
  printf 'video %s\nimage %s\n' "$CLIP_URL" "$KF_URL" > "$IDS"
  build_fal_request "$CLIP_URL" "$KF_URL" || exit 1
  ENDPOINT=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["endpoint"])' "$REQ")
  echo "== generating via fal.ai $ENDPOINT (this runs for minutes) =="
  python3 -c 'import json,sys; json.dump(json.load(open(sys.argv[1]))["input"], open(sys.argv[2], "w"))' "$REQ" "$OUT/.body"
  SUB=$(/usr/bin/curl -s -m 120 -X POST "https://queue.fal.run/$ENDPOINT" -H "Authorization: Key $FAL_KEY" \
    -H "Content-Type: application/json" --data-binary @"$OUT/.body"); rm -f "$OUT/.body"
  echo "$SUB" > "$OUT/submit-$STAMP.json"
  read -r STATUS_URL RESPONSE_URL < <(python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d["status_url"], d["response_url"])' "$SUB" 2>/dev/null) \
    || { echo "FAILED: fal.ai refused the request: ${SUB:0:600}" >&2; exit 1; }
  echo "  request $(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("request_id"))' "$SUB")"
  START=$(date +%s); ST=""
  while [ $(( $(date +%s) - START )) -lt 1800 ]; do
    ST=$(/usr/bin/curl -s -m 60 "$STATUS_URL" -H "Authorization: Key $FAL_KEY" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' 2>/dev/null)
    [ "$ST" = COMPLETED ] && break
    case "$ST" in IN_QUEUE|IN_PROGRESS|"") sleep 10 ;; *) echo "FAILED: fal.ai status $ST" >&2; exit 1 ;; esac
  done
  [ "$ST" = COMPLETED ] || { echo "FAILED: no result after 30 minutes; status $ST" >&2; exit 1; }
  CODE=$(/usr/bin/curl -s -m 120 "$RESPONSE_URL" -H "Authorization: Key $FAL_KEY" -o "$RESP" -w "%{http_code}")
  URL=$(python3 - "$RESP" "$CODE" "$(( $(date +%s) - START ))" <<'FALPY'
import json, sys
d = json.load(open(sys.argv[1])); code = sys.argv[2]
v = (d.get("video") or {}) if isinstance(d, dict) else {}
if code != "200" or not v.get("url"):
    print(f"FAILED http={code}: {json.dumps(d)[:800]}", file=sys.stderr)
    sys.exit(1)
print(f"done in {sys.argv[3]} s, seed {d.get('seed')}", file=sys.stderr)
print(v["url"])
FALPY
) || exit 1
  /usr/bin/curl -s -f -m 600 "$URL" -o "$MP4"
  echo "downloaded: $MP4"
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_frames \
    -show_entries format=duration,size -of default=nw=1 "$MP4"
  python3 "$PROJ/scripts/character/state.py" set "$VIDEO" generate done "$SEG $(basename "$MP4")" >/dev/null 2>&1 || true
  python3 "$PROJ/scripts/character/state.py" cost "$VIDEO" "$EST" "$SEG $MODEL ${BILLED} video s" 2>/dev/null || true
  # The identity gate, free and local: whose face is in the file.
  PY=python3; [ -x "$PROJ/.venv/bin/python3" ] && PY="$PROJ/.venv/bin/python3"
  echo; "$PY" "$PROJ/scripts/character/identity.py" "$VIDEO" "$SEG" "generated/$(basename "$MP4")" || true
  echo
  echo "Next: run the 'character-review' skill. Do not report this as good until you have looked at it."
  exit 0
fi

if [ "$USE_REFS" = 1 ]; then
  echo "== uploading references =="
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

build_request || exit 1

echo "== generating via $SLUG (this runs for minutes) =="
SUB="$OUT/submit-$STAMP.json"
CODE=$(/usr/bin/curl -s -m 120 -X POST "https://supagen.dev/api/v1/invoke" \
  -H "Authorization: Bearer $SUPAGEN_API_KEY" -H "Content-Type: application/json" \
  --data-binary @"$REQ" -o "$SUB" -w "%{http_code}")
JOB=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("invocation_id") or "")' "$SUB" 2>/dev/null || true)
[ -n "$JOB" ] || { echo "FAILED: Supagen refused the request (http $CODE): $(head -c 600 "$SUB")" >&2; exit 1; }
echo "  job $JOB (poll mode; if this script stops, the job runs on: GET /api/v1/jobs/$JOB)"
cp "$SUB" "$RESP"; START=$(date +%s)
while :; do
  ST=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("status") or "")' "$RESP" 2>/dev/null || true)
  case "$ST" in completed|failed|cancelled) CODE=200; break ;; esac
  [ $(( $(date +%s) - START )) -lt 1800 ] || { echo "FAILED: job $JOB still $ST after 30 minutes; poll it later" >&2; exit 1; }
  sleep 15
  /usr/bin/curl -s -m 60 "https://supagen.dev/api/v1/jobs/$JOB" -H "Authorization: Bearer $SUPAGEN_API_KEY" \
    -o "$RESP.tmp" && python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$RESP.tmp" 2>/dev/null \
    && mv "$RESP.tmp" "$RESP"
done

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
# -L: a Supagen blob URL redirects to the file (without it the file is empty, 2026-10-06).
/usr/bin/curl -s -f -L -m 600 "$URL" -o "$MP4"
[ -s "$MP4" ] || { echo "FAILED: the download is empty: $MP4" >&2; exit 1; }
echo "downloaded: $MP4"
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate \
  -show_entries format=duration,size -of default=nw=1 "$MP4"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,channels -of default=nw=1 "$MP4" \
  || echo "WARNING: no audio stream in the generated file"

python3 "$PROJ/scripts/character/state.py" set "$VIDEO" generate done "$SEG $(basename "$MP4")" >/dev/null 2>&1 || true
python3 "$PROJ/scripts/character/state.py" cost "$VIDEO" "$EST" "$SEG $MODEL $([ -n "$FRINFO" ] && echo "${BILLED} billed units" || echo "${DUR}s")" 2>/dev/null || true
if [ -n "$FRINFO" ]; then
  # The identity gate, free and local: whose face is in the file.
  PY=python3; [ -x "$PROJ/.venv/bin/python3" ] && PY="$PROJ/.venv/bin/python3"
  echo; "$PY" "$PROJ/scripts/character/identity.py" "$VIDEO" "$SEG" "generated/$(basename "$MP4")" || true
fi
echo
echo "Next: run the 'character-review' skill. Do not report this as good until you have looked at it."
