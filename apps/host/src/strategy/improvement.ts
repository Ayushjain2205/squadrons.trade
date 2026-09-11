import {
  improvementCadenceMs,
  parseProposeImprovementInput,
  type Agent,
  type Strategy,
  type StrategyImprovementProposal,
} from "@squadrons/shared";
import type { ActivityHub } from "../agents/activity-hub.js";
import { agentWorkspacePath } from "../agents/paths.js";
import type { AgentStore } from "../agents/store.js";
import type { StrategyStore } from "../agents/strategy-store.js";
import type { UserStore } from "../auth/privy.js";
import { isSuccessfulProposeImprovementResult } from "../dsh/activity-map.js";
import { runDshSelfImprovement } from "../dsh/runner.js";
import type { ImprovementProposalStore } from "./improvement-store.js";
import type { AgentPluginStore } from "../plugins/store.js";
import { prepareAgentPlugins } from "../plugins/prepare.js";
import {
  clearPendingImprovementProposal,
  readPendingImprovementProposal,
  writeStrategyStateFile,
} from "./workspace-draft.js";

const DEFAULT_SCAN_MS = 60_000;

export type ImprovementScheduler = {
  stop: () => void;
};

function filterPatch(
  strategy: Strategy,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const allowed =
    strategy.improvement.allowedKeys.length > 0
      ? new Set(strategy.improvement.allowedKeys)
      : new Set(Object.keys(strategy.params));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}

export function isImprovementDue(strategy: Strategy, now = Date.now()): boolean {
  if (!strategy.improvement.enabled) return false;
  if (strategy.status !== "running") return false;
  if (!strategy.recipeId) return false;
  const cadenceMs = improvementCadenceMs(strategy.improvement.cadence);
  const last = strategy.improvement.lastRunAt;
  if (last == null) {
    // Wait until the strategy has ticked at least once.
    return strategy.lastTickAt != null;
  }
  return now - last >= cadenceMs;
}

export async function ingestPendingImprovementProposal(deps: {
  agentId: string;
  workspace: string;
  strategies: StrategyStore;
  improvements: ImprovementProposalStore;
  activity: ActivityHub;
  announce?: boolean;
}): Promise<StrategyImprovementProposal | null> {
  const strategy = deps.strategies.get(deps.agentId);
  if (!strategy?.recipeId) return null;
  if (deps.improvements.getPending(deps.agentId)) return null;

  const pending = await readPendingImprovementProposal(deps.workspace);
  if (!pending) return null;

  const parsed = parseProposeImprovementInput(pending);
  if (!parsed) {
    await clearPendingImprovementProposal(deps.workspace);
    return null;
  }

  const patch = filterPatch(strategy, parsed.patch);
  if (Object.keys(patch).length === 0) {
    await clearPendingImprovementProposal(deps.workspace);
    deps.activity.publish({
      agentId: deps.agentId,
      kind: "info",
      source: "system",
      label: "Self-improvement skipped",
      detail: "Proposed patch had no allowed keys",
    });
    return null;
  }

  const proposal = deps.improvements.create({
    agentId: deps.agentId,
    patch,
    reason: parsed.reason ?? null,
  });
  await clearPendingImprovementProposal(deps.workspace);

  if (deps.announce !== false) {
    deps.activity.publish({
      agentId: deps.agentId,
      kind: "info",
      source: "system",
      label: "Self-improvement suggested",
      detail: proposal.reason ?? Object.keys(proposal.patch).join(", "),
    });
  }
  return proposal;
}

async function runOne(deps: {
  agents: AgentStore;
  strategies: StrategyStore;
  users: UserStore;
  activity: ActivityHub;
  improvements: ImprovementProposalStore;
  plugins: AgentPluginStore;
  strategy: Strategy;
}): Promise<void> {
  const agent = deps.agents.getById(deps.strategy.agentId);
  if (!agent || agent.strategy?.status !== "running") return;
  if (!deps.strategy.improvement.enabled) return;
  if (deps.improvements.getPending(deps.strategy.agentId)) return;

  deps.strategies.markImprovementRun(deps.strategy.agentId);

  const user = deps.users.get(agent.userId);
  const workspace = agentWorkspacePath(agent.userId, agent.id);
  await writeStrategyStateFile(workspace, agent);
  await clearPendingImprovementProposal(workspace);

  const recent = deps.activity
    .list(agent.id, { limit: 30, sources: ["strategy"] })
    .events.slice(0, 12);

  deps.activity.publish({
    agentId: agent.id,
    kind: "info",
    source: "system",
    label: "Self-improvement review",
    detail: deps.strategy.improvement.cadence,
  });

  try {
    const mcp = await prepareAgentPlugins(deps.plugins, agent.id, workspace);
    await runDshSelfImprovement({
      agent,
      strategy: deps.strategies.get(agent.id) ?? deps.strategy,
      workspace,
      walletAddress: user?.walletAddress ?? null,
      recentActivity: recent.map((event) => ({
        label: event.label,
        detail: event.detail,
        createdAt: event.createdAt,
      })),
      patches: mcp.patches,
      pluginEnv: mcp.pluginEnv,
      pluginsHash: mcp.pluginsHash,
      enabledPluginNames: mcp.enabledNames,
      onActivity: (event) => {
        deps.activity.publish({ ...event, source: "system" });
      },
      onNotification: (notification) => {
        if (!isSuccessfulProposeImprovementResult(notification)) return;
        void ingestPendingImprovementProposal({
          agentId: agent.id,
          workspace,
          strategies: deps.strategies,
          improvements: deps.improvements,
          activity: deps.activity,
        }).catch((error) => {
          console.error("[self-improvement-mid]", agent.id, error);
        });
      },
    });

    await ingestPendingImprovementProposal({
      agentId: agent.id,
      workspace,
      strategies: deps.strategies,
      improvements: deps.improvements,
      activity: deps.activity,
    });
  } catch (error) {
    console.error("[self-improvement]", agent.id, error);
    deps.activity.publish({
      agentId: agent.id,
      kind: "error",
      source: "system",
      label: "Self-improvement failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Cadence scanner for self-improvement reviews on armed strategies.
 */
export function startImprovementScheduler(deps: {
  agents: AgentStore;
  strategies: StrategyStore;
  users: UserStore;
  activity: ActivityHub;
  improvements: ImprovementProposalStore;
  plugins: AgentPluginStore;
  scanIntervalMs?: number;
}): ImprovementScheduler {
  const scanMs = deps.scanIntervalMs ?? DEFAULT_SCAN_MS;
  const inFlight = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let scanning = false;

  const scan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      const now = Date.now();
      for (const strategy of deps.strategies.listRunning()) {
        if (!isImprovementDue(strategy, now)) continue;
        if (inFlight.has(strategy.agentId)) continue;
        inFlight.add(strategy.agentId);
        void runOne({ ...deps, strategy }).finally(() => {
          inFlight.delete(strategy.agentId);
        });
      }
    } catch (error) {
      console.error("[improvement-scheduler]", error);
    } finally {
      scanning = false;
    }
  };

  timer = setInterval(() => {
    void scan();
  }, scanMs);
  void scan();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

/** Used by routes when Operate queues a proposal via tool. */
export function applyImprovementProposalFromWorkspace(
  deps: {
    agent: Agent;
    workspace: string;
    strategies: StrategyStore;
    improvements: ImprovementProposalStore;
    activity: ActivityHub;
  },
): Promise<StrategyImprovementProposal | null> {
  return ingestPendingImprovementProposal({
    agentId: deps.agent.id,
    workspace: deps.workspace,
    strategies: deps.strategies,
    improvements: deps.improvements,
    activity: deps.activity,
  });
}
