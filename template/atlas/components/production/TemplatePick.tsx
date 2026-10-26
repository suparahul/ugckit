"use client";

/**
 * The post's template as two dropdowns: the format (Slideshow · Reel · Single
 * image) and the style that format allows. Each change writes one
 * `template.set` line with a valid pair; a new format takes its first style
 * unless the current one is valid there too (lib/template.ts). The styles are
 * the app's (the kit's and apps/<slug>/brand/style.json's, carried on the post's
 * TemplateState). The latest line wins over the plan's Template cell. Nothing is
 * deleted: when a deck exists, the change asks first, since the deck was written
 * for the old template and must then be rewritten; a note says so after.
 */

import { useState } from "react";

import { FORMATS, FORMAT_LABEL, templateLabel, templateWord, withFormat, type Format, type TemplateState } from "@/lib/template";
import { useDecide } from "./Actions";

export function TemplatePick({ post, t, readOnly = false, compact = false, hasDeck = false }: { post: string; t: TemplateState; readOnly?: boolean; compact?: boolean; hasDeck?: boolean }) {
  const [decide, busy] = useDecide();
  const [err, setErr] = useState<string | null>(null);
  const cur = t.current;

  const write = async (format: string, style: string) => {
    if (cur && cur.format === format && cur.style === style) return;
    /* A deck written for the old template has to be rewritten: one question first, so a stray pick costs nothing. */
    if (hasDeck && !window.confirm(`Change the template to ${templateLabel({ format: format as Format, style }, t.styles)}?\n\nThe deck was written for ${templateLabel(cur, t.styles)}: it will have to be rewritten. Nothing is deleted.`)) return;
    setErr(null);
    const r = await decide({ post, kind: "template.set", data: { format, style } });
    if (r) setErr(r);
  };

  const title = t.source === "log" ? `Changed ${t.at?.slice(0, 16).replace("T", " ") ?? ""}${t.from ? ` from ${t.from}` : ""}${t.plan && templateWord(t.plan) !== templateWord(cur) ? ` · the plan says ${templateWord(t.plan)}` : ""}` : t.source === "plan" ? "From the plan's Template column" : "No template in the plan yet";
  return (
    <span className={`tpl${compact ? " tpl--compact" : ""}`} title={title}>
      {compact ? null : <span className="tpl__k">Template</span>}
      {readOnly ? (
        <span className="tpl__v">{templateLabel(cur, t.styles)}</span>
      ) : (
        <>
          <select className="tpl__sel" value={cur?.format ?? ""} disabled={busy} onChange={(e) => { const n = withFormat(cur, e.target.value as Format, t.styles); write(n.format, n.style); }} aria-label="Format">
            {cur ? null : <option value="">format</option>}
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
          <select className="tpl__sel" value={cur?.style ?? ""} disabled={busy || !cur} onChange={(e) => cur && write(cur.format, e.target.value)} aria-label="Style">
            {cur ? null : <option value="">style</option>}
            {(cur ? t.styles[cur.format] : []).map((o) => <option key={o.key} value={o.key} title={o.desc}>{o.label}</option>)}
          </select>
        </>
      )}
      {!compact && t.source === "log" && t.from ? <small className="tpl__from">was {t.from}</small> : null}
      {t.rewrite ? <small className="tpl__note" role="note">{compact ? "deck to rewrite" : `The deck was written for ${t.from || "no template"}: it must be rewritten as ${templateWord(cur)}. Nothing was deleted.`}</small> : null}
      {err ? <span className="rail__err" role="alert">{err}</span> : null}
    </span>
  );
}

/** The template as a word, for the board's links (no control inside a link): `reel · cube`. */
export function TemplateTag({ t }: { t: TemplateState }) {
  return (
    <span className={`tpl-tag${t.current ? "" : " is-open"}${t.rewrite ? " is-rewrite" : ""}`} title={t.rewrite ? `Template changed from ${t.from || "none"}: the deck must be rewritten` : templateLabel(t.current, t.styles)}>
      {t.current ? templateWord(t.current) : "no template"}{t.rewrite ? " · rewrite" : ""}
    </span>
  );
}
