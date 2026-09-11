import { SUPPORTED_CHAINS } from "@squadrons/shared";
import { resolveRpcUrl } from "../strategy/recipes/rpc.js";

export type ChainNativeBalance = {
  chainId: number;
  shortName: string;
  symbol: string;
  balanceWei: string;
  /** Human-readable ETH-style amount (18 decimals). */
  balance: string;
  /** True when balance is too low for a typical Base approve/swap gas. */
  needsGas: boolean;
};

async function ethGetBalance(
  rpcUrl: string,
  address: string,
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
    throw new Error(`RPC ${response.status}`);
  }
  const payload = (await response.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  if (!payload.result || !/^0x[0-9a-fA-F]+$/.test(payload.result)) {
    throw new Error("Bad eth_getBalance result");
  }
  return BigInt(payload.result);
}

function formatEther(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  const trimmed = fracStr.slice(0, 6).replace(/0+$/, "") || "0";
  return `${whole}.${trimmed}`;
}

/** ~0.0003 ETH — enough for a typical approve on Base; warn below this. */
const MIN_GAS_WEI = 300_000_000_000_000n;

export async function loadNativeBalances(
  address: string,
): Promise<ChainNativeBalance[]> {
  const rows = await Promise.all(
    SUPPORTED_CHAINS.map(async (chain) => {
      try {
        const rpcUrl = resolveRpcUrl(chain.chainId);
        const wei = await ethGetBalance(rpcUrl, address);
        return {
          chainId: chain.chainId,
          shortName: chain.shortName,
          symbol: "ETH",
          balanceWei: wei.toString(),
          balance: formatEther(wei),
          needsGas: wei < MIN_GAS_WEI,
        } satisfies ChainNativeBalance;
      } catch {
        return {
          chainId: chain.chainId,
          shortName: chain.shortName,
          symbol: "ETH",
          balanceWei: "0",
          balance: "—",
          needsGas: true,
        } satisfies ChainNativeBalance;
      }
    }),
  );
  return rows;
}
