"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  recipeLabel,
  type Strategy,
  type StrategyImprovementProposal,
} from "@squadrons/shared";
import type { AgentWithWorkspace } from "@/lib/host";
import {
  approveStrategyImprovement,
  dismissStrategyImprovement,
  listStrategyImprovements,
  subscribeActivity,
  updateStrategyImprovement,
} from "@/lib/host";

const IMPROVEMENT_ACTIVITY_LABELS = new Set([
  "Self-improvement suggested",
  "Self-improvement approved",
  "Self-improvement dismissed",
  "Self-improvement review",
  "Self-improvement failed",
  "Self-improvement skipped",
  "Updated self-improvement",
]);

export function StrategyCard({
  mode,
  spendMode = "observe",
  strategy,
  agentId,
  agentWorking = false,
  onAction,
  onAgentUpdated,
}: {
  mode: "scout" | "operate";
  spendMode?: "observe" | "spend_enabled";
  strategy: Strategy | null;
  agentId: string;
  /** True while a chat turn is in flight — freeze strategy controls. */
  agentWorking?: boolean;
  onAction?: (
    action: "arm" | "pause" | "resume" | "disarm",
  ) => Promise<AgentWithWorkspace>;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<StrategyImprovementProposal | null>(
    null,
  );
  const [proposalHighlight, setProposalHighlight] = useState(false);
  const busy = pending || agentWorking;

  function refreshProposal(opts?: { highlight?: boolean }) {
    void listStrategyImprovements(agentId)
      .then((data) => {
        setProposal(data.pending);
        if (opts?.highlight && data.pending) {
          setProposalHighlight(true);
        }
        if (!data.pending) setProposalHighlight(false);
      })
      .catch(() => {
        setProposal(null);
        setProposalHighlight(false);
      });
  }

  useEffect(() => {
    refreshProposal();
  }, [agentId, strategy?.updatedAt, strategy?.params, strategy?.improvement?.lastRunAt]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh when strategy identity/params/improve change

  // Live: pick up proposals without waiting for a full agent reload.
  useEffect(() => {
    const unsubscribe = subscribeActivity(agentId, (event) => {
      if (!IMPROVEMENT_ACTIVITY_LABELS.has(event.label)) return;
      refreshProposal({
        highlight: event.label === "Self-improvement suggested",
      });
    });
    return unsubscribe;
  }, [agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!proposalHighlight) return;
    const timer = window.setTimeout(() => setProposalHighlight(false), 4000);
    return () => window.clearTimeout(timer);
  }, [proposalHighlight, proposal?.id]);

  function run(action: "arm" | "pause" | "resume" | "disarm") {
    if (!onAction || busy) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAction(action);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Strategy action failed");
      }
    });
  }

  function resolveProposal(kind: "approve" | "dismiss") {
    if (!proposal || busy) return;
    setError(null);
    startTransition(async () => {
      try {
        if (kind === "approve") {
          const updated = await approveStrategyImprovement(
            agentId,
            proposal.id,
          );
          onAgentUpdated?.(updated);
        } else {
          await dismissStrategyImprovement(agentId, proposal.id);
        }
        setProposal(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Improvement action failed",
        );
      }
    });
  }

  function setImprovement(patch: {
    enabled?: boolean;
    cadence?: "hourly" | "daily" | "weekly";
  }) {
    if (busy || mode !== "operate" || !strategy) return;
    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateStrategyImprovement(agentId, patch);
        onAgentUpdated?.(updated);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not update improvement",
        );
      }
    });
  }

  if (!strategy) {
    return (
      <section className="shrink-0 space-y-2 rounded-xl bg-[var(--panel)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
          <StatusPill status="none" />
        </div>
        <p className="type-meta text-[var(--muted)]">
          {mode === "operate"
            ? "Shape a recipe-backed plan in chat. When the agent saves a draft, it shows up here for Arm."
            : "Scout first. Switch to Operate when you’re ready to draft and arm a plan."}
        </p>
        <PrimaryButton
          disabled
          title={
            mode === "operate"
              ? "Waiting for a strategy draft"
              : "Switch to Operate after scouting"
          }
        >
          Arm strategy
        </PrimaryButton>
      </section>
    );
  }

  const triggerLabel =
    strategy.trigger.type === "interval"
      ? `Every ${strategy.trigger.intervalSec ?? 60}s`
      : strategy.trigger.type === "event"
        ? `On event: ${strategy.trigger.event ?? "…"}${
            strategy.trigger.intervalSec
              ? ` (poll ${strategy.trigger.intervalSec}s)`
              : ""
          }`
        : strategy.trigger.condition
          ? `Legacy condition: ${strategy.trigger.condition}`
          : "Condition";

  const actionLabel =
    strategy.action.type === "alert"
      ? strategy.action.detail
        ? `Alert — ${strategy.action.detail}`
        : "Alert in-app"
      : strategy.action.detail
        ? `Propose trade — ${strategy.action.detail}`
        : "Propose trade";

  const improvementLabel = !strategy.improvement?.enabled
    ? "Off"
    : strategy.improvement.cadence;

  const needsRecipe = !strategy.recipeId;
  const canArm =
    mode === "operate" &&
    !needsRecipe &&
    (strategy.status === "draft" || strategy.status === "paused");
  const canPause = strategy.status === "running";
  const canResume =
    mode === "operate" && !needsRecipe && strategy.status === "paused";
  const canDisarm =
    strategy.status === "running" || strategy.status === "paused";

  const armHint = needsRecipe
    ? "Re-propose with a recipe in Operate first"
    : mode !== "operate"
      ? "Switch to Operate to arm"
      : spendMode === "observe"
        ? "Arms in observe mode — alerts only, no spend"
        : "Arms with spend enabled — still policy-gated";

  const paramsPreview = Object.entries(strategy.params ?? {})
    .slice(0, 4)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" · ");

  const proposalPreview = proposal
    ? Object.entries(proposal.patch)
        .map(([key, value]) => `${key}→${String(value)}`)
        .join(" · ")
    : "";

  return (
    <section className="shrink-0 space-y-3 rounded-xl bg-[var(--panel)] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
        <StatusPill status={strategy.status} />
      </div>

      <p className="type-ui text-[var(--ink-soft)]">{strategy.summary}</p>

      {needsRecipe ? (
        <p className="type-meta text-[var(--danger)]">
          This draft has no recipe. Switch to Operate and ask the agent to
          propose a recipe-backed plan (e.g. balance threshold or price cross)
          before Arm.
        </p>
      ) : null}

      <dl className="space-y-1.5">
        <div>
          <dt className="type-meta text-[var(--muted)]">Recipe</dt>
          <dd className="type-meta text-[var(--ink-soft)]">
            {recipeLabel(strategy.recipeId)}
          </dd>
        </div>
        {paramsPreview ? (
          <div>
            <dt className="type-meta text-[var(--muted)]">Params</dt>
            <dd className="type-meta truncate text-[var(--ink-soft)]">
              {paramsPreview}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="type-meta text-[var(--muted)]">Trigger</dt>
          <dd className="type-meta text-[var(--ink-soft)]">{triggerLabel}</dd>
        </div>
        <div>
          <dt className="type-meta text-[var(--muted)]">Action</dt>
          <dd className="type-meta text-[var(--ink-soft)]">{actionLabel}</dd>
        </div>
        <div>
          <dt className="type-meta text-[var(--muted)]">Self-improvement</dt>
          <dd className="type-meta text-[var(--ink-soft)]">
            {mode === "operate" && !needsRecipe ? (
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setImprovement({
                      enabled: !strategy.improvement?.enabled,
                    })
                  }
                  className="cursor-pointer underline-offset-2 hover:underline disabled:opacity-40"
                >
                  {strategy.improvement?.enabled ? "On" : "Off"}
                </button>
                {strategy.improvement?.enabled ? (
                  <select
                    value={strategy.improvement.cadence}
                    disabled={busy}
                    onChange={(e) =>
                      setImprovement({
                        cadence: e.target.value as
                          | "hourly"
                          | "daily"
                          | "weekly",
                      })
                    }
                    className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[var(--ink-soft)] outline-none"
                  >
                    <option value="hourly">hourly</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                  </select>
                ) : null}
                {strategy.improvement?.lastRunAt ? (
                  <span className="text-[var(--muted)]">
                    last {formatRelativeTime(strategy.improvement.lastRunAt)}
                  </span>
                ) : strategy.improvement?.enabled ? (
                  <span className="text-[var(--muted)]">not run yet</span>
                ) : null}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span>{improvementLabel}</span>
                {strategy.improvement?.lastRunAt ? (
                  <span className="text-[var(--muted)]">
                    last {formatRelativeTime(strategy.improvement.lastRunAt)}
                  </span>
                ) : null}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="type-meta text-[var(--muted)]">Spend</dt>
          <dd className="type-meta text-[var(--ink-soft)]">
            {spendMode === "observe" ? "observe only" : "spend enabled"}
          </dd>
        </div>
        {strategy.caps.maxTradeUsd !== undefined ? (
          <div>
            <dt className="type-meta text-[var(--muted)]">Cap</dt>
            <dd className="type-meta text-[var(--ink-soft)]">
              ${strategy.caps.maxTradeUsd}
            </dd>
          </div>
        ) : null}
        {strategy.lastTickAt ? (
          <div>
            <dt className="type-meta text-[var(--muted)]">Last tick</dt>
            <dd className="type-meta text-[var(--ink-soft)]">
              {formatTickTime(strategy.lastTickAt)}
            </dd>
          </div>
        ) : strategy.status === "running" ? (
          <div>
            <dt className="type-meta text-[var(--muted)]">Last tick</dt>
            <dd className="type-meta text-[var(--ink-soft)]">
              waiting for first tick
            </dd>
          </div>
        ) : null}
      </dl>

      {proposal ? (
        <div
          className={`space-y-2 rounded-lg border px-3 py-2 transition ${
            proposalHighlight
              ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
              : "border-[var(--line-soft)]"
          }`}
        >
          <p className="type-ui text-[var(--ink)]">Self-improvement suggested</p>
          {proposal.reason ? (
            <p className="type-meta text-[var(--ink-soft)]">{proposal.reason}</p>
          ) : null}
          {proposalPreview ? (
            <p className="type-meta truncate text-[var(--muted)]">
              {proposalPreview}
            </p>
          ) : null}
          <p className="type-meta text-[var(--muted)]">
            Proposed {formatRelativeTime(proposal.createdAt)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => resolveProposal("approve")}
              className="type-ui flex-1 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => resolveProposal("dismiss")}
              className="type-ui flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {strategy.status === "running" ? (
        <p className="type-meta flex items-center gap-1.5 text-[var(--accent)]">
          <span className="working-dot size-1.5 rounded-full bg-[var(--accent)]" />
          Host is running this recipe in the background
        </p>
      ) : null}

      {agentWorking ? (
        <p className="type-meta text-[var(--muted)]">
          Controls pause while the agent is mid-reply.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {strategy.status === "running" ? (
          <PrimaryButton
            disabled={busy || !canPause}
            onClick={() => run("pause")}
            title={agentWorking ? "Wait for the chat turn to finish" : undefined}
          >
            {pending ? "Pausing…" : "Pause strategy"}
          </PrimaryButton>
        ) : strategy.status === "paused" ? (
          <PrimaryButton
            disabled={busy || !canResume}
            onClick={() => run("resume")}
            title={
              mode !== "operate"
                ? "Switch to Operate to resume"
                : needsRecipe
                  ? armHint
                  : agentWorking
                    ? "Wait for the chat turn to finish"
                    : undefined
            }
          >
            {pending ? "Resuming…" : "Resume strategy"}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            disabled={busy || !canArm}
            onClick={() => run("arm")}
            title={
              agentWorking ? "Wait for the chat turn to finish" : armHint
            }
          >
            {pending ? "Arming…" : "Arm strategy"}
          </PrimaryButton>
        )}

        {canDisarm ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run("disarm")}
            className="type-ui w-full cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Disarming…" : "Disarm"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="type-meta text-[var(--danger)]">{error}</p>
      ) : null}
    </section>
  );
}

function StatusPill({
  status,
}: {
  status: "none" | "draft" | "running" | "paused";
}) {
  const styles =
    status === "running"
      ? "text-[var(--accent)]"
      : status === "draft"
        ? "text-[var(--link)]"
        : status === "paused"
          ? "text-[var(--ink-soft)]"
          : "text-[var(--muted)]";

  return (
    <span className={`type-meta capitalize ${styles}`}>
      {status === "running" ? "running" : status}
    </span>
  );
}

function PrimaryButton({
  children,
  disabled,
  title,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="type-ui w-full cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function formatTickTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

function formatRelativeTime(ts: number): string {
  const deltaSec = Math.round((Date.now() - ts) / 1000);
  if (deltaSec < 45) return "just now";
  if (deltaSec < 3600) {
    const mins = Math.max(1, Math.round(deltaSec / 60));
    return `${mins}m ago`;
  }
  if (deltaSec < 86400) {
    const hours = Math.max(1, Math.round(deltaSec / 3600));
    return `${hours}h ago`;
  }
  const days = Math.max(1, Math.round(deltaSec / 86400));
  return `${days}d ago`;
}
