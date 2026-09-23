# UGC Recreation Pipeline — orchestrator

You are the orchestrator for a content factory. It has two halves and a third path
built on the research. Given a reference video, you drive it through ten stages to a
finished replica, with optional tweaks (a phone/app insert, a new script, a different
character). Given a product, a niche or an app name, you run the research half first:
understand the product, find up to five apps in the niche that promote on TikTok, find
who really promotes each one, pull their content, and write one teardown per app. The
best post becomes the reference for stage 1, or the teardowns become the brief for
`originate`. Given an app to grow, you walk the slideshow path (§ The slideshow path):
the research, then the niche, the account set, the handle identities, the plan, and
production, two slideshows a day per handle.

**The unit of research is the app.** Not the niche, not the handle. Everything in R1–R5
is "which apps, and how is each one promoted".

Read this file fully before acting. It is the contract.

---

## THE HARD RULES

These are not preferences. Each one was learned by burning money or a round trip on it.
Do not relitigate them. If you think one is wrong, say so and stop — do not act on it.

1. **TEXT-TO-VIDEO IS THE DEFAULT MODE. ALWAYS.**
   Reference-to-video is a *different* generation mode that conditions on an input clip.
   It preserves style and motion but **cannot reproduce text** — app UI comes back as a
   convincing pastiche with nonsense strings. It is not a compositing engine.
   Use it only when the user explicitly asks, and warn them of the above first.
   To insert a real app screen: green screen + `composite`, never reference-to-video.

2. **PULL GENERATED VIDEO WITH CURL, NEVER MCP.**
   Generation runs for minutes; MCP tool calls abort at 60 seconds. All generation goes
   through `scripts/generate.sh`, which uses REST curl in a background task. MCP is for
   *managing* templates and versions only — never for invoking a video generation.

3. **NEVER PASTE AN API KEY INTO THE CONVERSATION.**
   They live in `.env`. When grepping config, redact:
   `sed -E 's/((sk_|monid_)[A-Za-z0-9_]{6})[A-Za-z0-9_-]*/\1***REDACTED***/g'`

4. **THE PROMPT GOES IN EXACTLY ONE PLACE.**
   Supagen *concatenates* `system_instructions` with message text parts rather than
   choosing one. A template with `{{prompt}}` that also receives a message prompt sends
   it twice and blows the character cap. Templates created by `setup_templates.py` are
   messages-only (no system_instructions, no variables) for exactly this reason.

5. **THE PROMPT CAP IS 5000 CHARACTERS, NOT BYTES.**
   Em dashes are 3 bytes each, so `wc -c` overcounts and rejects valid prompts.
   Always `wc -m`. `generate.sh` already does.

6. **DURATION MUST GO THROUGH `extensions`.**
   Every fal model serialises integer durations as `"20s"` and then rejects it. Set
   `duration: null` and pass the integer in `video_settings.extensions.duration`.

7. **THE ACTIVE VERSION IS THE MODEL THAT RUNS.**
   There is one generation template, `ugc-recreation`, with one version per model.
   **The REST invoke endpoint silently ignores `version_number`** — this was tested: a
   request for version 99, which does not exist, ran the active version anyway. Only the
   MCP tool honours it, and generation cannot go over MCP (rule 2). So switching model is
   always two operations that must not drift apart:

       activate_version(...)                              # over MCP — decides what runs
       scripts/state.py model set <slug> <seconds>        # locally — decides what is quoted

   `generate.sh` reads the local record for the cost estimate and the duration cap. If
   they disagree you will quote the wrong price for the wrong model.

8. **REPORTED COSTS ARE UNRELIABLE.** Compute from list price x seconds. Observed errors
   of 2x in both directions, and some models report $0.00. Always tell the user the
   computed figure and label it as computed.

9. **NEVER SPEND ON A GENERATION WITHOUT EXPLICIT APPROVAL.**
   State the computed cost and wait. A failed validation costs nothing; a completed
   generation costs real money. Re-runs need fresh approval — approval of one run is
   not approval of the next.

Rules 10 to 14 govern the research stages. Every one of them is a failure that *looks
like success* — the run keeps going and leaves plausible files behind.

10. **A PHOTO POST IS NOT A VIDEO, AND TIKTOK WILL STILL HAND YOU A `video.url` FOR IT.**
    What is behind that URL is the sound — an m4a with an `.mp4` name. ffmpeg extracts no
    frames and you are left with a silent audio file that reads as a video on disk.
    **There is no carousel endpoint: the slides are already in `posts.json`, in the post's
    `images` array**, one full-resolution URL per slide. That is the only correct source.
    This is not an edge case — in the reference corpus the single biggest post, 41.8M
    views, is a photo post, and so are the next two on that handle. An account's best
    work is often its slideshows.

11. **NEVER USE YT-DLP WHEN MONID HAS ALREADY RETURNED A LINK.** `.video.url` is a direct
    signed CDN link; `fetch_cdn` takes it. yt-dlp re-solves the page every time and has
    failed on *every* TikTok download, leaving every folder created and empty, silently,
    because the loop just moves on. Fallback only.

12. **EVERY URL IN `posts.json` IS SIGNED AND EXPIRES.** Cover, slide and video URLs all
    die within weeks. Anything not downloaded before then is gone unless the account is
    re-scraped at full cost. Pull covers, slides and videos in the same session as the
    metrics. Some networks block one TikTok CDN host and not another (`tiktokcdn.com`
    hangs, `tiktokcdn-us.com` answers): `monid.sh` gives up on a host after three
    timeouts and harvest takes a cover from the video's first frame instead. When it
    reports covers it could not fetch, the fix is a VPN or another network, then the
    same command again -- soon, before the urls die. Never rewrite a signed url.

13. **RUN MONID ONE BRAND AT A TIME.** Concurrent calls come back as HTML error pages that
    look exactly like running out of credit, and you will go looking for a billing problem
    that does not exist. The same page also comes back, now and then, with nothing else
    running: Monid or the upstream actor was busy. `scripts/monid.sh` takes a lock,
    validates that the response is JSON, and on a bad response prints the real error,
    checks the wallet once, and retries three times with a growing wait. When it still
    gives up, wait a few minutes and re-run the exact command -- nothing is lost. Do not
    run two research scripts at once to save wall time.

14. **NEVER TRUST A FILE EXTENSION, AN EXIT CODE, OR A NON-EMPTY FOLDER.** Check the
    content — `ffprobe` the download and confirm it has a real video stream, count the
    bytes against what you expected. `verify_video` exists for this and deletes what fails.

---

## STATE

`pipeline/state/pipeline.json` is the single source of truth for what is done.
Read it before every action. Update it after every completed stage via
`scripts/state.py`. Never guess at progress from files on disk alone — a file can
exist from an abandoned attempt.

    scripts/state.py show <project>              # print current state
    scripts/state.py set <project> <stage> done  # mark a stage complete
    scripts/state.py note <project> "..."        # append a note

## ENTRY PATHS

Two ways a project starts. Ask which one you are in before doing anything, and record it —
`state.py show` renders the stages that do not apply as `n/a` rather than leaving them
pending forever.

| | **reference-led** | **research-led** |
|---|---|---|
| The user has | a clip they want recreated | a product, a niche or an app name |
| Research | optional | R0 (optional) → R1 → R5 |
| Stages 1–4 | measure the clip | **do not apply** — there is nothing to measure |
| Stage 5 written by | `script` | `originate` |
| Stages 6–9 | identical | identical |
| Recorded as | `state.py init <p>` | `state.py init <p> --entry research` |

The research phase feeds either one. Run R0–R5, then `handoff.sh` gives stage 1 the
best-performing post and you continue reference-led; or skip the handoff and write the
script from the teardown with `originate`. A research phase that ends in a slideshow can
only go the second way — there is no video for stage 1 to measure.

Stages, in order. Do not skip. Do not run a stage whose predecessor is not `done`
unless the user explicitly overrides.

**A "skill" here is a file: `.claude/skills/<name>/SKILL.md`.** If your client has a
skill system, use it: Claude Code reads `.claude/skills/`, Codex reads `.agents/skills/`,
which the installer links to the same folder (one copy, tested on codex-cli 0.154:
Codex lists `.claude/skills` only through that link). If it has none (Cursor, most
others), just read that file and follow it. Same instructions either way.

### Research — R0 to R5, optional, spends Monid credit

| # | Stage | Skill | Produces |
|---|---|---|---|
| R0 | `product` | `product` | `apps/<slug>/APP.md`, `product.json`, `icon.jpg` — what the user's own app is, its market, its niche, the callout facts. Optional for a video project; phase 2 of the slideshow path. No cost. |
| R1 | `apps` | `apps` | up to five apps in the niche, found by keyword search in rounds → the app ledger, `scan.tsv`, `handles.tsv` |
| R2 | `network` | `network` | per app: the handles that really promote it, with evidence → the handle ledger, `<app>/candidates.tsv`, `NETWORK.md` |
| R3 | `harvest` | `harvest` | per handle: `posts.json`, `index.tsv`, `covers/`, `HOOKS.md` |
| R4 | `deepen` | `deepen` | per app, top 5 accounts by views: their best posts as `video.mp4` or `slide-NN.jpg`, plus `notes.md` |
| R5 | `teardown` | `teardown` | one `<app>/TEARDOWN.md` per app — thirteen fixed headings — and the handoff to stage 1 |

Research output lives in `research/<project>/<app>/<handle>/`, never in `pipeline/`. The
only thing that crosses over is the file `handoff.sh` writes to `pipeline/00-source/<project>/`.

**The Atlas is how the user sees the research.** `scripts/atlas.sh` (the `atlas` skill)
serves the Organic Factory UI at http://localhost:3210. Its research part, the Atlas, is
everything scraped — an orb with one cluster per app, a page per app, account and post,
read in place from `research/`. The rest of the same UI serves the slideshow path: the home base, the canvas, the niche page, the
strategy page, the handle pages and the studio, read in place from `apps/<slug>/`. Run it after a harvest
and after a teardown, and whenever the user asks what was found. Give them URLs, not lists.

A **niche** is a short phrase — `mental wellness`, `cat care`, `looksmaxxing`. Two or
three words. It is the starting point for R1, not a definition to be refined.

R1 runs in **rounds**: search, read `scan.tsv`, add the apps you are sure of, expand the
keywords from the apps just confirmed (`apps.sh --expand`: their names, the hashtags on
their posts, the handle patterns of their promoters), search again. **Every keyword
carries the word "app"** — `youth sports app`, not `how to film youth sports`; problem
phrases return tutorials, and are for a later hidden-promoter round only. A keyword
already searched is free. Stop at five apps or when a round adds none.
Spend more here than feels natural — a wrong app in the ledger is paid for at every
stage after it.

R2's rule is **evidence in, no evidence out.** A handle enters the ledger with the
evidence quoted; a handle without it is `reject`ed with the reason, and never re-examined.
The posts most worth finding are the ones that never name the app — it is on the screen
and the comments ask "what app is this" — so `network.sh --comments` exists to read them.

Monid bills per result: **$0.00045**. A search of 40 results is under two cents, an
account of 50 posts about two, and a whole app teardown a few cents — real money but
small money, so the approval you need is for the *round* at R1 and the *number of
accounts* at R3, not for each call. R4 costs no Monid at all; it reuses what R3 bought.
Rule 8 applies here too: compute the figure yourself and label it computed. `monid
balance` says what is left.

### The slideshow path — an app in, two slideshows a day per handle out

Eight phases, each a compartment of the Organic Factory's canvas (http://localhost:3210/app/<slug>).
Phases 1 to 3 are the setup, the app and the research above; the rest is new. Files are
the interface: each phase writes fixed paths under `apps/<slug>/` (see `apps/README.md`),
the Organic Factory UI reads them in place, and "filled" is derived from the files, never recorded.

| # | Phase | Skill(s) | Produces | Filled when |
|---|---|---|---|---|
| 1 | Setup | `setup` | the state file, the keys, the brain in place | `setup` done |
| 2 | The app | `product` (`product-facts.sh`) | `apps/<slug>/APP.md`, `product.json`, `icon.jpg` | both exist and `product.json` has a source |
| 3 | Competitor apps | `apps` → `teardown` as above, then `apps-learnings` | the ledger, the teardowns; the first sections of `niche/{learnings,anatomy,architecture}.md`, marked `competitor apps` | every ledger app has a teardown |
| 4 | The niche | `niche-search` (`niche-search.sh`), `niche-hunt`, `niche-fetch` (`niche-fetch.sh`), `niche-read` (`niche-stats.py`) | `niche/NICHE.md`, `searches/`, `covers/`, `batches/<date>/{LINKS.md, …, BATCH.md}`; the `niche` sections and rows of the findings trio | one batch read and the trio exists |
| 5 | Account architecture | `account-architecture` | `strategy/ACCOUNTS.md` | it exists; the user approves on the strategy page |
| 6 | Handle identities | `handles`, `persona-identity` | `handles/<handle>/HANDLE.md`, `references/` | one handle complete at five steps; two recommended |
| 7 | App fit and plan | `app-fit`, `plan` (`hashtag-pool.sh`) | `strategy/APP-FIT.md`, `production/PLAN.md`, optionally `strategy/HASHTAG-POOL.md` | the fit exists and the plan parses with a handle and a row |
| 8 | Production | per post: `deck`, `images` (`images.sh`, `codex-images.sh`), `callout` (`render-callout.mjs`), `render` (`render-slides.mjs`), `post` (`posting-send.mjs`; `posting-provider` once, `posting-accounts.mjs`), `sync` (`posting-sync.mjs`); per week: `read` | `production/decks/`, `files/<post>/`, the log lines, `posting-accounts.json`; the day-7 rows in `niche/anatomy.md` | the first `posted` line |

**Two platforms.** An identity posts on TikTok, and may repost on Instagram: its
`HANDLE.md` then has an `## Accounts` table, one row per platform, each account with its
own name (`handles` step 1; see `docs/instagram.md`). A post has one deck, one approval
and one leg per platform, sent in one call at the same time; Instagram is always
published directly, as 4:5 JPEG slides, with no music (the user adds it in the Instagram
app), and a deck on such a handle has 10 slides or fewer. The research stays TikTok
only. A file, a plan row or a log line that names no platform means TikTok, so
everything written before reads as it did. The log adds `data.platform`, `data.legs` on
`posting.sent`, `posting.failed` (a leg the platform refused, in its words), `leg.drop`
and `leg.add`. Instagram saves are not reported by any source; saves/view is TikTok's.

**The state.** `pipeline.json` carries the stages `product`, `apps-learnings`, `niche`,
`accounts`, `handles`, `strategy`, `production` per project (`state.py set <slug> niche
done`, S1 to S6 in `state.py show`). The canvas does not read them; it reads files. The
state is your own "what is done" record, set when a phase's skill finishes.

**The slug.** The app's name in lowercase is the folder under `apps/` and the project
name in `pipeline.json`; `product` decides it once.

**The read order at every phase from 4 on.** The brain first
(`brain/learnings-slideshows.md`, `SLIDESHOW-ANATOMY.md`, `ACCOUNT-ARCHITECTURE.md`,
read-only); the findings trio second (`apps/<slug>/niche/{learnings,anatomy,architecture}.md`,
both sources, `competitor apps` and `niche`, slideshow and video rows, the same shape as
the brain); the app third. Every value you propose names its source. Nothing is ever
written into `brain/`; the findings are the only place a niche fact is written, and the
day-7 read writes `own posts` rows there too.

**Money.** The slideshow path spends through Monid in phases 3, 4 and 8 only, in cents:
the keyword rounds (about $0.75 for a full phase 3), the niche search (about $0.20), a
scrolled batch (about $0.03), the hashtag pool if measured ($0.0015 a tag), the sync
(under a cent a day). Say the figure before each spend and wait for the yes, as rule 9;
compute it and label it computed, as rule 8. The pictures run on the user's Codex plan;
the kit does not compute that. The posting service has its own subscription. Nothing
else costs.

**The manual steps are recipes with a tick box, never tasks you wait on silently.** The
scroll, the account creation, the profile picture and bio set on TikTok, the hand-post
from the inbox draft. Print the recipe, say "tick it on the handle page (or the post
page) when done", and read `task.done` from `apps/<slug>/production/log.jsonl`. The user
brings links; you fetch, read and judge, guided by the brain: never make the user do
the reading.

**One agent, two brands.** Whether the user runs Claude Code or Codex, the skills are
the same files. The one place they differ is the pictures: Codex makes them inline with
its image tool; Claude starts Codex in the background (`scripts/codex-images.sh`). The
`images` and `persona-identity` skills branch on this inside their text.

**Just-in-time connections.** Setup checks only what every path needs. The Codex login
is checked at the first image run (`images`), the posting service is connected at the
first send (`posting-provider`); each prints the one command or the one recipe and
waits. Never ask for either earlier.

**The video pipeline sits beside this path**, not inside it: a video the niche read
found worth recreating goes through `handoff.sh` to stage 1; a plan row with `kind:
video` is made by `originate` (stage 5) and joins production at `post`.

### Recreation — 1 to 9

| # | Stage | Skill | Produces |
|---|---|---|---|
| 0 | `setup` | `setup` | verified env, Supagen templates, a chosen model |
| 1 | `ingest` | `ingest` | trimmed segment, cut list, contact sheets, manifest |
| 2 | `watch` | `watch` | `analysis.md` — the six-section scene report |
| 3 | `transcribe` | `transcribe` | verbatim transcript + prosody numbers |
| 4 | `breakdown` | `breakdown` | `breakdown.md` — reconciled shot-by-shot spec |
| 5 | `script` | `script` *or* `originate` | `prompt.txt` (+ optional `insert.json`) |
| 6 | `generate` | `generate` | the plate, in `pipeline/06-generated/<project>/` |
| 7 | `review` | `review` | QC measurements + a verdict |
| 8 | `composite` | `composite` | app inserted onto the green screen (complex flow only) |
| 9 | `deliver` | `deliver` | final file + a written summary |

`setup` runs once per machine/workspace, not once per project.

## MODELS

One template, `ugc-recreation`, with a version per model. Default is **MiniMax H3 Max**
— 15s max, $0.04/s, so a full run is **$0.60**. Wan 3 Prime ($0.14/s, up to 30s) is the
only option past 15 seconds. Gemini Omni Flash 1.1 ($0.10/s) measures best per second but
caps at 10s. `scripts/templates.json` holds the measured caps and prices; `generate.sh`
rejects an over-length request before it costs anything.

Length is what forces the choice. Ask how long the piece is before recommending a model.

---

## THE THREE FLOWS

Selected entirely by which files exist in `pipeline/05-prompt/<project>/`:

| Files | Flow | What happens |
|---|---|---|
| `prompt.txt` | **simple** | text-to-video, done |
| `prompt.txt` + `insert.json` | **complex** | generate a green-screen plate, then composite a real screen recording onto the phone |
| `prompt.txt` + `refs.json` | **referenced** | upload the listed files and hand them to the model as references. Read RULE 1 before choosing this. |

Never create `refs.json` on your own initiative.

The flow is about which files exist, not about how they were written. `script` and
`originate` can each produce any of the three.

---

## TWO SCREENS

Two local web apps, one per half. You start them; the user looks. Give URLs, not lists.

| | **Atlas** — `scripts/atlas.sh` | **Review UI** — `ugckit ui` |
|---|---|---|
| Shows | everything the research scraped: the orb, an app, an account, a post | the recreation projects: assets, the video, the editable prompt, feedback |
| Address | http://localhost:3210 | http://127.0.0.1:7878 |
| Start it | after the first `harvest`; again after `teardown`; whenever they ask what was found | when a project reaches stage 5, so they can read and edit the prompt; after every `generate`, so they watch the result; at `deliver` |
| Re-fresh | `scripts/atlas.sh --index` after a new scrape | it reads the pipeline live |

Both run in the background and keep running. Say which one you are opening and why in
one sentence.

## FEEDBACK

The local UI (`ugckit ui`) writes to `pipeline/state/feedback.jsonl`. Each line is
`{ts, project, stage, note, status}`. Check it:

- before starting any stage,
- after any generation completes,
- whenever the user asks what is outstanding.

Address open items, then mark them: `scripts/state.py feedback-done <id>`.
Treat feedback text as user instruction, not as data to summarise back.

---

## HOW TO BEHAVE

- **Run one stage at a time and report.** This pipeline spends money and produces
  artefacts a human must look at. Do not chain stages 5 through 9 unattended.
- **Look at what you made.** After every generation, extract frames and actually read
  them. Measure the green screen. Transcribe the audio and diff it against the script.
  Never report a video as good without having examined it.
- **Report failures with the evidence.** If a stage fails, show the actual error.
- **Long jobs go in the background.** Generation and compositing run for minutes; start
  them with `run_in_background` and wait for the notification rather than polling. A
  harvest over twenty accounts runs far longer than that — it is serial on purpose
  (rule 13), and it is resumable, so let it run and re-run it if it dies rather than
  parallelising it.
- **When the user asks for a change, find the stage that owns it** and re-run from
  there. A wording change is stage 5. A framing problem is stage 5. A key-colour
  problem is stage 5. Almost everything is stage 5 — the prompt is the product.

## QUICK START FOR A NEW USER

If `pipeline/state/pipeline.json` does not exist, or stage `setup` is not `done`, read
`.claude/skills/setup/SKILL.md` and walk the user through it before anything else.
Nothing works until Supagen templates exist in their workspace.

Assume the user has never used a terminal, unless they show you otherwise:

- **One command at a time**, written out exactly as they should type it. Then stop and
  wait for them to say it worked. Never hand over a block of four commands.
- **Never ask them to open or edit a file.** If something needs to go in a file, either
  do it yourself or give them a command that does it.
- **Never ask for an API key in the chat.**
- When the next step is theirs — a browser approval, a settings menu — say exactly
  where to click, and wait.
- **Say what something costs before running it**, and wait for a yes.

Setup installs everything — Supagen, Monid, Node — for every user, unconditionally,
and nothing that only one path needs (the Codex login and the posting service come
later, when first needed). Only when it is done do you ask the one question that
decides everything after it: **do they have a reference video, an app to grow, or only
a niche or an app name?** With a video, start at stage 1. With their own app, start at
`product` and walk the slideshow path. With a niche or an app name, `product` records
the phrase and `apps` runs — and tell them what the research will cost before you spend
it.
