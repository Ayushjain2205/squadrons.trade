import { DEFAULT_POLICY } from "@squadrons/shared";
import { resolveKnownToken } from "./recipes/tokens.js";

/** 0x native ETH sentinel (not WETH). */
export const ZEROEX_NATIVE_TOKEN =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export type TradePlan = {
  chainId: number;
  walletAddress: string | null;
  amountUsd: number;
  symbol: string | null;
  side: "buy" | "sell" | null;
  maxSlippageBps: number;
};

export type BuiltSwapTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  gas?: string;
  gasPrice?: string;
};

export type BuiltSwap = {
  provider: "0x";
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string | null;
  buyAmount: string | null;
  minBuyAmount: string | null;
  allowanceTarget: string | null;
  needsAllowance: boolean;
  transaction: BuiltSwapTx;
  zid: string | null;
};

export type BuildSwapResult =
  | { ok: true; swap: BuiltSwap }
  | { ok: false; reason: string };

function getZeroExApiKey(): string | null {
  return process.env.ZEROEX_API_KEY?.trim() || null;
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function usdcAmountUnits(amountUsd: number): string {
  // Base / Ethereum USDC are 6 decimals. Cap already enforced upstream.
  const units = Math.round(amountUsd * 1e6);
  if (!(units > 0)) throw new Error("USDC amount rounds to zero");
  return String(units);
}

function resolveAssetToken(
  chainId: number,
  symbol: string | null,
): { address: string; symbol: string } | null {
  if (!symbol) return null;
  const upper = symbol.trim().toUpperCase();
  if (upper === "ETH" || upper === "NATIVE") {
    return { address: ZEROEX_NATIVE_TOKEN, symbol: "ETH" };
  }
  const known = resolveKnownToken(chainId, upper);
  if (!known) return null;
  return { address: known.address, symbol: known.symbol };
}

function resolveUsdc(chainId: number): { address: string; symbol: string } | null {
  const known = resolveKnownToken(chainId, "USDC");
  if (!known) return null;
  return { address: known.address, symbol: known.symbol };
}

/**
 * Map a capped USD trade plan to a 0x AllowanceHolder quote on Base.
 * buy  → sell USDC for asset (exact-in USDC)
 * sell → sell asset for USDC (exact-out USDC)
 */
export async function buildSwapFromPlan(
  plan: TradePlan,
): Promise<BuildSwapResult> {
  const apiKey = getZeroExApiKey();
  if (!apiKey) {
    return { ok: false, reason: "ZEROEX_API_KEY is not set" };
  }

  if (plan.chainId !== DEFAULT_POLICY.defaultChainId) {
    return {
      ok: false,
      reason: `Swap builder only supports Base (${DEFAULT_POLICY.defaultChainId})`,
    };
  }

  if (!isAddress(plan.walletAddress)) {
    return { ok: false, reason: "Valid wallet address required for swap quote" };
  }

  if (!plan.side || (plan.side !== "buy" && plan.side !== "sell")) {
    return { ok: false, reason: "Trade plan needs side buy|sell" };
  }

  const asset = resolveAssetToken(plan.chainId, plan.symbol);
  const usdc = resolveUsdc(plan.chainId);
  if (!asset) {
    return {
      ok: false,
      reason: plan.symbol
        ? `Unsupported swap symbol ${plan.symbol} on chain ${plan.chainId}`
        : "Trade plan needs a symbol",
    };
  }
  if (!usdc) {
    return { ok: false, reason: `No USDC mapping on chain ${plan.chainId}` };
  }

  if (asset.address.toLowerCase() === usdc.address.toLowerCase()) {
    return { ok: false, reason: "Cannot swap USDC for USDC" };
  }

  const usdcUnits = usdcAmountUnits(plan.amountUsd);
  const params = new URLSearchParams({
    chainId: String(plan.chainId),
    taker: plan.walletAddress,
    slippageBps: String(plan.maxSlippageBps),
  });

  if (plan.side === "buy") {
    params.set("sellToken", usdc.address);
    params.set("buyToken", asset.address);
    params.set("sellAmount", usdcUnits);
  } else {
    params.set("sellToken", asset.address);
    params.set("buyToken", usdc.address);
    params.set("buyAmount", usdcUnits);
  }

  const url = `https://api.0x.org/swap/allowance-holder/quote?${params}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
        Accept: "application/json",
      },
    });
  } catch (error) {
    return {
      ok: false,
      reason: `0x quote network error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        (typeof payload.message === "string"
          ? payload.message
          : typeof payload.reason === "string"
            ? payload.reason
            : null)) ||
      `HTTP ${response.status}`;
    return { ok: false, reason: `0x quote failed: ${message}` };
  }

  if (!payload || payload.liquidityAvailable === false) {
    return { ok: false, reason: "0x quote: no liquidity" };
  }

  const tx = payload.transaction as
    | {
        to?: string;
        data?: string;
        value?: string;
        gas?: string;
        gasPrice?: string;
      }
    | undefined;

  if (!isAddress(tx?.to) || typeof tx?.data !== "string" || !tx.data.startsWith("0x")) {
    return { ok: false, reason: "0x quote missing transaction calldata" };
  }

  const issues = payload.issues as
    | { allowance?: { spender?: string } | null }
    | undefined;
  const allowanceTarget =
    (typeof payload.allowanceTarget === "string"
      ? payload.allowanceTarget
      : null) ??
    (typeof issues?.allowance?.spender === "string"
      ? issues.allowance.spender
      : null);

  const swap: BuiltSwap = {
    provider: "0x",
    chainId: plan.chainId,
    sellToken: String(payload.sellToken ?? ""),
    buyToken: String(payload.buyToken ?? ""),
    sellAmount:
      typeof payload.sellAmount === "string" ? payload.sellAmount : null,
    buyAmount: typeof payload.buyAmount === "string" ? payload.buyAmount : null,
    minBuyAmount:
      typeof payload.minBuyAmount === "string" ? payload.minBuyAmount : null,
    allowanceTarget,
    needsAllowance: Boolean(issues?.allowance),
    transaction: {
      to: tx.to,
      data: tx.data as `0x${string}`,
      value: (typeof tx.value === "string" && tx.value.startsWith("0x")
        ? tx.value
        : "0x0") as `0x${string}`,
      ...(typeof tx.gas === "string" ? { gas: tx.gas } : {}),
      ...(typeof tx.gasPrice === "string" ? { gasPrice: tx.gasPrice } : {}),
    },
    zid: typeof payload.zid === "string" ? payload.zid : null,
  };

  return { ok: true, swap };
}

export function isZeroExConfigured(): boolean {
  return Boolean(getZeroExApiKey());
}
