#!/usr/bin/env python3
"""The offline test of two small planning rules the Atlas relies on. Free: no generation, no
network. Not shipped (the installer copies template/ only).

    python3 tests/video-planning/run.py

  - video_plan.py atlas_approval: the Atlas "Approve plan" line is the user's approval only when
    it is the last plan line for the video, written by the user, for this revision and digest;
  - video_plan.py check_row_fields: a filled idea field of the studio plan row (video type, hook,
    hook job, length) is kept verbatim in the brief, as a choice with status user.

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

print(f"\n{sum(RESULTS)} of {len(RESULTS)} expectations met")
sys.exit(0 if all(RESULTS) else 1)
