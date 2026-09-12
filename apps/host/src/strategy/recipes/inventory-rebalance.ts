import type { StrategyTickDecision } from "@squadrons/shared";
import { fetchSpotUsd } from "../events.js";
import { applyStrategyAction } from "./action.js";
import { resolveRpcUrl } from "./rpc.js";
import { resolveKnownToken } from "./tokens.js";
import type { RecipeContext } from "./types.js";

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  if (typeof payload.result !== "string") {
    throw new Error(`RPC ${method} returned no result`);
  }
  return payload.result;
}

function formatUnits(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}

/**
 * Keep ETH share of (ETH + USDC) inside [target ± band].
 * Proposes a capped corrective USDC↔ETH swap when outside the band.
 */
export async function executeInventoryRebalance(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const wallet = isAddress(ctx.walletAddress) ? ctx.walletAddress : null;
  if (!wallet) {
    return {
      action: "alert",
      label: "Rebalance skipped",
      detail: "No wallet address configured for this strategy",
    };
  }

  const targetEthPct = Number(params.targetEthPct);
  const bandPct = Number(params.bandPct);
  const maxAmountUsd = Number(params.amountUsd);
  const minPortfolioUsd = Number(params.minPortfolioUsd ?? 5);

  if (
    !Number.isFinite(targetEthPct) ||
    !Number.isFinite(bandPct) ||
    !Number.isFinite(maxAmountUsd) ||
    !Number.isFinite(minPortfolioUsd) ||
    targetEthPct < 0 ||
    targetEthPct > 1 ||
    bandPct <= 0 ||
    maxAmountUsd <= 0
  ) {
    return {
      action: "alert",
      label: "Rebalance skipped",
      detail: "Invalid targetEthPct / bandPct / amountUsd",
    };
  }

  const usdc = resolveKnownToken(ctx.agent.chainId, "USDC");
  if (!usdc) {
    return {
      action: "alert",
      label: "Rebalance skipped",
      detail: `USDC not configured on chain ${ctx.agent.chainId}`,
    };
  }

  const ethPrice = await fetchSpotUsd("ETH");
  if (ethPrice == null || !(ethPrice > 0)) {
    return {
      action: "alert",
      label: "Rebalance skipped",
      detail: "No ETH USD price",
    };
  }

  const rpcUrl = resolveRpcUrl(ctx.agent.chainId);
  const ethWei = BigInt(
    await rpcCall(rpcUrl, "eth_getBalance", [wallet, "latest"]),
  );
  const usdcRaw = BigInt(
    await rpcCall(rpcUrl, "eth_call", [
      {
        to: usdc.address,
        data: `0x70a08231000000000000000000000000${wallet.slice(2).toLowerCase()}`,
      },
      "latest",
    ]),
  );

  const ethAmount = formatUnits(ethWei, 18);
  const usdcAmount = formatUnits(usdcRaw, usdc.decimals);
  const ethUsd = ethAmount * ethPrice;
  const usdcUsd = usdcAmount; // treat USDC as $1
  const totalUsd = ethUsd + usdcUsd;

  const detail = `${wallet.slice(0, 6)}…${wallet.slice(-4)} ETH $${ethUsd.toFixed(2)} + USDC $${usdcUsd.toFixed(2)} (target ${(targetEthPct * 100).toFixed(0)}% ±${(bandPct * 100).toFixed(0)})`;

  if (totalUsd < minPortfolioUsd) {
    return {
      action: "none",
      label: "Checked inventory (dust)",
      detail: `${detail} · below min portfolio $${minPortfolioUsd}`,
    };
  }

  const ethPct = ethUsd / totalUsd;
  const low = Math.max(0, targetEthPct - bandPct);
  const high = Math.min(1, targetEthPct + bandPct);

  if (ethPct >= low && ethPct <= high) {
    return {
      action: "none",
      label: "Checked inventory",
      detail: `${detail} · ETH share ${(ethPct * 100).toFixed(1)}% in band`,
    };
  }

  const side: "buy" | "sell" = ethPct > high ? "sell" : "buy";
  const driftUsd =
    side === "sell"
      ? ethUsd - targetEthPct * totalUsd
      : targetEthPct * totalUsd - ethUsd;
  const amountUsd = Math.min(maxAmountUsd, Math.max(0, driftUsd));

  if (!(amountUsd >= 1)) {
    return {
      action: "none",
      label: "Checked inventory",
      detail: `${detail} · drift $${driftUsd.toFixed(2)} below $1`,
    };
  }

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label: `ETH share ${(ethPct * 100).toFixed(1)}% — propose ${side} ~$${amountUsd.toFixed(2)}`,
      detail,
    },
    { symbol: "ETH", side, amountUsd },
  );
}
