"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  sendMessage,
  type AgentMessage,
  type AgentWithWorkspace,
} from "@/lib/host";

export function AgentChat({
  agent: initialAgent,
  initialMessages,
}: {
  agent: AgentWithWorkspace;
  initialMessages: AgentMessage[];
}) {
  const router = useRouter();
  const [agent, setAgent] = useState(initialAgent);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function onSend(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;

    setError(null);
    setDraft("");
    // Optimistic user bubble
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        agentId: agent.id,
        role: "user",
        content,
        createdAt: Date.now(),
      },
    ]);

    startTransition(async () => {
      try {
        const result = await sendMessage(agent.id, content);
        setAgent(result.agent);
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
          return [...withoutOptimistic, ...result.messages];
        });
        router.refresh();
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(content);
        setError(err instanceof Error ? err.message : "Send failed");
      }
    });
  }

  const placeholder = agent.currentGoal
    ? "Steer the agent, ask for a status update…"
    : "Tell the agent what to work on…";

  return (
    <section className="flex min-h-[28rem] flex-col border-t border-[var(--line)] pt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em]">
            Chat
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {agent.currentGoal
              ? `Goal: ${agent.currentGoal}`
              : "No goal yet — your first message becomes the goal."}
          </p>
        </div>
        <div className="flex gap-2 text-xs font-medium uppercase tracking-wide">
          <span className="rounded-md bg-[var(--accent-dim)] px-2 py-0.5 text-[var(--accent)]">
            {agent.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "bg-[var(--accent-dim)] text-[var(--ink)]"
                    : "bg-[var(--canvas)] text-[var(--ink-soft)]"
                }`}
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  {message.role === "user" ? "You" : agent.name}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))
        )}
        {pending ? (
          <p className="text-sm text-[var(--muted)]">{agent.name} is working…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSend} className="mt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={placeholder}
          disabled={pending}
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)] disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
            observe · get_wallet_balances · web / todo / goal / skill
          </p>
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#0c1210] transition hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-3 rounded-xl bg-[#2a1818] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
