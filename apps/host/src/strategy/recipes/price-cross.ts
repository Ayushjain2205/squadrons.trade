import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchSpotUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

function resolveCrossParams(params: Record<string, unknown>): {
  symbol: string;
  level: number;
  direction: "above" | "below" | "either";
} {
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
  return { symbol, level, direction };
}

function resolveSwapSide(
  params: Record<string, unknown>,
  direction: "above" | "below" | "either",
): "buy" | "sell" {
  if (params.side === "buy" || params.side === "sell") return params.side;
  if (direction === "above") return "sell";
  return "buy";
}

async function executePriceCross(
  ctx: RecipeContext,
  mode: "alert" | "swap",
): Promise<StrategyTickDecision> {
  const { symbol, level, direction } = resolveCrossParams(ctx.strategy.params);

  if (!Number.isFinite(level) || level < 0) {
    return {
      action: "alert",
      label: mode === "swap" ? "Price cross swap skipped" : "Price cross skipped",
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
    return {
      action: "none",
      label: mode === "swap" ? "Checked price cross swap" : "Checked price cross",
      detail,
    };
  }

  const side = resolveSwapSide(ctx.strategy.params, direction);
  const crossLabel =
    direction === "above"
      ? `${symbol} crossed above $${level}`
      : direction === "below"
        ? `${symbol} crossed below $${level}`
        : `${symbol} crossed $${level}`;

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label:
        mode === "swap" ? `${crossLabel} — propose ${side}` : crossLabel,
      detail,
    },
    {
      symbol,
      side,
    },
  );
}

export async function executePriceCrossAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  return executePriceCross(ctx, "alert");
}

export async function executePriceCrossSwap(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  return executePriceCross(ctx, "swap");
}
