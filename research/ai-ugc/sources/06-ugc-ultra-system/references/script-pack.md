# One-Face 50 Script Pack

Mode B only.

## Script rules

- Exactly 50 cards.
- 15 TH, 15 HT, 10 BA, 10 CF.
- Hooks are the first spoken line, not a title.
- Hook length: usually 6-14 words.
- Each script: roughly 8-18 seconds.
- One idea per card.
- One visible proof beat.
- Spoken language should sound like a person, not ad copy.
- No fake stats or invented product screens.
- No second creator.
- Avoid filler closers such as “game changer,” “obsessed,” “you need this,” or using “link in bio” as the entire payoff.

## Card shape

```text
{ID} · {format name} · {seconds}s
hook: {first spoken line}
say:
- {line}
- {line}
- {line, optional}
show: {what the locked product does, in order}
cut: {none, or the one allowed cut}
PROMPT
{creator lock pasted exactly}
{product lock pasted exactly}
shot: {this card only}
hold: same face, same voice, same lighting, frame 0 to last frame
```

For production-ready packs, expand `PROMPT` using the 11-block structure in `realism-prompting.md`. For script-only packs, the compact block above is enough unless the user asks for model-ready prompts.

## Format constraints

### TH 01-15
Talking head. Face does the work. Product may flash once. Hook → proof → stop.

### HT 16-30
One app/product job. Three beats max. In one-face mode, creator remains visually present while demonstrating when practical.

### BA 31-40
Same creator, room, clothes, and lighting. The change is behavior/product state, not a makeover or “weeks later” face change.

### CF 41-50
Small admission → product is the fix they already use. No melodrama. Keep it close and specific.

## Variation discipline

Do not generate synonyms of the same hook 50 times. Vary:
- pain point;
- moment of use;
- proof beat;
- social context;
- failure avoided;
- result shown;
- camera behavior;
- pacing;
- emotional temperature.

Do not vary identity.
