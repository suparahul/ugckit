# Character pipeline: what the kit knows about each model

**The kit's file. Do not write here:** every kit upgrade updates it. It is how new kit knowledge about a model reaches an existing workspace. Your
own rows go in the failure ledger, `pipeline/character/model-failures.md`, which is
yours and which no upgrade touches.

P1 (`character-shots`) reads this table and the model's table in the ledger before it
writes a prompt. Where the two disagree, a row you measured wins over a kit row.

| Model | Known failure or limit | Source |
|---|---|---|
| every model | hands first, then teeth, then eye movement | creator research |
| every model | captions added unprompted; an animal that vanishes between shots; a hand or prop that swaps sides; a hallucinated object | measured in the kit |
| MiniMax H3 Max, text-to-video and image-to-video (`minimax-h3-max-text-to-video`, `minimax-h3-max-image-to-video`) | 15 s, 768p, $0.04/s in `templates.json` (Supagen now lists $0.08/s and records $0.20 a run); not in the character `models.json` yet; the planned model for a segment with no references (an O plate); tuned for prompt adherence | measured in the kit |
| MiniMax H3 Max, reference-to-video (`minimax-h3-max-reference-to-video`) | **the default for every segment with references.** 5 to 15 s, whole seconds; 480p, 768p, 1080p; generated at 768p; **at most 4 reference images** (the start frame counts), plus video and audio references; no video extension; $0.08/s (Supagen lists the same); sound with the video is not confirmed yet (`models.json`, `audio`). No run yet: no measured failure, no measured output length. | Supagen model record |
| MiniMax H3, reference-to-video (`minimax-h3-reference-to-video`) | 5 to 15 s, whole seconds; 480p, 768p, 2K, 4K; generated at 768p; at most 9 reference images; about $0.06/s at 768p (Supagen lists $0.13/s and records $0.65 a run, `models.json`); **the second choice for a segment with references**, no longer the default; takes the face, the sheets of fixed subjects, earlier frames and a voice clip. Earlier prompts needed guards against an extra animal, a wrong animal size and an object appearing from nowhere. | measured in the kit |
| Wan 3 Prime, alternate (`wan-3-prime-*`) | the only one past 15 s (30 s); in reference mode the app UI came back as nonsense strings and the framing drifted from over-the-shoulder to frontal; green less flat (G std 14.6) | measured in the kit |
| Gemini Omni Flash 1.1, alternate (`gemini-omni-flash-1-1-*`) | best per second, word-perfect dialogue, a true over-the-shoulder, the flattest green (G std 12.3); 10 s cap; a tripod hallucinated into shot; UI ghosting baked into the green; references cannot reach it through Supagen, so it serves only segments with no references | measured in the kit |
| Seedance, alternate (`seedance-2-fast-text-to-video` in `templates.json`: text-to-video, 15 s, 720p, no price yet) | from the sources, on Seedance 2.5 outside Supagen: 30 s in one pass; refuses hyper-real face references by default; mangles on-screen text, always; falls back to narrated b-roll unless on-camera speech is stated in the style, in each stage and in the constraints; counts drift first, so write them as numbers. Not measured here. | measured in the kit; creator research |
| Kling, alternate | not in `templates.json` yet: no template version, no price, no measured failure. It needs both before its first use. | measured in the kit |
