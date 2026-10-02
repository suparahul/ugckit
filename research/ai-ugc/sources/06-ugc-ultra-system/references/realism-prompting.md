# Realism + Generation Prompting

## Creator reference: five layers

### 1. Remove AI-coded glamour language
Avoid: flawless, ethereal, stunning, porcelain, dewy, curated, luxury, sharp-cheekboned, model energy, cinematic beauty, “natural beauty,” or vague “realistic.”

### 2. Name imperfections by location
Examples:
- visible pores on nose/forehead;
- faint redness around nostrils;
- healing blemish near left jawline;
- dry patch at mouth corner;
- under-eye darkness;
- asymmetrical freckles;
- one eyebrow slightly higher;
- flyaways at crown / one strand on cheek.

Use only plausible, non-extreme details. If a real face reference exists, do not invent marks that are not visible.

### 3. Use a lived-in environment
Unmade pillow, charging cable, half-drunk glass, hoodie on chair, clutter that looks ordinary rather than styled.

### 4. Use phone-camera language
Good:
`iPhone front-facing camera, raw unedited phone photo, natural lens distortion, slight chromatic aberration around high-contrast edges, mild grain in shadow areas`

Avoid pro-camera/editorial vocabulary when the goal is native UGC.

### 5. Anti-polish negative

```text
no flash, no ring light, no studio lighting, no color grading, no skin smoothing,
no beauty filter, no airbrushing, no AI-aesthetic styling, no posed model energy,
no curated background, no commercial polish, no cinematic look. The image should
look like ordinary phone footage, not a polished content-creator shoot.
```

## Fill-in creator image prompt

```text
Ultra-realistic vertical phone selfie of a [age band] [person], taken at a slightly
awkward casual angle as if the camera was opened quickly.

HAIR: [length, color, texture, style], [ordinary imperfection].
SKIN: [tone/undertone], visible pores on [area], [localized redness/blemish],
[freckles/moles only if chosen/visible], under-eye darkness, [dry patch].
EYEBROWS: [shape], slightly uneven.
EYES: [color if known], natural moisture catchlights, slight lash irregularity.
LIPS: bare, slightly dry, asymmetrical at rest.
OUTFIT: [ordinary clothing], [wrinkle/fit detail].

Camera at [height], phone [held/propped], mild lens distortion, slight motion blur
where physically plausible.

ENVIRONMENT: [ordinary room + small clutter], [light source and direction].

Vertical 9:16, raw unedited phone-camera look, mild shadow grain, no flash, no ring
light, no studio lighting, no color grading, no skin smoothing, no beauty filter,
no airbrushing, no AI-aesthetic styling, no posed model energy, no curated background,
no commercial polish, no cinematic look.
```

## Expression sheet

Generate from the same base identity, preferably image-to-image:
1. neutral;
2. mid-sentence;
3. real laugh with eye creasing;
4. listening;
5. surprised;
6. looking away.

## 11-block video prompt order

1. Opening style paragraph
2. CHARACTER
3. ENVIRONMENT
4. VOICE
5. TIMELINE
6. LIP SYNC
7. PHYSICS
8. CAMERA
9. LIGHTING
10. STYLE + NEGATIVES
11. SOUND

Earlier blocks receive more weight in many models, so identity/scene should appear before decorative language.

## Reliable 15s beat template

```text
00:00-00:02  Hook
00:02-00:04  Product reveal
00:04-00:06  Setup / first action
00:06-00:08  Hero demo
00:08-00:10  Proof / reaction
00:10-00:12  Second use / consequence
00:12-00:14  Fast payoff details
00:14-00:15  Soft close / CTA if needed
```

Do not force this template when the winning reference has materially different timing. It is a default, not a law.

## On-camera dialogue anchors

When the model must visibly speak to camera, make the beat unambiguous:
1. face stays visible in selfie position;
2. direct eye contact and clear natural mouth movement;
3. explicit lip-sync instruction.

Put physical action before the spoken line when possible so the model does not blend incompatible actions.

## Physics

Always add content-specific physics.

Examples:
- liquids: proper surface tension, gravity, no floating droplets;
- impact/debris: believable mass and uneven fall;
- hair/fabric: subtle flyaways, natural drape;
- handheld object: weighted grip, fingers maintain contact;
- app/phone: screen stays planar, no warping through fingers.

## Video negative base

```text
no CGI sheen, no plastic skin, no airbrushing, no beauty filter, no warped hands,
no extra fingers, no stiff movement, no robotic face, no bad lip sync, no jitter,
no flicker, no glossy commercial lighting, no studio lighting, no commercial color
grading, no unintended slow motion, no posed model energy, no identity drift,
no warped labels, no distorted packaging, no fake branding
```

Add task-specific negatives after a failure rather than bloating every prompt with irrelevant bans.

## Seedance 2.5

For exact Seedance 2.5 syntax and advanced operations, read `seedance-2-5-prompts.md`.
