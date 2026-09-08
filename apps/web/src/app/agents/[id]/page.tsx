import { notFound } from "next/navigation";
import { DeskShell } from "@/components/desk/DeskShell";
import { getAgent, listAgents, listMessages } from "@/lib/host";
import { AgentChat } from "./AgentChat";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = await params;

  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let agent;
  let messages;

  try {
    agents = await listAgents();
    [agent, messages] = await Promise.all([getAgent(id), listMessages(id)]);
  } catch {
    notFound();
  }

  return (
    <DeskShell agents={agents} selectedId={agent.id} selectedAgent={agent}>
      <AgentChat agent={agent} initialMessages={messages} />
    </DeskShell>
  );
}
