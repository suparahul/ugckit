# Pawly — product screens

The screens and components of the app that a slideshow's callout slide can show. The
`deck` skill chooses one per post from this file and writes its in-app text into the
deck; the user reviews both with the deck text; production (`images`, `callout`,
`render`) only builds what the deck chose. The `product` skill writes this file; agents
add to it (a new screen, a use, a correction). The user may edit it at any time.

This file is an example. The real one is `apps/<slug>/PRODUCT-SCREENS.md`.

App code: ~/code/pawly-app (read only)
Updated: 2026-10-09

## How to choose

1. Read the slide before the callout and the post's hook: what question does the story
   ask at that point? Choose the screen whose **Fits** line answers that question.
2. Skip every screen whose **Does not fit** line matches the post.
3. Prefer a screen the user has approved for a story like this one (**Used**), and obey
   every **Corrections** line.
4. No screen fits: the App Store card alone, or a line plus the App Store card (the
   `callout` skill § The templates), and say so in the deck summary.

## Symptom Check

**Kind:** screen
**Shows:** the owner's question about one sign, a photo if there is one, and a short
answer that names the likely cause and what to do now.
**Fits:** a new or worrying sign the owner wants to understand right now (a dog that
licks its paws all evening; a photo of a rash). The slide text ends on the question;
the screen gives the answer.
**Does not fit:** step-by-step training (use Training Steps); a routine that is already
known; any post where the answer would be the whole tip of the slide.
**Staging:** phone in hand (persona handles); phone beside the App Store card (brand and
illustrated handles).
**Source:** code `src/screens/SymptomCheck.tsx` (the question bubble, the answer card);
screenshot `apps/pawly/screens/symptom-check.png`.
**In-app text:** the question in the owner's words, one line. The answer: two or three
short sentences, the key phrase in bold, using what the post already told about the dog.
Keep the screen's title and the "Ask again" button as the app shows them.
**Used:** 2026-09-20 `@maya.petmom` post 1, slide 4: "Why does he lick his paws at
night?" → the allergy answer.
**Corrections:** none yet.

## Training Steps

**Kind:** component
**Shows:** a card of three to five numbered steps of one training plan, the current step
ticked.
**Fits:** a skill the owner teaches over days (loose-lead walking, the crate).
**Does not fit:** a one-off problem; an adult dog's post when the steps are for puppies.
**Staging:** component on its own, on the photo, with a text line above it; no phone.
**Source:** code `src/components/StepCard.tsx`.
**In-app text:** the plan's name as a plain label ("Loose-Lead Walking"), three to five
steps of six words or fewer, each one true to the post's dog and advice.
**Used:** none yet.
**Corrections:** none yet.
