import type {
  Agent,
  ActivityEvent as SharedActivityEvent,
  AvatarId,
  CreateAgentInput,
  UpdateAgentInput,
} from "@squadrons/shared";

export type AgentWithWorkspace = Agent & { workspace: string };

export type AgentMessage = {
  id: string;
  agentId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
};

export type MeResponse = {
  userId: string;
  walletAddress: string | null;
};

export type ActivityEvent = SharedActivityEvent;

export type { AvatarId, CreateAgentInput, UpdateAgentInput, Agent };
