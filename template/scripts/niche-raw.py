#!/usr/bin/env python3
"""posts.raw.json of a niche batch (the `niche-fetch` skill): the raw record of every post
the batch holds, once each. The Atlas niche page reads it beside LINKS.md and BATCH.md.

    niche-raw.py missing <posts.raw.json>            post urls on stdin; prints, as a JSON list,
                                                     the urls whose post id is not in the file yet
    niche-raw.py merge <posts.raw.json> <file>...    adds the records of each file (a list of
                                                     records, or one record: a post.json) whose
                                                     id is not in the file yet; writes the file
    niche-raw.py drop <batch dir> <id> <reason>...   drops off-niche posts from the batch: deletes
                                                     <handle>/<id>/, takes the id out of
                                                     posts.raw.json, and adds "id <tab> reason" to
                                                     dropped.tsv; ids and reasons in pairs

A file that is missing or not JSON counts as empty. The order is kept: the old records
first, then the new ones in the order given. A post in dropped.tsv is never merged back.
The paid fetch files (<handle>.profile.raw.json) are never changed.
"""
import json, os, re, shutil, sys


def load(path):
    try:
        d = json.load(open(path))
    except Exception:
        return []
    return [r for r in (d if isinstance(d, list) else [d]) if isinstance(r, dict) and r.get("id")]


def missing(raw, urls):
    have = {str(r["id"]) for r in load(raw)}
    out = []
    for u in urls:
        m = re.search(r"/(\d{15,})", u)
        if not m or m.group(1) not in have:
            out.append(u)
    return out


def dropped(batch):
    p = os.path.join(batch, "dropped.tsv")
    return {l.split("\t")[0] for l in open(p) if l.strip()} if os.path.exists(p) else set()


def merge(raw, files):
    rows = load(raw)
    ids = {str(r["id"]) for r in rows} | dropped(os.path.dirname(os.path.abspath(raw)))
    for f in files:
        for r in load(f):
            if str(r["id"]) not in ids:
                rows.append(r)
                ids.add(str(r["id"]))
    json.dump(rows, open(raw, "w"), ensure_ascii=False, indent=1)
    return rows


def drop(batch, pairs):
    batch = os.path.abspath(batch)
    raw = os.path.join(batch, "posts.raw.json")
    ids = {pid for pid, _ in pairs}
    if os.path.exists(raw):
        json.dump([r for r in load(raw) if str(r["id"]) not in ids], open(raw, "w"), ensure_ascii=False, indent=1)
    gone = 0
    for pid in ids:
        for d in [os.path.join(batch, h, pid) for h in os.listdir(batch)]:
            if re.fullmatch(r"\d{15,}", pid) and os.path.isdir(d):
                shutil.rmtree(d)
                gone += 1
    have = dropped(batch)
    with open(os.path.join(batch, "dropped.tsv"), "a") as f:
        for pid, why in pairs:
            if pid not in have:
                f.write(f"{pid}\t{why}\n")
    return gone


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] not in ("missing", "merge", "drop"):
        sys.exit(__doc__)
    if sys.argv[1] == "drop":
        a = sys.argv[3:]
        if not a or len(a) % 2:
            sys.exit("drop: give ids and reasons in pairs")
        print(f"dropped {drop(sys.argv[2], list(zip(a[::2], a[1::2])))} post folders")
        sys.exit(0)
    if sys.argv[1] == "missing":
        print(json.dumps(missing(sys.argv[2], [l.strip() for l in sys.stdin if l.strip()])))
    else:
        files = [f for f in sys.argv[3:] if os.path.exists(f)]
        print(f"posts.raw.json: {len(merge(sys.argv[2], files))} posts")
