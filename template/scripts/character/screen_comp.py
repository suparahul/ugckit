#!/usr/bin/env python3
"""P4 worker: composite the real app onto the green phone of a character plate. Free, local.

    screen_comp.py <plate> <insert.json> <out.mp4> <workspace> <work dir>
    screen_comp.py --propose-grade <plate> <insert.json> <workspace> <work dir>

Started from scripts/screen_comp.py (the recreation compositor, which stays as it is);
the character pipeline's insertion upgrades are here. Run it through
scripts/character/composite.sh. For every frame it finds the green quad, warps the app
into it, and composites through the green key, so what is not green over the screen (a
thumb, a finger) stays in front.

What insert.json drives (docs/character/insert.example.json; every key but `source` is
optional, so an old recreation insert.json still runs):
  composite_resolution  "1080x1920" (default): the plate is upscaled once, lanczos, and
                        the app is warped into the upscaled quad at full sharpness, then
                        softened by `grade`. "plate" keeps the plate's own size.
  source_kind           recording (time-warped through `beats`) | still (one screenshot,
                        rung 1 and the S mode) | finger-driven (a long screenshot moved by
                        the fingertip for a scroll; two stills for a swipe)
  track.mode            per-frame | locked | motion (screen_track.py)
  occlusion             the finger matte: with "notch zone and edge band only", a dark
                        pixel is screen only in those zones, and the despill covers the
                        whole finger
  finger                contact and release frames (null: found by the fingertip tracker)
  motion_blur.on        blur the app along its own motion (a 180-degree shutter: the
                        app averaged over the quads between the neighbouring frames)
  grade                 blur, brightness, contrast, saturation, reflection, noise,
                        black_lift; --propose-grade measures the plate beside the bezel
                        and proposes one
Writes <work dir>/track.json (the quads, the fingertip, contact and release) for qc.py.
"""
import json, os, subprocess, sys
import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import screen_track as st


def probe_size(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True)
    w, h = r.stdout.strip().split(",")[:2]
    return int(w), int(h)


def target_size(spec):
    r = str(spec.get("composite_resolution", "1080x1920"))
    if r == "plate":
        return None
    w, h = r.lower().split("x")
    return int(w), int(h)


def upscale_plate(plate, spec, work):
    """Upscale once, lanczos, before the composite (§ 13, step 6)."""
    ts = target_size(spec)
    if ts is None or probe_size(plate) == ts:
        return plate
    out = os.path.join(work, "plate-%dx%d.mp4" % ts)
    w, h = ts
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", plate, "-vf",
                    f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}",
                    "-c:v", "libx264", "-crf", "12", "-preset", "medium", "-pix_fmt", "yuv420p",
                    "-c:a", "copy", out], check=True)
    print(f"plate upscaled once, lanczos, to {w}x{h}")
    return out


def rounded_rect(sw, sh):
    rad = int(0.085 * sw)
    rr = np.zeros((sh, sw), np.float32)
    cv2.rectangle(rr, (rad, 0), (sw - rad, sh), 1.0, -1)
    cv2.rectangle(rr, (0, rad), (sw, sh - rad), 1.0, -1)
    for cx, cy in ((rad, rad), (sw - rad, rad), (rad, sh - rad), (sw - rad, sh - rad)):
        cv2.circle(rr, (cx, cy), rad, 1.0, -1)
    return cv2.GaussianBlur(rr, (0, 0), max(1.0, sw * 0.004))


# ---------------------------------------------------------------- sources
class Source:
    """The app's pixels for a plate time: a recording through the beats, a still, or a
    long screenshot (or two stills) moved by the fingertip."""

    def __init__(self, spec, proj, work, quad_w, quad_aspect, green_start, fps):
        self.spec, self.kind = spec, spec.get("source_kind", "recording")
        self.fps, self.green_start = fps, green_start
        src = spec.get("source")
        if not src:
            sys.exit("insert.json has no source -- the screens skill fills it from SCREENS.md")
        files = src if isinstance(src, list) else [src]
        files = [f if os.path.isabs(f) else os.path.join(proj, f) for f in files]
        for f in files:
            if not os.path.exists(f):
                sys.exit(f"the source is missing: {f}")
        # The source is scaled to twice the widest quad: a small phone needs little, an
        # over-the-shoulder phone at half the frame needs much more than 480 px.
        self.SW = int(spec.get("source_width_px") or max(480, min(1440, round(quad_w) * 2)))
        self.SW -= self.SW % 2
        if self.kind == "recording":
            self._recording(files[0], work)
        elif self.kind == "still":
            img = cv2.imread(files[0])
            self.native_w = img.shape[1]
            self.SW = min(self.SW, self.native_w - self.native_w % 2)
            self.frames = [cv2.resize(img, (self.SW, round(img.shape[0] * self.SW / img.shape[1] / 2) * 2),
                                      interpolation=cv2.INTER_AREA)]
            self.SH = self.frames[0].shape[0]
            print(f"source: still {os.path.basename(files[0])} -> {self.SW}x{self.SH}")
        elif self.kind == "finger-driven":
            self.SH = int(round(self.SW * quad_aspect / 2) * 2)
            imgs = [cv2.imread(f) for f in files]
            self.native_w = imgs[0].shape[1]
            self.imgs = [cv2.resize(i, (self.SW, int(round(i.shape[0] * self.SW / i.shape[1]))),
                                    interpolation=cv2.INTER_AREA) for i in imgs]
            self.gesture = (spec.get("finger") or {}).get("gesture") or ("swipe" if len(files) == 2 else "scroll")
            print(f"source: finger-driven {self.gesture}, {len(files)} picture(s), window {self.SW}x{self.SH}")
        else:
            sys.exit(f"unknown source_kind {self.kind!r}: recording | still | finger-driven")
        self._patches()
        beats = spec.get("beats") or []
        self.bp = [b["plate_t"] for b in beats]
        self.ba = [b["app_t"] for b in beats]

    def _recording(self, path, work):
        cap = cv2.VideoCapture(path)
        self.native_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        cap.release()
        self.SW = min(self.SW, self.native_w - self.native_w % 2)
        tmp = os.path.join(work, "src-scaled.mp4")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vf", f"scale={self.SW}:-2",
                        "-an", "-c:v", "libx264", "-crf", "14", tmp], check=True)
        sc = cv2.VideoCapture(tmp)
        self.frames = []
        while True:
            ok, f = sc.read()
            if not ok:
                break
            self.frames.append(f)
        sc.release()
        r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                            "csv=p=0", tmp], capture_output=True, text=True)
        self.SH = self.frames[0].shape[0]
        self.SFPS = len(self.frames) / float(r.stdout.strip() or 1)
        print(f"source: {self.native_w} px wide -> {self.SW}x{self.SH}, {len(self.frames)} frames, "
              f"{self.SFPS:.2f} fps")

    def _patches(self):
        """Cover regions of the recording that must not appear (a notification banner).
        The coordinates are in the source's own pixels, read from the file."""
        pats = self.spec.get("patches") or []
        if not pats or self.kind != "recording":
            return
        sx = self.SW / float(self.native_w)
        for p in pats:
            x, y, w, h = [int(round(v * sx)) for v in p["region"]]
            w, h = min(w, self.SW - x), min(h, self.SH - y)
            fi = int(round(p["from_t"] * self.SFPS))
            patch = self.frames[min(fi, len(self.frames) - 1)][y:y + h, x:x + w].copy()
            a, b = [int(round(v * self.SFPS)) for v in p["window"]]
            for i in range(max(0, a), min(len(self.frames), b + 1)):
                self.frames[i][y:y + h, x:x + w] = patch
            print(f"patched '{p.get('label', '')}' frames {a}-{b}")

    def app_time(self, tp):
        if len(self.bp) >= 2:
            return float(np.interp(tp, self.bp, self.ba))
        return max(0.0, tp - self.green_start)

    def finger_offsets(self, tips, contact, release, frames):
        """The content offset of a finger-driven source, per frame, in source pixels: it
        moves with the fingertip from contact to release, then keeps the momentum and
        slows down (`finger.momentum_tau_s`, 0.5 s by default)."""
        tau = float((self.spec.get("finger") or {}).get("momentum_tau_s", 0.5))
        axis = 1 if self.gesture == "scroll" else 0
        size = self.SH if axis == 1 else self.SW
        off, out, last, vel = 0.0, {}, None, 0.0
        for f in frames:
            if contact <= f <= release and tips.get(f) and tips.get(contact):
                off = -(tips[f][axis] - tips[contact][axis]) * size
                if last is not None:
                    vel = off - last
                last = off
            elif f > release:
                vel *= np.exp(-1.0 / (tau * self.fps))
                off += vel
            out[f] = off
        return out

    def frame(self, tp, off=0.0):
        if self.kind == "recording":
            si = int(np.clip(round(self.app_time(tp) * self.SFPS), 0, len(self.frames) - 1))
            return self.frames[si]
        if self.kind == "still":
            return self.frames[0]
        if self.gesture == "scroll":
            img = self.imgs[0]
            y = int(np.clip(round(off), 0, max(0, img.shape[0] - self.SH)))
            return img[y:y + self.SH]
        a, b = self.imgs[0][:self.SH], self.imgs[1][:self.SH]
        x = int(np.clip(round(off), 0, self.SW))
        return np.hstack([a, b])[:, x:x + self.SW]


# ---------------------------------------------------------------- grade
def make_grade(g, sw, sh):
    yy, xx = np.mgrid[0:sh, 0:sw]
    refl = np.clip(1.0 - np.abs((xx / sw + yy / sh) - 0.55) * 3.2, 0, 1) * g.get("reflection", 0.0)
    refl = cv2.GaussianBlur(refl.astype(np.float32), (0, 0), sw * 0.06)[..., None]

    def grade(img):
        if g.get("blur", 0) > 0:
            img = cv2.GaussianBlur(img, (0, 0), g["blur"])
        img = img.astype(np.float32)
        if g.get("saturation", 1) != 1:
            gr = cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_BGR2GRAY)[..., None].astype(np.float32)
            img = gr + (img - gr) * g["saturation"]
        img = img * g.get("contrast", 1.0) + 255 * g.get("brightness", 0.0)
        if g.get("black_lift", 0):
            img = img * (1 - g["black_lift"]) + 255 * g["black_lift"]
        if g.get("noise", 0):
            img += np.random.normal(0, g["noise"], img.shape)
        img = img + 255 * refl[:img.shape[0], :img.shape[1]]
        return np.clip(img, 0, 255).astype(np.uint8)
    return grade


def shutter_quads(quads, i, shutter_deg):
    """The quads a screen passes through while the shutter is open (180 degrees: half the
    movement to the neighbouring frames), for a blur along the screen's own motion: a
    move, a turn or a push, which grows the screen from its centre."""
    q = quads[i]
    a, b = quads.get(i - 1, q), quads.get(i + 1, q)
    d = (b - a) / 2.0
    f = shutter_deg / 360.0
    move = float(np.abs(d).max()) * f
    k = int(min(16, max(1, np.ceil(move))))
    if k == 1:
        return [q]
    return [(q + d * u).astype(np.float32) for u in np.linspace(-f / 2, f / 2, k)]


def track(plate, spec, log=print):
    raw, areas, fps, W, H, nf = st.detect(plate, spec)
    if not raw:
        return {}, {}, fps, W, H, nf
    quads, info = st.stabilise(raw, areas, spec, log=log)
    return quads, info, fps, W, H, nf


# ---------------------------------------------------------------- propose a grade
def propose_grade(plate, spec, proj, work):
    """Measure the plate in a ring just outside the screen (the bezel, the hand) and the
    app warped into the quad, and propose `grade`: the blur that brings the app's
    sharpness to the plate's, the plate's noise, a black lift when the plate's blacks
    sit higher than the app's. The agent confirms it by eye on the corner sheet."""
    os.makedirs(work, exist_ok=True)
    plate = upscale_plate(plate, spec, work)
    quads, info, fps, W, H, _ = track(plate, spec, log=lambda *a: None)
    if not quads:
        sys.exit("no green screen in the plate")
    fs = sorted(quads)
    pick = [fs[int(k)] for k in np.linspace(0, len(fs) - 1, 6)]
    qw = max(st.quad_width(q) for q in quads.values())
    asp = float(np.median([st.quad_height(q) / st.quad_width(q) for q in quads.values()]))
    src = Source(spec, proj, work, qw, asp, fs[0] / fps, fps)
    cap = cv2.VideoCapture(plate)
    sharp_p, noise_p, black_p, sharp_s, black_s = [], [], [], {}, []
    sig = [0.0, 0.3, 0.5, 0.7, 0.9, 1.2, 1.5, 2.0]
    for f in pick:
        cap.set(cv2.CAP_PROP_POS_FRAMES, f)
        ok, fr = cap.read()
        if not ok:
            continue
        q = quads[f]
        poly = np.zeros((H, W), np.uint8)
        cv2.fillConvexPoly(poly, q.astype(np.int32), 1)
        r = max(5, int(0.10 * st.quad_width(q)))
        ring = (cv2.dilate(poly, np.ones((r, r), np.uint8)) > 0) & (cv2.dilate(poly, np.ones((7, 7), np.uint8)) == 0)
        inner = cv2.erode(poly, np.ones((9, 9), np.uint8)) > 0
        gray = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        sharp_p.append(float(cv2.Laplacian(gray, cv2.CV_32F)[ring].var()))
        hp = gray - cv2.GaussianBlur(gray, (0, 0), 1.5)
        noise_p.append(float(np.median(np.abs(hp[ring])) / 0.6745))
        black_p.append(float(np.percentile(gray[ring], 2)))
        s = src.frame(f / fps)
        _, Mi = st.to_screen(q, s.shape[1], s.shape[0])
        for sg in sig:
            g = cv2.GaussianBlur(s, (0, 0), sg) if sg else s
            w = cv2.warpPerspective(g, Mi, (W, H), flags=cv2.INTER_LINEAR)
            wl = cv2.Laplacian(cv2.cvtColor(w, cv2.COLOR_BGR2GRAY).astype(np.float32), cv2.CV_32F)
            sharp_s.setdefault(sg, []).append(float(wl[inner].var()))
        w = cv2.warpPerspective(s, Mi, (W, H))
        black_s.append(float(np.percentile(cv2.cvtColor(w, cv2.COLOR_BGR2GRAY)[inner], 2)))
    cap.release()
    target = float(np.median(sharp_p))
    blur = min(sig, key=lambda s: abs(np.log((np.median(sharp_s[s]) + 1) / (target + 1))))
    lift = float(np.clip((np.median(black_p) - np.median(black_s)) / 255.0, 0, 0.08))
    prop = dict(spec.get("grade") or {})
    prop.update({"blur": blur, "noise": round(float(np.median(noise_p)), 1), "black_lift": round(lift, 3)})
    prop.setdefault("contrast", 1.04)
    prop.setdefault("reflection", 0.05)
    out = {"measured": {"plate_sharpness": round(target, 1), "plate_noise": round(float(np.median(noise_p)), 2),
                        "plate_black": round(float(np.median(black_p)), 1),
                        "app_black": round(float(np.median(black_s)), 1),
                        "app_sharpness_by_blur": {str(k): round(float(np.median(v)), 1) for k, v in sharp_s.items()}},
           "proposed_grade": prop}
    json.dump(out, open(os.path.join(work, "grade-proposal.json"), "w"), indent=2)
    print(json.dumps(out, indent=2))
    print("a proposal: confirm it by eye on the corner sheet before it goes into insert.json")


# ---------------------------------------------------------------- composite
def composite(plate, spec, out_path, proj, work):
    os.makedirs(work, exist_ok=True)
    plate = upscale_plate(plate, spec, work)
    quads, info, fps, W, H, nf = track(plate, spec)
    t0, t1 = spec.get("plate_window") or [0, nf / max(fps, 1)]
    print(f"plate: {W}x{H} {fps:.3f}fps {nf} frames; insert window {t0}-{t1}s")
    if not quads:
        print("no green screen found anywhere in the plate -- no green, no insert: regenerate",
              file=sys.stderr)
        sys.exit(1)
    fs = sorted(quads)
    print(f"green screen present {fs[0] / fps:.2f}s - {fs[-1] / fps:.2f}s "
          f"({info['detected']} frames detected; nominal window was {t0}-{t1}s)")
    qw = max(st.quad_width(q) for q in quads.values())
    asp = float(np.median([st.quad_height(q) / st.quad_width(q) for q in quads.values()]))
    src = Source(spec, proj, work, qw, asp, fs[0] / fps, fps)
    SW, SH = src.SW, src.SH
    print(f"widest screen {qw:.0f} px of {W}; source at {SW} px ({SW / qw:.1f}x the quad)")

    lo, hi = st.key_range(spec.get("key") or {})
    dark_v = int((spec.get("key") or {}).get("dark_max", 105))
    occ = spec.get("occlusion") or {}
    finger_mode = spec.get("mode") == "finger" or "notch" in str(occ.get("dark_exception", ""))
    soften = float(occ.get("edge_soften_px", 1.0 if finger_mode else 1.6))
    whole_despill = finger_mode or occ.get("despill") == "whole finger"

    extra, offsets = {}, {}
    if spec.get("mode") == "finger" or src.kind == "finger-driven":
        tips = st.track_finger(plate, quads, spec)
        fg = spec.get("finger") or {}
        gesture = fg.get("gesture") or getattr(src, "gesture", None) or "scroll"
        c, r = st.contact_release(tips, fps, gesture)
        if fg.get("contact_frame") is not None:
            c = int(fg["contact_frame"])
        if fg.get("release_frame") is not None:
            r = int(fg["release_frame"])
        say = lambda f: "none" if f is None else f"frame {f} ({f / fps:.2f}s)"
        print(f"finger ({gesture}): contact {say(c)}, release {say(r)} -- confirm them on the finger sheet")
        extra = {"tips": {str(k): v for k, v in tips.items()}, "contact": c, "release": r, "gesture": gesture}
        if src.kind == "finger-driven":
            if c is None or r is None:
                sys.exit("finger-driven: no contact found; set finger.contact_frame and release_frame")
            offsets = src.finger_offsets(tips, c, r, fs)
    hero = (spec.get("hero") or {}).get("rect_source_px")
    if hero and any(hero):
        sx = SW / float(getattr(src, "native_w", SW))
        extra["hero_rect_screen"] = [v * sx for v in hero]
    extra.update({"source_size": [SW, SH], "source_kind": src.kind, "plate": os.path.abspath(plate)})
    st.save_track(os.path.join(work, "track.json"), quads, fps, W, H, info, extra)

    grade = make_grade(spec.get("grade") or {}, SW, SH)
    mb = spec.get("motion_blur") or {}

    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
         "-r", f"{fps}", "-i", "-", "-i", plate, "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", out_path],
        stdin=subprocess.PIPE)
    cap = cv2.VideoCapture(plate)
    dst_ref = np.array([[0, 0], [SW - 1, 0], [SW - 1, SH - 1], [0, SH - 1]], np.float32)
    rr = rounded_rect(SW, SH)
    zone = st.exception_zone(SW, SH).astype(np.float32)
    i, comped, blurred = 0, 0, 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if i in quads:
            s = grade(src.frame(i / fps, offsets.get(i, 0.0)))
            Mh = cv2.getPerspectiveTransform(dst_ref, quads[i])
            warp = cv2.warpPerspective(s, Mh, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            poly = cv2.warpPerspective(rr, Mh, (W, H), flags=cv2.INTER_LINEAR)
            if mb.get("on"):
                sub = shutter_quads(quads, i, float(mb.get("shutter_deg", 180)))
                if len(sub) > 1:
                    acc_w = np.zeros((H, W, 3), np.float32)
                    acc_p = np.zeros((H, W), np.float32)
                    for sq in sub:
                        M2 = cv2.getPerspectiveTransform(dst_ref, sq)
                        acc_w += cv2.warpPerspective(s, M2, (W, H), flags=cv2.INTER_LINEAR,
                                                     borderMode=cv2.BORDER_REPLICATE)
                        acc_p += cv2.warpPerspective(rr, M2, (W, H), flags=cv2.INTER_LINEAR)
                    warp = (acc_w / len(sub)).astype(np.uint8)
                    poly = acc_p / len(sub)
                    blurred += 1
            hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
            green = cv2.inRange(hsv, lo, hi)
            # STRICT green can only be the display, so the app must cover it; it is strict
            # so that the weak green spill on a finger is not painted over.
            strict = cv2.inRange(hsv, np.array([lo[0], st.STRICT_SAT, st.STRICT_VAL]), hi).astype(np.float32) / 255.0
            dark = hsv[..., 2] < dark_v
            if finger_mode:
                # The dark exception only in the notch zone and the edge band: a finger in
                # shadow, a darker skin tone or a dark nail stays in front everywhere else.
                zw = cv2.warpPerspective(zone, Mh, (W, H), flags=cv2.INTER_NEAREST) > 0.5
                occl = ((green == 0) & ~(zw & dark)).astype(np.float32)
            else:
                # The recreation rule: not green and not dark is a thumb; dark is the
                # model's notch or a shaded edge, and the app covers it.
                occl = ((green == 0) & ~dark).astype(np.float32)
            occl = cv2.GaussianBlur(occl, (0, 0), soften)
            m = np.maximum(poly, strict)
            m = (cv2.GaussianBlur(m, (0, 0), 1.2) * (1.0 - occl))[..., None]
            base = fr.astype(np.float32)
            if whole_despill:
                near = cv2.dilate((poly > 0.05).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
                edge = near & ((occl > 0.05) | ((m[..., 0] > 0.05) & (m[..., 0] < 0.95)))
            else:
                edge = (m[..., 0] > 0.05) & (m[..., 0] < 0.95)
            base[edge, 1] = np.minimum(base[edge, 1], (base[edge, 0] + base[edge, 2]) / 2)
            fr = np.clip(base * (1 - m) + warp.astype(np.float32) * m, 0, 255).astype(np.uint8)
            comped += 1
        enc.stdin.write(fr.tobytes())
        i += 1
    enc.stdin.close()
    enc.wait()
    cap.release()
    if mb.get("on"):
        print(f"motion blur on {blurred} frame(s)")
    print(f"composited {comped} frames -> {out_path}")


def main():
    a = sys.argv[1:]
    if a and a[0] == "--propose-grade":
        if len(a) < 5:
            sys.exit(__doc__)
        plate, spec_p, proj, work = a[1:5]
        propose_grade(plate, json.load(open(spec_p)), proj, work)
        return
    if len(a) < 5:
        sys.exit(__doc__)
    plate, spec_p, out, proj, work = a[:5]
    composite(plate, json.load(open(spec_p)), out, proj, work)


if __name__ == "__main__":
    main()
