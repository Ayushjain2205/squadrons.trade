/** Built-in deterministic strategy types the host can execute without an LLM. */

export const RECIPE_IDS = [
  "balance_threshold_alert",
  "price_band_alert",
] as const;

export type RecipeId = (typeof RECIPE_IDS)[number];

export function isRecipeId(value: unknown): value is RecipeId {
  return (
    typeof value === "string" &&
    (RECIPE_IDS as readonly string[]).includes(value)
  );
}

export type RecipeParamSchema = {
  label: string;
  description: string;
  /** Keys Operate / self-improvement may set. */
  paramKeys: string[];
  defaultParams: Record<string, unknown>;
};

export const RECIPE_CATALOG: Record<RecipeId, RecipeParamSchema> = {
  balance_threshold_alert: {
    label: "Balance threshold",
    description:
      "Alert when a wallet's native (or token) balance crosses a threshold.",
    paramKeys: ["walletAddress", "asset", "op", "threshold"],
    defaultParams: {
      asset: "native",
      op: "below",
      threshold: 0.1,
    },
  },
  price_band_alert: {
    label: "Price band",
    description: "Alert when a spot USD price leaves [low, high].",
    paramKeys: ["symbol", "low", "high"],
    defaultParams: {
      symbol: "ETH",
      low: 1000,
      high: 10000,
    },
  },
};

export function recipeLabel(recipeId: RecipeId | null | undefined): string {
  if (!recipeId || !isRecipeId(recipeId)) return "Custom / legacy";
  return RECIPE_CATALOG[recipeId].label;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate + normalize params for a recipe. Returns null if invalid. */
export function parseRecipeParams(
  recipeId: RecipeId,
  value: unknown,
): Record<string, unknown> | null {
  const base = { ...RECIPE_CATALOG[recipeId].defaultParams };
  const raw = value === undefined || value === null ? {} : value;
  if (!isRecord(raw)) return null;

  if (recipeId === "balance_threshold_alert") {
    const asset =
      typeof raw.asset === "string" && raw.asset.trim()
        ? raw.asset.trim()
        : String(base.asset);
    const op = raw.op === "above" || raw.op === "below" ? raw.op : base.op;
    const threshold = Number(raw.threshold ?? base.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) return null;
    const out: Record<string, unknown> = { asset, op, threshold };
    if (typeof raw.walletAddress === "string" && raw.walletAddress.trim()) {
      const addr = raw.walletAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
      out.walletAddress = addr;
    }
    return out;
  }

  if (recipeId === "price_band_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : String(base.symbol);
    const low = Number(raw.low ?? base.low);
    const high = Number(raw.high ?? base.high);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= low) {
      return null;
    }
    return { symbol, low, high };
  }

  return null;
}
