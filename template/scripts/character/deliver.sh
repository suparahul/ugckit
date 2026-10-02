#!/usr/bin/env bash
# P6: the finished file, after gate C. Local, free. The pipeline ends here: no posting.
#
#   scripts/character/deliver.sh <video>
#
# Refuses unless approval.json gate_c_final.decision is "approve" with the user's words
# (review.py final). Copies the export the user chose (default, or grain) to
# pipeline/character/<video>/final/<video>.mp4 and writes final/delivery.json.
set -euo pipefail
[ $# -eq 1 ] || { sed -n 2,8p "$0"; exit 2; }
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PY=python3; [ -x "$ROOT/.venv/bin/python3" ] && PY="$ROOT/.venv/bin/python3"
"$PY" - "$ROOT" "$1" <<'PYEOF'
import hashlib, json, os, shutil, subprocess, sys, time
root, video = sys.argv[1:3]
vd = os.path.join(root, "pipeline", "character", video)
ap = os.path.join(vd, "approval.json")
man = os.path.join(vd, "assembly", "assembly.json")
if not os.path.exists(man):
    sys.exit("no assembly/assembly.json -- run scripts/character/assemble.sh first")
gc = (json.load(open(ap)).get("gate_c_final") or {}) if os.path.exists(ap) else {}
if gc.get("decision") != "approve" or not (gc.get("words") or "").strip():
    sys.exit("gate C is not approved: show the user the file, then record their words with "
             "scripts/character/review.py final <video> --decision approve --words \"...\"")
m = json.load(open(man))
choice = gc.get("export_choice") or "default"
src = m["grain_file"] if choice == "grain" else m["file"]
if not src:
    sys.exit("the user chose the grain export, but none was made: assemble.sh <video> --grain")
src = os.path.join(root, src)
if gc.get("file") and os.path.join(root, gc["file"]) != os.path.join(root, m["file"]):
    sys.exit("gate C approved another assembly than the one on disk: show the user this file and record gate C again")
if os.path.getmtime(src) > os.path.getmtime(ap):
    sys.exit("the assembly is newer than gate C: show the user this file and record gate C again")
fd = os.path.join(vd, "final")
os.makedirs(fd, exist_ok=True)
out = os.path.join(fd, f"{video}.mp4")
shutil.copy2(src, out)
sha = hashlib.sha256(open(out, "rb").read()).hexdigest()
st = os.path.join(root, "pipeline", "character", "state.json")
costs = (json.load(open(st)).get("videos", {}).get(video, {}).get("costs") or []) if os.path.exists(st) else []
d = {"video_id": video, "file": os.path.relpath(out, root), "sha256": sha, "export": choice,
     "duration_s": m.get("duration_s"), "approved": {"words": gc["words"], "date": gc.get("date")},
     "segments": [{k: e.get(k) for k in ("n", "type", "src", "in", "out")} for e in m["segments"]],
     "computed_spend_usd": round(sum(c["usd"] for c in costs), 2),
     "delivered": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
json.dump(d, open(os.path.join(fd, "delivery.json"), "w"), indent=2)
subprocess.run([sys.executable, os.path.join(root, "scripts", "character", "state.py"), "set", video,
                "deliver", "done", f"final/{video}.mp4"], capture_output=True)
print(f"delivered: {os.path.relpath(out, root)} ({choice} export, sha256 {sha[:12]}, computed spend ${d['computed_spend_usd']:.2f})")
print("the pipeline ends here; posting is outside it")
PYEOF
