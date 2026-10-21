#!/usr/bin/env python3
"""The approvals of a character video, and the failure ledger. Free, local.

    review.py segment <video> <seg> --decision approve|reject|regenerate --words "<the user's words>"
              [--file generated/<x>.mp4] [--class "<failure>"] [--fix "<prompt change>"]
              [--fixed-by "<prompt change>"] [--set <set-id>] [--check name=value ...]
                                    gate B (P3): one decision on one generated segment
    review.py composite <video> <seg> --file composite/<x>.mp4 --words "<the user's words>"
                                    P4: the composite that assembly uses (its gates passed)
    review.py final <video> --decision approve|reject|regenerate --words "<the user's words>"
              [--export default|grain] [--segment <n>] [--check name=value ...]
                                    gate C (P6): the assembled file
    review.py source <video> <asset-id> --decision approve|reject --words "<the user's words>"
              [--check name=value ...]
                                    gate B for supplied media (C, a panel, a supplied voice):
                                    the file matches its checksum, its permission and range
    review.py narration <video> <take> --narrator <id> --lines l2,l3 --decision approve|reject
              --words "<the user's words>" [--check natural_voice=pass ...]
                                    gate B for a narrator's take, narration/<take>.wav|mp3
    review.py motion <video> <seg> --decision approve|reject --words "<the user's words>"
              [--check text=pass] [--check hero=pass]
                                    gate B for a motion-designed screen (an R or P segment, a
                                    phone's screen or an M panel whose beats have demo_source
                                    motion_design): this exact render
                                    (its sha256), every gate of motion_design.py check passed;
                                    a gate NOT RUN (no OCR engine) needs the user's eye check
    --accept-fail <gate>, on segment, motion, narration and final (repeatable): approve anyway a
              take or file that failed a measured gate, at the user's discretion (2026-10-21). The
              gate still runs and shows its result; approval.json records accepted_failures (the
              gate, its result, the words). Gates: identity and ocr (a motion-copy take), voice
              (a narrator's take), overlays (gate C), and each motion-design gate but current.
              Never accepted: a stale render, a supplied file that changed, a stale cut.
    review.py storyboard <video> --decision approve|redo --words "<the user's words>"
                                    gate A (P1): the storyboard, every keyframe by its sha256
    review.py show <video>          every segment: generated, approved, composited
    review.py pending [<video>]     every Atlas click no file records yet, with the command
                                    that records it (run it first in every character-* skill)

    --from-atlas, on storyboard, segment, composite, final, source, narration and motion, in place
    of --decision and --words: the user's click in the Atlas (apps/<app>/production/log.jsonl,
    the last storyboard.*, take.*, composite.*, cut.*, source.* or narration.* line for this
    video, by the user; motion.* for a render). The file the line names must still have the sha256 it recorded; the
    words are the click's note, or say what was clicked. Every gate runs as for words given
    here. A storyboard send-back that names segments is a redo of only those keyframes; a
    cut send-back that names a segment is "regenerate segment <n>" at gate C, the user's yes
    to one more run of it at the cost on the line. A composite send-back is not a record of
    approval.json: the agent notes it (state.py note) and runs composite.sh again.
    review.py rates                 the keep rate per segment type and per set, from every video

Writes pipeline/character/<video>/approval.json. A reject or a regenerate with --class
adds a row to the model's table in pipeline/character/model-failures.md (the user's file;
the table is made at the model's first reject); --fixed-by on a later approve fills the
"Prompt change that fixed it" column of that segment's open rows. Nothing is approved
without the user's words. Gate C refuses an approval when the file is stale (the plan
changed after assembly) or its overlays are not the plan's. An X segment by motion
copy is approved only with --check identity=pass, no_source_identity=pass and silent=pass,
a PASS or NO FACE of the identity gate (identity.py) on the file, a length within 0.25 s of
its reference clip, and no text read by OCR (a failed identity gate or OCR read is approved
anyway only with --accept-fail identity or ocr and the user's words). An X segment by the written fallback (a silent
reaction the user named after a failed motion take) is approved only with --check identity=pass, hands=pass, silent=pass and
performance=pass, and only when the file is as long as the shot plans.

Continuity (scripts/character/continuity.py): an approval of a segment that the next one
continues from takes its last frame (segments/<seg>/last-frame.png and last-frame.json). A
continuing take is approved only when generate.sh recorded the frame it was seeded with
(<take>.seed.json) and that frame is the current one; how far its first frame is from the
seed frame is recorded as checks.seed_diff.
"""
import glob, json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bridge
import continuity

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "pipeline", "character")
LEDGER = os.path.join(CH, "model-failures.md")
GENERATED = ("T", "O", "G", "S", "H", "F", "B", "X")
# X, a silent reaction: approved only with these checks passed by eye, and its length
# measured against the shot's planned length.
REACTION_CHECKS = ("identity", "hands", "silent", "performance")
# X by motion copy (founder, 2026-10-04; renamed 2026-10-19): the motion is the reference clip's,
# so the checks are the person: the character's identity, and no trace of the original creator
# (face, hair, identity marks, a handle or watermark); silent; the clip's length on the edit
# route, at least it on the guided route (trimmed at assembly, plus follows_reference); and
# OCR reads no text on the file.
MOTION_COPY_CHECKS = ("identity", "no_source_identity", "silent")
GUIDED_CHECKS = ("follows_reference",)    # the guided route makes a new clip, not the clip's frames
AUDIO_EXT = (".wav", ".mp3", ".m4a", ".aac")
PHONE = ("O", "G", "S", "H", "F")
PLANNED = {"T": 60, "O": 50, "G": 37, "S": 37, "H": 30, "F": 25}


def today():
    return time.strftime("%Y-%m-%d")


def vdir(video):
    return os.path.join(CH, video)


def load_approval(video):
    p = os.path.join(vdir(video), "approval.json")
    if os.path.exists(p):
        return json.load(open(p))
    return {"video_id": video, "gate_a_storyboard": {}, "gate_b_segments": [], "gate_c_final": {}}


def save_approval(video, d):
    p = os.path.join(vdir(video), "approval.json")
    tmp = p + ".tmp"
    json.dump(d, open(tmp, "w"), indent=2)
    os.replace(tmp, p)


def opts(a, multi=("--check", "--accept-fail")):
    out, i = {}, 0
    while i < len(a):
        k = a[i]
        if k.startswith("--") and i + 1 < len(a):
            if k in multi:
                out.setdefault(k, []).append(a[i + 1])
            else:
                out[k] = a[i + 1]
            i += 2
        else:
            sys.exit(f"unexpected argument {k!r}\n{__doc__}")
    return out


# The measured gates an approval may pass at the user's discretion (2026-10-21): the gate
# still runs and its result is shown; --accept-fail <gate> with the user's words records the
# override in approval.json (accepted_failures). Never accepted: a file that changed after it
# was checked (a motion render that is not current, a supplied file that is not the plan's).
ACCEPTABLE = {"identity": "the identity gate of a motion-copy take (identity.py)",
              "ocr": "text read by OCR on a motion-copy take",
              "voice": "the natural-voice check of a narrator's take",
              "overlays": "the overlay checks of the assembled file (gate C)",
              "format": "motion design: the render's size, rate or length",
              "local_only": "motion design: a web address or a request out",
              "assets": "motion design: a picture not from the app, the plan or the world",
              "story_text": "motion design: text on the page that the story does not hold",
              "text_read": "motion design: OCR does not read a step's strings (or did not run)",
              "hero": "motion design: the hero string (or it was not read)",
              "page": "motion design: the page had an error"}


# The checks of the cut that are integrity, never accepted (assemble.py names them).
INTEGRITY_CUT = ("overlays as planned", "supplied files unchanged")


def accept_fail(o, rows, gate, result, detail, words, why):
    """One failed measured gate: refused (exit with why), or approved anyway when the user
    named it (--accept-fail <gate>), recorded in rows with the result and their words."""
    known(o)
    if gate not in o.get("--accept-fail", []):
        sys.exit(f"{why}\n  or, at the user's discretion, approve anyway: --accept-fail {gate} with their words "
                 "(the gate, its result and the words are recorded)")
    rows.append({"gate": gate, "result": result, "detail": detail, "words": words, "date": today()})
    print(f"warning: {gate} {result}{f' ({detail})' if detail else ''}: approved anyway on the user's words")


def known(o):
    for g in o.get("--accept-fail", []):
        if g not in ACCEPTABLE:
            sys.exit(f"--accept-fail {g!r}: one of {', '.join(ACCEPTABLE)}")


def unused_accepts(o, rows):
    known(o)
    for g in o.get("--accept-fail", []):
        if g not in {r["gate"] for r in rows}:
            print(f"note: --accept-fail {g}: that gate did not fail here; nothing is recorded for it")


def model_slug():
    st = os.path.join(CH, "state.json")
    if os.path.exists(st):
        return (json.load(open(st)).get("model") or {}).get("slug")
    return None


def latest(d, project):
    rows = [e for e in d.get("gate_b_segments") or [] if e.get("project") == project]
    return rows[-1] if rows else None


# ---------------------------------------------------------------- the Atlas
def log_lines(video):
    """Every line of the app's decision log, in order."""
    app = plan_of(video).get("app") or ""
    lp = os.path.join(ROOT, "apps", app, "production", "log.jsonl")
    out = []
    if app and os.path.exists(lp):
        for ln in open(lp, encoding="utf-8"):
            try:
                out.append(json.loads(ln))
            except ValueError:
                continue
    return app, out


def atlas_line(video, kinds, segment=None, key="segment"):
    """The user's last Atlas decision of `kinds` for this video (and segment, or the line's
    `key` field), from the app's decision log. A line written by an agent (an actor) is never
    the user's decision."""
    app, lines = log_lines(video)
    rows = []
    for e in lines:
        dd = e.get("data") or {}
        if e.get("kind") in kinds and dd.get("video") == video and (segment is None or dd.get(key) == segment):
            rows.append(e)
    if not rows:
        sys.exit(f"no Atlas decision ({', '.join(kinds)}) for {video}{' ' + segment if segment else ''} in "
                 f"apps/{app}/production/log.jsonl: the user decides in the Atlas, or gives their words here")
    e = rows[-1]
    if e.get("actor"):
        sys.exit(f"the last Atlas line was written by {e['actor']!r}, not by the user: it is not a decision")
    return e


def atlas_file(path, e, what):
    """The file a line names must be the one the user saw: the same sha256."""
    want = (e.get("data") or {}).get("sha256")
    if not os.path.exists(path):
        sys.exit(f"{what} {os.path.relpath(path, ROOT)} is not on disk")
    if bridge.sha256_file(path) != want:
        sys.exit(f"{what} {os.path.relpath(path, ROOT)} changed after the click ({e['at'][:16]}): the user decides again")


def atlas_accepts(e):
    """--accept-fail of an Atlas "Approve anyway" line (data.accept_fail), which always carries
    the user's note: their words for the override."""
    gates = [str(g) for g in ((e.get("data") or {}).get("accept_fail") or [])]
    if gates and not (e.get("note") or "").strip():
        sys.exit("the Atlas approval accepts a failed gate but has no note: the user's words are required for it")
    return [x for g in gates for x in ("--accept-fail", g)]


def from_atlas(cmd, video, seg=None):
    """The Atlas line as this script's own arguments."""
    if cmd == "segment":
        e = atlas_line(video, ("take.approve", "take.reject"), seg)
        dd = e["data"]
        atlas_file(os.path.join(vdir(video), "segments", seg, dd.get("file") or ""), e, "the take")
        if e["kind"] == "take.approve":
            a = ["--decision", "approve", "--words", (e.get("note") or "").strip()
                 or f"Approve this take of {seg} (clicked in the Atlas)"]
            for k, v in (dd.get("checks") or {}).items():
                a += ["--check", f"{k}={v}"]
            a += atlas_accepts(e)
        else:
            a = ["--decision", "regenerate" if dd.get("decision") != "reject" else "reject",
                 "--words", e.get("note") or "", "--class", e.get("note") or ""]
            if dd.get("fix"):
                a += ["--fix", dd["fix"]]
        return a + ["--file", dd["file"], "--atlas-at", e["at"]]
    if cmd == "composite":
        e = atlas_line(video, ("composite.approve",), seg)
        dd = e["data"]
        atlas_file(os.path.join(vdir(video), "segments", seg, dd.get("file") or ""), e, "the composite")
        return ["--file", dd["file"], "--words", (e.get("note") or "").strip()
                or f"Approve the composite of {seg} (clicked in the Atlas)", "--atlas-at", e["at"]]
    if cmd == "final":
        e = atlas_line(video, ("cut.approve", "cut.sendback"))
        dd = e["data"]
        atlas_file(os.path.join(ROOT, dd.get("file") or ""), e, "the cut")
        if e["kind"] == "cut.sendback" and dd.get("segment"):
            return ["--decision", "regenerate", "--segment", dd["segment"], "--words", e.get("note") or "",
                    "--atlas-at", e["at"]] + (["--cost", str(dd["cost_usd"])] if dd.get("cost_usd") is not None else [])
        if e["kind"] == "cut.sendback":
            return ["--decision", "reject", "--words", e.get("note") or "", "--atlas-at", e["at"]]
        return ["--decision", "approve", "--words", (e.get("note") or "").strip() or "Approve the cut (clicked in the Atlas)",
                "--export", dd.get("export") or "default", "--atlas-at", e["at"]] + atlas_accepts(e)
    if cmd == "storyboard":
        e = atlas_line(video, ("storyboard.approve", "storyboard.sendback"))
        if e["kind"] == "storyboard.sendback":
            segs = (e.get("data") or {}).get("segments") or []
            return ["--decision", "redo", "--words", e.get("note") or "", "--atlas-at", e["at"]] + \
                (["--segments", ",".join(segs)] if segs else [])
        return ["--decision", "approve", "--words", (e.get("note") or "").strip()
                or f"Approve the storyboard and its computed cost, ${(e['data'].get('cost_usd') or 0):.2f} (clicked in the Atlas)",
                "--atlas-at", e["at"], "--keyframes", json.dumps(e["data"].get("keyframes") or {}),
                "--cost", str(e["data"].get("cost_usd"))]
    if cmd == "source":
        e = atlas_line(video, ("source.approve", "source.reject"), seg, key="asset_id")
        atlas_file(os.path.join(ROOT, (e.get("data") or {}).get("file") or ""), e, "the source")
        if e["kind"] == "source.reject":
            return ["--decision", "reject", "--words", e.get("note") or "", "--atlas-at", e["at"]]
        return ["--decision", "approve", "--words", (e.get("note") or "").strip()
                or f"Approve the source {seg} (clicked in the Atlas)", "--atlas-at", e["at"]]
    if cmd == "motion":
        e = atlas_line(video, ("motion.approve", "motion.reject"), seg)
        dd = e.get("data") or {}
        atlas_file(os.path.join(vdir(video), "segments", seg, dd.get("file") or "motion/render.mp4"), e, "the render")
        if e["kind"] == "motion.reject":
            return ["--decision", "reject", "--words", e.get("note") or "", "--atlas-at", e["at"]]
        a = ["--decision", "approve", "--words", (e.get("note") or "").strip()
             or f"Approve the motion design of {seg} (clicked in the Atlas)", "--atlas-at", e["at"]]
        for k, v in (dd.get("checks") or {}).items():
            a += ["--check", f"{k}={v}"]
        return a + atlas_accepts(e)
    if cmd == "narration":
        e = atlas_line(video, ("narration.approve", "narration.reject"), seg, key="take")
        dd = e.get("data") or {}
        atlas_file(os.path.join(vdir(video), dd.get("file") or ""), e, "the narration take")
        a = ["--narrator", dd.get("narrator") or "", "--lines", ",".join(dd.get("lines") or []), "--atlas-at", e["at"]]
        if e["kind"] == "narration.reject":
            return a + ["--decision", "reject", "--words", e.get("note") or ""]
        a += ["--decision", "approve", "--words", (e.get("note") or "").strip() or f"Approve the narration take {seg} (clicked in the Atlas)"]
        for k, v in (dd.get("checks") or {}).items():
            a += ["--check", f"{k}={v}"]
        return a + atlas_accepts(e)
    sys.exit(f"--from-atlas does not apply to {cmd}")


def keyframes_of(video):
    """{segment: sha256 of keyframes/<seg>.png} for every generated segment of this video that
    starts from a keyframe; a missing one is None. A motion-copy X on a route with no first
    frame (replace, guided) has none: the clip leads."""
    spec = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "models.json")))
    out = {}
    for s, t, name, proj in video_segments(video):
        if t not in GENERATED or not proj.startswith(video + "."):
            continue
        if t == "X" and motion_copy_of(video, name):
            sp = os.path.join(vdir(video), "shots", f"{name}.json")
            route = bridge.motion_route_name(bridge.motion_block(json.load(open(sp)) if os.path.exists(sp) else {}))
            if ((bridge.motion_spec(spec).get("routes") or {}).get(route) or {}).get("first_frame") != "keyframe":
                continue
        kf = os.path.join(vdir(video), "keyframes", f"{name}.png")
        out[name] = bridge.sha256_file(kf) if os.path.exists(kf) else None
    return out


def video_segments(video):
    p = os.path.join(vdir(video), "video.json")
    if not os.path.exists(p):
        return []
    out = []
    for s in json.load(open(p)).get("segments") or []:
        t = str(s.get("type", "")).upper()
        name = f"{int(s['n']):02d}-{t.lower()}"
        proj = s.get("project") or f"{video}.{name}"
        out.append((s, t, name, proj))
    return out


def project_dir(project):
    v, seg = project.rsplit(".", 1)
    return v, seg, os.path.join(CH, v, "segments", seg)


# ---------------------------------------------------------------- the ledger
def ledger_add(slug, failure, where, fix):
    if not os.path.exists(LEDGER):
        sys.exit("no pipeline/character/model-failures.md -- the installer writes it once; restore it from "
                 "the kit's template before recording a reject")
    lines = open(LEDGER).read().split("\n")
    head = f"## {slug}"
    row = f"| {failure.replace('|', '/')} | {today()} | {where} | {(fix or 'open').replace('|', '/')} |"
    if head not in lines:
        while lines and not lines[-1].strip():
            lines.pop()
        lines += ["", head, "", "| Failure | Date | Video and segment | Prompt change that fixed it |",
                  "|---|---|---|---|", row, ""]
    else:
        i = lines.index(head) + 1
        while i < len(lines) and not lines[i].startswith("|"):
            i += 1
        while i < len(lines) and lines[i].startswith("|"):
            i += 1
        lines.insert(i, row)
    open(LEDGER, "w").write("\n".join(lines))
    print(f"ledger: a row under '{head}': {failure}")


def ledger_fixed(where, fix):
    if not os.path.exists(LEDGER):
        return 0
    lines, n = open(LEDGER).read().split("\n"), 0
    for i, l in enumerate(lines):
        cells = [c.strip() for c in l.strip().strip("|").split("|")]
        if l.startswith("|") and len(cells) == 4 and cells[2] == where and cells[3] == "open":
            cells[3] = fix.replace("|", "/")
            lines[i] = "| " + " | ".join(cells) + " |"
            n += 1
    open(LEDGER, "w").write("\n".join(lines))
    if n:
        print(f"ledger: {n} open row(s) of {where} now say what fixed them")
    return n


# ---------------------------------------------------------------- state
def state_set(video, stage, status, note=""):
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "character", "state.py"), "set", video,
                    stage, status] + ([note] if note else []), capture_output=True)


def latest_source(d, asset_id):
    rows = [e for e in d.get("gate_b_sources") or [] if e.get("asset_id") == asset_id]
    return rows[-1] if rows else None


def latest_take(d, take):
    rows = [e for e in d.get("gate_b_narration") or [] if e.get("take") == take]
    return rows[-1] if rows else None


def motion_segments(video):
    """The segments whose beats are motion-designed (R or P, a phone's screen, an M panel): their
    render is approved at gate B."""
    p = os.path.join(vdir(video), "plan.json")
    if not os.path.exists(p):
        return []
    plan = json.load(open(p))
    import demo
    return [name for s, t, name, _ in video_segments(video)
            if demo.segment_story(plan, s.get("beat_ids") or [])]


def needs(video):
    """What gate B must approve before assembly: the generated segments (projects), the
    supplied assets and the narration takes that video.json uses (the motion-designed
    renders: motion_segments)."""
    projects, assets, takes = [], set(), set()
    for s, t, name, proj in video_segments(video):
        if t in GENERATED or (t == "C" and s.get("insert")):
            projects.append(proj)
        if t == "C" and s.get("asset_id"):
            assets.add(s["asset_id"])
        for p in s.get("panels") or []:
            if p.get("asset_id"):
                assets.add(p["asset_id"])
            if p.get("project"):
                projects.append(p["project"])
        af = s.get("audio_from") or ""
        if af.startswith("asset:"):
            assets.add(af[6:])
        elif af.startswith("narration:"):
            takes.add(af[10:])
    p = os.path.join(vdir(video), "plan.json")
    screens = {a.get("id") for a in (json.load(open(p)).get("assets") or [])
               if a.get("kind") == "screen"} if os.path.exists(p) else set()
    return projects, sorted(assets - screens), sorted(takes)


def update_review_state(video):
    d = load_approval(video)
    projects, assets, takes = needs(video)
    motions = motion_segments(video)
    if not projects and not assets and not takes and not motions:
        return
    approved = []
    for proj in projects:
        v, _, _ = project_dir(proj)
        e = latest(load_approval(v) if v != video else d, proj)
        approved.append(bool(e and e.get("decision") == "approve"))
    approved += [bool((latest_source(d, a) or {}).get("decision") == "approve") for a in assets]
    approved += [bool((latest_take(d, k) or {}).get("decision") == "approve") for k in takes]
    if motions:
        import motion_design
        approved += [motion_design.approved(video, m)[0] is not None for m in motions]
    if all(approved):
        state_set(video, "review", "done", f"{len(approved)} item(s) approved at gate B")
        print(f"every segment, source and take of {video} is approved: P3 done")
    else:
        state_set(video, "review", "running", f"{sum(approved)} of {len(approved)} approved")


# ---------------------------------------------------------------- commands
def cmd_segment(video, seg, a):
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "reject", "regenerate"):
        sys.exit("--decision approve | reject | regenerate")
    words = o.get("--words", "").strip()
    if dec == "approve" and not words:
        sys.exit("an approval needs the user's words (--words)")
    sdir = os.path.join(vdir(video), "segments", seg)
    f = o.get("--file")
    if not f:
        c = sorted(glob.glob(os.path.join(sdir, "generated", "*.mp4")), key=os.path.getmtime, reverse=True)
        if not c:
            sys.exit(f"no file in segments/{seg}/generated/")
        f = os.path.relpath(c[0], sdir)
    if not os.path.exists(os.path.join(sdir, f)):
        sys.exit(f"no {os.path.join('segments', seg, f)}")
    t = seg.split("-")[-1].upper()
    if dec in ("reject", "regenerate") and not o.get("--class"):
        print("note: no --class, so no ledger row; name the failure class for every reject")
    d = load_approval(video)
    entry = {"project": f"{video}.{seg}", "segment_type": t, "file": f, "decision": dec,
             "words": words or None, "date": today(), "model": o.get("--model") or model_slug(),
             "set_id": o.get("--set"), "failure_class": o.get("--class"), "fix": o.get("--fix"),
             "checks": dict(c.split("=", 1) for c in o.get("--check", []) if "=" in c)}
    if o.get("--atlas-at"):
        entry["atlas_line_at"] = o["--atlas-at"]
    entry["sha256"] = bridge.sha256_file(os.path.join(sdir, f))
    fr = motion_copy_of(video, seg) if t == "X" else None
    if fr and dec == "approve":
        sp = os.path.join(vdir(video), "shots", f"{seg}.json")
        shot = json.load(open(sp)) if os.path.exists(sp) else {}
        route = bridge.motion_route_name(bridge.motion_block(shot))
        need = MOTION_COPY_CHECKS + (GUIDED_CHECKS if route == "guided" else ())
        miss = [k for k in need if entry["checks"].get(k) != "pass"]
        if miss:
            sys.exit(f"a motion-copy reaction is approved with {' '.join(f'--check {k}=pass' for k in miss)}: "
                     "the face is the character's in every frame (identity), nothing of the original creator's "
                     "face, hair or identity remains (no_source_identity), and no voice is heard (silent)"
                     + ("; on the guided route the reaction follows the clip's expression beats in order and "
                        "time within the trimmed length (follows_reference)" if route == "guided" else ""))
        want = fr["end_s"] - fr["start_s"]
        got = bridge.probe(os.path.join(sdir, f))[0]
        if route == "guided":
            # A new clip of the template's length, trimmed to the clip's at assembly.
            gen = (shot.get("video") or {}).get("duration_seconds")
            if not got or got < want - 0.05 or (bridge.num(gen) and got > gen + 0.7):
                sys.exit(f"the file is {got or 0:.2f} s; the guided route generates {gen} s, at least the "
                         f"reference clip's {want:g} s, and is trimmed to it at assembly (length gate)")
        else:
            # A route with pad_to_s (motion: Kling takes 3 s or more) gets the clip held on its
            # last frame to that length; the take is that long and is trimmed to the clip at assembly.
            pad = ((bridge.motion_spec(json.load(open(os.path.join(ROOT, "scripts", "character", "models.json"))))
                    .get("routes") or {}).get(route) or {}).get("pad_to_s") or 0
            sent = max(want, pad)
            if not got or abs(got - sent) > 0.25:
                sys.exit(f"the file is {got or 0:.2f} s; the input clip is {sent:g} s"
                         + (f" (the {want:g} s reference held to {pad:g} s)" if pad > want else "")
                         + f" (length gate: the {route} route keeps the clip's timing)")
        entry["checks"]["length"] = "pass"
        # The identity gate (identity.py): the face is measured, not only looked at.
        try:
            import identity
            idr = identity.check(video, seg, f)
        except ImportError as e:
            sys.exit(f"the identity gate needs opencv ({e}): run review.py with .venv/bin/python3")
        # NO FACE: no frame shows a face, so nothing is measured and the eye check decides
        # (founder, 2026-10-19: a visible face is not a requirement of motion copy).
        acc = []
        if idr["result"] not in ("PASS", "NO FACE"):
            accept_fail(o, acc, "identity", idr["result"], idr.get("why"), words,
                        f"identity gate {idr['result']}: {idr.get('why')} (qc/identity-*.json). A face the take shows "
                        "is measured as not the character's")
        entry["checks"]["identity_gate"] = (f"accepted failure: {idr['result']}" if acc else
                                            "no face to measure: the eye check decides" if idr["result"] == "NO FACE"
                                            else f"pass: median {idr['median_character']} to the character, "
                                                 f"{idr['median_reference']} to the reference")
        left = text_on(os.path.join(sdir, f), os.path.join(sdir, os.path.dirname(f), "qc"))
        if left:
            accept_fail(o, acc, "ocr", "FAIL", str(left)[:200], words,
                        f"OCR reads text on the file: {left} -- a burned-in caption, handle or watermark of the "
                        "reference may be left (a trace of the original creator)")
        entry["checks"]["text_left"] = ("accepted: " + str(left)[:120]) if left else \
            "none" if left is not None else "not read (no OCR engine)"
        unused_accepts(o, acc)
        if acc:
            entry["accepted_failures"] = acc
        entry["motion_copy"] = {"ref_id": fr["id"], "post_id": fr.get("post_id"), "route": route}
    elif t == "X" and dec == "approve":
        miss = [k for k in REACTION_CHECKS if entry["checks"].get(k) != "pass"]
        if miss:
            sys.exit(f"a silent reaction is approved with {' '.join(f'--check {k}=pass' for k in miss)}: the face is the "
                     "character's (identity), the hands are whole, no mouth forms words and no voice is heard "
                     "(silent), and the reaction follows the written performance")
        sp = os.path.join(vdir(video), "shots", f"{seg}.json")
        sv = (json.load(open(sp)).get("video") or {}) if os.path.exists(sp) else {}
        want = sv.get("trim_to_seconds") if bridge.num(sv.get("trim_to_seconds")) else sv.get("duration_seconds")
        got = bridge.probe(os.path.join(sdir, f))[0]
        if not bridge.num(want) or not got or got < float(want) - 0.05:
            sys.exit(f"the file is {got or 0:.2f} s; the shot plans {want} s (duration gate)")
        entry["checks"]["duration"] = "pass"
    cprev = continuity.source_of(continuity.shot_of(video, seg))
    if cprev and dec == "approve":
        ok, why, info = continuity.state(video, seg)
        seed = os.path.join(sdir, os.path.splitext(f)[0] + ".seed.json")
        if not ok:
            sys.exit(f"{seg} continues from {cprev}: {why}")
        if not os.path.exists(seed):
            sys.exit(f"{seg} continues from {cprev}, but {os.path.relpath(seed, sdir)} is missing: generate.sh records the "
                     "frame each continuing take is seeded with. A take with no record is not approved as a continuation")
        sd_ = json.load(open(seed))
        if sd_.get("sha256") != info["sha256"]:
            sys.exit(f"{f} was seeded with another last frame of {cprev} (sha256 {str(sd_.get('sha256'))[:12]}, now "
                     f"{info['sha256'][:12]}): {cprev} was approved again after this take; regenerate {seg}")
        d_, _ = continuity.match(video, seg, os.path.join(sdir, f))
        entry["continuity"] = {"from": cprev, "last_frame": info["file"], "last_frame_sha256": info["sha256"]}
        entry["checks"]["seed_diff"] = d_
        print(f"continuity: the first frame of {f} differs from the last frame of {cprev} by {d_} (0 to 255)")
    gp = os.path.join(sdir, os.path.dirname(f), "qc", "gates.json")        # beside the plate
    if (t in PHONE or t == "C") and os.path.exists(gp):
        g = json.load(open(gp))
        entry["insert_gates"] = "pass" if g.get("pass") else "fail: " + ", ".join(
            r["gate"] for r in g["results"] if r["result"] != "PASS")
        if dec == "approve" and not g.get("pass"):
            print("warning: the plate's insertion gates did not all pass (qc/gates.json); approved on the user's word")
    d.setdefault("gate_b_segments", []).append(entry)
    save_approval(video, d)
    print(f"gate B: {video}.{seg} {dec} ({f})")
    where = f"{video} {seg}"
    if dec != "approve" and o.get("--class"):
        ledger_add(entry["model"] or "unknown model", o["--class"], where, o.get("--fix"))
    if dec == "approve" and o.get("--fixed-by"):
        ledger_fixed(where, o["--fixed-by"])
    if dec == "approve":
        # The next clip continues from this one: its first frame is this clip's last.
        for prev, nxt in continuity.continuing(video):
            if prev != seg:
                continue
            ok, msg = continuity.take(video, seg)
            print(("continuity: " if ok else "continuity: FAILED ") + msg + f" -- the first frame of {nxt}")
            e_n = latest(d, f"{video}.{nxt}")
            if ok and e_n and e_n.get("decision") == "approve" and (e_n.get("continuity") or {}).get(
                    "last_frame_sha256") != (continuity.state(video, nxt)[2] or {}).get("sha256"):
                print(f"warning: {nxt} was approved from another last frame of {seg}: regenerate {nxt}")
    update_review_state(video)


def motion_copy_of(video, seg):
    """The reaction_refs row of an X segment by motion copy, else None."""
    vp = os.path.join(vdir(video), "video.json")
    if not os.path.exists(vp):
        return None
    plan = plan_of(video)
    bmap = {b.get("id"): b for b in plan.get("beats") or []}
    for s in json.load(open(vp)).get("segments") or []:
        if f"{int(s.get('n')):02d}-{str(s.get('type', '')).lower()}" == seg:
            for b in s.get("beat_ids") or []:
                if b in bmap and "reaction" in bmap[b]:
                    return bridge.motion_copy_ref(plan, bmap[b])
    return None


def text_on(video_file, work, n=6):
    """The text OCR reads on n frames ({t: text} of the frames with text), {} when none,
    None when no OCR engine exists."""
    import ocr
    os.makedirs(work, exist_ok=True)
    d = bridge.probe(video_file)[0] or 0
    frames = []
    for i in range(n):
        t = d * (i + 0.5) / n
        fp = os.path.join(work, f"text-{i}.png")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.3f}", "-i", video_file, "-frames:v", "1", fp],
                       capture_output=True)
        frames.append((round(t, 2), fp))
    got = ocr.read([fp for _, fp in frames])
    if got is None:
        return None
    return {t: got[fp] for t, fp in frames if re.search(r"[A-Za-z0-9]{2,}", got.get(fp, ""))}


def plan_of(video):
    p = os.path.join(vdir(video), "plan.json")
    if not os.path.exists(p):
        sys.exit(f"no pipeline/character/{video}/plan.json")
    return json.load(open(p))


def cmd_source(video, asset_id, a):
    """Gate B for supplied media: the user approves this exact file (its checksum), its
    permission and its range. Supplied media has source checks, not the checks of a
    generated picture."""
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "reject"):
        sys.exit("--decision approve | reject")
    words = o.get("--words", "").strip()
    if not words:
        sys.exit("a source decision needs the user's words (--words)")
    plan = plan_of(video)
    asset = next((x for x in plan.get("assets") or [] if x.get("id") == asset_id), None)
    if not asset:
        sys.exit(f"{asset_id} is not in the plan's assets[]")
    fp = os.path.join(ROOT, asset.get("path") or "-")
    checks, problems = {}, []
    if not os.path.exists(fp):
        sys.exit(f"no {asset.get('path')}")
    sha = bridge.sha256_file(fp)
    checks["checksum"] = "pass" if sha == asset.get("sha256") else "fail"
    if checks["checksum"] == "fail":
        problems.append("the file does not match the plan's sha256: it changed after the plan was locked")
    if asset.get("origin") in bridge.NEEDS_PERMISSION:
        checks["permission"] = "pass" if not bridge.placeholder(asset.get("permission_ref")) else "fail"
        if checks["permission"] == "fail":
            problems.append(f"origin {asset.get('origin')} has no permission_ref")
    dur, hv, ha = bridge.probe(fp)
    trim = asset.get("trim_s")
    if trim and dur:
        checks["range"] = "pass" if trim[1] <= dur + 0.05 else "fail"
        if checks["range"] == "fail":
            problems.append(f"trim_s ends at {trim[1]} s; the file is {dur:.2f} s")
    checks["streams"] = ("picture" if hv else "") + (" sound" if ha else "")
    for c in o.get("--check", []):
        if "=" in c:
            k, v = c.split("=", 1)
            checks[k] = v
    if dec == "approve" and problems:
        sys.exit("cannot approve:\n  " + "\n  ".join(problems))
    d = load_approval(video)
    d.setdefault("gate_b_sources", []).append({
        "asset_id": asset_id, "kind": asset.get("kind"), "origin": asset.get("origin"),
        "file": asset.get("path"), "sha256": sha, "trim_s": trim, "decision": dec,
        "words": words, "date": today(), "checks": checks,
        **({"atlas_line_at": o["--atlas-at"]} if o.get("--atlas-at") else {})})
    save_approval(video, d)
    print(f"gate B source: {asset_id} {dec} ({asset.get('path')}, sha256 {sha[:12]})")
    update_review_state(video)


def cmd_motion(video, seg, a):
    """Gate B for a motion-designed screen: the user approves this exact render (its sha256)
    after every gate of motion_design.py check passed. It is the app's real screens rebuilt in
    code, never a video model's picture; a gate the machine could not run (OCR) is the user's
    eye check, given as --check text=pass or hero=pass."""
    import motion_design
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "reject"):
        sys.exit("--decision approve | reject")
    words = o.get("--words", "").strip()
    if not words:
        sys.exit("a motion-design decision needs the user's words (--words)")
    plan, s, st = motion_design.story_of(video, seg)
    sha, g, _ = motion_design.state(video, seg)
    if not sha:
        sys.exit(f"no segments/{seg}/motion/render.mp4: motion_design.py render {video} {seg}")
    eye = {}
    for c in o.get("--check", []):
        if "=" in c:
            k, v = c.split("=", 1)
            eye[k] = v
    checks, acc = {}, []
    if dec == "approve":
        if not g:
            sys.exit(f"no gates for this render: motion_design.py check {video} {seg}")
        for r in g["results"]:
            checks[r["gate"]] = r["result"].lower().replace(" ", "_")
            if r["result"] == "FAIL" and r["gate"] == "current":
                sys.exit(f"cannot approve: the render is not of the page, the assets and the story now ({r['detail']}); "
                         "render and check again (a stale render is never approved)")
            if r["result"] == "FAIL":
                accept_fail(o, acc, r["gate"], "FAIL", r.get("detail"), words,
                            f"cannot approve: the gate {r['gate']} failed ({r.get('detail')}); change the page, render "
                            "and check again")
            elif r["result"] == "NOT RUN":
                k = {"text_read": "text", "hero": "hero"}.get(r["gate"], r["gate"])
                if eye.get(k) != "pass":
                    accept_fail(o, acc, r["gate"], "NOT RUN", r.get("detail"), words,
                                f"cannot approve: {r['gate']} was not run ({r['detail']}); the user reads the stills "
                                f"and says so: --check {k}=pass")
        unused_accepts(o, acc)
    checks.update(eye)
    d = load_approval(video)
    d.setdefault("gate_b_motion", []).append({
        "segment": seg, "screen_id": st.get("screen_id"), "file": "motion/render.mp4", "sha256": sha,
        "story_sha256": motion_design.sha256_json(st), "decision": dec, "words": words, "date": today(),
        "checks": checks, "hero": (g or {}).get("hero"), **({"accepted_failures": acc} if acc else {}),
        **({"atlas_line_at": o["--atlas-at"]} if o.get("--atlas-at") else {})})
    save_approval(video, d)
    print(f"gate B motion design: {seg} {dec} (motion/render.mp4, sha256 {sha[:12]})"
          + (f", approved anyway: {', '.join(r['gate'] for r in acc)}" if acc else ""))
    update_review_state(video)


def cmd_narration(video, take, a):
    """Gate B for one take of a narrator: the voice of an original synthetic narrator (or
    the user's own recorded take), made outside the kit from the approved narrator voice.
    The kit has no voice generator and computes no cost for it."""
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "reject"):
        sys.exit("--decision approve | reject")
    words = o.get("--words", "").strip()
    if not words:
        sys.exit("a narration decision needs the user's words (--words)")
    plan = plan_of(video)
    nid = o.get("--narrator")
    nar = next((n for n in plan.get("narrators") or [] if n.get("id") == nid), None)
    if not nar:
        sys.exit(f"--narrator {nid!r} is not in the plan's narrators[]")
    if nar.get("kind") != "original_synthetic":
        sys.exit(f"{nid} is a {nar.get('kind')} narrator: a character's voice is her approved performance "
                 "(audio_from <video>.<seg>); a supplied speaker's is a supplied asset (review.py source)")
    files = [f for f in glob.glob(os.path.join(vdir(video), "narration", f"{take}.*")) if f.endswith(AUDIO_EXT)]
    if not files:
        sys.exit(f"no narration/{take}.wav (or .mp3) in pipeline/character/{video}/")
    lines = [x.strip() for x in o.get("--lines", "").split(",") if x.strip()]
    beats = plan.get("beats") or []
    allowed = {l for b in beats if b.get("performance") == "voiceover" and bridge.beat_narrator(plan, b) == nid
               for l in b.get("lines") or []}
    if not lines or set(lines) - allowed:
        sys.exit(f"--lines names the voiceover lines of {nid}: {', '.join(sorted(allowed)) or 'none in the plan'}")
    checks = dict(c.split("=", 1) for c in o.get("--check", []) if "=" in c)
    acc = []
    if dec == "approve" and checks.get("natural_voice") != "pass":
        accept_fail(o, acc, "voice", checks.get("natural_voice") or "not passed", None, words,
                    "a synthetic narrator's take is approved after the natural-voice check: natural breaths, "
                    "varied pauses, no 2 s window under 5 semitones (qc.py - - <take>), room sound, no flat TTS "
                    "cadence; record it with --check natural_voice=pass")
    if dec == "approve":
        unused_accepts(o, acc)
    d = load_approval(video)
    d.setdefault("gate_b_narration", []).append({
        "take": take, "file": os.path.relpath(files[0], vdir(video)), "sha256": bridge.sha256_file(files[0]),
        "narrator": nid, "voice_ref": nar.get("voice_ref"), "lines": lines, "decision": dec,
        "words": words, "date": today(), "checks": checks, **({"accepted_failures": acc} if acc else {}),
        **({"atlas_line_at": o["--atlas-at"]} if o.get("--atlas-at") else {})})
    save_approval(video, d)
    print(f"gate B narration: {take} ({nid}, {', '.join(lines)}) {dec}")
    update_review_state(video)


def cmd_composite(video, seg, a):
    o = opts(a)
    words, f = o.get("--words", "").strip(), o.get("--file")
    if not words or not f:
        sys.exit("--file composite/<x>.mp4 and --words are both needed")
    sdir = os.path.join(vdir(video), "segments", seg)
    if not os.path.exists(os.path.join(sdir, f)):
        sys.exit(f"no {os.path.join('segments', seg, f)}")
    d = load_approval(video)
    e = latest(d, f"{video}.{seg}")
    if not e or e.get("decision") != "approve":
        sys.exit(f"{video}.{seg} has no approved plate at gate B; approve the plate first")
    gp = os.path.join(sdir, "composite", "qc", "gates.json")
    g = json.load(open(gp)) if os.path.exists(gp) else None
    if g is None:
        sys.exit("no composite/qc/gates.json -- run scripts/character/composite.sh first")
    if os.path.basename(g.get("file", "")) != os.path.basename(f):
        sys.exit("the gates in composite/qc/gates.json are for another file; run qc.py --composite on this one")
    failed = [r["gate"] for r in g["results"] if r["result"] != "PASS"]
    e["composite"] = {"file": f, "gates": "pass" if not failed else "fail: " + ", ".join(failed),
                      "hero": g.get("hero"), "words": words, "date": today(),
                      "sha256": bridge.sha256_file(os.path.join(sdir, f))}
    if o.get("--atlas-at"):
        e["composite"]["atlas_line_at"] = o["--atlas-at"]
    save_approval(video, d)
    if failed:
        print(f"warning: gates not passed ({', '.join(failed)}); recorded on the user's word")
    print(f"composite of {video}.{seg}: {f}")
    if all(latest(d, p) and latest(d, p).get("composite") for s, t, _, p in video_segments(video)
           if (t in PHONE or (t == "C" and s.get("insert"))) and p.startswith(video + ".")):
        state_set(video, "composite", "done")


def cmd_final(video, a):
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "reject", "regenerate"):
        sys.exit("--decision approve | reject | regenerate")
    words = o.get("--words", "").strip()
    if not words:
        sys.exit("gate C needs the user's words, quoted (--words)")
    man = os.path.join(vdir(video), "assembly", "assembly.json")
    if not os.path.exists(man):
        sys.exit("no assembly/assembly.json -- run scripts/character/assemble.sh first")
    m = json.load(open(man))
    plan = plan_of(video)
    acc = []
    if dec == "approve" and bridge.is_v2(plan):
        if m.get("plan_sha256") != bridge.digest(plan):
            sys.exit("the file was assembled from another revision of the plan: assemble again before gate C")
        # Integrity, never accepted: the overlays are not the plan's, or a supplied file changed.
        failed = [k for k, c in (m.get("checks") or {}).items() if k in INTEGRITY_CUT and c.get("result") == "FAIL"]
        if failed:
            sys.exit(f"cannot approve: {', '.join(failed)} failed on the final file (assembly.json): the cut is not "
                     "the plan's; assemble again")
        failed = [k for k, c in (m.get("checks") or {}).items()
                  if k.startswith("overlays") and k not in INTEGRITY_CUT and c.get("result") == "FAIL"]
        if failed:
            accept_fail(o, acc, "overlays", "FAIL", ", ".join(failed), words,
                        f"cannot approve: {', '.join(failed)} failed on the final file (assembly.json)")
    if dec == "approve":
        unused_accepts(o, acc)
    d = load_approval(video)
    g = d.get("gate_c_final") or {}
    g.update({"decision": dec if dec != "regenerate" else f"regenerate segment {o.get('--segment', '?')}",
              "words": words, "date": today(), "file": m.get("file"),
              "export_choice": o.get("--export", "default"),
              "final_checks": m.get("checks"), "accepted_failures": acc or None,
              "sha256": bridge.sha256_file(os.path.join(ROOT, m["file"])) if m.get("file") and os.path.exists(os.path.join(ROOT, m["file"])) else None,
              "atlas_line_at": o.get("--atlas-at")})
    if dec == "regenerate" and o.get("--cost") not in (None, "None"):
        g["regenerate_cost_usd"] = float(o["--cost"])
    for c in o.get("--check", []):
        if "=" in c:
            k, v = c.split("=", 1)
            g[k] = v
    d["gate_c_final"] = g
    save_approval(video, d)
    print(f"gate C: {video} {g['decision']}")


def cmd_storyboard(video, a):
    """Gate A: the user's decision on the storyboard. An approval pins every keyframe by its
    sha256 (generate.sh runs a motion-copy X only from that very keyframe) and records the
    computed cost the user approved for the first runs. The checks the agent made at gate A
    (character-shots) stay in the record."""
    o = opts(a)
    dec = o.get("--decision")
    if dec not in ("approve", "redo"):
        sys.exit("--decision approve | redo")
    words = o.get("--words", "").strip()
    if not words:
        sys.exit("gate A needs the user's words (--words)")
    have = keyframes_of(video)
    if dec == "approve":
        missing = [k for k, v in have.items() if not v]
        if missing:
            sys.exit(f"no keyframe yet for {', '.join(missing)}: make it (keyframes.sh) before gate A")
        if o.get("--keyframes") is not None:
            want = json.loads(o["--keyframes"])
            moved = [k for k, v in have.items() if want.get(k) != v]
            if moved:
                sys.exit(f"keyframe(s) {', '.join(moved)} changed after the click: show the storyboard again")
    d = load_approval(video)
    g = d.get("gate_a_storyboard") or {}
    g.update({"decision": "approve" if dec == "approve" else f"redo: {words}", "words": words, "date": today()})
    if dec == "redo":
        g["redo_segments"] = [s for s in (o.get("--segments") or "").split(",") if s] or None
    if dec == "approve":
        g["keyframes_sha256"] = {k: v for k, v in have.items() if v}
        if o.get("--cost") not in (None, "None"):
            g["cost_usd"] = float(o["--cost"])
    if o.get("--atlas-at"):
        g["approved_in"] = {"atlas_line_at": o["--atlas-at"]}
    d["gate_a_storyboard"] = g
    save_approval(video, d)
    if dec == "approve":
        state_set(video, "shots", "done", "storyboard approved")
    print(f"gate A: {video} {g['decision']} ({len(g.get('keyframes_sha256') or {})} keyframe(s) pinned)")


def cmd_show(video):
    d = load_approval(video)
    ga = d.get("gate_a_storyboard") or {}
    print(f"{video}: gate A {ga.get('decision') or 'not yet'}")
    for s, t, name, proj in video_segments(video):
        if t == "C":
            e = latest_source(d, s.get("asset_id"))
            print(f"  {name:<8} C  supplied {s.get('asset_id')}: "
                  + (f"{e['decision']} {e['date']}" if e else "source not reviewed"))
            if not s.get("insert"):
                continue
        elif t == "M":
            print(f"  {name:<8} M  panels {', '.join(str(p.get('id')) for p in s.get('panels') or [])}")
            if name not in motion_segments(video):
                continue
        if name in motion_segments(video):
            import motion_design
            sha, g, e = motion_design.state(video, name)
            print(f"  {name:<8} {t}  motion design: " + ("not rendered" if not sha else
                  ("rendered, " + ("checked" if g else "not checked") + "; " +
                   (f"{e['decision']} {e['date']}" + ("" if e.get("sha256") == sha else " (another render)")
                    if e else "not reviewed"))))
            if t in ("R", "P", "M"):
                continue
        if t not in GENERATED:
            print(f"  {name:<8} {t}  not generated (built at assembly)")
            continue
        v, seg, sd = project_dir(proj)
        e = latest(load_approval(v) if v != video else d, proj)
        files = len(glob.glob(os.path.join(sd, "generated", "*.mp4")))
        state = (e["decision"] + (f" {e['file']}" if e else "")) if e else "not reviewed"
        comp = ""
        if t in PHONE:
            comp = "   composite: " + (e["composite"]["file"] if e and e.get("composite") else "not yet")
        shared = f"  (shared, {proj})" if v != video else ""
        print(f"  {name:<8} {t}  {files} generated   {state}{comp}{shared}")
    for e in d.get("gate_b_narration") or []:
        print(f"  narration {e['take']}  {e['narrator']}  {', '.join(e.get('lines') or [])}  {e['decision']}")
    gc = d.get("gate_c_final") or {}
    print(f"gate C: {gc.get('decision') or 'not yet'}")


# The command that records each kind of Atlas line, by what the line names.
RECORDS = {
    "storyboard.approve": "storyboard", "storyboard.sendback": "storyboard",
    "take.approve": "segment", "take.reject": "segment",
    "composite.approve": "composite", "composite.sendback": None,
    "cut.approve": "final", "cut.sendback": "final",
    "source.approve": "source", "source.reject": "source",
    "narration.approve": "narration", "narration.reject": "narration",
    "motion.approve": "motion", "motion.reject": "motion",
}


def recorded(video, e, d):
    """Whether approval.json records this user line: a row of its gate, written after the click
    (atlas_line_at, or a date on or after the click's)."""
    k, dd, at = e["kind"], e.get("data") or {}, e.get("at", "")

    def after(row):
        return bool(row) and (row.get("atlas_line_at") == at or str(row.get("date") or "") >= at[:10])
    if k.startswith("storyboard."):
        g = d.get("gate_a_storyboard") or {}
        ok = g.get("decision") == "approve" if k.endswith("approve") else str(g.get("decision", "")).startswith("redo")
        return ok and ((g.get("approved_in") or {}).get("atlas_line_at") == at or str(g.get("date") or "") >= at[:10])
    if k.startswith("take."):
        r = latest(d, f"{video}.{dd.get('segment')}")
        return after(r) and r.get("file") == dd.get("file") and (r.get("decision") == "approve") == (k == "take.approve")
    if k == "composite.approve":
        r = latest(d, f"{video}.{dd.get('segment')}") or {}
        return after(r.get("composite")) and (r.get("composite") or {}).get("file") == dd.get("file")
    if k.startswith("cut."):
        g = d.get("gate_c_final") or {}
        return after(g) and g.get("file") == dd.get("file") and (g.get("decision") == "approve") == (k == "cut.approve")
    if k.startswith("source."):
        r = latest_source(d, dd.get("asset_id"))
        return after(r) and (r.get("decision") == "approve") == (k == "source.approve")
    if k.startswith("narration."):
        r = latest_take(d, dd.get("take"))
        return after(r) and (r.get("decision") == "approve") == (k == "narration.approve")
    if k.startswith("motion."):
        rows = [x for x in d.get("gate_b_motion") or [] if x.get("segment") == dd.get("segment")]
        r = rows[-1] if rows else None
        return after(r) and (r.get("decision") == "approve") == (k == "motion.approve")
    return True


def cmd_pending(only=None):
    """Every user line in the Atlas that no file records yet, newest last, with the command
    that records it. Read only."""
    videos = [only] if only else sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(CH, "*", "plan.json")))
    n = 0
    for video in videos:
        if not os.path.exists(os.path.join(vdir(video), "plan.json")):
            sys.exit(f"no pipeline/character/{video}/plan.json")
        app, lines = log_lines(video)
        d = load_approval(video)
        last = {}
        for e in lines:
            dd = e.get("data") or {}
            if e.get("actor") or dd.get("video") != video or e.get("kind") not in RECORDS:
                continue
            k = e["kind"].split(".")[0]
            last[(k, dd.get("segment") or dd.get("asset_id") or dd.get("take"))] = e
        for (k, what), e in sorted(last.items(), key=lambda x: x[1].get("at", "")):
            if recorded(video, e, d):
                continue
            cmd = RECORDS[e["kind"]]
            n += 1
            note = f' — "{e["note"]}"' if e.get("note") else ""
            if cmd is None:
                print(f"{video}  {e['at'][:16]}  {e['kind']} {what}{note}\n"
                      f"    scripts/character/state.py note {video} \"{what} composite: {e.get('note') or ''}\", then composite.sh")
                continue
            arg = f" {what}" if cmd in ("segment", "composite", "source", "narration", "motion") else ""
            print(f"{video}  {e['at'][:16]}  {e['kind']}{' ' + what if what else ''}{note}\n"
                  f"    .venv/bin/python3 scripts/character/review.py {cmd} {video}{arg} --from-atlas")
    if not n:
        print("no Atlas click waits to be recorded" + (f" for {only}" if only else ""))


def cmd_rates():
    by_t, by_set = {}, {}
    for p in glob.glob(os.path.join(CH, "*", "approval.json")):
        for e in json.load(open(p)).get("gate_b_segments") or []:
            t = e.get("segment_type") or e.get("project", "x-x").split("-")[-1].upper()
            k = 1 if e.get("decision") == "approve" else 0
            by_t.setdefault(t, []).append(k)
            if e.get("set_id"):
                by_set.setdefault(e["set_id"], []).append(k)
    if not by_t:
        print("no gate B decision yet")
        return
    print("keep rate per segment type (measured; planning value in brackets)")
    for t, v in sorted(by_t.items()):
        r = 100 * sum(v) / len(v)
        stop = "   STOP: under 40% after 10 -- change the prompt, the set or the model" if len(v) >= 10 and r < 40 else ""
        print(f"  {t}  {sum(v)}/{len(v)} kept = {r:.0f}%  [{PLANNED.get(t, '-')}%]{stop}")
    if by_set:
        print("usable rate per set (write it into the handle's world.json)")
        for s, v in sorted(by_set.items()):
            print(f"  {s:<20} {sum(v)}/{len(v)} = {100 * sum(v) / len(v):.0f}%")


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    c = a[0]
    if "--from-atlas" in a:
        a = [x for x in a if x != "--from-atlas"]
        if c in ("segment", "composite", "source", "narration", "motion") and len(a) >= 3:
            a = a[:3] + from_atlas(c, a[1], a[2]) + a[3:]
        elif c in ("final", "storyboard") and len(a) >= 2:
            a = a[:2] + from_atlas(c, a[1]) + a[2:]
        else:
            sys.exit(__doc__)
    if c == "segment" and len(a) >= 3:
        cmd_segment(a[1], a[2], a[3:])
    elif c == "composite" and len(a) >= 3:
        cmd_composite(a[1], a[2], a[3:])
    elif c == "final" and len(a) >= 2:
        cmd_final(a[1], a[2:])
    elif c == "source" and len(a) >= 3:
        cmd_source(a[1], a[2], a[3:])
    elif c == "narration" and len(a) >= 3:
        cmd_narration(a[1], a[2], a[3:])
    elif c == "motion" and len(a) >= 3:
        cmd_motion(a[1], a[2], a[3:])
    elif c == "storyboard" and len(a) >= 2:
        cmd_storyboard(a[1], a[2:])
    elif c == "pending" and len(a) <= 2:
        cmd_pending(a[1] if len(a) == 2 else None)
    elif c == "show" and len(a) == 2:
        cmd_show(a[1])
    elif c == "rates":
        cmd_rates()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
