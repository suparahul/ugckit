#!/usr/bin/env python3
"""The prompt lint of the character pipeline (P1, gate A). Free; runs before any spend.

    lint_prompt.py <video> [segment ...]      every segment with a prompt.txt, or the named ones

Reads pipeline/character/<video>/segments/<seg>/prompt.txt with its shot file
(shots/<seg>.json), its refs.json and the plan. One line per check, PASS or FAIL; exit 1
on any FAIL. The checks: the length, the section order, no booster
or glamour word, every reference bound alone, an end state on every shot, a job for
every hand, no conflicting camera words, the word budget, the flat-on sentence in every
O, G and S prompt and no word that angles the phone, the push sentence in H and the
finger sentence in F with their times, no spoken line in H or F, lip sync stated for a
talking segment, the shot times within the generated length, no generation
parameter, and the reference-picture limit.
"""
import json, os, re, sys

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
    text = open(pp).read()
    t = str(shot.get("segment_type", "")).upper()
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
    check("sections", order_ok and heads[-1] == "NO TEXT",
          ("missing " + ", ".join(missing) + "; " if missing else "") +
          ("NO TEXT is last" if heads[-1] == "NO TEXT" else "NO TEXT must be the last section") +
          ("" if order_ok else "; the order is in the character-shots skill, step 5"))

    hits = sorted({w for w in BOOSTERS if unnegated(front, w)})
    check("no booster or glamour word", not hits, ", ".join(hits))

    if refs:
        rb = allb("REFERENCES")
        unbound = [r["file"] for r in refs if os.path.basename(r["file"]) not in rb]
        sentences = [s for s in re.split(r"\n+", rb) if s.strip()]
        check("every reference bound alone", not unbound and len(sentences) >= len(refs),
              ("not named in REFERENCES: " + ", ".join(unbound)) if unbound else
              f"{len(refs)} reference(s), {len(sentences)} line(s)")

    shots_b = [b for h, b in secs if kind(h) == "SHOT"]
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
    if t in ("H", "F"):
        quoted = re.findall(r"[\"“][^\"”]{3,}[\"”]", "\n".join(shots_b))
        silent = "does not speak" in text.lower()
        check("no spoken line", not spoken and not quoted and silent,
              "an H or F segment has no line on camera and says 'She does not speak'")
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
    except Exception:
        lim = {}
    imgs = sum(1 for r in refs if r.get("kind") != "voice")
    mx = lim.get("max_reference_images")
    check("reference pictures within the limit", not mx or imgs <= mx, f"{imgs} of at most {mx}")
    return results


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    video = a[0]
    sroot = os.path.join(ROOT, "pipeline", "character", video, "segments")
    segs = a[1:] or sorted(d for d in os.listdir(sroot)
                           if os.path.exists(os.path.join(sroot, d, "prompt.txt")))
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
