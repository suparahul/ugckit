---
name: ugc-ultra-system
description: "End-to-end AI UGC ad system: reverse-engineer a winning reference ad, choose the right ad mechanism, cast and lock one believable creator, lock the product/UI, write hyper-real creator/start-frame prompts, generate Seedance 2.5-ready video prompts, produce 50-script one-face packs, and scale winners into controlled multi-creator/product/angle matrices without identity drift. Use for competitor-ad rebuilds, AI UGC scripts, creator consistency, one-face ad packs, realistic phone-footage prompts, Seedance/Kling-style video prompting, product demos, and large variation packs."
compatibility: Claude.ai, Claude Code, ChatGPT, Codex, and agents that read Agent Skills SKILL.md. No external API required.
metadata:
  version: "2.0.0"
  merged_from: "ugc-ad-system + one-face-lock"
---

# UGC Ultra System

One production system from reference ad to scalable AI UGC library.

Core principle: **lock first, vary second.** Most bad AI UGC fails because the model is asked to improvise the person, product, room, voice, camera, and script at the same time. This skill freezes the parts that must remain stable, then changes one deliberate variable at a time.

## Inputs

Work with whatever the user already supplied. Do not interview them if you can proceed.

Minimum useful input:
- a product photo/screenshot or enough product detail to describe what must appear; and
- one line explaining what the product does.

Optional inputs:
- a competitor/reference ad, video, or 4-6 freeze frames;
- a creator face/reference image;
- target audience, angle, platform, duration, or offer.

If the user already supplied enough to act, start. If a visual detail is unreadable, do not invent readable UI, logos, prices, claims, or statistics.

## Choose the operating mode

Pick one mode before writing anything.

### MODE A — Hero Ad Rebuild
Use when the user gives a winning/reference ad and wants one or a few rebuilt ads.

Flow:
1. Scan the reference into a bones sheet.
2. Pick the ad mechanism and production format.
3. Build creator + product locks.
4. Write the creator reference/start-frame prompt if needed.
5. Write the generation-ready video prompt.
6. Run pre-generation QC.

Read:
- `references/reference-scan.md`
- `references/formats.md`
- `references/creator-product-lock.md`
- `references/realism-prompting.md`
- `references/quality-control.md`
- `references/seedance-2-5-prompts.md` only for Seedance-specific syntax/features.

### MODE B — One-Face 50 Pack (default for “50 UGC ads/scripts”)
Use when the user wants a batch, pack, scripts, consistent creator, or “one person filmed everything.”

Rules:
- One creator across all 50.
- Same face, voice, wardrobe, room/light system, and product lock.
- 15 talking-head, 15 how-to, 10 before/after, 10 confession.
- The product must appear in a proof beat.
- Change hook/idea/shot, not identity.
- No second creator unless the user explicitly switches to Matrix Mode.

Read:
- `references/creator-product-lock.md`
- `references/formats.md`
- `references/script-pack.md`
- `references/quality-control.md`
- `examples/focus-loop.md` once for density/quality only.

### MODE C — Controlled Matrix Scale
Use only when the user explicitly wants multiple creators, products, or angles.

Build a matrix before generating:
`creator × product × hook × angle`

Change **one major axis at a time**. Each creator gets a separate frozen creator lock and voice lock. Each product gets a separate product reference/lock. Do not let “variation” become random drift.

Suggested naming:
`c02-p01-a1-h3`

Generation order:
1. product refs;
2. creator hero frames;
3. creator turnaround/expression refs from the hero frame;
4. start frames;
5. videos.

## Universal pipeline

### 1. Scan the reference when one exists
Extract the winning structure, not the creator’s identity or footage. Keep the mechanism, beat map, camera logic, hook shape, reveal timing, and pacing. Replace the human/product as requested.

Use `references/reference-scan.md`.

### 2. Pick two labels: mechanism + production format
A mechanism explains *why the ad works* (reaction+demo, accidental discovery, notification punchline, etc.). A production format explains *how this specific asset is shot* (talking head, how-to, before/after, confession, macro demo, mirror selfie, etc.).

Do not confuse the two. One ad can be “accidental discovery” as the mechanism and “talking head” as the production format.

Use `references/formats.md`.

### 3. Freeze the creator and product
Write one `CREATOR LOCK` and one `PRODUCT LOCK`. Paste them verbatim anywhere consistency matters.

When a creator image exists, describe only visible traits. Do not invent scars, tattoos, age jumps, makeup changes, or backstory.

When there is no creator image, cast one ordinary, specific person once and freeze them. Avoid glamour/model language.

Use `references/creator-product-lock.md`.

### 4. Build a believable creator reference
If an image-generation prompt is needed, use localized imperfections, a lived-in setting, phone-camera language, and anti-polish negatives. “Realistic” alone is not enough.

If the creator must speak, make an expression sheet from the same base identity: neutral, mid-sentence, real laugh, listening, surprised, looking away. Derive all secondary views from the same base image when possible.

Use `references/realism-prompting.md`.

### 5. Write the ad or script pack
For a hero ad, write a tight beat map then a generation prompt. For a 50 pack, use the exact card shape and distribution in `references/script-pack.md`.

Hooks are spoken lines, not titles. Keep them short, conversational, and specific. No fake stats. No generic “game changer / obsessed / you need this” filler.

### 6. Make the video prompt generation-ready
For Seedance 2.5, follow the 11-block order in `references/realism-prompting.md` and consult `references/seedance-2-5-prompts.md` for official syntax, reference binding, staged videos, editing, extension, keyframes, limits, and parameter locks.

For other video models, preserve the same logic even if syntax changes:
- opening style;
- character;
- environment;
- voice;
- timeline;
- lip sync;
- physics;
- camera;
- lighting;
- style/negatives;
- sound.

### 7. QC before shipping
Run both checks:
- **drift check**: identity/product consistency across the pack;
- **generation check**: reference binding, physics, lip sync, camera, visible UI, and impossible claims.

Rewrite failures before output. Do not knowingly ship a failed card/prompt.

Use `references/quality-control.md`.

## Precedence rules

When source rules conflict, follow this order:
1. The user’s explicit current request.
2. Mode rules above.
3. Product/creator locks.
4. Format rules.
5. Model-specific prompting rules.

Important conflict resolutions:
- “One face” applies to Mode B. Mode C may use multiple creators, but each creator is independently locked.
- A reference ad may use multiple people, but Mode B still rebuilds it with one locked creator unless the user asks otherwise.
- Product UI must come from provided visuals or verified text. Never hallucinate readable app screens.
- Do not force phone-in-frame from frame 0 for every possible hero ad. That rule is mandatory for Mode B how-to/before-after cards, and optional elsewhere based on the chosen format.
- On-screen text/captions are allowed only when the brief/reference calls for them. Otherwise keep the generation clean and add text in post.
- If an actual reference image is bound, let the image carry identity. Use the text lock to reinforce stable visible traits and imperfections, not to invent new geometry.

## Output behavior

Return only what the user asked for.

If they ask for one ad: return the bones/locks only when useful, then the final prompt/script.

If they ask for a 50 pack: produce one markdown-ready pack containing:
1. Creator Lock
2. Product Lock
3. 50 script cards
4. Completed Drift Check

If they ask for production-ready prompts too, append a filled prompt block to each card or to the selected winners. Do not pad the response with a strategy calendar unless requested.

The skill writes scripts and prompts. Rendering is handled by the user’s image/video generation tools.
