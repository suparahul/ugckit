#!/usr/bin/env python3
"""The curation marks of a niche (the `niche-curate` skill): apps/<slug>/niche/marks.json,
the same file the Atlas niche page writes in edit mode. No cost, no network.

    niche-marks.py show <slug>                    the counts, then every mark of yours (the samples
                                                  an agent learns from) with its post
    niche-marks.py list <slug> [--unmarked] [--kind slideshow|video] [--min-views N]
                                                  one TSV line per post of the niche catalog
                                                  (atlas/data/niche-<slug>.json): key, mark, by, rule,
                                                  kind, handle, views, saves, date, keywords, caption
    niche-marks.py set <slug> <out|study|clear> <key>... --rule <C1> --why "<few words>"
                                                  marks as the agent; a key is <platform>:<id>, a bare
                                                  id is TikTok. A mark of yours (by "you", keep
                                                  included) is never changed: it is skipped and named.
                                                  clear takes off agent marks only.
    niche-marks.py study <slug> [--date YYYY-MM-DD] [--write]
                                                  the Study posts whose slides or video are not on disk
                                                  yet; --write adds them as post rows to
                                                  batches/<date>/LINKS.md (today when no date), ready
                                                  for scripts/niche-fetch.sh <slug> <date>

The file: {"version": 1, "marks": {"<platform>:<id>": {"mark": "out" | "study" | "keep",
"by": "you" | "agent", "at": "<ISO time>", "handle", "caption", "rule", "why"}}}. A post not in
it is unmarked (kept, not downloaded). "keep" is a mark of yours: an agent mark you took back.
The keys are kept in order and the file is written whole, so a diff shows one line per mark.
Run `npm run index` in atlas/ (or open the page) after a fetch; the marks need no rebuild.
"""
import datetime as dt, json, os, re, sys

ROOT = os.environ.get("PROJ_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKS = ("out", "study", "keep")
KEY = re.compile(r"^(tiktok|instagram):[\w.-]{1,64}$")


def niche_dir(slug):
    if not re.match(r"^[\w.-]+$", slug):
        sys.exit(f"not a slug: {slug}")
    d = os.path.join(ROOT, "apps", slug, "niche")
    if not os.path.isdir(d):
        sys.exit(f"no {d}: the niche phase has not started for {slug}")
    return d


def load(slug):
    p = os.path.join(niche_dir(slug), "marks.json")
    try:
        raw = json.load(open(p))
    except FileNotFoundError:
        return {}
    except Exception as e:
        sys.exit(f"{p} is not JSON ({e}); fix it by hand before marking")
    out = {}
    for k, v in (raw.get("marks") or {}).items():
        if KEY.match(k) and isinstance(v, dict) and v.get("mark") in MARKS:
            v["by"] = "agent" if v.get("by") == "agent" else "you"
            out[k] = v
    return out


def save(slug, marks):
    p = os.path.join(niche_dir(slug), "marks.json")
    tmp = f"{p}.{os.getpid()}.tmp"
    with open(tmp, "w") as f:
        f.write(json.dumps({"version": 1, "marks": {k: marks[k] for k in sorted(marks)}}, indent=2, ensure_ascii=False) + "\n")
    os.replace(tmp, p)


def catalog(slug):
    """One record per post of the catalog, its keywords and windows merged; batch posts first."""
    p = os.path.join(ROOT, "atlas", "data", f"niche-{slug}.json")
    try:
        posts = json.load(open(p)).get("posts", [])
    except Exception:
        sys.exit(f"no {p}: run `npm run index` in atlas/ first")
    out = {}
    for r in posts:
        k = f"{r.get('platform') or 'tiktok'}:{r['id']}"
        if k in out:
            out[k]["keywords"].add(r.get("keyword", ""))
            continue
        out[k] = {**r, "key": k, "keywords": {r.get("keyword", "")}}
    return out


def on_disk(slug, platform, pid):
    """The post's slides or video in any batch folder: batches/<date>/<handle>/<id>/."""
    if platform != "tiktok":
        return False
    root = os.path.join(niche_dir(slug), "batches")
    for date in os.listdir(root) if os.path.isdir(root) else []:
        bdir = os.path.join(root, date)
        if not os.path.isdir(bdir):
            continue
        for handle in os.listdir(bdir):
            pdir = os.path.join(bdir, handle, pid)
            if os.path.isdir(pdir) and (os.path.exists(os.path.join(pdir, "video.mp4")) or os.path.exists(os.path.join(pdir, "slide-01.jpg"))):
                return True
    return False


def clip(t, n=140):
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[: n - 1] + "…"


def opt(args, name, default=None):
    if name in args:
        i = args.index(name)
        if i + 1 >= len(args):
            sys.exit(f"{name} needs a value")
        v = args[i + 1]
        del args[i : i + 2]
        return v
    return default


def flag(args, name):
    if name in args:
        args.remove(name)
        return True
    return False


def cmd_show(slug):
    marks, cat = load(slug), catalog(slug)
    counts = {}
    for v in marks.values():
        counts[(v["mark"], v["by"])] = counts.get((v["mark"], v["by"]), 0) + 1
    print(f"{len(cat)} posts in the catalog, {len(marks)} marked: " + (", ".join(f"{n} {m} by {b}" for (m, b), n in sorted(counts.items())) or "none"))
    rules = os.path.join(niche_dir(slug), "CLEANUP.md")
    print(f"cleanup rules: {'niche/CLEANUP.md' if os.path.exists(rules) else 'none yet (niche/CLEANUP.md)'}")
    mine = sorted(((k, v) for k, v in marks.items() if v["by"] == "you"), key=lambda kv: (kv[1]["mark"], kv[0]))
    if mine:
        print("\nyour marks (the samples):")
        print("key\tmark\tkind\thandle\tviews\tkeywords\tcaption")
    for k, v in mine:
        p = cat.get(k, {})
        print("\t".join([k, v["mark"], p.get("mediaType", "?"), "@" + (p.get("handle") or v.get("handle") or "?"), str(p.get("views", "")), ",".join(sorted(x for x in p.get("keywords", ()) if x)), clip(p.get("caption") or v.get("caption", ""))]))


def cmd_list(slug, args):
    unmarked, kind, floor = flag(args, "--unmarked"), opt(args, "--kind"), int(opt(args, "--min-views", "0"))
    marks = load(slug)
    print("key\tmark\tby\trule\tkind\thandle\tviews\tsaves\tdate\tkeywords\tcaption")
    for k, p in sorted(catalog(slug).items(), key=lambda kv: -(kv[1].get("views") or 0)):
        m = marks.get(k, {})
        if unmarked and m:
            continue
        if kind and p.get("mediaType") != kind or (p.get("views") or 0) < floor:
            continue
        print("\t".join([k, m.get("mark", ""), m.get("by", ""), m.get("rule", ""), p.get("mediaType", ""), "@" + p.get("handle", ""), str(p.get("views") or ""), str(p.get("saves") if p.get("saves") is not None else ""), p.get("date", ""), ",".join(sorted(x for x in p["keywords"] if x)), clip(p.get("caption"))]))


def cmd_set(slug, args):
    rule, why = opt(args, "--rule", ""), opt(args, "--why", "")
    if not args or args[0] not in ("out", "study", "clear"):
        sys.exit("set <slug> <out|study|clear> <key>... --rule <C1> --why \"...\"")
    mark, keys = args[0], [k if ":" in k else f"tiktok:{k}" for k in args[1:]]
    if not keys:
        sys.exit("no keys given")
    if mark != "clear" and not why:
        sys.exit("--why is required: a few words on why, for the user reading the page")
    marks, cat = load(slug), catalog(slug)
    at = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    done, skipped, unknown = 0, [], []
    for k in keys:
        if not KEY.match(k):
            unknown.append(k)
            continue
        had = marks.get(k)
        if had and had["by"] == "you":
            skipped.append(f"{k} ({had['mark']} by you)")
            continue
        if mark == "clear":
            if had:
                del marks[k]
                done += 1
            continue
        if k not in cat:
            unknown.append(k)
            continue
        p = cat[k]
        marks[k] = {"mark": mark, "by": "agent", "at": at, "handle": p.get("handle", ""), "caption": clip(p.get("caption"), 160), **({"rule": rule} if rule else {}), "why": why}
        done += 1
    save(slug, marks)
    print(f"{mark}: {done} written" + (f"; {len(skipped)} skipped, marked by you: {', '.join(skipped)}" if skipped else "") + (f"; not in the catalog or not a key: {', '.join(unknown)}" if unknown else ""))


def cmd_study(slug, args):
    date, write = opt(args, "--date") or dt.date.today().isoformat(), flag(args, "--write")
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        sys.exit(f"--date is YYYY-MM-DD, not {date}")
    marks, cat = load(slug), catalog(slug)
    study = [k for k, v in sorted(marks.items()) if v["mark"] == "study"]
    held = [k for k in study if on_disk(slug, *k.split(":", 1))]
    ig = [k for k in study if not k.startswith("tiktok:")]
    todo = [k for k in study if k not in held and k not in ig and cat.get(k, {}).get("url")]
    lost = [k for k in study if k not in held and k not in ig and k not in todo]
    print(f"{len(study)} marked study: {len(held)} on disk, {len(todo)} to fetch" + (f", {len(ig)} on Instagram (niche-fetch reads TikTok only; say so)" if ig else "") + (f", {len(lost)} with no url in the catalog: {', '.join(lost)}" if lost else ""))
    for k in todo:
        print(f"  {cat[k]['url']}")
    if not write or not todo:
        return
    bdir = os.path.join(niche_dir(slug), "batches", date)
    os.makedirs(bdir, exist_ok=True)
    links = os.path.join(bdir, "LINKS.md")
    text = open(links).read() if os.path.exists(links) else f"# Batch {date}\nSearched: the Study marks of the niche page\nSource: study marks\n\n| # | What you brought | Source | Your note |\n|---|---|---|---|\n"
    nums = [int(m) for m in re.findall(r"^\|\s*(\d+)\s*\|", text, re.M)]
    n, added = max(nums, default=0), 0
    with open(links, "w") as f:
        f.write(text if text.endswith("\n") else text + "\n")
        for k in todo:
            url = cat[k]["url"]
            if url in text:
                continue
            n += 1
            added += 1
            who = "you" if marks[k]["by"] == "you" else "the agent"
            f.write(f"| {n} | {url} | study mark | @{cat[k].get('handle', '')}: marked Study by {who} |\n")
    print(f"LINKS.md: {added} rows added -> {links}\nnext: scripts/niche-fetch.sh {slug} {date} --plan")


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2 or a[0] not in ("show", "list", "set", "study"):
        sys.exit(__doc__)
    {"show": lambda: cmd_show(a[1]), "list": lambda: cmd_list(a[1], a[2:]), "set": lambda: cmd_set(a[1], a[2:]), "study": lambda: cmd_study(a[1], a[2:])}[a[0]]()
