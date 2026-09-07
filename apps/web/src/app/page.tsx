import Link from "next/link";
import { AgentOrb } from "@/components/AgentOrb";
import { AppShell } from "@/components/AppShell";
import { getHostUrl, listAgents } from "@/lib/host";

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
    <AppShell
      action={
        <Link
          href="/agents/new"
          className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#0c1210] transition hover:brightness-110"
        >
          New agent
        </Link>
      }
    >
      <div className="rise space-y-8">
        <div className="max-w-2xl space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.03em] text-[var(--ink)] sm:text-5xl">
            My Agents
          </h1>
          <p className="text-lg text-[var(--ink-soft)]">
            Named crypto agents on Base. Observe by default — spend is per
            agent when you turn it on.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[var(--danger)]/40 bg-[#2a1818] px-5 py-4 text-[var(--danger)]">
            <p className="font-medium">Host unreachable</p>
            <p className="mt-1 text-sm opacity-90">{error}</p>
            <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
              Expected {getHostUrl()} — run `pnpm dev:host`
            </p>
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-6 py-14 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em]">
              No agents yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-[var(--ink-soft)]">
              Create one with a name, face, and description — then tell it what
              to do.
            </p>
            <Link
              href="/agents/new"
              className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[#0c1210] transition hover:brightness-110"
            >
              Create your first agent
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex items-center gap-4 py-5 transition hover:bg-[var(--panel)]"
                >
                  <AgentOrb id={agent.avatarId} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="truncate font-[family-name:var(--font-display)] text-xl tracking-[-0.02em]">
                        {agent.name}
                      </h2>
                      <StatusPill status={agent.status} />
                      <SpendPill mode={agent.spendMode} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[var(--ink-soft)]">
                      {agent.description}
                    </p>
                    <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                      Base · {agent.chainId}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-md bg-[var(--accent-dim)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
      {status.replace("_", " ")}
    </span>
  );
}

function SpendPill({ mode }: { mode: string }) {
  const observe = mode === "observe";
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        observe
          ? "bg-[var(--line)] text-[var(--muted)]"
          : "bg-[#3d3218] text-[var(--warn)]"
      }`}
    >
      {observe ? "observe" : "spend on"}
    </span>
  );
}
