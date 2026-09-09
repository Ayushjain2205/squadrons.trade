"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeskShell } from "@/components/desk/DeskShell";
import { listAgents, type AgentWithWorkspace } from "@/lib/host";

export default function NotFound() {
  const [agents, setAgents] = useState<AgentWithWorkspace[]>([]);

  useEffect(() => {
    void listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  return (
    <DeskShell agents={agents} selectedId={null}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="type-display">Agent not found</p>
        <Link
          href="/"
          className="type-ui text-[var(--link)] transition hover:underline"
        >
          Back to agents
        </Link>
      </div>
    </DeskShell>
  );
}
