# apps/ — one folder per app you grow

The agent writes every file here; the Organic Factory (`./ugckit atlas`, http://localhost:3210)
reads them in place. Files are the interface: fixed paths, fixed headings. A missing file
is a pending slot on the canvas, never an error.

    apps/<slug>/                 <slug> is the app's name in lowercase, and its project name in pipeline/state/pipeline.json
      APP.md                     the app: what it is, the niche phrase, the hero features
      product.json               the product callout facts: name, subtitle, button, icon, source, fetchedAt
      icon.jpg                   the App Store icon
      niche/
        NICHE.md                 the keywords, the doors run, the search log
        searches/                photo.<kw>.p<N>.json (the Photo tab door: slideshows), general.<kw>.p<N>.json
                                 (the general search door: recent videos); <kw>.<WINDOW>.json (the apidojo video search)
        covers/<postId>.jpg      the first slide of every slideshow found, the cover of every video
        instagram/               only when you said yes to Instagram niche research: searches/hashtag.<tag>.<feed>.p<N>.json,
                                 covers/<id>.jpg
        batches/<date>/          one scrolled batch: LINKS.md (what you brought, verbatim), posts.raw.json,
                                 <handle>/<postId>/ (slides or video + contact sheets + transcript, comments, post.json),
                                 screenshots/, BATCH.md (the read)
        learnings.md             your findings, dated sections, the shape of brain/learnings-slideshows.md
        anatomy.md               your findings' post-table rows, the shape of brain/SLIDESHOW-ANATOMY.md
        architecture.md          your findings' account-table rows, the shape of brain/ACCOUNT-ARCHITECTURE.md
      strategy/
        ACCOUNTS.md              how many handles, the role of each, the subject, the name pattern, the cadence
        APP-FIT.md               every parameter of both brain sheets, one value each, with a source and a status
        HASHTAG-POOL.md          optional: the measured hashtag pool
      handles/<handle>/
        HANDLE.md                the identity: head lines (…, Dimension:, Slide style:), Accounts (optional:
                                 one row per platform, see docs/instagram.md), Persona, Bio,
                                 References, Defaults, Style prefix, Identity rule, Post-process step
        references/              face.png, subject-<name>.png, style.png, profile.png
      production/
        PLAN.md                  the plan: App:, App Store id:, Posting zone:, Home zone:, Posting service:,
                                 Platforms: (optional), the posts table
        decks/<date>-<short>.md  one deck per handle per day
        log.jsonl                append-only decisions: approvals, sends, posted links, outcome reads, ticks
        files/<date>-<short>-<n>/  slide-NN/ candidates, cards/, final/ (and final/instagram/), images-job.json, images-result.json
        posting-accounts.json    handle -> posting-service account per platform, written at the first send

`brain/` (read-only, shipped by the kit) is read together with `niche/` at every stage from the
niche read on. Money is spent only in the competitor-apps phase, the niche phase and the sync,
in cents, and the agent says the figure first.
