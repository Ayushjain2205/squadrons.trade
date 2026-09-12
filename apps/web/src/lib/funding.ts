import {
  DEFAULT_POLICY,
  getSupportedChain,
  type SupportedChainId,
} from "@squadrons/shared";

/**
 * Destinations Privy can settle into for Squadrons today.
 * Grow this map as onramps / crypto-deposit routes add chains.
 * Source assets & payment methods stay in Privy’s modal.
 */
type FundingChain = {
  chainId: SupportedChainId;
  caip2: `${string}:${string}`;
  shortName: string;
  /** Quote stable used as the default landing asset. */
  usdc: `0x${string}`;
};

const FUNDING_CHAINS: readonly FundingChain[] = [
  {
    chainId: 8453,
    caip2: "eip155:8453",
    shortName: "Base",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  {
    chainId: 1,
    caip2: "eip155:1",
    shortName: "Ethereum",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
  {
    chainId: 42161,
    caip2: "eip155:42161",
    shortName: "Arbitrum",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },
  {
    chainId: 10,
    caip2: "eip155:10",
    shortName: "Optimism",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  },
] as const;

export type FundingDestination = {
  chainId: SupportedChainId;
  caip2: `${string}:${string}`;
  asset: `0x${string}`;
  symbol: string;
  label: string;
  /** True when we fell back because the agent chain isn’t fundable yet. */
  fellBack: boolean;
};

function getFundingChain(chainId: number): FundingChain | undefined {
  return FUNDING_CHAINS.find((c) => c.chainId === chainId);
}

/** Agent home chain when Privy can settle there; else product default (Base). */
export function resolveFundingDestination(
  preferredChainId?: number | null,
): FundingDestination {
  const match =
    preferredChainId != null ? getFundingChain(preferredChainId) : undefined;
  const chain =
    match ??
    getFundingChain(DEFAULT_POLICY.defaultChainId) ??
    FUNDING_CHAINS[0]!;

  return {
    chainId: chain.chainId,
    caip2: chain.caip2,
    asset: chain.usdc,
    symbol: "USDC",
    label: `USDC on ${chain.shortName}`,
    fellBack: match == null && preferredChainId != null,
  };
}

export function fundingFallbackNote(
  preferredChainId?: number | null,
): string | null {
  const dest = resolveFundingDestination(preferredChainId);
  if (!dest.fellBack || preferredChainId == null) return null;
  const name = getSupportedChain(preferredChainId)?.shortName ?? "This chain";
  return `${name} isn’t on Privy’s settle rails yet — opening funding for ${dest.label}.`;
}
