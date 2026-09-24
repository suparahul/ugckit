# Account Architecture — the parameters of a TikTok account that distributes slideshows for a consumer app

An account architecture is a list of parameters. Each parameter has a fixed set of values that we have seen work or fail. This is the layer above `SLIDESHOW-ANATOMY.md`. That file holds the parameters of one post. This file holds the parameters of the account that posts it, and of the set of accounts an app runs. An account-level experiment changes one parameter here and holds the post-level parameters at their best-seen values.

Every value below comes from evidence in `learnings-slideshows.md` (cited by section), `learnings.md` (cited by section), `PLAYBOOK.md` (cited by section), `FUNDAMENTALS-REVIEW.md` (cited by item number), the six teardowns under `media/<brand>/TEARDOWN.md` (cited by section), the two batch files `X-SLIDESHOW-BATCH-2026-09-11.md` and `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` (cited by section), `HANDOFF.md` and `JOURNAL.md`. No value is invented. Where the evidence is thin, the table says so.

Each layer holds parameters. Each parameter is a heading. Under the heading, one table: one row per value we have seen.

**Seen in** lists the niches the value was seen in. A value seen in two or more niches is treated as niche-agnostic. A value seen in one niche only is not yet known to transfer. **(claimed)** in the evidence means a creator or an article described the value; we did not see an account that uses it.

**Corpus and slideshow evidence are mixed here on purpose.** The six teardown networks (Vent Now, Stronger, Potto, Roamy, JobStep, UMax) are mostly video. Their account-level findings are the strongest evidence this project has on handles, bios, tiers, cadence and kill rules, and the account layer does not change with the medium. Where a value rests on video evidence only, the evidence cell names the network so the reader can judge the transfer. The slideshow-first comparables (`@mei.dates`, `@testo.cat`, `@lindalewiston3`, `@lin444782`, `@the.modern.man`, `@gym1495`, `@glowuptrickz`, `@mias.diary7`, `@datingwithmads`, `@easy_cooking_ideas`, the Vent Now persona accounts, the nine scrolled cat accounts) sit beside them.

**Rules to avoid overlap.** The handle says what the account is called. The bio says what the profile text holds. Persona fidelity says whether the posts share one subject. The format lock says whether the posts share one format. The tier says what job the account does in the network. Cadence says how often it posts. The persona *type* (person, mascot, theme page, brand handle, ambassador) is a post-table column in `SLIDESHOW-ANATOMY.md` Layer 0 and is not repeated here. The product slot inside a post is `SLIDESHOW-ANATOMY.md` Layer 4 and is not repeated here.

---

## Layer 1 — Handle

### Handle naming pattern

| Value | Seen in | Evidence |
|---|---|---|
| `<firstname>.<niche>` | travel, gym, job search, dating | Roamy 13 of 22 handles are `<firstname>.traveltips` or a one-character mutation, and the fleet's biggest post (4,450,213) came off one, `media/roamy/TEARDOWN.md` § 2; Stronger 11 `<firstname>.lifts` handles, 83,756,476 views, `media/stronger/TEARDOWN.md` § 2; JobStep 9 scraped on `<firstname>.jobtips` / `.jobstep` (21 on the wider ledger), `FUNDAMENTALS-REVIEW.md` item 13 fact-check; `@mei.dates`, `learnings-slideshows.md` § Example accounts. `PLAYBOOK.md` § 3.3 calls it the default. The pattern does not predict the outcome: JobStep's `@manal.jobstep.io` is the tightest brand-in-handle name and its weakest full-scrape account (best 6,818), `media/jobstep/TEARDOWN.md` § 2 |
| `<firstname>` persona, no niche word | mental health | Vent Now 2025 cohort "sydney" `@sydneysynced` 4.8M, "sarah" `@selfbysarah` 7.9M, "heather <3" `@heather.xoxo` 7.5M, `learnings-slideshows.md` § Account Architecture (grid screenshots, not scraped) |
| name + topic tag (`issy.anxiety`, `ava.isventing`) | mental health | Vent Now "mixed" result; `@ava.isventing` is the network's biggest seeded account by total views (3,150,128), `media/ventnow/TEARDOWN.md` § 2; `FUNDAMENTALS-REVIEW.md` item 14 fact-check |
| anonymous throwaway (`cat.naur`, `madi.spam111`) | mental health, meal planning | Vent Now's top seeded accounts by best post: `@cat.naur` 1,758,965, `@ava.isventing` 1,260,995, `@maeveeeee7` 846,687, `FUNDAMENTALS-REVIEW.md` § 2.2 fact-check; Potto's `@madi.spam111` 29,233,020, the single biggest account in its network, `media/potto/TEARDOWN.md` § 2. `PLAYBOOK.md` § 3.3: the only convention that won in the one network where brand-in-handle lost |
| pet name in the handle | cat | Four of the nine scrolled cat posts are pet accounts with the cat's name in the handle (`@tommy_purrs` 2.52M, `@lukaandmeowmy_marie` 392K, `@chuchutama` 182K, `@mochiandcheddar1` 1.20M), `learnings-slideshows.md` § 2026-09-12, "Niche and who posts" |
| mascot name (`@testo.cat`) | health | 8,886 followers, 437.2K best on the grid, `learnings-slideshows.md` § Example accounts |
| theme-page name (`@the.modern.man`, `@gym1495`, `@thatgymguy16`, `@meow_meowcatss`, `@glowuptrickz`, `@healthyyinspoo`, `@easy_cooking_ideas`) | looksmaxxing, gym, cat, cooking, healthy food | `@the.modern.man` 458.1K best, no app; `@gym1495` copied its template, 113.5K best; `@thatgymguy16` Lino's own page, 43 followers; `@glowuptrickz` 1.6M followers; `@healthyyinspoo` 7.6M best, `learnings-slideshows.md` § Example accounts; `@meow_meowcatss` 760K, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 4; `@easy_cooking_ideas` Nicholas's SEO account, `HANDOFF.md` |
| brand name in the handle, running its own format | gym, meal planning, travel, photo (SEO) | Stronger's five brand handles (`@strongermobile`, `@stronger_gymapp`, `@strongerapp`, `@strongerstrengths`, `@strongerus`) 138,638,546 views, 60.6% of the network, three of its five biggest posts, `media/stronger/TEARDOWN.md` § 2; `@potto.app` #2 account, 4,830,200, `media/potto/TEARDOWN.md` § 2; `@chiara.roamy` #5 account, 1,147,930 best, `media/roamy/TEARDOWN.md` § 2; `@trypovappus` (POV App) 10.3K followers, 1.2M likes, explicit app bio, "works for SEO", `learnings.md` § Account Architecture |
| brand name in the handle, running the persona format | gym, mental health, job search | `@strongerwithlinda` 50 posts, 47 days, 24,869 lifetime views, best 4,859, second-worst in a 228M-view network, `media/stronger/TEARDOWN.md` § 2, § 10; Vent Now `@iana.ventnow` 10,641 and `@ventwithchloee` 7,370, the worst performers there, `media/ventnow/TEARDOWN.md` § 2; `@jobstep.io` runs the paid creators' formats, 3rd by reach, dead last on ER (0.73% against a 3.4–13.1% floor), `media/jobstep/TEARDOWN.md` § 2, § 8 |
| ambassador in the handle | job search | `@lara.jobstep`, bio "official brand ambassador @Jobstep.io", best 482,511, dead after 74 days, `media/jobstep/TEARDOWN.md` § 3, § 7. Thin: one account. `@mias.diary7` declares the ambassador role in the bio, not the handle |
| the creator's own pre-existing handle (rented) | looksmaxxing, mental health, meal planning, travel | UMax: none of 35 handles contains "umax" except the brand account; "if you rent, the handle is not yours to name", `media/umax/TEARDOWN.md` § 2, `FUNDAMENTALS-REVIEW.md` item 11; Vent Now `@lowkey_deep`, `@talkswithshad` hold that network's two biggest posts, `media/ventnow/TEARDOWN.md` § 2; Potto `@demi_does.it`; Roamy `@justlikedru`, `@chrisrey3s` |
| UGC declared in the handle (`@laurenteel.ugc`) | meal planning | 24 followers, 13,549 best, a portfolio account, `media/potto/TEARDOWN.md` § 2. Thin: one account |
| founder's own name | photo | `@nikiivictoria` (photogenik) 1.6M followers, bio "founded @photogenik…", `learnings.md` § Account Architecture. Video, one account |
| near-duplicate handles on one script | job search, mental health | JobStep `@julie.jobtips` 38,893 / `@juliejobtips` 720,021 / `@juliajobtips` 381,817, "a template handed to several bodies", `media/jobstep/TEARDOWN.md` § 2; Vent Now's Kait pair ran the same script two days apart under near-identical handles for 269 and 313 views, `media/ventnow/TEARDOWN.md` § 10 |

## Layer 2 — Bio

### Bio content

| Value | Seen in | Evidence |
|---|---|---|
| one app word or phrase, no link, no CTA | dating | `@mei.dates` "coffeemeetsbagel girlie" is the whole funnel; 512K pinned post, 1,195 followers, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6; `learnings-slideshows.md` § Product Insertion |
| a role line, no app, no link | dating, couples | `@lindalewiston3` "Relationship coach"; `@lin444782` "Advice for all who can relate to this"; the app is named inside a tip on a slide instead, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6, § 7 |
| persona flavour line, no app, no link | travel, mental health, cat | Roamy fleet "map pin collector 📍🧭", "lost & loving it 💫🩵", "Travelholic🌺✈️✨", "No bio yet", `media/roamy/TEARDOWN.md` § 2; Vent Now personas have no bio, no link, no follow CTA, `media/ventnow/TEARDOWN.md` § 2; the Vent Now 2025 cohort carries "soft self-help lines like 'self-improvement'", `learnings-slideshows.md` § Account Architecture; scrolled cat accounts "crazy cat lady", "just a kitten going through a life of adventure 🐾", `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § Captions, hashtags, bios |
| ambassador declaration | cat, job search | `@mias.diary7` "Mia & Luna 🐈 Cat care tips that actually help 🐾 PawSolids App ambassador 🔥", 338 followers, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 10; `@lara.jobstep` "official brand ambassador @Jobstep.io", `media/jobstep/TEARDOWN.md` § 7 |
| search instruction naming the app | meal planning, gym, looksmaxxing | `Search for Potto in App Store 🍳` (`@potto.app`), "the app name is potto!" (`@willowsfeed`), 7 of 16 Potto bios, `PLAYBOOK.md` § 3.3; "Search 'Stronger' on the app store" (`@strongerapp`, `@strongerus`), "search stronger on the app store to get your strength standards" (`@strongerstrengths`), `media/stronger/TEARDOWN.md` § 7; "Search "Umax" on iOS or Android" (`@umax.app`), `media/umax/TEARDOWN.md` § 6 |
| @-mention of the brand account | gym, looksmaxxing | "Getting stronger with @Stronger 🙈" (`@kass.lifts`), "getting stronger with @Stronger 💪🏼" (`@milas.lifts`), "Getting stronger with the @Stronger app💪" (`@viktoria.liftss`): 22,406,132 views one tap from the brand profile, `media/stronger/TEARDOWN.md` § 7; nine UMax bios, e.g. "Get your ratings with @Umax App", `media/umax/TEARDOWN.md` § 6 |
| social-proof line + "download below" | gym | `@strongermobile` "Join over 1M people tracking their fitness journey 💪 / Download for free below", 49.5K followers, `learnings.md` § Account Architecture. Whether a link button exists is not captured, `media/stronger/TEARDOWN.md` § 12 |
| explicit product bio on a brand handle | photo, mental health | `@trypovappus` "POV App🔥 / Disposable Camera For Event's 📷 / Available On iOS & Android 📲", `learnings.md` § Account Architecture; `@ventnowapp` "Feel better by learning and understanding your emotions👇🏼" + www.ventnow.ai, 386 followers, `learnings.md` § Reference Accounts |
| "The app I use… on App Store" | emotional story | Pedro's recurring-character account, bio partly redacted in the screenshot, 7.1M views in the week Sep 1–7, `X-SLIDESHOW-BATCH-2026-09-11.md` § 1 (claimed from a screenshot; the account was not opened) |
| theme-page mission line | gym, looksmaxxing, cat | `@thatgymguy16` "Collecting gym rats 0/1000. Page dedicated to the gym."; `@the.modern.man` "Helping men upgrade all aspects of their life / DM me if you have any questions"; `@gym1495` "DM for your lifetime transformation.", `X-SLIDESHOW-BATCH-2026-09-11.md` § 5, § 6; `@meow_meowcatss` "Cat care tips every day 🐈 / Ask anything about cats / Follow us only if you love cats", `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` |
| mascot voice line + linktree | health | `@testo.cat` "your T is cooked. testo cat is here to fix it 😼👇" + linktr.ee/testocat, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6 |
| founder bio with product, contact email, branded short link | photo | `@nikiivictoria` "founded @photogenik to help you take better pics ✉ nikivictoriacontact@gmail.com 🔗 go.photogenik.app", `learnings.md` § Account Architecture |
| "DM for paid promo" | looksmaxxing | `@primal.kevin` "DM for paid promo / Get ratings with @Umax App", the only direct evidence money moves in that niche, `media/umax/TEARDOWN.md` § 6 |
| a second product in the same bio | job search, mental health | `@sina.realfakephotos` sells "RealFakePhotos: KI Bewerbungsfotos" beside JobStep, `media/jobstep/TEARDOWN.md` § 2; `@selfcarewithebs` also promotes "Momo", `media/ventnow/TEARDOWN.md` § 12; 13 of 25 UMax accounts also tag a rival app, `media/umax/TEARDOWN.md` § 11 |
| identical bio string on two handles | travel | `@mina.travelhacks` and `@ray_traveltips` both "map pin collector 📍🧭", "the clearest single artefact of central operation", `media/roamy/TEARDOWN.md` § 2. Do not do this, `PLAYBOOK.md` § 8 Day 1 |

### Bio link

| Value | Seen in | Evidence |
|---|---|---|
| no link | dating, couples, mental health, travel, cat | `@mei.dates`, `@lindalewiston3`, `@lin444782` no link, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6, § 7; no persona bio in Roamy contains a URL, `media/roamy/TEARDOWN.md` § 2; Vent Now personas no link, `media/ventnow/TEARDOWN.md` § 2. `PLAYBOOK.md` § 1.3: not one seeded account in 74 carries a verified working link. Caveat: `posts.json` has no bio-link field, so "no link" means no URL in the bio text |
| linktree | health, glow-up | `@testo.cat`, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6; `@male_aestheticcc` "links an app via linktree", `learnings-slideshows.md` § Example accounts |
| App Store link (claimed) | looksmaxxing | `@glowuptrickz` "the App Store link in the bio", read from Salim's screenshot, `learnings-slideshows.md` § Account Architecture (claimed; not opened by us) |
| Instagram link, no app | looksmaxxing | `@the.modern.man`, `X-SLIDESHOW-BATCH-2026-09-11.md` § 6 |
| affiliate store links | cat | `@chuchutama` Amazon links, "all the products link are listed on my bio🥰", 4.80% saves/view, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 8 |
| typed URL in the bio text | gym, job search | `@annab.lifts` `https://www.strongermobileapp.com/`, the worst account in its network (best 920), `media/stronger/TEARDOWN.md` § 7; `@lara.jobstep` `https://www.jobstep.io/de/links-impressum`, the only typed URL in the whole corpus, `media/jobstep/TEARDOWN.md` § 7 |
| brand website | mental health | `@ventnowapp` www.ventnow.ai, `learnings.md` § Reference Accounts |
| creator's own linktree, not the app | travel | `@justlikedru` "↓ everything is linked here ↓", a Viator affiliate, `media/roamy/TEARDOWN.md` § 2 |

**Does the bio carry the product when the posts do not?** Yes in two cases we opened: `@mei.dates` (bio word, no app on slides 1–5, 512K) and `@glowuptrickz` (bio link, slides are infographics, 1.6M followers, claimed). No in two networks: Vent Now personas carry the app in neither the bio nor the slides; the caption's last clause carries it, `media/ventnow/TEARDOWN.md` § 6. Roamy carries it in neither the bio nor the caption on nine of 22 accounts, "the single most expensive mistake in the corpus", `PLAYBOOK.md` § 1.3. Both in two: `@testo.cat` (linktree + slide 7 card) and `@mias.diary7` (ambassador bio + slide 5–7 card).

## Layer 3 — Identity

### Persona fidelity

Whether the posts share one subject. See `SLIDESHOW-ANATOMY.md` Layer 5, Image subject, for what the subject is inside one post.

| Value | Seen in | Evidence |
|---|---|---|
| one real pet on every slide | cat | `@pelinclh` (tuxedo cat, 3.59M), `@tommy_purrs` (kitten, 2.52M), `@mochiandcheddar1` (two cats, 1.20M and 235K), `@chuchutama` (one British Shorthair, 182K), `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 1–3, § 8 |
| one mascot on every cover | health | `@testo.cat`, "one ginger cat on every cover. No face.", 437.2K / 403.3K / 243.2K, `learnings-slideshows.md` § Format Specs |
| one recurring AI character, same face every post | emotional story, gym | Pedro's crying woman "same face, same character, every post", 7.1M views in one week, `X-SLIDESHOW-BATCH-2026-09-11.md` § 1; his replica "Ana Castro ❤️‍🩹" 2.0M; an unnamed fitness app "its recurring characters make the content recognizable", 52M+ views, `learnings.md` § Account Architecture (SGE, claimed) |
| the same two AI faces across many covers, on two accounts | couples | Groundly's `@lindalewiston3` and `@lin444782`: "the same two faces on many covers", `X-SLIDESHOW-BATCH-2026-09-11.md` § 7 |
| one reused still, recoloured or relabelled | mental health, travel, looksmaxxing | Vent Now `@ava.isventing` fixed image, rotating hook, 1,260,995, saves 4.990%, `PLAYBOOK.md` § 5.2 C; `@dana.traveltips` one airplane-window shot in 7 of 12 posts, `@sofiaa.traveltrips` one Bali shot in 6 of 12, `PLAYBOOK.md` § 5.2 C; `@bruceaesthetic` one blurred frame in six colour grades, 5,152,123 / 2,536,464 / 2,038,191, `media/umax/TEARDOWN.md` § 10; `@oliviatok88` one pool-edge photo on 45 of 95 covers (47%), 2026-08-09 to 2026-09-12, 1,945 followers, empty bio, median 5.6K views, `ACCOUNT-INSPECT-oliviatok88-2026-09-24.md` § 3 |
| one invented person, own-style photos, no face | dating | `@mei.dates` "one invented woman in New York", text card over moody photo, 582.1K / 518.9K / 512K, `learnings-slideshows.md` § Account Architecture, § Format Specs |
| one persona, one topic, never deviates | mental health | Every Vent Now seeded account "carries one persona and one topic and never deviates", `media/ventnow/TEARDOWN.md` § 2; the one off-brief account `@life.improvement.tips` (42 posts of college advice for men) was killed at six weeks with a best of 1,297, `PLAYBOOK.md` § 1.5 |
| different cats, own face on one slide | cat | `@mias.diary7`: bio "Mia & Luna", but "the photos are not one cat; slide 6 shows a woman holding a cat", saves/view 0.53–0.88%, the lowest in the batch, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 10. The low saves are attributed to the advice-only content, not to the mixed subject, `learnings-slideshows.md` § 2026-09-12 |
| a different face on every post (no persona) | meal planning | Potto dump accounts: `@willowsfeed`'s 50 covers include "a woman in a white t-shirt, a woman with long black hair, three different women in pink bonnets"; best 748,886; "these are not personas; they are dump accounts for other people's UGC", `media/potto/TEARDOWN.md` § 2. `@potto.app` republishes twenty faces, 4.82M from two batch days, `PLAYBOOK.md` § 3.4 |
| a real creator's own face and franchise | mental health, travel, looksmaxxing | `@lowkey_deep`, `@talkswithshad` (5.5M and 2.4M, over half of Vent Now's views), `media/ventnow/TEARDOWN.md` § 2; `@chrisrey3s` 110,290 at 337× his median, `media/roamy/TEARDOWN.md` § 2; UMax's 35 rented creators |
| stock couples, the credential switched to "expert" | mental health | `@ava.isventing` moved from "(From a girl who…)" over own images to "(from a relationship expert)" over stock couple photos and collapsed from 829K–1.26M to 900–8,500, then ran the losing format 47 more times, `media/ventnow/TEARDOWN.md` § 10; `PLAYBOOK.md` § 4 Job 5 |

**Decisions for our handles (Rahul, 2026-09-15).** Two identity arms, one per handle, on the same format family and the same rendered-cat images:

| Handle | Identity | Persona fidelity value | Voice | Reason |
|---|---|---|---|---|
| `@hannah.catmom` | named persona: Hannah, a cat mom with **exactly two cats** (Rahul, 2026-09-15): an orange tabby and a cute British Longhair. Reference photo of the tabby with the Hannah-like owner and her cat tree: `posts/references/hannah-orange-tabby.png` | two rendered cats, the same two on every post, inside one owner story (the "one real pet on every slide" row above, with two); never a third cat | first person | the persona arm; every cat post above 290K in the batch is an owner's first person (`APP-FIT.md` C2) |
| `@catlover.tiktok3` | general cat-knowledge account, no persona, no named cat | random rendered cats, no story (the "a different face on every post" row above, with cats) | second person or neutral; no "I", "my", "we"; the product mention is "Catwise has a … plan for this", a form no post in the evidence uses | Hannah already runs the persona experiment, so the general page is the right second experiment. The two options weighed: a named persona (a foster carer, a vet-nurse, a pet-sitter, each a story that explains random cats) against the theme page; the theme page's known cost is reach without saves (`@meow_meowcatss` 0.90% saves/view against a 1.9% batch median) |

The comparison is read at day 7 and day 30 of week 1 (`WEEK-1-PLAN.md`): views, saves/view, "what app?" comments and store impressions per 100K views, Hannah against catlover on the same format family.

### Format lock

Whether one account runs one format.

| Value | Seen in | Evidence |
|---|---|---|
| one format per account, noun or verb rotated | mental health, gym, meal planning, travel, health, dating | "One locked format per account. Every account in the set runs one template and rotates the noun or the verb.", `learnings-slideshows.md` § Account Architecture; `@testo.cat` "5 [things / signs / habits] + verb + testosterone"; Vent Now nine niches, one per account, `PLAYBOOK.md` § 1.5; Potto 230 of 423 hooks contain "shopping at", per account near-total (rossypreps 15/15, willowsfeed 47/50); Roamy `@mina.travelhacks` "this template appears in 67% of the feed"; Stronger brand handles post only two-slide memes, persona handles only video, `PLAYBOOK.md` § 1.5 |
| one template on several persona accounts | couples, mental health, cat | Groundly's Linda and Lin: the same cover titles on both accounts, "feminine ways to talk to him" 366.9K on Lin against 61.2K on Linda, `X-SLIDESHOW-BATCH-2026-09-11.md` § 7; the Vent Now 2025 cohort; the "Things I bothered the vet with" line on three cat accounts inside weeks, 3.59M and 2.52M, `learnings-slideshows.md` § 2026-09-12 |
| one format, three formats tested a day (claimed) | any | Pedro "3 different formats per account, per day"; his worked example Format A 500, B 5K, C 100K, `learnings.md` § Finding Ideas & Vetting Formats (claimed) |
| photo posts only if the account is built on them | looksmaxxing, gym | UMax network-wide photo median 16,933 against video 24,928, but `@handsome.habit` puts 86% of 12.2M views on 27 carousels; "photo posts only work if the account is built on them", `media/umax/TEARDOWN.md` § 4; Stronger `@strongerstrengths` 32 photo posts 13,461,933 views, 17 videos 2,461 views, `FUNDAMENTALS-REVIEW.md` item 41–43 fact-check |
| mixed formats on one handle | job search, mental health | `@jobstep.io` mixes German and French content and paid-boosted and organic posts in one feed, `media/jobstep/TEARDOWN.md` § 4; `@ventnowapp` runs four creatives across 14 posts, best 17,995, `media/ventnow/TEARDOWN.md` § 4. Both are the weakest ER accounts in their networks |

### Format change inside an account

What happens when the account changes what it posts.

| Value | Seen in | Evidence |
|---|---|---|
| a switch to a proven template lifts the account | gym | `@gym1495` copied `@the.modern.man`'s red-keyword editorial template; older posts 363–6,481 views, the six newest 17.3K–113.5K. Salim's "4k to 170k" claim is larger than the frames show, `X-SLIDESHOW-BATCH-2026-09-11.md` § 5 |
| a switch away from the winning format kills the account | mental health | `@ava.isventing` credential switch, above, `media/ventnow/TEARDOWN.md` § 10 |
| adding video to a photo account adds nothing | gym | `@strongerstrengths` 17 daily videos under one identical caption, 49–290 views each, then the account stopped, `PLAYBOOK.md` § 2.2 |
| restarting a serial counter fails | looksmaxxing | `@jorikkkkk_` "Day 1 of neck curls and chin tucks" 5,371,684, Day 229 still 3,857,841; a second "Day 1 of glow up journey" 38,102, `media/umax/TEARDOWN.md` § 10 |
| reposting the same slides on the same account does not re-run the reach | cat | `@mias.diary7` reposted its 151K post on 2026-09-04 for 483 views, `learnings-slideshows.md` § 2026-09-12; Vent Now reposts to itself 44,914 → 17,371, `media/ventnow/TEARDOWN.md` § 10 |
| reposting the same slides on the same account can still reach far | mental health | `@oliviatok88`, photo slideshows reposted with the same cover, the same body text word for word, the same sound and the same "wellness ai" mention. "Weird habits that are actually depression": 503,767 (08-10), 288,653 (08-14), 23,012 (08-27, 6 slides; the other two have 8). "Weird hacks my counselor gave me…": 619,347 (08-18), 16,061 (08-19), 117,249 (08-24), `ACCOUNT-INSPECT-oliviatok88-2026-09-24.md` § 1. This disagrees with the row above |
| reposting the same line on a later account re-rolls | gym, meal planning | "I used to HATE going to the gym…" 405 / 391 / 327 on `@kailyn.lifts`, 3,033,184 on `@kass.lifts`, `media/stronger/TEARDOWN.md` § 10; Potto's one creative 29,233,020 / 2,919,594 / 748,886 across two accounts, `media/potto/TEARDOWN.md` § 10. "Spread your firings across handles, not down one feed", `PLAYBOOK.md` § 7.5 |
| reach comes early and does not repeat | cat, meal planning | `@mias.diary7` three posts above 69K in the first 17 days, then 20 of the next 23 under 6K, `learnings-slideshows.md` § 2026-09-12; Potto: the best post is the first post in 5 of 15 accounts, in the first three in 9 of 15, `media/potto/TEARDOWN.md` § 3 |

## Layer 4 — Tier

### Account tier

The job the account does in the network.

| Value | Seen in | Evidence |
|---|---|---|
| brand handle (the name resolves here) | gym, meal planning, mental health, job search, looksmaxxing | "Your brand account's job is to be the place the name resolves to", `PLAYBOOK.md` § 3.6; Stronger five handles 60.6% of reach; `@potto.app` #2; `@umax.app` 44,285 followers with no post since 2024-03-04, "a landing page, not a channel", `media/umax/TEARDOWN.md` § 2, § 7; `@ventnowapp` 386 followers, 14 posts, best 17,995; `@jobstep.io` 2,951 followers, 3,271,816 captured views. Roamy has none in six searches and nine of 22 accounts never write the name, `PLAYBOOK.md` § 3.5 |
| owned persona (disposable, sprinted) | mental health, gym, meal planning | Vent Now 14 seeded personas, launched two to four a month, run three to eight weeks, `media/ventnow/TEARDOWN.md` § 2; Stronger `<firstname>.lifts`; Potto 13 micro-accounts |
| owned persona fleet (dripped) | travel | Roamy 16 personas on one handle template, 774 posts, 23,789,793 views, no brand account, `media/roamy/TEARDOWN.md` § 2 |
| distribution page with no product (a "normie") | healthy food, looksmaxxing, dating, cat | `@healthyyinspoo` 7.6M no product; `@the.modern.man` promotes no app; `@datingwithmads` 5.8M no product, `learnings-slideshows.md` § Example accounts; none of the nine scrolled cat posts promotes an app, `learnings-slideshows.md` § 2026-09-12. Salim: "a distribution channel sitting there unclaimed", `learnings-slideshows.md` § Finding Ideas & Vetting Formats |
| ambassador (declared, small) | cat, job search | `@mias.diary7` 338 followers, 30 posts in 10 weeks, verified badge, "whether the early reach was paid or seeded" open, `learnings-slideshows.md` § 2026-09-12; `@lara.jobstep`, `media/jobstep/TEARDOWN.md` § 7 |
| rented creator (audience pre-exists) | mental health, meal planning, travel, looksmaxxing | Vent Now's two rented creators supply over half of all views, "bought reach and must never be averaged with tier 2", `media/ventnow/TEARDOWN.md` § 2; Potto `@demi_does.it` (607,802 followers) 60,861, her worst sponsorship, `PLAYBOOK.md` § 2.6; UMax: only 12.2% of 666.8M views sit on a post that names the app, `FUNDAMENTALS-REVIEW.md` item 1 |
| dedicated carrier (rented, tagged on every post) | looksmaxxing | `@bruceaesthetic` 50 of 50 tagged, account window = campaign window, 24,357,927 views; `@king.psll` 50 of 50, `media/umax/TEARDOWN.md` § 2 |
| part-time carrier / one-off placement | looksmaxxing | 13 part-time carriers; 7 one-off placements, `@biancoacta` one tagged post 5,028,746, `media/umax/TEARDOWN.md` § 2 |
| dump account for commissioned UGC (no persona) | meal planning | Potto tier 2, `media/potto/TEARDOWN.md` § 2; the mechanism stated in Potto's own recruitment ad, "No huge following required ✨ Get paid to create content", 3,134 views, `media/potto/TEARDOWN.md` § 7 |
| paid local creator, disclosed, per market | job search | JobStep 70+ accounts, ten languages, "Anzeige, publi, reklam…", disclosed posts at 1,505,513 and 644.2× median, `PLAYBOOK.md` § 2.7 |
| founder account | photo, screen time | `@nikiivictoria` 1.6M followers; Alejandro's Pushscroll from his own account, `learnings.md` § Account Architecture (video) |
| SEO account (one account, no network) | cooking | Nicholas: one account, about 80 posts over 3 months, 3.8M views over twelve months, Search 99.3%, `learnings-slideshows.md` § Account Architecture, § Format Specs |
| large single theme page | looksmaxxing | `@glowuptrickz` 0 following, 1.6M followers, 47.4M likes, `learnings-slideshows.md` § Account Architecture |

### What a brand handle posts

| Value | Seen in | Evidence |
|---|---|---|
| its own format, different from the personas (two-slide meme) | gym | Stronger's five brand handles post only two-slide memes; 41,840,708 / 16,838,859 / 15,450,366, `PLAYBOOK.md` § 3.4 rule 1, § 5.2 A |
| the give-away-the-data carousel with a store end card | gym | `@strongerapp` 6,945,829: slides 2–5 unbranded strength-standards tables, slide 6 "Get Stronger", "1M+ users", both store badges. Done once in the corpus, `PLAYBOOK.md` § 3.4 rule 4 |
| a republishing hub for a commissioned library, batch-dumped | meal planning | `@potto.app` 15 videos in one day, each a different creator, 3,915,407 views; two batch days = 4.82M of 4.83M lifetime, `PLAYBOOK.md` § 3.4 rule 3 |
| nothing (dormant landing page) | looksmaxxing | `@umax.app` 8 posts, last 2024-03-04, median 463,814 beats 30 of 35 accounts, 44,285 followers, `media/umax/TEARDOWN.md` § 2; `FUNDAMENTALS-REVIEW.md` item 4 |
| celebrity-rating carousels | looksmaxxing | `@umax.app` "RATING CELEBRITIES PART 2 Jordan Barrett" 215,318, "RATING CELEBRITIES USING AI Chico Lachowski" 201,097, `media/umax/TEARDOWN.md` § 2 |
| the search instruction in the bio | meal planning, gym, looksmaxxing | See Layer 2. `PLAYBOOK.md` § 3.4 rule 6 |
| the tappable destination for persona @-mentions | gym, looksmaxxing | Stronger's three persona bios; UMax's caption tag `@Umax App` on 428 posts, `PLAYBOOK.md` § 3.4 rule 5, § 6 mechanic 6 |
| a recruitment ad for creators | meal planning | `@potto.app` 2026-07-30, 3,134 views, `media/potto/TEARDOWN.md` § 7 |
| an explicit-app bio for search (claimed to work) | photo | `@trypovappus`, "you do not need to hide as a normie", 10.3K followers, 1.2M likes, posts 1,687 to 4.1M, `learnings.md` § Account Architecture, § Reference Apps |

### What a brand handle should never post

| Value | Seen in | Evidence |
|---|---|---|
| the persona format | gym, job search, mental health | `@strongerwithlinda` 24,869 lifetime, `PLAYBOOK.md` § 3.5 rule 5; `@jobstep.io` dead last on ER at 0.73%, `media/jobstep/TEARDOWN.md` § 11 rule 9; `@ventnowapp` ~0.4% ER, `media/ventnow/TEARDOWN.md` § 2 |
| the product-demo screen recording | mental health | `@ventnowapp` POV → paste-into-app → analysis-reveal, 6 posts, best 8,737, "the single worst format in the Vent Now portfolio", `PLAYBOOK.md` § 3.5 rule 1 |
| the App Store ranking screenshot | meal planning | `@potto.app` "Top Downloaded / Health & Fitness / 1", 2,258 views, `PLAYBOOK.md` § 3.5 rule 2 |
| the feature explainer | meal planning, travel | `@potto.app` "Choose shop, budget, preferences and get meal plan in 30 seconds" 6,232 against 2,919,594 on the same account; Roamy's numbered explainer ~25 times at 79–811, `PLAYBOOK.md` § 1.9 |
| a ranked list of apps with itself first | gym | "Ranking the best workout apps 1. Stronger 2. Hevy…" 719, `PLAYBOOK.md` § 1.9 |
| variants of its own four creatives, batch-dumped | mental health | `@ventnowapp` six uploads on 2025-07-10, three on 2025-05-27, best 17,995; "Potto was sampling twenty faces and Vent Now was sampling its own opinion", `PLAYBOOK.md` § 3.4 rule 3 |
| its own original sound or a generic ad-music track | mental health | `PLAYBOOK.md` § 3.5 rule 4 says do not ride your own original sound. The live sound field corrects the wording: 11 of `@ventnowapp`'s 14 posts ride `Nhạc quảng cáo` (Vietnamese "advertising music"), one rides `âm thanh gốc - ventnowapp`, `FUNDAMENTALS-REVIEW.md` § 2.7 fact-check. Neither is recognisable to the audience. See Layer 6 |
| the same repeated caption on every post | mental health | `@ventnowapp`: four captions across 14 posts, "the only app that helped me thrive" ×6, "Is your mind racing? Feel less anxious with our app" ×4, `learnings.md` § Reference Accounts |
| nothing at all (no brand account) | travel | Roamy: 7,061,449 views on its biggest account with nowhere to send them, `PLAYBOOK.md` § 3.5 rule 6 |

### What a persona handle never posts

| Value | Seen in | Evidence |
|---|---|---|
| a direct download instruction | mental health, meal planning | "download vent now and type in…" 269; "get the Vent Now app! You won't regret it." 1,565, account killed, `media/ventnow/TEARDOWN.md` § 7; `@madi.spam111` "DOWNLOAD RN!!!!!" 1,121, "run to that app store!!" 267, `media/potto/TEARDOWN.md` § 7 |
| the brand's format | gym | The two Stronger systems never cross: brand handles post only memes, `<firstname>.lifts` handles post only video, `PLAYBOOK.md` § 1.5 |
| a cross-promotion of a sibling persona | mental health, meal planning, travel | "Cross-promotion between sibling personas: Vent Now none, Potto none, Roamy none. Only Stronger does it, and only upward to the brand account.", `PLAYBOOK.md` § 6 |
| the app in a comment reply | cat | `@mias.diary7` "answers every comment in a coach's voice and never names the app in a reply", `learnings-slideshows.md` § 2026-09-12 |
| a comment-keyword gate as the funnel | travel, meal planning | Roamy 81 posts across 8 accounts, persona-fleet comment rate 0.023%; Potto `@willowsfeed` 34 gated posts, comments up ~175×, views per post 51,561 → 347 (confounded), `PLAYBOOK.md` § 1.1 |

## Layer 5 — Scale and cadence

### Handles per app

| Value | Seen in | Evidence |
|---|---|---|
| 1 (SEO account) | cooking | Nicholas, one account, 3.8M views, `learnings-slideshows.md` § Account Architecture |
| 1 (large theme page) | looksmaxxing | `@glowuptrickz` 1.6M followers, `learnings-slideshows.md` § Account Architecture |
| 1 (founder account) | photo | `@nikiivictoria`, `learnings.md` § Account Architecture (video) |
| 2 (two personas, one template) | couples | Groundly `@lindalewiston3` + `@lin444782`, `X-SLIDESHOW-BATCH-2026-09-11.md` § 7 |
| 2–3 | emotional story | Pedro's screenshots show 7.1M + 4M + 3.9M across two or three accounts, `X-SLIDESHOW-BATCH-2026-09-11.md` § 1 |
| 5–8 to start | any | The practical starting number, from Pedro's 8 per device (he runs 6–7) and Salim's 10 per device, `PLAYBOOK.md` § 3.2 (source advice, not a corpus finding, `FUNDAMENTALS-REVIEW.md` item 7) |
| 5–25 (faceless network) | any | Patiri's playbook, `learnings-slideshows.md` § Account Architecture (claimed) |
| 7 | any | `@iamgdsa` 7 accounts, $50K MRR, 10M views; Guillaume's app 7 accounts, `learnings-slideshows.md` § Account Architecture, § Example accounts (claimed) |
| 10 × 2 posts a day | any | Brain "2 posts/day 10 accounts 20 shots at distribution every single day", `X-SLIDESHOW-BATCH-2026-09-11.md` § 3 (claimed) |
| 12 AI personas | any | Ethan Nguyen quotes one operator at "$22/month to run 12 AI slideshow personas posting daily", `learnings-slideshows.md` § Account Architecture (second-hand, claimed) |
| 16–17 (personas + rented + brand) | mental health, travel, meal planning | Vent Now 14 personas + 2 rented + 1 brand, `media/ventnow/TEARDOWN.md` § 2; Roamy 16 personas; Potto 16 scraped, 23+ found, `PLAYBOOK.md` § 3.2 |
| 16 owned (5 brand + 11 persona) | gym | Stronger, `media/stronger/TEARDOWN.md` § 2 |
| 18 | people search | truthseek 18 accounts, 30+ videos a day per account, `learnings.md` § Account Architecture (video, claimed) |
| 25+ | couples | cray cray 25+ faceless accounts, 130M views in 14 months, `learnings-slideshows.md` § Format Specs (claimed) |
| 35 rented | looksmaxxing | UMax 35 accounts with data, 25 tagging, `media/umax/TEARDOWN.md` § 2 |
| 70+ paid, ten languages | job search | JobStep, $2M ARR in 8 months, `PLAYBOOK.md` § 3.1 E |
| "dozens" | mental health | Vent Now per Salim, `learnings-slideshows.md` § Account Architecture (claimed; we found 17) |

The count is a function of production cost per post, not of ambition: Roamy one reused photo + one screen recording → 16; Potto one commissioned video → 23+; JobStep one paid creator video per market → 70+, `PLAYBOOK.md` § 3.2.

### Posts per day per handle

| Value | Seen in | Evidence |
|---|---|---|
| 0.05–0.15 (maintained brand asset, years) | gym | `@strongermobile` 996 days at 0.05/day, 2,433 videos on the profile; `@stronger_gymapp` 0.15/day, `PLAYBOOK.md` § 2.8 |
| 0.3–0.4 (persona fleet, drip) | travel, gym | Roamy persona median 0.37/day; `@kailyn.lifts` 0.31, `@kass.lifts` 0.42, `media/roamy/TEARDOWN.md` § 3, `media/stronger/TEARDOWN.md` § 3 |
| about 0.4, one a day later | cat | `@mias.diary7` 30 posts in 10 weeks; "about one a day" from Aug 5 to Sep 10, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 10 |
| 1.0–2.0 (disposable persona, sprint) | mental health, meal planning, gym | `@cat.naur` 50 in 33 days; `@prezloves` 50 in 23; Potto `@chaos.with.katie8` 50 in 26, median window 21 days; `@annab.lifts` 35 in 20 days, `PLAYBOOK.md` § 2.8 |
| 1–3 (claimed) | any | Patiri 1–3 per day per account, `learnings-slideshows.md` § Account Architecture |
| 2 (claimed) | any | Brain 10 accounts × 2, `X-SLIDESHOW-BATCH-2026-09-11.md` § 3 |
| 2–4 while warming up, then 3–4 (claimed) | gym | Lino "This is a volume game", `learnings-slideshows.md` § Account Architecture |
| 1 a day for at least 3 months (SEO, claimed) | cooking | Nicholas, `learnings-slideshows.md` § Account Architecture |
| 2–8 (rented creator's own cadence) | looksmaxxing | `@trevythetrex` 8.17/day, `@skeria7` 6.71, `@mika_appeal` 4.70, `media/umax/TEARDOWN.md` § 3; `FUNDAMENTALS-REVIEW.md` item 55 |
| 30+ (recycled clips, claimed) | people search | truthseek, one account 725 videos in a week, `learnings.md` § Account Architecture |
| batch dump: 10–15 in one day on the brand handle | meal planning, gym | `@potto.app` 15 in one day → 3,915,407; `@strongerapp` five posts in two days, seven near-million posts in nine days, `PLAYBOOK.md` § 7.3 |

The fastest persona accounts are the shortest-lived: Roamy's four accounts above 0.9/day lived 25–48 days, `media/roamy/TEARDOWN.md` § 3. Sixteen firings of one line down one feed produced nothing above 51K, `PLAYBOOK.md` § 7.5.

### Launch shape

| Value | Seen in | Evidence |
|---|---|---|
| drip, two to four new handles a month | mental health, meal planning | Vent Now for eight months, `media/ventnow/TEARDOWN.md` § 3; Potto five in June, four in July, three in August, `media/potto/TEARDOWN.md` § 3 |
| wave, five handles inside ten days | gym | Stronger `@kailyn.lifts` 03-25 → `@faithlifts1` 04-03, then a July wave and one in August, `media/stronger/TEARDOWN.md` § 3. Both shapes produced multi-million-view accounts; the drip is safer, `PLAYBOOK.md` § 3.2 |
| 24–48 hours between account creations (claimed) | any | Pedro "DO NOT create multiple TikTok accounts on the same day", `learnings.md` § Account Architecture |
| a ramp of rented placements | looksmaxxing | UMax twenty accounts begin tagging between 2026-06-08 and 2026-08-29, `media/umax/TEARDOWN.md` § 3 |
| a steady stream of new paid creators | job search | JobStep three new accounts under five weeks old at the teardown date, `media/jobstep/TEARDOWN.md` § 3 |

### Kill rule and lifecycle

| Value | Seen in | Evidence |
|---|---|---|
| post daily for a month; nothing above ~100K → kill, start another | mental health | Every killed Vent Now account topped out under 112K; every survivor broke 150K or is new; "the only clean kill rule in the corpus", `PLAYBOOK.md` § 2.8 |
| 0 views across 7–8 posts → move on (claimed) | any | Pedro, `learnings.md` § Account Architecture |
| below 3K kill the format; above 10–15K replicate (claimed) | any | Pedro's per-format thresholds, `learnings-slideshows.md` § Finding Ideas & Vetting Formats |
| accounts end on a contract, not a threshold | job search | `@sina.realfakephotos` 870,493 best, `@noahdiesdas` 866,860, `@lara.jobstep` 482,511, all dead; "paid campaign cycles ending on a budget/contract schedule", `media/jobstep/TEARDOWN.md` § 3 |
| placements end, accounts continue | looksmaxxing | `@bruceaesthetic` stops on 2026-08-15 after a 68-day, 50-post, 24.4M-view run, `media/umax/TEARDOWN.md` § 3; `FUNDAMENTALS-REVIEW.md` item 56 |
| winners killed, losers kept | gym | `@sophia.liftss` 5,850,351 and stopped; `@liftswithcait` 79,435 still posting, `PLAYBOOK.md` § 2.8 |
| retired on a product rename | travel | `@chiara.roamy` killed after a 1.1M hit; persona views per post 67,612 before the Roamy→Rhyme switch, 6,364 after, `media/roamy/TEARDOWN.md` § 3 |
| no rule legible (too young) | meal planning | Potto accounts die at 8 days and 68 days, at 500 views and 750K, `media/potto/TEARDOWN.md` § 3 |
| a 2–3 month novelty window per format (claimed) | any | `PLAYBOOK.md` § 8 Day 30–90, from skyirezumi |
| expect roughly one hit in five accounts | mental health | `PLAYBOOK.md` § 8 Day 1–30 |

### When to spin a new handle

| Value | Seen in | Evidence |
|---|---|---|
| after a kill | mental health | Vent Now: "stop and start another account", `media/ventnow/TEARDOWN.md` § 3 |
| to re-validate a hit on two fresh accounts ("format maxxing") | looksmaxxing | Salim; proofs `@jacosahur` at 304 followers, `@mognutrition` at 90, `learnings-slideshows.md` § Finding Ideas & Vetting Formats (claimed) |
| to fire the same hook again (spread across handles, not down one feed) | gym, meal planning | `PLAYBOOK.md` § 7.5 |
| to copy a proven format into a new niche | gym | `@gym1495`, one month old, copied the template 7 days later per Salim, `X-SLIDESHOW-BATCH-2026-09-11.md` § 4, § 5 |
| to add a niche for SEO ("several accounts, different niches, same system") | cooking | Nicholas, `learnings-slideshows.md` § Account Architecture (claimed) |
| to enter a new language market | job search, couples, emotional story | JobStep per market; cray cray's best account is French `@questionsprofondes1`; Pedro's Spanish replica 2.0M beat his 1.2M original, `learnings-slideshows.md` § Account Architecture, § Format Specs |
| a duplicate handle on the same script, two days apart, does not help | mental health | The Kait pair 269 and 313, `media/ventnow/TEARDOWN.md` § 10 |

## Layer 6 — Sound at the account level

`SLIDESHOW-ANATOMY.md` Layer 5 holds the per-post sound values. This layer holds the policy an account keeps across posts.

### Sound policy

| Value | Seen in | Evidence |
|---|---|---|
| one licensed track on every post | looksmaxxing | `@bruceaesthetic` "EEYUH! x Fluxxwave - Super Slowed" on 49 of 50 posts, 24,171,408 views, 24.4M in 68 days on a brand-new account; no other account in the network used it once. Rule: "Commit an account to one sound if you commit it to one format.", `media/umax/TEARDOWN.md` § 10, § 11; `FUNDAMENTALS-REVIEW.md` item 50 |
| the poster's own original sound on most posts | travel, meal planning, job search | Roamy 78.5% of posts; Potto 367 of 427; corpus-wide 4,250 original against 1,187 licensed, JobStep 90.0% original, `PLAYBOOK.md` § 7.1; `FUNDAMENTALS-REVIEW.md` item 49. No signal either way: the same sound carries 13,160,469 and 303, `media/stronger/TEARDOWN.md` § 10 |
| a sound matched to the format (meme clip for jokes, soft track for tips) | cat | Both 2M+ joke posts ride an uploaded meme clip; five of nine tip posts ride a library track; the two posts with the same hook and different sounds did 3.6M and 2.5M, `learnings-slideshows.md` § 2026-09-12, "Sound" |
| match the emotion, never a trending sound that contradicts the story (claimed) | emotional story, abs | Pedro both notification posts on "Love In The Dark"; Lino "The Sound has more of a impact than you think", `learnings-slideshows.md` § Format Portfolio |
| copy what the winning slideshow accounts in the niche use now (claimed) | abs | Lino, `learnings-slideshows.md` § Format Portfolio |
| the brand's own original sound | mental health | `PLAYBOOK.md` § 3.5 rule 4: do not. Live count: one of `@ventnowapp`'s 14 posts rides `âm thanh gốc - ventnowapp`; eleven ride a generic Vietnamese ad-music track, `Nhạc quảng cáo`; the account is the worst in its network, `FUNDAMENTALS-REVIEW.md` § 2.7 fact-check |
| a shared sound across sibling handles (a coordination fingerprint) | gym, meal planning | `original sound - spazmanian` on `@strongermobile` (13), `@stronger_gymapp` (2), `@strongerus` (2), `@lift.with.dana` (1), `media/stronger/TEARDOWN.md` § 2; Potto song id `7638674261947370000` on three "unconnected" accounts, `media/potto/TEARDOWN.md` § 2 |
| "Promoted Music" credit (paid boosting visible in the sound field) | job search | `@jobstep.io` January 2026 posts, `media/jobstep/TEARDOWN.md` § 4; `FUNDAMENTALS-REVIEW.md` item 53 |
| mixed per post, no policy | cat | `@mias.diary7`: "original sound - meaningful_english", "Night Changes", "Lover" on three posts, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § The table |

A trap, recorded so nobody chases it: `âm thanh gốc` and `som original` prefixes on English content are a scrape-locale artifact, not an operator fingerprint, `PLAYBOOK.md` § 2.10.

## Layer 7 — Set-up and environment

Almost every value here is claimed. The corpus does not see devices, regions or warm-up.

### Account creation

| Value | Seen in | Evidence |
|---|---|---|
| email, not phone number; Outlook, not Gmail (claimed) | any | Pedro "Gmail tends to become restrictive when you're creating several accounts", `learnings.md` § Account Architecture |
| up to 8 accounts on one device, runs 6–7 (claimed) | any | Pedro, with a screenshot of his account switcher, `learnings.md` § Account Architecture |
| up to 10 per device (claimed) | any | Salim, `learnings-slideshows.md` § Account Architecture. Disagreement, untested; "Pedro's number is the safer one", `learnings-slideshows.md` § Open disagreements |
| borrow aged native accounts through Discord (claimed) | any | Salim: pay "$100 at 100k views · $350 at 1M views · capped around $500 if it hits 2M", "DM 100+ a day"; rejects VPNs as "too fragile, too much babysitting", `learnings-slideshows.md` § Account Architecture, § Working with Creators |
| aged or warmed accounts as the bottleneck (claimed) | any | Laur "distribute across aged accounts via a TikTok factory"; @MilesFeldstein "Only bottle neck is having enough warmed accounts", `X-SLIDESHOW-BATCH-2026-09-11.md` § 2 |
| accounts are a sellable asset | garden | The AI garden design app was listed for sale with its TikTok accounts, `learnings-slideshows.md` § Account Architecture (a sale listing) |

### Warm-up

| Value | Seen in | Evidence |
|---|---|---|
| create 2–3 days before the first post; scroll 15–20 minutes before posting (claimed) | any | Pedro, "not mandatory", `learnings.md` § Account Architecture |
| a few weeks at 2–4 posts a day (claimed) | gym | Lino, `learnings-slideshows.md` § Account Architecture |
| zero views on the first 2–3 posts is not a verdict (claimed) | any | Pedro, `learnings.md` § Account Architecture |
| rushed reaction content is useful only to warm an account (claimed) | screen time | Alejandro Sanchez, `learnings.md` § Format Portfolio. `PLAYBOOK.md` § 5.4 rejects his wider claim |
| warm the research account too (claimed) | cooking | Nicholas: TikTok suggests keywords only to an active account, `learnings-slideshows.md` § Account Architecture |
| train a research feed on a burner, 20–30 minutes (claimed) | any | Pedro, `learnings.md` § Finding Ideas & Vetting Formats |

### Device and region

| Value | Seen in | Evidence |
|---|---|---|
| factory-reset phone, no SIM, US location, English, NordVPN to New York kept on (claimed) | any | Pedro's US-targeting list, `learnings.md` § Account Architecture. Salim disagrees; untested by us |
| no VPN, borrowed native accounts (claimed) | any | Salim, `learnings-slideshows.md` § Open disagreements |
| TikTok short links do not resolve from an Indian IP | cat | `tiktok.com/t/` links redirect to `tiktok.com/in/about`; `unshorten.me` resolves them, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § Method and cost |

### Language and market

| Value | Seen in | Evidence |
|---|---|---|
| non-English accounts first (claimed) | couples, emotional story | Patiri "french, spanish, portuguese accounts consistently outperform english-only"; cray cray's best account is French, 6M views a month, `learnings-slideshows.md` § Account Architecture; Pedro's Spanish replica 2.0M against 1.2M, `learnings-slideshows.md` § Format Specs |
| one handle per language market, paid, disclosed | job search | JobStep ten languages, `media/jobstep/TEARDOWN.md` § 2 |
| the German fleet runs the identical template | travel | `@josi.travelplanning` 4,450,213, "Wieso finde ich DAS erst JETZT???", `PLAYBOOK.md` § 4 Job 1 |
| a multi-market rented network with no per-market brand account | looksmaxxing | Portuguese, French, Swedish, German, Belgian, Norwegian creators under one brand tag, `media/umax/TEARDOWN.md` § 9 |
| a Filipino audience on an English cat haul | cat | `@lukaandmeowmy_marie`, Tagalog comments, `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 5. Thin: one post |

### Follower count as a target

| Value | Seen in | Evidence |
|---|---|---|
| not a goal; reach comes from the format | dating, couples, cat, mental health, gym, travel | `@mei.dates` 1,191 followers, posts above 500K; `@lindalewiston3` 376, 149.6K; `@mognutrition` 90, 422.4K, `learnings-slideshows.md` § What the evidence says together; `@mias.diary7` 338, 151K; Vent Now personas "several have under a hundred and clear a million views", `media/ventnow/TEARDOWN.md` § 2; `@kailyn.lifts` 2,010 followers, 13,160,469; `@keeks.traveltips` 14 followers |
| a large single page as the exception | looksmaxxing | `@glowuptrickz` 1.6M followers, `learnings-slideshows.md` § Account Architecture |
| the brand profile keeps followers without posting | looksmaxxing | `@umax.app` 44,285 followers, no post since 2024-03-04, `media/umax/TEARDOWN.md` § 7 |

---

## Niche-agnostic and niche-specific

The parameters and the layers are the same for any niche. Only some values change with the niche.

**Niche-agnostic values, as far as the evidence goes.** The `<firstname>.<niche>` handle (travel, gym, job search, dating). The anonymous throwaway (mental health, meal planning). Brand-in-handle wins with its own format and loses with the persona format (gym, meal planning, travel, mental health, job search). The search-instruction bio (meal planning, gym, looksmaxxing). The @-mention of the brand (gym, looksmaxxing). One format per account (six niches). The three cadence bands (sprint 1–2/day, drip 0.3–0.4/day, brand 0.05–0.15/day) across mental health, travel, gym and meal planning. Reposting the same line on a later account re-rolls (gym, meal planning). Follower count is not a goal (six niches).

**Niche-specific values.** The persona subject: a cat account uses its own cat; a dating account uses an invented woman or a stock couple; a health account uses a mascot. The bio's role line ("Relationship coach", "crazy cat lady"). The rented-creator model (looksmaxxing, where creators already own the vocabulary).

**Seen in one niche only.** The one-licensed-track sound policy (`@bruceaesthetic`, looksmaxxing). The ambassador handle (job search). The dormant brand landing page (looksmaxxing). The contract-based lifecycle (job search). The recruitment ad on the brand handle (meal planning). The give-away-the-data carousel on the brand handle (gym). The pet-name handle (cat). They stay unproven elsewhere until another niche shows them.

## Outcome columns

| Column | Definition | Why |
|---|---|---|
| best post | the account's highest view count | the lottery ticket that paid, `PLAYBOOK.md` § 1.6 |
| median post | the median view count across the window | the baseline; "knowing your median" (@benou_irl), `learnings-slideshows.md` § Open disagreements |
| ×median | best ÷ median | SGE's outlier metric, the right one, `PLAYBOOK.md` § 2.4 |
| total views | sum across the window | reach; always a floor under the 50-post cap, `PLAYBOOK.md` § 9.5 |
| days alive | first to last post | the lifecycle; read the campaign window, not the account window, on rented handles, `media/umax/TEARDOWN.md` § 3 |
| saves/view, shares/view | as in `SLIDESHOW-ANATOMY.md` | the metric a tip slideshow earns |
| not ER | — | ER runs inverse to reach in seeded networks, `PLAYBOOK.md` § 2.4; it holds in rented ones, `FUNDAMENTALS-REVIEW.md` § 2.8 |
| not comments | — | dead in every network, `PLAYBOOK.md` § 1.1 |

## Account table

One row per comparable handle this project has reviewed at the account level. One column per parameter. Blank = the evidence does not say. Followers and best post are as read from the source on the date it was read.

| Handle | App | Niche | Handle pattern | Bio content | Bio link | Persona fidelity | Format lock | Tier | Posts/day | Sound policy | Followers | Best post | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| @mei.dates | Coffee Meets Bagel | dating | `<firstname>.<niche>` | one app word | none | one invented person, no face | one (persona story) | owned persona | | | 1,195 | 582.1K | `X-SLIDESHOW-BATCH-2026-09-11.md` § 6 |
| @testo.cat | Thrive | health | mascot name | mascot line | linktree | one mascot | one (listicle) | owned persona (mascot) | | | 8,886 | 437.2K | same |
| @lindalewiston3 | Groundly | couples | `<firstname>` + surname-like | role line | none | same two AI faces | one (stock-photo listicle) | owned persona | | | 408 | 150.2K | same |
| @lin444782 | Groundly | couples | anonymous throwaway | advice line | none | same two AI faces | one (Linda's template) | owned persona | | | 612 | 366.9K | `X-SLIDESHOW-BATCH-2026-09-11.md` § 7 |
| @the.modern.man | none | looksmaxxing | theme page | mission line | Instagram | editorial card, B&W portrait | one (red-keyword editorial) | distribution page | | | 5,607 | 458.1K | `X-SLIDESHOW-BATCH-2026-09-11.md` § 5, § 6 |
| @gym1495 | none | gym | theme page | "DM for your lifetime transformation." | none | cartoon avatar, AI figures | switched to the editorial template | distribution page | | | 3,769 | 113.5K | `X-SLIDESHOW-BATCH-2026-09-11.md` § 5 |
| @thatgymguy16 | AbMaxx | gym | theme page | "Collecting gym rats 0/1000…" | none | | one (Lino's template) | owned theme page | | | 43 | 284 likes, 1 post | `JOURNAL.md` 2026-09-11 |
| @glowuptrickz | Bloat Down | looksmaxxing | theme page | | App Store (claimed) | infographic, no face | one (medical infographic) | large single page | | | 1.6M | — | `learnings-slideshows.md` § Example accounts |
| @easy_cooking_ideas | Crumb (probable) | cooking | theme page | | | Canva + AI images | one (keyword SEO) | SEO account | 1/day for 3 months (claimed) | | | 16.3K likes | `HANDOFF.md` |
| @datingwithmads | none | dating | `<niche>with<name>` | | | selfie + chat screenshot | | distribution page | | "original sound - throwbackhits_2" | | 5.8M | `learnings-slideshows.md` § Format Specs |
| @mias.diary7 | PawSolids | cat | `<firstname>.diary` | ambassador declaration | | different cats, own face once | one (tips) | ambassador | ~0.4, later ~1 | mixed | 338 | 151K | `SCROLLED-SLIDESHOW-BATCH-2026-09-12.md` § 10 |
| @pelinclh | none | cat | person name | "crazy cat lady" | | one cat, own face once | | pet account | | meme clip uploaded | | 3.59M | same, § 1 |
| @tommy_purrs | none | cat | pet name | kitten line | | one kitten | | pet account | | meme clip uploaded | | 2.52M | same, § 2 |
| @mochiandcheddar1 | none | cat | pet names | "🛠️ DIY cat toys / 🐱Orange cat vibes" | | two cats, own face once | one (enrichment list) | pet account | | library track | | 1.20M | same, § 3, § 7 |
| @meow_meowcatss | none | cat | theme page | "Cat care tips every day…" | | designed card, watermark | one (editorial card) | distribution page | | library track | | 760K | same, § 4 |
| @chuchutama | Amazon affiliate | cat | pet name | one cat's profile | Amazon links | one cat, flat-lay cards | | pet account (affiliate) | | library track | | 182K | same, § 8 |
| @quanying.pet.leo | litter supplier | cat | `<company>.pet.<name>` | "From Factory To Your Brand 🏭" | | AI illustration | | B2B supplier | | uploaded audio | | 157K | same, § 9 |
| @sydneysynced | Vent Now | self-improvement | `<firstname>` + word | soft self-help line | none | one young woman's photos | one (soft-life list) | owned persona | | | 14.3K | 4.8M | `learnings-slideshows.md` § Example accounts |
| @selfbysarah / @heather.xoxo | Vent Now | relationships | `<firstname>` persona | soft self-help line | none | couples photography | one (advice list) | owned persona | | | 16.5K / 21.2K | 7.9M / 7.5M | same |
| @ava.isventing | Vent Now | mental health | name + topic tag | "No bio yet." | none | one reused still; later stock couples | one, then switched | owned persona | | | | 1,260,995 | `media/ventnow/TEARDOWN.md` § 2, § 10 |
| @cat.naur | Vent Now | mental health | anonymous throwaway | none | none | one persona, one topic | one (story → aphorism) | owned persona | 1.5 (50 in 33 days) | | | 1,758,965 | same, § 3 |
| @ventnowapp | Vent Now | mental health | brand handle | explicit product bio | ventnow.ai | product on screen | four creatives | brand handle | batch-dumped variants | 11/14 ad-music track | 386 | 17,995 | `learnings.md` § Reference Accounts; `FUNDAMENTALS-REVIEW.md` § 2.7 |
| @strongermobile | Stronger | gym | brand handle | social proof + "download below" | implied | phone-shot gym photos | one (two-slide meme) | brand handle | 0.05 | shared `spazmanian` sound | 76,655 | 41,840,708 | `media/stronger/TEARDOWN.md` § 2, § 3 |
| @stronger_gymapp | Stronger | gym | brand handle | "'Stronger' on iOS and Android 💪" | | | one (two-slide meme) | brand handle | 0.15 | | 36,454 | 16,838,859 | same |
| @strongerapp | Stronger | gym | brand handle | search instruction | | | memes + one data carousel | brand handle | 0.06 | | 4,618 | 6,945,829 | same |
| @strongerwithlinda | Stronger | gym | brand + persona format | "Gym diaries for the girls 💗🧸💌" | | | persona video | brand handle running the persona format | 1.04 | | 47 | 4,859 | same |
| @kass.lifts | Stronger | gym | `<firstname>.<niche>` | @-mention of the brand | | | one (face → screen recording); not deep-dived | owned persona | 0.42 | | 915 | 12,108,887 | same |
| @bruceaesthetic | UMax | looksmaxxing | name + maxxing suffix | "Receba sua avaliação com o UMAX APP ⤵️" | arrow to a link slot | one blurred frame, recoloured | one (question + tag) | dedicated carrier (rented) | 50 in 68 days | one licensed track ×49 | 210,936 | 5,823,039 | `media/umax/TEARDOWN.md` § 2, § 10 |
| @umax.app | UMax | looksmaxxing | brand handle | product line + search instruction | 👇 to a link slot | | celebrity ratings | brand handle (dormant) | 0 since 2024-03-04 | | 44,285 | 1,228,760 | same, § 2 |
| @potto.app | Potto | meal planning | brand handle | search instruction | | a different face every post | one script, republished | brand handle (republishing hub) | 15 in one day | | 997 | 2,919,594 | `media/potto/TEARDOWN.md` § 2, § 10 |
| @madi.spam111 | Potto | meal planning | anonymous throwaway | "using potto to take the stress away from cooking✨" | | | one (face → screen recording) | dump account or paid, unresolved | 1.6 (50 in 31 days) | shared obscure song id | 2,419 | 29,233,020 | same, § 2, § 12 |
| @josi.travelplanning | Roamy | travel | `<firstname>.<niche>` | persona flavour | none | reaction face + screen recording | one (departure panic) | owned persona (fleet) | 0.39 | fleet: 78.5% own original sound | 3,384 | 4,450,213 | `media/roamy/TEARDOWN.md` § 3 |
| @chiara.roamy | Roamy | travel | brand in the handle | "No bio yet" | none | | one | owned persona | 0.70 | | 996 | 1,147,930 | same, § 2 |
| @jobstep.io | JobStep | job search | brand handle | | | | the creators' formats, two languages | brand handle | | "Promoted Music" credit | 2,951 | 1,055,657 | `media/jobstep/TEARDOWN.md` § 2, § 4 |
| @lara.jobstep | JobStep | job search | ambassador in the handle | ambassador declaration | typed URL | | | ambassador (paid) | | | | 482,511 | same, § 3, § 7 |
| @elizacv25 | JobStep | job search | `<name>cv<year>` | | | one real creator | | paid local creator, disclosed | | | | 1,031,120 (644.2× median) | `PLAYBOOK.md` § 2.7 |
| Pedro's crying-woman account (handle redacted) | unnamed | emotional story | | "The app I use… on App Store" | | one AI character, same face | one (3-slide notification) | owned persona | | "Love In The Dark" | | 2M on the grid; 7.1M/week | `X-SLIDESHOW-BATCH-2026-09-11.md` § 1 |
| @trypovappus | POV App | photo | brand handle | explicit product bio | none | | | brand handle (SEO) | | | 10.3K | 4.1M | `learnings.md` § Account Architecture |
| @nikiivictoria | photogenik | photo | founder's name | founder bio + email + short link | go.photogenik.app | one real founder | playlists per use case | founder account | | | 1.6M | — | same |

## How to run an experiment

1. Pick one parameter from one layer above.
2. Hold every other account-level parameter at its best-seen value from the tables. For a cat tip account, the best-seen row for saves is a pet account with one real cat, a persona-flavour bio, no link, one format, one library track per post (post 8 in `SLIDESHOW-ANATOMY.md`). For an app account in that niche, the only row is `@mias.diary7`, and it under-earns on saves.
3. Hold every post-level parameter at its best-seen value from `SLIDESHOW-ANATOMY.md`. An account-level experiment never changes a post-level parameter in the same run.
4. Spin a fresh handle for each arm. Do not run two arms down one feed: reach comes early and does not repeat, and the same line on a later handle re-rolls (Layer 3, Format change inside an account).
5. Post at the cadence of the tier you chose (Layer 5). After thirty days, add one row per handle to the account table with the outcome columns filled.
6. Compare the rows that differ only in that parameter. Judge on best post, median and ×median, not on ER and not on comments.
7. Apply the day-30 rule: nothing above ~100K, kill the handle and start another (Layer 5, Kill rule). Expect one hit in five.
8. Repeat with the next parameter. Never change two parameters in one handle.

## Open questions

Account-level things no source answers.

- **Does the persona have to be one subject?** `@mias.diary7` mixes cats and still got 151K; Potto's dump accounts mix faces and got 748,886. No source compares a one-subject account with a mixed-subject account on the same format. The low saves on `@mias.diary7` are attributed to the content, not the subject.
- **Does the brand-handle rule hold for slideshows?** Every brand-handle finding (Stronger, Potto, Vent Now, JobStep, UMax) is corpus video or Stronger memes. No slideshow-first app we opened runs a brand handle beside its personas. `@testo.cat`, `@mei.dates`, `@lindalewiston3` have no visible brand account; Thrive's, Coffee Meets Bagel's and Groundly's own handles were not searched.
- **Whether `@mias.diary7`'s early reach was paid or seeded.** A verified badge on a 338-follower account; three hits in 17 days and none after, `learnings-slideshows.md` § 2026-09-12.
- **Whether the bio carries a link button.** `posts.json` has no bio-link field. Every "no link" value above is "no URL in the bio text". `@strongermobile`'s "Download for free below" and nine UMax bios with 👇 point at a slot nobody has seen, `PLAYBOOK.md` § 9.1.
- **Pinned comments.** Zero read in 5,455 posts. A pinned comment carrying the app would change the bio and caption findings, `PLAYBOOK.md` § 9.1.
- **Accounts per device, VPN or borrowed accounts, warm-up.** Pedro against Salim on all three; every value in Layer 7 is claimed and untested by us.
- **Whether the fastest cadence causes the shortest life, or the operator chose both.** Roamy's four fastest accounts are its four shortest-lived; no source separates the two.
- **Why winners are switched off.** Stronger stopped accounts at 5.85M, 2.79M and 2.14M; JobStep's dead accounts had 480K–870K hits. Rented terms, operator churn, or something else, `media/stronger/TEARDOWN.md` § 12.
- **Who runs the accounts.** Staff, freelancers, agencies or affiliates: unknown in all six networks. Potto's recruitment ad is the only hard evidence, `PLAYBOOK.md` § 9.6.
- **Whether a persona handle should @-mention the brand on a slideshow account.** Stronger's three bios do it for 22.4M video views; no slideshow persona we opened does it.
- **Whether the one-sound policy transfers.** `@bruceaesthetic` is one account in one niche on video. No slideshow account commits to one track.
- **The novelty window per account.** "Two to three months" comes from one source; `@mias.diary7` went quiet after 17 days; Roamy peaked in one month. No measured window on a slideshow account.
- **Whether the Vent Now 2025 slideshow personas (`@sydneysynced`, `@selfbysarah`, `@heather.xoxo`, `@isabeqiwzzy`) share the 2026 architecture.** Never scraped; the unrun sound-page scrape is the only route, `media/ventnow/TEARDOWN.md` § 12.
- **What a slideshow brand handle should post.** The give-away-the-data carousel exists once, on video-era Stronger. No slideshow-first brand handle has been observed posting anything.
- **Reach to revenue at the account level.** Only Vent Now, Potto, Rhyme and UMax have App Store reads; none is per account, `FUNDAMENTALS-REVIEW.md` § 1.3. Thrive "isn't making money tho lol", `learnings-slideshows.md` § What the evidence says together.
