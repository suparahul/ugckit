#!/usr/bin/env python3
"""The screen library of an app, for the character pipeline (the `screens` skill). Free.

    screens.py index <slug>                       add the user's new recordings and stills,
                                                  measure them, write SCREENS.md
    screens.py check <slug> [id ...]              each row against the capture recipe, and
                                                  the hero string read by OCR in the source
    screens.py fill <slug> <id> <video> <seg>     start the segment's insert.json from the row

The user provides the recordings (decided 2026-10-02); the pipeline only checks and
indexes them. The data is apps/<slug>/screens/screens.json; SCREENS.md is written from it,
for people and for shots.py check. A row the user has not described yet (the job, the
events, the hero element) is listed with what is missing. Only for a plan with app
insertion.
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

VIDEO_EXT = (".mp4", ".mov", ".m4v")
STILL_EXT = (".png", ".jpg", ".jpeg", ".webp")
NEEDS = {"recognition": 0, "large type": 280, "body text": 550}
GESTURES = ("tap", "scroll", "swipe")
TYPE_MODE = {"O": "over-shoulder", "G": "in-hand", "S": "show-to-camera", "H": "push", "F": "finger"}

PROBLEMS = []


def bad(msg):
    PROBLEMS.append(msg)
    print(f"  ✗ {msg}")


def good(msg):
    print(f"  ✓ {msg}")


def sdir(slug):
    return os.path.join(ROOT, "apps", slug, "screens")


def load(slug):
    p = os.path.join(sdir(slug), "screens.json")
    if os.path.exists(p):
        return json.load(open(p))
    return {"_comment": "The screen library: written by scripts/character/screens.py index, described "
                        "with the user (the screens skill). See docs/character/screens.example.json.",
            "app": slug, "screens": []}


def save(slug, d):
    json.dump(d, open(os.path.join(sdir(slug), "screens.json"), "w"), indent=2)
    render(slug, d)


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,avg_frame_rate", "-show_entries", "format=duration",
                        "-of", "json", path], capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
        s = j["streams"][0]
        n, d = s.get("avg_frame_rate", "0/1").split("/")
        fps = round(float(n) / float(d), 2) if float(d) else None
        dur = float(j.get("format", {}).get("duration") or 0) or None
        return [int(s["width"]), int(s["height"])], fps, dur
    except Exception:
        return None, None, None


def missing(row):
    out = []
    if not row.get("job"):
        out.append("job")
    if row.get("kind") == "recording" and not row.get("events"):
        out.append("events")
    h = row.get("hero") or {}
    if not h.get("text"):
        out.append("hero text")
    if h.get("needs") not in NEEDS:
        out.append("hero need")
    for k in ("mode", "app_version", "date"):
        if not row.get(k):
            out.append(k)
    return out


def render(slug, d):
    L = [f"# Screens of {slug}", "",
         "The user's recordings and stills, checked and indexed for the character pipeline. Written",
         "by `scripts/character/screens.py` from `screens.json`; edit `screens.json`, not this file.",
         "Every app pixel of a character video comes from here; the app is never a reference.", "",
         "| id | file | kind | job | length | events | hero element | needs | mode | app version | date | missing |",
         "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in d["screens"]:
        ev = "; ".join(f"{e.get('t')} s {e.get('gesture')}" for e in r.get("events") or []) or "-"
        h = r.get("hero") or {}
        state = "EXPIRED" if r.get("expired") else ("FILE MISSING" if r.get("file_missing") else
                                                   ", ".join(missing(r)) or "-")
        L.append(f"| {r['id']} | {r['file']} | {r.get('kind')} | {r.get('job') or '-'} | "
                 f"{r.get('duration_s') or '-'} | {ev} | {h.get('text') or '-'} | {h.get('needs') or '-'} | "
                 f"{r.get('mode') or '-'} | {r.get('app_version') or '-'} | {r.get('date') or '-'} | {state} |")
    open(os.path.join(sdir(slug), "SCREENS.md"), "w").write("\n".join(L) + "\n")


# ---------------------------------------------------------------- index
def cmd_index(slug):
    d = sdir(slug)
    if not os.path.isdir(d):
        os.makedirs(d)
        print(f"made apps/{slug}/screens/ -- the user puts the recordings and stills here")
    lib = load(slug)
    rows = {r["file"]: r for r in lib["screens"]}
    stills_used = {v for r in lib["screens"] for v in (r.get("stills") or {}).values()}
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        low = f.lower()
        if not low.endswith(VIDEO_EXT + STILL_EXT) or f in stills_used:
            continue
        size, fps, dur = probe(p)
        r = rows.get(f)
        if r is None:
            r = {"id": os.path.splitext(f)[0], "file": f,
                 "kind": "recording" if low.endswith(VIDEO_EXT) else "still",
                 "job": None, "events": [], "hero": {"text": None, "rect_source_px": None, "needs": None},
                 "mode": None, "app_version": None, "date": None, "stills": {}, "patches": []}
            lib["screens"].append(r)
            rows[f] = r
            print(f"  + {f} ({r['kind']})")
        r["size"] = size
        if r["kind"] == "recording":
            r["fps"], r["duration_s"] = fps, round(dur, 2) if dur else None
        r.pop("file_missing", None)
    for r in lib["screens"]:
        if not os.path.exists(os.path.join(d, r["file"])):
            r["file_missing"] = True
            print(f"  ! {r['file']} is in screens.json but not on disk")
    save(slug, lib)
    for r in lib["screens"]:
        m = missing(r)
        print(f"  {r['id']:<24} {r['kind']:<10} " + ("ready to check" if not m else "to describe: " + ", ".join(m)))
    print(f"wrote apps/{slug}/screens/screens.json and SCREENS.md")


# ---------------------------------------------------------------- check
def hero_frame(slug, r, out):
    p = os.path.join(sdir(slug), r["file"])
    if r["kind"] == "still":
        return p
    ev = [e["t"] for e in r.get("events") or [] if isinstance(e.get("t"), (int, float))]
    t = (r.get("hero") or {}).get("t")
    if t is None:
        t = min((r.get("duration_s") or 1) - 0.3, (max(ev) + 0.6) if ev else (r.get("duration_s") or 1) / 2)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(max(0, t)), "-i", p, "-frames:v", "1", out],
                   check=False)
    return out


def cmd_check(slug, ids):
    lib = load(slug)
    rows = [r for r in lib["screens"] if not ids or r["id"] in ids]
    if not rows:
        sys.exit(f"no screen to check in apps/{slug}/screens/screens.json -- run: screens.py index {slug}")
    render(slug, lib)
    import ocr
    import cv2
    work = os.path.join(sdir(slug), ".check")
    os.makedirs(work, exist_ok=True)
    for r in rows:
        print(f"{r['id']}  ({r['file']}, {r['kind']})")
        before = len(PROBLEMS)
        p = os.path.join(sdir(slug), r["file"])
        if r.get("expired"):
            bad(f"{r['id']}: marked expired (the app's UI changed) -- the user records it again")
        if not os.path.exists(p):
            bad(f"{r['id']}: {r['file']} is not on disk")
            continue
        for m in missing(r):
            bad(f"{r['id']}: no {m}")
        if r.get("mode") and r["mode"] not in ("light", "dark"):
            bad(f"{r['id']}: mode is light or dark")
        size = r.get("size") or [0, 0]
        h = r.get("hero") or {}
        rect = h.get("rect_source_px")
        if rect:
            x, y, w, hh = rect
            if w <= 0 or hh <= 0 or x < 0 or y < 0 or x + w > size[0] or y + hh > size[1]:
                bad(f"{r['id']}: hero rect {rect} is not inside the {size[0]}x{size[1]} source")
        if r["kind"] == "recording":
            ev = r.get("events") or []
            dur = r.get("duration_s") or 0
            ts = [e.get("t") for e in ev]
            gest = [e for e in ev if e.get("gesture") in GESTURES]
            if any(not isinstance(t, (int, float)) for t in ts) or ts != sorted(ts):
                bad(f"{r['id']}: the events need times in seconds, in order")
            else:
                if any(e.get("gesture") not in GESTURES for e in ev):
                    bad(f"{r['id']}: an event's gesture is tap, scroll or swipe")
                if len(gest) > 3:
                    bad(f"{r['id']}: {len(gest)} gestures; one recording, one job, at most three gestures "
                        "(more than that is an R cutaway, or two recordings)")
                if ts and ts[0] < 0.5:
                    bad(f"{r['id']}: the first gesture at {ts[0]} s; hold a stable frame 0.5 s first")
                if ts and dur and dur - ts[-1] < 1.0:
                    bad(f"{r['id']}: the last gesture at {ts[-1]} s of {dur} s; end on the result and hold 1 s")
                for a, b in zip(ev, ev[1:]):
                    if a.get("gesture") == "tap" and b["t"] - a["t"] < 0.4:
                        bad(f"{r['id']}: only {b['t'] - a['t']:.2f} s after the tap at {a['t']} s; pause 0.4 s or more")
                if ts and len(PROBLEMS) == before:
                    good(f"{len(gest)} gesture(s) in {dur} s, holds and pauses as the recipe asks")
            if (r.get("fps") or 0) and r["fps"] < 30:
                print(f"  ! {r['fps']} fps; 60 fps when the phone offers it")
            if any(e.get("gesture") in ("scroll", "swipe") for e in ev):
                st_ = r.get("stills") or {}
                if not st_.get("long") and not (st_.get("start") and st_.get("end")):
                    print("  ! for an F plate: a long screenshot (a scroll) or start and end stills (a swipe), "
                          "in stills.long or stills.start and stills.end")
        if h.get("text"):
            img = hero_frame(slug, r, os.path.join(work, f"{r['id']}-hero.png"))
            if rect:
                im = cv2.imread(img)
                if im is not None:
                    x, y, w, hh = rect
                    m = int(0.15 * max(w, hh))
                    crop = im[max(0, y - m):y + hh + m, max(0, x - m):x + w + m]
                    img = os.path.join(work, f"{r['id']}-hero-crop.png")
                    cv2.imwrite(img, crop)
            got = ocr.read([img])
            if got is None:
                print("  ! hero OCR not run: no OCR engine (brew install tesseract, or macOS with swift)")
            else:
                ok, score = ocr.matches(h["text"], got[img])
                (good if ok else bad)(f"hero '{h['text']}' read in the source: similarity {score}")
    print()
    if PROBLEMS:
        print(f"{len(PROBLEMS)} problem(s). Describe or re-record before a plate uses these screens.")
        sys.exit(1)
    print("ok")


# ---------------------------------------------------------------- fill
def cmd_fill(slug, sid, video, seg):
    lib = load(slug)
    row = next((r for r in lib["screens"] if r["id"] == sid), None)
    if row is None:
        sys.exit(f"no screen {sid} in apps/{slug}/screens/screens.json")
    t = seg.split("-")[-1].upper()
    if t not in TYPE_MODE:
        sys.exit(f"{seg} is not a phone segment (O, G, S, H, F)")
    vdir = os.path.join(ROOT, "pipeline", "character", video)
    plan = json.load(open(os.path.join(vdir, "plan.json")))
    if plan.get("app_insertion") is not True:
        sys.exit("the plan has no app insertion")
    shot_p = os.path.join(vdir, "shots", f"{seg}.json")
    shot = json.load(open(shot_p)) if os.path.exists(shot_p) else {}
    dur = float((shot.get("video") or {}).get("duration_seconds") or 0)
    if not dur:
        sys.exit(f"no shots/{seg}.json with video.duration_seconds: the plate window comes from it")
    ip = os.path.join(vdir, "segments", seg, "insert.json")
    os.makedirs(os.path.dirname(ip), exist_ok=True)
    spec = json.load(open(ip)) if os.path.exists(ip) else {}
    rel = os.path.relpath(os.path.join(sdir(slug), row["file"]), ROOT)
    st_ = row.get("stills") or {}
    gestures = [e for e in row.get("events") or [] if e.get("gesture") in GESTURES]
    kind = row["kind"]
    if kind == "still":
        src = rel
    elif t == "S":
        # S shows a still screenshot: the row's end or start still, or one frame of the
        # recording at the hero's time, kept beside it in the library.
        name = st_.get("end") or st_.get("start")
        if not name:
            name = f"{row['id']}-still.png"
            t_h = (row.get("hero") or {}).get("t") or (row.get("duration_s") or 1) / 2
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(t_h), "-i",
                            os.path.join(sdir(slug), row["file"]), "-frames:v", "1",
                            os.path.join(sdir(slug), name)], check=True)
            row.setdefault("stills", {})["s"] = name
            save(slug, lib)
            print(f"  still for S: {name}, the recording at {t_h} s")
        kind, src = "still", os.path.relpath(os.path.join(sdir(slug), name), ROOT)
    elif t == "F" and st_.get("long") and any(e["gesture"] == "scroll" for e in gestures):
        kind, src = "finger-driven", os.path.relpath(os.path.join(sdir(slug), st_["long"]), ROOT)
    elif t == "F" and st_.get("start") and st_.get("end") and any(e["gesture"] == "swipe" for e in gestures):
        kind = "finger-driven"
        src = [os.path.relpath(os.path.join(sdir(slug), st_[k]), ROOT) for k in ("start", "end")]
    else:
        kind, src = "recording", rel
    spec.update({"mode": TYPE_MODE[t], "screen_id": sid, "source": src, "source_kind": kind})
    spec.setdefault("plate_window", [0.0, dur])
    w0, w1 = spec["plate_window"]
    if kind == "recording":
        # A first guess: the recording laid on the plate window at its own speed. The
        # plate_t of every beat is measured again on the real plate (the skill, step 4).
        # A first guess: the recording laid on the plate window, at its own speed when it
        # fits, squeezed evenly when it is longer. The plate_t of every beat is measured
        # again on the real plate (the skill, step 4).
        rd = row.get("duration_s") or (w1 - w0)
        k = min(1.0, (w1 - w0) / rd) if rd else 1.0
        beats = [{"app_t": 0.0, "plate_t": w0, "label": "start", "region": None}]
        for e in row.get("events") or []:
            beats.append({"app_t": e["t"], "plate_t": round(w0 + e["t"] * k, 2),
                          "label": e.get("label") or e.get("gesture"), "region": e.get("region")})
        beats.append({"app_t": rd, "plate_t": round(w0 + rd * k, 2), "label": "end", "region": None})
        spec["beats"] = beats
        spec["patches"] = row.get("patches") or []
    else:
        spec.pop("beats", None)
    n = len(gestures)
    spec["gesture_rung"] = 1 if n == 0 else (2 if all(e["gesture"] == "tap" for e in gestures) and n == 1 else 3)
    h = row.get("hero") or {}
    # The hero rect is in the recording's pixels. A still or a finger-driven picture is
    # another picture: its OCR reads the whole screen instead.
    rect = h.get("rect_source_px") if kind == "recording" or (t == "S" and row["kind"] == "recording"
                                                               and not (st_.get("end") or st_.get("start"))) else None
    spec["hero"] = {"text": h.get("text"), "rect_source_px": rect, "needs": h.get("needs")}
    spec["legibility"] = {"min_screen_width_px_at_1080": NEEDS.get(h.get("needs"), 0),
                          "ocr_must_read_hero": h.get("needs") in ("large type", "body text")}
    spec.setdefault("key", {"color": [0, 177, 64], "hue_tol": 26, "sat_min": 55, "val_min": 35, "dark_max": 105})
    spec.setdefault("track", {"mode": "motion" if t in ("H", "F") else "per-frame",
                              "locked_if_drift_pct_under": 2,
                              "motion": {"median_frames": 3, "smooth_frames": 5, "join_green_regions": True}})
    if t == "F":
        g = "scroll" if any(e["gesture"] == "scroll" for e in gestures) else (
            "swipe" if any(e["gesture"] == "swipe" for e in gestures) else "tap")
        spec.setdefault("occlusion", {"dark_exception": "notch zone and edge band only", "edge_soften_px": 1,
                                      "despill": "whole finger"})
        spec.setdefault("finger", {"gesture": g, "contact_frame": None, "release_frame": None,
                                   "momentum_tau_s": 0.5})
    spec.setdefault("motion_blur", {"on": t == "H", "shutter_deg": 180})
    spec.setdefault("composite_resolution", "1080x1920")
    spec.setdefault("grade", {"blur": 0.5, "brightness": 0.0, "contrast": 1.04, "saturation": 1.0,
                              "reflection": 0.05, "noise": 5, "black_lift": 0.0})
    spec.setdefault("smooth", 7)
    spec.setdefault("gates", {"green_g_std_max": 10, "drift_pct_max": 8,
                              "flat_on": {"opposite_edge_diff_pct_max": 3, "corner_deg_from_90_max": 3,
                                          "long_edge_deg_from_vertical_max": 3},
                              "strict_green_pixels_in_final": 0, "tap_alignment_frames_max": 2,
                              "motion": {"push_max_deg_from_square": 8, "corner_jump_pct_screen_w_max": 2,
                                         "scroll_follow_pct_screen_h_max": 5}})
    json.dump(spec, open(ip, "w"), indent=2)
    print(f"{os.path.relpath(ip, ROOT)}: {TYPE_MODE[t]}, {kind} from {sid}"
          + (f", {len(spec.get('beats', []))} beats (measure plate_t on the plate)" if kind == "recording" else ""))


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    if a[0] == "index":
        cmd_index(a[1])
    elif a[0] == "check":
        cmd_check(a[1], a[2:])
    elif a[0] == "fill" and len(a) == 5:
        cmd_fill(*a[1:5])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
