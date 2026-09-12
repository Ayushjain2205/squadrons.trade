import {
  DEFAULT_POLICY,
  canProposeTrades,
  type Agent,
  type Strategy,
  type StrategyTickDecision,
  type StrategyTradeIntent,
} from "@squadrons/shared";

export type SpendGateResult =
  | {
      kind: "pass";
      decision: StrategyTickDecision;
    }
  | {
      kind: "blocked";
      reason: string;
      decision: StrategyTickDecision;
    }
  | {
      kind: "proposed";
      decision: StrategyTickDecision;
      intent: StrategyTradeIntent;
      /** Never broadcast here — host executor owns paper vs live. */
      execution: "propose_only";
    };

/**
 * Fail-closed spend gate for strategy ticks.
 * Passing intents are handed to the host executor (paper by default).
 */
export function gateStrategyTickSpend(input: {
  agent: Agent;
  strategy: Strategy;
  decision: StrategyTickDecision;
}): SpendGateResult {
  const { agent, strategy, decision } = input;

  if (decision.action !== "propose_trade") {
    return { kind: "pass", decision };
  }

  const fallbackAlert: StrategyTickDecision = {
    action: "alert",
    label: decision.label || "Trade blocked — alert only",
    detail: decision.detail,
  };

  if (!canProposeTrades(agent.runMode)) {
    return {
      kind: "blocked",
      reason: "Agent is observe-only; switch to Paper or Live to propose trades",
      decision: {
        ...fallbackAlert,
        detail: [
          decision.detail,
          "Blocked: observe mode (no trades)",
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }

  if (strategy.action.type !== "propose_trade") {
    return {
      kind: "blocked",
      reason: "Armed strategy action is alert-only",
      decision: {
        ...fallbackAlert,
        detail: [
          decision.detail,
          "Blocked: strategy is alert-only",
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }

  const intent = decision.intent;
  if (!intent || !(intent.amountUsd > 0)) {
    return {
      kind: "blocked",
      reason: "propose_trade requires intent.amountUsd",
      decision: {
        ...fallbackAlert,
        detail: [
          decision.detail,
          "Blocked: missing trade amount",
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }

  const strategyCap = strategy.caps.maxTradeUsd ?? DEFAULT_POLICY.maxTradeUsd;
  const maxTradeUsd = Math.min(strategyCap, DEFAULT_POLICY.maxTradeUsd);
  if (intent.amountUsd > maxTradeUsd) {
    return {
      kind: "blocked",
      reason: `Amount $${intent.amountUsd} exceeds cap $${maxTradeUsd}`,
      decision: {
        ...fallbackAlert,
        detail: [
          decision.detail,
          `Blocked: over $${maxTradeUsd} cap`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    };
  }

  const label =
    decision.label ||
    `Proposed ${intent.side ?? "trade"} $${intent.amountUsd}${
      intent.symbol ? ` ${intent.symbol}` : ""
    }`;

  return {
    kind: "proposed",
    execution: "propose_only",
    intent,
    decision: {
      action: "propose_trade",
      label,
      detail: [decision.detail, intent.note].filter(Boolean).join(" · ") || undefined,
      intent,
    },
  };
}
