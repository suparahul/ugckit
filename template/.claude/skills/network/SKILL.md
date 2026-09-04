---
name: network
description: Stage R2 — for each app, find the handles that really promote it and reject the false positives. Name searches through Monid, about a cent each; comments of a post when the app is only in the picture.
---

# Stage R2 — network

    scripts/network.sh <project> <app> "<keyword>" ["<keyword>" ...]

Writes `research/<project>/<app>/candidates.tsv`: one row per handle with the evidence
columns. Run it once per app in the ledger, one app at a time.

## Keywords

The app's name in every form people write it: one word, two words, `<name> app`, the
hashtag. If the app has its own original sound, its sound page lists every post that
used it, named or not — pass the URL as a keyword and it is fetched as a page:

    scripts/network.sh <project> <app> "stronger" "stronger app" "strongerapp" \
        "https://www.tiktok.com/music/original-sound-123456"

## Deciding, one handle at a time

`candidates.tsv` puts the evidence next to each handle: how many of its posts name the
app in the caption or a hashtag, whether the handle or display name contains it, whether
it uses the app's sound. Rows with evidence sort first.

The rule is **evidence in, no evidence out.** A false positive here is scraped at R3,
its hooks enter the hook bank, and the teardown describes an account that has nothing to
do with the app. Nothing after this stage can undo that.

    scripts/state.py handle <project> <app> <handle> "captions name the app in 6 of 8 posts"
    scripts/state.py reject <project> <handle> "keyword match only — sells a course"
    scripts/state.py handle-set <project> <app> <handle> own yes    # the app's own account

Write every decision down, rejections included. A rejected handle is never scraped and
is never re-examined.

## The hidden promoters

The best posts often do not name the app at all. The app is on the screen for two
seconds, nothing in the caption, and the comments ask "what app is this". Those are the
posts most worth finding, and the caption columns cannot see them.

For a big post with zeros in every evidence column, read its comments:

    scripts/network.sh <project> <app> --comments "<best_url>" ["<url>" ...]

It prints the comments that name the app, ask for one, or were liked by the author —
the author's own reply naming the app is as good as a caption. Under half a cent a post.
Add the handle with the comment as the evidence, quoted.

Where the evidence is still unclear, give the user the profile link and ask. Do not
guess. `reject` with a reason beats `handle` on a hunch.

## Finish, per app

Record what the network is, in one line, in `research/<project>/<app>/NETWORK.md`: the
handle count, the shape (a brand account, personas, rented creators), and the rejected
count. When every app in the ledger has a network:

    scripts/state.py set <project> network done

Report the ledger per app and the R3 bill: handles × 50 posts × $0.00045, about two
cents an account. Get a yes on the number before running `harvest`.
