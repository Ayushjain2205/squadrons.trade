import {
  DEFAULT_POLICY,
  type Agent,
  type Strategy,
  type StrategyTradeIntent,
} from "@squadrons/shared";

/** Host execution posture for gated trade intents. */
export type ExecutionMode = "off" | "dry_run" | "live";

export type TradePlan = {
  chainId: number;
  walletAddress: string | null;
  amountUsd: number;
  symbol: string | null;
  side: "buy" | "sell" | null;
  maxSlippageBps: number;
};

export type ExecuteTradeResult =
  | {
      status: "proposed";
      detail: string;
      plan: TradePlan;
    }
  | {
      status: "dry_run";
      detail: string;
      plan: TradePlan;
    }
  | {
      status: "failed";
      reason: string;
      detail: string;
      plan: TradePlan;
    }
  | {
      status: "submitted";
      detail: string;
      plan: TradePlan;
      txHash: string;
    };

export function getExecutionMode(): ExecutionMode {
  const raw = process.env.SQUADRONS_EXECUTION_MODE?.trim().toLowerCase();
  if (raw === "off" || raw === "dry_run" || raw === "live") return raw;
  return "dry_run";
}

function buildPlan(input: {
  agent: Agent;
  intent: StrategyTradeIntent;
  walletAddress: string | null;
}): TradePlan {
  return {
    chainId: input.agent.chainId,
    walletAddress: input.walletAddress,
    amountUsd: input.intent.amountUsd,
    symbol: input.intent.symbol ?? null,
    side: input.intent.side ?? null,
    maxSlippageBps: DEFAULT_POLICY.maxSlippageBps,
  };
}

function describePlan(plan: TradePlan): string {
  const side = plan.side ?? "trade";
  const symbol = plan.symbol ? ` ${plan.symbol}` : "";
  return `${side} $${plan.amountUsd}${symbol} on chain ${plan.chainId}`;
}

/**
 * Run a spend-gated trade intent through the host executor.
 * Default mode is dry_run: records the plan, never broadcasts.
 * Live mode is fail-closed until swap build + Privy sign are wired.
 */
export async function executeGatedTrade(input: {
  agent: Agent;
  strategy: Strategy;
  intent: StrategyTradeIntent;
  walletAddress: string | null;
}): Promise<ExecuteTradeResult> {
  const plan = buildPlan(input);
  const mode = getExecutionMode();
  const summary = describePlan(plan);

  // Defense in depth — spend-gate already checked these.
  if (input.agent.spendMode !== "spend_enabled") {
    return {
      status: "failed",
      reason: "Agent is observe-only",
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }
  if (input.strategy.action.type !== "propose_trade") {
    return {
      status: "failed",
      reason: "Strategy is alert-only",
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }
  if (!(plan.amountUsd > 0) || plan.amountUsd > DEFAULT_POLICY.maxTradeUsd) {
    return {
      status: "failed",
      reason: `Amount outside $${DEFAULT_POLICY.maxTradeUsd} policy`,
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }

  if (mode === "off") {
    return {
      status: "proposed",
      detail: `Queued only (${summary}) — execution mode off`,
      plan,
    };
  }

  if (mode === "dry_run") {
    return {
      status: "dry_run",
      detail: `Dry-run: would ${summary} (no broadcast)`,
      plan,
    };
  }

  // live — fail closed until calldata + Privy signing exist.
  if (plan.chainId !== DEFAULT_POLICY.defaultChainId) {
    return {
      status: "failed",
      reason: `Live execution only on chain ${DEFAULT_POLICY.defaultChainId} (Base)`,
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  if (!plan.walletAddress) {
    return {
      status: "failed",
      reason: "No wallet address for live execution",
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  return {
    status: "failed",
    reason:
      "Live swap build + Privy broadcast not wired yet — use dry_run",
    detail: `Live blocked: ${summary}`,
    plan,
  };
}
