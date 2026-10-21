#!/usr/bin/env python3
"""The offline test of two small planning rules the Atlas relies on. Free: no generation, no
network. Not shipped (the installer copies template/ only).

    python3 tests/video-planning/run.py

  - video_plan.py atlas_approval: the Atlas "Approve plan" line is the user's approval only when
    it is the last plan line for the video, written by the user, for this revision and digest;
  - video_plan.py check_row_fields: a filled idea field of the studio plan row (video type, hook,
    hook job, length) is kept verbatim in the brief, as a choice with status user;
  - the demo source of an app beat (scripts/character/demo.py, through video_plan.py): a real
    recording first, motion design only with its reason and a screen story of the app's real
    screens; a live_use video with motion design is the user's choice, never blocked.

Exit 1 when any expectation fails.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(HERE)), "template", "scripts", "planning"))
import video_plan as vp  # noqa: E402

RESULTS = []
ID, DIG = "maya-2026-10-06-vettech", "a" * 64


def expect(label, fn, ok=True, contains=None):
    try:
        got, err = fn(), None
    except SystemExit as e:
        got, err = None, str(e)
    good = (err is None) == ok and (contains is None or contains in (err or str(got)))
    RESULTS.append(good)
    print(f"{'PASS' if good else 'FAIL'}  {label}")
    if not good:
        print(f"      got {got!r}, error {err!r}")
    return got


def line(kind="plan.approve", **kw):
    e = {"at": "2026-10-04T12:30:00.000Z", "post": "2026-10-06/maya/1", "kind": kind,
         "data": {"video": ID, "revision": 2, "digest": DIG}}
    e.update(kw)
    return e


# ------------------------------------------------------------------ the Atlas approval
words = expect("an Atlas plan.approve for this revision and digest is the approval",
               lambda: vp.atlas_approval([line()], ID, 2, DIG))
assert words is None or words == ("Approve plan (clicked in the Atlas on revision 2)", "2026-10-04", "2026-10-04T12:30:00.000Z")
expect("the note of the click, when there is one, is the words",
       lambda: vp.atlas_approval([line(note="yes, this one")], ID, 2, DIG), contains="yes, this one")
expect("no Atlas line: refused", lambda: vp.atlas_approval([], ID, 2, DIG), ok=False, contains="no Atlas plan decision")
expect("a line for another video does not count",
       lambda: vp.atlas_approval([line(data={"video": "other", "revision": 2, "digest": DIG})], ID, 2, DIG),
       ok=False, contains="no Atlas plan decision")
expect("a later send-back wins", lambda: vp.atlas_approval([line(), line("plan.sendback", note="shorter")], ID, 2, DIG),
       ok=False, contains="send-back")
expect("an approval after a send-back counts", lambda: vp.atlas_approval([line("plan.sendback", note="x"), line()], ID, 2, DIG))
expect("another digest is refused", lambda: vp.atlas_approval([line()], ID, 2, "b" * 64), ok=False, contains="digest")
expect("another revision is refused", lambda: vp.atlas_approval([line()], ID, 3, DIG), ok=False, contains="revision 2")
expect("a line an agent wrote is not the user's", lambda: vp.atlas_approval([line(actor="demo")], ID, 2, DIG),
       ok=False, contains="not by the user")


# ------------------------------------------------------------------ the row's idea fields
T = vp.taxonomy()


def brief(row_fields, **over):
    b = {"strategy_ref": {"row_fields": row_fields},
         "anatomy": {"filming_format": "talking_head", "hook": {"job_id": "gratitude_discovery", "channel": "spoken"},
                     "length_band": "15", "length_s": 15},
         "hook_alternatives": [{"id": "h1", "text": "I could kiss the vet tech"}], "selected_hook": "h1",
         "choices": [{"slot": s, "status": "user"} for s in ("filming_format", "hook_text", "hook_job", "length_band")]}
    for k, v in over.items():
        b[k] = v
    return b


def rows(b):
    out = vp.Out(quiet=True)
    vp.check_row_fields(b, T, out)
    if out.bad:
        sys.exit("; ".join(out.bad))
    return "ok"


FULL = {"video_type": "talking_head", "hook": "I could kiss the vet tech", "hook_job": "gratitude_discovery", "length": "15"}
expect("every filled field kept, each a user choice", lambda: rows(brief(FULL)))
expect("a brief without row_fields (an older brief) is not checked", lambda: rows({"anatomy": {}}))
expect("empty fields are video-plan's to choose",
       lambda: rows(brief({"video_type": "talking_head", "hook": None, "hook_job": None, "length": None},
                          choices=[{"slot": "filming_format", "status": "user"}])))
expect("a row hook not kept verbatim is refused",
       lambda: rows(brief({**FULL, "hook": "I could hug the vet tech"})), ok=False, contains="h1, verbatim")
expect("a row hook job changed is refused", lambda: rows(brief({**FULL, "hook_job": "imminent_need"})),
       ok=False, contains="hook job")
expect("a row length changed is refused", lambda: rows(brief({**FULL, "length": "30"})), ok=False, contains="band 30")
expect("a length in seconds matches length_s",
       lambda: rows(brief({**FULL, "length": "12"}, anatomy={**brief(FULL)["anatomy"], "length_band": "15", "length_s": 12})))
expect("a length in seconds that differs is refused", lambda: rows(brief({**FULL, "length": "12"})),
       ok=False, contains="12 s")
expect("a row video type changed is refused", lambda: rows(brief({**FULL, "video_type": "live_use"})),
       ok=False, contains="video type")
expect("reaction means the reaction hook channel", lambda: rows(brief({**FULL, "video_type": "reaction"},
       choices=[{"slot": s, "status": "user"} for s in ("hook_channel", "hook_text", "hook_job", "length_band")])),
       ok=False, contains="hook.channel must be reaction")
expect("a filled field with no user choice is refused", lambda: rows(brief(FULL, choices=[])),
       ok=False, contains="status user")

# ------------------------------------------------------------------ the demo source (founder, 2026-10-19)
SCREENS = {"Tail Reading": "**Shows:** \"Tail reading\", \"Upload a clip\", the posture (\"Relaxed tail\")."}
LIB = {"scan-result": {"id": "scan-result", "kind": "recording"}}


def md_beat(**over):
    b = {"id": "b2", "start_s": 4, "end_s": 9, "app_on_screen": True, "framing": "app_screen", "screen_id": "tail-reading",
         "viewer_must": "read", "demo_source": "motion_design", "demo_source_reason": "no recording of the reading yet",
         "screen_story": {"screens": ["Tail Reading"], "rebuilt_from": ["code src/TailReading.tsx"], "fit": "pad", "steps": [
             {"at_s": 0, "screen": "Tail Reading", "action": "appear", "target": None, "shows": ["Tail reading", "Upload a clip"]},
             {"at_s": 1.5, "screen": "Tail Reading", "action": "tap", "target": "Upload a clip", "shows": ["Upload a clip"]},
             {"at_s": 2.5, "screen": "Tail Reading", "action": "result", "target": None, "shows": ["Relaxed tail", "Biscuit is calm"]}]}}
    b.update(over)
    return b


def demo_check(b, rows=None, hero="Relaxed tail"):
    bad, notes = [], []
    plan = {"app": "catapp", "hero_strings": {b.get("screen_id"): hero}, "beats": [b]}
    vp.demo.check_beat(vp.ROOT, plan, b, LIB if rows is None else rows, bad.append, notes.append, SCREENS)
    if bad:
        sys.exit("; ".join(bad))
    return " | ".join(notes)


notes = expect("a motion-designed beat with its reason and story passes", lambda: demo_check(md_beat()))
assert "scan-result" in notes and "Biscuit is calm" in notes, notes
expect("the library's recordings and the reason are named", lambda: demo_check(md_beat()), contains="the reason: no recording")
expect("the post's own words not in PRODUCT-SCREENS.md are named for the review",
       lambda: demo_check(md_beat()), contains="'Biscuit is calm'")
expect("no reason: refused", lambda: demo_check(md_beat(demo_source_reason="")), ok=False, contains="demo_source_reason")
expect("a screen the library records: refused (a recording first)",
       lambda: demo_check(md_beat(screen_id="scan-result")), ok=False, contains="real recording in the screen library")
expect("a screen PRODUCT-SCREENS.md does not describe: refused",
       lambda: demo_check(md_beat(screen_story={**md_beat()["screen_story"], "screens": ["Tail Scanner"]})),
       ok=False, contains="not a heading")
expect("no PRODUCT-SCREENS.md: refused", lambda: vp.demo.check_beat(vp.ROOT, {"app": "nope"}, md_beat(), {},
       lambda m: sys.exit(m), lambda m: None, None), ok=False, contains="PRODUCT-SCREENS.md does not exist")
expect("motion design on a phone plate: refused", lambda: demo_check(md_beat(framing="hands_only")), ok=False,
       contains="rendered full screen")
expect("a step after the beat's end: refused", lambda: demo_check(md_beat(end_s=6)), ok=False, contains="inside its 2 s")
expect("a hero string the story does not show: refused", lambda: demo_check(md_beat(), hero="Happy"), ok=False,
       contains="not one of the strings")
expect("a still named as a recording: refused",
       lambda: demo_check({"id": "b3", "app_on_screen": True, "framing": "app_screen", "screen_id": "s1", "demo_source": "recording"},
                          rows={"s1": {"kind": "still"}}), ok=False, contains="is a still")
expect("a screen story without motion design: refused",
       lambda: demo_check({"id": "b3", "app_on_screen": True, "screen_id": "scan-result", "screen_story": {}}), ok=False,
       contains="belongs to demo_source motion_design")
expect("an old beat with no demo_source passes untouched",
       lambda: demo_check({"id": "b3", "app_on_screen": True, "framing": "app_screen", "screen_id": "scan-result"}))
caps = vp.capabilities_needed({"beats": [md_beat()]})
expect("motion design needs bridge.motion_design", lambda: list(caps), contains="bridge.motion_design")
live = {"app": "catapp", "handle": "nora", "editorial": {"filming_format": "live_use"},
        "beats": [md_beat()], "hero_strings": {"tail-reading": "Relaxed tail"}}
expect("a live_use plan with a motion-designed screen: no screen-library block (the user's choice)",
       lambda: "; ".join(vp.readiness(live, "plan.draft.json")[0]) or "nothing blocks",
       contains="nothing blocks")
st = vp.demo.segment_story({"beats": [{"id": "b1", "start_s": 0, "end_s": 4}, md_beat()], "hero_strings": {"tail-reading": "Relaxed tail"}},
                           ["b2"])
expect("the segment's story: 5 s, the steps from its start, the hero",
       lambda: (st["seconds"], [x["at_s"] for x in st["steps"]], st["hero"]), contains="(5, [0.0, 1.5, 2.5], 'Relaxed tail')")

print(f"\n{sum(RESULTS)} of {len(RESULTS)} expectations met")
sys.exit(0 if all(RESULTS) else 1)
