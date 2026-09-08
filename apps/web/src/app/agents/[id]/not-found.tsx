import Link from "next/link";
import { DeskShell } from "@/components/desk/DeskShell";
import { listAgents } from "@/lib/host";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  let agents: Awaited<ReturnType<typeof listAgents>> = [];
  try {
    agents = await listAgents();
  } catch {
    agents = [];
  }

  return (
    <DeskShell agents={agents} selectedId={null}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Agent not found
        </p>
        <Link
          href="/"
          className="text-sm text-[var(--link)] transition hover:underline"
        >
          Back to agents
        </Link>
      </div>
    </DeskShell>
  );
}
