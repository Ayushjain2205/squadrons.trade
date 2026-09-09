/** Desk posture: research vs shape/run a strategy. */
export type AgentMode = "scout" | "operate";

/** Lifecycle of the single strategy attached to an agent. */
export type StrategyStatus = "none" | "draft" | "running" | "paused";

export type StrategyTriggerType = "interval" | "condition";

export type StrategyActionType = "alert" | "propose_trade";

export interface StrategyTrigger {
  type: StrategyTriggerType;
  /** Poll interval in seconds when type is interval (and as a floor for condition checks). */
  intervalSec?: number;
  /** Human / LLM-evaluated condition when type is condition. */
  condition?: string;
}

export interface StrategyAction {
  type: StrategyActionType;
  /** Optional short note for alerts or trade intent. */
  detail?: string;
}

export interface StrategyCaps {
  maxTradeUsd?: number;
}

/**
 * One strategy per agent (v1).
 * `status: none` means no row / empty — callers may omit the object entirely.
 */
export interface Strategy {
  agentId: string;
  status: Exclude<StrategyStatus, "none">;
  summary: string;
  trigger: StrategyTrigger;
  action: StrategyAction;
  caps: StrategyCaps;
  /** Last successful host tick, if any. */
  lastTickAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertStrategyDraftInput {
  summary: string;
  trigger: StrategyTrigger;
  action: StrategyAction;
  caps?: StrategyCaps;
}

export function isAgentMode(value: unknown): value is AgentMode {
  return value === "scout" || value === "operate";
}

export function isStrategyStatus(value: unknown): value is StrategyStatus {
  return (
    value === "none" ||
    value === "draft" ||
    value === "running" ||
    value === "paused"
  );
}
