#!/usr/bin/env python3
"""The production bridge of the character pipeline: the v2 plan contract and its check
against what P1 writes. Free, local. shots.py check and validate call it; it also runs
alone.

    bridge.py plan <video>            the v2 fields of plan.json (and its planning approval)
    bridge.py video <video>           video.json and the shot files against the v2 plan:
                                      beat timing, words, performance, actions, subjects,
                                      sets, panels, overlays, narration, live pairing
    bridge.py assets <video>          every supplied file on disk, its checksum and range
    bridge.py digest <plan.json>      the content digest that planning-approval.json pins

A plan without `schema_version` is a legacy (v1) plan: the bridge has nothing to check
and says so; shots.py keeps its v1 checks. The contract is docs/character/plan.schema.json.
Exit 1 when a check fails.

The bridge adds no generation. B is a silent generated action (hands only, pet only, or
an approved mascot); C is supplied media (a clip or a still, never generated, never a
reference of a generation); M lays panels side by side or one inside another. A narrator
speaks over a beat where no generated face talks. X is a silent reaction: the handle's own
generated face reacts, with no voice and no lip sync, while the hook runs as a timed text
overlay (founder, 2026-10-03: a reaction hook is never spoken). In face-replace mode
(founder, 2026-10-04) the reference clip, trimmed and masked by shots.py reference, is
the motion input and the character's face goes in; otherwise the written performance
taken from the reference drives it. The research file itself is never attached.
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# The controlled values of the plan (research/ai-ugc/VIDEO-PLANNING-PLAN.md § 2 and § 5).
EDITORIAL = {
    "objective": {"reach", "save_share", "product_discovery", "product_action"},
    "distribution": {"organic", "paid"},
    "lane": {"pitch", "discovery", "everyday", "education"},
    "filming_format": {"talking_head", "hook_to_demo", "live_use", "before_after",
                       "text_over_action", "voiceover_action"},
    "recipe_id": {"pitch_proof", "discovery_demo", "routine_log", "personal_note",
                  "state_change", "explain_action", "list_steps", "setup_reveal"},
    "app_presence": {"none", "incidental_use", "demonstration", "result"},
    "close": {"none", "payoff", "save", "share", "follow", "question", "profile", "product_action"},
    "cast_kind": {"human", "mascot", "none"},
}
FORMAT_ALIASES = {"face_to_demo": "hook_to_demo"}
HOOK_JOBS = {"discovery_regret", "imminent_need", "confession_reframe", "quoted_challenge",
             "specific_promise", "peer_question", "visible_result", "in_progress",
             "gratitude_discovery", "category_analogy", "withheld_reveal", "explanation"}
# reaction: a silent reacting face with the hook as a text overlay (never spoken).
HOOK_CHANNELS = {"spoken", "visual", "text", "spoken_visual", "text_visual", "reaction"}
HOOK_FRAMINGS = {"count", "negative", "audience_callout", "lived_experience", "professional_basis"}
PRODUCT_ROLES = {"absent", "incidental_tool", "story_solution", "main_subject"}
NAME_LOCATIONS = {"speech", "overlay", "caption", "bio"}
PRODUCT_TIMING = {"absent", "opening", "middle", "closing", "throughout"}
PROOF_KINDS = {"none", "visible_action", "real_screen_result", "sourced_fact"}
COMPARISON = {"before_after", "wrong_right", "best_worst"}
EXPERIMENT_AXES = {"none", "hook", "proof", "product_presence", "close", "cast"}

PERFORMANCE = {"on_camera", "voiceover", "silent_action"}
# app_screen: the real app fills the frame (an R or P segment); no person, nothing generated.
FRAMING = {"face", "hands_only", "subject_only", "app_screen"}
LAYOUT = {"sequence", "split_screen", "picture_in_picture"}
OVERLAY_ROLES = {"hook", "paragraph", "step_label", "comparison_label", "day_counter", "source_credit"}
# Where an overlay may sit. Never the lower band: the captions and the platform's buttons
# are there.
PLACEMENTS = {"top", "middle", "upper_left", "upper_right", "panel"}
ASSET_KINDS = {"clip", "still", "screen", "audio"}
# own_camera: filmed by the user; user_supplied: the user's own file from elsewhere;
# licensed / permitted_reference: a third party's clip used with a licence or permission
# (a stitch excerpt); verified_expert: a real professional's footage or voice;
# app_recording: a real recording of the app (the screen library).
ASSET_ORIGINS = {"own_camera", "user_supplied", "licensed", "permitted_reference",
                 "verified_expert", "app_recording"}
NEEDS_PERMISSION = {"user_supplied", "licensed", "permitted_reference", "verified_expert"}
NEEDS_CREDIT = {"licensed", "permitted_reference"}
LIVE_INPUT_ORIGINS = {"own_camera", "user_supplied"}
STRATEGY_DISPOSITIONS = {"scheduled", "candidate", "stopped", "avoid"}
# Overlay roles whose digits are not claims: a step number, the series day (bound by the
# series' state_fact_refs). Any other number on screen names its fact_refs.
NUMBER_EXEMPT_ROLES = {"step_label", "day_counter"}
NARRATOR_KINDS = {"character", "supplied_speaker", "original_synthetic"}

MAX_WORDS_PER_S = 3.75          # 15 words per 4 s: the speech ceiling of the plan
READ_WORDS_PER_S = 3.0          # an overlay stays up at least words / 3 s
MIN_OVERLAY_S = 1.0
BEAT_TOL_S = 0.05               # beats meet end to start
SYNC_TOL_S = 0.25               # live pairing: measured offset against the panel offsets


def load(p):
    with open(p) as f:
        return json.load(f)


def placeholder(v):
    return v is None or (isinstance(v, str) and (not v.strip() or "<" in v))


def is_v2(plan):
    return "schema_version" in plan


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def words(text):
    return len(str(text or "").split())


def norm(text):
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", str(text or "").lower().replace("’", "'"))).strip()


def digest(plan):
    """The content digest of a locked plan: sha256 of the canonical JSON of the whole
    plan without `approved`. planning-approval.json pins it; production verifies it."""
    body = {k: v for k, v in plan.items() if k != "approved"}
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def probe(path):
    """(duration_s or None, has_video, has_audio) of a media file."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type",
                        "-of", "json", path], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        return None, False, False
    kinds = {s.get("codec_type") for s in d.get("streams") or []}
    dur = (d.get("format") or {}).get("duration")
    return (float(dur) if dur not in (None, "N/A") else None), "video" in kinds, "audio" in kinds


def handle_dir(plan):
    return os.path.join(ROOT, "apps", plan["app"], "handles", str(plan["handle"]).lstrip("@"))


def world_of(plan):
    p = os.path.join(handle_dir(plan), "world.json")
    return load(p) if os.path.exists(p) else {"fixed_subjects": [], "sets": []}


def screen_rows(plan):
    p = os.path.join(ROOT, "apps", plan["app"], "screens", "screens.json")
    return {r.get("id"): r for r in (load(p).get("screens") or [])} if os.path.exists(p) else {}


def narrator_profile(plan, ref):
    """The narrator file of a pinned original synthetic voice, '<narrator>@v<n>':
    narrators/<narrator>/narrator.json when it is that version, else versions/v<n>.json."""
    m = re.fullmatch(r"([a-z0-9][a-z0-9._-]*)@v(\d+)", str(ref or ""))
    if not m:
        return None, None
    ndir = os.path.join(handle_dir(plan), "narrators", m.group(1))
    cur = os.path.join(ndir, "narrator.json")
    if os.path.exists(cur) and str(load(cur).get("version")) == f"v{m.group(2)}":
        return load(cur), cur
    old = os.path.join(ndir, "versions", f"v{m.group(2)}.json")
    return (load(old), old) if os.path.exists(old) else (None, old)


def pin_ids(plan):
    out = set()
    for c in plan.get("characters") or []:
        m = re.fullmatch(r"([a-z0-9][a-z0-9._-]*)@v(\d+)", str(c))
        if m:
            out.add(m.group(1))
    return out


def beat_narrator(plan, beat):
    return beat.get("narrator_ref") or (plan.get("editorial") or {}).get("narrator_ref")


def asset_path(a):
    return os.path.join(ROOT, a["path"]) if a.get("path") else None


class Out:
    """Collects the results; shots.py passes its own printers."""
    def __init__(self, bad=None, note=None, good=None):
        self.problems, self.notes = [], []
        self._bad, self._note, self._good = bad, note, good

    def bad(self, m):
        self.problems.append(m)
        (self._bad or (lambda x: print(f"  ✗ {x}")))(m)

    def note(self, m):
        self.notes.append(m)
        (self._note or (lambda x: print(f"  ! {x}")))(m)

    def good(self, m):
        (self._good or (lambda x: print(f"  ✓ {x}")))(m)


# ---------------------------------------------------------------------------- the plan
def check_plan(plan, out, verify_files=True, script_checked=False):
    """Every v2 field of a locked plan. Returns nothing; problems go to `out`.
    script_checked: the caller (shots.py check) has already checked the speakers and
    that every line is in a beat."""
    if not is_v2(plan):
        out.note("legacy plan (no schema_version): the v1 checks apply, the bridge has nothing to check")
        return
    if plan.get("schema_version") != 2:
        out.bad(f"schema_version is {plan.get('schema_version')!r}; this production knows 2")
        return
    rev = plan.get("revision")
    if not isinstance(rev, int) or isinstance(rev, bool) or rev < 1:
        out.bad("revision must be a positive whole number")
    fmt = plan.get("format") or {}
    length = fmt.get("length_s")
    if not num(length) or length <= 0:
        out.bad("format.length_s must be a number of seconds")
        length = None
    pins = pin_ids(plan)
    world = world_of(plan)
    subjects = {s.get("id"): s for s in world.get("fixed_subjects") or []}
    sets = {s.get("id") for s in world.get("sets") or []}
    assets = check_assets(plan, out, verify_files)
    narrators = check_narrators(plan, assets, pins, out)
    ed = check_editorial(plan, pins, narrators, out)
    lines = {l.get("id"): l for l in plan.get("script") or []}
    for l in ([] if script_checked else plan.get("script") or []):
        if l.get("speaker") not in pins | {"vo"}:
            out.bad(f"script line {l.get('id')}: speaker {l.get('speaker')!r} is not a pinned character or 'vo'")
    beats = plan.get("beats") or []
    check_reaction_refs(plan, out, verify_files)
    check_beats(plan, beats, lines, length, pins, subjects, sets, assets, narrators, ed, out, script_checked)
    check_overlays(plan, beats, length, assets, ed, out)
    check_live(plan, beats, assets, ed, out)
    pn = plan.get("publishing_note")
    if pn is not None and not (isinstance(pn, dict) and set(pn) <= {"caption", "bio_ref", "music_note"}):
        out.bad("publishing_note is {caption, bio_ref, music_note}; music is a note only, never in the file")
    check_planning_approval(plan, out)
    if not out.problems:
        out.good(f"v2 plan, revision {rev}: {len(beats)} beat(s), {len(assets)} asset(s), "
                 f"{len(narrators)} narrator(s), {len(plan.get('overlays') or [])} overlay(s)")


def check_editorial(plan, pins, narrators, out):
    ed = plan.get("editorial")
    if not isinstance(ed, dict):
        out.bad("a v2 plan has an 'editorial' block (§ 5 of the planning contract)")
        return {}
    ed = dict(ed)
    ff = ed.get("filming_format")
    if ff in FORMAT_ALIASES:
        out.note(f"filming_format {ff!r} is read as {FORMAT_ALIASES[ff]!r}")
        ed["filming_format"] = FORMAT_ALIASES[ff]
    for k, allowed in EDITORIAL.items():
        if ed.get(k) not in allowed:
            out.bad(f"editorial.{k} is {ed.get(k)!r}; one of {', '.join(sorted(allowed))}")
    hook = ed.get("hook") or {}
    if hook.get("job_id") not in HOOK_JOBS:
        out.bad(f"editorial.hook.job_id {hook.get('job_id')!r} is not a hook job")
    if hook.get("channel") not in HOOK_CHANNELS:
        out.bad(f"editorial.hook.channel {hook.get('channel')!r}; one of {', '.join(sorted(HOOK_CHANNELS))}")
    fr = hook.get("framing") or []
    fr = [fr] if isinstance(fr, str) else fr
    if not set(fr) <= HOOK_FRAMINGS:
        out.bad(f"editorial.hook.framing {sorted(set(fr) - HOOK_FRAMINGS)} not allowed")
    ed["_framing"] = set(fr)
    pr = ed.get("product") or {}
    if pr.get("role") not in PRODUCT_ROLES:
        out.bad(f"editorial.product.role {pr.get('role')!r}")
    if not set(pr.get("name_locations") or []) <= NAME_LOCATIONS:
        out.bad("editorial.product.name_locations is a set of speech, overlay, caption, bio")
    if not isinstance(pr.get("speech_count", 0), int) or pr.get("speech_count", 0) < 0:
        out.bad("editorial.product.speech_count is a whole number")
    if pr.get("timing") not in PRODUCT_TIMING:
        out.bad(f"editorial.product.timing {pr.get('timing')!r}")
    proof = ed.get("proof") or {}
    if proof.get("kind") not in PROOF_KINDS:
        out.bad(f"editorial.proof.kind {proof.get('kind')!r}")
    if proof.get("kind") == "sourced_fact" and not proof.get("fact_refs"):
        out.bad("proof sourced_fact names its fact_refs")
    if ed.get("comparison_mode") not in COMPARISON | {None}:
        out.bad(f"editorial.comparison_mode {ed.get('comparison_mode')!r}")
    exp = ed.get("experiment") or {"axis": "none"}
    if exp.get("axis") not in EXPERIMENT_AXES:
        out.bad(f"editorial.experiment.axis {exp.get('axis')!r}")
    elif exp.get("axis") != "none" and placeholder(exp.get("base_video_id")):
        out.bad("an experiment names the base video it changes one axis of")
    check_strategy_ref(ed.get("strategy_ref"), out)
    # The app is shown only through app insertion.
    ins = plan.get("app_insertion") is True
    if ed.get("app_presence") not in (None, "none") and not ins:
        out.bad(f"app_presence {ed.get('app_presence')!r} shows the real app: app_insertion must be true")
    # The cast.
    ck = ed.get("cast_kind")
    if ck == "none" and pins:
        out.bad("cast_kind none, but the plan pins characters")
    if ck in ("human", "mascot") and not pins:
        out.bad(f"cast_kind {ck}, but the plan pins no character")
    if ed.get("narrator_ref") is not None and ed["narrator_ref"] not in narrators:
        out.bad(f"editorial.narrator_ref {ed['narrator_ref']!r} is not in narrators[]")
    # A professional basis is a real credential, supplied and verified; or the basis is a
    # sourced fact. Never a credential given to a fictional or synthetic voice.
    if "professional_basis" in ed["_framing"]:
        verified = any(n.get("kind") == "supplied_speaker" and not placeholder(n.get("credential_ref"))
                       for n in narrators.values())
        if not verified and not proof.get("fact_refs"):
            out.bad("a professional_basis hook needs a supplied speaker with a credential_ref, or fact_refs "
                    "for its basis; a fictional character or a synthetic voice carries no credential")
    s = ed.get("series", "standalone")
    if s not in (None, "standalone"):
        if not isinstance(s, dict) or s.get("kind") != "progress_log":
            out.bad("editorial.series is 'standalone' or {kind: progress_log, ...}")
        else:
            for k in ("series_id", "subject_ids", "routine_id", "episode", "day"):
                if s.get(k) in (None, "", []):
                    out.bad(f"series progress_log has no {k}")
            if isinstance(s.get("episode"), int) and s["episode"] > 1 and placeholder(s.get("previous_plan_ref")):
                out.bad("episode after the first names previous_plan_ref, the plan it continues")
            if not s.get("state_fact_refs"):
                out.bad("a progress log binds the actual state with state_fact_refs; a counter alone is not progress")
    return ed


def check_strategy_ref(sr, out):
    """editorial.strategy_ref: the row of the user's strategy this video executes, as the
    brief names it: {file, section, row (verbatim), disposition}. A plain string (the
    first planning drafts) is still read, as a free-text pointer."""
    if sr is None:
        return
    if isinstance(sr, str):
        if placeholder(sr):
            out.bad("editorial.strategy_ref is empty; it names the strategy row {file, section, row, disposition}")
        else:
            out.note("editorial.strategy_ref is a plain string; the shape is {file, section, row, disposition}")
        return
    if not isinstance(sr, dict):
        out.bad("editorial.strategy_ref is {file, section, row, disposition}")
        return
    for k in ("file", "section", "row"):
        if placeholder(sr.get(k)):
            out.bad(f"editorial.strategy_ref.{k} is empty")
    if sr.get("disposition") not in STRATEGY_DISPOSITIONS:
        out.bad(f"editorial.strategy_ref.disposition {sr.get('disposition')!r}; "
                f"one of {', '.join(sorted(STRATEGY_DISPOSITIONS))}")


def check_assets(plan, out, verify_files):
    assets, rows = {}, None
    for a in plan.get("assets") or []:
        a = dict(a)                   # measured values go on a copy: the plan is never changed
        aid = a.get("id")
        if placeholder(aid) or aid in assets:
            out.bad(f"asset id {aid!r} is missing or used twice")
            continue
        assets[aid] = a
        k, o = a.get("kind"), a.get("origin")
        if k not in ASSET_KINDS:
            out.bad(f"asset {aid}: kind {k!r}; one of {', '.join(sorted(ASSET_KINDS))}")
        if o not in ASSET_ORIGINS:
            out.bad(f"asset {aid}: origin {o!r}; one of {', '.join(sorted(ASSET_ORIGINS))}")
        if o in NEEDS_PERMISSION and placeholder(a.get("permission_ref")):
            out.bad(f"asset {aid}: origin {o} needs permission_ref (the licence, the permission or the user's own note)")
        if o in NEEDS_CREDIT | {"verified_expert"} and placeholder(a.get("source_url")):
            out.bad(f"asset {aid}: origin {o} needs source_url")
        if k == "screen":
            if rows is None:
                rows = screen_rows(plan)
            if o != "app_recording":
                out.bad(f"asset {aid}: a screen is a real app recording (origin app_recording)")
            if placeholder(a.get("screen_id")) or a.get("screen_id") not in rows:
                out.bad(f"asset {aid}: screen_id {a.get('screen_id')!r} is not in apps/{plan['app']}/screens/screens.json")
        p = a.get("path")
        if placeholder(p) or os.path.isabs(p or ""):
            out.bad(f"asset {aid}: path is the file's path in the workspace, relative (apps/..., pipeline/...)")
            continue
        sha = a.get("sha256")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha):
            out.bad(f"asset {aid}: sha256 is the file's checksum, 64 hex digits")
        trim = a.get("trim_s")
        if trim is not None and not (isinstance(trim, list) and len(trim) == 2 and all(num(x) for x in trim)
                                     and 0 <= trim[0] < trim[1]):
            out.bad(f"asset {aid}: trim_s is [in, out] in seconds of the source, the approved range")
            trim = None
        if not verify_files:
            continue
        fp = asset_path(a)
        if not os.path.exists(fp):
            out.bad(f"asset {aid}: {p} is not on disk")
            continue
        if isinstance(sha, str) and sha256_file(fp) != sha:
            out.bad(f"asset {aid}: {p} does not match its sha256 -- the file changed after the plan was locked")
        dur, hv, ha = probe(fp)
        a["_duration"] = dur
        if k in ("clip", "screen") and not hv:
            out.bad(f"asset {aid}: a {k} has a picture; {p} has none")
        if k == "audio" and not ha:
            out.bad(f"asset {aid}: an audio asset has sound; {p} has none")
        if trim and dur and trim[1] > dur + 0.05:
            out.bad(f"asset {aid}: trim_s ends at {trim[1]} s; the file is {dur:.2f} s")
    return assets


def asset_range(a):
    """The approved range of an asset: its trim_s, else the whole file."""
    if a.get("trim_s"):
        return a["trim_s"]
    return [0.0, a.get("_duration")] if a.get("_duration") else None


def within(rng, outer):
    return outer is None or (outer[1] is None) or (rng[0] >= outer[0] - 0.01 and rng[1] <= outer[1] + 0.01)


def check_narrators(plan, assets, pins, out):
    narrators = {}
    for n in plan.get("narrators") or []:
        nid, k = n.get("id"), n.get("kind")
        if placeholder(nid) or nid in narrators:
            out.bad(f"narrator id {nid!r} is missing or used twice")
            continue
        narrators[nid] = n
        if k not in NARRATOR_KINDS:
            out.bad(f"narrator {nid}: kind {k!r}; one of {', '.join(sorted(NARRATOR_KINDS))}")
            continue
        if k != "supplied_speaker" and not placeholder(n.get("credential_ref")):
            out.bad(f"narrator {nid}: a {k} narrator carries no credential; no synthetic expert")
        if k == "character":
            cid = str(n.get("character_ref") or "").split("@")[0]
            if cid not in pins:
                out.bad(f"narrator {nid}: character_ref {n.get('character_ref')!r} is not a pinned character")
        elif k == "supplied_speaker":
            src = assets.get(n.get("source_ref"))
            if not src or src.get("kind") not in ("audio", "clip"):
                out.bad(f"narrator {nid}: source_ref names the supplied audio or clip of the real speaker")
            elif src.get("origin") not in ("own_camera", "user_supplied", "verified_expert"):
                out.bad(f"narrator {nid}: a supplied speaker's voice is the user's own or a verified expert's, "
                        f"not {src.get('origin')}")
        else:
            prof, path = narrator_profile(plan, n.get("voice_ref"))
            if prof is None:
                out.bad(f"narrator {nid}: voice_ref {n.get('voice_ref')!r} is not <narrator>@v<n> with a narrator "
                        f"file ({os.path.relpath(path, ROOT) if path else 'narrators/<narrator>/narrator.json'}) "
                        "-- character-voice, narrator mode")
                continue
            if prof.get("kind") != "original_synthetic":
                out.bad(f"narrator {nid}: the narrator file's kind is {prof.get('kind')!r}")
            if prof.get("cloned_from") not in (None, "none"):
                out.bad(f"narrator {nid}: an original synthetic voice is never a clone of a real person "
                        f"(cloned_from {prof.get('cloned_from')!r})")
            if placeholder((prof.get("approved") or {}).get("words")):
                out.bad(f"narrator {nid}: the narrator voice is not approved by the user")
            if prof.get("status") not in ("live",):
                out.bad(f"narrator {nid}: narrator status {prof.get('status')!r}; it must be 'live' "
                        "(approved, and the natural-voice check passed)")
    return narrators


def check_beats(plan, beats, lines, length, pins, subjects, sets, assets, narrators, ed, out,
                script_checked=False):
    ids, carried, t = set(), {}, 0.0
    ins = plan.get("app_insertion") is True
    cast = ed.get("cast_kind")
    for i, b in enumerate(beats, 1):
        bid = b.get("id")
        tag = f"beat {bid or i}"
        if placeholder(bid) or bid in ids:
            out.bad(f"beat {i}: id {bid!r} is missing or used twice")
        ids.add(bid)
        s, e = b.get("start_s"), b.get("end_s")
        if not (num(s) and num(e) and e > s):
            out.bad(f"{tag}: start_s and end_s are numbers, end after start")
            continue
        if abs(s - t) > BEAT_TOL_S:
            out.bad(f"{tag} starts at {s} s; the previous beat ends at {t} s (beats are in order, "
                    "with no gap and no overlap; simultaneous media are panels)")
        t = e
        if placeholder(b.get("role")):
            out.bad(f"{tag}: no role")
        if placeholder(b.get("action")):
            out.bad(f"{tag}: no action (what is visible)")
        perf, framing, layout = b.get("performance"), b.get("framing"), b.get("layout", "sequence")
        if perf not in PERFORMANCE:
            out.bad(f"{tag}: performance {perf!r}; one of {', '.join(sorted(PERFORMANCE))}")
        if framing not in FRAMING:
            out.bad(f"{tag}: framing {framing!r}; one of {', '.join(sorted(FRAMING))}")
        if layout not in LAYOUT:
            out.bad(f"{tag}: layout {layout!r}; one of {', '.join(sorted(LAYOUT))}")
        src = b.get("source_asset_ids") or []
        for aid in src:
            if aid not in assets:
                out.bad(f"{tag}: source asset {aid!r} is not in assets[]")
        # Generated media: no source asset and no panel. An app beat without an asset is a
        # phone insertion (generated plate) or R/P from the screen library.
        generated = not src and layout == "sequence"
        action_only = generated and not b.get("app_on_screen")
        # The words.
        bl = b.get("lines") or []
        for lid in bl:
            if lid not in lines:
                if not script_checked:
                    out.bad(f"{tag}: line {lid!r} is not in the script")
            elif lid in carried:
                out.bad(f"line {lid} is in {carried[lid]} and {tag}; each spoken line belongs to one beat")
            carried.setdefault(lid, tag)
        n_words = sum(words(lines[l].get("line")) for l in bl if l in lines)
        if n_words / (e - s) > MAX_WORDS_PER_S:
            out.bad(f"{tag}: {n_words} words in {e - s:g} s is over {MAX_WORDS_PER_S} words a second")
        speakers = {lines[l].get("speaker") for l in bl if l in lines}
        nref = beat_narrator(plan, b)
        nar = narrators.get(nref) if nref else None
        if perf == "silent_action" and bl:
            out.bad(f"{tag}: silent_action carries no line")
        if perf in ("on_camera", "voiceover") and not bl:
            out.bad(f"{tag}: {perf} carries its line(s)")
        if perf == "on_camera":
            if framing != "face":
                out.bad(f"{tag}: on_camera speech shows the face (framing face)")
            supplied_speaker = nar and nar.get("kind") == "supplied_speaker" and nar.get("source_ref") in src
            if speakers - pins and not supplied_speaker:
                out.bad(f"{tag}: on_camera lines are spoken by a pinned character, or by a supplied speaker "
                        "in their own footage")
        if perf == "voiceover" and bl:
            if not nar:
                out.bad(f"{tag}: a voiceover beat binds a narrator (narrator_ref, here or in editorial)")
            else:
                if nar.get("kind") == "character":
                    cid = str(nar.get("character_ref") or "").split("@")[0]
                    if speakers - {"vo", cid}:
                        out.bad(f"{tag}: the narrator is {cid}; the lines are spoken by {sorted(speakers)}")
                elif speakers - {"vo"}:
                    out.bad(f"{tag}: a {nar.get('kind')} narrator speaks 'vo' lines only")
                # Founder, 2026-10-01: a synthetic voice only where no human face is on
                # screen. A mascot is not lip-synced; its narration can be voice-over.
                if nar.get("kind") == "original_synthetic" and framing == "face" and cast != "mascot":
                    out.bad(f"{tag}: an original synthetic narrator never speaks over a visible human face")
        # The app.
        on = b.get("app_on_screen")
        if on and not ins:
            out.bad(f"{tag} shows the app, but app_insertion is false")
        if framing == "app_screen":
            if not on:
                out.bad(f"{tag}: framing app_screen is the real app full frame (app_on_screen true)")
            if layout != "sequence":
                out.bad(f"{tag}: app_screen fills the frame; a recording beside other media is a panel")
            if any((assets.get(a) or {}).get("kind") in ("clip", "still") for a in src):
                out.bad(f"{tag}: app_screen shows the real recording, not a clip or a still")
            if b.get("subject_ids"):
                out.bad(f"{tag}: app_screen shows no subject")
        elif on and framing == "subject_only" and layout == "sequence" and \
                all((assets.get(a) or {}).get("kind") == "screen" for a in src):
            out.note(f"{tag}: a full-screen app beat is framing app_screen (subject_only is read as it)")
        if is_reaction(plan, b, i == 1):
            check_reaction(plan, tag, b, i == 1, perf, framing, layout, src, cast, plan.get("overlays") or [],
                           ed, out)
        # The cast and the world.
        if generated and framing == "face" and cast not in ("human", "mascot"):
            out.bad(f"{tag}: a generated face needs a cast (cast_kind human or mascot)")
        if generated and framing == "hands_only" and cast != "human":
            out.bad(f"{tag}: generated hands belong to a pinned human character (cast_kind human); "
                    "supplied hands come from a source asset")
        for sid in b.get("subject_ids") or []:
            from_assets = any(sid in (assets.get(a) or {}).get("subject_ids", []) for a in src)
            if sid not in subjects and not (from_assets and sid.startswith("source:")):
                out.bad(f"{tag}: subject {sid!r} is not a fixed subject of world.json")
                continue
            if sid in subjects and subjects[sid].get("origin") == "real" and generated:
                out.bad(f"{tag}: {sid} is a real animal; it is shown only in supplied footage, never generated")
            if src and not from_assets and all((assets.get(a) or {}).get("kind") in ("clip", "still") for a in src):
                out.bad(f"{tag}: subject {sid} is in no source asset of this beat (subject_ids of the asset)")
        sid_ = b.get("set_id")
        if action_only and framing != "face" and placeholder(sid_):
            out.bad(f"{tag}: a generated action names its set (set_id)")
        if not placeholder(sid_) and action_only and sid_ not in sets:
            out.bad(f"{tag}: set {sid_!r} is not in world.json")
        mo = b.get("media_origin")
        if mo is not None and mo not in ("generated", "supplied", "mixed"):
            out.bad(f"{tag}: media_origin {mo!r}")
        # Panels.
        panels = b.get("panels") or []
        if layout == "sequence" and panels:
            out.bad(f"{tag}: panels need layout split_screen or picture_in_picture")
        if layout != "sequence":
            check_panels(tag, layout, panels, src, assets, out)
        if b.get("repeat_group") is not None and not isinstance(b.get("item_index"), int):
            out.bad(f"{tag}: a repeat group item has its item_index")
    if length and abs(t - length) > BEAT_TOL_S:
        out.bad(f"the beats end at {t:g} s; the target length is {length} s (beats cover the whole video)")
    missing = [l for l in lines if l not in carried]
    if missing and not script_checked:
        out.bad(f"script lines no beat carries: {', '.join(missing)}")


RX_REF_KEYS = ("id", "post_id", "platform", "handle", "post_dir", "video_path", "video_sha256",
               "start_s", "end_s", "notes_ref", "generation_input")
RX_KEYS = ("ref_id", "framing", "camera_distance", "expression_beats")
RX_STEP_KEYS = ("start_s", "end_s", "ref_s", "face", "eyes", "head")


def reaction_refs(plan):
    return {r.get("id"): r for r in plan.get("reaction_refs") or [] if isinstance(r, dict)}


def is_reaction(plan, b, first):
    """A beat that performs a reaction: it has a `reaction` key, or it opens a reaction hook."""
    ch = ((plan.get("editorial") or {}).get("hook") or {}).get("channel")
    return "reaction" in b or (first and ch == "reaction")


def ref_mode(r):
    """How a reference reaction is used. face_replace: its trimmed clip is the input of an
    X generation, which keeps the motion and timing and replaces the face with the
    character's (founder, 2026-10-04). none: the written expression beats only (the
    fallback). The first plans wrote null or false for none."""
    g = (r or {}).get("generation_input")
    return "none" if g in (None, False) else g


def face_replace_ref(plan, b):
    """The reaction_refs row of a face-replace beat, else None."""
    rx = b.get("reaction") if isinstance(b.get("reaction"), dict) else {}
    r = reaction_refs(plan).get(rx.get("ref_id"))
    return r if r and ref_mode(r) == "face_replace" else None


def check_reaction_refs(plan, out, verify_files=False):
    """The real reference reactions, from the user's research, named by post and range.
    In face_replace mode the trimmed clip is the motion input of the X generation, pinned
    by its checksum; in none mode it gives the written performance only. Either way the
    research file itself is never attached to a generation: production trims and masks a
    copy (shots.py reference)."""
    seen = set()
    for r in plan.get("reaction_refs") or []:
        rid = r.get("id") if isinstance(r, dict) else None
        if placeholder(rid) or rid in seen:
            out.bad(f"reaction ref {rid!r} is missing or used twice")
            continue
        seen.add(rid)
        for k in RX_REF_KEYS:
            if k not in r:
                out.bad(f"reaction ref {rid}: no '{k}'")
        if placeholder(r.get("post_id")) or placeholder(r.get("video_path")):
            out.bad(f"reaction ref {rid}: a real post (post_id and video_path)")
        if any(os.path.isabs(str(r.get(k) or "")) for k in ("post_dir", "video_path")):
            out.bad(f"reaction ref {rid}: paths are relative to the workspace")
        if not (num(r.get("start_s")) and num(r.get("end_s")) and 0 <= r["start_s"] < r["end_s"]):
            out.bad(f"reaction ref {rid}: start_s and end_s are the exact range of the reaction in the post")
        g = r.get("generation_input")
        if g in (None, False):
            out.note(f"reaction ref {rid}: generation_input {g!r} is read as 'none' (the written performance only)")
        elif g not in ("face_replace", "none"):
            out.bad(f"reaction ref {rid}: generation_input is 'face_replace' or 'none', not {g!r}")
        if not (r.get("burned_in_text") is None or isinstance(r.get("burned_in_text"), str)):
            out.bad(f"reaction ref {rid}: burned_in_text is the visible text and where it is, or null")
        if ref_mode(r) != "face_replace":
            continue
        sha = r.get("video_sha256")
        if not (isinstance(sha, str) and re.fullmatch(r"[0-9a-f]{64}", sha)):
            out.bad(f"reaction ref {rid}: face_replace pins the clip: video_sha256 is its 64-hex checksum")
        elif verify_files:
            fp = os.path.join(ROOT, str(r.get("video_path")))
            if not os.path.exists(fp):
                out.bad(f"reaction ref {rid}: {r.get('video_path')} is not on disk")
            elif sha256_file(fp) != sha:
                out.bad(f"reaction ref {rid}: {r.get('video_path')} does not match its video_sha256 (it changed "
                        "after the plan was locked)")
            else:
                d = probe(fp)[0]
                if num(r.get("end_s")) and d and r["end_s"] > d + BEAT_TOL_S:
                    out.bad(f"reaction ref {rid}: the range ends at {r['end_s']} s; the clip is {d:.2f} s")


def check_reaction(plan, tag, b, first, perf, framing, layout, src, cast, ovs, ed, out):
    """A silent reaction (an X segment): the handle's own generated face reacts, with no
    voice and no lip sync. Founder, 2026-10-03: a reaction hook is never spoken; the hook
    is a timed text overlay over the face."""
    rx = b.get("reaction")
    if perf != "silent_action" or b.get("lines"):
        out.bad(f"{tag}: a reaction is silent (silent_action, no line); a reaction hook is never spoken")
    if not placeholder(b.get("narrator_ref")):
        out.bad(f"{tag}: a reaction has no voice and no narrator")
    if framing != "face":
        out.bad(f"{tag}: a reaction shows the face (framing face)")
    if layout != "sequence" or src or b.get("app_on_screen"):
        out.bad(f"{tag}: a reaction is the generated face alone: no source asset, no panel, no app")
    if cast not in ("human", "mascot"):
        out.bad(f"{tag}: a reaction is the face of the handle's approved generated character "
                "(cast_kind human or mascot)")
    if rx is None:
        out.bad(f"{tag}: no reference reaction yet (reaction null); a reaction is never invented, so "
                "production waits for the planned one")
    elif not isinstance(rx, dict):
        out.bad(f"{tag}: reaction is {{ref_id, framing, camera_distance, expression_beats}}")
    else:
        for k in RX_KEYS:
            if not rx.get(k):
                out.bad(f"{tag}: reaction has no '{k}'")
        r = reaction_refs(plan).get(rx.get("ref_id"))
        if not r and rx.get("ref_id"):
            out.bad(f"{tag}: reaction {rx.get('ref_id')!r} is not in reaction_refs")
        if r and ref_mode(r) == "face_replace":
            # The clip plays at 1x: no hold, no speed change. The room, clothes, hands and
            # camera are the clip's; only the face changes.
            if num(r.get("start_s")) and num(r.get("end_s")) and \
                    abs((b["end_s"] - b["start_s"]) - (r["end_s"] - r["start_s"])) > BEAT_TOL_S:
                out.bad(f"{tag}: a face-replace beat lasts its clip's range, {r['end_s'] - r['start_s']:g} s "
                        f"(the beat is {b['end_s'] - b['start_s']:g} s)")
            if not placeholder(b.get("set_id")):
                out.bad(f"{tag}: a face-replace beat has no set_id: the room is the clip's")
        t = b["start_s"]
        for j, st in enumerate(rx.get("expression_beats") or [], 1):
            st = st if isinstance(st, dict) else {}
            for k in RX_STEP_KEYS:
                if st.get(k) in (None, "", []):
                    out.bad(f"{tag}: expression beat {j} has no '{k}'")
            s_, e_ = st.get("start_s"), st.get("end_s")
            if not (num(s_) and num(e_) and e_ > s_):
                out.bad(f"{tag}: expression beat {j}: start_s and end_s, end after start")
                continue
            if abs(s_ - t) > BEAT_TOL_S:
                out.bad(f"{tag}: expression beat {j} starts at {s_:g} s; the one before ends at {t:g} s")
            t = e_
            rs = st.get("ref_s")
            if r and not (isinstance(rs, list) and len(rs) == 2 and all(num(x) for x in rs) and rs[0] < rs[1]
                          and num(r.get("start_s")) and num(r.get("end_s"))
                          and r["start_s"] - BEAT_TOL_S <= rs[0] and rs[1] <= r["end_s"] + BEAT_TOL_S):
                out.bad(f"{tag}: expression beat {j}: ref_s is inside the reference range of {r.get('id')}")
        if rx.get("expression_beats") and abs(t - b["end_s"]) > BEAT_TOL_S:
            out.bad(f"{tag}: the expression beats end at {t:g} s; the beat ends at {b['end_s']:g} s")
    if first or b.get("role") == "hook":
        ch = str((ed.get("hook") or {}).get("channel", ""))
        if ch not in ("reaction", "text", "text_visual"):
            out.bad(f"{tag}: a reaction hook is never spoken; the hook channel is reaction (or text), not {ch!r}")
        if not any(o.get("role") == "hook" and num(o.get("start_s")) and num(o.get("end_s"))
                   and o["start_s"] < b["end_s"] and o["end_s"] > b["start_s"] for o in ovs):
            out.bad(f"{tag}: a reaction hook runs the hook as a timed text overlay (role hook) over the face")


def check_panels(tag, layout, panels, src, assets, out):
    if len(panels) < 2:
        out.bad(f"{tag}: {layout} has two panels or more")
    pids = set()
    for p in panels:
        pid = p.get("id")
        if placeholder(pid) or pid in pids:
            out.bad(f"{tag}: panel id {pid!r} is missing or used twice")
        pids.add(pid)
        r = p.get("rect")
        if not (isinstance(r, list) and len(r) == 4 and all(num(x) for x in r)
                and r[0] >= 0 and r[1] >= 0 and r[2] > 0 and r[3] > 0
                and r[0] + r[2] <= 1.001 and r[1] + r[3] <= 1.001):
            out.bad(f"{tag}: panel {pid}: rect is [x, y, w, h] as shares of the 9:16 frame")
            continue
        aid = p.get("asset_id")
        if aid is not None:
            if aid not in src:
                out.bad(f"{tag}: panel {pid}: asset {aid!r} is not in the beat's source_asset_ids")
            a = assets.get(aid)
            rng = p.get("source_range_s")
            if a and not (isinstance(rng, list) and len(rng) == 2 and all(num(x) for x in rng) and rng[0] < rng[1]):
                out.bad(f"{tag}: panel {pid}: source_range_s is [in, out] of the asset")
            elif a and a.get("kind") != "still" and not within(rng, asset_range(a)):
                out.bad(f"{tag}: panel {pid}: {rng} is outside the approved range {asset_range(a)} of {aid}")
        if not num(p.get("sync_offset_s", 0)):
            out.bad(f"{tag}: panel {pid}: sync_offset_s is seconds")
    if layout == "split_screen":
        rs = [p["rect"] for p in panels if isinstance(p.get("rect"), list) and len(p["rect"]) == 4]
        for i in range(len(rs)):
            for j in range(i + 1, len(rs)):
                a, b = rs[i], rs[j]
                if a[0] < b[0] + b[2] - 1e-3 and b[0] < a[0] + a[2] - 1e-3 and \
                   a[1] < b[1] + b[3] - 1e-3 and b[1] < a[1] + a[3] - 1e-3:
                    out.bad(f"{tag}: split_screen panels overlap; picture_in_picture is the layout for an inset")


def check_overlays(plan, beats, length, assets, ed, out):
    ovs = plan.get("overlays") or []
    seen = set()
    panels = {p.get("id") for b in beats for p in b.get("panels") or []}
    heroes = {norm(v) for v in (plan.get("hero_strings") or {}).values() if not placeholder(v)}
    series = ed.get("series") if isinstance(ed.get("series"), dict) else None
    for o in ovs:
        oid = o.get("id")
        tag = f"overlay {oid}"
        if placeholder(oid) or oid in seen:
            out.bad(f"overlay id {oid!r} is missing or used twice")
        seen.add(oid)
        if o.get("role") not in OVERLAY_ROLES:
            out.bad(f"{tag}: role {o.get('role')!r}; one of {', '.join(sorted(OVERLAY_ROLES))}")
        if placeholder(o.get("text")):
            out.bad(f"{tag}: no text; the exact words are frozen in the plan")
        s, e = o.get("start_s"), o.get("end_s")
        if not (num(s) and num(e) and e > s and s >= 0 and (not length or e <= length + BEAT_TOL_S)):
            out.bad(f"{tag}: start_s and end_s inside the video")
            continue
        if o.get("placement") not in PLACEMENTS:
            out.bad(f"{tag}: placement {o.get('placement')!r}; one of {', '.join(sorted(PLACEMENTS))} "
                    "(never the lower band of the captions)")
        if o.get("placement") == "panel" and o.get("panel_id") not in panels:
            out.bad(f"{tag}: panel_id {o.get('panel_id')!r} is not a panel of any beat")
        need = max(MIN_OVERLAY_S, words(o.get("text")) / READ_WORDS_PER_S)
        if e - s < need - 1e-6:
            out.bad(f"{tag}: {words(o.get('text'))} words for {e - s:g} s; it needs {need:.1f} s to be read")
        if norm(o.get("text")) in heroes:
            out.bad(f"{tag}: the text is a hero string; the app's real words come from the real screen, "
                    "never from an overlay")
        if re.search(r"\d", str(o.get("text"))) and o.get("role") not in NUMBER_EXEMPT_ROLES \
                and not o.get("fact_refs"):
            out.bad(f"{tag}: a number on screen names its fact_refs (the sourced fact it states)")
        if o.get("fact_refs") is not None and not (isinstance(o["fact_refs"], list)
                                                  and all(isinstance(x, str) and x for x in o["fact_refs"])):
            out.bad(f"{tag}: fact_refs is a list of fact ids")
        if o.get("role") == "day_counter":
            if not series:
                out.bad(f"{tag}: a day counter belongs to a progress_log series")
            elif str(series.get("day")) not in re.findall(r"\d+", str(o.get("text"))):
                out.bad(f"{tag}: the counter says {o.get('text')!r}; the series is at day {series.get('day')}")
    if series and not any(o.get("role") == "day_counter" for o in ovs):
        out.bad("a progress_log series shows its day_counter overlay")
    # A third party's clip is credited while it is on screen.
    for b in beats:
        for aid in b.get("source_asset_ids") or []:
            a = assets.get(aid) or {}
            if a.get("origin") in NEEDS_CREDIT and not any(
                    o.get("role") == "source_credit" and num(o.get("start_s")) and num(o.get("end_s"))
                    and o["start_s"] < b.get("end_s", 0) and o["end_s"] > b.get("start_s", 0) for o in ovs):
                out.bad(f"beat {b.get('id')}: {aid} is a {a.get('origin')} clip; a source_credit overlay "
                        "runs while it is on screen")
    hook = ed.get("hook") or {}
    if (str(hook.get("channel", "")).startswith("text") or hook.get("channel") == "reaction") and beats:
        first_end = beats[0].get("end_s") or 0
        if not any(o.get("role") == "hook" and num(o.get("start_s")) and o["start_s"] < first_end for o in ovs):
            out.bad(f"the hook channel is {hook.get('channel')}: a hook overlay starts in the first beat")


def check_live(plan, beats, assets, ed, out):
    """A real input and its real result: a camera clip and the app recording that read it,
    with the measured times. Never a live analysis made from unrelated clips."""
    paired = {aid: a for aid, a in assets.items() if a.get("paired_input_ref")}
    for aid, a in paired.items():
        pr = a["paired_input_ref"]
        if a.get("kind") != "screen":
            out.bad(f"asset {aid}: paired_input_ref belongs to the app recording (kind screen)")
        clip = assets.get(pr.get("asset_id"))
        if not clip or clip.get("kind") not in ("clip", "still"):
            out.bad(f"asset {aid}: paired_input_ref.asset_id names the supplied camera clip or still of the input")
            continue
        if clip.get("origin") not in LIVE_INPUT_ORIGINS:
            out.bad(f"asset {aid}: the input is the user's own capture, not {clip.get('origin')}")
        it, ot = pr.get("input_t_s"), pr.get("output_t_s")
        if not (num(it) and num(ot)):
            out.bad(f"asset {aid}: paired_input_ref has the measured input_t_s (in the clip) and output_t_s "
                    "(in the recording)")
            continue
        if clip.get("kind") == "clip" and not within([it, it], asset_range(clip)):
            out.bad(f"asset {aid}: input_t_s {it} is outside the clip's approved range")
        if not within([ot, ot], asset_range(a)):
            out.bad(f"asset {aid}: output_t_s {ot} is outside the recording's approved range")
        both = [b for b in beats if aid in (b.get("source_asset_ids") or [])
                or pr.get("asset_id") in (b.get("source_asset_ids") or [])]
        if not any(aid in (b.get("source_asset_ids") or []) for b in both) or \
           not any(pr.get("asset_id") in (b.get("source_asset_ids") or []) for b in both):
            out.bad(f"asset {aid}: the paired clip and recording are both shown (in the beats' source_asset_ids)")
    if ed.get("filming_format") == "live_use":
        if not paired:
            out.bad("filming_format live_use needs a real input clip and its app recording, paired with the "
                    "measured times (assets[].paired_input_ref)")
        for b in beats:
            for aid in b.get("source_asset_ids") or []:
                if (assets.get(aid) or {}).get("kind") == "screen" and aid not in paired:
                    out.bad(f"beat {b.get('id')}: in a live_use video the recording {aid} is paired with its input")


def check_planning_approval(plan, out):
    """A locked plan carries the user's approval of its exact content. A draft (no
    approval words yet, as the planning skills check it) has nothing to match. A dry run
    of the lock is never an approval."""
    vd = os.path.join(ROOT, "pipeline", "character", str(plan.get("video_id")))
    p = os.path.join(vd, "planning-approval.json")
    if "approved" in plan and os.path.exists(p) and load(p).get("dry_run"):
        out.bad("planning-approval.json is a dry run (dry_run true): a rehearsal of the lock, not the user's "
                "approval; lock the plan with the user's words")
        return
    if placeholder((plan.get("approved") or {}).get("words")):
        out.note("not approved yet: the planning approval and its digest are checked once the plan is locked")
        return
    if not os.path.exists(p):
        out.bad("no planning-approval.json beside the v2 plan: the user's approval of this exact revision")
        return
    pa = load(p)
    if pa.get("video_id") != plan.get("video_id") or pa.get("revision") != plan.get("revision"):
        out.bad(f"planning-approval.json is for {pa.get('video_id')} revision {pa.get('revision')}; "
                f"the plan is revision {plan.get('revision')}")
    if pa.get("content_sha256") != digest(plan):
        out.bad("the plan's content does not match the approved digest (planning-approval.json content_sha256): "
                "an edit after approval needs a new revision and approval")
    ap = plan.get("approved") or {}
    if pa.get("words") != ap.get("words") or pa.get("date") != ap.get("date"):
        out.bad("plan.approved and planning-approval.json give different words or dates")


# ---------------------------------------------------------------------------- the video
def seg_name(s):
    return f"{int(s.get('n')):02d}-{str(s.get('type', '')).lower()}"


def seg_lines(s):
    sl = s.get("script_lines") or []
    return [x.strip() for x in sl.split(",") if x.strip()] if isinstance(sl, str) else list(sl)


def planned_length(s, shot, plan, assets, rows):
    """The planned seconds of one segment of video.json."""
    t = str(s.get("type", "")).upper()
    if num(s.get("planned_s")):
        return float(s["planned_s"])
    if t == "C":
        r = s.get("source_range_s") or []
        if (assets.get(s.get("asset_id")) or {}).get("kind") == "still":
            return float(s.get("still_s") or 0) or None
        return float(r[1] - r[0]) if len(r) == 2 else None
    if t == "M":
        if num(s.get("duration_s")):
            return float(s["duration_s"])
        ls = [p["source_range_s"][1] - p["source_range_s"][0] + float(p.get("sync_offset_s") or 0)
              for p in s.get("panels") or [] if len(p.get("source_range_s") or []) == 2]
        return max(ls) if ls else None
    if t in ("R", "P"):
        if s.get("trim"):
            return float(s["trim"][1] - s["trim"][0])
        return (rows.get(s.get("screen_id")) or {}).get("duration_s")
    sv = (shot or {}).get("video") or {}
    tt = sv.get("trim_to_seconds")
    return float(tt) if num(tt) else (float(sv["duration_seconds"]) if num(sv.get("duration_seconds")) else None)


def audio_kind(ref):
    if not ref:
        return None
    if ref.startswith("asset:"):
        return "asset"
    if ref.startswith("narration:"):
        return "narration"
    return "project"


def check_video(plan, v, shots, out):
    """P1's video.json and shot files against the v2 plan."""
    if not is_v2(plan):
        return
    beats = plan.get("beats") or []
    bidx = {b.get("id"): i for i, b in enumerate(beats)}
    bmap = {b.get("id"): b for b in beats}
    lines = {l.get("id"): l for l in plan.get("script") or []}
    assets = {a.get("id"): dict(a) for a in plan.get("assets") or []}
    for a in assets.values():
        fp = asset_path(a)
        if fp and os.path.exists(fp) and "_duration" not in a:
            a["_duration"] = probe(fp)[0]
    narrators = {n.get("id"): n for n in plan.get("narrators") or []}
    world = world_of(plan)
    subjects = {s.get("id"): s for s in world.get("fixed_subjects") or []}
    rows = screen_rows(plan)
    pins = pin_ids(plan)
    if v.get("plan_revision") != plan.get("revision") or v.get("plan_sha256") != digest(plan):
        out.bad("video.json is stale: plan_revision and plan_sha256 are those of another plan revision "
                "(rewrite it from the current plan)")
    # Which segment carries which beat.
    segs = v.get("segments") or []
    covered, last_first = {}, -1
    timeline, t = [], 0.0
    for s in segs:
        name = seg_name(s)
        ty = str(s.get("type", "")).upper()
        bids = s.get("beat_ids") or []
        if not bids:
            out.bad(f"{name}: beat_ids names the plan beats this segment carries")
            continue
        bad_ids = [b for b in bids if b not in bmap]
        if bad_ids:
            out.bad(f"{name}: beat(s) {bad_ids} are not in the plan")
            continue
        ix = sorted(bidx[b] for b in bids)
        if ix != list(range(ix[0], ix[-1] + 1)):
            out.bad(f"{name}: its beats are not consecutive")
        if ix[0] < last_first:
            out.bad(f"{name}: carries beat {bids[0]} before an earlier segment's beat (order of the plan)")
        last_first = max(last_first, ix[0])
        for b in bids:
            covered.setdefault(b, []).append(len(timeline))
        shot = shots.get(name)
        d = planned_length(s, shot, plan, assets, rows)
        if d is None:
            out.bad(f"{name}: no planned length (planned_s, the shot's duration, or the source range)")
            d = 0.0
        timeline.append({"seg": s, "name": name, "type": ty, "beats": bids, "start": t, "end": t + d, "shot": shot,
                         "first": not timeline})
        t += d
    missing = [b.get("id") for b in beats if b.get("id") not in covered]
    if missing:
        out.bad(f"plan beats no segment carries: {', '.join(missing)}")
    check_timing(plan, beats, timeline, covered, out)
    for it in timeline:
        check_segment_against_beats(plan, it, bmap, lines, assets, narrators, subjects, rows, pins, out)
    check_video_overlays(plan, v, out)
    check_video_live(plan, timeline, assets, out)


def check_timing(plan, beats, timeline, covered, out):
    """Segments that share beats form groups; each group spans the same seconds as its
    beats. Inside a group, P1 places the cut."""
    seen, groups = set(), []
    for b in beats:
        bid = b.get("id")
        if bid in seen or bid not in covered:
            continue
        segs, bs, stack = set(), set(), [bid]
        while stack:
            x = stack.pop()
            if x in bs:
                continue
            bs.add(x)
            for si in covered.get(x, []):
                if si not in segs:
                    segs.add(si)
                    stack += [y for y in timeline[si]["beats"] if y not in bs]
        seen |= bs
        groups.append((sorted(segs), bs))
    for segs, bs in groups:
        bb = [b for b in beats if b.get("id") in bs]
        ps, pe = min(b["start_s"] for b in bb), max(b["end_s"] for b in bb)
        vs, ve = timeline[segs[0]]["start"], timeline[segs[-1]]["end"]
        tol = max(0.5, 0.1 * (pe - ps))
        where = f"beat(s) {', '.join(sorted(bs, key=lambda x: [b.get('id') for b in beats].index(x)))}"
        for label, want, got in (("start", ps, vs), ("end", pe, ve)):
            if abs(want - got) > tol:
                out.bad(f"{where}: the segments {label} at {got:.2f} s; the plan has {want:g} s "
                        f"(tolerance {tol:.2f} s)")
            elif abs(want - got) > 0.25:
                out.note(f"{where}: the segments {label} at {got:.2f} s against {want:g} s in the plan")
    length = (plan.get("format") or {}).get("length_s")
    if timeline and num(length):
        total = timeline[-1]["end"]
        if abs(total - length) > max(1.0, 0.05 * length):
            out.bad(f"the segments plan {total:.2f} s; the plan's length is {length} s")


def check_segment_against_beats(plan, it, bmap, lines, assets, narrators, subjects, rows, pins, out):
    s, name, ty, shot = it["seg"], it["name"], it["type"], it["shot"] or {}
    bb = [bmap[b] for b in it["beats"]]
    perfs = {b.get("performance") for b in bb}
    framings = {b.get("framing") for b in bb}
    beat_lines = [l for b in bb for l in b.get("lines") or []]
    sl = [l for l in seg_lines(s) if l != "demo-vo"]
    extra = [l for l in sl if l not in beat_lines]
    if extra:
        out.bad(f"{name}: speaks {extra}, which its beats do not carry")
    src = {a for b in bb for a in b.get("source_asset_ids") or []}
    app_beats = [b for b in bb if b.get("app_on_screen")]
    af = s.get("audio_from")
    # Performance: the type of segment honours it; nothing silent is relabelled as talk.
    if ty == "T" and perfs - {"on_camera"}:
        out.bad(f"{name}: a T segment talks on camera; its beats are {sorted(perfs)}")
    if ty == "B":
        if "on_camera" in perfs:
            out.bad(f"{name}: a B segment is silent; an on_camera beat is a T segment")
        if app_beats:
            out.bad(f"{name}: the app is never shown in a generated action; use a phone insertion type")
        fk = shot.get("framing_kind")
        if fk not in framings or len(framings) != 1:
            out.bad(f"{name}: the shot's framing_kind {fk!r} is not the beats' framing {sorted(framings)}")
    # A silent reaction: one reaction beat, the handle's face, no voice, the written
    # performance copied exactly.
    rx_beats = [b for b in bb if "reaction" in b]
    if ty == "X":
        if len(bb) != 1 or len(rx_beats) != 1:
            out.bad(f"{name}: an X segment carries exactly one reaction beat")
        if sl or af:
            out.bad(f"{name}: a reaction is never spoken: no line, no audio_from, no voice")
        if shot.get("framing_kind") != "face":
            out.bad(f"{name}: a reaction shows the face (framing_kind face)")
        if rx_beats and shot.get("reaction") != rx_beats[0]["reaction"]:
            out.bad(f"{name}: the shot's reaction is not beat {rx_beats[0].get('id')}'s reaction, copied exactly "
                    "(the written performance)")
        fr = face_replace_ref(plan, rx_beats[0]) if rx_beats else None
        fx = shot.get("face_replace")
        if fr:
            check_face_replace_shot(name, fr, fx, out)
        elif fx:
            out.bad(f"{name}: the reference's generation_input is none: the written performance route, no clip "
                    "(no face_replace block)")
    elif rx_beats:
        out.bad(f"{name}: beat {rx_beats[0].get('id')} is a silent reaction; it is an X segment, not {ty}")
    if ty != "X" and it.get("first") and ((plan.get("editorial") or {}).get("hook") or {}).get("channel") == "reaction":
        out.bad(f"{name}: the hook is a reaction; the first segment is an X segment")
    # The real app full frame is a recording, never a generated picture.
    if "app_screen" in framings and ty not in ("R", "P"):
        out.bad(f"{name}: its beats are framing app_screen (the real app full frame): an R or P segment")
    if "silent_action" in perfs and perfs <= {"silent_action"} and (sl or audio_kind(af) == "narration"):
        out.bad(f"{name}: its beats are silent_action; it carries no line and no narration")
    # Voice-over beats: the narration comes from the bound narrator.
    for b in bb:
        if b.get("performance") != "voiceover" or not (set(b.get("lines") or []) & set(sl)):
            continue
        n = narrators.get(beat_narrator(plan, b)) or {}
        k = n.get("kind")
        if ty == "T":
            continue
        if k == "original_synthetic" and audio_kind(af) != "narration":
            out.bad(f"{name}: beat {b.get('id')} is narrated by {n.get('id')}: audio_from 'narration:<take>'")
        if k == "character" and audio_kind(af) != "project":
            out.bad(f"{name}: beat {b.get('id')} is narrated by the character: audio_from '<video>.<seg>', "
                    "her approved performance")
        if k == "supplied_speaker":
            ok = (af == f"asset:{n.get('source_ref')}") or (ty == "C" and s.get("asset_id") == n.get("source_ref")
                                                              and not af)
            if not ok:
                out.bad(f"{name}: beat {b.get('id')} is the supplied speaker's own voice "
                        f"(asset {n.get('source_ref')})")
    if ty in ("B", "C", "M", "R") and sl and not af and not (ty == "C" and s.get("asset_id") in
                                                              {n.get("source_ref") for n in narrators.values()}):
        out.bad(f"{name}: speaks lines but has no audio_from")
    # The generated pictures: action, subjects, set, framing.
    if ty in ("T", "B", "X", "O", "G", "S", "H", "F") and shot:
        said = norm(" ".join([str(shot.get("action") or "")] +
                             [str(x.get("action") or "") for x in (shot.get("video") or {}).get("beats") or []]))
        for b in bb:
            if not placeholder(b.get("action")) and norm(b["action"]) not in said:
                out.bad(f"{name}: the shot does not carry beat {b.get('id')}'s action, word for word: "
                        f"{b['action']!r}")
        want = {x for b in bb for x in b.get("subject_ids") or []}
        have = set(shot.get("fixed_subjects_in_shot") or [])
        if want != have:
            out.bad(f"{name}: fixed subjects in the shot {sorted(have)}; the beats show {sorted(want)} "
                    "(exact ids and count)")
        for x in have:
            if (subjects.get(x) or {}).get("origin") == "real":
                out.bad(f"{name}: {x} is a real animal; never generated (supplied footage only)")
        sets_ = {b.get("set_id") for b in bb if not placeholder(b.get("set_id"))}
        if sets_ and shot.get("set_ref") not in sets_:
            out.bad(f"{name}: set_ref {shot.get('set_ref')!r}; the beats are in {sorted(sets_)}")
        if ty == "T" and framings != {"face"}:
            out.bad(f"{name}: a T segment shows the face; the beats are {sorted(framings)}")
    # Supplied media.
    if ty == "C":
        a = assets.get(s.get("asset_id"))
        if not a:
            out.bad(f"{name}: asset_id {s.get('asset_id')!r} is not in the plan's assets")
        else:
            if s.get("asset_id") not in src:
                out.bad(f"{name}: asset {s['asset_id']} is not a source asset of its beats")
            if a.get("kind") not in ("clip", "still"):
                out.bad(f"{name}: a C segment shows a clip or a still; {a['id']} is a {a.get('kind')} "
                        "(a screen is R or P)")
            rng = s.get("source_range_s")
            if a.get("kind") == "clip":
                if not (isinstance(rng, list) and len(rng) == 2 and all(num(x) for x in rng) and rng[0] < rng[1]):
                    out.bad(f"{name}: source_range_s is [in, out] of the clip")
                elif not within(rng, asset_range(a)):
                    out.bad(f"{name}: {rng} is outside the approved range {asset_range(a)} of {a['id']}")
            elif not num(s.get("still_s")):
                out.bad(f"{name}: a still is held for still_s seconds")
            want = {x for b in bb for x in b.get("subject_ids") or []}
            if want - set(a.get("subject_ids") or []):
                out.bad(f"{name}: the beats show {sorted(want)}; {a['id']} binds {sorted(a.get('subject_ids') or [])}")
        if s.get("insert"):
            ins = s["insert"]
            if plan.get("app_insertion") is not True:
                out.bad(f"{name}: a screen replacement in supplied footage needs app_insertion true")
            if not app_beats or ins.get("screen_id") not in {b.get("screen_id") for b in app_beats}:
                out.bad(f"{name}: insert.screen_id is the screen of its app beat")
    # The real screen.
    if ty in ("R", "P"):
        if not app_beats or s.get("screen_id") not in {b.get("screen_id") for b in app_beats}:
            out.bad(f"{name}: screen {s.get('screen_id')!r} is not the screen of its app beat(s)")
    if ty in ("O", "G", "S", "H", "F") and app_beats:
        sid = (shot.get("phone") or {}).get("screen_id")
        if sid not in {b.get("screen_id") for b in app_beats}:
            out.bad(f"{name}: phone.screen_id {sid!r} is not the screen of its app beat(s)")
    if app_beats and ty in ("T", "B", "X", "C") and not (ty == "C" and s.get("insert")):
        if len(bb) == len(app_beats):
            out.bad(f"{name}: its beats show the app; a {ty} segment does not (O, G, S, H, F, R, P, or M "
                    "with the recording as a panel)")
    # Panels.
    layouts = {b.get("layout", "sequence") for b in bb}
    if ty == "M":
        if layouts == {"sequence"}:
            out.bad(f"{name}: an M segment carries a split_screen or picture_in_picture beat")
        planned = {p.get("id"): p for b in bb for p in b.get("panels") or []}
        got = {p.get("id"): p for p in s.get("panels") or []}
        if set(planned) != set(got):
            out.bad(f"{name}: panels {sorted(got)}; the plan has {sorted(planned)}")
        for pid, p in planned.items():
            g = got.get(pid) or {}
            for k in ("asset_id", "source_range_s", "rect", "crop"):
                if k in p and g.get(k) != p.get(k):
                    out.bad(f"{name}: panel {pid} {k} {g.get(k)!r}; the plan has {p.get(k)!r}")
            if float(g.get("sync_offset_s") or 0) != float(p.get("sync_offset_s") or 0):
                out.bad(f"{name}: panel {pid} sync_offset_s differs from the plan")
            if p.get("asset_id") is None and placeholder(g.get("project")) and placeholder(g.get("screen_id")):
                out.bad(f"{name}: panel {pid} is generated in the plan: it names its approved project (B)")
    elif layouts - {"sequence"}:
        out.bad(f"{name}: its beats are {sorted(layouts - {'sequence'})}; they are built as one M segment")


MASK_HOW = {"crop", "blur", "box"}
FR_ROUTES = ("edit", "guided")      # models.json face_replace.routes


def check_face_replace_shot(name, r, fx, out):
    """The X shot of a face-replace reaction: its route, the trimmed, masked copy of the
    reference clip that shots.py reference writes, and the masks over its burned-in text."""
    if not isinstance(fx, dict):
        out.bad(f"{name}: a face-replace reaction names its clip: face_replace {{ref_id, route, clip, range_s, masks}}")
        return
    if fx.get("route") not in FR_ROUTES:
        out.bad(f"{name}: face_replace.route {fx.get('route')!r}; it is edit (Wan 2.7 Edit Video: the clip is the "
                "source video, its frames and timing stay) or guided (MiniMax H3: a new clip guided by the clip, "
                "trimmed to its length)")
    if fx.get("ref_id") != r.get("id"):
        out.bad(f"{name}: face_replace.ref_id {fx.get('ref_id')!r}; the beat's reference is {r.get('id')}")
    if fx.get("range_s") != [r.get("start_s"), r.get("end_s")]:
        out.bad(f"{name}: face_replace.range_s {fx.get('range_s')}; the reference range is "
                f"[{r.get('start_s')}, {r.get('end_s')}]")
    if fx.get("clip") != f"segments/{name}/source/reference.mp4":
        out.bad(f"{name}: face_replace.clip is segments/{name}/source/reference.mp4 (shots.py reference), "
                "never the research file")
    masks = fx.get("masks")
    if not isinstance(masks, list):
        out.bad(f"{name}: face_replace.masks is a list (empty when the range has no burned-in text)")
        masks = []
    for m in masks:
        rc = m.get("rect") if isinstance(m, dict) else None
        if not (isinstance(rc, list) and len(rc) == 4 and all(num(x) for x in rc) and rc[2] > 0 and rc[3] > 0
                and rc[0] >= 0 and rc[1] >= 0 and rc[0] + rc[2] <= 1.001 and rc[1] + rc[3] <= 1.001):
            out.bad(f"{name}: a mask rect is [x, y, w, h] as shares of the frame")
            continue
        if m.get("how") not in MASK_HOW:
            out.bad(f"{name}: a mask is crop, blur or box, not {m.get('how')!r}")
        if m.get("how") == "crop" and not (rc[0] <= 0.001 or rc[1] <= 0.001 or rc[0] + rc[2] >= 0.999
                                           or rc[1] + rc[3] >= 0.999):
            out.bad(f"{name}: a crop mask lies at an edge of the frame; text in the middle is blurred or boxed")
    if not placeholder(r.get("burned_in_text")) and not masks:
        out.bad(f"{name}: the reference carries burned-in text ({r['burned_in_text']!r}); the shot masks it "
                "before generation (face_replace.masks)")


def check_video_overlays(plan, v, out):
    keys = ("id", "role", "text", "start_s", "end_s", "placement", "panel_id")
    want = [{k: o.get(k) for k in keys} for o in plan.get("overlays") or []]
    got = [{k: o.get(k) for k in keys} for o in v.get("overlays") or []]
    if want != got:
        out.bad("video.json overlays are not the plan's overlays, copied exactly")
    if want and (v.get("title_overlay") or {}).get("burn") is True:
        out.bad("a v2 video carries its text as overlays[]; title_overlay stays off")


def check_video_live(plan, timeline, assets, out):
    for aid, a in assets.items():
        pr = a.get("paired_input_ref")
        if not pr or not num(pr.get("input_t_s")) or not num(pr.get("output_t_s")):
            continue
        cid = pr["asset_id"]
        offset = pr["output_t_s"] - pr["input_t_s"]
        done = False
        for it in timeline:
            s = it["seg"]
            if it["type"] == "M":
                ps = {p.get("asset_id"): p for p in s.get("panels") or []}
                if aid in ps and cid in ps:
                    sp, cp = ps[aid], ps[cid]
                    # The source time on screen at the same final moment: in - sync.
                    got = (sp["source_range_s"][0] - float(sp.get("sync_offset_s") or 0)) - \
                          (cp["source_range_s"][0] - float(cp.get("sync_offset_s") or 0))
                    if abs(got - offset) > SYNC_TOL_S:
                        out.bad(f"{it['name']}: the recording runs {got:+.2f} s against the clip; the measured "
                                f"offset is {offset:+.2f} s (paired_input_ref of {aid})")
                    done = True
        if done:
            continue
        cs = [it for it in timeline if it["type"] == "C" and it["seg"].get("asset_id") == cid]
        rs = [it for it in timeline if it["type"] in ("R", "P") and
              it["seg"].get("screen_id") == a.get("screen_id")]
        if not cs or not rs:
            out.bad(f"live pairing of {aid}: the clip {cid} (C) and the recording (R or P) are both in "
                    "video.json, or in one M segment")
            continue
        c, r = cs[0], rs[0]
        rng = c["seg"].get("source_range_s") or [0, 0]
        if not (rng[0] - 0.01 <= pr["input_t_s"] <= rng[1] + 0.01):
            out.bad(f"{c['name']}: the clip's range {rng} does not show the input at {pr['input_t_s']} s")
        tr = r["seg"].get("trim") or [0, 1e9]
        if not (tr[0] - 0.01 <= pr["output_t_s"] <= tr[1] + 0.01):
            out.bad(f"{r['name']}: the recording's trim {tr} does not show the result at {pr['output_t_s']} s")
        if r["start"] < c["start"]:
            out.bad(f"{r['name']}: the result comes before its input ({c['name']})")


# ---------------------------------------------------------------------------- cli
def vdir(video):
    return os.path.join(ROOT, "pipeline", "character", video)


def plan_of(video):
    p = os.path.join(vdir(video), "plan.json")
    if not os.path.exists(p):
        sys.exit(f"no pipeline/character/{video}/plan.json")
    return load(p)


def finish(out):
    print()
    if out.problems:
        print(f"{len(out.problems)} problem(s). Fix them before going on.")
        sys.exit(1)
    print("ok" + (f", {len(out.notes)} note(s)" if out.notes else ""))


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        sys.exit(__doc__)
    cmd, arg = a[0], a[1]
    out = Out()
    if cmd == "digest":
        print(digest(load(arg)))
        return
    plan = plan_of(arg)
    if cmd == "plan":
        print(f"plan  pipeline/character/{arg}/plan.json")
        check_plan(plan, out)
    elif cmd == "assets":
        print(f"assets of {arg}")
        check_assets(plan, out, True)
        if not out.problems:
            out.good(f"{len(plan.get('assets') or [])} asset(s) on disk, checksums match")
    elif cmd == "video":
        vp = os.path.join(vdir(arg), "video.json")
        if not os.path.exists(vp):
            sys.exit(f"no pipeline/character/{arg}/video.json")
        if not is_v2(plan):
            out.note("legacy plan: the bridge compares nothing (shots.py validate keeps the v1 checks)")
        else:
            d = os.path.join(vdir(arg), "shots")
            shots = {f[:-5]: load(os.path.join(d, f)) for f in sorted(os.listdir(d))
                     if f.endswith(".json")} if os.path.isdir(d) else {}
            print(f"video.json against the plan, revision {plan.get('revision')}")
            check_video(plan, load(vp), shots, out)
            if not out.problems:
                out.good("timing, words, performance, actions, subjects, panels and overlays as planned")
    else:
        sys.exit(__doc__)
    finish(out)


if __name__ == "__main__":
    main()
