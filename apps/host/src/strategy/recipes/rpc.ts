import { getSupportedChain } from "@squadrons/shared";

export function resolveRpcUrl(chainId: number): string {
  const chain = getSupportedChain(chainId);
  const envKeys =
    chainId === 1
      ? ["ETHEREUM_RPC_URL", "ETH_RPC_URL", "SQUADRONS_ETH_RPC_URL"]
      : chainId === 8453
        ? ["BASE_RPC_URL", "SQUADRONS_BASE_RPC_URL"]
        : chainId === 4663
          ? ["ROBINHOOD_RPC_URL", "SQUADRONS_ROBINHOOD_RPC_URL"]
          : [];
  for (const key of envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  if (chainId === 1) return "https://ethereum.publicnode.com";
  if (chainId === 8453) return "https://mainnet.base.org";
  if (chainId === 4663) return "https://rpc.mainnet.chain.robinhood.com";
  throw new Error(
    `No RPC for chain ${chain?.name ?? chainId}. Set an RPC env var.`,
  );
}
