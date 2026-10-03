---
name: video-fit
description: Video planning, step 1 — map every video type the user's plan requests for a handle onto the video anatomy: the slot values, the handle defaults it inherits, the inputs still missing and the production capability gaps. Writes strategy/VIDEO-FIT.md. Never rewrites the strategy, never picks ideas or dates. No script, no cost.
---

# Video planning, step 1 — the video fit

No script, no cost. Runs once per handle that has a video in the user's plan, and again
when the plan adds a video type. `app-fit` calls it when a video arm is requested.

**Coverage, not redesign.** The user's plan chose the content. This step checks that each
requested video type can be expressed and executed, and says what it needs. It never
changes a handle's role, rules, topics, hooks, dates or cadence; it never drops a requested
format because another one scores better; it never decides which idea posts on which day.
A requested type that production cannot make yet stays requested, with its gap named.

## Read, in this order

1. The brain: `brain/VIDEO-ANATOMY.md` (every slot), `brain/video-patterns.json` (the
   controlled values, the twelve hook jobs, the eight recipes, the rules),
   `brain/learnings-video.md` for the reasons.
2. The local overlay, when it exists: `apps/<slug>/niche/video/patterns.json` (scoped
   evidence on the same ids). None yet: say "starter-backed", and go on; do not block.
3. The user's plan: `strategy/HANDLE-STRATEGIES.md`, `production/PLAN.md`, or the file the
   user names. Read the handle's section in full: who the handle is, its rules ("Never…"),
   its video formats, its hook table and its dated rows.
4. The handle and the app: `strategy/ACCOUNTS.md`, `handles/<handle>/HANDLE.md`,
   `handles/<handle>/world.json`, `handles/<handle>/characters/*/creator.json`,
   `handles/<handle>/narrators/*/narrator.json`, `APP.md`, `product.json`,
   `screens/screens.json`.
5. Production capability: `scripts/character/capabilities.json` when production declares
   it; otherwise every `bridge.*` capability is "not declared" (`VIDEO-ANATOMY.md`
   § Production capability).

## Write `apps/<slug>/strategy/VIDEO-FIT.md`

One file per app, one section per handle. Keep the shape; the planner and a future UI read it.

    # Video fit — <App> on the video anatomy
    <date> · taxonomy <taxonomy_version> · catalogue <catalogue digest, first 12>
    Status legend: evidence (a sourced observation decides) · claimed (a source claims it;
    no post read) · experiment (the evidence does not decide; the plan tests it) · user (the
    user's plan or decision, dated) · inherited (from HANDLE.md / ACCOUNTS.md)

    ## `@<handle>` — <role in one line>
    Source: <file> § <section>. Rules that bound every video: <the handle's Never… lines, verbatim>.

    ### <video type name, as the plan names it> — disposition: scheduled | candidate | stopped | avoid
    | Parameter | Value | Status | Source ids | Reason |
    |---|---|---|---|---|
    | lane | discovery | user | strategy §@handle | "CatWise is the payoff of every post" |
    | filming_format | hook_to_demo | user | strategy | "reacting face for 2–4 seconds, then the CatWise screen" |
    | hook_job | discovery_regret, imminent_need (per row) | user | strategy hook table | … |
    | recipe | discovery_demo | evidence | potto-teardown, roamy-teardown | … |
    | … every slot of VIDEO-ANATOMY.md that the type fixes … |

    **Inherited defaults:** <slot = value, from where>.
    **Open per video:** <slots the type leaves to each row: the hook fill, the screen, the topic>.
    **Missing inputs:** <one line each: what, owner (founder | part A | capture | production)>.
    **Capability:** <route, e.g. T → R>; runnable | needs <bridge ids>, and why.

Rows use the statuses above and `source_ids` from `video-patterns.json` sources or the
plan's section ids. A slot the plan states is `user`; a slot the evidence decides is
`evidence`; a slot neither decides is `experiment`, with the candidates and the
recommendation, and is walked with the user. A strategy disposition sits beside the row; it
is never merged with the capability or the evidence strength.

## Rules

- Map, do not invent: a hook fill, a number, a result or a credential that the plan does
  not give stays an open slot or a missing input.
- A request that breaks a compatibility rule (a generated real cat, a fake UI, a synthetic
  expert) is reported with the rule id from `video-patterns.json` and the nearest valid
  mapping; the user decides. Do not change the request silently.
- Open founder questions in the plan (a face or only hands, which real cat, an identity not
  yet approved) are missing inputs, owner `founder`, with a recommendation.
- A reaction video maps to hook channel `reaction`: a silent face, the hook as text, never
  spoken (`rule.reaction_silent`). Its performance comes from a real reference reaction in
  the workspace's research, chosen per video by `video-plan` (`rule.reaction_from_reference`).
- Cross-handle facts (the app's screens, product facts) are written once per app, under
  `## Shared inputs`.

## Hooks for later steps (not built in this kit version)

- **Scheduling:** which idea a handle posts on which day stays in the user's plan. When a
  scheduling step exists it writes the rows this step reads; nothing here changes.
- **Video evidence (layers B and C):** when `apps/<slug>/niche/video/patterns.json` exists,
  read it at step 2 and cite its evidence ids in `Source ids`. Until then, rows are
  starter-backed and say so.

## Finish

Report per handle: the video types mapped, rows decided by the plan, by evidence, and left
as experiments, the missing inputs and the capability gaps, in four lines. Then, for a
requested video row, run `video-plan`.
