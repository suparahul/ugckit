/**
 * Depth 1 — the orb.
 *
 * A slowly turning sphere. Drag to spin, hover to lift, click to dive. Not a
 * uniform scatter: one cluster per app, so spinning the orb moves between
 * networks and the geography itself carries the argument that each app is a
 * self-contained network.
 *
 * Empty until the research has run. An empty atlas says so in one sentence
 * rather than drawing a sphere with nothing on it.
 */

import type { Metadata } from "next";
import { getCorpus, getOrb } from "@/lib/data";
import { buildOrbSource, planPlates } from "@/lib/orb-source";
import AtlasOrb from "@/components/orb/AtlasOrb";
import "./orb.css";

export const metadata: Metadata = { title: "The Atlas" };

export default async function OrbPage({
  searchParams,
}: {
  searchParams: Promise<{ cluster?: string }>;
}) {
  const { cluster } = await searchParams;
  const clusters = getOrb();
  const corpus = getCorpus();

  if (!clusters.length) {
    return (
      <div className="page orb-page">
        <section className="titlecard">
          <h1 className="titlecard__head">Nothing here yet.</h1>
          <p className="titlecard__sub">
            Run the research — the <code>apps</code>, <code>network</code> and <code>harvest</code> skills — then{" "}
            <code>./ugckit atlas</code>. Every app you study becomes a cluster on this sphere.
          </p>
        </section>
      </div>
    );
  }

  const { plates, clusterMeta } = planPlates(clusters);
  const srcDoc = buildOrbSource(plates, clusterMeta.length);
  const niches = [...new Set(clusters.map((c) => c.niche).filter(Boolean))];

  return (
    <div className="page orb-page">
      <AtlasOrb srcDoc={srcDoc} plates={plates} clusters={clusterMeta} focusCluster={cluster} />

      <section className="titlecard">
        <h1 className="titlecard__head">{niches.length ? niches.join(" · ") : "Research Atlas"}</h1>
        <p className="titlecard__sub">
          {corpus.networks} {corpus.networks === 1 ? "app" : "apps"} &middot; {corpus.accounts} accounts &middot;{" "}
          {corpus.posts.toLocaleString("en-US")} posts. Every claim one click from the post that proves it.
        </p>
      </section>
    </div>
  );
}
