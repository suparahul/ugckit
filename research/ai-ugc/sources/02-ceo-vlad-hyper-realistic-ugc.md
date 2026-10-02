# CEO (@CEO_Vlad) — "the complete guide to creating hyper realistic AI UGC videos"
Source: https://x.com/CEO_Vlad/status/2099934124408500463 (Sep 16, 2026). Text captured from the X article; images not captured. (Author promotes "Infinite UGC".)

realism in AI UGC comes down to 4 things: the face, the voice, the environment, and the motion. you need all 4 right.

## why ads get clocked as ai (viewer feels it in the first second and scrolls)
1. the face is generic — the same ai face 40 times this week, every model trains on similar data.
2. the audio and the room disagree — a clean studio voice from someone standing in a kitchen.
3. the person does not move like a person — no gesture, no blink pattern, perfectly even pacing.
4. the setting does not match the claim — a skincare review shot in an office.

## part 1: the face
stop generating faces from scratch; text descriptions return the same generic output. method:
- search tiktok for someone already filming the exact style you want (a doctor talking about a product, an older guy reviewing a supplement)
- screenshot the frame
- ask chatgpt for a json prompt that recreates the image one to one, from scratch, with no reference image
- paste that json into nano banana or gpt image; generate 4 at once and keep the best
json carries pose, lighting, framing, clothing, environment as separate fields so nothing is left to interpretation. output is "copyright free": generated from a description of a person, composition matches, individual does not. it also hands you the keyframe (avatar already in the right environment and posture to start the video from).

match the avatar to the claim: a 22 year old talking about joint pain fails before the script starts. build a library of 5 covering different ages and looks, reused across every script — a controlled variable: the same script from 3 different faces pulls 3 different audiences at 3 different cpas.

## part 2: the voice
gives an ad away fastest; thought about least. seedance 2.0 and google omni read the acoustics of the environment: a voice in a car carries cabin tone, bathroom carries reflection, large room carries echo. tools with no contextual read of the space (e.g. elevenlabs) are fine for voiceover over b-roll where nobody is on camera, wrong for anything where the avatar is visibly standing somewhere.
locking the voice across a longer ad: generate one clip, pull the mp3, reference that audio on the rest; tone, echo and pacing hold.
write the script with imperfections in: interruptions, half sentences, a restart or two. perfectly even delivery reads as generated. read it out loud; anything you would not say to a friend in a car gets rewritten.

## part 3: the environment
the setting makes the claim plausible AND decides how well the model renders.
- car: private and unscripted
- bathroom/bedroom: anything personal
- kitchen: food, supplements, domestic
- store aisle: caught mid-shop
- office/desk: b2b and software
technical: a car interior is small, contained, evenly lit, fixed camera → fewer failed generations. a full room with depth, multiple lights, background movement → usable rate drops. usable rate decides real cost per finished ad: 80% usable costs half of 40% usable at the same price per generation.
keep the setting consistent: the character sheet holds the face; you check the room. read the scene proposal before generating; confirm setting, lighting, camera position hold across every scene. a shifting angle breaks a selfie read immediately.

## part 4: the motion
check: eye contact holds on camera through lines; hands move (people gesture); pacing has stumbles; natural blink patterns; background has some movement where the setting implies it.
write for motion: the engine stages what happens, so write actions and reactions. a line describing a benefit produces a static character; a line describing someone reaching for something produces movement.
hands are the most common failure across every model, then teeth and eye movement. run the same script 5 times on your model, note what it breaks on, write around it (e.g. avatar holds nothing until the product beat).

## tooling
Infinite UGC (character sheets, generation, editor), ChatGPT (json from reference screenshot), Nano Banana (avatar images), Claude (scripts written as actions, hook variations), TikTok (reference frames), ElevenLabs (b-roll-only voiceover).
setup: avatar image = opening keyframe; product image + product name matching the script; 9:16; paste script; seedance or google omni where the voice carries the ad; check preview (length, image count, clip count) before spending.
character sheet first: each character designed with colour palette and expressions before any frame exists — holds one face across scenes; breaks on tools generating each clip independently.
read the scene proposal: same person every scene; setting and lighting consistent; camera position holds; product appears where the script says. critique a miss in plain language and regenerate that scene alone. the tool trims silent gaps ai generations leave, matches audio to each clip, stitches. captions/overlays in editor.
length: other generators stop at 8-15s, so a 50s ad = 7 renders joined; every join is a chance for face/light/room to shift. one generation with the character locked removes those failure points.

## pre-ship checklist
face holds across every scene; voice matches the room (echo, background tone); eye contact on camera; hands move while talking; pacing has stumbles; setting suits the claim; product appears where intended; captions match platform styling.
expect to keep 60-70%. 30 usable ads ≈ 45 generations.
test: ~$20/day per creative, read ctr first and hold rate second, cut anything under 1% ctr by day 3.
the ads that print are often not the most realistic: claymation, pixar and story formats regularly outperform a perfect talking head. attention is the constraint; believability is only the entry ticket.
