/** Built-in deterministic strategy types the host can execute without an LLM. */

export const RECIPE_IDS = [
  "balance_threshold_alert",
  "price_band_alert",
  "price_cross_alert",
  "price_cross_swap",
  "take_profit_stop",
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
  /** Keys chat / self-improvement may set. */
  paramKeys: string[];
  defaultParams: Record<string, unknown>;
};

export const RECIPE_CATALOG: Record<RecipeId, RecipeParamSchema> = {
  balance_threshold_alert: {
    label: "Balance threshold",
    description:
      "Alert when a wallet's native or known ERC-20 balance crosses a threshold.",
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
  price_cross_alert: {
    label: "Price cross",
    description:
      "Event-style: alert when spot USD price crosses a level (host tracks edge).",
    paramKeys: ["symbol", "level", "direction"],
    defaultParams: {
      symbol: "ETH",
      level: 3000,
      direction: "below",
    },
  },
  price_cross_swap: {
    label: "Price cross swap",
    description:
      "Event-style: when spot USD crosses a level, propose a capped USDC↔ETH/WETH swap (spend still fail-closed).",
    paramKeys: ["symbol", "level", "direction", "side", "amountUsd"],
    defaultParams: {
      symbol: "ETH",
      level: 2800,
      direction: "below",
      side: "buy",
      amountUsd: 10,
    },
  },
  take_profit_stop: {
    label: "Take profit / stop",
    description:
      "Event-style: propose an exit swap when spot hits take-profit (above) or stop-loss (below). Long-exit defaults (side sell).",
    paramKeys: ["symbol", "takeProfit", "stopLoss", "side", "amountUsd"],
    defaultParams: {
      symbol: "ETH",
      takeProfit: 3500,
      stopLoss: 2500,
      side: "sell",
      amountUsd: 10,
    },
  },
};

export function recipeLabel(recipeId: RecipeId | null | undefined): string {
  if (!recipeId || !isRecipeId(recipeId)) return "Custom / legacy";
  return RECIPE_CATALOG[recipeId].label;
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/**
 * One-line plain-language plan for the desk Strategy card.
 * Falls back to null when params aren't recipe-shaped.
 */
export function describeRecipePlan(
  recipeId: RecipeId | null | undefined,
  params: Record<string, unknown> | null | undefined,
  actionType?: "alert" | "propose_trade",
): string | null {
  if (!recipeId || !isRecipeId(recipeId) || !params) return null;
  const verb = actionType === "propose_trade" ? "Propose trade when" : "Alert when";

  if (recipeId === "balance_threshold_alert") {
    const asset =
      typeof params.asset === "string" && params.asset !== "native"
        ? params.asset.toUpperCase()
        : "native balance";
    const op = params.op === "above" ? "goes above" : "goes below";
    const threshold =
      typeof params.threshold === "number"
        ? params.threshold
        : Number(params.threshold);
    if (!Number.isFinite(threshold)) return null;
    const wallet =
      typeof params.walletAddress === "string" && params.walletAddress
        ? ` on ${shortAddress(params.walletAddress)}`
        : "";
    return `${verb} ${asset} ${op} ${threshold}${wallet}`;
  }

  if (recipeId === "price_band_alert") {
    const symbol =
      typeof params.symbol === "string" ? params.symbol.toUpperCase() : "asset";
    const low = Number(params.low);
    const high = Number(params.high);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    return `${verb} ${symbol} leaves ${formatUsd(low)}–${formatUsd(high)}`;
  }

  if (recipeId === "price_cross_alert" || recipeId === "price_cross_swap") {
    const symbol =
      typeof params.symbol === "string" ? params.symbol.toUpperCase() : "asset";
    const level = Number(params.level);
    if (!Number.isFinite(level)) return null;
    const direction =
      params.direction === "above"
        ? "crosses above"
        : params.direction === "either"
          ? "crosses"
          : "crosses below";
    if (recipeId === "price_cross_swap") {
      const side =
        params.side === "sell"
          ? "sell"
          : params.side === "buy"
            ? "buy"
            : params.direction === "above"
              ? "sell"
              : "buy";
      const amount = Number(params.amountUsd);
      const size =
        Number.isFinite(amount) && amount > 0
          ? ` (~${formatUsd(amount)})`
          : "";
      return `Propose ${side} ${symbol} when price ${direction} ${formatUsd(level)}${size}`;
    }
    return `${verb} ${symbol} ${direction} ${formatUsd(level)}`;
  }

  if (recipeId === "take_profit_stop") {
    const symbol =
      typeof params.symbol === "string" ? params.symbol.toUpperCase() : "asset";
    const takeProfit = Number(params.takeProfit);
    const stopLoss = Number(params.stopLoss);
    if (!Number.isFinite(takeProfit) || !Number.isFinite(stopLoss)) return null;
    const side = params.side === "buy" ? "buy" : "sell";
    const amount = Number(params.amountUsd);
    const size =
      Number.isFinite(amount) && amount > 0 ? ` (~${formatUsd(amount)})` : "";
    return `Propose ${side} ${symbol} at TP ${formatUsd(takeProfit)} or stop ${formatUsd(stopLoss)}${size}`;
  }

  return null;
}

/** Human wake schedule — not host poll internals. */
export function describeStrategySchedule(trigger: {
  type: string;
  intervalSec?: number;
  event?: string;
}): string {
  if (trigger.type === "event") {
    if (trigger.event === "price_cross") return "Watches for a price cross";
    if (trigger.event === "price_tp_stop") {
      return "Watches for take-profit or stop";
    }
    if (trigger.event) return `Watches for ${trigger.event.replace(/_/g, " ")}`;
    return "Watches for an event";
  }
  if (trigger.type === "interval") {
    const sec = trigger.intervalSec ?? 60;
    if (sec >= 3600 && sec % 3600 === 0) {
      const h = sec / 3600;
      return h === 1 ? "Checks every hour" : `Checks every ${h} hours`;
    }
    if (sec >= 60 && sec % 60 === 0) {
      const m = sec / 60;
      return m === 1 ? "Checks every minute" : `Checks every ${m} minutes`;
    }
    return `Checks every ${sec}s`;
  }
  return "On a condition";
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

  if (recipeId === "price_cross_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : String(base.symbol);
    const level = Number(raw.level ?? base.level);
    const direction =
      raw.direction === "above" ||
      raw.direction === "below" ||
      raw.direction === "either"
        ? raw.direction
        : base.direction;
    if (!Number.isFinite(level) || level < 0) return null;
    return { symbol, level, direction };
  }

  if (recipeId === "price_cross_swap") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : String(base.symbol);
    const level = Number(raw.level ?? base.level);
    const direction =
      raw.direction === "above" ||
      raw.direction === "below" ||
      raw.direction === "either"
        ? raw.direction
        : base.direction;
    if (!Number.isFinite(level) || level < 0) return null;

    const inferredSide =
      direction === "above" ? "sell" : direction === "below" ? "buy" : "buy";
    const side =
      raw.side === "buy" || raw.side === "sell"
        ? raw.side
        : base.side === "buy" || base.side === "sell"
          ? base.side
          : inferredSide;

    const amountUsd = Number(raw.amountUsd ?? base.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;

    return { symbol, level, direction, side, amountUsd };
  }

  if (recipeId === "take_profit_stop") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : String(base.symbol);
    const takeProfit = Number(raw.takeProfit ?? base.takeProfit);
    const stopLoss = Number(raw.stopLoss ?? base.stopLoss);
    if (
      !Number.isFinite(takeProfit) ||
      !Number.isFinite(stopLoss) ||
      takeProfit < 0 ||
      stopLoss < 0 ||
      takeProfit <= stopLoss
    ) {
      return null;
    }
    const side =
      raw.side === "buy" || raw.side === "sell"
        ? raw.side
        : base.side === "buy" || base.side === "sell"
          ? base.side
          : "sell";
    const amountUsd = Number(raw.amountUsd ?? base.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
    return { symbol, takeProfit, stopLoss, side, amountUsd };
  }

  return null;
}
