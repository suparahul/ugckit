#!/usr/bin/env python3
"""The identity gate of a face-replace reaction (P3, before gate B). Free, local.

    .venv/bin/python3 scripts/character/identity.py <video> <segment> [generated/<x>.mp4]

Whose face is in the generated file: the character's, or still the reference clip's?
Eight frames of the file, inside the reaction's range (reference.json range_s; a padded take is
trimmed to it at assembly), are compared, with OpenCV's face detector (YuNet) and face
recogniser (SFace), against the character's approved pictures (the hero and the front and
three-quarter anchors of creator.json) and against the same moment of the reference clip
(segments/<seg>/source/reference.mp4). Scores are cosine similarities; 0.363 is SFace's
"same person" threshold.

PASS needs all three:
  - a face in at least 6 of the 8 frames;
  - the median similarity to the character at or above 0.363;
  - in at least 75% of the frames with both faces, the face is closer to the character
    than to the reference clip's person.
A file that still shows the reference's person fails the third rule even when the two
people look alike.

Writes generated/qc/identity-<file>.json beside the file; review.py reads it at gate B
and refuses a face-replace approval without a PASS. Exit 0 PASS, 1 FAIL, 2 not run.
The model files (about 39 MB, from github.com/opencv/opencv_zoo) are fetched once into
scripts/character/face-models/. The eye check at gate B still decides; this gate only
stops a file that is clearly not the character.
"""
import glob, hashlib, json, os, statistics, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "pipeline", "character")
MODELS = os.path.join(ROOT, "scripts", "character", "face-models")
ZOO = "https://github.com/opencv/opencv_zoo/raw/main/models/"
WEIGHTS = {
    "face_detection_yunet_2023mar.onnx":
        ("face_detection_yunet/", "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
    "face_recognition_sface_2021dec.onnx":
        ("face_recognition_sface/", "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"),
}
SAME_PERSON = 0.363          # SFace cosine threshold (OpenCV)
FRAMES = 8
MIN_FACES = 6
CLOSER_SHARE = 0.75
ANCHORS = ("front", "three_quarter_left", "three_quarter_right")


def weights():
    os.makedirs(MODELS, exist_ok=True)
    out = {}
    for name, (sub, sha) in WEIGHTS.items():
        p = os.path.join(MODELS, name)
        if not os.path.exists(p):
            print(f"fetching {name} (once)")
            urllib.request.urlretrieve(ZOO + sub + name, p)
        if hashlib.sha256(open(p, "rb").read()).hexdigest() != sha:
            os.remove(p)
            sys.exit(f"{name} does not match its checksum; it was removed -- run again")
        out[name] = p
    return out


class Faces:
    def __init__(self):
        import cv2
        self.cv2 = cv2
        try:
            cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
        except AttributeError:
            pass
        w = weights()
        self.det = cv2.FaceDetectorYN.create(w["face_detection_yunet_2023mar.onnx"], "", (320, 320), 0.7)
        self.rec = cv2.FaceRecognizerSF.create(w["face_recognition_sface_2021dec.onnx"], "")

    def feature(self, img):
        """The feature of the largest face in a picture, or None."""
        if img is None:
            return None
        h, w = img.shape[:2]
        if max(h, w) > 1280:                       # YuNet is fast and accurate at this size
            s = 1280 / max(h, w)
            img = self.cv2.resize(img, (int(w * s), int(h * s)))
            h, w = img.shape[:2]
        self.det.setInputSize((w, h))
        _, faces = self.det.detect(img)
        if faces is None or not len(faces):
            return None
        f = max(faces, key=lambda r: r[2] * r[3])
        return self.rec.feature(self.rec.alignCrop(img, f))

    def sim(self, a, b):
        return float(self.rec.match(a, b, self.cv2.FaceRecognizerSF_FR_COSINE))


def frame(video_file, t):
    import cv2, numpy as np
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", video_file, "-frames:v", "1",
                        "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    if not r.stdout:
        return None
    return cv2.imdecode(np.frombuffer(r.stdout, np.uint8), cv2.IMREAD_COLOR)


def duration(video_file):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                        video_file], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def character_pictures(video):
    """The character's approved pictures: the hero first, then the front and three-quarter
    anchors that exist."""
    plan = json.load(open(os.path.join(CH, video, "plan.json")))
    hdir = os.path.join(ROOT, "apps", plan["app"], "handles", plan["handle"].lstrip("@"))
    pin = (plan.get("characters") or [""])[0]
    cid = pin.split("@")[0]
    cp = os.path.join(hdir, "characters", cid, "creator.json")
    c = json.load(open(cp)) if os.path.exists(cp) else {}
    a = c.get("anchors") or {}
    rels = [(a.get("hero") or "references/face.png").split(" ")[0]] + [a[k] for k in ANCHORS if a.get(k)]
    return [os.path.join(hdir, r) for r in rels if os.path.exists(os.path.join(hdir, r))]


def check(video, seg, rel=None):
    """Score one generated file. Returns the record written to qc/identity-<file>.json."""
    import cv2
    sdir = os.path.join(CH, video, "segments", seg)
    if rel is None:
        c = sorted(glob.glob(os.path.join(sdir, "generated", "*.mp4")), key=os.path.getmtime, reverse=True)
        if not c:
            sys.exit(f"no file in segments/{seg}/generated/")
        rel = os.path.relpath(c[0], sdir)
    f = os.path.join(sdir, rel)
    src = os.path.join(sdir, "source", "reference.mp4")
    faces = Faces()
    pics = character_pictures(video)
    feats = [x for x in (faces.feature(cv2.imread(p)) for p in pics) if x is not None]
    rec = {"file": rel, "frames": [], "thresholds": {"same_person": SAME_PERSON, "min_faces": MIN_FACES,
                                                     "closer_share": CLOSER_SHARE},
           "character_pictures": [os.path.relpath(p, ROOT) for p in pics], "character_faces": len(feats)}
    if not feats:
        rec.update(result="NOT RUN", why="no face found in the character's pictures")
        return rec
    d, ds = duration(f), duration(src) if os.path.exists(src) else 0.0
    # The reaction's range only: a route with pad_to_s holds the clip's last frame to that length,
    # and assembly trims the take back to the range (reference.json range_s).
    rj = os.path.join(sdir, "source", "reference.json")
    rng = (json.load(open(rj)).get("range_s") or []) if os.path.exists(rj) else []
    span = min(d, rng[1] - rng[0]) if len(rng) == 2 and rng[1] > rng[0] else d
    rec["range_s"] = round(span, 3)
    for i in range(FRAMES):
        t = span * (i + 0.5) / FRAMES
        g = faces.feature(frame(f, t))
        row = {"t": round(t, 2), "face": g is not None}
        if g is not None:
            row["character"] = round(max(faces.sim(g, x) for x in feats), 3)
            if ds:
                s = faces.feature(frame(src, min(ds - 0.01, t)))
                if s is not None:
                    row["reference"] = round(faces.sim(g, s), 3)
        rec["frames"].append(row)
    found = [r for r in rec["frames"] if r["face"]]
    both = [r for r in found if "reference" in r]
    med = statistics.median([r["character"] for r in found]) if found else 0.0
    closer = sum(r["character"] > r["reference"] for r in both) / len(both) if both else None
    rec.update(faces_found=len(found), median_character=round(med, 3),
               median_reference=round(statistics.median([r["reference"] for r in both]), 3) if both else None,
               closer_to_character=round(closer, 2) if closer is not None else None)
    why = []
    if len(found) < MIN_FACES:
        why.append(f"a face in {len(found)} of {FRAMES} frames (needs {MIN_FACES})")
    if med < SAME_PERSON:
        why.append(f"median similarity to the character {med:.3f} (needs {SAME_PERSON})")
    if closer is not None and closer < CLOSER_SHARE:
        why.append(f"closer to the character in {closer:.0%} of frames (needs {CLOSER_SHARE:.0%}): "
                   "the face is still the reference's")
    rec["result"] = "FAIL" if why else "PASS"
    rec["why"] = "; ".join(why) or None
    out = os.path.join(os.path.dirname(f), "qc", f"identity-{os.path.splitext(os.path.basename(f))[0]}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(rec, open(out, "w"), indent=2)
    rec["_path"] = out
    return rec


def show(rec):
    print(f"identity  {rec['file']}")
    for r in rec.get("frames") or []:
        if not r["face"]:
            print(f"  {r['t']:5.2f}s  no face")
        else:
            ref = f"   reference {r['reference']:.3f}" if "reference" in r else ""
            print(f"  {r['t']:5.2f}s  character {r['character']:.3f}{ref}")
    if rec["result"] != "NOT RUN":
        print(f"  median: character {rec['median_character']}, reference {rec['median_reference']}; "
              f"closer to the character in {rec['closer_to_character']} of frames")
    print(f"{rec['result']}" + (f": {rec['why']}" if rec.get("why") else ""))


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    rec = check(a[0], a[1], a[2] if len(a) > 2 else None)
    show(rec)
    sys.exit({"PASS": 0, "FAIL": 1}.get(rec["result"], 2))


if __name__ == "__main__":
    main()
