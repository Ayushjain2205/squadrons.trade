"use client";

import { useState, useTransition } from "react";
import { runAgent, type DshTurnResult } from "@/lib/host";

export function AgentRunner({
  agentId,
  initialSessionId,
}: {
  agentId: string;
  initialSessionId: string | null;
}) {
  const [prompt, setPrompt] = useState(
    "Introduce yourself in one short sentence, then ask what I want you to do.",
  );
  const [resume, setResume] = useState(Boolean(initialSessionId));
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [turn, setTurn] = useState<DshTurnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRun(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await runAgent(agentId, prompt, resume && Boolean(sessionId));
        setTurn(result.turn);
        setSessionId(result.agent.lastDshSessionId);
        setResume(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Run failed");
      }
    });
  }

  return (
    <section className="space-y-4 border-t border-[var(--line)] pt-8">
      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-[-0.02em]">
        Talk to agent
      </h2>
      <p className="text-[var(--ink-soft)]">
        Sends one dsh turn in this agent&apos;s workspace. Full goal intake UI
        comes next — this is the live bridge.
      </p>

      <form onSubmit={onRun} className="space-y-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          required
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3"
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={resume && Boolean(sessionId)}
              disabled={!sessionId}
              onChange={(e) => setResume(e.target.checked)}
            />
            Resume last session
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Running…" : "Run turn"}
          </button>
        </div>
      </form>

      {sessionId ? (
        <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
          session · {sessionId}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-[#2a1818] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {turn ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Response
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[var(--ink)]">
            {turn.finalResponse || "(empty response)"}
          </p>
          <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
            {turn.provider}/{turn.model} · {turn.eventCount} events
          </p>
        </div>
      ) : null}
    </section>
  );
}
