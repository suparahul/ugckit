# Enzo (@enzoxmotion) — "how to ACTUALLY build yourself an ai ugc team (with json prompts)"
Source: https://x.com/enzoxmotion/status/2103542414119936125 (Sep 25, 2026, 196K views). Text captured from the X article; images not captured.

i run four ai creators 0 of them exist, and none of them have looked different from one post to the next since the day they were made. that second part took way longer to figure out than the first.

anyone can generate a good-looking creator once. what gives ai ugc away is almost never a single image, it's the feed. scroll back ten posts on a bad ai account and the jawline changes, the hair gets shorter, the ring disappears, the room is a different room.

so the job was never "make a creator". it was making the same creator show up a hundred times, across slideshows and full videos, without anyone being able to tell.

## why paragraph prompts drift
a normal prompt is a sentence. "woman in her 20s, curly black hair, gold jewelry, selfie in a car, natural light." the model reads that as a mood (not a set of rules). every generation it re-decides what "curly" means, how much jewelry counts as gold jewelry, where the camera sits. you ONLY get something close each time, and close is exactly what makes a persona look fake.

json fixes this for one boring reason. it forces you to split what's allowed to change from what isn't and then tell the model which is which. the rest of this runs on that split, one file that never changes, one file that changes every post and a handful of smaller files for the jobs around them.

## the creator file
every creator on the team gets one json file that never changes. identity only (nothing about what they're doing in any particular post).

```json
{ "creator_id": "noon", "identity_lock": { "age_appearance": "mid-20s", "face": "soft oval, gently tapered jaw, defined natural cheekbones", "eyes": "almond-shaped, warm brown, long natural lashes", "brows": "full, softly arched, deep brown", "skin": "warm medium tan, golden undertone, visible pores, faint freckles on nose", "hair": "very long, thick black spiral curls, near-center part", "signature_details": [ "thin gold chain with small pearl", "small gold hoops", "almond nails, nude pink, slightly chipped on left thumb" ] }, "voice_profile": { "tone": "warm, slightly dry, talks fast when excited", "verbal_habits": ["starts sentences with 'okay so'", "never says 'guys'"], "accent": "neutral american" }, "camera_habits": { "device": "front-facing smartphone camera", "lens": "24-28mm equivalent", "distance": "arm's length", "height": "slightly above eye level", "processing": "subtle hdr, mild phone sharpening, no beauty filter" }, "never_change": ["face", "hair", "signature_details", "skin texture", "voice_profile"] }
```

the signature details matter more than they look. somebody who wears the same necklace in every video reads as a person. change it once and people start noticing. the chipped nail is deliberate too. small imperfections that repeat are what make a face feel lived-in rather than generated and they give you something to check against when a generation drifts.

the voice profile sits in the same file on purpose. when this creator ends up in a video later, the script writer and the voice model are both reading from the same identity (instead of guessing how she talks).

## the shot file
the second file is what changes per post: wardrobe, room, action, the one thing that happens in the frame.

```json
{ "shot_id": "noon_morning_routine_03", "creator_ref": "noon", "wardrobe": "oversized grey hoodie, sleeves pushed up", "location": { "room": "small apartment bathroom", "details": "white square tiles, one towel hanging crooked, toothbrush cup on the sink", "light": "morning window light from camera-left" }, "action": "holding the product up to camera mid-sentence, other hand pushing hair back", "product_placement": { "visible": true, "label_facing": "camera", "size_in_frame": "roughly a fifth of frame height" }, "priority_order": [ "identity from creator file", "same camera habits", "product label readable", "requested wardrobe only", "requested location only" ], "negative_prompt": [ "different face", "shorter hair", "missing jewelry", "plastic skin", "studio lighting", "perfectly tidy room", "extra fingers", "warped product label", "text", "watermarks", "ui overlays" ] }
```

the priority_order block is the WHOLE TRICK. it tells the model what it's not allowed to touch before it gets to touch anything. identity sits at the top, and the stuff you actually want to change sits at the bottom where the model gets the least freedom.

the negative prompt does the opposite. plastic skin and warped hands are what kill these posts instantly, so they get banned every time. "perfectly tidy room" is in there because a real bathroom always has something slightly off in it.

you merge the two files per generation. creator file stays fixed, shot file rotates. (that's how the same person ends up in fifty different rooms without turning into someone else).

## turning one creator into a team
once one creator holds together, adding more is mostly copying the file and changing the identity. four creators, noon, oka, sua and suvi. each one owns a lane so the formats don't all start looking like the same person made them.

```json
{ "roster": [ { "creator_id": "noon", "lane": "skincare morning routines", "formats": ["slideshow", "talking head"] }, { "creator_id": "oka", "lane": "unboxing reactions", "formats": ["talking head"] }, { "creator_id": "sua", "lane": "day-in-the-life product use", "formats": ["slideshow", "b-roll voiceover"] }, { "creator_id": "suvi", "lane": "close-up swatches", "formats": ["talking head"] } ], "rules": { "one_creator_per_post": true, "no_creator_outside_lane": true, "max_posts_per_creator_per_day": 3 } }
```

the team isn't only faces though, around the creators there are separate jobs and splitting them is what stops the whole thing turning into one giant chat window. research runs first, pulling formats that are already working in a niche and ranking the hooks. scripts come after, written against those formats and assigned to one creator. every job gets its own prompt and its own json, so when a batch comes back bad you can see which step broke.

```json
{ "research_brief": { "niche": "skincare for acne-prone skin", "sources": "tiktok most-liked, last 30 days only", "validity_checks": [ "same hook structure appears on several different accounts", "works outside this exact niche", "product can be introduced naturally, not on slide one" ], "output_per_format": ["hook", "slide or shot count", "pacing", "where the product appears", "top comments"], "ignore": "single viral posts from accounts with no other hits" } }
```

the last line in that brief saves a lot of wasted weeks. one viral post can be the only hit an account ever had (copying it means copying luck).

## slideshows
slideshows are where i'd start anyone, since they're the cheapest format to test and the easiest to keep consistent. the whole deck gets planned as one file before a single image is generated.

```json
{ "deck_id": "noon_acne_rules_07", "creator_ref": "noon", "format": "ranked list, strongest item last", "slide_count": 7, "hook": "things my dermatologist made me stop doing before my skin cleared", "slides": [ { "n": 1, "role": "hook", "visual": "noon selfie, bare skin, slightly tired", "text": "hook line" }, { "n": 2, "role": "item", "visual": "pillowcase close-up, no face", "text": "changing my pillowcase once a month" }, { "n": 3, "role": "item", "visual": "phone screen held near cheek, no face", "text": "holding my phone against my face on calls" }, { "n": 4, "role": "item", "visual": "bathroom shelf with too many bottles", "text": "using five actives at once" }, { "n": 5, "role": "product", "visual": "noon holding the product in bathroom", "text": "what i switched to instead, said like the next line of the story" }, { "n": 6, "role": "item", "visual": "hand touching jawline, no face", "text": "picking at it when it's healing" }, { "n": 7, "role": "payoff", "visual": "noon selfie, same angle as slide 1, clearer skin", "text": "the one that made the biggest difference" } ], "rules": [ "product never on slide 1", "never end on the product", "slide 1 exists only to earn slide 2" ] }
```

half the slides don't have a face in them at all, on purpose. slides without a face read more like a real person's camera roll and they're also the ones least likely to drift. the face slides get their own image file built from the creator file and a short shot file, the faceless ones get a lighter spec that only locks the look.

```json
{ "slide_image": { "deck_ref": "noon_acne_rules_07", "slide": 2, "subject": "white pillowcase, slightly creased, one faint makeup mark", "framing": "top-down, phone held above bed", "light": "soft morning light, slightly warm", "look": { "grain": "light phone sensor noise", "color": "muted, slightly warm, no heavy contrast", "sharpness": "phone-level, not studio-level" }, "negative_prompt": ["perfectly ironed", "product placement", "text", "watermark", "studio lighting"] } }
```

text NEVER goes inside the image. the hook gets typed into tiktok natively, by hand, and the slide text is laid over in the editor using one fixed spec so every deck looks like it came from the same phone.

```json
{ "text_overlay": { "font": "arial bold", "color": "white", "outline": { "color": "black", "thickness": "35-45" }, "line_spacing": "0.9-1.0", "alignment": "center", "words_per_line": "4-7", "canvas": "1080x1920", "safe_area": "keep top and bottom clear of ui" }, "export": { "resolution": "1080p, not 4k", "grain": "2-3%", "compression_pass": "send through a messenger app and download it back before posting" } }
```

the export block is the part that makes the deck blend into a feed. 4k reads as produced, and a single compression pass takes the too-clean edge off.

## turning them into ugc videos with higgsfield and gpt astra
SLIDESHOWS PROVE A FORMAT WORKS. videos are where it scales. higgsfield connects to chatgpt over mcp, so gpt-6 astra can write the video prompts and push them straight into the video model without anyone switching tabs. astra's job here is narrow, it gets one format from the research brief and stays inside it.

```json
{ "astra_task": { "locked_format": "skincare morning routine, product as the fix, 20-30 seconds", "creator_ref": "noon", "do": [ "write 15-20 hooks for this format only", "rank them, one line explaining each ranking", "write a beat-by-beat script for the top 3" ], "do_not": [ "invent a new format", "mention the product in the first 3 seconds", "end on the product" ], "voice": "use voice_profile from creator file" } }
```

the top scripts become shots, each shot starts from a still built with the creator file, so the face is already locked before any motion gets added. (the video prompt only describes what moves).

```json
{ "video_shot": { "script_ref": "noon_morning_routine_hook_02", "start_frame": "still from creator file + bathroom shot file", "duration_seconds": 6, "camera": "handheld selfie, small natural wobble, no cuts", "motion": [ "0-2s: leans into camera, squints at skin", "2-4s: picks product up off the sink", "4-6s: holds it next to cheek, half-smiles" ], "keep_fixed": ["face", "hair", "jewelry", "room layout", "light direction"], "negative_prompt": ["morphing face", "melting hands", "label changing between frames", "camera cuts", "slow motion"] } }
```

short shots hold together much better than long ones. a 6 second clip with one simple action rarely drifts, while a 30 second one-take usually does somewhere in the middle, so longer videos get built from several short shots stitched together.

the voice runs off the same identity, the script and the voice profile go in together, so the pacing matches how this creator actually talks.

```json
{ "voiceover": { "creator_ref": "noon", "script_ref": "noon_morning_routine_hook_02", "delivery": "conversational, slightly rushed on the hook, slower on the product line", "room_tone": "small tiled bathroom, faint echo", "imperfections": ["one small breath before the product line", "no studio compression"] } }
```

then captions go on with the same text spec as the slideshows, and it goes through the same export pass.

## the part that doesn't get automated
nothing posts without a person approving. dashboard: 49 clips made, 23 approved, 6 rejected, rest rendering or waiting. average hook hold 65%, spend around $2.02 per clip. rejections are usually hands or a face that drifted just enough to notice, or a product label that came out as gibberish halfway through a video. the json cuts those down a lot, it doesn't get them to zero. the check itself is a file too.

```json
{ "approval_check": { "identity": "face, hair and jewelry match the creator file", "hands": "five fingers, nothing melting", "product": "label readable and unchanged across frames", "product_timing": "not in the first 3 seconds, not the last thing on screen", "ai_label": "ai-generated disclosure turned on before posting", "decision": ["approve", "reject", "regenerate this shot only"] } }
```

## what i'd tell someone starting this week
BUILD ONE BEFORE YOU BUILD FOUR! get the same face through twenty generations before you worry about anything else. keep the creator file boring, every word in the identity block is a word the model has to obey. start with slideshows even if videos are the goal: a format that can't hold attention as still images won't suddenly start converting once it moves. treat the json as a spec, it makes the model consistent. whether the content is actually good still comes down to the format and the hook.
