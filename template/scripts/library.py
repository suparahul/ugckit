#!/usr/bin/env python3
"""The hook library, queried rather than read. Input to the `originate` skill.

Points at a research corpus -- LIBRARY_DIR in .env -- holding library/hooks.jsonl and
its companions. Thousands of hooks must not go through an agent's context, so every
command here prints a small table.

    library.py stats                                   corpus totals, per app
    library.py templates [--format video|photo] [--top N]
    library.py hooks [--template ID] [--app X] [--format F] [--lang L] [--top N] [--min-views N]
    library.py formats
    library.py mechanics [name]
    library.py teardowns                               the prose teardowns available

Hooks print verbatim -- spelling, capitalisation and typos are the source's. Quote them
as they are or say plainly that you varied one.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def library_dir():
    d = os.environ.get("LIBRARY_DIR", "")
    env = os.path.join(ROOT, ".env")
    if not d and os.path.exists(env):
        for line in open(env):
            line = line.strip()
            if line.startswith("LIBRARY_DIR="):
                d = line.split("=", 1)[1].strip()
    d = os.path.expanduser(d)
    if not d:
        sys.exit("LIBRARY_DIR is not set. Add it to .env — it points at a research corpus\n"
                 "checkout holding library/hooks.jsonl (see the originate skill).")
    if not os.path.exists(os.path.join(d, "library", "hooks.jsonl")):
        sys.exit(f"{d} has no library/hooks.jsonl — LIBRARY_DIR is pointing at the wrong place.")
    return d


def load_jsonl(path):
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass                      # a half-written line; skip it
    return out


def load_json(d, name):
    p = os.path.join(d, "library", name)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    return json.load(open(p))


def clip(s, n):
    # These files are hand-written: a field that is prose in one entry is a dict of
    # prose in the next. Flatten rather than crash.
    if isinstance(s, dict):
        s = "  ".join(f"{k}: {v}" for k, v in s.items())
    elif isinstance(s, list):
        s = " · ".join(str(x) for x in s)
    elif s is None:
        s = ""
    s = str(s).replace("\n", " ⏎ ").replace("\t", " ")
    return s if len(s) <= n else s[:n - 1] + "…"


def arg(name, default=None):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    d = library_dir()

    if cmd == "stats":
        s = load_json(d, "_stats.json")
        t = s.get("totals", {})
        print(f"corpus   {d}")
        print(f"hooks    {t.get('hooks_emitted')} emitted of {t.get('hook_rows_in_media')} rows"
              f"   ({t.get('classified')} classified, {t.get('unclassified')} not)")
        print(f"accounts {t.get('accounts_with_hooks')}   apps {t.get('apps')}")
        print()
        print(f"{'app':<18}{'hooks':>7}{'handles':>9}{'median':>10}{'best':>12}{'total views':>15}")
        for app, v in sorted(s.get("by_app", {}).items(),
                             key=lambda kv: -(kv[1].get("total_views") or 0)):
            if not v.get("n"):
                continue
            print(f"{app:<18}{v.get('n',0):>7}{v.get('handles',0):>9}"
                  f"{v.get('median_views',0):>10}{v.get('best_views',0):>12}"
                  f"{v.get('total_views',0):>15,}")
        return

    if cmd == "templates":
        tpl = load_json(d, "templates.json")["templates"]
        want_fmt, top = arg("--format"), int(arg("--top", 100))
        # Ranked by best_views, not median: these are outlier businesses, and the
        # median of a template says more about how often it is used badly.
        tpl.sort(key=lambda t: -(t.get("best_views") or 0))
        n = 0
        for t in tpl:
            if want_fmt and not (t.get("formats") or {}).get(want_fmt):
                continue
            n += 1
            if n > top:
                break
            print(f"\n{t['id']}   n={t.get('instances','?')}   median {t.get('median_views','?')}"
                  f"   best {t.get('best_views',0):,}   >1M: {t.get('posts_over_1m',0)}"
                  f"   apps={','.join(t.get('apps', []))}")
            print(f"  shape   {clip(t.get('pattern'), 150)}")
            if t.get("slots"):
                print(f"  slots   {', '.join(t['slots'])}")
            if t.get("when_to_use"):
                print(f"  use     {clip(t['when_to_use'], 240)}")
            for ex in (t.get("examples") or [])[:2]:
                print(f"  e.g.    {clip(ex if isinstance(ex, str) else (ex.get('hook') or ex.get('evidence')), 120)}")
        return

    if cmd == "hooks":
        rows = load_jsonl(os.path.join(d, "library", "hooks.jsonl"))
        tid, app = arg("--template"), arg("--app")
        fmt, lang = arg("--format"), arg("--lang")
        minv, top = int(arg("--min-views", 0)), int(arg("--top", 25))
        sel = [r for r in rows
               if (tid is None or r.get("template_id") == tid)
               and (app is None or r.get("app") == app)
               and (fmt is None or r.get("format") == fmt)
               and (lang is None or r.get("language") == lang)
               and (r.get("views") or 0) >= minv]
        sel.sort(key=lambda r: -(r.get("views") or 0))
        print(f"{len(sel)} matching hooks, top {min(top, len(sel))} by views\n")
        for r in sel[:top]:
            print(f"{r.get('views') or 0:>10,}  {r.get('app',''):<10}"
                  f"{r.get('account_type',''):<10}{r.get('format',''):<7}{r.get('language',''):<4}"
                  f"  {clip(r.get('hook'), 90)}")
            print(f"{'':>10}  {r.get('url','')}")
        return

    if cmd == "formats":
        f = load_json(d, "formats.json")
        for section in ("media_types", "creative_formats"):
            print(f"\n== {section} ==")
            for v in f.get(section, []):
                head = f"\n{v['id']}"
                if v.get("media_type"):
                    head += f"   ({v['media_type']})"
                if v.get("hooked_posts"):
                    head += f"   n={v['hooked_posts']}"
                if v.get("best_views"):
                    head += f"   median {v.get('median_views','?')}   best {v['best_views']:,}"
                print(head + f"   apps={','.join(v.get('apps', []))}")
                for key in ("shape", "when_to_use", "verdict"):
                    if v.get(key):
                        print(f"  {key:<12}{clip(v[key], 260)}")
        return

    if cmd == "mechanics":
        want = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("-") else None
        for v in load_json(d, "mechanics.json")["mechanics"]:
            if want and want != v["id"]:
                continue
            print(f"\n{v['id']}   apps={','.join(v.get('apps', []))}")
            print(f"  {clip(v.get('one_line'), 240)}")
            for key in ("requires", "disclosure", "when_to_use"):
                if v.get(key):
                    print(f"  {key:<12}{clip(str(v[key]), 240)}")
            for ex in (v.get("examples") or [])[:2]:
                print(f"  e.g.        {clip(ex if isinstance(ex, str) else ex.get('evidence'), 140)}")
        return

    if cmd == "teardowns":
        media = os.path.join(d, "media")
        if not os.path.isdir(media):
            sys.exit(f"no media/ under {d}")
        for app in sorted(os.listdir(media)):
            p = os.path.join(media, app, "TEARDOWN.md")
            if os.path.exists(p):
                n = sum(1 for _ in open(p))
                print(f"{app:<20}{n:>5} lines   {p}")
        return

    sys.exit(f"unknown command '{cmd}'\n{__doc__}")


if __name__ == "__main__":
    main()
