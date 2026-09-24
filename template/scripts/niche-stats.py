#!/usr/bin/env python3
"""The counting parts of the niche read (the `niche-read` skill). The judging is the
agent's; this prints numbers.

    scripts/niche-stats.py <slug> <date>            one batch: the table, the spread, the handles
    scripts/niche-stats.py <slug> --searches        the search files: the spread, handles with 2+ posts, recency

For a batch it reads batches/<date>/<handle>/<id>/post.json (and comments.json) and prints
the batch table in BATCH.md's column order (handle, id, date, views, likes, comments,
shares, saves, slides or seconds, saves/view, shares/view, likes/view, sound, kind), then
the medians by kind, the view spread, and the handles with 2+ posts. For the searches it
reads niche/searches/*.json (the Photo tab, the general search, an apidojo video search) and
niche/instagram/searches/hashtag.*.json, and prints the spread of views (of likes for an
Instagram photo or carousel, which reports no views), the share from the last 90 days, and
the handles with 2+ posts, by platform and kind. No verdicts.
"""
import glob, json, os, statistics, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pct(a, b):
    return f"{a / b * 100:.2f}%" if b else "-"


def fmt(n):
    return f"{n:,}" if isinstance(n, int) else str(n)


def spread(vals):
    if not vals:
        return "-"
    v = sorted(vals)
    q = lambda p: v[min(len(v) - 1, int(p * len(v)))]
    return f"p25 {fmt(q(.25))} · p50 {fmt(q(.5))} · p75 {fmt(q(.75))} · p90 {fmt(q(.9))} · max {fmt(v[-1])}"


def batch(slug, date):
    b = os.path.join(ROOT, "apps", slug, "niche", "batches", date)
    rows = []
    for pj in sorted(glob.glob(os.path.join(b, "*", "*", "post.json"))):
        d = os.path.dirname(pj)
        try:
            r = json.load(open(pj))
        except Exception:
            print(f"{pj}: not JSON", file=sys.stderr)
            continue
        slides = len(glob.glob(os.path.join(d, "slide-*.jpg")))
        kind = "slideshow" if slides or r.get("images") else "video"
        views = r.get("views") or 0
        n_comments = None
        cj = os.path.join(d, "comments.json")
        if os.path.exists(cj):
            try:
                c = json.load(open(cj))
                n_comments = len((c.get("data") or c).get("comments") or []) if isinstance(c, dict) else None
            except Exception:
                pass
        rows.append({
            "handle": "@" + ((r.get("channel") or {}).get("username") or os.path.basename(os.path.dirname(d))),
            "id": str(r.get("id") or os.path.basename(d)), "date": (r.get("uploadedAtFormatted") or "")[:10],
            "views": views, "likes": r.get("likes") or 0, "comments": r.get("comments") or 0,
            "shares": r.get("shares") or 0, "saves": r.get("bookmarks") or 0,
            "length": f"{slides} slides" if kind == "slideshow" else f"{(r.get('video') or {}).get('duration') or '?'} s",
            "sound": ((r.get("song") or {}).get("title") or "").replace("|", "/"), "kind": kind,
            "commentsRead": n_comments, "bio": ((r.get("channel") or {}).get("bio") or "").replace("\n", " / ").replace("|", "/"),
            "caption": (r.get("title") or "").replace("\n", " ").replace("|", "/"),
            "tags": " ".join("#" + (h if isinstance(h, str) else (h or {}).get("name", "")) for h in (r.get("hashtags") or [])),
        })
    if not rows:
        sys.exit(f"no post.json under {b} -- run scripts/niche-fetch.sh {slug} {date} first")
    rows.sort(key=lambda r: -r["views"])
    print("## The table\n")
    print("| Handle | Post id | Date | Views | Likes | Comments | Shares | Saves | Slides / length | Saves/view | Shares/view | Likes/view | Sound | Kind |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['handle']} | {r['id']} | {r['date']} | {fmt(r['views'])} | {fmt(r['likes'])} | {fmt(r['comments'])} | {fmt(r['shares'])} | {fmt(r['saves'])} | {r['length']} | {pct(r['saves'], r['views'])} | {pct(r['shares'], r['views'])} | {pct(r['likes'], r['views'])} | {r['sound']} | {r['kind']} |")
    print("\n## Captions, hashtags, bios\n")
    print("| Handle | Caption | Hashtags | Bio |")
    print("|---|---|---|---|")
    for r in rows:
        print(f"| {r['handle']} | \"{r['caption'][:120]}\" | {r['tags'][:120] or 'none'} | \"{r['bio'][:120]}\" |")
    for kind in ("slideshow", "video"):
        ks = [r for r in rows if r["kind"] == kind]
        if not ks:
            continue
        med = lambda k: statistics.median([r[k] / r["views"] for r in ks if r["views"]]) * 100 if any(r["views"] for r in ks) else 0
        print(f"\n{len(ks)} {kind}{'s' if len(ks) != 1 else ''}: {fmt(sum(r['views'] for r in ks))} views total; median saves/view {med('saves'):.2f}%, "
              f"median shares/view {med('shares'):.2f}%, median likes/view {med('likes'):.2f}%")
        print(f"   view spread: {spread([r['views'] for r in ks])}")
        if kind == "slideshow":
            counts = sorted(int(r["length"].split()[0]) for r in ks if r["length"].endswith("slides"))
            if counts:
                print(f"   slide counts: {', '.join(map(str, counts))} (median {statistics.median(counts):g})")
    by = {}
    for r in rows:
        by.setdefault(r["handle"], []).append(r)
    multi = {h: rs for h, rs in by.items() if len(rs) >= 2}
    print(f"\nhandles: {len(by)}; with 2+ posts in the batch: {len(multi)}" + (" — " + ", ".join(f"{h} ({len(rs)})" for h, rs in multi.items()) if multi else ""))
    print(f"comments on disk: {sum(1 for r in rows if r['commentsRead'] is not None)} of {len(rows)} posts")


def iso_t(v):
    if isinstance(v, (int, float)):
        return v
    try:
        return time.mktime(time.strptime(str(v)[:19], "%Y-%m-%dT%H:%M:%S")) if v else 0
    except ValueError:
        return 0


def searches(slug):
    d = os.path.join(ROOT, "apps", slug, "niche", "searches")
    posts = {}
    for f in sorted(glob.glob(os.path.join(d, "*.json"))):
        try:
            j = json.load(open(f))
        except Exception:
            print(f"{os.path.basename(f)}: not JSON", file=sys.stderr)
            continue
        if os.path.basename(f).startswith("general."):
            for x in j.get("data") or []:
                a = (x or {}).get("aweme_info") or {}
                if not a.get("aweme_id"):
                    continue
                s = a.get("statistics") or {}
                posts.setdefault(str(a["aweme_id"]), {"kind": "slideshow" if (a.get("image_post_info") or {}).get("images") else "video",
                    "handle": (a.get("author") or {}).get("unique_id", ""), "views": int(s.get("play_count") or 0),
                    "saves": int(s.get("collect_count") or 0), "t": a.get("create_time") or 0})
        elif os.path.basename(f).startswith("photo."):
            for it in j.get("item_list") or []:
                s = it.get("statsV2") or {}
                posts.setdefault(str(it.get("id")), {"kind": "slideshow", "handle": (it.get("author") or {}).get("uniqueId", ""),
                    "views": int(s.get("playCount") or 0), "saves": int(s.get("collectCount") or 0), "t": it.get("createTime") or 0})
        elif isinstance(j, list):
            for it in j:
                if not isinstance(it, dict) or not it.get("id"):
                    continue
                t = it.get("uploadedAt") or 0
                posts.setdefault(str(it["id"]), {"kind": "slideshow" if it.get("images") else "video", "handle": (it.get("channel") or {}).get("username", ""),
                    "views": it.get("views") or 0, "saves": it.get("bookmarks") or 0, "t": t})
    # Instagram: raw control characters inside strings, so strict=False. No saves, and no views on a photo or a carousel.
    for f in sorted(glob.glob(os.path.join(ROOT, "apps", slug, "niche", "instagram", "searches", "hashtag.*.json"))):
        try:
            j = json.loads(open(f, encoding="utf-8").read(), strict=False)
        except Exception:
            print(f"instagram/{os.path.basename(f)}: not JSON", file=sys.stderr)
            continue
        for it in ((j.get("output") or j).get("data") or {}).get("items") or []:
            pid = str(it.get("pk") or it.get("id") or "").split("_")[0]
            if not pid:
                continue
            video = it.get("media_type") == 2
            posts.setdefault("ig:" + pid, {"platform": "instagram", "kind": "video" if video else "slideshow",
                "handle": (it.get("user") or {}).get("username", ""),
                "views": max(it.get("play_count") or 0, it.get("view_count") or 0) if video else None,
                "likes": it.get("like_count"), "t": iso_t(it.get("taken_at"))})
    if not posts:
        sys.exit(f"no search files under {d} or {os.path.join(os.path.dirname(d), 'instagram', 'searches')}")
    now = time.time()
    for platform in ("tiktok", "instagram"):
        for kind in ("slideshow", "video"):
            ks = [p for p in posts.values() if p.get("platform", "tiktok") == platform and p["kind"] == kind]
            if not ks:
                continue
            recent = [p for p in ks if p["t"] and now - p["t"] < 90 * 86400]
            by = {}
            for p in ks:
                by.setdefault(p["handle"], 0)
                by[p["handle"]] += 1
            multi = sorted(((h, n) for h, n in by.items() if n >= 2), key=lambda x: -x[1])
            word = {"slideshow": "photos and carousels", "video": "reels"}[kind] if platform == "instagram" else f"{kind}s"
            print(f"{platform}: {len(ks)} {word} from {len(by)} handles; {len(recent)} from the last 90 days")
            if platform == "instagram" and kind == "slideshow":
                print(f"   like spread (no views reported): {spread([p['likes'] for p in ks if p['likes'] is not None])}")
            else:
                print(f"   view spread: {spread([p['views'] for p in ks])}")
            if platform == "instagram" and kind == "video":
                print(f"   like spread: {spread([p['likes'] for p in ks if p['likes'] is not None])}")
            print(f"   handles with 2+: {len(multi)}" + (" — " + ", ".join(f"@{h} ({n})" for h, n in multi[:12]) if multi else ""))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    if sys.argv[2] == "--searches":
        searches(sys.argv[1])
    else:
        batch(sys.argv[1], sys.argv[2])
