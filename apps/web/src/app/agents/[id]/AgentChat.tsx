"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AgentOrb } from "@/components/AgentOrb";
import {
  sendMessage,
  type AgentMessage,
  type AgentWithWorkspace,
} from "@/lib/host";
import { formatClock } from "@/lib/time";

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setAgent(initialAgent);
    setMessages(initialMessages);
  }, [initialAgent, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function onSend(event?: React.FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;

    setError(null);
    setDraft("");
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

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  const placeholder = `Message ${agent.name}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] md:hidden"
            aria-label="All agents"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <AgentOrb id={agent.avatarId} size={32} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.02em]">
              {agent.name}
            </h1>
            {pending ? (
              <p className="flex items-center gap-1.5 text-xs text-[var(--accent)]">
                <span className="working-dot size-1.5 rounded-full bg-[var(--accent)]" />
                Working…
              </p>
            ) : (
              <p className="truncate text-xs text-[var(--muted)]">
                {agent.status.replace("_", " ")}
                {agent.currentGoal ? ` · ${agent.currentGoal}` : ""}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 ? (
            <div className="rounded-[var(--radius-msg)] bg-[var(--panel)] px-5 py-8 text-center">
              <p className="text-sm text-[var(--ink-soft)]">
                {agent.currentGoal
                  ? "No messages in this goal yet."
                  : `Tell ${agent.name} what to work on.`}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                agentName={agent.name}
              />
            ))
          )}
          {pending ? (
            <p className="px-1 text-sm text-[var(--muted)]">
              {agent.name} is working…
            </p>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-3 pb-4 pt-2 sm:px-6 sm:pb-5">
        <form
          onSubmit={onSend}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        >
          <span
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--muted)]"
            aria-hidden
          >
            +
          </span>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={pending}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-30"
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.4 20.6L20.9 12 3.4 3.4l-.1 6.7L14 12 3.3 13.9l.1 6.7z" />
            </svg>
          </button>
        </form>
        {error ? (
          <p className="mx-auto mt-3 max-w-3xl rounded-xl bg-[#2a1818] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  agentName,
}: {
  message: AgentMessage;
  agentName: string;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,40rem)] rounded-[var(--radius-msg)] px-5 py-4 text-[15px] leading-relaxed ${
          isUser
            ? "bg-[var(--panel-2)] text-[var(--ink)]"
            : "bg-[var(--panel)] text-[var(--ink-soft)]"
        }`}
      >
        {!isUser ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            {agentName}
          </p>
        ) : null}
        <p className="whitespace-pre-wrap text-[var(--ink)]">{message.content}</p>
        <p className="mt-3 text-right text-[11px] text-[var(--muted)]">
          {formatClock(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
