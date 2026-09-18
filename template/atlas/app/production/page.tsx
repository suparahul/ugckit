/**
 * /production — the door to the studio. One app opens straight onto its
 * studio; several list them; none says which phase brings the plan.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { listApps } from "@/lib/apps";
import { plannedApps } from "@/lib/production";

export const dynamic = "force-dynamic";

export default async function StudioDoor({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "app") q.set(k, v);
  const qs = q.toString();
  const want = typeof sp.app === "string" ? sp.app : null;
  const apps = listApps();
  const target = want && apps.some((a) => a.slug === want) ? want : apps.length === 1 ? apps[0].slug : null;
  if (target) redirect(`/production/${encodeURIComponent(target)}${qs ? `?${qs}` : ""}`);
  const planned = new Set(plannedApps());
  return (
    <div className="page stack column">
      <header className="prod__head"><div><h1 className="prod__title">The studio</h1><p className="prod__counts">{apps.length ? `${apps.length} apps` : "No app yet"}</p></div></header>
      {apps.length ? (
        <ul className="more">{apps.map((a) => <li key={a.slug}><Link href={`/production/${encodeURIComponent(a.slug)}`}>{a.name}</Link> · {planned.has(a.slug) ? "plan written" : "no plan yet"}</li>)}</ul>
      ) : (
        <p className="pending">The studio opens when the plan is written, at the app fit and plan phase.</p>
      )}
    </div>
  );
}
