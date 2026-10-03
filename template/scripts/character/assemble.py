#!/usr/bin/env python3
"""P5: one finished file from video.json. Local ffmpeg, free. Run it through assemble.sh.

    assemble.py <video> [--grain] [--no-captions]

For every segment of pipeline/character/<video>/video.json, in order:
  generated (T, O, G, S, H, F, B, X)  the file approved at gate B (approval.json); for a phone
                                segment, its approved composite (P4)
  C                             supplied media: the plan's asset, its checksum checked and
                                its source approved at gate B; a clip cut to
                                `source_range_s`, a still held for `still_s`; scaled to cover
                                9:16 (`fit`: "pad" keeps the whole picture); its own sound
                                unless `audio` is "mute" or `audio_from` lays another; with
                                `insert`, the approved composite of its filmed phone
  M                             panels: each panel (an asset, an approved B project or a
                                screen recording) cut to its range, scaled into its `rect`
                                (shares of the frame), started `sync_offset_s` late, on black
  R                             the screen recording, cropped to 9:16 around the hero
                                element, a slow punch-in to `punch_in_to_hero` (1.25), a
                                0.3 px blur
  P                             the R base and her demo performance in a round bubble,
                                28% of the width, in the top corner away from the hero
Then: trim (a talking segment from 0.15 s before its first word to 0.2 s after its last,
by faster-whisper word times; otherwise `trim`, or the shot's trim_to_seconds), upscale
once with lanczos to 1080x1920 (a composite is already there), `punch_in`, one loudness
for every segment, a 30 ms fade at each join, hard cuts, the room tone under everything,
captions spelled from the frozen script and timed by the word times, the title overlay
only when the plan asks, and the export pass: one phone-like intermediate encode, then
the final 1080x1920 30 fps H.264. --grain also writes the 2 to 3% grain variant.
After the pass: the size, the frame rate, the sound, the loudness, the OCR of every
hero element and the green count on the final file. Writes assembly/<video>.mp4 and
assembly/assembly.json; nothing is posted (the pipeline ends at the finished file).

Per segment in video.json, all optional: "trim": [in, out] in seconds of the source;
"punch_in": 1.10; "audio_from": "<video>.<seg>" (another approved segment's voice: the
demo performance under R, P, H, F, B or C), "asset:<id>" (a supplied voice or sound,
approved at gate B, cut to `audio_range_s` or its trim_s) or "narration:<take>" (a
narrator's take approved at gate B); for R and P "screen_id", "punch_in_to_hero".

The overlays of a v2 plan (video.json `overlays`, copied from the plan) are drawn at their
exact times: hook, paragraph, step and comparison labels, the day counter, the source
credit. A legacy `title_overlay` is drawn as one hook overlay. After the pass, gate C's
checks add: the overlays as planned, long enough to read, clear of every hero element,
every caption and each other; the supplied files unchanged.
"""
import difflib, glob, hashlib, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bridge
CH = os.path.join(ROOT, "pipeline", "character")
W, H, FPS = 1080, 1920, 30
GENERATED = ("T", "O", "G", "S", "H", "F", "B", "X")
PHONE = ("O", "G", "S", "H", "F")
# Overlay roles: (size as a share of the width, characters per line).
OVERLAY_STYLE = {"hook": (0.074, 22), "paragraph": (0.048, 30), "step_label": (0.06, 22),
                 "comparison_label": (0.05, 16), "day_counter": (0.05, 14), "source_credit": (0.032, 40)}
# Placements: (x as a share of the width, text anchor, top of the block as a share of the height).
PLACE = {"top": (0.5, "middle", 0.08), "middle": (0.5, "middle", 0.30),
         "upper_left": (0.06, "start", 0.08), "upper_right": (0.94, "end", 0.08)}
LOUD = "loudnorm=I=-16:TP=-1.5:LRA=11"
CAP_BAND = (0.62, 0.82)          # the lower caption band; the safe area ends at 82%
PROBLEMS = []


def bad(msg):
    PROBLEMS.append(msg)
    print(f"  ✗ {msg}")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed:\n  " + " ".join(cmd[:12]) + " ...\n" + r.stderr[-1500:])
    return r


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def has_audio(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                        "stream=codec_name", "-of", "csv=p=0", path], capture_output=True, text=True)
    return bool(r.stdout.strip())


def norm(w):
    return re.sub(r"[^a-z0-9%$']", "", w.lower().replace("’", "'"))


# ---------------------------------------------------------------- word times
_model = None


def heard_words(path, work):
    """[(word, start, end)] heard in the file, by faster-whisper; cached per file."""
    global _model
    h = hashlib.sha1(f"{path}:{os.path.getmtime(path)}".encode()).hexdigest()[:12]
    cp = os.path.join(work, f"words-{h}.json")
    if os.path.exists(cp):
        return [tuple(x) for x in json.load(open(cp))]
    if not has_audio(path):
        return []
    wav = os.path.join(work, f"audio-{h}.wav")
    run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", wav])
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper is not installed: the word times trim the talking segments and time the "
                 "captions (pip install -r requirements.txt)")
    if _model is None:
        _model = WhisperModel("base.en", device="cpu", compute_type="int8")
    segs, _ = _model.transcribe(wav, word_timestamps=True, vad_filter=False)
    out = [(w.word.strip(), round(w.start, 3), round(w.end, 3)) for s in segs for w in (s.words or [])]
    json.dump(out, open(cp, "w"))
    return out


def align(script_words, heard):
    """Times for every word of the frozen script, from the words heard: matched words take
    the heard times, the rest are spread between their matched neighbours."""
    a, b = [norm(w) for w in script_words], [norm(w) for w, _, _ in heard]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k][1], heard[blk.b + k][2])
    matched = sum(1 for t in times if t)
    if not heard:
        return None, 0.0
    lo, hi = heard[0][1], heard[-1][2]
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i]:
            continue
        prev = max([k for k in known if k < i], default=None)
        nxt = min([k for k in known if k > i], default=None)
        s = times[prev][1] if prev is not None else lo
        e = times[nxt][0] if nxt is not None else hi
        span = [k for k in range(len(times)) if (prev is None or k > prev) and (nxt is None or k < nxt)]
        step = (e - s) / max(1, len(span))
        j = span.index(i)
        times[i] = (s + j * step, s + (j + 1) * step)
    return times, matched / max(1, len(a))


def chunks(words, times):
    """Captions of 3 to 6 words, broken at punctuation where it can be."""
    out, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        end = re.search(r"[.,!?;:—–-]$", w) is not None
        if len(cur) >= 6 or (len(cur) >= 3 and end):
            out.append(cur)
            cur = []
    if cur:
        if out and len(cur) < 3 and len(out[-1]) + len(cur) <= 6:
            out[-1] += cur
        else:
            out.append(cur)
    return [(" ".join(words[i] for i in c), times[c[0]][0], times[c[-1]][1]) for c in out]


def wrap(text, n=24):
    lines, cur = [], ""
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > n:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    return lines + ([cur] if cur else [])


# ---------------------------------------------------------------- sources
def load(p):
    return json.load(open(p))


def approved(project):
    """The approved entry of a project ('<video>.<seg>') at gate B, and its segment folder."""
    v, seg = project.rsplit(".", 1)
    sd = os.path.join(CH, v, "segments", seg)
    ap = os.path.join(CH, v, "approval.json")
    rows = [e for e in (load(ap).get("gate_b_segments") or []) if e.get("project") == project] if os.path.exists(ap) else []
    e = rows[-1] if rows else None
    return (e if e and e.get("decision") == "approve" else None), sd, v, seg


def screen_row(slug, sid):
    p = os.path.join(ROOT, "apps", slug, "screens", "screens.json")
    if not os.path.exists(p):
        return None, None
    for r in load(p).get("screens") or []:
        if r["id"] == sid:
            return r, os.path.join(ROOT, "apps", slug, "screens", r["file"])
    return None, None


def fits(name, aw, dur):
    """A voice laid under a picture fits inside it; the plan's timing is never stretched."""
    if aw[1] - aw[0] > dur + 0.25:
        sys.exit(f"{name}: the sound under it runs {aw[1] - aw[0]:.2f} s; the picture is {dur:.2f} s. "
                 "The take is too long for the planned beat: P1 changes the cut, or the plan goes back "
                 "to planning")


def alpha_bbox(png):
    """[x, y, w, h] of the drawn pixels of a transparent picture."""
    import cv2, numpy as np
    im = cv2.imread(png, cv2.IMREAD_UNCHANGED)
    if im is None or im.ndim < 3 or im.shape[2] < 4:
        return None
    ys, xs = np.nonzero(im[:, :, 3] > 8)
    if not len(xs):
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def boxes_meet(a, b, pad=8):
    return bool(a and b) and a[0] < b[0] + b[2] + pad and b[0] < a[0] + a[2] + pad and \
        a[1] < b[1] + b[3] + pad and b[1] < a[1] + a[3] + pad


def approval_doc(video):
    p = os.path.join(CH, video, "approval.json")
    return load(p) if os.path.exists(p) else {}


def supplied(plan, video, aid):
    """(path, asset) of a supplied asset approved at gate B, or (None, why)."""
    a = next((x for x in plan.get("assets") or [] if x.get("id") == aid), None)
    if not a:
        return None, f"asset {aid!r} is not in the plan's assets[]"
    fp = os.path.join(ROOT, a.get("path") or "-")
    if not os.path.exists(fp):
        return None, f"{a.get('path')} is not on disk"
    sha = bridge.sha256_file(fp)
    if sha != a.get("sha256"):
        return None, f"{a.get('path')} does not match the plan's sha256 (the file changed)"
    rows = [e for e in approval_doc(video).get("gate_b_sources") or [] if e.get("asset_id") == aid]
    # A screen recording is the app's real recording from the screen library, checked there
    # (screens.py check), as for R and P; its checksum is still the plan's.
    if a.get("kind") != "screen" and (not rows or rows[-1].get("decision") != "approve"
                                      or rows[-1].get("sha256") != sha):
        return None, f"asset {aid} has no source approval at gate B for this file (review.py source)"
    a = dict(a)
    a["_duration"] = duration(fp) if a.get("kind") != "still" else None
    return fp, a


def narration(video, take):
    """The approved file of a narrator's take, or (None, why)."""
    rows = [e for e in approval_doc(video).get("gate_b_narration") or [] if e.get("take") == take]
    if not rows or rows[-1].get("decision") != "approve":
        return None, f"narration take {take!r} is not approved at gate B (review.py narration)"
    fp = os.path.join(CH, video, rows[-1]["file"])
    if not os.path.exists(fp) or bridge.sha256_file(fp) != rows[-1].get("sha256"):
        return None, f"narration/{take} changed after its approval"
    return fp, rows[-1]


def audio_window(it, work):
    """The window of the sound laid under a segment, and the words heard in it: a supplied
    sound's approved range, else the words of the take or performance (0.15 s before the
    first, 0.2 s after the last)."""
    src = it["audio_src"]
    if it.get("audio_range"):
        a0, a1 = [float(x) for x in it["audio_range"]]
        hw = [w for w in heard_words(src, it["work"]) if a0 <= w[1] < a1]
        return [a0, a1], hw
    aw, hw = word_window(src, work)
    return aw or [0.0, duration(src)], hw


def word_window(path, work, pad=(0.15, 0.2)):
    hw = heard_words(path, work)
    if not hw:
        return None, hw
    d = duration(path)
    return [max(0.0, hw[0][1] - pad[0]), min(d, hw[-1][2] + pad[1])], hw


# ---------------------------------------------------------------- segment builders
def vf_generated(punch):
    crop = f"crop=iw/{punch}:ih/{punch}," if punch and punch != 1 else ""
    return (f"fps={FPS},{crop}scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={W}:{H},setsar=1,format=yuv420p")


def audio_chain(dur, fade):
    f = fade / 1000.0
    # apad: a sound shorter than the picture is padded with silence, so every segment's
    # sound is exactly as long as its picture and the joins stay in sync.
    return (f"{LOUD},aresample=48000,apad=whole_dur={dur:.3f},afade=t=in:st=0:d={f},"
            f"afade=t=out:st={max(0, dur - f):.3f}:d={f}")


def encode_segment(out, vin, vf, ain, af, dur, extra_inputs=(), fc=None):
    """One normalised segment: 1080x1920, 30 fps, yuv420p, AAC 48 kHz stereo."""
    cmd = ["ffmpeg", "-y", "-v", "error"] + vin
    if ain is None:
        cmd += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        # Digital silence needs no levelling: loudnorm on silence under 3 s returns NaN.
        af = f"aresample=48000,apad=whole_dur={dur:.3f}" if af else af
    else:
        cmd += ain
    for x in extra_inputs:
        cmd += x
    if fc:
        cmd += ["-filter_complex", fc, "-map", "[v]", "-map", "[a]"]
    else:
        cmd += ["-filter_complex", f"[0:v]{vf}[v];[1:a]{af},aformat=channel_layouts=stereo[a]",
                "-map", "[v]", "-map", "[a]"]
    cmd += ["-t", f"{dur:.3f}", "-r", str(FPS), "-c:v", "libx264", "-crf", "14", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", out]
    run(cmd)


def r_geometry(rec_size, hero_rect):
    """The 9:16 crop of a recording around its hero element, in source pixels."""
    sw, sh = rec_size
    cw, ch = sw, round(sw * 16 / 9)
    if ch > sh:
        ch, cw = sh, round(sh * 9 / 16)
    hx, hy = ((hero_rect[0] + hero_rect[2] / 2, hero_rect[1] + hero_rect[3] / 2) if hero_rect and any(hero_rect)
              else (sw / 2, sh / 2))
    x = int(min(max(0, hx - cw / 2), sw - cw))
    y = int(min(max(0, hy - ch / 2), sh - ch))
    return x, y, cw, ch, hx - x, hy - y


def r_final_rect(geo, hero_rect, z):
    """Where the hero element lands in the 1080x1920 frame at zoom z (the zoompan below)."""
    x, y, cw, ch, hx, hy = geo
    vw, vh = cw / z, ch / z
    zx = min(max(0, hx - vw / 2), cw - vw)
    zy = min(max(0, hy - vh / 2), ch - vh)
    s = W / vw
    rx, ry, rw, rh = hero_rect
    return [round((rx - x - zx) * s), round((ry - y - zy) * s), round(rw * s), round(rh * s)]


def vf_supplied(fit, punch):
    """A supplied clip or still to 1080x1920: cover (crop the overflow) or pad (keep the
    whole picture on black)."""
    if fit == "pad":
        return (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,"
                f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p")
    return vf_generated(punch)


def build_c(it, out, dur, ain, fade):
    """C: the supplied clip in its range, or the still held."""
    s, a = it["seg"], it["asset"]
    if a["kind"] == "still":
        vin = ["-loop", "1", "-t", f"{dur:.3f}", "-i", it["src"]]
    else:
        r = s["source_range_s"]
        vin = ["-ss", f"{r[0]:.3f}", "-to", f"{r[1]:.3f}", "-i", it["src"]]
    encode_segment(out, vin, vf_supplied(s.get("fit"), s.get("punch_in")), ain, audio_chain(dur, fade), dur)


def even(x):
    return int(round(x / 2.0)) * 2


def panel_px(rect):
    x, y, w, h = rect
    return even(x * W), even(y * H), max(2, even(w * W)), max(2, even(h * H))


def build_m(it, out, dur, audio, fade):
    """M: the panels on black, each in its rect, each started sync_offset_s late and held
    on its last frame. The sound: audio_from, else the panel marked "audio": true, else
    silence."""
    panels = it["panels"]
    cmd = ["ffmpeg", "-y", "-v", "error"]
    fc = [f"color=c=black:s={W}x{H}:r={FPS}:d={dur:.3f},format=yuv420p[b0]"]
    for k, p in enumerate(panels):
        if p["kind"] == "still":
            cmd += ["-loop", "1", "-t", f"{dur:.3f}", "-i", p["src"]]
        else:
            cmd += ["-ss", f"{p['range'][0]:.3f}", "-to", f"{p['range'][1]:.3f}", "-i", p["src"]]
        x, y, w, h = p["px"]
        sync = float(p.get("sync") or 0)
        fit = (f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
               if p.get("crop") == "pad" else
               f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h}")
        fc.append(f"[{k}:v]fps={FPS},{fit},setsar=1,format=yuv420p,"
                  f"tpad=start_duration={sync:.3f}:color=black:stop_mode=clone:stop_duration={dur:.3f},"
                  f"trim=duration={dur:.3f},setpts=PTS-STARTPTS[p{k}]")
        fc.append(f"[b{k}][p{k}]overlay={x}:{y}:eof_action=repeat[b{k + 1}]")
    n = len(panels)
    af = audio_chain(dur, fade)
    if audio:
        cmd += ["-ss", f"{audio[1]:.3f}", "-to", f"{audio[2]:.3f}", "-i", audio[0]]
        fc.append(f"[{n}:a]{af},aformat=channel_layouts=stereo[a]")
    else:
        own = next((k for k, p in enumerate(panels) if p.get("audio") and p["kind"] != "still"
                    and has_audio(p["src"])), None)
        if own is not None:
            ms = int(round(float(panels[own].get("sync") or 0) * 1000))
            fc.append(f"[{own}:a]adelay={ms}|{ms},{af},aformat=channel_layouts=stereo[a]")
        else:
            cmd += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
            fc.append(f"[{n}:a]{af},aformat=channel_layouts=stereo[a]")
    cmd += ["-filter_complex", ";".join(fc), "-map", f"[b{n}]", "-map", "[a]",
            "-t", f"{dur:.3f}", "-r", str(FPS), "-c:v", "libx264", "-crf", "14", "-preset", "medium",
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", out]
    run(cmd)


def panel_hero(p, row, t0):
    """Where a screen panel's hero element lands in the frame, and when (cover fit, centred)."""
    hero = (row or {}).get("hero") or {}
    r = hero.get("rect_source_px")
    if not r or not any(r) or not row.get("size") or p.get("crop") == "pad":
        return None
    sw, sh = row["size"]
    x, y, w, h = p["px"]
    sc = max(w / sw, h / sh)
    ox, oy = (sw * sc - w) / 2, (sh * sc - h) / 2
    rect = [round(x + r[0] * sc - ox), round(y + r[1] * sc - oy), round(r[2] * sc), round(r[3] * sc)]
    if rect[0] < x or rect[1] < y or rect[0] + rect[2] > x + w or rect[1] + rect[3] > y + h:
        return None
    ht = float(hero.get("t") or 0)
    if not (p["range"][0] <= ht <= p["range"][1]):
        ht = p["range"][1] - 0.3
    return {"t": round(t0 + float(p.get("sync") or 0) + ht - p["range"][0], 3), "rect": rect, "text": hero.get("text")}


def build_r(seg, row, rec, out, dur, audio, fade, bubble=None):
    """R: the recording, 9:16 around the hero, a slow punch-in, a light blur. P adds the
    bubble: the demo performance in a circle, 28% of the width, in the top corner away
    from the hero."""
    size = row.get("size") or [0, 0]
    hero = (row.get("hero") or {}).get("rect_source_px")
    geo = r_geometry(size, hero)
    x, y, cw, ch, hx, hy = geo
    zmax = float(seg.get("punch_in_to_hero") or 1.25)
    n = max(1, int(round(dur * FPS)))
    tin = float(seg["trim"][0]) if seg.get("trim") else 0.0
    rlen = duration(rec) - tin
    pad = max(0.0, dur - rlen + 0.1)
    vf = (f"[0:v]fps={FPS},tpad=stop_mode=clone:stop_duration={pad:.3f},crop={cw}:{ch}:{x}:{y},"
          f"zoompan=z='min(1+{zmax - 1:.4f}*on/{n},{zmax})':d=1:fps={FPS}:s={W}x{H}"
          f":x='max(0,min(iw-iw/zoom,{hx:.1f}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,{hy:.1f}-ih/zoom/2))',"
          f"gblur=sigma=0.3,setsar=1,format=yuv420p")
    ain = ["-i", audio[0]] + [] if audio else None
    if audio:
        ain = ["-ss", f"{audio[1]:.3f}", "-to", f"{audio[2]:.3f}", "-i", audio[0]]
    af = audio_chain(dur, fade)
    vin = (["-ss", f"{tin:.3f}"] if tin else []) + ["-i", rec]
    if bubble is None:
        fc = vf + "[v];" + f"[1:a]{af},aformat=channel_layouts=stereo[a]"
        encode_segment(out, vin, None, ain, None, dur, fc=fc)
    else:
        bw = int(0.28 * W) // 2 * 2
        left = hero is None or (hero[0] + hero[2] / 2) / max(1, size[0]) >= 0.5
        bx = 40 if left else W - bw - 40
        by = int(0.08 * H)
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height", "-of", "csv=p=0", bubble[0]], capture_output=True, text=True)
        bw0, bh0 = [int(v) for v in r.stdout.strip().split(",")[:2]]
        sq = min(bw0, bh0)
        fc = (vf + "[base];"
              f"[2:v]fps={FPS},crop={sq}:{sq}:{(bw0 - sq) // 2}:{int(0.06 * (bh0 - sq))},scale={bw}:{bw},format=rgba,"
              f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-{bw / 2},Y-{bw / 2}),{bw / 2 - 1}),255,0)'[bub];"
              f"[base][bub]overlay={bx}:{by}:shortest=0,format=yuv420p[v];"
              f"[1:a]{af},aformat=channel_layouts=stereo[a]")
        encode_segment(out, vin, None, ain, None, dur,
                       extra_inputs=[["-ss", f"{bubble[1]:.3f}", "-i", bubble[0]]], fc=fc)
    return geo, zmax


# ---------------------------------------------------------------- main
def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    video = a[0]
    grain, captions_on = "--grain" in a, "--no-captions" not in a
    vd = os.path.join(CH, video)
    vj, pj = os.path.join(vd, "video.json"), os.path.join(vd, "plan.json")
    if not os.path.exists(vj) or not os.path.exists(pj):
        sys.exit(f"pipeline/character/{video} needs plan.json and video.json (character-shots)")
    v, plan = load(vj), load(pj)
    lines = {l["id"]: l for l in plan["script"]}
    work = os.path.join(vd, "assembly", "work")
    os.makedirs(work, exist_ok=True)
    fade = int((v.get("joins") or {}).get("audio_fade_ms", 30))
    print(f"assemble {video}: {len(v['segments'])} segment(s), app_insertion "
          f"{'true' if plan.get('app_insertion') else 'false'}")

    if bridge.is_v2(plan) and v.get("plan_sha256") != bridge.digest(plan):
        sys.exit("video.json was written from another revision of the plan: P1 writes it again "
                 "(scripts/character/shots.py validate)")

    # Resolve every segment first, so a missing approval stops before any encode.
    plan_segs = []
    for s in v["segments"]:
        t = str(s["type"]).upper()
        name = f"{int(s['n']):02d}-{t.lower()}"
        sl = s.get("script_lines") or []
        if isinstance(sl, str):
            sl = [x.strip() for x in sl.split(",") if x.strip()]
        sl = [x for x in sl if x in lines]
        item = {"seg": s, "type": t, "name": name, "lines": sl}
        if t in GENERATED:
            proj = s.get("project") or f"{video}.{name}"
            e, sd, pv, pseg = approved(proj)
            if not e:
                bad(f"{name}: {proj} has no approved file at gate B (review.py segment ... --decision approve)")
                continue
            f = e["file"]
            if t in PHONE:
                if not plan.get("app_insertion"):
                    bad(f"{name}: a phone segment in a plan without app insertion")
                    continue
                if not (e.get("composite") or {}).get("file"):
                    bad(f"{name}: no approved composite (composite.sh, then review.py composite)")
                    continue
                f = e["composite"]["file"]
                item["hero"] = e["composite"].get("hero")
            item["src"] = os.path.join(sd, f)
            shot_p = os.path.join(CH, pv, "shots", f"{pseg}.json")
            item["trim_to"] = ((load(shot_p).get("video") or {}).get("trim_to_seconds")
                               if os.path.exists(shot_p) else None)
        elif t in ("R", "P"):
            row, rec = screen_row(plan["app"], s.get("screen_id"))
            if not row or not rec or not os.path.exists(rec):
                bad(f"{name}: screen {s.get('screen_id')} is not in apps/{plan['app']}/screens/screens.json or not on disk")
                continue
            item["row"], item["rec"] = row, rec
        elif t == "C":
            fp, a_ = supplied(plan, video, s.get("asset_id"))
            if not fp:
                bad(f"{name}: {a_}")
                continue
            item["src"], item["asset"] = fp, a_
            if s.get("insert"):
                # A filmed phone: its plate went through the gates of its mode at P3 and P4.
                proj = s.get("project") or f"{video}.{name}"
                e, sd, _, _ = approved(proj)
                if not e or not (e.get("composite") or {}).get("file"):
                    bad(f"{name}: the filmed phone has no approved plate and composite (review.py segment, "
                        "composite.sh, review.py composite)")
                    continue
                item["composite"] = os.path.join(sd, e["composite"]["file"])
                item["hero"] = e["composite"].get("hero")
        elif t == "M":
            panels = []
            for p in s.get("panels") or []:
                q = {"id": p.get("id"), "asset_id": p.get("asset_id"),
                     "px": panel_px(p.get("rect") or [0, 0, 1, 1]), "sync": p.get("sync_offset_s"),
                     "crop": p.get("crop"), "audio": p.get("audio"), "kind": "clip"}
                if p.get("asset_id"):
                    fp, a_ = supplied(plan, video, p["asset_id"])
                    if not fp:
                        bad(f"{name}: panel {p.get('id')}: {a_}")
                        continue
                    q.update({"src": fp, "kind": "still" if a_["kind"] == "still" else "clip",
                              "range": p.get("source_range_s") or a_.get("trim_s") or [0.0, a_["_duration"] or 0]})
                    if a_["kind"] == "screen":
                        q["row"] = screen_row(plan["app"], a_.get("screen_id"))[0]
                elif p.get("project"):
                    e, sd, _, _ = approved(p["project"])
                    if not e:
                        bad(f"{name}: panel {p.get('id')}: {p['project']} has no approved file at gate B")
                        continue
                    f = os.path.join(sd, e["file"])
                    q.update({"src": f, "range": p.get("source_range_s") or [0.0, duration(f)]})
                elif p.get("screen_id"):
                    row, rec = screen_row(plan["app"], p["screen_id"])
                    if not row or not rec or not os.path.exists(rec):
                        bad(f"{name}: panel {p.get('id')}: screen {p['screen_id']} is not in the screen library")
                        continue
                    q.update({"src": rec, "row": row, "range": p.get("source_range_s") or [0.0, duration(rec)]})
                else:
                    bad(f"{name}: panel {p.get('id')} names no source")
                    continue
                panels.append(q)
            item["panels"] = panels
        else:
            bad(f"{name}: unknown type {t}")
            continue
        af = s.get("audio_from")
        item["work"] = work
        if af and bridge.audio_kind(af) == "asset":
            fp, a_ = supplied(plan, video, af[6:])
            if not fp:
                bad(f"{name}: audio_from {af}: {a_}")
                continue
            item["audio_src"] = fp
            item["audio_range"] = s.get("audio_range_s") or a_.get("trim_s") or [0.0, a_["_duration"] or duration(fp)]
        elif af and bridge.audio_kind(af) == "narration":
            fp, e = narration(video, af[10:])
            if not fp:
                bad(f"{name}: {e}")
                continue
            item["audio_src"] = fp
        elif af:
            e, sd, _, _ = approved(af)
            if not e:
                bad(f"{name}: audio_from {af} has no approved file at gate B")
                continue
            item["audio_src"] = os.path.join(sd, e["file"])
        if t == "P" and not item.get("audio_src"):
            bad(f"{name}: a P segment needs audio_from, the demo performance whose picture goes in the bubble")
            continue
        plan_segs.append(item)
    if PROBLEMS:
        sys.exit(f"\n{len(PROBLEMS)} problem(s); nothing was assembled")

    # Build each segment.
    parts, timeline, caps, t_final = [], [], [], 0.0
    for k, it in enumerate(plan_segs):
        s, t, name = it["seg"], it["type"], it["name"]
        out = os.path.join(work, f"seg-{k + 1:02d}-{name}.mp4")
        entry = {"n": s["n"], "type": t, "name": name}
        words_src, words_off, heard = None, 0.0, []
        if t in GENERATED or it.get("composite"):
            src = it.get("composite") or it["src"]
            if s.get("trim") and not it.get("composite"):
                win = [float(s["trim"][0]), float(s["trim"][1])]
                how = "the trim in video.json"
            elif it["lines"] and has_audio(src) and not it.get("audio_src"):
                win, heard = word_window(src, work)
                how = "word times"
                if win is None:
                    win, how = [0.0, duration(src)], "no words heard: whole file"
            elif isinstance(it.get("trim_to"), (int, float)):
                win, how = [0.0, float(it["trim_to"])], "trim_to_seconds"
            else:
                win, how = [0.0, duration(src)], "whole file"
            dur = win[1] - win[0]
            if it.get("audio_src"):
                aw, aheard = audio_window(it, work)
                if t == "B":
                    fits(name, aw, dur)
                ain = ["-ss", f"{aw[0]:.3f}", "-to", f"{aw[1]:.3f}", "-i", it["audio_src"]]
                words_src, words_off, heard = it["audio_src"], aw[0], aheard
            elif t == "X":
                ain = None              # a silent reaction: no voice; the room tone runs under it
            elif has_audio(src):
                ain = ["-ss", f"{win[0]:.3f}", "-to", f"{win[1]:.3f}", "-i", src]
                words_src, words_off = src, win[0]
                if not heard and it["lines"]:
                    heard = heard_words(src, work)
            else:
                ain = None
            encode_segment(out, ["-ss", f"{win[0]:.3f}", "-to", f"{win[1]:.3f}", "-i", src],
                           vf_generated(s.get("punch_in")), ain, audio_chain(dur, fade), dur)
            entry.update({"src": os.path.relpath(src, ROOT), "in": round(win[0], 3), "out": round(win[1], 3),
                          "trim_by": how, "punch_in": s.get("punch_in"),
                          "composite": bool(it.get("composite")) or None,
                          "asset_id": (it.get("asset") or {}).get("id")})
            if it.get("hero") and (t in PHONE or it.get("composite")):
                h = it["hero"]
                if win[0] <= h["t"] <= win[1]:
                    entry["hero"] = {"t": round(t_final + h["t"] - win[0], 3), "rect": h["rect"], "text": h.get("text")}
            print(f"  {name}: {os.path.basename(src)} {win[0]:.2f}-{win[1]:.2f}s ({how})"
                  + (f", punch-in {s['punch_in']}" if s.get("punch_in") else ""))
        elif t == "C":
            a_ = it["asset"]
            r = s.get("source_range_s") or a_.get("trim_s") or [0.0, a_.get("_duration") or 0]
            dur = float(s["still_s"]) if a_["kind"] == "still" else float(r[1] - r[0])
            if it.get("audio_src"):
                aw, heard = audio_window(it, work)
                fits(name, aw, dur)
                ain = ["-ss", f"{aw[0]:.3f}", "-to", f"{aw[1]:.3f}", "-i", it["audio_src"]]
                words_src, words_off = it["audio_src"], aw[0]
                how = "with " + s["audio_from"]
            elif a_["kind"] != "still" and s.get("audio") != "mute" and has_audio(it["src"]):
                ain = ["-ss", f"{r[0]:.3f}", "-to", f"{r[1]:.3f}", "-i", it["src"]]
                words_src, words_off = it["src"], r[0]
                how = "its own sound"
            else:
                ain, how = None, "no sound"
            build_c(it, out, dur, ain, fade)
            entry.update({"src": os.path.relpath(it["src"], ROOT), "asset_id": a_["id"],
                          "in": round(r[0], 3) if a_["kind"] != "still" else 0.0,
                          "out": round(r[1], 3) if a_["kind"] != "still" else round(dur, 3), "fit": s.get("fit") or "cover"})
            print(f"  {name}: supplied {a_['id']} ({a_['kind']}) {dur:.2f}s, {how}")
        elif t == "M":
            ps = it["panels"]
            dur = float(s.get("duration_s") or max(p["range"][1] - p["range"][0] + float(p.get("sync") or 0) for p in ps))
            audio = None
            if it.get("audio_src"):
                aw, heard = audio_window(it, work)
                fits(name, aw, dur)
                audio = (it["audio_src"], aw[0], aw[1])
                words_src, words_off = it["audio_src"], aw[0]
            build_m(it, out, dur, audio, fade)
            entry.update({"panels": [{"id": p["id"], "asset_id": p.get("asset_id"),
                                      "src": os.path.relpath(p["src"], ROOT), "range": p["range"],
                                      "rect_px": list(p["px"]), "sync_offset_s": float(p.get("sync") or 0)}
                                     for p in ps]})
            for p in ps:
                h = panel_hero(p, p.get("row"), t_final) if p.get("row") else None
                if h:
                    entry["hero"] = h
                    break
            print(f"  {name}: {len(ps)} panels ({', '.join(str(p['id']) for p in ps)}), {dur:.2f}s")
        else:
            row, rec = it["row"], it["rec"]
            audio = None
            if it.get("audio_src"):
                aw, heard = audio_window(it, work)
                if t == "P":
                    aw = [0.0, duration(it["audio_src"])]       # lips in the bubble: never trimmed
                audio = (it["audio_src"], aw[0], aw[1])
                dur = aw[1] - aw[0]
                words_src, words_off = it["audio_src"], aw[0]
            else:
                dur = float(s["trim"][1] - s["trim"][0]) if s.get("trim") else duration(rec)
            bubble = (it["audio_src"], 0.0) if t == "P" else None
            geo, zmax = build_r(s, row, rec, out, dur, audio, fade, bubble)
            hero = row.get("hero") or {}
            entry.update({"src": os.path.relpath(rec, ROOT), "in": 0.0, "out": round(dur, 3),
                          "crop": list(geo[:4]), "punch_in_to_hero": zmax})
            if hero.get("rect_source_px") and any(hero["rect_source_px"]):
                zt = max(0.0, dur - 0.3)
                z = min(1 + (zmax - 1) * zt / dur, zmax)
                entry["hero"] = {"t": round(t_final + zt, 3), "rect": r_final_rect(geo, hero["rect_source_px"], z),
                                 "text": hero.get("text")}
            print(f"  {name}: {os.path.basename(rec)} 9:16 around the hero, punch-in to {zmax}, {dur:.2f}s"
                  + (", her demo performance in the bubble" if t == "P" else ""))
        d = duration(out)
        entry.update({"final_start": round(t_final, 3), "final_end": round(t_final + d, 3)})
        # The captions of this segment: the frozen script's words, timed by the words heard.
        if captions_on and it["lines"] and words_src:
            sw = " ".join(lines[l]["line"] for l in it["lines"]).split()
            heard = heard or heard_words(words_src, work)
            times, frac = align(sw, heard)
            if times is None:
                print(f"    ! no words heard in {os.path.basename(words_src)}: no captions for {name}")
            else:
                if frac < 0.6:
                    print(f"    ! only {frac:.0%} of the script's words were heard in {name}: check the mouth gate")
                for text, a0, a1 in chunks(sw, times):
                    s0 = t_final + a0 - words_off
                    s1 = t_final + a1 - words_off
                    if s1 <= t_final or s0 >= t_final + d:
                        continue
                    caps.append({"text": text, "start": round(max(t_final, s0), 3),
                                 "end": round(min(t_final + d, s1), 3), "segment": name})
                entry["script_words_heard"] = round(frac, 2)
        timeline.append(entry)
        parts.append(out)
        t_final += d

    # Caption timing: each caption runs to the next one when the gap is short.
    for i, c in enumerate(caps):
        nxt = caps[i + 1]["start"] if i + 1 < len(caps) else None
        seg_end = next(e["final_end"] for e in timeline if e["name"] == c["segment"])
        end = c["end"] + 0.3
        if nxt is not None and nxt - c["end"] < 0.6:
            end = nxt
        c["end"] = round(min(end, seg_end, nxt if nxt is not None else end), 3)

    # Join: hard cuts.
    lst = os.path.join(work, "concat.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    joined = os.path.join(work, "joined.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", joined])

    # Room tone under everything.
    snd = v.get("sound") or {}
    rt = snd.get("room_tone") or ((v.get("voiceover") or {}).get("room_tone") or {}).get("file")
    level = ((v.get("voiceover") or {}).get("room_tone") or {}).get("level_db", -45)
    rt_path = None
    if rt and "<" not in rt:
        hd = os.path.join(ROOT, "apps", plan["app"], "handles", plan["handle"].lstrip("@"))
        for c in (os.path.join(hd, rt), os.path.join(ROOT, rt)):
            if os.path.exists(c):
                rt_path = c
                break
        if not rt_path:
            print(f"  ! the room tone {rt} is not on disk: assembled without it")

    # Captions and the title overlay, drawn by captions.mjs.
    items, overlays = [], []
    heroes = [e["hero"] for e in timeline if e.get("hero")]
    for i, c in enumerate(caps):
        top = any(c["start"] < e["final_end"] and c["end"] > e["final_start"] and e.get("hero")
                  and e["hero"]["rect"][1] + e["hero"]["rect"][3] > CAP_BAND[0] * H
                  and e["hero"]["rect"][1] < CAP_BAND[1] * H for e in timeline)
        c["position"] = "top" if top else "bottom"
        p = os.path.join(work, f"cap-{i:03d}.png")
        items.append({"lines": wrap(c["text"]), "out": p, "y": 0.14 if top else 0.78,
                      "anchor": "top" if top else "bottom", "size": 0.056})
        overlays.append((p, c["start"], c["end"]))
    # The overlays: the plan's (v2, copied into video.json), or the legacy title as one
    # hook overlay. Each at its exact time, in the style of its role.
    ovs = list(v.get("overlays") or [])
    title = v.get("title_overlay") or {}
    if not ovs and title.get("burn") is True and title.get("text") and "<" not in str(title["text"]):
        ovs = [{"id": "title", "role": "hook", "text": title["text"], "start_s": 0.0,
                "end_s": float(title.get("until_s") or t_final), "placement": "top", "panel_id": None}]
    panel_rects = {p["id"]: p["rect_px"] for e in timeline for p in e.get("panels") or []}
    drawn = []
    for i, o in enumerate(ovs):
        size, per = OVERLAY_STYLE.get(o.get("role"), (0.05, 24))
        pl = o.get("placement") or "top"
        if pl == "panel" and o.get("panel_id") in panel_rects:
            x, y, w, h = panel_rects[o["panel_id"]]
            xs, anchor, ys = (x + w / 2) / W, "middle", (y + 0.015 * H) / H
            per = max(6, int(w / (size * W * 0.6)))
        else:
            xs, anchor, ys = PLACE.get(pl, PLACE["top"])
        p = os.path.join(work, f"overlay-{i:02d}.png")
        items.append({"lines": wrap(o["text"], per), "out": p, "y": ys, "anchor": "top", "size": size,
                      "x": xs, "align": anchor})
        drawn.append({"id": o.get("id"), "role": o.get("role"), "text": o.get("text"), "placement": pl,
                      "start": round(float(o["start_s"]), 3), "end": round(min(float(o["end_s"]), t_final), 3),
                      "planned_end": float(o["end_s"]), "png": p})
    if items:
        if not shutil.which("node"):
            sys.exit("node is not installed: the captions are drawn by scripts/character/captions.mjs")
        jp = os.path.join(work, "captions-job.json")
        json.dump({"width": W, "height": H, "items": items}, open(jp, "w"))
        r = subprocess.run(["node", os.path.join(HERE, "captions.mjs"), jp], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(r.stderr.strip() or "captions.mjs failed")

    for c, it in zip(caps, items):
        c["bbox"] = alpha_bbox(it["out"])
    for d in drawn:
        d["bbox"] = alpha_bbox(d["png"])

    # The edit: captions and overlays burned, the room tone mixed. Each layer is one
    # stream: its pictures in order, each held for its time, with a transparent picture in
    # the gaps. The captions are one layer; overlays that run at the same time (a day
    # counter under a hook) go on separate layers.
    edit = os.path.join(work, "edit.mp4")
    layers = [sorted(overlays, key=lambda o: o[1])] if overlays else []
    olayers = []
    for d in sorted(drawn, key=lambda d: d["start"]):
        o = (d["png"], d["start"], d["end"])
        for L in olayers:
            if L[-1][2] <= o[1] + 1e-3:
                L.append(o)
                break
        else:
            olayers.append([o])
    layers += olayers
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", joined]
    if layers:
        import cv2, numpy as np
        blank = os.path.join(work, "blank.png")
        cv2.imwrite(blank, np.zeros((H, W, 4), np.uint8))
        for n, layer in enumerate(layers):
            lines_, t = [], 0.0
            for p, s0, s1 in layer:
                if s0 > t + 0.001:
                    lines_ += [f"file '{blank}'", f"duration {s0 - t:.3f}"]
                lines_ += [f"file '{p}'", f"duration {max(0.034, s1 - max(s0, t)):.3f}"]
                t = max(t, s1)
            lines_ += [f"file '{blank}'", f"duration {max(0.04, t_final - t + 0.1):.3f}", f"file '{blank}'"]
            lp = os.path.join(work, f"layer-{n}.txt")
            open(lp, "w").write("\n".join(lines_) + "\n")
            # Encoded to its own file first: read as a concat input beside the edit, the
            # layer stopped part way through.
            lv = os.path.join(work, f"layer-{n}.mov")
            run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lp,
                 "-vf", f"fps={FPS},format=argb", "-c:v", "qtrle", lv])
            cmd += ["-i", lv]
    fc, last = [], "[0:v]"
    for n in range(len(layers)):
        fc.append(f"{last}[{n + 1}:v]overlay=0:0:eof_action=pass[o{n}]")
        last = f"[o{n}]"
    amap = "0:a"
    if rt_path:
        cmd += ["-stream_loop", "-1", "-i", rt_path]
        ri = len(layers) + 1
        fc.append(f"[{ri}:a]volume={level}dB,aresample=48000,aformat=channel_layouts=stereo[rt];"
                  f"[0:a][rt]amix=inputs=2:duration=first:normalize=0[a]")
        amap = "[a]"
    if fc:
        cmd += ["-filter_complex", ";".join(fc), "-map", last if layers else "0:v", "-map", amap]
    else:
        cmd += ["-map", "0:v", "-map", "0:a"]
    cmd += ["-t", f"{t_final:.3f}", "-c:v", "libx264", "-crf", "14", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", edit]
    run(cmd)

    # The export pass: one phone-like intermediate encode, then the final encode.
    exp = v.get("export") or {}
    phone = os.path.join(work, "phone-pass.mp4")
    run(["ffmpeg", "-y", "-v", "error", "-i", edit, "-c:v", "libx264", "-preset", "medium", "-b:v", "8M",
         "-maxrate", "10M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", phone]
        if exp.get("intermediate_encode", True) else ["cp", edit, phone])
    adir = os.path.join(vd, "assembly")
    final = os.path.join(adir, f"{video}.mp4")
    base = ["ffmpeg", "-y", "-v", "error", "-i", phone]
    tail = ["-r", str(FPS), "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
    run(base + ["-vf", f"scale={W}:{H}:flags=lanczos,setsar=1"] + tail + [final])
    outputs = {"default": final}
    if grain or exp.get("film_grain") is True:
        gfile = os.path.join(adir, f"{video}-grain.mp4")
        run(base + ["-vf", f"scale={W}:{H}:flags=lanczos,setsar=1,noise=alls=7:allf=t"] + tail + [gfile])
        outputs["grain"] = gfile
    print(f"export: {os.path.relpath(final, ROOT)}" + (f" and {os.path.basename(outputs['grain'])}" if "grain" in outputs else ""))

    checks = final_checks(outputs, timeline, work, video, plan=plan, v=v, drawn=drawn, caps=caps)
    sheet = os.path.join(adir, "contact-sheet.png")
    n = max(1, min(30, int(t_final)))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", final, "-vf",
                    f"fps={n / max(t_final, 0.1):.4f},scale=216:384,tile=6x{(n + 5) // 6}:padding=6:color=white",
                    "-frames:v", "1", sheet])
    man = {"video_id": video, "file": os.path.relpath(final, ROOT),
           "grain_file": os.path.relpath(outputs["grain"], ROOT) if "grain" in outputs else None,
           "duration_s": round(duration(final), 3), "segments": timeline, "captions": caps,
           "overlays": [{k: d[k] for k in ("id", "role", "text", "placement", "start", "end", "bbox")} for d in drawn],
           "plan_revision": plan.get("revision"),
           "plan_sha256": bridge.digest(plan) if bridge.is_v2(plan) else None,
           "room_tone": os.path.relpath(rt_path, ROOT) if rt_path else None, "checks": checks}
    json.dump(man, open(os.path.join(adir, "assembly.json"), "w"), indent=2)
    print(f"contact sheet: {os.path.relpath(sheet, ROOT)}   manifest: assembly/assembly.json")
    failed = [k for k, c in checks.items() if c.get("result") == "FAIL"]
    subprocess.run([sys.executable, os.path.join(HERE, "state.py"), "set", video, "assemble",
                    "done" if not failed else "failed"] + ([f"checks failed: {', '.join(failed)}"] if failed else []),
                   capture_output=True)
    sys.exit(1 if failed else 0)


def final_checks(outputs, timeline, work, video, plan=None, v=None, drawn=(), caps=()):
    """After the pass, on the final file (§ 13, step 8)."""
    import cv2, numpy as np
    out = {}
    print("\nfinal checks")

    def rep(name, ok, detail):
        tag = "NOT RUN" if ok is None else ("PASS" if ok else "FAIL")
        out[name] = {"result": tag, "detail": detail}
        print(f"  {tag:<7}  {name}  ({detail})")

    overlay_checks(rep, out, outputs["default"], timeline, work, plan or {}, v or {}, list(drawn), list(caps))

    f = outputs["default"]
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate,codec_name", "-of", "csv=p=0", f],
                       capture_output=True, text=True).stdout.strip()
    cw, chh, rate = r.split(",")[1], r.split(",")[2], r.split(",")[3]
    rep("1080x1920, 30 fps, H.264", (cw, chh, rate) == ("1080", "1920", "30/1") and r.startswith("h264"), r)
    rep("sound track", has_audio(f), "present" if has_audio(f) else "missing")
    lr = subprocess.run(["ffmpeg", "-nostats", "-i", f, "-af", "ebur128", "-f", "null", "-"],
                        capture_output=True, text=True).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", lr)
    if m:
        lufs = float(m[-1])
        # A video of silent reactions and real screens only carries the room tone: nothing
        # to level. Every other segment, a line or a laid voice makes sound to measure.
        segs = (v or {}).get("segments") or []
        sounded = any(str(x.get("type", "")).upper() not in ("X", "R", "P") or x.get("script_lines")
                      or x.get("audio_from") for x in segs)
        if not sounded and lufs < -40:
            rep("loudness", None, f"{lufs} LUFS: no voice or sound in the plan, the room tone only "
                                  "(the music is added at posting)")
        else:
            rep("loudness", -19 <= lufs <= -13, f"{lufs} LUFS integrated; the segments are levelled to -16")
    import ocr
    heroes = [e for e in timeline if e.get("hero")]
    if heroes:
        for name, path in outputs.items():
            for e in heroes:
                h = e["hero"]
                png = os.path.join(work, f"final-hero-{e['name']}-{name}.png")
                cap = cv2.VideoCapture(path)
                cap.set(cv2.CAP_PROP_POS_MSEC, h["t"] * 1000)
                ok, fr = cap.read()
                cap.release()
                if not ok:
                    rep(f"OCR {e['name']} ({name})", False, "the frame could not be read")
                    continue
                x, y, w, hh = h["rect"]
                mx, my = int(0.15 * w), int(0.15 * hh)
                crop = fr[max(0, y - my):y + hh + my, max(0, x - mx):x + w + mx]
                if crop.size == 0:
                    rep(f"OCR {e['name']} ({name})", False, f"the hero rect {h['rect']} is outside the frame")
                    continue
                cv2.imwrite(png, cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
                got = ocr.read([png])
                if got is None:
                    rep(f"OCR {e['name']} ({name})", None, "no OCR engine (brew install tesseract, or macOS with swift)")
                    continue
                okm, score = ocr.matches(h.get("text") or "", got[png])
                rep(f"OCR {e['name']} ({name})", okm, f"'{h.get('text')}' at {h['t']:.2f}s, similarity {score}")
    else:
        out["OCR"] = {"result": "n/a", "detail": "no hero element in this video"}
        print("  n/a      OCR  (no hero element in this video)")
    # No green left in the phone segments: a pixel inside the tracked screen that is
    # strict green in the plate and still the plate's own colour (the composite gate,
    # again on the final file).
    import screen_track as st
    import screen_gates as sg
    phone = [e for e in timeline if e["type"] in PHONE or e.get("composite")]
    for e in phone:
        comp = os.path.join(ROOT, e["src"])
        tp = sg.track_path(os.path.dirname(os.path.dirname(comp)), comp)
        if not os.path.exists(tp):
            rep(f"no green left {e['name']}", None, "the composite's track is missing")
            continue
        tr = st.load_track(tp)
        pc = cv2.VideoCapture(tr.get("plate") or "")
        cap = cv2.VideoCapture(f)
        lo, hi = st.key_range({})
        worst = 0
        for tt in np.arange(e["final_start"] + 0.1, e["final_end"] - 0.05, 0.25):
            fi = int(round((tt - e["final_start"] + e["in"]) * tr["fps"]))
            if fi not in tr["quads"]:
                continue
            cap.set(cv2.CAP_PROP_POS_MSEC, tt * 1000)
            pc.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ok1, fr = cap.read()
            ok2, pf = pc.read()
            if not (ok1 and ok2):
                continue
            q = tr["quads"][fi]
            m = np.zeros(fr.shape[:2], np.uint8)
            cv2.fillConvexPoly(m, q.astype(np.int32), 1)
            m = cv2.dilate(m, np.ones((15, 15), np.uint8)) > 0
            same = np.abs(fr.astype(np.int16) - pf.astype(np.int16)).sum(2) < 60
            left = (st.strict_mask(fr, lo, hi) > 0) & (st.strict_mask(pf, lo, hi) > 0) & same & m
            worst = max(worst, int(left.sum()))
        cap.release()
        pc.release()
        rep(f"no green left {e['name']}", worst == 0, f"at most {worst} pixel(s) of the plate's green in a sampled frame")
    return out


def overlay_checks(rep, out, final, timeline, work, plan, v, drawn, caps):
    """Gate C's overlay checks: as planned, long enough to read, clear of the hero
    elements, the captions and each other, read back from the final file; and the supplied
    files unchanged since the plan was locked."""
    import cv2
    keys = ("id", "role", "text", "start_s", "end_s", "placement", "panel_id")
    if bridge.is_v2(plan):
        want = [{k: o.get(k) for k in keys} for o in plan.get("overlays") or []]
        got = [{k: o.get(k) for k in keys} for o in v.get("overlays") or []]
        drawn_ok = [(d["id"], d["text"], d["start"]) for d in drawn] == \
                   [(o["id"], o["text"], round(float(o["start_s"]), 3)) for o in want]
        rep("overlays as planned", want == got and drawn_ok,
            f"{len(drawn)} drawn, {len(want)} in the plan" + ("" if want == got else "; video.json differs from the plan"))
    if not drawn:
        out.setdefault("overlays", {"result": "n/a", "detail": "no overlay in this video"})
        return
    short = [d["id"] for d in drawn if d["end"] - d["start"] < max(bridge.MIN_OVERLAY_S,
                                                                    bridge.words(d["text"]) / bridge.READ_WORDS_PER_S) - 1e-3
             or d["planned_end"] > d["end"] + 0.05]
    rep("overlays readable", not short, "every overlay up for its reading time" if not short else
        f"too short or cut by the end of the file: {', '.join(map(str, short))}")
    hits = []
    for d in drawn:
        for e in timeline:
            h = e.get("hero")
            if h and d["start"] <= h["t"] <= d["end"] and boxes_meet(d["bbox"], h["rect"]):
                hits.append(f"{d['id']} on the hero of {e['name']}")
        for c in caps:
            if c["start"] < d["end"] and c["end"] > d["start"] and boxes_meet(d["bbox"], c.get("bbox")):
                hits.append(f"{d['id']} on the caption at {c['start']:.2f}s")
                break
        for o in drawn:
            if o is not d and o["start"] < d["end"] and o["end"] > d["start"] and boxes_meet(d["bbox"], o["bbox"]) \
                    and str(o["id"]) > str(d["id"]):
                hits.append(f"{d['id']} on {o['id']}")
    rep("overlays clear of heroes, captions and each other", not hits, "; ".join(hits[:6]) or "no overlap")
    import ocr
    pngs, want = [], {}
    cap = cv2.VideoCapture(final)
    for d in drawn:
        if not d["bbox"]:
            continue
        cap.set(cv2.CAP_PROP_POS_MSEC, (d["start"] + d["end"]) / 2 * 1000)
        ok, fr = cap.read()
        if not ok:
            continue
        x, y, w, hh = d["bbox"]
        crop = fr[max(0, y - 12):y + hh + 12, max(0, x - 12):x + w + 12]
        p = os.path.join(work, f"final-overlay-{d['id']}.png")
        cv2.imwrite(p, cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC))
        pngs.append(p)
        want[p] = d
    cap.release()
    got = ocr.read(pngs) if pngs else {}
    if got is None:
        rep("overlays read back (OCR)", None, "no OCR engine (brew install tesseract, or macOS with swift)")
    else:
        miss = []
        for p, d in want.items():
            okm, score = ocr.matches(d["text"], got.get(p, ""), ratio=0.85)
            if not okm:
                miss.append(f"{d['id']} ({score})")
        rep("overlays read back (OCR)", not miss, "every overlay read on the final file" if not miss
            else "not read: " + ", ".join(miss))
    used = {e.get("asset_id") for e in timeline if e.get("asset_id")} | \
        {p.get("asset_id") for e in timeline for p in e.get("panels") or [] if p.get("asset_id")}
    if used and bridge.is_v2(plan):
        assets = {a["id"]: a for a in plan.get("assets") or []}
        changed = [a for a in used if bridge.sha256_file(os.path.join(ROOT, assets[a]["path"])) != assets[a]["sha256"]]
        rep("supplied files unchanged", not changed, ", ".join(changed) or f"{len(used)} file(s) match the plan's sha256")


if __name__ == "__main__":
    main()
