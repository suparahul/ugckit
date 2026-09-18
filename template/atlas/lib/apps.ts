/**
 * The workspace's apps: one folder each under apps/<slug>/, plus any project
 * the ledger names that has no folder yet (the app is still being read).
 *
 * The home base reads apps/<slug>/APP.md (stage "the app": the name, the
 * niche, one line) and product.json (the callout facts). Read live: the files
 * are small and the agent writes them mid-session.
 */

import { join } from "node:path";

import { readLedger } from "./ledger";
import { APPS_DIR, appDir, exists, headLines, listDirs, readJson, readText, titleOf } from "./root";

export type Product = { name?: string; subtitle?: string; button?: string; icon?: string; source?: string; fetchedAt?: string };

export type App = {
  slug: string;
  /** The app's name: APP.md's title, else the slug. */
  name: string;
  niche: string | null;
  oneLine: string | null;
  platform: string | null;
  website: string | null;
  repo: string | null;
  appStoreId: string | null;
  /** APP.md exists. */
  hasAppMd: boolean;
  /** The hero-feature rows of APP.md. */
  featureCount: number;
  product: Product | null;
  /** The icon, as a /media URL, when apps/<slug>/icon.jpg (or the file product.json names) exists. */
  icon: string | null;
  /** The folder exists under apps/. */
  hasFolder: boolean;
};

const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function readApp(slug: string): App {
  const dir = appDir(slug);
  const md = readText(join(dir, "APP.md"));
  const head = md ? headLines(md) : {};
  const product = readJson<Product>(join(dir, "product.json"));
  const ledger = readLedger()?.projects?.[slug]?.research;
  const iconFile = product?.icon && exists(join(dir, product.icon)) ? product.icon : exists(join(dir, "icon.jpg")) ? "icon.jpg" : exists(join(dir, "icon.png")) ? "icon.png" : null;
  const features = md ? (md.match(/^\|\s*\d+\s*\|/gm) ?? []).length : 0;
  return {
    slug,
    name: (md && titleOf(md)) || product?.name || titleCase(slug),
    niche: head["Niche"] || ledger?.niche || null,
    oneLine: head["One line"] || null,
    platform: head["Platform"] || null,
    website: head["Website"] || null,
    repo: head["Repo"] || null,
    appStoreId: head["App Store id"] || null,
    hasAppMd: !!md,
    featureCount: features,
    product,
    icon: iconFile ? `/media/apps/${encodeURIComponent(slug)}/${iconFile}` : null,
    hasFolder: exists(dir),
  };
}

/** Every app, folders first (in name order), then ledger-only projects. */
export function listApps(): App[] {
  const slugs = new Set<string>(listDirs(APPS_DIR).filter((d) => d !== "EXAMPLE"));
  for (const p of Object.keys(readLedger()?.projects ?? {})) slugs.add(p);
  return [...slugs].sort().map(readApp);
}

export function getApp(slug: string): App | null {
  if (!/^[\w.-]+$/.test(slug)) return null;
  const apps = listApps();
  return apps.find((a) => a.slug === slug) ?? null;
}

/** The app the chrome shows when the route names none: the first one. */
export function defaultApp(): App | null {
  return listApps()[0] ?? null;
}
