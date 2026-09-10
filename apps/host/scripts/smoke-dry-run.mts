import { buildSwapFromPlan } from "../src/strategy/swap-build.ts";
import { executeGatedTrade } from "../src/strategy/executor.ts";
import { DEFAULT_STRATEGY_IMPROVEMENT } from "@squadrons/shared";

async function main() {
  const plan = {
    chainId: 8453,
    walletAddress: "0x50b648a030332b31C32Fc7be889074c670277021",
    amountUsd: 10,
    symbol: "ETH",
    side: "buy" as const,
    maxSlippageBps: 50,
  };

  const quote = await buildSwapFromPlan(plan);
  if (!quote.ok) {
    console.log("QUOTE_FAIL", quote);
  } else {
    console.log("QUOTE_OK", {
      needsAllowance: quote.swap.needsAllowance,
      sellAmount: quote.swap.sellAmount,
      buyAmount: quote.swap.buyAmount,
      to: quote.swap.transaction.to,
      zid: quote.swap.zid,
    });
  }

  const agent = {
    id: "smoke",
    userId: "smoke-user",
    name: "Smoke",
    avatarId: "01" as const,
    colorId: "purple" as const,
    description: "",
    chainId: 8453 as const,
    status: "idle" as const,
    spendMode: "spend_enabled" as const,
    mode: "operate" as const,
    currentGoal: null,
    lastDshSessionId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const strategy = {
    agentId: "smoke",
    status: "running" as const,
    summary: "smoke buy eth",
    recipeId: "price_band_alert" as const,
    params: { symbol: "ETH", low: 1, high: 2 },
    trigger: { type: "interval" as const, intervalSec: 15 },
    action: { type: "propose_trade" as const, detail: "smoke" },
    caps: { maxTradeUsd: 10 },
    improvement: { ...DEFAULT_STRATEGY_IMPROVEMENT },
    lastTickAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const result = await executeGatedTrade({
    agent,
    strategy,
    intent: { amountUsd: 10, symbol: "ETH", side: "buy", note: "smoke" },
    walletAddress: plan.walletAddress,
    walletId: null,
  });
  console.log("EXEC", {
    status: result.status,
    detail: result.detail,
    hasSwap: Boolean("swap" in result && result.swap),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
