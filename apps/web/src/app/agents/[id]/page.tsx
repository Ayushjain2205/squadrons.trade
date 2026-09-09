"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DeskShell } from "@/components/desk/DeskShell";
import {
  getAgent,
  listAgents,
  listMessages,
  type AgentMessage,
  type AgentWithWorkspace,
} from "@/lib/host";
import { AgentWorkspace } from "./AgentWorkspace";

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | {
        status: "ready";
        agents: AgentWithWorkspace[];
        agent: AgentWithWorkspace;
        messages: AgentMessage[];
      }
  >({ status: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const [agents, agent, messages] = await Promise.all([
          listAgents(),
          getAgent(id),
          listMessages(id),
        ]);
        if (!cancelled) {
          setState({ status: "ready", agents, agent, messages });
        }
      } catch {
        if (!cancelled) setState({ status: "missing" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") {
    return (
      <DeskShell agents={[]} selectedId={id}>
        <div className="type-ui flex flex-1 items-center justify-center text-[var(--muted)]">
          Loading agent…
        </div>
      </DeskShell>
    );
  }

  if (state.status === "missing") {
    return (
      <DeskShell agents={[]} selectedId={null}>
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

  return (
    <AgentWorkspace
      initialAgents={state.agents}
      initialAgent={state.agent}
      initialMessages={state.messages}
    />
  );
}
