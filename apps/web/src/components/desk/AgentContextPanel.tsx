"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AGENT_COLORS,
  AGENT_FACES,
  SUPPORTED_CHAINS,
  chainLabel,
  type AvatarId,
  type OrbColorId,
  type SupportedChainId,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { OrbColorSwatch } from "@/components/OrbColorSwatch";
import { updateAgent, type AgentWithWorkspace } from "@/lib/host";
import { ActivityTrail } from "./ActivityTrail";

export function AgentContextPanel({
  agent,
  onAgentUpdated,
}: {
  agent: AgentWithWorkspace | null;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsOpen(false);
  }, [agent?.id]);

  if (!agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          Select an agent to see status and details.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line-soft)] px-4 py-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {settingsOpen ? "Settings" : "Context"}
        </h2>
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-pressed={settingsOpen}
          aria-label={settingsOpen ? "Close settings" : "Open settings"}
          className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition ${
            settingsOpen
              ? "bg-[var(--panel-2)] text-[var(--ink)]"
              : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
          }`}
        >
          <SettingsIcon />
        </button>
      </div>

      <div className="desk-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {settingsOpen ? (
          <AgentSettingsForm
            agent={agent}
            onSaved={(updated) => {
              onAgentUpdated?.(updated);
              setSettingsOpen(false);
            }}
            onCancel={() => setSettingsOpen(false)}
          />
        ) : (
          <AgentContextSummary agent={agent} />
        )}
      </div>
    </div>
  );
}

function AgentContextSummary({ agent }: { agent: AgentWithWorkspace }) {
  const isWorking = agent.status === "working";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <section className="shrink-0 space-y-1.5">
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          {agent.description}
        </p>
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">
          {chainLabel(agent.chainId)}
          {" · "}
          {agent.spendMode === "observe" ? "observe" : "spend on"}
        </p>
      </section>

      <ActivityTrail
        agentId={agent.id}
        agentName={agent.name}
        live={isWorking}
      />
    </div>
  );
}

function AgentSettingsForm({
  agent,
  onSaved,
  onCancel,
}: {
  agent: AgentWithWorkspace;
  onSaved: (agent: AgentWithWorkspace) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [avatarId, setAvatarId] = useState<AvatarId>(agent.avatarId);
  const [colorId, setColorId] = useState<OrbColorId>(agent.colorId);
  const [chainId, setChainId] = useState<SupportedChainId>(agent.chainId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chainLocked = agent.status === "working";

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setAvatarId(agent.avatarId);
    setColorId(agent.colorId);
    setChainId(agent.chainId);
    setError(null);
  }, [agent]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateAgent(agent.id, {
          name,
          description,
          avatarId,
          colorId,
          chainId: chainLocked ? undefined : chainId,
        });
        onSaved(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--ink-soft)]">
          Face
        </legend>
        <div className="grid grid-cols-4 gap-1.5">
          {AGENT_FACES.map((face) => {
            const selected = face.id === avatarId;
            return (
              <button
                key={face.id}
                type="button"
                onClick={() => setAvatarId(face.id)}
                aria-pressed={selected}
                aria-label={face.name}
                className={`flex cursor-pointer items-center justify-center rounded-xl border p-1 transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--panel)]"
                    : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                }`}
              >
                <AgentOrb
                  id={face.id}
                  colorId={colorId}
                  size={36}
                  animate={selected}
                />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--ink-soft)]">
          Color
        </legend>
        <div className="flex flex-nowrap gap-1.5">
          {AGENT_COLORS.map((color) => {
            const selected = color.id === colorId;
            return (
              <button
                key={color.id}
                type="button"
                onClick={() => setColorId(color.id)}
                aria-pressed={selected}
                aria-label={color.name}
                className={`flex cursor-pointer items-center justify-center rounded-full border p-0.5 transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--panel)]"
                    : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                }`}
              >
                <OrbColorSwatch colorId={color.id} size={24} />
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ink-soft)]">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--ink-soft)]">
          Description
        </span>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--ink-soft)]">
          Chain
        </legend>
        <div className="grid grid-cols-1 gap-1.5">
          {SUPPORTED_CHAINS.map((chain) => {
            const selected = chain.chainId === chainId;
            return (
              <button
                key={chain.chainId}
                type="button"
                disabled={chainLocked}
                onClick={() => setChainId(chain.chainId)}
                aria-pressed={selected}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--panel)]"
                    : "border-[var(--line)] bg-transparent hover:bg-[var(--panel)]"
                } ${chainLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <span className="block text-sm font-medium text-[var(--ink)]">
                  {chain.shortName}
                </span>
                <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                  {chain.chainId}
                </span>
              </button>
            );
          })}
        </div>
        {chainLocked ? (
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Chain can change when the agent is not working.
          </p>
        ) : chainId !== agent.chainId ? (
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            Switching home chain moves tools to{" "}
            {SUPPORTED_CHAINS.find((c) => c.chainId === chainId)?.shortName}.
            Chat history is kept.
          </p>
        ) : null}
      </fieldset>

      {error ? (
        <p className="rounded-xl bg-[#2a1818] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1.1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      />
    </svg>
  );
}
