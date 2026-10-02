# AI UGC — script and storyline learnings

What an AI UGC video says: the hook, the beats, where the product and the app sit in the
timeline, how one demo serves many hooks, and how the variants are tested. Written
2026-10-01, when these rules were moved out of `METHODOLOGY.md`.

**Status.** A holding file for the **video planning system**, which is built later as
its own skill set, like the slideshow anatomy system: a detailed plan of the video, the
user approves it, then production starts. That system decides what a video is: its
script, its storyline and its format. This file belongs to it, not to the character
video production pipeline of `METHODOLOGY.md`, which starts only from a locked,
approved plan (`METHODOLOGY.md` § 2). The planning system is not designed yet. This
file lives in the ugckit repository under `research/ai-ugc/`, outside `template/`, and
is never shipped; what ships later is that system's skills, scripts and orchestrator
updates in `template/`. No picture or video was generated to write this file, and no
money was spent.

**The boundary.** `METHODOLOGY.md`, beside this file, is production quality only: the
creator, the pictures, the voice, the app on a green screen, the segments, the joins,
the export. This file stops where the words are frozen. A rule that is about how a
line sounds (breaths, restarts, pace) is in `METHODOLOGY.md` § 7.6. A rule that is
about what the line says is here.

**Sources.** The six sources in `sources/README.md`, cited as **[Enzo]**, **[Vlad]**,
**[Fekri]**, **[Jason]**, **[Ultra]** (ugc-ultra-system). What comes from this
repository is cited **[repo]**. Quotes are verbatim. The source key at the end gives
each author's bias. Numbers we did not measure are marked *planning value*.

Contents: 1 what the evidence says together · 2 what you sell · 3 research and hook
mining · 4 how an ad is built · 5 the hook · 6 the beats · 7 the product and the app in
the timeline · 8 mechanisms and formats · 9 one demo, many hooks · 10 the words ·
11 script checks · 12 script-side templates · 13 the testing loop · 14 where the
sources disagree · 15 slideshow rules from the same sources · 16 open script
questions · source key.

---

## 1. What the evidence says together

1. **A video is two parts: the hook and the demo.** "A UGC video is two parts: the hook
   (first 3 seconds, most important) and the demo (showing the product)." Scale is one
   demo paired with 5 to 10 hooks, then a test of which one lands [Jason].
2. **The hook carries most of the result.** About eighty percent of the outcome is in
   the call-out. If the first two seconds fail, nothing after them is seen [Fekri, from
   Hormozi].
3. **No hook is about the product.** In the 25 top Cal AI ads, "every opener is a
   person, a bet, a physique or an accusation. The app never appears before second
   eight" [Fekri].
4. **The product is never in the first 3 seconds and never the last beat.** "mention
   the product in the first 3 seconds" and "end on the product" are both on [Enzo]'s
   do-not list.
5. **Say how it works, out loud, exactly.** "You take a picture of your food and it
   tells you the calories and macros." Cal AI repeats one sentence in almost every ad
   [Fekri].
6. **Answer one doubt, with a number or a visible result.** Not five doubts weakly
   [Fekri].
7. **Do not invent what already has evidence.** The competitors paid to find what
   converts, and it is public [Fekri]. A structure is valid only when it repeats on
   several accounts [Enzo].
8. **Vary the idea, not the noun.** Fifty hooks that are one sentence with one word
   changed are one hook [Ultra].
9. **The same script from another face is another test.** "the same script from 3
   different faces pulls 3 different audiences at 3 different cpas" [Vlad].
10. **Attention is the constraint; believability is only the entry ticket.** "the ads
    that print are often not the most realistic: claymation, pixar and story formats
    regularly outperform a perfect talking head" [Vlad].

---

## 2. What you sell

Do this before a word of the script [Fekri].

- Every purchase comes back to one of eight human desires (the Life-Force 8, from
  Whitman's *Ca$hvertising*): to stay alive and feel well; to enjoy food and drink; to
  be free from fear, pain and danger; to find a partner; to live comfortably; to be
  better than the people around you; to look after the people you love; to be liked
  and respected.
- Answer two questions. What problem do you really solve? What changes for this person
  afterwards?
- "That painful moment is your ad, and that change is what you are selling."
- The features do not matter. In the Sona example, the food photos, the barcode scan
  and the watch sync are not the ad. The ad is "standing on the scale after six weeks
  of eating well and still seeing the same number".

---

## 3. Research and hook mining

Nothing new is scraped for this. R1 to R5 and the niche phases already bought the
corpus [repo].

**3.1 Validity before volume** [Enzo]. A format or a hook structure is usable only
when:

- the same hook structure appears on several different accounts;
- it works outside this exact niche;
- the product can enter naturally, not at the start.

Ignore "single viral posts from accounts with no other hits". One viral post can be
the only hit an account ever had: "copying it means copying luck". In our terms: pick a
template on `best_views` and `posts_over_1m` across handles, not on one post [repo
`originate`].

**3.2 The paid-ads check** [Fekri]. The Meta Ads Library is free. "A long-running ad
is usually a winning ad. Nobody keeps paying to serve a loser." Take a large app in the
category, take its top ads by impressions, and for each one write down: the first line
word for word, the pain it goes after, the objection it answers, the format. "By about
the fifteenth ad the same three or four pains will keep coming back." Paid ads show
what a marketer chose to say. Organic posts show what an audience chose to spread. When
both point at the same pain, build on it.

**3.3 What to take from each winner.** Stages 2 and 4 already hold it [repo]. Read
them as a bones sheet [Ultra]:

1. the mechanism, with a confidence;
2. the hook, as a shape and a function: question, confession, correction, flex,
   surprise, embarrassment;
3. the beat map, about every 2 seconds, with the time of the first product appearance;
4. the overlay timing: which on-screen text appears, and when;
5. why it holds attention, in one sentence tied to a visible structural choice.

Keep the mechanism, the hook shape, the beat timing, the reveal timing, the pacing.
Swap the person, the product, the exact words, the proof beat. "Never copy a competitor
creator's face or raw footage. Treat the reference as a structural template." (The
camera, the light and the sound of the same sheet are production inputs.)

**3.4 The three research outputs a script needs.**

1. **A hook bank for one demo:** 15 to 20 lines, ranked, with one line of reason for
   each rank [Enzo]. Each line is a corpus hook quoted verbatim, or a stated variation
   on a named `template_id`; a line never gets a view count it did not earn [repo]. Our
   own winning slideshow covers (the `own posts` rows in the findings) go to the top of
   the bank.
2. **One pain and one doubt.** The pain the market already validated, and the one
   objection the script answers.
3. **The format, locked.** One format from `library.py formats`. The writer stays in
   it and does not invent a new one [Enzo].

**3.5 Use their winner.** "Take the best script you found, and either say it better
than they do, or say it from a person they are not using" [Fekri].

---

## 4. How an ad is built

The framework is Hormozi's, as [Fekri] applies it: the call-out, the value, the call
to action.

**4.1 The call-out.** It stops the right person and lets all others scroll. "A call out
aimed at everybody stops nobody." It is the line, the way it is said, and what is on
screen, and all three land in the same two seconds. The line is about the viewer, not
about you.

**4.2 The value.** What they get; the more specific, the better. "Giving away the
secrets and selling the implementation":

- Bad: "It just knows what you're eating."
- Good: "You just snap a picture of your food and it instantly tracks your calories and
  macros for you."

Promise less work, not a bigger result: "No typing, no mental math." Nobody in the Cal
AI set promises a number of pounds.

**4.3 One objection.** There are five reasons a person does not buy: no need, no
money, no hurry, not enough want, no belief. Pick the one your buyer most probably has
and answer it fully.

- No belief: "While FDA food labels have 80% accuracy, this has 90% accuracy."
- No need: "It's not because they're lazy, but because they're guessing their diet."

**4.4 The reframe.** The strongest ads reframe the problem. The pain is not that
tracking is hard. The viewer blamed themselves for what was a measurement problem.

**4.5 The call to action.** The last line tells the viewer what to do, in their own
words. Cal AI uses two parts: a qualifier ("So if you're serious about getting in
shape, stop guessing and start tracking the smart way.") and then the app and the tap
("use the link below and download CalAI"). For our organic posts the second part is
not used; see § 7.

**4.6 The winning script, taken apart** [Fekri]. About 106 words in about 30 seconds:

> You're not overweight because you eat too much, you just have no idea how much
> you're actually eating. Like be honest, you guess your calories and you forget snacks
> and by the end of the day you're way off. That was literally me until I found this.
> It's called CalAI. You just snap a picture of your food and it instantly tracks your
> calories and macros for you. No typing, no guessing, no effort, it made dieting
> stupid simple. Like now I actually know what I'm eating and it shows. So if you're
> serious about getting in shape, stop guessing and start tracking the smart way.

The parts: call-out, problem, value with the mechanism given away, the objection
(trust), call to action. [Fekri]'s own version keeps the pain, the reframe and the
order of the beats, and changes four things only: who says it, what is in front of
her, one number for trust ("two months in"), and the product name. Get one script
working before you make variants.

---

## 5. The hook

- **Four shapes** [Fekri, from Hormozi]. A label ("women over 35"). A yes-question
  ("You eat well all week and you still can't work out why nothing happens"). An
  if-then ("If you've been eating well for six weeks and the scale hasn't moved, it
  isn't your body."). A result so large that it needs an explanation ("Her salad had
  more calories than a Big Mac.").
- **The software pattern** [Jason]: "a stunning claim, a specific number, and a
  result." His example: "3 AM last night, my agent was researching hundreds of
  customers and emailing each of them to book meetings for me. I woke up to 12 replies
  and 4 meetings on my calendar. Here's exactly how I set it up."
- **A hook is a spoken line, not a title.** Usually 6 to 14 words. Short,
  conversational, specific [Ultra].
- **The picture is part of the hook.** Six of Cal AI's live ads have no script: a
  person eats and the number appears. The bet ads open on a plate held out to a
  stranger. "You know what the ad is about before the first word" [Fekri]. The first
  frame must stop the scroll alone: something in motion, not a held pose.
- **A new call-out for each ad** [Fekri].
- **Where hooks come from.** Extract them from the transcripts of the top videos of
  the reference accounts [Jason]. In this repository: `scripts/library.py templates`
  and `hooks` [repo].
- **How many.** 15 to 20 for one format, ranked; write the full beats for the top 3
  only [Enzo].
- **Our first hooks** are our own best slideshow covers. A hook that held as a still
  picture is the cheapest evidence we have [Enzo: slideshows prove a format].

---

## 6. The beats

Thirty seconds lets the three parts become five beats [Fekri]:

    Hook → Problem → Demo → Proof → CTA

[Fekri]'s Sona script adds a turn between the problem and the demo. Our default, for a
20-second organic video (*planning values* for the times):

| Beat | Time | What it does |
|---|---|---|
| Hook | 0 to 4 s | Names a person and gives the viewer their own situation. Never about the product. |
| Problem | 4 to 8 s | The pain, in the viewer's words. Reframe it when possible: not "tracking is hard" but "you were guessing". |
| Turn | 8 to 10 s | "That was literally me, until I found this." The app is named once, here. |
| Demo | 10 to 16 s | The mechanism said out loud, exactly. One job, three beats at most: tap, result, why it matters [Ultra]. |
| Proof | 16 to 18 s | One number or one visible result that answers the one doubt. |
| Close | 18 to 20 s | A payoff, a laugh at her own line, or a save ask. No product. |

- One idea per video. One visible proof beat [Ultra].
- The pace: 106 to 112 words for 30 seconds [Fekri]. The production limit on words per
  second is in `METHODOLOGY.md` § 7.7.
- [Ultra] has a 15-second default: hook 0 to 2 s, product reveal 2 to 4 s, setup 4 to
  6 s, hero demo 6 to 8 s, proof 8 to 10 s, second use 10 to 12 s, payoff 12 to 14 s,
  soft close 14 to 15 s. "It is a default, not a law." Its early reveal conflicts with
  § 7; see § 14.
- When a winning reference has other timing, keep the reference's timing [Ultra].

---

## 7. The product and the app in the timeline

1. **Not in the first 3 seconds.** Not seen and not named [Enzo]. In practice not
   before the turn: Cal AI's winners hold the app until second 8 or later [Fekri].
2. **Named once, in the turn.** The name is said one time, mid-sentence, naturally,
   "never emphasised or announced like an advert" [Fekri]. The script gives the
   pronunciation. The script never asks the model to show the name, because models
   mangle text; the real screen shows it (`METHODOLOGY.md` § 11).
3. **Introduced as the next line of the story.** "what i switched to instead, said
   like the next line of the story" [Enzo]. A small confession with the product as the
   fix already in use [Ultra].
4. **Shown in a proof beat.** The product must appear in a beat that proves its one
   job [Ultra].
5. **Never the last beat.** "never end on the product" [Enzo]. The last beat is a
   payoff or a save ask, and the creator ends on an action.
6. **The app can be absent from the picture.** A mechanic can keep the product in the
   caption or the bio; `originate` picks this from `library.py mechanics` [repo].
   [Fekri]'s own ad shows no phone and no screen at all; the product is spoken.
7. **A slideshow default agrees.** A handle's slideshow often puts the product slot at
   slide n−2, never the last one, with no app name in the caption [repo, an earlier
   handle's `HANDLE.md`].

How the app is put on screen (cutaway, picture-in-picture, green screen) is
production: `METHODOLOGY.md` § 11.

---

## 8. Mechanisms and formats

Choose two labels and do not mix them [Ultra]. The **mechanism** is why the ad works.
The **production format** is how this one asset is shot.

| Mechanism | Why it works | Good fit |
|---|---|---|
| Shocked reaction + demo | the reaction opens a question; the demo answers it | an app with one impressive action |
| Product-as-gameplay | the demo is the entertainment | visual, strange, satisfying core loops |
| Notification punchline | embarrassment or comedy makes shares | products with screenshot-worthy copy |
| Mascot / character engine | a recurring character builds recognition | a brand that builds around a character |
| What-worked-for-me note | a peer recommendation feels native | fitness, habit, wellness, productivity |
| Spot-the-AI | the question farms comments and dwell | AI creator services |
| Accidental discovery | the viewer feels late to something useful | tools found mid-task |
| Trend-template at volume | reach comes from the number of variations | products that support many versions |

Choose the format from the product's core loop, not from its category [Ultra].

The four batch formats of [Ultra], with their script rules:

- **Talking head.** The face carries the ad. The product can flash once, late. Hook,
  proof, stop.
- **How-to.** One job. Three beats at most: tap, result, why it matters.
- **Before / after.** The same person, room, clothes and light. The behaviour or the
  product state changes; the person does not.
- **Confession.** A small admission that sounds true, then the product as the fix
  already in use. "Quiet, close, specific." No melodrama.

A pack of 50 for one creator is 15 talking head, 15 how-to, 10 before/after, 10
confession [Ultra]. Other formats on record: macro demo, mirror selfie,
over-the-shoulder, front camera with screen proof [Ultra]; the six Cal AI formats (the
bet, before and after, "it's not your fault", "a 17 year old built it", the news clip,
no talking) [Fekri]; skincare routine, unboxing reaction, day-in-the-life, close-up
swatches [Enzo].

**A lane per creator** [Enzo]. Each creator owns one lane and its formats, "so the
formats don't all start looking like the same person made them". His rules: one
creator per post; no creator outside its lane; at most 3 posts per creator per day.

---

## 9. One demo, many hooks

- **The demo is made once.** "One demo clip, then pair with many hooks" [Jason]. To
  cut cost, his demo has no character: a screen recording with a voice-over.
- **5 to 10 hooks per demo**, then test which lands [Jason].
- **What is shared.** The demo; and the problem, turn, proof and close when the hooks
  share one pain. When a hook changes the pain, the problem beat is written again.
  (The production side of sharing is `METHODOLOGY.md` § 10.5.)
- **Vary the idea** [Ultra]. Between hooks, change the pain point, the moment of use,
  the proof beat, the social context, the failure avoided, the result shown, the
  emotional temperature. Rotate the job the product does: start, stick, recover, prove,
  simplify, hide friction, show the win, remove a step, prevent failure, reveal
  progress. "Do not write 15 hooks that are the same sentence with one noun swapped."
- **Variants after one works.** "Once it does, the variants are cheap: the same script
  with a different woman in a different room, with a different hook or answering a
  different objection" [Fekri].
- **The matrix** [Ultra]. `creator × product × hook × angle`. Change one major axis at
  a time. "Do not let 'variation' become random drift." Name each video by its cell.
  Ours: `c<creator>-d<demo>-h<hook>`, for example `c01-d02-h07`.
- **The face is a variable.** A library of 5 faces of different ages and looks, used
  across every script, is a controlled variable [Vlad].

---

## 10. The words

- Spoken language is a person's, not ad copy [Ultra].
- No filler closers: "game changer", "obsessed", "you need this", or "link in bio" as
  the whole payoff [Ultra].
- No fake statistics, fake reviews, fake notifications or invented product screens
  [Ultra]. What the script says must agree with what the real screen shows.
- Read it aloud. "Anything you would not say to a friend in a car gets rewritten"
  [Vlad].
- The creator's verbal habits come from her voice profile: one opener she uses, the
  words she never says [Enzo]. The profile is in `creator.json` (`METHODOLOGY.md`
  § 15.1).
- Write lines that carry an action. A line that describes a benefit gives a static
  character; a line with a reach or a reaction gives movement [Vlad]. (The motion rules
  are `METHODOLOGY.md` § 9.)
- The on-screen hook and the spoken lines are not the same words. The corpus hooks are
  text overlays; the spoken lines are written in the voice the teardown describes
  [repo `originate`].
- The words are frozen when the user approves them. Later changes are to delivery
  only [repo].

---

## 11. Script checks

Run at the storyboard gate and again on the final file. These are the script's part
of the approval; the production checks are in `METHODOLOGY.md` § 14.

- The hook is not about the product.
- The product is not seen or named in the first 3 seconds.
- The app is named one time, in the turn.
- The demo says the mechanism in one exact sentence.
- One doubt is answered, with a number or a visible result. No statistic is invented.
- The last beat has no product and no app name.
- One idea, one visible proof beat.
- Each hook of the round is a different idea, not a changed noun.
- Each hook is a corpus quote or a stated variation on a named `template_id`.
- The words on the real screen agree with the words in the script.
- No filler closer.

---

## 12. Script-side templates

These fields are the script's part of `video.json` and `approval.json`. Stage 5 adds
them; `METHODOLOGY.md` § 15 holds the production fields.

```json
{
  "research_brief": {
    "app": "<slug>",
    "sources": ["research/<project>/*/TEARDOWN.md", "HOOKS.md", "apps/<slug>/niche/{learnings,anatomy,architecture}.md", "scripts/library.py"],
    "validity_checks": [
      "the same hook structure appears on several accounts",
      "it works outside this exact niche",
      "the product can enter naturally, not in the first 3 seconds"
    ],
    "ignore": "a single viral post from an account with no other hits",
    "output": ["15-20 hooks for one demo, ranked, one line of reason each, each with its template_id", "one pain", "one doubt", "one locked format"]
  },
  "hook_task": {
    "locked_format": "<one format from library.py formats>",
    "do": ["write hooks for this format only", "rank them, one line of reason each", "write the beats for the top 3"],
    "do_not": ["invent a new format", "show or name the product in the first 3 seconds", "end on the product", "attach a view count a line did not earn"],
    "voice": "voice_profile from creator.json"
  },
  "video_script_fields": {
    "variant_id": "c01-d02-h07",
    "mechanism": "<one row of the mechanism table>",
    "format": "<talking head | how-to | before/after | confession | ...>",
    "hook_template_id": "<library template id>",
    "hook_overlay_text": "<the on-screen hook>",
    "beats": [
      { "beat": "hook", "t": "0-4", "lines": "<ids>" },
      { "beat": "problem", "t": "4-8", "lines": "<ids>" },
      { "beat": "turn", "t": "8-10", "lines": "<ids>", "app_named": true },
      { "beat": "demo", "t": "10-16", "lines": "<ids>", "mechanism_sentence": "<the one exact sentence>" },
      { "beat": "proof", "t": "16-18", "lines": "<ids>", "answers_doubt": "<the one doubt>" },
      { "beat": "close", "t": "18-20", "lines": "<ids>" }
    ],
    "words": 71,
    "frozen": "<the user's words and the date>"
  },
  "script_checks": {
    "hook_not_about_product": null,
    "product_first_seen_s": 8.0,
    "product_in_last_beat": false,
    "app_named_times": 1,
    "invented_statistics": 0,
    "one_idea_one_proof": null
  }
}
```

[Ultra]'s script card, for a pack:

```text
{ID} · {format name} · {seconds}s
hook: {first spoken line}
say:
- {line}
- {line}
- {line, optional}
show: {what the product does, in order}
cut: {none, or the one allowed cut}
```

---

## 13. The testing loop

**13.1 The unit of a test is the matrix cell** (§ 9). Order of tests: hooks first (the
cheapest, the largest effect), then the demo, then the set, the creator last.

**13.2 A round.** One demo, 5 to 10 hooks [Jason], on the handle's normal slots.

**13.3 What is read.** `sync` writes views, likes, comments, saves and shares per
post; the weekly `read` writes `own posts` rows into the findings [repo]. For a video
round, read at 24 hours, 72 hours and day 7: the views against the handle's own median,
saves per view, shares per view, and the comments that ask what the app is. Hold rate
is read by hand from TikTok's analytics; no tool here reports it. [Enzo]'s dashboard
tracks "average hook hold" (65% in his example).

**13.4 The rules.** *Planning values.*

- A hook at 2 times the handle's median or more gets three variations on the same
  template.
- When all ten hooks of a demo are under the median, the demo is the problem. Change
  the demo, not the hooks.
- Change the creator or the set only after a demo has one hook that works.
- Winners and losers go back into the hook bank with their numbers.

**13.5 Paid ads** [Vlad]. About $20 a day for each creative. Read the click-through
rate first and the hold rate second. Cut anything under 1% click-through by day 3. A
long-running ad is usually a winning ad [Fekri].

**13.6 Start with slideshows** [Enzo]. "a format that can't hold attention as still
images won't suddenly start converting once it moves." Slideshows are the cheapest
format to test. We post two a day per handle already [repo].

**13.7 The warning.** The videos that win are often not the most realistic [Vlad]. If
the numbers say a format outside these rules wins, the numbers are right. "whether the
content is actually good still comes down to the format and the hook" [Enzo].

---

## 14. Where the sources disagree

| Question | The positions | Our decision | The reason |
|---|---|---|---|
| End on the product or not? | [Enzo]: never end on the product. [Fekri]: the last line is the call to action; Cal AI names the app there. An earlier character video made with the kit named the app in its last shot [repo]. | **Organic: the last beat is a payoff or a save ask, with no product on screen and no app name. The app is named once, in the turn.** A paid variant can end on a call to action that qualifies the viewer. | The founder's brief sets this rule. It agrees with the slideshow default above: the product at slide n−2, never last. |
| When does the product first appear? | [Enzo]: not in the first 3 seconds. [Fekri]: Cal AI holds the app until second 8. [Ultra]: a product reveal at 2 to 4 seconds in the 15-second default; in a one-face pack the phone is in the frame from frame 0. [Vlad]: nothing in the hands until the product beat. | **Never in the first 3 seconds; in practice not before the turn.** | Three sources and the Cal AI evidence agree. [Ultra]'s frame-0 rule is a production rule about objects that appear mid-clip, and production keeps it in another form: the phone is in the first frame of its own segment (`METHODOLOGY.md` § 3, decision 9). |
| Does the creator say the app's name? | [Fekri]: once, mid-sentence. [Enzo]: the product line is "the next line of the story". An older standing decision of a project built on the kit: "The actor never mentions the app." [repo]. | **Once, in the turn. Open: see § 16.** | The older decision is from a different project and a different format. The founder must confirm which rule holds. |
| A character in the demo or not? | [Jason]: no character in the demo; a screen recording with a voice-over. [Ultra]: in a one-face how-to, the creator stays visible while she demonstrates. | **A script choice per demo.** The default is no character in the part that must be read. | The reasons are production reasons: legibility and cost (`METHODOLOGY.md` § 11.2). |

---

## 15. Slideshow rules from the same sources

[Enzo] plans a slideshow deck as one file before any picture. These rules belong with
the slideshow learnings; they are recorded here because they came with these sources.

- "product never on slide 1"; "never end on the product"; "slide 1 exists only to earn
  slide 2".
- The format in his example: a ranked list, the strongest item last, 7 slides, the
  product on slide 5.
- The product slide's text is "what i switched to instead, said like the next line of
  the story".
- Half the slides have no face. "slides without a face read more like a real person's
  camera roll".
- The payoff slide repeats the angle of slide 1.
- "text NEVER goes inside the image. the hook gets typed into tiktok natively, by
  hand".

---

## 16. Open script questions for the founder

1. **The app in the last beat.** An earlier character video made with the kit ends on
   "the <app> app was a massive help". The rule here puts the app name in the turn and
   no product in the last beat (§ 7, § 14). Does the rule apply to every creator?
2. **The app's name, spoken.** Is the app named aloud at all? An older standing
   decision of a project built on the kit is "the actor never mentions the app" (§ 14).
3. **Organic only, or paid too?** It changes the close (a call to action is permitted
   in an ad) and the test rules (§ 13.5).
4. **The first demo.** Which three jobs of the app come first, and which one pain and
   one doubt does the first script answer?
5. **The merge.** When these learnings merge into the video learnings brain, do the
   decisions of § 14 go in as rules, or as source positions until our own posts prove
   them?

---

## Source key

| Cite | Author | Piece | Bias |
|---|---|---|---|
| [Enzo] | Enzo (@enzoxmotion) | "how to ACTUALLY build yourself an ai ugc team (with json prompts)", X article, 2026-09-25, 196K views. `sources/01-enzo-ai-ugc-team-json.md` | He shows no revenue. His numbers are a dashboard: 49 clips, 23 approved, 65% average hook hold, about $2.02 a clip. |
| [Vlad] | CEO (@CEO_Vlad) | "the complete guide to creating hyper realistic AI UGC videos", X article, 2026-09-16. `sources/02-ceo-vlad-hyper-realistic-ugc.md` | He sells Infinite UGC. |
| [Fekri] | Fekri (@fekdaoui) | "Everything you need to know to make Seedance 2.5 UGC ads that convert", X article, 2026-08-12, 84K views. `sources/03-fekri-seedance-2-5-ugc-ads.raw.txt` | He co-founded Genviral. The Cal AI analysis is his own count of 25 ads on 2026-08-09; Sona is fictional. The capture is cut in places. |
| [Jason] | Jason Zhou (@jasonzhou1993) | "How to run your first AI UGC campaign", X article, 2026-09-15, 174K views. `sources/05-jason-zhou-first-ai-ugc-campaign.md` | He built treg. The Composio hook (3.3M impressions) is his example. |
| [Ultra] | ugc-ultra-system | A skill package: `SKILL.md`, `references/formats.md`, `reference-scan.md`, `script-pack.md`, `examples/focus-loop.md`. `sources/06-ugc-ultra-system/` | A prompt package with no results data. Its rules are a method, not evidence. |
| [repo] | the kit | `template/AGENTS.md`, the `originate` and `script` skills, `scripts/library.py`, and records of earlier videos made with the kit | Our own records. |
