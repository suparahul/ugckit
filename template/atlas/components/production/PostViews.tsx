/**
 * The post page's two bodies and its folded reference block.
 *
 *   PlanningMode   the deck as written, one slide at a time (Deck.tsx in plan
 *                  mode: the sketch frame, the on-image text at reading size,
 *                  where it sits, the prompt, a note). With no deck yet, the
 *                  plan row and the source post, and what happens next.
 *   ProducedMode   the deck as it will appear (Deck.tsx in produced mode).
 *   AnatomyRail    the rules, the style prefix, the ask and experiment tags,
 *                  the parameter table from the deck file and the outcome
 *                  rows, folded closed under the body.
 */

import Link from "next/link";

import { getPost } from "@/lib/data";
import { dateParts, getProduction, outcomesOpenAt, postPath, type Deck, type DeckFile, type PostState, type SourceRef } from "@/lib/production";
import { Deck as DeckView } from "./Deck";

export function sourceLink(src: { handle: string | null; id: string | null } | null): { href: string; label: string; inAtlas: boolean; cover: string | null } | null {
  if (!src || !src.handle) return null;
  if (src.id) {
    const hit = getPost(src.id);
    if (hit) return { href: `/post/${src.id}`, label: "open in the Atlas", inAtlas: true, cover: hit.post.cover ?? hit.post.slides[0] ?? null };
    return { href: `https://www.tiktok.com/@${src.handle}/photo/${src.id}`, label: "open on TikTok", inAtlas: false, cover: null };
  }
  return { href: `https://www.tiktok.com/@${src.handle}`, label: "open on TikTok", inAtlas: false, cover: null };
}

/* ---------------------------------------------------------------- planning */

export function PlanningMode({ state, readOnly, src, slideNo }: { state: PostState; readOnly?: boolean; src: ReturnType<typeof sourceLink>; slideNo: number }) {
  const { deck, deckFile } = state;

  if (!deck || !deckFile) return <IdeaBrief state={state} />;

  return <DeckView state={state} deck={deck} deckFile={deckFile} initial={slideNo} src={src ? { href: src.href, label: src.label, inAtlas: src.inAtlas } : null} overlayOff={false} readOnly={!!readOnly} mode="plan" />;
}

/* The deck's packaging beyond the caption and sound: the ask, the experiment
   tags, the mirror table and the deck's own notes. Folded into the anatomy. */
function Packaging({ deck }: { deck: Deck }) {
  return (
    <dl className="packaging">
      <div className="packaging__row"><dt>Ask</dt><dd>{deck.ask ?? "—"}</dd></div>
      {deck.experimentTags ? <div className="packaging__row"><dt>Experiments</dt><dd>{deck.experimentTags}</dd></div> : null}
      {deck.mirror ? (
        <div className="packaging__row">
          <dt>Mirror</dt>
          <dd>
            <details className="mirror">
              <summary>{deck.mirror.rows.length} lines change · {deck.mirror.title}</summary>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-3)" }}>{deck.mirror.intro}</p>
              <table>
                <thead><tr><th>Slide</th><th>this deck</th><th>the mirror</th></tr></thead>
                <tbody>{deck.mirror.rows.map((r, i) => <tr key={i}><td>{r.slide}</td><td>{r.from}</td><td>{r.to}</td></tr>)}</tbody>
              </table>
            </details>
          </dd>
        </div>
      ) : null}
      {deck.notes.map((n) => (
        <div key={n.title} className="packaging__row"><dt>Note</dt><dd><b style={{ fontWeight: 600 }}>{n.title}.</b> {n.text}</dd></div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------- idea */

const ROLE_WORD: Record<SourceRef["role"], string> = { model: "Modelled on", skeleton: "Skeleton from", structure: "Structure from", topic: "Topic from", reference: "See" };
const fmtN = (n: number | null | undefined) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, "")}M` : n.toLocaleString("en-US"));
const pct = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? `${((a / b) * 100).toFixed(2)}%` : null);
export const curl = (t: string) => t.replace(/"([^"]*)"/g, "\u201c$1\u201d");
const dateWord = (iso: string | null | undefined) => { if (!iso) return null; const p = dateParts(iso); return `${p.d} ${p.month.slice(0, 3)} ${p.y}`; };

/** The verbatim of the named source slide, read from the batch notes: a line `2 "worry" / "answer"`. */
function slideVerbatim(src: SourceRef): string[] | null {
  if (!src.slide || !src.notes) return null;
  const re = new RegExp(`(?:^|\\n)\\s*${src.slide} (.+?)(?=\\n\\s*\\d+ "|$)`, "s");
  for (const n of src.notes) {
    const m = n.match(re);
    if (m) return m[1].split(/\s\/\s|\s\+\s(?=small\s)/).map((x) => x.trim().replace(/^small\s+/, "").replace(/\.$/, ""));
  }
  return null;
}

/**
 * The idea, in full, before any deck exists: what the post is (the handle's
 * format lock), the feature card and the arm it carries, where the line comes
 * from, and every source with what it did and why it worked. Rahul judges the
 * idea here and approves it or sends it back; the deck is written after that.
 */
export function IdeaBrief({ state }: { state: PostState }) {
  const { row } = state;
  const { idea, sources } = row;
  const prod = getProduction(row.slug);
  /* The arm's experiment: by its E-code first ("E4 absent" → "E4 proof parenthetical"), else by the arm's
     own phrase inside the experiment's "what" ("caption names the app" → "Caption on the brand handle").
     A row that says it is not an experiment never matches; an arm with no match prints alone. */
  const armPlain = row.arm.replace(/\s*\([^)]*\)/, "");
  const armHead = armPlain.split(";")[0].trim();
  const code = armHead.match(/\bE(\d+)\b/)?.[0] ?? null;
  const real = idea.experiments.filter((e) => !/not an experiment/i.test(e.name));
  const everyExp = Object.values(prod.plan.handles).flatMap((h) => h.experiments);
  const phrase = armHead.toLowerCase();
  const word = phrase.split(/\s+/)[0];
  const text = (e: (typeof real)[number]) => `${e.name} ${e.what}`.toLowerCase();
  const exp =
    (code ? real.find((e) => e.name.startsWith(code + " ")) ?? everyExp.find((e) => e.name.startsWith(code + " ")) : null) ??
    (!code && phrase ? real.find((e) => text(e).includes(phrase)) ?? (word.length >= 4 ? real.find((e) => text(e).includes(word)) : undefined) : null) ??
    null;
  const lock = idea.reasons;
  return (
    <section className="idea" aria-label="The idea">
      <div className="idea__main">
        {idea.premise ? <p className="idea__premise">{curl(idea.premise).replace(/([^.!?])$/, "$1.")}</p> : <p className="pending idea__premise">The handle has no format lock in the plan.</p>}
        {idea.answer ? (
          <div className="meme" aria-label="The two slides">
            <div className="meme__slide is-worry">
              <span className="meme__no tabular" aria-hidden="true">1 / 2</span>
              <p className="meme__worry">{curl(`"${idea.answer.worry}"`)}</p>
              <span className="meme__hint">over a rendered cat photo</span>
            </div>
            <div className="meme__slide is-card">
              <span className="meme__no tabular" aria-hidden="true">2 / 2</span>
              <div className="meme__card">
                <p className="meme__q">{idea.answer.worry}</p>
                {idea.answer.lines.map((l, i) => <p key={i} className="meme__a">{curl(l)}</p>)}
              </div>
              <span className="meme__hint">the CatGPT answer card, in-app screenshot</span>
            </div>
          </div>
        ) : null}
        <dl className="idea__rows" aria-label="This post">
          <div className="idea__row"><dt>Format</dt><dd>{row.format}</dd></div>
          <div className="idea__row"><dt>Feature card</dt><dd>{idea.feature ?? <span className="is-blank">none named</span>}</dd></div>
          <div className="idea__row">
            <dt>Arm</dt>
            <dd>
              {armPlain}
              {exp ? <span className="idea__exp"> — {exp.name}: {exp.what}. {exp.schedule}.</span> : code ? <span className="idea__exp is-blank"> — {code} is not in the plan's experiment tables.</span> : null}
            </dd>
          </div>
          {idea.product ? <div className="idea__row"><dt>Product slot</dt><dd>{idea.product}</dd></div> : null}
        </dl>
        {idea.record ? (
          <details className="idea__lock">
            <summary>The cat's record the answer cites · {idea.record.length} fields</summary>
            <dl className="idea__rows">
              {idea.record.map((r) => (
                <div key={r.field} className="idea__row"><dt>{r.field}</dt><dd>{curl(r.value)}</dd></div>
              ))}
            </dl>
          </details>
        ) : null}
        {lock.length ? (
          <details className="idea__lock">
            <summary>The handle's lock · the same on every {row.handle} post this week</summary>
            <dl className="idea__rows">
              {lock.map((r) => (
                <div key={r.label} className="idea__row"><dt>{r.label}</dt><dd>{curl(r.text)}</dd></div>
              ))}
            </dl>
          </details>
        ) : null}
      </div>

      <div className="idea__sources">
        {sources.filter((x) => x.handle).map((src, i) => {
          const pic = src.slide && src.slides?.[src.slide - 1] ? src.slides[src.slide - 1] : src.cover ?? src.slides?.[0] ?? null;
          const verbatim = slideVerbatim(src);
          /* No title: the caption's first sentence, at most 90 characters; the whole caption stays in the folded read. */
          const capLine = src.caption ? src.caption.replace(/#\S+/g, "").replace(/\s+/g, " ").trim() : "";
          const title = (src.title ? src.title.replace(/#\S+/g, "").replace(/\s+/g, " ").trim() || null : null) ?? (capLine ? (capLine.length > 90 ? `${capLine.slice(0, 90).replace(/\s+\S*$/, "")}…` : capLine) : null);
          const unread = !src.notes?.length && !src.pattern;
          const planNote = (src.text.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g) ?? []).map((x) => x.slice(1, -1)).filter((x) => !/^@/.test(x)).join(" ");
          const href = src.atlas ?? src.url ?? null;
          const siblings = prod.rows.filter((r) => r.key !== row.key && r.sources.some((x) => x.id && x.id === src.id));
          return (
            <article key={i} className="src">
              <h2 className="src__role">{ROLE_WORD[src.role]} @{src.handle}{src.slide ? ` · slide ${src.slide}` : ""}</h2>
              <div className="src__body">
                {pic ? (
                  <a className="src__pic" href={href ?? undefined} target={src.atlas ? undefined : "_blank"} rel="noreferrer" aria-label={`Source ${src.slide ? `slide ${src.slide}` : "post"} from @${src.handle}`}>
                    <img src={pic} alt="" />
                  </a>
                ) : (
                  <p className="src__nopic pending">no picture of this source held</p>
                )}
                <div className="src__text">
                  {title ? <p className="src__title">{curl(title)}</p> : null}
                  {verbatim ? <p className="src__verbatim verbatim">{verbatim.map((v, k) => <span key={k}>{curl(v)}</span>)}</p> : null}
                  {unread ? <p className="src__nopic pending">no read of this source held</p> : null}
                  {planNote ? <p className="src__note">{curl(planNote)}</p> : null}
                  <p className="src__stats tabular">
                    <b>{fmtN(src.views)}</b> views
                    {pct(src.saves, src.views) ? ` · ${pct(src.saves, src.views)} saves/view` : ""}
                    {src.comments != null ? ` · ${fmtN(src.comments)} comments` : ""}
                    {src.slides?.length ? ` · ${src.slides.length} slides` : ""}
                    {dateWord(src.date) ? ` · ${dateWord(src.date)}` : ""}
                  </p>
                  {src.pattern ? <p className="src__why"><b>Why it worked.</b> {curl(src.pattern)}</p> : null}
                  <p className="src__links">
                    {src.atlas ? <Link href={src.atlas}>open in the Atlas</Link> : null}
                    {src.url ? <a href={src.url} target="_blank" rel="noreferrer">on TikTok<span className="sr-only"> (new tab)</span></a> : null}
                    {src.account ? <Link href={src.account}>@{src.handle} in the Atlas</Link> : null}
                  </p>
                  {!src.notes?.length && capLine.length > 90 ? (
                    <details className="src__read">
                      <summary>The full caption</summary>
                      <ul><li>{curl(capLine)}</li></ul>
                    </details>
                  ) : null}
                  {src.notes?.length ? (
                    <details className="src__read">
                      <summary>The full read · {src.notes.length} line{src.notes.length === 1 ? "" : "s"}</summary>
                      <ul>{src.notes.map((n, k) => <li key={k}>{curl(n)}</li>)}</ul>
                    </details>
                  ) : null}
                  {siblings.length ? (
                    <p className="src__siblings">
                      Also the source of{" "}
                      {siblings.map((r, k) => {
                        const ref = r.sources.find((x) => x.id === src.id);
                        return <span key={r.key}>{k ? ", " : ""}<Link href={postPath(r)}>{r.short} {dateParts(r.date).d} {r.slot}{ref?.slide ? ` (slide ${ref.slide})` : ""}</Link></span>;
                      })}.
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
        {sources.filter((x) => !x.handle).map((src, i) => (
          <p key={`ref${i}`} className="src__ref">{ROLE_WORD.reference} {src.text}</p>
        ))}
        {!sources.length ? <p className="pending src__nopic">The plan names no source for this post.</p> : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- produced */

export function ProducedMode({ state, slideNo, src, overlayOff, readOnly }: { state: PostState; slideNo: number; src: ReturnType<typeof sourceLink>; overlayOff?: boolean; readOnly?: boolean }) {
  const { deck, deckFile } = state;
  if (!deck || !deckFile) return null;
  return <DeckView state={state} deck={deck} deckFile={deckFile} initial={slideNo} src={src ? { href: src.href, label: src.label, inAtlas: src.inAtlas } : null} overlayOff={!!overlayOff} readOnly={!!readOnly} />;
}

/* ----------------------------------------------------------------- anatomy */

const OUTCOME_COLS = [/^views$/i, /^saves\/view$/i, /^shares\/view$/i, /^comments\/view$/i, /^app questions$/i, /app store search impressions/i];
const isOutcome = (c: string) => OUTCOME_COLS.some((r) => r.test(c));

export function AnatomyRail({ state, src }: { state: PostState; src: ReturnType<typeof sourceLink> }) {
  const { deck, deckFile, row } = state;
  const rules = [...(deckFile?.rules ?? []), ...getProduction(row.slug).plan.rules];
  const rows = deck?.anatomy ?? [];
  const params = rows.filter((r) => !isOutcome(r.column));
  const outs = rows.filter((r) => isOutcome(r.column));
  const opens = outcomesOpenAt(state);
  /* The day-7 numbers Rahul typed; before that, the last sync (Monid with saves, or Post Bridge without). */
  const o = state.outcomes ?? (state.synced ? { views: state.synced.views, shares: state.synced.shares, comments: state.synced.comments, ...(state.synced.saves != null ? { saves: state.synced.saves } : {}) } : null);
  const fromSync = !state.outcomes && !!state.synced;
  const pct = (a: unknown, b: unknown) => (Number(b) > 0 ? `${((Number(a) / Number(b)) * 100).toFixed(2)}%` : "—");
  const computed: Record<string, string> = o
    ? {
        views: Number(o.views).toLocaleString("en-US"),
        "saves/view": pct(o.saves, o.views),
        "shares/view": pct(o.shares, o.views),
        "comments/view": pct(o.comments, o.views),
        "app questions": String(o.appQuestions ?? "—"),
        store: String(o.storeImpressions ?? "—"),
      }
    : {};
  const valueFor = (col: string) => {
    if (!o) return null;
    if (/^views$/i.test(col)) return computed.views;
    if (/^saves/i.test(col)) return computed["saves/view"];
    if (/^shares/i.test(col)) return computed["shares/view"];
    if (/^comments/i.test(col)) return computed["comments/view"];
    if (/^app questions/i.test(col)) return computed["app questions"];
    return computed.store;
  };
  const sourceText = `@${row.source.handle ?? "—"}${row.source.views ? ` · ${row.source.views.toLocaleString("en-US")} views` : ""}`;
  return (
    <details className="anatomy">
      <summary>Anatomy and rules{state.outcomes ? " · outcomes in" : fromSync ? " · outcomes synced" : ""}</summary>
      {rules.length ? <ul className="plan__rules">{rules.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
      {deckFile?.stylePrefix ? (
        <div className="anatomy__prefix">
          <h2>Style prefix · in front of every image prompt</h2>
          <p>{deckFile.stylePrefix}</p>
          {deckFile.styleNotes.map((n, i) => <p key={i}>{n}</p>)}
        </div>
      ) : null}
      {deck ? <Packaging deck={deck} /> : null}
      {!deck ? <p className="anatomy__opens">No deck, no parameter table yet.</p> : null}
      <dl>
        <div className="anatomy__row"><dt>Arm</dt><dd>{row.arm}</dd></div>
        <div className="anatomy__row"><dt>Deck file</dt><dd>{deckFile ? deckFile.file : <span className="is-blank">atlas/data/decks/{row.date}-{row.short}.md (not written yet)</span>}</dd></div>
        <div className="anatomy__row">
          <dt>Source</dt>
          <dd>
            {sourceText}
            {src ? <> · <a href={src.href} target={src.inAtlas ? undefined : "_blank"} rel="noreferrer">{src.label} →</a></> : null}
          </dd>
        </div>
        {state.link ? <div className="anatomy__row"><dt>Posted</dt><dd><a href={state.link} target="_blank" rel="noreferrer">{state.posted?.time ?? ""} · open on TikTok →</a></dd></div> : null}
        {/* The Instagram leg, when the post has one: where it is, its link, and what it posts beside the slides. */}
        {state.legs?.instagram ? (() => {
          const ig = state.legs.instagram!;
          const where = ig.dropped ? `not on this post${ig.dropped.note ? ` · ${ig.dropped.note}` : ""}` : ig.failed ? `failed · ${ig.failed.error}` : ig.posted ? `${ig.posted.time} UTC` : ig.sent ? "sent" : "with TikTok's send";
          const caption = deck?.caption ? deck.caption.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim() : null;
          const tags = [...new Set([...(deck?.hashtags ?? []), ...((deck?.caption ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [])])];
          return (
            <>
              <div className="anatomy__row"><dt>Instagram</dt><dd>{ig.link ? <a href={ig.link} target="_blank" rel="noreferrer">{where} · open on Instagram →</a> : where}</dd></div>
              <div className="anatomy__row"><dt>Instagram post</dt><dd>4:5 JPEG slides, the cover text burned in, no music (added by hand){caption ? <> · caption “{caption.split("\n")[0]}”</> : null}{tags.length ? <> · first comment {tags.join(" ")}</> : null}</dd></div>
            </>
          );
        })() : null}
        {params.map((r) => {
          let v = r.value;
          if (/^handle \/ post$/i.test(r.column) && state.link) v = `${state.row.handle} · ${state.link.split("/").pop()}`;
          return (
            <div key={r.column} className="anatomy__row">
              <dt>{r.column}</dt>
              <dd className={v ? "" : "is-blank"}>{v || "—"}</dd>
            </div>
          );
        })}
      </dl>
      {deck ? (
        <div className="anatomy__outcomes">
          <h2>Outcomes</h2>
          {o ? (
            <dl>
              {fromSync && state.synced ? <div className="anatomy__row is-outcome"><dt>Source</dt><dd>{state.synced.source === "monid" ? "Monid" : "Post Bridge"} sync {state.synced.at.slice(0, 10)} · {state.synced.likes.toLocaleString("en-US")} likes{state.synced.source === "monid" ? "" : " · saves not in its analytics"}{state.link ? <> · <a href={state.link} target="_blank" rel="noreferrer">open on TikTok →</a></> : ""}{opens && !state.outcomes ? ` · the day-7 form opens ${opens}` : ""}</dd></div> : null}
              {outs.map((r) => (
                <div key={r.column} className="anatomy__row is-outcome">
                  <dt>{r.column.replace(/\s*\(.*\)$/, "")}</dt>
                  <dd>{valueFor(r.column)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <p className="anatomy__opens">{opens ? `opens ${opens}` : "open seven days after posting"}</p>
              <dl>
                {outs.map((r) => (
                  <div key={r.column} className="anatomy__row"><dt>{r.column.replace(/\s*\(.*\)$/, "")}</dt><dd className="is-blank">—</dd></div>
                ))}
              </dl>
            </>
          )}
        </div>
      ) : null}
    </details>
  );
}
