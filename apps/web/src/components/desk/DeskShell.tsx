"use client";

import { useEffect, useState } from "react";
import type { AgentWithWorkspace } from "@/lib/host-types";
import { AgentContextPanel } from "./AgentContextPanel";
import { AgentRail } from "./AgentRail";
import { ContextPanelSkeleton } from "./DeskSkeleton";

const DESK_COLLAPSED_KEY = "squadrons.deskCollapsed";

/**
 * THESIS: Operator desk — agent roster left, live chat center, agent context right; refuse page-per-agent chrome.
 * OWN-WORLD: Near-black Grok-like rails, charcoal message wells, mint status accent, orb faces as identity.
 * STORY: Pick an agent, talk to it, glance identity + activity without leaving the desk.
 * FIRST VIEWPORT: Full-height three columns; selected rail row; center header + messages + pill composer; right soft identity + activity.
 * FORM: Grok Bot desk canon (user-pinned) · seed n/a
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */
export function DeskShell({
  agents,
  selectedId,
  selectedAgent,
  hostError,
  loading = false,
  onAgentUpdated,
  children,
}: {
  agents: AgentWithWorkspace[];
  selectedId?: string | null;
  selectedAgent?: AgentWithWorkspace | null;
  hostError?: string | null;
  loading?: boolean;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
  children: React.ReactNode;
}) {
  const [deskCollapsed, setDeskCollapsed] = useState(false);

  useEffect(() => {
    try {
      setDeskCollapsed(localStorage.getItem(DESK_COLLAPSED_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  function setCollapsed(next: boolean) {
    setDeskCollapsed(next);
    try {
      localStorage.setItem(DESK_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
      <AgentRail
        agents={agents}
        selectedId={selectedId}
        hostError={hostError}
        loading={loading}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-[var(--canvas)]">
        {children}
      </main>

      {/* Desktop desk rail — collapses to a slim reopen strip */}
      <aside
        className={`relative hidden min-h-0 shrink-0 flex-col border-l border-[var(--line-soft)] bg-[var(--rail)] lg:flex ${
          deskCollapsed ? "w-10" : "w-[var(--rail-right)]"
        }`}
        style={{
          transition: "width 220ms ease",
        }}
      >
        {deskCollapsed ? (
          <div className="flex h-full flex-col items-center pt-3">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Show desk"
              className="chain-tip group/chain relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            >
              <ChevronsLeftIcon />
              <span role="tooltip" className="chain-tip-bubble chain-tip-bubble--left">
                Show desk
              </span>
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-[var(--rail-right)] flex-1 flex-col">
            {loading && selectedId ? (
              <div className="relative flex min-h-0 flex-1 flex-col">
                <ContextPanelSkeleton />
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Hide desk"
                  className="chain-tip group/chain absolute right-4 top-3 flex size-8 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                >
                  <ChevronsRightIcon />
                  <span role="tooltip" className="chain-tip-bubble chain-tip-bubble--left">
                    Hide desk
                  </span>
                </button>
              </div>
            ) : (
              <AgentContextPanel
                agent={selectedAgent ?? null}
                onAgentUpdated={onAgentUpdated}
                onCollapse={() => setCollapsed(true)}
              />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function ChevronsLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 17l-5-5 5-5M18 17l-5-5 5-5"
      />
    </svg>
  );
}

function ChevronsRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 17l5-5-5-5M6 17l5-5-5-5"
      />
    </svg>
  );
}
