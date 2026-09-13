"use client";

import { LandingHero } from "./LandingHero";

export interface LandingPageProps {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] selection:bg-[var(--selection)]">
      {/* Section 1: Hero */}
      <LandingHero onLogin={onLogin} />

      {/* Subsequent sections will be mounted here as we build them */}
    </div>
  );
}
