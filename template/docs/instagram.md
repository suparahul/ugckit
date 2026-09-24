# Instagram: the second platform

Since 0.4.0 an identity can repost its slideshows on Instagram. The research, the
formats and the plan stay TikTok's; Instagram gets the same deck, sent in the same call
and at the same time as TikTok, through the same posting service (Post Bridge). Since
0.4.1 the niche search can read Instagram too (below).

## Add Instagram to an identity

1. **The account.** Create it in the Instagram app and make it a **professional
   account** (Business or Creator: Settings → Account type and tools). Post Bridge
   publishes only to a professional account; a Facebook Page is not needed. The name may
   differ from the TikTok one (`@hannah.catmom_` when `@hannah.catmom` is taken).
2. **The table.** The `handles` skill, step 1, writes it in the identity's `HANDLE.md`,
   right after the head lines. TikTok stays the primary account (`Handle:` and
   `Platform:` still name it):

       ## Accounts

       | Platform | Account | Created | Role | Status |
       |---|---|---|---|---|
       | tiktok | @hannah.catmom | 2026-09-14 | primary | connected |
       | instagram | @hannah.catmom_ | 2026-09-22 | repost | not connected |

   No table means one TikTok account: every `HANDLE.md` written before 0.4.0. The Status
   cell is for the eye; the truth is `production/posting-accounts.json`.
3. **The connection.** In Post Bridge: Accounts → Connect → Instagram, log in with
   Instagram's own login. Each connected account uses one account of the Post Bridge
   plan. Then `node scripts/posting-accounts.mjs <slug>`: an account matches only when
   its platform and its username are the ones the table declares.

From the next send, every post of that identity goes to both platforms.

## What differs on Instagram

| | TikTok | Instagram |
|---|---|---|
| Mode | draft (the phone publishes) or direct | always direct: Instagram has no draft |
| Time | the slot | the same instant as TikTok. A draft slot: send at the slot time, because Instagram publishes the moment the send runs |
| Slides | PNG at the deck's shape (3:4 or 9:16) | JPEG at 4:5, 1080 × 1350, in `final/instagram/`: a 3:4 slide loses 45 px at the top and the bottom; a 9:16 slide is fitted whole on a blurred copy of itself |
| Cover text | typed by hand (draft) or burned (direct) | always burned |
| Caption | the caption and the five tags | the same caption, tags included; no first comment |
| Music | picked on the phone (draft) or by TikTok (direct) | none. Once the post is live, add it in the Instagram app: Edit, then Replace Audio |
| Slides at most | no limit the kit sets | **10** (the API's carousel limit; the app takes 20, the API does not). A handle on both platforms plans every deck at 10 or fewer; a deck over 10 is not sent |
| The link and the numbers | Monid (a draft) or Post Bridge | Post Bridge, no Monid call |
| Saves | Monid | **not reported**: Post Bridge has no save field, and the public scrapers cannot see a save count |

## Hold Instagram back

- For one post: the post page's control, or a `leg.drop` line (`leg.add` undoes it).
- For one row of the plan: the last column `Platforms` (`tiktok`).
- For the whole week: the plan's head line `Platforms: tiktok`.

## When a leg fails

The sync writes `posting.failed` once, with Instagram's own words, and the post page names
it; the TikTok leg is not touched. The retry, after a yes:

    node scripts/posting-send.mjs <slug> --post <key> --only instagram --send

An account that needs a reconnect: reconnect it in Post Bridge, then run
`posting-accounts.mjs` again.

## Instagram in the niche

An optional step of the niche search: before the run, the `niche-search` skill asks
whether you also want Instagram niche research along with TikTok, and says the cost. A
yes runs `DOORS=photo,general,instagram scripts/niche-search.sh <slug> cattips catmom`,
which adds a third door: TikHub `fetch_hashtag_posts`, `top` and `recent`, $0.003 a page
($0.03 a keyword at five pages of two feeds), into
`apps/<slug>/niche/instagram/searches/hashtag.<tag>.<feed>.p<N>.json`. The covers go to
`instagram/covers/<id>.jpg`, fetched at once: `thumbnail_url` is signed and expires within
days. A no leaves TikTok alone, as before. `scripts/niche-import.sh <slug>` fetches any cover still missing and rebuilds the
page, at no cost.

On the niche page a platform switch shows both, TikTok or Instagram, and a handle links
to its own platform. Every tile opens a detail page, `/app/<slug>/niche/post/<platform>/<id>`:
the Atlas post page with the niche post in it, a dash for a count Instagram does not report,
and a link out to instagram.com. A post carries `platform: "instagram"` and its shortcode (`code`;
the post is `instagram.com/p/<code>/`, a reel `/reel/<code>/`). Instagram reports no
saves and no shares (null, not 0), no views on a photo or a carousel, and no likes when
the author hides them. So its winners are its own: a reel at 50,000 views or more and
likes per view at the median of the Instagram reels over 50,000 views; a photo or a
carousel at 50,000 × that median in likes (1,647 on CatWise's first search); hidden likes
never win on likes. A post also wins on shares, by the same two rules with shares in place
of likes, whenever the pages report shares (`share_count` or `reshare_count`). The hashtag
pages of 2026-09-24 report no shares on any of the 397 posts, so today the share bar is
empty and only likes win. The views floor holds a photo or a carousel to the same
likes-for-views rate.

## Sources

- Post Bridge's API reference, https://api.post-bridge.com/openapi.json: the Instagram
  settings (`caption`, `media`, `first_comment`, `placement`, …) have no draft field;
  `is_draft` only holds a post in Post Bridge; "instagram — 1–10 image/video (carousel)".
- Meta, content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
  ("Carousels are limited to 10 images, videos, or a mix of the two"; professional
  accounts; 100 API-published posts per 24 hours).
- Meta, IG User Media: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
  (images 4:5 to 1.91:1, JPEG, 8 MB at most).
