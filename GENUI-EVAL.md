# Generative checkpoints for the research pipeline: AG-UI vs thesys OpenUI

Written 2026-09-05. A research and evaluation document. No Atlas code was changed.

Sources read for this document:

- The live Atlas at `organic-social/atlas` and the packaged Atlas at `template/atlas`,
  plus the driver `template/scripts/atlas.sh`, `AGENTS.md`, the `network`, `apps` and
  `atlas` skills, `network.sh`, `harvest.sh`, `state.py` and the review UI `ui.py`.
- The AG-UI repository, cloned at commit `54c1558` (2026-09-04): README, licence,
  `docs/concepts/{events,interrupts,tools,capabilities,generative-ui-specs}.mdx`,
  `docs/drafts/generative-ui.mdx`, the HTTP+SSE transport draft, the Python SDK and
  encoder, the TypeScript `core`/`client` packages, the Python `server-starter-all-features`
  examples, the dojo client pages, the A2UI middleware and the Claude Agent SDK integration.
- The OpenUI repository, cloned at commit `1adca3c` (2026-09-02): README, licence,
  `lang-core`, `react-lang`, `react-headless`, `react-ui`, `browser-bundle` and CLI READMEs,
  the OpenUI Lang v0.1 and v0.5 specifications, the interactivity, built-ins, renderer,
  defining-components and incremental-editing docs, the self-hosted template, the FastAPI
  example, `templates.json`, `examples.json` and `ADOPTERS.md`.
- GitHub API for stars, forks, licence, contributor count and commit activity.

---

## 1. The short answer

**Recommendation: adopt OpenUI Lang and `@openuidev/react-lang` inside the existing Atlas.
Do not adopt AG-UI now. Borrow AG-UI's interrupt and resume JSON shapes as the contract for
the human's answer, so a later move to AG-UI is a translation, not a rewrite.**

The two libraries are not alternatives. AG-UI is a transport and lifecycle protocol between
an agent process and a client. OpenUI is a language that a model writes and a React renderer
draws. AG-UI's own docs say "AG-UI is not a generative UI specification". OpenUI's own
`react-headless` package ships an `agUIAdapter()` and its LangChain package "streams OpenUI
through AG-UI". They stack.

The reason to pick only one now is the shape of ugckit. The agent is a coding agent in a
terminal (Claude Code, Codex, Cursor) that reads `SKILL.md` files and runs bash and python.
There is no long-lived agent server. AG-UI assumes the browser POSTs a run and an agent
server streams the run back. That control model is inverted from ugckit, where the agent
drives and the browser is a viewport. To use AG-UI you must first build the agent server
that AG-UI talks to, and that server does not exist. OpenUI needs only a text file and a
React component, and both already exist in spirit: the agent writes files today, and the
Atlas renders files today.

---

## 2. What the Atlas and the pipeline are today

These facts decide the fit. They are from the code, not from the README.

**The pipeline.** `AGENTS.md` is the orchestrator contract. Stages R1 to R5 are bash scripts
(`apps.sh`, `network.sh`, `harvest.sh`, `deepen.sh`) that call Monid over `monid.sh` and
write to `research/<project>/<app>/<handle>/`. State lives in `pipeline/state/pipeline.json`
and is written only through `state.py`. The handle decision at R2 is three commands:

    scripts/state.py handle <project> <app> <handle> "<evidence>"
    scripts/state.py reject <project> <handle> "<why>"
    scripts/state.py handle-set <project> <app> <handle> own yes

`harvest.sh` reads the ledger with `state.py handles <project> <app>` and scrapes only
those handles. So the checkpoint's output already has a home. The `network` skill already
says "Where the evidence is still unclear, give the user the profile link and ask."

**The candidate data.** `network.sh` writes `research/<project>/<app>/candidates.tsv` with
columns `handle, name, followers, posts, names_app, in_handle, in_sound, best_views,
best_url, caption`. Every row is a handle with its evidence and the URL of its best post.
That is exactly the input the handle-review view needs.

**The existing human loop.** `ui.py` is a FastAPI app on port 7878. It serves a 190-line
static UI, lets the human edit the prompt, and appends notes to
`pipeline/state/feedback.jsonl`. `AGENTS.md` tells the agent to read that file before every
stage. This is already a checkpoint mechanism. It is text-only and one-directional, but the
pattern is proven: the browser writes a file, the agent reads it at a boundary.

**The Atlas.** Next.js 15.5.4, React 19.1.1, TypeScript, no Tailwind, no UI kit. Fonts are
Inter and Instrument Serif. Styling is hand-written CSS in `app/paper.css`, `chrome.css`
and `components.css`. `lib/data.ts` reads `data/index.json` once per process and re-reads it
when the file's mtime changes, so `atlas.sh --index` refreshes a running server without a
restart. Pages are server components. The only client components are `CommandBar`,
`Chrome`, `CopyButton`, `AccountCarousel` and the orb. `components/Bits.tsx` holds the
reusable pieces: `StatRow`, `TagChips`, and the post and account fragments. The live copy
adds `CloseForm.tsx`, a client form with local state and no network call, which shows that
an interactive form fits the paper design without friction.

Two things follow. The Atlas is a good host for a checkpoint route because it already reads
research files in place and re-renders when they change. And it is a poor host for a
third-party chat widget because there is no chat, no Tailwind and a deliberate visual
identity.

---

## 3. The two libraries, as read

### AG-UI (ag-ui-protocol/ag-ui)

| Fact | Value |
|---|---|
| Licence | MIT |
| Stars / forks | 15,735 / 1,416 |
| Created | May 2025 |
| Activity | 100+ commits since 2026-08-01, weekly `release/*` tags, biweekly working group |
| Maintainer | CopilotKit. The README links to CopilotKit docs for almost every integration |
| Hosted service | None required. CopilotKit Cloud exists but is optional |
| Python | `ag-ui-protocol` 0.1.22 on PyPI: Pydantic event models plus an SSE `EventEncoder` |
| TypeScript | `@ag-ui/core` and `@ag-ui/client` 0.0.59. The client depends on rxjs |
| Frontends | The reference client is CopilotKit (React). React Native via CopilotKit. Slack and Teams via a channels SDK. Raw `@ag-ui/client` works anywhere |

What it is. An event stream with about 16 core event types plus drafts. The ones that
matter here:

- `RUN_STARTED` / `RUN_FINISHED`, and `RUN_FINISHED` can carry
  `outcome: { type: "interrupt", interrupts: [...] }`.
- `TOOL_CALL_START` / `TOOL_CALL_ARGS` (JSON fragments) / `TOOL_CALL_END`. The client
  accumulates the fragments. A "frontend-defined tool" is one the client advertised in
  `RunAgentInput.tools`. When the agent calls it, the client executes it, and for a human
  checkpoint the "execution" is the human answering.
- `STATE_SNAPSHOT` / `STATE_DELTA` (RFC 6902 JSON Patch) and `ACTIVITY_SNAPSHOT` /
  `ACTIVITY_DELTA` for progressive structured output.
- `CUSTOM` for anything else.

The interrupt model is the most useful piece for this problem. An `Interrupt` has `id`,
`reason` (`tool_call`, `input_required`, `confirmation` or a custom string), `message`,
optional `toolCallId`, and optional `responseSchema` as JSON Schema. The next
`RunAgentInput` on the same thread carries `resume: [{ interruptId, status:
"resolved"|"cancelled", payload }]`. The spec says the agent may validate `payload` against
`responseSchema`. That is a clean, structured, auditable answer shape.

What it is not. AG-UI renders nothing. The dojo examples for human-in-the-loop and
tool-based generative UI are all CopilotKit pages using `useHumanInTheLoop` and
`useFrontendTool` with hand-written React for each tool. For fully model-generated UI,
AG-UI delegates to a separate spec (A2UI from Google, MCP Apps, Open-JSON-UI) through a
middleware package. The A2UI middleware in the repo wraps a `render_a2ui` tool and needs
the CopilotKit A2UI renderer on the client. The "generateUserInterface" two-step idea in
`docs/drafts/generative-ui.mdx` is marked Draft.

The transport is simple. POST a `RunAgentInput` JSON, get back `text/event-stream` with
one JSON event per `data:` line. The Python `server-starter-all-features` examples are
plain FastAPI generators, about 100 lines each. Producing the stream from Python is
trivial. Producing it from bash with `printf` is possible.

The control model is the catch. The client starts every run. The agent is a server that
answers POSTs. There is a Claude Agent SDK integration (`ag_ui_claude_sdk`, FastAPI
endpoint, "frontend tool halting" for human-in-the-loop), but it hosts the agent inside a
Python server. That is a different product from "open any coding agent and paste this".

### OpenUI (thesysdev/openui)

| Fact | Value |
|---|---|
| Licence | MIT |
| Stars / forks | 8,541 / 619 |
| Created | December 2024 |
| Activity | 100+ commits since 2026-08-01, 45 contributors, frequent npm releases |
| Maintainer | Thesys, a company that sells OpenUI Cloud |
| Hosted service | Not required. The CLI's default template is Cloud and needs `THESYS_API_KEY`. The `openui-self-hosted` template uses any OpenAI-compatible model with a locally generated prompt. `react-lang` and the renderer have no network dependency |
| Telemetry | `lang-core` sends install telemetry in `postinstall`. Opt out with `OPENUI_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1` |
| Python | None. The language is plain text, so any process can write it. Parsing is TypeScript only |
| Frontends | React 19 (`react-lang`, `react-ui`, `react-headless`), Vue 3, Svelte 5, React Native example, a no-build `browser-bundle` (2.2 MB JS, 650 KB gzipped) |
| Versions | `react-lang` 0.2.15, `lang-core` 0.2.17, `react-ui` 0.13.10. The language spec moved from v0.1 to v0.5 |

What it is. A line-oriented language that a model writes and a renderer draws while the
text is still arriving:

    root = Stack([header, table])
    header = CardHeader("Which of these promote Stronger?")
    table = Table(rows)
    rows = [...]

Rules that matter. One statement per line. `root` must be defined. Arguments are
positional and map to a component's Zod schema in key order. Forward references are
allowed, so `root` can name `table` before `table` arrives, and the renderer shows a
skeleton until it does. That is how a view appears progressively. Incremental edit mode
lets a later message send only changed statements, and `mergeStatements` merges by name.

Components are code. `defineComponent({ name, description, props: z.object(...),
component })` registers one. `createLibrary({ components, root })` makes the library.
`library.prompt({ preamble, additionalRules, examples })` generates the system prompt that
teaches a model the exact language for that library. The model composes registered
components at runtime; it cannot invent a new primitive.

The human's answer. `<Renderer response={text} library={lib} isStreaming={bool}
onAction={fn} onStateUpdate={fn} />`. `onAction` receives `ActionEvent { type, params,
humanFriendlyMessage, formState, formName }`. `formState` is a plain object of every
field value at the time of the click. Built-in action types are `continue_conversation`
and `open_url`. Inside a custom component, `useTriggerAction()` and `useStateField(name,
value)` bind to the same form state. What happens to the `ActionEvent` is up to the host
page. It is not validated against a schema and there is no run or resume lifecycle.

The built-in `react-ui` library has Table, Form, CheckBoxGroup, RadioGroup, Button,
Image, Card, Tabs, charts and more, with its own SCSS theme and a `ThemeProvider`. It is
optional. `react-lang` alone plus your own `defineComponent` calls is a complete runtime.

---

## 4. The seven needs, side by side

### (1) Can the agent decide at runtime which component to render?

| | AG-UI | OpenUI |
|---|---|---|
| Model of "component" | A frontend tool name, or a state shape, that the client pre-registered | A component from a library the client pre-registered |
| Runtime choice | The agent picks which tool to call and with what args. Each tool has one hand-written React renderer | The agent writes a program that composes any registered components in any tree, with any data |
| Fully novel UI | Only through A2UI, MCP Apps or Open-JSON-UI middleware and their renderers | Not possible. New primitives need code |
| Verdict | Choice among pre-built views | Composition from pre-built parts |

Both require pre-registration of primitives. OpenUI's unit is smaller, so the space of
views the agent can make without new code is much larger. For "the set of checkpoints is
not fixed and not known in advance", OpenUI answers the question directly. AG-UI answers
it only when paired with a generative UI spec, and its native answer is A2UI, which is
Google's JSON format and a CopilotKit renderer.

### (2) Does the human's response flow back as structured input?

| | AG-UI | OpenUI |
|---|---|---|
| Shape | `resume[].payload`, validated against the interrupt's JSON `responseSchema`; or a tool message with a string `content` | `ActionEvent.formState`, an untyped object keyed by field name |
| Where it goes | POSTed to the agent endpoint as the next `RunAgentInput` on the same `threadId` | Wherever the host's `onAction` sends it. Nothing is built in except "send to the model as a user message" |
| Audit | Spec-defined: proposal, decision and outcome are three linked events | None defined |
| Verdict | Strong, specified | Adequate, unspecified |

AG-UI is clearly better here, and this is the piece worth copying. The recommendation
below uses AG-UI's `Interrupt` and `resume` JSON as the answer-file format, without the
AG-UI runtime.

### (3) Streaming and staged output

| | AG-UI | OpenUI |
|---|---|---|
| Mechanism | `TOOL_CALL_ARGS` JSON fragments, `STATE_DELTA` JSON Patch, `ACTIVITY_DELTA` JSON Patch | Statement-per-line text, forward references render skeletons, incremental edit merges by name |
| Partial JSON | The client accumulates fragments; CopilotKit has partial-JSON parsing. With raw `@ag-ui/client` you do it yourself | The parser is permissive by design and renders what it can |
| Staged | Snapshot then deltas | First program, then patches |
| Verdict | Good, at the data level | Good, at the UI level |

Both stream. OpenUI's streaming is designed so the *view* appears in stages, which is the
requirement. AG-UI's streaming delivers *data* in stages, and the view is whatever your
React does with partial data.

### (4) Fit with the existing Next.js Atlas

| | AG-UI | OpenUI |
|---|---|---|
| Dependencies | `@ag-ui/client` (rxjs) for the raw path. CopilotKit `react-core`, `runtime`, GraphQL runtime client and CopilotKit styles for the supported path | `@openuidev/react-lang` and `zod`. Optionally `react-ui` with its SCSS theme |
| React version | Any React | React 19 required. The Atlas is on 19.1.1 |
| Reuse of Atlas components | Full. Each tool renderer is your own React, so `StatRow`, `TagChips`, `AccountCarousel` and the paper CSS are used as they are | Full. Each `defineComponent` wraps your own React. The same Atlas components become the library |
| Visual fit | The CopilotKit chat chrome does not fit the paper design. The raw client has no chrome | `react-lang` has no chrome. `react-ui` has a theme that would need overriding, so skip it |
| Data access | The route would need a server endpoint for the run | A route handler reads a file, exactly like `lib/data.ts` and `app/media/[...path]/route.ts` do now |
| What is rewritten | Nothing. One new route and one new server | Nothing. One new route and one small library file |

Both reuse the Atlas. OpenUI reuses it with fewer new packages and with the same
file-in-place pattern the Atlas already uses.

### (5) Connecting a shell-driven pipeline

This is the deciding row.

| | AG-UI | OpenUI |
|---|---|---|
| Who starts a checkpoint | The browser POSTs a run. The agent server answers | The agent writes a file. The browser reads it |
| What the agent needs | An HTTP server that implements `RunAgentInput` in and SSE out, keeps thread state, and honours `resume`. In Python that is a FastAPI app about the size of `ui.py`. The coding agent then has to trigger a run, which it cannot do because the client is the initiator, so the server must watch a file or queue that the shell writes | Nothing new. `printf` or a Python `open().write()` produces OpenUI Lang. The `library.prompt()` text is pasted into the skill so the coding agent knows the syntax |
| How the answer returns | The browser POSTs `resume` to the server. The server writes it somewhere the shell can read. The shell polls or blocks on that | The Atlas route handler writes an answer file or calls `state.py`. The shell polls or blocks on that |
| Net new moving parts | A server process, a run/thread store, and a bridge from the server to files | A file naming convention and a `ugckit checkpoint wait` command |

With AG-UI the shell still ends up waiting on a file. The protocol sits between two
things that both talk in files, and adds a server in the middle whose only job is to
translate. With OpenUI the file is the protocol.

The one case where AG-UI wins on this row: if the orchestrator is later re-hosted as a
Python service using the Claude Agent SDK integration, then AG-UI is the native way for a
browser to talk to it, and the interrupt model handles checkpoints without files. That is
a product decision, not a library decision. The paste-a-prompt entry path in the README is
the opposite decision.

### (6) Cost and lock-in

| | AG-UI | OpenUI |
|---|---|---|
| Money | None. No hosted service needed. CopilotKit Cloud optional | None for `react-lang`. OpenUI Cloud optional. Beware that the CLI, the docs callouts and several examples default to Cloud |
| Lock-in | The protocol is small and open, with SDKs in nine languages. Practical lock-in is to CopilotKit if you use its renderer | Lock-in is to the language and the 0.x renderer. Positional arguments are the API contract: the spec warns that reordering Zod keys breaks every existing program. Thesys drives the roadmap alone |
| Telemetry | None observed | `lang-core` postinstall telemetry, opt-out by env var. `atlas.sh` should set `OPENUI_TELEMETRY_DISABLED=1` before `npm install` |
| Maturity | 16 months old, 0.0.x TypeScript packages, but with broad first-party integrations and a public spec process | 21 months old, 0.2.x runtime, one vendor, an active ADOPTERS list |
| Exit path | Write your own SSE consumer; the wire format is plain JSON | Write your own renderer; programs are plain text and the parser is MIT |

Neither costs money. AG-UI is the safer long-term protocol. OpenUI is the smaller
surface to adopt and to remove.

### (7) The handle-review checkpoint, rendered in each

The checkpoint. After `network.sh` writes `candidates.tsv`, the agent shows every
discovered handle with its evidence and a button that opens the creator on TikTok. The
human marks each handle as a real promoter, a rejection, or the app's own account, adds a
reason, and submits. The agent then runs `state.py handle` or `state.py reject` for each
row and continues to R3.

#### 7a. AG-UI sketch

Server, Python, next to `ui.py`. It reads `candidates.tsv`, streams a frontend tool call
with the rows, and ends the run with an interrupt. The resume writes the decisions to a
file that the shell waits on.

```python
# scripts/checkpoint_server.py  (sketch)
import json, csv, uuid
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from ag_ui.core import (RunAgentInput, EventType, RunStartedEvent, RunFinishedEvent,
                        ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent)
from ag_ui.encoder import EventEncoder

app = FastAPI()
DECISION_SCHEMA = {
  "type": "object",
  "properties": {"decisions": {"type": "array", "items": {
      "type": "object",
      "properties": {"handle": {"type": "string"},
                     "verdict": {"type": "string", "enum": ["accept", "reject", "own"]},
                     "reason": {"type": "string"}},
      "required": ["handle", "verdict"]}}},
  "required": ["decisions"]}

@app.post("/checkpoint/{project}/{app_id}")
async def run(project: str, app_id: str, body: RunAgentInput, request: Request):
    enc = EventEncoder(accept=request.headers.get("accept"))
    async def gen():
        yield enc.encode(RunStartedEvent(type=EventType.RUN_STARTED,
                                         thread_id=body.thread_id, run_id=body.run_id))
        if body.resume:                                  # second run: the human answered
            payload = body.resume[0].payload or {}
            with open(f"research/{project}/{app_id}/checkpoints/handle-review.answer.json", "w") as f:
                json.dump(payload, f)                    # the shell is waiting on this file
            yield enc.encode(RunFinishedEvent(type=EventType.RUN_FINISHED,
                                              thread_id=body.thread_id, run_id=body.run_id,
                                              outcome={"type": "success"}))
            return
        tc = str(uuid.uuid4())
        yield enc.encode(ToolCallStartEvent(type=EventType.TOOL_CALL_START,
                                            tool_call_id=tc, tool_call_name="review_handles"))
        yield enc.encode(ToolCallArgsEvent(type=EventType.TOOL_CALL_ARGS, tool_call_id=tc, delta='{"rows":['))
        rows = list(csv.DictReader(open(f"research/{project}/{app_id}/candidates.tsv"), delimiter="\t"))
        for i, r in enumerate(rows):                     # one row per event: the table fills in
            yield enc.encode(ToolCallArgsEvent(type=EventType.TOOL_CALL_ARGS, tool_call_id=tc,
                                               delta=json.dumps(r) + ("," if i < len(rows) - 1 else "")))
        yield enc.encode(ToolCallArgsEvent(type=EventType.TOOL_CALL_ARGS, tool_call_id=tc, delta="]}"))
        yield enc.encode(ToolCallEndEvent(type=EventType.TOOL_CALL_END, tool_call_id=tc))
        yield enc.encode(RunFinishedEvent(type=EventType.RUN_FINISHED,
            thread_id=body.thread_id, run_id=body.run_id,
            outcome={"type": "interrupt", "interrupts": [{
                "id": "handle-review", "reason": "input_required", "toolCallId": tc,
                "message": f"Which of these really promote {app_id}?",
                "responseSchema": DECISION_SCHEMA}]}))
    return StreamingResponse(gen(), media_type=enc.get_content_type())
```

Client, a new Atlas page using the raw client, no CopilotKit:

```tsx
// app/checkpoint/[project]/[app]/page.tsx  (sketch, client component)
"use client";
import { HttpAgent } from "@ag-ui/client";
import { useEffect, useState } from "react";
import HandleReview from "@/components/HandleReview";   // your React, paper CSS, StatRow, open @handle

export default function Checkpoint({ params }) {
  const [rows, setRows] = useState([]);
  const [interrupt, setInterrupt] = useState(null);
  const agent = new HttpAgent({ url: `http://127.0.0.1:7879/checkpoint/${params.project}/${params.app}`,
                                threadId: "handle-review" });   // threadId is agent config, not a run parameter

  useEffect(() => {
    agent.runAgent({}, {
      onToolCallArgsEvent: ({ partialToolCallArgs }) => setRows(partialToolCallArgs?.rows ?? []), // partial JSON, rows appear one by one
      onRunFinishedEvent: ({ event }) => setInterrupt(event.outcome?.interrupts?.[0] ?? null),
    });
  }, []);

  const submit = (decisions) =>
    agent.runAgent({ resume: [{ interruptId: interrupt.id, status: "resolved", payload: { decisions } }] });
    // the client refuses a run that leaves a pending interrupt unaddressed (agent.ts checks this)

  return <HandleReview rows={rows} schema={interrupt?.responseSchema} onSubmit={submit} />;
}
```

Shell side, in the `network` skill:

    python3 scripts/checkpoint_server.py &          # a second server, port 7879
    open http://localhost:3210/checkpoint/$P/$APP
    until [ -f research/$P/$APP/checkpoints/handle-review.answer.json ]; do sleep 2; done

Note what happened. `HandleReview` is a hand-written React component. The agent chose to
call it, but did not shape it. To get a different view next time you write another
component and another tool. The server exists only to carry rows from a TSV to the
browser and the answer from the browser to a file.

#### 7b. OpenUI sketch

Library, one file in the Atlas, wrapping existing pieces:

```tsx
// lib/checkpoint-library.tsx  (sketch)
import { defineComponent, createLibrary, useStateField, useTriggerAction } from "@openuidev/react-lang";
import { z } from "zod/v4";
import { views } from "@/lib/data";

const HandleRow = defineComponent({
  name: "HandleRow",
  description: "One discovered TikTok handle with its evidence and a verdict control",
  props: z.object({
    handle: z.string(),
    name: z.string(),
    followers: z.number(),
    bestViews: z.number(),
    bestUrl: z.string().describe("URL of the best post; the Open button goes here"),
    evidence: z.string().describe("Why this handle is a candidate, quoted"),
    cover: z.string().optional().describe("Path under /media for the cover image"),
  }),
  component: ({ props }) => {
    const verdict = useStateField(`verdict.${props.handle}`, "accept");
    const reason = useStateField(`reason.${props.handle}`, "");
    return (
      <li className="hrow">                                  {/* paper CSS, same as PostTable */}
        {props.cover && <img src={props.cover} alt="" />}
        <div>
          <a href={`https://www.tiktok.com/@${props.handle}`} target="_blank" rel="noopener">@{props.handle}</a>
          <span className="tabular">{views(props.followers)} followers · best {views(props.bestViews)}</span>
          <q>{props.evidence}</q>
          <a className="copy" href={props.bestUrl} target="_blank" rel="noopener">Open the best post</a>
        </div>
        <fieldset>
          {["accept", "reject", "own"].map((v) => (
            <label key={v}><input type="radio" checked={verdict.value === v} onChange={() => verdict.setValue(v)} />{v}</label>
          ))}
          <input placeholder="reason" value={reason.value ?? ""} onChange={(e) => reason.setValue(e.target.value)} />
        </fieldset>
      </li>
    );
  },
});

const Checkpoint = defineComponent({
  name: "Checkpoint",
  description: "The root of a checkpoint: a question, the rows to decide, and one submit button",
  props: z.object({
    question: z.string(),
    rows: z.array(HandleRow.ref),
    submitLabel: z.string().default("Save decisions"),
  }),
  component: ({ props, renderNode }) => {
    const trigger = useTriggerAction();
    return (
      <section className="checkpoint">
        <h1 className="display">{props.question}</h1>
        <ol>{renderNode(props.rows)}</ol>                     {/* skeletons until each row's line arrives */}
        <button className="copy" onClick={() => trigger(props.submitLabel)}>{props.submitLabel}</button>
      </section>
    );
  },
});

export const checkpointLibrary = createLibrary({ root: "Checkpoint", components: [Checkpoint, HandleRow] });
```

What the agent writes. The `network` skill gets a new section with the text from
`checkpointLibrary.prompt()` and an example. After reading `candidates.tsv` and running
`--comments` where needed, the agent writes, line by line as it decides each row:

    # research/<p>/stronger/checkpoints/handle-review.openui
    root = Checkpoint("Which of these really promote Stronger?", [r1, r2, r3])
    r1 = HandleRow("mel.stronger", "Mel", 41200, 1830000, "https://www.tiktok.com/@mel.stronger/video/7669...", "captions name the app in 6 of 8 posts", "/media/p/stronger/mel.stronger/covers/001.jpg")
    r2 = HandleRow("liftwithjo", "Jo", 9800, 412000, "https://www.tiktok.com/@liftwithjo/video/7671...", "uses the app's original sound in 3 posts")
    r3 = HandleRow("gymtok.daily", "Gym Daily", 120000, 5100000, "https://www.tiktok.com/@gymtok.daily/video/7660...", "no name anywhere; comments ask what app this is; author replied Stronger")

`root` arrives first and three skeleton rows appear. Each `HandleRow` line fills one in.
If the agent later finds a fourth handle it appends one line and rewrites `root`; the
renderer merges by name.

The Atlas route. One server component reads the file, one client component polls it while
the checkpoint is open, one route handler accepts the answer:

```tsx
// app/checkpoint/[...id]/page.tsx  (sketch)
"use client";
import { Renderer } from "@openuidev/react-lang";
import { useEffect, useState } from "react";
import { checkpointLibrary } from "@/lib/checkpoint-library";

export default function CheckpointPage({ params }) {
  const id = params.id.join("/");
  const [text, setText] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(true);
  useEffect(() => {
    const t = setInterval(async () => {                   // same idea as getIndex(): re-read when it changes
      const r = await fetch(`/api/checkpoint/${id}`);
      const j = await r.json();
      setText(j.program); setStreaming(!j.sealed);         // the agent writes ".sealed" when it stops appending
    }, 500);
    return () => clearInterval(t);
  }, [id]);
  return (
    <Renderer
      library={checkpointLibrary}
      response={text}
      isStreaming={streaming}
      onAction={async (e) => {
        const decisions = Object.entries(e.formState ?? {})
          .filter(([k]) => k.startsWith("verdict."))
          .map(([k, v]) => ({ handle: k.slice(8), verdict: v, reason: e.formState?.[`reason.${k.slice(8)}`] ?? "" }));
        await fetch(`/api/checkpoint/${id}`, { method: "POST", body: JSON.stringify({
          interruptId: id, status: "resolved", payload: { decisions } }) });   // AG-UI's resume shape, on purpose
      }}
    />
  );
}
```

```ts
// app/api/checkpoint/[...id]/route.ts  (sketch)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(process.cwd(), "..", "research");
export async function GET(_: Request, { params }) {
  const base = join(ROOT, ...params.id);
  return Response.json({ program: existsSync(base + ".openui") ? readFileSync(base + ".openui", "utf8") : null,
                         sealed: existsSync(base + ".sealed") });
}
export async function POST(req: Request, { params }) {
  writeFileSync(join(ROOT, ...params.id) + ".answer.json", JSON.stringify(await req.json(), null, 2));
  return new Response(null, { status: 204 });
}
```

Shell side, one new subcommand in `ugckit`:

    # scripts/checkpoint.sh  (sketch)
    #   scripts/checkpoint.sh open <project> <app> <name>   print the URL, touch nothing
    #   scripts/checkpoint.sh seal <project> <app> <name>   the agent stopped appending
    #   scripts/checkpoint.sh wait <project> <app> <name>   block until the answer exists, print it
    case "$1" in
      wait) F="$(research_dir "$2")/$3/checkpoints/$4.answer.json"
            until [ -s "$F" ]; do sleep 2; done; cat "$F" ;;
    esac

And the `network` skill tells the agent what to do with the answer:

    for each decision: accept -> state.py handle <p> <app> <handle> "<reason>"
                       reject -> state.py reject <p> <handle> "<reason>"
                       own    -> state.py handle ... ; state.py handle-set ... own yes
    then: state.py set <p> network done, and quote the counts back to the user.

Note what happened here. The agent decided the question, the rows, the evidence text and
the order. Tomorrow it can write a `Checkpoint` whose rows are `PostCard`s for the deepen
stage, or a two-column `Compare` for the apps round, as soon as those two components exist
in the library. No server was added. The Atlas gained one page, one route and one library
file. The pipeline gained one script.

---

## 5. Recommendation, with reasons

Adopt OpenUI Lang and `@openuidev/react-lang` in the Atlas. Do not use `react-ui`. Do not
use OpenUI Cloud. Do not add AG-UI or CopilotKit now.

1. **It matches the control model.** The agent writes files and the Atlas reads files in
   place. That is how research, the index and the media route already work. OpenUI Lang is
   a file the agent writes. AG-UI needs a server the pipeline does not have.
2. **It matches the agent.** The orchestrator is a coding agent that already writes
   markdown tables and JSON by hand. A ten-line positional DSL, taught by a generated prompt
   pasted into the skill, is inside its comfort zone. No model API call is needed to make UI.
3. **It answers "not known in advance".** The agent composes views from a small library.
   Every new stage gets a checkpoint by writing text, and only a new *kind* of row needs
   code.
4. **It reuses the Atlas.** Every `defineComponent` wraps an existing Atlas piece and the
   existing CSS. The checkpoint page looks like the rest of the Atlas because it is the rest
   of the Atlas.
5. **The streaming is the right kind.** Forward references and merge-by-name mean the view
   appears in stages as the agent works, which is what was asked for.
6. **It is cheap to remove.** One npm package, one page, one route, one library file, one
   script. The programs on disk are text.
7. **The answer format is borrowed from AG-UI on purpose.** The answer file is
   `{ interruptId, status, payload }`, and the checkpoint carries `id`, `reason`, `message`
   and a `responseSchema` in a sidecar JSON. If the orchestrator is ever re-hosted as an
   AG-UI agent, every checkpoint already speaks that contract.

## 6. The strongest argument against

**The first slice does not need generative UI at all, and OpenUI is a young, single-vendor
DSL with a fragile contract.** A fixed `HandleReview` React component fed by
`candidates.tsv` would ship the handle-review checkpoint with zero new dependencies, and
the Atlas already has every piece it needs. OpenUI adds a 0.2.x renderer, a language whose
positional-argument contract breaks when a Zod key moves, a vendor whose CLI and examples
steer toward a paid Cloud, and postinstall telemetry. If the coding agent writes a
malformed line, the parser is permissive and the error shows only in `meta.errors`, which
a user would never see. And OpenUI has no lifecycle. Every rule AG-UI wrote down for
interrupts (same thread, cover every open interrupt, idempotent resume, expiry) has to be
reinvented in bash and a route handler.

The answer to that argument. The requirement is explicitly that the set of checkpoints is
open and the agent decides the view, so a fixed component solves the first slice and none
of the rest. The fragility is managed: the library is small, key order is documented in
the skill, and a `checkpoint lint` command can run `createParser(schema).parse()` in Node
and refuse to seal a program with `unknown-component` or `missing-required` errors. The
lifecycle is deliberately tiny because there is one human, one machine and one checkpoint
open at a time. If that stops being true, that is the moment to host the agent and adopt
AG-UI for real, and the answer files will already be in its shape.

If Rahul disagrees with the premise and wants the paste-a-prompt entry path to go away in
favour of a hosted orchestrator, then the recommendation flips: use the AG-UI Claude Agent
SDK integration, its interrupt model, and OpenUI Lang as the payload inside
`TEXT_MESSAGE_CONTENT`, which is exactly what `@openuidev/react-headless`'s `agUIAdapter`
expects.

## 7. Are they complementary or alternatives?

Complementary. AG-UI is the wire and the lifecycle. OpenUI Lang is one of the payloads
that can travel on it. OpenUI ships an AG-UI stream adapter and a LangChain package that
streams OpenUI through AG-UI. The reason to pick only OpenUI today is that the wire in
ugckit is the filesystem, and that is not going to change while the product is "open any
coding agent and paste this".

Neither library is a wrong fit. A third option, "no library, fixed React per checkpoint",
is a fit for the first slice only. It is rejected because the brief is generative.

## 8. Staged plan

Every stage is a working pipeline. No stage changes the end state: the orb, then the deep
pages, still fill from `research/` and `index.json` as they do now.

**Stage 0. Contract, no UI (half a day).**
Define the file layout under `research/<project>/<app>/checkpoints/`:
`<name>.openui` (the program, appended to), `<name>.json` (the interrupt sidecar: `id`,
`reason`, `message`, `responseSchema`), `<name>.sealed` (the agent stopped appending),
`<name>.answer.json` (`{ interruptId, status, payload }`). Add `scripts/checkpoint.sh`
with `open`, `seal`, `wait` and `answer` subcommands and a `checkpoint` line in `ugckit`.
Add `checkpoints/` to `build-index.mjs`'s ignore set next to `searches`, `covers` and
`comments`, so a checkpoint folder is never indexed as a handle.

**Stage 1. The handle-review checkpoint (two to three days).**
Add `@openuidev/react-lang` and `zod` to `template/atlas/package.json`. Set
`OPENUI_TELEMETRY_DISABLED=1` in `atlas.sh` before `npm install`. Write
`lib/checkpoint-library.tsx` with `Checkpoint` and `HandleRow`, styled with the existing
paper CSS. Add `app/checkpoint/[...id]/page.tsx` and `app/api/checkpoint/[...id]/route.ts`.
Add `open @handle` style links so the CommandBar grammar still holds. Generate
`checkpointLibrary.prompt()` with a small `node` script and paste the output into a new
section of `.claude/skills/network/SKILL.md`, with the exact example program above. Change
the skill's "Deciding, one handle at a time" section: the agent writes the program as it
reads `candidates.tsv`, seals it, gives the URL, runs `checkpoint.sh wait`, then applies
the answer with `state.py`. Add a `checkpoint lint` subcommand that parses the program in
Node and refuses to seal on `unknown-component` or `missing-required`. Test on one app end
to end: R2 with the checkpoint, then `harvest` reads the ledger unchanged.

**Stage 2. Progressive appearance and the map (one day).**
Make the page re-read the file while unsealed, so rows appear as the agent writes them.
List open checkpoints on `/map` and in the `Ticker`, so a user who wandered off can find
the thing that is waiting for them. Have the `atlas` skill say "a checkpoint is open at
<url>" when one exists.

**Stage 3. Two more row types, so the library is generative in practice (two days).**
`AppCandidate` for the R1 rounds (term, handle count, best post, add or skip) and
`PostPick` for R4 deepen (cover, views, hook, pick or skip), both wrapping existing Atlas
fragments. Update the `apps` and `deepen` skills the same way as `network`. At this point
the agent has three row types and one root, and can compose a checkpoint for any stage
without new code.

**Stage 4. Free-form checkpoints (one day, optional).**
Add `Note`, `Choice` and `TextField` components so the agent can ask an open question
("which of these two hooks should the script use?") without a stage-specific row type.
This is where "the agent decides what UI to surface" stops needing a developer at all.

**Stage 5. Revisit AG-UI (decision, not work).**
If the orchestrator moves into a server, or a second human joins, or checkpoints need
expiry and audit across machines, wrap the checkpoint files in an AG-UI endpoint. The
answer files are already in `resume` shape, and OpenUI programs can travel as
`TEXT_MESSAGE_CONTENT` into `@openuidev/react-headless`'s `agUIAdapter`. Nothing from
stages 1 to 4 is thrown away.

## 9. Open risks to watch

- OpenUI Lang v0.5 added `$variables`, `Query` and `Action`. The sketch uses none of them
  and needs none. Stay on the v0.1 subset in the skill prompt to keep the agent's output
  simple.
- `react-lang` needs React 19. The Atlas is on 19.1.1. Do not let the live
  `organic-social/atlas` copy drift to a different major.
- The coding agent must not put a signed TikTok CDN URL into a program that will be read
  later; use the `/media` path for covers, as the Atlas already does for everything else.
- A checkpoint file is under `research/`, which `build-index.mjs` walks. Stage 0's ignore
  entry is not optional.
