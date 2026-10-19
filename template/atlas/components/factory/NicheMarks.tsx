"use client";

/**
 * The edit mode of the niche explorer. The mode is a URL param (`edit=1`), so
 * it stays through every filter; the marks made in it are a draft held here
 * until Save, which sends them to /api/niche/marks (apps/<slug>/niche/marks.json)
 * and reloads the page from the server: a ruled-out post then leaves the
 * explorer. Discard drops the draft. Two marks a post: Rule out and Study; a
 * second click on the mark it has takes it off. Unmarked needs no button.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";

type Shown = "" | "out" | "study";
type Draft = Record<string, { mark: "out" | "study" | null; handle: string; caption: string }>;
type Ctx = { edit: boolean; saved: Record<string, Shown>; draft: Draft; set: (k: string, m: "out" | "study", handle: string, caption: string) => void; toggle: () => void };

const MarksCtx = createContext<Ctx | null>(null);

export function MarksProvider({ app, edit, saved, children }: { app: string; edit: boolean; /** The marks on file, by `<platform>:<id>`; unmarked posts are absent. */ saved: Record<string, Shown>; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState("");
  const [saving, start] = useTransition();
  const pending = Object.keys(draft).length;

  /* An unsaved draft is not lost to a closed tab without a word. */
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const set = (k: string, m: "out" | "study", handle: string, caption: string) => setDraft((d) => {
    const now = k in d ? d[k].mark : saved[k] || null;
    const next = now === m ? null : m;
    const out = { ...d };
    if (next === (saved[k] || null)) delete out[k];
    else out[k] = { mark: next, handle, caption };
    return out;
  });

  const toggle = () => {
    if (edit && pending && !window.confirm(`Leave edit mode and discard ${pending} unsaved ${pending === 1 ? "mark" : "marks"}?`)) return;
    const u = new URLSearchParams(params?.toString() ?? "");
    if (edit) u.delete("edit"); else u.set("edit", "1");
    setDraft({});
    const q = u.toString();
    router.push(`${path}${q ? `?${q}` : ""}#wins`, { scroll: false });
  };

  const save = async () => {
    setError("");
    const changes = Object.entries(draft).map(([key, v]) => ({ key, ...v }));
    const r = await fetch("/api/niche/marks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ app, changes }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setError(j.error ?? "Not saved: the Atlas did not answer."); return; }
    start(() => { router.refresh(); setDraft({}); });
  };

  const n = { out: 0, study: 0, off: 0 };
  for (const v of Object.values(draft)) n[v.mark ?? "off"]++;
  const said = [n.out ? `${n.out} to rule out` : "", n.study ? `${n.study} to study` : "", n.off ? `${n.off} unmarked` : ""].filter(Boolean).join(" · ");

  return (
    <MarksCtx.Provider value={{ edit, saved, draft, set, toggle }}>
      {children}
      {edit ? (
        <div className="marks__bar" role="region" aria-label="Unsaved marks">
          <p aria-live="polite">{pending ? <><b>{pending}</b> unsaved: {said}</> : <>Edit mode. Mark a post <b>Rule out</b> or <b>Study</b>, then save. Ruled-out posts leave the explorer; nothing is deleted.</>}{error ? <span className="marks__err"> {error}</span> : null}</p>
          <span className="marks__acts">
            <button type="button" className="marks__save" disabled={!pending || saving} onClick={save}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" disabled={!pending || saving} onClick={() => setDraft({})}>Discard</button>
            <button type="button" onClick={toggle}>Done</button>
          </span>
        </div>
      ) : null}
    </MarksCtx.Provider>
  );
}

/** The edit mode switch, for the filter bar. */
export function MarkToggle() {
  const c = useContext(MarksCtx);
  if (!c) return null;
  return <button type="button" className={`marks__toggle${c.edit ? " is-on" : ""}`} aria-pressed={c.edit} onClick={c.toggle}>{c.edit ? "✓ Editing marks" : "Edit marks"}</button>;
}

/** One tile of the grid with its marks: the draft or the saved mark as a class, and in edit mode the two buttons under it. */
export function MarkTile({ k, handle, caption, className, children }: { k: string; handle: string; caption: string; className: string; children: ReactNode }) {
  const c = useContext(MarksCtx);
  const now: Shown = c ? (k in c.draft ? c.draft[k].mark ?? "" : c.saved[k] ?? "") : "";
  const changed = !!c && k in c.draft;
  return (
    <li className={`${className}${now ? ` is-mark-${now}` : ""}${changed ? " is-changed" : ""}`}>
      {children}
      {c?.edit ? (
        <div className="mark-btns" role="group" aria-label={`Mark @${handle}`}>
          <button type="button" className="mark-btn mark-btn--out" aria-pressed={now === "out"} onClick={() => c.set(k, "out", handle, caption)}>{now === "out" ? "Ruled out ✕" : "Rule out"}</button>
          <button type="button" className="mark-btn mark-btn--study" aria-pressed={now === "study"} onClick={() => c.set(k, "study", handle, caption)}>{now === "study" ? "Study ★" : "Study"}</button>
        </div>
      ) : null}
    </li>
  );
}
