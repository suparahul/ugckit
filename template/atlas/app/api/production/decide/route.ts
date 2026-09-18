/**
 * One decision, appended to ../production/log.jsonl.
 *
 * The body is one event without its timestamp. Nothing is validated beyond the
 * shape, because the only writer is Rahul (or an agent on his say-so) on his own
 * machine; the log is the record and a wrong line is corrected by a later line,
 * never by editing this one.
 *
 * Three gates: idea, plan, final. The plan line records the deck hash and one
 * hash per slide, so a later edit can name the slide it touched. The final
 * line approves every picture still open (one `slide.approve` per file, so
 * the record names what was approved), then records the same hashes.
 */

import { NextResponse, type NextRequest } from "next/server";

import { allStates, appendEvent, finalBlock, parseLayout, slideHashes, validSlug, type Event, type EventKind } from "@/lib/production";

const KINDS = new Set<EventKind>([
  "idea.approve", "idea.sendback", "plan.approve", "plan.sendback", "final.approve", "final.sendback",
  "slide.choose", "slide.approve", "slide.reject", "slide.note", "slide.text", "slide.layout", "slide.unlock", "posted", "outcomes", "kill", "unkill", "task.tick", "task.untick",
  /* Identity events, from the handle page: `handle` instead of `post`. */
  "persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done",
]);
const IDENTITY = new Set<EventKind>(["persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done"]);

const NEEDS_NOTE = new Set<EventKind>(["idea.sendback", "plan.sendback", "final.sendback", "slide.reject", "slide.note", "kill", "persona.sendback", "reference.reject"]);

export async function POST(request: NextRequest) {
  let body: Partial<Event> & { app?: string };
  try {
    body = (await request.json()) as Partial<Event> & { app?: string };
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  const slug = typeof body.app === "string" ? body.app : "";
  if (!slug || !validSlug(slug)) return NextResponse.json({ error: "app is required." }, { status: 400 });
  if (!body.kind || !KINDS.has(body.kind)) return NextResponse.json({ error: "Unknown kind." }, { status: 400 });
  const identity = IDENTITY.has(body.kind);
  if (identity && (!body.handle || typeof body.handle !== "string")) return NextResponse.json({ error: "handle is required." }, { status: 400 });
  if (!identity && (!body.post || typeof body.post !== "string")) return NextResponse.json({ error: "post is required." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (NEEDS_NOTE.has(body.kind) && !note) return NextResponse.json({ error: "Say what to change." }, { status: 400 });

  const actor = typeof body.actor === "string" && body.actor && body.actor !== "demo" ? body.actor.slice(0, 40) : undefined;
  const state = body.kind.startsWith("slide.") || body.kind === "plan.approve" || body.kind === "plan.sendback" || body.kind === "final.approve" ? allStates(slug).find((x) => x.row.key === body.post) : undefined;

  /* A slide approval belongs to a picture: the line always names the file. The
   * client sends the candidate in view; when it does not, the current one. */
  let file = typeof body.file === "string" ? body.file : undefined;
  if (body.kind === "slide.approve" && typeof body.slide === "number") {
    const s = state?.slides.find((x) => x.n === body.slide);
    if (file && !s?.candidates.includes(file)) return NextResponse.json({ error: "That picture is not a candidate of this slide." }, { status: 400 });
    if (!file) file = s?.current ?? undefined;
    if (!file) return NextResponse.json({ error: "No picture to approve." }, { status: 400 });
  }

  /* The two gates that cover a deck record what they covered. A plan send-back
   * records the deck it refused, so a rewritten deck (a new hash) clears it. */
  let hash: string | undefined = typeof body.hash === "string" ? body.hash : undefined;
  let data = body.data && typeof body.data === "object" ? { ...body.data } : undefined;
  if ((body.kind === "plan.approve" || body.kind === "final.approve") && state?.deck) {
    hash = state.deck.hash;
    data = { ...(data ?? {}), slides: slideHashes(state.deck) };
  }
  if (body.kind === "plan.sendback" && state?.deck) hash = state.deck.hash;
  if (body.kind === "slide.layout") {
    if (typeof body.slide !== "number" || !parseLayout(data?.layout)) return NextResponse.json({ error: "slide and data.layout (JSON) are required." }, { status: 400 });
    if (!state?.slides.some((s) => s.n === body.slide)) return NextResponse.json({ error: "No such slide." }, { status: 400 });
  }
  if (body.kind === "final.approve") {
    if (!state?.deck) return NextResponse.json({ error: "No deck to approve." }, { status: 400 });
    const why = finalBlock(state);
    if (why) return NextResponse.json({ error: `Not yet: ${why}.` }, { status: 400 });
    for (const s of state.slides) {
      if (s.current && s.status !== "approved") appendEvent(slug, { post: body.post, kind: "slide.approve", slide: s.n, file: s.current });
    }
  }

  const e = appendEvent(slug, {
    ...(identity ? { handle: body.handle } : { post: body.post }),
    kind: body.kind,
    ...(note ? { note } : {}),
    ...(typeof body.slide === "number" ? { slide: body.slide } : {}),
    ...(file ? { file } : {}),
    ...(hash ? { hash } : {}),
    ...(data ? { data } : {}),
    ...(typeof body.task === "string" ? { task: body.task } : {}),
    ...(actor ? { actor } : {}),
  });
  return NextResponse.json({ ok: true, event: e });
}
