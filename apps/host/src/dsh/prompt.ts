import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent } from "@squadrons/shared";

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

export const GOAL_COMPLETE_MARKER = "[[GOAL_COMPLETE]]";

export function buildAgentTurnPrompt(agent: Agent, userText: string): string {
  const spendLabel =
    agent.spendMode === "observe"
      ? "observe-only (no spending, no transactions)"
      : "spend enabled (still wait for platform gates — do not invent txs)";

  const goalBlock = agent.currentGoal
    ? `Active goal:\n${agent.currentGoal}\n\nWork toward this goal. When it is fully complete, end your reply with a final line containing exactly ${GOAL_COMPLETE_MARKER} and nothing else on that line.`
    : `No active goal yet. The user is telling you what to do. Confirm the goal briefly and start working it. Do not emit ${GOAL_COMPLETE_MARKER} until the goal is actually finished.`;

  return [
    "You are a Squadrons crypto agent.",
    `Name: ${agent.name}`,
    `Description: ${agent.description}`,
    `Home chain: Base (${agent.chainId})`,
    `Spend mode: ${spendLabel}`,
    "",
    "Rules:",
    "- Stay in character as this named agent.",
    "- Prefer concise, actionable updates.",
    "- You may use web search for public market/research info.",
    "- You may call get_wallet_balances to read Base (8453) balances (observe-only).",
    "- Do not claim you executed on-chain transactions unless the platform confirms them.",
    "- Do not invent balances, quotes, or tx hashes. Prefer tools over guessing.",
    "",
    goalBlock,
    "",
    "User message:",
    userText,
  ].join("\n");
}

export function stripGoalCompleteMarker(text: string): {
  content: string;
  completed: boolean;
} {
  const lines = text.split(/\r?\n/);
  let completed = false;
  const kept: string[] = [];

  for (const line of lines) {
    if (line.trim() === GOAL_COMPLETE_MARKER) {
      completed = true;
      continue;
    }
    kept.push(line);
  }

  return {
    content: kept.join("\n").trimEnd(),
    completed,
  };
}
