/**
 * /app/<slug>/canvas — the long form of the tracker: the eight phases as
 * cards, each in the state the files give it, with its facts, what the agent
 * asked for, and what fills it folded under. A pending act of yours is a
 * line, not a control. #phase-N opens the page at one card.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getApp, listApps } from "@/lib/apps";
import { canvasOf, type Phase } from "@/lib/canvas";
import { brandsOf } from "@/lib/data";
import { listHandles } from "@/lib/handles";
import { listBatches } from "@/lib/niche";
import { allStates } from "@/lib/production";
import { isPosted } from "@/lib/read";
import { Fact, MarkRow, type MarkState } from "@/components/factory/Bits";
import { firstPicture } from "@/components/factory/Wait";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `The canvas · ${getApp(slug)?.name ?? "Your app"} — Organic Factory` };
}

/** The picture of a phase: what it produced, when a picture exists. */
function pictures(slug: string): Partial<Record<Phase["key"], string>> {
  const out: Partial<Record<Phase["key"], string>> = {};
  const app = getApp(slug);
  if (app?.icon) out.app = app.icon;
  const brand = brandsOf(slug).find((b) => b.logo);
  if (brand?.logo) out.apps = brand.logo;
  const batch = listBatches(slug).find((b) => b.posts.some((p) => p.slides.length));
  const bp = batch?.posts.find((p) => p.slides.length);
  if (bp) out.niche = bp.slides[0];
  const h = listHandles(slug).find((x) => x.profile);
  if (h?.profile) out.handles = h.profile;
  const posted = allStates(slug).filter(isPosted).sort((a, b) => (b.posted!.at > a.posted!.at ? 1 : -1))[0];
  const pic = posted ? firstPicture(posted) : null;
  if (pic) out.production = pic;
  return out;
}

export default async function CanvasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app && !(slug === "new" && !listApps().length)) notFound();
  const canvas = canvasOf(slug);
  const pics = pictures(slug);
  const s = encodeURIComponent(slug);
  return (
    <div className="page stack column">
      <header className="prod__head">
        <div>
          <h1 className="prod__title">The canvas</h1>
          <p className="prod__counts"><b>{canvas.done} of {canvas.phases.length}</b> phases done{canvas.now ? ` · ${canvas.now.title} in progress` : ""}</p>
        </div>
        <Link className="topbar__link" href={`/app/${s}`}>Home base</Link>
      </header>
      <p className="lede lede--full">{canvas.nowSentence}</p>
      <ol className="stages">
        {canvas.phases.map((p) => {
          const you = p.state === "now" && !!p.ask;
          const cls = p.state === "todo" ? " is-empty" : you ? " is-you" : "";
          const mark: MarkState = p.changedUpstream ? "stale" : p.state === "done" ? "approved" : you ? "waiting" : p.state === "now" ? "inhand" : "open";
          const word = p.changedUpstream ? "changed upstream" : p.state === "done" ? "done" : you ? "in progress · waiting on you" : p.state === "now" ? "in progress" : "not started";
          const pic = p.state !== "todo" ? pics[p.key] : undefined;
          return (
            <li key={p.key} className={`stage${cls}`} id={`phase-${p.n}`} aria-label={`Phase ${p.n}: ${p.title}`}>
              <div className="stage__n">{p.n}</div>
              {pic ? <img className="stage__pic" src={pic} alt="" /> : <span className="stage__pic stage__pic--none" />}
              <h2 className="stage__h">
                {p.page ? <Link href={p.page.href}>{p.title}</Link> : p.title}
                <span className="week__state"><MarkRow states={[mark]} label={word} /><span className={`state${you ? " is-waiting" : ""}`}>{word}</span></span>
              </h2>
              <p className="stage__text">{p.state === "todo" ? p.line : p.sentence}{p.changedUpstream ? ` ${p.changedUpstream} changed after this phase was filled; the agent reads it again when it next works here.` : ""}</p>
              {p.facts.length ? <p className="stage__facts">{p.facts.map((f, i) => <Fact key={i} text={f} />)}{p.page && p.state !== "todo" ? <Link href={p.page.href}>{p.page.label}</Link> : null}</p> : null}
              {p.ask && p.state === "now" ? <p className="stage__ask"><span className="stage__ask-k">The agent asked you for</span> {p.ask}</p> : null}
              <details className="anatomy">
                <summary>What fills this phase</summary>
                <dl className="stage__what">
                  <div className="packaging__row"><dt>You bring</dt><dd>{p.what.you}</dd></div>
                  <div className="packaging__row"><dt>The agent writes</dt><dd><code>{p.what.agent}</code></dd></div>
                  <div className="packaging__row"><dt>The page shows</dt><dd>{p.what.shows}</dd></div>
                </dl>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
