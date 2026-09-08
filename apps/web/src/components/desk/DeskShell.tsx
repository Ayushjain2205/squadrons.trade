import type { AgentWithWorkspace } from "@/lib/host";
import { AgentContextPanel } from "./AgentContextPanel";
import { AgentRail } from "./AgentRail";

/**
 * THESIS: Operator desk — agent roster left, live chat center, agent context right; refuse page-per-agent chrome.
 * OWN-WORLD: Near-black Grok-like rails, charcoal message wells, mint status accent, orb faces as identity.
 * STORY: Pick an agent, talk to it, glance goal/spend/status without leaving the desk.
 * FIRST VIEWPORT: Full-height three columns; selected rail row; center header + messages + pill composer; right goal/status.
 * FORM: Grok Bot desk canon (user-pinned) · seed n/a
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */
export function DeskShell({
  agents,
  selectedId,
  selectedAgent,
  hostError,
  onAgentUpdated,
  children,
}: {
  agents: AgentWithWorkspace[];
  selectedId?: string | null;
  selectedAgent?: AgentWithWorkspace | null;
  hostError?: string | null;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
      <AgentRail
        agents={agents}
        selectedId={selectedId}
        hostError={hostError}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-[var(--canvas)]">
        {children}
      </main>

      <aside className="hidden min-h-0 w-[var(--rail-right)] shrink-0 flex-col border-l border-[var(--line-soft)] bg-[var(--rail)] lg:flex">
        <AgentContextPanel
          agent={selectedAgent ?? null}
          onAgentUpdated={onAgentUpdated}
        />
      </aside>
    </div>
  );
}
