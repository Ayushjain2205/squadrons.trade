/**
 * 0x AllowanceHolder quote client for observe-mode get_dex_quote.
 * Mirrors apps/host/src/strategy/swap-build.ts (keep behavior in sync).
 * Chain-generic for any home chain in DEX_QUOTE_CHAIN_IDS (stable↔ETH/WETH).
 * Returns projected quote fields only — never agent-facing calldata.
 */

import { formatUnits } from "viem";
import {
  CHAIN_TOOL_CONFIGS,
  resolveQuoteStable,
  supportsDexQuote,
} from "./chains.js";

const ZEROEX_NATIVE =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_TRADE_USD = 10;
const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * @param {string | null | undefined} value
 * @returns {value is `0x${string}`}
 */
function isAddr(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * @param {number} chainId
 * @param {string} symbol
 * @param {{ address: string, symbol: string, decimals: number }} stable
 */
function resolveAsset(chainId, symbol, stable) {
  const config = CHAIN_TOOL_CONFIGS[chainId];
  if (!config) return null;
  const upper = symbol.trim().toUpperCase();
  if (upper === "ETH" || upper === "NATIVE") {
    return {
      address: ZEROEX_NATIVE,
      symbol: "ETH",
      decimals: 18,
    };
  }
  if (upper === stable.symbol.toUpperCase()) {
    return null; // caller rejects stable↔stable
  }
  if (config.tokens[upper]) {
    return { ...config.tokens[upper] };
  }
  return null;
}

/**
 * @param {number} amountUsd
 * @param {number} decimals
 */
function stableUnits(amountUsd, decimals) {
  const scale = 10 ** decimals;
  const units = Math.round(amountUsd * scale);
  if (!(units > 0)) throw new Error("Stable amount rounds to zero");
  return String(units);
}

/**
 * @param {number} chainId
 * @param {string} address
 * @param {{ address: string, symbol: string, decimals: number }} asset
 * @param {{ address: string, symbol: string, decimals: number }} stable
 */
function metaForAddress(chainId, address, asset, stable) {
  const lower = address.toLowerCase();
  if (lower === ZEROEX_NATIVE.toLowerCase()) {
    return { symbol: "ETH", decimals: 18 };
  }
  if (lower === stable.address.toLowerCase()) {
    return { symbol: stable.symbol, decimals: stable.decimals };
  }
  const weth = CHAIN_TOOL_CONFIGS[chainId]?.tokens.WETH;
  if (weth && lower === weth.address.toLowerCase()) {
    return { symbol: "WETH", decimals: weth.decimals };
  }
  if (lower === asset.address.toLowerCase()) {
    return { symbol: asset.symbol, decimals: asset.decimals };
  }
  return { symbol: "TOKEN", decimals: 18 };
}

/**
 * Quotable asset symbols for a chain (excludes the quote stable).
 * @param {number} chainId
 */
export function quotableAssetSymbols(chainId) {
  const config = CHAIN_TOOL_CONFIGS[chainId];
  const stable = resolveQuoteStable(chainId);
  if (!config || !stable) return ["ETH"];
  const out = ["ETH"];
  for (const sym of Object.keys(config.tokens)) {
    if (sym !== stable.symbol) out.push(sym);
  }
  return out;
}

/**
 * @param {{
 *   chainId: number,
 *   walletAddress: string,
 *   side: "buy" | "sell",
 *   symbol: string,
 *   amountUsd: number,
 *   slippageBps?: number,
 * }} plan
 * @param {AbortSignal} [signal]
 */
export async function fetchDexQuote(plan, signal) {
  const apiKey = process.env.ZEROEX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ZEROEX_API_KEY is not set. Add it to apps/host/.env to enable get_dex_quote.",
    );
  }

  const config = CHAIN_TOOL_CONFIGS[plan.chainId];
  if (!config || !supportsDexQuote(plan.chainId)) {
    throw new Error(
      `get_dex_quote is not enabled for chainId ${plan.chainId}. Supported: Base, Ethereum.`,
    );
  }

  const stable = resolveQuoteStable(plan.chainId);
  if (!stable) {
    throw new Error(
      `No quote stable (USDC/USDG) configured for ${config.shortName}`,
    );
  }

  if (!isAddr(plan.walletAddress)) {
    throw new Error(
      "Valid wallet address required (sign in, or pass address) for a 0x taker quote",
    );
  }

  if (plan.side !== "buy" && plan.side !== "sell") {
    throw new Error("side must be buy or sell");
  }

  if (
    typeof plan.amountUsd !== "number" ||
    !Number.isFinite(plan.amountUsd) ||
    plan.amountUsd <= 0
  ) {
    throw new Error("amountUsd must be a positive number");
  }
  if (plan.amountUsd > MAX_TRADE_USD) {
    throw new Error(
      `amountUsd exceeds desk maxTradeUsd (${MAX_TRADE_USD}). Pass a smaller size.`,
    );
  }

  const slippageBps =
    plan.slippageBps === undefined || plan.slippageBps === null
      ? DEFAULT_SLIPPAGE_BPS
      : Number(plan.slippageBps);
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500
  ) {
    throw new Error("slippageBps must be an integer from 1 to 500");
  }

  const asset = resolveAsset(plan.chainId, plan.symbol, stable);
  if (!asset) {
    const known = quotableAssetSymbols(plan.chainId).join(", ");
    throw new Error(
      `Unsupported symbol ${plan.symbol} on ${config.shortName}. Known: ${known}`,
    );
  }
  if (asset.symbol.toUpperCase() === stable.symbol.toUpperCase()) {
    throw new Error(
      `Cannot quote ${stable.symbol} ↔ ${stable.symbol}; pass ETH or WETH as symbol`,
    );
  }

  const notionalUnits = stableUnits(plan.amountUsd, stable.decimals);
  const params = new URLSearchParams({
    chainId: String(plan.chainId),
    taker: plan.walletAddress,
    slippageBps: String(slippageBps),
  });

  if (plan.side === "buy") {
    params.set("sellToken", stable.address);
    params.set("buyToken", asset.address);
    params.set("sellAmount", notionalUnits);
  } else {
    params.set("sellToken", asset.address);
    params.set("buyToken", stable.address);
    params.set("buyAmount", notionalUnits);
  }

  const url = `https://api.0x.org/swap/allowance-holder/quote?${params}`;
  const response = await fetch(url, {
    headers: {
      "0x-api-key": apiKey,
      "0x-version": "v2",
      Accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (get_dex_quote; observe)",
    },
    signal,
  });

  const payload = /** @type {Record<string, unknown> | null} */ (
    await response.json().catch(() => null)
  );

  if (!response.ok) {
    const message =
      (payload &&
        (typeof payload.message === "string"
          ? payload.message
          : typeof payload.reason === "string"
            ? payload.reason
            : null)) ||
      `HTTP ${response.status}`;
    throw new Error(`0x quote failed: ${message}`);
  }

  if (!payload || payload.liquidityAvailable === false) {
    throw new Error("0x quote: no liquidity for this route");
  }

  const sellAmount =
    typeof payload.sellAmount === "string" ? payload.sellAmount : null;
  const buyAmount =
    typeof payload.buyAmount === "string" ? payload.buyAmount : null;
  const minBuyAmount =
    typeof payload.minBuyAmount === "string" ? payload.minBuyAmount : null;

  const sellTokenAddr = String(payload.sellToken ?? "");
  const buyTokenAddr = String(payload.buyToken ?? "");

  const sellMeta = metaForAddress(
    plan.chainId,
    sellTokenAddr,
    asset,
    stable,
  );
  const buyMeta = metaForAddress(plan.chainId, buyTokenAddr, asset, stable);

  const sellFormatted =
    sellAmount != null
      ? formatUnits(BigInt(sellAmount), sellMeta.decimals)
      : null;
  const buyFormatted =
    buyAmount != null
      ? formatUnits(BigInt(buyAmount), buyMeta.decimals)
      : null;
  const minBuyFormatted =
    minBuyAmount != null
      ? formatUnits(BigInt(minBuyAmount), buyMeta.decimals)
      : null;

  const issues = payload.issues;
  const allowanceIssue =
    issues &&
    typeof issues === "object" &&
    issues !== null &&
    "allowance" in issues
      ? /** @type {{ allowance?: { spender?: string } | null }} */ (issues)
          .allowance
      : null;

  const allowanceTarget =
    (typeof payload.allowanceTarget === "string"
      ? payload.allowanceTarget
      : null) ??
    (typeof allowanceIssue?.spender === "string"
      ? allowanceIssue.spender
      : null);

  const tx = payload.transaction;
  const gas =
    tx && typeof tx === "object" && typeof tx.gas === "string" ? tx.gas : null;

  return {
    source: "0x",
    kind: "dex_quote",
    chainId: plan.chainId,
    chain: config.name,
    quoteStable: stable.symbol,
    side: plan.side,
    symbol: asset.symbol,
    amountUsd: plan.amountUsd,
    slippageBps,
    taker: plan.walletAddress,
    sell: {
      token: sellMeta.symbol,
      address: sellTokenAddr || null,
      amount: sellFormatted,
      raw: sellAmount,
    },
    buy: {
      token: buyMeta.symbol,
      address: buyTokenAddr || null,
      amount: buyFormatted,
      raw: buyAmount,
      minAmount: minBuyFormatted,
      minRaw: minBuyAmount,
    },
    allowanceTarget,
    needsAllowance: Boolean(allowanceIssue),
    gasEstimate: gas,
    zid: typeof payload.zid === "string" ? payload.zid : null,
    asOf: new Date().toISOString(),
    note: `Indicative 0x AllowanceHolder quote on ${config.shortName} (${stable.symbol} notional). Observe-only — does not execute. Confirm spend mode + desk gates before any trade.`,
  };
}

export function isZeroExConfigured() {
  return Boolean(process.env.ZEROEX_API_KEY?.trim());
}

export { MAX_TRADE_USD, DEFAULT_SLIPPAGE_BPS };
