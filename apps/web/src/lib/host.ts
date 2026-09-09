"use client";

import { getAccessToken } from "@privy-io/react-auth";
import type {
  Agent,
  CreateAgentInput,
  UpdateAgentInput,
} from "@squadrons/shared";
import type {
  ActivityEvent,
  AgentMessage,
  AgentWithWorkspace,
  MeResponse,
} from "@/lib/host-types";

export type {
  ActivityEvent,
  AgentMessage,
  AgentWithWorkspace,
  MeResponse,
} from "@/lib/host-types";
export type { AvatarId, UpdateAgentInput } from "@/lib/host-types";

const hostUrl =
  process.env.NEXT_PUBLIC_HOST_URL?.replace(/\/$/, "") ??
  "http://localhost:8787";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not signed in");
  }
  return {
    "content-type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function hostFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const response = await fetch(`${hostUrl}${path}`, {
    ...init,
    headers: {
      ...headers,
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

export async function getMe(): Promise<MeResponse> {
  const data = await hostFetch<MeResponse & { ok: boolean }>("/v1/me");
  return {
    userId: data.userId,
    walletAddress: data.walletAddress,
  };
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

export async function pauseAgent(agentId: string): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${agentId}/pause`,
    { method: "POST", body: "{}" },
  );
  return data.agent;
}

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
  let closed = false;
  let source: EventSource | null = null;

  void (async () => {
    try {
      const token = await getAccessToken();
      if (closed || !token) return;
      const url = `${hostUrl}/v1/agents/${agentId}/events?access_token=${encodeURIComponent(token)}`;
      source = new EventSource(url);
      source.addEventListener("activity", ((message: MessageEvent) => {
        try {
          const payload = JSON.parse(String(message.data)) as ActivityEvent;
          if (payload?.id) onEvent(payload);
        } catch {
          // ignore malformed frames
        }
      }) as EventListener);
    } catch {
      // auth failure — leave trail without live updates
    }
  })();

  return () => {
    closed = true;
    source?.close();
  };
}
