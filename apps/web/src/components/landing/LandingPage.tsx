"use client";

import { LandingHero } from "./LandingHero";
import { HarnessComparison } from "./HarnessComparison";

export interface LandingPageProps {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] selection:bg-[var(--selection)]">
      {/* Section 1: Hero */}
      <LandingHero onLogin={onLogin} />

      {/* Section 2: Missing Primitives / Harness Evolution */}
      <HarnessComparison />
    </div>
  );
}
