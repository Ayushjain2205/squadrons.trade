"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import {
  getAgent,
  listMessages,
  pauseAgent,
  sendMessage,
  type AgentMessage,
  type AgentWithWorkspace,
} from "@/lib/host";
import { MarkdownContent } from "@/components/MarkdownContent";

export function AgentChat({
  agent: initialAgent,
  initialMessages,
  onAgentUpdated,
}: {
  agent: AgentWithWorkspace;
  initialMessages: AgentMessage[];
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const router = useRouter();
  const [agent, setAgent] = useState(initialAgent);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pausing, setPausing] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setAgent(initialAgent);
    setMessages(initialMessages);
  }, [initialAgent, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  function applyAgent(next: AgentWithWorkspace) {
    setAgent(next);
    onAgentUpdated?.(next);
  }

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
    applyAgent({ ...agent, status: "working" });

    startTransition(async () => {
      try {
        const result = await sendMessage(agent.id, content);
        applyAgent(result.agent);
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
          return [...withoutOptimistic, ...result.messages];
        });
        router.refresh();
      } catch (err) {
        try {
          const latest = await getAgent(agent.id);
          applyAgent(latest);
          if (latest.status === "paused") {
            const stored = await listMessages(agent.id);
            setMessages(stored);
            setDraft("");
            setError(null);
            return;
          }
        } catch {
          // fall through
        }
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(content);
        setError(err instanceof Error ? err.message : "Send failed");
        applyAgent({ ...agent, status: "paused" });
      }
    });
  }

  async function onPause() {
    if (pausing) return;
    setPausing(true);
    setError(null);
    try {
      const updated = await pauseAgent(agent.id);
      applyAgent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setPausing(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  const placeholder = `Message ${agent.name}`;
  const isWorking = pending || agent.status === "working";

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
          <div className="relative shrink-0">
            <AgentOrb
              id={agent.avatarId}
              colorId={agent.colorId}
              size={32}
              animate={isWorking}
            />
            <span
              className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--canvas)] ${
                isWorking
                  ? "working-dot bg-[var(--accent)]"
                  : "bg-[var(--muted)]"
              }`}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-display)] text-base font-semibold tracking-[-0.02em]">
              {agent.name}
            </h1>
            {!isWorking && agent.description ? (
              <p className="truncate text-xs text-[var(--muted)]">
                {agent.description}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="rounded-[var(--radius-msg)] bg-[var(--msg-bot)] px-5 py-8 text-center">
              <p className="text-sm text-[var(--ink-soft)]">
                {`Message ${agent.name} to get started.`}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        {isWorking ? (
          <AgentWorkingStatus
            name={agent.name}
            avatarId={agent.avatarId}
            colorId={agent.colorId}
            className="mb-2 px-1"
          />
        ) : null}
        <form
          onSubmit={onSend}
          className="chat-composer flex w-full items-end gap-2 rounded-full border border-[var(--line)] bg-[var(--msg-bot)] px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
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
            className="chat-input max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug text-[var(--ink)] placeholder:text-[var(--muted)] outline-none ring-0 disabled:opacity-60"
          />
          {isWorking ? (
            <button
              type="button"
              onClick={() => void onPause()}
              disabled={pausing}
              className="mb-0.5 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={pausing ? "Stopping" : "Stop"}
              title="Stop"
            >
              <span className="block size-3 rounded-[2px] bg-current" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="mb-0.5 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.4 20.6L20.9 12 3.4 3.4l-.1 6.7L14 12 3.3 13.9l.1 6.7z" />
              </svg>
            </button>
          )}
        </form>
        {error ? (
          <p className="mt-3 rounded-xl bg-[#2a1818] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
          isUser
            ? "bg-[var(--msg-user)] text-[var(--ink)]"
            : "bg-[var(--msg-bot)] text-[var(--ink)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}

function AgentWorkingStatus({
  name,
  avatarId,
  colorId,
  className = "",
}: {
  name: string;
  avatarId: AvatarId;
  colorId: OrbColorId;
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-2 text-sm text-[var(--ink-soft)] ${className}`}
      aria-live="polite"
    >
      <AgentOrb
        id={avatarId}
        colorId={colorId}
        size={22}
        className="shrink-0"
        animate
      />
      <span className="truncate">
        <span className="text-[var(--ink)]">{name}</span> is working
      </span>
    </p>
  );
}
