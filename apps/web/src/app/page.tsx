import Link from "next/link";
import { DeskShell } from "@/components/desk/DeskShell";
import { AgentOrb } from "@/components/AgentOrb";
import { getHostUrl, listAgents } from "@/lib/host";
import { formatRelativeTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  let error: string | null = null;

  try {
    agents = await listAgents();
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Could not reach the host. Is it running on :8787?";
  }

  return (
    <DeskShell agents={agents} hostError={error} selectedId={null}>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center border-b border-[var(--line-soft)] px-5 py-3 md:hidden">
          <p className="font-[family-name:var(--font-brand)] text-[1.45rem] leading-none tracking-wide">
            Squadrons
          </p>
        </header>

        {/* Mobile list (rail is desktop-only) */}
        <div className="desk-scroll min-h-0 flex-1 overflow-y-auto md:hidden">
          {error ? (
            <div className="space-y-2 p-5">
              <p className="font-semibold text-[var(--danger)]">Host unreachable</p>
              <p className="text-sm text-[var(--ink-soft)]">{error}</p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                {getHostUrl()}
              </p>
            </div>
          ) : agents.length === 0 ? (
            <EmptyCreate />
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
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-semibold">{agent.name}</span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {formatRelativeTime(agent.updatedAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-[var(--ink-soft)]">
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
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Host unreachable
              </p>
              <p className="text-sm text-[var(--ink-soft)]">{error}</p>
              <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                Expected {getHostUrl()} — run `pnpm dev:host`
              </p>
            </div>
          ) : agents.length === 0 ? (
            <EmptyCreate />
          ) : (
            <div className="max-w-sm space-y-2">
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.02em]">
                Select an agent
              </p>
              <p className="text-sm text-[var(--ink-soft)]">
                Pick one from the list, or create a new scout.
              </p>
            </div>
          )}
        </div>
      </div>
    </DeskShell>
  );
}

function EmptyCreate() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.03em]">
        Create your first agent
      </p>
      <p className="max-w-md text-[var(--ink-soft)]">
        Name it, pick a face, then tell it what to work on — observe by default
        on Base.
      </p>
      <Link
        href="/agents/new"
        className="inline-flex cursor-pointer rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-[var(--canvas)] transition hover:opacity-90"
      >
        New agent
      </Link>
    </div>
  );
}
