# Creator Lock + Product Lock

Write each lock once. Paste it. Do not casually paraphrase per card/version.

## CREATOR LOCK

```text
CREATOR LOCK
name: {first name used only as a prompt label}
face: {face shape, skin, hair, visible ordinary distinguishing detail; no glamour language}
imperfections: {6-8 localized visible details if creating the face from scratch; otherwise only details actually visible in the reference}
voice: {pace, pitch, rhythm, filler habit, regional accent only if requested/known}
lighting: {source, direction, color temperature}
wardrobe: {one top / locked outfit, color, hair state}
room: {one ordinary room + 1-3 objects; optional locked second setup only if needed}
camera: {front/rear, height, handheld/propped, lens behavior}
negative: no second person, no face swap, no age change, no makeup change, no unplanned new room, no unplanned new outfit, no identity drift
```

### Creator rules
- If a face image exists, describe only what is visible.
- If no face exists, cast one ordinary specific person once and freeze them.
- Avoid model/glamour words.
- Same voice wording across one creator’s generations.
- In Mode B, no friend/partner/stranger B-roll.
- When the creator speaks, keep enough face visibility for lip-sync continuity unless the chosen beat is explicit voiceover.

## PRODUCT LOCK

```text
PRODUCT LOCK
product: {name from the user or visible asset}
one line: {what it does, cleaned but not turned into hype copy}
visual: {what is actually visible: screen, packshot, device, label}
colors: {2-4 visible colors}
must show: {one proof beat that demonstrates the core job}
must not: fake logos, fake notification counts, unreadable invented copy, altered packaging, different app icon, unsupported claims
```

If the one-liner and image disagree, trust the image for appearance and the user’s line for function, unless that would create a factual contradiction.

## Reference binding

When an actual creator reference is attached:
- bind it explicitly as the appearance source;
- do not ask text to reinvent the face;
- reinforce only stable visible traits/imperfections required to resist smoothing.

When a product contains readable text/branding, use a clean product reference whenever possible. Video models are weak at inventing stable type.

## Start-frame rule

For clips where a person will speak or materially interact later, include them in the start frame whenever the target video model benefits from it. In strict one-face sequences, do not introduce an unseen second human mid-clip.
