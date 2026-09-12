import type { Strategy } from "@squadrons/shared";

const SPOT_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  BTC: "bitcoin",
  SOL: "solana",
  USDC: "usd-coin",
};

/** In-memory last samples for event-edge detection (resets on host restart). */
const lastPrices = new Map<string, number>();

export type EventEdgeResult =
  | { kind: "skip"; reason: string }
  | { kind: "armed"; detail: string }
  | { kind: "quiet"; detail: string }
  | { kind: "fire"; detail: string };

export async function fetchSpotUsd(symbol: string): Promise<number | null> {
  const coingeckoId = SPOT_IDS[symbol.toUpperCase()];
  if (!coingeckoId) return null;

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", coingeckoId);
  url.searchParams.set("vs_currencies", "usd");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (event wakes; read-only)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as Record<
    string,
    { usd?: number } | undefined
  >;
  const usd = payload?.[coingeckoId]?.usd;
  return typeof usd === "number" ? usd : null;
}

/**
 * Cheap pre-check for event triggers. Only `fire` should run the full recipe path
 * with a loud "Strategy tick" — quiet polls just advance lastTickAt.
 */
export async function evaluateEventEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const event = strategy.trigger.event?.trim() || "";
  if (!event) {
    return { kind: "skip", reason: "missing event kind" };
  }

  if (
    event === "price_cross" ||
    strategy.recipeId === "price_cross_alert" ||
    strategy.recipeId === "price_cross_swap"
  ) {
    return evaluatePriceCrossEdge(strategy);
  }

  if (
    event === "price_tp_stop" ||
    strategy.recipeId === "take_profit_stop"
  ) {
    return evaluateTakeProfitStopEdge(strategy);
  }

  if (
    event === "stable_depeg" ||
    strategy.recipeId === "stable_depeg_alert"
  ) {
    return evaluateStableDepegEdge(strategy);
  }

  // Unknown events: treat like interval (always fire when due).
  return {
    kind: "fire",
    detail: `event ${event} (no edge detector — running recipe)`,
  };
}

async function evaluatePriceCrossEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "ETH";
  const level = Number(strategy.params.level);
  const direction =
    strategy.params.direction === "above" ||
    strategy.params.direction === "below" ||
    strategy.params.direction === "either"
      ? strategy.params.direction
      : "below";

  if (!Number.isFinite(level)) {
    return { kind: "skip", reason: "invalid price_cross level" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(2)} — watching ${direction} ${level}`,
    };
  }

  let crossed = false;
  if (direction === "above") {
    crossed = prev < level && price >= level;
  } else if (direction === "below") {
    crossed = prev > level && price <= level;
  } else {
    crossed =
      (prev < level && price >= level) || (prev > level && price <= level);
  }

  const detail = `${symbol} $${prev.toFixed(2)} → $${price.toFixed(2)} (level ${level})`;
  if (crossed) return { kind: "fire", detail };
  return { kind: "quiet", detail };
}

async function evaluateTakeProfitStopEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "ETH";
  const takeProfit = Number(strategy.params.takeProfit);
  const stopLoss = Number(strategy.params.stopLoss);

  if (
    !Number.isFinite(takeProfit) ||
    !Number.isFinite(stopLoss) ||
    takeProfit <= stopLoss
  ) {
    return { kind: "skip", reason: "invalid takeProfit/stopLoss" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(2)} — watching TP $${takeProfit} / stop $${stopLoss}`,
    };
  }

  const hitTp = prev < takeProfit && price >= takeProfit;
  const hitStop = prev > stopLoss && price <= stopLoss;
  const detail = `${symbol} $${prev.toFixed(2)} → $${price.toFixed(2)} (TP $${takeProfit} / stop $${stopLoss})`;

  if (hitTp || hitStop) {
    return {
      kind: "fire",
      detail: hitTp ? `${detail} · TP` : `${detail} · stop`,
    };
  }
  return { kind: "quiet", detail };
}

async function evaluateStableDepegEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "USDC";
  const low = Number(strategy.params.low);
  const high = Number(strategy.params.high);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return { kind: "skip", reason: "invalid stable peg band" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  const inside = (p: number) => p >= low && p <= high;

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(4)} — watching peg ${low}–${high}`,
    };
  }

  const detail = `${symbol} $${prev.toFixed(4)} → $${price.toFixed(4)} (peg ${low}–${high})`;
  if (inside(prev) && !inside(price)) {
    return { kind: "fire", detail: `${detail} · depeg` };
  }
  return { kind: "quiet", detail };
}

export function clearEventEdgeState(agentId: string): void {
  lastPrices.delete(agentId);
}
