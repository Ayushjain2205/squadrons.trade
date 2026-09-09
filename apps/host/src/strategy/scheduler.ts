import {
  extractStrategyTickDecisionFromText,
  type Strategy,
} from "@squadrons/shared";
import type { ActivityHub } from "../agents/activity-hub.js";
import { agentWorkspacePath } from "../agents/paths.js";
import type { AgentStore } from "../agents/store.js";
import type { StrategyStore } from "../agents/strategy-store.js";
import type { UserStore } from "../auth/privy.js";
import { runDshStrategyTick } from "../dsh/runner.js";
import { writeStrategyStateFile } from "./workspace-draft.js";

const DEFAULT_SCAN_MS = 15_000;
const DEFAULT_INTERVAL_SEC = 60;
const MIN_INTERVAL_SEC = 15;

export type StrategyScheduler = {
  stop: () => void;
};

/**
 * In-process wake loop for armed strategies.
 * Host owns liveness; dsh owns judgment on each due tick.
 */
export function startStrategyScheduler(deps: {
  agents: AgentStore;
  strategies: StrategyStore;
  users: UserStore;
  activity: ActivityHub;
  scanIntervalMs?: number;
}): StrategyScheduler {
  const scanMs = deps.scanIntervalMs ?? DEFAULT_SCAN_MS;
  const inFlight = new Set<string>();
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let scanning = false;

  const tickOne = async (strategy: Strategy) => {
    if (stopped || inFlight.has(strategy.agentId)) return;
    inFlight.add(strategy.agentId);
    try {
      const agent = deps.agents.getById(strategy.agentId);
      if (!agent || agent.strategy?.status !== "running") return;

      const user = deps.users.get(agent.userId);
      const workspace = agentWorkspacePath(agent.userId, agent.id);
      await writeStrategyStateFile(workspace, agent);

      deps.activity.publish({
        agentId: agent.id,
        kind: "info",
        label: "Strategy tick",
        detail: strategy.summary,
      });

      let decisionLabel = "Checked strategy";
      let decisionDetail: string | null = null;

      try {
        const turn = await runDshStrategyTick({
          agent,
          strategy,
          workspace,
          walletAddress: user?.walletAddress ?? null,
          onActivity: (event) => {
            deps.activity.publish(event);
          },
        });

        const decision = extractStrategyTickDecisionFromText(
          turn.finalResponse || "",
        );
        if (decision) {
          decisionLabel = decision.label;
          decisionDetail = decision.detail ?? null;
        }
      } catch (error) {
        console.error("[strategy-tick]", strategy.agentId, error);
        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "error",
          label: "Strategy tick failed",
          detail: error instanceof Error ? error.message : String(error),
        });
        deps.strategies.markTicked(strategy.agentId);
        return;
      }

      // Re-check after long dsh turn — user may have paused/disarmed.
      const still = deps.strategies.get(strategy.agentId);
      if (!still || still.status !== "running") return;

      deps.activity.publish({
        agentId: strategy.agentId,
        kind: "info",
        label: decisionLabel,
        detail: decisionDetail,
      });

      deps.strategies.markTicked(strategy.agentId);
    } finally {
      inFlight.delete(strategy.agentId);
    }
  };

  const scan = async () => {
    if (stopped || scanning) return;
    scanning = true;
    try {
      const running = deps.strategies.listRunning();
      const now = Date.now();
      for (const strategy of running) {
        if (isDue(strategy, now)) {
          void tickOne(strategy);
        }
      }
    } catch (error) {
      console.error("[strategy-scheduler]", error);
    } finally {
      scanning = false;
    }
  };

  timer = setInterval(() => {
    void scan();
  }, scanMs);
  // Kick once on boot so freshly armed bots don't wait a full scan.
  void scan();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

function isDue(strategy: Strategy, now: number): boolean {
  const intervalSec = Math.max(
    MIN_INTERVAL_SEC,
    strategy.trigger.intervalSec ?? DEFAULT_INTERVAL_SEC,
  );
  if (strategy.lastTickAt == null) return true;
  return now - strategy.lastTickAt >= intervalSec * 1000;
}
