#!/usr/bin/env python3
"""The offline test of scripts/niche-marks.py, the agent's side of the niche page's marks.
Free: no network. Not shipped (the installer copies template/ only).

    python3 tests/niche-marks/run.py

A temporary project with one niche catalog and one batch folder, then:
  - set writes agent marks with the rule and the why, and never changes a mark by you;
  - clear takes off agent marks only;
  - the file stays one the Atlas reads (sorted keys, version 1, the same shape);
  - study lists the Study posts not on disk and writes them as LINKS.md rows once;
  - list --unmarked shows only the posts with no mark.

Exit 1 when any expectation fails.
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "template", "scripts", "niche-marks.py")
RESULTS = []


def expect(label, good):
    RESULTS.append(bool(good))
    print(f"{'ok  ' if good else 'FAIL'} {label}")


def run(root, *args):
    r = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True, env={**os.environ, "PROJ_ROOT": root})
    return r.returncode, r.stdout + r.stderr


def post(pid, handle, kind, views, kw, caption):
    return {"id": pid, "keyword": kw, "window": "PHOTO_TAB", "handle": handle, "mediaType": kind, "views": views, "saves": views // 100, "date": "2026-10-01", "caption": caption, "url": f"https://www.tiktok.com/@{handle}/{'photo' if kind == 'slideshow' else 'video'}/{pid}"}


with tempfile.TemporaryDirectory() as root:
    niche = os.path.join(root, "apps", "demo", "niche")
    os.makedirs(os.path.join(root, "atlas", "data"))
    os.makedirs(os.path.join(niche, "batches", "2026-10-01", "held.one", "300"))
    open(os.path.join(niche, "batches", "2026-10-01", "held.one", "300", "slide-01.jpg"), "wb").write(b"x")
    posts = [post("100", "dog.mom", "video", 90000, "pettips", "my dog at the beach"), post("200", "cat.vet", "slideshow", 50000, "cattips", "5 signs your cat is in pain"),
             post("200", "cat.vet", "slideshow", 50000, "catcare", "5 signs your cat is in pain"), post("300", "held.one", "slideshow", 20000, "cattips", "cat food list"),
             post("400", "fan.art", "slideshow", 10000, "cattips", "drawing my cat"), post("500", "cat.list", "slideshow", 5000, "catcare", "things cats hate")]
    json.dump({"posts": posts}, open(os.path.join(root, "atlas", "data", "niche-demo.json"), "w"))
    marks_file = os.path.join(niche, "marks.json")
    json.dump({"version": 1, "marks": {"tiktok:100": {"mark": "out", "by": "you", "at": "2026-10-19T09:00:00Z"}, "tiktok:400": {"mark": "keep", "by": "you", "at": "2026-10-19T09:00:00Z"}}}, open(marks_file, "w"))

    code, out = run(root, "show", "demo")
    expect("show: the counts and your samples with their posts", code == 0 and "5 posts in the catalog" in out and "tiktok:100\tout\tvideo\t@dog.mom\t90000\tpettips\tmy dog at the beach" in out)

    code, out = run(root, "set", "demo", "out", "100", "400", "500", "tiktok:999", "--rule", "C1", "--why", "not about cats")
    m = json.load(open(marks_file))["marks"]
    expect("set: a mark of yours is skipped and named, keep included", "2 skipped" in out and m["tiktok:100"]["by"] == "you" and m["tiktok:400"]["mark"] == "keep")
    expect("set: the agent mark carries by, rule, why and the post", m["tiktok:500"] == {**m["tiktok:500"], "mark": "out", "by": "agent", "rule": "C1", "why": "not about cats", "handle": "cat.list", "caption": "things cats hate"})
    expect("set: a key not in the catalog is named, not written", "tiktok:999" in out and "tiktok:999" not in m)
    code, out = run(root, "set", "demo", "study", "200")
    expect("set: --why is required", code != 0 and "--why" in out)

    run(root, "set", "demo", "study", "200", "300", "--rule", "C2", "--why", "a numbered list of signs")
    raw = open(marks_file).read()
    keys = list(json.loads(raw)["marks"])
    expect("the file: version 1, keys sorted, written whole", json.loads(raw)["version"] == 1 and keys == sorted(keys) and raw.endswith("}\n") and not [f for f in os.listdir(niche) if f.endswith(".tmp")])

    code, out = run(root, "list", "demo", "--unmarked")
    expect("list --unmarked: only the posts with no mark (none left here)", code == 0 and out.strip().count("\n") == 0)
    code, out = run(root, "list", "demo")
    expect("list: one line per post, keywords merged, most views first", out.splitlines()[1].startswith("tiktok:100\tout\tyou") and "cattips,catcare" not in out and "catcare,cattips" in out)

    code, out = run(root, "study", "demo", "--date", "2026-10-19", "--write")
    links = open(os.path.join(niche, "batches", "2026-10-19", "LINKS.md")).read()
    expect("study: the post on disk is not fetched again", "1 on disk, 1 to fetch" in out and "/photo/300" not in links)
    expect("study: one LINKS.md row in the niche-hunt shape", "| 1 | https://www.tiktok.com/@cat.vet/photo/200 | study mark |" in links and links.startswith("# Batch 2026-10-19\n"))
    run(root, "study", "demo", "--date", "2026-10-19", "--write")
    expect("study: a second run adds no row twice", open(os.path.join(niche, "batches", "2026-10-19", "LINKS.md")).read().count("/photo/200") == 1)

    run(root, "set", "demo", "clear", "100", "500")
    m = json.load(open(marks_file))["marks"]
    expect("clear: an agent mark goes, a mark of yours stays", "tiktok:500" not in m and m["tiktok:100"]["mark"] == "out")

print(f"\n{sum(RESULTS)}/{len(RESULTS)} passed")
sys.exit(0 if all(RESULTS) else 1)
