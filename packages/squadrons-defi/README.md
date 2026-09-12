# squadrons-defi

Cordis tools for wallet balances, CoinGecko spot prices, and **0x DEX quotes**.

## Tools

| Tool | Scope |
| --- | --- |
| `get_wallet_balances` | Home-chain native + known ERC-20s |
| `get_spot_prices` | USD spot reference (not executable) |
| `get_dex_quote` | Indicative 0x AllowanceHolder quote (observe-only) |

Quotes use the same language as the host swap builder: **USD notional** against a **quote stable** (`USDC` preferred, else `USDG`), asset `ETH` / `WETH`.

## Adding a chain (checklist)

Goal: one config row + flip a couple of allowlists — **do not fork** quote/swap code per chain.

### 1. Token + RPC config (required for reads)

Edit [`chains.js`](./chains.js) — add a `CHAIN_TOOL_CONFIGS[chainId]` entry:

- `viemChain` / RPC env keys / default RPC
- `tokens`: at least one **quote stable** (`USDC` or `USDG`, 6 decimals) and usually `WETH`
- Native is always treated as `ETH` via the 0x `0xEeee…` sentinel

Mirror the ERC-20 map in the host:

- [`apps/host/src/strategy/recipes/tokens.ts`](../../apps/host/src/strategy/recipes/tokens.ts)

Also register the chain in product UI / agent create if needed:

- [`packages/shared/src/policy.ts`](../shared/src/policy.ts) → `SUPPORTED_CHAINS`
- Chain logo under `apps/web/public/chains/` if you show it in the web app

### 2. Enable DEX quotes (0x)

Confirm [0x Swap API](https://0x.org/docs/) supports the `chainId`. Then add the id to **both** allowlists (keep in sync):

| File | Constant |
| --- | --- |
| [`chains.js`](./chains.js) | `DEX_QUOTE_CHAIN_IDS` |
| [`packages/shared/src/policy.ts`](../shared/src/policy.ts) | `DEX_QUOTE_CHAIN_IDS` (drives prompt tool list) |
| [`apps/host/src/strategy/swap-build.ts`](../../apps/host/src/strategy/swap-build.ts) | `DEX_QUOTE_CHAIN_IDS` (dry-run / execute build) |

`get_dex_quote` registers automatically when `supportsDexQuote(homeChainId)` is true — no new tool code.

### 3. Smoke

```bash
# From repo root (needs ZEROEX_API_KEY in apps/host/.env)
node --env-file=apps/host/.env --input-type=module -e "
import { fetchDexQuote } from './packages/squadrons-defi/zeroex-quote.js';
const q = await fetchDexQuote({
  chainId: YOUR_CHAIN_ID,
  walletAddress: '0x1111111111111111111111111111111111111111',
  side: 'buy',
  symbol: 'ETH',
  amountUsd: 5,
});
console.log(q.chain, q.quoteStable, q.buy);
"
```

Restart the host after linking plugins so Cordis reloads `squadrons-defi`.

### 4. Live spend

Live broadcast uses the same `DEX_QUOTE_CHAIN_IDS` allowlist as quotes
(`supportsDexQuote` in the executor). Adding a chain to the quote allowlists
enables live once host `SQUADRONS_EXECUTION_MODE=live` and Privy broadcast
keys are configured. Smoke quote + approve/broadcast on the new chain before
shipping real size.

## Related intel

Market tape / TVL (not quotes): [`packages/squadrons-intel`](../squadrons-intel) — GeckoTerminal + DefiLlama. Those packs have their own chain→slug maps (`geckoNetworkId`, `llamaChainSlug`).
