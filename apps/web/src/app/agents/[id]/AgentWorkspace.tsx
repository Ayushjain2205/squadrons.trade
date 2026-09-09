"use client";

import { useEffect, useState } from "react";
import type { AgentMessage, AgentWithWorkspace } from "@/lib/host-types";
import { DeskShell } from "@/components/desk/DeskShell";
import { AgentChat } from "./AgentChat";

/**
 * Client owner for agent detail: keeps rail, chat header, and context panel
 * in sync when settings are saved.
 */
export function AgentWorkspace({
  initialAgents,
  initialAgent,
  initialMessages,
}: {
  initialAgents: AgentWithWorkspace[];
  initialAgent: AgentWithWorkspace;
  initialMessages: AgentMessage[];
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [agent, setAgent] = useState(initialAgent);

  useEffect(() => {
    setAgents(initialAgents);
    setAgent(initialAgent);
  }, [initialAgents, initialAgent]);

  function onAgentUpdated(updated: AgentWithWorkspace) {
    setAgent(updated);
    setAgents((prev) =>
      prev.map((row) => (row.id === updated.id ? updated : row)),
    );
  }

  return (
    <DeskShell
      agents={agents}
      selectedId={agent.id}
      selectedAgent={agent}
      onAgentUpdated={onAgentUpdated}
    >
      <AgentChat
        agent={agent}
        initialMessages={initialMessages}
        onAgentUpdated={onAgentUpdated}
      />
    </DeskShell>
  );
}
