import type {
  Agent,
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

export type { AvatarId, CreateAgentInput, UpdateAgentInput, Agent };
