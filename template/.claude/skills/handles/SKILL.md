---
name: handles
description: Phase 6 — create one handle identity at a time, in five steps: role and name, persona, references, profile picture and bio, defaults. Each step ends in a file under apps/<slug>/handles/<handle>/. The user creates the accounts (TikTok, and Instagram when the identity reposts there) and ticks; the agent writes. No cost through Monid.
---

# Phase 6 — the handle identities

No script of its own; the references come from the `persona-identity` stage. One handle
at a time, one step at a time, from the rows of `strategy/ACCOUNTS.md`. The sixth step
of the Organic Factory UI's list, the connection to the posting service, is **not** here: it runs at
the first send (`posting-provider`). A handle is complete for this phase at five steps.

Read first: `strategy/ACCOUNTS.md` (the role, the subject, the pattern, the cadence),
`brain/ACCOUNT-ARCHITECTURE.md` Layers 1 to 3 and 6, `niche/architecture.md` (both
sources), `niche/learnings.md`.

## The five steps

Each step ends with a file or a section, and where the user acts, with the tick or the
approval line the Organic Factory UI writes to the log. Say "tick it on the handle page when done"
(http://localhost:3210/app/<slug>/handle/<handle>) and read `task.done`; do not wait
silently.

**1. Role and name.** From the row's pattern, propose three handle strings; check each
is free on TikTok only if the user asks (there is no free way to check from here). The
user picks one and **creates the account on TikTok by hand**, then ticks "created".
Write `HANDLE.md` with the head lines:

    # @hannah.catmom
    Handle: @hannah.catmom
    Platform: tiktok
    Role: main persona
    Tier: persona handle
    Created: <date the user ticked>

Then ask one question: **does this identity also post on Instagram?** Instagram is a
repost of the same decks (the research stays TikTok only). When the answer is yes:

- propose the Instagram name. It may differ from the TikTok one (`@hannah.catmom_`
  when `@hannah.catmom` is taken there); nothing derives one from the other;
- the user creates the account in the Instagram app by hand and makes it a
  **professional account** (Business or Creator: Settings → Account type and tools).
  Publishing through the posting service works only on a professional account; a
  Facebook Page is not needed;
- write the `## Accounts` table right after the head lines. TikTok stays the primary
  account (`Handle:` and `Platform:` still name it):

      ## Accounts

      | Platform | Account | Created | Role | Status |
      |---|---|---|---|---|
      | tiktok | @hannah.catmom | 2026-09-14 | primary | connected |
      | instagram | @hannah.catmom_ | 2026-09-22 | repost | not connected |

  The Status cell is for the eye; the truth is `posting-accounts.json`. No table means
  one TikTok account, which is every handle written before this.
- **the 10-slide rule:** from now on every deck of this identity has 10 slides or fewer
  (Instagram's API takes 10 in a carousel). Say so in one line; the `plan` and `deck`
  skills keep it.

**Adding Instagram to an existing identity** is this step for the new row only: ask
the name, the user creates the professional account, write the row (or the whole table,
with the TikTok row first). Steps 2 to 5 stay approved. Then the `posting-provider`
skill connects it.

A handle the user already has: read its profile (`scripts/network.sh <slug> <app>
https://www.tiktok.com/@<handle>` is the method; or the user tells you the bio), fill
the head lines from it, and steps 1 and 4 become "confirm", not "create".

**2. Persona.** Draft `## Persona` from the brain (Layer 3, persona fidelity) and the
niche findings: name, age band, the voice (first person | second person | none), the
named reader, the subject (the exact cats, the room), the place. Short prose and a small
table. The brand handle's persona is the app: no "I", the voice is second person or
neutral. The user approves on the handle page (`persona.approve`) or here.

**3. References.** Rendered subject → run the `persona-identity` stage now: the face
(`references/face.png`), each subject (`references/subject-<name>.png`), the style
photo (`references/style.png`). Real subject → skip; write `## References` with the line
"own camera; references pending" and go on. Write the table:

    ## References
    | File | Role | What it is | Used for |
    |---|---|---|---|
    | references/face.png | identity, when in frame | … | attached when the persona is in frame |
    | references/subject-tabby.png | identity | … | attached to every generation |
    | references/style.png | style | … | style only |
    | references/profile.png | profile picture | … | set on TikTok (and on Instagram) by hand |

The `images` skill reads this table: every row whose role is not the profile picture
is attached to every generation. The user approves each file (`reference.approve`) or
asks for a new one (`reference.reject` with a note); regenerate that one only.

**4. Profile picture and bio.** Generate `references/profile.png` from the face and the
subjects (the `persona-identity` stage again). Draft `## Bio` by the tier's rule: the
persona bio never names the app; the brand bio is the search instruction ("Search
<App> in the App Store"). Quote it in a `>` line, then the rule line. The user approves
(`bio.approve`), sets both on TikTok by hand, and ticks "set on TikTok". An identity
with an Instagram account uses the same picture and the same bio there, and the user
ticks "set on Instagram" too.

**5. Defaults.** Propose from the brain and the findings, and write the head lines
`Format:`, `Dimension:` (3:4 unless the user chooses 9:16: the camera-roll shape, shown
whole with the caption under it, while TikTok covers or cuts the lower ~30% of a 9:16
photo; 109 of 191 cat-niche covers were 3:4), `Slots:` with `Posting zone:` (two a day:
the first 9 AM–1 PM, the last 3–8 PM in the audience's zone, 5–7 hours apart; the kit's
default pair is 11 AM by hand and 7 PM scheduled; measured on 16,165 posts, 2026-09-16,
cross-niche), `Cadence:`, `Sound:` (one library track kept across the account, or an
uploaded clip; never the brand's own sound), `Warm-up:` (as the user states it; "not
recorded" is fine), `Slide style:` (`photo`, the default: the compositor burns the
text; or `illustrated`: the image generator draws the text as part of the picture and
the compositor burns nothing but the callout. The value alone, no fields; the look lives
in the style prefix), then `## Defaults` (product slot, last-slide ask, caption rule, image origin,
named reader, with a source each), `## Style prefix` (the `>` line the deck copies: for a photo handle the shared
phone-photo prefix, for an illustrated one the illustration's look — the medium, the
line, the palette, the paper, and the text's feel: the lettering style and its colour —
in one sentence, then in both cases the identity clause naming the subjects and their
reference files), `## Identity rule`, `## Post-process step`. The user approves
(`defaults.approve`).

The head lines and sections are the ones `apps/README.md` lists; the Organic Factory UI reads them by
name, so keep the spelling.

## Finish, per handle

Say "complete at five steps; the posting service is connected at the first send". Then
the next handle. When every row of `ACCOUNTS.md` has a folder:

    scripts/state.py set <slug> handles done

Then run the `app-fit` skill.
