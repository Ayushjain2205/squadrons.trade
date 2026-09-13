"use client";

import { LandingHero } from "./LandingHero";
import { HarnessComparison } from "./HarnessComparison";
import { WorkflowSteps } from "./WorkflowSteps";
import { AgentRosterBento } from "./AgentRosterBento";
import { LandingFooter } from "./LandingFooter";

export interface LandingPageProps {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] selection:bg-[var(--selection)]">
      {/* Section 1: Hero */}
      <LandingHero onLogin={onLogin} />

      {/* Section 2: Why a DeFi Harness */}
      <HarnessComparison />

      {/* Section 3: The 4-Step Operator Workflow */}
      <WorkflowSteps />

      {/* Section 4: Squadron Roster Bento */}
      <AgentRosterBento />

      {/* Section 5: Final CTA & Footer */}
      <LandingFooter onLogin={onLogin} />
    </div>
  );
}

