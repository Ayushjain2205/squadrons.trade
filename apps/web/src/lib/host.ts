import type {
  Agent,
  AvatarId,
  CreateAgentInput,
  UpdateAgentInput,
} from "@squadrons/shared";

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

export async function updateAgent(
  id: string,
  input: UpdateAgentInput,
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  return data.agent;
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
  turn: { finalResponse: string; sessionId: string };
}> {
  return hostFetch(`/v1/agents/${agentId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export type ActivityEvent = {
  id: string;
  agentId: string;
  kind:
    | "turn_start"
    | "turn_end"
    | "tool_call"
    | "tool_result"
    | "error"
    | "info";
  label: string;
  detail: string | null;
  toolName: string | null;
  createdAt: number;
};

export async function listActivity(
  agentId: string,
  limit = 100,
): Promise<ActivityEvent[]> {
  const data = await hostFetch<{ activity: ActivityEvent[] }>(
    `/v1/agents/${agentId}/activity?limit=${limit}`,
  );
  return data.activity;
}

/** Subscribe to live activity for an agent. Returns an unsubscribe fn. */
export function subscribeActivity(
  agentId: string,
  onEvent: (event: ActivityEvent) => void,
): () => void {
  const source = new EventSource(`${hostUrl}/v1/agents/${agentId}/events`);

  const onActivity = (message: MessageEvent) => {
    try {
      const payload = JSON.parse(String(message.data)) as ActivityEvent;
      if (payload?.id) onEvent(payload);
    } catch {
      // ignore malformed frames
    }
  };

  source.addEventListener("activity", onActivity as EventListener);

  return () => {
    source.removeEventListener("activity", onActivity as EventListener);
    source.close();
  };
}

export type { AvatarId, UpdateAgentInput };
