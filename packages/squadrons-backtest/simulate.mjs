/**
 * Deterministic simulated equity backtest.
 * Swap engine → Tenderly later; keep the artifact shape stable.
 */

const ARTIFACT_KIND = "squadrons.backtest";

/** Mulberry32 — small seeded PRNG. */
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {{
 *   strategy?: string,
 *   days?: number,
 *   startEquity?: number,
 *   seed?: string | number,
 *   annualDriftPct?: number,
 *   annualVolPct?: number,
 * }} input
 */
export function runSimulation(input = {}) {
  const strategy =
    typeof input.strategy === "string" && input.strategy.trim()
      ? input.strategy.trim()
      : "mean-reversion desk";
  const days = clamp(Math.round(Number(input.days) || 90), 14, 365);
  const startEquity = clamp(Number(input.startEquity) || 10_000, 100, 10_000_000);
  const seedRaw =
    input.seed != null && String(input.seed).trim()
      ? String(input.seed).trim()
      : strategy;
  const seed =
    typeof input.seed === "number" && Number.isFinite(input.seed)
      ? input.seed >>> 0
      : hashSeed(seedRaw);
  const annualDrift = (Number(input.annualDriftPct) || 18) / 100;
  const annualVol = (Number(input.annualVolPct) || 35) / 100;

  const rand = mulberry32(seed);
  const dailyDrift = annualDrift / 365;
  const dailyVol = annualVol / Math.sqrt(365);

  const equityCurve = [];
  let equity = startEquity;
  let peak = startEquity;
  let maxDrawdownPct = 0;
  let wins = 0;
  let trades = 0;
  const dailyReturns = [];

  const startMs = Date.UTC(2025, 0, 1);
  equityCurve.push({
    t: 0,
    v: round2(equity),
    label: new Date(startMs).toISOString().slice(0, 10),
  });

  for (let d = 1; d <= days; d++) {
    // Geometric Brownian + occasional trade day noise
    const z = boxMuller(rand);
    let ret = dailyDrift + dailyVol * z;
    const tradeDay = rand() < 0.35;
    if (tradeDay) {
      trades += 1;
      const edge = (rand() - 0.42) * 0.012;
      ret += edge;
      if (edge >= 0) wins += 1;
    }
    equity = Math.max(50, equity * (1 + ret));
    dailyReturns.push(ret);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    maxDrawdownPct = Math.max(maxDrawdownPct, dd);
    equityCurve.push({
      t: d,
      v: round2(equity),
      label: new Date(startMs + d * 86_400_000).toISOString().slice(0, 10),
    });
  }

  const endEquity = equity;
  const totalReturnPct = ((endEquity - startEquity) / startEquity) * 100;
  const mean =
    dailyReturns.reduce((a, b) => a + b, 0) / Math.max(dailyReturns.length, 1);
  const variance =
    dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) /
    Math.max(dailyReturns.length - 1, 1);
  const sharpe =
    Math.sqrt(variance) > 0
      ? (mean / Math.sqrt(variance)) * Math.sqrt(365)
      : 0;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;

  const stats = {
    startEquity: round2(startEquity),
    endEquity: round2(endEquity),
    totalReturnPct: round2(totalReturnPct),
    maxDrawdownPct: round2(maxDrawdownPct),
    sharpe: round2(sharpe),
    trades,
    winRatePct: round2(winRatePct),
    days,
  };

  const sign = totalReturnPct >= 0 ? "+" : "";
  return {
    kind: ARTIFACT_KIND,
    version: 1,
    engine: "simulation",
    title: strategy,
    summary: `${sign}${stats.totalReturnPct}% over ${days}d · max DD ${stats.maxDrawdownPct}% · Sharpe ${stats.sharpe}`,
    stats,
    equityCurve,
    notes: [
      "Simulated equity path — not live chain execution.",
      "Replace engine with Tenderly simulation when wired.",
    ],
  };
}

function boxMuller(rand) {
  const u = Math.max(rand(), 1e-12);
  const v = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
