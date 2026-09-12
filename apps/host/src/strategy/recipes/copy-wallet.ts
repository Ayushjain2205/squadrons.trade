import type { StrategyTickDecision } from "@squadrons/shared";
import { applyStrategyAction } from "./action.js";
import {
  takePendingCopySignal,
  sampleCopyTarget,
  detectCopyTrade,
  getCopySnapshot,
  setCopySnapshot,
} from "./copy-detect.js";
import type { RecipeContext } from "./types.js";

/**
 * When a watched wallet looks like it swapped ETH↔USDC, propose a capped mirror.
 * Prefer event wake (`target_trade_seen`); interval re-samples as a fallback.
 */
export async function executeCopyWalletPropose(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const targetAddress =
    typeof params.targetAddress === "string" ? params.targetAddress.trim() : "";
  const amountUsd = Number(params.amountUsd);
  const minUsd = Number(params.minUsd ?? 100);

  if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
    return {
      action: "alert",
      label: "Copy watch skipped",
      detail: "Invalid targetAddress",
    };
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return {
      action: "alert",
      label: "Copy watch skipped",
      detail: "Invalid amountUsd",
    };
  }
  if (!Number.isFinite(minUsd) || minUsd <= 0) {
    return {
      action: "alert",
      label: "Copy watch skipped",
      detail: "Invalid minUsd",
    };
  }

  let signal = takePendingCopySignal(ctx.strategy.agentId);

  // Interval fallback (or lost pending): sample and detect once.
  if (!signal) {
    const next = await sampleCopyTarget(ctx.agent.chainId, targetAddress);
    if (!next) {
      return {
        action: "alert",
        label: "Copy watch failed",
        detail: "Could not read target ETH/USDC balances or ETH price",
      };
    }
    const prev = getCopySnapshot(ctx.strategy.agentId);
    setCopySnapshot(ctx.strategy.agentId, next);
    if (!prev) {
      return {
        action: "none",
        label: "Copy watch armed",
        detail: `${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)} ETH $${next.ethUsd.toFixed(0)} / USDC $${next.usdcUsd.toFixed(0)}`,
      };
    }
    signal = detectCopyTrade(prev, next, minUsd);
  }

  if (!signal) {
    return {
      action: "none",
      label: "Checked copy target",
      detail: `No ETH↔USDC trade ≥ $${minUsd} on ${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)}`,
    };
  }

  const proposeUsd = Math.min(amountUsd, Math.max(1, signal.observedUsd));
  const short = `${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)}`;

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label: `Copy ${signal.side} ETH from ${short}`,
      detail: `${signal.detail} · propose ~$${proposeUsd.toFixed(2)}`,
    },
    {
      symbol: "ETH",
      side: signal.side,
      amountUsd: proposeUsd,
    },
  );
}
