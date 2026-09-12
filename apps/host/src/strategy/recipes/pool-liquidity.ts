import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchPoolReserveUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

/** Alert when a DEX pool's USD reserve drops sharply or under a floor. */
export async function executePoolLiquidityShock(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const poolAddress =
    typeof params.poolAddress === "string" ? params.poolAddress.trim() : "";
  const dropPct = Number(params.dropPct);
  const minReserveUsd = Number(params.minReserveUsd ?? 0);

  if (
    !poolAddress ||
    (!/^0x[a-fA-F0-9]{40}$/.test(poolAddress) &&
      !/^0x[a-fA-F0-9]{64}$/.test(poolAddress))
  ) {
    return {
      action: "alert",
      label: "Pool liquidity check skipped",
      detail: "Invalid poolAddress",
    };
  }
  if (!Number.isFinite(dropPct) || dropPct <= 0 || dropPct > 1) {
    return {
      action: "alert",
      label: "Pool liquidity check skipped",
      detail: "Invalid dropPct (need 0 < dropPct ≤ 1)",
    };
  }

  // Reuse the same sample key as the event edge so we don't double-advance.
  // If the edge already updated state this wake, pass no sampleKey and just read.
  const snap = await fetchPoolReserveUsd(
    ctx.agent.chainId,
    poolAddress,
    // Only update sample on interval wakes; event wakes already sampled in the edge.
    ctx.strategy.trigger.type === "interval" ? ctx.strategy.agentId : undefined,
  );
  if (!snap) {
    return {
      action: "alert",
      label: "Pool liquidity feed failed",
      detail: `No reserve for ${poolAddress.slice(0, 10)}… on chain ${ctx.agent.chainId}`,
    };
  }

  const label =
    snap.name ?? `${poolAddress.slice(0, 6)}…${poolAddress.slice(-4)}`;
  const detail = `${label} reserve $${snap.reserveUsd.toFixed(0)} (drop≥${(dropPct * 100).toFixed(0)}%${minReserveUsd > 0 ? ` / floor $${minReserveUsd}` : ""})`;

  const hitFloor = minReserveUsd > 0 && snap.reserveUsd < minReserveUsd;
  const hitDrop =
    snap.dropFraction != null && snap.dropFraction >= dropPct;

  // Event wake already confirmed the edge — always alert when we get here.
  if (ctx.strategy.trigger.type === "event" || hitDrop || hitFloor) {
    return applyStrategyAction(
      ctx,
      {
        action: "alert",
        label: hitFloor
          ? `${label} below $${minReserveUsd} reserve`
          : `${label} liquidity shock`,
        detail,
      },
      {},
    );
  }

  return { action: "none", label: "Checked pool liquidity", detail };
}
