"use client";

import type { Strategy } from "@squadrons/shared";

export function StrategyCard({
  mode,
  strategy,
}: {
  mode: "scout" | "operate";
  strategy: Strategy | null;
}) {
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
        <ArmButton disabled title="Arming comes next — draft a strategy first" />
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
      </dl>

      <ArmButton
        disabled
        title={
          strategy.status === "draft"
            ? "Arming ships next — draft is ready"
            : "Strategy controls ship next"
        }
      />
    </section>
  );
}

function ArmButton({
  disabled,
  title,
}: {
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className="type-ui w-full cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      Arm strategy
    </button>
  );
}
