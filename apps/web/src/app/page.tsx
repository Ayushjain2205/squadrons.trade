"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeskShell } from "@/components/desk/DeskShell";
import { EmptyAgents } from "@/components/desk/EmptyAgents";
import { HomeCenterSkeleton } from "@/components/desk/DeskSkeleton";
import { AgentOrb } from "@/components/AgentOrb";
import { BrandMark } from "@/components/BrandMark";
import { getHostUrl, listAgents, type AgentWithWorkspace } from "@/lib/host";
import { formatRelativeTime } from "@/lib/time";
import { useToast } from "@/components/Toast";

export default function HomePage() {
  const [agents, setAgents] = useState<AgentWithWorkspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void listAgents()
      .then((rows) => {
        if (!cancelled) {
          setAgents(rows);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAgents([]);
          const message =
            err instanceof Error
              ? err.message
              : "Could not reach the host. Is it running on :8787?";
          setError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (!ready) {
    return (
      <DeskShell agents={[]} selectedId={null} loading>
        <HomeCenterSkeleton />
      </DeskShell>
    );
  }

  return (
    <DeskShell agents={agents} hostError={error} selectedId={null}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center border-b border-[var(--line-soft)] px-5 py-3 md:hidden">
          <BrandMark
            className="pt-0"
            textClassName="text-[length:var(--text-brand-rail-sm)]"
            orbSize={32}
          />
        </header>

        {/* Mobile list (rail is desktop-only) */}
        <div className="desk-scroll min-h-0 flex-1 overflow-y-auto md:hidden">
          {error ? (
            <div className="space-y-2 p-5">
              <p className="type-name text-[var(--danger)]">Host unreachable</p>
              <p className="type-ui text-[var(--ink-soft)]">{error}</p>
              <p className="type-data text-[var(--muted)]">{getHostUrl()}</p>
            </div>
          ) : agents.length === 0 ? (
            <EmptyAgents />
          ) : (
            <ul className="divide-y divide-[var(--line-soft)]">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/agents/${agent.id}`}
                    className="flex gap-3 px-4 py-3.5 transition active:bg-[var(--panel)]"
                  >
                    <AgentOrb
                      id={agent.avatarId}
                      colorId={agent.colorId}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="type-name truncate">{agent.name}</span>
                        <span className="type-meta shrink-0">
                          {formatRelativeTime(agent.updatedAt)}
                        </span>
                      </div>
                      <p className="type-meta mt-0.5 line-clamp-1 !text-[var(--ink-soft)]">
                        {agent.description}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Desktop empty / select prompt */}
        <div className="hidden min-h-0 flex-1 flex-col items-center justify-center px-6 text-center md:flex">
          {error ? (
            <div className="max-w-md space-y-3">
              <p className="type-display">Host unreachable</p>
              <p className="type-ui text-[var(--ink-soft)]">{error}</p>
              <p className="type-data text-[var(--muted)]">
                Expected {getHostUrl()} — run `pnpm dev:host`
              </p>
            </div>
          ) : agents.length === 0 ? (
            <EmptyAgents />
          ) : (
            <div className="max-w-sm space-y-2">
              <p className="type-display">Select an agent</p>
              <p className="type-ui text-[var(--ink-soft)]">
                Pick one from the list, or create a new scout.
              </p>
            </div>
          )}
        </div>
      </div>
    </DeskShell>
  );
}
