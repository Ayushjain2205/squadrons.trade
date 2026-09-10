import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchSpotUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

export async function executePriceCrossAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const symbol =
    typeof params.symbol === "string" && params.symbol.trim()
      ? params.symbol.trim().toUpperCase()
      : "ETH";
  const level = Number(params.level);
  const direction =
    params.direction === "above" ||
    params.direction === "below" ||
    params.direction === "either"
      ? params.direction
      : "below";

  if (!Number.isFinite(level) || level < 0) {
    return {
      action: "alert",
      label: "Price cross skipped",
      detail: "Invalid level param",
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

  const detail = `${symbol} $${usd.toFixed(2)} (cross ${direction} ${level})`;
  const onSide =
    direction === "above"
      ? usd >= level
      : direction === "below"
        ? usd <= level
        : true;

  if (!onSide && direction !== "either") {
    return { action: "none", label: "Checked price cross", detail };
  }

  const side =
    direction === "above" ? "sell" : direction === "below" ? "buy" : undefined;

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label:
        direction === "above"
          ? `${symbol} crossed above $${level}`
          : direction === "below"
            ? `${symbol} crossed below $${level}`
            : `${symbol} crossed $${level}`,
      detail,
    },
    {
      symbol,
      ...(side ? { side } : {}),
    },
  );
}
