import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseProposeImprovementInput,
  parseStrategyDraftInput,
  type Agent,
  type ProposeImprovementInput,
  type UpsertStrategyDraftInput,
} from "@squadrons/shared";

/** Keep in sync with packages/squadrons-strategy/paths.js */
const STRATEGY_DIR = ".squadrons";
const STRATEGY_DRAFT_FILE = "strategy-draft.json";
const STRATEGY_STATE_FILE = "strategy-state.json";
const STRATEGY_PARAMS_PATCH_FILE = "strategy-params-patch.json";
const STRATEGY_IMPROVEMENT_FILE = "strategy-improvement.json";

export function strategyDraftPath(workspace: string): string {
  return path.join(workspace, STRATEGY_DIR, STRATEGY_DRAFT_FILE);
}

export function strategyStatePath(workspace: string): string {
  return path.join(workspace, STRATEGY_DIR, STRATEGY_STATE_FILE);
}

export function strategyParamsPatchPath(workspace: string): string {
  return path.join(workspace, STRATEGY_DIR, STRATEGY_PARAMS_PATCH_FILE);
}

export function strategyImprovementPath(workspace: string): string {
  return path.join(workspace, STRATEGY_DIR, STRATEGY_IMPROVEMENT_FILE);
}

/** Write DB strategy snapshot for get_strategy / propose_strategy guards. */
export async function writeStrategyStateFile(
  workspace: string,
  agent: Agent,
): Promise<void> {
  const dir = path.join(workspace, STRATEGY_DIR);
  await mkdir(dir, { recursive: true });
  const payload = agent.strategy
    ? {
        status: agent.strategy.status,
        summary: agent.strategy.summary,
        recipeId: agent.strategy.recipeId,
        params: agent.strategy.params,
        trigger: agent.strategy.trigger,
        action: agent.strategy.action,
        caps: agent.strategy.caps,
        improvement: agent.strategy.improvement,
        lastTickAt: agent.strategy.lastTickAt,
        updatedAt: agent.strategy.updatedAt,
        spendMode: agent.spendMode,
      }
    : { status: "none", spendMode: agent.spendMode };
  await writeFile(
    strategyStatePath(workspace),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

export async function readPendingStrategyDraft(
  workspace: string,
): Promise<UpsertStrategyDraftInput | null> {
  try {
    const raw = await readFile(strategyDraftPath(workspace), "utf8");
    return parseStrategyDraftInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function readPendingParamsPatch(
  workspace: string,
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(strategyParamsPatchPath(workspace), "utf8");
    const parsed = JSON.parse(raw) as { params?: unknown };
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.params !== "object" ||
      parsed.params === null ||
      Array.isArray(parsed.params)
    ) {
      return null;
    }
    return parsed.params as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function clearPendingParamsPatch(
  workspace: string,
): Promise<void> {
  try {
    await unlink(strategyParamsPatchPath(workspace));
  } catch {
    // missing is fine
  }
}

export async function readPendingImprovementProposal(
  workspace: string,
): Promise<ProposeImprovementInput | null> {
  try {
    const raw = await readFile(strategyImprovementPath(workspace), "utf8");
    return parseProposeImprovementInput(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearPendingImprovementProposal(
  workspace: string,
): Promise<void> {
  try {
    await unlink(strategyImprovementPath(workspace));
  } catch {
    // missing is fine
  }
}
