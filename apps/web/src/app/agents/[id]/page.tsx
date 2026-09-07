import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentOrb } from "@/components/AgentOrb";
import { AppShell } from "@/components/AppShell";
import { getAgent } from "@/lib/host";
import { AgentRunner } from "./AgentRunner";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = await params;

  let agent;
  try {
    agent = await getAgent(id);
  } catch {
    notFound();
  }

  return (
    <AppShell
      action={
        <Link
          href="/"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          All agents
        </Link>
      }
    >
      <div className="rise space-y-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <AgentOrb id={agent.avatarId} size={96} />
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.03em]">
              {agent.name}
            </h1>
            <p className="max-w-2xl text-lg text-[var(--ink-soft)]">
              {agent.description}
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide">
              <span className="rounded-md bg-[var(--accent-dim)] px-2 py-0.5 text-[var(--accent)]">
                {agent.status.replace("_", " ")}
              </span>
              <span className="rounded-md bg-[var(--line)] px-2 py-0.5 text-[var(--muted)]">
                {agent.spendMode === "observe" ? "observe" : "spend on"}
              </span>
              <span className="rounded-md bg-[var(--panel)] px-2 py-0.5 font-[family-name:var(--font-mono)] normal-case tracking-normal text-[var(--muted)]">
                Base · {agent.chainId}
              </span>
            </div>
          </div>
        </div>

        <AgentRunner
          agentId={agent.id}
          initialSessionId={agent.lastDshSessionId}
        />
      </div>
    </AppShell>
  );
}
