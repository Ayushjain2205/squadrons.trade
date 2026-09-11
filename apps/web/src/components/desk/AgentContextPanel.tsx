"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AGENT_COLORS,
  AGENT_FACES,
  SUPPORTED_CHAINS,
  type AvatarId,
  type OrbColorId,
  type SupportedChainId,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { ChainName, ChainPicker } from "@/components/ChainLogo";
import { OrbColorSwatch } from "@/components/OrbColorSwatch";
import {
  armStrategy,
  disarmStrategy,
  getAgent,
  pauseStrategy,
  resumeStrategy,
  updateAgent,
  type AgentWithWorkspace,
} from "@/lib/host";
import { ActivityTrail } from "./ActivityTrail";
import { StrategyCard } from "./StrategyCard";
import { useToast } from "@/components/Toast";
import { useHostSigner } from "@/hooks/useHostSigner";

export function AgentContextPanel({
  agent,
  onAgentUpdated,
  onCollapse,
}: {
  agent: AgentWithWorkspace | null;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
  /** Hide the desk rail (desktop). */
  onCollapse?: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsOpen(false);
  }, [agent?.id]);

  if (!agent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DeskPanelHeader
          title="Desk"
          onCollapse={onCollapse}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="type-ui text-[var(--muted)]">
            Select an agent to see status and details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DeskPanelHeader
        title={settingsOpen ? "Settings" : "Desk"}
        onCollapse={onCollapse}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
      />

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
          <AgentContextSummary
            agent={agent}
            onAgentUpdated={onAgentUpdated}
          />
        )}
      </div>
    </div>
  );
}

function DeskPanelHeader({
  title,
  onCollapse,
  settingsOpen,
  onToggleSettings,
}: {
  title: string;
  onCollapse?: () => void;
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
      <h2 className="type-title text-[var(--ink)]">{title}</h2>
      <div className="flex items-center gap-0.5">
        {onToggleSettings ? (
          <button
            type="button"
            onClick={onToggleSettings}
            aria-pressed={settingsOpen}
            aria-label={settingsOpen ? "Close settings" : "Open settings"}
            title={settingsOpen ? "Close settings" : "Settings"}
            className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition ${
              settingsOpen
                ? "bg-[var(--panel-2)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            }`}
          >
            <SettingsIcon />
          </button>
        ) : null}
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide desk"
            className="chain-tip group/chain relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
          >
            <ChevronsRightIcon />
            <span role="tooltip" className="chain-tip-bubble chain-tip-bubble--left">
              Hide desk
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChevronsRightIcon() {
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
        d="M13 17l5-5-5-5M6 17l5-5-5-5"
      />
    </svg>
  );
}

function AgentContextSummary({
  agent,
  onAgentUpdated,
}: {
  agent: AgentWithWorkspace;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const isWorking = agent.status === "working";
  const strategyRunning = agent.strategy?.status === "running";
  const onAgentUpdatedRef = useRef(onAgentUpdated);
  onAgentUpdatedRef.current = onAgentUpdated;
  const [posturePending, startPosture] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const toast = useToast();
  const { ensureHostSigner } = useHostSigner();

  useEffect(() => {
    if (!strategyRunning) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await getAgent(agent.id);
        if (!cancelled) onAgentUpdatedRef.current?.(latest);
      } catch {
        // ignore transient poll errors
      }
    };
    const id = window.setInterval(() => {
      void refresh();
    }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [agent.id, strategyRunning]);

  function patchAgent(input: {
    mode?: "scout" | "operate";
    spendMode?: "observe" | "spend_enabled";
  }) {
    if (posturePending || isWorking) return;
    startPosture(async () => {
      try {
        const updated = await updateAgent(agent.id, input);
        onAgentUpdatedRef.current?.(updated);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update posture",
        );
      }
    });
  }

  function requestModeChange(mode: "scout" | "operate") {
    if (mode === agent.mode || posturePending || isWorking) return;
    // Host rejects scout while strategy is running — offer pause + switch.
    if (mode === "scout" && agent.strategy?.status === "running") {
      setConfirm({
        title: "Switch to Scout?",
        body: "The strategy is running. Pausing it lets you scout without the host loop.",
        confirmLabel: "Pause & switch",
        onConfirm: () => {
          setConfirm(null);
          startPosture(async () => {
            try {
              const paused = await pauseStrategy(agent.id);
              onAgentUpdatedRef.current?.(paused);
              const updated = await updateAgent(agent.id, { mode: "scout" });
              onAgentUpdatedRef.current?.(updated);
            } catch (err) {
              toast.error(
                err instanceof Error
                  ? err.message
                  : "Could not switch to Scout",
              );
            }
          });
        },
      });
      return;
    }
    patchAgent({ mode });
  }

  function requestSpendChange(spendMode: "observe" | "spend_enabled") {
    if (spendMode === agent.spendMode || posturePending || isWorking) return;
    setConfirm(
      spendConfirmRequest(spendMode, () => {
        setConfirm(null);
        if (spendMode !== "spend_enabled") {
          patchAgent({ spendMode });
          return;
        }
        if (posturePending || isWorking) return;
        startPosture(async () => {
          try {
            const signer = await ensureHostSigner();
            const updated = await updateAgent(agent.id, { spendMode });
            onAgentUpdatedRef.current?.(updated);
            if (!signer.alreadyDelegated) {
              toast.info("Host can now sign for this wallet");
            }
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Could not enable spend — host wallet access failed",
            );
          }
        });
      }),
    );
  }

  const postureDisabled = posturePending || isWorking;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <section className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <ChainName chainId={agent.chainId} size={18} tipPlacement="right" />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <HoverFlipToggle
              value={agent.mode}
              disabled={postureDisabled}
              options={[
                { id: "scout", label: "Scout" },
                { id: "operate", label: "Operate" },
              ]}
              onChange={requestModeChange}
            />
            <HoverFlipToggle
              value={agent.spendMode}
              disabled={postureDisabled}
              options={[
                { id: "observe", label: "Observe" },
                { id: "spend_enabled", label: "Spend" },
              ]}
              onChange={requestSpendChange}
            />
          </div>
        </div>
      </section>

      <StrategyCard
        mode={agent.mode}
        spendMode={agent.spendMode}
        strategy={agent.strategy}
        agentId={agent.id}
        agentWorking={isWorking}
        onAgentUpdated={onAgentUpdated}
        onAction={async (action) => {
          const updated =
            action === "arm"
              ? await armStrategy(agent.id)
              : action === "pause"
                ? await pauseStrategy(agent.id)
                : action === "resume"
                  ? await resumeStrategy(agent.id)
                  : await disarmStrategy(agent.id);
          onAgentUpdated?.(updated);
          return updated;
        }}
      />

      <ActivityTrail
        agentId={agent.id}
        agentName={agent.name}
        live={agent.strategy?.status === "running"}
        onLiveEvent={(event) => {
          const shouldRefresh =
            event.label === "Saved strategy draft" ||
            event.label === "Armed strategy" ||
            event.label === "Paused strategy" ||
            event.label === "Resumed strategy" ||
            event.label === "Disarmed strategy" ||
            event.label === "Updated strategy params" ||
            event.label === "Updated self-improvement" ||
            event.label === "Self-improvement review" ||
            event.label === "Self-improvement suggested" ||
            event.label === "Self-improvement approved" ||
            event.label === "Self-improvement dismissed" ||
            event.label === "Self-improvement failed" ||
            event.label === "Self-improvement skipped" ||
            event.label === "Spend enabled" ||
            event.label === "Spend set to observe";
          if (!shouldRefresh) return;
          void getAgent(agent.id)
            .then((latest) => onAgentUpdatedRef.current?.(latest))
            .catch(() => undefined);
        }}
      />

      <ConfirmDialog
        request={confirm}
        busy={posturePending}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function spendConfirmRequest(
  next: "observe" | "spend_enabled",
  onConfirm: () => void,
): ConfirmRequest {
  if (next === "spend_enabled") {
    return {
      title: "Enable spend?",
      body: "This agent can propose capped trades. You’ll grant Squadrons permission to sign from your embedded wallet (Privy). You still approve token allowances in chat before first spend.",
      confirmLabel: "Enable spend",
      onConfirm,
    };
  }
  return {
    title: "Switch to observe-only?",
    body: "This agent will stop proposing spends until you enable spend again.",
    confirmLabel: "Observe only",
    onConfirm,
  };
}

function ConfirmDialog({
  request,
  busy,
  onCancel,
}: {
  request: ConfirmRequest | null;
  busy?: boolean;
  onCancel: () => void;
}) {
  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-confirm-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_16px_48px_rgb(0_0_0_/_0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="desk-confirm-title" className="type-ui text-[var(--ink)]">
          {request.title}
        </h3>
        <p className="type-meta mt-2 text-[var(--ink-soft)]">{request.body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={request.onConfirm}
            className="type-ui flex-1 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-2 font-semibold text-[var(--canvas)] disabled:opacity-40"
          >
            {busy ? "Working…" : request.confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="type-ui flex-1 cursor-pointer rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Idle: current value. Hover/focus: both options to flip. */
function HoverFlipToggle<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div
      className={`group/flip relative inline-flex min-h-7 items-center rounded-full bg-[var(--panel-2)] px-0.5 py-0.5 ring-1 ring-[var(--line-soft)] ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="type-meta px-2.5 py-0.5 font-medium text-[var(--ink)] group-hover/flip:hidden group-focus-within/flip:hidden">
        {current.label}
      </span>
      <div className="hidden items-center gap-0.5 group-hover/flip:flex group-focus-within/flip:flex">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled || selected}
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={`type-meta rounded-full px-2.5 py-0.5 transition ${
                selected
                  ? "bg-[var(--ink)] font-semibold text-[var(--canvas)]"
                  : "cursor-pointer text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:cursor-not-allowed"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
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
  const [spendMode, setSpendMode] = useState<"observe" | "spend_enabled">(
    agent.spendMode,
  );
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const toast = useToast();
  const { ensureHostSigner } = useHostSigner();

  const chainLocked = agent.status === "working";

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setAvatarId(agent.avatarId);
    setColorId(agent.colorId);
    setChainId(agent.chainId);
    setSpendMode(agent.spendMode);
    setConfirm(null);
  }, [agent]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const enablingSpend =
      spendMode === "spend_enabled" && agent.spendMode !== "spend_enabled";

    const save = () => {
      startTransition(async () => {
        try {
          if (enablingSpend) {
            await ensureHostSigner();
          }
          const updated = await updateAgent(agent.id, {
            name,
            description,
            avatarId,
            colorId,
            chainId: chainLocked ? undefined : chainId,
            spendMode,
          });
          onSaved(updated);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Save failed");
        }
      });
    };

    if (enablingSpend) {
      setConfirm(
        spendConfirmRequest("spend_enabled", () => {
          setConfirm(null);
          save();
        }),
      );
      return;
    }
    save();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="type-label">Face</legend>
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
          <legend className="type-label">Color</legend>
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
          <span className="type-label">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="type-ui w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </label>

        <label className="block space-y-2">
          <span className="type-label">Description</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="type-ui w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="type-label">Chain</legend>
          <ChainPicker
            value={chainId}
            onChange={setChainId}
            disabled={chainLocked}
          />
          {chainLocked ? (
            <p className="type-meta">
              Chain can change when the agent is not working.
            </p>
          ) : chainId !== agent.chainId ? (
            <p className="type-meta">
              Switching home chain moves tools to{" "}
              {SUPPORTED_CHAINS.find((c) => c.chainId === chainId)?.shortName}.
              Chat history is kept.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="type-label">Spend</legend>
          <div className="flex gap-1.5">
            {(
              [
                {
                  id: "observe" as const,
                  label: "Observe",
                  hint: "Ticks alert only",
                },
                {
                  id: "spend_enabled" as const,
                  label: "Enabled",
                  hint: "Propose trades (dry-run executor by default)",
                },
              ] as const
            ).map((option) => {
              const selected = spendMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (option.id === spendMode) return;
                    setConfirm(
                      spendConfirmRequest(option.id, () => {
                        setConfirm(null);
                        setSpendMode(option.id);
                      }),
                    );
                  }}
                  aria-pressed={selected}
                  className={`flex flex-1 cursor-pointer flex-col items-start rounded-xl border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--panel)]"
                      : "border-[var(--line)] hover:border-[var(--line)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <span className="type-ui text-[var(--ink)]">{option.label}</span>
                  <span className="type-meta text-[var(--muted)]">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>

      <ConfirmDialog
        request={confirm}
        onCancel={() => setConfirm(null)}
      />
    </>
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
