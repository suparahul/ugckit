"""The green phone screen of a character plate: the key, the corner fit, the tracking
modes and the geometry gates. Shared by screen_comp.py (P4) and qc.py (P3). Free, local.

The corner fit is the recreation compositor's (scripts/screen_comp.py), unchanged in what
it does for one region; the tracking modes, the join of several green regions and the
gates are the character pipeline's.
"""
import json, math
import numpy as np
import cv2

STRICT_SAT, STRICT_VAL = 100, 60


# ---------------------------------------------------------------- the key
def key_range(kc):
    hue = cv2.cvtColor(np.uint8([[kc.get("color", [0, 177, 64])[::-1]]]), cv2.COLOR_BGR2HSV)[0][0][0]
    lo = np.array([max(0, int(hue) - kc.get("hue_tol", 26)), kc.get("sat_min", 55), kc.get("val_min", 35)])
    hi = np.array([min(179, int(hue) + kc.get("hue_tol", 26)), 255, 255])
    return lo, hi


def green_mask(bgr, lo, hi):
    return cv2.inRange(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV), lo, hi)


def strict_mask(bgr, lo, hi):
    """Only a strongly green pixel: the display, never the spill on a finger."""
    return cv2.inRange(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV),
                       np.array([lo[0], STRICT_SAT, STRICT_VAL]), hi)


# ---------------------------------------------------------------- the corner fit
def _fit_outer(u, v, sign, iters=4):
    """Fit v = a*u + b to the OUTER envelope of the points: a finger over an edge puts
    the extreme green pixel of that row inside the true edge, so those points are
    dropped and the line refitted."""
    keep = np.ones(len(u), bool)
    a = b = 0.0
    for _ in range(iters):
        a, b = np.polyfit(u[keep], v[keep], 1)
        k = (sign * (v - (a * u + b))) > -2.0
        if k.sum() < 12:
            break
        keep = k
    a, b = np.polyfit(u[keep], v[keep], 1)
    return a, b


def screen_region(mask, join=False, min_frac=0.01):
    """The screen's green as a boolean picture. One region (the largest), or with `join`
    every region near it: a finger across the screen splits the green in two, and
    fitting the largest half alone puts an edge in the middle of the screen."""
    H, W = mask.shape
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs:
        return None
    cs = sorted(cs, key=cv2.contourArea, reverse=True)
    big = cs[0]
    if cv2.contourArea(big) < min_frac * W * H:
        return None
    keep = [big]
    if join:
        x, y, w, h = cv2.boundingRect(big)
        gx, gy = int(w * 0.6), int(h * 0.6)
        box = (x - gx, y - gy, x + w + gx, y + h + gy)
        for c in cs[1:]:
            if cv2.contourArea(c) < 0.05 * cv2.contourArea(big):
                break
            cx, cy, cw, ch = cv2.boundingRect(c)
            if cx >= box[0] and cy >= box[1] and cx + cw <= box[2] and cy + ch <= box[3]:
                keep.append(c)
    g = np.zeros((H, W), np.uint8)
    cv2.drawContours(g, keep, -1, 1, -1)
    return g > 0, len(keep)


def screen_quad(mask, join=False, max_frac=0.9):
    """The true screen corners, TL, TR, BR, BL, from the outer envelope of the green on
    all four sides, with the rounded corners skipped (the recreation fit)."""
    H, W = mask.shape
    r = screen_region(mask, join)
    if r is None:
        return None
    g, _ = r
    rows = np.nonzero(g.any(1))[0]
    cols = np.nonzero(g.any(0))[0]
    if len(rows) < 40 or len(cols) < 40:
        return None
    tr, tc = int(len(rows) * 0.12), int(len(cols) * 0.12)
    rs, cl = rows[tr:len(rows) - tr], cols[tc:len(cols) - tc]
    if len(rs) < 20 or len(cl) < 20:
        return None
    sub = g[rs]
    ok_r = sub.any(1)
    xr = (W - 1 - np.argmax(sub[:, ::-1], axis=1)).astype(float)
    xl = np.argmax(sub, axis=1).astype(float)
    sub = g[:, cl]
    ok_c = sub.any(0)
    yt = np.argmax(sub, axis=0).astype(float)
    yb = (H - 1 - np.argmax(sub[::-1], axis=0)).astype(float)
    rs_f, cl_f = rs[ok_r].astype(float), cl[ok_c].astype(float)
    if len(rs_f) < 20 or len(cl_f) < 20:
        return None
    try:
        aR, bR = _fit_outer(rs_f, xr[ok_r], +1)
        aL, bL = _fit_outer(rs_f, xl[ok_r], -1)
        aT, bT = _fit_outer(cl_f, yt[ok_c], -1)
        aB, bB = _fit_outer(cl_f, yb[ok_c], +1)
    except Exception:
        return None

    def meet(av, bv, ah, bh):
        den = 1.0 - av * ah
        if abs(den) < 1e-9:
            return None
        y = (ah * bv + bh) / den
        return np.array([av * y + bv, y], np.float32)

    q = [meet(aL, bL, aT, bT), meet(aR, bR, aT, bT), meet(aR, bR, aB, bB), meet(aL, bL, aB, bB)]
    if any(x is None for x in q):
        return None
    q = np.array(q, np.float32)
    if not (0.01 * W * H < cv2.contourArea(q) < max_frac * W * H):
        return None
    return q


# ---------------------------------------------------------------- geometry
def quad_width(q):
    return float((np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2)


def quad_height(q):
    return float((np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2)


def flat_on(q):
    """How far the screen is from square to the lens, from the fitted quad (§ 11.10):
    the difference of opposite edges in %, the worst corner's distance from 90 degrees,
    the long edges' angle from vertical, and one 'degrees from square' figure for the
    push limit of H (the largest of the two angles)."""
    top, bot = np.linalg.norm(q[1] - q[0]), np.linalg.norm(q[2] - q[3])
    lef, rig = np.linalg.norm(q[3] - q[0]), np.linalg.norm(q[2] - q[1])
    edge = max(abs(top - bot) / max(top, bot), abs(lef - rig) / max(lef, rig)) * 100
    corners = []
    for i in range(4):
        a, b, c = q[i - 1], q[i], q[(i + 1) % 4]
        v1, v2 = a - b, c - b
        cos = float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9))
        corners.append(abs(math.degrees(math.acos(max(-1, min(1, cos)))) - 90))
    vert = []
    for a, b in ((q[0], q[3]), (q[1], q[2])):
        d = b - a
        vert.append(abs(math.degrees(math.atan2(d[0], d[1]))))
    return {"edge_diff_pct": round(float(edge), 2), "corner_deg": round(float(max(corners)), 2),
            "vertical_deg": round(float(max(vert)), 2),
            "deg_from_square": round(float(max(max(corners), max(vert))), 2)}


def flat_on_pass(f, gates):
    g = (gates or {}).get("flat_on") or {}
    return (f["edge_diff_pct"] <= g.get("opposite_edge_diff_pct_max", 3) and
            f["corner_deg"] <= g.get("corner_deg_from_90_max", 3) and
            f["vertical_deg"] <= g.get("long_edge_deg_from_vertical_max", 3))


# ---------------------------------------------------------------- filters
def medfilt(a, k):
    if k <= 1:
        return a.copy()
    pad = k // 2
    ap = np.pad(a, ((pad, pad), (0, 0)), mode="edge")
    return np.stack([np.median(ap[i:i + k], axis=0) for i in range(len(a))])


def savgol(a, win, order=2):
    win = min(win | 1, (len(a) // 2) * 2 - 1)
    if win < order + 2:
        return a
    pad = win // 2
    ap = np.pad(a, ((pad, pad), (0, 0)), mode="edge")
    x = np.arange(win) - pad
    h = np.linalg.pinv(np.vander(x, order + 1))[-1][::-1]
    return np.stack([np.convolve(ap[:, c], h, "valid") for c in range(a.shape[1])], 1)


# ---------------------------------------------------------------- tracking
def detect(path, spec, join=None, log=print):
    """Pass 1: the raw quad and green area of every frame. Returns (raw quads by frame,
    areas by frame, fps, W, H, frame count)."""
    lo, hi = key_range(spec.get("key") or {})
    mode = (spec.get("track") or {}).get("mode", "per-frame")
    tm = (spec.get("track") or {}).get("motion") or {}
    if join is None:
        join = bool(tm.get("join_green_regions", mode == "motion" or spec.get("mode") == "finger"))
    max_frac = 0.98 if mode == "motion" else 0.9
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    quads, areas, i = {}, {}, 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        gm = green_mask(fr, lo, hi)
        a = int(gm.sum() // 255)
        if a > 0.005 * W * H:
            q = screen_quad(gm, join=join, max_frac=max_frac)
            if q is not None:
                quads[i], areas[i] = q, a
        i += 1
    cap.release()
    return quads, areas, fps, W, H, i


def keep_frames(quads, areas, motion):
    """Drop the part-frames at the cuts. Still phone: under a quarter of the largest
    green area. Push: the start of a push is often under a quarter of its end, so the
    area is judged against the neighbouring frames instead."""
    if not quads:
        return []
    fs = sorted(quads)
    if not motion:
        amax = max(areas.values())
        return [f for f in fs if areas[f] > 0.25 * amax]
    out = []
    for f in fs:
        near = [areas[g] for g in fs if abs(g - f) <= 5]
        if areas[f] > 0.5 * max(near):
            out.append(f)
    return out


def drift_pct(quads):
    if len(quads) < 2:
        return 0.0
    c = np.array([q.mean(0) for q in quads.values()])
    w = np.mean([quad_width(q) for q in quads.values()])
    return float(max(np.ptp(c[:, 0]), np.ptp(c[:, 1])) / w * 100)


def morph(quads):
    """How much the generated bezel changes shape: the spread of the top/bottom and
    left/right edge ratios. A real phone does not keystone; a generated one does."""
    tb = [np.linalg.norm(q[1] - q[0]) / max(1e-6, np.linalg.norm(q[2] - q[3])) for q in quads.values()]
    lr = [np.linalg.norm(q[3] - q[0]) / max(1e-6, np.linalg.norm(q[2] - q[1])) for q in quads.values()]
    return float(max(np.ptp(tb), np.ptp(lr)))


def stabilise(quads, areas, spec, log=print):
    """Pass 2: the quad of every frame of the insert window, by the track mode.

    per-frame  the recreation tracker: a 9-frame median rejects a bad fit, a light
               smoother (`smooth`, 7 to 31) follows a bezel that really morphs.
    locked     one median quad for the whole window, when the phone drifts under
               `locked_if_drift_pct_under` % of its width and the bezel hardly morphs;
               otherwise it falls back to per-frame and says why.
    motion     a push or a finger shot: a 3-frame median, a 5-frame smoother or none,
               the area judged against the neighbours, and a frame whose fit is lost is
               predicted from the last frames instead of skipped.
    Returns ({frame: quad}, info)."""
    tr = spec.get("track") or {}
    mode = tr.get("mode", "per-frame")
    if mode not in ("per-frame", "locked", "motion"):
        mode = "per-frame"
    motion = mode == "motion"
    good = keep_frames(quads, areas, motion)
    if not good:
        return {}, {"mode": mode, "frames": 0}
    q = {f: quads[f] for f in good}
    f0, f1 = good[0], good[-1]
    info = {"mode": mode, "first": f0, "last": f1, "detected": len(good)}
    allf = np.arange(f0, f1 + 1)

    if mode == "locked":
        d, m = drift_pct(q), morph(q)
        lim = tr.get("locked_if_drift_pct_under", 2)
        info.update(drift_pct=round(d, 2), morph=round(m, 3))
        if d < lim and m < 0.03:
            med = np.median(np.stack(list(q.values())), axis=0).astype(np.float32)
            log(f"track locked: drift {d:.2f}% < {lim}%, morph {m:.3f}: one quad for {len(allf)} frames")
            return {int(f): med for f in allf}, info
        why = f"drift {d:.2f}% (limit {lim}%)" if d >= lim else f"the bezel morphs ({m:.3f})"
        log(f"track locked refused: {why}; per-frame instead")
        mode = info["mode"] = "per-frame"

    idx = sorted(q)
    arr = np.stack([q[j] for j in idx]).reshape(len(idx), 8)
    raw = arr.copy()
    if motion:
        mo = tr.get("motion") or {}
        arr = medfilt(arr, int(mo.get("median_frames", 3)))
        sm = int(mo.get("smooth_frames", 5))
        if sm > 2:
            arr = savgol(arr, sm)
        # A lost fit inside the window (a hand over an edge): predict from the two frames
        # before it, linearly, rather than interpolate across a fast move.
        res = []
        known = {f: arr[n] for n, f in enumerate(idx)}
        last = []
        for f in allf:
            if f in known:
                v = known[f]
            elif len(last) >= 2:
                v = 2 * last[-1] - last[-2]
            else:
                v = last[-1]
            res.append(v)
            last = (last + [v])[-2:]
        res = np.stack(res)
        info["predicted"] = int(len(allf) - len(idx))
        log(f"track motion: median {mo.get('median_frames', 3)}, smoother {sm if sm > 2 else 'none'}, "
            f"{info['predicted']} frame(s) predicted")
    else:
        arr = medfilt(arr, 9)
        drop = int((np.abs(raw - arr).max(axis=1) > 4.0).sum())
        if drop:
            log(f"median rejected {drop} unstable corner fits")
        sm = int(spec.get("smooth", 31))
        arr = savgol(arr, sm)
        res = np.stack([np.interp(allf, idx, arr[:, c]) for c in range(8)], 1)
        log(f"track per-frame: median 9 + savgol {sm}")
    return {int(f): res[n].reshape(4, 2).astype(np.float32) for n, f in enumerate(allf)}, info


def holds(quads, fps, still_pct=0.6, min_s=0.3):
    """The runs of frames where the screen hardly changes size (the start and end holds of
    a push). Returns [(first, last)] in frame numbers."""
    fs = sorted(quads)
    if len(fs) < 3:
        return [(fs[0], fs[-1])] if fs else []
    w = np.array([quad_width(quads[f]) for f in fs])
    still = np.r_[False, np.abs(np.diff(w)) / w[1:] * 100 < still_pct]
    still[0] = still[1]
    runs, start = [], None
    for n, s in enumerate(still):
        if s and start is None:
            start = n
        if (not s or n == len(still) - 1) and start is not None:
            end = n if s else n - 1
            if (end - start + 1) / fps >= min_s:
                runs.append((fs[start], fs[end]))
            start = None
    return runs


def corner_jumps(quads):
    """Per frame, how far each corner lands from where its two previous frames predict,
    as % of the screen width. The worst corner per frame."""
    fs = sorted(quads)
    out = {}
    for n in range(2, len(fs)):
        a, b, c = quads[fs[n - 2]], quads[fs[n - 1]], quads[fs[n]]
        pred = 2 * b - a
        out[fs[n]] = float(np.linalg.norm(c - pred, axis=1).max() / quad_width(c) * 100)
    return out


# ---------------------------------------------------------------- the screen's own frame
def to_screen(q, sw, sh):
    """The homography from the plate to an upright sw x sh screen, and back."""
    dst = np.array([[0, 0], [sw - 1, 0], [sw - 1, sh - 1], [0, sh - 1]], np.float32)
    return cv2.getPerspectiveTransform(q, dst), cv2.getPerspectiveTransform(dst, q)


def save_track(path, quads, fps, W, H, info, extra=None):
    d = {"fps": fps, "size": [W, H], "info": info,
         "quads": {str(k): np.round(v, 2).tolist() for k, v in sorted(quads.items())}}
    d.update(extra or {})
    json.dump(d, open(path, "w"))


def load_track(path):
    d = json.load(open(path))
    d["quads"] = {int(k): np.array(v, np.float32) for k, v in d["quads"].items()}
    return d


# ---------------------------------------------------------------- the finger (F)
FSW, FSH = 400, 868          # the upright screen frame the finger is measured in


def exception_zone(sw, sh, notch_h=0.09, notch_w=0.45, band=0.03):
    """Where a dark, not-green pixel still counts as screen: the notch zone at the top
    and a thin band along the edges (§ 11.12). Everywhere else, not green is the finger."""
    z = np.zeros((sh, sw), bool)
    b = max(1, int(round(band * sw)))
    z[:b, :] = z[-b:, :] = z[:, :b] = z[:, -b:] = True
    nw, nh = int(notch_w * sw), int(notch_h * sh)
    z[:nh, (sw - nw) // 2:(sw + nw) // 2] = True
    return z


def finger_in_screen(fr, q, lo, hi, dark_v, sw=FSW, sh=FSH):
    """The finger matte in the upright screen frame: not green, except a dark pixel in
    the notch zone or the edge band."""
    M, _ = to_screen(q, sw, sh)
    scr = cv2.warpPerspective(fr, M, (sw, sh), flags=cv2.INTER_LINEAR)
    hsv = cv2.cvtColor(scr, cv2.COLOR_BGR2HSV)
    notgreen = cv2.inRange(hsv, lo, hi) == 0
    dark = hsv[..., 2] < dark_v
    f = notgreen & ~(exception_zone(sw, sh) & dark)
    f = cv2.morphologyEx(f.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    return f


def fingertip(matte, entry=None):
    """The point of the finger matte furthest into the screen, from the edge the finger
    enters by. Returns ((x, y) as fractions of the screen, area fraction, entry edge), or
    (None, area, entry) when no finger is on the screen."""
    sh, sw = matte.shape
    area = float(matte.mean())
    if area < 0.002:
        return None, area, entry
    n, lab, stats, _ = cv2.connectedComponentsWithStats(matte.astype(np.uint8))
    if n < 2:
        return None, area, entry
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = lab == k
    b = max(2, int(0.04 * sw))
    touch = {"bottom": m[-b:].sum(), "right": m[:, -b:].sum(), "left": m[:, :b].sum(), "top": m[:b].sum()}
    if max(touch.values()) > 0:
        entry = max(touch, key=touch.get)
    entry = entry or "bottom"
    ys, xs = np.nonzero(m)
    depth = {"bottom": sh - 1 - ys, "top": ys, "right": sw - 1 - xs, "left": xs}[entry]
    i = int(np.argmax(depth))
    return (xs[i] / sw, ys[i] / sh), area, entry


def track_finger(path, quads, spec, log=print):
    """The fingertip in every frame of the insert window: {frame: [x, y] or None}, in
    fractions of the screen."""
    lo, hi = key_range(spec.get("key") or {})
    dark_v = int((spec.get("key") or {}).get("dark_max", 105))
    cap = cv2.VideoCapture(path)
    tips, entry, i = {}, None, 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if i in quads:
            t, _, entry = fingertip(finger_in_screen(fr, quads[i], lo, hi, dark_v), entry)
            tips[i] = None if t is None else [round(float(t[0]), 4), round(float(t[1]), 4)]
        i += 1
    cap.release()
    seen = sum(1 for v in tips.values() if v)
    log(f"fingertip: on the screen in {seen} of {len(tips)} frames")
    return tips


def contact_release(tips, fps, gesture="scroll", still=0.004, move=0.006):
    """Contact and release from the fingertip track (§ 11.12). A tap: contact is the first
    frame where the fingertip stops on the screen, release the frame it moves again. A
    scroll or a swipe: the longest run of frames moving along the screen, start and end.
    Speeds are fractions of the screen per frame. Returns (contact, release) or (None, None)."""
    fs = [f for f in sorted(tips) if tips[f]]
    if len(fs) < 4:
        return None, None
    p = np.array([tips[f] for f in fs])
    v = np.r_[[0.0], np.linalg.norm(np.diff(p, axis=0), axis=1)]
    if gesture == "tap":
        for n in range(1, len(fs) - 1):
            if v[n] < still and v[n + 1] < still:
                c = fs[n]
                for m in range(n + 1, len(fs)):
                    if v[m] > move:
                        return c, fs[m]
                return c, fs[-1]
        return None, None
    axis = 1 if gesture == "scroll" else 0
    d = np.r_[[0.0], np.diff(p[:, axis])]
    sign = np.sign(np.sum(d[np.abs(d) > move])) or -1
    runs, start = [], None
    for n in range(len(fs)):
        on = sign * d[n] > move
        if on and start is None:
            start = n
        if (not on or n == len(fs) - 1) and start is not None:
            end = n - 1 if not on else n
            runs.append((start, end))
            start = None
    if not runs:
        return None, None
    a, b = max(runs, key=lambda r: abs(p[r[1], axis] - p[max(0, r[0] - 1), axis]))
    return fs[max(0, a - 1)], fs[b]
