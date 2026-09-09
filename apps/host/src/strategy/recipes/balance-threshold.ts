import type { StrategyTickDecision } from "@squadrons/shared";
import { resolveRpcUrl } from "./rpc.js";
import type { RecipeContext } from "./types.js";

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function ethGetBalance(
  rpcUrl: string,
  address: `0x${string}`,
): Promise<bigint> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
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
    throw new Error("RPC returned no balance");
  }
  return BigInt(payload.result);
}

export async function executeBalanceThresholdAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const wallet =
    (isAddress(params.walletAddress)
      ? params.walletAddress
      : null) ??
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
  if (asset !== "native" && asset.toUpperCase() !== "ETH") {
    return {
      action: "alert",
      label: "Balance check skipped",
      detail: `Asset ${asset} not supported yet — use native/ETH`,
    };
  }

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
  const wei = await ethGetBalance(rpcUrl, wallet);
  const eth = Number(wei) / 1e18;
  const fired = op === "below" ? eth < threshold : eth > threshold;

  const detail = `${wallet.slice(0, 6)}…${wallet.slice(-4)} has ${eth.toFixed(4)} ETH (threshold ${op} ${threshold})`;

  if (!fired) {
    return {
      action: "none",
      label: "Checked balance",
      detail,
    };
  }

  return {
    action: ctx.strategy.action.type === "propose_trade" ? "alert" : "alert",
    label:
      op === "below"
        ? `Balance below ${threshold} ETH`
        : `Balance above ${threshold} ETH`,
    detail,
  };
}
