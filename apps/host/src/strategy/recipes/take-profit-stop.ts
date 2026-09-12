import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchSpotUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

/**
 * Long-exit style: take-profit is above, stop-loss is below.
 * When either level is crossed, propose the configured side (default sell).
 */
export async function executeTakeProfitStop(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const symbol =
    typeof params.symbol === "string" && params.symbol.trim()
      ? params.symbol.trim().toUpperCase()
      : "ETH";
  const takeProfit = Number(params.takeProfit);
  const stopLoss = Number(params.stopLoss);
  const side = params.side === "buy" ? "buy" : "sell";

  if (
    !Number.isFinite(takeProfit) ||
    !Number.isFinite(stopLoss) ||
    takeProfit <= stopLoss
  ) {
    return {
      action: "alert",
      label: "Take profit / stop skipped",
      detail: "Invalid takeProfit/stopLoss params (need takeProfit > stopLoss)",
    };
  }

  const usd = await fetchSpotUsd(symbol);
  if (usd == null) {
    return {
      action: "alert",
      label: "Price feed failed",
      detail: `No USD price for ${symbol}`,
    };
  }

  const detail = `${symbol} $${usd.toFixed(2)} (TP $${takeProfit} / stop $${stopLoss})`;
  const hitTp = usd >= takeProfit;
  const hitStop = usd <= stopLoss;

  if (!hitTp && !hitStop) {
    return { action: "none", label: "Checked take profit / stop", detail };
  }

  const reason = hitTp
    ? `take-profit $${takeProfit}`
    : `stop-loss $${stopLoss}`;

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label: `${symbol} hit ${reason} — propose ${side}`,
      detail,
    },
    { symbol, side },
  );
}
