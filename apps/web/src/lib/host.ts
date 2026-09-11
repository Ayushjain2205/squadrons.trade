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

export type WalletChainBalance = {
  chainId: number;
  shortName: string;
  symbol: string;
  balanceWei: string;
  balance: string;
  needsGas: boolean;
};

export type WalletSummary = {
  address: string | null;
  walletId: string | null;
  chains: WalletChainBalance[];
};

export async function getWalletSummary(): Promise<WalletSummary> {
  const data = await hostFetch<WalletSummary & { ok: boolean }>("/v1/wallet");
  return {
    address: data.address,
    walletId: data.walletId ?? null,
    chains: data.chains ?? [],
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

export type {
  AgentPluginView,
  CreateCustomPluginInput,
  CustomMcpConfig,
  UpsertCatalogPluginInput,
  UpdateCustomPluginInput,
} from "@squadrons/shared";

export async function listAgentPlugins(
  agentId: string,
): Promise<import("@squadrons/shared").AgentPluginView[]> {
  const data = await hostFetch<{
    plugins: import("@squadrons/shared").AgentPluginView[];
  }>(`/v1/agents/${agentId}/plugins`);
  return data.plugins;
}

export async function upsertCatalogPlugin(
  agentId: string,
  catalogId: string,
  input: import("@squadrons/shared").UpsertCatalogPluginInput,
): Promise<import("@squadrons/shared").AgentPluginView> {
  const data = await hostFetch<{
    plugin: import("@squadrons/shared").AgentPluginView;
  }>(`/v1/agents/${agentId}/plugins/catalog/${catalogId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data.plugin;
}

export async function createCustomPlugin(
  agentId: string,
  input: import("@squadrons/shared").CreateCustomPluginInput,
): Promise<import("@squadrons/shared").AgentPluginView> {
  const data = await hostFetch<{
    plugin: import("@squadrons/shared").AgentPluginView;
  }>(`/v1/agents/${agentId}/plugins/custom`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.plugin;
}

export async function updateCustomPlugin(
  agentId: string,
  pluginId: string,
  input: import("@squadrons/shared").UpdateCustomPluginInput,
): Promise<import("@squadrons/shared").AgentPluginView> {
  const data = await hostFetch<{
    plugin: import("@squadrons/shared").AgentPluginView;
  }>(`/v1/agents/${agentId}/plugins/${pluginId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.plugin;
}

export async function deleteAgentPlugin(
  agentId: string,
  pluginId: string,
): Promise<void> {
  await hostFetch<{ ok: boolean }>(
    `/v1/agents/${agentId}/plugins/${pluginId}`,
    { method: "DELETE" },
  );
}

export async function upsertStrategyDraft(
  agentId: string,
  draft: {
    summary: string;
    trigger: { type: "interval" | "condition"; intervalSec?: number; condition?: string };
    action: { type: "alert" | "propose_trade"; detail?: string };
    caps?: { maxTradeUsd?: number };
  },
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${agentId}/strategy/draft`,
    {
      method: "PUT",
      body: JSON.stringify(draft),
    },
  );
  return data.agent;
}

async function strategyAction(
  agentId: string,
  action: "arm" | "pause" | "resume" | "disarm",
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${agentId}/strategy/${action}`,
    { method: "POST", body: "{}" },
  );
  return data.agent;
}

export function armStrategy(agentId: string) {
  return strategyAction(agentId, "arm");
}

export function pauseStrategy(agentId: string) {
  return strategyAction(agentId, "pause");
}

export function resumeStrategy(agentId: string) {
  return strategyAction(agentId, "resume");
}

export function disarmStrategy(agentId: string) {
  return strategyAction(agentId, "disarm");
}

export async function listStrategyImprovements(agentId: string) {
  return hostFetch<{
    pending: import("@squadrons/shared").StrategyImprovementProposal | null;
    proposals: import("@squadrons/shared").StrategyImprovementProposal[];
  }>(`/v1/agents/${agentId}/strategy/improvements`);
}

export type TradeIntentRecord = {
  id: string;
  agentId: string;
  status:
    | "proposed"
    | "blocked"
    | "dry_run"
    | "awaiting_allowance"
    | "dismissed"
    | "failed"
    | "submitted";
  amountUsd: number;
  symbol: string | null;
  side: "buy" | "sell" | null;
  label: string;
  detail: string | null;
  reason: string | null;
  txHash?: string | null;
  createdAt: number;
  updatedAt?: number;
};

export async function listTradeIntents(agentId: string, limit = 10) {
  const data = await hostFetch<{
    intents: TradeIntentRecord[];
    awaitingAllowance?: TradeIntentRecord[];
  }>(`/v1/agents/${agentId}/strategy/trade-intents?limit=${limit}`);
  return data;
}

export async function approveTradeAllowance(
  agentId: string,
  intentId: string,
) {
  return hostFetch<{
    intent: TradeIntentRecord;
    execution: { status: string; detail?: string; txHash?: string };
    outcome?: {
      kind: string;
      code: string;
      title: string;
      body: string;
      txHash?: string;
    };
  }>(
    `/v1/agents/${agentId}/strategy/trade-intents/${intentId}/approve-allowance`,
    { method: "POST", body: "{}" },
  );
}

export async function dismissTradeAllowance(
  agentId: string,
  intentId: string,
) {
  return hostFetch<{ intent: TradeIntentRecord }>(
    `/v1/agents/${agentId}/strategy/trade-intents/${intentId}/dismiss-allowance`,
    { method: "POST", body: "{}" },
  );
}

export async function approveStrategyImprovement(
  agentId: string,
  proposalId: string,
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${agentId}/strategy/improvements/${proposalId}/approve`,
    { method: "POST", body: "{}" },
  );
  return data.agent;
}

export async function dismissStrategyImprovement(
  agentId: string,
  proposalId: string,
): Promise<void> {
  await hostFetch(
    `/v1/agents/${agentId}/strategy/improvements/${proposalId}/dismiss`,
    { method: "POST", body: "{}" },
  );
}

export async function updateStrategyImprovement(
  agentId: string,
  patch: {
    enabled?: boolean;
    cadence?: "hourly" | "daily" | "weekly";
    allowedKeys?: string[];
  },
): Promise<AgentWithWorkspace> {
  const data = await hostFetch<{ agent: AgentWithWorkspace }>(
    `/v1/agents/${agentId}/strategy/improvement`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
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
  options: {
    limit?: number;
    before?: number;
    beforeId?: string;
    sources?: Array<"chat" | "strategy" | "system">;
  } = {},
): Promise<{ activity: ActivityEvent[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 40));
  if (options.before != null) params.set("before", String(options.before));
  if (options.beforeId) params.set("beforeId", options.beforeId);
  if (options.sources?.length) params.set("sources", options.sources.join(","));
  const data = await hostFetch<{
    activity: ActivityEvent[];
    hasMore?: boolean;
  }>(`/v1/agents/${agentId}/activity?${params.toString()}`);
  return {
    activity: data.activity,
    hasMore: Boolean(data.hasMore),
  };
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
