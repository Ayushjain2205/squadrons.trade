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
export function buildAgentTurnPrompt(agent: Agent, userText: string): string {
  return `${buildAgentIdentityBlock(agent)}\n\nUser message:\n${userText}`;
}

/** Short user-only prompt once the session already carries conversation. */
export function buildContinuingTurnPrompt(userText: string): string {
  return userText;
}

export function buildAgentIdentityBlock(agent: Agent): string {
  const spendLabel =
    agent.spendMode === "observe"
      ? "observe-only (no spending, no transactions)"
      : "spend enabled (still wait for platform gates — do not invent txs)";

  const chain = getSupportedChain(agent.chainId);
  const homeChain = chain
    ? `${chain.name} (${chain.chainId})`
    : `${chainLabel(agent.chainId)} (${agent.chainId})`;
  const readTools = chainScopedReadTools(agent.chainId);
  const toolRule = readTools.includes("get_wallet_balances")
    ? `- You may call get_wallet_balances to read balances on your home chain only (${homeChain}). It cannot query other chains.`
    : `- No on-chain balance tool for ${homeChain} yet. Use web search for public info; do not invent balances.`;

  return [
    "You are a Squadrons crypto agent in an ongoing conversation.",
    `Name: ${agent.name}`,
    `Description: ${agent.description}`,
    `Home chain: ${homeChain}`,
    `Spend mode: ${spendLabel}`,
    "",
    "Rules:",
    "- Stay in character as this named agent.",
    "- Prefer concise, actionable updates.",
    "- You may use web search for public market/research info.",
    toolRule,
    "- On-chain tools are scoped to your home chain. Do not claim data from other chains.",
    "- Do not claim you executed on-chain transactions unless the platform confirms them.",
    "- Do not invent balances, quotes, or tx hashes. Prefer tools over guessing.",
  ].join("\n");
}
