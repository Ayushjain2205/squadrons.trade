import type { AvatarId, OrbColorId } from "./avatars";
import type { SupportedChainId } from "./policy";
import type { Strategy } from "./strategy";

/** idle = waiting for user; working = mid-turn; paused = error / halted */
export type AgentStatus = "idle" | "working" | "paused";

/**
 * How an agent runs strategies / trades.
 * - observe: alerts / research only — no trade intents
 * - paper: quote + record fills — never broadcast
 * - live: real txs under caps (host ceiling may still block)
 */
export type RunMode = "observe" | "paper" | "live";

export const RUN_MODES = ["observe", "paper", "live"] as const;

export function isRunMode(value: unknown): value is RunMode {
  return (
    typeof value === "string" &&
    (RUN_MODES as readonly string[]).includes(value)
  );
}

/** Paper and live may propose trades; observe may not. */
export function canProposeTrades(mode: RunMode): boolean {
  return mode === "paper" || mode === "live";
}

/** Only live may broadcast (subject to host execution ceiling). */
export function canBroadcastTrades(mode: RunMode): boolean {
  return mode === "live";
}

export function runModeLabel(mode: RunMode): string {
  if (mode === "live") return "Live";
  if (mode === "paper") return "Paper";
  return "Observe";
}

/**
 * Map legacy spend_mode rows / API values onto RunMode.
 * spend_enabled → paper (safe default; live is an explicit desk choice).
 */
export function runModeFromLegacySpend(
  value: string | null | undefined,
): RunMode {
  if (value === "spend_enabled") return "paper";
  if (isRunMode(value)) return value;
  return "observe";
}

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
  runMode: RunMode;
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

/** Partial identity / run-mode update. Chain may only change when idle or paused. */
export interface UpdateAgentInput {
  name?: string;
  avatarId?: AvatarId;
  colorId?: OrbColorId;
  description?: string;
  chainId?: SupportedChainId;
  runMode?: RunMode;
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
