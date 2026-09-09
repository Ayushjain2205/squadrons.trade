import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chainLabel,
  chainScopedReadTools,
  getSupportedChain,
  type Agent,
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
      "Operate mode reminder: when the strategy is concrete, end with a ```strategy JSON fence (summary, trigger, action, optional caps). User still Arms it.",
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
  const toolList = readTools.join(", ");
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
      `Strategy (${agent.strategy.status}): ${agent.strategy.summary}`,
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
          "- When the plan is concrete enough to draft, end your reply with a fenced ```strategy JSON block using keys summary, trigger, action, and optional caps.",
          '- trigger.type is "interval" (intervalSec >= 15) or "condition" (condition string; optional intervalSec poll floor).',
          '- action.type is "alert" or "propose_trade" (observe agents should prefer alert).',
          "- Keep the JSON valid. The platform saves it as a draft — the user still has to Arm it.",
        ].join("\n")
      : "- In Scout mode, focus on research and findings. Suggest switching to Operate when ready to define a runnable strategy.",
  );
  return lines.join("\n");
}
