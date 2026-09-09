"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AgentMode, AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import {
  getAgent,
  listMessages,
  pauseAgent,
  sendMessage,
  updateAgent,
  type AgentMessage,
  type AgentWithWorkspace,
} from "@/lib/host";
import { MarkdownContent } from "@/components/MarkdownContent";
import { sanitizeAssistantContent } from "@/lib/sanitize-assistant";

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
  const [modePending, setModePending] = useState(false);
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

  async function onModeChange(mode: AgentMode) {
    if (modePending || mode === agent.mode || isWorking) return;
    setModePending(true);
    setError(null);
    try {
      const updated = await updateAgent(agent.id, { mode });
      applyAgent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mode switch failed");
    } finally {
      setModePending(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  const placeholder =
    agent.mode === "operate"
      ? `Define or steer ${agent.name}'s strategy…`
      : `Scout with ${agent.name}…`;
  const isWorking = pending || agent.status === "working";
  const modeDisabled = pending || modePending || isWorking;

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
            <h1 className="type-title truncate">{agent.name}</h1>
            {!isWorking && agent.description ? (
              <p className="type-meta truncate">{agent.description}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="rounded-[var(--radius-msg)] bg-[var(--msg-bot)] px-5 py-8 text-center">
              <p className="type-ui text-[var(--ink-soft)]">
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
          className="chat-composer flex w-full items-end gap-1.5 rounded-full border border-[var(--line)] bg-[var(--msg-bot)] px-2 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
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
            className="chat-input type-body max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)] outline-none ring-0 disabled:opacity-60"
          />
          <ModeChooser
            mode={agent.mode}
            disabled={modeDisabled}
            onChange={(mode) => void onModeChange(mode)}
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
          <p className="type-ui mt-3 rounded-xl bg-[#2a1818] px-4 py-3 text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const MODE_META: Record<
  AgentMode,
  { label: string; hint: string; color: string; colorDim: string }
> = {
  scout: {
    label: "Scout",
    hint: "Research and dig",
    color: "var(--link)",
    colorDim: "color-mix(in srgb, var(--link) 16%, transparent)",
  },
  operate: {
    label: "Operate",
    hint: "Shape and run strategy",
    color: "var(--accent)",
    colorDim: "color-mix(in srgb, var(--accent) 16%, transparent)",
  },
};

function ModeChooser({
  mode,
  disabled,
  onChange,
}: {
  mode: AgentMode;
  disabled?: boolean;
  onChange: (mode: AgentMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const meta = MODE_META[mode];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div ref={rootRef} className="relative mb-0.5 shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Mode: ${meta.label}`}
        title={meta.label}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-2.5 transition hover:bg-[var(--panel)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: meta.color }}
      >
        <span
          className="flex size-6 items-center justify-center rounded-full"
          style={{ background: meta.colorDim }}
          aria-hidden
        >
          <ModeIcon mode={mode} />
        </span>
        <span className="type-meta hidden capitalize sm:inline">{meta.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`opacity-70 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Desk mode"
          className="absolute bottom-[calc(100%+0.5rem)] right-0 z-30 min-w-[11.5rem] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-2)] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          {(["scout", "operate"] as const).map((value) => {
            const option = MODE_META[value];
            const selected = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onChange(value);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[var(--panel)] ${
                  selected ? "bg-[var(--panel)]" : ""
                }`}
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    color: option.color,
                    background: option.colorDim,
                  }}
                  aria-hidden
                >
                  <ModeIcon mode={value} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="type-ui block font-medium"
                    style={{ color: selected ? option.color : "var(--ink)" }}
                  >
                    {option.label}
                  </span>
                  <span className="type-meta block text-[var(--muted)]">
                    {option.hint}
                  </span>
                </span>
                {selected ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={option.color}
                    strokeWidth="2.5"
                    aria-hidden
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ModeIcon({ mode }: { mode: AgentMode }) {
  if (mode === "operate") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="7.5"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <circle cx="12" cy="12" r="2.25" fill="currentColor" />
        <path
          d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="10.5"
        cy="10.5"
        r="6"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M15 15l5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8.2 10.5h4.6M10.5 8.2v4.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`type-body max-w-[min(100%,var(--measure-chat))] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-[var(--msg-user)] text-[var(--ink)]"
            : "bg-[var(--msg-bot)] text-[var(--ink)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <MarkdownContent content={sanitizeAssistantContent(message.content)} />
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
      className={`type-ui flex items-center gap-2 text-[var(--ink-soft)] ${className}`}
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
