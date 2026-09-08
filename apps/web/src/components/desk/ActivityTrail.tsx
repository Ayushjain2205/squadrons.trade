"use client";

import { useEffect, useMemo, useState } from "react";
import { displayActivityLabel } from "@squadrons/shared";
import {
  listActivity,
  subscribeActivity,
  type ActivityEvent,
} from "@/lib/host";

type DisplayStep = ActivityEvent & { displayLabel: string };

function toDisplayStep(
  event: ActivityEvent,
  done: boolean,
): DisplayStep | null {
  const displayLabel = displayActivityLabel(event, { done });
  if (!displayLabel) return null;
  return { ...event, displayLabel };
}

/**
 * One line per logical step. Collapse same tool / same present-verb nearby.
 * Uses present-tense keys for collapse so "Looking…" and "Looked…" merge.
 */
function collapseSteps(
  events: ActivityEvent[],
  live: boolean,
): DisplayStep[] {
  const out: Array<{ event: ActivityEvent; presentKey: string }> = [];

  for (const event of events) {
    const presentKey = displayActivityLabel(event, { done: false });
    if (!presentKey) continue;
    const last = out[out.length - 1];
    if (last) {
      const sameTool =
        Boolean(last.event.toolName) &&
        last.event.toolName === event.toolName;
      const sameVerb = last.presentKey === presentKey;
      const close = event.createdAt - last.event.createdAt < 120_000;
      if ((sameTool || sameVerb) && close) {
        out[out.length - 1] = { event, presentKey };
        continue;
      }
    }
    out.push({ event, presentKey });
  }

  // Newest last in `out`. While live, only the newest step stays present tense.
  return out.map((row, index) => {
    const isNewest = index === out.length - 1;
    const done = !(live && isNewest);
    return toDisplayStep(row.event, done)!;
  });
}

export function ActivityTrail({
  agentId,
  agentName,
  live = false,
}: {
  agentId: string;
  agentName: string;
  live?: boolean;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    setError(null);

    void listActivity(agentId)
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    const unsubscribe = subscribeActivity(agentId, (event) => {
      if (!displayActivityLabel(event, { done: false })) return;
      setEvents((prev) => {
        if (prev.some((row) => row.id === event.id)) return prev;
        return [...prev, event];
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [agentId]);

  const steps = useMemo(
    () => collapseSteps(events, live).reverse().slice(0, 24),
    [events, live],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-[-0.01em]">Activity</h3>
        {live ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)]">
            <span className="working-dot size-1.5 rounded-full bg-[var(--accent)]" />
            Live
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>
      ) : null}

      {steps.length === 0 && !error ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {live
            ? `${agentName} is working…`
            : `When ${agentName} works, steps show up here.`}
        </p>
      ) : (
        <ol className="mt-4 space-y-0">
          {steps.map((event, index) => {
            const newest = index === 0;
            return (
              <li
                key={event.id}
                className="grid grid-cols-[12px_minmax(0,1fr)_auto] gap-x-2.5 py-2"
              >
                <span className="relative flex justify-center pt-1.5">
                  {index < steps.length - 1 ? (
                    <span
                      className="absolute top-3 bottom-[-0.5rem] w-px bg-[var(--line-soft)]"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={`relative z-[1] size-1.5 rounded-full ${
                      newest && live
                        ? "working-dot bg-[var(--accent)]"
                        : event.kind === "error"
                          ? "bg-[var(--danger)]"
                          : "bg-[var(--muted)]"
                    }`}
                    aria-hidden
                  />
                </span>
                <p
                  className={`min-w-0 text-sm leading-snug ${
                    newest && live
                      ? "text-[var(--ink)]"
                      : event.kind === "error"
                        ? "text-[var(--danger)]"
                        : "text-[var(--ink-soft)]"
                  }`}
                >
                  {event.displayLabel}
                </p>
                <time
                  className="pt-0.5 font-[family-name:var(--font-mono)] text-[10px] tabular-nums text-[var(--muted)]"
                  dateTime={new Date(event.createdAt).toISOString()}
                  title={new Date(event.createdAt).toLocaleString()}
                >
                  {formatRelative(event.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatRelative(ts: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 8) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
