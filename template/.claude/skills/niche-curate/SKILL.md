---
name: niche-curate
description: Phase 4, the curation of the niche page — the user's Rule out and Study marks, applied to the rest. Learn from the sample marks the user made in the Atlas edit mode, write or update the cleanup rules (niche/CLEANUP.md) when asked, mark the remaining posts in marks.json, and fetch the full slides or video of every Study post (niche-fetch). Runs by itself after every niche search, refresh and batch when CLEANUP.md exists. Marking is free; the fetch says its figure first.
---

# Phase 4 — the curation (niche-curate)

    scripts/niche-marks.py show <slug>                       the counts, the cleanup rules, your sample marks
    scripts/niche-marks.py list <slug> [--unmarked] [--kind slideshow|video] [--min-views N]
                                                             one TSV line per post of the catalog
    scripts/niche-marks.py set <slug> <out|study|clear> <key>... --rule <id> --why "<few words>"
    scripts/niche-marks.py study <slug> [--date <today>] [--write]
                                                             the Study posts not on disk; --write puts them in
                                                             batches/<date>/LINKS.md for niche-fetch

The niche search brings in many posts that are of no use to this app. The user marks some
on the niche page (http://localhost:3210/app/<slug>/niche, **Edit marks**), and asks you to
clean up the rest the same way. Three states a post:

| Mark | On the page | Meaning |
|---|---|---|
| `out` (Rule out) | gone from the explorer; the marks pick "ruled out" shows it | of no use; nothing is deleted |
| `study` | a ★ Study line, "to fetch" or "on disk" | the user wants the full slides or video, to study |
| none | as it is | kept, not downloaded; this is the default and needs no mark |

`keep` is a fourth value only the page writes: the user took back an agent mark. It shows
as unmarked and means "leave it alone".

## The file: `apps/<slug>/niche/marks.json`

    {
      "version": 1,
      "marks": {
        "tiktok:7412345678901234567": { "mark": "out", "by": "you", "at": "2026-10-19T10:02:11Z", "handle": "x", "caption": "…" },
        "tiktok:7498765432109876543": { "mark": "study", "by": "agent", "at": "…", "handle": "y", "caption": "…", "rule": "S1", "why": "a numbered list of signs, 5 slides" }
      }
    }

The key is `<platform>:<post id>` (TikTok ids are the number in the post url). `by` is
`you` (the page) or `agent` (you). `rule` names the rule in `CLEANUP.md` you applied;
`why` is a few words the user reads under the tile. The keys stay sorted and the file is
written whole: use the script, or edit the JSON by hand in the same shape. The marks
live outside the catalog, so an index rebuild, a new search or a refresh never loses
them. Never delete a post, a cover or a search page to "clean up": the mark is the
cleanup.

**The one hard rule: a mark by `you` is never changed by an agent**, `keep` included.
The script skips such a key and names it. If a rule of yours contradicts a mark of the
user, the user's mark wins and the rule is wrong: say so.

## 1. Learn from the samples

`show` prints every mark of the user with its post: the kind, the handle, the views, the
keywords, the caption. Read them, and open the covers of the ones the caption does not
explain (`apps/<slug>/niche/covers/<id>.jpg`, one at a time). Say back, in a short list,
what you think the user is doing: for example "rules out other animals, giveaway posts,
fan art; studies numbered-list slideshows over 100K views". Each line names the sample
keys it comes from. When a pattern rests on one sample, say so.

## 2. The cleanup rules: `apps/<slug>/niche/CLEANUP.md`

The rules are the niche's memory of what is relevant. Write the file when the user asks
for it ("write the cleanup rules", "remember this for next time"), or when you finish a
cleanup and the user agrees to keep the rules. Update it, never rewrite it silently,
when the user corrects a mark or tells you a new rule: add the rule, or change it with a
dated line under it. The shape is `docs/niche-cleanup.example.md`:

- `## Rule out`, `## Study`, `## Keep (never rule out)`, `## Ask` — one bullet per rule,
  led by its id in bold (`C1`, `S1`, `K1`), then the rule in plain words, then
  `Examples:` with two or three keys and handles from the user's marks.
- An `Updated:` line with the date and where the rule came from (the sample marks of a
  date, or the user's words, quoted).

Judge each post by what the rule says, not by the keyword that found it: a rule is about
the post's subject, its format and its numbers. A post the rules do not decide stays
unmarked; a post you are unsure of goes under `## Ask` in your report, never marked.

## 3. Apply them to the rest

`list <slug> --unmarked` gives the posts with no mark. Read every caption; open a cover
when the caption is empty, in another language, or does not say the subject. Then mark in
groups, one call per rule:

    scripts/niche-marks.py set <slug> out 7412… 7413… --rule C1 --why "not about cats: dogs"
    scripts/niche-marks.py set <slug> study 7498… --rule S1 --why "numbered list, 5 slides, 210K views"

Prefer leaving a post unmarked over a wrong `out`: a ruled-out post leaves the user's
view. When the user asks for a cleanup without rules on file, apply what you said back in
step 1 and offer to keep it as `CLEANUP.md`.

## 4. Fetch the Study posts

Every post marked `study` (by the user or by you) is wanted in full. `study <slug>` lists
the ones whose slides or video are not on disk yet. Then:

    scripts/niche-marks.py study <slug> --date <today> --write    the rows, in batches/<today>/LINKS.md
    scripts/niche-fetch.sh <slug> <today> --plan                   the cost

That is the `niche-fetch` path, unchanged: say the figure (about $0.002 a post with its
comments) and wait for the yes, then fetch; then `cd atlas && npm run index`, and run the
`niche-read` skill on that batch so the posts are read slide by slide. Instagram posts
cannot be fetched by niche-fetch: say so and leave them marked.

## When this runs by itself

After a `niche-search` run, a weekly refresh, or any batch `niche-read` has written: if
`apps/<slug>/niche/CLEANUP.md` exists, rebuild the index (`cd atlas && npm run index`),
then apply it to the unmarked posts (steps 3 and 4) without asking: marking is free. The
fetch of new Study posts still says its figure and waits for the yes. No `CLEANUP.md`: do
nothing, and say in one line that the user can mark samples and ask for a cleanup.

## Finish

Report: the posts marked, by rule (`out` and `study`), the user marks you skipped, the
posts left unmarked, the posts under Ask with one line each, the Study posts on disk and
to fetch, and the change to `CLEANUP.md` if any. Open
http://localhost:3210/app/<slug>/niche?marks=out for the ruled-out posts and
`?marks=study` for the Study posts, so the user can check them and take back a mark.
