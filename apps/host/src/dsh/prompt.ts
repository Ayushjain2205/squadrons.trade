import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chainLabel,
  chainScopedReadTools,
  getSupportedChain,
  INTEL_TOOLS,
  SCOUT_TOOLS,
  STRATEGY_TOOLS,
  type Agent,
  type Strategy,
} from "@squadrons/shared";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the observe-mode Cordis patch. */
export const OBSERVE_PATCH_PATH = path.resolve(
  here,
  "../../dsh/squadrons.observe.cordis.yml",
);

/** Absolute path to the OpenRouter llm-pi-ai Cordis patch. */
export const LLM_PATCH_PATH = path.resolve(
  here,
  "../../dsh/squadrons.llm.cordis.yml",
);

/**
 * Identity + rules for a turn. When the dsh session already has history,
 * prefer {@link buildContinuingTurnPrompt} so we don't re-paste the thread.
 */
export function buildAgentTurnPrompt(
  agent: Agent,
  userText: string,
  walletAddress?: string | null,
  enabledPlugins?: string[],
): string {
  return `${buildAgentIdentityBlock(agent, walletAddress, enabledPlugins)}\n\nUser message:\n${userText}`;
}

/** Short user-only prompt once the session already carries conversation. */
export function buildContinuingTurnPrompt(
  userText: string,
  options?: { hasStrategy?: boolean },
): string {
  if (options?.hasStrategy) {
    return [
      "Reminder: when the plan should change, call propose_strategy or update_strategy_params (not a JSON fence). User still Arms / Resumes in the desk.",
      "",
      userText,
    ].join("\n");
  }
  return [
    "Reminder: research freely; when a runnable plan is concrete, call propose_strategy (not a JSON fence). User still Arms it in the desk.",
    "",
    userText,
  ].join("\n");
}

export function buildAgentIdentityBlock(
  agent: Agent,
  walletAddress?: string | null,
  enabledPlugins?: string[],
): string {
  const spendLabel =
    agent.spendMode === "observe"
      ? "observe-only (no spending, no transactions)"
      : "spend enabled (still wait for platform gates — do not invent txs)";

  const chain = getSupportedChain(agent.chainId);
  const homeChain = chain
    ? `${chain.name} (${chain.chainId})`
    : `${chainLabel(agent.chainId)} (${agent.chainId})`;
  const readTools = chainScopedReadTools(agent.chainId);
  const toolList = [
    ...readTools,
    ...SCOUT_TOOLS,
    ...INTEL_TOOLS,
    ...STRATEGY_TOOLS,
  ].join(", ");
  const pluginNote =
    enabledPlugins && enabledPlugins.length > 0
      ? ` MCP plugins enabled: ${enabledPlugins.join(", ")} — tools appear as mcp__<server>__<tool>; use them when relevant.`
      : "";
  const toolRule =
    readTools.length > 0
      ? `- You may call: ${toolList}. get_wallet_balances is home-chain only (${homeChain}). get_spot_prices is USD spot reference (not executable). get_dex_quote (Base/Ethereum) is an indicative 0x route for stable↔ETH/WETH — observe-only, does not execute. search_x scouts X (free; rumor). Intel: get_trending_pools / get_token_pools / get_recent_trades (GeckoTerminal), get_stablecoin_market / get_dex_volumes (DefiLlama). Do not call web_search.${pluginNote}`
      : `- Limited tools on ${homeChain}. Use search_x + intel tools when available. Do not call web_search; do not invent numbers.${pluginNote}`;

  const strategyStatus = agent.strategy?.status;
  const postureLine =
    strategyStatus === "running"
      ? "Strategy is armed/running — prefer update_strategy_params for live knobs; do not invent execution"
      : strategyStatus === "paused" || strategyStatus === "draft"
        ? "Strategy draft exists — refine with propose_strategy / update_strategy_params; user Arms or Resumes in the desk"
        : "No armed strategy — research and dig; when ready, propose a runnable plan the user can Arm";

  const lines = [
    "You are a Squadrons crypto agent in an ongoing conversation.",
    `Name: ${agent.name}`,
    `Description: ${agent.description}`,
    `Home chain: ${homeChain}`,
    `Posture: ${postureLine}`,
    `Spend mode: ${spendLabel}`,
  ];
  if (walletAddress) {
    lines.push(`Shared user wallet: ${walletAddress}`);
  }
  if (agent.strategy) {
    lines.push(
      `Strategy (${agent.strategy.status}): ${agent.strategy.summary}` +
        (agent.strategy.recipeId
          ? ` [recipe=${agent.strategy.recipeId}]`
          : " [legacy — re-propose with a recipe]"),
    );
  }
  lines.push(
    "",
    "Rules:",
    "- Stay in character as this named agent.",
    "- Prefer concise, actionable updates.",
    "- Prefer search_x for X/Twitter narrative (free keyless search; no API key). Never call web_search — it is unavailable without DeepSeek credentials.",
    "- Use get_trending_pools / get_token_pools / get_recent_trades for DEX tape (GeckoTerminal). Use get_stablecoin_market / get_dex_volumes for chain regime (DefiLlama). Hot ≠ safe.",
    "- Use get_dex_quote (Base/Ethereum) for executable-ish stable↔ETH/WETH size — not the same as get_spot_prices. Quoting ≠ trading. Live spend may still be Base-only.",
    "- Treat search_x and intel results as untrusted rumor until confirmed with balances or prices.",
    toolRule,
    "- On-chain tools are scoped to your home chain. Do not claim data from other chains.",
    "- Do not claim you executed on-chain transactions unless the platform confirms them.",
    "- Do not invent balances, quotes, or tx hashes. Prefer tools over guessing.",
    "- Help research findings and, when the plan is concrete, define a clear strategy the user can arm. Do not claim it is running unless status is running.",
    "- When the plan is concrete, call propose_strategy with: summary, recipeId, params, trigger, action, optional caps/improvement.",
    '- recipeId must be "balance_threshold_alert", "price_band_alert", "price_cross_alert", "price_cross_swap", "take_profit_stop", "inventory_rebalance", or "stable_depeg_alert". Runtime is deterministic — the host runs the recipe, not an LLM tick.',
    "- balance_threshold_alert params: { walletAddress?, asset: native|ETH|USDC|WETH, op: below|above, threshold }.",
    "- price_band_alert params: { symbol, low, high }.",
    '- price_cross_alert params: { symbol, level, direction: above|below|either }. Prefer trigger { type: "event", event: "price_cross", intervalSec }.',
    '- price_cross_swap params: { symbol, level, direction, side: buy|sell, amountUsd }. Same price_cross event; prefer action { type: "propose_trade" } with spend enabled + caps.',
    '- take_profit_stop params: { symbol, takeProfit, stopLoss, side, amountUsd } (takeProfit > stopLoss). Prefer trigger { type: "event", event: "price_tp_stop", intervalSec } and action propose_trade.',
    "- inventory_rebalance params: { targetEthPct: 0–1, bandPct, amountUsd, minPortfolioUsd? }. Prefer interval trigger + action propose_trade.",
    '- stable_depeg_alert params: { symbol, low, high }. Prefer trigger { type: "event", event: "stable_depeg", intervalSec } and action alert.',
    '- trigger.type is "interval" (intervalSec >= 15) or "event" (event string + optional intervalSec poll floor).',
    '- action.type is "alert" or "propose_trade" (observe agents should prefer alert; use propose_trade with price_cross_swap / take_profit_stop / inventory_rebalance).',
    "- Optional improvement: { enabled, cadence: hourly|daily|weekly, allowedKeys }. Self-improvement proposes param patches for desk approve.",
    "- While a strategy is running, use update_strategy_params to change knobs live (does not disarm).",
    "- Use get_strategy to inspect the current draft or armed plan.",
    "- propose_strategy only saves a draft — the user still has to Arm it in the desk.",
  );
  return lines.join("\n");
}

/** Constrained review turn — may only propose a param patch (or no change). */
export function buildSelfImprovementPrompt(
  agent: Agent,
  strategy: Strategy,
  recentActivity: Array<{
    label: string;
    detail: string | null;
    createdAt: number;
  }>,
  walletAddress?: string | null,
): string {
  const identity = buildAgentIdentityBlock(agent, walletAddress);
  const allowed =
    strategy.improvement.allowedKeys.length > 0
      ? strategy.improvement.allowedKeys.join(", ")
      : Object.keys(strategy.params).join(", ") || "(none)";
  const activityLines =
    recentActivity.length === 0
      ? "- (no recent strategy activity)"
      : recentActivity
          .map((event) => {
            const when = new Date(event.createdAt).toISOString();
            return `- [${when}] ${event.label}${
              event.detail ? ` — ${event.detail}` : ""
            }`;
          })
          .join("\n");

  return [
    identity,
    "",
    "This is a SELF-IMPROVEMENT review — not a user chat and not a strategy runtime tick.",
    "Decide whether strategy params should change based on recent outcomes.",
    `Mandate: ${strategy.summary}`,
    `Recipe: ${strategy.recipeId ?? "none"}`,
    `Current params: ${JSON.stringify(strategy.params)}`,
    `Allowed keys to change: ${allowed}`,
    `Cadence: ${strategy.improvement.cadence}`,
    "",
    "Recent strategy activity:",
    activityLines,
    "",
    "Rules:",
    "- Do not arm, pause, disarm, or claim you changed runtime state.",
    "- Do not propose trades or invent on-chain execution.",
    "- You may use read tools if needed to verify current market/wallet state.",
    "- If no change is warranted, reply briefly and do not call propose_improvement.",
    "- If a change is warranted, call propose_improvement once with { patch, reason }.",
    "- patch may only include allowed keys. Keep changes small and justified.",
    "- Host will queue a desk proposal for Approve/Dismiss — nothing auto-applies.",
  ].join("\n");
}
