#!/usr/bin/env python3
"""Pipeline state. The orchestrator's single source of truth for what is done.

A file existing on disk is not proof a stage completed -- it may be from an abandoned
attempt. Only this file counts.

    state.py show <project>
    state.py init <project> [--flow simple|complex|referenced] [--entry reference|research]
    state.py set <project> <stage> <pending|running|done|failed> [note]
    state.py note <project> <text>
    state.py cost <project> <usd> <what>
    state.py feedback <project> <stage> <note>       # normally written by the UI
    state.py feedback-done <id>
    state.py projects
    state.py model                                  # which generation model is active
    state.py model set <slug> <duration_s>          # record a model switch

    state.py entry <project> <reference|research>   # which half of the pipeline runs
    state.py niche <project> <text>                 # what the research phase searched for
    state.py handle <project> <handle> <promoter|competitor|noise> [note]
    state.py handle-set <project> <handle> <key> <value>
    state.py handles <project> [bucket]             # the ledger, as tsv
"""
import json, os, sys, time, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, "pipeline", "state", "pipeline.json")
FEEDBACK = os.path.join(ROOT, "pipeline", "state", "feedback.jsonl")

RESEARCH = ["discover", "triage", "harvest", "deepen", "teardown"]
STAGES = ["setup"] + RESEARCH + ["ingest", "watch", "transcribe", "breakdown",
          "script", "generate", "review", "composite", "deliver"]

# Stages that only mean something when a reference clip exists. A research-led project
# reaches stage 5 through `originate` instead, and these never run.
REFERENCE_ONLY = ["ingest", "watch", "transcribe", "breakdown"]

# Display numbers. The research half is R1-R5; the recreation half keeps 1-9.
NUM = {s: f"R{i}" for i, s in enumerate(RESEARCH, 1)}
NUM.update({s: str(i) for i, s in enumerate(
    ["ingest", "watch", "transcribe", "breakdown", "script",
     "generate", "review", "composite", "deliver"], 1)})
NUM["setup"] = "0"

BUCKETS = ("promoter", "competitor", "noise")


def load():
    if not os.path.exists(STATE):
        return {"version": 1, "projects": {}, "setup": {"status": "pending"}, "model": {}}
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
    # A research call costs fractions of a cent. Rounding those to "$0.00" reads as
    # free, which is the wrong thing to tell someone about money they are spending.
    return f"${v:.2f}" if v >= 0.01 else f"${v:.4f}"


def project(d, name, create=False):
    if name not in d["projects"]:
        if not create:
            sys.exit(f"unknown project '{name}' -- run: state.py init {name}")
        d["projects"][name] = {
            "created": now(), "flow": "simple", "entry": "reference",
            "stages": {s: {"status": "pending"} for s in STAGES},
            "research": {"niche": "", "handles": {}},
            "notes": [], "costs": [],
        }
    p = d["projects"][name]
    # A project written before the research stages existed is missing their keys. Fill
    # them in on read so an old state file resumes instead of crashing.
    p.setdefault("entry", "reference")
    p.setdefault("research", {"niche": "", "handles": {}})
    for s in STAGES:
        p["stages"].setdefault(s, {"status": "pending"})
    return p


def handle_row(p, handle, create=False):
    h = p["research"]["handles"]
    if handle not in h:
        if not create:
            sys.exit(f"'{handle}' is not in the ledger -- run: state.py handle <project> "
                     f"{handle} <promoter|competitor|noise>")
        h[handle] = {"bucket": "promoter", "added": now()}
    return h[handle]


def cmd_show(name):
    d = load()
    p = project(d, name)
    m = d.get("model") or {}
    print(f"project  {name}   flow={p['flow']}   entry={p['entry']}   created {p['created']}")
    print(f"setup    {d['setup']['status']}")
    if m:
        print(f"model    {m.get('slug')}  {m.get('duration_s')}s  "
              f"${m.get('price_per_s', 0) * m.get('duration_s', 0):.2f}/run")
    niche = p["research"].get("niche")
    if niche:
        ledger = p["research"]["handles"]
        buckets = ", ".join(f"{sum(1 for h in ledger.values() if h['bucket'] == b)} {b}"
                            for b in BUCKETS if any(h["bucket"] == b for h in ledger.values()))
        print(f"niche    {niche}" + (f"   ({buckets})" if buckets else ""))
    print()
    for s in STAGES:
        if s == "setup":
            continue
        st = p["stages"][s]
        # Under a research-led entry there is no reference clip, so stages 1-4 are not
        # pending work -- they are not applicable. Say that rather than showing them
        # unchecked forever.
        if p["entry"] == "research" and s in REFERENCE_ONLY:
            print(f"  [-] {NUM[s]:<3} {s:<12} n/a       no reference clip")
            continue
        mark = {"done": "[x]", "running": "[~]", "failed": "[!]"}.get(st["status"], "[ ]")
        extra = f"   {st.get('note','')}" if st.get("note") else ""
        print(f"  {mark} {NUM[s]:<3} {s:<12} {st['status']:<9}{extra}")
        if s == "teardown":
            print()
    total = sum(c["usd"] for c in p["costs"])
    if p["costs"]:
        print(f"\nspend (computed): {usd(total)}")
        for c in p["costs"]:
            print(f"   {usd(c['usd']):>9}  {c['what']}")
    if p["notes"]:
        print("\nnotes:")
        for n in p["notes"][-10:]:
            print(f"   {n['ts']}  {n['text']}")
    open_fb = [f for f in read_feedback() if f.get("project") == name and f.get("status") == "open"]
    if open_fb:
        print(f"\nOPEN FEEDBACK ({len(open_fb)}):")
        for f in open_fb:
            print(f"   [{f['id'][:8]}] ({f.get('stage','-')}) {f['note']}")


def read_feedback():
    if not os.path.exists(FEEDBACK):
        return []
    out = []
    with open(FEEDBACK) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass                      # a partial write from the UI; skip it
    return out


def write_feedback(rows):
    tmp = FEEDBACK + ".tmp"
    with open(tmp, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    os.replace(tmp, FEEDBACK)


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
            spec = json.load(open(os.path.join(ROOT, "scripts", "templates.json")))
            lim = spec["known_model_limits"].get(slug)
            if lim is None:
                sys.exit(f"'{slug}' is not in templates.json known_model_limits -- add it "
                         f"with its measured cap and price before selecting it")
            if lim["max_duration_s"] and dur > lim["max_duration_s"]:
                sys.exit(f"{slug} caps at {lim['max_duration_s']}s -- {dur}s would be rejected")
            d["model"] = {"slug": slug, "duration_s": dur,
                          "price_per_s": lim.get("price_per_s"), "ts": now()}
            save(d)
            price = lim.get("price_per_s")
            cost = f"${price * dur:.2f}" if price else "unknown"
            print(f"model = {slug}  {dur}s  {cost}/run")
            print("REMINDER: also activate the matching version in Supagen "
                  "(activate_version over MCP) -- REST invoke ignores version_number.")
        else:
            m = d.get("model") or {}
            if not m:
                sys.exit("no model selected -- run the setup skill, or: state.py model set <slug> <seconds>")
            print(json.dumps(m, indent=2))
        return

    if cmd == "projects":
        d = load()
        for n in list(d["projects"]):
            p = project(d, n)
            applicable = [s for s in STAGES[1:]
                          if not (p["entry"] == "research" and s in REFERENCE_ONLY)]
            done = sum(1 for s in applicable if p["stages"][s]["status"] == "done")
            print(f"{n:<24} {p['flow']:<12} {p['entry']:<10} {done}/{len(applicable)} stages")
        return

    if cmd == "show":
        if not a:
            sys.exit("usage: state.py show <project>")
        cmd_show(a[0]); return

    if cmd == "init":
        if not a:
            sys.exit("usage: state.py init <project> [--flow simple|complex|referenced] "
                     "[--entry reference|research]")
        d = load()
        p = project(d, a[0], create=True)
        if "--flow" in a:
            p["flow"] = a[a.index("--flow") + 1]
        if "--entry" in a:
            e = a[a.index("--entry") + 1]
            if e not in ("reference", "research"):
                sys.exit("entry must be reference|research")
            p["entry"] = e
        save(d)
        print(f"initialised {a[0]} (flow={p['flow']}, entry={p['entry']})")
        return

    if cmd == "entry":
        if len(a) < 2 or a[1] not in ("reference", "research"):
            sys.exit("usage: state.py entry <project> <reference|research>")
        d = load()
        project(d, a[0], create=True)["entry"] = a[1]
        save(d)
        print(f"{a[0]}.entry = {a[1]}")
        if a[1] == "research":
            print("stages 1-4 do not apply -- stage 5 is written by the `originate` skill")
        return

    if cmd == "niche":
        if len(a) < 2:
            sys.exit("usage: state.py niche <project> <text>")
        d = load()
        project(d, a[0], create=True)["research"]["niche"] = " ".join(a[1:])
        save(d)
        print(f"{a[0]}.niche = {' '.join(a[1:])}")
        return

    if cmd == "handle":
        if len(a) < 3:
            sys.exit(f"usage: state.py handle <project> <handle> <{'|'.join(BUCKETS)}> [note]")
        name, handle, bucket = a[0], a[1].lstrip("@"), a[2]
        if bucket not in BUCKETS:
            sys.exit(f"bucket must be {'|'.join(BUCKETS)}")
        d = load()
        row = handle_row(project(d, name, create=True), handle, create=True)
        row["bucket"] = bucket
        if len(a) > 3:
            row["note"] = " ".join(a[3:])
        save(d)
        print(f"{handle}  {bucket}")
        return

    if cmd == "handle-set":
        if len(a) < 4:
            sys.exit("usage: state.py handle-set <project> <handle> <key> <value>\n"
                     "  keys: harvested, deep, views, posts, winner, note")
        name, handle, key = a[0], a[1].lstrip("@"), a[2]
        val = " ".join(a[3:])
        d = load()
        row = handle_row(project(d, name, create=True), handle)
        row[key] = int(val) if val.isdigit() else val
        save(d)
        print(f"{handle}.{key} = {row[key]}")
        return

    if cmd == "handles":
        if not a:
            sys.exit("usage: state.py handles <project> [bucket]")
        d = load()
        p = project(d, a[0])
        want = a[1] if len(a) > 1 else None
        rows = [(h, r) for h, r in p["research"]["handles"].items()
                if want is None or r["bucket"] == want]
        # Sorted by views so the ranking that decides the deep dive is visible here too.
        for h, r in sorted(rows, key=lambda kv: -int(kv[1].get("views") or 0)):
            print("\t".join([h, r["bucket"], str(r.get("views", "")),
                             str(r.get("harvested", "")), str(r.get("deep", "")),
                             str(r.get("note", ""))]))
        return

    if cmd == "set":
        if len(a) < 3:
            sys.exit("usage: state.py set <project> <stage> <pending|running|done|failed>")
        name, stage, status = a[0], a[1], a[2]
        if stage not in STAGES:
            sys.exit(f"unknown stage '{stage}' -- one of {', '.join(STAGES)}")
        if status not in ("pending", "running", "done", "failed"):
            sys.exit("status must be pending|running|done|failed")
        d = load()
        if stage == "setup":
            d["setup"] = {"status": status, "ts": now()}
        else:
            p = project(d, name, create=True)
            p["stages"][stage] = {"status": status, "ts": now()}
            if len(a) > 3:
                p["stages"][stage]["note"] = " ".join(a[3:])
        save(d)
        print(f"{name}.{stage} = {status}")
        return

    if cmd == "note":
        d = load()
        project(d, a[0], create=True)["notes"].append({"ts": now(), "text": " ".join(a[1:])})
        save(d); print("noted"); return

    if cmd == "cost":
        if len(a) < 3:
            sys.exit("usage: state.py cost <project> <usd> <what>")
        try:
            float(a[1])
        except ValueError:
            sys.exit(f"cost must be a number, got '{a[1]}'")
        d = load()
        p = project(d, a[0], create=True)
        p["costs"].append({"ts": now(), "usd": float(a[1]), "what": " ".join(a[2:])})
        save(d)
        print(f"recorded {usd(float(a[1]))}; project total {usd(sum(c['usd'] for c in p['costs']))}")
        return

    if cmd == "feedback":
        rows = read_feedback()
        rows.append({"id": uuid.uuid4().hex, "ts": now(), "project": a[0],
                     "stage": a[1], "note": " ".join(a[2:]), "status": "open"})
        write_feedback(rows); print("feedback queued"); return

    if cmd == "feedback-done":
        rows = read_feedback()
        hit = False
        for r in rows:
            if r["id"].startswith(a[0]):
                r["status"] = "done"; r["resolved"] = now(); hit = True
        write_feedback(rows)
        print("resolved" if hit else f"no feedback matching '{a[0]}'")
        return

    sys.exit(f"unknown command '{cmd}'\n{__doc__}")


if __name__ == "__main__":
    main()
