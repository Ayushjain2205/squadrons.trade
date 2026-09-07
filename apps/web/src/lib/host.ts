import type { Agent, AvatarId, CreateAgentInput } from "@squadrons/shared";

const hostUrl =
  process.env.NEXT_PUBLIC_HOST_URL?.replace(/\/$/, "") ??
  "http://localhost:8787";

export type AgentWithWorkspace = Agent & { workspace: string };

export type DshTurnResult = {
  sessionId: string;
  finalResponse: string;
  eventCount: number;
  notificationCount: number;
  workspace: string;
  provider: string;
  model: string;
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

export async function runAgent(
  id: string,
  prompt: string,
  resume = false,
): Promise<{ agent: AgentWithWorkspace; turn: DshTurnResult }> {
  return hostFetch(`/v1/agents/${id}/run`, {
    method: "POST",
    body: JSON.stringify({ prompt, resume }),
  });
}

export type { AvatarId };
