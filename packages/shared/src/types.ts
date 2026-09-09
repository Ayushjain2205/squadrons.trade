import type { AvatarId, OrbColorId } from "./avatars";
import type { SupportedChainId } from "./policy";
import type { AgentMode, Strategy } from "./strategy";

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
  /** Scout = research; Operate = shape / run strategy. Default scout. */
  mode: AgentMode;
  /** Attached strategy when drafted or armed; null when none. */
  strategy: Strategy | null;
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

/** Partial identity / posture update. Chain may only change when idle or paused. */
export interface UpdateAgentInput {
  name?: string;
  avatarId?: AvatarId;
  colorId?: OrbColorId;
  description?: string;
  chainId?: SupportedChainId;
  mode?: AgentMode;
  spendMode?: SpendMode;
}

/** Product-facing activity trail kinds (mapped from dsh session events). */
export type ActivityKind =
  | "turn_start"
  | "turn_end"
  | "tool_call"
  | "tool_result"
  | "error"
  | "info";

/**
 * Where the activity came from.
 * chat = desk conversation tools; strategy = armed tick loop; system = arm/pause/etc.
 */
export type ActivitySource = "chat" | "strategy" | "system";

export interface ActivityEvent {
  id: string;
  agentId: string;
  kind: ActivityKind;
  source: ActivitySource;
  /** Short operator-facing line. */
  label: string;
  /** Optional truncated detail (args, result snippet). */
  detail: string | null;
  /** Tool name when kind is tool_call / tool_result. */
  toolName: string | null;
  createdAt: number;
}
