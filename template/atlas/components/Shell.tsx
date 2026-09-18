"use client";

/**
 * The one chrome of Organic Factory: the wordmark, the workspace picker and
 * the sections. It sits on every route. The route decides which section is
 * current and which app is meant, so nothing hides in component memory.
 *
 * The research leaf pages (the orb, an app's front door, a dossier, a post,
 * a thread, the map) keep their command bar and corpus counter on a second
 * row under it: <ResearchRow> renders its children only there.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export type ShellApp = { slug: string; name: string; niche: string | null };

export const RESEARCH_LEAF = /^\/(orb|brand|account|post|thread|map)(\/|$)/;

/** The app a route is about: /app/<slug>/…, /production/<slug>/…, else ?app=, else the first app. */
export function slugOf(pathname: string, app: string | null, apps: ShellApp[]): string | null {
  const m = pathname.match(/^\/(?:app|production)\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (app && apps.some((a) => a.slug === app)) return app;
  return apps[0]?.slug ?? null;
}

export function sections(slug: string | null) {
  const s = slug ? encodeURIComponent(slug) : null;
  return [
    { key: "home", label: "Home", href: s ? `/app/${s}` : "/" },
    { key: "studio", label: "Studio", href: s ? `/production/${s}` : "/production" },
    { key: "niche", label: "Niche", href: s ? `/app/${s}/niche` : "/" },
    { key: "handles", label: "Handles", href: s ? `/app/${s}/handles` : "/" },
    { key: "strategy", label: "Strategy", href: s ? `/app/${s}/strategy` : "/" },
    { key: "posts", label: "All posts", href: s ? `/posts?app=${s}` : "/posts" },
    { key: "atlas", label: "Atlas", href: s ? `/atlas?app=${s}` : "/atlas" },
  ];
}

export function currentSection(pathname: string): string | null {
  if (/^\/app\/[^/]+\/?$/.test(pathname) || /^\/app\/[^/]+\/canvas/.test(pathname)) return "home";
  if (/^\/production(\/|$)/.test(pathname)) return "studio";
  if (/^\/app\/[^/]+\/niche/.test(pathname)) return "niche";
  if (/^\/app\/[^/]+\/handle/.test(pathname)) return "handles";
  if (/^\/app\/[^/]+\/strategy/.test(pathname)) return "strategy";
  if (/^\/posts(\/|$)/.test(pathname)) return "posts";
  if (/^\/atlas(\/|$)/.test(pathname) || RESEARCH_LEAF.test(pathname)) return "atlas";
  return null;
}

export function Pbar({ apps }: { apps: ShellApp[] }) {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  const slug = slugOf(pathname, params?.get("app") ?? null, apps);
  const app = apps.find((a) => a.slug === slug) ?? null;
  const cur = currentSection(pathname);
  /* Framed inside another page (the Atlas tab's orb view): no chrome. */
  if (params?.get("embed") === "1") return null;
  return (
    <header className="pbar above">
      <Link className="wordmark" href="/">
        Organic <em>Factory</em>
      </Link>
      <details className="pick pbar__ws">
        <summary aria-label={app ? `Workspace: ${app.name}${app.niche ? `, ${app.niche}` : ""}. Opens the list of workspaces` : "Workspace: none yet. Opens the list of workspaces"}>
          <b>{app ? app.name : "No app yet"}</b>
          {app?.niche ? <span className="pbar__word"> · {app.niche}</span> : null}
        </summary>
        <ul className="pick__list" aria-label="Workspaces">
          {apps.map((a) => (
            <li key={a.slug}>
              <Link href={`/app/${encodeURIComponent(a.slug)}`} aria-current={a.slug === slug ? "true" : undefined}>
                {a.name}
                {a.niche ? <span className="n">{a.niche}</span> : null}
              </Link>
            </li>
          ))}
          <li className="pick__sep">
            <Link href="/">All workspaces</Link>
          </li>
        </ul>
      </details>
      <nav className="pbar__links" aria-label="Sections">
        {sections(slug).map((s) => (
          <Link key={s.key} href={s.href} aria-current={s.key === cur ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** Renders its children only on the research leaf pages. */
export function ResearchRow({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const params = useSearchParams();
  if (!RESEARCH_LEAF.test(pathname) || params?.get("embed") === "1") return null;
  return <>{children}</>;
}
