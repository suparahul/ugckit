/**
 * / — the workspace. One row per app with where its work is; with one app the
 * door opens straight onto its home base. With none, the page says what the
 * first phase brings.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listApps } from "@/lib/apps";
import { canvasOf, PHASES } from "@/lib/canvas";

export const metadata: Metadata = { title: "Organic Factory" };
export const dynamic = "force-dynamic";

export default function Workspace({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  void searchParams;
  const apps = listApps();
  if (apps.length === 1) redirect(`/app/${encodeURIComponent(apps[0].slug)}`);
  return (
    <div className="page stack column">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">Your apps</h1>
          <p className="prod__counts">
            {apps.length ? <><b>{apps.length}</b> {apps.length === 1 ? "app" : "apps"} in this workspace</> : "No app yet"}
          </p>
        </div>
      </header>
      {apps.length ? (
        <div className="plist__wrap" style={{ marginTop: 0 }}>
          <table className="plist plist--wide">
            <thead>
              <tr><th>App</th><th>Niche</th><th>Where the work is</th><th></th></tr>
            </thead>
            <tbody>
              {apps.map((a) => {
                const c = canvasOf(a.slug);
                const now = c.phases.find((p) => p.state === "now");
                return (
                  <tr key={a.slug}>
                    <td className="plist__topic"><Link href={`/app/${encodeURIComponent(a.slug)}`}>{a.name}</Link></td>
                    <td className="plist__muted">{a.niche ?? "—"}</td>
                    <td><span className="state">{c.done} of {PHASES.length} done{now ? ` · ${now.title} in progress` : ""}</span></td>
                    <td className="is-act"><Link className="pill pill--quiet" href={`/app/${encodeURIComponent(a.slug)}`}>Home base</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="pending">
          Nothing here yet. The first phase names your app: the agent writes <code>apps/&lt;slug&gt;/APP.md</code> and this page lists it.
          <small>Until then, <Link href="/app/new">the blank home base</Link> shows what is to come.</small>
        </div>
      )}
    </div>
  );
}
