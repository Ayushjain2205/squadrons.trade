import type {
  RecipeId,
  StrategyTickDecision,
} from "@squadrons/shared";
import { executeBalanceThresholdAlert } from "./balance-threshold.js";
import { executePriceBandAlert } from "./price-band.js";
import {
  executePriceCrossAlert,
  executePriceCrossSwap,
} from "./price-cross.js";
import { executeTakeProfitStop } from "./take-profit-stop.js";
import type { RecipeContext } from "./types.js";

export type { RecipeContext } from "./types.js";

export type RecipeExecutor = (
  ctx: RecipeContext,
) => Promise<StrategyTickDecision>;

const EXECUTORS: Record<RecipeId, RecipeExecutor> = {
  balance_threshold_alert: executeBalanceThresholdAlert,
  price_band_alert: executePriceBandAlert,
  price_cross_alert: executePriceCrossAlert,
  price_cross_swap: executePriceCrossSwap,
  take_profit_stop: executeTakeProfitStop,
};

export function hasRecipeExecutor(recipeId: RecipeId | null): boolean {
  return recipeId != null && recipeId in EXECUTORS;
}

export async function executeStrategyRecipe(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const recipeId = ctx.strategy.recipeId;
  if (!recipeId || !EXECUTORS[recipeId]) {
    throw new Error(
      recipeId
        ? `No executor for recipe ${recipeId}`
        : "Strategy has no recipeId",
    );
  }
  return EXECUTORS[recipeId](ctx);
}
