import type { Strategy, StrategyTickDecision } from "@squadrons/shared";
import type { ActivityHub } from "../agents/activity-hub.js";
import { agentWorkspacePath } from "../agents/paths.js";
import type { AgentStore } from "../agents/store.js";
import type { StrategyStore } from "../agents/strategy-store.js";
import type { UserStore } from "../auth/privy.js";
import { isSuccessfulReportTickResult } from "../dsh/activity-map.js";
import { runDshStrategyTick } from "../dsh/runner.js";
import { gateStrategyTickSpend } from "./spend-gate.js";
import type { TradeIntentStore } from "./trade-intents.js";
import {
  clearStrategyTickReport,
  readStrategyTickReport,
  writeStrategyStateFile,
} from "./workspace-draft.js";

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
  tradeIntents: TradeIntentStore;
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
      await clearStrategyTickReport(workspace);

      deps.activity.publish({
        agentId: agent.id,
        kind: "info",
        label: "Strategy tick",
        detail: strategy.summary,
      });

      let decision: StrategyTickDecision | null = null;
      let publishedDecision = false;

      const publishDecision = (raw: StrategyTickDecision) => {
        if (publishedDecision) return;
        publishedDecision = true;

        const gated = gateStrategyTickSpend({
          agent,
          strategy,
          decision: raw,
        });

        if (gated.kind === "blocked") {
          deps.tradeIntents.append({
            agentId: strategy.agentId,
            status: "blocked",
            intent: raw.intent,
            label: gated.decision.label,
            detail: gated.decision.detail ?? null,
            reason: gated.reason,
          });
          decision = gated.decision;
          deps.activity.publish({
            agentId: strategy.agentId,
            kind: "error",
            label: gated.decision.label,
            detail: gated.decision.detail ?? gated.reason,
          });
          return;
        }

        if (gated.kind === "proposed") {
          deps.tradeIntents.append({
            agentId: strategy.agentId,
            status: "proposed",
            intent: gated.intent,
            label: gated.decision.label,
            detail: gated.decision.detail ?? null,
          });
          decision = gated.decision;
          deps.activity.publish({
            agentId: strategy.agentId,
            kind: "info",
            label: gated.decision.label,
            detail: gated.decision.detail ?? null,
          });
          return;
        }

        decision = gated.decision;
        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "info",
          label: gated.decision.label,
          detail: gated.decision.detail ?? null,
        });
      };

      try {
        await runDshStrategyTick({
          agent,
          strategy,
          workspace,
          walletAddress: user?.walletAddress ?? null,
          onActivity: (event) => {
            deps.activity.publish(event);
          },
          onNotification: (notification) => {
            if (!isSuccessfulReportTickResult(notification)) return;
            void readStrategyTickReport(workspace)
              .then((reported) => {
                if (reported) publishDecision(reported);
              })
              .catch((error) => {
                console.error("[strategy-tick-report]", strategy.agentId, error);
              });
          },
        });

        if (!decision) {
          const reported = await readStrategyTickReport(workspace);
          if (reported) publishDecision(reported);
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

      if (!publishedDecision) {
        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "info",
          label: "Checked strategy",
          detail: null,
        });
      }

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
