---
name: slideshow-review
description: Phase 8, the slideshow check — two passes on one post. Pass 1 checks the deck text (line breaks, titles, subtitles, the callout plan with its product screen and in-app text) before any picture and before the user's review; pass 2 checks the finished pictures and slides before the user sees them. No script, no cost. The `deck` skill runs pass 1; the `images` and `render` skills run pass 2.
---

# Phase 8 — the slideshow check

No script. Read the deck (`apps/<slug>/production/decks/<date>-<short>.md`), the handle file,
the product screens (`apps/<slug>/PRODUCT-SCREENS.md`) and, for pass 2, the post folder
(`production/files/<post>/`). Fix what fails, then report what you fixed and what you could
not fix. The rules are in the bodies of the `deck`, `callout`, `images` and `plan` skills;
the entries of their sections "Iterative learnings and improvements" (with their IDs) are
checked too, as rules of the same weight.

The order of a post (Rahul, 2026-10-09):

1. The deck text is written (`deck`), with the callout's template, screen and in-app text.
2. **Pass 1** of this skill runs on the deck.
3. The user reviews the deck text, the callout included. No picture is made before the
   user's go-ahead.
4. The pictures, the callout and the render are made (`images`, `callout`, `render`),
   exactly as the deck says.
5. **Pass 2** of this skill runs on the finished slides.
6. The user approves the final on the post page.

## Pass 1 — the deck plan, before any picture

Line breaks and text size. Each line of a fenced text block is one line on the slide. A
line that is too long for its size wraps by itself, so check the length too. On a
1080-wide slide, about 22 characters fit on one line at the big size (the cover), about
33 at the medium size (a headline) and about 39 at the small size (the lines). These are
estimates; pass 2 checks the real render.

- [ ] No line holds one word alone. Re-break or reword ("under 5 minutes each" stays on
      one line).
- [ ] Every line fits its size, so the renderer does not add a break of its own.
- [ ] A title (headline) is one idea in one or two lines. It does not open with the
      subject's name and age.
- [ ] A subtitle has 3 lines at most; on a phone slide, 2 lines, so that the phone stays
      big.
- [ ] The text block sits at the top, directly under the heading, never over the phone or
      the subject; on a photo, the prompt keeps a plain part of the picture for it.
- [ ] Persona slides are first person and plain. A first-person sentence is always fine on
      a persona handle.
- [ ] Data cards: each tag, then its answer on its own line, starting with a capital. A
      key slide carries one message on short lines, the key fact in a box, the action
      under it.
- [ ] The spelling of every slide, also of text the user locked or typed. Ask before you
      change the user's words.

The story and the items (`deck` § The story and the text).

- [ ] Every instruction the user gave for this deck is applied; a blocked one is reported
      first.
- [ ] The story is plausible for the subject's age, kind and history. A first-person hook
      claims only what happened. Each item is true to the exact situation, and every
      slide keeps the hook's promise.
- [ ] The topic can be shown in this handle's picture style.
- [ ] The advice is something the reader can observe and act on; it has numbers, not
      "more than usual"; no row contradicts another; the source choice is the safe one.
- [ ] No hard-to-follow or commonplace item; the strongest item leads. Checklists are
      complete; optional items are last and say "optional"; no hook number points at a
      weak item.
- [ ] The two posts of the handle that day use different subjects or angles. The wording
      is the reader's plain phrase.
- [ ] The hook and each heading have no second meaning. The hook is the same in the plan
      row, the deck and Atlas; after a reorder, every "#N" is right.
- [ ] The topic is not the handle's own topic and angle of the last 30 days, and the week
      has no post that covers its parts (`plan` § Topics across handles and weeks).
- [ ] The slide count fits: about seven slides as a rule, 10 at most on a handle with an
      Instagram account. The save line may sit under the last item.

The callout plan (`deck` § The callout plan and § Rules of the deck).

- [ ] The deck names, for each post, the template, the screen and the callout slide.
- [ ] The template is chosen for this deck, with a strong bias towards a phone that shows
      the app. The App Store card alone only when no screen fits, and the summary says why.
- [ ] The screen is a section of `PRODUCT-SCREENS.md`, named exactly (`The screen:
      "<Screen Name>"`). Its **Fits** line matches the story at the callout slide; no
      **Does not fit** line matches; no **Corrections** line is broken.
- [ ] The in-app text is in the deck ("The screen (in-app text)" or "The component (in-app
      text)"), within the screen's **In-app text** rule, short (a chat reply: two or three
      short sentences, the key phrase in bold), true to this subject and this slide's
      advice, with a plain label.
- [ ] A phone in a hand never shares the slide with the App Store card.
- [ ] The callout is on slide 4, or slide 5 at worst; never on slide 3 or earlier, never on
      the last slide; on its own slide; at least three points come before it.
- [ ] The slide before it leads into it; the line above the screen says why the app
      appears; no filler, no jump; the cause and the fix are logically true.
- [ ] The app is one of the solutions in the story, not an advert. No line says "download
      <App>"; a heading may name a kind of app ("Get a <category> app"). The app's name is
      written the same way, on one line; the slide has a supporting line that says what
      the app is useful for.
- [ ] The slide words stay broad and the screen carries the detail: the words lead to the
      question, the screen gives the answer. No line asks the viewer to do something
      nobody does.
- [ ] The callout is paired with the post's most important item, never a trivial one.

The prompts.

- [ ] Every prompt starts with `[style prefix]`, names the subject in frame by its look,
      and names the camera position and the framing that the slide needs: the natural,
      wide view by default, close only for a touch or a detail.
- [ ] Each prompt shows what its slide's text says; the cover shows the hook's situation.
      No hands-only lifting or holding shot.
- [ ] The product slide's prompt leaves the room its template needs (the chroma phone and
      its place, or the plain lower third for the card).

Then report the deck to the user and wait for the go-ahead.

## Pass 2 — the finished pictures and slides

- [ ] `scripts/images.sh <slug> <post> --verify` passes: every slide has a valid file at
      the post's size.
- [ ] The right subject on every slide, against the handle's identity rule.
- [ ] True size and proportions: judge against the handle's approved reference picks and
      the setting; fail a result only when the subject is clearly too big, the head is too
      big, or it is the wrong subject.
- [ ] An illustrated slide: every word in the picture is spelt right; a misspelt slide is
      made again, never patched.
- [ ] The rendered text is inside the safe area and never covers the subject's face; the
      callout is on the right slide.
- [ ] Most shots are the natural view, not super close; close only where the slide needs a
      touch or a detail. Each picture shows what its text says. No hands-only handling
      shot. A clip inside a phone is the owner's own view.
- [ ] The finished slide is the chosen candidate on every slide; no placeholder covers a
      finished picture.

The finished slides, at full size:

- [ ] Pass 1's text checks again on the render: no word alone on a line, no extra break,
      the subtitle line limits, the text in the plain part of the picture.
- [ ] The callout is made, not a placeholder; its template, its screen and its in-app
      text are the deck's, word for word.
- [ ] Every post of the day is finished: all slides and all callouts exist, and no agent
      has stopped quietly. Check each post folder against its deck before you say a day
      is done.
- [ ] The cover text follows the cover's setting in Atlas: text-free (the user types the
      words in TikTok) or burned-in. The send follows that setting; no agent decides it
      alone. If the covers of one day differ, say so before the send.

## Finish

Say what failed, what you fixed and what is still open. After pass 1, the user reviews the
deck. After pass 2, the user approves the final on the post page (`final.approve`). When
the user changes the screen the deck chose, the `deck` skill records the correction in
`PRODUCT-SCREENS.md` (§ The callout plan, step 6).

## Iterative learnings and improvements

A dated list that agents add to over time, from the user's feedback on reviewed posts.
Each entry is a rule for every future check. Add new entries at the bottom under a new
date heading (`### <date> — <what>`), with short IDs (R1, R2, …); keep the IDs. Where an
entry disagrees with older text in this file, the entry says so; the older text is not
rewritten until the user decides.
