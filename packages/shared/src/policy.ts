/** v1 demo policy defaults (PRD §7). */
export const DEFAULT_POLICY = {
  maxTradeUsd: 10,
  maxSlippageBps: 50,
  defaultChainId: 8453,
} as const;

/** Supported home chains for agent create. */
export const SUPPORTED_CHAINS = [
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    /** Vendored CoinGecko asset-platform icon — see apps/web/public/chains/README.md */
    logoUrl: "/chains/base.png",
  },
  {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    logoUrl: "/chains/ethereum.png",
  },
  {
    chainId: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood",
    logoUrl: "/chains/robinhood.png",
  },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["chainId"];

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export function isSupportedChainId(value: number): value is SupportedChainId {
  return SUPPORTED_CHAINS.some((chain) => chain.chainId === value);
}

export function getSupportedChain(
  chainId: number,
): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.chainId === chainId);
}

export function chainLabel(chainId: number): string {
  return getSupportedChain(chainId)?.shortName ?? `Chain ${chainId}`;
}

/** Observe-mode on-chain / market read tools available per home chain. */
export const CHAIN_SCOPED_READ_TOOLS = [
  "get_wallet_balances",
  "get_spot_prices",
] as const;

export type ChainScopedReadTool = (typeof CHAIN_SCOPED_READ_TOOLS)[number];

export function chainScopedReadTools(
  _chainId: SupportedChainId,
): readonly ChainScopedReadTool[] {
  // All supported home chains currently share the same read surface;
  // balance tools still execute against the agent's home chain only.
  return CHAIN_SCOPED_READ_TOOLS;
}
