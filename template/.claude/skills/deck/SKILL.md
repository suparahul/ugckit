---
name: deck
description: Phase 8, the deck — one file per handle per day, production/decks/<date>-<short>.md, with the item table and the slide-by-slide text and image prompts of each planned post, copied from its source post with the fewest changes. The deck also chooses each post's callout (the template, the product screen from PRODUCT-SCREENS.md and its in-app text), so the user reviews all of it before production. No script, no cost.
---

# Phase 8 — the deck

No script. One deck per handle per day, from the plan rows of that day, before any
picture is made. No picture is made before the user's go-ahead on the deck text (§ Finish). Read, in this order: the plan row (`production/PLAN.md`), the handle
file (`handles/<handle>/HANDLE.md`: the style prefix, the identity rule, the defaults),
the anatomy's best-seen row for the format (`niche/anatomy.md`, both sources), the
product screens (`apps/<slug>/PRODUCT-SCREENS.md`, for the callout: § The callout plan),
and the source post's slides on disk (`niche/batches/<date>/<handle>/<id>/slide-NN.jpg`, or the
competitor's post under `research/<slug>/<app>/<handle>/<id>/`). Read the source slides
yourself before writing a line.

## The file: `apps/<slug>/production/decks/<date>-<short>.md`

`<short>` is the plan's handle short name. The Organic Factory UI parses the file by these
conventions; keep them exactly.

    # `@maya.petmom` — day 2, 2026-09-17 — two slideshow posts
    <two or three sentences: the role, the rules of the day, the sources>

    ## Bio
    > <the bio, verbatim>

    ## Rules that hold on both posts
    - <one rule per bullet: the app's slot, the voice, the subject, the ask, the sound, the caption, the dimension>

    ## One visual style for both posts
    > **Style prefix:** <copied word for word from HANDLE.md § Style prefix>
    <notes: the input images, the flat, what a generator that returns 9:16 does>

    ---

    # Post 1 — AM — "How to stop your cat waking you at 5am"

    | Item | Value |
    |---|---|
    | Slot | AM |
    | Arm | <the plan row's arm, with the callout slide named> |
    | Source | `@mias.diary7` 7657658973415410977, 151,103 views, 9 slides, https://www.tiktok.com/@mias.diary7/photo/7657658973415410977 |
    | Slides | 7: hook → step ×2 → Pawly slide → step ×3, the save line under the last step |
    | Dimension | 3:4 (1080×1440) |
    | Slide style | photo |
    | Density | headline + 2–3 lines per step |
    | Text position | headline in the upper third, the lines under it; the subject in the lower two thirds |
    | Text size | slide 1 big; slides 2–7 headline medium, lines small |
    | Callout slot | slide 4 of 7; phone in hand · Symptom Check (the template and the screen chosen for this deck: § The callout plan) |

    ## Voice note — what changes from the source
    <one paragraph: what is kept word for word, what is swapped, why>

    ## Slides

    ### Slide 1 — hook
    **On-image text** (one block, centred, lower third of the frame):
    ```
    How to stop your cat
    waking you at 5am 😴
    ```
    **Position and size:** <where, which size, no box>
    **Image prompt:** [style prefix] <the scene: which subject is in frame, the room, the light, the framing>

    ### Slide 4 — the Pawly slide
    **Why this slide.** <the template, why this screen answers the story at this point>. The screen: "Symptom Check".
    **On-image text, top (headline):**
    ```
    ...
    ```
    **The screen (in-app text):**
    ```
    <every word the screen shows, as this post needs it: § The callout plan>
    ```
    **Image prompt:** [style prefix] <the scene, and the callout's room as its template needs it: § The callout plan>

    ## Caption
    <one line + the plan row's five tags>

    ## Last-slide ask
    ## Sound

Rules the parser has: the post heading is `# Post N — AM|PM — "title"`; the slide
heading is `### Slide N — label`; a heading that contains the app's name marks the
product slide; text blocks are the fenced block after a bold label; the word "box" in a
placement sentence boxes every block of the slide; a top block is medium only when its
label says "(headline)" and the Text size row names "headline medium"; the image prompt
is the sentence after `**Image prompt:**`, with `[style prefix]` first; the Dimension
row decides the canvas (3:4 when absent); the Slide style row (`photo` when absent) is
copied from the handle's `Slide style:` line and carried into the index as an item, so
the compositor knows whether to burn the text. The `Cards:` list marks the callout. A
block whose label starts with "The screen", "The component" or "The phone" holds the
in-app text: Atlas and the compositor never draw it as slide text; the callout step puts
it inside the app's picture. "The screen:" in "Why this slide" names the screen on the
Atlas placeholder.

A camera cover (a slide drawn as a phone camera screen, such as a mirror selfie): the line
`**Cover style:** camera` on the slide (`camera, no zoom` leaves out the zoom buttons). The
compositor and Atlas then draw, over the picture, the camera's 3x3 grid and its ".5 1x 2"
zoom buttons, and the hook in TikTok Sans SemiBold, pale yellow (#F4EEAC), lowercase, no
outline and no box, one line per line of the block, the lines staggered over the middle of
the frame (`atlas/lib/camera-cover.ts`). Write the hook as `**On-image text (big):**`, one or
two words a line, and an optional `**On-image text, under it (small):**` block for a bracketed
part. The image prompt asks for a clean photo: no grid lines, no camera interface, no text.

An illustrated handle puts the text in the picture. Each slide's image prompt carries,
after the style prefix and the scene, the slide's text word for word in quotation
marks, where it sits, the lettering feel and the text colour (`… the words "How to stop
your cat waking you at 5am" hand-lettered across the top in warm cream`). The
**On-image text** block is still written (the post page, `cover-text.txt` and the
caption need it), but the compositor draws nothing on an illustrated slide except the
callout on the product slide: the picture is the finished slide. The product slide's
prompt leaves room for the callout the deck chose (§ The callout plan). Look at every picture for
the spelling: a generator's text is a candidate to reject, not to fix.

## The callout plan

Every slideshow has a callout, and the deck plans all of it: the template, the screen or
component, and every word inside the app's picture. The user reviews it with the deck
text. Production (`images`, `callout`, `render`) only makes what the deck chose and never
chooses again (Rahul, 2026-10-09). Plan it per deck; never copy the App Store card in by
default. Choose the template that fits this deck best, with a strong bias towards a phone
that shows the real app, as often as possible. The App Store card is the default template
only when no screen fits. The templates and how each one is made: the `callout` skill §
The templates.

1. **Choose the screen first, from `apps/<slug>/PRODUCT-SCREENS.md`.** Ask "which screen
   proves this tip?". Follow the file's § How to choose: match the story at the callout
   slide (the question the slide before it raises) to each screen's **Fits** line, skip
   what **Does not fit**, prefer what the user approved before (**Used**), and obey every
   **Corrections** line. Write it in "Why this slide" as `The screen: "<Screen Name>"`,
   the name exactly as the file has it, so Atlas names it on the placeholder. With no
   file, or no screen that fits, use the App Store card and say why in the deck summary.
2. **Write the in-app text in the deck**, in a block labelled `**The screen (in-app
   text):**` (a phone) or `**The component (in-app text):**` (a component on the photo):
   every word the screen shows for this post, within the screen's **In-app text** rule.
   The words on the slide lead to the question; the screen gives the answer and carries
   the detail (the cause, the named object, the number). The in-app text uses what the
   post already said about its subject and stays short: a chat reply has two or three
   short sentences with the key phrase in bold; nobody reads more. It fits this subject
   and this slide's advice (no puppy steps on an adult dog's slide; no step that
   contradicts the slide), with a plain label and an icon that match. It need not be the
   app's exact text, but it must be something the app really shows.
3. **Choose the template**, and write it the way Atlas reads it (`atlas/lib/callout.ts`),
   so the post page draws the phone frame placeholder before the picture exists:
   - **Phone in hand** (persona handles): the image prompt asks for the phone screen in
     flat chroma green and places it ("the phone is about 60% of the frame width", "its
     top edge at about 40% of the frame height", "running off the bottom edge"), and says
     "phone in her hand". No App Store card in the `Cards:` list.
   - **Phone beside the App Store card** (E2): `**Cards:**` `1. full-height phone, the App
     Store card upright in the side column`; "from 4% to 96%" sets the phone's height. For
     E1, write "E1" and the side line as `line "…"`.
   - **Product component** (the app's own cards on the photo): no `Cards:` list; the
     component's words go in its in-app text block; a slide built as one HTML picture gets
     a "Composition spec" paragraph (`callout` § The templates).
   - **App Store card**, alone or under a line: `**Cards:**` `1. the App Store card`; the
     prompt keeps the lower third plain, so the card sits over it.
4. **Place the text for the template.** The text sits at the top, directly under the
   heading, never over the phone or the subject; on a phone slide the subtitle has 2 lines
   at most, so that the phone stays big.
5. **Name the plan** in the deck summary for each post: the style (photo or illustrated,
   by the main background), the template, the screen and the slide.
6. **Record it in `PRODUCT-SCREENS.md`.** Add a **Used** line under the screen when the
   user gives the go-ahead. When the user changes the screen or its text, add a dated
   **Corrections** line in the user's words with the rule taken from it, and correct the
   **Fits** or **Does not fit** line, so the next deck does not repeat the choice.

## Rules of the deck

- The source's hook line stays on slide 1 with the fewest changes; only the items the
  plan names are swapped. No step invented from outside the source's argument.
- One idea per slide sets the count; nothing else does. In the cat niche 12–14 slides
  had the best median save rate (1.7%) and the worst views (397K against 1.8M for two
  slides, 195 posts, 2026-09-16); across every app niche two-slide posts dominate and
  no 12+ deck reached 1M. A long deck costs pictures and views: on a fresh handle it
  waits until the handle clears about 500 views on a shorter one.
- **The 10-slide rule (Rahul, 2026-09-23).** A deck for a handle with both a TikTok and
  an Instagram account (the `## Accounts` table of its `HANDLE.md`) has **10 slides or
  fewer**, the CTA slide and the save ask included: Instagram's API takes 10 in a
  carousel. When the source has more ideas than fit, merge two per slide or drop the
  weakest; never plan on the kit cutting slides (it does not: the check on the post page
  fails and the send stops). A handle on TikTok only keeps no limit.
- The caption's first line repeats the cover text (4 of the 9 biggest tip posts of the
  scrolled batch do; search reads the caption for certain), then the plan row's five
  tags. The sync matches the posted link by that first line, so keep it exact. Write one
  caption for both platforms: Instagram gets the same `caption.txt`, tags included, with
  no first comment.
- The SEO handle (the search-keyword tier, when `ACCOUNTS.md` has one): slide 1's text
  is the keyword and nothing else, and the keyword sits in the caption too; its cover is
  typed in TikTok, never burned, because search reads TikTok's own text layer. Its tags
  come from the keyword, not from the rotation.
- The callout goes on slide 4 ideally, on slide 5 at worst (Rahul, 2026-10-09). Slide 3
  almost never fits: slide 1 is the cover and slide 2 is the first point. Never on slide 1,
  never on the last slide, never in the caption of a persona handle. The callout is its
  own slide, never merged into an information or table slide.
- At least three points come before the pitch. Woven into a numbered item, the app can be
  item 3 on slide 4; as a slide of its own (not an item), it comes after three tips
  (slide 5 after a cover).
- The slide before the callout leads into it, so the app is never a jump. The line above
  the screen says why the app appears: the problem that remains after the earlier
  points, or the hard part of doing them ("Doing it every day is the hard part. <App>
  puts each step in the routine."). No filler ("every pet is different").
- The app is one of the solutions in the story, never a separate advert. In a list post
  it is one of the numbered fixes, and the item heading names the kind of app as the fix
  ("3. I got a dog training app"). The cause and the fix must be logically true: the app
  did what the story says it did, and nothing more.
- The download wording is contextual (Rahul, 2026-10-09). Never write "download <App>". A
  heading that names a kind of app is fine: "Get a <category> app", "I got a <category>
  app". The descriptor fits the topic. Write the app's name the same way on every slide,
  on one line.
- The slide words stay broad (what the app does for the reader); the screen carries the
  detail. Never ask the viewer to do something nobody does ("film it in the app").
- Pair the callout with the post's most important item, never a trivial one. On a
  persona post the callout slide carries one of the strongest tips.
- Every slide is the handle's dimension (3:4 by default); every prompt names which
  subject is in frame and carries the prefix; no text rendered inside the image.
- About seven slides is the usual limit. The last slide carries the save ask and its
  reason. With a six-point list, the save line may sit under the last item on the last
  item slide (Rahul, 2026-10-09).

## The story and the text

- The story fits the subject: the problem and the fix are real for its age, kind and
  history. A first-person hook is literal: claim only what happened. The topic can be
  shown in the handle's picture style; signs a real photo cannot show go to an
  illustrated or a generic handle.
- Each item is true to the exact situation and keeps the hook's promise and scope. Advice
  is what the reader can observe and act on, with numbers, not "more than usual"; no row
  contradicts another; when sources conflict, take the expert source and the number that
  does not hide a warning sign.
- Strong, easy items first; drop the hard-to-follow and the commonplace. Checklists are
  complete; optional items go last and say "optional"; a number in the hook never points
  at a weak item. Use strong, recognisable signs and the reader's own plain words.
- The two posts of one handle on one day use different subjects or angles.
- Read every hook and heading for a second meaning. A hook change flows to the plan row,
  the deck and Atlas, except a hook the user edits in Atlas (slide 1 only; the caption
  stays). After a reorder, fix every "#N" in the hook.
- Lines: no line holds one word alone; a subtitle has 3 lines at most (2 on a phone
  slide); text sits at the top, under the heading, in the plain part of the picture, never
  over the subject or the phone. A heading states the rule; it does not open with the
  subject's name and age. Persona slides are first person and plain.
- Data cards: each tag, then its answer on its own line, starting with a capital. A key
  slide carries one message on short lines, the key fact boxed, the action under the box.
- Before you report, tick off every instruction the user gave for this deck; say first
  what is blocked, and say what you took out when you restructure.

## Finish

Run pass 1 of the `slideshow-review` skill on the deck and fix what fails. Rebuild the
index (`cd atlas && ATLAS_ROOT=.. node scripts/build-production.mjs`) and read what it
could not parse. Then give the deck to the user: the written deck is at
http://localhost:3210/production/<slug>/<date>/<short>/<n>?as=plan, and say for each post
the template, the screen, its in-app text and the callout slide.

**Wait for the user's go-ahead (Rahul, 2026-10-09).** The decks are made first as text;
the user reviews them, the callout's screen and in-app text included; the pictures start
only after the user's go-ahead for that deck, said in the conversation or a
`plan.approve` line for the post in `log.jsonl`. Then run the `images` skill for that
post. A `plan.sendback` line for this post whose `hash` is the deck's current hash means
the user refused this deck: rewrite it from the note and ask again. The Organic Factory UI
counts the plan stage done the moment the deck exists; that count is not the go-ahead.

## Before you finish

Did the user correct anything in this run? If yes, add the learning before you finish:
a dated, general entry in the section "Iterative learnings and improvements" of the skill
that produced the mistake (this one, or `deck`, `callout`, `images`, `plan`,
`slideshow-review`), and for a screen choice a dated line under that screen's
**Corrections** in `apps/<slug>/PRODUCT-SCREENS.md` (AGENTS.md, hard rule 16). Then tell
the user in one line which learning you added.

## Iterative learnings and improvements

A dated list that agents add to over time, from the user's feedback on real decks. Each
entry is a rule for every future deck, not only for the post it came from. Add new
entries at the bottom under a new date heading (`### <date> — <what>`), with short IDs
(D1, D2, …) that the `slideshow-review` skill can cite. Where an entry disagrees with older
text in this file, the entry says so; the older text is not rewritten until the user
decides. When a review of many posts is written up, the file that traces each entry to
the user's words is `apps/<slug>/production/LEARNINGS-<date>.md`. A correction of a
product screen goes to `apps/<slug>/PRODUCT-SCREENS.md`, not here.
