import { notFound } from "next/navigation";
import { getAgent, listAgents, listMessages } from "@/lib/host";
import { AgentWorkspace } from "./AgentWorkspace";

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
    <AgentWorkspace
      initialAgents={agents}
      initialAgent={agent}
      initialMessages={messages}
    />
  );
}
