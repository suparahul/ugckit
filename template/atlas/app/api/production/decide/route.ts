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
 *                        cut.sendback (data.segment: regenerate that segment, at data.cost_usd)
 *   storyboard.sendback  data.segments: redo only those keyframes
 *   composite.sendback   the composite is wrong (the note says how)
 *   source.approve       gate B for a supplied file (data.asset_id), by its sha256; source.reject
 *   narration.approve    gate B for a narration take (data.take), with the natural-voice
 *                        check, its narrator and lines; narration.reject
 *   motion.approve       gate B for a motion-designed screen (data.segment): its render by its
 *                        sha256, every gate of motion_design.py check passed, a gate not run
 *                        (OCR) ticked by eye; motion.reject
 * "Approve anyway" (2026-10-21): take.approve, motion.approve, narration.approve and cut.approve
 * may carry data.accept_fail, the measured gates the user approves although they failed
 * (identity; each motion-design gate but current; voice; overlays). The note is required: it
 * is the user's words, and review.py --from-atlas records the override (--accept-fail). A
 * stale render, a changed supplied file and a stale cut are never accepted.
 * The server reads every hash and cost from the files, never from the client
 * (research/ai-ugc/ATLAS-VIDEO-STAGES-PLAN.md § 7).
 */

import { NextResponse, type NextRequest } from "next/server";

import { isPlatform } from "@/lib/platform";
import { allStates, appendEvent, finalBlock, parseLayout, slideHashes, validSlug, type Event, type EventKind, type PostState } from "@/lib/production";
import { cutAccepts, motionAccepts } from "@/lib/accept-fail";
import { identityOk } from "@/lib/video-production";

const KINDS = new Set<EventKind>([
  "idea.approve", "idea.sendback", "plan.approve", "plan.sendback", "final.approve", "final.sendback",
  "storyboard.approve", "storyboard.sendback", "take.approve", "take.reject", "composite.approve", "cut.approve", "cut.sendback",
  "composite.sendback", "source.approve", "source.reject", "narration.approve", "narration.reject", "motion.approve", "motion.reject",
  "slide.choose", "slide.approve", "slide.reject", "slide.note", "slide.text", "slide.layout", "slide.unlock", "posted", "outcomes", "kill", "unkill", "task.tick", "task.untick",
  /* One leg of a post taken off, or put back: data.platform names it. */
  "leg.drop", "leg.add",
  /* Identity events, from the handle page: `handle` instead of `post`. account.connect may name data.platform (TikTok when absent). */
  "persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done", "account.connect",
]);
const IDENTITY = new Set<EventKind>(["persona.approve", "persona.sendback", "reference.approve", "reference.reject", "bio.approve", "defaults.approve", "task.done", "account.connect"]);
/* The kinds whose data.platform must name a platform: required on a leg line, optional on account.connect. */
const LEG = new Set<EventKind>(["leg.drop", "leg.add"]);

const NEEDS_NOTE = new Set<EventKind>(["idea.sendback", "plan.sendback", "final.sendback", "storyboard.sendback", "take.reject", "cut.sendback", "composite.sendback", "source.reject", "narration.reject", "motion.reject", "slide.reject", "slide.note", "kill", "persona.sendback", "reference.reject"]);

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
    const r = productionLine(state, body.kind, data ?? {}, note);
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

const PRODUCTION = new Set<EventKind>(["storyboard.approve", "storyboard.sendback", "take.approve", "take.reject", "composite.approve", "cut.approve", "cut.sendback", "composite.sendback", "source.approve", "source.reject", "narration.approve", "narration.reject", "motion.approve", "motion.reject"]);
/* review.py final refuses an approval when one of these failed on the assembled file. */
/* The failed gates the user accepts on an "Approve anyway" line (data.accept_fail). */
const acceptsOf = (sent: Record<string, unknown>) => (Array.isArray(sent.accept_fail) ? sent.accept_fail.map(String) : []);

/** The data of one production line, from the files on disk; or why it cannot be written yet. */
function productionLine(state: PostState | undefined, kind: EventKind, sent: Record<string, unknown>, note = ""): { data: Record<string, any> } | { error: string } {
  const accepts = acceptsOf(sent);
  if (accepts.length && !note) return { error: "Approve anyway needs your note: say why you accept the failed gate." };
  const v = state?.video;
  const p = v?.production;
  if (!v?.id || !v.lock || !p) return { error: "This video's plan is not locked yet." };
  const video = v.id;
  if (kind === "storyboard.approve" || kind === "storyboard.sendback") {
    const own = p.segments.filter((s) => s.generated && !s.sharedFrom);
    const missing = own.filter((s) => s.needsKeyframe && !s.keyframe).map((s) => s.name);
    if (kind === "storyboard.approve" && missing.length) return { error: `No keyframe yet for ${missing.join(", ")}.` };
    /* A send-back may name the keyframes to redo; only the ones that exist. */
    const want = Array.isArray(sent.segments) ? sent.segments.map(String) : [];
    const bad = want.filter((n) => !own.some((s) => s.name === n && s.needsKeyframe));
    if (bad.length) return { error: `No keyframe to redo for ${bad.join(", ")}.` };
    return { data: { video, keyframes: p.keyframes, ...(kind === "storyboard.approve" ? { cost_usd: p.cost } : {}), ...(kind === "storyboard.sendback" && want.length ? { segments: want } : {}) } };
  }
  if (kind === "source.approve" || kind === "source.reject") {
    const x = p.sources.find((s) => s.id === sent.asset_id);
    if (!x) return { error: "No such supplied source in this video." };
    if (!x.sha256 || !x.file) return { error: `${x.id}: the file is not on disk.` };
    return { data: { video, asset_id: x.id, file: x.file, sha256: x.sha256 } };
  }
  if (kind === "narration.approve" || kind === "narration.reject") {
    const x = p.narration.find((s) => s.take === sent.take);
    if (!x) return { error: "No such narration take in this video." };
    if (!x.sha256 || !x.file) return { error: `No narration/${x.take}.wav yet.` };
    const natural = Array.isArray(sent.checks) && sent.checks.map(String).includes("natural_voice");
    if (kind === "narration.approve") {
      if (!natural && !accepts.includes("voice")) return { error: "Tick the natural-voice check first, or approve anyway with your note." };
      if (!x.lines.length || !x.narrator) return { error: "No voiceover line of the plan names this take's narrator." };
    }
    return { data: { video, take: x.take, file: x.file, sha256: x.sha256, narrator: x.narrator, lines: x.lines,
      ...(kind === "narration.approve" ? (natural ? { checks: { natural_voice: "pass" } } : { accept_fail: ["voice"] }) : {}) } };
  }
  if (kind === "cut.approve" || kind === "cut.sendback") {
    const a = p.assembly;
    if (!a) return { error: "No assembled file yet." };
    if (kind === "cut.approve") {
      const open = p.segments.filter((s) => (s.generated && !s.sharedFrom && !s.approved) || (s.motion && !s.motion.approved)).map((s) => s.name);
      if (open.length) return { error: `Not every segment is approved: ${open.join(", ")}.` };
      if (a.stale) return { error: "The cut was assembled from another revision of the plan: the agent assembles again first." };
      const { blocked, overlays } = cutAccepts(a.failed);
      if (blocked.length) return { error: `Failed on the cut: ${blocked.join(", ")}: the cut is not the plan's. The agent assembles again.` };
      if (overlays.length && !accepts.includes("overlays")) return { error: `Failed on the cut: ${overlays.join(", ")}. Send it back, or approve anyway with your note.` };
    }
    const exp = sent.export === "grain" && a.grain ? "grain" : "default";
    /* A send-back may name one segment to regenerate: the user's yes to one more run at its computed cost. */
    const rs = kind === "cut.sendback" && typeof sent.segment === "string" ? p.segments.find((s) => s.name === sent.segment && s.generated && !s.sharedFrom) : null;
    if (kind === "cut.sendback" && typeof sent.segment === "string" && !rs) return { error: `No generated segment ${sent.segment} of this video.` };
    const accepted = kind === "cut.approve" && cutAccepts(a.failed).overlays.length ? { accept_fail: ["overlays"] } : {};
    return { data: { video, file: a.file, sha256: a.sha256, ...(kind === "cut.approve" ? { export: exp, ...accepted } : {}), ...(rs ? { segment: rs.name, cost_usd: rs.cost } : {}) } };
  }
  const seg = p.segments.find((s) => s.name === sent.segment);
  if (!seg) return { error: "No such segment." };
  if (seg.sharedFrom) return { error: `${seg.name} is ${seg.sharedFrom}'s segment: decide it on that video.` };
  if (kind === "motion.approve" || kind === "motion.reject") {
    const m = seg.motion;
    if (!m) return { error: `${seg.name} is not a motion-designed screen.` };
    if (!m.render) return { error: `No render of ${seg.name} yet: the agent runs motion_design.py render.` };
    if (kind === "motion.reject") return { data: { video, segment: seg.name, file: "motion/render.mp4", sha256: m.render.sha256 } };
    if (!m.gates) return { error: "The gates have not run on this render: the agent runs motion_design.py check." };
    const ticked = Array.isArray(sent.checks) ? sent.checks.map(String) : [];
    const { stale, seen, accept: acc } = motionAccepts(m, ticked);
    if (stale) return { error: "The render is not of the page and the story now: the agent renders and checks again." };
    const open = acc.filter((g) => !accepts.includes(g));
    if (open.length) return { error: `Not passed: ${open.join(", ")}. Reject it, tick what you read on the stills, or approve anyway with your note.` };
    return { data: { video, segment: seg.name, file: "motion/render.mp4", sha256: m.render.sha256, ...(seen.length ? { checks: Object.fromEntries(seen.map((c) => [c, "pass"])) } : {}), ...(acc.length ? { accept_fail: acc } : {}) } };
  }
  if (kind === "composite.approve" || kind === "composite.sendback") {
    if (!seg.composite) return { error: `No composite of ${seg.name} yet.` };
    return { data: { video, segment: seg.name, file: seg.composite.file, sha256: seg.composite.sha256 } };
  }
  const take = seg.takes.find((t) => t.file === sent.file);
  if (!take) return { error: `No take ${String(sent.file ?? "")} of ${seg.name}.` };
  if (kind === "take.reject") {
    const fix = typeof sent.fix === "string" ? sent.fix.trim().slice(0, 600) : "";
    return { data: { video, segment: seg.name, file: take.file, sha256: take.sha256, decision: sent.decision === "reject" ? "reject" : "regenerate", ...(fix ? { fix } : {}), cost_usd: seg.cost } };
  }
  /* take.approve: the identity gate first on a motion-copy take, then every check review.py needs. */
  if (seg.motionCopy) {
    if (!take.identity) return { error: "The identity gate has not run on this take: the agent runs scripts/character/identity.py first." };
    if (!identityOk(take.identity.result) && !accepts.includes("identity")) return { error: `The identity gate says ${take.identity.result}${take.identity.why ? `: ${take.identity.why}` : ""}. Reject this take, or approve anyway with your note.` };
  }
  const ticked = Array.isArray(sent.checks) ? sent.checks.map(String) : [];
  const miss = seg.checks.filter((c) => !ticked.includes(c));
  if (miss.length) return { error: `Tick every check first: ${miss.join(", ")}.` };
  const idFail = !!seg.motionCopy && !identityOk(take.identity?.result);
  return { data: { video, segment: seg.name, file: take.file, sha256: take.sha256, checks: Object.fromEntries(seg.checks.map((c) => [c, "pass"])), ...(idFail ? { accept_fail: ["identity"] } : {}) } };
}
