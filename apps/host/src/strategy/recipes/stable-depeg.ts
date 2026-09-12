import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchSpotUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

/** Alert when a stablecoin leaves its peg band (defaults USDC $0.99–$1.01). */
export async function executeStableDepegAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const symbol =
    typeof params.symbol === "string" && params.symbol.trim()
      ? params.symbol.trim().toUpperCase()
      : "USDC";
  const low = Number(params.low);
  const high = Number(params.high);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return {
      action: "alert",
      label: "Depeg check skipped",
      detail: "Invalid low/high peg band",
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

  const detail = `${symbol} $${usd.toFixed(4)} (peg ${low}–${high})`;
  if (usd >= low && usd <= high) {
    return { action: "none", label: "Checked stable peg", detail };
  }

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label:
        usd < low
          ? `${symbol} depegged below $${low}`
          : `${symbol} depegged above $${high}`,
      detail,
    },
    {
      symbol,
      side: usd < low ? "sell" : "buy",
    },
  );
}
