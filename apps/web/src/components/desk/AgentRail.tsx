"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { AgentOrb } from "@/components/AgentOrb";
import { BrandMark } from "@/components/BrandMark";
import { getMe, type AgentWithWorkspace } from "@/lib/host";
import { formatRelativeTime } from "@/lib/time";

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AgentRail({
  agents,
  selectedId,
  hostError,
}: {
  agents: AgentWithWorkspace[];
  selectedId?: string | null;
  hostError?: string | null;
}) {
  const [query, setQuery] = useState("");
  const { logout } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    const fromClient = embedded?.address ?? wallets[0]?.address ?? null;
    if (fromClient) {
      setWalletAddress(fromClient);
      return;
    }
    void getMe()
      .then((me) => setWalletAddress(me.walletAddress))
      .catch(() => setWalletAddress(null));
  }, [wallets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [agents, query]);

  return (
    <aside className="flex h-full w-[min(100%,var(--rail-left))] shrink-0 flex-col border-r border-[var(--line-soft)] bg-[var(--rail)] max-md:absolute max-md:z-20 max-md:hidden md:relative md:flex">
      <div className="shrink-0 space-y-3 p-3 pb-2">
        <BrandMark />
        <label className="relative block">
          <span className="sr-only">Search agents</span>
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="type-ui w-full rounded-xl border border-transparent bg-[var(--panel)] py-2.5 pl-10 pr-3 text-[var(--ink)] placeholder:text-[var(--muted)] transition focus:border-[var(--line)] focus:outline-none"
          />
        </label>
      </div>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {hostError ? (
          <p className="type-meta m-2 rounded-xl bg-[#2a1818] px-3 py-2 !text-[var(--danger)]">
            {hostError}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="type-ui px-3 py-6 text-[var(--muted)]">
            {agents.length === 0 ? "No agents yet." : "No matches."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((agent) => {
              const active = agent.id === selectedId;
              const preview = agent.description.trim() || "No description";
              return (
                <li key={agent.id}>
                  <Link
                    href={`/agents/${agent.id}`}
                    className={`flex cursor-pointer gap-3 rounded-xl px-2.5 py-2.5 transition ${
                      active
                        ? "bg-[var(--panel-2)]"
                        : "hover:bg-[var(--panel)]"
                    }`}
                  >
                    <AgentOrb
                      id={agent.avatarId}
                      colorId={agent.colorId}
                      size={40}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="type-name truncate">{agent.name}</span>
                        <span className="type-meta shrink-0">
                          {formatRelativeTime(agent.updatedAt)}
                        </span>
                      </div>
                      <p className="type-meta mt-0.5 line-clamp-1 !text-[var(--ink-soft)]">
                        {preview}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-1 border-t border-[var(--line-soft)] p-3">
        <Link
          href="/agents/new"
          className="type-ui flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[var(--ink-soft)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--panel-2)] text-lg leading-none">
            +
          </span>
          New agent
        </Link>
        <div className="type-ui flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[var(--muted)]">
          <span className="type-meta flex size-8 items-center justify-center rounded-full bg-[var(--panel-2)] font-semibold !text-[var(--ink-soft)]">
            0x
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-data truncate !text-[length:var(--text-ui)] font-medium !text-[var(--ink-soft)]">
              {walletAddress ? truncateAddress(walletAddress) : "No wallet yet"}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="type-meta cursor-pointer transition hover:!text-[var(--ink)]"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
