# Jason Zhou (@jasonzhou1993) — "How to run your first AI UGC campaign (step-by-step guide)"
Source: https://x.com/jasonzhou1993/status/2099837130927427989 (Sep 15, 2026, 174K views). Text captured from the X article; images not captured. (Author built and promotes treg.)

Context: UGC = a normal-looking person talking about an app they "just found", posted from a personal account with ~40 followers. Companies pay people with time but no following $20-50/video to spin up accounts. Goal: $4-6/video with AI.

## Step 1: Find what's already working in your vertical
A UGC video is two parts: the hook (first 3 seconds, most important) and the demo (showing the product). Scale = one demo paired with 5-10 different hooks, then test which lands.
Before generating, pull trending videos in your vertical and study: how hooks are built, and which faces/characters resonate. Same script, different person, completely different impression.
Then the hard part: take a real person whose vibe works and generate a DIFFERENT person with the same vibe; build an account around that character.

## Step 2: Generate a character with a vibe
GPT Image 2.5 and Gemini 3 Pro on a presenter screenshot: both looked wrong with a normal prompt. A friend's prompt fixed it: same models, character now looks like a real person, different from the reference, same vibe.
The trick: restrict the model's exploration space — force a definition, in JSON, of every detail it would otherwise fill with defaults. Every image model has defaults: eyes slightly too big, doll-ish face; and "4K, 8K, ultra detailed" yields the HDR over-sharpened AI look. Specify face structure, skin texture, lighting, camera, expression, clothing, background; with no room to revert to defaults, slop stops.
This became the portrait-clone skill (feed a screenshot, get a new character): https://github.com/agentara/skills/blob/main/skills/aigc/portrait-clone/SKILL.md
Model matters even with the right prompt: same JSON across five models — GPT Image 2.5 still has doll-face eyes; Gemini 3 Pro most realistic. Generate on GPT Image 2.5, Gemini 3 Pro and Seedream side by side; pick the winner.

## Step 3: Make the character talk
Feed the character image to Seedance 2.5 as image reference + a script; works well from a single image.
Problem: Seedance 2.5 refuses hyper-realistic reference images by default (anti-impersonation). Workarounds: Higgsfield exposes a bypass endpoint but at 2-3x cost; the proper route is BytePlus directly — advanced creation rights let you upload an image and register it as a digital character asset, then generate from it (approval hurdles). treg wraps this at BytePlus price.
Voice trick: default voice is off in rhythm. Clip audio from the original trending video you liked and pass it as an audio reference; rhythm and delivery transfer. Too many details in speech to describe in text — let the model copy.

## Step 4: The demo — the character doesn't need to be in it
To cut cost, the demo section shows no character: just a screen recording of the product on the phone. Clone the voice (Fish Audio) from the same original audio clip, generate the voiceover, stitch with screen recording + captions. One demo clip, then pair with many hooks.

## Step 5: Generate hooks at scale
Pull top videos from reference accounts doing this well; extract hooks from transcripts. Example (Composio, 3.3M impressions): "They emailed over five million people and asked each for one dollar. What if you emailed every millionaire in the world and asked for just one dollar?" — showing off a Gmail integration.
Pattern: a stunning claim, a specific number, and a result.
Example written in that pattern: "3 AM last night, my agent was researching hundreds of customers and emailing each of them to book meetings for me. I woke up to 12 replies and 4 meetings on my calendar. Here's exactly how I set it up."
Then: Seedance 2.5 + character image + audio reference → video. A talking-head skill writes script, sets duration, grabs voice ref, writes the Seedance prompt, adds captions and headers (https://github.com/superdesigndev/treg). 4 clips for $2.67 total.

## Harder videos
Software demos: one character image is enough. Complex videos: design the character from multiple angles, build a storyboard with an image model, then feed storyboard + character to Seedance 2.5.

## Full loop
1. Pull trending videos in vertical, study hooks and faces
2. Generate a new character with the vibe (JSON prompt, Gemini 3 Pro)
3. Register character on Seedance 2.5, use original audio as reference
4. Record demo yourself, clone the voice, stitch
5. Extract hooks from top performers, generate 5-10 variants, A/B test
