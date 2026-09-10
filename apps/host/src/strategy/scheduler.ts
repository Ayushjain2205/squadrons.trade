import type { Strategy, StrategyTickDecision } from "@squadrons/shared";
import type { ActivityHub } from "../agents/activity-hub.js";
import { agentWorkspacePath } from "../agents/paths.js";
import type { AgentStore } from "../agents/store.js";
import type { StrategyStore } from "../agents/strategy-store.js";
import type { UserStore } from "../auth/privy.js";
import { evaluateEventEdge } from "./events.js";
import { executeGatedTrade } from "./executor.js";
import { gateStrategyTickSpend } from "./spend-gate.js";
import type { TradeIntentStore } from "./trade-intents.js";
import { executeStrategyRecipe } from "./recipes/index.js";
import { writeStrategyStateFile } from "./workspace-draft.js";

const DEFAULT_SCAN_MS = 15_000;
const DEFAULT_INTERVAL_SEC = 60;
const MIN_INTERVAL_SEC = 15;

export type StrategyScheduler = {
  stop: () => void;
};

/**
 * In-process wake loop for armed strategies.
 * Host owns liveness; recipes run deterministically (no LLM ticks).
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

      if (!strategy.recipeId) {
        deps.activity.publish({
          agentId: agent.id,
          kind: "error",
          source: "strategy",
          label: "Strategy has no recipe",
          detail: "Disarm and re-propose a recipe-backed plan in Operate",
        });
        deps.strategies.pause(strategy.agentId);
        return;
      }

      // Stamp immediately so a long/failing turn cannot overlap the next due scan.
      deps.strategies.markTicked(strategy.agentId);

      const user = deps.users.get(agent.userId);
      const workspace = agentWorkspacePath(agent.userId, agent.id);
      await writeStrategyStateFile(workspace, agent);

      if (strategy.trigger.type === "event") {
        const edge = await evaluateEventEdge(
          deps.strategies.get(strategy.agentId) ?? strategy,
        );
        if (edge.kind === "skip") {
          deps.activity.publish({
            agentId: agent.id,
            kind: "error",
            source: "strategy",
            label: "Event watch failed",
            detail: edge.reason,
          });
          return;
        }
        if (edge.kind === "armed") {
          deps.activity.publish({
            agentId: agent.id,
            kind: "info",
            source: "strategy",
            label: "Event watch armed",
            detail: edge.detail,
          });
          return;
        }
        if (edge.kind === "quiet") {
          // Poll advanced; stay silent until a cross fires.
          return;
        }
        // kind === fire → fall through to recipe
      }

      deps.activity.publish({
        agentId: agent.id,
        kind: "info",
        source: "strategy",
        label: "Strategy tick",
        detail: strategy.summary,
      });

      let publishedDecision = false;

      const publishDecision = async (raw: StrategyTickDecision) => {
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
          deps.activity.publish({
            agentId: strategy.agentId,
            kind: "error",
            source: "strategy",
            label: gated.decision.label,
            detail: gated.decision.detail ?? gated.reason,
          });
          return;
        }

        if (gated.kind === "proposed") {
          const record = deps.tradeIntents.append({
            agentId: strategy.agentId,
            status: "proposed",
            intent: gated.intent,
            label: gated.decision.label,
            detail: gated.decision.detail ?? null,
          });

          try {
            const executed = await executeGatedTrade({
              agent,
              strategy,
              intent: gated.intent,
              walletAddress: user?.walletAddress ?? null,
            });

            deps.tradeIntents.updateExecution(record.id, {
              status: executed.status,
              detail: executed.detail,
              reason:
                executed.status === "failed" ? executed.reason : null,
              txHash:
                executed.status === "submitted" ? executed.txHash : null,
              execution: executed.plan,
            });

            deps.activity.publish({
              agentId: strategy.agentId,
              kind: executed.status === "failed" ? "error" : "info",
              source: "strategy",
              label:
                executed.status === "dry_run"
                  ? `Dry-run: ${gated.decision.label}`
                  : executed.status === "submitted"
                    ? `Submitted: ${gated.decision.label}`
                    : executed.status === "failed"
                      ? `Execution failed: ${gated.decision.label}`
                      : gated.decision.label,
              detail:
                executed.status === "failed"
                  ? `${executed.reason} · ${executed.detail}`
                  : executed.detail,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            deps.tradeIntents.updateExecution(record.id, {
              status: "failed",
              reason: message,
              detail: message,
            });
            deps.activity.publish({
              agentId: strategy.agentId,
              kind: "error",
              source: "strategy",
              label: `Execution failed: ${gated.decision.label}`,
              detail: message,
            });
          }
          return;
        }

        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "info",
          source: "strategy",
          label: gated.decision.label,
          detail: gated.decision.detail ?? null,
        });
      };

      try {
        const fresh = deps.strategies.get(strategy.agentId) ?? strategy;
        const result = await executeStrategyRecipe({
          agent,
          strategy: fresh,
          walletAddress: user?.walletAddress ?? null,
        });
        await publishDecision(result);
      } catch (error) {
        console.error("[strategy-tick]", strategy.agentId, error);
        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "error",
          source: "strategy",
          label: "Strategy tick failed",
          detail: error instanceof Error ? error.message : String(error),
        });
        return;
      }

      const still = deps.strategies.get(strategy.agentId);
      if (!still || still.status !== "running") return;

      if (!publishedDecision) {
        deps.activity.publish({
          agentId: strategy.agentId,
          kind: "info",
          source: "strategy",
          label: "Checked strategy",
          detail: null,
        });
      }
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
