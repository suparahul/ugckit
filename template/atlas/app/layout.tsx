import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Instrument_Serif } from "next/font/google";
import Link from "next/link";

import "./paper.css";
import "./chrome.css";
import "./components.css";
import CommandBar from "@/components/CommandBar";
import { Breadcrumb, RouteFlag, Ticker } from "@/components/Chrome";
import { getCorpus } from "@/lib/data";

/* Self-hosted at build time, so the session itself needs no network. */
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "The Atlas",
  description: "Your research, on one surface. Every claim one click from the post that proves it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const corpus = getCorpus();

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

        <header className="topbar above">
          <div className="topbar__row">
            <Link className="wordmark" href="/orb">
              The <em>Atlas</em>
            </Link>
            <Suspense fallback={<div className="cmd" />}>
              <CommandBar />
            </Suspense>
            <Ticker corpus={corpus} />
          </div>
          <Suspense fallback={<nav className="crumb" />}>
            <Breadcrumb />
          </Suspense>
        </header>

        <main id="main" className="above">
          {children}
        </main>
      </body>
    </html>
  );
}
