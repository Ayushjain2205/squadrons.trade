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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStrategyDraftInput(
  value: unknown,
): UpsertStrategyDraftInput | null {
  if (!isRecord(value)) return null;
  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) return null;

  if (!isRecord(value.trigger)) return null;
  const triggerType = value.trigger.type;
  if (triggerType !== "interval" && triggerType !== "condition") return null;

  const trigger: StrategyTrigger = { type: triggerType };
  if (value.trigger.intervalSec !== undefined) {
    const intervalSec = Number(value.trigger.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec < 15) return null;
    trigger.intervalSec = Math.floor(intervalSec);
  }
  if (value.trigger.condition !== undefined) {
    if (typeof value.trigger.condition !== "string") return null;
    const condition = value.trigger.condition.trim();
    if (condition) trigger.condition = condition;
  }
  if (triggerType === "condition" && !trigger.condition) return null;
  if (triggerType === "interval" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }

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

  return { summary, trigger, action, caps };
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

export function parseStrategyTickDecision(
  value: unknown,
): StrategyTickDecision | null {
  if (!isRecord(value)) return null;
  const action = value.action;
  if (action !== "none" && action !== "alert" && action !== "propose_trade") {
    return null;
  }
  const label =
    typeof value.label === "string" && value.label.trim()
      ? value.label.trim()
      : action === "alert"
        ? "Alert"
        : action === "propose_trade"
          ? "Proposed trade"
          : "Checked strategy";
  const detail =
    typeof value.detail === "string" && value.detail.trim()
      ? value.detail.trim()
      : undefined;

  let intent: StrategyTradeIntent | undefined;
  if (action === "propose_trade") {
    if (!isRecord(value.intent)) return null;
    const amountUsd = Number(value.intent.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
    intent = { amountUsd };
    if (typeof value.intent.symbol === "string" && value.intent.symbol.trim()) {
      intent.symbol = value.intent.symbol.trim().toUpperCase();
    }
    if (value.intent.side === "buy" || value.intent.side === "sell") {
      intent.side = value.intent.side;
    }
    if (typeof value.intent.note === "string" && value.intent.note.trim()) {
      intent.note = value.intent.note.trim();
    }
  }

  return { action, label, detail, intent };
}

export function extractStrategyTickDecisionFromText(
  text: string,
): StrategyTickDecision | null {
  const fenced = text.match(/```tick\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return parseStrategyTickDecision(JSON.parse(fenced[1].trim()));
    } catch {
      return null;
    }
  }
  return null;
}
