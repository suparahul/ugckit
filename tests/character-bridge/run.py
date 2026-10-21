#!/usr/bin/env python3
"""The offline test of the character pipeline's production bridge. Free: no generation,
no Supagen, no API. Not shipped (the installer copies template/ only).

    python3 tests/character-bridge/run.py [--workspace DIR] [--venv DIR] [--no-assemble]

Builds a scratch workspace from template/ (scripts/character, docs/character, the Atlas
link for the caption renderer), a handle with its world, a human character, a mascot and a
synthetic narrator, a screen library, and synthetic media made locally with ffmpeg, cv2
and macOS `say`. The "generated" segments are ffmpeg test pictures standing in for
approved generations. Then, for every fixture plan in fixtures/ (two v1, twelve v2):

  - shots.py check, the bridge plan check, shots.py validate and the bridge video check pass;
  - the B prompt passes the lint;
  - six videos are assembled end to end and pass gate C (review.py final);
  - clip-to-clip continuity (v2-continuous): the last frame of the approved first clip is
    taken with its checksum, opens the second clip's refs.json and request (REQUEST_ONLY=1),
    is checked at gate B, and the two are cut with no frame shown twice;
  - each broken copy (a mutation) is refused with the expected reason.

--venv names a Python environment with opencv and faster-whisper (requirements.txt); it is
linked as the workspace's .venv for assemble.sh. Exit 1 when any expectation fails.
"""
import copy, glob, hashlib, json, os, shutil, subprocess, sys, tempfile

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
        "identity_lock": {"face": LOCK_FACE, "hair": LOCK_HAIR},
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


X_PROMPT = """Vertical 9:16 selfie video of a woman in a small kitchen, window light from the left, handheld.
REFERENCES
keyframes/01-x.png is the first frame: composition, her pose, the light. Nothing else.
face.png is her face: identity, hair and signature details. Not its background.
STRUCTURE
One shot, no cuts.
SUBJECT
Exactly one person. Nora in her green apron, chest-up, centred, at arm's length.
SETTING
The kitchen of the set plate, no other location.
SHOT 1 (0.0 to 3.0 s)
She looks into the lens and reacts. End state: she smiles at the lens.
PERFORMANCE
She does not speak. No lip sync: her mouth never forms words.
At 0 s, brows lift and her lips press together; eyes widen at the lens; head pulls back a little.
At 1.2 s, a slow disbelieving smile spreads; eyes drop to the side, then come back to the lens; one small shake of the head.
AUDIO
Kitchen room sound only. No voice, no music.
CONSISTENCY
The same face, hair and apron as the references.
NO TEXT
No captions, no text, no watermark, no logo.
"""


def reaction(assemble_on):
    v_ = "v2-reaction"
    pl = lock(fixture(v_))
    checks(v_)
    sh = shot(v_, "01-x", "X", [], pl["beats"][0]["action"])
    sh["video"]["trim_to_seconds"] = 3
    sh["reaction"] = copy.deepcopy(pl["beats"][0]["reaction"])
    wj(p("pipeline", "character", v_, "shots", "01-x.json"), sh)
    video_json(pl, [{"n": 1, "type": "X", "project": f"{v_}.01-x", "beat_ids": ["b1"], "script_lines": []},
                    {"n": 2, "type": "R", "screen_id": "scan-result", "trim": [1, 6], "beat_ids": ["b2"],
                     "script_lines": []}])
    validate(v_)
    sd = p("pipeline", "character", v_, "segments", "01-x")
    os.makedirs(sd, exist_ok=True)
    pp = os.path.join(sd, "prompt.txt")
    open(pp, "w").write(X_PROMPT)
    expect(f"{v_}: shots.py refs", [PY, f"{SC}/shots.py", "refs", v_])
    expect(f"{v_}: lint of the X prompt", [PY, f"{SC}/lint_prompt.py", v_, "01-x"])
    for label, text, why in (
            ("a reaction without 'No lip sync'", X_PROMPT.replace("No lip sync: her mouth never forms words.", ""),
             "no lip sync"),
            ("an expression beat left out", X_PROMPT.replace("one small shake of the head", "she nods"),
             "written performance"),
            ("a prompt that names the reference post",
             X_PROMPT.replace("She looks into the lens", "Copy the reference video 7412000000000000001; she looks"),
             "no copy of the reference"),
            ("a spoken line in a reaction", X_PROMPT.replace("She does not speak.", 'She says "no way".'),
             "no spoken line")):
        open(pp, "w").write(text)
        expect(f"{v_}: lint refuses {label}", [PY, f"{SC}/lint_prompt.py", v_, "01-x"], ok=False, contains=why)
    open(pp, "w").write(X_PROMPT)
    f = gen_file(v_, "01-x", "action")
    rel = os.path.relpath(f, sd)
    rv = [PY, f"{SC}/review.py", "segment", v_, "01-x", "--decision", "approve", "--file", rel, "--words", "Keep it."]
    warns(v_, "gate B records unticked checks as not claimed", rv,
          "not claimed by the user: identity, hands, silent, performance")
    ok_checks = ["--check", "identity=pass", "--check", "hands=pass", "--check", "silent=pass",
                 "--check", "performance=pass"]
    short = os.path.join(sd, "generated", "01-x-short.mp4")
    clip(short, 2, "testsrc", 120, size="720x1280")
    expect(f"{v_}: gate B refuses a reaction shorter than planned",
           rv[:8] + ["generated/01-x-short.mp4"] + rv[9:] + ok_checks, ok=False, contains="duration gate")
    os.remove(short)
    expect(f"{v_}: gate B approves the reaction with its checks", rv + ok_checks)
    assemble(v_, assemble_on)
    if assemble_on:
        man = rj(p("pipeline", "character", v_, "assembly", "assembly.json"))
        x = [s for s in man.get("segments") or man.get("timeline") or [] if s.get("type") == "X"]
        ok = bool(x) and x[0].get("trim_by") == "trim_to_seconds"
        RESULTS.append((f"{v_}: the X segment is cut to its planned 3 s", ok))
        print(f"{'PASS' if ok else 'FAIL'}  {v_}: the X segment is cut to its planned 3 s {x[:1]}")
    # The plan: never spoken, never invented, never the clip as an input.
    mutate(v_, "a spoken reaction hook", plan_fn=lambda q: q["editorial"]["hook"].update(channel="spoken"),
           cmd="plan", contains="never spoken")
    mutate(v_, "a reaction that talks on camera",
           plan_fn=lambda q: q["beats"][0].update(performance="on_camera"), cmd="plan", contains="a reaction is silent")
    mutate(v_, "a generation_input that is not motion_copy or written",
           plan_fn=lambda q: q["reaction_refs"][0].update(generation_input=True), cmd="plan",
           contains="'motion_copy' (the default) or 'written'")
    mutate(v_, "the written route chosen up front with no reason, with a note",
           plan_fn=lambda q: q["reaction_refs"][0].pop("written_reason"), cmd="plan", ok=True, contains="chosen up front")
    mutate(v_, "a reaction with no reference post",
           plan_fn=lambda q: q["beats"][0]["reaction"].update(ref_id="r9"), cmd="plan", contains="not in reaction_refs")
    mutate(v_, "a reaction not found yet (null)", plan_fn=lambda q: q["beats"][0].update(reaction=None),
           cmd="plan", contains="never invented")
    mutate(v_, "a reaction hook without its text overlay", plan_fn=lambda q: q.update(overlays=[]),
           cmd="plan", contains="timed text overlay")
    mutate(v_, "expression beats that leave a gap",
           plan_fn=lambda q: q["beats"][0]["reaction"]["expression_beats"][1].update(start_s=1.6), cmd="plan",
           contains="the one before ends")
    mutate(v_, "a number on an overlay without fact_refs",
           plan_fn=lambda q: q["overlays"][0].update(text="9 in 10 cats do this"), cmd="plan", contains="fact_refs")
    mutate(v_, "a strategy_ref with an unknown disposition",
           plan_fn=lambda q: q["editorial"]["strategy_ref"].update(disposition="maybe"), cmd="plan",
           contains="strategy_ref.disposition")
    mutate(v_, "app_screen on a beat that does not show the app",
           plan_fn=lambda q: q["beats"][1].update(app_on_screen=False, screen_id=None, viewer_must=None),
           cmd="plan", contains="framing app_screen is the real app")
    # video.json and the shot.
    mutate(v_, "a reaction with narration laid under it",
           video_fn=lambda v: v["segments"][0].update(audio_from="narration:n1"), contains="never spoken")
    mutate(v_, "a reaction built as a B segment",
           video_fn=lambda v: v["segments"][0].update(type="B"), contains="it is an X segment")
    shp = p("pipeline", "character", v_, "shots", "01-x.json")
    mutate(v_, "a shot that changes the written performance",
           video_fn=lambda v: wj(shp, {**rj(shp), "reaction": {**rj(shp)["reaction"], "camera_distance": "far"}}),
           contains="copied exactly")
    research = "apps/catapp/research/posts/7412000000000000001/frame.png"
    picture(p(research))
    mutate(v_, "a frame of the reference reaction as a generation reference",
           video_fn=lambda v: wj(shp, {**rj(shp), "video": {**rj(shp)["video"], "references":
                                 rj(shp)["video"]["references"] + [{"file": research, "kind": "anchor"}]}}),
           contains="research footage")
    # The planning approval: a dry run is never an approval.
    vd = p("pipeline", "character", v_)
    keep = {f: open(os.path.join(vd, f)).read() for f in ("plan.json", "planning-approval.json")}
    pa = rj(os.path.join(vd, "planning-approval.json"))
    wj(os.path.join(vd, "planning-approval.json"), {**pa, "words": None, "date": None, "dry_run": True})
    q = rj(os.path.join(vd, "plan.json"))
    wj(os.path.join(vd, "plan.json"), {**q, "approved": {"words": None, "date": None}})
    expect(f"{v_}: refuses a dry-run planning approval", [PY, f"{SC}/bridge.py", "plan", v_], ok=False,
           contains="dry run")
    wj(os.path.join(vd, "plan.json"), q)
    wj(os.path.join(vd, "planning-approval.json"), {**pa, "dry_run": True})
    expect(f"{v_}: refuses dry_run even with words filled in", [PY, f"{SC}/shots.py", "check", v_], ok=False,
           contains="dry run")
    for f_, t_ in keep.items():
        open(os.path.join(vd, f_), "w").write(t_)
    # generate.sh refuses before any cost: the research frame, a voice clip on a reaction.
    ap = os.path.join(vd, "approval.json")
    a = rj(ap)
    a["gate_a_storyboard"] = {"decision": "approve", "words": "Storyboard is good."}
    wj(ap, a)
    refs = os.path.join(sd, "refs.json")
    keep_refs = open(refs).read()
    wj(refs, {"references": [{"kind": "anchor", "file": research}]})
    expect(f"{v_}: generate.sh refuses the reference reaction before any cost",
           ["bash", f"{SC}/generate.sh", v_, "01-x"], ok=False, contains="research footage", env={"ALLOW_REFS": "1"})
    wj(refs, {"references": [{"kind": "voice", "file": "characters/nora/references/voice/voice-reference.wav"}]})
    expect(f"{v_}: generate.sh refuses a voice clip on a reaction",
           ["bash", f"{SC}/generate.sh", v_, "01-x"], ok=False, contains="silent reaction", env={"ALLOW_REFS": "1"})
    open(refs, "w").write(keep_refs)
    # The legacy full-screen app beat (subject_only) is still read, with a note.
    expect("v2-live-cat: subject_only on a full-screen app beat is read as app_screen",
           [PY, f"{SC}/bridge.py", "plan", "v2-live-cat"], contains="framing app_screen")


def reference_clip(path, dur=4.0):
    """A stand-in for a downloaded reaction post: a face-like shape, a caption burned in
    across the chest and the creator's handle at the bottom edge, 720x1280."""
    import cv2, numpy as np
    w, h, fps = 720, 1280, 30
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".avi"
    vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    for i in range(int(dur * fps)):
        f = np.full((h, w, 3), (70, 110, 150), np.uint8)
        cx = 360 + int(20 * np.sin(i / 8))
        cv2.ellipse(f, (cx, 420), (150, 190), 0, 0, 360, (150, 180, 220), -1)
        cv2.rectangle(f, (170, 640), (550, 1180), (60, 60, 60), -1)
        cv2.putText(f, "4 YEARS AT THE GYM", (40, 720), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (255, 255, 255), 4, cv2.LINE_AA)
        cv2.putText(f, "@somecreator", (230, 1240), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 3, cv2.LINE_AA)
        vw.write(f)
    vw.release()
    ff("-i", tmp, "-c:v", "libx264", "-pix_fmt", "yuv420p", path)
    os.remove(tmp)


LOCK_FACE = "an oval face, a soft jaw, warm brown eyes and a small mole on the left cheek"
LOCK_HAIR = "dark brown hair in a low bun"

FR_KEYFRAME = (
    "A vertical 9:16 phone selfie video frame, the front camera at chest height; normal phone processing, true "
    "colours, no beauty filter.\n\nThe first reference picture is the woman: her face and hair exactly. The second "
    "reference picture is the pose picture: take only its pose, framing, camera angle, light and room, never its "
    f"person's face, hair, clothes or identity.\n\nThe woman: {LOCK_FACE}; {LOCK_HAIR}. Exactly one person.\n\n"
    "The pose, as in the pose picture: her face fills the upper half of the frame, her eyes on the lens.\n\n"
    "{band}\n\nNo text, no captions, no watermark, no logo.")

FR_MOTION = ("The woman in the reference image reacts to the camera exactly as the person in the reference video "
             "does, at the same moments: her brows go up, then she smiles at the lens. Keep her face, hair, clothes "
             "and the room as in the reference image. No captions and no on-screen text.")


def stub_identity(result):
    """The identity gate needs real faces; the fixtures have none. A scratch-only stand-in
    that returns `result`, or None to put the real identity.py back."""
    ip = os.path.join(WS, "scripts", "character", "identity.py")
    keep = ip + ".real"
    for c in glob.glob(os.path.join(WS, "scripts", "character", "__pycache__", "identity.*")):
        os.remove(c)        # a stale compiled copy of the other stand-in (same size, same second)
    if result is None:
        if os.path.exists(keep):
            os.replace(keep, ip)
        return
    if not os.path.exists(keep):
        shutil.copy(ip, keep)
    open(ip, "w").write(
        "def check(video, seg, rel=None):\n"
        f"    return {{'result': {result!r}, 'why': 'fixture stand-in', 'median_character': 0.6, "
        "'median_reference': 0.1, 'file': rel}\n\n"
        "def show(rec):\n    print(rec['result'])\n")


def motion_copy(assemble_on):
    """The default route (motion: Kling 3.0 Pro Motion Control), offline: the original clip
    padded to 3.0 s, the character's first frame made from the hero and the clip's first frame
    and approved at gate A by its checksum, the short prompt, the request, gate B with the
    identity gate. Then the backup route (replace) and the untested guided route."""
    v_ = "v2-motion-copy"
    fx = fixture(v_)
    ref = fx["reaction_refs"][0]
    src = p(ref["video_path"])
    reference_clip(src)
    ref["video_sha256"] = sha(src)
    pl = lock(fx)
    checks(v_)
    clip_rel = "segments/01-x/source/reference.mp4"
    frame_rel = "segments/01-x/source/first-frame.png"
    masks = [{"rect": [0, 0.9, 1, 0.1], "how": "crop", "text": "@somecreator"},
             {"rect": [0.02, 0.52, 0.96, 0.07], "how": "blur", "text": "4 YEARS AT THE GYM",
              "behind": "her grey top and the wall behind her"}]
    band = bridge_band(masks)
    sh = shot(v_, "01-x", "X", [], pl["beats"][0]["action"])
    sh["video"].update(duration_seconds=None, trim_to_seconds=2.9,
                       references=[{"file": clip_rel, "kind": "motion_clip", "role": "the motion and timing"},
                                   {"file": "keyframes/01-x.png", "kind": "keyframe",
                                    "role": "the subject and the room"}])
    sh["keyframe_prompt"] = FR_KEYFRAME.replace("{band}", band)
    sh["keyframe_references"] = [{"file": "references/face.png", "kind": "hero", "role": "her face"},
                                 {"file": frame_rel, "kind": "pose_frame", "role": "the pose and the room"}]
    sh["reaction"] = copy.deepcopy(pl["beats"][0]["reaction"])
    # No route named: the shot takes models.json motion_copy.default_route (motion).
    sh["motion_copy"] = {"ref_id": "r1", "clip": clip_rel, "range_s": [0.0, 2.9], "masks": masks}
    shp = p("pipeline", "character", v_, "shots", "01-x.json")
    wj(shp, sh)
    video_json(pl, [{"n": 1, "type": "X", "project": f"{v_}.01-x", "beat_ids": ["b1"], "script_lines": []},
                    {"n": 2, "type": "R", "screen_id": "scan-result", "trim": [1, 6], "beat_ids": ["b2"],
                     "script_lines": []}])
    # The input clip: the original, cut to the range and held on its last frame to 3.0 s.
    expect(f"{v_}: shots.py reference (the original clip, padded for Kling)", [PY, f"{SC}/shots.py", "reference", v_])
    ref_mp4 = p("pipeline", "character", v_, clip_rel)
    d_ = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ref_mp4])[1].strip()
    ok = abs(float(d_ or 0) - 3.0) < 0.1 and os.path.exists(p("pipeline", "character", v_, frame_rel))
    RESULTS.append((f"{v_}: the motion clip is the 2.9 s range held to 3.0 s, with its first frame", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: the motion clip is the 2.9 s range held to 3.0 s ({d_} s), with its first frame")
    # The character's first frame (keyframes.sh makes it; a stand-in here) and gate A by its checksum.
    vd = p("pipeline", "character", v_)
    kf = os.path.join(vd, "keyframes", "01-x.png")
    picture(kf, "tan", "720x1280")
    validate(v_)
    sd = os.path.join(vd, "segments", "01-x")
    pp = os.path.join(sd, "prompt.txt")
    open(pp, "w").write(FR_MOTION)
    expect(f"{v_}: shots.py refs (the clip, then the keyframe)", [PY, f"{SC}/shots.py", "refs", v_])
    expect(f"{v_}: lint of the motion route (the keyframe prompt and the short prompt)",
           [PY, f"{SC}/lint_prompt.py", v_, "01-x"])
    for label, kp, vp, why in (
            ("a keyframe prompt without the identity lock", sh["keyframe_prompt"].replace(LOCK_HAIR, "her hair"),
             FR_MOTION, "the identity lock's face and hair"),
            ("a keyframe prompt without the band sentence", sh["keyframe_prompt"].replace(band, ""), FR_MOTION,
             "the band sentence"),
            ("a motion prompt that names a file", None, FR_MOTION.replace("the reference image", "keyframes/01-x.png"),
             "no file name in the video prompt"),
            ("a motion prompt over 600 characters", None, FR_MOTION + " " + "She reacts. " * 50, "video prompt short")):
        wj(shp, {**sh, "keyframe_prompt": kp or sh["keyframe_prompt"]})
        open(pp, "w").write(vp)
        expect(f"{v_}: lint refuses {label}", [PY, f"{SC}/lint_prompt.py", v_, "01-x"], ok=False, contains=why)
    wj(shp, sh)
    open(pp, "w").write(FR_MOTION)
    ap = os.path.join(vd, "approval.json")
    gate_a = {"decision": "approve", "words": "Storyboard is good."}
    wj(ap, {**(rj(ap) if os.path.exists(ap) else {}), "gate_a_storyboard": gate_a})
    gen = ["bash", f"{SC}/generate.sh", v_, "01-x"]
    expect(f"{v_}: generate.sh refuses a keyframe not approved at gate A by its checksum", gen, ok=False,
           contains="not the keyframe approved at gate A", env={"ALLOW_REFS": "1", "REQUEST_ONLY": "1"})
    # Gate A from the Atlas: the click pins the keyframe by its sha256; review.py records it.
    log = p("apps", "catapp", "production", "log.jsonl")
    def atlas(kind, data, note=None, at="2026-10-20T10:00:00.000Z"):
        os.makedirs(os.path.dirname(log), exist_ok=True)
        open(log, "a").write(json.dumps({"at": at, "post": "2026-10-20/nora/1", "kind": kind,
                                         **({"note": note} if note else {}), "data": {"video": v_, **data}}) + "\n")
    atlas("storyboard.approve", {"keyframes": {"01-x": "0" * 64}, "cost_usd": 0.5})
    expect(f"{v_}: review.py storyboard --from-atlas refuses a click on another keyframe",
           [PY, f"{SC}/review.py", "storyboard", v_, "--from-atlas"], ok=False, contains="changed after the click")
    atlas("storyboard.approve", {"keyframes": {"01-x": sha(kf)}, "cost_usd": 0.5}, at="2026-10-20T10:05:00.000Z")
    expect(f"{v_}: review.py storyboard --from-atlas records gate A",
           [PY, f"{SC}/review.py", "storyboard", v_, "--from-atlas"], contains="1 keyframe(s) pinned")
    g = rj(ap)["gate_a_storyboard"]
    ok = g.get("keyframes_sha256") == {"01-x": sha(kf)} and g.get("approved_in", {}).get("atlas_line_at", "").endswith("10:05:00.000Z")
    RESULTS.append((f"{v_}: gate A from the Atlas pins the keyframe and the click", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: gate A from the Atlas pins the keyframe and the click")
    request_shape(v_, sd, sh, shp, clip_rel)
    refs = os.path.join(sd, "refs.json")
    keep_refs = open(refs).read()
    wj(refs, {"references": [{"kind": "motion_clip", "file": ref["video_path"]},
                             {"kind": "keyframe", "file": f"pipeline/character/{v_}/keyframes/01-x.png"}]})
    expect(f"{v_}: generate.sh refuses the raw research file as the clip", gen, ok=False,
           contains="Research footage is never an input", env={"ALLOW_REFS": "1"})
    open(refs, "w").write(keep_refs)
    wsd = p("pipeline", "character", "v2-reaction", "segments", "01-x")
    wrefs = os.path.join(wsd, "refs.json")
    keep_w = open(wrefs).read()
    wj(wrefs, {"references": [{"kind": "motion_clip", "file": f"pipeline/character/{v_}/{clip_rel}"}]})
    expect("v2-reaction: generate.sh refuses a clip on the written fallback",
           ["bash", f"{SC}/generate.sh", "v2-reaction", "01-x"], ok=False, contains="is a motion-copy clip",
           env={"ALLOW_REFS": "1"})
    open(wrefs, "w").write(keep_w)
    # Gate B: the checks, the identity gate, the padded length, no text.
    take = os.path.join(sd, "generated", "01-x-take1.mp4")
    os.makedirs(os.path.dirname(take), exist_ok=True)
    clip(take, 2.95, "smptebars", 120, size="720x1280", audio=False)
    rv = [PY, f"{SC}/review.py", "segment", v_, "01-x", "--decision", "approve", "--file",
          "generated/01-x-take1.mp4", "--words", "Keep it."]
    ok_checks = ["--check", "identity=pass", "--check", "no_source_identity=pass", "--check", "silent=pass"]
    warns(v_, "gate B records an unticked no-trace check as not claimed",
          rv + ["--check", "identity=pass", "--check", "silent=pass"], "not claimed by the user: no_source_identity")
    dirty = os.path.join(sd, "generated", "01-x-dirty.mp4")
    ff("-ss", "0", "-to", "2.95", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", dirty)
    # The fixture's character pictures show no face: the real gate cannot run; a warning, recorded.
    warns(v_, "gate B warns and records a take the identity gate could not run", rv + ok_checks,
          "recorded: identity NOT RUN")
    # A take whose frames show no face: NO FACE lets the eye check decide (a visible face is
    # not a requirement of motion copy), so the next gate, OCR, reads the text: a warning.
    stub_identity("NO FACE")
    warns(v_, "gate B passes a take with no face to the next check (identity NO FACE)",
          rv[:8] + ["generated/01-x-dirty.mp4"] + rv[9:] + ok_checks, "OCR reads text")
    stub_identity("FAIL")
    warns(v_, "gate B warns and records an identity FAIL", rv + ok_checks, "recorded: identity FAIL")
    # Approve anyway (2026-10-21): the gate still runs; the user's words and the result are recorded.
    keep_ap = open(ap).read() if os.path.exists(ap) else None
    expect(f"{v_}: gate B approves an identity FAIL anyway, on the user's words",
           rv[:-1] + ["It is her; the light fooled the gate.", "--accept-fail", "identity"] + ok_checks,
           contains="approved anyway: identity")
    e = [x for x in rj(ap)["gate_b_segments"] if x.get("project") == f"{v_}.01-x"][-1]
    af = (e.get("accepted_failures") or [{}])[0]
    ok = e["decision"] == "approve" and af.get("gate") == "identity" and af.get("result") == "FAIL" \
        and af.get("words") == "It is her; the light fooled the gate." and e["checks"].get("identity_gate") == "accepted failure: FAIL"
    RESULTS.append((f"{v_}: approval.json records the accepted identity failure", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: approval.json records the accepted identity failure {af}")
    atlas("take.approve", {"segment": "01-x", "file": "generated/01-x-take1.mp4", "sha256": sha(take), "accept_fail": ["identity"],
                           "checks": {"identity": "pass", "no_source_identity": "pass", "silent": "pass"}},
          at="2026-10-20T10:50:00.000Z")
    expect(f"{v_}: an Atlas approve-anyway line with no note is refused", [PY, f"{SC}/review.py", "segment", v_, "01-x",
           "--from-atlas"], ok=False, contains="has no note")
    atlas("take.approve", {"segment": "01-x", "file": "generated/01-x-take1.mp4", "sha256": sha(take), "accept_fail": ["identity"],
                           "checks": {"identity": "pass", "no_source_identity": "pass", "silent": "pass"}},
          note="Keep it, the gate is wrong here.", at="2026-10-20T10:51:00.000Z")
    expect(f"{v_}: the Atlas approve-anyway line becomes --accept-fail identity", [PY, f"{SC}/review.py", "segment", v_,
           "01-x", "--from-atlas"], contains="approved anyway: identity")
    if keep_ap is None:
        os.remove(ap)
    else:
        open(ap, "w").write(keep_ap)
    stub_identity("PASS")
    warns(v_, "gate B warns and records a file with the creator's caption and handle",
          rv[:8] + ["generated/01-x-dirty.mp4"] + rv[9:] + ok_checks, "OCR reads text on the file")
    keep_ap = open(ap).read() if os.path.exists(ap) else None
    expect(f"{v_}: gate B approves it anyway with --accept-fail ocr",
           rv[:8] + ["generated/01-x-dirty.mp4"] + rv[9:] + ok_checks + ["--accept-fail", "ocr"], contains="ocr FAIL")
    if keep_ap is None:
        os.remove(ap)
    else:
        open(ap, "w").write(keep_ap)
    os.remove(dirty)
    long_ = os.path.join(sd, "generated", "01-x-long.mp4")
    clip(long_, 5, "smptebars", 120, size="720x1280")
    expect(f"{v_}: gate B refuses a file longer than the padded clip",
           rv[:8] + ["generated/01-x-long.mp4"] + rv[9:] + ok_checks, ok=False, contains="length gate")
    os.remove(long_)
    # Gate B from the Atlas: the take by its sha256 and the ticked checks; a changed file is refused.
    atlas("take.approve", {"segment": "01-x", "file": "generated/01-x-take1.mp4", "sha256": "0" * 64,
                           "checks": {"identity": "pass", "no_source_identity": "pass", "silent": "pass"}},
          at="2026-10-20T11:00:00.000Z")
    fa = [PY, f"{SC}/review.py", "segment", v_, "01-x", "--from-atlas"]
    expect(f"{v_}: review.py segment --from-atlas refuses a take changed after the click", fa, ok=False,
           contains="changed after the click")
    atlas("take.approve", {"segment": "01-x", "file": "generated/01-x-take1.mp4", "sha256": sha(take),
                           "checks": {"identity": "pass", "no_source_identity": "pass", "silent": "pass"}},
          at="2026-10-20T11:05:00.000Z")
    expect(f"{v_}: gate B approves the motion take (2.95 s of the 3.0 s padded clip) from the Atlas click", fa)
    e = [x for x in rj(ap)["gate_b_segments"] if x.get("project") == f"{v_}.01-x"][-1]
    ok = e.get("decision") == "approve" and e.get("atlas_line_at", "").endswith("11:05:00.000Z") and e.get("sha256") == sha(take)
    RESULTS.append((f"{v_}: the gate B row names the click and the take's sha256", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: the gate B row names the click and the take's sha256")
    stub_identity(None)
    assemble(v_, assemble_on)
    stub_identity("PASS")
    guided_gate_b(v_, sd, sh, shp)
    stub_identity(None)
    # The plan and the shot.
    mutate(v_, "a motion-copy beat that is not the clip's length",
           plan_fn=lambda q: q["reaction_refs"][0].update(end_s=3.5), cmd="plan", contains="lasts its clip's range")
    mutate(v_, "a set on a motion-copy beat", plan_fn=lambda q: q["beats"][0].update(set_id="kitchen"),
           cmd="plan", contains="has no set_id")
    mutate(v_, "a motion-copy clip with no checksum",
           plan_fn=lambda q: q["reaction_refs"][0].update(video_sha256=None), cmd="plan", contains="video_sha256")
    keep_src = open(src, "rb").read()
    open(src, "ab").write(b"\0")
    expect(f"{v_}: refuses a reference post changed after the lock", [PY, f"{SC}/shots.py", "check", v_],
           ok=False, contains="does not match its video_sha256")
    open(src, "wb").write(keep_src)
    mutate(v_, "burned-in text with no mask",
           video_fn=lambda v: wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "masks": []}}),
           contains="masks it before generation")
    mutate(v_, "a shot range that is not the reference range",
           video_fn=lambda v: wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "range_s": [0.5, 3.4]}}),
           contains="motion_copy.range_s")
    mutate(v_, "a crop mask in the middle of the frame",
           video_fn=lambda v: wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "masks": [
               {"rect": [0.02, 0.52, 0.96, 0.07], "how": "crop", "text": "x"}]}}), contains="lies at an edge")
    mutate(v_, "a motion shot without its keyframe",
           video_fn=lambda v: wj(shp, {**sh, "video": {**sh["video"], "references": sh["video"]["references"][:1]}}),
           contains="and the shot's own keyframe")
    mutate(v_, "a motion keyframe not made from the clip's first frame",
           video_fn=lambda v: wj(shp, {**sh, "keyframe_references": sh["keyframe_references"][:1]}),
           contains="the clip's first frame")
    mutate(v_, "the retired edit route",
           video_fn=lambda v: wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "route": "edit"}}),
           contains="is retired")
    mutate(v_, "a motion-copy length that is not the clip's",
           video_fn=lambda v: wj(shp, {**sh, "video": {**sh["video"], "trim_to_seconds": 3}}),
           contains="its clip's 2.9 s")
    mutate(v_, "a clip on the written fallback",
           plan_fn=lambda q: q["reaction_refs"][0].update(generation_input="written", written_reason="the take failed"),
           contains="the user's fallback, no clip")
    mutate(v_, "a clip on the written fallback by its old name (none)",
           plan_fn=lambda q: q["reaction_refs"][0].update(generation_input="none"),
           contains="only an X segment by motion copy")
    old_names(v_, sh, shp)


def old_names(v_, sh, shp):
    """A video made before 2026-10-19 keeps its names: generation_input face_replace in the
    locked plan, the shot's face_replace block, the kinds face_replace_clip and
    face_replace_frame, and capabilities.json bridge.face_replace. Nothing rewrites them."""
    vd = p("pipeline", "character", v_)
    keep = {f: open(os.path.join(vd, f)).read() for f in ("plan.json", "planning-approval.json")}
    pl = rj(os.path.join(vd, "plan.json"))
    pl["reaction_refs"][0]["generation_input"] = "face_replace"
    lock(pl)
    old_kind = {"motion_clip": "face_replace_clip", "pose_frame": "face_replace_frame"}
    old = {k: v for k, v in sh.items() if k != "motion_copy"}
    old["face_replace"] = sh["motion_copy"]
    old["video"] = {**sh["video"], "references": [{**r, "kind": old_kind.get(r["kind"], r["kind"])}
                                                  for r in sh["video"]["references"]]}
    old["keyframe_references"] = [{**r, "kind": old_kind.get(r["kind"], r["kind"])} for r in sh["keyframe_references"]]
    wj(shp, old)
    refs = os.path.join(vd, "segments", "01-x", "refs.json")
    keep_refs = open(refs).read()
    wj(refs, {**rj(refs), "references": [{**r, "kind": old_kind.get(r["kind"], r["kind"])}
                                         for r in rj(refs)["references"]]})
    cp = os.path.join(WS, "scripts", "character", "capabilities.json")
    keep_c = open(cp).read()
    c = json.loads(keep_c)
    c["bridge.face_replace"] = c.pop("bridge.motion_copy")
    wj(cp, c)
    try:
        expect(f"{v_}: the old names: bridge.py plan", [PY, f"{SC}/bridge.py", "plan", v_])
        expect(f"{v_}: the old names: shots.py validate", [PY, f"{SC}/shots.py", "validate", v_])
        expect(f"{v_}: the old names: lint_prompt.py", [PY, f"{SC}/lint_prompt.py", v_, "01-x"])
        expect(f"{v_}: the old names: generate.sh REQUEST_ONLY on the motion route",
               ["bash", f"{SC}/generate.sh", v_, "01-x"], contains="MOTION COPY, motion route",
               env={"ALLOW_REFS": "1", "REQUEST_ONLY": "1"})
        c["bridge.face_replace"] = False
        wj(cp, c)
        expect(f"{v_}: the old names: bridge.face_replace false still stops a live run",
               ["bash", f"{SC}/generate.sh", v_, "01-x"], ok=False, contains="bridge.motion_copy is false",
               env={"ALLOW_REFS": "1", "CONFIRM": "1"})
    finally:
        for f, t in keep.items():
            open(os.path.join(vd, f), "w").write(t)
        open(refs, "w").write(keep_refs)
        open(cp, "w").write(keep_c)
        wj(shp, sh)


def bridge_band(masks):
    sys.path.insert(0, os.path.join(WS, "scripts", "character"))
    import bridge
    return " ".join(bridge.band_sentence(masks, "picture"))


def request_shape(v_, sd, sh, shp, clip_rel):
    """The routes, offline: the request generate.sh would send (REQUEST_ONLY=1, placeholder
    file ids, no upload, no run), the cost it quotes, and the stops before spend."""
    gen = ["bash", f"{SC}/generate.sh", v_, "01-x"]
    clip_file = f"pipeline/character/{v_}/{clip_rel}"
    kf_file = f"pipeline/character/{v_}/keyframes/01-x.png"
    face = "apps/catapp/handles/nora/references/face.png"
    rq = os.path.join(sd, "generated", "request-draft.json")

    def shape(label, tpl, model, cost, prompt, parts_want, trim):
        out = expect(f"{v_}: generate.sh REQUEST_ONLY, {label}", gen, env={"ALLOW_REFS": "1", "REQUEST_ONLY": "1"})
        req = rj(rq) if os.path.exists(rq) else {}
        parts = ((req.get("messages") or [{}])[0]).get("content") or []
        texts = [x.get("text") for x in parts if x.get("type") == "text"]
        got = [(x.get("type"), (x.get("source") or {}).get("file_id")) for x in parts if x.get("type") != "text"]
        ok = (req.get("template_slug") == tpl and texts == ([prompt] if prompt else []) and got == parts_want
              and f"model       {model}" in out and f"est. cost   {cost}" in out and ("trim to 2.9s" in out) == trim)
        RESULTS.append((f"{v_}: the {label} request: {tpl}", ok))
        print(f"{'PASS' if ok else 'FAIL'}  {v_}: the {label} request: {tpl}, {cost}")
        if not ok:
            print("      " + json.dumps({"template": req.get("template_slug"), "texts": texts, "parts": got}) + "\n      "
                  + "\n      ".join(out.strip().splitlines()[-10:]))
        if os.path.exists(rq):
            os.remove(rq)
        return out

    # motion (the default): the prompt, the clip held to 3.0 s, then the approved keyframe; 3 s x $0.168.
    shape("the motion route (default)", "ugc-character-face-kling-motion", "kling-v3-0-pro-motion-control", "$0.50",
          FR_MOTION, [("video", f"offline:{clip_file}"), ("image", f"offline:{kf_file}")], False)
    # The live stops: capabilities.json false refuses; true reaches the cost prompt and stops without CONFIRM.
    cp = os.path.join(WS, "scripts", "character", "capabilities.json")
    keep_c = open(cp).read()
    wj(cp, {**json.loads(keep_c), "bridge.motion_copy": False})
    expect(f"{v_}: generate.sh stops before any cost when motion copy is switched off", gen, ok=False,
           contains="bridge.motion_copy is false", env={"ALLOW_REFS": "1", "CONFIRM": "1"})
    open(cp, "w").write(keep_c)
    expect(f"{v_}: the motion route stops at the cost prompt without CONFIRM", gen, ok=False,
           contains="This would spend $0.50", env={"ALLOW_REFS": "1"})
    # replace (the backup): the original clip, unpadded, then one face picture; no prompt; per frame.
    rep = {**sh, "motion_copy": {**sh["motion_copy"], "route": "replace"},
           "video": {**sh["video"], "references": [sh["video"]["references"][0],
                                                   {"file": "references/face.png", "kind": "hero", "role": "her face"}]}}
    wj(shp, rep)
    expect(f"{v_}: shots.py reference for the replace route (no padding)", [PY, f"{SC}/shots.py", "reference", v_])
    expect(f"{v_}: shots.py refs for the replace route", [PY, f"{SC}/shots.py", "refs", v_])
    out = shape("the replace route (backup)", "ugc-character-face-animate-replace", "wan-2-2-animate-replace", "$0.44",
                None, [("video", f"offline:{clip_file}"), ("image", f"offline:{face}")], False)
    # Back to the default route and its padded clip.
    wj(shp, sh)
    expect(f"{v_}: shots.py reference for the motion route again", [PY, f"{SC}/shots.py", "reference", v_])
    expect(f"{v_}: shots.py refs for the motion route again", [PY, f"{SC}/shots.py", "refs", v_])
    for label, change, why in (
            ("a motion shot with a length of its own", {"duration_seconds": 5}, "has no length of its own"),):
        wj(shp, {**sh, "video": {**sh["video"], **change}})
        expect(f"{v_}: shots.py validate refuses {label}", [PY, f"{SC}/shots.py", "validate", v_], ok=False, contains=why)
        expect(f"{v_}: generate.sh refuses {label}", gen, ok=False, contains=why,
               env={"ALLOW_REFS": "1", "REQUEST_ONLY": "1"})
    wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "route": "edit"}})
    expect(f"{v_}: generate.sh refuses the retired edit route", gen, ok=False, contains="is retired",
           env={"ALLOW_REFS": "1", "REQUEST_ONLY": "1"})
    two = {**sh, "video": {**sh["video"], "references": sh["video"]["references"] + [
        {"file": "references/face.png", "kind": "hero", "role": "a second picture"}]}}
    wj(shp, two)
    expect(f"{v_}: shots.py validate refuses two pictures on the motion route (Kling takes one)",
           [PY, f"{SC}/shots.py", "validate", v_], ok=False, contains="at most 1")
    wj(shp, sh)
    for m in ("wan-2-7-edit-video", "kling-v3-0-pro-motion-control"):
        expect(f"{v_}: state.py refuses {m} as the segment model",
               [PY, f"{SC}/state.py", "model", "set", m, "5"], ok=False, contains="never as the segment model")


def guided_gate_b(v_, sd, sh, shp):
    """Gate B on the guided route (untested with a paid run): a new clip of 5 s, at least the
    clip's length, trimmed at assembly, with the check that the reaction follows the clip."""
    wj(shp, {**sh, "motion_copy": {**sh["motion_copy"], "route": "guided"}, "video": {**sh["video"], "duration_seconds": 5}})
    rv = [PY, f"{SC}/review.py", "segment", v_, "01-x", "--decision", "approve", "--words", "Keep it.",
          "--check", "identity=pass", "--check", "no_source_identity=pass", "--check", "silent=pass"]
    g5 = os.path.join(sd, "generated", "01-x-guided.mp4")
    clip(g5, 5, "smptebars", 120, size="720x1280")
    warns(v_, "gate B records an unticked follows_reference as not claimed", rv + ["--file", "generated/01-x-guided.mp4"],
          "not claimed by the user: follows_reference")
    g2 = os.path.join(sd, "generated", "01-x-short.mp4")
    clip(g2, 2, "smptebars", 120, size="720x1280")
    expect(f"{v_}: gate B refuses a guided take shorter than the clip",
           rv + ["--file", "generated/01-x-short.mp4", "--check", "follows_reference=pass"], ok=False, contains="length gate")
    expect(f"{v_}: gate B approves a 5 s guided take (trimmed at assembly)",
           rv + ["--file", "generated/01-x-guided.mp4", "--check", "follows_reference=pass"])
    for f in (g5, g2):
        os.remove(f)
    wj(shp, sh)


CONT_PROMPT = B_PROMPT.replace(
    "keyframes/01-b.png is the first frame: composition, the counter, the light. Nothing else.",
    "last-frame.png is the first frame: the last frame of 01-b, where this take begins. Nothing else.").replace(
    "Her hands set two bowls a body length apart for Pip and Biscuit. End state: both cats eat, her hands rest on the counter.",
    "Her hands stay on the counter while both cats keep eating. End state: both cats eat, her hands rest on the counter.")


def continuous_takes(dir_, name="take"):
    """One moving 10 s take split in two, as a model that honours its first frame would make
    them: 01-b is 0 to 5 s; 02-b opens on 01-b's last frame (frame 149), then goes on."""
    full = os.path.join(dir_, "full.mp4")
    clip(full, 10, "testsrc", 220, size="720x1280")
    a = p("pipeline", "character", "v2-continuous", "segments", "01-b", "generated", f"01-b-{name}1.mp4")
    b = p("pipeline", "character", "v2-continuous", "segments", "02-b", "generated", f"02-b-{name}1.mp4")
    for f in (a, b):
        os.makedirs(os.path.dirname(f), exist_ok=True)
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", "-c:a", "aac"]
    ff("-i", full, "-t", "5", *enc, a)
    ff("-ss", f"{149 / 30:.6f}", "-i", full, "-t", f"{151 / 30:.6f}", *enc, b)
    os.remove(full)
    return a, b


def continuity_test(assemble_on):
    """Clip-to-clip continuity: 02-b continues from 01-b. The last frame of the approved 01-b
    is taken with its checksum, put in 02-b's refs.json in the keyframe's place, sent in the
    request (REQUEST_ONLY=1, nothing spent), checked at gate B, and cut without a repeated
    frame at assembly. Each refusal names its reason."""
    v_ = "v2-continuous"
    sys.path.insert(0, SC)
    import continuity
    pl = lock(fixture(v_))
    checks(v_)
    vd = p("pipeline", "character", v_)
    for n, b in (("01-b", pl["beats"][0]), ("02-b", pl["beats"][1])):
        shot(v_, n, "B", [], b["action"], subjects=["pip", "biscuit"], framing="hands_only")
    shp = os.path.join(vd, "shots", "02-b.json")
    wj(shp, {**rj(shp), "continuity": {"from": "01-b"}})
    video_json(pl, [{"n": 1, "type": "B", "project": f"{v_}.01-b", "beat_ids": ["b1"], "script_lines": ["l1"],
                     "audio_from": "narration:n1"},
                    {"n": 2, "type": "B", "project": f"{v_}.02-b", "beat_ids": ["b2"], "script_lines": ["l2"],
                     "audio_from": "narration:n2"}])
    expect(f"{v_}: shots.py validate, the frame pending before gate A", [PY, f"{SC}/shots.py", "validate", v_],
           contains="taken when 01-b is approved")
    expect(f"{v_}: bridge video", [PY, f"{SC}/bridge.py", "video", v_])
    expect(f"{v_}: shots.py refs", [PY, f"{SC}/shots.py", "refs", v_], contains="opens on the last frame of 01-b")
    frame = f"pipeline/character/{v_}/segments/01-b/last-frame.png"
    r2 = rj(os.path.join(vd, "segments", "02-b", "refs.json"))["references"]
    ok = r2[0]["file"] == frame and r2[0]["kind"] == "neighbour-frame" and not any(r["kind"] == "keyframe" for r in r2) \
        and len(r2) == 4
    RESULTS.append((f"{v_}: refs.json opens on 01-b's last frame, in the keyframe's place", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: refs.json opens on 01-b's last frame, in the keyframe's place")
    r1 = rj(os.path.join(vd, "segments", "01-b", "refs.json"))["references"]
    ok = r1[0]["kind"] == "keyframe" and not any(r["kind"] == "neighbour-frame" for r in r1)
    RESULTS.append((f"{v_}: the first clip keeps its own keyframe", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: the first clip keeps its own keyframe")
    pp = os.path.join(vd, "segments", "02-b", "prompt.txt")
    open(pp, "w").write(CONT_PROMPT)
    expect(f"{v_}: lint of the continuing prompt", [PY, f"{SC}/lint_prompt.py", v_, "02-b"])
    open(pp, "w").write(CONT_PROMPT.replace("last-frame.png is the first frame", "last-frame.png is the look"))
    expect(f"{v_}: lint refuses a last frame not bound as the first frame", [PY, f"{SC}/lint_prompt.py", v_, "02-b"],
           ok=False, contains="the last frame bound as the first frame")
    open(pp, "w").write(CONT_PROMPT)
    # Gate A: from here the frame is a production input.
    ap = os.path.join(vd, "approval.json")
    wj(ap, {**(rj(ap) if os.path.exists(ap) else {}),
            "gate_a_storyboard": {"decision": "approve", "words": "Storyboard is good."}})
    expect(f"{v_}: shots.py validate refuses a continuing shot before its previous clip is approved",
           [PY, f"{SC}/shots.py", "validate", v_], ok=False, contains="no approved clip at gate B yet")
    expect(f"{v_}: state.py model set (the default, 5 s)",
           [PY, f"{SC}/state.py", "model", "set", "minimax-h3-max-reference-to-video", "5"])
    gen = ["bash", f"{SC}/generate.sh", v_, "02-b"]
    ro = {"ALLOW_REFS": "1", "REQUEST_ONLY": "1"}
    expect(f"{v_}: generate.sh refuses the continuing segment before any cost", gen, ok=False,
           contains="no approved clip at gate B yet", env=ro)
    # 01-b approved: its last frame is taken, with its checksum.
    a, b = continuous_takes(p("pipeline", "character", v_))
    expect(f"{v_}: gate B 01-b takes its last frame",
           [PY, f"{SC}/review.py", "segment", v_, "01-b", "--decision", "approve", "--file",
            "generated/01-b-take1.mp4", "--words", "Keep it."], contains="last-frame.png (frame 149 of 150")
    lf = rj(os.path.join(vd, "segments", "01-b", "last-frame.json"))
    png = p(frame)
    d_ = continuity.diff(continuity.gray(png), continuity.gray(a, 149))
    ok = (lf["frame_index"] == 149 and abs(lf["out_s"] - 5.0) < 0.002 and lf["sha256"] == sha(png)
          and lf["source_sha256"] == sha(a) and d_ is not None and d_ < 1.0)
    RESULTS.append((f"{v_}: last-frame.json: frame 149, the cut at 5.0 s, both checksums; the PNG is that frame", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: last-frame.json: frame 149, the cut at 5.0 s, both checksums "
          f"({lf['frame_index']}, {lf['out_s']}, diff {d_})")
    expect(f"{v_}: continuity.py check", [PY, f"{SC}/continuity.py", "check", v_], contains="02-b continues from 01-b")
    validate(v_)
    # The request, offline: the frame is the first image part. The take's seed record.
    out = expect(f"{v_}: generate.sh REQUEST_ONLY, the continuing segment", gen, env=ro)
    rq = os.path.join(vd, "segments", "02-b", "generated", "request-draft.json")
    req = rj(rq) if os.path.exists(rq) else {}
    parts = ((req.get("messages") or [{}])[0]).get("content") or []
    shape = [(x.get("type"), (x.get("source") or {}).get("file_id")) for x in parts[1:]]
    seed = os.path.join(vd, "segments", "02-b", "generated", f"{v_}.02-b-draft.seed.json")
    ok = (req.get("template_slug") == "ugc-character" and shape[:1] == [("image", f"offline:{frame}")]
          and len(shape) == 4 and "continuity  from 01-b: last-frame.png" in out and "UNVERIFIED" in out
          and os.path.exists(seed) and rj(seed).get("sha256") == lf["sha256"])
    RESULTS.append((f"{v_}: the request carries 01-b's last frame as the first image; the seed is recorded", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: the request carries 01-b's last frame as the first image; the seed is "
          f"recorded {shape[:1]}")
    if not ok:
        print("      " + "\n      ".join(out.strip().splitlines()[-10:]))
    for f in (rq, seed):
        if os.path.exists(f):
            os.remove(f)
    gd = os.path.join(vd, "segments", "02-b", "generated")
    expect(f"{v_}: generate.sh without CONFIRM stops at the cost", gen, ok=False, contains="This would spend $0.40",
           env={"ALLOW_REFS": "1"})
    left = glob.glob(os.path.join(gd, "*.seed.json"))
    RESULTS.append((f"{v_}: a run stopped at the cost leaves no seed record", not left))
    print(f"{'PASS' if not left else 'FAIL'}  {v_}: a run stopped at the cost leaves no seed record {left}")
    # Refusals before any cost: refs.json not rewritten; a model that cannot continue.
    refs = os.path.join(vd, "segments", "02-b", "refs.json")
    keep_refs = open(refs).read()
    wj(refs, {"references": [x for x in rj(refs)["references"] if x["kind"] != "neighbour-frame"]})
    expect(f"{v_}: generate.sh refuses refs.json without the last frame", gen, ok=False, contains="once, first",
           env={**ro, "REQUEST_ONLY": "1"})
    open(refs, "w").write(keep_refs)
    mp = os.path.join(SC, "models.json")
    keep_m = open(mp).read()
    m = json.loads(keep_m)
    m["known_model_limits"]["minimax-h3-max-reference-to-video"]["continuity"]["input"] = "none"
    wj(mp, m)
    expect(f"{v_}: generate.sh refuses a model with no continuity input", gen, ok=False,
           contains="has continuity input 'none'", env=ro)
    expect(f"{v_}: shots.py validate refuses a model with no continuity input", [PY, f"{SC}/shots.py", "validate", v_],
           ok=False, contains="has no continuity input")
    open(mp, "w").write(keep_m)
    # Gate B of the continuing take: the seed record, and that it is the current frame.
    rv = [PY, f"{SC}/review.py", "segment", v_, "02-b", "--decision", "approve", "--file",
          "generated/02-b-take1.mp4", "--words", "Keep it."]
    expect(f"{v_}: gate B refuses a continuing take with no seed record", rv, ok=False, contains="seed.json is missing")
    sj = b[:-4] + ".seed.json"
    wj(sj, {"from": "01-b", "file": frame, "sha256": "0" * 64})
    expect(f"{v_}: gate B refuses a take seeded with another frame", rv, ok=False, contains="seeded with another last frame")
    wj(sj, {"from": "01-b", "file": frame, "sha256": lf["sha256"], "model": "minimax-h3-max-reference-to-video"})
    out = expect(f"{v_}: gate B approves the continuing take", rv, contains="differs from the last frame of 01-b by")
    e = [x for x in rj(ap)["gate_b_segments"] if x["project"] == f"{v_}.02-b"][-1]
    ok = (e.get("continuity") or {}).get("last_frame_sha256") == lf["sha256"] and \
        (e["checks"].get("seed_diff") is not None and e["checks"]["seed_diff"] < 1.0)
    RESULTS.append((f"{v_}: gate B records the seed frame and its match", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v_}: gate B records the seed frame and its match ({e.get('checks')})")
    narration_take(v_, "n1", pl["script"][0]["line"], "l1")
    narration_take(v_, "n2", pl["script"][1]["line"], "l2")
    if assemble_on:
        assemble(v_, assemble_on)
        man = rj(os.path.join(vd, "assembly", "assembly.json"))
        sg = {x["name"]: x for x in man["segments"]}
        c = (sg.get("02-b") or {}).get("continuity") or {}
        cut = c.get("cut") or {}
        ok = (abs(sg["01-b"]["out"] - 5.0) < 0.002 and "continues from it" in sg["01-b"]["trim_by"]
              and 0.03 <= sg["02-b"]["in"] <= 0.034 and cut.get("dropped_diff") is not None
              and cut["dropped_diff"] < 0.5 and cut["shown_diff"] > 3 * cut["dropped_diff"] + 0.2
              and (man["checks"].get("continuous cut 01-b > 02-b") or {}).get("result") == "PASS")
        RESULTS.append((f"{v_}: 01-b ends at its last frame, 02-b starts at its second: no frame shown twice", ok))
        print(f"{'PASS' if ok else 'FAIL'}  {v_}: 01-b ends at its last frame, 02-b starts at its second: no frame "
              f"shown twice ({sg['01-b']['out']}, {sg['02-b']['in']}, {cut})")
        d2 = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                  os.path.join(vd, "assembly", f"{v_}.mp4")])[1].strip()
        ok = abs(float(d2 or 0) - (5 + 151 / 30 - 1 / 30)) < 0.05
        RESULTS.append((f"{v_}: the file is the two clips less the one dropped frame", ok))
        print(f"{'PASS' if ok else 'FAIL'}  {v_}: the file is the two clips less the one dropped frame ({d2} s)")
    # 01-b approved again with another take: the frame changes, so 02-b is stale everywhere.
    t2 = os.path.join(os.path.dirname(a), "01-b-take2.mp4")
    clip(t2, 5, "smptebars", 220, size="720x1280")
    expect(f"{v_}: a new approval of 01-b warns that 02-b is stale",
           [PY, f"{SC}/review.py", "segment", v_, "01-b", "--decision", "approve", "--file", "generated/01-b-take2.mp4",
            "--words", "Use the second."], contains="02-b was approved from another last frame")
    if assemble_on:
        expect(f"{v_}: assemble refuses a continuing take seeded with an old frame",
               ["bash", f"{SC}/assemble.sh", v_], ok=False, contains="not seeded with the current last frame")
    expect(f"{v_}: generate.sh REQUEST_ONLY uses the new frame", gen, env=ro,
           contains=f"sha256 {sha(p(frame))[:12]}")
    for f in glob.glob(os.path.join(vd, "segments", "02-b", "generated", "*draft*")):
        os.remove(f)
    expect(f"{v_}: gate B 01-b, the first take again", [PY, f"{SC}/review.py", "segment", v_, "01-b", "--decision",
                                                       "approve", "--file", "generated/01-b-take1.mp4", "--words", "Keep it."])
    expect(f"{v_}: the first take's frame is current again", [PY, f"{SC}/continuity.py", "check", v_])
    # A frame changed by hand, a cut changed after the frame was taken.
    keep_png = open(png, "rb").read()
    open(png, "ab").write(b"\0")
    expect(f"{v_}: refuses a last frame changed after it was taken", [PY, f"{SC}/continuity.py", "check", v_],
           ok=False, contains="changed after it was taken")
    open(png, "wb").write(keep_png)
    mutate(v_, "a cut of the previous clip changed after its last frame was taken",
           video_fn=lambda v: v["segments"][0].update(trim=[0, 4]), cmd=[PY, f"{SC}/continuity.py", "check", v_],
           contains="the cut of 01-b changed")
    # The shot and video.json.
    mutate(v_, "a continuation from a segment that is not the one before",
           video_fn=lambda v: wj(shp, {**rj(shp), "continuity": {"from": "03-b"}}), contains="right before it")
    mutate(v_, "a continuing shot in another set",
           video_fn=lambda v: wj(shp, {**rj(shp), "set_ref": "hallway"}), contains="stays in its set")
    mutate(v_, "a neighbour frame written by hand on a continuing shot",
           video_fn=lambda v: wj(shp, {**rj(shp), "video": {**rj(shp)["video"], "references": rj(shp)["video"]["references"]
                                       + [{"file": frame, "kind": "neighbour-frame"}]}}),
           contains="list no neighbour-frame by hand")
    mutate(v_, "a trim on a continuing segment", video_fn=lambda v: v["segments"][1].update(trim=[0.5, 5]),
           contains="no trim in video.json")
    mutate(v_, "a punch-in on one side of a continuous cut", video_fn=lambda v: v["segments"][1].update(punch_in=1.1),
           contains="keeps one framing")
    mutate(v_, "a beat that continues with no continuing shot",
           video_fn=lambda v: wj(shp, {k: x for k, x in rj(shp).items() if k != "continuity"}),
           contains='declares "continuity"')
    # The plan.
    mutate(v_, "continues_previous on the first beat", plan_fn=lambda q: q["beats"][0].update(continues_previous=True),
           cmd="plan", contains="on the first beat")
    mutate(v_, "continues_previous across two sets", plan_fn=lambda q: q["beats"][1].update(set_id="hallway"),
           cmd="plan", contains="stays in the set of the beat before")
    mutate(v_, "continues_previous after supplied media",
           plan_fn=lambda q: q["beats"][0].update(source_asset_ids=["milo-clip"]), cmd="plan",
           contains="joins two generated clips")
    # A motion-copy reaction neither continues nor is continued.
    fv = "v2-motion-copy"
    fsp = p("pipeline", "character", fv, "shots", "01-x.json")
    keep_f = open(fsp).read()
    vj = p("pipeline", "character", fv, "video.json")
    keep_v = open(vj).read()
    v2 = rj(vj)
    v2["segments"].insert(0, {"n": 0, "type": "T", "project": f"{fv}.00-t", "beat_ids": ["b1"], "script_lines": []})
    wj(vj, v2)
    wj(fsp, {**json.loads(keep_f), "continuity": {"from": "00-t"}})
    expect(f"{fv}: shots.py validate refuses a motion-copy reaction that continues a clip",
           [PY, f"{SC}/shots.py", "validate", fv], ok=False, contains="is a motion-copy reaction: its motion")
    open(fsp, "w").write(keep_f)
    open(vj, "w").write(keep_v)


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


def atlas_line(video, kind, data, note=None, at="2026-10-22T09:00:00.000Z"):
    """One user line in the video's app log, as the Atlas writes it."""
    app = rj(p("pipeline", "character", video, "plan.json")).get("app")
    log = p("apps", app, "production", "log.jsonl")
    os.makedirs(os.path.dirname(log), exist_ok=True)
    open(log, "a").write(json.dumps({"at": at, "post": f"x/{video}", "kind": kind, **({"note": note} if note else {}),
                                     "data": {"video": video, **data}}) + "\n")


def atlas_source(video, plan):
    """Gate B for a supplied file from the Atlas: pending lists the click, --from-atlas records it."""
    a = next(x for x in plan.get("assets") or [] if x["kind"] != "screen")
    atlas_line(video, "source.approve", {"asset_id": a["id"], "file": a["path"], "sha256": sha(p(a["path"]))})
    expect(f"{video}: review.py pending lists the source click", [PY, f"{SC}/review.py", "pending", video],
           contains=f"review.py source {video} {a['id']} --from-atlas")
    expect(f"{video}: review.py source --from-atlas records it", [PY, f"{SC}/review.py", "source", video, a["id"], "--from-atlas"],
           contains=f"gate B source: {a['id']} approve")
    e = [x for x in rj(p("pipeline", "character", video, "approval.json"))["gate_b_sources"] if x["asset_id"] == a["id"]][-1]
    ok = e.get("atlas_line_at") == "2026-10-22T09:00:00.000Z"
    RESULTS.append((f"{video}: the source row names the click", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {video}: the source row names the click")
    expect(f"{video}: nothing pending after the record", [PY, f"{SC}/review.py", "pending", video], contains="no Atlas click waits")


def atlas_narration(video, take, text, lines):
    """A narration take from the Atlas: the natural-voice check on the line; a changed file is refused."""
    f = p("pipeline", "character", video, "narration", f"{take}.wav")
    speech(f, text)
    atlas_line(video, "narration.approve", {"take": take, "file": f"narration/{take}.wav", "sha256": "0" * 64, "narrator": "calm",
                                            "lines": lines.split(","), "checks": {"natural_voice": "pass"}})
    expect(f"{video}: review.py narration --from-atlas refuses a take changed after the click",
           [PY, f"{SC}/review.py", "narration", video, take, "--from-atlas"], ok=False, contains="changed after the click")
    atlas_line(video, "narration.approve", {"take": take, "file": f"narration/{take}.wav", "sha256": sha(f), "narrator": "calm",
                                            "lines": lines.split(","), "checks": {"natural_voice": "pass"}}, at="2026-10-22T09:05:00.000Z")
    expect(f"{video}: review.py narration --from-atlas records the take",
           [PY, f"{SC}/review.py", "narration", video, take, "--from-atlas"], contains=f"gate B narration: {take}")


def gate_c_anyway(video):
    """Gate C with a failed overlay check (2026-10-21): refused, then approved anyway on the user's
    words; the overlays not the plan's are never accepted."""
    vd = p("pipeline", "character", video)
    keep = {f: open(os.path.join(vd, f)).read() for f in ("assembly/assembly.json", "approval.json")}
    man = rj(os.path.join(vd, "assembly", "assembly.json"))
    man["checks"]["overlays readable"] = {"result": "FAIL", "detail": "the paragraph is up 1.2 s; it needs 2.4 s"}
    wj(os.path.join(vd, "assembly", "assembly.json"), man)
    fin = [PY, f"{SC}/review.py", "final", video, "--decision", "approve", "--words", "Fast is fine, it is a teaser."]
    warns(video, "gate C warns and records a failed overlay check", fin, "recorded: overlays FAIL")
    expect(f"{video}: gate C approves it anyway with --accept-fail overlays", fin + ["--accept-fail", "overlays"],
           contains="gate C: " + video + " approve")
    af = (rj(os.path.join(vd, "approval.json"))["gate_c_final"].get("accepted_failures") or [{}])[0]
    ok = af.get("gate") == "overlays" and af.get("result") == "FAIL" and af.get("words") == "Fast is fine, it is a teaser."
    RESULTS.append((f"{video}: gate_c_final records the accepted overlay failure", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {video}: gate_c_final records the accepted overlay failure {af}")
    man["checks"]["overlays as planned"] = {"result": "FAIL", "detail": "video.json overlays are not the plan's"}
    wj(os.path.join(vd, "assembly", "assembly.json"), man)
    expect(f"{video}: overlays not the plan's are never approved anyway", fin + ["--accept-fail", "overlays"], ok=False,
           contains="the cut is not the plan's")
    for f, t in keep.items():
        open(os.path.join(vd, f), "w").write(t)


def narration_anyway(video, take, text, lines):
    """A narrator's take without the natural-voice check: refused, then approved anyway on the user's words."""
    f = p("pipeline", "character", video, "narration", f"{take}.wav")
    speech(f, text)
    ap = p("pipeline", "character", video, "approval.json")
    keep = open(ap).read() if os.path.exists(ap) else None
    base = [PY, f"{SC}/review.py", "narration", video, take, "--narrator", "calm", "--lines", lines, "--decision", "approve",
            "--words", "The flat read is the joke."]
    warns(video, "narration without the natural-voice check: recorded as not claimed", base,
          "not claimed by the user: natural_voice")
    expect(f"{video}: narration approved anyway with --accept-fail voice", base + ["--accept-fail", "voice"],
           contains=f"gate B narration: {take}")
    row = rj(ap)["gate_b_narration"][-1]
    af = (row.get("accepted_failures") or [{}])[0]
    ok = af.get("gate") == "voice" and af.get("words") == "The flat read is the joke."
    RESULTS.append((f"{video}: the narration row records the accepted voice check", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {video}: the narration row records the accepted voice check {af}")
    if keep is None:
        os.remove(ap)
    else:
        open(ap, "w").write(keep)


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


def warns(video, label, cmd, contains):
    """An approval over a failed gate or an unticked check (2026-10-21): it goes through with a
    warning and a record. The video's JSON files are put back after, so the next test starts
    from the same approvals."""
    vd = p("pipeline", "character", video)
    keep = {f: open(os.path.join(vd, f)).read() for f in os.listdir(vd) if f.endswith(".json")}
    expect(f"{video}: {label}", cmd, contains=contains)
    for f in os.listdir(vd):
        if f.endswith(".json") and f not in keep:
            os.remove(os.path.join(vd, f))
    for f, t in keep.items():
        open(os.path.join(vd, f), "w").write(t)


def mutate(name, label, plan_fn=None, video_fn=None, cmd="validate", contains=None, relock=True, ok=False):
    """A broken copy of a fixture video, refused with the expected reason (or, with ok, a
    choice of the user's, allowed with the expected note). The original is restored after."""
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
             "plan": [PY, f"{SC}/bridge.py", "plan", name]}.get(cmd, cmd) if isinstance(cmd, str) else cmd
        expect(f"{name}: {'allows' if ok else 'refuses'} {label}", c, ok=ok, contains=contains)
    finally:
        for f, t in keep.items():
            open(os.path.join(vd, f), "w").write(t)
        for f, t in shots_keep.items():
            open(os.path.join(vd, "shots", f), "w").write(t)


MD_PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 390px; height: 844px; overflow: hidden; background: #FFF8F0; font-family: -apple-system, system-ui, sans-serif; }
.l { position: absolute; inset: 0; }
h1 { position: absolute; left: 24px; top: 80px; font: 700 30px/1.2 -apple-system, system-ui; color: #222; }
#up { position: absolute; left: 24px; right: 24px; top: 160px; padding: 18px; border-radius: 16px; background: #FF9F89;
  color: #fff; font: 700 22px/1.2 -apple-system, system-ui; text-align: center; }
#res { position: absolute; left: 24px; right: 24px; top: 160px; padding: 22px; border-radius: 18px; background: #fff;
  border: 1px solid #eee; }
#res h2 { font: 800 34px/1.2 -apple-system, system-ui; color: #222; }
#res p { margin-top: 10px; font: 500 22px/1.4 -apple-system, system-ui; color: #444; }
#clock { position: absolute; left: 30px; top: 16px; font: 600 17px/22px -apple-system; }
</style></head><body>
<div id="clock">9:41</div>
<h1>Tail reading</h1>
<div class="l" id="a"><div id="up">Upload a clip</div></div>
<div class="l" id="b" style="visibility:hidden"><div id="res"><h2 data-hero>Relaxed tail</h2><p>Held high, a slow sway.</p></div></div>
EXTRA
<script>
window.SCREEN_PT = [390, 844];
function seek(t) {
  const press = t >= 1500 && t < 1650;
  document.getElementById("up").style.transform = press ? "scale(0.96)" : "none";
  document.getElementById("a").style.visibility = t < 2500 ? "visible" : "hidden";
  const b = document.getElementById("b");
  b.style.visibility = t >= 2500 ? "visible" : "hidden";
  b.style.opacity = Math.min(1, Math.max(0, (t - 2500) / 300));
}
window.seek = seek; window.DURATION = 5000; seek(0);
</script></body></html>
"""


def motion_design_test(assemble_on):
    """Motion design (founder, 2026-10-19): an R segment rebuilt from the app's real screens,
    rendered locally, gated, approved at gate B, laid in at assembly; and every refusal."""
    v = "v2-motion-design"
    open(p("apps", "catapp", "PRODUCT-SCREENS.md"), "w").write(
        "# catapp — product screens\n\n## How to choose\n\nMatch the story.\n\n## Tail Reading\n\n"
        "**Kind:** screen\n**Shows:** the owner's clip, then the reading: \"Tail reading\", \"Upload a clip\", the "
        "posture in one or two words (\"Relaxed tail\") and one line on what it means.\n"
        "**Source:** code `src/screens/TailReading.tsx`.\n")
    pl = lock(fixture(v))
    checks(v)
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "milo-clip", "source_range_s": [1, 5], "beat_ids": ["b1"],
                     "script_lines": []},
                    {"n": 2, "type": "R", "screen_id": "tail-reading", "beat_ids": ["b2"], "script_lines": []}])
    validate(v)
    expect(f"{v}: the plan check notes the library's recordings and the reason",
           [PY, f"{SC}/bridge.py", "plan", v], contains="motion design, while the screen library holds scan-result")
    mutate(v, "motion design with no reason, with a note", plan_fn=lambda q: q["beats"][1].update(demo_source_reason=None),
           cmd="plan", ok=True, contains="no demo_source_reason")
    mutate(v, "motion design of a screen the library records, with a note (the user's choice)",
           plan_fn=lambda q: (q["beats"][1].update(screen_id="scan-result"),
                              q["hero_strings"].update({"scan-result": "Relaxed tail"})),
           cmd="plan", ok=True, contains="looks more like an advert")
    mutate(v, "a screen that PRODUCT-SCREENS.md does not describe",
           plan_fn=lambda q: q["beats"][1]["screen_story"].update(screens=["Tail Scanner"]),
           cmd="plan", contains="is not a heading of PRODUCT-SCREENS.md")
    mutate(v, "a hero string the story does not show",
           plan_fn=lambda q: q["hero_strings"].update({"tail-reading": "Happy cat"}),
           cmd="plan", contains="is not one of the strings its screen_story shows")
    mutate(v, "a tap with no target",
           plan_fn=lambda q: q["beats"][1]["screen_story"]["steps"][1].update(target=None),
           cmd="plan", contains="names its target")
    mutate(v, "a live_use video with a motion-designed result, with a note",
           plan_fn=lambda q: q["editorial"].update(filming_format="live_use"), cmd="plan", ok=True,
           contains="looks more like an advert")
    mutate(v, "a live_use video with a motion-designed result, through shots.py validate",
           plan_fn=lambda q: q["editorial"].update(filming_format="live_use"), ok=True)
    mutate(v, "a motion-designed beat in a generated segment",
           video_fn=lambda x: x["segments"][1].update(type="B", project=f"{v}.02-b"),
           contains="the app is never in a generated action")
    expect(f"{v}: generate.sh refuses the app screen", ["bash", f"{SC}/generate.sh", v, "02-r"], ok=False,
           contains="a video model never generates an app screen")
    expect(f"{v}: motion_design.py start", [PY, f"{SC}/motion_design.py", "start", v, "02-r"],
           contains="Tail Reading")
    md = p("pipeline", "character", v, "segments", "02-r", "motion")
    have_browser = subprocess.run(["node", "-e", "1"], capture_output=True).returncode == 0
    if not have_browser:
        print("SKIP  the render needs node, playwright-core and Chrome")
        return
    # A page with an interface line the story does not hold: the story-text gate refuses it.
    open(os.path.join(md, "index.html"), "w").write(MD_PAGE.replace("EXTRA", '<div style="position:absolute;bottom:60px;left:24px">Try premium free</div>'))
    out = expect(f"{v}: render (an invented line)", [PY, f"{SC}/motion_design.py", "render", v, "02-r"])
    if "no playwright-core" in out or "no Chrome" in out:
        print("SKIP  the render needs playwright-core and Chrome")
        return
    expect(f"{v}: the gates refuse an invented interface line", [PY, f"{SC}/motion_design.py", "check", v, "02-r"],
           ok=False, contains="not in the story: ")
    warns(v, "gate B warns and records the failed render", [PY, f"{SC}/review.py", "motion", v, "02-r",
          "--decision", "approve", "--words", "Looks good."], "recorded: story_text FAIL")
    eye = ["--check", "text=pass", "--check", "hero=pass"]
    expect(f"{v}: --accept-fail names a known gate", [PY, f"{SC}/review.py", "motion", v, "02-r", "--decision", "approve",
           "--words", "Keep it.", "--accept-fail", "vibes"] + eye, ok=False, contains="--accept-fail 'vibes'")
    expect(f"{v}: gate B approves the failed render anyway, on the user's words",
           [PY, f"{SC}/review.py", "motion", v, "02-r", "--decision", "approve", "--words", "The extra line is fine.",
            "--accept-fail", "story_text"] + eye, contains="approved anyway: story_text")
    row = rj(p("pipeline", "character", v, "approval.json"))["gate_b_motion"][-1]
    af = (row.get("accepted_failures") or [{}])[0]
    ok = row["decision"] == "approve" and af.get("gate") == "story_text" and af.get("result") == "FAIL" \
        and af.get("words") == "The extra line is fine." and "Try premium free" in str(af.get("detail"))
    RESULTS.append((f"{v}: approval.json records the gate, its result and the words", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v}: approval.json records the gate, its result and the words {af}")
    # The page of the story, word for word.
    open(os.path.join(md, "index.html"), "w").write(MD_PAGE.replace("EXTRA", ""))
    expect(f"{v}: render", [PY, f"{SC}/motion_design.py", "render", v, "02-r"])
    out = expect(f"{v}: every gate passes", [PY, f"{SC}/motion_design.py", "check", v, "02-r"], contains="no gate failed")
    g = rj(os.path.join(md, "gates.json"))
    ok = all(r["result"] in ("PASS", "NOT RUN") for r in g["results"]) and g.get("hero") and g["hero"]["rect"][2] > 0
    RESULTS.append((f"{v}: the gates record the hero's place", bool(ok)))
    print(f"{'PASS' if ok else 'FAIL'}  {v}: the gates record the hero's place {g.get('hero')}")
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", os.path.join(md, "render.mp4")], capture_output=True, text=True).stdout.strip()
    RESULTS.append((f"{v}: the render is 1080x1920", pr == "1080,1920"))
    print(f"{'PASS' if pr == '1080,1920' else 'FAIL'}  {v}: the render is 1080x1920 ({pr})")
    # A web address and an unlisted picture: refused without a new render.
    keep = open(os.path.join(md, "index.html")).read()
    open(os.path.join(md, "index.html"), "w").write(keep.replace("</body>", '<img src="https://cdn.example.com/x.png"></body>'))
    picture(os.path.join(md, "assets", "stray.png"), "red", "64x64")
    out = expect(f"{v}: the gates refuse a web address and an unlisted picture",
                 [PY, f"{SC}/motion_design.py", "check", v, "02-r"], ok=False, contains="local_only")
    ok = "stray.png is not in assets.json" in out and "changed since the render" in out
    RESULTS.append((f"{v}: ... and name the picture and the stale render", ok))
    print(f"{'PASS' if ok else 'FAIL'}  {v}: ... and name the picture and the stale render")
    expect(f"{v}: a stale render is never approved anyway", [PY, f"{SC}/review.py", "motion", v, "02-r", "--decision",
           "approve", "--words", "Ship it.", "--accept-fail", "local_only", "--accept-fail", "assets"] + eye,
           ok=False, contains="cannot approve: current failed")
    open(os.path.join(md, "index.html"), "w").write(keep)
    os.remove(os.path.join(md, "assets", "stray.png"))
    expect(f"{v}: the gates pass again", [PY, f"{SC}/motion_design.py", "check", v, "02-r"])
    words = ["--decision", "approve", "--words", "Yes, that is the app's tail reading."]
    if any(r["result"] == "NOT RUN" for r in g["results"]):
        words += ["--check", "text=pass", "--check", "hero=pass"]
    approve_sources(v, pl)
    expect(f"{v}: gate B approves the render", [PY, f"{SC}/review.py", "motion", v, "02-r"] + words,
           contains="gate B motion design: 02-r approve")
    expect(f"{v}: review.py show names it", [PY, f"{SC}/review.py", "show", v], contains="motion design: rendered")
    out = assemble(v, assemble_on)
    if assemble_on:
        a = rj(p("pipeline", "character", v, "assembly", "assembly.json"))
        seg = next((e for e in a.get("timeline") or a.get("segments") or [] if e.get("name") == "02-r"), {})
        ok = seg.get("demo_source") == "motion_design" and (seg.get("hero") or {}).get("text") == "Relaxed tail"
        RESULTS.append((f"{v}: assembly lays in the approved render, with its hero", ok))
        print(f"{'PASS' if ok else 'FAIL'}  {v}: assembly lays in the approved render, with its hero")
    # The render changes after the approval: assembly refuses it.
    with open(os.path.join(md, "render.mp4"), "ab") as f:
        f.write(b"\0")
    expect(f"{v}: assembly refuses a render that is not the approved one", ["bash", f"{SC}/assemble.sh", v], ok=False,
           contains="the approved render is not the one on disk")


MD_STORY = {"screens": ["Tail Reading"], "rebuilt_from": ["code src/screens/TailReading.tsx"], "fit": "pad", "steps": [
    {"at_s": 0, "screen": "Tail Reading", "action": "appear", "target": None, "shows": ["Tail reading", "Upload a clip"]},
    {"at_s": 1.5, "screen": "Tail Reading", "action": "tap", "target": "Upload a clip", "shows": ["Tail reading", "Upload a clip"]},
    {"at_s": 2.5, "screen": "Tail Reading", "action": "result", "target": None,
     "shows": ["Tail reading", "Relaxed tail", "Held high, a slow sway."]}]}


def md_render(v, seg, label):
    """Start, write the story's page, render, check and approve one motion-designed segment.
    False when the machine cannot render (no browser): the caller skips the rest."""
    expect(f"{v}: motion_design.py start {seg}", [PY, f"{SC}/motion_design.py", "start", v, seg], contains="fit screen")
    md = p("pipeline", "character", v, "segments", seg, "motion")
    open(os.path.join(md, "index.html"), "w").write(MD_PAGE.replace("EXTRA", ""))
    out = expect(f"{v}: render {seg} ({label})", [PY, f"{SC}/motion_design.py", "render", v, seg])
    if "no playwright-core" in out or "no Chrome" in out or "needs node" in out:
        print(f"SKIP  {v}: the render needs node, playwright-core and Chrome")
        return False
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", os.path.join(md, "render.mp4")], capture_output=True, text=True).stdout.strip()
    RESULTS.append((f"{v}: the {label} render is the bare screen, 1080x2338", pr == "1080,2338"))
    print(f"{'PASS' if pr == '1080,2338' else 'FAIL'}  {v}: the {label} render is the bare screen, 1080x2338 ({pr})")
    expect(f"{v}: every gate passes on {seg}", [PY, f"{SC}/motion_design.py", "check", v, seg], contains="no gate failed")
    g = rj(os.path.join(md, "gates.json"))
    eye = ["--check", "text=pass", "--check", "hero=pass"] if any(r["result"] == "NOT RUN" for r in g["results"]) else []
    expect(f"{v}: gate B approves the {label} render", [PY, f"{SC}/review.py", "motion", v, seg, "--decision", "approve",
           "--words", "That is the app."] + eye, contains=f"gate B motion design: {seg} approve")
    return True


def screens_recipe_test():
    """The capture recipe of a screen recording is guidance (2026-10-21): screens.py check warns."""
    sj = p("apps", "catapp", "screens", "screens.json")
    keep = open(sj).read()
    lib = json.loads(keep)
    lib["screens"][0].update(expired=True, events=[{"t": 0.2, "gesture": "tap", "label": "a"},
                                                    {"t": 0.4, "gesture": "tap", "label": "b"},
                                                    {"t": 1.0, "gesture": "scroll", "label": "c"},
                                                    {"t": 2.0, "gesture": "tap", "label": "d"},
                                                    {"t": 5.5, "gesture": "tap", "label": "e"}])
    wj(sj, lib)
    out = expect("screens.py check warns on the capture recipe and an expired row, never refuses",
                 [PY, f"{SC}/screens.py", "check", "catapp", "scan-result"])
    ok = all(w in out for w in ("marked expired", "5 gestures", "stable frame 0.5 s", "holds 1 s", "pauses 0.4 s"))
    RESULTS.append(("screens.py check names each recipe warning", ok))
    print(f"{'PASS' if ok else 'FAIL'}  screens.py check names each recipe warning")
    open(sj, "w").write(keep)


def motion_phone_test(assemble_on):
    """Motion design on a phone (2026-10-21): the filmed phone of v2-filmed-phone shows a
    motion-designed screen. The render (fit screen) is approved at gate B, `fill` writes the
    insert.json, composite.sh lays it into the green screen, and assembly uses the composite."""
    v = "v2-phone-motion"
    pl = fixture("v2-filmed-phone")
    pl["video_id"] = v
    pl["beats"][0].update(screen_id="tail-reading", demo_source="motion_design",
                          demo_source_reason="the user chose the rebuilt screen", screen_story=MD_STORY)
    pl["hero_strings"] = {"tail-reading": "Relaxed tail"}
    pl = lock(pl)
    checks(v)
    expect(f"{v}: the plan check notes motion design on a phone", [PY, f"{SC}/bridge.py", "plan", v],
           contains="motion design on a phone or in a panel")
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "phone-clip", "source_range_s": [0, 5], "beat_ids": ["b1"],
                     "script_lines": [], "insert": {"mode": "in-hand", "screen_id": "tail-reading"}}])
    validate(v)
    expect(f"{v}: shots.py supplied (the plate)", [PY, f"{SC}/shots.py", "supplied", v])
    expect(f"{v}: fill refuses a render not approved yet", [PY, f"{SC}/motion_design.py", "fill", v, "01-c"], ok=False,
           contains="no motion/render.mp4")
    if not md_render(v, "01-c", "phone"):
        return
    expect(f"{v}: motion_design.py fill", [PY, f"{SC}/motion_design.py", "fill", v, "01-c"], contains="in-hand, recording")
    ins = rj(p("pipeline", "character", v, "segments", "01-c", "insert.json"))
    ok = ins.get("source", "").endswith("segments/01-c/motion/render.mp4") and ins.get("source_kind") == "recording" \
        and (ins.get("motion_design") or {}).get("sha256") and (ins.get("hero") or {}).get("text") == "Relaxed tail" \
        and [b["label"] for b in ins.get("beats") or []] == ["start", "Upload a clip", "end"]
    RESULTS.append((f"{v}: insert.json takes the approved render, its hero and its tap", bool(ok)))
    print(f"{'PASS' if ok else 'FAIL'}  {v}: insert.json takes the approved render, its hero and its tap")
    plate = p("pipeline", "character", v, "segments", "01-c", "source", "plate.mp4")
    expect(f"{v}: qc.py on the plate", [PY, f"{SC}/qc.py", v, "01-c", plate])
    approve_sources(v, pl)
    expect(f"{v}: gate B on the plate", [PY, f"{SC}/review.py", "segment", v, "01-c", "--decision", "approve",
                                         "--file", "source/plate.mp4", "--words", "Plate is good."])
    if not assemble_on:
        return
    expect(f"{v}: composite.sh lays the render into the phone", ["bash", f"{SC}/composite.sh", v, "01-c"])
    cd = p("pipeline", "character", v, "segments", "01-c", "composite")
    comp = sorted(f for f in os.listdir(cd) if f.endswith(".mp4"))
    expect(f"{v}: review.py composite", [PY, f"{SC}/review.py", "composite", v, "01-c", "--file", f"composite/{comp[-1]}",
                                         "--words", "Composite ok."])
    assemble(v, assemble_on)
    # The render is approved again after the composite: the composite and assembly refuse the old one.
    rp = p("pipeline", "character", v, "segments", "01-c", "motion", "render.mp4")
    with open(rp, "ab") as f:
        f.write(b"\0")
    expect(f"{v}: composite.sh refuses a render that is not the approved one", ["bash", f"{SC}/composite.sh", v, "01-c"],
           ok=False, contains="the approved render is not the one on disk")
    expect(f"{v}: assembly refuses the composite of an old render", ["bash", f"{SC}/assemble.sh", v], ok=False,
           contains="the motion-designed screen in the phone")


def motion_panel_test(assemble_on):
    """Motion design in a panel (2026-10-21): the real clip beside the rebuilt screen, one M segment."""
    v = "v2-panel-motion"
    pl = fixture("v2-motion-design")
    pl["video_id"] = v
    b = pl["beats"][1]
    b.update(framing="hands_only", layout="split_screen", source_asset_ids=["milo-clip"],
             panels=[{"id": "cat", "asset_id": "milo-clip", "source_range_s": [1, 6], "rect": [0, 0, 0.5, 1], "crop": "cover",
                      "sync_offset_s": 0},
                     {"id": "app", "screen_id": "tail-reading", "rect": [0.5, 0, 0.5, 1], "crop": "cover", "sync_offset_s": 0}])
    pl = lock(pl)
    checks(v)
    video_json(pl, [{"n": 1, "type": "C", "asset_id": "milo-clip", "source_range_s": [1, 5], "beat_ids": ["b1"],
                     "script_lines": []},
                    {"n": 2, "type": "M", "beat_ids": ["b2"], "script_lines": [], "panels": [
                        {"id": "cat", "asset_id": "milo-clip", "source_range_s": [1, 6], "rect": [0, 0, 0.5, 1], "crop": "cover",
                         "sync_offset_s": 0},
                        {"id": "app", "screen_id": "tail-reading", "rect": [0.5, 0, 0.5, 1], "crop": "cover", "sync_offset_s": 0}]}])
    validate(v)
    mutate(v, "a motion-designed beat whose M segment names no panel of its screen",
           video_fn=lambda x: x["segments"][1]["panels"][1].update(screen_id="scan-result"), contains="a panel names its screen_id")
    if not md_render(v, "02-m", "panel"):
        return
    approve_sources(v, pl)
    assemble(v, assemble_on)


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
    atlas_source("v2-live-cat", pl)
    approve_sources("v2-live-cat", pl)
    assemble("v2-live-cat", assemble_on)
    mutate("v2-live-cat", "a real cat generated",
           plan_fn=lambda q: q["beats"][0].update(source_asset_ids=[], set_id="kitchen"),
           cmd="plan", contains="real animal")
    mutate("v2-live-cat", "a recording trim that misses the measured result",
           video_fn=lambda v: v["segments"][1].update(trim=[4, 6]), contains="does not show the result")
    mutate("v2-live-cat", "live_use without a paired recording, with a note",
           plan_fn=lambda q: q["assets"][1].update(paired_input_ref=None), cmd="plan", ok=True,
           contains="reads as a staged demonstration")
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
    atlas_narration("v2-hands-two-cats", "n1", pl["script"][0]["line"], "l1")
    narration_take("v2-hands-two-cats", "n2", pl["script"][1]["line"], "l2")
    warns("v2-hands-two-cats", "gate B records a take without the natural-voice check as not claimed",
          [PY, f"{SC}/review.py", "narration", "v2-hands-two-cats", "n1", "--narrator", "calm", "--lines", "l1",
           "--decision", "approve", "--words", "ok"], "not claimed by the user: natural_voice")
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
    mutate("v2-split", "speech over the ceiling, with a note (the user's choice)",
           plan_fn=lambda q: q["script"][0].update(line=" ".join(["word"] * 40)), cmd="plan", ok=True,
           contains="it may sound rushed")
    narration_anyway("v2-split", "n1", pl["script"][0]["line"], "l1")
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
    if assemble_on:
        gate_c_anyway("v2-diary")
    mutate("v2-diary", "a progress log with no day counter, with a note (the user's choice)",
           plan_fn=lambda q: q.update(overlays=q["overlays"][1:]), cmd="plan", ok=True, contains="no day_counter overlay")
    mutate("v2-diary", "a paragraph too short to read, with a note (the user's choice)",
           plan_fn=lambda q: q["overlays"][2].update(end_s=8), cmd="plan", ok=True, contains="reading it takes")
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

    # ---- v2: a silent reaction hook (X), then the real app full frame (app_screen, R)
    reaction(assemble_on)
    # ---- v2: the same hook by motion copy: the reference clip, trimmed and masked
    motion_copy(assemble_on)
    # ---- v2: one take over two clips: 02-b opens on the last frame of 01-b
    continuity_test(assemble_on)
    motion_design_test(assemble_on)
    motion_phone_test(assemble_on)
    motion_panel_test(assemble_on)
    screens_recipe_test()

    print()
    bad = [l for l, ok in RESULTS if not ok]
    print(f"{len(RESULTS) - len(bad)} of {len(RESULTS)} expectations met" + (f"; failed: {len(bad)}" if bad else ""))
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
