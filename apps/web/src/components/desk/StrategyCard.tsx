"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { Strategy } from "@squadrons/shared";
import type { AgentWithWorkspace } from "@/lib/host";

export function StrategyCard({
  mode,
  strategy,
  onAction,
}: {
  mode: "scout" | "operate";
  strategy: Strategy | null;
  onAction?: (
    action: "arm" | "pause" | "resume" | "disarm",
  ) => Promise<AgentWithWorkspace>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: "arm" | "pause" | "resume" | "disarm") {
    if (!onAction || pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await onAction(action);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Strategy action failed");
      }
    });
  }

  if (!strategy) {
    return (
      <section className="shrink-0 space-y-2 rounded-xl bg-[var(--panel)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
          <span className="type-meta text-[var(--muted)]">none</span>
        </div>
        <p className="type-meta text-[var(--muted)]">
          {mode === "operate"
            ? "Define a plan in chat — when it’s concrete, the draft lands here."
            : "Scout first, then switch to Operate to draft and arm."}
        </p>
        <PrimaryButton disabled title="Draft a strategy first">
          Arm strategy
        </PrimaryButton>
      </section>
    );
  }

  const triggerLabel =
    strategy.trigger.type === "interval"
      ? `Every ${strategy.trigger.intervalSec ?? 60}s`
      : strategy.trigger.condition
        ? `When: ${strategy.trigger.condition}`
        : "Condition";

  const actionLabel =
    strategy.action.type === "alert"
      ? strategy.action.detail
        ? `Alert — ${strategy.action.detail}`
        : "Alert"
      : strategy.action.detail
        ? `Propose trade — ${strategy.action.detail}`
        : "Propose trade";

  const canArm =
    mode === "operate" &&
    (strategy.status === "draft" || strategy.status === "paused");
  const canPause = strategy.status === "running";
  const canResume = mode === "operate" && strategy.status === "paused";
  const canDisarm =
    strategy.status === "running" || strategy.status === "paused";

  return (
    <section className="shrink-0 space-y-3 rounded-xl bg-[var(--panel)] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-ui text-[var(--ink)]">Strategy</h3>
        <span className="type-meta capitalize text-[var(--ink-soft)]">
          {strategy.status}
        </span>
      </div>

      <p className="type-ui text-[var(--ink-soft)]">{strategy.summary}</p>

      <dl className="space-y-1.5">
        <div>
          <dt className="type-meta text-[var(--muted)]">Trigger</dt>
          <dd className="type-meta text-[var(--ink-soft)]">{triggerLabel}</dd>
        </div>
        <div>
          <dt className="type-meta text-[var(--muted)]">Action</dt>
          <dd className="type-meta text-[var(--ink-soft)]">{actionLabel}</dd>
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
            <dd className="type-meta text-[var(--ink-soft)]">pending</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-2">
        {strategy.status === "running" ? (
          <PrimaryButton
            disabled={pending || !canPause}
            onClick={() => run("pause")}
          >
            {pending ? "Working…" : "Pause strategy"}
          </PrimaryButton>
        ) : strategy.status === "paused" ? (
          <PrimaryButton
            disabled={pending || !canResume}
            onClick={() => run("resume")}
            title={
              mode !== "operate"
                ? "Switch to Operate to resume"
                : undefined
            }
          >
            {pending ? "Working…" : "Resume strategy"}
          </PrimaryButton>
        ) : (
          <PrimaryButton
            disabled={pending || !canArm}
            onClick={() => run("arm")}
            title={
              mode !== "operate"
                ? "Switch to Operate to arm"
                : undefined
            }
          >
            {pending ? "Working…" : "Arm strategy"}
          </PrimaryButton>
        )}

        {canDisarm ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run("disarm")}
            className="type-ui w-full cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disarm
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="type-meta text-[var(--danger)]">{error}</p>
      ) : null}
    </section>
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
