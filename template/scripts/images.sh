#!/usr/bin/env bash
# Phase 8, the pictures of one post (the `images` skill). Three jobs in one script:
#
#   scripts/images.sh <slug> <post> [--only 3,5]     write the job file and print the instruction
#   scripts/images.sh <slug> <post> --verify         check every slide's file, write images-result.json, append the log lines
#   scripts/images.sh <slug> <post> --job            print the job file's path and nothing else
#
# <post> is the post key, 2026-09-16/hannah/2. Codex inline: the Codex agent reads the
# instruction this prints, makes the pictures itself, then runs --verify. Claude: the
# bridge, scripts/codex-images.sh, calls this twice around one `codex exec`.
#
# Writes apps/<slug>/production/files/<date>-<short>-<n>/images-job.json before anything
# is generated, so a re-run and the Atlas can read what was asked:
#   {post, handle, dimension, size: [w, h], slides: [{n, label, prompt, references, candidatesWanted}],
#    stylePrefix, identityRule, postProcess, requestedAt, agent}
# The prompts come from the deck through the Atlas build (data/production-<slug>.json);
# the references, the identity rule and the post-process step from handles/<handle>/HANDLE.md.
# --verify writes images-result.json {post, slides: [{n, files}], failed: [n], agent, finishedAt}
# and one log line per new candidate: {kind: "slide.upload", post, slide, file, actor: "agent",
# data: {source: "codex", job: "images-job.json"}}, the same `file` form the upload route writes.
set -euo pipefail

[ $# -ge 2 ] || { sed -n 2,12p "$0"; exit 2; }
SLUG=$1; KEY=$2; shift 2
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ATLAS="$ROOT/atlas"
POSTDIR="$ROOT/apps/$SLUG/production/files/$(printf '%s' "$KEY" | tr '/' '-')"
JOB="$POSTDIR/images-job.json"
MODE=write; ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --verify) MODE=verify ;;
    --job) echo "$JOB"; exit 0 ;;
    --only) ONLY=$2; shift ;;
    *) echo "unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done
export UGCKIT_AGENT="${UGCKIT_AGENT:-codex}"

# ---------------------------------------------------------------- verify
if [ "$MODE" = verify ]; then
  [ -s "$JOB" ] || { echo "no job file at $JOB -- run: $0 $SLUG $KEY" >&2; exit 1; }
  python3 - "$ROOT" "$SLUG" "$KEY" "$JOB" <<'PY'
import json, os, subprocess, sys, time
root, slug, key, job_path = sys.argv[1:5]
job = json.load(open(job_path))
postdir = os.path.dirname(job_path)
log = os.path.join(root, "apps", slug, "production", "log.jsonl")
w, h = job["size"]
logged = set()
if os.path.exists(log):
    for l in open(log):
        try: e = json.loads(l)
        except Exception: continue
        if e.get("kind") == "slide.upload" and e.get("post") == key: logged.add(e.get("file"))
def size_of(p):
    # ffprobe, not sips: sips is macOS only and ffmpeg is already a hard dependency.
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height", "-of", "csv=p=0", p], capture_output=True, text=True)
    try:
        a, b = r.stdout.strip().split(",")[:2]; return int(a), int(b)
    except Exception: return None
result = {"post": key, "slides": [], "failed": [], "agent": job.get("agent"), "finishedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
new_lines = []
for s in job["slides"]:
    n = s["n"]; sub = f"slide-{n:02d}"; d = os.path.join(postdir, sub)
    files = sorted(f for f in os.listdir(d)) if os.path.isdir(d) else []
    files = [f for f in files if not f.startswith(".") and f.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))]
    good, notes = [], []
    for f in files:
        p = os.path.join(d, f)
        if os.path.getsize(p) == 0: notes.append(f"{f}: empty"); continue
        sz = size_of(p)
        if not sz: notes.append(f"{f}: not an image"); continue
        if sz != (w, h): notes.append(f"{f}: {sz[0]}x{sz[1]}, wanted {w}x{h}"); continue
        good.append(f)
    if good:
        result["slides"].append({"n": n, "files": [f"{slug}/{os.path.basename(postdir)}/{sub}/{f}" for f in good], "notes": notes})
        print(f"  slide {n:2d}: {len(good)} valid file(s)" + (f"; {'; '.join(notes)}" if notes else ""))
    else:
        result["failed"].append(n)
        print(f"  slide {n:2d}: NO VALID FILE" + (f" ({'; '.join(notes)})" if notes else " (folder empty)"))
    for f in good:
        rel = f"{slug}/{os.path.basename(postdir)}/{sub}/{f}"
        if rel not in logged:
            new_lines.append({"at": result["finishedAt"], "post": key, "kind": "slide.upload", "slide": n, "file": rel,
                              "actor": "agent", "data": {"source": job.get("agent", "codex"), "job": "images-job.json"}})
json.dump(result, open(os.path.join(postdir, "images-result.json"), "w"), indent=2)
with open(log, "a") as fh:
    for e in new_lines: fh.write(json.dumps(e) + "\n")
print(f"{len(result['slides'])} of {len(job['slides'])} slides have a valid picture; {len(new_lines)} new candidate(s) logged -> images-result.json")
if result["failed"]:
    print(f"FAILED slides: {', '.join(str(n) for n in result['failed'])} -- re-run with --only {','.join(str(n) for n in result['failed'])}")
    sys.exit(1)
PY
  exit $?
fi

# ---------------------------------------------------------------- write the job
command -v node >/dev/null 2>&1 || { echo "node not found -- the deck is read through the Atlas build" >&2; exit 1; }
[ -d "$ATLAS" ] || { echo "no atlas/ folder -- re-run install.sh" >&2; exit 1; }
( cd "$ATLAS" && ATLAS_ROOT="$ROOT" node scripts/build-production.mjs >/dev/null ) || { echo "the Atlas build failed -- run: cd atlas && node scripts/build-production.mjs" >&2; exit 1; }
PROD="$ATLAS/data/production-$SLUG.json"
[ -s "$PROD" ] || { echo "no $PROD -- is there an apps/$SLUG/production/PLAN.md and a deck?" >&2; exit 1; }
mkdir -p "$POSTDIR"

python3 - "$ROOT" "$SLUG" "$KEY" "$PROD" "$JOB" "$ONLY" "$UGCKIT_AGENT" <<'PY'
import json, os, re, sys, time
root, slug, key, prod_path, job_path, only, agent = sys.argv[1:8]
prod = json.load(open(prod_path))
hit = None
for d in prod["decks"]:
    for p in d["posts"]:
        if p["key"] == key: hit = (d, p)
if not hit:
    sys.exit(f"no deck post with key {key} -- the deck skill writes production/decks/<date>-<short>.md first "
             f"(known: {', '.join(p['key'] for d in prod['decks'] for p in d['posts']) or 'none'})")
deck, post = hit
handle = (deck.get("handle") or "").lstrip("@")
hdir = os.path.join(root, "apps", slug, "handles", handle)
hmd = os.path.join(hdir, "HANDLE.md")
refs, identity, postproc = [], "", ""
if os.path.exists(hmd):
    text = open(hmd).read()
    def section(name):
        m = re.search(r"^##\s+" + name + r"\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
        return m.group(1).strip() if m else ""
    for line in section("References").split("\n"):
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(c) >= 2 and re.search(r"\.(png|jpe?g|webp)$", c[0].replace("`", ""), re.I):
            f = c[0].replace("`", "")
            refs.append({"file": os.path.normpath(os.path.join(hdir, f)), "role": c[1], "whatItIs": c[2] if len(c) > 2 else "", "usedFor": c[3] if len(c) > 3 else ""})
    identity = section("Identity rule")
    postproc = section("Post-process step")
else:
    print(f"  note: no {hmd}; the job carries no references, no identity rule and no post-process step", file=sys.stderr)
missing = [r["file"] for r in refs if not os.path.exists(r["file"])]
if missing: sys.exit("reference files named in HANDLE.md are missing on disk: " + ", ".join(missing))
# The profile picture is set on TikTok, not attached to slides.
attach = [r for r in refs if not re.search(r"profile", r["role"] + r["usedFor"], re.I)]
dim = post.get("dimension") or "3:4"
size = [1080, 1920] if dim == "9:16" else [1080, 1440]
want = set(int(x) for x in only.split(",") if x.strip()) if only else None
slides = []
for s in post["slides"]:
    if want and s["n"] not in want: continue
    if not s.get("prompt"):
        print(f"  note: slide {s['n']} has no image prompt in the deck; skipped", file=sys.stderr); continue
    slides.append({"n": s["n"], "label": s.get("label"), "prompt": s["prompt"],
                   "references": [r["file"] for r in attach], "candidatesWanted": 1})
if not slides: sys.exit("no slide to make: the deck has no image prompts" + (f" among {only}" if only else ""))
job = {"post": key, "handle": f"@{handle}" if handle else None, "dimension": dim, "size": size,
       "slides": slides, "stylePrefix": deck.get("stylePrefix"), "identityRule": identity, "postProcess": postproc,
       "references": attach, "requestedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "agent": agent}
json.dump(job, open(job_path, "w"), indent=2)
print(f"job: {len(slides)} slide(s) of {key} for @{handle}, {dim} ({size[0]}x{size[1]}), {len(attach)} reference(s) -> {job_path}")
PY

# The instruction: the same text for the Codex agent reading it inline and for the
# bridge, which pipes it to `codex exec` on stdin. Paths are absolute so the worker
# cannot save anywhere else.
cat <<EOT

== instruction for the image-making agent ==
Read the job file $JOB. It lists the slides of one TikTok slideshow post: for each slide
an image prompt, and the same style prefix, identity rule and reference images for all
of them. Make the pictures with your built-in image generation tool, one call per slide
(never one call for several slides, never code that calls an image API).

For each slide N in the job's "slides":
  1. The prompt is the job's "stylePrefix" followed by the slide's "prompt". Use it as
     written. The attached reference images are the identity references the job names:
     the subject in the picture must be the same subject (same coat, same face, same eye
     colour; the same face for a person). Follow "identityRule". No text in the image.
  2. Ask the tool for the portrait size closest to the job's "size" (1024x1536 for 3:4
     and for 9:16).
  3. Copy the generated file into the folder $POSTDIR/slide-NN/ (NN two digits) as
     codex-<timestamp>.png. Then resize it to exactly the job's size with ffmpeg, into a
     second file next to it, codex-<timestamp>-post.png:
       ffmpeg -y -loglevel error -i <raw>.png -vf "scale=WxH:force_original_aspect_ratio=increase,crop=W:H" <raw>-post.png
     with W and H from "size" (a 1024x1536 render becomes 1080x1440 by a scale and a
     centre crop; 1080x1920 the same way). Apply the job's "postProcess" step if it names
     more than that. Keep both files; the review picks either.
  4. Go to the next slide. Do not stop on a failed slide: note its number and continue.
When every slide is done, write $POSTDIR/images-result.md: one line per slide, "slide N:
<file> <WxH>" or "slide N: FAILED <why>", then one line "done". Your last message is the
contents of that file and nothing else. Do not run the --verify step; the caller does.
EOT
