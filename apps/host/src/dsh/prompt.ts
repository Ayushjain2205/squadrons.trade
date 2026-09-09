import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chainLabel,
  chainScopedReadTools,
  DEFAULT_POLICY,
  getSupportedChain,
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
): string {
  return `${buildAgentIdentityBlock(agent, walletAddress)}\n\nUser message:\n${userText}`;
}

/** Short user-only prompt once the session already carries conversation. */
export function buildContinuingTurnPrompt(
  userText: string,
  options?: { mode?: Agent["mode"] },
): string {
  if (options?.mode === "operate") {
    return [
      "Operate mode reminder: when the strategy is concrete, call propose_strategy (not a JSON fence). User still Arms it.",
      "",
      userText,
    ].join("\n");
  }
  return userText;
}

export function buildAgentIdentityBlock(
  agent: Agent,
  walletAddress?: string | null,
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
    ...(agent.mode === "operate"
      ? ["propose_strategy", "update_strategy_params", "get_strategy"]
      : []),
  ].join(", ");
  const toolRule =
    readTools.length > 0
      ? `- You may call: ${toolList}. get_wallet_balances is home-chain only (${homeChain}). get_spot_prices returns USD reference prices (not a DEX quote / not executable).`
      : `- No market/balance tools for ${homeChain} yet. Use web search for public info; do not invent numbers.`;

  const lines = [
    "You are a Squadrons crypto agent in an ongoing conversation.",
    `Name: ${agent.name}`,
    `Description: ${agent.description}`,
    `Home chain: ${homeChain}`,
    `Desk mode: ${
      agent.mode === "operate"
        ? "Operate (shape or steer a runnable strategy; do not invent live execution)"
        : "Scout (research and dig; do not arm or claim a live strategy loop)"
    }`,
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
    "- You may use web search for public market/research info.",
    toolRule,
    "- On-chain tools are scoped to your home chain. Do not claim data from other chains.",
    "- Do not claim you executed on-chain transactions unless the platform confirms them.",
    "- Do not invent balances, quotes, or tx hashes. Prefer tools over guessing.",
    agent.mode === "operate"
      ? [
          "- In Operate mode, help define a clear strategy the user can arm later. Do not claim it is running unless status is running.",
          "- When the plan is concrete, call propose_strategy with: summary, recipeId, params, trigger, action, optional caps/improvement.",
          '- recipeId must be "balance_threshold_alert" or "price_band_alert". Runtime is deterministic — the host runs the recipe, not an LLM tick.',
          "- balance_threshold_alert params: { walletAddress?, asset: native|ETH, op: below|above, threshold }.",
          "- price_band_alert params: { symbol, low, high }.",
          '- trigger.type is "interval" (intervalSec >= 15) or "event" (event string + optional intervalSec poll floor).',
          '- action.type is "alert" or "propose_trade" (observe agents should prefer alert).',
          "- Optional improvement: { enabled, cadence: hourly|daily|weekly, allowedKeys }. Self-improvement proposes param patches for desk approve.",
          "- While a strategy is running, use update_strategy_params to change knobs live (does not disarm).",
          "- Use get_strategy to inspect the current draft or armed plan.",
          "- propose_strategy only saves a draft — the user still has to Arm it in the desk.",
        ].join("\n")
      : "- In Scout mode, focus on research and findings. Suggest switching to Operate when ready to define a runnable strategy. Do not call propose_strategy.",
  );
  return lines.join("\n");
}

/** Prompt for a background strategy tick — not a user chat turn. */
export function buildStrategyTickPrompt(
  agent: Agent,
  strategy: Strategy,
  walletAddress?: string | null,
): string {
  const identity = buildAgentIdentityBlock(agent, walletAddress);
  const trigger =
    strategy.trigger.type === "interval"
      ? `interval every ${strategy.trigger.intervalSec ?? 60}s`
      : `condition: ${strategy.trigger.condition ?? "(missing)"}` +
        (strategy.trigger.intervalSec
          ? ` (poll floor ${strategy.trigger.intervalSec}s)`
          : "");
  const action =
    strategy.action.type === "alert"
      ? `alert${strategy.action.detail ? ` — ${strategy.action.detail}` : ""}`
      : `propose_trade${strategy.action.detail ? ` — ${strategy.action.detail}` : ""}`;

  const spendRules =
    agent.spendMode === "spend_enabled" && strategy.action.type === "propose_trade"
      ? [
          "- Spend is enabled for this agent. If the trigger warrants a trade within caps, call report_tick with action propose_trade and intent { amountUsd, symbol?, side?, note? }.",
          `- Respect maxTradeUsd caps (strategy + platform default $${DEFAULT_POLICY.maxTradeUsd}). Host fail-closes oversized intents.`,
          "- Do not claim a tx was broadcast. Host records proposals only until signing ships.",
        ]
      : [
          "- Spend is observe-only (or strategy is alert-only). Use action none or alert — never propose_trade.",
          "- Never invent txs or claim funds moved.",
        ];

  return [
    identity,
    "",
    "This is a background STRATEGY TICK — not a user chat message.",
    "Evaluate the armed strategy using tools if needed.",
    `Armed strategy: ${strategy.summary}`,
    `Trigger: ${trigger}`,
    `Action: ${action}`,
    "",
    "Rules for this tick:",
    "- Do not claim the strategy is disarmed or that you changed Arm state.",
    "- Prefer tools over guessing balances/prices.",
    "- If a price tool fails, do not loop retries — call report_tick once with action alert or none and say the feed failed.",
    "- Call report_tick exactly once. Do not dump ```tick fences.",
    "- If nothing actionable, action is none.",
    ...spendRules,
    "- Keep label short and operator-facing (present or past tense).",
  ].join("\n");
}
