# ugckit — effectiveness review

**Question asked:** can someone following ugckit actually (a) find the right apps to study,
(b) find and map the creator handles behind an app, (c) pull and organise the content, and
(d) get to real findings?

**Judged against:** `~/Documents/code-max/organic-social` — the completed, by-hand research
project that tore down six apps (ventnow, potto, stronger, jobstep, umax, roamy), 128
accounts, ~5,455 posts, ~1.0B views, and produced `learnings.md`, six `TEARDOWN.md`s,
`PLAYBOOK.md` and a derived `library/`.

**Reviewed:** ugckit v0.2.0 (`VERSION`), read in full — `README.md`, `install.sh`,
`template/AGENTS.md`, all eighteen `template/.claude/skills/*/SKILL.md`, and every script
under `template/scripts/`. `scripts/doctor.py` was run read-only against the template
directory. Nothing was modified in either repo; no scraping API was called.

**Verdict in one line:** the collection machinery is genuinely good — better instrumented
than the originals it was built from — but the two ends are weak. **App discovery rests on
one untested experiment, handle discovery has had the single highest-value technique
(the browser eye test) removed rather than automated, and there is no stage that produces
the actual deliverable** — the cross-app synthesis that `PLAYBOOK.md` is. A competent
operator would reproduce roughly the middle 60% of organic-social with ugckit today.

---

## 1. Honest inventory — what it claims, what is actually in there

### 1.1 Claim

`README.md`: *"give it your product, a niche or an app name. It works out the niche, finds
up to five apps in it that promote on TikTok, finds who really promotes each one, pulls
their content, transcribes the on-screen hook off every post, and writes one teardown per
app."* Then the recreation half turns the winning post into a generated video.

### 1.2 What is on disk

Two halves, eighteen skills, twelve shell scripts and nine python scripts. **Nothing is a
stub.** I read every research script line by line; every one does what its name says, and
several do more than the organic-social original did.

| Stage | Skill | Script | Real? | What it actually does |
|---|---|---|---|---|
| R0 product | `product` | *(none)* | prose only, by design | Agent reads a website/doc/repo and writes `PRODUCT.md`. Fixed six headings including a `Niche` phrase and a `Search words` list. Honest about being scriptless. |
| R1 apps | `apps` | `apps.sh` (236 ln) | **real** | Two Monid searches per keyword (`ALL_TIME` + `LAST_THREE_MONTHS`, `MOST_LIKED`, `maxItems` 40). Then a pure-python scan over *every* search ever run for the project → `scan.tsv` (recurring hashtags / `<x> app` phrases / channel names, with post counts, views, handle counts), `handles.tsv`, `searches.tsv`. `--expand` re-reads the corpus for posts naming a confirmed app and prints its hashtags, `<x> app` phrases and handle patterns, plus a not-yet-searched keyword suggestion list. Warns if no keyword contains "app". |
| R2 network | `network` | `network.sh` (164 ln) | **real** | Same search endpoint, per app; a `https://` argument is passed as `startUrls` so hashtag **and sound pages** work. Builds `candidates.tsv` with evidence columns `names_app / in_handle / in_sound / best_views / best_url`. `--comments` calls `/scraptik/tiktok-comments-scraper-api` and tags comments that name the app, ask for one, or come from the post author. |
| R3 harvest | `harvest` | `harvest.sh` (169 ln) | **real** | Profile scrape → `posts.json`, `index.tsv` (rank 1 = newest), `covers/NNN.jpg` pulled in the same session, then `hooks-NN.md` batches of 12 covers read by a headless Haiku session, concatenated into `HOOKS.md`. Falls back to a `hooks.todo` the orchestrator reads itself when `claude` is not on PATH. Fully resumable at every step. |
| R4 deepen | `deepen` | `deepen.sh` (184 ln) | **real** | `--rank` sorts the app's harvested accounts by *total views* and marks the top 5 `deep`. `--deep` writes `manifest.tsv`, `slides.tsv`, `shortlist.tsv`, then pulls video (`fetch_cdn` + `ffprobe` + 4×4 contact sheets) or slides (from the `images` array), and writes `notes.md` via Haiku or leaves `notes.todo`. Costs no Monid. |
| R5 teardown | `teardown` | `handoff.sh` (53 ln) | **real** (prose + handoff) | The teardown document is written by the agent to thirteen fixed headings. `handoff.sh` copies the winning `video.mp4` into `pipeline/00-source/`, ffprobes it, and **refuses a photo post with the right explanation**. |
| — | `atlas` | `atlas.sh` + a full Next.js app | **real** | `atlas/scripts/build-index.mjs` walks `research/<project>/<app>/<handle>/`, joins `posts.json` / `index.tsv` / `HOOKS.md` / `covers/NNN.jpg` on the rank spine, reads the app ledger out of `pipeline/state/pipeline.json`, and tolerates every partial state. 15 hook rules and 4 insertion rules in `atlas/data/*.json` are organic-social's findings, generalised. This is not a placeholder; it is the walkthrough app ported. |
| — | shared | `monid.sh` (191 ln) | **real, and the best file in the repo** | `monid_lock` (mkdir-based, portable), JSON-shape validation, 3 retries with growing backoff, one wallet check, an auth-error short-circuit, `fetch_cdn` with per-host dead-host detection after 3 connect failures, `frame_from_video` cover fallback, `verify_video`, `to_jpg`, `spend`. |
| — | state | `state.py` (456 ln) | **real** | Project state, stage status, spend ledger, feedback queue, **and** the research ledgers: niche, apps, per-app handles with `views / harvested / deep / winner / evidence / own`, plus a rejection ledger. Atomic writes. |
| — | corpus query | `library.py` (195 ln) | **real, but see §5.6** | Queries `hooks.jsonl` / `templates.json` / `formats.json` / `mechanics.json` / `media/*/TEARDOWN.md` at `LIBRARY_DIR`. **It only reads. Nothing in ugckit builds these files.** |
| 0–9 recreation | `setup` … `deliver` | `ingest.sh`, `watch.sh`, `transcribe.sh`, `generate.sh`, `qc.py`, `screen_comp.py`, `composite.sh`, `ui.py` | **real** | ffprobe/trim/contact sheets; a Supagen "watching layer" over REST; two-pass local faster-whisper with prosody numbers; a generation script that refuses without `CONFIRM=1`, counts `wc -m` not `wc -c`, and refuses `refs.json` without `ALLOW_REFS=1`; a 305-line OpenCV compositor; a FastAPI review UI. |

**Placeholders and dangling references, the complete list:**

- `pipeline/*/` and `research/` are empty `.gitkeep` skeletons — correct, that is the point.
- `AGENTS.md:42` cites *"Templates created by `setup_templates.py`"*. **No such file exists.**
  Templates are actually created over MCP by the `setup` skill. Harmless to a human, but an
  agent told to look for that script will not find it.
- `README.md` promises fourteen hard rules; `AGENTS.md` has exactly fourteen. Consistent.
- `template/scripts/__pycache__/` is committed and gets `-prune`d by `install.sh`. Cosmetic.

**So (c) — "pull and organise the content" — is answered: yes.** The harvest/deepen layer is
strictly better instrumented than `tools/shallow-pass.sh` and `tools/slides-pass.sh`: it has
a lock, JSON validation, retry, dead-host handling, a cover-from-first-frame fallback and a
no-`claude`-CLI path, none of which the originals had. The rest of this review is about
(a), (b) and (d).

---

## 2. App discovery (R1) — the weakest link, and the most expensive one

### 2.1 What ugckit tells you to do

`.claude/skills/apps/SKILL.md` is specific and readable:

1. Get a niche phrase (from R0, or the user). Record it with `state.py niche`.
2. Round 1 = four to six keywords, **every one carrying the word "app"** —
   `<niche> app`, `<niche> apps`, `best <niche> app`, `app for <niche>`, plus one or two
   near-neighbour nouns.
3. Explicitly *not* problem phrases: *"`how to film youth sports` … return tutorials, gear
   reviews and parents' highlight clips. They can run for a whole round and surface no app
   at all, at full cost."* `apps.sh` prints a warning when no keyword contains "app".
4. Read `scan.tsv`. *"An app shows as a hashtag, a `<name> app` phrase or a channel name,
   across **several handles**. One handle using a hashtag is an account, not an app."*
5. `apps.sh --expand` to derive the next round's keywords from confirmed apps.
6. Stop at five apps or when a round adds none.

That is a followable procedure with a stopping rule, a cost figure per round (~$0.036/keyword),
and an anti-pattern named. It is better specified than anything in organic-social, which has
**no app-discovery step at all.**

### 2.2 What organic-social actually did

This is the important comparison and it is uncomfortable.

- **The six apps were not discovered. They were harvested from other people's writing.**
  `research-process.md` sets up a *Reference Apps* index in `learnings.md` fed by seven
  written sources (four X threads, plus Nicholas Dulait, Chris/@everestchris6, and the paid
  Social Growth Engineers September 2026 report). `HANDOFF.md` lists the teardown targets that
  came out of it: *"truthseek, deepsearch AI, photogenik, roamy, fable, stronger, creed, erly,
  Vent Now, Depuff AI, Bloat Down … plus new from the SGE card pass: Potto, @exposrapp …"*.
  Stronger was picked because it was *"the only app in `learnings.md` named twice"*
  (`media/stronger/NOTES.md`). Potto and JobStep came out of the SGE report with revenue
  numbers attached — *"$2M ARR in 8 months off a 70+ account creator network"*.
- **`tools/search-app.sh` is a brand tool, not a discovery tool.** Its first argument is a
  brand folder and its keywords are app-name variants. `METHOD.md` step 1 is titled
  *"Find the network"*, not "find the app".
- **The niche-first search was tried exactly once, and it worked — as far as it went.**
  `JOURNAL.md` 2026-09-03, *"Niche discovery — cat care"*: *"Tested using `search-app.sh` as a
  **niche** tool rather than a brand tool … It works — one search returns the competitor set,
  the creators and the view counts together."* Two keywords (`cat care app`, `cat health app`),
  46 handles in `media/cat-care-niche/all-handles.tsv`, and a list of ~20 apps read off the
  captions by eye: Purrrr, Leo, CatsMe, CatCare, My Cat Pal, Papatte, Keia, Mochi, Hubert,
  FurMinder, Toxickitty, Pounce, Furever…

So ugckit's R1 is **a real technique with one successful trial and zero end-to-end
validation.** `media/cat-care-niche/` contains a `searches/` folder and an
`all-handles.tsv` and *nothing else* — no `NOTES.md`, no ledger, no network, no teardown. The
niche→app step has never once been carried through to a finished teardown.

### 2.3 Where R1 is under-specified against what the trial showed

| Problem | Evidence | ugckit's answer today |
|---|---|---|
| **The niche search returns apps *and* hardware *and* news.** The cat-care result includes @petlibro (a water fountain), @zvrpetofficials (a litter box), @c4news (a Channel 4 news segment about CatsMe), @mrsmotivated2025 (a physical cat tracker). | `media/cat-care-niche/all-handles.tsv` | Nothing. `scan.tsv` will happily rank `petlibro` as a `channel` term. The skill's test is "several handles", which a hardware brand passes. |
| **Twenty apps, not five, and picking the five is the whole job.** The cat-care read in `JOURNAL.md` is a judgement — *"nobody has cracked distribution in cat health records; the reach is all in stray-feeding and single-purpose scanners"* — made by looking at the view distribution. | `JOURNAL.md` §Niche discovery | The skill says "stop at five apps" but gives no criterion for *which* five. It should be: the ones with a **multi-handle cluster and real reach**, which is exactly what `scan.tsv`'s `handles` and `views` columns show, and exactly what the skill never says to sort on. |
| **The app you should study may have no App Store presence you can see.** `METHOD.md` §Gaps: *"Monid has nothing useful for App Store revenue or rankings; the app-store endpoints in its catalogue are B2B software directories."* Confirmed independently in `JOURNAL.md`. The only route is **appstoretracker.com in a browser**, and `METHOD.md` step 7 heading 1 makes saving `appstoretracker-<date>.png` a required artefact. | `METHOD.md` step 7; `JOURNAL.md` | **Not mentioned anywhere in ugckit.** `grep -rni "appstoretracker\|sensor tower"` over `AGENTS.md`, `.claude/`, `scripts/` and `docs/` returns nothing. The `teardown` skill says only *"whatever store numbers you have"*, and the `atlas` skill documents an `app.json` schema with `revenue7d`/`downloads7d` fields but never says where to get them. |
| **Reach is not the objective and ugckit's ranking is pure reach.** `PLAYBOOK.md` §9.2: *"Alejandro Sanchez's competitor averaged ~40M views a month, one video at 50M, and was making roughly $6K MRR. Every ranking in this playbook is a ranking of reach, and reach is not the objective."* | `PLAYBOOK.md` §9.2 | Missing. R1 picks apps on view counts, R4 ranks accounts on view counts, and nothing anywhere warns that a 228M-view network may be commercially worthless. `PLAYBOOK.md` says of Stronger's own teardown: *"This teardown cannot say whether Stronger's 228.6M views are worth anything."* |

**Answer to (a):** partially. The mechanics work and are cheap. The *judgement* — which of
twenty candidates is a real app with a real network worth five dollars of scraping — is
hand-waved into "the agent decides", with no sort order, no non-app filter, and no way to
attach money to any of it.

---

## 3. Network discovery (R2) — good plumbing, one critical technique deleted

### 3.1 What ugckit does, and what it got right

`network.sh` reproduces `METHOD.md` step 1 and step 2 and improves on both:

- Name variants as keywords — matches `NOTES.md` search logs verbatim (`stronger`,
  `stronger app`, `strongermobile`, `stronger workout app`, `stronger fitness app`).
- **The sound page.** `METHOD.md` step 1: *"Also worth trying, and not yet proved: `startUrls`
  accepts user, search, tag **and music** pages."* `ventnow/NOTES.md` §Search log:
  *"Still unrun: the **sound page** … which should surface seeded accounts that never name
  the app — the only route to Salim's 2025 cohort."* `PLAYBOOK.md` §9.1 lists it as gap #4.
  **ugckit ships it.** `network.sh` branches on `https://*` into `startUrls`, and the skill
  documents it in the usage example. This is a genuine improvement over the source project.
- **The comments pass.** `PLAYBOOK.md` §9.1 gap #1: *"Nobody has read a single comment. Four
  networks, 3,070 posts, zero comment content."* ugckit's `--comments` closes it, with the
  right framing (*"the posts most worth finding are the ones that never name the app"*) and a
  correct cost note ($0.00375/post, billed per call not per result).
- **Evidence columns.** `candidates.tsv` mechanises the caption triage that `NOTES.md` did by
  hand, and adds `in_sound`, which the manual process never had.
- **The rejection ledger.** `state.py reject` + the skill's *"a rejected handle is never
  scraped and is never re-examined"* is `ventnow/NOTES.md`'s *"Rejected handles stay in this
  file: a rejection is evidence too, and keeping it stops us re-searching the same noise."*

### 3.2 The critical thing that is missing

**`METHOD.md` step 3 — the browser eye test — has no counterpart in ugckit, and the R2 rule
as written would have thrown away the single most important finding in the reference corpus.**

`METHOD.md` step 3, verbatim:

> **Step 3 — Eye test, browser, only on the grey list.** The one thing no metric answers: is
> this a purpose-built persona, a paid creator, or an organic user? Open the profile grid and
> look. A persona is on-message in every post, has no personal life, often has the brand in
> the handle, and starts within days of its siblings. A paid creator has a real audience and
> a feed of unrelated content.

ugckit's R2 rule is **"evidence in, no evidence out"** — a handle enters only if a caption,
hashtag, handle string or sound names the app, and everything else is `reject`ed.

Now look at what that rule does to `media/ventnow/NOTES.md`:

> `[@ava.isventing]` — 2,300,000 best post — **"Confirmed by eye test. See 'The Ava pattern'
> below — the single most important account in this file."**
>
> `[@issy.anxiety]` — **"Confirmed by eye test. Same repeating-template pattern as Ava."**

The Ava pattern *is* the core finding of the Vent Now teardown: twelve consecutive posts using
**the same photograph**, ~9.5M views from one image, the `"(From a girl who…)"` credential
formula, and a live A/B test of the parenthetical. `NOTES.md` says why it matters: *"the
production cost of a post here is one line of text … the entire strategy is hook iteration on
a fixed asset. If that reproduces on other apps, it is the cheapest content factory in the
study."*

**Ava was found on the grey list and confirmed by opening the profile in a browser.** Under
ugckit's rule she is a zero row in `candidates.tsv` and gets rejected. The `--comments`
escape hatch does not reach her — the app is not in her comments either; her content simply
does not mention Vent Now.

The eye test also does work that nothing else can:

- It is what separates **persona / paid creator / organic user**, and `PLAYBOOK.md` §2.6 and
  the `library/` build both depend on that distinction: *"creators run a median of 15,547
  views against 764 for personas — mixing them makes any template-performance figure
  meaningless"* (`JOURNAL.md`, Phase 10).
- It is what would resolve Stronger's *"five brand-shaped handles, not one"* question
  (`stronger/NOTES.md`) and Roamy's missing brand account.
- Its absence is logged in `PLAYBOOK.md` §0 limit 4 as one of the four things that shape
  every number in the document: *"Nobody ran the browser eye test on the brand-shaped
  accounts."*

ugckit's `AGENTS.md` mentions a browser exactly twice, both times about approving an OAuth
login. There is no grey list, no eye test, no "ask the user to look at this profile" step
beyond one line in the network skill (*"give the user the profile link and ask"*), and no
`account_type` field anywhere in `state.py`'s `HANDLE_KEYS`.

### 3.3 The paid scraping service — setup, cost and rate limits

**Documented, and mostly well.**

| Fact | Where ugckit says it | Correct? |
|---|---|---|
| Which service | `README.md` Requirements: *"[monid](https://monid.ai) (`npm install -g @monid-ai/cli`)"* | yes |
| Where the key comes from | `.env.example`: *"https://app.monid.ai/access/api-keys"*; `./ugckit key` registers it with the CLI too | yes — and `doctor.py` checks the CLI's own store separately, which is a real failure mode |
| Per-result price | `monid.sh`: `PER_RESULT=0.00045`; `AGENTS.md`: *"Monid bills per result: **$0.00045**"* | matches `METHOD.md` step 1 exactly |
| Per-stage cost | R1 ~$0.036/keyword, R2 ~$0.02/search, R3 ~$0.02/account, R4 free | consistent with `METHOD.md` *"a few cents of Monid"* and `PLAYBOOK.md` §0 *"~$1.63 of Monid"* for four networks |
| Concurrency limit | `AGENTS.md` rule 13, enforced by `monid_lock` | This is `finish-all.sh`'s comment and `jobstep/NOTES.md`'s *"7 of 8 calls failed transiently while another search ran in a second terminal — **do not run two `search-app.sh` invocations at once**"*. ugckit turns a warning into a lock. Best single improvement in the kit. |
| Empty wallet | `monid_run` checks `monid balance` on first failure and stops with *"the wallet is empty -- top up at https://app.monid.ai"* | This is `JOURNAL.md` §Checkpoint — *"Monid balance hit $0.00 mid-run … 10 of 128"* accounts done — handled properly |
| Expiring signed URLs | rule 12; covers pulled in the same session; `deepen.sh` warns *"the image urls have expired (RULE 12)"* | `METHOD.md` trap 3 |
| Missing key | `doctor.py` **warns** rather than fails, correctly, since the recreation half never touches Monid | good |
| Missing `monid` binary | `monid_run` prints `npm install -g @monid-ai/cli` and returns 1 | good |

**What is not documented:** any actual rate limit in requests/minute or concurrent runs
(there may be none published — the lock is a blunt instrument that works); what happens when
the *upstream Apify actor* is down as opposed to Monid; and the fact — recorded in
`METHOD.md` §Gaps and re-confirmed in `JOURNAL.md` — that **Monid has no usable App Store
endpoint at all**, so an agent will burn turns discovering that for itself.

**Answer to (b):** mostly. Every mechanical route organic-social used, plus two it never got
round to (sound pages, comments). But the rule that decides who enters the ledger is
strictly narrower than the one that produced the reference findings, and the compensating
technique was dropped rather than replaced.

---

## 4. The gap table

Every row is a lesson recorded in organic-social. `captured` = ugckit states it and enforces
or operationalises it. `partial` = stated but not enforced, or enforced but not stated, or
materially weakened. `missed` = absent.

### 4.1 Scraper traps (`tools/METHOD.md` ⚠ TRAPS, `AGENTS.md` rules 10–14)

| # | Lesson | Source | ugckit | Note |
|---|---|---|---|---|
| 1 | A photo post is not a video; TikTok serves a `video.url` that is the sound; slides are in the `images` array; there is no carousel endpoint | `METHOD.md` trap 1; `scrape-account.sh` §1b | **captured** | Rule 10 + `deepen.sh` photo branch + `handoff.sh` refusal + `slides.tsv`. Cites the 41.8M post. Best-transferred lesson in the kit. |
| 2 | Never yt-dlp a link Monid already returned; it fails on every TikTok download and leaves empty folders silently | `METHOD.md` trap 2; `scrape-account.sh` §2 | **captured** | Rule 11; `fetch_cdn` is the only download path. ugckit goes further — yt-dlp is not even a fallback, which removes the SSL-failure class entirely. |
| 3 | Every URL in `posts.json` is signed and expires; pull covers/slides/videos in the same session as the metrics | `METHOD.md` trap 3 | **captured** | Rule 12; `harvest.sh` downloads covers inline. |
| 4 | Never trust an extension, an exit code or a non-empty folder — `ffprobe` it | `METHOD.md` standing rule | **captured** | Rule 14; `verify_video` deletes what fails. |
| 5 | Run one Monid call at a time; concurrent calls return HTML that reads like an empty wallet | `finish-all.sh` header; `jobstep/NOTES.md` | **captured, improved** | Rule 13 + `monid_lock` + JSON validation + backoff + one wallet check. |
| 6 | Covers must be **kept**, not deleted after the hook pass — the walkthrough app is built from them and the URLs expire | `METHOD.md` step 5; `shallow-pass.sh` trailing comment | **captured** | `harvest.sh` keeps `covers/NNN.jpg`; the Atlas serves them via `/media/[...path]`. |
| 7 | Download the top N slides only — an earlier version left 301 jpgs on one account and had to be pruned by hand | `METHOD.md` step 6b; `slides-pass.sh` header | **partial** | ugckit's `shortlist.tsv` is top-N *overall*, so it cannot over-download. But see §5.3 — it can now *under*-download. |
| 8 | Rank accounts for the deep dive by **total views**, computed, never by hand: the manual pick on Stronger took ranks 1, 3, 5, 6 and left the network's #2 and #4 with no video and no slides | `METHOD.md` §Which accounts go deep; `PLAYBOOK.md` §9.5 | **captured** | `deepen.sh --rank` is arithmetic; the skill says *"your taste is not evidence"*. |
| 9 | Five accounts ≈ three quarters of a network's reach (Stronger: top 4 ≈ 70%, top 8 ≈ 87%); **add any specific account the ranking exposes as a gap** | `METHOD.md` §Which accounts go deep | **partial** | Top-5 is implemented; the coverage rationale and the "add the gap account" instruction are not stated, so an agent cannot judge when 5 is too few. |
| 10 | Follower counts are recorded but **deliberately not used for judgement** — reach comes from the For You page | `ventnow/NOTES.md`, `stronger/NOTES.md` headers | **captured** | `deepen` skill: *"Follower counts on seeded accounts are meaningless."* |
| 11 | `posts.json`'s `verified` field is junk — `true` for a 105-follower account, `false` for a 76K-follower one | `ventnow/NOTES.md` §Standing observations; `PLAYBOOK.md` §9.5 | **missed** | Not mentioned. `candidates.tsv` does not surface it, so the damage is limited, but an agent reading `posts.json` directly will trust it. |
| 12 | `channel.videos` excludes photo posts (@stronger_gymapp reports 27 videos; 50 photo posts were scraped from it) | `PLAYBOOK.md` §9.5 | **missed** | Not mentioned anywhere. |
| 13 | The **50-post cap is a floor on every number.** @caity.traveltips' best-ever post (2,425,816) is in the search JSON and **not in her `posts.json` at all**; Roamy accounts show 352/297/286 real posts against 50-post windows | `PLAYBOOK.md` §0 limit 1, §9.5 | **missed — and this is a significant one** | `maxItems` defaults to 50 and nothing says a total-views figure is a floor, that the ranking in R4 is a ranking of *sampled* views, or that the search JSON may hold a bigger post than the profile scrape. The `teardown` skill asks for a "sample caveat" but never says what the caveat is. |
| 14 | Localised sound prefixes (`âm thanh gốc`, `som original`) look like an operator fingerprint and are **a scrape-locale artifact** — one song id renders in three languages | `PLAYBOOK.md` §2.10 | **missed** | An agent will independently rediscover this trap and write it into a teardown as a finding, exactly as two of four teardowns did before Potto disproved it. |

### 4.2 Method and process (`research-process.md`, `METHOD.md`, `NOTES.md`)

| # | Lesson | Source | ugckit | Note |
|---|---|---|---|---|
| 15 | **Capture exact wording. Verbatim, in quotes, typos intact** — *"the single most important rule"* | `research-process.md` §Rules for extraction | **captured, thoroughly** | Enforced in the `harvest` skill, in `harvest.sh`'s Haiku prompt, in `deepen.sh`'s prompt, in `teardown`, and in `originate` (*"a hook is quoted verbatim or it is a stated variation on a named template"*). |
| 16 | Brand folder at the top; **every account is a child of it, including the brand's own account** | `METHOD.md` §Folder layout | **captured** | `research/<project>/<app>/<handle>/`, with `handle-set … own yes` for the brand account and the Atlas rendering it unmarked in the carousel. |
| 17 | Record the **rejections and the noise**, so nobody re-searches it | `METHOD.md` step 2; every `NOTES.md` | **captured** | `state.py reject` + `rejected` ledger. |
| 18 | Triage into **three** buckets — confirmed / **grey** / noise — and expect roughly half noise on a common-word name | `METHOD.md` step 2 | **partial** | ugckit has two buckets. `candidates.tsv` sorts evidence-bearing rows first, so grey rows are visually distinguishable, but there is no grey *state* and nothing to do with one. |
| 19 | The **eye test** on the grey list is the only way to tell persona from paid creator from organic user | `METHOD.md` step 3 | **missed** | See §3.2. The highest-value gap in the review. |
| 20 | Keep a fourth bucket: **competitors** — handles promoting a *different* app in the same niche. Stronger's list produced 18 rival apps including `@harryliftsweights` promoting **Strong**, and `@alina.lifts2` — a `.lifts` handle promoting **Thelo**, *"the clearest sign the persona format is being run by more than one app"* | `stronger/NOTES.md`, `roamy/NOTES.md`, `jobstep/NOTES.md` | **missed** | `grep -i competitor` over `AGENTS.md` and `.claude/` returns nothing. This is a wasted asset: R2's noise pile is R1's best source of new apps, and `apps.sh --expand` only expands from *confirmed* apps, never from R2 leftovers. |
| 21 | Handles in documents are written as clickable links `[@h](https://www.tiktok.com/@h)` | `METHOD.md` §Folder layout | **missed** | Trivial, but it is what makes `NOTES.md` usable. |
| 22 | Per-app working file `NOTES.md` = search log (date, endpoint, query, sort, range, items, cost, yield) + handle ledger + rejections | `METHOD.md` step 7; every `NOTES.md` | **partial** | `apps` skill asks for a project-level `NOTES.md`; the `network` skill asks for a one-line `<app>/NETWORK.md`. The rich per-app search log with cost and yield per query is not asked for, though `searches.tsv` has the raw material. |
| 23 | A `PARKED not scraped` marker for handles left behind at a session cutoff | `jobstep/handles.txt` (18 parked handles) | **missed** | `state.py` has `harvested`/`deep` but no "known, deliberately not scraped" state. `PLAYBOOK.md` §9.5 records the cost: *"Seven confirmed Potto promoters were found and never scraped, so its account count is understated."* |
| 24 | **The thirteen teardown headings, fixed, in order** — so two teardowns can be read against each other | `METHOD.md` step 7 | **captured, verbatim** | The `teardown` skill's list matches `METHOD.md`'s one for one, and adds the right reason: *"a heading with nothing under it says 'we did not find this', which is itself a finding."* |
| 25 | Heading 1 requires **App Store numbers from appstoretracker.com**, saved as `appstoretracker-<date>.png` in the app folder | `METHOD.md` step 7 heading 1 | **missed** | See §2.3. `PLAYBOOK.md` §9.2 calls three browser passes on appstoretracker.com *"the cheapest, highest-value thing anyone can do next."* |
| 26 | Heading 7 must be worked through as a **checklist** — bio link, pinned comment, comment-keyword/Manychat trigger, forced engagement, visual legibility, caption SEO — and record what they **don't** do | `METHOD.md` step 7 heading 7 | **partial** | The ugckit heading names the items in one sentence but does not present them as a checklist, and drops *"record what they don't do"* into a generic instruction. |
| 27 | Don't stop at the text pass — go back and *look* at the images | `research-process.md` §Don't stop at the text pass | **captured** | `harvest`: *"Then actually look."* `deepen`: *"Read every `notes.md` and open the contact sheets of the biggest post yourself."* |
| 28 | *"tell me which of these patterns you saw across most of the videos and which you're extrapolating from one or two. do not write a coincidence into the file as a rule."* — called *"the best methodological line in the whole project"* | `HANDOFF.md` §Chris | **partial** | `teardown` says *"Where the sample is thin — one account, five posts — say the sample is thin in the sentence that makes the claim"*, which is the same idea. But there is no stage where cross-app extrapolation happens, so the line has nothing to govern (see §4.4). |
| 29 | A source with confident prose and **no evidence** must not outrank sourced material | `HANDOFF.md` §Chris | **missed** | No provenance or confidence model anywhere. |

### 4.3 Findings that should shape how the research is *run*

These are conclusions from `PLAYBOOK.md`, but each one changes what a competent operator
would collect or measure. That makes their absence a method gap, not just a content gap.

| # | Lesson | Source | ugckit | Note |
|---|---|---|---|---|
| 30 | **The ×median outlier ratio is the right breakout metric**, not raw views. @kailyn.lifts: median 485, best 13,160,469 = 27,135×. SGE's metric; `METHOD.md` step 5 says to compute it | `METHOD.md` step 5; `PLAYBOOK.md` §1.6, §8 §What to measure | **missed in the research half** | `library.py` prints medians for a *pre-built* corpus, but nothing in R3/R4/R5 computes median, max or ×median. `index.tsv` and `manifest.tsv` have the raw numbers; nothing derives the metric, and the teardown skill never asks for it. |
| 31 | **Engagement rate is a broken health metric** and runs *inverse* to reach in three of four networks; judge on views and ×median | `PLAYBOOK.md` §2.4 | **missed** | Teardown heading 8 asks for the like/comment/share/save split — right — but nothing warns that a low ER on a big account is normal. Vent Now's teardown got this wrong and `PLAYBOOK.md` had to correct it. A ugckit user writing one teardown will make the same error with no corpus to correct it. |
| 32 | **Outlier lifecycle:** median views, max views, days from first post to first breakout, cadence, still-active | `METHOD.md` step 5 | **partial** | Teardown heading 3 asks for *"posts, active window, best post, alive or dead"* per account — but no script computes any of it, and `index.tsv` has dates but no derived cadence. |
| 33 | Persona / creator / brand must never be averaged: *"creators run a median of 15,547 views against 764 for personas — mixing them makes any template-performance figure meaningless"* | `JOURNAL.md` Phase 10; `PLAYBOOK.md` §2.6; `ventnow/NOTES.md` §Standing observations | **partial** | Teardown heading 2 asks for the tiers. But `state.py` has no `account_type` field, R4 ranks all accounts together, and there is no way to record the *basis* for a type — the `account_type_basis` field the library carries exists precisely so an inference can be discounted. |
| 34 | Run your own app's name as a TikTok keyword search before committing to it — *"if more than half the results are not your category, the name is a tax you will pay on every post forever"* | `PLAYBOOK.md` §1.4, §8 Day 0 step 4 | **missed** | R0 `product` writes a niche and search words and never checks the product's own name. This is a one-search, two-cent check that ugckit is already perfectly equipped to run. |
| 35 | The Day-0 **legibility audit** — Patiri's "does removing the product break the video?", Sanchez's "does it read from one or two visuals?", and the still-frame test — decides slideshow vs video-demo vs content-first, and *"determines everything downstream"* | `PLAYBOOK.md` §8 Day 0 | **missed** | R0 has no legibility section. `originate` picks the mechanic from `mechanics.json` (a *different* app's evidence) rather than from an audit of the user's own product. |
| 36 | Comments are dead in every network; do not build a funnel that requires them — 82 attempts across 3,070 posts, never both comments and reach on one post | `PLAYBOOK.md` §1.1 | **missed** | Nothing warns a teardown writer that a comment-keyword CTA is a known loser. |
| 37 | There is no link; the conversion path is App Store search; **the app's name is the funnel** | `PLAYBOOK.md` §1.3 | **partial** | Teardown heading 7 asks about bio links. The *caveat* that `posts.json` has no bio-link field — so "no link" is inferred from bio text only — is absent, and that caveat is what makes the finding honest. |
| 38 | Reposting across accounts re-rolls the lottery; within one account it decays. Do not plan around decay | `PLAYBOOK.md` §2.9, §7.5 | **partial** | `harvest`'s Haiku prompt has a `Same as previous` column and the skill says *"a reposted winner is the single strongest signal an account gives you"* — good — but nothing distinguishes within-account repetition from across-account repetition, which is the whole point. |

### 4.4 The structural gap: there is no synthesis stage

`PLAYBOOK.md` is the deliverable of organic-social. It is explicitly *not* a summary:
*"It is what is left when you read them against each other: what held in every network, where
they genuinely disagree, and what a builder should therefore do."* It contains the findings
that a single teardown cannot produce — that comments are dead, that ER is inverse to reach,
that the distribution is the lottery and not the copy, that reposting behaves differently
across accounts than within one, that photo-vs-video is decided by the still-frame test.

**ugckit has no stage that writes it.** The `teardown` skill says: *"The cross-app learnings
are a later stage, not this one."* There is no later stage. `state.py`'s `RESEARCH` list ends
at `teardown`; `.claude/skills/` has no `playbook`, `synthesise` or `compare`; `AGENTS.md`'s
R0–R5 table stops at *"one `<app>/TEARDOWN.md` per app"*.

What ugckit offers instead is the Atlas's **threads** — *"threads that pull the same hook
across every app you studied"* — which is a genuinely good inductive surface and is exactly
what `WALKTHROUGH-APP.md` designed. But `JOURNAL.md` is clear that the threads were a
*presentation* of findings that already existed in written form, not a substitute for them.

**Answer to (d):** you get up to five per-app teardowns and a browsable Atlas. You do not get
`PLAYBOOK.md`, and nothing tells you that you are missing it.

### 4.5 The second structural gap: the library is read-only

`library.py` queries `hooks.jsonl`, `_stats.json`, `templates.json`, `formats.json`,
`mechanics.json` at `LIBRARY_DIR`. In organic-social those files are produced by
`scripts/build-library.mjs` + `scripts/lib/classify.mjs` — *"emit `hooks.jsonl` (4,636 rows)
and `_stats.json` deterministically from `media/`"* (`JOURNAL.md` Phase 10) — plus three
hand-written JSON files.

**ugckit ships none of that.** No build script, no classifier, no seed corpus, no `library/`
directory. So:

- `originate` (stage 5, research-led — the whole point of the research half when the winner
  is a slideshow) **only works if you have a checkout of organic-social**, which is a private
  repo. `.env.example` describes `LIBRARY_DIR` as *"a research corpus checkout"* without
  saying that no such corpus is distributed.
- A ugckit user's own five teardowns never become queryable. The loop `JOURNAL.md` Phase 11
  describes — *"teardown → library → prompt → video"* — is open at the first arrow for
  everyone except this repo's author.
- `doctor.py` correctly warns rather than fails, so this surfaces as a yellow `!` and not as
  a blocker, which understates it.

---

## 5. Pitfalls — how a run goes wrong today

Ordered by how likely they are to bite and how badly.

### 5.1 The `evidence in, no evidence out` rule silently discards the best accounts

Covered in §3.2. The failure mode is the one `AGENTS.md` itself names for rules 10–14 — *the
failure looks like success*. `candidates.tsv` will be full of confirmed promoters, the
harvest will run, `HOOKS.md` files will fill up, the teardown will be written, and the
`@ava.isventing`-class account — the one that would have changed the finding — was rejected
in round 2 and is never re-examined, because the skill says *"a rejected handle is never
scraped and is never re-examined."*

`roamy/NOTES.md` shows the same shape from the other direction: *"No brand account surfaced
in the search — every promoter tags '@Roamy Travel' but the account itself never appears in
the results. Finding it is the first job of step 3."* ugckit has no step 3. A ugckit teardown
of Roamy would have no brand account and no instruction to go looking for one — and
`PLAYBOOK.md` §3.6 makes the missing brand account *the* explanation for Roamy's collapse.

### 5.2 R1 will confidently pick the wrong five apps

The cat-care trial returned 46 handles across ~20 apps plus a water fountain, a litter box, a
Channel 4 news package and a physical cat tracker. `scan.tsv` counts terms; it does not know
which terms are apps. The skill's only test — *"across several handles"* — is passed by
@petlibro. The skill then says *"a wrong app in the ledger is paid for at every stage after
it"*, which is true and is precisely why the selection needs a sort order and a filter rather
than an exhortation. There is also no App Store check anywhere to catch an "app" that is a
Shopify store or a hardware brand.

### 5.3 The top-3 shortlist can miss the network's biggest slideshow

`deepen.sh` writes one `shortlist.tsv` = top N posts by views, N=3, whatever kind they are.
organic-social ran **two** passes: `scrape-account.sh <handle> 3` (top 3 videos, photo posts
explicitly skipped) **and** `slides-pass.sh <handle> 5` (top 5 *photo posts* by views), and
`run-brand.sh` always ran both — *"Without this the deep dive silently misses them."*

Consequence: on an account whose top three posts are videos and whose fourth is a 41.8M-view
photo post, ugckit downloads three videos and **zero slides**, and the slides expire. The
`deepen` skill's own text says *"`slides.tsv` lists every one an account has"* — but listing
is not downloading, and rule 12 means the difference is permanent. This is the exact class of
error `METHOD.md` step 6b was written to fix.

### 5.4 Every total-views number in a ugckit teardown is a floor, and nothing says so

`maxItems` defaults to 50 in `harvest.sh`. R4 ranks accounts on the sum of those 50. The
teardown quotes those totals as facts. `PLAYBOOK.md` §0 limit 1 spells out what this costs:
@strongermobile reports 2,433 videos and 50 were scraped; @caity.traveltips' best-ever post
is **absent from her own `posts.json`** and only exists in the search JSON. `PLAYBOOK.md`
§9.5 goes further: *"Roamy's 'March–April launch wave' may be an artifact of the cap rather
than a cohort."* A ugckit user will write launch-wave findings off a 50-post window with no
warning that the window is the finding.

Worse, `apps.sh` already keeps the search JSON that contains the missing bigger posts. Nothing
cross-checks `handles.tsv`'s `best_views` against `index.tsv`'s max.

### 5.5 No `claude` CLI turns a 20-account harvest into a manual image-reading marathon

`harvest.sh` sets `HEADLESS=0` when `claude` is not on PATH and writes `hooks.todo` with one
block per batch of twelve covers. At 50 posts an account that is ~5 batches; at 20 accounts,
**~100 batches, ~1,200 cover images**, all to be read by the orchestrator itself. The skill
says plainly *"the work is yours, and it is not optional"* and *"do not load an account's
fifty covers at once"*, which is honest, but it is not a workable path for a Codex or Cursor
user, and `install.sh` treats `claude` as neither required nor recommended — it is not in the
`need`/`want` list at all, and `doctor.py` does not check for it. The only mention is a
throwaway line in the `harvest` skill.

### 5.6 `originate` fails for anyone who is not the author

`library.py` exits with *"LIBRARY_DIR is not set"* or *"has no library/hooks.jsonl"*. There is
no shipped corpus and no builder. `AGENTS.md` routes a research-led project — and any project
whose winning post is a slideshow, which `handoff.sh` correctly refuses — through `originate`.
So the most likely research outcome (Stronger's top three posts are all two-slide carousels;
Vent Now's million-view posts are photo posts) lands on the one stage that cannot run.

### 5.7 Undocumented dependency: the comments endpoint is unproven

`network.sh --comments` calls `apify /scraptik/tiktok-comments-scraper-api` with
`listComments_awemeId` / `listComments_count`, and parses `comments[].reply_comment[]`,
`user.unique_id`, `digg_count`, `is_author_digged`. **This endpoint was never used in
organic-social** — `PLAYBOOK.md` §9.1 gap #1 is *"Nobody has read a single comment."* The
response-shape assumptions, the `$0.00375` per-call price and the per-call (not per-result)
billing model are all unverified against a live response. The parser degrades quietly: a
shape mismatch produces `0 comments read of , 0 of interest` and the run continues.

### 5.8 Environment and installer assumptions

Verified by running `scripts/doctor.py` against `template/` (read-only; it makes no
network call without credentials, and exits 1 correctly):

```
tools:   ffmpeg 8.0.1 ✓  ffprobe ✓  curl ✓  python3 ✓  monid ✓  node v26.3.0 ✓
python:  .venv missing ✗ · numpy ✗ · cv2 ✗ · faster_whisper ✗ · fastapi ✗ · uvicorn ✗
creds:   .env missing ✗
MCP:     supagen server configured ✓ (Claude Code and Cursor)
exit=1
```

`doctor.py` is well built — it never prints a secret, catches the welded-`.env`-variable
failure by shape, checks the monid CLI's own credential store separately from `.env`, and
uses `POST /api/v1/files` as the auth probe with a comment explaining that `GET` returns 401
even with a valid key. Remaining assumptions worth flagging:

- **`sips` → `ffmpeg`.** organic-social used `sips` (macOS only) for webp→jpeg; ugckit uses
  `to_jpg()` via ffmpeg. Correct portability fix, correctly commented.
- **`flock` → `mkdir`.** Correct; `flock` is absent on macOS.
- **`jq` → `python3`.** Correct and commented. But note the whole research half now depends on
  `python3` parsing multi-MB JSON per account, invoked once per operation.
- **`git` is required for the piped-curl install** but the `need` list only checks it in the
  cloned path — actually it is checked in both; fine.
- **`node` is optional but the Atlas is the primary review surface** for the research half.
  `AGENTS.md` says to run it after every harvest and teardown. A user without Node has no way
  to see the research at all except by reading TSVs, and `install.sh` flags node with a yellow
  `!`. The `setup` skill does say *"install them anyway, now"*, which mostly covers it.
- **`claude` is nowhere in the dependency list** despite being load-bearing for R3 and R4.
- **`install.sh` copies `atlas/` wholesale** — a Next.js app whose `node_modules` install is
  documented as *"a minute or two, ~370 MB, once."* Reasonable, but it makes a "research
  toolkit" install considerably heavier than the prerequisites suggest.
- **`AGENTS.md:42` references `setup_templates.py`, which does not exist.**

### 5.9 Cost arithmetic is an over-estimate, quietly

`apps.sh` and `harvest.sh` compute spend as `CALLS × MAXITEMS × PER_RESULT`. Monid bills per
*result returned*, and searches frequently return fewer than `maxItems` — `stronger/NOTES.md`
logs a `stronger workout app / LAST_THREE_MONTHS` search returning **17** against a requested
20. Erring high is the right direction for a money-spending tool, and rule 8 already says to
label figures as computed, but `state.py cost` records the estimate as if it were the charge,
so the running total will drift above the real wallet spend.

---

## 6. Prioritised fixes

Highest leverage first. Each names the file.

### 1. Add a step-3 equivalent: a grey list and an account-type decision — `template/.claude/skills/network/SKILL.md`, `template/scripts/state.py`

The single change that most affects whether ugckit reproduces the reference findings.

- Add a third disposition alongside `handle` and `reject`: `state.py grey <project> <app> <handle> "<why it is suggestive>"`. A grey handle is neither scraped nor forgotten.
- Add `account_type` and `account_type_basis` to `HANDLE_KEYS` in `state.py` (`brand` / `persona` / `creator` / `organic` / `unknown`), mirroring `library/hooks.jsonl`'s schema so the two can ever be joined.
- Add a **"The eye test"** section to the network skill, lifted from `METHOD.md` step 3: the agent has no browser, so it hands the user three to five profile URLs from the grey list with the exact question — *is this on-message in every post with no personal life (persona), a real audience with unrelated content (paid creator), or a normal user?* — and records the answer as evidence. Keep it to three to five accounts, as `METHOD.md` does.
- Add the rule that produced the Ava finding: **a big post with zeros in every evidence column is a candidate for the grey list, not for `reject`.** Right now the skill sends it only to `--comments`.
- Add an explicit instruction to find the brand account, with Roamy as the worked example of what happens when nobody does.

### 2. Add R6 — the cross-app synthesis — `template/.claude/skills/playbook/SKILL.md` (new), `template/scripts/state.py`, `template/AGENTS.md`

Add `playbook` to `RESEARCH` in `state.py` and to the R-stage table in `AGENTS.md`. Model the
skill on `PLAYBOOK.md`'s own structure, because it is the shape that worked:

- §0 **what this is built on and what it cannot tell you** — with the four limits stated as limits (post cap, no store numbers, no comments, no eye test), which forces the honesty the corpus needed.
- §1 **what held in every network** — a claim only qualifies if it is positively evidenced in ≥2 apps and contradicted in none.
- §2 **what varied, and what the variation depends on** — the section that turns disagreement into a decision rule.
- §3 **claims that rest on one network only**, listed by name so they are never quoted as general rules (`PLAYBOOK.md` §9.3).
- §4 **where the sources and the corpus disagree** (`PLAYBOOK.md` §9.4).
- Carry Chris's rule as the skill's governing line: *"tell me which of these patterns you saw across most of the videos and which you're extrapolating from one or two. do not write a coincidence into the file as a rule."*

Without this, ugckit's answer to "what did we learn" is five documents and an orb.

### 3. Make the deep dive pull slides *and* video — `template/scripts/deepen.sh`

Replace the single `shortlist.tsv` with two shortlists, as `run-brand.sh` did: top-N by views
among video posts **and** top-M by views among photo posts (defaults 3 and 5). Keep the
existing top-N-overall behaviour as the union. Update the `deepen` skill's "Photo posts are
not a footnote" section to say that both passes always run.

### 4. Compute the outlier metrics — `template/scripts/deepen.sh` (or a new `stats.py`), `template/.claude/skills/teardown/SKILL.md`

Per account, from `posts.json` alone and free: median views, max views, **×median ratio**,
first/last post date, active window in days, posts/day, days to first breakout, photo share of
posts and of views, and the caption-names-the-app percentage. Write it to `<handle>/stats.tsv`
and an app-level `stats.tsv`. Then have teardown headings 3, 4 and 8 quote it instead of
asking the writer to eyeball `index.tsv`.

This one change makes teardown headings 3, 5, 8 and 10 answerable, and it is the metric
`METHOD.md` step 5 and `PLAYBOOK.md` §8 both name as the right one.

### 5. Put App Store numbers back in — `template/.claude/skills/teardown/SKILL.md`, `template/.claude/skills/product/SKILL.md`

- Teardown heading 1 becomes a required browser pass: search the app on **appstoretracker.com**, save the capture as `research/<project>/<app>/appstoretracker-<date>.png`, and write `app.json` from it. State plainly, as `METHOD.md` §Gaps does, that **Monid has no usable App Store endpoint** so nobody burns turns looking.
- Add the warning from `PLAYBOOK.md` §9.2 to `AGENTS.md`'s research section: reach is not revenue; ~40M views/month against ~$6K MRR is a real observed case.

### 6. Give R1 a selection rule and a non-app filter — `template/.claude/skills/apps/SKILL.md`, `template/scripts/apps.sh`

- In `apps.sh`, sort `scan.tsv` candidates by **handle count first, then total views**, and print the top candidates as an explicit "these are the app-shaped terms" block rather than a flat term list.
- In the skill, add the rejection categories the cat-care trial actually produced: **hardware/accessory brands** (a water fountain, a litter box, a tracker), **news coverage of the category**, and **the primate/potato class of homonym**. Give the concrete examples.
- Add the selection rule: *five apps with a multi-handle cluster and real reach*, and say what to do when the niche has twenty low-reach apps (the cat-care answer: note that nobody has cracked distribution, pick the leaders, record the rest).
- Add a **competitors bucket**: `state.py competitor <project> <handle> <app-they-promote>`, fed from R2's non-matching rows, and make `apps.sh --expand` read it. Stronger's noise pile contained 18 rival apps.

### 7. State the sampling caveats where they are used — `template/.claude/skills/harvest/SKILL.md`, `template/.claude/skills/teardown/SKILL.md`, `template/AGENTS.md`

- Harvest skill: *every total-views figure is a floor; `maxItems` is 50 and real accounts run to hundreds or thousands of posts; a launch "wave" read off a 50-post window may be an artifact of the window.*
- Have `harvest.sh` cross-check each handle's `best_views` in `handles.tsv`/`candidates.tsv` against the max in `index.tsv`, and print a line when the search JSON holds a bigger post than the profile scrape — that is the @caity.traveltips case, caught for free.
- Add to the teardown skill's opening-block caveat a required list: post cap, whether an eye test was run, whether comments were read, whether store numbers exist.
- Add the three junk-data facts as a short block in `AGENTS.md`: `verified` is useless; `channel.videos` excludes photo posts; localised sound prefixes (`âm thanh gốc`, `som original`) are a scrape-locale artifact, not an operator fingerprint.

### 8. Close the library loop — new `template/scripts/build_library.py`, `template/.env.example`, `template/.claude/skills/originate/SKILL.md`

Port `organic-social/scripts/build-library.mjs` + `lib/classify.mjs` so that a ugckit user's own
`research/` produces `library/hooks.jsonl` and `_stats.json` deterministically, and default
`LIBRARY_DIR` to the project itself. Ship `templates.json` / `formats.json` / `mechanics.json`
as a seed if licensing allows; otherwise say clearly in `.env.example` and in the `originate`
skill that no corpus is bundled and `originate` needs one. Today the skill reads as though the
corpus is simply there.

### 9. Make `claude` a first-class dependency — `install.sh`, `template/scripts/doctor.py`, `README.md`

Move `claude` into `install.sh`'s `want` list and add it to `doctor.py`'s tool check, with the
cost stated: without it, a 20-account harvest becomes ~100 manual batches of twelve images.
`README.md` Requirements should name it.

### 10. Smaller corrections

- `template/AGENTS.md:42` — drop the `setup_templates.py` reference; the templates come from the `setup` skill over MCP.
- `template/scripts/apps.sh`, `harvest.sh` — compute spend from rows actually returned (`json_rows`) rather than `MAXITEMS`, or label the ledger entry `estimate`.
- `template/.claude/skills/teardown/SKILL.md` — write handles as `[@handle](https://www.tiktok.com/@handle)` (`METHOD.md` §Folder layout), and turn heading 7 into the explicit checklist `METHOD.md` step 7 specifies, including *record what they don't do*.
- `template/.claude/skills/product/SKILL.md` — add two free steps from `PLAYBOOK.md` §8 Day 0: the **name check** (run the product's own name as a TikTok keyword search; if more than half the results are not the category, say so) and the **legibility audit** (Patiri's test, Sanchez's test, the still-frame test) whose three outcomes should be recorded in `PRODUCT.md` because they decide format for everything downstream.
- `template/.claude/skills/network/SKILL.md` — mark `--comments` as an unproven endpoint until a live response has been checked, and have the parser say so loudly when it finds zero parseable comments rather than printing `0 of interest`.
- `template/scripts/state.py` — add a `parked` handle state for "known, deliberately not scraped" (`jobstep/handles.txt`).

---

## 7. Verdict

**Could ugckit reproduce the organic-social result today?**

- **Collection: yes, and faster.** The R3/R4 layer is a strict improvement on `shallow-pass.sh`,
  `scrape-account.sh` and `slides-pass.sh` — locking, JSON validation, retry with backoff,
  dead-CDN-host detection, a cover-from-video fallback, ffprobe verification, full
  resumability, and a no-`claude` fallback. All five research traps from `METHOD.md` are
  enforced in code rather than remembered. The Atlas ports the walkthrough app faithfully and
  reads `research/` generically.
- **Per-app teardowns: yes, with thinner evidence.** The thirteen headings are carried over
  exactly. But headings 1 (store numbers), 3 (lifecycle arithmetic), 7 (conversion checklist)
  and 8 (engagement) would be materially weaker than the reference teardowns, because nothing
  computes the numbers and nothing tells the writer where the store data lives.
- **The network map: no, not to the same standard.** Without a grey list and an eye test,
  ugckit's ledgers would be caption-matched only. On Vent Now that loses the account the
  teardown is built around; on Roamy it loses the brand account whose absence is the whole
  finding; across all six it loses the persona/creator/brand distinction that
  `PLAYBOOK.md` §2.6 and the library both depend on.
- **The synthesis: no.** There is no stage that writes `PLAYBOOK.md`, and no mechanism that
  turns a user's own teardowns into the `library/` that `originate` requires.

**Top three gaps**

1. **No cross-app synthesis stage.** The `teardown` skill defers it to "a later stage" that does not exist. `PLAYBOOK.md` — comments are dead, ER is inverse to reach, the distribution is the lottery and not the copy — cannot be produced by any sequence of ugckit stages. (§4.4)
2. **The browser eye test is gone, and "evidence in, no evidence out" replaces it with a narrower rule.** `@ava.isventing` — *"the single most important account in this file"*, 2.3M best post, ~9.5M views from one photograph — was confirmed by eye test and would be rejected by ugckit. (§3.2, `media/ventnow/NOTES.md`, `METHOD.md` step 3)
3. **App discovery is one unrepeated experiment with no selection rule.** organic-social got its apps from written sources and a paid report, not from search; the niche-first search was tried once (`media/cat-care-niche/`) and never carried through to a teardown. R1 has no non-app filter, no sort order for picking five from twenty, and no App Store check — while `METHOD.md` and `PLAYBOOK.md` §9.2 both say the store data is the highest-value missing piece and is browser-only. (§2)

**The worst single pitfall:** §5.1 — the rejection rule discarding the highest-value accounts,
because it fails in exactly the shape `AGENTS.md` itself warns about for rules 10–14: *the
failure looks like success and the run carries on.* You get a full `candidates.tsv`, a
complete harvest, populated hook banks and a thirteen-heading teardown, and the finding that
would have made the teardown worth writing was rejected in round two and, by the skill's own
rule, is never re-examined.

**Overall:** ugckit is a strong, honest, well-instrumented **collection** kit wrapped around a
research method whose two hardest steps — deciding what to study, and deciding what it all
means — are the two it has not yet productised. Fixes 1–4 would close most of the distance.
