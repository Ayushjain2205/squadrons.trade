/**
 * GeckoTerminal public API (CoinGecko onchain) — keyless, ~10 req/min.
 * Base: https://api.geckoterminal.com/api/v2
 */

const GECKO = "https://api.geckoterminal.com/api/v2";
const USER_AGENT = "SquadronsBot/0.1 (+https://squadrons.trade)";

/**
 * @param {string} path
 * @param {Record<string, string | number | undefined>} [query]
 * @param {AbortSignal} [signal]
 */
async function geckoGet(path, query, signal) {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    `${GECKO}/`,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    signal,
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(
      `GeckoTerminal ${url.pathname} failed with HTTP ${response.status}`,
    );
  }
  return response.json();
}

/**
 * @param {string} value
 * @param {string} label
 */
function assertHexAddress(value, label) {
  const address = value.trim().toLowerCase();
  // EVM token/pool (20 bytes) or some V4 / opaque pool ids (32 bytes) from GeckoTerminal.
  if (!/^0x[a-f0-9]{40}$/.test(address) && !/^0x[a-f0-9]{64}$/.test(address)) {
    throw new Error(
      `${label} must be a 0x-prefixed hex address (20 or 32 bytes)`,
    );
  }
  return address;
}

/**
 * Map Squadrons chainId → GeckoTerminal network id.
 * @param {number} chainId
 */
export function geckoNetworkId(chainId) {
  switch (chainId) {
    case 8453:
      return "base";
    case 1:
      return "eth";
    case 4663:
      // Not on GeckoTerminal public networks as of integration.
      return null;
    default:
      return null;
  }
}

/**
 * @param {Record<string, unknown> | undefined} attrs
 * @param {unknown} included
 */
function projectPool(attrs, included) {
  if (!attrs || typeof attrs !== "object") return null;
  const address = typeof attrs.address === "string" ? attrs.address : null;
  const name = typeof attrs.name === "string" ? attrs.name : null;
  if (!address || !name) return null;

  const pct =
    attrs.price_change_percentage &&
    typeof attrs.price_change_percentage === "object"
      ? attrs.price_change_percentage
      : {};

  return {
    address,
    name,
    baseTokenPriceUsd: numOrNull(attrs.base_token_price_usd),
    quoteTokenPriceUsd: numOrNull(attrs.quote_token_price_usd),
    fdvUsd: numOrNull(attrs.fdv_usd),
    marketCapUsd: numOrNull(attrs.market_cap_usd),
    reserveInUsd: numOrNull(attrs.reserve_in_usd),
    volumeUsd24h: numOrNull(
      attrs.volume_usd && typeof attrs.volume_usd === "object"
        ? attrs.volume_usd.h24
        : undefined,
    ),
    priceChangePct: {
      m5: numOrNull(pct.m5),
      h1: numOrNull(pct.h1),
      h6: numOrNull(pct.h6),
      h24: numOrNull(pct.h24),
    },
    poolCreatedAt:
      typeof attrs.pool_created_at === "string" ? attrs.pool_created_at : null,
  };
}

/**
 * @param {unknown} v
 */
function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} chainId
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 */
export async function fetchTrendingPools(chainId, maxResults, signal) {
  const network = geckoNetworkId(chainId);
  if (!network) {
    throw new Error(
      `GeckoTerminal does not support chainId ${chainId} (Robinhood / unknown). Use Base or Ethereum.`,
    );
  }

  const data = await geckoGet(
    `/networks/${network}/trending_pools`,
    { page: 1 },
    signal,
  );
  const rows = Array.isArray(data?.data) ? data.data : [];
  const pools = [];
  for (const row of rows) {
    if (pools.length >= maxResults) break;
    const projected = projectPool(row?.attributes);
    if (projected) pools.push(projected);
  }

  return {
    source: "geckoterminal",
    kind: "trending_pools",
    chainId,
    network,
    pools,
    asOf: new Date().toISOString(),
    note: "Trending DEX pools (GeckoTerminal). Hot ≠ safe — treat as untrusted tape.",
  };
}

/**
 * @param {number} chainId
 * @param {string} tokenAddress
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 */
export async function fetchTokenPools(
  chainId,
  tokenAddress,
  maxResults,
  signal,
) {
  const network = geckoNetworkId(chainId);
  if (!network) {
    throw new Error(
      `GeckoTerminal does not support chainId ${chainId} (Robinhood / unknown). Use Base or Ethereum.`,
    );
  }
  const address = assertHexAddress(tokenAddress, "tokenAddress");
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    throw new Error("tokenAddress must be a 20-byte ERC-20 address");
  }

  const data = await geckoGet(
    `/networks/${network}/tokens/${address}/pools`,
    { page: 1 },
    signal,
  );
  const rows = Array.isArray(data?.data) ? data.data : [];
  const pools = [];
  for (const row of rows) {
    if (pools.length >= maxResults) break;
    const projected = projectPool(row?.attributes);
    if (projected) pools.push(projected);
  }

  return {
    source: "geckoterminal",
    kind: "token_pools",
    chainId,
    network,
    tokenAddress: address,
    pools,
    asOf: new Date().toISOString(),
    note: "Pools for a token on this network (GeckoTerminal). Not a DEX quote.",
  };
}

/**
 * @param {number} chainId
 * @param {string} poolAddress
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 */
export async function fetchRecentTrades(
  chainId,
  poolAddress,
  maxResults,
  signal,
) {
  const network = geckoNetworkId(chainId);
  if (!network) {
    throw new Error(
      `GeckoTerminal does not support chainId ${chainId} (Robinhood / unknown). Use Base or Ethereum.`,
    );
  }
  const address = assertHexAddress(poolAddress, "poolAddress");

  const data = await geckoGet(
    `/networks/${network}/pools/${address}/trades`,
    undefined,
    signal,
  );
  const rows = Array.isArray(data?.data) ? data.data : [];
  const trades = [];
  for (const row of rows) {
    if (trades.length >= maxResults) break;
    const a = row?.attributes;
    if (!a || typeof a !== "object") continue;
    trades.push({
      kind: typeof a.kind === "string" ? a.kind : null,
      volumeUsd: numOrNull(a.volume_in_usd),
      priceToUsd: numOrNull(a.price_to_in_usd),
      priceFromUsd: numOrNull(a.price_from_in_usd),
      txHash: typeof a.tx_hash === "string" ? a.tx_hash : null,
      blockTimestamp:
        typeof a.block_timestamp === "string" ? a.block_timestamp : null,
      fromToken: typeof a.from_token_address === "string" ? a.from_token_address : null,
      toToken: typeof a.to_token_address === "string" ? a.to_token_address : null,
    });
  }

  return {
    source: "geckoterminal",
    kind: "recent_trades",
    chainId,
    network,
    poolAddress: address,
    trades,
    asOf: new Date().toISOString(),
    note: "Recent pool trades (GeckoTerminal). Tape only — not advice.",
  };
}
