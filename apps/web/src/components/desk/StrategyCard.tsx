"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  describeRecipePlan,
  describeStrategySchedule,
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    setAdvancedOpen(false);
  }, [agentId, strategy?.updatedAt, strategy?.params, strategy?.improvement?.lastRunAt]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh when strategy identity/params/improve change

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
      <section className="shrink-0 space-y-3 rounded-xl bg-[var(--panel)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
          <StatusPill status="none" />
        </div>
        <p className="type-meta text-[var(--muted)]">
          {mode === "operate"
            ? "Draft a plan in chat. When it’s saved, Arm it here."
            : "Scout first. Switch to Operate when you’re ready to arm a plan."}
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

  const needsRecipe = !strategy.recipeId;
  const planLine =
    describeRecipePlan(strategy.recipeId, strategy.params) ?? strategy.summary;
  const schedule = describeStrategySchedule(strategy.trigger);
  const spendLabel =
    spendMode === "observe" ? "Observe only" : "Spend enabled";
  const actionVerb =
    strategy.action.type === "propose_trade" ? "Propose trade" : "Alert";

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
    ? "Ask Operate for a recipe-backed plan first"
    : mode !== "operate"
      ? "Switch to Operate to arm"
      : spendMode === "observe"
        ? "Arms in observe mode — alerts only"
        : "Arms with spend enabled — still policy-gated";

  const proposalPreview = proposal
    ? Object.entries(proposal.patch)
        .map(([key, value]) => `${key} → ${String(value)}`)
        .join(" · ")
    : "";

  const metaBits = [
    schedule,
    spendLabel,
    strategy.lastTickAt
      ? `Last check ${formatRelativeTime(strategy.lastTickAt)}`
      : strategy.status === "running"
        ? "Waiting for first check"
        : null,
  ].filter(Boolean) as string[];

  return (
    <section className="shrink-0 space-y-3 rounded-xl bg-[var(--panel)] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
        <StatusPill status={strategy.status} />
      </div>

      <div className="space-y-1">
        <p className="type-ui leading-snug text-[var(--ink)]">{planLine}</p>
        {strategy.action.type === "propose_trade" || strategy.action.detail ? (
          <p className="type-meta text-[var(--muted)]">
            {actionVerb}
            {strategy.action.detail ? ` — ${strategy.action.detail}` : null}
          </p>
        ) : null}
      </div>

      {needsRecipe ? (
        <p className="type-meta text-[var(--danger)]">
          This draft has no recipe. In Operate, ask for a recipe-backed plan
          before Arm.
        </p>
      ) : null}

      {metaBits.length > 0 ? (
        <p className="type-meta text-[var(--muted)]">{metaBits.join(" · ")}</p>
      ) : null}

      {proposal ? (
        <div
          className={`space-y-2 rounded-lg border px-3 py-2 transition ${
            proposalHighlight
              ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
              : "border-[var(--line-soft)]"
          }`}
        >
          <p className="type-ui text-[var(--ink)]">Needs your decision</p>
          {proposal.reason ? (
            <p className="type-meta text-[var(--ink-soft)]">{proposal.reason}</p>
          ) : null}
          {proposalPreview ? (
            <p className="type-meta truncate text-[var(--muted)]">
              {proposalPreview}
            </p>
          ) : null}
          <p className="type-meta text-[var(--muted)]">
            Suggested {formatRelativeTime(proposal.createdAt)}
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
            {pending ? "Pausing…" : "Pause"}
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
            {pending ? "Resuming…" : "Resume"}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            disabled={busy || !canArm}
            onClick={() => run("arm")}
            title={
              agentWorking ? "Wait for the chat turn to finish" : armHint
            }
          >
            {pending ? "Arming…" : "Arm"}
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

      <div>
        <button
          type="button"
          className="type-meta text-[var(--muted)] hover:text-[var(--ink)]"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? "Hide details" : "Details"}
        </button>
        {advancedOpen ? (
          <div className="mt-2 space-y-2 border-t border-[var(--line-soft)] pt-2">
            <div>
              <p className="type-meta text-[var(--muted)]">Self-improvement</p>
              {mode === "operate" && !needsRecipe ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setImprovement({
                        enabled: !strategy.improvement?.enabled,
                      })
                    }
                    className="type-meta cursor-pointer text-[var(--ink-soft)] underline-offset-2 hover:underline disabled:opacity-40"
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
                      className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 type-meta text-[var(--ink-soft)] outline-none"
                    >
                      <option value="hourly">hourly</option>
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                    </select>
                  ) : null}
                  {strategy.improvement?.lastRunAt ? (
                    <span className="type-meta text-[var(--muted)]">
                      last {formatRelativeTime(strategy.improvement.lastRunAt)}
                    </span>
                  ) : strategy.improvement?.enabled ? (
                    <span className="type-meta text-[var(--muted)]">
                      not run yet
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="type-meta mt-0.5 text-[var(--ink-soft)]">
                  {strategy.improvement?.enabled
                    ? strategy.improvement.cadence
                    : "Off"}
                  {strategy.improvement?.lastRunAt
                    ? ` · last ${formatRelativeTime(strategy.improvement.lastRunAt)}`
                    : null}
                </p>
              )}
            </div>
            {strategy.caps.maxTradeUsd !== undefined ? (
              <div>
                <p className="type-meta text-[var(--muted)]">Trade cap</p>
                <p className="type-meta text-[var(--ink-soft)]">
                  ${strategy.caps.maxTradeUsd}
                </p>
              </div>
            ) : null}
            {strategy.summary &&
            describeRecipePlan(strategy.recipeId, strategy.params) &&
            strategy.summary !== planLine ? (
              <div>
                <p className="type-meta text-[var(--muted)]">Agent note</p>
                <p className="type-meta text-[var(--ink-soft)]">
                  {strategy.summary}
                </p>
              </div>
            ) : null}
          </div>
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
      {status === "none" ? "none" : status}
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
