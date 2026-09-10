import {
  DEFAULT_POLICY,
  type Agent,
  type Strategy,
  type StrategyTradeIntent,
} from "@squadrons/shared";
import {
  broadcastSwapTx,
  isPrivyBroadcastConfigured,
} from "./broadcast.js";
import {
  buildSwapFromPlan,
  isZeroExConfigured,
  type BuiltSwap,
  type TradePlan,
} from "./swap-build.js";
import { isTenderlyConfigured, simulateSwapTx } from "./tenderly.js";

/** Host execution posture for gated trade intents. */
export type ExecutionMode = "off" | "dry_run" | "live";

export type { TradePlan };
export type ExecuteTradeResult =
  | {
      status: "proposed";
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "dry_run";
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "failed";
      reason: string;
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "submitted";
      detail: string;
      plan: TradePlan;
      swap: BuiltSwap;
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
 * Default mode is dry_run: records the plan (and optional 0x quote), never broadcasts.
 * Live: build 0x swap → optional Tenderly sim → Privy broadcast.
 */
export async function executeGatedTrade(input: {
  agent: Agent;
  strategy: Strategy;
  intent: StrategyTradeIntent;
  walletAddress: string | null;
  walletId?: string | null;
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
    if (!isZeroExConfigured()) {
      return {
        status: "dry_run",
        detail: `Dry-run: would ${summary} (no broadcast; set ZEROEX_API_KEY to quote)`,
        plan,
      };
    }
    const built = await buildSwapFromPlan(plan);
    if (!built.ok) {
      return {
        status: "dry_run",
        detail: `Dry-run: would ${summary} — quote skipped (${built.reason})`,
        plan,
      };
    }
    return {
      status: "dry_run",
      detail: `Dry-run: quoted ${summary} via 0x (no broadcast)`,
      plan,
      swap: built.swap,
    };
  }

  // live
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

  const walletId = input.walletId?.trim() || null;
  if (!walletId) {
    return {
      status: "failed",
      reason:
        "No Privy wallet id on user — re-login after enabling embedded wallet API access",
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  const built = await buildSwapFromPlan(plan);
  if (!built.ok) {
    return {
      status: "failed",
      reason: built.reason,
      detail: `Live blocked at swap build: ${summary}`,
      plan,
    };
  }

  if (built.swap.needsAllowance) {
    return {
      status: "failed",
      reason:
        "Token allowance required before swap — approve path not wired yet",
      detail: `Live blocked at allowance: ${summary}`,
      plan,
      swap: built.swap,
    };
  }

  let simDetail = "Tenderly skipped (not configured)";
  if (isTenderlyConfigured()) {
    const sim = await simulateSwapTx({
      chainId: plan.chainId,
      from: plan.walletAddress,
      tx: built.swap.transaction,
    });
    if (!sim.ok) {
      return {
        status: "failed",
        reason: sim.reason,
        detail: `Live blocked at Tenderly: ${summary}`,
        plan,
        swap: built.swap,
      };
    }
    simDetail = sim.detail;
  }

  if (!isPrivyBroadcastConfigured()) {
    return {
      status: "failed",
      reason:
        "PRIVY_AUTHORIZATION_PRIVATE_KEY is not set — required for live broadcast",
      detail: `Live blocked at broadcast: ${summary} · ${simDetail}`,
      plan,
      swap: built.swap,
    };
  }

  const sent = await broadcastSwapTx({
    walletId,
    chainId: plan.chainId,
    tx: built.swap.transaction,
  });
  if (!sent.ok) {
    return {
      status: "failed",
      reason: sent.reason,
      detail: `Live blocked at broadcast: ${summary} · ${simDetail}`,
      plan,
      swap: built.swap,
    };
  }

  return {
    status: "submitted",
    detail: `Submitted ${summary} · ${sent.detail} · ${simDetail}`,
    plan,
    swap: built.swap,
    txHash: sent.txHash,
  };
}
