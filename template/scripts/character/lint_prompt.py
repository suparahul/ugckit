#!/usr/bin/env python3
"""The prompt lint of the character pipeline (P1, gate A). Free; runs before any spend.

    lint_prompt.py <video> [segment ...]      every segment with a prompt.txt, or the named ones

Reads pipeline/character/<video>/segments/<seg>/prompt.txt with its shot file
(shots/<seg>.json), its refs.json and the plan. One line per check, PASS or FAIL; exit 1
on any FAIL. The checks: the length, the section order, no booster
or glamour word, every reference bound alone, an end state on every shot, a job for
every hand, no conflicting camera words, the word budget, the flat-on sentence in every
O, G and S prompt and no word that angles the phone, the push sentence in H and the
finger sentence in F with their times, no spoken line in H, F or B, lip sync stated for a
talking segment, the shot times within the generated length, no generation
parameter, and the reference-picture limit. For B (a silent generated action): no phone
and no app, the people rule of its framing (hands only: no face; subject only: no person,
and no "exactly one person"), and the exact count of each fixed subject. For X (a silent
reaction): no line and the silence stated, no lip sync, exactly one person, no phone and
no app, every expression beat of the written performance (its face, eyes and head) word for
word with its time from the segment's start, and no copy of the reference (its post id,
its creator's handle, its file, or words that ask the model to copy a clip).

X in face-replace mode (the reference's generation_input face_replace) has two kinds of
prompt:
  - the replace route sends no prompt and has no keyframe: nothing to lint (a prompt.txt
    left in the segment is reported as not sent).
  - the motion route (Kling motion control) lints the keyframe_prompt as animate does, and
    its prompt.txt: present, at most 600 characters, no file name.
  - the animate route sends no video prompt. Its keyframe_prompt (the character's first
    frame, made by Codex from the hero and the clip's first frame) is linted instead:
    exactly one person, the identity lock's face and hair word for word, the band
    sentence of every blur or box mask (bridge.band_sentence, "picture"), no file name, and
    no name of the reference post or its creator.
  - a prompt.txt for a model that edits or follows the clip (the guided route, or any
    editing model) follows the rules for editing models: the edit first (the face
    replacement in the first 300 characters), short (at most 1,500 characters), the inputs
    called "the input video" and "the reference image" and never by a file name, no
    instruction to keep or follow the clip's frames exactly, "nothing of the original
    person" stated, and the band sentence of every blur or box mask
    (bridge.band_sentence, "video"). The written beats are the gate B checklist.

A continuing segment (its refs.json opens on the previous clip's last-frame.png): that
line of REFERENCES binds it as the first frame. A face-replace X never continues.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bridge

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAX_CHARS = 5000
MAX_WORDS_PER_S = 3.75

FLAT_ON = ("The phone is held completely flat-on to the camera: the screen plane is square "
           "to the lens and upright, with no tilt, no turn and no perspective, from the first "
           "frame to the last.")
# Phrases that turn the phone away from the lens. Negated uses ("no tilt") are fine.
ANGLING = [r"tilts? the (phone|screen)", r"turns? the (phone|screen)", r"angles? the (phone|screen)",
           r"rotates? the (phone|screen)", r"at an angle", r"tilted (phone|screen)",
           r"(phone|screen) (is )?tilted", r"angled (phone|screen)", r"three-quarter view of the (phone|screen)"]
BOOSTERS = ["4k", "8k", "ultra-detailed", "ultra detailed", "photorealistic", "hyperrealistic",
            "hyper-realistic", "masterpiece", "sharp focus", "flawless", "stunning", "ethereal",
            "porcelain", "dewy", "cinematic", "natural beauty", "award-winning", "award winning",
            "studio quality", "highly detailed", "best quality", "breathtaking", "gorgeous"]
CAMERA_CONFLICTS = [
    (r"\b(tripod|propped|locked[- ]off|static camera)\b", r"\b(handheld|hand-held|walking with|follows? her)\b"),
    (r"\bclose-up\b", r"\bwide shot\b"),
]
PARAMS = [r"--ar\b", r"--[a-z]+ \d", r"\bseed\s*[:=]", r"\bduration\s*[:=]", r"\baspect ratio\s*[:=]"]
SECTIONS = ["REFERENCES", "STRUCTURE", "SUBJECT", "SETTING", "ANIMALS/PROPS", "SHOT",
            "THE PHONE SCREEN", "PERFORMANCE", "AUDIO", "DIALOGUE", "CONSISTENCY", "NO TEXT"]
NEGATORS = ("no ", "not ", "never ", "without ", "avoid ", "zero ")
SILENT = ("does not speak", "no one speaks", "nobody speaks", "do not speak")
APP_WORDS = [r"green screen", r"phone screen", r"\bthe app\b", r"app screen", r"screen recording",
             r"holds? (a|the|her|his) phone", r"\bsmartphone\b"]
COUNT_WORDS = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}
COPY_WORDS = [r"reference (video|clip|reaction)", r"\bcopy\b", r"\brecreate\b", r"\breplicate\b",
              r"\bmimic\b", r"same as the (video|clip)"]
# Editing models (face replace): an instruction to keep the clip as it is wins over the edit.
EDIT_MAX_CHARS = 1500
FILE_NAME = r"\b[\w-]+\.(mp4|mov|png|jpe?g|webp)\b"
KEEP_AS_IS = [r"keep (its|the) frames", r"(follow|match)\w* (the )?(input video|clip|reference)[^.]{0,40}\bexactly",
              r"\bexactly\b[^.]{0,30}\b(input video|clip)\b", r"stays? (those|that) of", r"its frames,"]


def face_route_of(shot):
    """(route name, route record) of a face-replace shot, from models.json."""
    spec = json.load(open(os.path.join(ROOT, "scripts", "character", "models.json")))
    route = bridge.face_route_name(shot.get("face_replace") or {})
    return route, ((spec.get("face_replace") or {}).get("routes") or {}).get(route) or {}


def norm(x):
    return " ".join(str(x).split())


def lint_first_frame(video, seg, shot, plan, ref):
    """The animate route: the keyframe prompt of the character's first frame."""
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok, detail))

    kp = shot.get("keyframe_prompt") or ""
    flat = norm(kp)
    low = flat.lower()
    check("keyframe prompt (animate route: no video prompt)", bool(kp.strip()),
          f"{len(kp)} characters" if kp.strip() else "the shot has no keyframe_prompt")
    check("length", len(kp) <= MAX_CHARS, f"{len(kp)} characters (limit {MAX_CHARS})")
    check("the people rule (face)", "exactly one person" in low, "say 'Exactly one person.'")
    hdir = os.path.join(ROOT, "apps", plan["app"], "handles", plan["handle"].lstrip("@"))
    cid = (plan.get("characters") or [""])[0].split("@")[0]
    cp = os.path.join(hdir, "characters", cid, "creator.json")
    lock = (json.load(open(cp)).get("identity_lock") or {}) if os.path.exists(cp) else {}
    miss = [k for k in ("face", "hair") if not lock.get(k) or norm(lock[k]).lower() not in low]
    check("the identity lock's face and hair, word for word", not miss,
          ("missing: " + ", ".join(miss)) if miss else "")
    bands = bridge.band_sentence((shot.get("face_replace") or {}).get("masks"), "picture")
    gone = [b for b in bands if norm(b) not in flat]
    check("the band sentence of every blur or box mask", not gone,
          ("paste, word for word: " + " | ".join(gone)) if gone else f"{len(bands)} band(s)")
    fn = sorted({m.group(0) for m in re.finditer(FILE_NAME, kp)})
    check("no file name", not fn, ", ".join(fn) or "call the pictures 'the first reference picture' and 'the pose picture'")
    names = [str(ref.get(k)) for k in ("post_id", "handle") if ref.get(k)]
    cpn = [n for n in names if n.lower() in low]
    check("no name of the reference", not cpn, ", ".join(cpn))
    return results


def sections(text):
    """[(header, body)] in order; the text before the first header is the opening look."""
    pat = re.compile(r"^(REFERENCES|STRUCTURE|SUBJECT|SETTING|ANIMALS/PROPS|SHOT \d+[^\n]*|"
                     r"THE PHONE SCREEN|PERFORMANCE|AUDIO|DIALOGUE|CONSISTENCY|NO TEXT)\b:?",
                     re.M)
    out, last, head = [], 0, "opening look"
    for m in pat.finditer(text):
        out.append((head, text[last:m.start()]))
        head, last = m.group(1).strip(), m.end()
    out.append((head, text[last:]))
    return out


def kind(head):
    return "SHOT" if head.startswith("SHOT ") else head


def negated(low, start):
    """True when a negator stands before `start` in the same clause."""
    before = low[max(0, start - 30):start]
    before = re.split(r"[.;:!?\n]", before)[-1]
    return any(n in " " + before for n in NEGATORS)


def unnegated(body, word):
    low = body.lower()
    return any(not negated(low, m.start()) for m in re.finditer(re.escape(word), low))


def lint(video, seg):
    vd = os.path.join(ROOT, "pipeline", "character", video)
    sd = os.path.join(vd, "segments", seg)
    pp = os.path.join(sd, "prompt.txt")
    shot = json.load(open(os.path.join(vd, "shots", f"{seg}.json")))
    plan = json.load(open(os.path.join(vd, "plan.json")))
    refs = []
    if os.path.exists(os.path.join(sd, "refs.json")):
        refs = json.load(open(os.path.join(sd, "refs.json"))).get("references") or []
    t = str(shot.get("segment_type", "")).upper()
    rx0 = shot.get("reaction") or {}
    ref0 = next((r for r in plan.get("reaction_refs") or [] if r.get("id") == rx0.get("ref_id")), {})
    fr0 = t == "X" and ref0.get("generation_input") == "face_replace" and isinstance(shot.get("face_replace"), dict)
    if fr0 and face_route_of(shot)[1].get("first_frame") == "keyframe":
        res = lint_first_frame(video, seg, shot, plan, ref0)
        if face_route_of(shot)[1].get("prompt") is True:
            # The motion route also sends a short prompt.txt beside the first frame and the clip.
            vp = open(pp).read().strip() if os.path.exists(pp) else ""
            res.append(("video prompt present (motion route)", bool(vp), ""))
            res.append(("video prompt short", len(vp) <= 600, f"{len(vp)} chars, at most 600"))
            res.append(("no file name in the video prompt", not re.search(FILE_NAME, vp), ""))
        return res
    if fr0 and face_route_of(shot)[1].get("prompt") is False:
        route = face_route_of(shot)[0]
        return [(f"no prompt ({route} route: the clip and the face picture are the request)", True,
                 "prompt.txt is in the segment but is not sent" if os.path.exists(pp) else "")]
    text = open(pp).read()
    sv = shot.get("video") or {}
    secs = sections(text)
    heads = [kind(h) for h, _ in secs]
    body = {}
    for h, b in secs:
        body.setdefault(kind(h), []).append(b)
    allb = lambda k: "\n".join(body.get(k, []))
    front = "\n".join(b for h, b in secs if kind(h) not in ("CONSISTENCY", "NO TEXT"))
    lines = {l["id"]: l for l in plan["script"]}
    sl = shot.get("script_lines") or []
    if isinstance(sl, str):
        sl = [x.strip() for x in sl.split(",") if x.strip()]
    spoken = [lines[i] for i in sl if i in lines]
    results = []

    def check(name, ok, detail=""):
        results.append((name, ok, detail))

    n = len(text)
    check("length", n <= MAX_CHARS, f"{n} characters (limit {MAX_CHARS})")

    need = ["STRUCTURE", "SUBJECT", "SETTING", "SHOT", "PERFORMANCE", "AUDIO", "CONSISTENCY", "NO TEXT"]
    if refs:
        need.insert(0, "REFERENCES")
    if t in ("O", "G", "S", "H", "F"):
        need.insert(need.index("PERFORMANCE"), "THE PHONE SCREEN")
    if spoken:
        need.insert(need.index("CONSISTENCY"), "DIALOGUE")
    if shot.get("fixed_subjects_in_shot"):
        need.insert(need.index("SHOT"), "ANIMALS/PROPS")
    present = [h for h in heads if h in SECTIONS]
    order_ok = all(h in present for h in need) and \
        [h for h in present if h in need] == sorted([h for h in present if h in need],
                                                    key=lambda h: SECTIONS.index(h))
    missing = [h for h in need if h not in present]
    if not fr0:     # a prompt for an editing model is short: no screenplay sections
        check("sections", order_ok and heads[-1] == "NO TEXT",
              ("missing " + ", ".join(missing) + "; " if missing else "") +
              ("NO TEXT is last" if heads[-1] == "NO TEXT" else "NO TEXT must be the last section") +
              ("" if order_ok else "; the order is in the character-shots skill, step 5"))

    hits = sorted({w for w in BOOSTERS if unnegated(front, w)})
    check("no booster or glamour word", not hits, ", ".join(hits))

    if refs and not fr0:
        rb = allb("REFERENCES")
        unbound = [r["file"] for r in refs if os.path.basename(r["file"]) not in rb]
        sentences = [s for s in re.split(r"\n+", rb) if s.strip()]
        check("every reference bound alone", not unbound and len(sentences) >= len(refs),
              ("not named in REFERENCES: " + ", ".join(unbound)) if unbound else
              f"{len(refs)} reference(s), {len(sentences)} line(s)")

    seed = [r for r in refs if r.get("kind") == "neighbour-frame" and isinstance(r.get("continuity"), dict)]
    if seed:
        name = os.path.basename(seed[0]["file"])
        said = [l for l in allb("REFERENCES").splitlines() if name in l]
        check("the last frame bound as the first frame", bool(said) and "first frame" in said[0].lower(),
              f"REFERENCES says '{name} is the first frame' (the last frame of {seed[0]['continuity'].get('from')})")

    shots_b = [b for h, b in secs if kind(h) == "SHOT"]
    if not fr0:
        no_end = [i + 1 for i, b in enumerate(shots_b) if "end state:" not in b.lower()]
        check("an end state on every shot", shots_b and not no_end,
              f"shot(s) {no_end} have no 'End state:'" if no_end else f"{len(shots_b)} shot(s)")

        gen = sv.get("duration_seconds") or 5
        ends = [float(m.group(2)) for h, _ in secs if kind(h) == "SHOT"
                for m in [re.search(r"\(\s*(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*s", h)] if m]
        check("shot times within the length", bool(ends) and max(ends) <= gen + 0.05,
              f"the shots end at {max(ends):g} s; the segment is generated at {gen} s" if ends
              else "each SHOT header gives its times, as 'SHOT 1 (0.0 to 5.0 s)'")

    hands = shot.get("hands") or {}
    empty = [s for s in ("left", "right") if not hands.get(s) or "<" in str(hands.get(s))]
    check("every hand has a job", not empty, ("no job: " + ", ".join(empty)) if empty else "")

    conflicts = [f"{a} / {b}" for a, b in CAMERA_CONFLICTS
                 if re.search(a, front, re.I) and re.search(b, front, re.I)]
    check("no conflicting camera words", not conflicts, "; ".join(conflicts))

    dur = sv.get("trim_to_seconds") if isinstance(sv.get("trim_to_seconds"), (int, float)) else sv.get("duration_seconds") or 5
    words = sum(len(l["line"].split()) for l in spoken)
    check("word budget", words / dur <= MAX_WORDS_PER_S,
          f"{words} words in {dur} s ({words / dur:.2f}/s, limit {MAX_WORDS_PER_S})")

    if t in ("O", "G", "S"):
        flat = " ".join(FLAT_ON.split()) in " ".join(text.split())
        check("the flat-on sentence", flat, "" if flat else "paste it into THE PHONE SCREEN, word for word")
    if t in ("O", "G", "S", "H", "F"):
        low = front.lower()
        ang = [p for p in ANGLING if any(not negated(low, m.start()) for m in re.finditer(p, low))]
        check("no word that angles the phone", not ang, ", ".join(ang))
    ps = allb("THE PHONE SCREEN")
    if t == "H":
        ok = all(re.search(p, ps, re.I) for p in [r"straight toward the lens", r"flat-on",
                                                   r"at \d+(\.\d+)? s", r"holds it completely still"])
        check("the push sentence with its times", ok, "" if ok else "the H sentence of the character-shots skill")
    if t == "F":
        ok = all(re.search(p, ps, re.I) for p in [r"index finger", r"at \d+(\.\d+)? s",
                                                   r"flat solid green under and around the finger",
                                                   r"never passes through the phone"])
        check("the finger sentence with its times", ok, "" if ok else "the F sentence of the character-shots skill")
    if t in ("H", "F", "B", "X"):
        quoted = re.findall(r"[\"“][^\"”]{3,}[\"”]", "\n".join(shots_b))
        silent = any(x in text.lower() for x in SILENT)
        check("no spoken line", not spoken and not quoted and silent,
              f"an {t} segment has no line on camera and says so ('She does not speak', 'No one speaks')")
    if t in ("B", "X"):
        low = front.lower()
        app = [p for p in APP_WORDS if any(not negated(low, m.start()) for m in re.finditer(p, low))]
        check("no phone and no app", "THE PHONE SCREEN" not in heads and not app,
              ", ".join(app) or (f"THE PHONE SCREEN section in a {t} prompt" if "THE PHONE SCREEN" in heads else
                                 "") or "the app is shown only by O, G, S, H, F, R or P")
    if t == "B":
        fk = shot.get("framing_kind")
        tl = text.lower()
        if fk == "subject_only":
            ok = "exactly one person" not in tl and re.search(r"\bno (person|people|human)\b", tl)
            check("the people rule (subject only)", bool(ok),
                  "" if ok else "say 'No person in frame'; never 'exactly one person'")
        elif fk == "hands_only":
            ok = re.search(r"\bno face\b", tl) is not None
            check("the people rule (hands only)", ok, "" if ok else "say 'Only her hands and forearms; no face'")
    if t in ("B", "X"):
        subs = shot.get("fixed_subjects_in_shot") or []
        if subs:
            ap = allb("ANIMALS/PROPS").lower()
            n = len(subs)
            ok = re.search(rf"\bexactly ({n}|{COUNT_WORDS.get(n, n)})\b", ap) is not None
            check("the exact count of the subjects", ok,
                  f"{n} fixed subject(s): ANIMALS/PROPS says 'exactly {COUNT_WORDS.get(n, n)}' with their true size")
    if t == "X":
        tl = text.lower()
        flat = " ".join(tl.split())
        rx = shot.get("reaction") or {}
        ref = next((r for r in plan.get("reaction_refs") or [] if r.get("id") == rx.get("ref_id")), {})
        fr_mode = ref.get("generation_input") == "face_replace" and isinstance(shot.get("face_replace"), dict)
        check("no lip sync", re.search(r"\bno lip[- ]?sync\b", tl) is not None and "voice-over" not in
              allb("PERFORMANCE").lower(),
              "say 'No lip sync: her mouth does not form words'; a reaction hook is never spoken")
        check("the people rule (face)", "exactly one person" in tl, "say 'Exactly one person.'")
        steps = [x for x in rx.get("expression_beats") or [] if isinstance(x, dict)]
        perf_t = " ".join(allb("PERFORMANCE").lower().split())
        t0 = steps[0].get("start_s") if steps and isinstance(steps[0].get("start_s"), (int, float)) else 0
        miss = []
        for j, x in enumerate(steps, 1):
            tt = x.get("start_s")
            rel = (tt - t0) if isinstance(tt, (int, float)) else None
            times = {f"{rel:g} s", f"{rel:.1f} s"} if rel is not None else set()
            if not any(f"at {w}" in perf_t for w in times):
                miss.append(f"step {j}: 'at {rel if rel is None else f'{rel:g}'} s'")
            for k in ("face", "eyes", "head"):
                v = " ".join(str(x.get(k) or "").lower().split())
                if not v or v not in perf_t:
                    miss.append(f"step {j} {k}")
        if not fr_mode:
            check("the written performance, word for word", bool(steps) and not miss,
                  ("PERFORMANCE lacks: " + "; ".join(miss)) if miss else
                  "" if steps else "the shot has no reaction.expression_beats")
        names = [str(ref.get(k)) for k in ("post_id", "handle") if ref.get(k)]
        if ref.get("video_path"):
            names.append(os.path.basename(str(ref["video_path"])))
        if fr_mode:
            # Editing models (2026-10-04: Wan 2.7 Edit Video kept the clip's face under a
            # long prompt that said to keep its frames): the edit first, short, the inputs by
            # their role, nothing that says to keep the clip as it is.
            check("short (an editing model)", len(text) <= EDIT_MAX_CHARS,
                  f"{len(text)} characters (limit {EDIT_MAX_CHARS} for a prompt with an input video)")
            head_ = " ".join(text[:300].lower().split())
            swap = re.search(r"\breplace[sd]? (the|her|his|its) (woman|man|person|face)", head_) is not None
            check("the edit first", swap,
                  "open with the edit: 'Replace the person in the input video with the person in the reference image.'")
            roles = "the input video" in flat and "the reference image" in flat
            check("the inputs by their role", roles,
                  "call them 'the input video' and 'the reference image'; the model never sees a file name")
            fn = sorted({m.group(0) for m in re.finditer(FILE_NAME, text)})
            check("no file name", not fn, ", ".join(fn))
            keep = [p for p in KEEP_AS_IS if re.search(p, flat)]
            check("no instruction to keep the clip as it is", not keep,
                  ", ".join(keep) + (": an editing model keeps its input when told to" if keep else ""))
            trace = re.search(r"\b(nothing|no trace) of the (original|source) (person|creator|face)", flat)
            check("no trace of the original person", trace is not None,
                  "say 'Nothing of the original person's face, hair or identity remains'")
            bands = bridge.band_sentence(shot["face_replace"].get("masks"), "video")
            gone = [b for b in bands if " ".join(b.lower().split()) not in flat]
            check("the band sentence of every blur or box mask", not gone,
                  ("paste, word for word: " + " | ".join(gone)) if gone else f"{len(bands)} band(s)")
            cp = [n for n in names if n.lower() in flat]
        else:
            cp = [w for w in COPY_WORDS if re.search(w, flat)] + [n for n in names if n.lower() in flat]
        check("no copy of the reference", not cp, ", ".join(cp) or
              "the face is the handle's own; the prompt never names the reference post, creator or file")
    if spoken:
        perf = allb("PERFORMANCE").lower()
        bans = allb("NO TEXT").lower()
        ok = "lip sync" in perf and "voice-over" in bans
        check("lip sync stated", ok, "" if ok else
              "PERFORMANCE says she speaks every line on camera with lip sync; the bans say "
              "no voice-over on a shot where her face is visible")

    par = [p for p in PARAMS if re.search(p, text, re.I)]
    check("no generation parameter", not par, ", ".join(par))

    try:
        spec = json.load(open(os.path.join(ROOT, "scripts", "character", "models.json")))
        st = os.path.join(ROOT, "pipeline", "character", "state.json")
        slug = (json.load(open(st)).get("model") or {}).get("slug") if os.path.exists(st) else None
        lim = spec["known_model_limits"].get(slug or spec["default"], {})
        rt = ((spec.get("face_replace") or {}).get("routes") or {}).get(bridge.face_route_name(shot.get("face_replace") or {}))
        if t == "X" and rt:
            lim = spec["known_model_limits"].get(rt["model"], {})
    except Exception:
        lim = {}
    imgs = sum(1 for r in refs if r.get("kind") not in ("voice", "face_replace_clip"))
    mx = lim.get("max_reference_images")
    check("reference pictures within the limit", not mx or imgs <= mx, f"{imgs} of at most {mx}")
    return results


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    video = a[0]
    sroot = os.path.join(ROOT, "pipeline", "character", video, "segments")
    shots_dir = os.path.join(ROOT, "pipeline", "character", video, "shots")

    def first_frame_route(d):
        sp = os.path.join(shots_dir, f"{d}.json")
        return d.endswith("-x") and os.path.exists(sp) and \
            face_route_of(json.load(open(sp)))[1].get("first_frame") == "keyframe"
    segs = a[1:] or sorted(d for d in os.listdir(sroot)
                           if os.path.exists(os.path.join(sroot, d, "prompt.txt")) or first_frame_route(d))
    if not segs:
        sys.exit("no segment has a prompt.txt yet")
    fails = 0
    for seg in segs:
        print(seg)
        for name, ok, detail in lint(video, seg):
            fails += not ok
            print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))
    print()
    print("lint: pass" if not fails else f"lint: {fails} failure(s)")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
