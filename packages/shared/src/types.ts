import type { AvatarId } from "./avatars.js";
import type { SupportedChainId } from "./policy.js";

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
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentInput {
  name: string;
  avatarId: AvatarId;
  description: string;
  chainId?: SupportedChainId;
}
