import {
  DEFAULT_POLICY,
  type StrategyTickDecision,
  type StrategyTradeIntent,
} from "@squadrons/shared";
import type { RecipeContext } from "./types.js";

/**
 * When the armed strategy action is propose_trade, upgrade a fired alert
 * into a capped USD trade intent. Quiet checks (`none`) and skip alerts
 * stay unchanged — spend-gate still owns observe / caps / propose-only.
 */
export function applyStrategyAction(
  ctx: RecipeContext,
  decision: StrategyTickDecision,
  intentHints?: {
    symbol?: string;
    side?: "buy" | "sell";
  },
): StrategyTickDecision {
  if (decision.action !== "alert") return decision;
  if (ctx.strategy.action.type !== "propose_trade") return decision;

  const cap = Math.min(
    ctx.strategy.caps.maxTradeUsd ?? DEFAULT_POLICY.maxTradeUsd,
    DEFAULT_POLICY.maxTradeUsd,
  );
  const fromParams = Number(ctx.strategy.params.amountUsd);
  const amountUsd =
    Number.isFinite(fromParams) && fromParams > 0
      ? Math.min(fromParams, cap)
      : cap;

  const intent: StrategyTradeIntent = {
    amountUsd,
    ...(intentHints?.symbol ? { symbol: intentHints.symbol } : {}),
    ...(intentHints?.side ? { side: intentHints.side } : {}),
    ...(decision.detail ? { note: decision.detail } : {}),
  };

  return {
    action: "propose_trade",
    label: decision.label,
    detail: decision.detail,
    intent,
  };
}
