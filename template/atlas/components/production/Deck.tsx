"use client";

/**
 * The deck, one slide at a time. Two modes on one structure:
 *
 *   plan       the sketch frame (text placement only), and beside it the
 *              on-image text at reading size, where it sits, the image prompt
 *              and a note. Rahul reads slide one, presses Next, reads slide two.
 *   produced   the replica with the current picture, and beside it the
 *              per-slide judgement, the prompt, the note and the source slide.
 *
 * The slide in view is client state, mirrored into the URL (?slide=n) with
 * replaceState so the address stays true and the page never scrolls or
 * reloads on a slide change. The strip of slide numbers sits above the frame,
 * in the first fold, with prev and next beside it; j k and the arrow keys walk
 * the strip too. Pictures come from coding agents through the API; this page
 * only judges what is there.
 */

import { useEffect, useRef, useState } from "react";

import type { Deck as DeckT, DeckFile, PostState, Slide } from "@/lib/production";
import { BOX_FONT_SIZE, FONT_SIZE_BY, type Layout } from "@/lib/layout";
import { PhoneTick, SlideActions, SlideNote, SlideTextFlag, useDecide } from "./Actions";
import { Replica, Sketch } from "./Frame";
import { LayoutEditor } from "./LayoutEditor";
import { CheckIcon, Diamond, SoundIcon } from "./Marks";

type Src = { href: string; label: string; inAtlas: boolean } | null;
export type DeckMode = "plan" | "produced";

export function Deck({ state, deck, deckFile, initial, src, overlayOff, readOnly, mode = "produced" }: { state: PostState; deck: DeckT; deckFile: DeckFile; initial: number; src: Src; overlayOff: boolean; readOnly: boolean; mode?: DeckMode }) {
  const plan = mode === "plan";
  const total = deck.slides.length;
  const [n, setN] = useState(Math.min(Math.max(1, initial), total));
  const [overlay, setOverlay] = useState(!overlayOff);
  /* The layout being edited, or null. Leaving the slide drops an unlocked draft. */
  const [draft, setDraft] = useState<Layout | null>(null);
  const frameWrap = useRef<HTMLDivElement>(null);
  const [decide, busy] = useDecide();
  const [lockErr, setLockErr] = useState<string | null>(null);
  useEffect(() => { setDraft(null); setLockErr(null); }, [n]);

  /* The default layout, read off the replica as drawn: each block's box in
   * percent of the frame. That is the starting point for hand placement. */
  const layoutFromDom = (s: Slide): Layout | null => {
    const f = frameWrap.current?.querySelector(".frame")?.getBoundingClientRect();
    if (!f) return null;
    const els = Array.from(frameWrap.current!.querySelectorAll<HTMLElement>("[data-block]"));
    const blocks = s.blocks.map((b, i) => {
      const el = els.find((e) => e.dataset.block === String(i));
      const r = el?.getBoundingClientRect();
      return {
        x: r ? ((r.left - f.left) / f.width) * 100 : 6,
        y: r ? ((r.top - f.top) / f.height) * 100 : 7 + i * 12,
        w: r ? (r.width / f.width) * 100 : 88,
        fs: b.box ? BOX_FONT_SIZE : FONT_SIZE_BY[state.dimension][b.size],
        text: b.text,
        align: (b.box || el?.classList.contains("is-left") ? "left" : "center") as "left" | "center",
        box: b.box,
      };
    });
    /* The card, when the slide has one and it is on the page: where the default stacks put it, as a hand-placed card. */
    const cardEl = frameWrap.current!.querySelector<HTMLElement>("[data-card]");
    const cr = cardEl?.getBoundingClientRect();
    const card = s.cards.length && cr ? { x: ((cr.left - f.left) / f.width) * 100, y: ((cr.top - f.top) / f.height) * 100, w: (cr.width / f.width) * 100 } : null;
    return card ? { blocks, card } : { blocks };
  };
  /* An older lock without a card gets the card where the page shows it now. */
  const editable = (l: Layout, s: Slide): Layout => (l.card || !s.cards.length ? l : { ...l, card: layoutFromDom(s)?.card ?? null });
  const lock = async () => {
    if (!draft) return;
    setLockErr(null);
    const r = await decide({ post: state.row.key, kind: "slide.layout", slide: n, data: { layout: JSON.stringify(draft) } });
    if (r) setLockErr(r); else setDraft(null);
  };
  const { row } = state;
  /* Slide judgements do not wait for Rahul's turn: a wrong picture can be sent
   * back while the agent is still making the others. Only the rail waits. */
  const canDecide = !state.killed && (state.stage === "final" || state.stage === "ready");

  /* Mirror the slide into the URL only after a change Rahul makes, never on
   * mount. On mount this effect runs before Next.js has patched history, so
   * a native replaceState(null) would wipe the router's own entry state
   * (__NA and the route tree): back/forward would then show the wrong screen
   * under this URL and the router's canonical URL would lose ?slide. On
   * mount the address is already the one the server rendered from. */
  const written = useRef({ n, overlay });
  useEffect(() => {
    if (written.current.n === n && written.current.overlay === overlay) return;
    written.current = { n, overlay };
    const url = new URL(window.location.href);
    url.searchParams.set("slide", String(n));
    if (overlay) url.searchParams.delete("overlay"); else url.searchParams.set("overlay", "0");
    window.history.replaceState(null, "", url.toString());
  }, [n, overlay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "j" || e.key === "ArrowRight") setN((k) => Math.min(total, k + 1));
      if (e.key === "k" || e.key === "ArrowLeft") setN((k) => Math.max(1, k - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  const slide = deck.slides[n - 1];
  const ss = state.slides[n - 1];
  /* An illustrated deck (the item row `Slide style: illustrated`): the generator drew the text into the picture, so the
   * replica shows the picture as the finished slide — no text blocks, no layout to lock — with the callout card on the
   * product slide where the compositor pastes it. An absent row, or `photo`, is the photo replica. */
  const illustrated = /^illustrated/i.test(deck.items?.["Slide style"] ?? "");
  const empty = state.slides.filter((s) => !s.current).length;
  const srcThumb = deck.sourceSlides[n - 1] ?? null;
  const captionBody = deck.caption ? deck.caption.replace(/#[\w]+/g, "").trim() : "";
  const namesApp = /caption names the app/i.test(row.arm);
  const notes = state.log.filter((e) => e.kind === "slide.note" && e.slide === n);
  const noted = new Set(state.log.filter((e) => e.kind === "slide.note" && e.slide).map((e) => e.slide as number));
  const where = (b: (typeof slide.blocks)[number]) => `${b.label}${b.hint ? ` · ${b.hint}` : ""} · ${b.size}${b.box ? " · in a box" : ""}`;

  return (
    <section className="rep" aria-label={plan ? "The deck as written" : "The deck as it will appear"}>
      <div className="rep__top">
        <button type="button" className="rep__arrow" onClick={() => setN((k) => Math.max(1, k - 1))} disabled={n <= 1} aria-label="Previous slide">‹</button>
        <ol className="rep__strip" aria-label="Every slide">
          {deck.slides.map((s, i) => {
            const st = state.slides[i];
            return (
              <li key={s.n}>
                <button type="button" className={`${plan ? (noted.has(s.n) ? "is-noted" : "is-plain") : `is-${st.status}`}${st.changed ? " is-changed" : ""}${st.layout && !illustrated ? " is-locked" : ""}${s.n === n ? " is-here" : ""}`} aria-current={s.n === n ? "true" : undefined} aria-label={plan ? `slide ${s.n}, ${s.label}${noted.has(s.n) ? ", has a note" : ""}` : `slide ${s.n}, ${st.status === "needsnew" ? "needs a new picture" : st.status === "candidate" ? "candidate" : st.status === "approved" ? "approved" : "no picture"}${st.changed ? `, text changed since the ${state.changed?.since === "final" ? "post" : "plan"} was approved` : ""}${st.layout && !illustrated ? ", saved layout" : ""}`} title={!plan && st.layout && !illustrated ? "saved layout" : undefined} onClick={() => setN(s.n)}>
                  {s.n}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="rep__arrow" onClick={() => setN((k) => Math.min(total, k + 1))} disabled={n >= total} aria-label="Next slide">›</button>
        {plan ? (
          <p className="rep__count tabular" aria-live="polite">{n} of {total}{noted.size ? ` · ${noted.size} noted` : ""}</p>
        ) : (
          <>
            <p className="rep__count tabular">{state.approvedSlides} of {total} approved{empty ? ` · ${empty} without a picture` : ""}</p>
            {illustrated ? (
              <span className="rep__overlay" title="The text is part of the picture: the generator drew it">text in the picture</span>
            ) : (
              <button type="button" className={`rep__overlay${overlay ? " is-on" : ""}`} aria-pressed={overlay} onClick={() => setOverlay((v) => !v)} title="Show or hide the text drawn over the pictures">
                text {overlay ? "on" : "off"}
              </button>
            )}
          </>
        )}
      </div>

      {plan ? (
        <div className="rep__body">
          <div className="rep__frame">
            <Sketch slide={slide} total={total} dimension={state.dimension} />
            <p className="rep__textflag">The text in its planned place and size; no picture yet.</p>
          </div>
          <div className="rep__side">
            <div className="sr">
              <div className="sr__h">
                <span className="sr__title"><b>Slide {n} of {total}</b> · {slide.label} {slide.isProduct ? <Diamond /> : null}</span>
              </div>
              {slide.why ? <p className="sr__why">{slide.why}</p> : slide.isProduct ? <p className="sr__why">The app's one appearance in the deck: a first-person line and the product callout (the App Store image and one in-app image).</p> : null}
              <div className="sr__copy">
                {slide.blocks.map((b, i) => (
                  <div key={i}>
                    <pre className={`pslide__copy is-${b.size}`}>{b.text}</pre>
                    <p className="pslide__where">{where(b)}</p>
                  </div>
                ))}
                {!slide.blocks.length ? <p className="sr__hint">No text on this slide.</p> : null}
              </div>
              <dl className="sr__rows">
                {slide.position ? <div className="sr__row"><dt>Where</dt><dd>{slide.position}</dd></div> : null}
                {slide.cards.length ? (
                  <div className="sr__row"><dt>Cards</dt><dd><ol className="sr__list">{slide.cards.map((c, i) => <li key={i}>{c}</li>)}</ol></dd></div>
                ) : null}
                <div className="sr__row"><dt>Prompt</dt><dd>{slide.prompt ?? <span className="pending" style={{ display: "inline-block", padding: "2px 8px" }}>no image prompt</span>}</dd></div>
                <div className="sr__row"><dt>Note</dt><dd><SlideNote post={row.key} slide={n} notes={notes} readOnly={readOnly} /></dd></div>
              </dl>
            </div>

            <div className="tt">
              <div className="tt__handle">{row.handle}<small>{deckFile.bio ?? ""}</small></div>
              <p className="tt__caption">
                {captionBody}{" "}
                {deck.hashtags.map((h) => <span key={h} className="tag">{h} </span>)}
              </p>
              <p className="tt__sound"><SoundIcon />{deck.sound ? deck.sound.split(/\.\s/)[0].replace(/\.$/, "") : "sound not chosen"}</p>
            </div>
            <p className="rep__editor">The prompt is sent with the deck's style prefix in front of it; the prefix is under Anatomy and rules. The editor's font will differ from the sketch.</p>
            {n === total ? (
              <p className="rep__end">
                That was the last slide{noted.size ? `, with ${noted.size} noted` : ""}. <a href="#decision">Approve the plan, or send it back</a> in the band above.
              </p>
            ) : null}
          </div>
        </div>
      ) : (

      <div className="rep__body">
        <div className="rep__frame" ref={frameWrap}>
          {draft ? (
            <LayoutEditor post={row.key} slide={slide} state={ss} cards={state.cards} total={total} layout={draft} onChange={setDraft} dimension={state.dimension} onSave={lock} onCancel={() => setDraft(null)} busy={busy} error={lockErr} />
          ) : (
            <Replica slide={slide} state={ss} cards={state.cards} total={total} text={illustrated || !overlay ? "off" : "on"} layout={illustrated ? null : ss.layout} dimension={state.dimension} />
          )}
          {canDecide && ss.text === "baked" && !draft && !illustrated ? (
            <p className="rep__lockrow">
              {ss.layout ? (
                <>
                  <span className="rep__lockhint">Layout saved: the final is drawn from it.</span>
                  <button type="button" className="rail__kill" disabled={busy} onClick={() => setDraft(editable(ss.layout!, slide))}>Edit</button>
                  <button type="button" className="rail__kill" disabled={busy} onClick={() => decide({ post: row.key, kind: "slide.unlock", slide: n }).then((r) => setLockErr(r))}>Reset to default</button>
                </>
              ) : (
                <>
                  <span className="rep__lockhint">Deck default layout.</span>
                  <button type="button" className="rail__kill" onClick={() => { const l = layoutFromDom(slide); if (l) setDraft(l); }}>Edit layout</button>
                </>
              )}
              {lockErr ? <span className="rail__err" role="alert">{lockErr}</span> : null}
            </p>
          ) : null}
          {ss.current ? (
            <p className="rep__textflag">
              <strong>Exported image:</strong>{" "}
              {illustrated ? "the picture as it is; the text is drawn in it by the generator, nothing is burned" : ss.text === "baked" ? "text burned in, as drawn here" : `text-free, you type the words in TikTok${n === 1 ? " (the cover's default)" : ""}`}
              {canDecide && !illustrated ? <> · <SlideTextFlag post={row.key} slide={n} text={ss.text} /></> : "."}
            </p>
          ) : null}
        </div>

        <div className="rep__side">
          <div className="sr">
            <div className="sr__h">
              <span className="sr__title"><b>Slide {n} of {total}</b> · {slide.label} {slide.isProduct ? <Diamond /> : null}</span>
              <span className={`sr__status is-${ss.status}`}>
                {ss.status === "approved" ? `approved${ss.at ? ` ${ss.at.slice(11, 16)}` : ""}${ss.current !== ss.approved ? ` · viewing candidate ${ss.candidates.indexOf(ss.current!) + 1} of ${ss.candidates.length}` : ""}` : ss.status === "needsnew" ? "needs a new one" : ss.status === "candidate" ? `candidate${ss.candidates.length > 1 ? ` ${ss.candidates.indexOf(ss.current!) + 1} of ${ss.candidates.length}` : ""}` : "no picture yet"}
              </span>
            </div>
            {ss.status === "needsnew" && ss.note ? <p className="sr__reject"><em>“{ss.note}”</em></p> : null}
            {ss.changed ? <p className="sr__changed">{state.changed?.since === "final" ? "The text of this slide changed after you approved the post. Check the picture still fits, then approve for posting again." : "The text of this slide changed after you approved the plan. The plan stays approved; check the picture still fits."}</p> : null}
            {!ss.current ? <p className="sr__hint">{canDecide || readOnly ? "No picture yet. It appears here as a candidate when one is made from the prompt below." : "Pictures are judged once the plan is approved."}</p> : null}
            <SlideActions post={row.key} slide={n} state={ss} canDecide={canDecide} />
            <dl className="sr__rows">
              {slide.cards.length ? (
                <div className="sr__row">
                  <dt>Product callout</dt>
                  <dd>
                    {slide.cards.map((c, i) => {
                      const held = state.cards.find((k) => k.index === i + 1)?.file ?? null;
                      return (
                        <p key={i} className="sr__card"><span className={`check ${held ? "is-ok" : "is-bad"}`}><CheckIcon ok={!!held} />{held ? "made" : "not made yet"}</span> {i + 1}. {c}</p>
                      );
                    })}
                  </dd>
                </div>
              ) : null}
              <div className="sr__row"><dt>Prompt</dt><dd>{slide.prompt ?? "—"}</dd></div>
              <div className="sr__row"><dt>Note</dt><dd><SlideNote post={row.key} slide={n} notes={notes} /></dd></div>
              <div className="sr__row">
                <dt>Source</dt>
                <dd>
                  <div className="sr__src">
                    {srcThumb ? <img className="sr__srcthumb" src={`/media/${srcThumb}`} alt={`Source slide ${n} from @${deck.source?.handle}`} /> : null}
                    <div>
                      @{deck.source?.handle} · slide {n}{srcThumb ? "" : " (no source slide on disk)"}
                      {src ? <small><a href={src.href} target={src.inAtlas ? undefined : "_blank"} rel="noreferrer">{src.label}</a></small> : null}
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>

          <div className="tt">
            <div className="tt__handle">{row.handle}<small>{deckFile.bio ?? ""}</small></div>
            <p className="tt__caption">
              {captionBody}{" "}
              {deck.hashtags.map((h) => <span key={h} className="tag">{h} </span>)}
            </p>
            <p className="tt__sound"><SoundIcon />{deck.sound ? deck.sound.split(/\.\s/)[0].replace(/\.$/, "") : "sound not chosen"}</p>
          </div>

          <dl className="checks">
            <div className="checks__row">
              <dt>Checks</dt>
              <dd>
                {state.checks.map((c) => (
                  <span key={c.label} className={`check ${c.ok === null ? "is-na" : c.ok ? "is-ok" : "is-bad"}`}><CheckIcon ok={c.ok} />{c.label}</span>
                ))}
              </dd>
            </div>
            <div className="checks__row">
              <dt>On the phone</dt>
              <dd>
                <PhoneTick id={`${row.key}:sound`} label="sound picked on the device" />
                <PhoneTick id={`${row.key}:bio`} label={deckFile.bio ? `bio set — “${deckFile.bio}”` : "bio set"} />
                {namesApp ? <span className="check is-na"><CheckIcon ok={null} />caption names the app on this handle</span> : null}
              </dd>
            </div>
          </dl>
          <p className="rep__editor">This replica shows the text's position and size. Burned-in text is drawn exactly like this; words you type in TikTok take TikTok's own font.</p>
        </div>
      </div>
      )}
    </section>
  );
}
