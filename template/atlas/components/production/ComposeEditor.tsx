"use client";

/**
 * The design editor of an infographic slide (lib/infographic.ts).
 *
 * The frame is the template drawn live from the spec: every slider, every
 * word and every drag redraws it at once, with the same function the renderer
 * uses, so what is here is what is saved. Drag any element to move it (a
 * nudge in px), or select it and use the arrow keys (shift for bigger steps)
 * and − / + to scale it. The callout card sits on top where it will be pasted;
 * drag it, or its corner to widen it. The band at the bottom is what TikTok's
 * handle and caption cover.
 *
 * TikTok / Instagram switches the layout being edited: Instagram is a second
 * layout of the same words at 4:5, with its own sizes, moves and callout place.
 * Animation plays in the frame; Export video renders the MP4s.
 *
 * Save design writes the spec, renders the slide's picture (a new candidate,
 * like any upload), the Instagram picture, and records the callout's place.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";

import { byId, calloutSvg, CALLOUT_RATIO, draw, EMPTY_BRAND_CALLOUT, forPlatform, TEMPLATES, toSvg, type Anim, type Asset, type BrandCallout, type Nudge, type Placement, type Platform, type Spec, type Style, type Variant } from "@/lib/infographic";
import type { LayoutCard, LayoutScreen } from "@/lib/layout";
import { AppCalloutField, calloutToChoice, choiceToCallout, isBanner, shotIdOf } from "./AppCalloutField";
import { fileUrl } from "./Frame";
import { appFromPath } from "./scope";

type UrlAsset = Asset & { url: string };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** TikTok covers the frame from here down: its handle and caption take the bottom fifth. */
const CAPTION_FROM = 80;
/** Values that are positions across the width keep their size in the 4:5 layout; the rest scale with the height. */
const KEEP_ON_RESIZE = new Set(["colInset", "margin", "gap", "artX", "pad", "doodles"]);
/** What a deleted block is called in the Restore list (its id is a code). */
const BLOCK_NAMES: Record<string, string> = { title: "Title", step: "Step chip", label: "Activity name", caption: "Line under the name", shade: "Shading", panel: "Panel / card", heading: "Heading", sub: "Tag", footer: "Footer", art: "Picture", screen: "App screen", body: "Lines", scrim: "Dimmer", band: "Paper band", video: "Clip still", def: "Definition", bubble: "Bubble", center: "Centre picture", logo: "Logo", inset: "Inset" };
const blockName = (id: string) => BLOCK_NAMES[id] ?? id.replace(/^line-(\d+)$/, (_, n) => (n === "0" ? "Headline" : `Line ${Number(n) + 1}`)).replace(/^item-(\d+)$/, (_, n) => `Item ${Number(n) + 1}`).replace(/^cube-(\d+)$/, (_, n) => `Cube ${Number(n) + 1}`);
const ANIMS: [Anim["kind"], string][] = [["none", "None (a still)"], ["pop", "Pop in, one by one"], ["float", "Pictures float"], ["pop-float", "Pop in, then float"], ["drift", "Slow drift of the background"]];

export function ComposeEditor({ post, slide, cardFile, card0, screen0 = null, noCard0 = false, onClose }: { post: string; slide: number; cardFile: string | null; card0: LayoutCard | null; screen0?: LayoutScreen | null; noCard0?: boolean; onClose: () => void }) {
  const router = useRouter();
  const app = appFromPath();
  const [spec, setSpec] = useState<Spec | null>(null);
  const [assets, setAssets] = useState<UrlAsset[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "video">(null);
  const [done, setDone] = useState<string | null>(null);
  /* The callout deleted in this session: saving records that the slide has no card. */
  const [dropCard, setDropCard] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [tkCard, setTkCard] = useState<Placement | null>(noCard0 ? null : card0 ? { x: card0.x, y: card0.y, w: card0.w } : cardFile ? { x: 11, y: 70, w: 78 } : null);
  /* An app screenshot pasted on the slide (the slide's layout screen), as on the photo slides: dragged, the corner sets its width. */
  const [shot, setShot] = useState<LayoutScreen | null>(screen0);
  const [t, setT] = useState<number | null>(null);
  /* An activity reel is several screens: -1 the hook (or the intro card), 0..n-1 the clips, n the end card. The page shown is the one edited. */
  const [page, setPage] = useState(-1);
  /* The app's look and callout words (lib/brand.ts) and its icon, from the GET. */
  const [brand, setBrand] = useState<{ style: Partial<Style>; callout: BrandCallout }>({ style: {}, callout: EMPTY_BRAND_CALLOUT });
  const [icon, setIcon] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "el" | "card" | "cardsize" | "shot" | "shotsize"; id?: string; x0: number; y0: number; n0: Nudge; c0?: Placement } | null>(null);

  useEffect(() => {
    fetch(`/api/production/compose?${new URLSearchParams({ app, post, slide: String(slide) })}`)
      .then((r) => r.json())
      .then((j: { spec?: Spec; assets?: UrlAsset[]; brand?: { style: Style; callout: BrandCallout }; icon?: string; error?: string }) => {
        if (j.error) setErr(j.error);
        else { setSpec(j.spec!); setAssets(j.assets ?? []); if (j.brand) setBrand(j.brand); setIcon(j.icon ?? ""); }
      })
      .catch(() => setErr("The design could not be read."));
  }, [app, post, slide]);

  const ig = platform === "instagram";
  const variant = spec?.variants?.instagram;
  /* Drawn in the app's look (the brand's style under the spec's own), as the renderer draws it. */
  const view = useMemo(() => (spec ? forPlatform({ ...spec, style: { ...brand.style, ...spec.style } }, platform) : null), [spec, platform, brand.style]);
  const drawn = useMemo(() => (view ? draw(view, byId(assets), (a) => (a as UrlAsset).url, t, view.template === "clips" ? { focus: page } : {}) : null), [view, assets, t, page]);
  const svg = useMemo(() => (drawn ? toSvg(drawn) : ""), [drawn]);
  const callout = spec?.content.callout;
  const screenUrl = callout?.screen ? assets.find((a) => a.id === callout.screen)?.url ?? "" : "";
  const calloutMarkup = useMemo(() => (callout ? calloutSvg(callout, icon, { ...brand.style, ...spec?.style }, screenUrl) : ""), [callout, icon, brand.style, spec?.style, screenUrl]);
  /* An activity reel pastes its callout on the end card only: on the hook and the clip screens the editor shows no banner (and no warning about it). */
  const clipsEnd = spec?.template === "clips" ? spec.content.items.filter((_, i) => !(spec.hidden ?? []).includes(`clip-${i}`)).length : -1;
  const onCardPage = spec?.template !== "clips" || page === clipsEnd;
  const card: Placement | null = !onCardPage ? null : ig ? variant?.card ?? null : tkCard;

  /* Every edit goes to the layout in view: the base for TikTok, the variant for Instagram. */
  const patchVariant = (p: Partial<Variant>) => setSpec((s) => (s && s.variants?.instagram ? { ...s, variants: { ...s.variants, instagram: { ...s.variants.instagram, ...p } } } : s));
  const setCard = (c: Placement | null) => (ig ? patchVariant({ card: c }) : setTkCard(c));
  const setParam = (k: string, v: number) => {
    if (ig) patchVariant({ params: { ...(variant?.params ?? {}), [k]: v } });
    else setSpec((s) => (s ? ({ ...s, params: { ...s.params, [k]: v } } as Spec) : s));
  };
  const nudges = ig ? variant?.nudge ?? {} : spec?.nudge ?? {};
  const nudgeOf = (id: string): Nudge => nudges[id] ?? { dx: 0, dy: 0 };
  const setNudge = useCallback((id: string, n: Nudge) => {
    setSpec((s) => {
      if (!s) return s;
      if (platform === "instagram" && s.variants?.instagram) return { ...s, variants: { ...s.variants, instagram: { ...s.variants.instagram, nudge: { ...(s.variants.instagram.nudge ?? {}), [id]: n } } } };
      return { ...s, nudge: { ...s.nudge, [id]: n } };
    });
  }, [platform]);
  const resetMoves = () => (ig ? patchVariant({ nudge: {} }) : setSpec((s) => (s ? { ...s, nudge: {} } : s)));
  /* Delete a block: its id goes into spec.hidden and the design closes up round it; Restore brings it back. */
  const hide = (id: string) => { setSpec((s) => (s ? { ...s, hidden: [...new Set([...(s.hidden ?? []), id])] } : s)); setSel(null); };
  const restore = (id: string) => setSpec((s) => (s ? { ...s, hidden: (s.hidden ?? []).filter((x) => x !== id) } : s));
  const removeCallout = () => { setSpec((s) => { if (!s) return s; const c = { ...s.content } as Record<string, unknown>; delete c.callout; return { ...s, content: c } as Spec; }); setTkCard(null); setDropCard(true); setSel(null); };

  /* The first 4:5 layout: the sizes scaled by the frames' height ratio (positions across the width kept), and the
   * callout placed just under where that layout's design ends. Everything is then the user's to move. */
  const addInstagram = () => setSpec((s) => {
    if (!s) return s;
    const k = 1350 / s.size[1];
    const params: Record<string, number | boolean> = {};
    for (const [key, v] of Object.entries(s.params)) params[key] = typeof v === "number" && !KEEP_ON_RESIZE.has(key) ? Math.round(v * k) : v;
    const next = { ...s, variants: { ...(s.variants ?? {}), instagram: { size: [1080, 1350] as [number, number], params, nudge: {}, card: null } } };
    const end = draw(forPlatform({ ...next, style: { ...brand.style, ...next.style } }, "instagram"), byId(assets), (a) => (a as UrlAsset).url).contentEnd / 1350 * 100;
    const w = tkCard?.w ?? 72;
    return { ...next, variants: { ...next.variants, instagram: { ...next.variants.instagram, card: tkCard || cardFile || callout ? { x: (100 - w) / 2, y: Math.min(end + 2, 98 - (w * 1080 * CALLOUT_RATIO) / 1350), w } : null } } };
  });

  /* The animation preview: time runs while Play is on, looping over the duration. */
  const anim = spec?.anim ?? { kind: "none" as const, duration: 6, stagger: 0.12 };
  const setAnim = (p: Partial<Anim>) => setSpec((s) => (s ? { ...s, anim: { ...anim, ...p } } : s));
  const playing = t !== null;
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const t0 = performance.now();
    const tick = () => { setT((((performance.now() - t0) / 1000) % anim.duration)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, anim.duration, anim.kind, anim.stagger]);

  const scale = () => (drawn && frame.current ? drawn.width / frame.current.getBoundingClientRect().width : 1);
  const startEl = (e: ReactPointerEvent, id: string) => {
    if (playing) return;
    setSel(id);
    drag.current = { kind: "el", id, x0: e.clientX, y0: e.clientY, n0: nudgeOf(id) };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const startShot = (e: ReactPointerEvent, kind: "shot" | "shotsize") => {
    if (!shot) return;
    setSel("shot");
    drag.current = { kind, x0: e.clientX, y0: e.clientY, n0: { dx: 0, dy: 0 }, c0: { x: shot.x, y: shot.y, w: shot.w } };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const startCard = (e: ReactPointerEvent, kind: "card" | "cardsize") => {
    if (!card) return;
    setSel("card");
    drag.current = { kind, x0: e.clientX, y0: e.clientY, n0: { dx: 0, dy: 0 }, c0: card };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current, f = frame.current?.getBoundingClientRect();
    if (!d || !f || !drawn) return;
    if (d.kind === "el" && d.id) {
      const k = scale();
      setNudge(d.id, { ...d.n0, dx: Math.round(d.n0.dx + (e.clientX - d.x0) * k), dy: Math.round(d.n0.dy + (e.clientY - d.y0) * k) });
    } else if (d.c0) {
      const dx = ((e.clientX - d.x0) / f.width) * 100, dy = ((e.clientY - d.y0) / f.height) * 100;
      if (d.kind === "shot") setShot((sh) => (sh ? { ...sh, x: +clamp(d.c0!.x + dx, -20, 120 - d.c0!.w).toFixed(2), y: +clamp(d.c0!.y + dy, -20, 96).toFixed(2) } : sh));
      else if (d.kind === "shotsize") setShot((sh) => (sh ? { ...sh, w: +clamp(d.c0!.w + dx, 10, 120).toFixed(2) } : sh));
      else if (d.kind === "card") setCard({ ...d.c0, x: clamp(d.c0.x + dx, 0, 100 - d.c0.w), y: clamp(d.c0.y + dy, 0, 96) });
      else setCard({ ...d.c0, w: clamp(d.c0.w + dx, 30, 100 - d.c0.x) });
    }
  };
  const end = () => { drag.current = null; };

  /* Arrow keys move the selected element; − and + scale it. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (!sel || (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.tagName === "SELECT"))) return;
      const step = e.shiftKey ? 20 : 4;
      const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (sel === "shot") { if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setShot(null); setDropCard(true); setSel(null); } return; }
      if (sel === "card") {
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeCallout(); return; }
        if (m[e.key] && card && drawn) { e.preventDefault(); setCard({ ...card, x: clamp(card.x + (m[e.key][0] / drawn.width) * 100, 0, 100 - card.w), y: clamp(card.y + (m[e.key][1] / drawn.height) * 100, 0, 96) }); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); hide(sel); return; }
      const n = nudgeOf(sel);
      if (m[e.key]) { e.preventDefault(); setNudge(sel, { ...n, dx: n.dx + m[e.key][0], dy: n.dy + m[e.key][1] }); }
      if (e.key === "-" || e.key === "=" || e.key === "+") { e.preventDefault(); setNudge(sel, { ...n, s: +clamp((n.s ?? 1) + (e.key === "-" ? -0.05 : 0.05), 0.4, 2.5).toFixed(2) }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = async (action: "save" | "video") => {
    if (!spec) return;
    setBusy(action); setErr(null); setDone(null);
    try {
      const r = await fetch("/api/production/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app, post, slide, spec, card: tkCard, screen: shot, action, ...(dropCard ? { dropCard: true } : {}) }) });
      const j = await r.json();
      if (!r.ok || j.error) setErr(j.error ?? "Not saved.");
      else if (action === "video") { setDone(`Video ready: ${(j.videos as string[]).map((v) => v.split("/").slice(-2).join("/")).join(" and ")}. It shows at the top of the page.`); router.refresh(); }
      else { onClose(); router.refresh(); }
    } catch { setErr("Not saved: the server did not answer."); }
    finally { setBusy(null); }
  };

  if (err && !spec) return <p className="rail__err" role="alert">{err}</p>;
  if (!spec || !drawn || !view) return <p className="rep__lockhint">Reading the design…</p>;

  const tpl = TEMPLATES[spec.template];
  const W = drawn.width, H = drawn.height;
  const cardH = card ? (card.w * W * CALLOUT_RATIO) / H : 0;
  const cardBottom = card ? card.y + cardH : 0;
  const contentEndPct = (drawn.contentEnd / H) * 100;
  const limit = ig ? 98 : CAPTION_FROM + 2;
  const warn = !onCardPage ? null : card ? (card.y < contentEndPct ? "The callout overlaps the design: move it down or tighten the spacing." : cardBottom > limit ? (ig ? "The callout runs off the frame." : "The callout runs into the caption zone.") : null) : !ig && contentEndPct > CAPTION_FROM ? "The design runs into the caption zone." : null;
  const selected = sel && sel !== "card" && sel !== "shot" ? drawn.elements.find((e) => e.id === sel) : null;

  return (
    <div className="cmp">
      <div className="cmp__stage">
        <div className="cmp__tabs" role="tablist" aria-label="Platform">
          <button type="button" role="tab" aria-selected={!ig} className={!ig ? "is-on" : ""} onClick={() => { setPlatform("tiktok"); setSel(null); }}>TikTok 9:16</button>
          <button type="button" role="tab" aria-selected={ig} className={ig ? "is-on" : ""} onClick={() => { setPlatform("instagram"); setSel(null); }}>Instagram 4:5</button>
        </div>
        {ig && !variant ? (
          <div className="cmp__empty">
            <p>No Instagram layout yet: Instagram gets the TikTok picture fitted into 4:5, with blurred sides.</p>
            <button type="button" className="pill pill--go" onClick={addInstagram}>Make a 4:5 layout</button>
          </div>
        ) : (
          <div className="cmp__frame" ref={frame} style={{ aspectRatio: `${W} / ${H}` }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
            <div className="cmp__svg" dangerouslySetInnerHTML={{ __html: svg }} />
            {!ig ? <div className="cmp__caption" style={{ top: `${CAPTION_FROM}%` }}><span>TikTok handle + caption · keep clear</span></div> : null}
            {!playing ? drawn.elements.map((el) => (
              <div key={el.id} className={`cmp__hit${sel === el.id ? " is-sel" : ""}`} title={`${el.label} — drag to move`}
                style={{ left: `${(el.x / W) * 100}%`, top: `${(el.y / H) * 100}%`, width: `${(el.w / W) * 100}%`, height: `${(el.h / H) * 100}%` }}
                onPointerDown={(e) => startEl(e, el.id)} />
            )) : null}
            {card && (cardFile || calloutMarkup) ? (
              <div className={`cmp__card${sel === "card" ? " is-sel" : ""}`} style={{ left: `${card.x}%`, top: `${card.y}%`, width: `${card.w}%` }} onPointerDown={(e) => startCard(e, "card")} title="The callout — drag to move">
                {calloutMarkup ? <div className="cmp__callout" dangerouslySetInnerHTML={{ __html: calloutMarkup }} /> : <img src={fileUrl(cardFile!)} alt="The callout card" draggable={false} />}
                <span className="cmp__corner" onPointerDown={(e) => startCard(e, "cardsize")} title="drag to widen" />
              </div>
            ) : null}
            {shot && !ig ? (
              <div className={`cmp__card cmp__shot${sel === "shot" ? " is-sel" : ""}`} style={{ left: `${shot.x}%`, top: `${shot.y}%`, width: `${shot.w}%` }} onPointerDown={(e) => startShot(e, "shot")} title="The app screenshot — drag to move">
                <img src={assets.find((a) => a.id === shot.id)?.url ?? ""} alt="The app screenshot" draggable={false} style={{ width: "100%", display: "block" }} />
                <span className="cmp__corner" onPointerDown={(e) => startShot(e, "shotsize")} title="drag to widen" />
              </div>
            ) : null}
          </div>
        )}
        {(() => {
          /* The App callout field (AppCalloutField.tsx): one field, the same options and the same place as on every other post. */
          const hasScreenSlot = spec.template === "page" || spec.template === "wall";
          const inPic = hasScreenSlot ? (spec.content as { screen?: string }).screen ?? "" : "";
          const value = shot ? `shot:${shot.id}` : inPic ? `shot:${inPic}` : callout ? calloutToChoice(callout, brand.callout) ?? "none" : tkCard && cardFile ? "appstore" : "none";
          const choose = (v: string) => {
            const id = shotIdOf(v);
            setSpec((s0) => {
              if (!s0) return s0;
              const c = { ...s0.content } as Record<string, unknown>;
              delete c.callout;
              if (hasScreenSlot) c.screen = "";
              const b = isBanner(v) ? choiceToCallout(v, brand.callout) : null;
              if (b) c.callout = b;
              return { ...s0, content: c } as Spec;
            });
            if (id) { setShot((cur) => (cur ? { ...cur, id } : { id, x: 35, y: 40, w: 30 })); setTkCard(null); setDropCard(true); setSel("shot"); }
            else if (v === "none") { setShot(null); setTkCard(null); setDropCard(true); setSel(null); }
            else { setShot(null); setDropCard(false); setTkCard((cur) => cur ?? { x: 11, y: 60, w: 78 }); setSel("card"); }
          };
          return <AppCalloutField value={value} onChange={choose} assets={assets} brand={brand.callout} hint={shot ? "Drag the screenshot in the picture; the corner sets its width." : card ? "Drag the callout in the picture; the corner sets its width." : undefined} />;
        })()}
        <p className={`cmp__status${warn ? " is-warn" : ""}`}>{warn ?? `Design ends at ${contentEndPct.toFixed(0)}%${card ? ` · callout ${card.y.toFixed(0)}–${cardBottom.toFixed(0)}%` : ""}`}</p>
      </div>

      <div className="cmp__panel">
        <section>
          <h4>{selected ? selected.label : sel === "card" ? "The callout" : `${tpl.name} · ${ig ? "Instagram layout" : "TikTok layout"}`}</h4>
          {sel === "card" ? <div className="cmp__row"><button type="button" className="rail__kill" onClick={removeCallout}>Delete callout</button></div> : null}
          {selected ? (
            <div className="cmp__row">
              <button type="button" onClick={() => setNudge(selected.id, { ...nudgeOf(selected.id), s: +clamp((nudgeOf(selected.id).s ?? 1) - 0.05, 0.4, 2.5).toFixed(2) })}>−</button>
              <span className="tabular">{Math.round((nudgeOf(selected.id).s ?? 1) * 100)}%</span>
              <button type="button" onClick={() => setNudge(selected.id, { ...nudgeOf(selected.id), s: +clamp((nudgeOf(selected.id).s ?? 1) + 0.05, 0.4, 2.5).toFixed(2) })}>+</button>
              <button type="button" onClick={() => setNudge(selected.id, { dx: 0, dy: 0 })}>reset</button>
              <button type="button" className="rail__kill" onClick={() => hide(selected.id)} title="Delete this block (Delete key); Restore brings it back">Delete block</button>
            </div>
          ) : <p className="cmp__hint">Click anything in the picture to move or scale it. Arrow keys nudge (shift: bigger steps), − and + scale.{ig ? " Sizes and moves here change the Instagram layout only; the words are shared." : ""}</p>}
        </section>

        {(() => {
          /* Every block can be deleted and brought back: the drawn elements, and a template's own blocks (a clip). */
          const extra = tpl.blocks ? tpl.blocks(spec) : [];
          const gone = spec.hidden ?? [];
          const label = (id: string) => extra.find((b) => b.id === id)?.label ?? blockName(id);
          return extra.length || gone.length ? (
            <section>
              <h4>Blocks</h4>
              {extra.filter((b) => !gone.includes(b.id)).map((b) => (
                <div key={b.id} className="cmp__row"><span>{b.label}</span><button type="button" className="rail__kill" onClick={() => hide(b.id)}>Delete</button></div>
              ))}
              {gone.map((id) => <div key={id} className="cmp__row"><span>Deleted: {label(id)}</span><button type="button" onClick={() => restore(id)}>Restore</button></div>)}
              <p className="cmp__hint">Click any block in the picture and press Delete (or use Delete block). The rest closes up. Restore brings it back.</p>
            </section>
          ) : null;
        })()}

        <section>
          <h4>Sizes and spacing{ig ? " · Instagram" : ""}</h4>
          {tpl.controls.map(([k, label, min, max, step]) => (
            <label key={k} className="cmp__slider">
              <span>{label}</span>
              <input type="range" min={min} max={max} step={step} value={Number((view.params as Record<string, unknown>)[k])} onChange={(e) => setParam(k, Number(e.target.value))} disabled={ig && !variant} />
              <span className="tabular">{Number((view.params as Record<string, unknown>)[k])}</span>
            </label>
          ))}
        </section>

        <section>
          <h4>Words</h4>
          {tpl.fields(spec).map((f) => (
            <label key={f.key} className="cmp__field"><span>{f.label}</span>
              {f.rows ? <textarea rows={f.rows} value={f.value} onChange={(e) => setSpec((s) => (s ? f.set(s, e.target.value) : s))} />
                : <input value={f.value} onChange={(e) => setSpec((s) => (s ? f.set(s, e.target.value) : s))} />}
            </label>
          ))}
        </section>

        <section>
          <h4>Pictures</h4>
          {tpl.slots(spec).filter((sl) => sl.key !== "screen").map((sl) => {
            const pick = assets.filter((a) => !a.kind || sl.kinds.includes(a.kind));
            const cur = assets.find((a) => a.id === sl.value);
            return (
              <label key={sl.key} className="cmp__pick">
                {cur ? <img src={cur.url} alt="" /> : <span className="cmp__pick-none" />}
                <span>{sl.label}</span>
                <select value={sl.value} onChange={(e) => setSpec((s) => (s ? sl.set(s, e.target.value) : s))}>
                  {sl.key === "inset" || sl.key === "screen" || sl.key === "art2" || sl.key === "art3" || sl.key === "art4" || (sl.key === "art" && spec.template === "wall") ? <option value="">none</option> : null}
                  {pick.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                </select>
              </label>
            );
          })}
          <p className="cmp__hint">A picture missing from the library is drawn once with Codex (the infographic skill's art sheets) and then appears here.</p>
        </section>

        {callout ? (
          <section>
            <h4>The callout banner</h4>
            <label className="cmp__field"><span>{callout.kind === "store" ? "Title" : callout.kind === "phone" ? "App name" : "Bold line"}</span>
              <input value={callout.headline} onChange={(e) => setSpec((s) => (s ? ({ ...s, content: { ...s.content, callout: { ...callout, headline: e.target.value } } } as Spec) : s))} />
            </label>
            <label className="cmp__field"><span>{callout.kind === "store" ? "Tagline" : callout.kind === "phone" ? "One line under the name" : "Second line (leave empty for one line)"}</span>
              <input value={callout.line} onChange={(e) => setSpec((s) => (s ? ({ ...s, content: { ...s.content, callout: { ...callout, line: e.target.value } } } as Spec) : s))} />
            </label>
            {callout.kind === "phone" || (callout.kind === "store" && callout.variant === 2) ? (
              <>
                {callout.kind === "phone" ? <label className="cmp__field"><span>Button text</span>
                  <input value={callout.button ?? "Download on the App Store"} onChange={(e) => setSpec((s) => (s ? ({ ...s, content: { ...s.content, callout: { ...callout, button: e.target.value } } } as Spec) : s))} />
                </label> : null}
                <label className="cmp__pick">
                  {screenUrl ? <img src={screenUrl} alt="" /> : <span className="cmp__pick-none" />}
                  <span>App screen in the phone</span>
                  <select value={callout.screen ?? ""} onChange={(e) => setSpec((s) => (s ? ({ ...s, content: { ...s.content, callout: { ...callout, screen: e.target.value || undefined } } } as Spec) : s))}>
                    <option value="">none</option>
                    {assets.filter((a) => a.kind === "screen").map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
                  </select>
                </label>
              </>
            ) : null}
            <div className="cmp__row"><button type="button" className="rail__kill" onClick={removeCallout}>Delete callout</button></div>
            <p className="cmp__hint">Drag it in the picture to place it (keep it above the bottom fifth). A longer line is set smaller so it stays on one line.</p>
          </section>
        ) : null}

        <section>
          <h4>{spec.template === "clips" ? "Video" : "Animation"}</h4>
          {spec.template === "clips" ? (() => {
            const n = spec.content.items.filter((_, i) => !(spec.hidden ?? []).includes(`clip-${i}`)).length;
            const pages: [number, string][] = [[-1, (spec.params as { hook?: number }).hook ? "Hook" : "Intro"], ...Array.from({ length: n }, (_, i) => [i, `Clip ${i + 1}`] as [number, string]), [n, "End card"]];
            return (
              <div className="cmp__row" role="group" aria-label="Screen to edit">
                {pages.map(([k, l]) => <button key={k} type="button" className={page === k ? "pill pill--go" : "pill"} onClick={() => { setPage(k); setSel(null); }}>{l}</button>)}
                <p className="cmp__hint" style={{ flexBasis: "100%", margin: 0 }}>Pick the screen to edit: its words, sizes and positions are the controls above and the dragging in the picture. The hook has its own title size, position, dimmer and line size.</p>
              </div>
            );
          })() : null}
          {spec.template === "clips" ? null : (
            <>
              <label className="cmp__slider"><span>Motion</span>
                <select value={anim.kind} onChange={(e) => setAnim({ kind: e.target.value as Anim["kind"] })}>
                  {ANIMS.filter(([k]) => spec.template === "wall" ? k === "none" || k === "drift" : k !== "drift").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <span />
              </label>
              <label className="cmp__slider"><span>Length (seconds)</span>
                <input type="range" min={3} max={15} step={0.5} value={anim.duration} onChange={(e) => setAnim({ duration: Number(e.target.value) })} /><span className="tabular">{anim.duration}</span>
              </label>
              {spec.template === "wall" ? null : (
                <label className="cmp__slider"><span>Pop-in gap (seconds)</span>
                  <input type="range" min={0.03} max={0.5} step={0.01} value={anim.stagger} onChange={(e) => setAnim({ stagger: Number(e.target.value) })} /><span className="tabular">{anim.stagger}</span>
                </label>
              )}
            </>
          )}
          <div className="cmp__row">
            {spec.template === "clips" || anim.kind === "none" ? null : <button type="button" onClick={() => setT(playing ? null : 0)}>{playing ? "Stop" : "Play"}</button>}
            <button type="button" className="pill pill--go" disabled={!!busy || (anim.kind === "none" && spec.template !== "wall" && spec.template !== "clips")} onClick={() => submit("video")}>{busy === "video" ? "Making the video…" : "Save and export video"}</button>
          </div>
          <p className="cmp__hint">The video is drawn frame by frame from this design (the words never blur), with the callout in place{variant ? ", for TikTok and at 4:5 for Instagram" : ""}, and the music chosen above when there is one. About a minute for each platform.</p>
          {done ? <p className="cmp__done">{done}</p> : null}
        </section>

        <div className="rep__tools cmp__tools">
          {err ? <span className="rail__err" role="alert">{err}</span> : <span className="rep__tools__hint">{busy === "save" ? "Drawing the picture…" : "Saving makes a new candidate of this slide."}</span>}
          <span className="rep__tools__end">
            <button type="button" className="rail__kill" onClick={resetMoves}>Reset moves</button>
            <button type="button" className="rail__kill" onClick={onClose}>Cancel</button>
            <button type="button" className="pill pill--go" disabled={!!busy} onClick={() => submit("save")}>Save design</button>
          </span>
        </div>
      </div>
    </div>
  );
}
