#!/usr/bin/env python3
"""The reaction library: real reaction ranges of real posts, for a reaction hook's reference.
Free, local: ffmpeg, the OCR of scripts/character/ocr.py, no network, no generation.

    reactions.py scan <slug> [--sheets] [--json]   candidate posts in the workspace's research and
                                                   niche batches that are not in the library yet:
                                                   notes that describe a reaction; with --sheets,
                                                   also the videos with no notes (look at their
                                                   contact sheets)
    reactions.py add <post_dir> <start_s> <end_s> [--tags a,b] [--note "..."] [--by agent|you]
                                                   one entry, status proposed (by you: kept)
    reactions.py describe <id> --json '<object>'   what an agent saw in the frames: expression_beats,
                     | --file <x.json>             framing, speech, burned_in_text, hook_text, tags,
                                                   note, start_s, end_s; never a field the user set
    reactions.py fill <id>|--all [--no-ocr]        sha256, length, the preview sheet, the OCR of the
                                                   burned-in text (when none is written), the fit
    reactions.py check                             every entry against its file and the tag list
    reactions.py list [--tag t] [--job j] [--fit face_replace|written] [--max-s n]
                      [--status s] [--json]        the entries, best first

The library is library/reactions/reactions.json at the workspace root, with the previews in
library/reactions/previews/. An entry points to the post's video in place (research/ or
apps/<slug>/niche/batches/); the video is never copied, moved or written. The shape is
docs/character/reaction.example.json; the tags are docs/character/reaction-tags.json. An agent
writes `proposed` entries; only the user sets `kept` (the Atlas Reactions page), and an agent
never changes a field listed in `set_by_you`.
"""
import argparse, datetime, hashlib, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.environ.get("UGCKIT_ROOT") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIB_DIR = os.path.join(ROOT, "library", "reactions")
LIB = os.path.join(LIB_DIR, "reactions.json")
PREVIEWS = os.path.join(LIB_DIR, "previews")
TAGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                         "docs", "character", "reaction-tags.json")
if not os.path.exists(TAGS_FILE):
    TAGS_FILE = os.path.join(ROOT, "docs", "character", "reaction-tags.json")

RX_WORDS = re.compile(r"react|shock|surpris|disbelief|gasp|amaz|stunned|jaw|hand to (?:her |his )?(?:mouth|face)", re.I)
HOOK_TIME = re.compile(r"hook[^()\n]{0,20}\((\d+(?::\d+)?)\s*[-–]\s*(\d+(?::\d+)?)\s*s?", re.I)
VIDEO_EXT = (".mp4", ".mov", ".webm")
STATUSES = ("proposed", "kept", "retired")
SPEECH = ("none", "mouths words", "speaks")
DESCRIBE_KEYS = ("expression_beats", "framing", "speech", "burned_in_text", "hook_text", "tags", "note",
                 "start_s", "end_s")
BEAT_KEYS = ("start_s", "end_s", "face", "eyes", "head")
FRAMING_KEYS = ("framing", "camera_distance", "camera", "people", "room", "cuts", "face_hidden_s")
FR_MAX_S, FR_MIN_S, HIDDEN_MAX_S = 30.0, 1.0, 0.3


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def tag_file():
    with open(TAGS_FILE) as f:
        return json.load(f)


def load_lib():
    if not os.path.exists(LIB):
        return {"version": 1, "entries": {}}
    with open(LIB) as f:
        lib = json.load(f)
    lib.setdefault("entries", {})
    return lib


def save_lib(lib):
    """Write the library atomically. The file is read again just before, by the caller, so a
    field the user set in the Atlas in the meantime is not lost."""
    os.makedirs(LIB_DIR, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=LIB_DIR, prefix=".tmp-")
    with os.fdopen(fd, "w") as f:
        json.dump(lib, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, LIB)


def rel(p):
    return os.path.relpath(os.path.abspath(p), ROOT)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def duration(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def entry_id(platform, post_id, start_s):
    return f"rx-{platform}-{post_id}-{int(round(start_s * 10))}"


def served(post_dir):
    """A library entry points only into the workspace's research or an app's niche batches:
    the two places the Atlas serves a post's video from."""
    r = post_dir.replace(os.sep, "/")
    return r.startswith("research/") or re.match(r"^apps/[^/]+/niche/batches/", r) is not None


# ------------------------------------------------------------------------------ the source
def source_of(post_dir):
    """platform, post id, handle, url, views and date of a downloaded post folder:
    <...>/<handle>/<post id>/ with notes.md (research) or post.json (a niche batch)."""
    d = os.path.join(ROOT, post_dir)
    vids = sorted(f for f in os.listdir(d) if f.lower().endswith(VIDEO_EXT))
    if not vids:
        sys.exit(f"{post_dir}: no video in the folder; fetch the post first")
    post_id = os.path.basename(post_dir.rstrip("/"))
    handle = os.path.basename(os.path.dirname(post_dir.rstrip("/")))
    platform = "instagram" if "/instagram/" in f"/{post_dir}/" else "tiktok"
    src = {"platform": platform, "post_id": post_id, "handle": "@" + handle.lstrip("@"), "url": None,
           "post_dir": post_dir.rstrip("/"), "video": f"{post_dir.rstrip('/')}/{vids[0]}", "video_sha256": None,
           "notes": None, "views": None, "date": None}
    notes = os.path.join(d, "notes.md")
    if os.path.exists(notes):
        src["notes"] = f"{src['post_dir']}/notes.md"
        text = open(notes, errors="replace").read()
        m = re.search(r"URL:\s*(\S+)", text)
        src["url"] = m.group(1) if m else None
        m = re.search(r"Views:\s*([\d,]+)", text)
        src["views"] = int(m.group(1).replace(",", "")) if m else None
        m = re.search(r"Posted:\s*(\d{4}-\d\d-\d\d)", text)
        src["date"] = m.group(1) if m else None
    pj = os.path.join(d, "post.json")
    if os.path.exists(pj):
        try:
            p = json.load(open(pj))
            src["url"] = src["url"] or p.get("inputSource") or p.get("url")
            src["views"] = src["views"] if src["views"] is not None else p.get("views")
            date = p.get("uploadedAtFormatted") or p.get("createTime") or p.get("date")
            src["date"] = src["date"] or (str(date)[:10] if date and re.match(r"\d{4}-", str(date)) else None)
        except ValueError:
            pass
    if not src["url"] and platform == "tiktok":
        src["url"] = f"https://www.tiktok.com/{src['handle']}/video/{post_id}"
    return src


# ----------------------------------------------------------------------------- the fit
def compute_fit(e):
    """Face replace (the default route, models.json face_replace) fits one face that stays in
    view, silent, with no cut, 1 to 30 s; a closed eye or a hand over the mouth drifts toward
    the reference person (docs/character-model-known.md). The written route fits any clip whose
    expression beats are written. A clip that speaks fits no reaction hook (never spoken)."""
    fr = e.get("framing") or {}
    beats = e.get("expression_beats") or []
    ln = e.get("length_s")
    speech, people, cuts, hidden = e.get("speech"), fr.get("people"), fr.get("cuts"), fr.get("face_hidden_s")
    if speech is None or people is None or cuts is None or hidden is None:
        unknown = [k for k, v in (("speech", speech), ("people", people), ("cuts", cuts), ("face_hidden_s", hidden))
                   if v is None]
        fr_fit = {"ok": None, "why": "not described yet: " + ", ".join(unknown)}
    else:
        no = []
        if people != 1:
            no.append(f"{people} people in the frame")
        if speech != "none":
            no.append(f"speech: {speech}")
        if cuts:
            no.append(f"{cuts} cut(s) inside the range")
        if num(hidden) and hidden > HIDDEN_MAX_S:
            no.append(f"the face is hidden or the eyes closed for {hidden:g} s")
        if num(ln) and not FR_MIN_S <= ln <= FR_MAX_S:
            no.append(f"{ln:g} s long")
        fr_fit = {"ok": not no, "why": "; ".join(no) if no else f"one face, silent, no cut, {ln:g} s"}
    if speech == "speaks":
        wr = {"ok": False, "why": "the person speaks; a reaction hook is never spoken"}
    elif not beats:
        wr = {"ok": None, "why": "no expression beats yet"}
    else:
        wr = {"ok": True, "why": f"{len(beats)} expression beat(s)" + (f", {people} people" if people and people != 1 else "")}
    return {"face_replace": fr_fit, "written": wr}


# ---------------------------------------------------------------------------- commands
def cmd_scan(slug, sheets=False, as_json=False):
    lib = load_lib()
    have = {(e["source"]["platform"], e["source"]["post_id"]) for e in lib["entries"].values()}
    roots = [os.path.join(ROOT, "research", slug), os.path.join(ROOT, "apps", slug, "niche", "batches")]
    noted, unnoted = [], []
    for top in roots:
        for d, _, files in os.walk(top):
            vids = [f for f in files if f.lower().endswith(VIDEO_EXT)]
            if not vids:
                continue
            pd = rel(d)
            platform = "instagram" if "/instagram/" in f"/{pd}/" else "tiktok"
            if (platform, os.path.basename(d)) in have:
                continue
            sheets_here = sorted(f for f in files if re.match(r"(sheet|frame)[-_]?\d+\.(png|jpe?g)$", f))
            if "notes.md" in files:
                text = open(os.path.join(d, "notes.md"), errors="replace").read()
                hits = [ln.strip() for ln in text.splitlines() if RX_WORDS.search(ln)]
                if not hits:
                    continue
                m = HOOK_TIME.search(text)
                hook = [m.group(1), m.group(2)] if m else None
                mv = re.search(r"Views:\s*([\d,]+)", text)
                noted.append({"post_dir": pd, "video": f"{pd}/{vids[0]}", "views": int(mv.group(1).replace(",", "")) if mv else None,
                              "hook_range": hook, "hit": hits[0][:200], "sheets": [f"{pd}/{s}" for s in sheets_here]})
            elif sheets:
                unnoted.append({"post_dir": pd, "video": f"{pd}/{vids[0]}", "sheets": [f"{pd}/{s}" for s in sheets_here]})
    noted.sort(key=lambda r: -(r["views"] or -1))
    if as_json:
        print(json.dumps({"noted": noted, "unnoted": unnoted}, indent=1))
        return
    print(f"{len(noted)} post(s) whose notes describe a reaction and that are not in the library")
    for r in noted:
        print(f"- {r['post_dir']} · views {r['views'] if r['views'] is not None else '?'}"
              + (f" · hook {r['hook_range'][0]}–{r['hook_range'][1]} s" if r["hook_range"] else "")
              + f"\n    {r['hit']}")
    if sheets:
        print(f"\n{len(unnoted)} video(s) with no notes; {sum(1 for r in unnoted if r['sheets'])} with a contact sheet")
    print("\nLook at the frames before you add one (ffmpeg -t 5 -i <video> -vf \"fps=4,scale=270:-1,tile=6x3\" "
          "-frames:v 1 <scratch>/sheet.jpg). Write only what you saw.")


def cmd_add(post_dir, start_s, end_s, tags, note, by, frm):
    post_dir = rel(os.path.join(ROOT, post_dir)) if not os.path.isabs(post_dir) else rel(post_dir)
    if not served(post_dir):
        sys.exit(f"{post_dir}: a library entry points into research/ or apps/<slug>/niche/batches/ only")
    if not (num(start_s) and num(end_s) and 0 <= start_s < end_s):
        sys.exit("start_s and end_s: the exact range of the reaction in the post, start before end")
    known = set(tag_file()["tags"])
    bad = [t for t in tags if t not in known]
    if bad:
        sys.exit(f"unknown tag(s) {bad}; the list is docs/character/reaction-tags.json")
    src = source_of(post_dir)
    dur = duration(os.path.join(ROOT, src["video"]))
    if dur is not None and end_s > dur + 0.05:
        sys.exit(f"the range ends at {end_s:g} s; the video is {dur:.2f} s long")
    lib = load_lib()
    eid = entry_id(src["platform"], src["post_id"], start_s)
    if eid in lib["entries"]:
        sys.exit(f"{eid} is in the library already")
    t = now()
    e = {"id": eid, "status": "kept" if by == "you" else "proposed", "source": src,
         "start_s": round(start_s, 2), "end_s": round(end_s, 2), "length_s": round(end_s - start_s, 2),
         "expression_beats": [], "framing": {k: None for k in FRAMING_KEYS}, "speech": None,
         "burned_in_text": [], "hook_text": None, "tags": tags, "fit": {}, "preview": None, "note": note or "",
         "added": {"by": by, "at": t, "from": frm}, "set_by_you": (["start_s", "end_s", "tags", "status"] + (["note"] if note else [])) if by == "you" else [],
         "updated_at": t}
    e["fit"] = compute_fit(e)
    lib = load_lib()
    lib["entries"][eid] = e
    save_lib(lib)
    print(f"  ✓ {eid} ({e['status']}): {src['post_dir']} {start_s:g}–{end_s:g} s. Next: describe, then fill.")


def check_beats(beats, length):
    errs = []
    if not isinstance(beats, list):
        return ["expression_beats is a list"]
    for i, b in enumerate(beats):
        miss = [k for k in BEAT_KEYS if b.get(k) in (None, "")]
        if miss:
            errs.append(f"beat {i + 1}: no {', '.join(miss)}")
        elif not (num(b["start_s"]) and num(b["end_s"]) and 0 <= b["start_s"] < b["end_s"] <= (length or 1e9) + 0.05):
            errs.append(f"beat {i + 1}: times are seconds from the range's start, inside 0–{length:g} s")
    return errs


def cmd_describe(eid, obj):
    lib = load_lib()
    e = lib["entries"].get(eid) or sys.exit(f"no entry {eid}")
    mine = set(e.get("set_by_you") or [])
    unknown = [k for k in obj if k not in DESCRIBE_KEYS]
    if unknown:
        sys.exit(f"describe takes {', '.join(DESCRIBE_KEYS)}; not {unknown}")
    skipped = [k for k in obj if k in mine]
    for k in obj:
        if k in mine:
            continue
        v = obj[k]
        if k == "framing":
            v = {**(e.get("framing") or {}), **{kk: vv for kk, vv in v.items() if kk in FRAMING_KEYS}}
        if k == "speech" and v not in SPEECH:
            sys.exit(f"speech is one of {SPEECH}")
        if k == "tags":
            bad = [t for t in v if t not in tag_file()["tags"]]
            if bad:
                sys.exit(f"unknown tag(s) {bad}; the list is docs/character/reaction-tags.json")
        e[k] = v
    if "start_s" in obj or "end_s" in obj:
        e["length_s"] = round(e["end_s"] - e["start_s"], 2)
    errs = check_beats(e.get("expression_beats") or [], e["length_s"])
    if errs:
        sys.exit("; ".join(errs))
    e["fit"] = compute_fit(e)
    e["updated_at"] = now()
    lib = load_lib()
    lib["entries"][eid] = e
    save_lib(lib)
    print(f"  ✓ {eid}: " + ", ".join(k for k in obj if k not in skipped)
          + (f" (kept the user's {', '.join(skipped)})" if skipped else "")
          + f"; face replace {fit_word(e['fit']['face_replace'])}, written {fit_word(e['fit']['written'])}")


def fit_word(f):
    return {True: "fits", False: "no", None: "?"}[f.get("ok")] + (f" ({f['why']})" if f.get("ok") is not True and f.get("why") else "")


def preview(e):
    """One contact sheet of the range, at most 12 frames, 180 px wide each. Free and local."""
    os.makedirs(PREVIEWS, exist_ok=True)
    out = os.path.join(PREVIEWS, f"{e['id']}.jpg")
    ln = max(0.1, e["end_s"] - e["start_s"])
    n = max(2, min(12, int(ln * 4)))
    cols = min(6, n)
    rows = (n + cols - 1) // cols
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{e['start_s']}", "-t", f"{ln}",
                        "-i", os.path.join(ROOT, e["source"]["video"]),
                        "-vf", f"fps={n / ln:.4f},scale=180:-2,tile={cols}x{rows}", "-frames:v", "1", "-q:v", "5", out],
                       capture_output=True, text=True)
    if r.returncode or not os.path.exists(out):
        print(f"  ! {e['id']}: no preview ({r.stderr.strip()[:160]})")
        return None
    return rel(out)


def ocr_text(e):
    sys.path.insert(0, os.path.join(ROOT, "scripts", "character"))
    try:
        import ocr
    except ImportError:
        return None
    work = tempfile.mkdtemp(prefix="rx-ocr-")
    try:
        frames = []
        for i, t in enumerate((e["start_s"] + 0.1, (e["start_s"] + e["end_s"]) / 2, max(e["start_s"], e["end_s"] - 0.1))):
            f = os.path.join(work, f"f{i}.png")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", os.path.join(ROOT, e["source"]["video"]),
                            "-frames:v", "1", f], capture_output=True)
            if os.path.exists(f):
                frames.append(f)
        got = ocr.read(frames) if frames else None
        if got is None:
            return None
        seen = []
        for f in frames:
            for part in (got.get(f) or "").split(" | "):
                part = part.strip()
                if len(part) > 2 and part not in seen:
                    seen.append(part)
        return seen
    finally:
        shutil.rmtree(work, ignore_errors=True)


def cmd_fill(ids, no_ocr=False):
    lib = load_lib()
    for eid in ids:
        e = lib["entries"].get(eid)
        if not e:
            print(f"  ! no entry {eid}")
            continue
        v = os.path.join(ROOT, e["source"]["video"])
        if not os.path.exists(v):
            print(f"  ! {eid}: {e['source']['video']} is not in the workspace")
            continue
        h = sha256_file(v)
        if e["source"].get("video_sha256") and e["source"]["video_sha256"] != h:
            print(f"  ! {eid}: the video changed since it was added (sha256 {h[:12]}…); check the range again")
        e["source"]["video_sha256"] = h
        e["length_s"] = round(e["end_s"] - e["start_s"], 2)
        e["preview"] = preview(e) or e.get("preview")
        if not no_ocr and not e.get("burned_in_text") and "burned_in_text" not in (e.get("set_by_you") or []):
            seen = ocr_text(e)
            if seen:
                e["burned_in_text"] = [{"text": s, "where": None, "start_s": 0.0, "end_s": e["length_s"], "kind": "ocr"}
                                       for s in seen[:6]]
        e["fit"] = compute_fit(e)
        e["updated_at"] = now()
        fresh = load_lib()
        fresh["entries"][eid] = {**fresh["entries"].get(eid, {}), **{k: e[k] for k in
                                 ("source", "length_s", "preview", "burned_in_text", "fit", "updated_at")}}
        save_lib(fresh)
        lib = fresh
        print(f"  ✓ {eid}: {e['length_s']:g} s, preview {e['preview'] or '—'}, "
              f"face replace {fit_word(e['fit']['face_replace'])}, written {fit_word(e['fit']['written'])}")


def problems(e, tags):
    out = []
    s = e.get("source") or {}
    if e.get("status") not in STATUSES:
        out.append(f"status {e.get('status')!r}")
    if e.get("status") == "kept" and "status" not in (e.get("set_by_you") or []):
        out.append("kept, but not by the user: only the user keeps an entry")
    if not served(s.get("post_dir") or ""):
        out.append("the post is not in research/ or an app's niche batches")
    v = os.path.join(ROOT, s.get("video") or "")
    if not s.get("video") or not os.path.exists(v):
        out.append(f"{s.get('video')} is not in the workspace")
    elif s.get("video_sha256") and sha256_file(v) != s["video_sha256"]:
        out.append("the video changed since its sha256 was written")
    elif not s.get("video_sha256"):
        out.append("no sha256 yet (fill)")
    if not (num(e.get("start_s")) and num(e.get("end_s")) and 0 <= e["start_s"] < e["end_s"]):
        out.append("start_s and end_s")
    out += check_beats(e.get("expression_beats") or [], e.get("length_s") or 0)
    bad = [t for t in e.get("tags") or [] if t not in tags]
    if bad:
        out.append(f"unknown tags {bad}")
    return out


def cmd_check():
    lib, tags = load_lib(), set(tag_file()["tags"])
    n = 0
    for eid, e in sorted(lib["entries"].items()):
        p = problems(e, tags)
        if p:
            n += 1
            print(f"  ✗ {eid}: " + "; ".join(p))
    print(f"{len(lib['entries'])} entr{'y' if len(lib['entries']) == 1 else 'ies'}; {n} with a problem")
    sys.exit(1 if n else 0)


def ranked(lib, tag=None, job=None, fit=None, max_s=None, status=None):
    want = set([tag] if tag else []) | set(tag_file()["hook_jobs"].get(job, []) if job else [])
    rows = []
    for e in lib["entries"].values():
        if status and e.get("status") != status:
            continue
        if not status and e.get("status") == "retired":
            continue
        if want and not want & set(e.get("tags") or []):
            continue
        if fit and (e.get("fit") or {}).get(fit, {}).get("ok") is not True:
            continue
        if max_s and (e.get("length_s") or 0) > max_s:
            continue
        score = (e.get("status") == "kept", len(want & set(e.get("tags") or [])),
                 (e.get("fit") or {}).get("face_replace", {}).get("ok") is True, e["source"].get("views") or 0)
        rows.append((score, e))
    rows.sort(key=lambda r: r[0], reverse=True)
    return [e for _, e in rows]


def cmd_list(tag=None, job=None, fit=None, max_s=None, status=None, as_json=False, limit=40):
    lib = load_lib()
    rows = ranked(lib, tag, job, fit, max_s, status)
    if as_json:
        print(json.dumps(rows[:limit], indent=1, ensure_ascii=False))
        return
    print(f"{len(rows)} entr{'y' if len(rows) == 1 else 'ies'} in library/reactions/reactions.json")
    for e in rows[:limit]:
        print(f"- {e['id']} · {e['status']} · {e['length_s']:g} s · {', '.join(e.get('tags') or []) or 'no tags'}"
              f" · face replace {fit_word(e['fit']['face_replace'])}\n    {e['source']['post_dir']}"
              f" {e['start_s']:g}–{e['end_s']:g} s · {len(e.get('expression_beats') or [])} beat(s)"
              + (f" · “{e['hook_text']}”" if e.get("hook_text") else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["scan", "add", "describe", "fill", "check", "list"])
    ap.add_argument("args", nargs="*")
    ap.add_argument("--sheets", action="store_true")
    ap.add_argument("--json", nargs="?", const=True)
    ap.add_argument("--file")
    ap.add_argument("--tags", default="")
    ap.add_argument("--note", default="")
    ap.add_argument("--by", choices=["agent", "you"], default="agent")
    ap.add_argument("--from", dest="frm", default=None)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--no-ocr", action="store_true")
    ap.add_argument("--tag")
    ap.add_argument("--job")
    ap.add_argument("--fit", choices=["face_replace", "written"])
    ap.add_argument("--max-s", type=float)
    ap.add_argument("--status", choices=STATUSES)
    a = ap.parse_args()
    if a.cmd == "scan":
        if len(a.args) != 1:
            sys.exit("scan <slug>")
        cmd_scan(a.args[0], a.sheets, a.json is True)
    elif a.cmd == "add":
        if len(a.args) != 3:
            sys.exit("add <post_dir> <start_s> <end_s>")
        tags = [t.strip() for t in a.tags.split(",") if t.strip()]
        cmd_add(a.args[0], float(a.args[1]), float(a.args[2]), tags, a.note, a.by,
                a.frm or ("conversation" if a.by == "you" else "agent-scan"))
    elif a.cmd == "describe":
        if len(a.args) != 1 or not (isinstance(a.json, str) or a.file):
            sys.exit("describe <id> --json '<object>' | --file <x.json>")
        obj = json.load(open(a.file)) if a.file else json.loads(a.json)
        cmd_describe(a.args[0], obj)
    elif a.cmd == "fill":
        ids = sorted(load_lib()["entries"]) if a.all else a.args
        if not ids:
            sys.exit("fill <id> ... | --all")
        cmd_fill(ids, a.no_ocr)
    elif a.cmd == "check":
        cmd_check()
    else:
        cmd_list(a.tag, a.job, a.fit, a.max_s, a.status, a.json is True)


if __name__ == "__main__":
    main()
