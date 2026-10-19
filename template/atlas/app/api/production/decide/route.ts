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
 *
 * A video post: `plan.approve` records the video id, the revision and the
 * content digest of REVIEW.md (video-lock reads it as the user's approval);
 * `final.approve` records the delivered file's sha256 as its hash.
 *
 * A locked video's production (lib/video-production.ts) has its own lines, each
 * with data.video, and each recorded by the agent with review.py ... --from-atlas:
 *   storyboard.approve   gate A: every keyframe's sha256 and the computed cost of the
 *                        first runs, the user's yes to both; storyboard.sendback
 *   take.approve         gate B: one take by its sha256, with the checks review.py
 *                        needs; take.reject (the note says what failed; data.decision
 *                        regenerate is the yes to one more run, at data.cost_usd)
 *   composite.approve    a phone segment's composite, by its sha256
 *   cut.approve          gate C: the assembled file by its sha256 and the export;
 *                        cut.sendback
 * The server reads every hash and cost from the files, never from the client.
 */

import { NextResponse, type NextRequest } from "next/server";

import { isPlatform } from "@/lib/platform";
import { allStates, appendEvent, finalBlock, parseLayout, slideHashes, validSlug, type Event, type EventKind, type PostState } from "@/lib/production";

const KINDS = new Set<EventKind>([
  "idea.approve", "idea.sendback", "plan.approve", "plan.sendback", "final.approve", "final.sendback",
  "storyboard.approve", "storyboard.sendback", "take.approve", "take.reject", "composite.approve", "cut.approve", "cut.sendback",
  "slide.choose", "slide.approve", "slide.reject", "slide.note", "slide.text", "slide.layout", "slide.unlock", "posted", "outcomes", "kill", "unkill", "task.tick", "task.untick",
  /* One leg of a post taken off, or put back: data.platform names it. */
  "leg.drop", "leg.add",
  /* Identity events, from the handle page: `handle` instead of `post`. account.connect may name data.platform (TikTok when absent). */
  "persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done", "account.connect",
]);
const IDENTITY = new Set<EventKind>(["persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done", "account.connect"]);
/* The kinds whose data.platform must name a platform: required on a leg line, optional on account.connect. */
const LEG = new Set<EventKind>(["leg.drop", "leg.add"]);

const NEEDS_NOTE = new Set<EventKind>(["idea.sendback", "plan.sendback", "final.sendback", "storyboard.sendback", "take.reject", "cut.sendback", "slide.reject", "slide.note", "kill", "persona.sendback", "reference.reject"]);

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
  const platform = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>).platform : undefined;
  if ((LEG.has(body.kind) || platform !== undefined) && !isPlatform(platform)) return NextResponse.json({ error: "data.platform must be tiktok or instagram." }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (NEEDS_NOTE.has(body.kind) && !note) return NextResponse.json({ error: "Say what to change." }, { status: 400 });

  const actor = typeof body.actor === "string" && body.actor && body.actor !== "demo" ? body.actor.slice(0, 40) : undefined;
  const state = body.kind.startsWith("slide.") || body.kind === "plan.approve" || body.kind === "plan.sendback" || body.kind === "final.approve" || PRODUCTION.has(body.kind) ? allStates(slug).find((x) => x.row.key === body.post) : undefined;

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
  /* A video's plan gate is one exact revision, by digest: the line records what REVIEW.md showed, and
   * video-lock --from-atlas takes it as the user's approval. A send-back records the revision it refused. */
  if (state?.video && body.kind === "plan.approve") {
    const r = state.video.review;
    if (!state.video.id || !r?.digest) return NextResponse.json({ error: "No REVIEW.md with a content digest to approve yet." }, { status: 400 });
    data = { ...(data ?? {}), video: state.video.id, revision: r.revision ?? state.video.draft?.revision ?? null, digest: r.digest };
  }
  if (state?.video && body.kind === "plan.sendback") data = { ...(data ?? {}), video: state.video.id, revision: state.video.draft?.revision ?? null };
  if (PRODUCTION.has(body.kind)) {
    const r = productionLine(state, body.kind, data ?? {});
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    data = r.data;
  }
  if (body.kind === "slide.layout") {
    if (typeof body.slide !== "number" || !parseLayout(data?.layout)) return NextResponse.json({ error: "slide and data.layout (JSON) are required." }, { status: 400 });
    if (!state?.slides.some((s) => s.n === body.slide)) return NextResponse.json({ error: "No such slide." }, { status: 400 });
  }
  /* A video's final approval covers the delivered file, by its checksum. */
  if (body.kind === "final.approve" && state?.video) {
    const why = finalBlock(state);
    if (why) return NextResponse.json({ error: `Not yet: ${why}.` }, { status: 400 });
    hash = state.video.final!.sha256;
    data = { ...(data ?? {}), video: state.video.id };
  } else if (body.kind === "final.approve") {
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

const PRODUCTION = new Set<EventKind>(["storyboard.approve", "storyboard.sendback", "take.approve", "take.reject", "composite.approve", "cut.approve", "cut.sendback"]);
/* review.py final refuses an approval when one of these failed on the assembled file. */
const BLOCKS_CUT = (k: string) => k.startsWith("overlays") || k.startsWith("supplied");

/** The data of one production line, from the files on disk; or why it cannot be written yet. */
function productionLine(state: PostState | undefined, kind: EventKind, sent: Record<string, unknown>): { data: Record<string, any> } | { error: string } {
  const v = state?.video;
  const p = v?.production;
  if (!v?.id || !v.lock || !p) return { error: "This video's plan is not locked yet." };
  const video = v.id;
  if (kind === "storyboard.approve" || kind === "storyboard.sendback") {
    const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
    const missing = own.filter((s) => s.needsKeyframe && !s.keyframe).map((s) => s.name);
    if (kind === "storyboard.approve" && missing.length) return { error: `No keyframe yet for ${missing.join(", ")}.` };
    return { data: { video, keyframes: p.keyframes, ...(kind === "storyboard.approve" ? { cost_usd: p.cost } : {}) } };
  }
  if (kind === "cut.approve" || kind === "cut.sendback") {
    const a = p.assembly;
    if (!a) return { error: "No assembled file yet." };
    if (kind === "cut.approve") {
      const open = p.segments.filter((s) => s.generated && !s.sharedFrom && !s.approved).map((s) => s.name);
      if (open.length) return { error: `Not every segment is approved: ${open.join(", ")}.` };
      if (a.stale) return { error: "The cut was assembled from another revision of the plan: the agent assembles again first." };
      const blocks = a.failed.filter(BLOCKS_CUT);
      if (blocks.length) return { error: `Failed on the cut: ${blocks.join(", ")}. Send it back.` };
    }
    const exp = sent.export === "grain" && a.grain ? "grain" : "default";
    return { data: { video, file: a.file, sha256: a.sha256, ...(kind === "cut.approve" ? { export: exp } : {}) } };
  }
  const seg = p.segments.find((s) => s.name === sent.segment);
  if (!seg) return { error: "No such segment." };
  if (seg.sharedFrom) return { error: `${seg.name} is ${seg.sharedFrom}'s segment: decide it on that video.` };
  if (kind === "composite.approve") {
    if (!seg.composite) return { error: `No composite of ${seg.name} yet.` };
    return { data: { video, segment: seg.name, file: seg.composite.file, sha256: seg.composite.sha256 } };
  }
  const take = seg.takes.find((t) => t.file === sent.file);
  if (!take) return { error: `No take ${String(sent.file ?? "")} of ${seg.name}.` };
  if (kind === "take.reject") {
    const fix = typeof sent.fix === "string" ? sent.fix.trim().slice(0, 600) : "";
    return { data: { video, segment: seg.name, file: take.file, sha256: take.sha256, decision: sent.decision === "reject" ? "reject" : "regenerate", ...(fix ? { fix } : {}), cost_usd: seg.cost } };
  }
  /* take.approve: the identity gate first on a face-replace take, then every check review.py needs. */
  if (seg.faceReplace) {
    if (!take.identity) return { error: "The identity gate has not run on this take: the agent runs scripts/character/identity.py first." };
    if (take.identity.result !== "PASS") return { error: `The identity gate says ${take.identity.result}${take.identity.why ? `: ${take.identity.why}` : ""}. Reject this take.` };
  }
  const ticked = Array.isArray(sent.checks) ? sent.checks.map(String) : [];
  const miss = seg.checks.filter((c) => !ticked.includes(c));
  if (miss.length) return { error: `Tick every check first: ${miss.join(", ")}.` };
  return { data: { video, segment: seg.name, file: take.file, sha256: take.sha256, checks: Object.fromEntries(seg.checks.map((c) => [c, "pass"])) } };
}
