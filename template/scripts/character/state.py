#!/usr/bin/env python3
"""Character pipeline state. The single source of truth for what is done, per video.

A copy of the state logic of scripts/state.py, pointed at pipeline/character/state.json
and scripts/character/models.json. The recreation state file is never read or written.
A file existing on disk is not proof a stage completed -- it may be from an abandoned
attempt. Only this file counts.

    state.py show <video>
    state.py init <video> [--app-insertion yes|no]
    state.py set <video> <stage> <pending|running|done|failed> [note]
                                                    # stages: shots, generate, review,
                                                    # composite, assemble, deliver (P1-P6)
    state.py note <video> <text>
    state.py cost <video> <usd> <what>
    state.py videos
    state.py model                                  # which generation model is active
    state.py model set <slug> <duration_s>          # record a model switch
"""
import json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATE = os.path.join(ROOT, "pipeline", "character", "state.json")
MODELS = os.path.join(ROOT, "scripts", "character", "models.json")

STAGES = ["shots", "generate", "review", "composite", "assemble", "deliver"]
NUM = {s: f"P{i}" for i, s in enumerate(STAGES, 1)}

# Stages that only mean something when the plan inserts the app. A video with no app
# segment never runs them.
APP_ONLY = ["composite"]


def load():
    if not os.path.exists(STATE):
        return {"version": 1, "videos": {}, "model": {}}
    with open(STATE) as f:
        return json.load(f)


def save(d):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=2)
    os.replace(tmp, STATE)          # atomic: a killed run never leaves half a state file


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def usd(v):
    return f"${v:.2f}" if v >= 0.01 else f"${v:.4f}"


def video(d, name, create=False):
    if name not in d["videos"]:
        if not create:
            sys.exit(f"unknown video '{name}' -- run: scripts/character/state.py init {name}")
        d["videos"][name] = {
            "created": now(), "app_insertion": True,
            "stages": {s: {"status": "pending"} for s in STAGES},
            "notes": [], "costs": [],
        }
    v = d["videos"][name]
    for s in STAGES:
        v["stages"].setdefault(s, {"status": "pending"})
    return v


def cmd_show(name):
    d = load()
    v = video(d, name)
    m = d.get("model") or {}
    print(f"video    {name}   app_insertion={'yes' if v['app_insertion'] else 'no'}   "
          f"created {v['created']}")
    if m:
        trim = f"   trim to {m['trim_to_s']}s at assembly" if m.get("trim_to_s") else ""
        print(f"model    {m.get('slug')}  {m.get('duration_s')}s  "
              f"${m.get('price_per_s', 0) * m.get('duration_s', 0):.2f}/run{trim}")
    print()
    for s in STAGES:
        st = v["stages"][s]
        # A plan with no app insertion has no screen stages: say so rather than showing
        # them unchecked forever.
        if not v["app_insertion"] and s in APP_ONLY:
            print(f"  [-] {NUM[s]:<3} {s:<10} n/a       no app insertion in the plan")
            continue
        mark = {"done": "[x]", "running": "[~]", "failed": "[!]"}.get(st["status"], "[ ]")
        extra = f"   {st.get('note','')}" if st.get("note") else ""
        print(f"  {mark} {NUM[s]:<3} {s:<10} {st['status']:<9}{extra}")
    total = sum(c["usd"] for c in v["costs"])
    if v["costs"]:
        print(f"\nspend (computed): {usd(total)}")
        for c in v["costs"]:
            print(f"   {usd(c['usd']):>9}  {c['what']}")
    if v["notes"]:
        print("\nnotes:")
        for n in v["notes"][-10:]:
            print(f"   {n['ts']}  {n['text']}")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    a = sys.argv[2:]

    if cmd == "model":
        d = load()
        if a and a[0] == "set":
            if len(a) < 3:
                sys.exit("usage: state.py model set <model-slug> <duration-seconds>")
            slug, raw = a[1].strip(), a[2].strip()
            if not raw.isdigit():
                sys.exit(f"duration must be a whole number of seconds, got '{a[2]}'")
            dur = int(raw)
            if dur < 1:
                sys.exit("duration must be at least 1 second")
            spec = json.load(open(MODELS))
            lim = spec["known_model_limits"].get(slug)
            if lim is None:
                sys.exit(f"'{slug}' is not in scripts/character/models.json known_model_limits "
                         f"-- add it with its measured cap and price before selecting it")
            if lim["max_duration_s"] and dur > lim["max_duration_s"]:
                sys.exit(f"{slug} caps at {lim['max_duration_s']}s -- {dur}s would be rejected")
            # The model refuses anything shorter than its minimum. A shorter planned
            # segment is generated at the minimum and trimmed at assembly; it costs the
            # minimum.
            trim = None
            lo = lim.get("min_duration_s") or 1
            if dur < lo:
                trim, dur = dur, lo
            d["model"] = {"slug": slug, "duration_s": dur,
                          "price_per_s": lim.get("price_per_s"), "ts": now()}
            if trim:
                d["model"]["trim_to_s"] = trim
            save(d)
            price = lim.get("price_per_s")
            cost = f"${price * dur:.2f}" if price else "unknown"
            print(f"model = {slug}  {dur}s  {cost}/run")
            if trim:
                print(f"{slug} takes at least {lo}s -- generating {lo}s, trim to {trim}s at assembly")
            print("REMINDER: also activate the matching version in Supagen "
                  "(activate_version over MCP) -- REST invoke ignores version_number.")
        else:
            m = d.get("model") or {}
            if not m:
                sys.exit("no model selected -- run: scripts/character/state.py model set <slug> <seconds>")
            print(json.dumps(m, indent=2))
        return

    if cmd == "videos":
        d = load()
        for n in list(d["videos"]):
            v = video(d, n)
            applicable = [s for s in STAGES if v["app_insertion"] or s not in APP_ONLY]
            done = sum(1 for s in applicable if v["stages"][s]["status"] == "done")
            print(f"{n:<24} {'app' if v['app_insertion'] else 'no-app':<8} "
                  f"{done}/{len(applicable)} stages")
        return

    if cmd == "show":
        if not a:
            sys.exit("usage: state.py show <video>")
        cmd_show(a[0]); return

    if cmd == "init":
        if not a:
            sys.exit("usage: state.py init <video> [--app-insertion yes|no]")
        d = load()
        v = video(d, a[0], create=True)
        if "--app-insertion" in a:
            e = a[a.index("--app-insertion") + 1]
            if e not in ("yes", "no"):
                sys.exit("--app-insertion must be yes|no")
            v["app_insertion"] = e == "yes"
        save(d)
        print(f"initialised {a[0]} (app_insertion={'yes' if v['app_insertion'] else 'no'})")
        return

    if cmd == "set":
        if len(a) < 3:
            sys.exit("usage: state.py set <video> <stage> <pending|running|done|failed>")
        name, stage, status = a[0], a[1], a[2]
        if stage not in STAGES:
            sys.exit(f"unknown stage '{stage}' -- one of {', '.join(STAGES)}")
        if status not in ("pending", "running", "done", "failed"):
            sys.exit("status must be pending|running|done|failed")
        d = load()
        v = video(d, name, create=True)
        v["stages"][stage] = {"status": status, "ts": now()}
        if len(a) > 3:
            v["stages"][stage]["note"] = " ".join(a[3:])
        save(d)
        print(f"{name}.{stage} = {status}")
        return

    if cmd == "note":
        d = load()
        video(d, a[0], create=True)["notes"].append({"ts": now(), "text": " ".join(a[1:])})
        save(d); print("noted"); return

    if cmd == "cost":
        if len(a) < 3:
            sys.exit("usage: state.py cost <video> <usd> <what>")
        try:
            float(a[1])
        except ValueError:
            sys.exit(f"cost must be a number, got '{a[1]}'")
        d = load()
        v = video(d, a[0], create=True)
        v["costs"].append({"ts": now(), "usd": float(a[1]), "what": " ".join(a[2:])})
        save(d)
        print(f"recorded {usd(float(a[1]))}; video total {usd(sum(c['usd'] for c in v['costs']))}")
        return

    sys.exit(f"unknown command '{cmd}'\n{__doc__}")


if __name__ == "__main__":
    main()
