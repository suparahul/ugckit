/**
 * The teardown, summarised — the thirteen fixed headings from METHOD.md step 7,
 * laid out graphically rather than as prose. Architecture as a diagram, the hook
 * set as pull-quotes with their view counts, the insertion mechanic shown on a
 * real post, cadence as a timeline. The full text stays one click deeper.
 *
 * Teardowns are still being written — only ventnow has one today. All thirteen
 * slots render every time, and the missing ones say so, because the room should
 * be able to tell the difference between "we found nothing" and "we haven't
 * looked yet". As each TEARDOWN.md lands, the slot fills in on the next index run.
 */

import Link from "next/link";
import type { Brand } from "@/lib/data";
import { views } from "@/lib/data";
import Markdown from "./Markdown";

/** video / carousel / mixed — already counted at build time, no extra work. */
function formatKind(a: Brand["accounts"][number]): { id: "video" | "carousel" | "mixed"; label: string } {
  const { postCount, slideshows } = a.stats;
  if (slideshows <= 0) return { id: "video", label: "video" };
  if (slideshows >= postCount) return { id: "carousel", label: "carousel" };
  return { id: "mixed", label: "mixed" };
}

/** The graphical panels that stand in front of the prose, per heading. */
function ArchitectureDiagram({ brand }: { brand: Brand }) {
  const own = brand.accounts.filter((a) => a.isOwn);
  const personas = brand.accounts.filter((a) => !a.isOwn);
  const byConvention = new Map<string, number>();
  for (const a of personas) byConvention.set(a.handleConvention.label, (byConvention.get(a.handleConvention.label) || 0) + 1);

  return (
    <div className="arch">
      <div className="arch__tier">
        <span className="arch__label">Brand&rsquo;s own</span>
        <div className="arch__nodes">
          {own.length ? (
            own.map((a) => {
              const kind = formatKind(a);
              return (
                <Link className="arch__node arch__node--own" key={a.handle} href={`/account/${a.handle}`}>
                  <span>@{a.handle}</span>
                  <span className="tabular">{views(a.stats.maxViews)}</span>
                  <span className={`arch__kind arch__kind--${kind.id}`}>{kind.label}</span>
                </Link>
              );
            })
          ) : (
            <span className="arch__none">none in the corpus</span>
          )}
        </div>
      </div>
      <div className="arch__tier">
        <span className="arch__label">Personas &amp; creators · {personas.length}</span>
        <div className="arch__nodes">
          {personas.slice(0, 18).map((a) => {
            const kind = formatKind(a);
            return (
              <Link
                className="arch__node"
                key={a.handle}
                href={`/account/${a.handle}`}
                title={`@${a.handle} · ${kind.label}`}
              >
                <span>@{a.handle}</span>
                <span className="tabular">{views(a.stats.maxViews)}</span>
                <span className={`arch__kind arch__kind--${kind.id}`}>{kind.label}</span>
              </Link>
            );
          })}
          {personas.length > 18 && <span className="arch__none">+{personas.length - 18} more</span>}
        </div>
      </div>
      <ul className="arch__conventions">
        {[...byConvention.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([label, n]) => (
            <li key={label}>
              <span className="tabular">{n}</span> {label}
            </li>
          ))}
      </ul>
    </div>
  );
}

function HookPullQuotes({ brand }: { brand: Brand }) {
  const posts = brand.accounts
    .flatMap((a) => a.posts)
    .filter((p) => p.onScreen)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  if (!posts.length) return <p className="pending">No on-screen hooks transcribed for this network yet.</p>;

  return (
    <ul className="pulls">
      {posts.map((p) => (
        <li key={p.id}>
          <Link href={`/post/${p.id}`}>
            <blockquote className="verbatim pulls__quote">
              <Markdown text={p.onScreen || ""} />
            </blockquote>
            <footer>
              <span className="tabular">{views(p.views)}</span> · @{p.handle}
              {p.tags.hook[0] && <span className="pulls__tag">{p.tags.hook[0].label}</span>}
            </footer>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function InsertionOnARealPost({ brand }: { brand: Brand }) {
  const post = brand.accounts
    .flatMap((a) => a.posts)
    .filter((p) => p.tags.insertion.length && p.onScreen)
    .sort((a, b) => b.views - a.views)[0];

  if (!post) return <p className="pending">No product-insertion mechanic detected in this network yet.</p>;

  return (
    <Link className="insertion" href={`/post/${post.id}`}>
      <div className="insertion__mechanics">
        {post.tags.insertion.map((t) => (
          <span className="chip" key={t.id}>
            {t.label}
            {t.evidence && <span className="chip__ev">“{t.evidence}”</span>}
          </span>
        ))}
      </div>
      <blockquote className="verbatim insertion__quote">
        <Markdown text={post.onScreen || ""} />
      </blockquote>
      <p className="insertion__caption">{post.caption}</p>
      <p className="insertion__foot">
        @{post.handle} · <span className="tabular">{views(post.views)}</span>
      </p>
    </Link>
  );
}

function CadenceTimeline({ brand }: { brand: Brand }) {
  const accounts = [...brand.accounts].sort((a, b) => a.stats.firstPost.localeCompare(b.stats.firstPost));
  if (!accounts.length) return null;

  const all = accounts.flatMap((a) => [a.stats.firstPost, a.stats.lastPost]).sort();
  const min = new Date(all[0]).getTime();
  const max = new Date(all[all.length - 1]).getTime();
  const span = Math.max(1, max - min);

  return (
    <div className="timeline">
      {accounts.map((a) => {
        const from = ((new Date(a.stats.firstPost).getTime() - min) / span) * 100;
        const to = ((new Date(a.stats.lastPost).getTime() - min) / span) * 100;
        return (
          <Link className="timeline__row" key={a.handle} href={`/account/${a.handle}`}>
            <span className="timeline__handle">@{a.handle}</span>
            <span className="timeline__track">
              <span
                className={`timeline__bar${a.stats.active ? " is-active" : ""}`}
                style={{ left: `${from}%`, width: `${Math.max(0.8, to - from)}%` }}
              />
            </span>
            <span className="timeline__rate tabular">{a.stats.postsPerWeek}/wk</span>
          </Link>
        );
      })}
      <p className="timeline__scale">
        <span>{all[0]}</span>
        <span>{all[all.length - 1]}</span>
      </p>
    </div>
  );
}

/** Only some headings get a graphic; the rest are prose only. */
const PANELS: Partial<Record<number, (p: { brand: Brand }) => React.ReactNode>> = {
  2: ArchitectureDiagram,
  3: CadenceTimeline,
  5: HookPullQuotes,
  6: InsertionOnARealPost,
};

export default function Teardown({ brand }: { brand: Brand }) {
  const written = brand.teardown.filter((t) => t.present).length;

  return (
    <section aria-labelledby="teardown">
      <div className="section__head">
        <h2 id="teardown" className="eyebrow">
          The teardown
        </h2>
        <p className="section__note tabular">
          {written}/13 headings written
          {written < 13 && " — the rest are in progress"}
        </p>
      </div>

      <ol className="teardown">
        {brand.teardown.map((section) => {
          const Panel = PANELS[section.n];
          return (
            <li className="teardown__item" key={section.n}>
              <h3 className="teardown__heading">
                <span className="teardown__n tabular">{String(section.n).padStart(2, "0")}</span>
                {section.heading}
              </h3>

              {/* The graphic goes in front of the prose — this is the section the
                  spec asks to be laid out rather than read. */}
              {Panel && (
                <div className="teardown__panel">
                  <Panel brand={brand} />
                </div>
              )}

              {section.present ? (
                <details className="teardown__prose">
                  <summary>Read the written analysis</summary>
                  <Markdown className="prose" text={section.body || ""} />
                </details>
              ) : (
                <p className="pending">
                  Not yet written for {brand.name}.
                  {Panel ? " The figures above are derived from the scrape and are live." : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
