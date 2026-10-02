#!/usr/bin/env python3
"""P5: one finished file from video.json. Local ffmpeg, free. Run it through assemble.sh.

    assemble.py <video> [--grain] [--no-captions]

For every segment of pipeline/character/<video>/video.json, in order:
  generated (T, O, G, S, H, F)  the file approved at gate B (approval.json); for a phone
                                segment, its approved composite (P4)
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
"punch_in": 1.10; "audio_from": "<video>.<seg>" (the demo performance under R, P, H or
F); for R and P "screen_id", "punch_in_to_hero".
"""
import difflib, glob, hashlib, json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
CH = os.path.join(ROOT, "pipeline", "character")
W, H, FPS = 1080, 1920, 30
GENERATED = ("T", "O", "G", "S", "H", "F")
PHONE = ("O", "G", "S", "H", "F")
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
    return f"{LOUD},aresample=48000,afade=t=in:st=0:d={f},afade=t=out:st={max(0, dur - f):.3f}:d={f}"


def encode_segment(out, vin, vf, ain, af, dur, extra_inputs=(), fc=None):
    """One normalised segment: 1080x1920, 30 fps, yuv420p, AAC 48 kHz stereo."""
    cmd = ["ffmpeg", "-y", "-v", "error"] + vin
    if ain is None:
        cmd += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
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
    rlen = duration(rec)
    pad = max(0.0, dur - rlen + 0.1)
    vf = (f"[0:v]fps={FPS},tpad=stop_mode=clone:stop_duration={pad:.3f},crop={cw}:{ch}:{x}:{y},"
          f"zoompan=z='min(1+{zmax - 1:.4f}*on/{n},{zmax})':d=1:fps={FPS}:s={W}x{H}"
          f":x='max(0,min(iw-iw/zoom,{hx:.1f}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,{hy:.1f}-ih/zoom/2))',"
          f"gblur=sigma=0.3,setsar=1,format=yuv420p")
    ain = ["-i", audio[0]] + [] if audio else None
    if audio:
        ain = ["-ss", f"{audio[1]:.3f}", "-to", f"{audio[2]:.3f}", "-i", audio[0]]
    af = audio_chain(dur, fade)
    if bubble is None:
        fc = vf + "[v];" + f"[1:a]{af},aformat=channel_layouts=stereo[a]"
        encode_segment(out, ["-i", rec], None, ain, None, dur, fc=fc)
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
        encode_segment(out, ["-i", rec], None, ain, None, dur,
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
        else:
            bad(f"{name}: unknown type {t}")
            continue
        if s.get("audio_from"):
            e, sd, _, _ = approved(s["audio_from"])
            if not e:
                bad(f"{name}: audio_from {s['audio_from']} has no approved file at gate B")
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
        if t in GENERATED:
            src = it["src"]
            if s.get("trim"):
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
                aw, aheard = word_window(it["audio_src"], work)
                aw = aw or [0.0, duration(it["audio_src"])]
                ain = ["-ss", f"{aw[0]:.3f}", "-to", f"{aw[1]:.3f}", "-i", it["audio_src"]]
                words_src, words_off, heard = it["audio_src"], aw[0], aheard
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
                          "trim_by": how, "punch_in": s.get("punch_in")})
            if it.get("hero") and t in PHONE:
                h = it["hero"]
                if win[0] <= h["t"] <= win[1]:
                    entry["hero"] = {"t": round(t_final + h["t"] - win[0], 3), "rect": h["rect"], "text": h.get("text")}
            print(f"  {name}: {os.path.basename(src)} {win[0]:.2f}-{win[1]:.2f}s ({how})"
                  + (f", punch-in {s['punch_in']}" if s.get("punch_in") else ""))
        else:
            row, rec = it["row"], it["rec"]
            audio = None
            if it.get("audio_src"):
                aw, heard = word_window(it["audio_src"], work)
                aw = aw or [0.0, duration(it["audio_src"])]
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
    title = v.get("title_overlay") or {}
    if title.get("burn") is True and title.get("text") and "<" not in str(title["text"]):
        p = os.path.join(work, "title.png")
        items.append({"lines": wrap(title["text"], 22), "out": p, "y": 0.08, "anchor": "top", "size": 0.074})
        overlays.append((p, 0.0, float(title.get("until_s") or t_final)))
    if items:
        if not shutil.which("node"):
            sys.exit("node is not installed: the captions are drawn by scripts/character/captions.mjs")
        jp = os.path.join(work, "captions-job.json")
        json.dump({"width": W, "height": H, "items": items}, open(jp, "w"))
        r = subprocess.run(["node", os.path.join(HERE, "captions.mjs"), jp], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit(r.stderr.strip() or "captions.mjs failed")

    # The edit: captions burned, the room tone mixed. Each overlay layer (the captions,
    # the title) is one stream: its pictures in order, each held for its time, with a
    # transparent picture in the gaps.
    edit = os.path.join(work, "edit.mp4")
    layers = [[o for o in overlays if not o[0].endswith("title.png")],
              [o for o in overlays if o[0].endswith("title.png")]]
    layers = [sorted(l, key=lambda o: o[1]) for l in layers if l]
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

    checks = final_checks(outputs, timeline, work, video)
    sheet = os.path.join(adir, "contact-sheet.png")
    n = max(1, min(30, int(t_final)))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", final, "-vf",
                    f"fps={n / max(t_final, 0.1):.4f},scale=216:384,tile=6x{(n + 5) // 6}:padding=6:color=white",
                    "-frames:v", "1", sheet])
    man = {"video_id": video, "file": os.path.relpath(final, ROOT),
           "grain_file": os.path.relpath(outputs["grain"], ROOT) if "grain" in outputs else None,
           "duration_s": round(duration(final), 3), "segments": timeline, "captions": caps,
           "room_tone": os.path.relpath(rt_path, ROOT) if rt_path else None, "checks": checks}
    json.dump(man, open(os.path.join(adir, "assembly.json"), "w"), indent=2)
    print(f"contact sheet: {os.path.relpath(sheet, ROOT)}   manifest: assembly/assembly.json")
    failed = [k for k, c in checks.items() if c.get("result") == "FAIL"]
    subprocess.run([sys.executable, os.path.join(HERE, "state.py"), "set", video, "assemble",
                    "done" if not failed else "failed"] + ([f"checks failed: {', '.join(failed)}"] if failed else []),
                   capture_output=True)
    sys.exit(1 if failed else 0)


def final_checks(outputs, timeline, work, video):
    """After the pass, on the final file (§ 13, step 8)."""
    import cv2, numpy as np
    out = {}
    print("\nfinal checks")

    def rep(name, ok, detail):
        tag = "NOT RUN" if ok is None else ("PASS" if ok else "FAIL")
        out[name] = {"result": tag, "detail": detail}
        print(f"  {tag:<7}  {name}  ({detail})")

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
    phone = [e for e in timeline if e["type"] in PHONE]
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


if __name__ == "__main__":
    main()
