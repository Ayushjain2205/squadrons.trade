/**
 * DefiLlama free clients (no API key).
 * TVL/DEX: https://api.llama.fi
 * Stables: https://stablecoins.llama.fi
 */

const LLAMA = "https://api.llama.fi";
const STABLES = "https://stablecoins.llama.fi";
const USER_AGENT = "SquadronsBot/0.1 (+https://squadrons.trade)";

/**
 * @param {string} base
 * @param {string} path
 * @param {Record<string, string | number | boolean | undefined>} [query]
 * @param {AbortSignal} [signal]
 */
async function llamaGet(base, path, query, signal) {
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
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
      `DefiLlama ${url.pathname} failed with HTTP ${response.status}`,
    );
  }
  return response.json();
}

/**
 * Map Squadrons chainId → DefiLlama chain slug.
 * @param {number} chainId
 */
export function llamaChainSlug(chainId) {
  switch (chainId) {
    case 8453:
      return "Base";
    case 1:
      return "Ethereum";
    case 4663:
      return "Robinhood Chain";
    default:
      return null;
  }
}

/**
 * @param {number} chainId
 * @param {AbortSignal} [signal]
 */
export async function fetchStablecoinMarket(chainId, signal) {
  const slug = llamaChainSlug(chainId);
  if (!slug) {
    throw new Error(`No DefiLlama stablecoin mapping for chainId ${chainId}`);
  }

  const chains = await llamaGet(STABLES, "/stablecoinchains", undefined, signal);
  if (!Array.isArray(chains)) {
    throw new Error("DefiLlama stablecoinchains returned unexpected shape");
  }

  const row = chains.find(
    (c) =>
      typeof c?.name === "string" &&
      c.name.toLowerCase() === slug.toLowerCase(),
  );

  const circulatingUsd =
    typeof row?.totalCirculatingUSD?.peggedUSD === "number"
      ? row.totalCirculatingUSD.peggedUSD
      : typeof row?.totalCirculatingUSD === "number"
        ? row.totalCirculatingUSD
        : null;

  /** @type {Array<{ date: number, totalCirculatingUSD?: number }>} */
  let chart = [];
  try {
    const raw = await llamaGet(
      STABLES,
      `/stablecoincharts/${encodeURIComponent(slug)}`,
      undefined,
      signal,
    );
    if (Array.isArray(raw)) {
      chart = raw.slice(-14).map((p) => ({
        date: Number(p.date),
        totalCirculatingUSD:
          typeof p.totalCirculatingUSD?.peggedUSD === "number"
            ? p.totalCirculatingUSD.peggedUSD
            : typeof p.totalCirculatingUSD === "number"
              ? p.totalCirculatingUSD
              : undefined,
      }));
    }
  } catch {
    // Chart is optional context.
  }

  return {
    source: "defillama",
    kind: "stablecoin_market",
    chainId,
    chain: slug,
    circulatingUsd,
    recentChart: chart,
    asOf: new Date().toISOString(),
    note: "Aggregate stablecoin circulating USD on this chain (DefiLlama). Not a trade quote.",
  };
}

/**
 * @param {number} chainId
 * @param {number} [topN]
 * @param {AbortSignal} [signal]
 */
export async function fetchDexVolumes(chainId, topN = 8, signal) {
  const slug = llamaChainSlug(chainId);
  if (!slug) {
    throw new Error(`No DefiLlama DEX volume mapping for chainId ${chainId}`);
  }

  const data = await llamaGet(
    LLAMA,
    `/overview/dexs/${encodeURIComponent(slug)}`,
    {
      excludeTotalDataChart: true,
      excludeTotalDataChartBreakdown: true,
    },
    signal,
  );

  const protocols = Array.isArray(data?.protocols) ? data.protocols : [];
  const sorted = [...protocols].sort(
    (a, b) => (Number(b.total24h) || 0) - (Number(a.total24h) || 0),
  );

  const top = sorted.slice(0, topN).map((p) => ({
    name: String(p.displayName || p.name || p.slug || "unknown"),
    slug: typeof p.slug === "string" ? p.slug : undefined,
    total24h: typeof p.total24h === "number" ? p.total24h : null,
    total7d: typeof p.total7d === "number" ? p.total7d : null,
    change_1d: typeof p.change_1d === "number" ? p.change_1d : null,
  }));

  const total24h = top.reduce(
    (sum, p) => sum + (typeof p.total24h === "number" ? p.total24h : 0),
    0,
  );

  return {
    source: "defillama",
    kind: "dex_volumes",
    chainId,
    chain: slug,
    total24hTop: total24h,
    protocols: top,
    asOf: new Date().toISOString(),
    note: "DEX volume summaries from DefiLlama (not executable liquidity / not a quote).",
  };
}
