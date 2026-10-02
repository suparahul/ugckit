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
    review.py show <video>          every segment: generated, approved, composited
    review.py rates                 the keep rate per segment type and per set, from every video

Writes pipeline/character/<video>/approval.json. A reject or a regenerate with --class
adds a row to the model's table in pipeline/character/model-failures.md (the user's file;
the table is made at the model's first reject); --fixed-by on a later approve fills the
"Prompt change that fixed it" column of that segment's open rows. Nothing is approved
without the user's words.
"""
import glob, json, os, re, subprocess, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "pipeline", "character")
LEDGER = os.path.join(CH, "model-failures.md")
GENERATED = ("T", "O", "G", "S", "H", "F")
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


def update_review_state(video):
    d = load_approval(video)
    segs = [x for x in video_segments(video) if x[1] in GENERATED]
    if not segs:
        return
    approved = []
    for s, t, name, proj in segs:
        v, _, _ = project_dir(proj)
        e = latest(load_approval(v) if v != video else d, proj)
        approved.append(bool(e and e.get("decision") == "approve"))
    if all(approved):
        state_set(video, "review", "done", f"{len(segs)} segment(s) approved at gate B")
        print(f"every generated segment of {video} is approved: P3 done")
    else:
        state_set(video, "review", "running", f"{sum(approved)} of {len(segs)} approved")


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
    gp = os.path.join(sdir, "generated", "qc", "gates.json")
    if t in PHONE and os.path.exists(gp):
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
    if all(latest(d, p) and latest(d, p).get("composite") for _, t, _, p in video_segments(video)
           if t in PHONE and p.startswith(video + ".")):
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
    elif c == "show" and len(a) == 2:
        cmd_show(a[1])
    elif c == "rates":
        cmd_rates()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
