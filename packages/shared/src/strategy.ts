import {
  isRecipeId,
  parseRecipeParams,
  type RecipeId,
} from "./recipes";

/** Lifecycle of the single strategy attached to an agent. */
export type StrategyStatus = "none" | "draft" | "running" | "paused";

/**
 * How the host wakes the strategy.
 * - interval: time-based
 * - event: event-based (v1 may poll with pollFloorSec)
 * - condition: legacy LLM-evaluated string (read-compat only)
 */
export type StrategyTriggerType = "interval" | "event" | "condition";

export type StrategyActionType = "alert" | "propose_trade";

export type StrategyImprovementCadence = "hourly" | "daily" | "weekly";

export interface StrategyTrigger {
  type: StrategyTriggerType;
  /** Poll / interval seconds (interval trigger, or poll floor for event/condition). */
  intervalSec?: number;
  /** Legacy free-text condition (deprecated — use a recipe + params). */
  condition?: string;
  /** Event kind when type is event, e.g. "price_cross". */
  event?: string;
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
 * Self-improvement policy on an armed strategy.
 * Cadence is strategy-scoped. v1 applies patches only after desk approve
 * (autoApply stays false).
 */
export interface StrategyImprovement {
  enabled: boolean;
  cadence: StrategyImprovementCadence;
  /** v1: always false — patches become proposals. */
  autoApply: boolean;
  /** Subset of recipe param keys the improver may touch. */
  allowedKeys: string[];
  lastRunAt: number | null;
}

export const DEFAULT_STRATEGY_IMPROVEMENT: StrategyImprovement = {
  enabled: false,
  cadence: "daily",
  autoApply: false,
  allowedKeys: [],
  lastRunAt: null,
};

/**
 * One strategy per agent (v1).
 * `status: none` means no row / empty — callers may omit the object entirely.
 *
 * Runtime is deterministic: host runs `recipeId` with `params`.
 * LLMs author/edit via chat (and optional self-improvement proposals).
 */
export interface Strategy {
  agentId: string;
  status: Exclude<StrategyStatus, "none">;
  summary: string;
  /** Built-in recipe; null = legacy draft that must be re-proposed. */
  recipeId: RecipeId | null;
  params: Record<string, unknown>;
  trigger: StrategyTrigger;
  action: StrategyAction;
  caps: StrategyCaps;
  improvement: StrategyImprovement;
  /** Last successful host tick, if any. */
  lastTickAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertStrategyDraftInput {
  summary: string;
  recipeId: RecipeId;
  params?: Record<string, unknown>;
  trigger: StrategyTrigger;
  action: StrategyAction;
  caps?: StrategyCaps;
  improvement?: Partial<StrategyImprovement> | null;
}

/** Live param patch from chat while draft/paused/running. */
export interface PatchStrategyParamsInput {
  params: Record<string, unknown>;
}

export function isStrategyStatus(value: unknown): value is StrategyStatus {
  return (
    value === "none" ||
    value === "draft" ||
    value === "running" ||
    value === "paused"
  );
}

export function isImprovementCadence(
  value: unknown,
): value is StrategyImprovementCadence {
  return value === "hourly" || value === "daily" || value === "weekly";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStrategyImprovement(
  value: unknown,
  fallbackAllowedKeys: string[] = [],
): StrategyImprovement {
  if (!isRecord(value)) {
    return {
      ...DEFAULT_STRATEGY_IMPROVEMENT,
      allowedKeys: [...fallbackAllowedKeys],
    };
  }
  const cadence = isImprovementCadence(value.cadence)
    ? value.cadence
    : DEFAULT_STRATEGY_IMPROVEMENT.cadence;
  const allowedKeys = Array.isArray(value.allowedKeys)
    ? value.allowedKeys.filter((k): k is string => typeof k === "string")
    : fallbackAllowedKeys;
  return {
    enabled: value.enabled === true,
    cadence,
    autoApply: false,
    allowedKeys,
    lastRunAt:
      typeof value.lastRunAt === "number" && Number.isFinite(value.lastRunAt)
        ? value.lastRunAt
        : null,
  };
}

function parseTrigger(value: unknown): StrategyTrigger | null {
  if (!isRecord(value)) return null;
  const triggerType = value.type;
  if (
    triggerType !== "interval" &&
    triggerType !== "event" &&
    triggerType !== "condition"
  ) {
    return null;
  }

  const trigger: StrategyTrigger = { type: triggerType };
  if (value.intervalSec !== undefined) {
    const intervalSec = Number(value.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec < 15) return null;
    trigger.intervalSec = Math.floor(intervalSec);
  }
  if (value.condition !== undefined) {
    if (typeof value.condition !== "string") return null;
    const condition = value.condition.trim();
    if (condition) trigger.condition = condition;
  }
  if (value.event !== undefined) {
    if (typeof value.event !== "string") return null;
    const event = value.event.trim();
    if (event) trigger.event = event;
  }

  if (triggerType === "condition" && !trigger.condition) return null;
  if (triggerType === "event" && !trigger.event) return null;
  if (triggerType === "interval" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }
  if (triggerType === "event" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }
  return trigger;
}

export function parseStrategyDraftInput(
  value: unknown,
): UpsertStrategyDraftInput | null {
  if (!isRecord(value)) return null;
  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) return null;

  if (!isRecipeId(value.recipeId)) return null;
  const recipeId = value.recipeId;
  const params = parseRecipeParams(recipeId, value.params);
  if (!params) return null;

  const trigger = parseTrigger(value.trigger);
  if (!trigger) return null;
  // New drafts should not use legacy condition — map guidance is in prompts.
  if (trigger.type === "condition") return null;

  if (!isRecord(value.action)) return null;
  const actionType = value.action.type;
  if (actionType !== "alert" && actionType !== "propose_trade") return null;
  const action: StrategyAction = { type: actionType };
  if (value.action.detail !== undefined) {
    if (typeof value.action.detail !== "string") return null;
    const detail = value.action.detail.trim();
    if (detail) action.detail = detail;
  }

  let caps: StrategyCaps | undefined;
  if (value.caps !== undefined) {
    if (!isRecord(value.caps)) return null;
    caps = {};
    if (value.caps.maxTradeUsd !== undefined) {
      const maxTradeUsd = Number(value.caps.maxTradeUsd);
      if (!Number.isFinite(maxTradeUsd) || maxTradeUsd <= 0) return null;
      caps.maxTradeUsd = maxTradeUsd;
    }
  }

  const improvement =
    value.improvement === undefined
      ? undefined
      : parseStrategyImprovement(value.improvement, Object.keys(params));

  return {
    summary,
    recipeId,
    params,
    trigger,
    action,
    caps,
    improvement,
  };
}

/**
 * Extract a draft from an assistant reply.
 * Looks for a ```strategy fenced JSON block.
 */
export function extractStrategyDraftFromText(
  text: string,
): UpsertStrategyDraftInput | null {
  const fenced = text.match(/```strategy\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return parseStrategyDraftInput(JSON.parse(fenced[1].trim()));
    } catch {
      return null;
    }
  }
  return null;
}

/** Outcome of a deterministic recipe execution (host runtime). */
export type StrategyTickDecision = {
  action: "none" | "alert" | "propose_trade";
  label: string;
  detail?: string;
  /** Required when action is propose_trade. */
  intent?: StrategyTradeIntent;
};

export type StrategyTradeIntent = {
  amountUsd: number;
  symbol?: string;
  side?: "buy" | "sell";
  note?: string;
};

export function improvementCadenceMs(
  cadence: StrategyImprovementCadence,
): number {
  switch (cadence) {
    case "hourly":
      return 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "daily":
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/** Pending / resolved self-improvement param patch. */
export type ImprovementProposalStatus =
  | "pending"
  | "approved"
  | "dismissed";

export interface StrategyImprovementProposal {
  id: string;
  agentId: string;
  status: ImprovementProposalStatus;
  patch: Record<string, unknown>;
  reason: string | null;
  createdAt: number;
  resolvedAt: number | null;
}

export interface ProposeImprovementInput {
  patch: Record<string, unknown>;
  reason?: string;
}

export function parseProposeImprovementInput(
  value: unknown,
): ProposeImprovementInput | null {
  if (!isRecord(value)) return null;
  if (!isRecord(value.patch)) return null;
  const patch: Record<string, unknown> = { ...value.patch };
  if (Object.keys(patch).length === 0) return null;
  const reason =
    typeof value.reason === "string" && value.reason.trim()
      ? value.reason.trim()
      : undefined;
  return reason ? { patch, reason } : { patch };
}

