#!/usr/bin/env python3
"""Clip-to-clip continuity of the character pipeline. Free, local; no generation.

    continuity.py last-frame <video> <seg>   the last frame of <seg>'s file approved at gate B:
                                            segments/<seg>/last-frame.png and last-frame.json (its
                                            checksum, the approved file's checksum, the frame's
                                            time and the cut). review.py runs it on an approval
                                            when the next segment continues from <seg>.
    continuity.py check <video>              every continuing shot: the previous clip approved, its
                                            last frame taken from that file at that cut, and
                                            nothing changed since
    continuity.py match <video> <seg> <file>  how close the first frame of a continuing take is to
                                            the frame that seeded it (mean difference, 0 to 255)

A shot continues from the segment right before it in video.json: "continuity": {"from":
"<nn>-<type>"}. shots.py refs puts that clip's last frame (kind neighbour-frame) in the
keyframe's place, first; generate.sh sends it through the model's continuity input
(models.json known_model_limits.<model>.continuity) and records the frame it sent beside the
take (<take>.seed.json); review.py approves a continuing take only when that frame is the
current one; assemble.py cuts the previous clip at that frame and drops the first frame of
the continuing clip, so no frame shows twice at the cut.

Only T, B and X by the written route continue or are continued: a phone plate (O, G, S, H,
F) gets the app at P4, supplied media (C) is never conditioning, M, R and P are not
generated, and a face-replace X is made of its reference clip's frames. Exit 1 when a check
fails.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bridge

ROOT = os.path.dirname(os.path.dirname(HERE))
CH = os.path.join(ROOT, "pipeline", "character")
CONTINUES = ("T", "B", "X")
FRAME, INFO = "last-frame.png", "last-frame.json"
MATCH_SIZE = (108, 192)          # the match is measured on small grey copies


def load(p):
    with open(p) as f:
        return json.load(f)


def vdir(video):
    return os.path.join(CH, video)


def seg_name(s):
    return f"{int(s['n']):02d}-{str(s.get('type', '')).lower()}"


def segments(video):
    """{name: segment} of video.json, in order."""
    p = os.path.join(vdir(video), "video.json")
    return {seg_name(s): s for s in (load(p).get("segments") or [])} if os.path.exists(p) else {}


def shot_of(video, name):
    p = os.path.join(vdir(video), "shots", f"{name}.json")
    return load(p) if os.path.exists(p) else {}


def source_of(shot):
    """The segment a shot continues from, or None."""
    c = shot.get("continuity")
    return c.get("from") if isinstance(c, dict) else None


def project_of(video, name, segs=None):
    s = (segs if segs is not None else segments(video)).get(name) or {}
    return s.get("project") or f"{video}.{name}"


def segment_dir(project):
    v, seg = project.rsplit(".", 1)
    return os.path.join(CH, v, "segments", seg)


def frame_rel(video, name):
    """The workspace path of the last frame of segment `name` (in its project's folder)."""
    return os.path.relpath(os.path.join(segment_dir(project_of(video, name)), FRAME), ROOT)


def approved_entry(project):
    """The latest gate B row of a project when it is an approval, else None."""
    v = project.rsplit(".", 1)[0]
    ap = os.path.join(CH, v, "approval.json")
    rows = [e for e in (load(ap).get("gate_b_segments") or []) if e.get("project") == project] \
        if os.path.exists(ap) else []
    return rows[-1] if rows and rows[-1].get("decision") == "approve" else None


def frames(path):
    """[(t, duration)] of every video frame of a file, in display order, by ffprobe. t is
    from the first frame, as ffmpeg's -ss and -to read it."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "frame=best_effort_timestamp_time,pts_time,duration_time", "-of", "json", path],
                       capture_output=True, text=True)
    try:
        rows = json.loads(r.stdout or "{}").get("frames") or []
    except json.JSONDecodeError:
        return []
    out = []
    for f in rows:
        t = f.get("best_effort_timestamp_time") or f.get("pts_time")
        if t in (None, "N/A"):
            continue
        d = f.get("duration_time")
        out.append([float(t), float(d) if d not in (None, "N/A") else None])
    out.sort()
    t0 = out[0][0] if out else 0.0
    for f in out:
        f[0] -= t0
    for i, f in enumerate(out):
        if f[1] is None:
            f[1] = (out[i + 1][0] - f[0]) if i + 1 < len(out) else (out[i - 1][1] if i else 1 / 30)
    return [tuple(f) for f in out]


def out_point(video, name, segs=None):
    """Where assembly cuts the clip that the next one continues: (seconds or None, how).
    video.json trim's out point, else the shot's trim_to_seconds, else the end of the file."""
    s = (segs if segs is not None else segments(video)).get(name) or {}
    if s.get("trim"):
        return float(s["trim"][1]), "the trim in video.json"
    t = (shot_of(video, name).get("video") or {}).get("trim_to_seconds")
    if bridge.num(t):
        return float(t), "trim_to_seconds"
    return None, "the end of the file"


def pick(fr, out):
    """(index, t, duration) of the last frame that starts before `out` (None: the last frame)."""
    idx = len(fr) - 1
    if out is not None:
        idx = max([i for i, (t, _) in enumerate(fr) if t < out - 1e-6], default=0)
    return idx, fr[idx][0], fr[idx][1]


def take(video, name):
    """Write the last frame of the approved file of segment `name`. (ok, message)."""
    segs = segments(video)
    if name not in segs:
        return False, f"{name} is not in video.json"
    proj = project_of(video, name, segs)
    e = approved_entry(proj)
    if not e:
        return False, f"{name} has no approved file at gate B (review.py segment ... --decision approve)"
    sd = segment_dir(proj)
    src = os.path.join(sd, e["file"])
    if not os.path.exists(src):
        return False, f"the approved file {os.path.relpath(src, ROOT)} is not on disk"
    fr = frames(src)
    if not fr:
        return False, f"no video frame in {os.path.relpath(src, ROOT)}"
    want, how = out_point(video, name, segs)
    i, t, d = pick(fr, want)
    png = os.path.join(sd, FRAME)
    tmp = os.path.join(sd, ".last-frame.tmp.png")
    # The exact frame by its index; PNG, at the clip's own size: no resampling.
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", f"select=eq(n\\,{i})",
                        "-frames:v", "1", "-update", "1", tmp], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(tmp):
        return False, f"ffmpeg could not write the frame: {r.stderr[-300:]}"
    os.replace(tmp, png)
    size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                           "stream=width,height", "-of", "csv=p=0", png], capture_output=True, text=True)
    sha = bridge.sha256_file(png)
    info = {"_comment": "Written by scripts/character/continuity.py last-frame from the file approved at gate B. "
                        "The next segment continues from this frame; assembly cuts this clip at out_s.",
            "project": proj, "segment": name, "file": os.path.relpath(png, ROOT), "sha256": sha,
            "source": os.path.relpath(src, ROOT), "source_sha256": bridge.sha256_file(src),
            "approved": {"words": e.get("words"), "date": e.get("date")},
            "frame_index": i, "frame_t_s": round(t, 6), "frame_duration_s": round(d, 6),
            "frames": len(fr), "out_s": round(t + d, 6), "planned_out_s": want, "out_by": how,
            "size": [int(x) for x in size.stdout.strip().split(",")[:2]] if size.stdout.strip() else None}
    json.dump(info, open(os.path.join(sd, INFO), "w"), indent=2)
    return True, (f"{name}: {info['file']} (frame {i} of {len(fr)}, at {t:.3f} s; the cut at "
                  f"{info['out_s']:.3f} s, by {how}; sha256 {sha[:12]})")


def state(video, name):
    """For a continuing segment: (ok, why, last-frame.json). ok when the previous clip is
    approved, its last frame was taken from that very file at the cut assembly uses, and
    neither changed since. A segment that does not continue is (True, "", None)."""
    prev = source_of(shot_of(video, name))
    if not prev:
        return True, "", None
    segs = segments(video)
    if prev not in segs:
        return False, f"{prev} is not in video.json", None
    proj = project_of(video, prev, segs)
    e = approved_entry(proj)
    if not e:
        return False, (f"{prev} has no approved clip at gate B yet: generate and approve {prev} first "
                       "(review.py takes its last frame on the approval)"), None
    sd = segment_dir(proj)
    png, ij = os.path.join(sd, FRAME), os.path.join(sd, INFO)
    if not (os.path.exists(png) and os.path.exists(ij)):
        return False, f"no last frame of {prev}: run scripts/character/continuity.py last-frame {video} {prev}", None
    info = load(ij)
    src = os.path.join(sd, e["file"])
    if info.get("source") != os.path.relpath(src, ROOT) or not os.path.exists(src) \
            or bridge.sha256_file(src) != info.get("source_sha256"):
        return False, (f"the last frame of {prev} is not from its approved file ({e['file']}): take it again "
                       f"(continuity.py last-frame {video} {prev})"), info
    if bridge.sha256_file(png) != info.get("sha256"):
        return False, f"{info['file']} changed after it was taken: take it again", info
    if out_point(video, prev, segs)[0] != info.get("planned_out_s"):
        return False, (f"the cut of {prev} changed after its last frame was taken (trim or trim_to_seconds): "
                       f"take it again (continuity.py last-frame {video} {prev})"), info
    return True, "", info


def continuing(video):
    """[(previous, name)] of every continuing shot, in video.json order."""
    return [(source_of(shot_of(video, n)), n) for n in segments(video) if source_of(shot_of(video, n))]


def rules(video, v, shots, model, lim):
    """The static checks of every continuing shot (shots.py validate). [(level, message)]:
    'bad' refuses, 'note' informs."""
    out = []
    segs = v.get("segments") or []
    names = [seg_name(s) for s in segs if s.get("type")]
    bym = {seg_name(s): s for s in segs if s.get("type")}
    cin = (lim.get("continuity") or {}).get("input")
    for i, name in enumerate(names):
        shot = shots.get(name) or {}
        prev = source_of(shot)
        refs = (shot.get("video") or {}).get("references") or []
        if not prev:
            if shot.get("continuity") is not None:
                out.append(("bad", f"{name}: continuity is {{\"from\": \"<the previous segment>\"}}"))
            elif any(r.get("kind") == "neighbour-frame" for r in refs):
                out.append(("note", f"{name}: a neighbour-frame written by hand has no checksum; "
                                    "\"continuity\": {\"from\": ...} takes it from the approved clip"))
            continue
        t = name.split("-")[-1].upper()
        want = names[i - 1] if i else None
        if prev != want:
            out.append(("bad", f"{name}: continuity.from is {prev!r}; a clip continues from the segment right "
                               f"before it in video.json ({want or 'none: it is the first'})"))
            continue
        pt = prev.split("-")[-1].upper()
        for who, ty, sh in ((name, t, shot), (prev, pt, shots.get(prev) or {})):
            if ty not in CONTINUES:
                out.append(("bad", f"{name}: {who} is {ty}; only T, B and X (the written route) continue or are "
                                   "continued (a phone plate gets the app at P4; C, M, R and P are not generated)"))
            elif ty == "X" and isinstance(sh.get("face_replace"), dict):
                out.append(("bad", f"{name}: {who} is a face-replace reaction: its frames are the reference "
                                   "clip's, so it neither continues nor is continued"))
        ps = shots.get(prev) or {}
        if shot.get("set_ref") and ps.get("set_ref") and shot["set_ref"] != ps["set_ref"]:
            out.append(("bad", f"{name}: set {shot['set_ref']!r}; the clip it continues is in {ps['set_ref']!r} "
                               "(a continuous take stays in its set)"))
        if any(r.get("kind") == "neighbour-frame" for r in refs):
            out.append(("bad", f"{name}: list no neighbour-frame by hand; shots.py refs puts the last frame of "
                               f"{prev} in the keyframe's place"))
        if bym[name].get("trim"):
            out.append(("bad", f"{name}: a continuing segment starts at its first frame: no trim in video.json "
                               "(trim_to_seconds sets its end)"))
        if (bym[name].get("punch_in") or 1) != (bym[prev].get("punch_in") or 1):
            out.append(("bad", f"{name}: punch_in {bym[name].get('punch_in')!r} against {bym[prev].get('punch_in')!r} "
                               f"on {prev}: a continuous take keeps one framing across the cut"))
        if cin == "none" or not cin:
            out.append(("bad", f"{name}: the model {model} has no continuity input (models.json "
                               f"known_model_limits.{model}.continuity): no clip of it can continue"))
        elif cin != "reference":
            out.append(("bad", f"{name}: the model's continuity input is {cin!r}; generate.sh sends the frame only "
                               "as a reference image (no first-frame request shape is verified on Supagen)"))
    return out


def gray(path, index=0):
    """A small grey copy of one frame of a picture or a clip, as bytes."""
    w, h = MATCH_SIZE
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf",
                        f"select=eq(n\\,{index}),scale={w}:{h}:flags=area,format=gray", "-frames:v", "1",
                        "-f", "rawvideo", "-"], capture_output=True)
    return r.stdout if len(r.stdout) == w * h else None


def diff(a, b):
    """The mean difference of two grey copies, 0 (the same) to 255."""
    if a is None or b is None:
        return None
    return round(sum(abs(x - y) for x, y in zip(a, b)) / len(a), 2)


def match(video, name, take_file):
    """The first frame of a continuing take against its seed frame: (diff or None, why)."""
    ok, why, info = state(video, name)
    if not info:
        return None, why or f"{name} does not continue"
    return diff(gray(os.path.join(ROOT, info["file"])), gray(take_file, 0)), why


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    cmd, video = a[0], a[1]
    if cmd == "last-frame" and len(a) > 2:
        ok, msg = take(video, a[2])
        print(("  ✓ " if ok else "  ✗ ") + msg)
        sys.exit(0 if ok else 1)
    if cmd == "check":
        pairs = continuing(video)
        bad = 0
        for prev, name in pairs:
            ok, why, info = state(video, name)
            bad += not ok
            print(f"  ✓ {name} continues from {prev}: {info['file']} (sha256 {info['sha256'][:12]})" if ok
                  else f"  ✗ {name} continues from {prev}: {why}")
        print(f"\n{len(pairs)} continuing shot(s)" + (f", {bad} not ready" if bad else ""))
        sys.exit(1 if bad else 0)
    if cmd == "match" and len(a) > 3:
        d, why = match(video, a[2], a[3])
        if d is None:
            sys.exit(f"no match measured: {why}")
        print(f"{a[2]}: the first frame differs from its seed frame by {d} (0 to 255; under a few points is "
              "the same picture)" + (f"; note: {why}" if why else ""))
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
