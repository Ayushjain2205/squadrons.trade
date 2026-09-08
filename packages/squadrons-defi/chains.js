import { defineChain } from "viem";
import { base, mainnet } from "viem/chains";

/** @typedef {{ address: `0x${string}`, decimals: number, symbol: string }} Erc20Token */

/**
 * @typedef {{
 *   chainId: number,
 *   name: string,
 *   shortName: string,
 *   viemChain: import('viem').Chain,
 *   rpcEnvKeys: string[],
 *   defaultRpcUrl: string,
 *   nativeSymbol: string,
 *   tokens: Record<string, Erc20Token>,
 * }} ChainToolConfig
 */

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

/** @type {Record<number, ChainToolConfig>} */
export const CHAIN_TOOL_CONFIGS = {
  8453: {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    viemChain: base,
    rpcEnvKeys: ["BASE_RPC_URL", "SQUADRONS_BASE_RPC_URL"],
    defaultRpcUrl: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    tokens: {
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
  },
  1: {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    viemChain: mainnet,
    rpcEnvKeys: ["ETHEREUM_RPC_URL", "ETH_RPC_URL", "SQUADRONS_ETH_RPC_URL"],
    defaultRpcUrl: "https://ethereum.publicnode.com",
    nativeSymbol: "ETH",
    tokens: {
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
  },
  4663: {
    chainId: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood",
    viemChain: robinhood,
    rpcEnvKeys: ["ROBINHOOD_RPC_URL", "SQUADRONS_ROBINHOOD_RPC_URL"],
    defaultRpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    nativeSymbol: "ETH",
    tokens: {
      // No canonical USDC on Robinhood — USDG / USDe are the stable anchors.
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
  },
};

/**
 * Agent home chain for this dsh process. Host sets SQUADRONS_AGENT_CHAIN_ID
 * per turn. Smoke / unset defaults to Base.
 * @returns {ChainToolConfig}
 */
export function resolveAgentChainConfig() {
  const raw = process.env.SQUADRONS_AGENT_CHAIN_ID;
  const chainId =
    raw === undefined || raw === ""
      ? 8453
      : Number(raw);

  if (!Number.isFinite(chainId) || !CHAIN_TOOL_CONFIGS[chainId]) {
    throw new Error(
      `Unsupported or missing agent chainId for tools: ${raw ?? "(unset)"}`,
    );
  }

  return CHAIN_TOOL_CONFIGS[chainId];
}

/**
 * @param {ChainToolConfig} config
 */
export function resolveRpcUrl(config) {
  for (const key of config.rpcEnvKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return config.defaultRpcUrl;
}

/**
 * Default token symbols shown in tool docs for a chain.
 * @param {ChainToolConfig} config
 */
export function defaultTokenSymbols(config) {
  return [config.nativeSymbol, ...Object.keys(config.tokens)];
}
