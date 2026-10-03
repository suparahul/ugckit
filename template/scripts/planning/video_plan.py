#!/usr/bin/env python3
"""Video planning: the checks, the review page and the lock of one planned character
video. Free, local: no generation, no network, no production state.

    video_plan.py catalogue [<slug>]                 taxonomy version and catalogue digest
    video_plan.py brief  <brief.json>                the brief against the taxonomy
    video_plan.py check  <plan.draft.json|plan.json> the planning contract (must pass to lock)
    video_plan.py review <plan.draft.json>           write REVIEW.md beside the draft, from the
                                                     exact draft and its brief.json
    video_plan.py ready  <plan.draft.json|plan.json> what production still needs: blocking
                                                     inputs, part-A dependencies, bridge
                                                     capabilities; then the bridge's own check
    video_plan.py pin    <plan.draft.json>           fill each supplied asset's sha256 from its
                                                     file (before the review; it changes the digest)
    video_plan.py digest <plan json>                 the content digest the approval pins
    video_plan.py lock   <plan.draft.json> --digest <hex> --words "<the user's words>" --date YYYY-MM-DD
    video_plan.py lock   <plan.draft.json> --digest <hex> --dry-run

The draft lives in apps/<slug>/production/video-plans/<video>/ with its brief.json. The
lock writes pipeline/character/<video>/plan.json and planning-approval.json and stops: it
never runs shots.py (which starts production state) and never edits a production file.
A lock refuses while the contract fails or a blocking input is missing. --dry-run writes
an unapproved plan (approved words null) so the user can see the handoff; production
refuses it at its approval check, as it must.

The contract is § 5 of the planning design (schema_version 2); the controlled values are
brain/video-patterns.json. The production bridge (scripts/character/bridge.py) owns the
production-side check; its digest and ours are the same function.
"""
import argparse, hashlib, json, os, re, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PATTERNS = os.path.join(ROOT, "brain", "video-patterns.json")
SCHEMA = os.path.join(ROOT, "docs", "character", "plan.schema.json")
CAPS = os.path.join(ROOT, "scripts", "character", "capabilities.json")

MAX_WORDS_PER_S = 15 / 4        # the speech ceiling
READ_WORDS_PER_S = 3.0          # an overlay stays up words / 3 s
MIN_OVERLAY_S = 1.0
TOL = 0.05
EDITORIAL_KEYS = ["objective", "distribution", "lane", "filming_format", "hook", "recipe_id",
                  "product", "app_presence", "proof", "close", "cast_kind", "narrator_ref",
                  "series", "comparison_mode", "experiment", "strategy_ref", "evidence_ids",
                  "taxonomy_version", "catalogue_digest"]
BEAT_KEYS = ["id", "role", "start_s", "end_s", "lines", "action", "performance", "framing",
             "layout", "app_on_screen", "screen_id", "viewer_must", "fact_refs",
             "source_asset_ids", "subject_ids", "set_id"]


def load(p):
    with open(p) as f:
        return json.load(f)


def taxonomy():
    t = load(PATTERNS)
    t["_by_id"] = {p["id"]: p for p in t["patterns"]}
    return t


def catalogue(slug=None):
    """(taxonomy_version, digest): the inbuilt catalogue plus the app's local overlay."""
    h = hashlib.sha256(open(PATTERNS, "rb").read())
    local = os.path.join(ROOT, "apps", slug, "niche", "video", "patterns.json") if slug else None
    if local and os.path.exists(local):
        h.update(open(local, "rb").read())
    return load(PATTERNS)["taxonomy_version"], "sha256:" + h.hexdigest()


def digest(plan):
    """The content digest: sha256 of the canonical JSON of the plan without `approved`.
    The same function as scripts/character/bridge.py digest; lock checks they agree."""
    body = {k: v for k, v in plan.items() if k != "approved"}
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def words(text):
    return len(str(text or "").split())


def norm(text):
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", str(text or "").lower().replace("’", "'"))).strip()


def placeholders(obj, path=""):
    """Every string that still holds template text (<...>)."""
    out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            out += placeholders(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            out += placeholders(v, f"{path}[{i}]")
    elif isinstance(obj, str) and re.search(r"<[^>]*>", obj):
        out.append(path)
    return out


class Out:
    def __init__(self, quiet=False):
        self.bad, self.notes, self.quiet = [], [], quiet

    def no(self, m):
        self.bad.append(m)
        if not self.quiet:
            print(f"  ✗ {m}")

    def note(self, m):
        self.notes.append(m)
        if not self.quiet:
            print(f"  ! {m}")

    def ok(self, m):
        if not self.quiet:
            print(f"  ✓ {m}")


def brief_of(draft_path):
    p = os.path.join(os.path.dirname(os.path.abspath(draft_path)), "brief.json")
    return (load(p), p) if os.path.exists(p) else (None, p)


def name_in(text, names):
    t = norm(text).replace(" ", "")
    return any(n and n in t for n in names)


def app_names(plan, brief=None):
    names = {norm(plan.get("app")).replace(" ", "")}
    if brief and brief.get("product_name"):
        names.add(norm(brief["product_name"]).replace(" ", ""))
    return names - {""}


# ------------------------------------------------------------------------------- brief
def check_brief(b, out):
    t = taxonomy()
    S = t["slots"]
    for k in ("brief_version", "video_id", "app", "handle", "strategy_ref", "anatomy",
              "choices", "hook_alternatives", "selected_hook", "facts", "assets_needed",
              "screens_needed", "missing_inputs", "capability", "taxonomy_version", "catalogue_digest"):
        if k not in b:
            out.no(f"brief has no '{k}'")
    a = b.get("anatomy") or {}
    sr = b.get("strategy_ref") or {}
    if sr.get("disposition") not in S["strategy_disposition"]:
        out.no(f"strategy_ref.disposition {sr.get('disposition')!r}; one of {S['strategy_disposition']}")
    for slot, key in [("objective", "objective"), ("distribution", "distribution"), ("lane", "lane"),
                      ("app_presence", "app_presence"), ("close", "close"),
                      ("experiment_axis", None)]:
        if key and a.get(key) not in S[slot]:
            out.no(f"anatomy.{key} {a.get(key)!r}; one of {S[slot]}")
    ff = t["aliases"]["filming_format"].get(a.get("filming_format"), a.get("filming_format"))
    if ff not in S["filming_format"]:
        out.no(f"anatomy.filming_format {a.get('filming_format')!r}")
    hook = a.get("hook") or {}
    hp = t["_by_id"].get(hook.get("job_id"))
    if not hp or hp["kind"] != "hook":
        out.no(f"anatomy.hook.job_id {hook.get('job_id')!r} is not one of the twelve hook jobs")
    else:
        fill = hook.get("fill") or {}
        if set(fill) != set(hp["slots"]):
            out.no(f"hook {hp['id']} fills {sorted(hp['slots'])}; the brief fills {sorted(fill)}")
        for k, v in fill.items():
            if not isinstance(v, str) or not v.strip():
                out.no(f"hook fill slot {k} is empty")
        if ff and ff not in hp["allowed_formats"]:
            out.note(f"hook {hp['id']} is not listed for {ff}; say why in the choices")
    if hook.get("channel") not in S["hook_channel"]:
        out.no(f"anatomy.hook.channel {hook.get('channel')!r}")
    if not set(hook.get("framing") or []) <= set(S["hook_framing"]):
        out.no("anatomy.hook.framing outside the allowed modifiers")
    rp = t["_by_id"].get(a.get("recipe_id"))
    if not rp or rp["kind"] != "recipe":
        out.no(f"anatomy.recipe_id {a.get('recipe_id')!r} is not one of the eight recipes")
    else:
        if a.get("lane") not in rp["allowed_lanes"]:
            out.no(f"recipe {rp['id']} is for lanes {rp['allowed_lanes']}, not {a.get('lane')!r}")
        if ff not in rp["allowed_formats"]:
            out.no(f"recipe {rp['id']} is for formats {rp['allowed_formats']}, not {ff!r}")
    pr = a.get("product") or {}
    if pr.get("role") not in S["product_role"] or pr.get("timing") not in S["product_timing"]:
        out.no("anatomy.product role or timing outside the controlled values")
    if not set(pr.get("name_locations") or []) <= set(S["name_location"]):
        out.no("anatomy.product.name_locations outside speech, overlay, caption, bio")
    if (a.get("proof") or {}).get("kind") not in S["proof"]:
        out.no("anatomy.proof.kind outside the controlled values")
    cast = a.get("cast") or {}
    if cast.get("kind") not in S["cast_kind"]:
        out.no("anatomy.cast.kind outside human, mascot, none")
    lb = str(a.get("length_band"))
    if lb not in S["length_band"]:
        out.no(f"anatomy.length_band {lb!r}; one of {S['length_band']}")
    ln = a.get("length_s")
    lo, hi = (35, 60) if lb == "35-60" else ((float(lb), float(lb)) if lb in S["length_band"] else (0, 0))
    if not num(ln) or not (lo - TOL <= ln <= hi + TOL):
        out.no(f"anatomy.length_s {ln!r} is outside the band {lb}")
    alts = b.get("hook_alternatives") or []
    if not 1 <= len(alts) <= 3:
        out.no(f"{len(alts)} hook alternatives; one to three, within the chosen hook job")
    for h in alts:
        if h.get("job_id") != hook.get("job_id"):
            out.no(f"hook alternative {h.get('id')}: job {h.get('job_id')!r}; alternatives stay within {hook.get('job_id')!r}")
    if b.get("selected_hook") not in {h.get("id") for h in alts}:
        out.no(f"selected_hook {b.get('selected_hook')!r} is not one of the alternatives")
    for c in b.get("choices") or []:
        if c.get("status") not in S["choice_status"]:
            out.no(f"choice {c.get('slot')}: status {c.get('status')!r}; one of {S['choice_status']}")
    for f in b.get("facts") or []:
        if not f.get("id") or not f.get("source"):
            out.no(f"fact {f.get('id')!r} has no source")
    for m in b.get("missing_inputs") or []:
        if not (m.get("id") and m.get("what") and m.get("owner")):
            out.no(f"missing input {m!r} needs id, what and owner")
    tv, cd = catalogue(b.get("app"))
    if b.get("taxonomy_version") != tv or b.get("catalogue_digest") != cd:
        out.no(f"the brief pins taxonomy {b.get('taxonomy_version')} / {str(b.get('catalogue_digest'))[:19]}…; "
               f"the catalogue is now {tv} / {cd[:19]}…: re-check the choices, then re-pin")
    for p in placeholders(b):
        out.no(f"brief: template text left at {p}")
    if not out.bad:
        out.ok(f"brief {b.get('video_id')}: {hook.get('job_id')} hook, {a.get('recipe_id')} recipe, "
               f"{ff}, {len(alts)} hook alternative(s), {len(b.get('missing_inputs') or [])} missing input(s)")


# -------------------------------------------------------------------------- the contract
def check_contract(plan, out, brief=None):
    t = taxonomy()
    S = t["slots"]
    if plan.get("schema_version") != 2:
        out.no("schema_version is 2 for a planned video")
    rev = plan.get("revision")
    if not isinstance(rev, int) or isinstance(rev, bool) or rev < 1:
        out.no("revision is a positive whole number")
    for k in ("video_id", "app", "handle", "characters", "format", "app_insertion", "script", "beats",
              "set", "outfit", "hero_strings", "source", "editorial", "overlays", "assets", "narrators"):
        if k not in plan:
            out.no(f"plan has no '{k}'")
    fmt = plan.get("format") or {}
    length = fmt.get("length_s")
    if fmt.get("dimension") != "9:16":
        out.no("format.dimension is 9:16")
    if not num(length) or length <= 0:
        out.no("format.length_s is a number of seconds")
        length = None
    if not isinstance(plan.get("app_insertion"), bool):
        out.no("app_insertion is true or false")
    for p in placeholders(plan):
        out.no(f"template text left at {p}; a locked plan has no placeholders (a missing value is null "
               "and is listed by `ready`)")

    ed = plan.get("editorial") or {}
    for k in EDITORIAL_KEYS:
        if k not in ed:
            out.no(f"editorial has no '{k}'")
    ff = t["aliases"]["filming_format"].get(ed.get("filming_format"), ed.get("filming_format"))
    for slot, key, val in [("objective", "objective", ed.get("objective")),
                           ("distribution", "distribution", ed.get("distribution")),
                           ("lane", "lane", ed.get("lane")), ("filming_format", "filming_format", ff),
                           ("app_presence", "app_presence", ed.get("app_presence")),
                           ("close", "close", ed.get("close")), ("cast_kind", "cast_kind", ed.get("cast_kind"))]:
        if val not in S[slot]:
            out.no(f"editorial.{key} {val!r}; one of {S[slot]}")
    hook = ed.get("hook") or {}
    hp = t["_by_id"].get(hook.get("job_id"))
    if not hp or hp["kind"] != "hook":
        out.no(f"editorial.hook.job_id {hook.get('job_id')!r} is not a hook job")
    if hook.get("channel") not in S["hook_channel"]:
        out.no(f"editorial.hook.channel {hook.get('channel')!r}")
    framing = hook.get("framing") or []
    if not set(framing) <= set(S["hook_framing"]):
        out.no("editorial.hook.framing outside the allowed modifiers")
    rp = t["_by_id"].get(ed.get("recipe_id"))
    if not rp or rp["kind"] != "recipe":
        out.no(f"editorial.recipe_id {ed.get('recipe_id')!r} is not a recipe")
        rp = None
    elif ed.get("lane") not in rp["allowed_lanes"] or ff not in rp["allowed_formats"]:
        out.no(f"recipe {rp['id']} does not take lane {ed.get('lane')!r} with format {ff!r}")
    pr = ed.get("product") or {}
    if pr.get("role") not in S["product_role"]:
        out.no(f"editorial.product.role {pr.get('role')!r}")
    if pr.get("timing") not in S["product_timing"]:
        out.no(f"editorial.product.timing {pr.get('timing')!r}")
    if not set(pr.get("name_locations") or []) <= set(S["name_location"]):
        out.no("editorial.product.name_locations outside speech, overlay, caption, bio")
    proof = ed.get("proof") or {}
    if proof.get("kind") not in S["proof"]:
        out.no(f"editorial.proof.kind {proof.get('kind')!r}")
    if proof.get("kind") == "sourced_fact" and not proof.get("fact_refs"):
        out.no("a sourced_fact proof names its fact_refs")
    if ed.get("comparison_mode") not in S["comparison_mode"] + [None]:
        out.no(f"editorial.comparison_mode {ed.get('comparison_mode')!r}")
    if rp and rp["id"] == "state_change" and not ed.get("comparison_mode"):
        out.no("state_change sets comparison_mode")
    exp = ed.get("experiment") or {}
    if exp.get("axis") not in S["experiment_axis"]:
        out.no(f"editorial.experiment.axis {exp.get('axis')!r}")
    elif exp.get("axis") != "none" and not exp.get("base_video_id"):
        out.no("an experiment names its base video")
    tv, cd = catalogue(plan.get("app"))
    if ed.get("taxonomy_version") != tv or ed.get("catalogue_digest") != cd:
        out.no("editorial pins an older catalogue: re-check the brief's choices against the current one, then re-pin")
    if "professional_basis" in framing and not proof.get("fact_refs") and not any(
            n.get("kind") == "supplied_speaker" and n.get("credential_ref") for n in plan.get("narrators") or []):
        out.no("professional_basis needs a verified supplied speaker or a sourced fact")

    # Cast and narrators.
    chars = plan.get("characters") or []
    for c in chars:
        if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*@v\d+", str(c)):
            out.no(f"character pin {c!r} is <character>@v<n>")
    pins = {str(c).split("@")[0] for c in chars}
    ck = ed.get("cast_kind")
    if ck == "none" and chars:
        out.no("cast_kind none, but characters are pinned")
    if ck in ("human", "mascot") and not chars:
        out.no(f"cast_kind {ck}, but no character is pinned")
    narrators = {n.get("id"): n for n in plan.get("narrators") or []}
    for nid, n in narrators.items():
        if n.get("kind") not in ("character", "supplied_speaker", "original_synthetic"):
            out.no(f"narrator {nid}: kind {n.get('kind')!r}")
        if n.get("kind") != "supplied_speaker" and n.get("credential_ref"):
            out.no(f"narrator {nid}: only a supplied, verified speaker carries a credential")
    if ed.get("narrator_ref") is not None and ed["narrator_ref"] not in narrators:
        out.no(f"editorial.narrator_ref {ed['narrator_ref']!r} is not in narrators[]")

    # Assets.
    assets = {}
    for a in plan.get("assets") or []:
        if not a.get("id") or a["id"] in assets:
            out.no(f"asset id {a.get('id')!r} is missing or used twice")
            continue
        assets[a["id"]] = a
        if a.get("kind") not in ("clip", "still", "screen", "audio"):
            out.no(f"asset {a['id']}: kind {a.get('kind')!r}")
        if a.get("path") and os.path.isabs(a["path"]):
            out.no(f"asset {a['id']}: path is relative to the workspace")

    # Beats.
    lines = {l.get("id"): l for l in plan.get("script") or []}
    for lid, l in lines.items():
        if l.get("speaker") not in pins | {"vo"}:
            out.no(f"line {lid}: speaker {l.get('speaker')!r} is a pinned character or 'vo'")
        if not str(l.get("line") or "").strip():
            out.no(f"line {lid}: no words")
    names = app_names(plan, brief)
    beats = plan.get("beats") or []
    heroes = plan.get("hero_strings") or {}
    carried, roles, t_end, ids = {}, [], 0.0, set()
    app_beats = []
    for i, b in enumerate(beats, 1):
        bid = b.get("id") or f"#{i}"
        for k in BEAT_KEYS:
            if k not in b:
                out.no(f"beat {bid}: no '{k}'")
        if bid in ids:
            out.no(f"beat id {bid} used twice")
        ids.add(bid)
        s, e = b.get("start_s"), b.get("end_s")
        if not (num(s) and num(e) and e > s):
            out.no(f"beat {bid}: start_s and end_s are numbers, end after start")
            continue
        if abs(s - t_end) > TOL:
            out.no(f"beat {bid} starts at {s:g} s; the beat before ends at {t_end:g} s")
        t_end = e
        roles.append(b.get("role"))
        perf, fr, lay = b.get("performance"), b.get("framing"), b.get("layout")
        if perf not in S["performance"]:
            out.no(f"beat {bid}: performance {perf!r}")
        if fr not in S["framing"]:
            out.no(f"beat {bid}: framing {fr!r}")
        if lay not in S["layout"]:
            out.no(f"beat {bid}: layout {lay!r}")
        if b.get("media_origin") not in S["media_origin"] + [None]:
            out.no(f"beat {bid}: media_origin {b.get('media_origin')!r}")
        if not str(b.get("action") or "").strip():
            out.no(f"beat {bid}: no action (what the viewer sees)")
        bl = b.get("lines") or []
        for lid in bl:
            if lid not in lines:
                out.no(f"beat {bid}: line {lid} is not in the script")
            elif lid in carried:
                out.no(f"line {lid} is in beats {carried[lid]} and {bid}; a line belongs to one beat")
            carried.setdefault(lid, bid)
        n = sum(words(lines[l]["line"]) for l in bl if l in lines)
        if n / (e - s) > MAX_WORDS_PER_S + 1e-9:
            out.no(f"beat {bid}: {n} words in {e - s:g} s, over 15 words per 4 s")
        elif n and n / (e - s) > 3.4:
            out.note(f"beat {bid}: {n} words in {e - s:g} s is near the ceiling; no room for a pause")
        if perf == "silent_action" and bl:
            out.no(f"beat {bid}: a silent action carries no line")
        if perf in ("on_camera", "voiceover") and not bl:
            out.no(f"beat {bid}: {perf} carries its line")
        if perf == "on_camera" and fr != "face":
            out.no(f"beat {bid}: speech on camera shows the face")
        if perf == "voiceover" and not (b.get("narrator_ref") or ed.get("narrator_ref")):
            out.no(f"beat {bid}: a voiceover binds a narrator")
        nar = narrators.get(b.get("narrator_ref") or ed.get("narrator_ref"))
        if perf == "voiceover" and nar and nar.get("kind") == "original_synthetic" and fr == "face":
            out.no(f"beat {bid}: a synthetic narrator never speaks over a visible face")
        src = b.get("source_asset_ids") or []
        for aid in src:
            if aid not in assets:
                out.no(f"beat {bid}: asset {aid} is not in assets[]")
        generated = not src and lay == "sequence"
        if generated and fr == "face" and ck not in ("human", "mascot") and not b.get("app_on_screen"):
            out.no(f"beat {bid}: a generated face needs a pinned cast")
        if b.get("app_on_screen"):
            app_beats.append(b)
            if not plan.get("app_insertion"):
                out.no(f"beat {bid} shows the app; app_insertion is false")
            if not b.get("screen_id"):
                out.no(f"beat {bid} shows the app and names no screen_id")
            if b.get("viewer_must") not in S["viewer_task"]:
                out.no(f"beat {bid}: viewer_must is read, recognise or believe")
            if b.get("viewer_must") == "read" and b.get("screen_id") not in heroes:
                out.no(f"beat {bid}: the viewer reads screen {b.get('screen_id')}; hero_strings has no entry "
                       "(null until the real screen is indexed)")
        texts = [lines[l]["line"] for l in bl if l in lines]
        if any(re.search(r"\d", x) for x in texts) and not b.get("fact_refs") and not b.get("app_on_screen"):
            out.no(f"beat {bid}: a number is said; it needs fact_refs or the real screen")
        if (b.get("repeat_group") is not None) and not isinstance(b.get("item_index"), int):
            out.no(f"beat {bid}: a repeated item has its item_index")
    if length and abs(t_end - length) > TOL:
        out.no(f"the beats end at {t_end:g} s; the length is {length:g} s")
    for lid in lines:
        if lid not in carried:
            out.no(f"line {lid} is in no beat")

    # The recipe, in order.
    if rp:
        order = [s_["role"] for s_ in rp["slots"]]
        rep = {s_["role"] for s_ in rp["slots"] if s_.get("repeat")}
        comp = []
        for r in roles:
            if comp and comp[-1] == r:
                if r not in rep:
                    out.no(f"role {r} repeats; {rp['id']} has one {r} beat")
                continue
            comp.append(r)
        last = -1
        for r in comp:
            if r not in order:
                out.no(f"role {r!r} is not a beat of {rp['id']} ({' → '.join(order)})")
                continue
            if order.index(r) <= last:
                out.no(f"role {r} is out of the order of {rp['id']} ({' → '.join(order)})")
            last = max(last, order.index(r))
        for s_ in rp["slots"]:
            if s_["required"] and s_["role"] not in comp:
                out.no(f"{rp['id']} needs a {s_['role']} beat")

    # The app and its name.
    pres = ed.get("app_presence")
    if pres == "none" and app_beats:
        out.no("app_presence none, but beats show the app")
    if pres not in (None, "none") and not app_beats:
        out.no(f"app_presence {pres}, but no beat shows the app")
    if plan.get("app_insertion") and not app_beats:
        out.no("app_insertion true, but no beat shows the app")
    if pr.get("role") == "absent" and (app_beats or pr.get("speech_count")):
        out.no("product role absent, but the app is shown or named")
    spoken = [lid for lid, l in lines.items() if name_in(l.get("line"), names)]
    if len(spoken) != (pr.get("speech_count") or 0):
        out.no(f"the app is said in {len(spoken)} line(s) ({', '.join(spoken) or 'none'}); "
               f"product.speech_count is {pr.get('speech_count')}")
    if bool(spoken) != ("speech" in (pr.get("name_locations") or [])):
        out.no("product.name_locations says speech only when a line says the name")
    ovs = plan.get("overlays") or []
    named_ov = [o.get("id") for o in ovs if name_in(o.get("text"), names)]
    if bool(named_ov) != ("overlay" in (pr.get("name_locations") or [])):
        out.no("product.name_locations says overlay only when an overlay names the app")
    if beats and pr.get("timing") != "opening":
        b0 = beats[0]
        first = [lines[l]["line"] for l in b0.get("lines") or [] if l in lines]
        first += [o.get("text") for o in ovs if num(o.get("start_s")) and o["start_s"] < (b0.get("end_s") or 0)]
        if any(name_in(x, names) for x in first) or b0.get("app_on_screen"):
            out.no("the app is in the first beat, but product timing is not 'opening'")
    if pr.get("timing") == "absent" and app_beats:
        out.no("product timing absent, but beats show the app")

    # Overlays.
    seen = set()
    series = ed.get("series") if isinstance(ed.get("series"), dict) else None
    hero_norm = {norm(v) for v in heroes.values() if v}
    for o in ovs:
        oid = o.get("id")
        if not oid or oid in seen:
            out.no(f"overlay id {oid!r} is missing or used twice")
        seen.add(oid)
        if o.get("role") not in S["overlay_role"]:
            out.no(f"overlay {oid}: role {o.get('role')!r}")
        if o.get("placement") not in S["overlay_placement"]:
            out.no(f"overlay {oid}: placement {o.get('placement')!r}; never the caption band")
        s, e = o.get("start_s"), o.get("end_s")
        if not (num(s) and num(e) and 0 <= s < e and (not length or e <= length + TOL)):
            out.no(f"overlay {oid}: start_s and end_s inside the video")
            continue
        need = max(MIN_OVERLAY_S, words(o.get("text")) / READ_WORDS_PER_S)
        if e - s < need - 1e-6:
            out.no(f"overlay {oid}: {words(o.get('text'))} words for {e - s:g} s; it needs {need:.1f} s")
        if norm(o.get("text")) in hero_norm:
            out.no(f"overlay {oid}: the app's real words come from the real screen, never an overlay")
        if re.search(r"\d", str(o.get("text"))) and o.get("role") not in ("day_counter", "step_label") \
                and not o.get("fact_refs"):
            out.no(f"overlay {oid}: a number on screen needs fact_refs")
        if o.get("role") == "day_counter" and not series:
            out.no(f"overlay {oid}: a day counter belongs to a progress_log series")
    if str(hook.get("channel", "")).startswith("text") and beats and not any(
            o.get("role") == "hook" and num(o.get("start_s")) and o["start_s"] < (beats[0].get("end_s") or 0)
            for o in ovs):
        out.no(f"hook channel {hook.get('channel')}: a hook overlay starts in the first beat")
    if hook.get("channel") in ("spoken", "spoken_visual") and beats and not beats[0].get("lines"):
        out.no(f"hook channel {hook.get('channel')}: the first beat speaks")

    # Facts named against the brief.
    if brief is not None:
        known = {f.get("id") for f in brief.get("facts") or []}
        used = set(proof.get("fact_refs") or [])
        for b in beats:
            used |= set(b.get("fact_refs") or [])
        for o in ovs:
            used |= set(o.get("fact_refs") or [])
        for f in sorted(used - known):
            out.no(f"fact {f} is not in the brief's facts")
    if not out.bad:
        out.ok(f"contract: {len(beats)} beats over {t_end:g} s, {len(lines)} line(s), {len(ovs)} overlay(s), "
               f"{len(assets)} asset(s); {rp['id'] if rp else '?'} in order")


# ------------------------------------------------------------------------------- ready
def capabilities_needed(plan):
    """{capability id: [why]} that production must have for this plan."""
    need = {}
    assets = {a.get("id"): a for a in plan.get("assets") or []}
    ed = plan.get("editorial") or {}

    def add(k, why):
        need.setdefault(k, []).append(why)
    for b in plan.get("beats") or []:
        src = b.get("source_asset_ids") or []
        if any((assets.get(a) or {}).get("kind") in ("clip", "still", "audio") for a in src):
            add("bridge.C", f"beat {b.get('id')}: supplied media")
        generated = not src and b.get("layout") == "sequence"
        if generated and not b.get("app_on_screen") and b.get("framing") != "face":
            add("bridge.B", f"beat {b.get('id')}: generated {b.get('framing')} action")
        if b.get("performance") == "voiceover":
            add("bridge.narration", f"beat {b.get('id')}: voiceover")
        if b.get("layout") != "sequence":
            add("bridge.composition", f"beat {b.get('id')}: {b.get('layout')}")
    if plan.get("overlays"):
        add("bridge.composition", f"{len(plan['overlays'])} timed overlay(s)")
    if ed.get("filming_format") == "live_use" or any(a.get("paired_input_ref") for a in assets.values()):
        add("bridge.live", "a real input paired with its app recording")
    return need


def readiness(plan, plan_path):
    """(blocking, dependencies): what the lock and production still need. Never changes a file."""
    block, dep = [], []
    hd = os.path.join(ROOT, "apps", str(plan.get("app")), "handles", str(plan.get("handle")).lstrip("@"))
    # Real screens and their hero strings.
    sp = os.path.join(ROOT, "apps", str(plan.get("app")), "screens", "screens.json")
    rows = {r.get("id"): r for r in (load(sp).get("screens") or [])} if os.path.exists(sp) else {}
    for b in plan.get("beats") or []:
        sid = b.get("screen_id")
        if b.get("app_on_screen") and sid and sid not in rows:
            block.append(f"screen {sid}: not in apps/{plan.get('app')}/screens/screens.json (record it, then `screens`)")
    for sid, h in (plan.get("hero_strings") or {}).items():
        if not h:
            block.append(f"hero string of {sid}: copied from the real screen once it is indexed")
        elif sid in rows and norm((rows[sid].get("hero") or {}).get("text")) != norm(h):
            block.append(f"hero string of {sid}: the plan says {h!r}; the real screen says "
                         f"{(rows[sid].get('hero') or {}).get('text')!r}")
    # Supplied files.
    for a in plan.get("assets") or []:
        aid = a.get("id")
        p = a.get("path")
        if not p:
            block.append(f"asset {aid}: no file yet ({a.get('kind')}, {a.get('origin')})")
        elif not os.path.exists(os.path.join(ROOT, p)):
            block.append(f"asset {aid}: {p} is not on disk")
        elif not a.get("sha256"):
            block.append(f"asset {aid}: no sha256 (video_plan.py pin, then review again)")
        if a.get("origin") in ("user_supplied", "licensed", "permitted_reference", "verified_expert") \
                and not a.get("permission_ref"):
            block.append(f"asset {aid}: no permission_ref")
        pr = a.get("paired_input_ref")
        if pr and not (num(pr.get("input_t_s")) and num(pr.get("output_t_s"))):
            block.append(f"asset {aid}: the input and output times are measured on the real capture")
    # Facts, against the brief.
    brief, _ = brief_of(plan_path)
    if brief:
        facts = {f.get("id"): f for f in brief.get("facts") or []}
        used = set((plan.get("editorial") or {}).get("proof", {}).get("fact_refs") or [])
        for b in plan.get("beats") or []:
            used |= set(b.get("fact_refs") or [])
        for f in sorted(used):
            if f in facts and not facts[f].get("verified"):
                block.append(f"fact {f}: not verified against its source ({facts[f].get('source')})")
    # Part A: characters, world, narrators.
    for c in plan.get("characters") or []:
        cid, ver = (str(c).split("@") + [""])[:2]
        cp = os.path.join(hd, "characters", cid, "creator.json")
        if not os.path.exists(cp):
            dep.append(f"character {c}: no creator.json (part A: persona-identity, character-voice)")
        else:
            cr = load(cp)
            if cr.get("version") != ver or cr.get("status") != "live":
                dep.append(f"character {c}: creator.json is {cr.get('version')} {cr.get('status')}; production needs {ver} live")
    wp = os.path.join(hd, "world.json")
    world = load(wp) if os.path.exists(wp) else {}
    subs = {s.get("id"): s for s in world.get("fixed_subjects") or []}
    sets = {s.get("id") for s in world.get("sets") or []}
    want_sets = set((plan.get("set") or {}).values()) | {b.get("set_id") for b in plan.get("beats") or [] if b.get("set_id")}
    for s in sorted(want_sets - sets):
        dep.append(f"set {s}: not in {os.path.relpath(wp, ROOT)}")
    for b in plan.get("beats") or []:
        for sid in b.get("subject_ids") or []:
            if sid not in subs and not sid.startswith("source:"):
                dep.append(f"subject {sid} (beat {b.get('id')}): not a fixed subject of {os.path.relpath(wp, ROOT)}")
    for n in plan.get("narrators") or []:
        if n.get("kind") == "original_synthetic":
            m = re.fullmatch(r"([a-z0-9][a-z0-9._-]*)@v(\d+)", str(n.get("voice_ref") or ""))
            npth = os.path.join(hd, "narrators", m.group(1), "narrator.json") if m else None
            if not npth or not os.path.exists(npth) or load(npth).get("status") != "live":
                dep.append(f"narrator {n.get('id')}: voice {n.get('voice_ref')!r} has no live narrator file "
                           "(character-voice, narrator mode)")
    # Production capabilities.
    caps = load(CAPS) if os.path.exists(CAPS) else None
    for k, why in sorted(capabilities_needed(plan).items()):
        if caps is None:
            dep.append(f"{k}: production has not declared it (scripts/character/capabilities.json is absent); "
                       f"needed by {'; '.join(why)}")
        elif not caps.get(k):
            dep.append(f"{k}: not runnable yet; needed by {'; '.join(dict.fromkeys(why))}")
    approved = (plan.get("approved") or {}).get("words")
    if os.path.basename(plan_path) == "plan.json" and not approved:
        block.append("the plan is not approved: the user's words and date (a dry run)")
    return list(dict.fromkeys(block)), list(dict.fromkeys(dep))


def bridge_check(plan):
    """Run the production bridge's own plan check, when it is installed. Returns its
    problems; prints them under its own heading."""
    bp = os.path.join(ROOT, "scripts", "character")
    if not os.path.exists(os.path.join(bp, "bridge.py")):
        print("  ! the production bridge is not installed; production will run its own check")
        return None
    sys.path.insert(0, bp)
    import bridge  # noqa: E402  (production code, read-only use)
    out = bridge.Out(bad=lambda m: print(f"  ✗ {m}"), note=lambda m: print(f"  ! {m}"),
                     good=lambda m: print(f"  ✓ {m}"))
    bridge.check_plan(json.loads(json.dumps(plan)), out)
    return out.problems


# A value only a real input can give: null in a draft or a dry run, never invented.
# Schema errors at these paths are missing inputs (`ready`), not contract errors.
INPUT_PATHS = [r"^assets/\d+/(path|sha256|permission_ref|paired_input_ref.*)$", r"^hero_strings/[^/]+$",
               r"^approved(/.*)?$"]


def _type_ok(v, t):
    return {"object": isinstance(v, dict), "array": isinstance(v, list), "string": isinstance(v, str),
            "number": num(v), "integer": isinstance(v, int) and not isinstance(v, bool),
            "boolean": isinstance(v, bool), "null": v is None}.get(t, True)


def schema_errors(v, sc, path=""):
    """The subset of JSON Schema 2020-12 that plan.schema.json uses, for workspaces
    without the jsonschema package. [(path, message)]."""
    errs = []
    if "anyOf" in sc:
        if all(schema_errors(v, alt, path) for alt in sc["anyOf"]):
            errs.append((path, f"{json.dumps(v)[:60]} matches none of the allowed shapes"))
        return errs
    t = sc.get("type")
    if t and not any(_type_ok(v, x) for x in ([t] if isinstance(t, str) else t)):
        return [(path, f"{json.dumps(v)[:60]} is not {t}")]
    if "const" in sc and v != sc["const"]:
        errs.append((path, f"{v!r} is not {sc['const']!r}"))
    if "enum" in sc and v not in sc["enum"]:
        errs.append((path, f"{v!r} is not one of {sc['enum']}"))
    if isinstance(v, str):
        if "pattern" in sc and not re.search(sc["pattern"], v):
            errs.append((path, f"{v!r} does not match {sc['pattern']}"))
        if len(v) < sc.get("minLength", 0):
            errs.append((path, "too short"))
    if num(v):
        if "minimum" in sc and v < sc["minimum"]:
            errs.append((path, f"{v} < {sc['minimum']}"))
        if "maximum" in sc and v > sc["maximum"]:
            errs.append((path, f"{v} > {sc['maximum']}"))
        if "exclusiveMinimum" in sc and v <= sc["exclusiveMinimum"]:
            errs.append((path, f"{v} <= {sc['exclusiveMinimum']}"))
    if isinstance(v, dict):
        for k in sc.get("required", []):
            if k not in v:
                errs.append((f"{path}/{k}".lstrip("/"), "is required"))
        props = sc.get("properties", {})
        for k, x in v.items():
            sub = f"{path}/{k}".lstrip("/")
            if k in props:
                errs += schema_errors(x, props[k], sub)
            elif isinstance(sc.get("additionalProperties"), dict):
                errs += schema_errors(x, sc["additionalProperties"], sub)
            elif sc.get("additionalProperties") is False:
                errs.append((sub, "is not allowed"))
    if isinstance(v, list):
        if len(v) < sc.get("minItems", 0) or len(v) > sc.get("maxItems", 10 ** 9):
            errs.append((path, f"{len(v)} items"))
        if isinstance(sc.get("items"), dict):
            for i, x in enumerate(v):
                errs += schema_errors(x, sc["items"], f"{path}/{i}".lstrip("/"))
    return errs


def schema_check(plan, out):
    """plan.schema.json, when production ships it. A draft has no `approved` yet; it is
    checked as if approved, and the null inputs are listed, not failed."""
    if not os.path.exists(SCHEMA):
        out.note("docs/character/plan.schema.json is not in this workspace; the contract above stands in")
        return []
    body = dict(plan)
    body.setdefault("approved", {"words": "(not yet)", "date": "(not yet)"})
    errs = schema_errors(body, load(SCHEMA))
    inputs = [(p, m) for p, m in errs if any(re.match(x, p) for x in INPUT_PATHS)]
    for p, m in errs:
        if (p, m) not in inputs:
            out.no(f"schema: {p or '(root)'}: {m}")
    for p, m in inputs:
        out.note(f"schema, missing input: {p}: {m}")
    if len(inputs) == len(errs):
        out.ok("plan.schema.json: valid" + (f" except {len(inputs)} missing input(s)" if inputs else ""))
    return inputs


# ------------------------------------------------------------------------------ review
def fmt_t(s, e):
    return f"{s:g}–{e:g} s"


def write_review(draft_path):
    plan = load(draft_path)
    brief, _ = brief_of(draft_path)
    out = Out(quiet=True)
    check_contract(plan, out, brief)
    block, dep = readiness(plan, draft_path)
    ed = plan.get("editorial") or {}
    lines = {l["id"]: l for l in plan.get("script") or []}
    beat_of = {lid: b["id"] for b in plan.get("beats") or [] for lid in b.get("lines") or []}
    assets = {a["id"]: a for a in plan.get("assets") or []}
    R = []
    w = R.append
    w(f"# Review — `{plan.get('video_id')}`, revision {plan.get('revision')}")
    w("")
    w(f"`{plan.get('handle')}` · {plan.get('app')} · {plan['format']['length_s']:g} s · 9:16 · "
      f"app insertion {'on' if plan.get('app_insertion') else 'off'}")
    w("")
    w(f"**Content digest:** `{digest(plan)}`")
    w("")
    w("Approve this exact revision with your own words. Any change to the words, actions, timing, "
      "cast, sources, layout or overlays makes a new revision and a new review.")
    w("")
    if brief:
        sr = brief.get("strategy_ref") or {}
        w("## The idea")
        w("")
        w(f"- **Source row:** {sr.get('file')} — {sr.get('section')} — {sr.get('row')} (disposition: {sr.get('disposition')})")
        w(f"- **Idea:** {brief.get('idea')}")
        w(f"- **Viewer moment:** {brief.get('viewer_moment')}")
        w(f"- **Objective:** {ed.get('objective')} ({ed.get('distribution')}); metric: {brief.get('metric', '—')}")
        w("")
        w("## Slots chosen")
        w("")
        w("| Slot | Value | Status | Source | Reason |")
        w("|---|---|---|---|---|")
        for c in brief.get("choices") or []:
            w(f"| {c.get('slot')} | {c.get('value')} | {c.get('status')} | {', '.join(c.get('source_ids') or []) or '—'} | {c.get('reason')} |")
        w("")
        w("## The hook")
        w("")
        h = ed.get("hook") or {}
        w(f"Job `{h.get('job_id')}`, channel `{h.get('channel')}`, framing {', '.join(h.get('framing') or []) or 'none'}. "
          f"Fill: " + "; ".join(f"{k} = “{v}”" for k, v in ((brief.get('anatomy') or {}).get('hook', {}).get('fill') or {}).items()))
        w("")
        for a in brief.get("hook_alternatives") or []:
            mark = "**selected**" if a.get("id") == brief.get("selected_hook") else "alternative"
            w(f"- {mark} `{a.get('id')}`: “{a.get('text')}” ({a.get('channel')}) — {a.get('note', '')}")
        w("")
    w("## The words")
    w("")
    w("| Line | Beat | Speaker | Words | Delivery |")
    w("|---|---|---|---|---|")
    for lid, l in lines.items():
        w(f"| {lid} | {beat_of.get(lid, '—')} | {l.get('speaker')} | {l.get('line')} | {l.get('delivery', '')} |")
    if not lines:
        w("| — | — | — | no spoken words | — |")
    w("")
    w("## Beat timeline")
    w("")
    w("| Beat | Role | Time | Performance | Framing / layout | What the viewer sees | App | Subjects, set, sources | Facts |")
    w("|---|---|---|---|---|---|---|---|---|")
    for b in plan.get("beats") or []:
        app = "—"
        if b.get("app_on_screen"):
            app = f"`{b.get('screen_id')}`, viewer must {b.get('viewer_must')}"
        bind = ", ".join(filter(None, [", ".join(b.get("subject_ids") or []), b.get("set_id") or "",
                                       ", ".join(b.get("source_asset_ids") or [])])) or "—"
        w(f"| {b.get('id')} | {b.get('role')} | {fmt_t(b['start_s'], b['end_s'])} | {b.get('performance')} | "
          f"{b.get('framing')} / {b.get('layout')} | {b.get('action')} | {app} | {bind} | {', '.join(b.get('fact_refs') or []) or '—'} |")
    w("")
    w("## Overlays")
    w("")
    if plan.get("overlays"):
        w("| Id | Role | Time | Placement | Exact text |")
        w("|---|---|---|---|---|")
        for o in plan["overlays"]:
            w(f"| {o.get('id')} | {o.get('role')} | {fmt_t(o['start_s'], o['end_s'])} | {o.get('placement')} | {o.get('text')} |")
    else:
        w("None. The spoken words are captioned at assembly.")
    w("")
    w("## The app and its name")
    w("")
    pr = ed.get("product") or {}
    app_t = [fmt_t(b["start_s"], b["end_s"]) for b in plan.get("beats") or [] if b.get("app_on_screen")]
    w(f"- Role `{pr.get('role')}`, presence `{ed.get('app_presence')}`, timing `{pr.get('timing')}` "
      f"({', '.join(app_t) or 'not on screen'}).")
    w(f"- Name said {pr.get('speech_count', 0)} time(s); name locations: {', '.join(pr.get('name_locations') or []) or 'none'}.")
    for sid, hstr in (plan.get("hero_strings") or {}).items():
        w(f"- Screen `{sid}`: hero string {('“' + hstr + '”') if hstr else '**not yet known** (from the real screen)'}.")
    w(f"- Proof `{(ed.get('proof') or {}).get('kind')}`; close `{ed.get('close')}`.")
    w("")
    w("## Cast, world, narrators and sources")
    w("")
    w(f"- Cast `{ed.get('cast_kind')}`: {', '.join(plan.get('characters') or []) or 'no generated character'}; "
      f"set {plan.get('set') or '—'}; outfit {plan.get('outfit') or '—'}.")
    for n in plan.get("narrators") or []:
        w(f"- Narrator `{n.get('id')}`: {n.get('kind')} {n.get('character_ref') or n.get('voice_ref') or n.get('source_ref') or ''}")
    if not plan.get("narrators"):
        w("- No narrator beyond the on-camera character.")
    for aid, a in assets.items():
        state = "on disk" if a.get("path") and os.path.exists(os.path.join(ROOT, a["path"])) else "**missing**"
        w(f"- Asset `{aid}`: {a.get('kind')}, {a.get('origin')}, {a.get('path') or 'no file yet'} — {state}"
          + (f"; trim {a['trim_s']}" if a.get("trim_s") else ""))
    w(f"- Series: {ed.get('series') if isinstance(ed.get('series'), str) else json.dumps(ed.get('series'))}; "
      f"experiment: {(ed.get('experiment') or {}).get('axis')}"
      + (f" against {(ed.get('experiment') or {}).get('base_video_id')}" if (ed.get('experiment') or {}).get('base_video_id') else ""))
    w("")
    pn = plan.get("publishing_note")
    if pn:
        w("## Publishing note (outside the file)")
        w("")
        for k, v in pn.items():
            w(f"- {k}: {v}")
        w("")
    if brief:
        w("## Facts and sources")
        w("")
        for f in brief.get("facts") or []:
            w(f"- `{f.get('id')}` {f.get('claim')} — {f.get('source')} ({'verified' if f.get('verified') else '**not verified**'})")
        for s in brief.get("limitations") or []:
            w(f"- Limitation: {s}")
        w("")
    w("## What is still needed")
    w("")
    if brief and brief.get("missing_inputs"):
        w("| Input | Owner | Blocks |")
        w("|---|---|---|")
        for m in brief["missing_inputs"]:
            w(f"| {m.get('what')} | {m.get('owner')} | {m.get('blocks', '—')} |")
        w("")
    w(f"**Blocking the lock ({len(block)}):**" + ("" if block else " none."))
    for x in block:
        w(f"- {x}")
    w("")
    w(f"**Dependencies for production ({len(dep)}):**" + ("" if dep else " none."))
    for x in dep:
        w(f"- {x}")
    w("")
    w("## Checks")
    w("")
    w(f"Planning contract: {'pass' if not out.bad else f'{len(out.bad)} problem(s)'}.")
    for x in out.bad:
        w(f"- ✗ {x}")
    for x in out.notes:
        w(f"- ! {x}")
    w("")
    p = os.path.join(os.path.dirname(os.path.abspath(draft_path)), "REVIEW.md")
    with open(p, "w") as f:
        f.write("\n".join(R))
    print(f"wrote {os.path.relpath(p, ROOT)} (revision {plan.get('revision')}, digest {digest(plan)[:12]}…)")
    return p


# -------------------------------------------------------------------------------- lock
def pin(draft_path):
    plan = load(draft_path)
    n = 0
    for a in plan.get("assets") or []:
        p = os.path.join(ROOT, a["path"]) if a.get("path") else None
        if p and os.path.exists(p):
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            if a.get("sha256") != h.hexdigest():
                a["sha256"] = h.hexdigest()
                n += 1
    if n:
        tmp = atomic_write(os.path.abspath(draft_path), plan)
        os.replace(tmp, os.path.abspath(draft_path))
    print(f"{n} checksum(s) written; digest now {digest(plan)[:12]}… (write REVIEW.md again)")


def atomic_write(path, data):
    d = os.path.dirname(path)
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".tmp-")
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return tmp


def lock(draft_path, want_digest, words_, date, dry_run):
    plan = load(draft_path)
    brief, _ = brief_of(draft_path)
    print(f"lock {os.path.relpath(os.path.abspath(draft_path), ROOT)}")
    if "approved" in plan:
        sys.exit("the draft carries 'approved'; the lock writes it")
    got = digest(plan)
    if want_digest != got:
        sys.exit(f"the draft's digest is {got}; the approval is for {want_digest}. The user approves the "
                 "draft they were shown: write REVIEW.md again and show it.")
    out = Out()
    check_contract(plan, out, brief)
    schema_check(plan, out)
    if out.bad:
        sys.exit(f"{len(out.bad)} contract problem(s); nothing written")
    block, dep = readiness(plan, draft_path)
    for x in dep:
        print(f"  ! dependency: {x}")
    if block and not dry_run:
        for x in block:
            print(f"  ✗ blocking: {x}")
        sys.exit(f"{len(block)} blocking input(s); nothing written. A plan is locked with real inputs only.")
    if not dry_run and not (words_ and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date or "")):
        sys.exit("the lock needs the user's words, quoted, and the date YYYY-MM-DD")
    vid = plan["video_id"]
    vd = os.path.join(ROOT, "pipeline", "character", vid)
    cur = os.path.join(vd, "plan.json")
    if os.path.exists(cur):
        old = load(cur)
        if digest(old) != got and (old.get("revision") or 0) >= plan["revision"]:
            sys.exit(f"pipeline/character/{vid}/plan.json is revision {old.get('revision')} with other content: "
                     "a changed plan is a new revision (raise `revision` in the draft, review, approve)")
        if digest(old) != got and any(os.path.exists(os.path.join(vd, x)) for x in ("video.json", "shots")):
            print("  ! production files exist for the old revision; they are stale and production re-checks them")
    approved = {"words": None if dry_run else words_, "date": None if dry_run else date}
    final = dict(plan)
    final["approved"] = approved
    bp = os.path.join(ROOT, "scripts", "character", "bridge.py")
    if os.path.exists(bp):
        sys.path.insert(0, os.path.dirname(bp))
        import bridge  # noqa: E402
        if bridge.digest(final) != got:
            sys.exit("the bridge computes another digest for this plan; report it, nothing written")
    tv, cd = catalogue(plan.get("app"))
    pa = {"video_id": vid, "revision": plan["revision"], "content_sha256": got,
          "words": approved["words"], "date": approved["date"], "evidence_snapshot_digest": cd}
    if dry_run:
        pa["dry_run"] = True
    t1 = atomic_write(os.path.join(vd, "planning-approval.json"), pa)
    t2 = atomic_write(cur, final)
    os.replace(t1, os.path.join(vd, "planning-approval.json"))
    os.replace(t2, cur)
    print(f"  ✓ wrote pipeline/character/{vid}/plan.json and planning-approval.json, revision {plan['revision']}, "
          f"digest {got[:12]}…" + (" — DRY RUN, not approved: production refuses it" if dry_run else ""))
    if block:
        print(f"  ! {len(block)} input(s) still missing; see REVIEW.md")
    print("  stop: planning ends here. Production starts with character-shots when its inputs exist.")


# -------------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["catalogue", "brief", "check", "review", "ready", "pin", "digest", "lock"])
    ap.add_argument("path", nargs="?")
    ap.add_argument("--digest")
    ap.add_argument("--words")
    ap.add_argument("--date")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    if a.cmd == "catalogue":
        tv, cd = catalogue(a.path)
        print(json.dumps({"taxonomy_version": tv, "catalogue_digest": cd}))
        return
    if not a.path:
        sys.exit("a file path is needed")
    if a.cmd == "digest":
        print(digest(load(a.path)))
        return
    if a.cmd == "review":
        write_review(a.path)
        return
    if a.cmd == "pin":
        pin(a.path)
        return
    if a.cmd == "lock":
        if not a.digest:
            sys.exit("--digest: the digest printed in the REVIEW.md the user approved")
        lock(a.path, a.digest, a.words, a.date, a.dry_run)
        return
    out = Out()
    if a.cmd == "brief":
        print(f"brief {a.path}")
        check_brief(load(a.path), out)
    elif a.cmd == "check":
        print(f"plan contract {a.path}")
        brief, _ = brief_of(a.path)
        plan = load(a.path)
        check_contract(plan, out, brief)
        schema_check(plan, out)
    elif a.cmd == "ready":
        plan = load(a.path)
        block, dep = readiness(plan, a.path)
        print(f"blocking the lock ({len(block)})")
        for x in block:
            print(f"  ✗ {x}")
        print(f"dependencies for production ({len(dep)})")
        for x in dep:
            print(f"  ! {x}")
        print("the production bridge's check")
        bridge_check(plan)
        print()
        print("ready to lock" if not block else f"{len(block)} blocking input(s)")
        sys.exit(1 if block else 0)
    print()
    if out.bad:
        print(f"{len(out.bad)} problem(s).")
        sys.exit(1)
    print("ok" + (f", {len(out.notes)} note(s)" if out.notes else ""))


if __name__ == "__main__":
    main()
