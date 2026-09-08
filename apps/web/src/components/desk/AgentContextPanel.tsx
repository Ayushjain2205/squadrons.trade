import { chainLabel } from "@squadrons/shared";
import type { AgentWithWorkspace } from "@/lib/host";

export function AgentContextPanel({
  agent,
}: {
  agent: AgentWithWorkspace | null;
}) {
  if (!agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          Select an agent to see its goal and status.
        </p>
      </div>
    );
  }

  return (
    <div className="desk-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--ink)]">
          Goal
        </h2>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {agent.currentGoal?.trim() ||
            "No active goal — send a message to set one."}
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">Status</h2>
        <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
          <span className="rounded-md bg-[var(--accent-dim)] px-2 py-1 text-[var(--accent)]">
            {agent.status.replace("_", " ")}
          </span>
          <span className="rounded-md bg-[var(--panel-2)] px-2 py-1 text-[var(--muted)]">
            {agent.spendMode === "observe" ? "observe" : "spend on"}
          </span>
          <span className="rounded-md bg-[var(--panel)] px-2 py-1 font-[family-name:var(--font-mono)] normal-case tracking-normal text-[var(--muted)]">
            {chainLabel(agent.chainId)} · {agent.chainId}
          </span>
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-sm font-semibold tracking-[-0.01em]">About</h2>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {agent.description}
        </p>
      </section>
    </div>
  );
}
