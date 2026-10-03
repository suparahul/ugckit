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
    review.py show <video>          every segment: generated, approved, composited
    review.py rates                 the keep rate per segment type and per set, from every video

Writes pipeline/character/<video>/approval.json. A reject or a regenerate with --class
adds a row to the model's table in pipeline/character/model-failures.md (the user's file;
the table is made at the model's first reject); --fixed-by on a later approve fills the
"Prompt change that fixed it" column of that segment's open rows. Nothing is approved
without the user's words. Gate C refuses an approval when the file is stale (the plan
changed after assembly) or its overlays are not the plan's. An X segment in face-replace
mode is approved only with --check identity=pass, no_source_identity=pass and silent=pass,
a length within 0.25 s of its reference clip, and no text read by OCR. An X segment by the
written route (a silent reaction) is approved only with --check identity=pass, hands=pass, silent=pass and
performance=pass, and only when the file is as long as the shot plans.
"""
import glob, json, os, re, subprocess, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bridge

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "pipeline", "character")
LEDGER = os.path.join(CH, "model-failures.md")
GENERATED = ("T", "O", "G", "S", "H", "F", "B", "X")
# X, a silent reaction: approved only with these checks passed by eye, and its length
# measured against the shot's planned length.
REACTION_CHECKS = ("identity", "hands", "silent", "performance")
# X in face-replace mode (founder, 2026-10-04): the motion is the reference clip's, so the
# checks are the face: the character's identity, and no trace of the original creator
# (face, hair, identity marks, a handle or watermark); silent; the clip's length; and OCR
# reads no text on the file.
FACE_REPLACE_CHECKS = ("identity", "no_source_identity", "silent")
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


def opts(a, multi=("--check",)):
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


def model_slug():
    st = os.path.join(CH, "state.json")
    if os.path.exists(st):
        return (json.load(open(st)).get("model") or {}).get("slug")
    return None


def latest(d, project):
    rows = [e for e in d.get("gate_b_segments") or [] if e.get("project") == project]
    return rows[-1] if rows else None


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


def needs(video):
    """What gate B must approve before assembly: the generated segments (projects), the
    supplied assets and the narration takes that video.json uses."""
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
    if not projects and not assets and not takes:
        return
    approved = []
    for proj in projects:
        v, _, _ = project_dir(proj)
        e = latest(load_approval(v) if v != video else d, proj)
        approved.append(bool(e and e.get("decision") == "approve"))
    approved += [bool((latest_source(d, a) or {}).get("decision") == "approve") for a in assets]
    approved += [bool((latest_take(d, k) or {}).get("decision") == "approve") for k in takes]
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
    fr = face_replace_of(video, seg) if t == "X" else None
    if fr and dec == "approve":
        miss = [k for k in FACE_REPLACE_CHECKS if entry["checks"].get(k) != "pass"]
        if miss:
            sys.exit(f"a face-replace reaction is approved with {' '.join(f'--check {k}=pass' for k in miss)}: "
                     "the face is the character's in every frame (identity), nothing of the original creator's "
                     "face, hair or identity remains (no_source_identity), and no voice is heard (silent)")
        want = fr["end_s"] - fr["start_s"]
        got = bridge.probe(os.path.join(sdir, f))[0]
        if not got or abs(got - want) > 0.25:
            sys.exit(f"the file is {got or 0:.2f} s; the reference clip is {want:g} s (length gate: the face "
                     "replace keeps the clip's timing)")
        entry["checks"]["length"] = "pass"
        left = text_on(os.path.join(sdir, f), os.path.join(sdir, os.path.dirname(f), "qc"))
        if left:
            sys.exit(f"OCR reads text on the file: {left} -- a burned-in caption, handle or watermark of the "
                     "reference is left (a trace of the original creator)")
        entry["checks"]["text_left"] = "none" if left is not None else "not read (no OCR engine)"
        entry["face_replace"] = {"ref_id": fr["id"], "post_id": fr.get("post_id")}
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
    update_review_state(video)


def face_replace_of(video, seg):
    """The reaction_refs row of an X segment in face-replace mode, else None."""
    vp = os.path.join(vdir(video), "video.json")
    if not os.path.exists(vp):
        return None
    plan = plan_of(video)
    bmap = {b.get("id"): b for b in plan.get("beats") or []}
    for s in json.load(open(vp)).get("segments") or []:
        if f"{int(s.get('n')):02d}-{str(s.get('type', '')).lower()}" == seg:
            for b in s.get("beat_ids") or []:
                if b in bmap and "reaction" in bmap[b]:
                    return bridge.face_replace_ref(plan, bmap[b])
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
        "words": words, "date": today(), "checks": checks})
    save_approval(video, d)
    print(f"gate B source: {asset_id} {dec} ({asset.get('path')}, sha256 {sha[:12]})")
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
    if dec == "approve" and checks.get("natural_voice") != "pass":
        sys.exit("a synthetic narrator's take is approved only after the natural-voice check: natural breaths, "
                 "varied pauses, no 2 s window under 5 semitones (qc.py - - <take>), room sound, no flat TTS "
                 "cadence; record it with --check natural_voice=pass")
    d = load_approval(video)
    d.setdefault("gate_b_narration", []).append({
        "take": take, "file": os.path.relpath(files[0], vdir(video)), "sha256": bridge.sha256_file(files[0]),
        "narrator": nid, "voice_ref": nar.get("voice_ref"), "lines": lines, "decision": dec,
        "words": words, "date": today(), "checks": checks})
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
                      "hero": g.get("hero"), "words": words, "date": today()}
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
    if dec == "approve" and bridge.is_v2(plan):
        if m.get("plan_sha256") != bridge.digest(plan):
            sys.exit("the file was assembled from another revision of the plan: assemble again before gate C")
        failed = [k for k, c in (m.get("checks") or {}).items()
                  if k.startswith(("overlays", "supplied")) and c.get("result") == "FAIL"]
        if failed:
            sys.exit(f"cannot approve: {', '.join(failed)} failed on the final file (assembly.json)")
    d = load_approval(video)
    g = d.get("gate_c_final") or {}
    g.update({"decision": dec if dec != "regenerate" else f"regenerate segment {o.get('--segment', '?')}",
              "words": words, "date": today(), "file": m.get("file"),
              "export_choice": o.get("--export", "default"),
              "final_checks": m.get("checks")})
    for c in o.get("--check", []):
        if "=" in c:
            k, v = c.split("=", 1)
            g[k] = v
    d["gate_c_final"] = g
    save_approval(video, d)
    print(f"gate C: {video} {g['decision']}")


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
            continue
        elif t not in GENERATED:
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
    elif c == "show" and len(a) == 2:
        cmd_show(a[1])
    elif c == "rates":
        cmd_rates()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
