import type { AvatarId } from "./avatars";
import type { SupportedChainId } from "./policy";

export type AgentStatus = "idle" | "working" | "needs_input" | "paused";
export type SpendMode = "observe" | "spend_enabled";

export interface Agent {
  id: string;
  userId: string;
  name: string;
  avatarId: AvatarId;
  description: string;
  chainId: SupportedChainId;
  status: AgentStatus;
  spendMode: SpendMode;
  currentGoal: string | null;
  /** Last dsh session id attached to this agent's workspace, if any. */
  lastDshSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentInput {
  name: string;
  avatarId: AvatarId;
  description: string;
  chainId?: SupportedChainId;
}

/** Partial identity update. Chain may only change when idle / needs_input. */
export interface UpdateAgentInput {
  name?: string;
  avatarId?: AvatarId;
  description?: string;
  chainId?: SupportedChainId;
}
