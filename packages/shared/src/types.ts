import type { AvatarId, OrbColorId } from "./avatars";
import type { SupportedChainId } from "./policy";

/** idle = waiting for user; working = mid-turn; paused = error / halted */
export type AgentStatus = "idle" | "working" | "paused";
export type SpendMode = "observe" | "spend_enabled";

export interface Agent {
  id: string;
  userId: string;
  name: string;
  /** Face / eye style id. */
  avatarId: AvatarId;
  /** Orb body color — independent of face. */
  colorId: OrbColorId;
  description: string;
  chainId: SupportedChainId;
  status: AgentStatus;
  spendMode: SpendMode;
  /** Last dsh session id attached to this agent's workspace, if any. */
  lastDshSessionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAgentInput {
  name: string;
  avatarId: AvatarId;
  colorId?: OrbColorId;
  description: string;
  chainId?: SupportedChainId;
}

/** Partial identity update. Chain may only change when idle or paused. */
export interface UpdateAgentInput {
  name?: string;
  avatarId?: AvatarId;
  colorId?: OrbColorId;
  description?: string;
  chainId?: SupportedChainId;
}
