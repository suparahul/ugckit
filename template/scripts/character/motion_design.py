#!/usr/bin/env python3
"""Motion design: the app's real screens rebuilt in code, animated and rendered at 1080x1920,
for an R or P segment whose beats have demo_source motion_design (scripts/character/demo.py).
Free, local: a headless Chromium and ffmpeg. Never a video model (founder, 2026-10-19).

    motion_design.py start  <video> <seg>    the segment's motion/ folder: story.json from the
                                             plan, the page template, assets/ and assets.json
    motion_design.py render <video> <seg>    motion/render.mp4 (motion_render.mjs), its stills at
                                             the end of every step, and render.json
    motion_design.py check  <video> <seg>    the gates, into motion/gates.json
    motion_design.py show   <video>          every motion-designed segment: story, render, gates,
                                             approval

The folder is pipeline/character/<video>/segments/<seg>/motion/:
  story.json    the segment's screen story, copied from the locked plan (never edited here)
  index.html    the page the agent writes (character-motion skill) from the app's real screens:
                PRODUCT-SCREENS.md, the code and screenshots its story's rebuilt_from names
  assets/       the fonts, icons and pictures the page uses, each in assets.json:
                {"files": {"assets/<f>": {"from": "app:<path>|plan:<asset id>|world:<subject id>"}}}
  render.mp4    the render; stills/step-NN.png the frame at the end of each step
  render.json   what was rendered, from which page, assets and story (sha256 of each)
  gates.json    the gates of that render

The gates (all must pass before review.py motion approves the render at gate B):
  current       render.json matches the page, the assets, assets.json and the plan's story now
  format        1080x1920, 30 fps, at least the story's seconds
  local_only    no request left the machine, and no web address in the page's files
  assets        every file in assets/ is listed, from the app, a plan asset or a fixed subject,
                with no file from a generation (generated/, keyframes/)
  story_text    every line of text on the page, at every step, is a string of the story: no
                interface word or sentence the story does not hold
  text_read     OCR reads each step's strings on its still (NOT RUN without an OCR engine: then
                the user's eye check, --check text=pass at approval)
  hero          the [data-hero] element holds the plan's hero string, and OCR reads it there
  page          the page ran with no error
"""
import glob, hashlib, json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CH = os.path.join(ROOT, "pipeline", "character")
sys.path.insert(0, HERE)
import demo  # noqa: E402
import ocr  # noqa: E402

TEMPLATE = os.path.join(ROOT, "docs", "character", "motion-design.example.html")
RENDERER = os.path.join(HERE, "motion_render.mjs")
GATES = ("current", "format", "local_only", "assets", "story_text", "text_read", "hero", "page")
URL = re.compile(r"(?:https?:)?//(?!www\.w3\.org/)[a-z0-9.-]+\.[a-z]{2,}", re.I)
# The text a status bar always shows: it is the phone, not the app.
CHROME_TEXT = re.compile(r"^(\d{1,2}:\d{2}|\d{1,3}%|5g|4g|lte)$", re.I)


def load(p):
    with open(p) as f:
        return json.load(f)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def sha256_json(o):
    return hashlib.sha256(json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def atomic(p, d):
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    os.replace(tmp, p)


def vdir(video):
    return os.path.join(CH, video)


def mdir(video, seg):
    return os.path.join(vdir(video), "segments", seg, "motion")


def segments(video):
    """[(name, segment)] of video.json."""
    v = load(os.path.join(vdir(video), "video.json"))
    return [(f"{int(s['n']):02d}-{str(s['type']).lower()}", s) for s in v.get("segments") or []]


def story_of(video, seg):
    """The segment's screen story from the locked plan, or exit with why there is none."""
    pp = os.path.join(vdir(video), "plan.json")
    if not os.path.exists(pp) or not os.path.exists(os.path.join(vdir(video), "video.json")):
        sys.exit(f"pipeline/character/{video} needs plan.json and video.json (character-shots)")
    plan = load(pp)
    s = dict(segments(video)).get(seg)
    if not s:
        sys.exit(f"{seg} is not a segment of {video}'s video.json")
    if str(s.get("type")).upper() not in ("R", "P"):
        sys.exit(f"{seg} is a {s.get('type')} segment: motion design is an R or P segment")
    st = demo.segment_story(plan, s.get("beat_ids") or [])
    if not st:
        sys.exit(f"{seg}: none of its beats has demo_source motion_design (it lays in a real recording)")
    return plan, s, st


def step_times(st):
    """The still of each step: 0.1 s before the next step (the result fully in), the last one
    0.1 s before the end."""
    ats = [float(x["at_s"]) for x in st["steps"]] + [float(st["seconds"])]
    return [round(max(ats[i], ats[i + 1] - 0.1), 3) for i in range(len(st["steps"]))]


def hero_step(st):
    h = demo.norm(st.get("hero"))
    if not h:
        return None
    for k, x in enumerate(st["steps"]):
        if h in {demo.norm(s) for s in x.get("shows") or []}:
            return k
    return None


def asset_rows(md):
    p = os.path.join(md, "assets.json")
    return (load(p).get("files") or {}) if os.path.exists(p) else {}


def page_files(md):
    """Every file the page is made of: index.html, assets.json and assets/ (the render reads them)."""
    out = [os.path.join(md, "index.html")]
    if os.path.exists(os.path.join(md, "assets.json")):
        out.append(os.path.join(md, "assets.json"))
    for p in sorted(glob.glob(os.path.join(md, "assets", "**", "*"), recursive=True)):
        if os.path.isfile(p):
            out.append(p)
    return out


def fingerprint(md, st):
    return {"story_sha256": sha256_json(st),
            "files": {os.path.relpath(p, md): sha256_file(p) for p in page_files(md) if os.path.exists(p)}}


# ---------------------------------------------------------------- start
def cmd_start(video, seg):
    plan, s, st = story_of(video, seg)
    md = mdir(video, seg)
    os.makedirs(os.path.join(md, "assets"), exist_ok=True)
    sp = os.path.join(md, "story.json")
    if os.path.exists(sp) and load(sp) != st:
        print("  ! the plan's story changed since the last start: story.json is rewritten; check the page against it")
    atomic(sp, st)
    ip = os.path.join(md, "index.html")
    if not os.path.exists(ip):
        shutil.copyfile(TEMPLATE, ip)
        print(f"  page template copied to {os.path.relpath(ip, ROOT)}")
    ap = os.path.join(md, "assets.json")
    if not os.path.exists(ap):
        atomic(ap, {"_comment": "Every file in assets/: where it comes from. app:<path in the app's code, or its "
                                "screenshot>, plan:<asset id>, world:<fixed subject id>. Never a model's picture.",
                    "files": {}})
    screens = demo.product_screens(ROOT, plan.get("app")) or {}
    print(f"{video} {seg}: motion design, {st['seconds']:g} s, fit {st['fit']}, screen {st['screen_id']}")
    print("  rebuild these screens, exactly as PRODUCT-SCREENS.md describes them:")
    for n in st["screens"]:
        src = re.search(r"\*\*Source:\*\*\s*(.+)", screens.get(n, ""))
        print(f"    - {n}" + (f"  ({src.group(1).strip()[:160]})" if src else ""))
    print("  from: " + "; ".join(st["rebuilt_from"]))
    print("  the steps (seconds from the segment's start; every string word for word):")
    for k, x in enumerate(st["steps"], 1):
        print(f"    {k}. {x['at_s']:>5g} s  {x['action']:<6} {x.get('target') or ''}  shows: {' / '.join(x['shows'])}")
    if st.get("hero"):
        print(f"  the hero string, on the element with data-hero: {st['hero']!r}")
    print(f"  then: motion_design.py render {video} {seg}")


# ---------------------------------------------------------------- render
def cmd_render(video, seg):
    plan, s, st = story_of(video, seg)
    md = mdir(video, seg)
    if not os.path.exists(os.path.join(md, "index.html")):
        sys.exit(f"no {os.path.relpath(md, ROOT)}/index.html: motion_design.py start {video} {seg}, then write the page")
    if not os.path.exists(os.path.join(md, "story.json")) or load(os.path.join(md, "story.json")) != st:
        sys.exit("story.json is not the plan's story now: motion_design.py start again, and check the page against it")
    if not shutil.which("node") or not shutil.which("ffmpeg"):
        sys.exit("the render needs node and ffmpeg")
    stills = step_times(st)
    hk = hero_step(st)
    out = os.path.join(md, "render.mp4")
    run_j = os.path.join(md, "render-run.json")
    cmd = ["node", RENDERER, os.path.join(md, "index.html"), out, "--seconds", f"{st['seconds']:g}",
           "--fit", st["fit"], "--probe", ",".join(f"{t:g}" for t in stills), "--json", run_j]
    if hk is not None:
        cmd += ["--hero-at", f"{stills[hk]:g}"]
    t0 = time.time()
    r = subprocess.run(cmd)
    if r.returncode != 0 or not os.path.exists(run_j):
        sys.exit("the render failed")
    run = load(run_j)
    os.remove(run_j)
    sd = os.path.join(md, "stills")
    os.makedirs(sd, exist_ok=True)
    for p in glob.glob(os.path.join(sd, "step-*.png")):
        os.remove(p)
    for k, t in enumerate(stills, 1):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", out, "-frames:v", "1",
                        os.path.join(sd, f"step-{k:02d}.png")], check=True)
    rec = {"video": video, "segment": seg, "file": "render.mp4", "sha256": sha256_file(out),
           "rendered": time.strftime("%Y-%m-%dT%H:%M:%S"), "seconds_taken": round(time.time() - t0, 1),
           "stills": {f"stills/step-{k:02d}.png": t for k, t in enumerate(stills, 1)},
           "hero_step": hk, **fingerprint(md, st), "run": run}
    atomic(os.path.join(md, "render.json"), rec)
    gp = os.path.join(md, "gates.json")
    if os.path.exists(gp):
        os.remove(gp)
    print(f"{os.path.relpath(out, ROOT)}: {run['frames']} frames, {len(stills)} still(s); then: motion_design.py check {video} {seg}")


# ---------------------------------------------------------------- check
def gates(video, seg, plan, st):
    md = mdir(video, seg)
    rp, out = os.path.join(md, "render.json"), os.path.join(md, "render.mp4")
    if not os.path.exists(rp) or not os.path.exists(out):
        return None, f"no render yet: motion_design.py render {video} {seg}"
    rec = load(rp)
    run = rec.get("run") or {}
    res = []

    def add(g, ok, detail):
        res.append({"gate": g, "result": ok if isinstance(ok, str) else ("PASS" if ok else "FAIL"), "detail": detail})

    # current
    now = fingerprint(md, st)
    changed = [f for f in set(now["files"]) | set(rec.get("files") or {})
               if now["files"].get(f) != (rec.get("files") or {}).get(f)]
    stale = []
    if now["story_sha256"] != rec.get("story_sha256"):
        stale.append("the plan's story changed")
    if changed:
        stale.append("changed since the render: " + ", ".join(sorted(changed)[:6]))
    if sha256_file(out) != rec.get("sha256"):
        stale.append("render.mp4 is not the file render.json records")
    add("current", not stale, "; ".join(stale) or "the render is of the page, the assets and the story now")
    # format
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,avg_frame_rate", "-show_entries", "format=duration", "-of", "json", out],
                       capture_output=True, text=True)
    pr = json.loads(r.stdout or "{}")
    vs = (pr.get("streams") or [{}])[0]
    fr = vs.get("avg_frame_rate", "0/1").split("/")
    fps = float(fr[0]) / float(fr[1] or 1) if len(fr) == 2 and float(fr[1] or 0) else 0
    dur = float((pr.get("format") or {}).get("duration") or 0)
    ok = vs.get("width") == 1080 and vs.get("height") == 1920 and abs(fps - 30) < 0.01 and dur >= st["seconds"] - 0.05
    add("format", ok, f"{vs.get('width')}x{vs.get('height')}, {fps:g} fps, {dur:.2f} s (the story: {st['seconds']:g} s)")
    # local_only
    found = []
    for p in page_files(md):
        if p.endswith((".html", ".css", ".js", ".mjs", ".svg")):
            found += [f"{os.path.relpath(p, md)}: {m.group(0)}" for m in URL.finditer(open(p, errors="replace").read())]
    blocked = run.get("blocked") or []
    add("local_only", not found and not blocked,
        "; ".join((["blocked: " + ", ".join(blocked[:3])] if blocked else []) + found[:4]) or "only local files")
    # assets
    rows, probs = asset_rows(md), []
    subjects = {}
    wp = os.path.join(ROOT, "apps", str(plan.get("app")), "handles", str(plan.get("handle")).lstrip("@"), "world.json")
    if os.path.exists(wp):
        subjects = {x.get("id") for x in load(wp).get("fixed_subjects") or []}
    plan_assets = {a.get("id") for a in plan.get("assets") or []}
    files = [os.path.relpath(p, md) for p in page_files(md) if os.path.relpath(p, md).startswith("assets" + os.sep)]
    for f in files:
        row = rows.get(f) or rows.get(f.replace(os.sep, "/"))
        frm = str((row or {}).get("from") or "")
        if not row:
            probs.append(f"{f} is not in assets.json")
        elif not frm.startswith(demo.ASSET_FROM):
            probs.append(f"{f}: from {frm!r} (app:, plan: or world:)")
        elif re.search(r"(^|/)(generated|keyframes)(/|$)", frm):
            probs.append(f"{f}: from {frm!r}, a generation: never inside the app's screen")
        elif frm.startswith("plan:") and frm[5:] not in plan_assets:
            probs.append(f"{f}: plan asset {frm[5:]!r} is not in the plan")
        elif frm.startswith("world:") and frm[6:] not in subjects:
            probs.append(f"{f}: {frm[6:]!r} is not a fixed subject of the handle's world")
    add("assets", not probs, "; ".join(probs[:5]) or f"{len(files)} file(s), each from the app, the plan or the world")
    # story_text: what the page says at each step, against the story.
    allowed = {demo.norm(x) for x in demo.story_strings(st)}
    extra = []
    for t, lines in sorted((run.get("text") or {}).items(), key=lambda x: float(x[0])):
        for ln in lines:
            n = demo.norm(ln)
            if not n or CHROME_TEXT.match(ln.strip()) or any(n in a for a in allowed):
                continue
            extra.append(f"{float(t):g} s: {ln!r}")
    probed = len(run.get("text") or {})
    extra = list(dict.fromkeys(extra))
    if extra:
        detail = "not in the story: " + "; ".join(extra[:5])
    else:
        detail = f"{probed} step(s): every line is a string of the story" if probed else "no text was read from the page"
    add("story_text", probed > 0 and not extra, detail)
    # text_read: OCR of each step's still.
    stills = sorted((rec.get("stills") or {}).items())
    paths = [os.path.join(md, p) for p, _ in stills]
    texts = ocr.read(paths) if paths and all(os.path.exists(p) for p in paths) else None
    if texts is None:
        add("text_read", "NOT RUN", "no OCR engine (tesseract, or swift on macOS): the user reads the stills")
    else:
        miss = []
        for k, (x, p) in enumerate(zip(st["steps"], paths), 1):
            for sstr in x.get("shows") or []:
                if len(demo.norm(sstr)) < 2:
                    continue
                if not ocr.matches(sstr, texts.get(p, ""), 0.85)[0]:
                    miss.append(f"step {k}: {sstr[:60]!r}")
        add("text_read", not miss, ("not read on the still: " + "; ".join(miss[:5])) if miss
            else f"every string read on {len(paths)} still(s)")
    # hero
    hero = st.get("hero")
    hk = rec.get("hero_step")
    if not hero:
        add("hero", True, "no hero string: the viewer recognises or believes the screen")
    else:
        h = run.get("hero") or {}
        okh = bool(h) and demo.text_close(hero, h.get("text") or "", 0.9)
        why = (f"[data-hero] holds {h.get('text')!r} at {h.get('t')} s, at {h.get('rect')}" if h else
               "no [data-hero] element at the hero's step")
        if okh and texts is not None and hk is not None and hk < len(paths):
            read, ratio = ocr.matches(hero, texts.get(paths[hk], ""), 0.9)
            okh = okh and read
            why += f"; OCR {'reads' if read else 'does not read'} it ({ratio})"
        elif okh and texts is None:
            add("hero", "NOT RUN", why + "; no OCR engine: the user reads it")
            okh = None
        if okh is not None:
            add("hero", okh, why)
    # page
    errs = run.get("errors") or []
    add("page", not errs, "; ".join(errs[:3]) or "no error")
    return {"video": video, "segment": seg, "file": "render.mp4", "sha256": rec.get("sha256"),
            "checked": time.strftime("%Y-%m-%dT%H:%M:%S"), "results": res,
            "hero": ({"t": (run.get("hero") or {}).get("t"), "rect": (run.get("hero") or {}).get("rect"), "text": hero}
                     if hero and run.get("hero") else None)}, None


def cmd_check(video, seg):
    plan, s, st = story_of(video, seg)
    g, why = gates(video, seg, plan, st)
    if g is None:
        sys.exit(why)
    atomic(os.path.join(mdir(video, seg), "gates.json"), g)
    for r in g["results"]:
        mark = {"PASS": "✓", "FAIL": "✗"}.get(r["result"], "?")
        print(f"  {mark} {r['result']:<8} {r['gate']:<11} {r['detail']}")
    failed = [r["gate"] for r in g["results"] if r["result"] == "FAIL"]
    print(("FAIL: " + ", ".join(failed)) if failed else
          f"no gate failed: show the user {os.path.relpath(os.path.join(mdir(video, seg), 'render.mp4'), ROOT)} and its stills; "
          f"review.py motion {video} {seg} records their decision")
    sys.exit(1 if failed else 0)


def state(video, seg):
    """(render sha256 or None, gates dict or None, approval row or None) of one segment, for
    review.py and assemble.py. The approval counts only for the render on disk now."""
    md = mdir(video, seg)
    out = os.path.join(md, "render.mp4")
    sha = sha256_file(out) if os.path.exists(out) else None
    gp = os.path.join(md, "gates.json")
    g = load(gp) if os.path.exists(gp) else None
    if g and g.get("sha256") != sha:
        g = None
    ap = os.path.join(vdir(video), "approval.json")
    rows = [e for e in (load(ap).get("gate_b_motion") or []) if e.get("segment") == seg] if os.path.exists(ap) else []
    return sha, g, (rows[-1] if rows else None)


def approved(video, seg):
    """The approved render of a segment: (path, row) or (None, why)."""
    sha, g, e = state(video, seg)
    if not sha:
        return None, f"no motion/render.mp4 (motion_design.py render {video} {seg})"
    if not e or e.get("decision") != "approve":
        return None, "the render is not approved at gate B (review.py motion)"
    if e.get("sha256") != sha:
        return None, "the approved render is not the one on disk (render again, check, approve)"
    return os.path.join(mdir(video, seg), "render.mp4"), e


def cmd_show(video):
    n = 0
    for name, s in segments(video):
        if str(s.get("type")).upper() not in ("R", "P"):
            continue
        plan = load(os.path.join(vdir(video), "plan.json"))
        st = demo.segment_story(plan, s.get("beat_ids") or [])
        if not st:
            continue
        n += 1
        sha, g, e = state(video, name)
        gs = "no gates" if not g else ", ".join(f"{r['gate']} {r['result']}" for r in g["results"]
                                                if r["result"] != "PASS") or "every gate PASS"
        ap = "not reviewed" if not e else f"{e['decision']} {e.get('date')}" + ("" if e.get("sha256") == sha else " (another render)")
        print(f"  {name}  {st['seconds']:g} s, {len(st['steps'])} step(s), screen {st['screen_id']}: "
              f"{'rendered' if sha else 'not rendered'}; {gs}; {ap}")
    if not n:
        print(f"{video}: no motion-designed segment")


def main():
    a = sys.argv[1:]
    if not a or a[0] not in ("start", "render", "check", "show"):
        sys.exit(__doc__)
    if a[0] == "show" and len(a) == 2:
        return cmd_show(a[1])
    if len(a) != 3:
        sys.exit(__doc__)
    {"start": cmd_start, "render": cmd_render, "check": cmd_check}[a[0]](a[1], a[2])


if __name__ == "__main__":
    main()
