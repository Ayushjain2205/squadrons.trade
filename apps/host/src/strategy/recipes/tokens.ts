/** Known ERC-20s for deterministic balance recipes (mirrors squadrons-defi).
 * When adding a chain for quotes, update this map and follow
 * packages/squadrons-defi/README.md
 */

export type KnownToken = {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
};

const TOKENS: Record<number, Record<string, KnownToken>> = {
  1: {
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      symbol: "USDC",
    },
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      symbol: "WETH",
    },
  },
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      symbol: "USDC",
    },
    WETH: {
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      symbol: "WETH",
    },
  },
  4663: {
    USDG: {
      address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      decimals: 6,
      symbol: "USDG",
    },
    WETH: {
      address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
      decimals: 18,
      symbol: "WETH",
    },
  },
};

export function resolveKnownToken(
  chainId: number,
  asset: string,
): KnownToken | null {
  const symbol = asset.trim().toUpperCase();
  if (symbol === "NATIVE" || symbol === "ETH") return null;
  return TOKENS[chainId]?.[symbol] ?? null;
}

export function isNativeAsset(asset: string): boolean {
  const symbol = asset.trim().toUpperCase();
  return symbol === "NATIVE" || symbol === "ETH";
}
