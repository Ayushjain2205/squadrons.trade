import type { Agent, AvatarId, CreateAgentInput } from "@squadrons/shared";

const hostUrl =
  process.env.NEXT_PUBLIC_HOST_URL?.replace(/\/$/, "") ??
  "http://localhost:8787";

export type AgentWithWorkspace = Agent & { workspace: string };

export type AgentMessage = {
  id: string;
  agentId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

async function hostFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${hostUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-user-id": "local-dev",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & {
    ok?: boolean;
    error?: string;
  };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `Host request failed (${response.status})`);
  }

  return payload;
}

export function getHostUrl(): string {
  return hostUrl;
}

export async function listAgents(): Promise<AgentWithWorkspace[]> {
  const data = await hostFetch<{ agents: AgentWithWorkspace[] }>("/v1/agents");
  return data.agents;
}

export async function getAgent(id: string): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${id}`,
  );
  return data.agent;
}

export async function createAgent(
  input: CreateAgentInput,
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: Agent; workspace: string }>(
    "/v1/agents",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return { ...data.agent, workspace: data.workspace };
}

export async function listMessages(agentId: string): Promise<AgentMessage[]> {
  const data = await hostFetch<{ messages: AgentMessage[] }>(
    `/v1/agents/${agentId}/messages`,
  );
  return data.messages;
}

export async function sendMessage(
  agentId: string,
  content: string,
): Promise<{
  agent: AgentWithWorkspace;
  messages: AgentMessage[];
  turn: { finalResponse: string; goalCompleted?: boolean; sessionId: string };
}> {
  return hostFetch(`/v1/agents/${agentId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export type { AvatarId };
