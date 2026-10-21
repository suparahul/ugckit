"""The demo source of an app beat, and the screen story of a motion-designed demo. Free, local.

A full-screen app beat (framing app_screen: an R or P segment) shows the real app from one of
three sources, the beat's `demo_source` (founder, 2026-10-19):

  recording       a real screen recording from the screen library (apps/<slug>/screens/)
  still           a real still from the screen library, held
  motion_design   the app's real screens rebuilt in code from the app's own screens, code and
                  in-app text (apps/<slug>/PRODUCT-SCREENS.md), animated (taps, scrolls, the
                  result appearing) and rendered locally at 1080x1920
                  (scripts/character/motion_design.py). No video model, no invented UI or text.

A beat with no demo_source reads as before: the library row's kind (a still is `still`, else
`recording`). A real recording is preferred: motion design fills the frame and looks more like
a promotion than a hand holding a phone, so the plan names it only when no recording shows the
screen, and says why in `demo_source_reason`. A motion-designed beat names a screen_id of its
own, never a library row's (a library row is a real recording: use it).

The beat's `screen_story` is what the render shows, and nothing else:

  {"screens": ["<a ## heading of PRODUCT-SCREENS.md, exactly>"],
   "rebuilt_from": ["<the app's code path or screenshot each screen is rebuilt from>"],
   "steps": [{"at_s": 0.0, "screen": "<one of screens>", "action": "appear|tap|scroll|swipe|type|result|hold",
              "target": "<what is tapped or scrolled, or null>",
              "shows": ["<every in-app string visible at this step, word for word>"]}],
   "fit": "pad|crop"}

`at_s` is seconds from the beat's start. `fit` pad (the default) keeps the whole phone screen at
the frame's height on the screen's own background, as the first two motion-designed posts were
(2026-10-14); crop fills the width and crops the height around the hero element.

On a phone or in a panel (2026-10-21, the user's choice): a motion-designed beat may also be the
screen of a phone plate (O, G, S, H, F, or a C clip that films a phone) or of a panel (M). The
render is then the bare phone screen at its own aspect (fit `screen`, set here, whatever the
story says), approved at gate B like a full-screen one, and laid into the phone by composite.sh
(`motion_design.py fill` writes its insert.json) or into the panel by assemble.py, as a real
recording is. The check notes the trade-off; it never refuses it.

Used by bridge.py (the production check of the plan), video_plan.py (the planning check),
motion_design.py (the render and its gates), review.py and assemble.py.
"""
import difflib, json, os, re

SOURCES = ("recording", "still", "motion_design")
ACTIONS = ("appear", "tap", "scroll", "swipe", "type", "result", "hold")
FITS = ("pad", "crop")
# A render for a phone plate or a panel: the bare screen at its own aspect (motion_render.mjs --fit screen).
SCREEN_FIT = "screen"
# Where a picture inside a motion-designed screen may come from: the app itself (its code,
# fonts, icons, its own screenshots), a supplied asset of the plan (the owner's real clip or
# photo), or a fixed subject's approved picture in the handle's world.
ASSET_FROM = ("app:", "plan:", "world:")
# Not product screens: the file's own sections.
NOT_SCREENS = {"how to choose"}


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w%$€£.,:'/-]+", " ", str(s or "").lower().replace("’", "'"))).strip()


def placeholder(v):
    return v is None or (isinstance(v, str) and (not v.strip() or bool(re.search(r"<[^>]*>", v))))


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def screen_rows(root, app):
    p = os.path.join(root, "apps", str(app), "screens", "screens.json")
    if not os.path.exists(p):
        return {}
    return {r.get("id"): r for r in (json.load(open(p)).get("screens") or []) if not r.get("expired")}


def product_screens(root, app):
    """{heading: section text} of apps/<slug>/PRODUCT-SCREENS.md, or None when there is no file."""
    p = os.path.join(root, "apps", str(app), "PRODUCT-SCREENS.md")
    if not os.path.exists(p):
        return None
    out, name, body = {}, None, []
    for line in open(p, encoding="utf-8"):
        m = re.match(r"^## (.+?)\s*$", line)
        if m:
            if name and name.lower() not in NOT_SCREENS:
                out[name] = "".join(body)
            name, body = m.group(1), []
        elif name:
            body.append(line)
    if name and name.lower() not in NOT_SCREENS:
        out[name] = "".join(body)
    return out


def source_of(beat, rows=None):
    """The beat's demo source: its demo_source, else the library row's kind; None for a beat
    that does not show the app."""
    if not beat.get("app_on_screen"):
        return None
    ds = beat.get("demo_source")
    if ds:
        return ds
    row = (rows or {}).get(beat.get("screen_id")) or {}
    return "still" if row.get("kind") == "still" else "recording"


def is_motion(beat):
    return bool(beat) and beat.get("demo_source") == "motion_design"


def story_strings(story):
    return [s for st in (story or {}).get("steps") or [] for s in st.get("shows") or [] if isinstance(s, str)]


def recordings(rows):
    return sorted(k for k, r in rows.items() if r.get("kind") != "still")


def check_beat(root, plan, b, rows, bad, note, screens=None):
    """The demo source of one beat. bad(msg) refuses; note(msg) informs."""
    tag = f"beat {b.get('id')}"
    ds = b.get("demo_source")
    if ds is None and b.get("screen_story") is not None:
        bad(f"{tag}: a screen_story belongs to demo_source motion_design")
    if ds is None:
        return
    if not b.get("app_on_screen"):
        bad(f"{tag}: demo_source picks the picture of an app beat (app_on_screen true)")
        return
    if ds not in SOURCES:
        bad(f"{tag}: demo_source {ds!r}; one of {', '.join(SOURCES)}")
        return
    sid = b.get("screen_id")
    if ds in ("recording", "still"):
        row = rows.get(sid)
        if row and (row.get("kind") == "still") != (ds == "still"):
            bad(f"{tag}: screen {sid} is a {row.get('kind')} in the library; demo_source {ds} says otherwise")
        if b.get("screen_story") is not None:
            bad(f"{tag}: a screen_story belongs to demo_source motion_design, not {ds}")
        return
    # Motion design. Full screen (framing app_screen, R or P), or the screen of a phone plate or a
    # panel: the user's choice (2026-10-21), noted with its trade-off.
    full = b.get("framing") == "app_screen"
    if not full:
        note(f"{tag}: motion design on a phone or in a panel (framing {b.get('framing')}), the user's choice: "
             "the render is laid into the phone's green screen or the panel like a recording; a drawn screen "
             "in a filmed hand can look pasted on, so check the composite closely")
    if placeholder(b.get("demo_source_reason")):
        bad(f"{tag}: motion design needs demo_source_reason: why no real recording shows this screen")
    if placeholder(sid):
        bad(f"{tag}: a motion-designed screen names its own screen_id")
    elif sid in rows:
        bad(f"{tag}: screen {sid} is a real {rows[sid].get('kind') or 'recording'} in the screen library: "
            f"demo_source {'still' if rows[sid].get('kind') == 'still' else 'recording'} (a real recording is "
            "preferred to motion design)")
    elif recordings(rows):
        note(f"{tag}: motion design, while the screen library holds {', '.join(recordings(rows))}; "
             f"the reason: {b.get('demo_source_reason')}")
    if full and b.get("source_asset_ids"):
        bad(f"{tag}: a motion-designed screen is rendered, not supplied (no source_asset_ids)")
    st = b.get("screen_story")
    if not isinstance(st, dict):
        bad(f"{tag}: motion design needs its screen_story (the screens, what they are rebuilt from, the steps)")
        return
    if screens is None:
        screens = product_screens(root, plan.get("app"))
    names = st.get("screens") or []
    if screens is None:
        bad(f"{tag}: apps/{plan.get('app')}/PRODUCT-SCREENS.md does not exist: motion design rebuilds only "
            "the screens it describes")
    elif not names:
        bad(f"{tag}: screen_story.screens names the PRODUCT-SCREENS.md screens it rebuilds")
    else:
        for n in names:
            if n not in screens:
                bad(f"{tag}: screen {n!r} is not a heading of PRODUCT-SCREENS.md (the name exactly as the file has it)")
    if not [x for x in st.get("rebuilt_from") or [] if not placeholder(x)]:
        bad(f"{tag}: screen_story.rebuilt_from names the app's code or screenshots each screen is rebuilt from")
    if st.get("fit") not in (None,) + FITS:
        bad(f"{tag}: screen_story.fit {st.get('fit')!r}; one of {', '.join(FITS)}")
    steps = st.get("steps") or []
    if not steps:
        bad(f"{tag}: screen_story.steps: what the screen does, in order (appear, tap, scroll, the result)")
    length = (b.get("end_s") or 0) - (b.get("start_s") or 0)
    last = -1.0
    for k, s in enumerate(steps, 1):
        at = s.get("at_s")
        if not num(at) or at < 0 or at >= length:
            bad(f"{tag}: step {k}: at_s {at!r} is seconds from the beat's start, inside its {length:g} s")
        elif at <= last:
            bad(f"{tag}: step {k} starts at {at:g} s, not after the step before it")
        else:
            last = at
        if s.get("action") not in ACTIONS:
            bad(f"{tag}: step {k}: action {s.get('action')!r}; one of {', '.join(ACTIONS)}")
        if names and s.get("screen") not in names:
            bad(f"{tag}: step {k}: screen {s.get('screen')!r} is not in screen_story.screens")
        shows = s.get("shows")
        if not isinstance(shows, list) or not shows or any(placeholder(x) or not isinstance(x, str) for x in shows):
            bad(f"{tag}: step {k}: shows lists every in-app string visible at this step, word for word")
        if s.get("action") in ("tap", "scroll", "swipe", "type") and placeholder(s.get("target")):
            bad(f"{tag}: step {k}: a {s.get('action')} names its target (the button, the list, the field)")
    if steps and num(steps[0].get("at_s")) and steps[0]["at_s"] > 0.05:
        bad(f"{tag}: the first step is at 0 s (the screen is there from the beat's first frame)")
    texts = story_strings(st)
    if b.get("viewer_must") == "read":
        hero = (plan.get("hero_strings") or {}).get(sid)
        if placeholder(hero):
            bad(f"{tag}: the viewer reads screen {sid}: hero_strings[{sid!r}] is one string of its screen_story")
        elif norm(hero) not in {norm(x) for x in texts}:
            bad(f"{tag}: hero string {hero!r} is not one of the strings its screen_story shows")
    if screens:
        known = norm(" ".join(screens.get(n, "") for n in names))
        new = [x for x in dict.fromkeys(texts) if norm(x) and norm(x) not in known]
        if new:
            note(f"{tag}: in-app text not in PRODUCT-SCREENS.md: {', '.join(repr(x) for x in new[:6])}"
                 f"{' …' if len(new) > 6 else ''}; it must be what the app shows for this post (the subject's "
                 "own name and data), never new interface words")


def motion_beats(plan, beat_ids):
    bm = {b.get("id"): b for b in plan.get("beats") or []}
    return [bm[i] for i in beat_ids if i in bm and is_motion(bm[i])]


def segment_story(plan, beat_ids):
    """The screen story of a segment: the story of each motion-designed beat it carries, with its
    steps moved to seconds from the segment's start. None when no beat is motion-designed."""
    bm = {b.get("id"): b for b in plan.get("beats") or []}
    bb = [bm[i] for i in beat_ids if i in bm]
    mb = [b for b in bb if is_motion(b)]
    if not mb:
        return None
    t0 = bb[0].get("start_s") or 0
    steps, screens, rebuilt = [], [], []
    for b in mb:
        st = b.get("screen_story") or {}
        off = (b.get("start_s") or 0) - t0
        for s in st.get("steps") or []:
            steps.append({**s, "at_s": round(off + float(s.get("at_s") or 0), 3), "beat": b.get("id")})
        screens += [x for x in st.get("screens") or [] if x not in screens]
        rebuilt += [x for x in st.get("rebuilt_from") or [] if x not in rebuilt]
    sid = mb[0].get("screen_id")
    full = all(b.get("framing") == "app_screen" for b in mb)
    return {"screen_id": sid, "beats": [b.get("id") for b in bb],
            "seconds": round(sum((b.get("end_s") or 0) - (b.get("start_s") or 0) for b in bb), 3),
            "screens": screens, "rebuilt_from": rebuilt, "steps": steps,
            "fit": ((mb[0].get("screen_story") or {}).get("fit") or "pad") if full else SCREEN_FIT,
            "hero": (plan.get("hero_strings") or {}).get(sid),
            "reasons": [b.get("demo_source_reason") for b in mb]}


def text_close(a, b, ratio=0.85):
    a, b = norm(a), norm(b)
    return bool(a) and (a in b or difflib.SequenceMatcher(None, a, b).ratio() >= ratio)
