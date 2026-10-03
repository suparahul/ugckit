#!/usr/bin/env python3
"""The offline test of the character pipeline's production bridge. Free: no generation,
no Supagen, no API. Not shipped (the installer copies template/ only).

    python3 tests/character-bridge/run.py [--workspace DIR] [--venv DIR] [--no-assemble]

Builds a scratch workspace from template/ (scripts/character, docs/character, the Atlas
link for the caption renderer), a handle with its world, a human character, a mascot and a
synthetic narrator, a screen library, and synthetic media made locally with ffmpeg, cv2
and macOS `say`. The "generated" segments are ffmpeg test pictures standing in for
approved generations. Then, for every fixture plan in fixtures/ (two v1, seven v2):

  - shots.py check, the bridge plan check, shots.py validate and the bridge video check pass;
  - the B prompt passes the lint;
  - six videos are assembled end to end and pass gate C (review.py final);
  - each broken copy (a mutation) is refused with the expected reason.

--venv names a Python environment with opencv and faster-whisper (requirements.txt); it is
linked as the workspace's .venv for assemble.sh. Exit 1 when any expectation fails.
"""
import copy, hashlib, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
TEMPLATE = os.path.join(REPO, "template")
FIX = os.path.join(HERE, "fixtures")
RESULTS = []


def arg(name, default=None):
    a = sys.argv[1:]
    return a[a.index(name) + 1] if name in a else default


WS = os.path.abspath(arg("--workspace") or tempfile.mkdtemp(prefix="ugckit-bridge-"))
VENV = arg("--venv")
PY = os.path.join(VENV, "bin", "python3") if VENV else sys.executable
SC = os.path.join(WS, "scripts", "character")
HANDLE = os.path.join(WS, "apps", "catapp", "handles", "nora")


def p(*parts):
    return os.path.join(WS, *parts)


def run(cmd, env=None):
    e = dict(os.environ)
    e.update(env or {})
    r = subprocess.run(cmd, cwd=WS, capture_output=True, text=True, env=e)
    return r.returncode, r.stdout + r.stderr


def expect(label, cmd, ok=True, contains=None, env=None):
    rc, out = run(cmd, env)
    good = (rc == 0) == ok and (contains is None or contains in out)
    RESULTS.append((label, good))
    print(f"{'PASS' if good else 'FAIL'}  {label}")
    if not good:
        print("      " + "\n      ".join(out.strip().splitlines()[-25:]))
    return out


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", *a], capture_output=True, text=True)
    if r.returncode:
        sys.exit("ffmpeg: " + r.stderr)


def picture(path, color="gray", size="1080x1920"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ff("-f", "lavfi", "-i", f"color=c={color}:s={size}", "-frames:v", "1", path)


def speech(path, text, pad_to=None):
    """A local TTS take (macOS say), as wav: the stand-in for a voice."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    aiff = path + ".aiff"
    subprocess.run(["say", "-r", "175", "-o", aiff, text], check=True)
    af = ["-af", f"apad=whole_dur={pad_to}"] if pad_to else []
    ff("-i", aiff, *af, "-ac", "1", "-ar", "44100", path)
    os.remove(aiff)


def clip(path, dur, src="testsrc2", tone=330, size="1080x1920", audio=True):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = ["-f", "lavfi", "-i", f"sine=frequency={tone}:sample_rate=48000:duration={dur}"] if audio else []
    ff("-f", "lavfi", "-i", f"{src}=size={size}:rate=30:duration={dur}", *a,
       "-c:v", "libx264", "-pix_fmt", "yuv420p", *(["-c:a", "aac", "-shortest"] if audio else []), path)


def talking(path, text, dur, color):
    """A stand-in for a generated talking segment: a plain picture and a TTS line."""
    wav = path + ".wav"
    speech(wav, text, pad_to=dur)
    ff("-f", "lavfi", "-i", f"color=c={color}:s=720x1280:r=30:d={dur}", "-i", wav,
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(dur), path)
    os.remove(wav)


def screen_recording(path, hero="Relaxed tail"):
    """A real-looking app recording: a light screen with the hero string, 6 s."""
    import cv2, numpy as np
    w, h, fps = 590, 1278, 30
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".avi"
    vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    for i in range(6 * fps):
        f = np.full((h, w, 3), 245, np.uint8)
        cv2.rectangle(f, (0, 0), (w, 120), (90, 60, 200), -1)
        cv2.putText(f, "Tail reading", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (255, 255, 255), 3, cv2.LINE_AA)
        if i >= 2 * fps:
            cv2.putText(f, hero, (40, 640), cv2.FONT_HERSHEY_SIMPLEX, 2.0, (20, 20, 20), 5, cv2.LINE_AA)
        vw.write(f)
    vw.release()
    ff("-i", tmp, "-c:v", "libx264", "-pix_fmt", "yuv420p", path)
    os.remove(tmp)
    return {"size": [w, h], "rect": [30, 585, 520, 80]}


def filmed_phone(path, tilt=0):
    """A supplied clip of a hand-held phone with a flat green screen; `tilt` pulls the top
    edge in by that many pixels on each side (a phone not flat-on to the lens)."""
    import cv2, numpy as np
    os.makedirs(os.path.dirname(path), exist_ok=True)
    w, h, fps = 1080, 1920, 30
    tmp = path + ".avi"
    vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    rng = np.random.default_rng(1)
    body = np.array([[270, 440], [810, 440], [810, 1480], [270, 1480]], np.int32)
    scr = np.array([[300 + tilt, 500], [780 - tilt, 500], [780, 1420], [300, 1420]], np.int32)
    for i in range(5 * fps):
        f = np.full((h, w, 3), (150, 140, 128), np.uint8)
        f = cv2.add(f, rng.integers(0, 6, (h, w, 3), dtype=np.uint8))
        cv2.fillConvexPoly(f, body, (25, 25, 25))
        cv2.fillConvexPoly(f, scr, (64, 177, 0))
        vw.write(f)
    vw.release()
    ff("-i", tmp, "-f", "lavfi", "-i", "sine=frequency=200:duration=5", "-c:v", "libx264", "-pix_fmt", "yuv420p",
       "-crf", "12", "-c:a", "aac", "-shortest", path)
    os.remove(tmp)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def wj(path, d):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(d, open(path, "w"), indent=2)


def rj(path):
    return json.load(open(path))


# ---------------------------------------------------------------- the workspace
def build_workspace():
    if os.path.exists(SC):
        shutil.rmtree(SC)
    shutil.copytree(os.path.join(TEMPLATE, "scripts", "character"), SC)
    shutil.copytree(os.path.join(TEMPLATE, "docs", "character"), p("docs", "character"), dirs_exist_ok=True)
    os.makedirs(p("pipeline", "character"), exist_ok=True)
    shutil.copy(os.path.join(TEMPLATE, "pipeline", "character", "model-failures.md"), p("pipeline", "character"))
    if not os.path.exists(p("atlas")):
        os.symlink(os.path.join(TEMPLATE, "atlas"), p("atlas"))
    if VENV and not os.path.exists(p(".venv")):
        os.symlink(os.path.abspath(VENV), p(".venv"))
    open(p(".env"), "w").write("SUPAGEN_API_KEY=offline-test-not-a-key\nSUPAGEN_WORKSPACE_ID=offline-test\n")
    # The handle's world: two sets, two generated cats and one real cat.
    for f in ("references/face.png", "references/sets/kitchen.png", "references/sets/hallway.png",
              "references/subject-pip.png", "references/subject-biscuit.png"):
        picture(os.path.join(HANDLE, f))
    wj(os.path.join(HANDLE, "world.json"), {"handle": "nora", "fixed_subjects": [
        {"id": "pip", "what": "a small grey tabby", "reference": "references/subject-pip.png",
         "count": "exactly one", "true_size": "knee height", "approved": "fixture 2026-10-01"},
        {"id": "biscuit", "what": "a cream long-hair", "reference": "references/subject-biscuit.png",
         "count": "exactly one", "true_size": "knee height", "approved": "fixture 2026-10-01"},
        {"id": "milo", "what": "the user's own black cat", "origin": "real", "count": "exactly one",
         "true_size": "real footage", "approved": "fixture 2026-10-01"}],
        "sets": [{"id": "kitchen", "plate": "references/sets/kitchen.png", "room": "a small kitchen",
                  "light": "window left", "camera_position": "counter", "objects": ["kettle", "bowl", "plant"],
                  "approved": "fixture"},
                 {"id": "hallway", "plate": "references/sets/hallway.png", "room": "a hallway",
                  "light": "ceiling", "camera_position": "floor", "objects": ["shoes", "mat", "door"],
                  "approved": "fixture"}]})
    cdir = os.path.join(HANDLE, "characters", "nora")
    anchors = {k: f"characters/nora/references/anchors/{k}.png" for k in
               ("front", "three_quarter_left", "three_quarter_right", "side", "back_shoulder", "expressions", "hands")}
    for f in list(anchors.values()) + ["characters/nora/references/anchors/outfits/apron.png"]:
        picture(os.path.join(HANDLE, f))
    speech(os.path.join(cdir, "references", "voice", "voice-reference.wav"), "Okay so this is how I do it.")
    wj(os.path.join(cdir, "creator.json"), {
        "character_id": "nora", "handle": "nora", "cast_kind": "human", "version": "v1", "status": "live",
        "voice_profile": {"voice_reference": {"file": "characters/nora/references/voice/voice-reference.wav",
                                              "approved": "fixture 2026-10-01"}},
        "sets": ["kitchen", "hallway"], "fixed_subjects": ["pip", "biscuit"],
        "outfits": [{"id": "apron", "what": "a green apron",
                     "reference": "characters/nora/references/anchors/outfits/apron.png"}],
        "anchors": dict(anchors, hero="references/face.png", approved=["all, fixture 2026-10-01"])})
    mdir = os.path.join(HANDLE, "characters", "whisker")
    picture(os.path.join(mdir, "references", "anchors", "hero.png"), "orange")
    wj(os.path.join(mdir, "creator.json"), {
        "character_id": "whisker", "handle": "nora", "cast_kind": "mascot", "version": "v1", "status": "live",
        "mascot": {"style_lock": "a flat orange cartoon cat, thick outline, two whiskers a side",
                   "not_a_real_animal": True},
        "sets": ["kitchen"], "fixed_subjects": [], "outfits": [],
        "anchors": {"hero": "characters/whisker/references/anchors/hero.png", "approved": ["fixture"]}})
    ndir = os.path.join(HANDLE, "narrators", "calm")
    speech(os.path.join(ndir, "voice-sample.wav"), "Here is the one thing to do tonight.")
    wj(os.path.join(ndir, "narrator.json"), {
        "narrator_id": "calm", "kind": "original_synthetic", "version": "v1", "status": "live",
        "cloned_from": "none", "voice_sample": "narrators/calm/voice-sample.wav",
        "approved": {"words": "That voice is fine.", "date": "2026-10-02"},
        "natural_voice_check": "2026-10-02 pass"})
    # The screen library.
    sdir = p("apps", "catapp", "screens")
    geo = screen_recording(os.path.join(sdir, "scan-result.mp4"))
    wj(os.path.join(sdir, "screens.json"), {"app": "catapp", "screens": [
        {"id": "scan-result", "file": "scan-result.mp4", "kind": "recording", "job": "reads a tail video",
         "size": geo["size"], "fps": 30, "duration_s": 6.0, "events": [],
         "hero": {"text": "Relaxed tail", "rect_source_px": geo["rect"], "t": 3.0, "needs": "large type"},
         "mode": "light", "app_version": "1.0.0", "date": "2026-10-01", "expired": False}]})
    open(os.path.join(sdir, "SCREENS.md"), "w").write("| scan-result | reads a tail video |\n")
    # Supplied media.
    m = p("apps", "catapp", "media")
    clip(os.path.join(m, "milo-tail.mp4"), 8, "testsrc2", 300)
    clip(os.path.join(m, "milo-carrier.mp4"), 12, "smptebars", 260)
    clip(os.path.join(m, "pill-wrong.mp4"), 6, "testsrc", 400, audio=False)
    clip(os.path.join(m, "pill-right.mp4"), 6, "rgbtestsrc", 500, audio=False)
    clip(os.path.join(m, "viral-blink.mp4"), 5, "testsrc2", 350)
    picture(os.path.join(m, "pouch.jpg"), "brown", "1080x1350")
    filmed_phone(os.path.join(m, "phone-flat.mp4"))
    filmed_phone(os.path.join(m, "phone-tilted.mp4"), tilt=70)
    vet = os.path.join(m, "vet-clip.mp4")
    speech(vet + ".wav", "A cat that hides for two days needs a vet.", pad_to=6)
    ff("-f", "lavfi", "-i", "color=c=white:s=1080x1920:r=30:d=6", "-i", vet + ".wav", "-c:v", "libx264",
       "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", "6", vet)
    os.remove(vet + ".wav")


# ---------------------------------------------------------------- the fixtures
def fixture(name):
    return rj(os.path.join(FIX, f"{name}.plan.json"))


def lock(plan):
    """What video-lock will do: the checksums, the digest, planning-approval.json."""
    sys.path.insert(0, SC)
    import bridge
    vd = p("pipeline", "character", plan["video_id"])
    for a in plan.get("assets") or []:
        if a.get("sha256") == "@sha":
            a["sha256"] = sha(p(a["path"]))
    wj(os.path.join(vd, "plan.json"), plan)
    if "schema_version" in plan:
        wj(os.path.join(vd, "planning-approval.json"), {
            "video_id": plan["video_id"], "revision": plan["revision"], "content_sha256": bridge.digest(plan),
            "words": plan["approved"]["words"], "date": plan["approved"]["date"], "evidence_snapshot_digest": None})
        vj = os.path.join(vd, "video.json")
        if os.path.exists(vj):
            v = rj(vj)
            v["plan_revision"], v["plan_sha256"] = plan["revision"], bridge.digest(plan)
            wj(vj, v)
    return plan


def shot(video, name, t, lines, action, set_ref="kitchen", subjects=(), framing="face", refs=None,
         character="nora@v1", dur=5, cast="human"):
    hero = "references/face.png"
    kf = [{"file": hero, "kind": "hero"}, {"file": f"references/sets/{set_ref}.png", "kind": "set"}]
    gen = [{"file": f"keyframes/{name}.png", "kind": "keyframe", "role": "the first frame"}]
    if framing == "hands_only":
        kf = [{"file": "characters/nora/references/anchors/hands.png", "kind": "anchor"}] + kf[1:]
        gen.append({"file": "characters/nora/references/anchors/hands.png", "kind": "anchor", "role": "her hands"})
    elif cast == "mascot":
        kf = [{"file": "characters/whisker/references/anchors/hero.png", "kind": "hero"}] + kf[1:]
        gen.append({"file": "characters/whisker/references/anchors/hero.png", "kind": "hero", "role": "the mascot"})
    else:
        gen.append({"file": hero, "kind": "hero", "role": "her face"})
    for s in subjects:
        kf.append({"file": f"references/subject-{s}.png", "kind": "subject"})
        gen.append({"file": f"references/subject-{s}.png", "kind": "subject", "role": s})
    if t == "T":
        gen.append({"file": "characters/nora/references/voice/voice-reference.wav", "kind": "voice",
                    "role": "the voice only"})
    d = {"shot_id": f"{video}.{name}", "character_ref": character, "segment_type": t, "script_lines": list(lines),
         "set_ref": set_ref, "outfit_ref": "apron" if cast == "human" else None, "framing": "medium",
         "framing_kind": framing, "cast_kind": cast, "action": action,
         "hands": {"left": "sets the bowl" if framing != "subject_only" else "out of frame",
                   "right": "rests on the counter" if framing != "subject_only" else "out of frame"},
         "fixed_subjects_in_shot": list(subjects), "phone": {"present": False},
         "keyframe_prompt": "the first frame, a real phone photo, no text", "keyframe_references": kf,
         "video": {"duration_seconds": dur, "trim_to_seconds": None, "references": refs or gen,
                   "beats": [{"t": f"0.0-{dur}.0", "action": action}]}}
    wj(p("pipeline", "character", video, "shots", f"{name}.json"), d)
    return d


def video_json(plan, segments, **extra):
    sys.path.insert(0, SC)
    import bridge
    v = {"video_id": plan["video_id"], "characters": plan["characters"], "app": "catapp", "handle": "nora",
         "dimension": "9:16", "app_insertion": plan["app_insertion"], "segments": segments,
         "joins": {"cut": "hard", "audio_fade_ms": 30, "on_sentence_end": True}, "sound": {},
         "export": {"intermediate_encode": True, "film_grain": False}}
    if "schema_version" in plan:
        v.update({"plan_revision": plan["revision"], "plan_sha256": bridge.digest(plan),
                  "overlays": copy.deepcopy(plan.get("overlays") or [])})
    v.update(extra)
    wj(p("pipeline", "character", plan["video_id"], "video.json"), v)
    return v


def gen_file(video, name, kind, text=None, dur=5, color="navy"):
    f = p("pipeline", "character", video, "segments", name, "generated", f"{name}-take1.mp4")
    if kind == "talk":
        talking(f, text, dur, color)
    else:
        clip(f, dur, "testsrc", 120, size="720x1280")
    return f


B_PROMPT = """Vertical 9:16 phone video of a small kitchen counter, window light from the left, slight handheld shake.
REFERENCES
keyframes/01-b.png is the first frame: composition, the counter, the light. Nothing else.
hands.png is her hands only: skin tone and nails. Not her face.
subject-pip.png is Pip, the grey tabby: look and true size. Not its background.
subject-biscuit.png is Biscuit, the cream long-hair: look and true size. Not its background.
STRUCTURE
One shot, no cuts.
SUBJECT
Only her hands and forearms; no face. A green apron sleeve at the wrist.
SETTING
The kitchen of the set plate, no other location.
ANIMALS/PROPS
Exactly two cats, Pip and Biscuit, each at knee height. Two ceramic bowls, held by her hands.
SHOT 1 (0.0 to 5.0 s)
Her hands set two bowls a body length apart for Pip and Biscuit. End state: both cats eat, her hands rest on the counter.
PERFORMANCE
No one speaks. The cats walk in and eat.
AUDIO
Bowls set on a wood counter; two cats eating. No music.
CONSISTENCY
The same two cats, the same counter, the same light.
NO TEXT
No captions, no text, no watermark, no logo.
"""


# ---------------------------------------------------------------- per fixture
def approve_segment(video, seg, f):
    rel = os.path.relpath(f, p("pipeline", "character", video, "segments", seg))
    expect(f"{video}: gate B {seg}", [PY, f"{SC}/review.py", "segment", video, seg, "--decision", "approve",
                                      "--file", rel, "--words", "Keep it."])


def approve_sources(video, plan):
    for a in plan.get("assets") or []:
        if a["kind"] != "screen":
            expect(f"{video}: source {a['id']}", [PY, f"{SC}/review.py", "source", video, a["id"],
                                                  "--decision", "approve", "--words", "That's my clip, use it."])


def narration_take(video, take, text, lines):
    f = p("pipeline", "character", video, "narration", f"{take}.wav")
    speech(f, text)
    expect(f"{video}: narration {take}", [PY, f"{SC}/review.py", "narration", video, take, "--narrator", "calm",
                                         "--lines", lines, "--decision", "approve", "--words", "Good take.",
                                         "--check", "natural_voice=pass"])


def checks(video):
    expect(f"{video}: shots.py check", [PY, f"{SC}/shots.py", "check", video])
    expect(f"{video}: bridge plan", [PY, f"{SC}/bridge.py", "plan", video])


def validate(video):
    expect(f"{video}: shots.py validate", [PY, f"{SC}/shots.py", "validate", video])
    expect(f"{video}: bridge video", [PY, f"{SC}/bridge.py", "video", video])


def assemble(video, assemble_on):
    if not assemble_on:
        return
    out = expect(f"{video}: assemble.sh", ["bash", f"{SC}/assemble.sh", video])
    man = p("pipeline", "character", video, "assembly", "assembly.json")
    if os.path.exists(man):
        fails = {k: c["detail"] for k, c in rj(man)["checks"].items() if c.get("result") == "FAIL"}
        RESULTS.append((f"{video}: no FAIL in the final checks", not fails))
        print(f"{'PASS' if not fails else 'FAIL'}  {video}: no FAIL in the final checks {fails or ''}")
        expect(f"{video}: gate C approve", [PY, f"{SC}/review.py", "final", video, "--decision", "approve",
                                            "--words", "Ship it."])
    return out


def mutate(name, label, plan_fn=None, video_fn=None, cmd="validate", contains=None, relock=True):
    """A broken copy of a fixture video, refused with the expected reason. The original is
    restored after."""
    vd = p("pipeline", "character", name)
    keep = {f: open(os.path.join(vd, f)).read() for f in ("plan.json", "video.json", "planning-approval.json")
            if os.path.exists(os.path.join(vd, f))}
    shots_keep = {f: open(os.path.join(vd, "shots", f)).read() for f in os.listdir(os.path.join(vd, "shots"))} \
        if os.path.isdir(os.path.join(vd, "shots")) else {}
    try:
        if plan_fn:
            pl = rj(os.path.join(vd, "plan.json"))
            plan_fn(pl)
            if relock:
                lock(pl)
            else:
                wj(os.path.join(vd, "plan.json"), pl)
        if video_fn:
            v = rj(os.path.join(vd, "video.json"))
            video_fn(v)
            wj(os.path.join(vd, "video.json"), v)
        c = {"check": [PY, f"{SC}/shots.py", "check", name], "validate": [PY, f"{SC}/shots.py", "validate", name],
             "plan": [PY, f"{SC}/bridge.py", "plan", name]}.get(cmd, cmd)
        expect(f"{name}: refuses {label}", c, ok=False, contains=contains)
    finally:
        for f, t in keep.items():
            open(os.path.join(vd, f), "w").write(t)
        for f, t in shots_keep.items():
            open(os.path.join(vd, "shots", f), "w").write(t)


def main():
    assemble_on = "--no-assemble" not in sys.argv
    print(f"workspace: {WS}")
    build_workspace()

    # ---- v1: the legacy contract, unchanged
    pl = lock(fixture("v1-talking"))
    checks("v1-talking")
    shot("v1-talking", "01-t", "T", ["l1"], "she looks at the bowl")
    shot("v1-talking", "02-t", "T", ["l2"], "she points at the litter box")
    video_json(pl, [{"n": 1, "type": "T", "project": "v1-talking.01-t", "script_lines": ["l1"]},
                    {"n": 2, "type": "T", "project": "v1-talking.02-t", "script_lines": ["l2"], "punch_in": 1.1}],
               title_overlay={"burn": True, "text": "Why she skipped her food", "until_s": 3})
    validate("v1-talking")
    for n, line, color in (("01-t", pl["script"][0]["line"], "navy"), ("02-t", pl["script"][1]["line"], "teal")):
        approve_segment("v1-talking", n, gen_file("v1-talking", n, "talk", line, 5, color))
    assemble("v1-talking", assemble_on)
    mutate("v1-talking", "an app beat without app insertion",
           plan_fn=lambda q: q["beats"][1].update(app_on_screen=True, screen_id="scan-result"),
           cmd="check", contains="app_insertion is false")

    pl = lock(fixture("v1-insert"))
    checks("v1-insert")
    shot("v1-insert", "01-t", "T", ["l1"], "she lifts her chin")
    video_json(pl, [{"n": 1, "type": "T", "project": "v1-insert.01-t", "script_lines": ["l1"]},
                    {"n": 2, "type": "R", "screen_id": "scan-result", "script_lines": ["l2"],
                     "audio_from": "v1-insert.03-t"}])
    validate("v1-insert")

    # ---- v2: a real cat clip, then the real app reading it (C, live pairing, overlay)
    pl = lock(fixture("v2-live-cat"))
    checks("v2-live-cat")
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "milo-clip", "source_range_s": [1, 5], "beat_ids": ["b1"],
                     "script_lines": []},
                    {"n": 2, "type": "R", "screen_id": "scan-result", "trim": [1, 6], "beat_ids": ["b2"],
                     "script_lines": []}])
    validate("v2-live-cat")
    approve_sources("v2-live-cat", pl)
    assemble("v2-live-cat", assemble_on)
    mutate("v2-live-cat", "a real cat generated",
           plan_fn=lambda q: q["beats"][0].update(source_asset_ids=[], set_id="kitchen"),
           cmd="plan", contains="real animal")
    mutate("v2-live-cat", "a recording trim that misses the measured result",
           video_fn=lambda v: v["segments"][1].update(trim=[4, 6]), contains="does not show the result")
    mutate("v2-live-cat", "live_use without a paired recording",
           plan_fn=lambda q: q["assets"][1].update(paired_input_ref=None), cmd="plan",
           contains="needs a real input clip")
    mutate("v2-live-cat", "a plan edited after its approval",
           plan_fn=lambda q: q["overlays"][0].update(text="I filmed his tail and asked"), relock=False,
           cmd="check", contains="does not match the approved digest")
    mutate("v2-live-cat", "overlays not copied into video.json",
           video_fn=lambda v: v.update(overlays=[]), contains="not the plan's overlays")
    mutate("v2-live-cat", "a hero string drawn as an overlay",
           plan_fn=lambda q: q["overlays"][0].update(text="Relaxed tail"), cmd="plan", contains="hero string")
    mutate("v2-live-cat", "a segment that misses the beat timing",
           video_fn=lambda v: v["segments"][0].update(source_range_s=[1, 3]), contains="the plan has 4 s")
    media = p("apps", "catapp", "media", "milo-tail.mp4")
    orig = open(media, "rb").read()
    open(media, "ab").write(b"\0")
    expect("v2-live-cat: refuses a supplied file changed after the lock", [PY, f"{SC}/shots.py", "check", "v2-live-cat"],
           ok=False, contains="does not match its sha256")
    expect("v2-live-cat: gate B refuses the changed file", [PY, f"{SC}/review.py", "source", "v2-live-cat",
                                                            "milo-clip", "--decision", "approve", "--words", "ok"],
           ok=False, contains="cannot approve")
    open(media, "wb").write(orig)

    # ---- v2: the same pair in picture-in-picture, the recording in an inset, measured sync
    pip = fixture("v2-live-cat")
    pip["video_id"] = "v2-live-pip"
    pip["format"]["length_s"] = 6
    pip["beats"] = [dict(pip["beats"][0], id="b1", start_s=0, end_s=6, role="use_reveal",
                         action="Milo flicks his tail while the app reads it in the corner",
                         source_asset_ids=["milo-clip", "scan-rec"], layout="picture_in_picture",
                         app_on_screen=True, screen_id="scan-result", viewer_must="read",
                         panels=[{"id": "cam", "asset_id": "milo-clip", "source_range_s": [0.5, 6.5],
                                  "rect": [0, 0, 1, 1], "crop": "cover", "sync_offset_s": 0},
                                 {"id": "app", "asset_id": "scan-rec", "source_range_s": [1, 6],
                                  "rect": [0.5, 0.45, 0.46, 0.5], "crop": "cover", "sync_offset_s": 0}])]
    pip["assets"][0]["trim_s"] = [0, 8]
    pip["overlays"][0]["end_s"] = 3.0
    pl = lock(pip)
    checks("v2-live-pip")
    video_json(pl, [{"n": 1, "type": "M", "beat_ids": ["b1"], "duration_s": 6, "script_lines": [],
                     "panels": [dict(x, audio=(x["id"] == "cam")) for x in pip["beats"][0]["panels"]]}])
    validate("v2-live-pip")
    approve_sources("v2-live-pip", pl)
    assemble("v2-live-pip", assemble_on)
    mutate("v2-live-pip", "a panel sync against the measured offset",
           plan_fn=lambda q: q["beats"][0]["panels"][1].update(sync_offset_s=1.0),
           video_fn=lambda v: v["segments"][0]["panels"][1].update(sync_offset_s=1.0), contains="measured")

    # ---- v2: B hands only, two cats, a synthetic narrator, step labels
    pl = lock(fixture("v2-hands-two-cats"))
    checks("v2-hands-two-cats")
    for n, b in (("01-b", pl["beats"][0]), ("02-b", pl["beats"][1])):
        shot("v2-hands-two-cats", n, "B", [], b["action"], subjects=["pip", "biscuit"], framing="hands_only")
    video_json(pl, [{"n": 1, "type": "B", "project": "v2-hands-two-cats.01-b", "beat_ids": ["b1"],
                     "script_lines": ["l1"], "audio_from": "narration:n1"},
                    {"n": 2, "type": "B", "project": "v2-hands-two-cats.02-b", "beat_ids": ["b2"],
                     "script_lines": ["l2"], "audio_from": "narration:n2"}])
    validate("v2-hands-two-cats")
    sd = p("pipeline", "character", "v2-hands-two-cats", "segments", "01-b")
    os.makedirs(sd, exist_ok=True)
    open(os.path.join(sd, "prompt.txt"), "w").write(B_PROMPT)
    expect("v2-hands-two-cats: shots.py refs", [PY, f"{SC}/shots.py", "refs", "v2-hands-two-cats"])
    expect("v2-hands-two-cats: lint of the B prompt", [PY, f"{SC}/lint_prompt.py", "v2-hands-two-cats", "01-b"])
    open(os.path.join(sd, "prompt.txt"), "w").write(B_PROMPT.replace("no face", "her face").replace(
        "THE", "THE") + "")
    expect("v2-hands-two-cats: lint refuses hands-only without 'no face'",
           [PY, f"{SC}/lint_prompt.py", "v2-hands-two-cats", "01-b"], ok=False, contains="hands only")
    open(os.path.join(sd, "prompt.txt"), "w").write(B_PROMPT.replace(
        "PERFORMANCE", "THE PHONE SCREEN\nShe holds a phone with a green screen.\nPERFORMANCE"))
    expect("v2-hands-two-cats: lint refuses a phone in B",
           [PY, f"{SC}/lint_prompt.py", "v2-hands-two-cats", "01-b"], ok=False, contains="no phone and no app")
    open(os.path.join(sd, "prompt.txt"), "w").write(B_PROMPT.replace("Exactly two cats", "Two cats"))
    expect("v2-hands-two-cats: lint refuses a count that is not exact",
           [PY, f"{SC}/lint_prompt.py", "v2-hands-two-cats", "01-b"], ok=False, contains="exact count")
    open(os.path.join(sd, "prompt.txt"), "w").write(B_PROMPT)
    narration_take("v2-hands-two-cats", "n1", pl["script"][0]["line"], "l1")
    narration_take("v2-hands-two-cats", "n2", pl["script"][1]["line"], "l2")
    expect("v2-hands-two-cats: gate B refuses a take without the natural-voice check",
           [PY, f"{SC}/review.py", "narration", "v2-hands-two-cats", "n1", "--narrator", "calm", "--lines", "l1",
            "--decision", "approve", "--words", "ok"], ok=False, contains="natural-voice check")
    for n in ("01-b", "02-b"):
        approve_segment("v2-hands-two-cats", n, gen_file("v2-hands-two-cats", n, "action"))
    assemble("v2-hands-two-cats", assemble_on)
    # Supplied media is never a reference of a generation (shots.py and generate.sh).
    sup = p("pipeline", "character", "v2-hands-two-cats", "supplied", "frame.png")
    picture(sup)
    mutate("v2-hands-two-cats", "a supplied picture as a generation reference",
           video_fn=lambda v: (rj(p("pipeline", "character", "v2-hands-two-cats", "shots", "01-b.json")),
                               wj(p("pipeline", "character", "v2-hands-two-cats", "shots", "01-b.json"),
                                  {**rj(p("pipeline", "character", "v2-hands-two-cats", "shots", "01-b.json")),
                                   "video": {**rj(p("pipeline", "character", "v2-hands-two-cats", "shots",
                                                    "01-b.json"))["video"],
                                             "references": [{"file": "keyframes/01-b.png", "kind": "keyframe"},
                                                            {"file": "pipeline/character/v2-hands-two-cats/supplied/frame.png",
                                                             "kind": "set"}]}})),
           contains="supplied media")
    ap = p("pipeline", "character", "v2-hands-two-cats", "approval.json")
    a = rj(ap)
    a["gate_a_storyboard"] = {"decision": "approve", "words": "Storyboard is good."}
    wj(ap, a)
    refs = os.path.join(sd, "refs.json")
    keep_refs = open(refs).read()
    wj(refs, {"references": [{"kind": "set", "file": "pipeline/character/v2-hands-two-cats/supplied/frame.png"}]})
    expect("v2-hands-two-cats: generate.sh refuses a supplied reference before any cost",
           ["bash", f"{SC}/generate.sh", "v2-hands-two-cats", "01-b"], ok=False, contains="supplied media",
           env={"ALLOW_REFS": "1"})
    open(refs, "w").write(keep_refs)
    mutate("v2-hands-two-cats", "the app shown in a generated action",
           plan_fn=lambda q: (q.update(app_insertion=True), q["beats"][0].update(app_on_screen=True,
                              screen_id="scan-result", viewer_must="read"),
                              q.setdefault("hero_strings", {}).update({"scan-result": "Relaxed tail"})),
           video_fn=lambda v: v.update(app_insertion=True), contains="never shown in a generated action")
    mutate("v2-hands-two-cats", "generated hands with no cast",
           plan_fn=lambda q: (q.update(characters=[]), q["editorial"].update(cast_kind="none")),
           cmd="plan", contains="generated hands belong to a pinned human")
    mutate("v2-hands-two-cats", "a synthetic narrator over a human face",
           plan_fn=lambda q: q["beats"][0].update(framing="face"), cmd="plan",
           contains="never speaks over a visible human face")
    mutate("v2-hands-two-cats", "a shot without the beat's action",
           video_fn=lambda v: wj(p("pipeline", "character", "v2-hands-two-cats", "shots", "01-b.json"),
                                 {**rj(p("pipeline", "character", "v2-hands-two-cats", "shots", "01-b.json")),
                                  "action": "she pours water", "video": {**rj(p("pipeline", "character",
                                  "v2-hands-two-cats", "shots", "01-b.json"))["video"], "beats": []}}),
           contains="word for word")
    mutate("v2-hands-two-cats", "one cat where the plan has two",
           video_fn=lambda v: wj(p("pipeline", "character", "v2-hands-two-cats", "shots", "02-b.json"),
                                 {**rj(p("pipeline", "character", "v2-hands-two-cats", "shots", "02-b.json")),
                                  "fixed_subjects_in_shot": ["pip"]}), contains="exact ids and count")
    mutate("v2-hands-two-cats", "the narration from the wrong source",
           video_fn=lambda v: v["segments"][0].update(audio_from="v2-hands-two-cats.03-t"),
           contains="'narration:<take>'")

    # ---- v2: split-screen wrong / right with panel labels
    pl = lock(fixture("v2-split"))
    checks("v2-split")
    video_json(pl, [{"n": 1, "type": "M", "beat_ids": ["b1"], "duration_s": 6, "script_lines": ["l1"],
                     "audio_from": "narration:n1", "panels": copy.deepcopy(pl["beats"][0]["panels"])},
                    {"n": 2, "type": "C", "asset_id": "pouch-still", "still_s": 3, "beat_ids": ["b2"],
                     "script_lines": [], "fit": "pad"}])
    validate("v2-split")
    approve_sources("v2-split", pl)
    narration_take("v2-split", "n1", pl["script"][0]["line"], "l1")
    assemble("v2-split", assemble_on)
    mutate("v2-split", "overlapping split-screen panels",
           plan_fn=lambda q: q["beats"][0]["panels"][1].update(rect=[0.4, 0, 0.6, 1]), cmd="plan",
           contains="split_screen panels overlap")
    mutate("v2-split", "a panel copied wrong into video.json",
           video_fn=lambda v: v["segments"][0]["panels"][0].update(source_range_s=[1, 6]), contains="panel left")

    # ---- v2: a progress-log diary of a real cat, paragraphs and a day counter
    pl = lock(fixture("v2-diary"))
    checks("v2-diary")
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "milo-carrier", "source_range_s": [0, 6], "beat_ids": ["b1"],
                     "script_lines": []},
                    {"n": 2, "type": "C", "asset_id": "milo-carrier", "source_range_s": [6, 12], "beat_ids": ["b2"],
                     "script_lines": []}])
    validate("v2-diary")
    approve_sources("v2-diary", pl)
    assemble("v2-diary", assemble_on)
    mutate("v2-diary", "a paragraph too short to read",
           plan_fn=lambda q: q["overlays"][2].update(end_s=8), cmd="plan", contains="to be read")
    mutate("v2-diary", "a day counter that is not the series day",
           plan_fn=lambda q: q["overlays"][0].update(text="Day 11"), cmd="plan", contains="day 12")
    mutate("v2-diary", "a progress log without state facts",
           plan_fn=lambda q: q["editorial"]["series"].update(state_fact_refs=[]), cmd="plan",
           contains="state_fact_refs")
    if assemble_on:
        rev2 = rj(p("pipeline", "character", "v2-diary", "plan.json"))
        keep = {f: open(p("pipeline", "character", "v2-diary", f)).read()
                for f in ("plan.json", "planning-approval.json", "video.json")}
        rev2["revision"] = 2
        rev2["overlays"][1]["text"] = "He walked in on his own"
        lock(rev2)
        expect("v2-diary: gate C refuses a file from an older revision",
               [PY, f"{SC}/review.py", "final", "v2-diary", "--decision", "approve", "--words", "ok"],
               ok=False, contains="another revision")
        for f, t in keep.items():
            open(p("pipeline", "character", "v2-diary", f), "w").write(t)

    # ---- v2: a credited stitch excerpt, then a talking head
    pl = lock(fixture("v2-stitch"))
    checks("v2-stitch")
    shot("v2-stitch", "02-t", "T", ["l1"], pl["beats"][1]["action"])
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "viral-blink", "source_range_s": [0, 4], "beat_ids": ["b1"],
                     "script_lines": []},
                    {"n": 2, "type": "T", "project": "v2-stitch.02-t", "beat_ids": ["b2"], "script_lines": ["l1"]}])
    validate("v2-stitch")
    mutate("v2-stitch", "a permitted clip with no source credit",
           plan_fn=lambda q: q.update(overlays=[]), cmd="plan", contains="source_credit")
    mutate("v2-stitch", "a silent beat relabelled as talk",
           plan_fn=lambda q: q["beats"][1].update(performance="silent_action", lines=[]),
           cmd="plan", contains="script lines no beat carries")
    mutate("v2-stitch", "a T segment over a silent beat",
           plan_fn=lambda q: (q["beats"][1].update(performance="silent_action", lines=[]),
                              q["beats"][0].update(lines=["l1"], performance="voiceover",
                                                   narrator_ref=None)),
           cmd="validate", contains="talks on camera")
    mutate("v2-stitch", "a third party's clip without permission",
           plan_fn=lambda q: q["assets"][0].update(permission_ref=None), cmd="plan", contains="permission_ref")

    # ---- v2: an approved mascot, silent, narrated
    pl = lock(fixture("v2-mascot"))
    checks("v2-mascot")
    shot("v2-mascot", "01-b", "B", [], pl["beats"][0]["action"], character="whisker@v1", cast="mascot")
    video_json(pl, [{"n": 1, "type": "B", "project": "v2-mascot.01-b", "beat_ids": ["b1"], "script_lines": ["l1"],
                     "audio_from": "narration:n1"}])
    validate("v2-mascot")
    mutate("v2-mascot", "a narrator voice that is not approved",
           plan_fn=lambda q: q["narrators"][0].update(voice_ref="calm@v2"), cmd="plan", contains="narrator file")
    nf = os.path.join(HANDLE, "narrators", "calm", "narrator.json")
    keep = open(nf).read()
    wj(nf, {**json.loads(keep), "cloned_from": "@realcreator"})
    expect("v2-mascot: refuses a narrator cloned from a real person", [PY, f"{SC}/bridge.py", "plan", "v2-mascot"],
           ok=False, contains="never a clone")
    open(nf, "w").write(keep)

    # ---- v2: a verified vet, supplied speaker
    pl = lock(fixture("v2-vet"))
    checks("v2-vet")
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "vet-clip", "source_range_s": [0, 6], "beat_ids": ["b1"],
                     "script_lines": ["l1"]}])
    validate("v2-vet")
    mutate("v2-vet", "a professional basis with no credential",
           plan_fn=lambda q: q["narrators"][0].update(credential_ref=None), cmd="plan", contains="professional_basis")
    mutate("v2-vet", "a credential on a synthetic voice",
           plan_fn=lambda q: q.update(narrators=[dict(q["narrators"][0], kind="original_synthetic",
                                                      voice_ref="calm@v1", source_ref=None)]),
           cmd="plan", contains="carries no credential")

    # ---- v2: a filmed phone in supplied footage: the plate passes the same insertion gates
    pl = lock(fixture("v2-filmed-phone"))
    checks("v2-filmed-phone")
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "phone-clip", "source_range_s": [0, 5], "beat_ids": ["b1"],
                     "script_lines": [], "insert": {"mode": "in-hand", "screen_id": "scan-result"}}])
    validate("v2-filmed-phone")
    expect("v2-filmed-phone: shots.py supplied (the plate)", [PY, f"{SC}/shots.py", "supplied", "v2-filmed-phone"])
    expect("v2-filmed-phone: screens.py fill", [PY, f"{SC}/screens.py", "fill", "catapp", "scan-result",
                                                "v2-filmed-phone", "01-c"])
    plate = p("pipeline", "character", "v2-filmed-phone", "segments", "01-c", "source", "plate.mp4")
    expect("v2-filmed-phone: qc.py on the plate", [PY, f"{SC}/qc.py", "v2-filmed-phone", "01-c", plate])
    g = rj(os.path.join(os.path.dirname(plate), "qc", "gates.json"))
    flat = [r for r in g["results"] if "flat" in r["gate"]]
    ok = bool(flat) and all(r["result"] == "PASS" for r in flat)
    RESULTS.append(("v2-filmed-phone: the flat-on gate passes on the flat plate", ok))
    print(f"{'PASS' if ok else 'FAIL'}  v2-filmed-phone: the flat-on gate passes on the flat plate {flat}")
    approve_sources("v2-filmed-phone", pl)
    expect("v2-filmed-phone: gate B on the plate", [PY, f"{SC}/review.py", "segment", "v2-filmed-phone", "01-c",
                                                    "--decision", "approve", "--file", "source/plate.mp4",
                                                    "--words", "Plate is good."])
    if assemble_on:
        out = expect("v2-filmed-phone: composite.sh", ["bash", f"{SC}/composite.sh", "v2-filmed-phone", "01-c"])
        comp = sorted(f for f in os.listdir(p("pipeline", "character", "v2-filmed-phone", "segments", "01-c",
                                               "composite")) if f.endswith(".mp4"))
        expect("v2-filmed-phone: review.py composite", [PY, f"{SC}/review.py", "composite", "v2-filmed-phone", "01-c",
                                                        "--file", f"composite/{comp[-1]}", "--words", "Composite ok."])
        assemble("v2-filmed-phone", assemble_on)
    # The same path with a tilted phone: the flat-on gate fails; nothing is relaxed.
    tilted = fixture("v2-filmed-phone")
    tilted["video_id"] = "v2-tilted-phone"
    tilted["assets"][0]["path"] = "apps/catapp/media/phone-tilted.mp4"
    lock(tilted)
    video_json(tilted, [{"n": 1, "type": "C", "asset_id": "phone-clip", "source_range_s": [0, 5], "beat_ids": ["b1"],
                         "script_lines": [], "insert": {"mode": "in-hand", "screen_id": "scan-result"}}])
    expect("v2-tilted-phone: shots.py supplied", [PY, f"{SC}/shots.py", "supplied", "v2-tilted-phone"])
    expect("v2-tilted-phone: screens.py fill", [PY, f"{SC}/screens.py", "fill", "catapp", "scan-result",
                                                "v2-tilted-phone", "01-c"])
    tp = p("pipeline", "character", "v2-tilted-phone", "segments", "01-c", "source", "plate.mp4")
    run([PY, f"{SC}/qc.py", "v2-tilted-phone", "01-c", tp])
    g = rj(os.path.join(os.path.dirname(tp), "qc", "gates.json"))
    flat = [r for r in g["results"] if "flat" in r["gate"]]
    ok = bool(flat) and any(r["result"] == "FAIL" for r in flat) and not g["pass"]
    RESULTS.append(("v2-tilted-phone: the flat-on gate refuses a tilted filmed phone", ok))
    print(f"{'PASS' if ok else 'FAIL'}  v2-tilted-phone: the flat-on gate refuses a tilted filmed phone {flat}")

    print()
    bad = [l for l, ok in RESULTS if not ok]
    print(f"{len(RESULTS) - len(bad)} of {len(RESULTS)} expectations met" + (f"; failed: {len(bad)}" if bad else ""))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
