/** Structured backtest artifact — plugin result → chat chart card. */

export const BACKTEST_ARTIFACT_KIND = "squadrons.backtest" as const;

export type BacktestEquityPoint = {
  /** Day index from start (0…n) or unix ms — chart uses order + optional label. */
  t: number;
  /** Equity in quote units. */
  v: number;
  /** Optional ISO date label for tooltips. */
  label?: string;
};

export type BacktestStats = {
  startEquity: number;
  endEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  /** Rough annualized Sharpe from daily returns (simulation). */
  sharpe: number;
  trades: number;
  winRatePct: number;
  days: number;
};

export type BacktestArtifact = {
  kind: typeof BACKTEST_ARTIFACT_KIND;
  version: 1;
  /** Engine: simulation now; tenderly later. */
  engine: "simulation" | "tenderly";
  title: string;
  summary: string;
  stats: BacktestStats;
  equityCurve: BacktestEquityPoint[];
  /** Free-form notes (assumptions, caveats). */
  notes?: string[];
};

export function isBacktestArtifact(value: unknown): value is BacktestArtifact {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.kind !== BACKTEST_ARTIFACT_KIND || row.version !== 1) return false;
  if (typeof row.title !== "string" || typeof row.summary !== "string") {
    return false;
  }
  if (!row.stats || typeof row.stats !== "object") return false;
  if (!Array.isArray(row.equityCurve) || row.equityCurve.length < 2) {
    return false;
  }
  return true;
}

/** MCP tool name from dsh-mcp-client, or bare Cordis name. */
export function isBacktestToolName(toolName: string | null | undefined): boolean {
  if (!toolName) return false;
  return (
    toolName === "run_backtest" ||
    toolName.endsWith("__run_backtest") ||
    /(^|__)backtest$/i.test(toolName)
  );
}

/** Pull a backtest artifact out of arbitrary tool-result text / JSON. */
export function parseBacktestArtifact(raw: unknown): BacktestArtifact | null {
  if (isBacktestArtifact(raw)) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isBacktestArtifact(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const nested = (parsed as { artifact?: unknown; result?: unknown })
        .artifact ?? (parsed as { result?: unknown }).result;
      if (isBacktestArtifact(nested)) return nested;
    }
  } catch {
    // fall through — maybe JSON embedded in prose
  }

  const start = trimmed.indexOf(`{"kind":"${BACKTEST_ARTIFACT_KIND}"`);
  const alt = trimmed.indexOf(`{"kind": "${BACKTEST_ARTIFACT_KIND}"`);
  const idx = start >= 0 ? start : alt;
  if (idx < 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(idx));
    return isBacktestArtifact(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Cap curve length for SSE / SQLite detail payloads. */
export function downsampleEquityCurve(
  curve: BacktestEquityPoint[],
  maxPoints = 120,
): BacktestEquityPoint[] {
  if (curve.length <= maxPoints) return curve;
  const out: BacktestEquityPoint[] = [];
  const last = curve.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * last);
    out.push(curve[idx]!);
  }
  return out;
}

export function compactBacktestArtifact(
  artifact: BacktestArtifact,
): BacktestArtifact {
  return {
    ...artifact,
    equityCurve: downsampleEquityCurve(artifact.equityCurve),
  };
}
