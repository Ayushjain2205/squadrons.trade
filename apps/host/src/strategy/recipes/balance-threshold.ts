import type { StrategyTickDecision } from "@squadrons/shared";
import { applyStrategyAction } from "./action.js";
import { resolveRpcUrl } from "./rpc.js";
import { isNativeAsset, resolveKnownToken } from "./tokens.js";
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

async function ethGetBalance(
  rpcUrl: string,
  address: `0x${string}`,
): Promise<bigint> {
  return BigInt(await rpcCall(rpcUrl, "eth_getBalance", [address, "latest"]));
}

/** ERC-20 balanceOf(address) via eth_call. */
async function erc20BalanceOf(
  rpcUrl: string,
  token: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  const data = `0x70a08231000000000000000000000000${owner.slice(2).toLowerCase()}`;
  const result = await rpcCall(rpcUrl, "eth_call", [
    { to: token, data },
    "latest",
  ]);
  return BigInt(result);
}

function formatUnits(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  return Number(whole) + Number(frac) / Number(base);
}

export async function executeBalanceThresholdAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const wallet =
    (isAddress(params.walletAddress) ? params.walletAddress : null) ??
    (isAddress(ctx.walletAddress) ? ctx.walletAddress : null);

  if (!wallet) {
    return {
      action: "alert",
      label: "Balance check skipped",
      detail: "No wallet address configured for this strategy",
    };
  }

  const asset =
    typeof params.asset === "string" ? params.asset.trim() : "native";
  const op = params.op === "above" ? "above" : "below";
  const threshold = Number(params.threshold);
  if (!Number.isFinite(threshold) || threshold < 0) {
    return {
      action: "alert",
      label: "Balance check skipped",
      detail: "Invalid threshold param",
    };
  }

  const rpcUrl = resolveRpcUrl(ctx.agent.chainId);
  let amount: number;
  let symbol: string;

  if (isNativeAsset(asset)) {
    const wei = await ethGetBalance(rpcUrl, wallet);
    amount = formatUnits(wei, 18);
    symbol = "ETH";
  } else {
    const token = resolveKnownToken(ctx.agent.chainId, asset);
    if (!token) {
      return {
        action: "alert",
        label: "Balance check skipped",
        detail: `Unknown asset ${asset} on chain ${ctx.agent.chainId}`,
      };
    }
    const raw = await erc20BalanceOf(rpcUrl, token.address, wallet);
    amount = formatUnits(raw, token.decimals);
    symbol = token.symbol;
  }

  const fired = op === "below" ? amount < threshold : amount > threshold;
  const detail = `${wallet.slice(0, 6)}…${wallet.slice(-4)} has ${amount.toFixed(4)} ${symbol} (threshold ${op} ${threshold})`;

  if (!fired) {
    return {
      action: "none",
      label: "Checked balance",
      detail,
    };
  }

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label:
        op === "below"
          ? `Balance below ${threshold} ${symbol}`
          : `Balance above ${threshold} ${symbol}`,
      detail,
    },
    {
      symbol,
      // Below threshold → need more; above → trim.
      side: op === "below" ? "buy" : "sell",
    },
  );
}
