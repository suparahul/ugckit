---
name: originate
description: Stage 5, research-led — write prompt.txt from a teardown and the hook library instead of from a reference video. Same contract and same output as script; stages 6–9 are unchanged.
---

# Stage 5 — originate

The other way into stage 5. `script` recreates a reference video; this originates one from
research, for when there is no clip — or when the research found a better idea than the
clip did.

Same output, same place, same limit: `pipeline/05-prompt/<project>/prompt.txt`,
**under 5000 characters — count with `wc -m`, not `wc -c`.** Stages 6 through 9 cannot
tell which skill wrote the file, and must not be able to.

    scripts/state.py entry <project> research

Marks stages 1–4 as not applicable so the state file stops asking for a video that will
never exist.

## What you are working from

The project's own research, if R1–R5 ran: `research/<project>/PRODUCT.md` if R0 wrote
it, every `research/<project>/<app>/TEARDOWN.md`, and the `HOOKS.md` files under them. Read the teardown in full — headings 4, 5, 6 and 11 are the
brief.

The standing corpus, wherever `LIBRARY_DIR` points:

    scripts/library.py stats                              what is in it
    scripts/library.py templates --format video --top 8   the hook structures, ranked
    scripts/library.py hooks --template <id> --top 20     every real hook using one
    scripts/library.py formats                            what the video actually IS
    scripts/library.py mechanics                          how the product gets on screen
    scripts/library.py teardowns                          other apps' full write-ups

Query it; never read `hooks.jsonl` directly. It is thousands of lines and it will crowd
out the work.

**A hook is quoted from the corpus verbatim, or it is a stated variation on a named
template.** Typos, capitalisation and emoji are the source's and stay. If you write a new
line, say which `template_id` it varies and what you changed. Do not attach a view count
to a line that did not earn it — inventing evidence is worse than having none.

## Choosing the hook, the format and the mechanic

Three decisions, in this order:

1. **The hook template.** Pick on `best_views` and `posts_over_1m` rather than median —
   this is an outlier business and the median mostly measures how often a template gets
   used badly. Check `when_to_use` actually describes the user's product.
2. **The format.** From `library.py formats` — what the piece *is*: reaction to a screen
   recording, talking head, two-slide meme, POV skit.
3. **The mechanic.** From `library.py mechanics` — where the product sits and what the
   viewer is asked to do. **This is what picks the flow:** a mechanic that puts the app on
   screen means `insert.json` and the green-screen route; one that keeps the product in the
   caption or the bio means `prompt.txt` alone.

Show the user all three with the evidence — template id, best views, an example url — and
get agreement before writing the prompt.

## Structure that works

The same sections, in the same order, as stage 5. Do not invent a different layout:

`opening look` · `STRUCTURE` (shot count, exact cut times) · `SUBJECT` · `SETTING` ·
`ANIMALS/PROPS` · one block per `SHOT` with second-by-second beats · `THE PHONE SCREEN`
if applicable · `PERFORMANCE` · `AUDIO` · `DIALOGUE` · `NO TEXT`.

Everything in `script`'s "Things that measurably matter" applies here unchanged — read
that skill before writing. In particular, carried across because they decide whether the
composite reads as real:

- **Green screen spec, when compositing:** flat solid uniform chroma-key green,
  RGB 0 177 64, edge to edge, no app/icons/text/status bar/clock/wallpaper, no reflection
  or gradient, identical shade in every frame, and the phone body and hand look normal —
  only the screen is green.
- **The phone must be locked still**, stated explicitly and at length:

      The phone is completely stable throughout the shot: held rigid in one position,
      filling the same part of the frame in every frame. It does not drift, rotate,
      tilt, sway, shift toward or away from camera, or get re-gripped. Her wrist and
      forearm stay locked. The camera holds still on it. The screen stays fully visible,
      square-on and unobstructed at its edges from the first frame to the last.

- **The thumb maps to the app recording beat for beat.** Watch the recording, list its
  events with timestamps, write the thumb beats from that list, reuse the list for
  `insert.json`. There is no reference video here, but there is still a real recording —
  it is the only thing the compositor can warp to.

## Where the shot structure comes from

With no reference clip there is no measured cut list. The shot count and the cut times
come from the format's shape in `library.py formats` and from heading 4 of the teardown —
`0–4s face to camera · hard cut at 2–6s to the screen recording · payoff` is a structure,
and it is evidence-backed.

Write it as **exact times anyway**: "hard cut at exactly 5.0s", never "then it cuts".
Stage 7 measures what the model actually did against what the prompt asked for, and it
cannot measure an adjective.

Keep it inside the model's cap — `scripts/state.py model` says how many seconds you have.
Fifteen seconds is three or four shots, not six.

## The dialogue

The hook is on screen; the dialogue is what is spoken over it. They are not the same line
and should not be the same words — the corpus hooks are text overlays. Write the spoken
lines yourself, in the voice heading 5 of the teardown describes, and give every line its
own delivery note. A flat read comes from a flat prompt.

## Before you hand off

    wc -m pipeline/05-prompt/<project>/prompt.txt
    scripts/state.py set <project> script done

`originate` completes stage **`script`** — the same stage, the same artifact, a second
producer. It does not get a stage of its own.

Show the user the dialogue and the chosen hook with the evidence behind it. Once they
agree the words are frozen: change delivery direction, not wording, unless they ask.
