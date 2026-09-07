import {
  AGENT_AVATARS,
  DEFAULT_POLICY,
  SUPPORTED_CHAINS,
} from "@squadrons/shared";

const hostUrl =
  process.env.NEXT_PUBLIC_HOST_URL ?? "http://localhost:8787";

export default function Home() {
  const chain = SUPPORTED_CHAINS[0];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-10 px-6 py-16">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            squadrons.trade
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            My Agents
          </h1>
          <p className="max-w-xl text-lg text-zinc-400">
            Named crypto agents with goals, memory, and observe-first spend
            controls. Scaffold is live — agent create flow comes next.
          </p>
        </header>

        <section className="space-y-4 border-t border-zinc-800 pt-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            v1 defaults
          </h2>
          <ul className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              Chain: {chain.name} ({chain.chainId})
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              Max auto trade: ${DEFAULT_POLICY.maxTradeUsd}
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              Avatars: {AGENT_AVATARS.length} orb faces
            </li>
            <li className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              Host: {hostUrl}
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
