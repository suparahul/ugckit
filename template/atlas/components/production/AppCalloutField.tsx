"use client";

/**
 * The App callout field: the one place, on every post and every template, to choose what the post shows of the app.
 * Both editors (the design editor for the templates, the layout editor for photo and illustrated slides) render this
 * same field, first, under the frame, with the same options:
 *
 *   none                 nothing of the app on this slide
 *   store-1..4           the App Store listing banner, four looks
 *   phone:<screen>       the phone banner with one of the app's screens
 *   peach, peach-<i>     the logo-and-text card: the user's own words, or one of the app's saved wordings
 *   shot:<asset>         an app screenshot (phone-* / screen-sim-*), pasted on the slide and placed by hand
 *   appstore             the older App Store card with editable words (listed only on a slide that still uses it)
 *
 * The words, the screens and the saved wordings are the app's (apps/<slug>/brand/style.json "callout", else product.json:
 * lib/brand.ts). A banner is drawn to the post's cards/1-custom.png (one banner per post) and placed by the slide's
 * layout card; a screenshot is the slide's layout screen. Either way it is dragged in the picture and the corner sets
 * its width. ("peach" is the stored name of the logo-and-text card, kept so older designs still read.)
 */
import type { BrandCallout, Callout } from "@/lib/infographic";

/** The banner a choice stands for, or null for none / a screenshot / the older card. */
export function choiceToCallout(v: string, b: BrandCallout): Callout | null {
  if (v.startsWith("store-")) {
    const variant = Number(v.slice(6));
    return { kind: "store", variant, headline: b.title, line: b.tagline, ...(variant === 2 && b.screens[0] ? { screen: b.screens[0][0] } : {}) };
  }
  if (v.startsWith("phone:")) return { kind: "phone", screen: v.slice(6), headline: b.name || b.title, line: b.line, ...(b.button ? { button: b.button } : {}) };
  if (v === "peach") return { headline: b.name || b.title, line: b.line };
  if (v.startsWith("peach-")) { const p = b.wordings[Number(v.slice(6))]; return p ? { headline: p[0], line: p[1] } : null; }
  return null;
}

/** The field's value for a banner. */
export function calloutToChoice(c: Callout | null | undefined, b: BrandCallout): string | null {
  if (!c) return null;
  if (c.kind === "store") return `store-${c.variant ?? 1}`;
  if (c.kind === "phone") return `phone:${c.screen ?? ""}`;
  const i = b.wordings.findIndex(([h, l]) => h === c.headline && l === c.line);
  return i >= 0 ? `peach-${i}` : "peach";
}

export const isBanner = (v: string) => v.startsWith("store-") || v.startsWith("phone:") || v.startsWith("peach");
export const isShot = (v: string) => v.startsWith("shot:");
export const shotIdOf = (v: string) => (isShot(v) ? v.slice(5) : null);
const shotName = (id: string) => (id.startsWith("phone-") ? "Phone · " : id.startsWith("screen-sim-") ? "Crop · " : "Screen · ") + id.replace(/^(phone-|screen-sim-|screen-)/, "").replace(/-/g, " ");

/**
 * The field. `words` and `onWords`: the logo-and-text card's own words, shown as two boxes while "my own words" is
 * chosen (the design editor has its own boxes for every banner, so it passes neither).
 */
export function AppCalloutField({ value, onChange, assets, brand, hint, words, onWords }: {
  value: string; onChange: (v: string) => void; assets: { id: string; kind?: string }[]; brand: BrandCallout; hint?: string;
  words?: { headline: string; line: string }; onWords?: (w: { headline: string; line: string }) => void;
}) {
  const ids = new Set(assets.map((a) => a.id));
  const shots = assets.filter((a) => /^(phone-|screen-sim-)/.test(a.id));
  /* A screenshot chosen earlier through an in-picture slot (screen-*) stays listed so the field shows it. */
  const cur = shotIdOf(value);
  const extra = cur && !shots.some((a) => a.id === cur) ? [{ id: cur }] : [];
  /* The phone banner's screens: the app's list, else every asset of kind "screen". */
  const screens: [string, string][] = brand.screens.length ? brand.screens : assets.filter((a) => a.kind === "screen").map((a) => [a.id, a.id.replace(/^screen-/, "").replace(/-/g, " ")]);
  const noWords = !brand.title && !brand.name;
  return (
    <div className="appcallout" role="group" aria-label="App callout">
      <label className="appcallout__field">
        <span className="appcallout__label">App callout</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="none">None</option>
          {value === "appstore" ? <option value="appstore">App Store card · older style, editable words</option> : null}
          <optgroup label="App Store banner">
            <option value="store-1">App Store listing · store logos</option>
            <option value="store-4">App Store listing · logos with store names</option>
            <option value="store-2">App Store listing · with an app screen</option>
            <option value="store-3">App Store listing · in the brand colours</option>
          </optgroup>
          {screens.length ? (
            <optgroup label="Phone banner with a screen">
              {screens.map(([id, name]) => <option key={id} value={`phone:${id}`} disabled={!ids.has(id)}>{`Phone banner · ${name}${ids.has(id) ? "" : " (screen missing)"}`}</option>)}
            </optgroup>
          ) : null}
          <optgroup label="Logo and text card">
            <option value="peach">Logo + text · my own words</option>
            {brand.wordings.map(([, , name], i) => <option key={`${name}-${i}`} value={`peach-${i}`}>{`Logo + text · ${name}`}</option>)}
          </optgroup>
          {shots.length || extra.length ? (
            <optgroup label="App screenshot (drag it in the picture)">
              {[...extra, ...shots].map((a) => <option key={a.id} value={`shot:${a.id}`}>{shotName(a.id)}</option>)}
            </optgroup>
          ) : null}
        </select>
      </label>
      {value === "peach" && words && onWords ? (
        <span className="appcallout__words">
          <input aria-label="Bold line" placeholder="Bold line" value={words.headline} onChange={(e) => onWords({ ...words, headline: e.target.value })} />
          <input aria-label="Second line" placeholder="Second line (empty for one line)" value={words.line} onChange={(e) => onWords({ ...words, line: e.target.value })} />
        </span>
      ) : null}
      {isBanner(value) && value !== "peach" && noWords ? <span className="appcallout__hint">No app name yet: run the product skill (product.json), or set "callout" in brand/style.json.</span> : null}
      {hint ? <span className="appcallout__hint">{hint}</span> : null}
    </div>
  );
}
