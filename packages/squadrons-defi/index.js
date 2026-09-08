import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  isAddress,
} from "viem";
import {
  defaultTokenSymbols,
  resolveAgentChainConfig,
  resolveRpcUrl,
} from "./chains.js";

/** Cordis plugin id / package export name. */
export const name = "squadrons-defi";
export const inject = ["tools"];

function resolveAddress(explicit) {
  const candidate =
    (typeof explicit === "string" && explicit.trim()) ||
    process.env.SQUADRONS_DEMO_WALLET ||
    process.env.DEMO_WALLET ||
    "";
  if (!candidate || !isAddress(candidate)) {
    throw new Error(
      "address is required (pass address, or set SQUADRONS_DEMO_WALLET)",
    );
  }
  return candidate;
}

/**
 * @param {import('./chains.js').ChainToolConfig} config
 * @param {unknown} tokens
 */
function resolveTokenList(config, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [
      { kind: "native", symbol: config.nativeSymbol, decimals: 18 },
      ...Object.values(config.tokens).map((t) => ({ kind: "erc20", ...t })),
    ];
  }

  return tokens.map((raw) => {
    const key = String(raw).trim();
    const upper = key.toUpperCase();
    if (
      upper === "ETH" ||
      upper === "NATIVE" ||
      upper === config.nativeSymbol.toUpperCase()
    ) {
      return { kind: "native", symbol: config.nativeSymbol, decimals: 18 };
    }
    if (config.tokens[upper]) {
      return { kind: "erc20", ...config.tokens[upper] };
    }
    if (isAddress(key)) {
      return {
        kind: "erc20",
        address: key,
        decimals: null,
        symbol: `${key.slice(0, 6)}…${key.slice(-4)}`,
      };
    }
    const known = defaultTokenSymbols(config).join(", ");
    throw new Error(
      `Unknown token on ${config.shortName} (${config.chainId}): ${key}. Known: ${known}, or pass an ERC-20 address.`,
    );
  });
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  const home = resolveAgentChainConfig();
  const symbols = defaultTokenSymbols(home).join(", ");

  ctx.tools.register(
    defineTool({
      name: "get_wallet_balances",
      description: `Read-only: fetch native ${home.nativeSymbol} and known ERC-20 balances on this agent's home chain ${home.name} (chainId ${home.chainId}) only. Defaults to ${symbols} when tokens are omitted. Does not send transactions. Cannot query other chains.`,
      parameters: {
        address: {
          type: "string",
          description:
            "EVM address to query. If omitted, uses SQUADRONS_DEMO_WALLET from the environment.",
        },
        tokens: {
          type: "array",
          description: `Token symbols (${symbols}) or ERC-20 addresses on ${home.shortName}. Defaults to ${symbols}.`,
          items: { type: "string" },
        },
        chainId: {
          type: "number",
          description: `Optional. Must match the agent home chain (${home.chainId}) if provided.`,
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: JSON.stringify(value, null, 2),
          },
        ],
      },
      async execute(args) {
        if (
          args.chainId !== undefined &&
          args.chainId !== null &&
          Number(args.chainId) !== home.chainId
        ) {
          throw new Error(
            `get_wallet_balances is scoped to this agent's home chain ${home.name} (${home.chainId}); requested ${args.chainId}`,
          );
        }

        const address = resolveAddress(args.address);
        const tokenSpecs = resolveTokenList(home, args.tokens);
        const client = createPublicClient({
          chain: home.viemChain,
          transport: http(resolveRpcUrl(home)),
        });

        const balances = [];

        for (const token of tokenSpecs) {
          if (token.kind === "native") {
            const wei = await client.getBalance({ address });
            balances.push({
              chainId: home.chainId,
              symbol: home.nativeSymbol,
              address: null,
              amount: formatEther(wei),
              raw: wei.toString(),
              decimals: 18,
            });
            continue;
          }

          let decimals = token.decimals;
          let symbol = token.symbol;
          if (decimals == null) {
            decimals = await client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "decimals",
            });
          }
          try {
            symbol = await client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "symbol",
            });
          } catch {
            // keep shortened address label
          }

          const raw = await client.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          });

          balances.push({
            chainId: home.chainId,
            symbol: String(symbol),
            address: token.address,
            amount: formatUnits(raw, Number(decimals)),
            raw: raw.toString(),
            decimals: Number(decimals),
          });
        }

        return {
          chainId: home.chainId,
          chain: home.name,
          address,
          balances,
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: `Get wallet balances (${home.shortName})`,
        kind: "other",
        rawInput: args,
      }),
    }),
  );
}
