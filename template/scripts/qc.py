#!/usr/bin/env python3
"""Stage 7: measure a generated plate. Numbers only -- the agent supplies the verdict.

    scripts/qc.py <project> [video.mp4]

Writes a contact sheet and per-shot frames next to the video and prints:
  - detected cuts vs the cut times the prompt asked for
  - green-screen quality, if there is any green (flatness is what keying cares about)
  - the spoken dialogue, transcribed back, for diffing against the script
  - pitch spread per 2s window, which is how you catch a monotone read

Looking at the frames is still your job. This tool cannot tell you the tripod is in shot.
"""
import glob, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

name = sys.argv[1]
vids = sys.argv[2:3] or sorted(glob.glob(f"{ROOT}/pipeline/06-generated/{name}/*.mp4"),
                               key=os.path.getmtime, reverse=True)
if not vids:
    sys.exit(f"no video in pipeline/06-generated/{name}/")
V = vids[0]
OUT = os.path.join(os.path.dirname(V), "qc")
os.makedirs(OUT, exist_ok=True)
print(f"video: {V}\n")


def ffprobe(*args):
    return subprocess.run(["ffprobe", "-v", "error", *args, V],
                          capture_output=True, text=True).stdout.strip()


dur = float(ffprobe("-show_entries", "format=duration", "-of", "csv=p=0") or 0)
wh = ffprobe("-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
             "-of", "csv=p=0")
has_audio = bool(ffprobe("-select_streams", "a:0", "-show_entries", "stream=codec_name",
                         "-of", "csv=p=0"))
print(f"  {wh}   {dur:.3f}s   audio={'yes' if has_audio else 'NO -- that is a defect'}")

# ---------------------------------------------------------------- cuts
print("\ncuts detected")
r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", V, "-vf",
                    "select='gt(scene,0.02)',metadata=print:key=lavfi.scene_score:file=-",
                    "-f", "null", "-"], capture_output=True, text=True)
cuts, t = [], None
for line in r.stdout.splitlines():
    m = re.search(r"pts_time:([\d.]+)", line)
    if m:
        t = float(m.group(1))
    m = re.search(r"scene_score=([\d.]+)", line)
    if m and t is not None and float(m.group(1)) > 0.15 and t > 0.5:
        cuts.append((t, float(m.group(1))))
for t, s in cuts:
    print(f"  {t:7.3f}s   score {s:.3f}")
if not cuts:
    print("  none above 0.15 -- single continuous take")

prompt_file = f"{ROOT}/pipeline/05-prompt/{name}/prompt.txt"
if os.path.exists(prompt_file):
    asked = sorted({float(x) for x in re.findall(r"(?:at|cuts? at|exactly)\s+([\d.]+)\s*s",
                                                 open(prompt_file).read())})
    if asked:
        print(f"  prompt asked for cuts at: {', '.join(f'{a}s' for a in asked)}")
        for a in asked:
            near = min((abs(a - c) for c, _ in cuts), default=None)
            if near is None:
                print(f"    {a}s -> MISSING")
            else:
                print(f"    {a}s -> off by {near:+.3f}s" if near > 0.001 else f"    {a}s -> exact")

# ---------------------------------------------------------------- frames
n_tiles = max(1, min(20, int(dur)))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", V, "-vf",
                f"fps=1,scale=216:384,tile={min(n_tiles,5)}x{(n_tiles+4)//5}:padding=6:color=white",
                f"{OUT}/sheet_%02d.png"], check=False)
print(f"\ncontact sheet -> {OUT}/sheet_01.png    (1 fps; LOOK AT IT)")

# ---------------------------------------------------------------- green screen
try:
    import cv2, numpy as np, statistics
    cap = cv2.VideoCapture(V)
    R, G, B, SD, AREA, CX, CY = [], [], [], [], [], [], []
    while True:
        okf, fr = cap.read()
        if not okf:
            break
        hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)
        m = ((hsv[:, :, 0] > 35) & (hsv[:, :, 0] < 85) &
             (hsv[:, :, 1] > 80) & (hsv[:, :, 2] > 60))
        if m.sum() < 2000:
            continue
        px = fr[m]
        AREA.append(int(m.sum()))
        B.append(px[:, 0].mean()); G.append(px[:, 1].mean()); R.append(px[:, 2].mean())
        SD.append(float(px[:, 1].std()))
        ys, xs = np.nonzero(m)
        CX.append(float(xs.mean())); CY.append(float(ys.mean()))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)); w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    cap.release()
    if G:
        print(f"\ngreen screen ({len(G)} frames carry a keyable region)")
        print(f"  area          {statistics.mean(AREA)/(w*h)*100:.1f}% of frame"
              f"   swing {(max(AREA)-min(AREA))/statistics.mean(AREA)*100:.1f}%")
        print(f"  colour        R={statistics.mean(R):.0f} G={statistics.mean(G):.0f} B={statistics.mean(B):.0f}")
        print(f"  flatness      within-frame G std {statistics.mean(SD):.1f}  (0 = perfect sheet;"
              f" >10 means UI ghosting baked in)")
        print(f"  stability     across-frame G drift {max(G)-min(G):.1f}")

        # Phone stability. The composite tracks the green quad, so every pixel the phone
        # wanders is a pixel the inserted app slides against the bezel. Judged relative to
        # the screen's own size, not the frame's -- a small phone drifting 20px is worse
        # than a large one drifting 20px.
        span = (max(CX) - min(CX), max(CY) - min(CY))
        side = statistics.mean(AREA) ** 0.5
        jitter = statistics.mean([abs(CX[i] - CX[i-1]) + abs(CY[i] - CY[i-1])
                                  for i in range(1, len(CX))]) if len(CX) > 1 else 0.0
        drift_pct = max(span) / side * 100
        verdict = ("locked" if drift_pct < 8 else
                   "acceptable" if drift_pct < 20 else "TOO MUCH — the insert will slide")
        print(f"  phone motion  centre travels {span[0]:.0f}px x {span[1]:.0f}px "
              f"= {drift_pct:.0f}% of screen width")
        print(f"                frame-to-frame jitter {jitter:.2f}px      -> {verdict}")
        if drift_pct >= 20:
            print("                fix in stage 5: the prompt must say the phone is held")
            print("                completely still — no drift, rotation, tilt or re-grip.")
    else:
        print("\ngreen screen: none found (fine unless this was meant to be a plate)")
except ImportError:
    print("\ngreen screen: skipped (cv2 not installed)")

# ---------------------------------------------------------------- audio
if has_audio:
    wav = f"{OUT}/audio.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", V, "-vn", "-ac", "1",
                    "-ar", "16000", wav], check=True)
    try:
        from faster_whisper import WhisperModel
        mdl = WhisperModel("base.en", device="cpu", compute_type="int8")
        segs, _ = mdl.transcribe(wav, vad_filter=True)
        print("\nspoken back (diff this against prompt.txt yourself)")
        for s in segs:
            print(f"  [{s.start:5.2f} - {s.end:5.2f}] {s.text.strip()}")
    except ImportError:
        print("\ntranscript: skipped (faster_whisper not installed)")

    try:
        import numpy as np, wave
        with wave.open(wav) as f:
            sr = f.getframerate()
            a = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float32)
        # Autocorrelation f0 per 40ms hop, then pitch spread per 2s window. A flat window
        # is a monotone stretch -- this is how you locate "it goes robotic after X".
        hop, win = int(sr * 0.04), int(sr * 0.04 * 2)
        f0 = []
        for i in range(0, len(a) - win, hop):
            seg = a[i:i + win] - a[i:i + win].mean()
            if np.abs(seg).mean() < 200:
                f0.append((i / sr, 0)); continue
            c = np.correlate(seg, seg, "full")[win - 1:]
            lo, hi = int(sr / 400), int(sr / 70)
            if hi >= len(c):
                f0.append((i / sr, 0)); continue
            k = int(np.argmax(c[lo:hi])) + lo
            f0.append((i / sr, sr / k if k else 0))
        voiced = [(t, f) for t, f in f0 if 70 < f < 400]
        if voiced:
            hz = np.array([f for _, f in voiced])
            st = 12 * np.log2(hz / np.median(hz))
            print(f"\nprosody   median f0 {np.median(hz):.1f} Hz   "
                  f"semitone SD {st.std():.2f}   p10-p90 spread {np.percentile(st,90)-np.percentile(st,10):.2f} st")
            print("  per 2s window (a window under ~5 st reads as monotone):")
            for w0 in range(0, int(dur), 2):
                sub = np.array([f for t, f in voiced if w0 <= t < w0 + 2])
                if len(sub) > 5:
                    s2 = 12 * np.log2(sub / np.median(hz))
                    spread = np.percentile(s2, 90) - np.percentile(s2, 10)
                    flag = "   <-- flat" if spread < 5 else ""
                    print(f"    {w0:>3}-{w0+2:<3}s   {spread:5.2f} st{flag}")
    except Exception as e:
        print(f"\nprosody: skipped ({e})")

print(f"\nartifacts in {OUT}/")
print("Now LOOK at the contact sheet. Measurements do not catch a hallucinated tripod,")
print("a wrong hand, a vanished animal, or on-screen text that should not be there.")
