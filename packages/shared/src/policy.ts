/** v1 demo policy defaults (PRD §7). */
export const DEFAULT_POLICY = {
  maxTradeUsd: 10,
  maxSlippageBps: 50,
  defaultChainId: 8453,
} as const;

/** Base is the first supported chain for demos. */
export const SUPPORTED_CHAINS = [
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
  },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["chainId"];

export function isSupportedChainId(value: number): value is SupportedChainId {
  return SUPPORTED_CHAINS.some((chain) => chain.chainId === value);
}
