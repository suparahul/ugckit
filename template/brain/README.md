# The brain

Six files, shipped by the kit and replaced on every upgrade. Do not edit them: the
installer overwrites them and they are marked read-only on disk.

| File | What it holds |
|---|---|
| `learnings-slideshows.md` | What the evidence says about TikTok slideshows for apps: format specs, hook shapes, saves over watch time, product insertion, how to find and vet a format. Quotes are verbatim; the rest is a synthesised guide with a source key. |
| `SLIDESHOW-ANATOMY.md` | The parameters of one photo-mode post, in five layers. One heading per parameter, one table per heading, one row per value seen. A post table at the end, one row per post read. |
| `ACCOUNT-ARCHITECTURE.md` | The parameters of the account that posts, in seven layers: handle, bio, identity, tier, scale and cadence, sound, set-up. An account table at the end, one row per account read. |
| `VIDEO-ANATOMY.md` | The slots of one planned character video, in seven layers: inherited, intent, structure, hook, product, cast and world, audio and text. The compatibility rules and the production capability of each value. |
| `video-patterns.json` | The same taxonomy, machine-readable: the controlled values, the twelve hook jobs with their fill slots, the eight beat recipes, the rules, the aliases, the sources and a few annotated examples. The planning skills and `scripts/planning/video_plan.py` read it. |
| `learnings-video.md` | Why the video slots and rules are there, compact, each position labelled observed, claimed, user decision or hypothesis. |

The three files cite the corpus they were written from (`media/<brand>/TEARDOWN.md`,
`SCROLLED-SLIDESHOW-BATCH-2026-09-12.md`, `PLAYBOOK.md`, and so on). Those files are not
shipped. The citations say where a value came from; they are not paths in this workspace.

**Your findings live beside the brain, in the same shape.** For each of your apps the agent
writes `apps/<slug>/niche/learnings.md`, `anatomy.md` and `architecture.md`: the same
headings, the same tables, with a source on every section and every row (`competitor
apps`, `niche`, or `own posts`). Every stage from the niche read on reads the brain and
your findings together, the brain first. Nothing is ever written into `brain/`.

Video planning reads the three video files first, then the local overlay
`apps/<slug>/niche/video/patterns.json` when it exists (it references the inbuilt ids and
adds scoped evidence; it never redefines one), then the app and the handle.
