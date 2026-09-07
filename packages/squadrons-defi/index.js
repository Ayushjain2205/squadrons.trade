import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  createPublicClient,
  erc20Abi,
  formatEther,
  formatUnits,
  http,
  isAddress,
} from "viem";
import { base } from "viem/chains";

/** Cordis plugin id / package export name. */
export const name = "squadrons-defi";
export const inject = ["tools"];

const BASE_TOKENS = {
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
};

function resolveRpcUrl() {
  return (
    process.env.BASE_RPC_URL ||
    process.env.SQUADRONS_BASE_RPC_URL ||
    "https://mainnet.base.org"
  );
}

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

function resolveTokenList(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [
      { kind: "native", symbol: "ETH", decimals: 18 },
      ...Object.values(BASE_TOKENS).map((t) => ({ kind: "erc20", ...t })),
    ];
  }

  return tokens.map((raw) => {
    const key = String(raw).trim();
    const upper = key.toUpperCase();
    if (upper === "ETH" || upper === "NATIVE") {
      return { kind: "native", symbol: "ETH", decimals: 18 };
    }
    if (BASE_TOKENS[upper]) {
      return { kind: "erc20", ...BASE_TOKENS[upper] };
    }
    if (isAddress(key)) {
      return {
        kind: "erc20",
        address: key,
        decimals: null,
        symbol: `${key.slice(0, 6)}…${key.slice(-4)}`,
      };
    }
    throw new Error(`Unknown token: ${key}`);
  });
}

function createClient() {
  return createPublicClient({
    chain: base,
    transport: http(resolveRpcUrl()),
  });
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "get_wallet_balances",
      description:
        "Read-only: fetch native ETH and ERC-20 balances on Base (chainId 8453) for a wallet. Defaults to ETH + USDC + WETH when tokens are omitted. Does not send transactions.",
      parameters: {
        address: {
          type: "string",
          required: false,
          description:
            "EVM address to query. If omitted, uses SQUADRONS_DEMO_WALLET from the environment.",
        },
        tokens: {
          type: "array",
          required: false,
          description:
            "Token symbols (ETH, USDC, WETH) or ERC-20 addresses. Defaults to ETH + USDC + WETH.",
          items: { type: "string" },
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
        const address = resolveAddress(args.address);
        const tokenSpecs = resolveTokenList(args.tokens);
        const client = createClient();

        const balances = [];

        for (const token of tokenSpecs) {
          if (token.kind === "native" || token.symbol === "ETH") {
            const wei = await client.getBalance({ address });
            balances.push({
              chainId: 8453,
              symbol: "ETH",
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
            chainId: 8453,
            symbol: String(symbol),
            address: token.address,
            amount: formatUnits(raw, Number(decimals)),
            raw: raw.toString(),
            decimals: Number(decimals),
          });
        }

        return {
          chainId: 8453,
          chain: "Base",
          address,
          balances,
        };
      },
      presentCall: (args) => ({
        card: "generic",
        title: "Get wallet balances",
        kind: "other",
        rawInput: args,
      }),
    }),
  );
}
