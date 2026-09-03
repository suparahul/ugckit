#!/usr/bin/env python3
"""Stage 8 worker: composite a real screen recording onto a green-screened phone.

The plate is generated with the phone screen filled with flat chroma green. For every
frame we find the green quad, warp the screen recording into it, and composite through
the green mask itself -- so anything NOT green that sits over the screen (her thumb)
stays in front. That occlusion is the whole reason for green-screening rather than
pasting a warped rectangle on top.

Called by scripts/composite.sh; see pipeline/05-prompt/<name>/insert.json for the spec.
"""
import json, subprocess, sys
import numpy as np
import cv2

plate_path, spec_path, out_path, proj, dbg_dir = sys.argv[1:6]
spec = json.load(open(spec_path))

# ---------------------------------------------------------------- plate
cap = cv2.VideoCapture(plate_path)
FPS = cap.get(cv2.CAP_PROP_FPS)
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
NF = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
t0, t1 = spec["plate_window"]
print(f"plate: {W}x{H} {FPS:.3f}fps {NF} frames; insert window {t0}-{t1}s")

# ---------------------------------------------------------------- source clip
# Pre-scale: the screen quad is only a few hundred px on the plate, so decoding the
# 1770x3840 original at full size wastes gigabytes for no visible gain.
SRC_W = 480
src = f"{dbg_dir}/src-scaled.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-i",f"{proj}/{spec['source']}",
                "-vf",f"scale={SRC_W}:-2","-an","-c:v","libx264","-crf","14",src],check=True)
sc = cv2.VideoCapture(src)
sframes = []
while True:
    ok, f = sc.read()
    if not ok: break
    sframes.append(f)
sc.release()
SH, SW = sframes[0].shape[:2]
SFPS = len(sframes) / (spec["beats"][-1]["app_t"] - spec["beats"][0]["app_t"])
print(f"source: {SW}x{SH}, {len(sframes)} frames")

# patches: cover regions that should not appear (e.g. the notification banner)
sx = SW / 1770.0
for p in spec.get("patches", []):
    x, y, w, h = [int(round(v * sx)) for v in p["region"]]
    w, h = min(w, SW - x), min(h, SH - y)
    fi = int(round(p["from_t"] * SFPS))
    patch = sframes[min(fi, len(sframes) - 1)][y:y+h, x:x+w].copy()
    a, b = [int(round(v * SFPS)) for v in p["window"]]
    for i in range(max(0, a), min(len(sframes), b + 1)):
        sframes[i][y:y+h, x:x+w] = patch
    print(f"patched '{p['label']}' frames {a}-{b}")

# ---------------------------------------------------------------- time map
# Piecewise-linear plate_t -> app_t through the beats, so every tap/scroll in the
# recording lands on the frame where the thumb actually moves.
bp = [b["plate_t"] for b in spec["beats"]]
ba = [b["app_t"] for b in spec["beats"]]
def app_time(tp): return float(np.interp(tp, bp, ba))

# ---------------------------------------------------------------- green key
kc = spec["key"]
hue = cv2.cvtColor(np.uint8([[kc["color"][::-1]]]), cv2.COLOR_BGR2HSV)[0][0][0]
LO = np.array([max(0, hue - kc["hue_tol"]), kc["sat_min"], kc["val_min"]])
HI = np.array([min(179, hue + kc["hue_tol"]), 255, 255])
print(f"key hue={hue} range {LO.tolist()}..{HI.tolist()}")

def green_mask(bgr):
    return cv2.inRange(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV), LO, HI)

def _fit_outer(u, v, sign, iters=4):
    """Fit v = a*u + b to the OUTER envelope of the points.

    Ordinary least squares is pulled inward by occluded rows, whose extreme green pixel
    sits inside the true edge because a finger is covering it. So refit a few times,
    discarding points that fall on the inner side. The screen edge is the outer bound of
    the green, not its average.
    """
    keep = np.ones(len(u), bool)
    a = b = 0.0
    for _ in range(iters):
        a, b = np.polyfit(u[keep], v[keep], 1)
        k = (sign * (v - (a * u + b))) > -2.0
        if k.sum() < 12: break
        keep = k
    a, b = np.polyfit(u[keep], v[keep], 1)
    return a, b

def screen_quad(mask):
    """True screen corners, from the outer envelope of the green on all four sides.

    Two traps this avoids. approxPolyDP lands on the rounded-corner arcs rather than the
    real corners, baking in a phantom tilt. And fitting to convex-hull EDGES fails where a
    hand wraps a side: the hull bridges the occlusion using green that lies inside the true
    edge, so the fitted line creeps inward and the app stops short of the bezel.

    Instead take the extreme green pixel per row (for the left/right edges) and per column
    (top/bottom), drop the end 12% where the corner rounding pulls those extremes inward,
    and fit each edge to the outer envelope of what is left. Intersecting the four lines
    gives corners extrapolated correctly past the rounding, in TL,TR,BR,BL order by
    construction -- no corner-ordering heuristic to misfire on a tilted phone.
    """
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cs: return None
    c = max(cs, key=cv2.contourArea)
    if cv2.contourArea(c) < 0.01 * W * H: return None
    g = np.zeros((H, W), np.uint8); cv2.drawContours(g, [c], -1, 1, -1); g = g > 0

    rows = np.nonzero(g.any(1))[0]
    cols = np.nonzero(g.any(0))[0]
    if len(rows) < 40 or len(cols) < 40: return None
    tr, tc = int(len(rows) * 0.12), int(len(cols) * 0.12)   # skip the rounded corners
    rs, cl = rows[tr:len(rows) - tr], cols[tc:len(cols) - tc]
    if len(rs) < 20 or len(cl) < 20: return None

    sub = g[rs]
    xr = (W - 1 - np.argmax(sub[:, ::-1], axis=1)).astype(float)
    xl = np.argmax(sub, axis=1).astype(float)
    sub = g[:, cl]
    yt = np.argmax(sub, axis=0).astype(float)
    yb = (H - 1 - np.argmax(sub[::-1], axis=0)).astype(float)

    try:
        aR, bR = _fit_outer(rs.astype(float), xr, +1)   # x = aR*y + bR
        aL, bL = _fit_outer(rs.astype(float), xl, -1)
        aT, bT = _fit_outer(cl.astype(float), yt, -1)   # y = aT*x + bT
        aB, bB = _fit_outer(cl.astype(float), yb, +1)
    except Exception:
        return None

    def meet(av, bv, ah, bh):
        """x = av*y+bv  with  y = ah*x+bh"""
        den = 1.0 - av * ah
        if abs(den) < 1e-9: return None
        y = (ah * bv + bh) / den
        return np.array([av * y + bv, y], np.float32)

    q = [meet(aL, bL, aT, bT), meet(aR, bR, aT, bT),
         meet(aR, bR, aB, bB), meet(aL, bL, aB, bB)]
    if any(x is None for x in q): return None
    q = np.array(q, np.float32)
    if not (0.01 * W * H < cv2.contourArea(q) < 0.9 * W * H): return None
    return q

# ---------------------------------------------------------------- pass 1: track
# Scan the WHOLE video, not the nominal window. The model does not cut exactly where the
# prompt asked -- here it cut at 4.97s and 14.97s against 5.0/15.0 -- and trusting the
# nominal window breaks at BOTH ends: the frames before it still show a bare green screen,
# and the frames after it are already the next shot, so forcing a quad onto them pastes the
# app across the presenter. The green screen itself is the only honest signal for where
# the insert may run, so let detection define the window.
quads, areas = {}, {}
i = 0
while True:
    ok, fr = cap.read()
    if not ok: break
    gm = green_mask(fr)
    a = int(gm.sum() // 255)
    if a > 0.005 * W * H:
        q = screen_quad(gm)
        if q is not None:
            quads[i], areas[i] = q, a
    i += 1

if not quads:
    print("no green screen found anywhere in the plate", file=sys.stderr); sys.exit(1)
amax = max(areas.values())
good = sorted(f for f in quads if areas[f] > 0.25 * amax)   # drop part-frames at the cuts
f0, f1 = good[0], good[-1]
quads = {f: quads[f] for f in good}
print(f"green screen present {f0/FPS:.2f}s - {f1/FPS:.2f}s "
      f"({len(good)} frames; nominal window was {t0}-{t1}s)")

# ---------------------------------------------------------------- stabilise
# Two jobs. REJECT: a frame where fingers hide most of one edge makes that edge's line fit
# blow up; a median discards it, a box filter would smear it across its neighbours.
# SMOOTH: only lightly, and this is counter-intuitive. The generated phone is NOT rigid --
# measured over this shot, screen height varies 1.2% while the top/bottom width ratio swings
# 0.976-1.298. A real phone cannot keystone that hard without also changing height, so the
# bezel is genuinely morphing frame to frame. You cannot hold a rigid overlay still against
# a deforming bezel: smoothing the quad makes the app slide RELATIVE to the phone, which is
# the exact artefact it was meant to cure. So track tightly and let the app deform with the
# bezel. Heavy smoothing here is actively wrong; the median is doing the real work.
def medfilt(a, k):
    pad = k // 2; ap = np.pad(a, ((pad, pad), (0, 0)), mode="edge")
    return np.stack([np.median(ap[i:i + k], axis=0) for i in range(len(a))])

def savgol(a, win, order=2):
    win = min(win | 1, (len(a) // 2) * 2 - 1)
    if win < order + 2: return a
    pad = win // 2
    ap = np.pad(a, ((pad, pad), (0, 0)), mode="edge")
    x = np.arange(win) - pad
    h = np.linalg.pinv(np.vander(x, order + 1))[-1][::-1]
    return np.stack([np.convolve(ap[:, c], h, "valid") for c in range(a.shape[1])], 1)

idx = sorted(quads)
arr = np.stack([quads[j] for j in idx]).reshape(len(idx), 8)
raw = arr.copy()
arr = medfilt(arr, 9)
drop = int((np.abs(raw - arr).max(axis=1) > 4.0).sum())
if drop: print(f"median rejected {drop} unstable corner fits")
arr = savgol(arr, int(spec.get("smooth", 31)))
allf = np.arange(f0, f1 + 1)
res = np.stack([np.interp(allf, idx, arr[:, c]) for c in range(8)], 1)
quads = {int(f): res[n].reshape(4, 2).astype(np.float32) for n, f in enumerate(allf)}
print(f"stabilised: median 9 + savgol {int(spec.get('smooth', 31))}, "
      f"{len(allf)} frames composited")

# ---------------------------------------------------------------- grade
g = spec.get("grade", {})
def grade(img):
    if g.get("blur", 0) > 0:
        img = cv2.GaussianBlur(img, (0, 0), g["blur"])
    img = img.astype(np.float32)
    if g.get("saturation", 1) != 1:
        gr = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY)[..., None].astype(np.float32)
        img = gr + (img - gr) * g["saturation"]
    img = img * g.get("contrast", 1.0) + 255 * g.get("brightness", 0.0)
    if g.get("noise", 0):
        img += np.random.normal(0, g["noise"], img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)

# a soft diagonal sheen, so the screen reads as glass rather than a pasted rectangle
refl = np.zeros((SH, SW), np.float32)
yy, xx = np.mgrid[0:SH, 0:SW]
refl = np.clip(1.0 - np.abs((xx / SW + yy / SH) - 0.55) * 3.2, 0, 1) * g.get("reflection", 0.0)
refl = cv2.GaussianBlur(refl, (0, 0), SW * 0.06)[..., None]

# ---------------------------------------------------------------- pass 2: composite
enc = subprocess.Popen(
    ["ffmpeg","-y","-v","error","-f","rawvideo","-pix_fmt","bgr24","-s",f"{W}x{H}",
     "-r",f"{FPS}","-i","-","-i",plate_path,"-map","0:v","-map","1:a?",
     "-c:v","libx264","-crf","16","-pix_fmt","yuv420p","-c:a","copy","-shortest",out_path],
    stdin=subprocess.PIPE)

cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
dst_ref = np.array([[0,0],[SW-1,0],[SW-1,SH-1],[0,SH-1]], np.float32)

# The screen alpha is now GEOMETRIC -- a rounded rectangle in screen space, warped onto
# the tracked quad -- instead of "wherever the plate is green". That matters because the
# plate is NOT green everywhere the screen is: the model draws a Dynamic Island pill and
# shades the screen edges. Keying on green alone left those as plate, so a generated notch
# sat on top of the composite and read as a separate layer. The recording carries its own
# real status bar and island, so covering the whole screen puts real footage up there.
#
# Occlusion is then subtractive: anything inside the screen that is NOT green and NOT dark
# is a finger, and stays in front. Dark-and-not-green is notch or edge shading -- screen,
# not hand -- so the app covers it.
DARK_V = int(spec.get("key", {}).get("dark_max", 105))
rad = int(0.085 * SW)
rr = np.zeros((SH, SW), np.float32)
cv2.rectangle(rr, (rad, 0), (SW - rad, SH), 1.0, -1)
cv2.rectangle(rr, (0, rad), (SW, SH - rad), 1.0, -1)
for cxp, cyp in ((rad, rad), (SW - rad, rad), (rad, SH - rad), (SW - rad, SH - rad)):
    cv2.circle(rr, (cxp, cyp), rad, 1.0, -1)
rr = cv2.GaussianBlur(rr, (0, 0), max(1.0, SW * 0.004))

i, comped = 0, 0
while True:
    ok, fr = cap.read()
    if not ok: break
    if i in quads:
        ta = app_time(i / FPS)
        si = int(np.clip(round(ta * SFPS), 0, len(sframes) - 1))
        s = grade(sframes[si]).astype(np.float32)
        s = np.clip(s + 255 * refl, 0, 255).astype(np.uint8)
        Mh = cv2.getPerspectiveTransform(dst_ref, quads[i])
        # BORDER_REPLICATE: where green spills past the fitted quad we still cover it,
        # with edge-replicated pixels rather than a black border.
        warp = cv2.warpPerspective(s, Mh, (W, H), flags=cv2.INTER_LINEAR,
                                   borderMode=cv2.BORDER_REPLICATE)
        poly = cv2.warpPerspective(rr, Mh, (W, H), flags=cv2.INTER_LINEAR)

        hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
        green = cv2.inRange(hsv, LO, HI)
        # Union the two definitions of "screen". Geometry covers what the key cannot see
        # (the notch, shaded edges); the key covers what geometry gets slightly wrong
        # (a quad edge fitted a little inside the real one, when fingers hide that edge).
        # Either failure alone leaks: bare green on one side, a generated notch on the other.
        # Two keys, deliberately. STRICT (highly saturated) defines "this is screen": a
        # strongly green pixel can only be the display, so the app must cover it -- that is
        # what stops green leaking where the fitted quad lands slightly inside the real
        # edge. It is strict so that green SPILL on her fingers, which is weakly saturated,
        # is not mistaken for screen and painted over. No bezel clamp: clamping to the quad
        # re-broke exactly the leak the union exists to fix.
        strict = cv2.inRange(hsv, np.array([LO[0], 100, 60]), HI).astype(np.float32) / 255.0
        occl = ((green == 0) & (hsv[..., 2] >= DARK_V)).astype(np.float32)
        occl = cv2.GaussianBlur(occl, (0, 0), 1.6)
        m = np.maximum(poly, strict)
        m = (cv2.GaussianBlur(m, (0, 0), 1.2) * (1.0 - occl))[..., None]
        base = fr.astype(np.float32)
        edge = ((m[..., 0] > 0.05) & (m[..., 0] < 0.95))
        base[edge, 1] = np.minimum(base[edge, 1], (base[edge, 0] + base[edge, 2]) / 2)
        fr = np.clip(base * (1 - m) + warp.astype(np.float32) * m, 0, 255).astype(np.uint8)
        comped += 1
    enc.stdin.write(fr.tobytes())
    i += 1
enc.stdin.close(); enc.wait(); cap.release()
print(f"composited {comped} frames -> {out_path}")
