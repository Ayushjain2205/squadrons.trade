"use client";

import { useEffect, useState } from "react";
import {
  listActivity,
  subscribeActivity,
  type ActivityEvent,
} from "@/lib/host";

export function ActivityTrail({ agentId }: { agentId: string }) {
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

  return (
    <section className="mt-6 space-y-2">
      <h3 className="text-sm font-semibold tracking-[-0.01em]">Activity</h3>
      {error ? (
        <p className="text-xs text-[var(--danger,#f87171)]">{error}</p>
      ) : null}
      {events.length === 0 && !error ? (
        <p className="text-sm text-[var(--muted)]">
          Tool use and turn markers show up here while the agent works.
        </p>
      ) : (
        <ol className="space-y-2">
          {[...events].reverse().map((event) => (
            <li
              key={event.id}
              className="border-l border-[var(--line-soft)] pl-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-[var(--ink-soft)]">{event.label}</p>
                <time
                  className="shrink-0 font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]"
                  dateTime={new Date(event.createdAt).toISOString()}
                >
                  {formatClock(event.createdAt)}
                </time>
              </div>
              {event.detail ? (
                <p className="mt-0.5 line-clamp-2 font-[family-name:var(--font-mono)] text-[11px] leading-snug text-[var(--muted)]">
                  {event.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
