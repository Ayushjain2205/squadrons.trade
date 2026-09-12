import { resolveRpcUrl } from "./rpc.js";
import { resolveKnownToken } from "./tokens.js";

export type CopyWalletSnapshot = {
  ethAmount: number;
  wethAmount: number;
  usdcAmount: number;
  ethUsd: number;
  usdcUsd: number;
  ethPrice: number;
};

export type CopyTradeSignal = {
  side: "buy" | "sell";
  /** Observed opposite-leg notional (informational). */
  observedUsd: number;
  detail: string;
};

const lastSnapshots = new Map<string, CopyWalletSnapshot>();
const pendingSignals = new Map<string, CopyTradeSignal>();

async function fetchEthSpotUsd(): Promise<number | null> {
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", "ethereum");
  url.searchParams.set("vs_currencies", "usd");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (copy wallet; read-only)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    ethereum?: { usd?: number };
  };
  const usd = payload.ethereum?.usd;
  return typeof usd === "number" ? usd : null;
}

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

async function erc20Balance(
  rpcUrl: string,
  token: `0x${string}`,
  owner: `0x${string}`,
  decimals: number,
): Promise<number> {
  const data = `0x70a08231000000000000000000000000${owner.slice(2).toLowerCase()}`;
  const result = await rpcCall(rpcUrl, "eth_call", [
    { to: token, data },
    "latest",
  ]);
  return formatUnits(BigInt(result), decimals);
}

/** Sample target native ETH + WETH + USDC (USD via spot ETH). */
export async function sampleCopyTarget(
  chainId: number,
  targetAddress: string,
): Promise<CopyWalletSnapshot | null> {
  if (!isAddress(targetAddress)) return null;
  const usdc = resolveKnownToken(chainId, "USDC");
  const weth = resolveKnownToken(chainId, "WETH");
  if (!usdc) return null;

  const ethPrice = await fetchEthSpotUsd();
  if (ethPrice == null || !(ethPrice > 0)) return null;

  const rpcUrl = resolveRpcUrl(chainId);
  const ethWei = BigInt(
    await rpcCall(rpcUrl, "eth_getBalance", [targetAddress, "latest"]),
  );
  const ethAmount = formatUnits(ethWei, 18);
  const wethAmount = weth
    ? await erc20Balance(rpcUrl, weth.address, targetAddress, weth.decimals)
    : 0;
  const usdcAmount = await erc20Balance(
    rpcUrl,
    usdc.address,
    targetAddress,
    usdc.decimals,
  );

  const ethUsd = (ethAmount + wethAmount) * ethPrice;
  return {
    ethAmount,
    wethAmount,
    usdcAmount,
    ethUsd,
    usdcUsd: usdcAmount,
    ethPrice,
  };
}

/**
 * Detect a likely ETH↔USDC swap from inventory deltas.
 * Buy: ETH exposure up + USDC down. Sell: opposite.
 */
export function detectCopyTrade(
  prev: CopyWalletSnapshot,
  next: CopyWalletSnapshot,
  minUsd: number,
): CopyTradeSignal | null {
  const deltaEthUsd = next.ethUsd - prev.ethUsd;
  const deltaUsdc = next.usdcUsd - prev.usdcUsd;
  const short = (addrN: number) => addrN.toFixed(2);

  if (deltaEthUsd >= minUsd && deltaUsdc <= -minUsd * 0.25) {
    const observed = Math.min(Math.abs(deltaEthUsd), Math.abs(deltaUsdc));
    return {
      side: "buy",
      observedUsd: observed,
      detail: `target ETH $${short(prev.ethUsd)}→$${short(next.ethUsd)}, USDC $${short(prev.usdcUsd)}→$${short(next.usdcUsd)}`,
    };
  }

  if (deltaEthUsd <= -minUsd && deltaUsdc >= minUsd * 0.25) {
    const observed = Math.min(Math.abs(deltaEthUsd), Math.abs(deltaUsdc));
    return {
      side: "sell",
      observedUsd: observed,
      detail: `target ETH $${short(prev.ethUsd)}→$${short(next.ethUsd)}, USDC $${short(prev.usdcUsd)}→$${short(next.usdcUsd)}`,
    };
  }

  return null;
}

export function getCopySnapshot(agentId: string): CopyWalletSnapshot | undefined {
  return lastSnapshots.get(agentId);
}

export function setCopySnapshot(
  agentId: string,
  snap: CopyWalletSnapshot,
): void {
  lastSnapshots.set(agentId, snap);
}

export function setPendingCopySignal(
  agentId: string,
  signal: CopyTradeSignal,
): void {
  pendingSignals.set(agentId, signal);
}

export function takePendingCopySignal(
  agentId: string,
): CopyTradeSignal | null {
  const signal = pendingSignals.get(agentId) ?? null;
  if (signal) pendingSignals.delete(agentId);
  return signal;
}

export function clearCopyWalletState(agentId: string): void {
  lastSnapshots.delete(agentId);
  pendingSignals.delete(agentId);
}
