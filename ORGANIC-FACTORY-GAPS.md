# ugckit — where the organic factory produces irrelevant research

**Scope.** Where ugckit v0.2.0, run today, would produce low-quality or irrelevant
research. Focused on **relevance and provenance**: whether a collected handle can be shown
to promote the app, and whether the evidence that admitted it survives into the corpus.

**Read for this.** `organic-social/learnings.md` in full (542 rows, seven sources),
`organic-social/tools/METHOD.md`, `organic-social/research-process.md`,
`organic-social/scripts/lib/classify.mjs`, `organic-social/scripts/build-library.mjs`;
against ugckit's `template/AGENTS.md`, every script in `template/scripts/`, all eighteen
`template/.claude/skills/*/SKILL.md`, and `template/atlas/scripts/build-index.mjs`.

**Measured, not asserted.** Three measurements were run read-only over the finished
corpus at `organic-social/media/` — 129 scraped accounts, 5,484 posts, six apps. They are
reproducible from the scripts quoted in §1. Nothing was written to either repo except this
file.

**The complaint this document is about, in Rahul's words:** *it is a bad experience to
open a handle in the Atlas, scroll its posts, and never find the post where that creator
actually promotes the app.* That is not a UI problem. It is a collection problem, and it
is measurable.

---

## 1. The three measurements

### 1.1 The post that justified admitting a handle is missing from that handle's folder 40% of the time

For every scraped account, take its best post across all the search JSONs for that app —
which is the post that put the handle on the candidate list — and ask whether that post id
appears in the account's own `posts.json`.

| App | Accounts scraped | Had an admitting post | Post present in `posts.json` | **Missing** |
|---|---|---|---|---|
| ventnow | 18 | 17 | 11 | **6** |
| potto | 16 | 16 | 14 | **2** |
| stronger | 19 | 19 | 11 | **8** |
| jobstep | 18 | 18 | 12 | **6** |
| umax | 36 | 35 | 19 | **16** |
| roamy | 22 | 22 | 9 | **13** |
| **Total** | **129** | **127** | **76** | **51 (40.2%)** |

The biggest ones lost:

```
umax     @hyperiddaren           3,329,564 views  2025-08-17
roamy    @caity.traveltips       2,425,816 views  2026-03-15
umax     @johnauvealt            1,713,416 views  2024-06-08
stronger @strongermobile         1,687,895 views  2026-05-01
jobstep  @alex.jobtipps          1,505,513 views  2026-04-20
jobstep  @manal.jobstep.io       1,255,842 views  2026-02-12
jobstep  @elizacv25              1,031,120 views  2026-07-09
roamy    @mina.travelhacks         955,274 views  2026-02-24
```

`@caity.traveltips` is already recorded as this failure in `PLAYBOOK.md` §0 limit 1 —
*"@caity.traveltips' best-ever post — 2,425,816 views on 2026-03-15 — is in the search JSON
and not in her `posts.json` at all"* — but it was read as a sampling caveat, not as a
provenance defect. It is 51 handles, not one.

`@elizacv25` is the sharpest case. `learnings.md` §Reference Accounts records her as
*"1.2M views / 52.3K likes / 178 comments / 4.4K shares at **644.2× her own median** — the
single biggest outlier multiple on the SGE page"*, and it is the only post of hers that
carries the `publi.` disclosure that proves she is paid. **That post is not in her scraped
folder.** Open her in the Atlas and you get 50 posts of Spanish careers content with no
JobStep in them and no way to see why she is in the study at all.

**Why it happens, mechanically.** R2 finds the handle through
`apify /apidojo/tiktok-scraper` with `sortType: MOST_LIKED` and `dateRange: ALL_TIME` —
i.e. the handle's *best-ever* post. R3 then scrapes the account with
`apify /apidojo/tiktok-profile-scraper` and `maxItems: 50`, and `harvest.sh` sorts what
comes back by `uploadedAtFormatted` descending. **Two different orderings.** The admitting
post survives only if it happens to fall inside the 50 most recent. On an account that has
posted steadily since 2024 — every UMax carrier — it does not.

Whether the profile actor accepts a sort parameter is unverified and should be checked
before assuming a config fix exists; the fetch-by-id fallback in §3 does not depend on it.

### 1.2 56% of the collected corpus never names the app it was collected for

Share of each account's scraped posts whose caption or hashtags contain the app name
(`vent now|ventnow`, `potto`, `stronger`, `job ?step|jobstep`, `umax`, `roamy|rhyme` —
simple word matching, so these are upper bounds on nothing and rough on both sides):

| App | Accounts | Posts | Posts naming the app | Median account rate | Accounts with **zero** mentions |
|---|---|---|---|---|---|
| stronger | 19 | 935 | 750 (80.2%) | 94% | 0 |
| jobstep | 18 | 705 | 503 (71.3%) | 94% | 0 |
| ventnow | 18 | 651 | 410 (63.0%) | 72% | 3 |
| potto | 16 | 427 | 146 (34.2%) | 17% | 1 |
| umax | 36 | 1,692 | 428 (25.3%) | 10% | 11 |
| roamy | 22 | 1,074 | 171 (15.9%) | **2%** | 9 |
| **Total** | **129** | **5,484** | **2,408 (43.9%)** | — | **24** |

**Twenty-four accounts never name the app in a single scraped post.** The largest:

```
umax     @emilseljeseth     50 posts   60,020,568 views
umax     @hyperiddaren      50 posts   31,967,365 views
umax     @frwjr             50 posts   15,990,555 views
umax     @skeria7           50 posts   12,723,597 views
roamy    @josi.travelplanning 50 posts  7,061,449 views
ventnow  @lowkey_deep       50 posts    6,973,212 views
roamy    @justlikedru       50 posts    4,518,676 views
potto    @demi_does.it      50 posts    3,682,625 views
ventnow  @ava.isventing     50 posts    3,150,128 views
roamy    @suggerimenti_x_te 50 posts    1,325,621 views
```

Roamy's median account names the app in **2%** of its posts — one post in fifty. That is
Rahul's complaint stated as a number, and it is exactly what he will hit in the Atlas.

**The trap, stated before any fix is proposed.** Four different things are mixed in that
list of 24 and they must not be treated the same way:

| Kind | Example | What it is |
|---|---|---|
| **A real finding** | `@josi.travelplanning`, 7,061,449 views, 0 mentions | `PLAYBOOK.md` §1.3 calls Roamy naming itself in 15.9% of captions **"the single most expensive mistake in the corpus."** The silence *is* the result. |
| **A correct persona** | `@ava.isventing`, 0 mentions | `ventnow/NOTES.md`: *"the single most important account in this file"* — ~9.5M views off one photograph. Vent Now's whole mechanic is content-first with the app named in the last clause of *some* captions. |
| **A one-off placement** | `@emilseljeseth`, 60M views, 0 mentions in the 50 scraped | `classify.mjs` records UMax carriers as *"one-off placement, 1/50 posts tagged"*. The mention exists; it is outside the window (§1.1). |
| **Genuine noise** | `@suggerimenti_x_te`, `@chika_dz` | On `classify.mjs`'s `UNRELATED_ACCOUNTS` list. `PLAYBOOK.md` §9.5: four such accounts *"contribute 3,203,311 views, 10.1% of the raw total"* to Roamy. |

**So the rule is never "drop accounts with no mentions."** It is: measure the rate, store
it, show it, guarantee the admitting post is present, and force a written reason whenever
an account is kept at a zero rate. A toolkit that silently deleted the first two rows would
destroy the two best findings in the reference corpus.

### 1.3 `deepen.sh` reaches 34 of 149 photo posts

organic-social ran two deep passes per account — `scrape-account.sh <handle> 3` (top 3
**videos**; photo posts explicitly skipped) and `slides-pass.sh <handle> 5` (top 5 **photo
posts** by views) — and `run-brand.sh` always ran both, with the comment *"Without this the
deep dive silently misses them."*

ugckit's `deepen.sh` writes one `shortlist.tsv` = top N by views overall, N=3, whatever
kind they are. Over the 48 scraped accounts that have any photo post:

- organic-social's slides pass downloads **149** photo posts.
- ugckit's single shortlist reaches **34**. It misses **115**.

The biggest slideshows ugckit would never download — and under rule 12 the slide URLs
expire, so this is permanent:

```
stronger @strongerstrengths   1,764,465 views   2 slides
stronger @strongerus          1,346,052 views   2 slides
stronger @strongerus          1,019,544 views   2 slides
umax     @handsome.habit        861,571 views   8 slides
stronger @strongerstrengths      708,195 views   2 slides
stronger @strongerapp            457,138 views   3 slides
umax     @umax.app               215,318 views   6 slides
```

Six accounts are the pure form of the bug — ugckit downloads three videos and zero slides
despite a 100K+ slideshow sitting below the cut: `@andolo00`, `@changdawg`,
`@hyperiddaren`, `@mika_appeal`, `@toledox00`, `@umax.app`.

`@strongerstrengths` is the account `PLAYBOOK.md` §2.2 calls *"the cleanest experiment in
the whole project"* — 33 photo posts at 13,463,747 views against 17 videos at 2,461. Its
1.76M two-slide carousel is one of the posts that experiment rests on.

---

## 2. The three questions asked directly

### Q1. Does ugckit ever fetch and keep the post that justified admitting a handle?

**No. Nowhere in the pipeline.** Traced end to end:

1. `network.sh` writes `candidates.tsv` with a `best_url` column and a `names_app` count.
   The post object itself is in `research/<project>/<app>/searches/*.json`, which is kept.
2. The `network` skill then says: `scripts/state.py handle <project> <app> <handle>
   "captions name the app in 6 of 8 posts"`. `state.py:341` stores that as
   `row["evidence"] = " ".join(a[3:])` — **a free-text string.** `HANDLE_KEYS` is
   `("harvested", "deep", "views", "posts", "winner", "evidence", "note", "own")`. There is
   no `evidence_post_id`, no `evidence_url`, no field the pipeline can act on.
3. `harvest.sh` scrapes the profile and writes `index.tsv` with columns
   `rank, views, likes, comments, shares, bookmarks, date, photo, caption`. **No post id
   and no URL** — so at R3 depth there is not even a way to open the post on TikTok.
4. `deepen.sh` shortlists by views within `posts.json`. If the admitting post is not in
   `posts.json` it cannot be shortlisted, downloaded, or read.
5. `build-index.mjs` builds the Atlas from `posts.json` + `index.tsv` + `HOOKS.md` +
   `covers/`. The search JSONs are not read. `NOT_AN_APP` / `NOT_A_HANDLE` explicitly skip
   the `searches` directory.

So the evidence exists as prose in `pipeline.json` and as a raw JSON blob nobody reads
again, and 40% of the time (§1.1) the post itself is absent from everything downstream.
**The Atlas cannot show it because nothing ever put it on disk.**

> **RULE 1 — an admitted handle carries its admitting post as data, and the harvest fetches it.**
>
> - `state.py handle` takes the post id and url as first-class fields, not prose:
>   `handle <project> <app> <handle> --evidence-post <id> --evidence-url <url> "<why>"`.
>   Add `evidence_post_id`, `evidence_url`, `evidence_views` to `HANDLE_KEYS`
>   (`template/scripts/state.py`). Refuse to admit a handle with neither an evidence post
>   nor an explicit `--no-post-evidence "<reason>"` flag — the escape hatch exists for the
>   sound-page and comment routes, and it must be recorded, not implied.
> - `network.sh` emits the id alongside `best_url` in `candidates.tsv`, and prints the
>   ready-to-paste `state.py handle …` line per row so the id is never retyped
>   (`template/scripts/network.sh`).
> - `harvest.sh`, after the profile scrape, checks whether `evidence_post_id` is in
>   `posts.json`. When it is not, it pulls that one post from the search JSON already on
>   disk, writes it into `<handle>/evidence/<id>.json`, downloads its cover into
>   `<handle>/evidence/<id>.jpg` in the same session (rule 12), appends it to `index.tsv`
>   with rank `E1`, and prints `admitting post recovered from search JSON — not in the
>   50-post window` (`template/scripts/harvest.sh`).
> - `harvest.sh` **fails the account loudly** — not silently — if the admitting post is
>   neither in `posts.json` nor recoverable from the search JSONs. That is a handle whose
>   provenance has been lost and it must not enter a teardown unexamined.
> - `build-index.mjs` reads `<handle>/evidence/` and pins the admitting post to the top of
>   the account page with an `admitting post` badge, always, regardless of view rank
>   (`template/atlas/scripts/build-index.mjs`, `app/account/[handle]/page.tsx`).
> - `index.tsv` gains an `id` and a `url` column, so a post is openable at R3 depth
>   without waiting for R4's `manifest.tsv` (`template/scripts/harvest.sh`).

### Q2. Does ugckit detect and mark handles with no app mention?

**Once, at R2, over the wrong set of posts — and never again.**

`network.sh:101` computes exactly the right thing and documents it well:

```
#   names_app   the caption or a hashtag contains the app's name, in how many posts
#   in_handle   the handle or the display name contains it
#   in_sound    the post's sound is the app's own original sound
# A row with zeros in all three is a candidate for `reject`, or for --comments if the
# post is big enough to matter.
```

But that count is computed over **the posts that happened to come back in the search
results** — typically two to eight posts, selected by `MOST_LIKED`, which is the most
biased possible sample toward the app being mentioned. It is never recomputed over the 50
posts R3 actually buys. `grep -rn "mention\|names_app\|relevan\|unrelated\|off-topic"` over
`scripts/`, `.claude/` and `AGENTS.md` returns `network.sh` and nothing else.

Consequences, in order of severity:

- **No account-level relevance figure exists anywhere.** Nothing computes "3 of 50 posts
  name the app". `state.py`'s handle row has `views`, `posts`, `harvested`, `deep` — no
  relevance field.
- **No post-level relevance flag exists anywhere.** `index.tsv` has a caption column and no
  derived flag; `HOOKS.md` has `Post | Views | On-screen hook | Image | Same as previous`
  and no app column; the Atlas post object has `tags.hook`, `tags.insertion`,
  `tags.disclosure`, `tags.sound`, `tags.format` — and `insertion` is the closest thing,
  but a post with no insertion evidence gets `insertion: []` while `disclosure` explicitly
  gets `[{id: "none", label: "No disclosure"}]`. **Absence is rendered for disclosure and
  silently empty for insertion**, which is backwards: insertion is the one the user is
  scrolling to find.
- **The account page has no filter.** `app/account/[handle]/page.tsx` sorts covers by views;
  `components/PostTable.tsx` is *"sortable by any metric"* and has no relevance column and
  no filter control. There is no way to say "show me the posts where this creator promotes
  the app" — which is the literal request.
- **The teardown is written off an unmarked mixture.** The `teardown` skill's heading 6 is
  *Product insertion — where the app appears in the creative and in the caption, quoted
  verbatim* — and the writer is handed 50 posts with no indication which of them qualify.
  On a Roamy-shaped account that is one post in fifty.
- **`--all` compounds it.** `harvest.sh --all` scrapes every ledger handle at 50 posts with
  no relevance gate, so an over-admitted ledger is paid for in full and then averaged into
  every network figure. `PLAYBOOK.md` §9.5 measures the damage on one app:
  *"Roamy's raw totals are inflated by search noise. Four accounts that promote nothing
  contribute 3,203,311 views, 10.1% of the raw total."*

> **RULE 2 — relevance is computed per post at collection time, rolled up per account, and rendered as a first-class column.**
>
> - `harvest.sh` computes, per post, `names_app` from caption + hashtags + sound title
>   using the app's normalised token (the same `re.sub(r"[^a-z0-9]","")` comparison
>   `network.sh` already uses), and writes it as a column in `index.tsv`. Cheap, offline,
>   no extra API call (`template/scripts/harvest.sh`).
> - It rolls that up to `mention_rate` and `mention_count` on the handle row via
>   `state.py handle-set`, and adds both to `HANDLE_KEYS` (`template/scripts/state.py`).
> - It prints the rate per account as it goes, and prints a summary block at the end
>   listing every account under a threshold. Use **`CAPTION_MENTION_THRESHOLD = 0.5`** — the
>   value `classify.mjs` already uses, with its stated justification: *"The corpus is
>   strongly bimodal on this measure … jobstep accounts sit at 74–100% or at 6–24%, umax at
>   60–100% or 0–18% — so the exact cut has almost no accounts near it."* Do not invent a
>   new number.
> - **A zero-mention account is a stop, not a warning.** `harvest.sh` marks it
>   `relevance: unconfirmed` and the `harvest` skill requires the agent to resolve each one
>   before `deepen`, to exactly one of four recorded values — `finding` (the silence is the
>   result, as with `@josi.travelplanning`), `persona` (content-first by design, as with
>   `@ava.isventing`), `placement-outside-window` (the mention exists but is older than the
>   scrape, as with `@emilseljeseth`), or `unrelated` (search noise). Store it as
>   `relevance_basis`, free text required. This is `classify.mjs`'s `account_type_basis`
>   field — *"so the inference can be discounted rather than trusted"* — applied at
>   collection time instead of at library-build time.
> - `deepen.sh --rank` **excludes `relevance: unrelated` accounts from the top-5 ranking and
>   from every network total**, and says how many it excluded and what they carried. That is
>   the 10.1% Roamy inflation, prevented rather than discovered afterwards
>   (`template/scripts/deepen.sh`).
> - The Atlas renders `insertion: []` as `[{id: "none", label: "No app mention"}]`, exactly
>   as it already does for disclosure; the post table gains a **"names app"** column and a
>   filter toggle; the account header shows `names the app in N of M scraped posts` and the
>   `relevance_basis` string when the rate is zero
>   (`template/atlas/scripts/build-index.mjs`, `components/PostTable.tsx`,
>   `app/account/[handle]/page.tsx`).

### Q3. Does ugckit have the equivalent of the classify step, and is it correct?

**It has two fragments of one, in the wrong place and at the wrong time, and neither
reaches the research half.**

organic-social's classify step is `scripts/lib/classify.mjs` (446 lines), run by
`build-library.mjs`. It assigns every account one of `brand` / `persona` / `creator` /
`unrelated` / `unknown`, plus an `account_type_basis` recording *why*. Its ordering is
curated-list first, then bio pattern, then caption-mention rate, then `unknown`. Its
stated design principle is the one that matters:

> *"Everything in here is evidence-backed and deliberately conservative: where the corpus
> does not tell us, we emit null / 'unknown' rather than guess."*

and, on the fallback:

> *"`persona` is only asserted when the account itself declares the affiliation in its bio.
> Everything else is `unknown`. This under-counts personas and that is the intended
> direction of error — a real creator mislabelled a persona would corrupt every average."*

It is also explicit that the obvious heuristic is wrong:

> *"A handle containing the app name is NOT sufficient — chiara.roamy, lara.jobstep,
> iana.ventnow, manal.jobstep.io and sarinajobstep are all seeded persona accounts that
> carry the app name."*

What ugckit has instead:

| Piece | Where | Verdict |
|---|---|---|
| `own yes` | `state.py handle-set … own yes` | A single boolean for "the app's own account". No persona / creator / unrelated distinction at all. |
| `isOwn` inference | `build-index.mjs:105` — `own === "yes" \|\| handle.includes(token)` | **Incorrect, and it is the exact error classify.mjs warns about.** `chiara.roamy`, `lara.jobstep`, `iana.ventnow`, `manal.jobstep.io`, `sarinajobstep` all contain the app token and all get flagged as the brand's own account by this rule. `classify.mjs` names four of those five as counter-examples in a comment. `PLAYBOOK.md` §3.3 depends on the distinction being right: brand-in-the-handle is *"harmful only at Vent Now … Top tier at Stronger"*, and `@strongerwithlinda` — brand name plus persona format — is *"the cleanest negative control in the corpus"* at 24,869 lifetime views. Collapse persona-with-brand-name into brand and that finding disappears. |
| `handleConvention` | `build-index.mjs` | Derived from the handles themselves. Genuinely useful — it is `<firstname>.lifts` / `.traveltips` / `.jobtips` mechanised — but it is a naming observation, not an account type. |
| insertion / disclosure / hook rules | `atlas/data/thread-rules.json`, `hook-rules.json` | Real, and a faithful port of organic-social's findings (4 insertion mechanics, 15 hook rules). But they are **per post, in the Atlas only, at display time.** They never reach `state.py`, the teardown skill, or any script. |

Three structural problems, beyond the `isOwn` bug:

1. **It runs at the wrong time.** classify.mjs runs *after* six teardowns exist and reads
   them; ugckit's fragments run at index time, after collection is paid for. Neither
   position lets classification prevent a bad scrape. In ugckit the classification the user
   needs — is this handle worth 50 posts of Monid credit — has to happen at R2, before the
   money is spent, and nothing happens there but a free-text evidence string.
2. **It has no `unrelated` state.** classify.mjs's `UNRELATED_ACCOUNTS` exists because the
   Roamy teardown had to name four accounts that *"survived triage into the scrape"* and
   quarantine them from every average. ugckit has `reject` (pre-admission, never scraped)
   and nothing for "we scraped it and it turned out not to belong". Once a handle is in the
   ledger, its views are in the app's totals forever.
3. **It has no basis field.** `account_type_basis` is what makes classify.mjs's output
   safely usable — `curated_brand_list`, `teardown`, `bio_declares_app`,
   `captions_declare_app (74% of captions name the app)`, `no_evidence`. ugckit's `evidence`
   string is prose typed by the agent, is not machine-readable, and is never checked
   against the data that arrived afterwards.

> **RULE 3 — one classification function, applied at R2 and re-checked at R3, that records its own basis and refuses to guess.**
>
> - Add `template/scripts/classify.py`, porting `classify.mjs`'s decision order and its
>   conservatism verbatim: curated own-account list → bio declares the app → caption
>   mention rate ≥ 0.5 → `unknown`. **Never infer brand from the handle string.** Replace
>   `build-index.mjs:105`'s `handle.includes(token)` with a read of the ledger's recorded
>   type, so the Atlas and the scripts cannot disagree
>   (`template/atlas/scripts/build-index.mjs`).
> - Add `account_type` (`brand` / `persona` / `creator` / `unrelated` / `unknown`) and
>   `account_type_basis` to `HANDLE_KEYS` (`template/scripts/state.py`). Default `unknown`
>   with basis `no_evidence`; the direction of error is under-claiming, as classify.mjs
>   says.
> - `network.sh` runs it at R2 on the search evidence and prints the proposed type per
>   candidate; `harvest.sh` re-runs it at R3 on the real 50 posts and **prints a diff when
>   the two disagree**. A handle admitted as a promoter that arrives at a 2% mention rate is
>   the single most useful signal the pipeline can produce, and today nothing computes it.
> - Add `state.py unrelated <project> <app> <handle> "<reason>"` — post-scrape quarantine,
>   distinct from `reject`. Quarantined accounts stay on disk and in the Atlas (their hooks
>   are still real hooks, which is why `classify.mjs` keeps their rows) but are excluded
>   from every per-app total, from `deepen --rank`, and from the teardown's numbers
>   (`template/scripts/state.py`, `template/scripts/deepen.sh`,
>   `template/.claude/skills/teardown/SKILL.md`).
> - The `teardown` skill quotes `account_type_basis` next to every tier claim in heading 2,
>   so a reader can discount an inference instead of inheriting it.

---

## 3. The admission gate ugckit does not have

`learnings.md` contains an explicit, quoted vetting filter for whether an account is worth
studying, and ugckit implements none of it. This is upstream of everything in §2: the
reason folders are full of irrelevant content is partly that the wrong handles were let in.

| Rule from `learnings.md` | Verbatim | ugckit today |
|---|---|---|
| **Not one viral post** | *"don't save an account just because one post went viral. that one post might be the only hit in its entire history. copy it and you're copying luck, not a format."* — Salim | `candidates.tsv` sorts by `best_views` and the skill admits on any evidence. A single hit is sufficient. |
| **A wall, not a fluke** | *"at least 100k views in the last 30 days, spread across posts, not from a single viral fluke"* · *"if an account has constant bangers, not one, a wall of them, it will work for you too. it's just math."* — Salim | Nothing computes recent-window views or spread. `deepen.sh --rank` uses total views over the 50-post sample, which is the opposite measure. |
| **Active, repeatable pattern** | *"an active, repeatable format pattern" · "posts daily"* — Salim | `build-index.mjs` computes `postsPerWeek` and `active` (last post < 21 days) — **at index time, in the Atlas, after the scrape is paid for.** Never at R2. |
| **Only accounts that bet on the channel** | *"keep only the ones who really bet on TikTok"* — Nicholas Dulait | No such filter. `--all` scrapes everything admitted. |
| **Minimum sample per competitor** | *"Study 20 to 30 posts per competitor minimum. Don't skip this step please."* — Nicholas Dulait | 50-post default clears this. The one rule ugckit satisfies. |
| **Recency bound** | *"twenty or thirty videos that are genuinely outperforming in your niche from the last month or two. anything older format has usually moved on."* — Chris | `apps.sh` and `network.sh` run `ALL_TIME` and `LAST_THREE_MONTHS` and merge them with no recency weighting. The UMax network runs 2024→2026 and is scraped as one undifferentiated pile. |
| **A quality floor on what you copy** | *"when you see a video with at least 50k likes, use that hook or format yourself"* — Alejandro Sanchez | No floor anywhere. Every cover of every admitted handle goes into the hook bank at equal weight. |
| **Don't write a coincidence into the file as a rule** | *"tell me which of these patterns you saw across most of the videos and which you're extrapolating from one or two."* — Chris; `HANDOFF.md` calls it *"the best methodological line in the whole project"* | The `teardown` skill has the spirit (*"say the sample is thin in the sentence that makes the claim"*) but no counts to say it with. |

> **RULE 4 — admission is a gate with numbers behind it, and the gate runs before the money.**
>
> - `network.sh` computes, per candidate, from the search JSONs already on disk and at no
>   extra cost: post count seen, best views, **views in the last 90 days**, whether more
>   than one post clears a floor, first and last post date seen, and the `names_app` /
>   `in_handle` / `in_sound` columns it already has. Add them to `candidates.tsv`
>   (`template/scripts/network.sh`).
> - The `network` skill states the gate in Salim's terms and requires the agent to record
>   which limb admitted each handle: **a wall, not a fluke** — more than one post above the
>   floor, or an explicit note saying this is a single-hit account being admitted anyway and
>   why. A one-post-wonder is not a network member; it may still be a format worth reading,
>   and that is a different decision that should be written down as one
>   (`template/.claude/skills/network/SKILL.md`).
> - `harvest.sh` refuses `--all` when any ledger handle lacks a recorded admission basis,
>   and names them. Approval at R3 is for *a list*, and the list should be inspectable
>   (`template/scripts/harvest.sh`).
> - Add the `50k likes` / `100k views in 30 days` floors as **defaults the user can
>   override**, not as hard limits — `learnings.md`'s own numbers are one practitioner's
>   thresholds, and `PLAYBOOK.md` §1.6 shows medians in the hundreds on accounts that
>   carried millions.

---

## 4. The defects carried over from `UGCKIT-REVIEW.md`, now with numbers

### 4.1 `deepen.sh` — one top-3-overall shortlist instead of two passes

Measured in §1.3: **34 of 149 photo posts reached, 115 missed**, including a 1,764,465-view
carousel on the account `PLAYBOOK.md` §2.2 calls the corpus's cleanest experiment.

`METHOD.md` step 6b exists precisely because this was already got wrong once, and it says
so: the video pass *"skips those posts"* and `run-brand.sh` *"always runs `slides-pass.sh`
after a deep dive"* because *"Without this the deep dive silently misses them."* ugckit
kept `AGENTS.md` rule 10 — the *knowledge* that photo posts matter — and dropped the
*mechanism* that acts on it.

> **RULE 5 — the deep dive shortlists per format, never across formats.**
>
> `deepen.sh` writes `shortlist-video.tsv` (top N by views among posts with no `images`
> array, default 3) and `shortlist-photo.tsv` (top M by views among posts with a non-empty
> `images` array, default 5) and processes both, every time. `slides.tsv` continues to list
> every photo post as the denominator. Print the two counts so a run that pulled zero slides
> on an account that has 28 photo posts is visible on the console
> (`template/scripts/deepen.sh`, `template/.claude/skills/deepen/SKILL.md`).
>
> Corollary, because rule 12 makes it permanent: `deepen.sh` prints, per account,
> `pulled N of M photo posts` and warns when a photo post above a view threshold is below
> the cut. `METHOD.md` §6b's pruning warning — *"301 jpgs on one account for posts nobody
> was ever going to read"* — is the reason M stays small, not a reason to leave M at zero.

### 4.2 `AGENTS.md:42` cites `setup_templates.py`, which does not exist

Verbatim, rule 4: *"Templates created by `setup_templates.py` are messages-only (no
system_instructions, no variables) for exactly this reason."* `ls template/scripts/ | grep
-i setup` returns `setkey.py` and nothing else. Templates are actually created over MCP by
the `setup` skill.

Small, but it is in the hard-rules block — the one section `AGENTS.md` opens by saying
*"Read this file fully before acting. It is the contract."* An agent that goes looking for
the file and cannot find it has been told the contract is unreliable.

> **RULE 6 — every file path named in `AGENTS.md` or a skill must exist, and CI proves it.**
>
> Fix the line to name the `setup` skill (`template/AGENTS.md`). Then add a check to
> `scripts/doctor.py`: extract every `scripts/*.py`, `scripts/*.sh` and
> `.claude/skills/*/SKILL.md` path mentioned in `AGENTS.md` and in each SKILL.md, and fail
> on any that does not resolve. This class of error recurs — `install.sh` already carries a
> `RETIRED` list for skills and scripts that were removed — and a five-line check kills it
> permanently (`template/scripts/doctor.py`).

### 4.3 ×median — a correction to `UGCKIT-REVIEW.md`, and what is actually missing

`UGCKIT-REVIEW.md` §4.3 row 30 says there is *"no ×median computation anywhere in the
research half."* That is too strong and should be read as corrected by this document.
`template/atlas/scripts/build-index.mjs:587` computes it, correctly attributed:

```js
// The Social Growth Engineers breakout signal — a better outlier metric
// than raw views, because it is relative to the account's own baseline.
xMedian: med ? Number((top.views / med).toFixed(1)) : null,
```

alongside `medianViews`, `maxViews`, `spanDays`, `postsPerWeek`, `active` and
`engagementRate` — a faithful port of `METHOD.md` step 5's lifecycle arithmetic. The
`--verbose` index report prints it per account.

What is actually wrong is narrower and still real:

1. **It lives only in the Atlas**, which needs Node 18+ — the one dependency `install.sh`
   marks optional and `doctor.py` only warns about. A user without Node has no outlier
   metric at all.
2. **No script or skill consumes it.** `deepen.sh --rank` sorts on total views;
   `teardown/SKILL.md` never mentions median, ×median, cadence or active window, so the
   thirteen headings are written without the arithmetic that would answer headings 3, 5, 8
   and 10. The numbers are computed and then not used.
3. **It is per account, not per post.** SGE's badge — *"644.2× median"*, *"120.4× median"*,
   quoted in `learnings.md` — is a property of a *post*: that post's views over that
   account's median. `build-index.mjs` computes only `top.views / med`, the account's single
   best post. Every other post has no breakout figure, so a post table cannot be sorted by
   the metric `PLAYBOOK.md` §8 names first under *What to measure, in order*.

> **RULE 7 — outlier arithmetic is derived once, in the research half, and every consumer reads it from there.**
>
> Move the derivation out of the Atlas into `template/scripts/stats.py`, run at the end of
> `harvest.sh`, writing `<handle>/stats.json` and an app-level `stats.tsv`: per account —
> median, max, ×median, first/last post, span, posts per week, active, photo share of posts
> and of views, mention rate; per post — `x_median` (`views / account median`) written as a
> column in `index.tsv`. `build-index.mjs` reads that file instead of recomputing, so Node
> stops being load-bearing and the two can never disagree. `deepen.sh --rank` prints
> ×median beside total views. The `teardown` skill quotes `stats.tsv` for headings 3, 5, 8
> and 10 instead of asking the writer to eyeball `index.tsv`.

### 4.4 No synthesis stage

`teardown/SKILL.md`: *"The cross-app learnings are a later stage, not this one."*
`state.py`'s `RESEARCH` list is `["product", "apps", "network", "harvest", "deepen",
"teardown"]`. **There is no later stage.**

This is a relevance problem as much as a structural one. `PLAYBOOK.md`'s method is to admit
a claim only when it is *"positively evidenced in at least two networks and contradicted in
none"*, and to list separately, by name, the claims that rest on one network — §9.3 has
thirteen of them. That discipline is what stops a coincidence in one app's data becoming a
rule. Chris's line, which `HANDOFF.md` calls the best in the project, is the same
instruction: *"do not write a coincidence into the file as a rule."*

Without a synthesis stage, ugckit's output is five documents each written from one app's
data, with no mechanism that would ever catch a single-network claim — and with the
per-app relevance defects of §1 baked into each one.

> **RULE 8 — add R6 `playbook`, and make its evidence threshold a rule the stage enforces.**
>
> New `template/.claude/skills/playbook/SKILL.md`; add `playbook` to `RESEARCH` in
> `state.py` and to the R-stage table in `AGENTS.md`. Structure it on `PLAYBOOK.md`'s own
> shape, because that shape is the finding: §0 what this rests on and the limits that shape
> every number (post cap, mention rates, missing admitting posts, no store data, no eye
> test); §1 claims evidenced in ≥2 apps and contradicted in none; §2 what varied and what
> the variation depends on; §3 **claims that rest on one app, listed by name**; §4 where the
> sources and the corpus disagree. The stage refuses to promote a claim to §1 without
> naming the two apps it holds in.

### 4.5 `originate` and `library.py` depend on a corpus ugckit does not build

`library.py` reads `LIBRARY_DIR/library/hooks.jsonl`, `_stats.json`, `templates.json`,
`formats.json`, `mechanics.json` and `media/*/TEARDOWN.md`. In organic-social those are
produced by `scripts/build-library.mjs` + `scripts/lib/classify.mjs` — 4,669 hook rows
emitted from 5,443 in `media/`, deterministically, with `media/` read-only. **ugckit ships
neither script, no seed corpus, and no `library/` directory.**

`.env.example` describes `LIBRARY_DIR` as *"a research corpus checkout"* without saying no
corpus is distributed. `doctor.py` reports its absence as a yellow warning. `AGENTS.md`
routes every research-led project through `originate`, and `handoff.sh` correctly refuses a
photo-post winner — so the most likely research outcome lands on the one stage that cannot
run for anyone but this repo's author.

This is also where §2's relevance work would pay off twice. `hooks.jsonl` carries
`account_type` and `account_type_basis` on every row *because* mixing tiers destroys the
numbers — `JOURNAL.md` Phase 10: *"creators run a median of 15,547 views against 764 for
personas — mixing them makes any template-performance figure meaningless."* A library built
from a ugckit corpus with no account types and no relevance flags would carry that error
into every generated prompt.

> **RULE 9 — the corpus a project produces is the corpus it queries, and the builder ships with the toolkit.**
>
> Port `build-library.mjs` + `classify.mjs` as `template/scripts/build_library.py`, reading
> `research/` and writing `research/library/`. Default `LIBRARY_DIR` to the project itself,
> so `originate` works on a project's own five teardowns with no external checkout. Emit
> `account_type`, `account_type_basis` **and the new `names_app` / `mention_rate` fields**
> on every row, and exclude `unrelated` accounts from every aggregate the way
> `_stats.json`'s note already does: *"Every block except by_account_type excludes
> account_type 'unrelated'."* Where a seed corpus cannot be shipped, say so plainly in
> `.env.example` and in `originate/SKILL.md` rather than describing a corpus that is not
> there.

---

## 5. The rules, in one table

Ordered by how much irrelevant research each one prevents.

| # | Rule | Files |
|---|---|---|
| 1 | An admitted handle carries its admitting post as data; the harvest fetches it, or fails loudly. The Atlas pins it. | `scripts/state.py`, `scripts/network.sh`, `scripts/harvest.sh`, `atlas/scripts/build-index.mjs`, `atlas/app/account/[handle]/page.tsx` |
| 2 | Relevance is computed per post at collection, rolled up per account, rendered as a column and a filter. A zero-mention account is a stop with a recorded basis, never a silent delete. | `scripts/harvest.sh`, `scripts/state.py`, `scripts/deepen.sh`, `atlas/scripts/build-index.mjs`, `atlas/components/PostTable.tsx`, `.claude/skills/harvest/SKILL.md` |
| 3 | One classification function, run at R2 and re-checked at R3, recording its basis and refusing to guess. Never infer brand from the handle string. Add a post-scrape `unrelated` quarantine. | new `scripts/classify.py`, `scripts/state.py`, `scripts/network.sh`, `scripts/harvest.sh`, `atlas/scripts/build-index.mjs` |
| 4 | Admission is a gate with numbers behind it, run before the money: a wall not a fluke, recent-window views, recorded admission basis. | `scripts/network.sh`, `.claude/skills/network/SKILL.md`, `scripts/harvest.sh` |
| 5 | The deep dive shortlists per format — top-3 video and top-5 photo, both every time. | `scripts/deepen.sh`, `.claude/skills/deepen/SKILL.md` |
| 6 | Every path named in `AGENTS.md` or a skill must resolve; `doctor.py` proves it. | `AGENTS.md`, `scripts/doctor.py` |
| 7 | Outlier arithmetic is derived once in the research half, per account **and per post**, and every consumer reads it from there. | new `scripts/stats.py`, `scripts/harvest.sh`, `scripts/deepen.sh`, `atlas/scripts/build-index.mjs`, `.claude/skills/teardown/SKILL.md` |
| 8 | Add R6 `playbook`; a claim reaches the "held everywhere" section only when two apps carry it and none contradicts it. | new `.claude/skills/playbook/SKILL.md`, `scripts/state.py`, `AGENTS.md` |
| 9 | The corpus a project produces is the corpus it queries; ship the builder and the classifier. | new `scripts/build_library.py`, `.env.example`, `.claude/skills/originate/SKILL.md` |

---

## 6. What this does not fix, stated so it is not assumed

- **The 50-post cap remains a floor on every number.** Rule 1 recovers the one post that
  matters; it does not recover an account's history. `PLAYBOOK.md` §0 limit 1 —
  @strongermobile reports 2,433 videos and 50 were scraped — still applies, and the
  teardown caveat must still say so.
- **Relevance by caption is not relevance.** A post can promote the app entirely on screen
  with nothing in the caption — `AGENTS.md`'s own R2 note says *"the posts most worth
  finding are the ones that never name the app — it is on the screen and the comments ask
  'what app is this'"*. `HOOKS.md` already transcribes the on-screen text, so a second
  pass could match the app token against the transcribed hook as well as the caption; that
  is a cheap extension to rule 2 and it should be built, but the caption rate is the number
  available at zero cost and it is where to start.
- **Nothing here recovers the browser eye test.** `METHOD.md` step 3 is still absent, and
  `@ava.isventing` — 0 mentions in 50 posts, and the account the Vent Now teardown is built
  around — was confirmed by opening her profile and looking. Rule 2's `relevance_basis`
  gives that judgement somewhere to be recorded; it does not make it, and the person or
  agent still has to look. See `UGCKIT-REVIEW.md` §3.2.
- **These measurements are approximations.** The mention rates in §1.2 use simple word
  matching on caption plus hashtags; the admitting-post test in §1.1 assumes the best
  search-result post is the one that admitted the handle, which is what `candidates.tsv`
  sorts on but not necessarily what an agent would pick. Both were run against
  organic-social's 20-result searches and 50-post profile scrapes; ugckit defaults to
  40-result searches and the same 50-post scrapes, so the shape transfers and the exact
  percentages will move.
