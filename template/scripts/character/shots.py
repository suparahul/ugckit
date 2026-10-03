#!/usr/bin/env python3
"""P1 helper of the character pipeline (the `character-shots` skill). Free; no generation.

    shots.py check <video>              the locked plan and its pinned characters, before P1
    shots.py validate <video>           video.json and the shot files against the plan
    shots.py refs <video> [segment]     write segments/<seg>/refs.json (and insert.json for a
                                        phone segment) from the shot files
    shots.py job <video> [--only a,b]   write keyframes/keyframes-job.json and the instruction
                                        for the Codex image tool (scripts/character/keyframes.sh)
    shots.py verify <video> [--only a,b]  every keyframe is a real 1080x1920 picture
    shots.py storyboard <video>         keyframes/storyboard.jpg, the sheet of gate A
    shots.py supplied <video> [segment] the plate of a C segment that shows a filmed phone
                                        (segments/<seg>/source/plate.mp4) and its insert.json

A v2 plan (schema_version 2) is also checked by scripts/character/bridge.py: check runs
its plan checks, validate compares video.json with the plan's beats, words and overlays.

<video> is a folder under pipeline/character/. Paths inside a shot file: keyframes/... is
the video's folder; apps/... and pipeline/... are the workspace; anything else is the
handle's folder (apps/<slug>/handles/<handle>/). Exit 1 when a check fails.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS = os.path.join(ROOT, "scripts", "character", "models.json")
STATE = os.path.join(ROOT, "pipeline", "character", "state.json")

# X: a silent reaction, the handle's own face with no voice and no lip sync.
GENERATED = ["T", "O", "G", "S", "H", "F", "B", "X"]
# R, P: the real recording; C: supplied media (a clip or a still); M: panels side by side
# or one inside another. None is generated.
NOT_GENERATED = ["R", "P", "C", "M"]
PHONE = ["O", "G", "S", "H", "F"]
APP_TYPES = PHONE + ["R", "P"]
INSERT_MODE = {"O": "over-shoulder", "G": "in-hand", "S": "show-to-camera", "H": "push", "F": "finger"}
# The only reference kinds a generation may carry (template/AGENTS.md, the character
# pipeline). Never an app UI, a screenshot or a screen recording.
GEN_KINDS = {"keyframe", "hero", "anchor", "subject", "set", "neighbour-frame", "voice"}
KEYFRAME_KINDS = {"hero", "anchor", "subject", "set", "keyframe"}
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac")
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp")
KEYFRAME_SIZE = (1080, 1920)
# Who is in a keyframe, by the shot's framing_kind. "Exactly one person" holds only where
# a face is in the frame.
PEOPLE = {
    "face": "Exactly one person.",
    "hands_only": "Only one person's hands and forearms are in the picture: no face, no second person.",
    "subject_only": "No person in the picture, no hand, no body part: only the subjects named.",
}
MAX_WORDS_PER_S = 3.75          # 15 words per 4 s
STATUS_OK = {"video-setup", "live"}

PROBLEMS, NOTES = [], []
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bridge


def bad(msg):
    PROBLEMS.append(msg)
    print(f"  ✗ {msg}")


def note(msg):
    NOTES.append(msg)
    print(f"  ! {msg}")


def good(msg):
    print(f"  ✓ {msg}")


def finish():
    print()
    if PROBLEMS:
        print(f"{len(PROBLEMS)} problem(s). Fix them before going on.")
        sys.exit(1)
    print("ok" + (f", {len(NOTES)} note(s)" if NOTES else ""))


def load(p):
    with open(p) as f:
        return json.load(f)


def placeholder(v):
    return v is None or (isinstance(v, str) and (not v.strip() or "<" in v))


def vdir(video):
    return os.path.join(ROOT, "pipeline", "character", video)


def plan_of(video):
    p = os.path.join(vdir(video), "plan.json")
    if not os.path.exists(p):
        sys.exit(f"no {os.path.relpath(p, ROOT)} -- production starts only from a locked, "
                 "approved plan; write it from docs/character/plan.example.json with the user")
    return load(p)


def handle_dir(plan):
    return os.path.join(ROOT, "apps", plan["app"], "handles", plan["handle"].lstrip("@"))


def resolve(video, plan, rel):
    """A path from a shot file, to an absolute path."""
    if rel.startswith("keyframes/") or rel.startswith("segments/"):
        return os.path.join(vdir(video), rel)
    if rel.startswith("apps/") or rel.startswith("pipeline/"):
        return os.path.join(ROOT, rel)
    return os.path.join(handle_dir(plan), rel)


def model_limits():
    spec = load(MODELS)
    slug = None
    if os.path.exists(STATE):
        slug = (load(STATE).get("model") or {}).get("slug")
    slug = slug or spec["default"]
    return slug, spec["known_model_limits"].get(slug, {})


def pins(plan):
    out = []
    for c in plan.get("characters") or []:
        m = re.fullmatch(r"([a-z0-9][a-z0-9._-]*)@v(\d+)", str(c))
        out.append((c, m.group(1), int(m.group(2))) if m else (c, None, None))
    return out


def creator_for(plan, cid, ver):
    """The creator file of a pinned version: creator.json when it is that version, else
    the frozen versions/v<n>.json."""
    cdir = os.path.join(handle_dir(plan), "characters", cid)
    cur = os.path.join(cdir, "creator.json")
    if not os.path.exists(cur):
        return None, cur
    c = load(cur)
    if str(c.get("version")) == f"v{ver}":
        return c, cur
    frozen = os.path.join(cdir, "versions", f"v{ver}.json")
    return (load(frozen), frozen) if os.path.exists(frozen) else (None, frozen)


# ---------------------------------------------------------------------------- check
def cmd_check(video):
    plan = plan_of(video)
    print(f"plan  pipeline/character/{video}/plan.json")
    v2 = bridge.is_v2(plan)
    # A v2 plan may leave the set and outfit maps empty: entirely supplied or subject-only
    # media has no generated person to dress.
    for k in ("video_id", "app", "handle", "characters", "format", "app_insertion", "script",
              "beats", "approved") + (() if v2 else ("set", "outfit")):
        if k not in plan:
            bad(f"plan has no '{k}'")
    if PROBLEMS:
        finish()
    plan.setdefault("set", {})
    plan.setdefault("outfit", {})
    if plan["video_id"] != video:
        bad(f"plan video_id '{plan['video_id']}' is not the folder name '{video}'")
    ap = plan.get("approved") or {}
    if placeholder(ap.get("words")) or placeholder(ap.get("date")):
        bad("the plan is not approved: 'approved' needs the user's words and the date")
    else:
        good(f"approved {ap['date']}: \"{ap['words']}\"")
    fmt = plan.get("format") or {}
    if fmt.get("dimension") != "9:16":
        bad(f"format.dimension is {fmt.get('dimension')!r}; 9:16 is the only size for now")
    if not isinstance(fmt.get("length_s"), (int, float)):
        bad("format.length_s must be a number of seconds")
    ins = plan.get("app_insertion")
    if not isinstance(ins, bool):
        bad("app_insertion must be true or false")

    # The frozen script and the beats.
    ids = [l.get("id") for l in plan["script"]]
    if len(ids) != len(set(ids)):
        bad("two script lines share an id")
    char_ids = {cid for _, cid, _ in pins(plan) if cid}
    for l in plan["script"]:
        if placeholder(l.get("line")):
            bad(f"script line {l.get('id')} has no words")
        if l.get("speaker") not in char_ids | {"vo"}:
            bad(f"script line {l.get('id')}: speaker {l.get('speaker')!r} is not a pinned character or 'vo'")
    used = []
    for i, b in enumerate(plan["beats"], 1):
        for lid in b.get("lines") or []:
            if lid not in ids:
                bad(f"beat {i} names line {lid!r}, which the script does not have")
            used.append(lid)
        on = b.get("app_on_screen")
        if ins is False and (on not in (False, None) or b.get("screen_id")):
            bad(f"beat {i} shows the app, but app_insertion is false")
        if ins is True and on is True:
            sid = b.get("screen_id")
            if placeholder(sid):
                bad(f"beat {i} shows the app but names no screen_id")
            else:
                screens = os.path.join(ROOT, "apps", plan["app"], "screens", "SCREENS.md")
                if not os.path.exists(screens):
                    bad(f"beat {i} needs screen {sid}, but apps/{plan['app']}/screens/SCREENS.md "
                        "does not exist -- the user provides the recordings first")
                elif sid not in open(screens).read():
                    bad(f"beat {i}: screen {sid} is not in SCREENS.md")
                if placeholder((plan.get("hero_strings") or {}).get(sid)):
                    note(f"beat {i}: no hero string for screen {sid}")
            if b.get("viewer_must") not in ("read", "recognise", "believe"):
                bad(f"beat {i}: viewer_must is read | recognise | believe")
    missing = [i for i in ids if i not in used]
    if missing:
        bad(f"script lines no beat carries: {', '.join(missing)}")
    if not PROBLEMS:
        good(f"{len(ids)} frozen line(s) in {len(plan['beats'])} beat(s); app_insertion "
             f"{'true' if ins else 'false'}")
    if v2:
        bridge.check_plan(plan, bridge.Out(bad, note, good), script_checked=True)

    # The pinned characters and the handle's world.
    hdir = handle_dir(plan)
    if not os.path.isdir(hdir):
        bad(f"no handle folder {os.path.relpath(hdir, ROOT)}")
        finish()
    world_p = os.path.join(hdir, "world.json")
    world = load(world_p) if os.path.exists(world_p) else {"fixed_subjects": [], "sets": []}
    if not os.path.exists(world_p):
        bad("the handle has no world.json -- run persona-identity (the video half)")
    sets = {s.get("id"): s for s in world.get("sets") or []}
    subjects = {s.get("id"): s for s in world.get("fixed_subjects") or []}
    beat_sets = {b.get("set_id") for b in plan["beats"] if not placeholder(b.get("set_id"))}
    for raw, cid, ver in pins(plan):
        if not cid:
            bad(f"character pin {raw!r} is not <character>@v<n>")
            continue
        c, cpath = creator_for(plan, cid, ver)
        if c is None:
            bad(f"{raw}: no creator file at {os.path.relpath(cpath, ROOT)} -- casting never runs "
                "per video; run persona-identity first (part A)")
            continue
        mascot = c.get("cast_kind") == "mascot"
        if mascot and placeholder((c.get("mascot") or {}).get("style_lock")):
            bad(f"{raw}: a mascot has its style_lock in creator.json (mascot.style_lock)")
        st = c.get("status")
        if st not in STATUS_OK:
            bad(f"{raw}: status {st!r}; P1 needs 'video-setup' or 'live' (persona-identity, mode 3)")
        elif st == "video-setup":
            note(f"{raw}: status video-setup -- the storyboard may be made (its keyframes count "
                 "toward the twenty-generation gate), but P2 waits for 'live'")
        else:
            good(f"{raw}: status live")
        hero = (c.get("anchors") or {}).get("hero") or "references/face.png"
        hero = hero.split(" ")[0]
        for label, rel in [("hero", hero)] + [(k, v) for k, v in (c.get("anchors") or {}).items()
                                               if k not in ("hero", "approved") and isinstance(v, str)]:
            if placeholder(rel):
                continue
            if not os.path.exists(os.path.join(hdir, rel)):
                (bad if label == "hero" else note)(f"{raw}: anchor {label} missing ({rel})")
        if not (c.get("anchors") or {}).get("approved"):
            bad(f"{raw}: no approved anchors in creator.json -- the video half is not done")
        vr = ((c.get("voice_profile") or {}).get("voice_reference") or {})
        if mascot:
            pass                      # a mascot speaks with its narrator voice (narrators[])
        elif placeholder(vr.get("approved")):
            note(f"{raw}: no approved voice reference -- talking segments cannot be generated "
                 "until character-voice is done")
        s = (plan.get("set") or {}).get(cid)
        if placeholder(s) and v2 and beat_sets:
            good(f"{raw}: the sets come from the beats ({', '.join(sorted(beat_sets))})")
        elif placeholder(s):
            bad(f"{raw}: the plan names no set")
        elif s not in sets:
            bad(f"{raw}: set {s!r} is not in world.json")
        else:
            if s not in (c.get("sets") or []):
                note(f"{raw}: set {s!r} is not in the character's own sets list")
            plate = sets[s].get("plate")
            if not plate or not os.path.exists(os.path.join(hdir, plate)):
                bad(f"{raw}: set {s!r} has no plate picture ({plate})")
            else:
                good(f"{raw}: set {s} ({plate})")
        o = (plan.get("outfit") or {}).get(cid)
        outfits = {x.get("id"): x for x in c.get("outfits") or []}
        if placeholder(o) and mascot:
            pass                      # a mascot's look is its style lock
        elif placeholder(o):
            bad(f"{raw}: the plan names no outfit")
        elif o not in outfits:
            bad(f"{raw}: outfit {o!r} is not in creator.json outfits")
        elif not os.path.exists(os.path.join(hdir, outfits[o].get("reference", ""))):
            bad(f"{raw}: outfit {o!r} has no anchor picture ({outfits[o].get('reference')})")
        else:
            good(f"{raw}: outfit {o}")
        for fs in c.get("fixed_subjects") or []:
            if placeholder(fs):
                continue
            if fs not in subjects:
                bad(f"{raw}: fixed subject {fs!r} is not in world.json")
            elif subjects[fs].get("origin") == "real":
                pass                  # a real animal: supplied footage only, no picture to generate from
            elif not os.path.exists(os.path.join(hdir, subjects[fs].get("reference", ""))):
                bad(f"{raw}: fixed subject {fs!r} has no picture")
    if v2:
        # The world of the generated beats: each set has its plate, each generated subject
        # its picture. A real subject is never generated, so it needs none.
        for b in plan["beats"]:
            if b.get("source_asset_ids") or b.get("layout", "sequence") != "sequence":
                continue
            sid = b.get("set_id")
            if not placeholder(sid) and sid in sets:
                plate = sets[sid].get("plate")
                if not plate or not os.path.exists(os.path.join(hdir, plate)):
                    bad(f"beat {b.get('id')}: set {sid!r} has no plate picture ({plate})")
            for fs in b.get("subject_ids") or []:
                x = subjects.get(fs) or {}
                if x and x.get("origin") != "real" and \
                        not os.path.exists(os.path.join(hdir, x.get("reference") or "-")):
                    bad(f"beat {b.get('id')}: fixed subject {fs!r} has no picture")
    slug, lim = model_limits()
    good(f"model {slug}: {lim.get('min_duration_s')} to {lim.get('max_duration_s')} s, "
         f"at most {lim.get('max_reference_images')} reference pictures")
    if not PROBLEMS:
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "character", "state.py"),
                            "init", video, "--app-insertion", "yes" if ins else "no"],
                           capture_output=True, text=True)
        print("  " + (r.stdout.strip() or r.stderr.strip()))
    finish()


# ---------------------------------------------------------------------------- validate
def shot_files(video):
    d = os.path.join(vdir(video), "shots")
    if not os.path.isdir(d):
        return {}
    return {f[:-5]: load(os.path.join(d, f)) for f in sorted(os.listdir(d)) if f.endswith(".json")}


def seg_name(n, t):
    return f"{int(n):02d}-{t.lower()}"


def gen_refs(shot):
    return (shot.get("video") or {}).get("references") or []


def supplied_paths(plan):
    """Every supplied file of the plan, absolute. Supplied footage is output media, never
    the conditioning of a generation."""
    return {os.path.realpath(os.path.join(ROOT, a["path"])) for a in plan.get("assets") or []
            if isinstance(a.get("path"), str)}


def reaction_marks(plan):
    """What names a reference reaction on disk: its post id, post folder and video path.
    The reference drives the written performance only; its clip is never a reference of a
    generation."""
    marks = set()
    for r in plan.get("reaction_refs") or []:
        for k in ("post_id", "post_dir", "video_path"):
            if isinstance(r.get(k), str) and r[k].strip():
                marks.add(r[k].strip().rstrip("/"))
    return marks


def check_refs(video, plan, name, refs, kinds, max_images, what):
    images = 0
    supplied = supplied_paths(plan)
    posts = reaction_marks(plan)
    for r in refs:
        f, k = r.get("file"), r.get("kind")
        if placeholder(f):
            bad(f"{name}: a {what} reference has no file")
            continue
        if k not in kinds:
            bad(f"{name}: {what} reference {f} has kind {k!r}; allowed: {', '.join(sorted(kinds))}")
        if "/screens/" in f:
            bad(f"{name}: {f} is from the screen library -- the app is never a reference")
        if "/supplied/" in f or os.path.realpath(resolve(video, plan, f)) in supplied:
            bad(f"{name}: {f} is supplied media -- it goes into the video as it is, never into a generation")
        if f.startswith("research/") or "/research/" in f or any(pid in f for pid in posts):
            bad(f"{name}: {f} is research footage or the reference reaction -- the written performance "
                "carries the reaction; the clip is never a reference of a generation")
        if f.lower().endswith(AUDIO_EXT):
            if k != "voice":
                bad(f"{name}: {f} is audio but its kind is {k!r}")
        elif f.lower().endswith(IMAGE_EXT):
            images += 1
            if k == "voice":
                bad(f"{name}: {f} is a picture but its kind is 'voice'")
        else:
            bad(f"{name}: {f} is neither a picture nor an audio clip")
        if not os.path.exists(resolve(video, plan, f)) and not f.startswith("keyframes/"):
            bad(f"{name}: {what} reference missing on disk: {f}")
    if max_images and images > max_images:
        bad(f"{name}: {images} {what} reference pictures; the model takes at most {max_images} "
            "(order: keyframe, hero, each fixed subject in the shot, then one angle or the "
            "neighbour frame)")
    return images


def cmd_validate(video):
    plan = plan_of(video)
    vp = os.path.join(vdir(video), "video.json")
    if not os.path.exists(vp):
        sys.exit(f"no pipeline/character/{video}/video.json -- write it from "
                 "docs/character/video.example.json")
    v = load(vp)
    shots = shot_files(video)
    slug, lim = model_limits()
    lo, hi = lim.get("min_duration_s") or 1, lim.get("max_duration_s") or 999
    ins = plan.get("app_insertion") is True
    lines = {l["id"]: l for l in plan["script"]}
    order = [l["id"] for l in plan["script"]]
    print(f"video.json  {len(v.get('segments') or [])} segment(s); model {slug} ({lo} to {hi} s)")
    if v.get("app_insertion") is not plan.get("app_insertion"):
        bad("video.json app_insertion differs from the plan")
    if v.get("characters") != plan.get("characters"):
        bad("video.json characters differ from the plan's pins")
    seen, last, total = [], -1, 0.0
    for seg in v.get("segments") or []:
        t = str(seg.get("type", "")).upper()
        n = seg.get("n")
        name = seg_name(n, t) if t else f"segment {n}"
        if t not in GENERATED + NOT_GENERATED:
            bad(f"{name}: type {t!r} is not one of {', '.join(GENERATED + NOT_GENERATED)}")
            continue
        if not ins and (t in APP_TYPES or seg.get("insert")
                        or any(p.get("screen_id") for p in seg.get("panels") or [])):
            bad(f"{name}: a {t} segment shows the app, but the plan has no app insertion")
        sl = seg.get("script_lines") or []
        if isinstance(sl, str):
            sl = [x.strip() for x in sl.split(",") if x.strip()]
        for lid in sl:
            if lid == "demo-vo":
                continue
            if lid not in lines:
                bad(f"{name}: line {lid!r} is not in the plan")
                continue
            idx = order.index(lid)
            if idx < last and not seg.get("shared"):
                bad(f"{name}: line {lid} comes before a line of an earlier segment")
            last = max(last, idx)
            seen.append(lid)
        if t in ("R", "P"):
            if placeholder(seg.get("screen_id")):
                bad(f"{name}: an {t} segment needs a screen_id")
            note(f"{name}: {t} is not generated; its length comes from the recording")
            continue
        if t == "C":
            if placeholder(seg.get("asset_id")):
                bad(f"{name}: a C segment names the supplied asset it shows (asset_id)")
            if seg.get("insert") and placeholder((seg.get("insert") or {}).get("screen_id")):
                bad(f"{name}: a filmed phone's insert names its screen_id")
            continue
        if t == "M":
            ps = seg.get("panels") or []
            if len(ps) < 2:
                bad(f"{name}: an M segment has two panels or more")
            for p in ps:
                srcs = [k for k in ("asset_id", "project", "screen_id") if not placeholder(p.get(k))]
                if len(srcs) != 1:
                    bad(f"{name}: panel {p.get('id')} names one source: asset_id, project (an approved "
                        "B segment) or screen_id")
            continue
        shot = shots.get(name)
        if shot is None:
            bad(f"{name}: no shots/{name}.json")
            continue
        if str(shot.get("segment_type", "")).upper() != t:
            bad(f"{name}: the shot file says type {shot.get('segment_type')!r}")
        sv = shot.get("video") or {}
        dur, trim = sv.get("duration_seconds"), sv.get("trim_to_seconds")
        if not isinstance(dur, int) or not lo <= dur <= hi:
            bad(f"{name}: duration_seconds {dur!r}; the model takes whole seconds from {lo} to {hi}")
            dur = lo
        if trim not in (None, "null") and not (isinstance(trim, (int, float)) and 3 <= trim < dur):
            bad(f"{name}: trim_to_seconds {trim!r}; it is the planned length, 3 s or more and "
                "under the generated length, or null")
            trim = None
        planned = trim if isinstance(trim, (int, float)) else dur
        total += planned
        words = sum(len(lines[l]["line"].split()) for l in sl if l in lines)
        if words and words / planned > MAX_WORDS_PER_S:
            bad(f"{name}: {words} words in {planned} s is over {MAX_WORDS_PER_S} words a second "
                "-- fewer words, or a longer segment")
        if t in ("H", "F") and sl:
            bad(f"{name}: an {t} segment speaks no line on camera; its audio is laid at assembly")
        if t == "X":
            if sl or seg.get("audio_from"):
                bad(f"{name}: an X segment is a silent reaction: no line, no audio_from (a reaction hook is "
                    "never spoken)")
            if shot.get("framing_kind") != "face":
                bad(f"{name}: an X segment shows the face (framing_kind face)")
            if any(r.get("kind") == "voice" for r in gen_refs(shot)):
                bad(f"{name}: an X segment is silent: no voice reference")
            if not isinstance(shot.get("reaction"), dict):
                bad(f"{name}: an X shot carries its beat's reaction (the reference and the written performance)")
        if t == "B" and sl and not seg.get("audio_from"):
            bad(f"{name}: a B segment is silent; its lines are a narration laid at assembly (audio_from)")
        if t == "B":
            fk = shot.get("framing_kind")
            if fk not in PEOPLE:
                bad(f"{name}: framing_kind is face, hands_only or subject_only")
            elif fk == "face" and shot.get("cast_kind") != "mascot":
                bad(f"{name}: a B segment with a face is an approved mascot; a human face that acts "
                    "silently is still a T segment's character")
            if any(r.get("kind") == "voice" for r in gen_refs(shot)):
                bad(f"{name}: a B segment is silent: no voice reference")
        for side in ("left", "right"):
            if placeholder((shot.get("hands") or {}).get(side)):
                bad(f"{name}: hands.{side} has no job")
        phone = shot.get("phone") or {}
        if t in PHONE:
            if not phone.get("present") or phone.get("screen") != "green":
                bad(f"{name}: a {t} segment has the phone up and green from the first frame")
            if placeholder(phone.get("screen_id")):
                bad(f"{name}: phone.screen_id names the screen from SCREENS.md")
        elif phone.get("present"):
            bad(f"{name}: a {t} segment has no phone (the app is shown only by O, G, S, H, F, R or P)")
        if t == "H" and placeholder(((shot.get("phone_motion") or {}).get("push") or {}).get("end_still")):
            bad(f"{name}: an H segment needs its end still (phone_motion.push.end_still)")
        if placeholder(shot.get("keyframe_prompt")):
            bad(f"{name}: no keyframe_prompt")
        check_refs(video, plan, name, shot.get("keyframe_references") or [], KEYFRAME_KINDS, None, "keyframe")
        check_refs(video, plan, name, gen_refs(shot), GEN_KINDS, lim.get("max_reference_images"), "generation")
        if t == "T" and not any(r.get("kind") == "voice" for r in gen_refs(shot)) and sl:
            bad(f"{name}: a talking segment carries the voice reference")
        if not any(r.get("kind") == "keyframe" for r in gen_refs(shot)):
            bad(f"{name}: every generated segment starts from its own keyframe (a 'keyframe' reference)")
    missing = [l for l in order if l not in seen]
    if missing:
        bad(f"lines no segment carries: {', '.join(missing)}")
    target = (plan.get("format") or {}).get("length_s")
    if bridge.is_v2(plan):
        print(f"bridge: video.json against plan revision {plan.get('revision')}")
        bridge.check_video(plan, v, shots, bridge.Out(bad, note, good))
    elif isinstance(target, (int, float)) and total and abs(total - target) > 0.25 * target:
        note(f"the generated segments plan {total:g} s against a target of {target} s "
             "(R and P segments add their recordings' length)")
    finish()


# ---------------------------------------------------------------------------- refs
def cmd_refs(video, only):
    plan = plan_of(video)
    _, lim = model_limits()
    shots = shot_files(video)
    if not shots:
        sys.exit("no shot files -- write shots/<nn>-<type>.json first")
    for name, shot in shots.items():
        if only and name not in only:
            continue
        refs = gen_refs(shot)
        n = check_refs(video, plan, name, refs, GEN_KINDS, lim.get("max_reference_images"), "generation")
        sdir = os.path.join(vdir(video), "segments", name)
        os.makedirs(sdir, exist_ok=True)
        out = {"_comment": "Written by scripts/character/shots.py refs from the shot file. "
                           "generate.sh accepts only these kinds.",
               "references": [{"kind": r["kind"],
                               "file": os.path.relpath(resolve(video, plan, r["file"]), ROOT),
                               "binding": r.get("role", "")} for r in refs]}
        json.dump(out, open(os.path.join(sdir, "refs.json"), "w"), indent=2)
        msg = f"{name}: refs.json, {n} picture(s), {len(refs) - n} audio"
        t = str(shot.get("segment_type", "")).upper()
        if t in PHONE:
            ip = os.path.join(sdir, "insert.json")
            if not os.path.exists(ip):
                sid = (shot.get("phone") or {}).get("screen_id")
                dur = (shot.get("video") or {}).get("duration_seconds") or 5
                json.dump({
                    "_comment": "Written by P1 from the plan. P4 (character-composite) fills the "
                                "source, the beats and the tracking; see docs/character/insert.example.json.",
                    "mode": INSERT_MODE[t], "screen_id": sid, "source": None,
                    "plate_window": [0.0, float(dur)],
                    "hero": {"text": (plan.get("hero_strings") or {}).get(sid)},
                }, open(ip, "w"), indent=2)
                msg += "; insert.json started"
        print(f"  {msg}")
    finish()


# ---------------------------------------------------------------------------- keyframes
def kf_targets(shot, name):
    out = [(name, shot.get("keyframe_prompt"), f"keyframes/{name}.png")]
    push = ((shot.get("phone_motion") or {}).get("push") or {})
    if str(shot.get("segment_type", "")).upper() == "H" and shot.get("keyframe_end_prompt"):
        out.append((f"{name}-end", shot["keyframe_end_prompt"], push.get("end_still") or f"keyframes/{name}-end.png"))
    return out


def cmd_job(video, only):
    plan = plan_of(video)
    shots = shot_files(video)
    if not shots:
        sys.exit("no shot files -- write shots/<nn>-<type>.json first")
    kdir = os.path.join(vdir(video), "keyframes")
    os.makedirs(kdir, exist_ok=True)
    stills, attach = [], []
    for name, shot in shots.items():
        if only and name not in only:
            continue
        refs = []
        for r in shot.get("keyframe_references") or []:
            p = resolve(video, plan, r["file"])
            if not os.path.exists(p):
                bad(f"{name}: keyframe reference missing: {r['file']}")
                continue
            refs.append({"kind": r.get("kind"), "file": p})
            if p not in attach:
                attach.append(p)
        for key, prompt, rel in kf_targets(shot, name):
            if placeholder(prompt):
                bad(f"{key}: no prompt")
                continue
            stills.append({"name": key, "prompt": prompt, "references": refs,
                           "people": PEOPLE.get(shot.get("framing_kind") or "face", PEOPLE["face"]),
                           "out": resolve(video, plan, rel)})
    if PROBLEMS:
        finish()
    job = {"video": video, "size": list(KEYFRAME_SIZE), "stills": stills, "attach": attach}
    jp = os.path.join(kdir, "keyframes-job.json")
    json.dump(job, open(jp, "w"), indent=2)
    w, h = KEYFRAME_SIZE
    instr = f"""Read the job file {jp}. It lists the keyframes of one character video: for each
still, a prompt and the reference images it uses. The references are attached. Make the
pictures with your built-in image generation tool, one call per still (never one call for
several, never code that calls an image API).

For each still in the job's "stills":
  1. Use its "prompt" as written. Its "references" are the person (or the mascot), the
     outfit, the room and any fixed subject: the picture must show the same person (same
     face, hair and signature details), in that outfit, in that room, with each fixed
     subject in its true size and exact count. Who is in the picture is the still's
     "people" rule, as written. No text, no captions, no logo in the picture. A phone
     screen, when there is one, is flat solid green (RGB 0 177 64).
  2. Ask the tool for a portrait picture (1024x1536).
  3. Save the generated file next to the still's "out" path as <out without .png>-raw.png,
     then make "out" at exactly {w}x{h} with ffmpeg:
       ffmpeg -y -loglevel error -i <raw>.png -vf "scale={w}x{h}:force_original_aspect_ratio=increase,crop={w}:{h}" <out>
  4. Go to the next still. Do not stop on a failed still: note its name and continue.
When every still is done, write {kdir}/keyframes-result.md: one line per still, "<name>:
<out> {w}x{h}" or "<name>: FAILED <why>", then one line "done". Your last message is the
contents of that file and nothing else. Do not run any verify step; the caller does.
"""
    open(os.path.join(kdir, "keyframes-instruction.txt"), "w").write(instr)
    print(f"job: {len(stills)} still(s), {len(attach)} reference file(s) -> {os.path.relpath(jp, ROOT)}")
    finish()


def size_of(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height", "-of", "csv=p=0", p], capture_output=True, text=True)
    try:
        a, b = r.stdout.strip().split(",")[:2]
        return int(a), int(b)
    except Exception:
        return None


def cmd_verify(video, only):
    plan = plan_of(video)
    for name, shot in shot_files(video).items():
        if only and name not in only:
            continue
        for key, _, rel in kf_targets(shot, name):
            p = resolve(video, plan, rel)
            if not os.path.exists(p) or os.path.getsize(p) == 0:
                bad(f"{key}: no keyframe at {rel}")
                continue
            sz = size_of(p)
            if sz != KEYFRAME_SIZE:
                bad(f"{key}: {rel} is {sz}, wanted {KEYFRAME_SIZE[0]}x{KEYFRAME_SIZE[1]}")
            else:
                good(f"{key}: {rel}")
    finish()


def cmd_supplied(video, only):
    """A C segment that shows a filmed phone gets a plate, like a generated phone segment:
    the approved range of the supplied clip, checked against its checksum, at
    segments/<nn>-c/source/plate.mp4, and a first insert.json. The plate then goes
    through the same gates (qc.py, review.py segment, composite.sh): nothing is relaxed."""
    plan = plan_of(video)
    vp = os.path.join(vdir(video), "video.json")
    if not os.path.exists(vp):
        sys.exit("no video.json")
    assets = {a.get("id"): a for a in plan.get("assets") or []}
    n = 0
    for seg in load(vp).get("segments") or []:
        name = seg_name(seg.get("n"), str(seg.get("type", "")))
        if str(seg.get("type", "")).upper() != "C" or not seg.get("insert") or (only and name not in only):
            continue
        a = assets.get(seg.get("asset_id"))
        if not a or a.get("kind") != "clip":
            bad(f"{name}: a filmed phone is a supplied clip (asset {seg.get('asset_id')!r})")
            continue
        src = os.path.join(ROOT, a["path"])
        if not os.path.exists(src) or bridge.sha256_file(src) != a.get("sha256"):
            bad(f"{name}: {a['path']} is missing or does not match its sha256")
            continue
        rng = seg.get("source_range_s") or a.get("trim_s")
        sdir = os.path.join(vdir(video), "segments", name)
        os.makedirs(os.path.join(sdir, "source"), exist_ok=True)
        plate = os.path.join(sdir, "source", "plate.mp4")
        r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{rng[0]:.3f}", "-to", f"{rng[1]:.3f}",
                            "-i", src, "-c:v", "libx264", "-crf", "12", "-preset", "medium",
                            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", plate],
                           capture_output=True, text=True)
        if r.returncode != 0:
            bad(f"{name}: ffmpeg could not cut the plate: {r.stderr[-300:]}")
            continue
        ins = seg["insert"]
        ip = os.path.join(sdir, "insert.json")
        if not os.path.exists(ip):
            json.dump({"_comment": "Written by shots.py supplied for a filmed phone in a supplied clip. "
                                   "P4 fills the source, the beats and the tracking; the gates are those "
                                   "of the mode (docs/character/insert.example.json).",
                       "mode": ins.get("mode") or "in-hand", "screen_id": ins.get("screen_id"),
                       "source": None, "plate_window": [0.0, round(rng[1] - rng[0], 3)],
                       "hero": {"text": (plan.get("hero_strings") or {}).get(ins.get("screen_id"))}},
                      open(ip, "w"), indent=2)
        good(f"{name}: plate {os.path.relpath(plate, ROOT)} ({rng[0]:g} to {rng[1]:g} s of {a['id']})")
        n += 1
    if not n and not PROBLEMS:
        note("no C segment with a filmed phone (segments[].insert) in video.json")
    finish()


def cmd_storyboard(video):
    try:
        import cv2, numpy as np
    except ImportError:
        sys.exit("the storyboard needs opencv: run it with .venv/bin/python3")
    plan = plan_of(video)
    tiles = []
    for name, shot in shot_files(video).items():
        for key, _, rel in kf_targets(shot, name):
            p = resolve(video, plan, rel)
            img = cv2.imread(p) if os.path.exists(p) else None
            if img is None:
                img = np.full((1920, 1080, 3), 40, np.uint8)
            img = cv2.resize(img, (360, 640))
            sv = shot.get("video") or {}
            label = f"{key}  {sv.get('duration_seconds')}s" + (f">{sv['trim_to_seconds']}s" if isinstance(sv.get("trim_to_seconds"), (int, float)) else "")
            cv2.rectangle(img, (0, 0), (360, 34), (0, 0, 0), -1)
            cv2.putText(img, label, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
            tiles.append(img)
    if not tiles:
        sys.exit("no shot files")
    cols = min(4, len(tiles))
    while len(tiles) % cols:
        tiles.append(np.full((640, 360, 3), 255, np.uint8))
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    out = os.path.join(vdir(video), "keyframes", "storyboard.jpg")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cv2.imwrite(out, np.vstack(rows))
    print(f"storyboard: {os.path.relpath(out, ROOT)} ({len(tiles)} tile(s))")


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    cmd, video = a[0], a[1]
    only = None
    if "--only" in a:
        only = set(a[a.index("--only") + 1].split(","))
    elif len(a) > 2 and cmd in ("refs", "supplied"):
        only = {a[2]}
    {"check": lambda: cmd_check(video),
     "validate": lambda: cmd_validate(video),
     "refs": lambda: cmd_refs(video, only),
     "job": lambda: cmd_job(video, only),
     "verify": lambda: cmd_verify(video, only),
     "storyboard": lambda: cmd_storyboard(video),
     "supplied": lambda: cmd_supplied(video, only)}.get(cmd, lambda: sys.exit(__doc__))()


if __name__ == "__main__":
    main()
