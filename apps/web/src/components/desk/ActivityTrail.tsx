"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { displayActivityLabel } from "@squadrons/shared";
import {
  listActivity,
  subscribeActivity,
  type ActivityEvent,
} from "@/lib/host";
import { useToast } from "@/components/Toast";

type DisplayStep = ActivityEvent & {
  displayLabel: string;
  /** Consecutive identical loud events collapsed into one row. */
  count: number;
};

/** How many rows to show before asking for more. */
const PREVIEW_COUNT = 4;
/** Raw rows per host fetch (includes quiet checks). */
const PAGE_SIZE = 40;

function isQuietCheck(event: ActivityEvent): boolean {
  if (event.source !== "strategy") return false;
  const label = event.label.trim();
  return (
    label === "Strategy tick" ||
    label === "Checked strategy" ||
    label === "Watched event" ||
    label === "Event watch armed" ||
    label.startsWith("Checked ")
  );
}

function toDisplayStep(event: ActivityEvent): DisplayStep | null {
  const raw = displayActivityLabel(event, { done: true });
  if (!raw) return null;
  return {
    ...event,
    displayLabel: humanizeActivityText(raw),
    detail: event.detail ? humanizeActivityText(event.detail) : event.detail,
    count: 1,
  };
}

/** Soft-rewrite legacy dry-run / spend wording for older stored rows. */
function humanizeActivityText(text: string): string {
  return text
    .replace(/\bDry-run\b/gi, "Paper")
    .replace(/\bdry-run\b/g, "paper")
    .replace(/^Spend set to observe$/i, "Run mode set to Observe")
    .replace(/^Spend enabled$/i, "Run mode set to Paper");
}

function sameActivityRow(a: DisplayStep, b: DisplayStep): boolean {
  return (
    a.displayLabel === b.displayLabel &&
    (a.detail ?? "") === (b.detail ?? "") &&
    a.kind === b.kind
  );
}

/** Newest-first list → collapse back-to-back identical labels. */
function collapseConsecutive(steps: DisplayStep[]): DisplayStep[] {
  const out: DisplayStep[] = [];
  for (const step of steps) {
    const prev = out[out.length - 1];
    if (prev && sameActivityRow(prev, step)) {
      prev.count += 1;
      continue;
    }
    out.push({ ...step, count: 1 });
  }
  return out;
}

/** Quiet checks → one “last check”; loud events newest-first, deduped. */
function buildSteps(events: ActivityEvent[]): {
  lastCheck: DisplayStep | null;
  steps: DisplayStep[];
} {
  let lastCheck: DisplayStep | null = null;
  const loud: DisplayStep[] = [];

  for (const event of events) {
    if (event.source === "chat") continue;
    const step = toDisplayStep(event);
    if (!step) continue;
    if (isQuietCheck(event)) {
      lastCheck = step;
      continue;
    }
    if (event.source === "strategy" || event.source === "system") {
      loud.push(step);
    }
  }

  return {
    lastCheck,
    steps: collapseConsecutive([...loud].reverse()),
  };
}

export function ActivityTrail({
  agentId,
  agentName,
  live = false,
  onLiveEvent,
}: {
  agentId: string;
  agentName: string;
  /** True only while the strategy is armed/running. */
  live?: boolean;
  onLiveEvent?: (event: ActivityEvent) => void;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PREVIEW_COUNT);
  const [loadingMore, startLoadMore] = useTransition();
  const toast = useToast();
  const onLiveEventRef = useRef(onLiveEvent);
  onLiveEventRef.current = onLiveEvent;

  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    setHasMore(false);
    setVisibleCount(PREVIEW_COUNT);

    void listActivity(agentId, {
      limit: PAGE_SIZE,
      sources: ["strategy", "system"],
    })
      .then((page) => {
        if (cancelled) return;
        setEvents(page.activity);
        setHasMore(page.hasMore);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      });

    const unsubscribe = subscribeActivity(agentId, (event) => {
      if (event.source === "chat") return;
      if (!displayActivityLabel(event, { done: false })) return;
      onLiveEventRef.current?.(event);
      setEvents((prev) => {
        if (prev.some((row) => row.id === event.id)) return prev;
        return [...prev, event];
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [agentId, toast]);

  const { lastCheck, steps } = useMemo(() => buildSteps(events), [events]);
  const visible = steps.slice(0, visibleCount);
  const canRevealMore = visibleCount < steps.length;
  const canLoadOlder = !canRevealMore && hasMore;

  function onShowMore() {
    if (canRevealMore) {
      setVisibleCount((n) => Math.min(n + PREVIEW_COUNT, steps.length));
      return;
    }
    if (!canLoadOlder || loadingMore) return;

    const oldest = events[0];
    if (!oldest) return;

    startLoadMore(async () => {
      try {
        const page = await listActivity(agentId, {
          limit: PAGE_SIZE,
          before: oldest.createdAt,
          beforeId: oldest.id,
          sources: ["strategy", "system"],
        });
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          const older = page.activity.filter((e) => !seen.has(e.id));
          return [...older, ...prev];
        });
        setHasMore(page.hasMore);
        setVisibleCount((n) => n + PREVIEW_COUNT);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="type-title">Strategy activity</h3>
        {live ? (
          <span className="type-meta flex items-center gap-1.5 font-medium !text-[var(--accent)]">
            <span className="working-dot size-1.5 rounded-full bg-[var(--accent)]" />
            Live
          </span>
        ) : null}
      </div>

      {lastCheck ? (
        <p className="type-meta mt-2 truncate text-[var(--muted)]">
          Last check {formatRelative(lastCheck.createdAt)}
        </p>
      ) : null}

      {steps.length === 0 ? (
        <p className="type-ui mt-3 text-[var(--muted)]">
          {live
            ? `${agentName} is checking — alerts and fills show here.`
            : `Alerts, paper fills, and desk changes show here.`}
        </p>
      ) : (
        <>
          <ol className="mt-3 space-y-0">
            {visible.map((event, index) => {
              const newest = index === 0;
              const moreBelow = index < visible.length - 1 || canRevealMore || canLoadOlder;
              const countSuffix =
                event.count > 1 ? ` · ×${event.count}` : "";
              return (
                <li
                  key={event.id}
                  className="grid grid-cols-[12px_minmax(0,1fr)_auto] gap-x-2.5 py-2"
                >
                  <span className="relative flex justify-center pt-1.5">
                    {moreBelow ? (
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
                  <div className="min-w-0">
                    <p
                      className={`type-ui leading-snug ${
                        newest && live
                          ? "text-[var(--ink)]"
                          : event.kind === "error"
                            ? "text-[var(--danger)]"
                            : "text-[var(--ink-soft)]"
                      }`}
                    >
                      {event.displayLabel}
                      {countSuffix}
                    </p>
                    {event.detail ? (
                      <p className="type-meta mt-0.5 truncate text-[var(--muted)]">
                        {event.detail}
                      </p>
                    ) : null}
                  </div>
                  <time
                    className="type-data pt-0.5 text-[var(--muted)]"
                    dateTime={new Date(event.createdAt).toISOString()}
                    title={new Date(event.createdAt).toLocaleString()}
                  >
                    {formatRelative(event.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
          {canRevealMore || canLoadOlder ? (
            <button
              type="button"
              className="type-meta mt-1 self-start text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-50"
              disabled={loadingMore}
              onClick={onShowMore}
            >
              {loadingMore
                ? "Loading…"
                : canRevealMore
                  ? "Show more"
                  : "Load older"}
            </button>
          ) : null}
        </>
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
