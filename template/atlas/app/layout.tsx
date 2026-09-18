import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Instrument_Serif } from "next/font/google";

import "./paper.css";
import "./chrome.css";
import "./components.css";
import "./production.css";
import "./reporting.css";
import "./endproduct.css";
import "./niche.css";
import "./factory.css";
import CommandBar from "@/components/CommandBar";
import { Breadcrumb, RouteFlag, Ticker } from "@/components/Chrome";
import { Pbar, ResearchRow } from "@/components/Shell";
import { listApps } from "@/lib/apps";
import { getCorpus } from "@/lib/data";

/* Self-hosted at build time, so the session itself needs no network. */
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "Organic Factory",
  description: "A home base for each of your apps: what waits for you, what was posted, and where the work is.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const corpus = getCorpus();
  const apps = listApps().map((a) => ({ slug: a.slug, name: a.name, niche: a.niche }));

  return (
    <html lang="en" className={`${inter.variable} ${instrument.variable}`}>
      <body>
        {/* One continuous surface, under everything, fixed to the viewport. */}
        <div className="paper-surface" aria-hidden="true" />
        <div className="paper-grain" aria-hidden="true" />

        <Suspense fallback={null}>
          <RouteFlag />
        </Suspense>

        <a className="skip" href="#main">
          Skip to content
        </a>

        <Suspense fallback={<header className="pbar above" />}>
          <Pbar apps={apps} />
        </Suspense>

        {/* The research leaf pages keep the command bar and the corpus counter. */}
        <Suspense fallback={null}>
          <ResearchRow>
            <div className="topbar topbar--row above">
              <div className="topbar__row">
                <Suspense fallback={<div className="cmd" />}>
                  <CommandBar />
                </Suspense>
                <Ticker corpus={corpus} />
              </div>
              <Suspense fallback={<nav className="crumb" />}>
                <Breadcrumb />
              </Suspense>
            </div>
          </ResearchRow>
        </Suspense>

        <main id="main" className="above">
          {children}
        </main>
      </body>
    </html>
  );
}
