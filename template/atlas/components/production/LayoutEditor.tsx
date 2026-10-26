"use client";

/**
 * The replica with its text blocks live. Every block is editable the moment
 * Edit layout opens: one click puts the caret in the words, typing changes
 * them at once. A drag starts from the block's edge (the dashed border zone)
 * or its grip, never from inside the words; the corner handle changes the
 * width. A− / A+ and the alignment toggle in the toolbar act on the block
 * that has the caret. Nothing here writes; the parent holds the draft and
 * posts it as one `slide.layout` line on Save layout.
 *
 * Positions are percentages of the frame, so the same numbers draw this
 * 300px replica and the 1080 × 1920 final that scripts/render-slides.mjs
 * writes. The picture is drawn exactly as the replica draws it.
 *
 * The product callout card is live the same way: drag its edge to move it,
 * its corner to widen it (the height follows the 139:34 ratio), and click
 * its name, subtitle or button to put the caret in that line. The card is
 * drawn here as HTML with the same geometry as scripts/lib/appstore-card.mjs;
 * /api/production/card renders the real PNG with those words as Rahul types
 * (cached by their hash) and says at once when a line is too long.
 *
 * The safe area (lib/layout.ts frameOf) is drawn as a faint band at the top
 * and the bottom; a block may be dragged into it, but the band says what
 * TikTok will cover.
 */

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import type { CardState, Dimension, Slide, SlideState } from "@/lib/production";
import { cardTextOf, frameOf, type CardText, type Layout, type LayoutBlock, type LayoutCard } from "@/lib/layout";
import { frameStyle, freeBlockProps, freeCardStyle, fileUrl, screenSrc } from "./Frame";
import { calloutSvg, EMPTY_BRAND_CALLOUT, type BrandCallout, type Callout, type Style } from "@/lib/infographic";
import { AppCalloutField, calloutToChoice, choiceToCallout, isBanner, shotIdOf } from "./AppCalloutField";
import { phoneOf, shownCards } from "@/lib/callout";
import { appFromPath } from "./scope";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * A contentEditable whose words React never rewrites while Rahul types: the
 * element owns its text, and `text` is pushed into it only when it differs
 * (the first render, or a change from outside), so the caret stays put.
 */
function Editable({ text, onText, className, style, label, multiline = false, onFocus }: { text: string; onText: (t: string) => void; className?: string; style?: CSSProperties; label: string; multiline?: boolean; onFocus?: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const read = (el: HTMLElement) => { const t = (el.innerText ?? "").replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n"); return multiline ? t : t.replace(/\s*\n\s*/g, " "); };
  useEffect(() => { const el = ref.current; if (el && read(el).trim() !== text.trim()) el.innerText = text; });
  const props = {
    ref: ref as never,
    className,
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    role: "textbox",
    "aria-multiline": multiline || undefined,
    "aria-label": label,
    onFocus,
    onInput: (e: React.FormEvent<HTMLElement>) => onText(read(e.currentTarget)),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => { if (!multiline && e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } },
  };
  return multiline ? <p {...props} /> : <span {...props} />;
}
/** The card in the drag state and the selection. */
const CARD = -1;
/** The app screenshot in the drag state and the selection. */
const SCREEN = -2;
/* The default card's strings come from the post's own CardState (apps/<slug>/product.json). Without them the card cannot be rewritten, and says so. */
const NO_TEXT: CardText = { name: "", subtitle: "", button: "" };

export function LayoutEditor({
  post, slide, state, cards, total, layout, onChange, dimension = "3:4", onSave, onCancel, busy = false, error = null,
}: {
  post: string; slide: Slide; state: SlideState; cards: CardState[]; total: number; layout: Layout; onChange: (l: Layout) => void; dimension?: Dimension;
  onSave: () => void; onCancel: () => void; busy?: boolean; error?: string | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const safe = frameOf(dimension).safe;
  const [sel, setSel] = useState<number | null>(null);
  const drag = useRef<{ i: number; mode: "move" | "size"; x0: number; y0: number; bx: number; by: number; bw: number } | null>(null);

  const patch = (i: number, p: Partial<LayoutBlock>) => onChange({ ...layout, blocks: layout.blocks.map((b, k) => (k === i ? { ...b, ...p } : b)) });
  const patchCard = (p: Partial<LayoutCard>) => { if (layout.card) onChange({ ...layout, card: { ...layout.card, ...p } }); };
  const patchScreen = (p: Partial<{ x: number; y: number; w: number }>) => { if (layout.screen) onChange({ ...layout, screen: { ...layout.screen, ...p } }); };

  /* The App callout field (AppCalloutField.tsx): the same options as the design editor. A banner is the post's
   * cards/1-custom.png (drawn by /api/production/callout) placed by layout.card; a screenshot is layout.screen. */
  const app = appFromPath();
  const [assets, setAssets] = useState<{ id: string; file?: string; kind?: string }[]>([]);
  useEffect(() => {
    fetch(`/media/apps/${encodeURIComponent(app)}/brand/assets/assets.json`).then((r) => (r.ok ? r.json() : []))
      .then((a: { id: string; file?: string; kind?: string }[]) => setAssets(Array.isArray(a) ? a : [])).catch(() => setAssets([]));
  }, [app]);
  const [banner, setBanner] = useState<Callout | null>(null);
  const [brand, setBrand] = useState<{ style: Partial<Style>; callout: BrandCallout }>({ style: {}, callout: EMPTY_BRAND_CALLOUT });
  const [icon, setIcon] = useState("");
  /* A banner picked here is previewed in the browser and written (cards/1-custom.png) only on Save layout: Cancel changes nothing. undefined: no change. */
  const [pending, setPending] = useState<Callout | null | undefined>(undefined);
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/production/callout?${new URLSearchParams({ app, post })}`).then((r) => r.json())
      .then((j: { callout?: Callout | null; brand?: { style: Style; callout: BrandCallout }; icon?: string }) => { setBanner(j.callout ?? null); if (j.brand) setBrand(j.brand); setIcon(j.icon ?? ""); })
      .catch(() => setBanner(null));
  }, [app, post]);
  const DEFAULT_CARD = { x: 11, y: 70, w: 78 };
  const choice = layout.screen ? `shot:${layout.screen.id}` : layout.noCard ? "none" : layout.card || slide.cards.length ? (banner ? calloutToChoice(banner, brand.callout) ?? "appstore" : "appstore") : "none";
  const pick = (v: string) => {
    setBannerErr(null);
    const id = shotIdOf(v);
    if (v === "none") { onChange({ blocks: layout.blocks, noCard: true }); setSel(null); return; }
    if (id) { onChange({ blocks: layout.blocks, noCard: true, screen: layout.screen ? { ...layout.screen, id } : { id, x: 35, y: 40, w: 30 } }); setSel(SCREEN); return; }
    const at = layout.card ? { x: layout.card.x, y: layout.card.y, w: layout.card.w } : DEFAULT_CARD;
    const c = isBanner(v) ? choiceToCallout(v, brand.callout) : null;
    setBanner(c); setPending(c);
    onChange({ blocks: layout.blocks, card: at });
    setSel(CARD);
  };
  /* The logo-and-text card's own words, typed under the field. */
  const setWords = (w: { headline: string; line: string }) => { const c = { ...(banner ?? {}), ...w }; setBanner(c); setPending(c); };
  const urlOf = (id?: string) => { const a = id ? assets.find((x) => x.id === id) : null; return a?.file ? `/media/apps/${encodeURIComponent(app)}/brand/assets/${encodeURIComponent(a.file)}` : ""; };
  const bannerMarkup = banner ? calloutSvg(banner, icon, brand.style, urlOf(banner.screen)) : "";
  const save = async () => {
    if (pending !== undefined && layout.card) {
      const r = await fetch("/api/production/callout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app, post, callout: pending }) });
      const j = await r.json().catch(() => ({ error: "The banner could not be drawn." }));
      if (!r.ok || j.error) { setBannerErr(j.error ?? "The banner could not be drawn."); return; }
      setPending(undefined);
    }
    onSave();
  };

  /* A drag starts on the wrapper's edge zone, the grip or the corner handle; a pointer inside editable words is a click for the caret. */
  const start = (e: ReactPointerEvent, i: number, mode: "move" | "size") => {
    if (mode === "move" && (e.target as HTMLElement).closest("[contenteditable]")) return;
    const b = i === CARD ? layout.card! : i === SCREEN ? layout.screen! : layout.blocks[i];
    drag.current = { i, mode, x0: e.clientX, y0: e.clientY, bx: b.x, by: b.y, bw: b.w };
    setSel(i);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    const f = frame.current?.getBoundingClientRect();
    if (!d || !f) return;
    const dx = ((e.clientX - d.x0) / f.width) * 100;
    const dy = ((e.clientY - d.y0) / f.height) * 100;
    const set = d.i === CARD ? patchCard : d.i === SCREEN ? patchScreen : (p: Partial<LayoutBlock>) => patch(d.i, p);
    /* A screenshot may hang off the frame's edge (a phone cut by the border); a card and the words stay inside. */
    const over = d.i === SCREEN ? 20 : 0;
    if (d.mode === "move") set({ x: clamp(d.bx + dx, -over, 100 - d.bw + over), y: clamp(d.by + dy, -over, 96) });
    else set({ w: clamp(d.bw + dx, d.i === SCREEN ? 10 : 15, d.i === SCREEN ? 120 : 100 - d.bx) });
  };
  const end = () => { drag.current = null; };

  /* The card's words. Typing patches the draft; the card route renders the
   * PNG with those words (cached by their hash) and returns its file, or says
   * which line is too long. The default card needs no round trip. */
  const custom = cardTextOf(layout.card);
  const [cardErr, setCardErr] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const customKey = custom ? `${custom.name}\n${custom.subtitle}\n${custom.button}` : null;
  useEffect(() => {
    if (!custom) { setCardErr(null); return; }
    let live = true;
    setCardBusy(true);
    const q = new URLSearchParams({ app: appFromPath(), post, name: custom.name, subtitle: custom.subtitle, button: custom.button });
    const t = setTimeout(() => {
      fetch(`/api/production/card?${q}`)
        .then((r) => r.json())
        .then((j: { file?: string; error?: string }) => { if (live) setCardErr(j.error ?? null); })
        .catch(() => { if (live) setCardErr("The card could not be drawn."); })
        .finally(() => { if (live) setCardBusy(false); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey, post]);
  const defaultText = cards.find((k) => k.index === 1)?.text ?? null;
  const cardText: CardText = custom ?? defaultText ?? NO_TEXT;
  /* The first edit of a card line makes the words the post's own: all three are then carried. */
  const setCardLine = (k: keyof CardText, v: string) => patchCard({ ...cardText, [k]: v });
  const cardIsDefault = !custom || (!!defaultText && custom.name === defaultText.name && custom.subtitle === defaultText.subtitle && custom.button === defaultText.button);

  /* A phone in a hand never shows the App Store card (lib/callout.ts shownCards); the editor's other slides keep every card. */
  const ePhone = phoneOf(slide, dimension)?.kind.startsWith("E");
  const shown = ePhone ? slide.cards.map((item, i) => ({ item, index: i + 1 })) : shownCards(slide, dimension);
  const hasCards = shown.length > 0;
  const selBlock = sel !== null && sel >= 0 ? layout.blocks[sel] : null;

  return (
    <>
      <div className="frame is-editing" style={frameStyle(dimension)} ref={frame} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {state.current ? <img className="frame__img" src={fileUrl(state.current)} alt="" draggable={false} /> : <div className="frame__empty" aria-hidden="true" />}
        <div className="frame__safe frame__safe--top" aria-hidden="true"><span>top {safe.top}%</span></div>
        <div className="frame__safe frame__safe--bottom" aria-hidden="true"><span>{dimension === "9:16" ? "TikTok caption · keep clear below" : "margin · keep clear below"} {safe.bottom}%</span></div>
        {layout.blocks.map((b, i) => {
          const p = freeBlockProps(b);
          return (
            <div key={i} className={`frame__edit${sel === i ? " is-selected" : ""}`} style={p.style} onPointerDown={(e) => start(e, i, "move")}>
              <span className="frame__grip" aria-hidden="true" title="drag to move">⠿</span>
              <Editable multiline className={p.className.replace("is-free", "")} style={{ fontSize: "inherit" }} label={`Words of block ${i + 1}`} text={b.text} onFocus={() => setSel(i)} onText={(t) => patch(i, { text: t })} />
              <span className="frame__handle" role="slider" aria-label={`Width of block ${i + 1}`} aria-valuenow={Math.round(b.w)} onPointerDown={(e) => { e.stopPropagation(); start(e, i, "size"); }} />
            </div>
          );
        })}
        {layout.card && banner ? (
          <div className={`frame__editcard${sel === CARD ? " is-selected" : ""}`} style={freeCardStyle(layout.card)} onPointerDown={(e) => start(e, CARD, "move")} role="group" aria-label="App callout banner; drag to move it, drag the corner to widen it">
            <div className="frame__bannerimg" dangerouslySetInnerHTML={{ __html: bannerMarkup }} />
            <span className="frame__handle" role="slider" aria-label="Width of the banner" aria-valuenow={Math.round(layout.card.w)} onPointerDown={(e) => { e.stopPropagation(); start(e, CARD, "size"); }} />
          </div>
        ) : layout.card && (!hasCards || shown[0].index === 1) ? (
          <div className={`frame__editcard${sel === CARD ? " is-selected" : ""}`} style={freeCardStyle(layout.card)} onPointerDown={(e) => start(e, CARD, "move")} role="group" aria-label="Product callout card; drag its edge to move it, click a line to edit it">
            <div className="frame__cardhtml" aria-hidden={false}>
              <img className="frame__cardicon" src={icon || `/media/apps/${encodeURIComponent(app)}/icon.jpg`} alt="" draggable={false} />
              <Editable className="frame__cardname" label="Card name" text={cardText.name} onFocus={() => setSel(CARD)} onText={(t) => setCardLine("name", t)} />
              <Editable className="frame__cardsub" label="Card subtitle" text={cardText.subtitle} onFocus={() => setSel(CARD)} onText={(t) => setCardLine("subtitle", t)} />
              <span className="frame__cardpill"><Editable label="Card button" text={cardText.button} onFocus={() => setSel(CARD)} onText={(t) => setCardLine("button", t)} /></span>
            </div>
            <span className="frame__handle" role="slider" aria-label="Width of the card" aria-valuenow={Math.round(layout.card.w)} onPointerDown={(e) => { e.stopPropagation(); start(e, CARD, "size"); }} />
          </div>
        ) : hasCards && !layout.noCard ? (
          <div className="frame__cards" aria-hidden="true">
            {shown.map(({ index }) => {
              const held = cards.find((k) => k.index === index)?.file ?? null;
              return held ? <div key={index} className="frame__card"><img src={fileUrl(held)} alt="" /></div> : <div key={index} className="frame__card is-empty">product callout · not made yet</div>;
            })}
          </div>
        ) : null}
        {layout.screen ? (
          <div className={`frame__editscreen${sel === SCREEN ? " is-selected" : ""}`} style={freeCardStyle(layout.screen)} onPointerDown={(e) => start(e, SCREEN, "move")} role="group" aria-label="App screenshot; drag to move it, drag the corner to resize it" title="App screenshot: drag to move, corner to resize">
            <img src={screenSrc(layout.screen.id, app)} alt="" draggable={false} />
            <span className="frame__handle" role="slider" aria-label="Width of the screenshot" aria-valuenow={Math.round(layout.screen.w)} onPointerDown={(e) => { e.stopPropagation(); start(e, SCREEN, "size"); }} />
          </div>
        ) : null}
        <span className="frame__no tabular" aria-hidden="true">{slide.n} / {total}</span>
      </div>
      <AppCalloutField value={choice} onChange={pick} assets={assets} brand={brand.callout} words={banner && !banner.kind ? { headline: banner.headline, line: banner.line } : undefined} onWords={setWords}
        hint={bannerErr ?? (layout.screen ? "Drag the screenshot in the picture; the corner sets its width." : layout.card ? "Drag the callout in the picture; the corner sets its width." : undefined)} />

      <div className="rep__tools" role="toolbar" aria-label="Layout">
        <span className="rep__tools__hint">
          {cardErr ? <span className="rail__err" role="alert">{cardErr}</span> : error ? <span className="rail__err" role="alert">{error}</span> : cardBusy ? "Drawing the card…" : "Click words to edit · drag edges to move · corner to widen"}
        </span>
        <span className="rep__tools__mid">
          <button type="button" disabled={!selBlock} onClick={() => selBlock && patch(sel!, { fs: clamp(selBlock.fs - 0.4, 2, 12) })} aria-label="Smaller type">A−</button>
          <button type="button" disabled={!selBlock} onClick={() => selBlock && patch(sel!, { fs: clamp(selBlock.fs + 0.4, 2, 12) })} aria-label="Bigger type">A+</button>
          <button type="button" disabled={!selBlock} onClick={() => selBlock && patch(sel!, { align: selBlock.align === "left" ? "center" : "left" })} aria-label="Toggle alignment" title={selBlock?.align === "left" ? "left; make it centred" : "centred; make it left"}>{selBlock?.align === "left" ? "⇤" : "≡"}</button>
          {sel === CARD && !banner && !cardIsDefault ? <button type="button" onClick={() => onChange({ ...layout, card: { x: layout.card!.x, y: layout.card!.y, w: layout.card!.w } })}>default words</button> : null}
        </span>
        <span className="rep__tools__end">
          <button type="button" className="rail__kill" onClick={onCancel}>Cancel</button>
          <button type="button" className="pill pill--go" disabled={busy || !!cardErr || cardBusy} onClick={() => { void save(); }}>Save layout</button>
        </span>
      </div>
    </>
  );
}
