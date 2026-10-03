"""The insertion gates of a phone segment (§ 11.10, § 11.12), for scripts/character/qc.py.
Free, local. Numbers are starting values, to be measured on the first real plates.

    qc.py <video> <segment>                       the plate gates, after the measures
    qc.py <video> <segment> --keyframe            the keyframe (and the H end still)
    qc.py <video> <segment> --composite [mp4]     the composite of composite.sh

Each gate prints PASS, FAIL or NOT RUN with its numbers, and the results go to
gates.json in the qc folder. A NOT RUN is never a pass.
"""
import glob, json, os, re
import numpy as np
import cv2
import screen_track as st

TIERS = {"recognition": 0, "large type": 280, "body text": 550}
PHONE = ("O", "G", "S", "H", "F")


def label(img, text):
    for col, th in (((0, 0, 0), 4), ((255, 255, 255), 2)):
        cv2.putText(img, text, (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, col, th, cv2.LINE_AA)


class Report:
    def __init__(self, title):
        self.rows = []
        print(f"\n{title}")

    def add(self, name, ok, detail=""):
        tag = "NOT RUN" if ok is None else ("PASS" if ok else "FAIL")
        self.rows.append({"gate": name, "result": tag, "detail": detail})
        print(f"  {tag:<7}  {name}" + (f"  ({detail})" if detail else ""))

    def note(self, text):
        print(f"  note     {text}")

    def ok(self):
        return all(r["result"] == "PASS" for r in self.rows)

    def save(self, path, extra=None):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        d = {"pass": self.ok(), "results": self.rows}
        d.update(extra or {})
        json.dump(d, open(path, "w"), indent=2)
        print(f"  -> {path}")


# A C segment that shows a filmed phone takes the gates of its insert mode, unchanged.
MODE_TYPE = {"over-shoulder": "O", "in-hand": "G", "show-to-camera": "S", "push": "H", "finger": "F"}


def seg_type(seg, spec=None):
    t = seg.split("-")[-1].upper()
    if t == "C" and spec is not None:
        return MODE_TYPE.get(spec.get("mode"), "G")
    return t


def spec_of(segdir):
    p = os.path.join(segdir, "insert.json")
    return json.load(open(p)) if os.path.exists(p) else {}


def gates_of(spec):
    g = dict(spec.get("gates") or {})
    g.setdefault("drift_pct_max", 8)
    g.setdefault("strict_green_pixels_in_final", 0)
    g.setdefault("tap_alignment_frames_max", 2)
    m = dict(g.get("motion") or {})
    m.setdefault("push_max_deg_from_square", 8)
    m.setdefault("corner_jump_pct_screen_w_max", 2)
    m.setdefault("scroll_follow_pct_screen_h_max", 5)
    g["motion"] = m
    return g


def fmt_flat(f):
    return f"edges {f['edge_diff_pct']}%, corner {f['corner_deg']}°, vertical {f['vertical_deg']}°"


def worst(fl):
    return {k: max(f[k] for f in fl) for k in ("edge_diff_pct", "corner_deg", "vertical_deg", "deg_from_square")}


def flat_gate(rep, name, quads, fps, gates, frames=None):
    frames = [f for f in (frames if frames is not None else sorted(quads)) if f in quads]
    if not frames:
        rep.add(name, False, "no frame to measure")
        return
    fl = {f: st.flat_on(quads[f]) for f in frames}
    bad = [f for f in frames if not st.flat_on_pass(fl[f], gates)]
    detail = f"worst {fmt_flat(worst(list(fl.values())))}; limits 3%, 3°, 3°"
    if bad:
        detail += f"; {len(bad)} of {len(frames)} frames fail, first at {bad[0] / fps:.2f}s"
    rep.add(name, not bad, detail)


def width_gate(rep, width_1080, needs):
    if not needs or needs not in TIERS:
        rep.note("screen width: the hero element names no need (recognition | large type | body text)")
        return
    lim = TIERS[needs]
    rep.add(f"screen width for {needs}", width_1080 >= lim,
            f"{width_1080:.0f} px of 1080 ({width_1080 / 10.8:.0f}%); {needs} needs {lim} px or more")


# ---------------------------------------------------------------- the plate
def plate_gates(root, video, seg, plate, out):
    segdir = f"{root}/pipeline/character/{video}/segments/{seg}"
    spec = spec_of(segdir)
    t = seg_type(seg, spec)
    gates = gates_of(spec)
    if t == "H":
        spec.setdefault("track", {"mode": "motion"})
    rep = Report(f"insertion gates of the plate ({t}, {spec.get('mode', 'mode not set')})")
    raw, areas, fps, W, H, _ = st.detect(plate, spec)
    quads, info = st.stabilise(raw, areas, spec, log=lambda *a: None)
    if not quads:
        rep.add("green screen", False, "none found: no green, no insert -- regenerate")
        rep.save(os.path.join(out, "gates.json"))
        return
    fs = sorted(quads)
    rep.note(f"screen tracked {fs[0] / fps:.2f}s - {fs[-1] / fps:.2f}s, {info['mode']}")
    scale = 1080.0 / W
    jumps = st.corner_jumps(quads)
    jmax = gates["motion"]["corner_jump_pct_screen_w_max"]
    if t == "H":
        hl = st.holds(quads, fps)
        if len(hl) < 2:
            rep.add("start and end holds", False, f"{len(hl)} hold(s) found; the push needs a hold before and after")
        else:
            (a0, a1), (b0, b1) = hl[0], hl[-1]
            sd, ed = (a1 - a0 + 1) / fps, (b1 - b0 + 1) / fps
            rep.add("start and end holds", sd >= 0.5 and ed >= 1.0,
                    f"start {a0 / fps:.2f}-{a1 / fps:.2f}s ({sd:.2f}s, 0.5 s or more), "
                    f"end {b0 / fps:.2f}-{b1 / fps:.2f}s ({ed:.2f}s, 1 s or more)")
            flat_gate(rep, "flat-on, start hold", quads, fps, gates, range(a0, a1 + 1))
            flat_gate(rep, "flat-on, end hold", quads, fps, gates, range(b0, b1 + 1))
            push = [f for f in fs if a1 < f < b0]
            if push:
                m = max(st.flat_on(quads[f])["deg_from_square"] for f in push)
                lim = gates["motion"]["push_max_deg_from_square"]
                rep.add("the push stays square", m <= lim, f"at most {m:.1f}° from square; limit {lim}°")
            for nm, (x0, x1) in (("start hold", (a0, a1)), ("end hold", (b0, b1))):
                d = st.drift_pct({f: quads[f] for f in range(x0, x1 + 1)})
                rep.add(f"drift, {nm}", d < gates["drift_pct_max"], f"{d:.1f}% of screen width; limit {gates['drift_pct_max']}%")
            hold_jumps = [v for f, v in jumps.items() if a0 <= f <= a1 or b0 <= f <= b1]
            push_jumps = [v for f, v in jumps.items() if a1 < f < b0]
            if push_jumps:
                rep.add("corner track during the push", max(push_jumps) <= jmax,
                        f"worst jump {max(push_jumps):.2f}% of screen width from the predicted corner; limit {jmax}%")
            if hold_jumps:
                rep.note(f"corner jumps on the holds at most {max(hold_jumps):.2f}%")
            width_gate(rep, np.median([st.quad_width(quads[f]) for f in range(b0, b1 + 1)]) * scale,
                       (spec.get("hero") or {}).get("needs"))
    else:
        flat_gate(rep, "flat-on to the lens, every frame", quads, fps, gates)
        d = st.drift_pct(quads)
        lim = gates["drift_pct_max"]
        still_g = t == "G" and (spec.get("gesture_rung") == 1 or len(spec.get("beats") or []) <= 2)
        if d < lim:
            rep.add("phone drift", True, f"{d:.1f}% of screen width; limit {lim}%")
        elif still_g and d <= 20:
            rep.add("phone drift", True, f"{d:.1f}%: allowed 8 to 20% only for a G with no gesture")
        else:
            rep.add("phone drift", False, f"{d:.1f}% of screen width; limit {lim}%"
                    + ("; over 20% regenerate" if d > 20 else ""))
        if t == "F" and jumps:
            rep.add("corner track", max(jumps.values()) <= jmax,
                    f"worst jump {max(jumps.values()):.2f}% of screen width; limit {jmax}%")
        width_gate(rep, np.median([st.quad_width(q) for q in quads.values()]) * scale,
                   (spec.get("hero") or {}).get("needs"))
    rep.note("by eye: five fingers on each hand, the holding hand keeps its grip"
             + (", the finger never passes through the phone" if t == "F" else ""))
    rep.save(os.path.join(out, "gates.json"))


# ---------------------------------------------------------------- the keyframe
def keyframe_gates(root, video, seg):
    vdir = f"{root}/pipeline/character/{video}"
    spec = spec_of(f"{vdir}/segments/{seg}")
    t = seg_type(seg, spec)
    gates = gates_of(spec)
    lo, hi = st.key_range(spec.get("key") or {})
    rep = Report(f"keyframe gates ({t})")
    stills = [("keyframe", f"{vdir}/keyframes/{seg}.png")]
    if t == "H":
        stills.append(("end still", f"{vdir}/keyframes/{seg}-end.png"))
    widths = {}
    for label, p in stills:
        img = cv2.imread(p)
        if img is None:
            rep.add(f"{label}: exists", False, os.path.relpath(p, root))
            continue
        q = st.screen_quad(st.green_mask(img, lo, hi), join=True)
        if q is None:
            rep.add(f"{label}: green screen", False, "no flat green screen found -- redo the keyframe")
            continue
        f = st.flat_on(q)
        rep.add(f"{label}: flat-on to the lens", st.flat_on_pass(f, gates), fmt_flat(f) + "; limits 3%, 3°, 3°")
        widths[label] = st.quad_width(q) * 1080.0 / img.shape[1]
    if t == "H" and len(widths) == 2:
        a, b = widths["keyframe"], widths["end still"]
        rep.add("the push grows the screen", b > 540 and b > a * 1.3,
                f"{a / 10.8:.0f}% of the frame width at the start, {b / 10.8:.0f}% at the end; "
                "the end is over half the frame")
    if widths:
        width_gate(rep, widths.get("end still", widths.get("keyframe", 0)), (spec.get("hero") or {}).get("needs"))
    rep.save(f"{vdir}/keyframes/qc/{seg}-gates.json")
    return 0 if rep.ok() else 1


# ---------------------------------------------------------------- the composite
def corner_sheet(cap, quads, times, path, fps):
    tiles = []
    for f in times:
        ok = False
        for g in range(f, max(-1, f - 8), -1):      # a seek near the end can fail: step back
            cap.set(cv2.CAP_PROP_POS_FRAMES, g)
            ok, fr = cap.read()
            if ok and g in quads:
                f = g
                break
        if not ok or f not in quads:
            continue
        q = quads[f]
        c = max(40, int(0.12 * st.quad_width(q)))
        row = []
        for n, (x, y) in enumerate(q):
            x0, y0 = int(x) - c // 2, int(y) - c // 2
            pad = cv2.copyMakeBorder(fr, c, c, c, c, cv2.BORDER_CONSTANT, value=(0, 0, 0))
            crop = pad[y0 + c:y0 + 2 * c, x0 + c:x0 + 2 * c]
            tile = cv2.resize(crop, (c * 4, c * 4), interpolation=cv2.INTER_NEAREST)
            tile = cv2.resize(tile, (320, 320), interpolation=cv2.INTER_NEAREST)
            label(tile, f"{f / fps:.2f}s {['TL', 'TR', 'BR', 'BL'][n]}")
            row.append(tile)
        tiles.append(np.hstack(row))
    if tiles:
        cv2.imwrite(path, np.vstack(tiles))
    return len(tiles)


def track_path(segdir, comp):
    """The track of one composite: composite/work/<stamp>/track.json, from its file name."""
    m = re.search(r"-composite-(\d{8}-\d{6})\.mp4$", os.path.basename(comp))
    if m:
        return f"{segdir}/composite/work/{m.group(1)}/track.json"
    return f"{segdir}/composite/work/track.json"


def tip_in_plate(q, tip):
    _, Mi = st.to_screen(q, st.FSW, st.FSH)
    p = np.array([[[tip[0] * st.FSW, tip[1] * st.FSH]]], np.float32)
    return cv2.perspectiveTransform(p, Mi)[0, 0]


def composite_gates(root, video, seg, rest):
    segdir = f"{root}/pipeline/character/{video}/segments/{seg}"
    spec = spec_of(segdir)
    t = seg_type(seg, spec)
    gates = gates_of(spec)
    i = rest.index("--composite")
    comp = rest[i + 1] if len(rest) > i + 1 else None
    if not comp:
        c = sorted(glob.glob(f"{segdir}/composite/*.mp4"), key=os.path.getmtime, reverse=True)
        comp = c[0] if c else None
    tp = track_path(segdir, comp) if comp else None
    if not comp or not tp or not os.path.exists(tp):
        print("no composite, or no track of it in composite/work/<stamp>/ -- run scripts/character/composite.sh")
        return 1
    tr = st.load_track(tp)
    quads, fps = tr["quads"], tr["fps"]
    W = tr["size"][0]
    fs = sorted(quads)
    out = f"{segdir}/composite/qc"
    os.makedirs(out, exist_ok=True)
    rep = Report(f"insertion gates of the composite ({t}): {os.path.basename(comp)}")
    lo, hi = st.key_range(spec.get("key") or {})

    # No green left near the screen: a pixel that is strict green in the plate and still
    # the plate's own colour in the composite. Green in the app's own pixels is not a leak.
    cap = cv2.VideoCapture(comp)
    plate = tr.get("plate")
    pc = cv2.VideoCapture(plate) if plate and os.path.exists(plate) else None
    worst_px, bad_frames, f = 0, 0, 0
    while True:
        ok, fr = cap.read()
        okp, pf = pc.read() if pc is not None else (False, None)
        if not ok:
            break
        if f in quads:
            q = quads[f]
            m = np.zeros(fr.shape[:2], np.uint8)
            cv2.fillConvexPoly(m, q.astype(np.int32), 1)
            r = max(3, int(0.03 * st.quad_width(q)))
            m = cv2.dilate(m, np.ones((r, r), np.uint8)) > 0
            left = st.strict_mask(fr, lo, hi) > 0
            if okp:
                same = np.abs(fr.astype(np.int16) - pf.astype(np.int16)).sum(2) < 40
                left &= (st.strict_mask(pf, lo, hi) > 0) & same
            n = int(left[m].sum())
            worst_px = max(worst_px, n)
            bad_frames += n > gates["strict_green_pixels_in_final"]
        f += 1
    if pc is not None:
        pc.release()
    rep.add("no green left", worst_px <= gates["strict_green_pixels_in_final"],
            f"at most {worst_px} pixel(s) in a frame still strict green from the plate, "
            f"{bad_frames} frame(s) with any" + ("" if pc is not None else "; the plate was not found, "
                                                 "so green in the app's own pixels counts too"))

    # The corner sheet, at four times.
    hl = st.holds(quads, fps) if t == "H" else []
    if t == "F" and tr.get("contact") is not None:
        times = [fs[0], tr["contact"], (tr["contact"] + tr["release"]) // 2, tr["release"]]
    elif t == "H" and len(hl) >= 2:
        times = [(hl[0][0] + hl[0][1]) // 2, (hl[0][1] + hl[-1][0]) // 2, hl[-1][0], (hl[-1][0] + hl[-1][1]) // 2]
    else:
        times = [fs[int(k)] for k in np.linspace(0, len(fs) - 1, 4)]
    n = corner_sheet(cap, quads, times, f"{out}/corner-sheet.png", fps)
    rep.note(f"corner sheet, {n} times x 4 corners: {out}/corner-sheet.png -- look for a gap, an "
             "overflow or a corner that is not round")

    # The finger: occlusion, the finger sheet, the UI sync.
    if t == "F":
        finger_gates(rep, tr, spec, gates, comp, cap, out, fps)
    elif any("tap" in str(b.get("label", "")) for b in spec.get("beats") or []):
        rep.note("tap alignment: confirm by eye that each tap lands within 2 frames of the thumb")

    # The hero element, read by OCR, and the width tier.
    hero_out = hero_ocr(rep, tr, spec, cap, quads, fps, t, hl, out)
    width_gate(rep, np.median([st.quad_width(q) for q in quads.values()]) * 1080.0 / W,
               (spec.get("hero") or {}).get("needs"))
    cap.release()
    rep.note("content truth: every string on the screen is real app output, and the data agrees with the script")
    rep.save(f"{out}/gates.json", {"file": comp, "hero": hero_out})
    return 0 if rep.ok() else 1


def finger_gates(rep, tr, spec, gates, comp, cap, out, fps):
    tips = {int(k): v for k, v in (tr.get("tips") or {}).items()}
    c, r = tr.get("contact"), tr.get("release")
    if c is None or r is None:
        rep.add("finger contact and release", False, "not found; set finger.contact_frame and release_frame")
        return
    rep.note(f"contact frame {c} ({c / fps:.2f}s), release frame {r} ({r / fps:.2f}s)")
    quads = tr["quads"]
    plate = tr.get("plate")
    pc = cv2.VideoCapture(plate) if plate and os.path.exists(plate) else None
    if pc is None:
        rep.add("finger occlusion", None, "the plate of the composite is not in track.json")
        return
    lo, hi = st.key_range(spec.get("key") or {})
    dark_v = int((spec.get("key") or {}).get("dark_max", 105))
    sheet, diffs, greens = [], [], []
    for f in sorted(set(range(c, r + 1, 2)) | {c, (c + r) // 2, r}):
        if f not in quads:
            continue
        pc.set(cv2.CAP_PROP_POS_FRAMES, f)
        cap.set(cv2.CAP_PROP_POS_FRAMES, f)
        ok1, pf = pc.read()
        ok2, cf = cap.read()
        if not (ok1 and ok2):
            continue
        q = quads[f]
        fm = st.finger_in_screen(pf, q, lo, hi, dark_v).astype(np.uint8)
        fm = cv2.erode(fm, np.ones((5, 5), np.uint8))
        _, Mi = st.to_screen(q, st.FSW, st.FSH)
        mp = cv2.warpPerspective(fm, Mi, (pf.shape[1], pf.shape[0]), flags=cv2.INTER_NEAREST) > 0
        if mp.sum() > 50:
            d = np.abs(cf.astype(np.int16) - pf.astype(np.int16))
            diffs.append(float((d[..., 0][mp].mean() + d[..., 2][mp].mean()) / 2))
            cf32 = cf.astype(np.int16)
            greens.append(float(np.maximum(0, cf32[..., 1] - np.maximum(cf32[..., 0], cf32[..., 2]))[mp].mean()))
        if f in (c, (c + r) // 2, r) and tips.get(f):
            x, y = tip_in_plate(q, tips[f])
            b = max(48, int(0.18 * st.quad_width(q)))
            tiles = []
            for img in (pf, cf):
                pad = cv2.copyMakeBorder(img, b, b, b, b, cv2.BORDER_CONSTANT)
                crop = pad[int(y):int(y) + 2 * b, int(x):int(x) + 2 * b]
                tiles.append(cv2.resize(crop, (360, 360), interpolation=cv2.INTER_NEAREST))
            row = np.hstack(tiles)
            label(row, f"{f / fps:.2f}s  plate | composite")
            sheet.append(row)
    pc.release()
    if sheet:
        cv2.imwrite(f"{out}/finger-sheet.png", np.vstack(sheet))
        rep.note(f"finger sheet at contact, mid-gesture and release: {out}/finger-sheet.png")
    if diffs:
        rep.add("no app pixel on the finger", max(diffs) <= 8,
                f"the finger differs from the plate by at most {max(diffs):.1f} of 255 (red and blue); limit 8")
        rep.add("no green on the finger", max(greens) <= 4,
                f"green above red and blue on the finger at most {max(greens):.1f} of 255; limit 4")
    else:
        rep.add("finger occlusion", False, "no finger found on the screen between contact and release")
    gesture = tr.get("gesture") or "scroll"
    if gesture == "tap":
        taps = [b for b in spec.get("beats") or [] if "tap" in str(b.get("label", ""))]
        if not taps:
            rep.add("UI sync, tap", None, "no tap beat in insert.json")
        else:
            off = round(taps[0]["plate_t"] * fps) - c
            rep.add("UI sync, tap", abs(off) <= gates["tap_alignment_frames_max"],
                    f"the app's tap is {off:+d} frame(s) from contact; limit {gates['tap_alignment_frames_max']}")
        return
    # Scroll or swipe: the content moves with the fingertip.
    axis = 1 if gesture == "scroll" else 0
    size = st.FSH if axis == 1 else st.FSW
    prev, content, err = None, 0.0, []
    for f in range(c, r + 1):
        if f not in quads or not tips.get(f) or not tips.get(c):
            continue
        cap.set(cv2.CAP_PROP_POS_FRAMES, f)
        ok, cf = cap.read()
        if not ok:
            continue
        M, _ = st.to_screen(quads[f], st.FSW, st.FSH)
        scr = cv2.cvtColor(cv2.warpPerspective(cf, M, (st.FSW, st.FSH)), cv2.COLOR_BGR2GRAY).astype(np.float32)
        x0, x1 = (0, int(0.4 * st.FSW)) if tips[f][0] > 0.5 else (int(0.6 * st.FSW), st.FSW)
        band = scr[:, x0:x1] if axis == 1 else scr[int(0.1 * st.FSH):int(0.4 * st.FSH)]
        if prev is not None:
            (dx, dy), _ = cv2.phaseCorrelate(prev, band)
            content += dy if axis == 1 else dx
            tip_d = (tips[f][axis] - tips[c][axis]) * size
            err.append(abs(content - tip_d) / size * 100)
        prev = band
    lim = gates["motion"]["scroll_follow_pct_screen_h_max"]
    if err:
        rep.add(f"UI sync, {gesture}", max(err) <= lim,
                f"the content is at most {max(err):.1f}% of the screen from the fingertip; limit {lim}%")
    else:
        rep.add(f"UI sync, {gesture}", None, "no frame to measure")


def hero_ocr(rep, tr, spec, cap, quads, fps, t, hl, out):
    import ocr
    hero = spec.get("hero") or {}
    text = hero.get("text")
    if not text or "<" in str(text):
        rep.note("OCR: no hero string in insert.json; n/a")
        return None
    fs = sorted(quads)
    if t == "F" and tr.get("release") is not None:
        f = min(fs[-1], tr["release"] + int(0.5 * fps))
    elif t == "H" and len(hl) >= 2:
        f = (hl[-1][0] + hl[-1][1]) // 2
    else:
        f = fs[len(fs) // 2]
    cap.set(cv2.CAP_PROP_POS_FRAMES, f)
    ok, fr = cap.read()
    if not ok:
        rep.add("OCR of the hero element", False, "the frame could not be read")
        return None
    q = quads[f]
    sw, sh = tr.get("source_size") or [400, 868]
    rect = tr.get("hero_rect_screen")
    if rect and any(rect):
        x, y, w, h = rect
        pts = np.array([[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]], np.float32)
        _, Mi = st.to_screen(q, sw, sh)
        p = cv2.perspectiveTransform(pts, Mi)[0]
    else:
        p = q
    x0, y0 = p.min(0)
    x1, y1 = p.max(0)
    mx, my = 0.2 * (x1 - x0), 0.2 * (y1 - y0)
    x0, y0 = int(max(0, x0 - mx)), int(max(0, y0 - my))
    x1, y1 = int(min(fr.shape[1], x1 + mx)), int(min(fr.shape[0], y1 + my))
    crop = cv2.resize(fr[y0:y1, x0:x1], None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    path = f"{out}/hero-ocr.png"
    cv2.imwrite(path, crop)
    got = ocr.read([path])
    hero_out = {"t": round(f / fps, 3), "rect": [x0, y0, x1 - x0, y1 - y0], "text": text}
    if got is None:
        rep.add("OCR of the hero element", None, "no OCR engine: brew install tesseract (or macOS with swift)")
        return hero_out
    ok, score = ocr.matches(text, got[path])
    rep.add("OCR of the hero element", ok, f"at {f / fps:.2f}s, '{text}' read with similarity {score}; "
            f"the engine read: {got[path][:120]!r}")
    return hero_out


def main(root, video, seg, rest):
    if "--keyframe" in rest:
        return keyframe_gates(root, video, seg)
    return composite_gates(root, video, seg, rest)
