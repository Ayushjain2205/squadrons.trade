"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AGENT_COLORS,
  AGENT_FACES,
  DEFAULT_ORB_COLOR,
  DEFAULT_POLICY,
  type AvatarId,
  type OrbColorId,
  type SupportedChainId,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { ChainPicker } from "@/components/ChainLogo";
import { OrbColorSwatch } from "@/components/OrbColorSwatch";
import { DeskShell } from "@/components/desk/DeskShell";
import { createAgent, listAgents, type AgentWithWorkspace } from "@/lib/host";

export default function NewAgentPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentWithWorkspace[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("01");
  const [colorId, setColorId] = useState<OrbColorId>(DEFAULT_ORB_COLOR);
  const [chainId, setChainId] = useState<SupportedChainId>(
    DEFAULT_POLICY.defaultChainId,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const agent = await createAgent({
          name,
          description,
          avatarId,
          colorId,
          chainId,
        });
        router.push(`/agents/${agent.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  return (
    <DeskShell agents={agents} selectedId={null}>
      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto">
        <form
          onSubmit={onSubmit}
          className="rise mx-auto max-w-lg space-y-8 px-6 py-10"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="type-display-lg">New agent</h1>
              <p className="type-body text-[var(--ink-soft)]">
                Pick a face, color, chain, name, and mandate.
              </p>
            </div>
            <Link
              href="/"
              className="type-ui text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              Cancel
            </Link>
          </div>

          <fieldset className="space-y-3">
            <legend className="type-label">Face</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {AGENT_FACES.map((face) => {
                const selected = face.id === avatarId;
                return (
                  <button
                    key={face.id}
                    type="button"
                    onClick={() => setAvatarId(face.id)}
                    aria-pressed={selected}
                    aria-label={face.name}
                    className={`flex cursor-pointer items-center justify-center rounded-2xl border p-1.5 transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--panel)]"
                        : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                    }`}
                  >
                    <AgentOrb
                      id={face.id}
                      colorId={colorId}
                      size={44}
                      animate={selected}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="type-label">Color</legend>
            <div className="flex flex-nowrap gap-2">
              {AGENT_COLORS.map((color) => {
                const selected = color.id === colorId;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setColorId(color.id)}
                    aria-pressed={selected}
                    aria-label={color.name}
                    className={`flex cursor-pointer items-center justify-center rounded-full border p-1 transition ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--panel)]"
                        : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                    }`}
                  >
                    <OrbColorSwatch colorId={color.id} size={28} />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="type-label">Chain</legend>
            <ChainPicker value={chainId} onChange={setChainId} />
          </fieldset>

          <label className="block space-y-2">
            <span className="type-label">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Base LP Scout"
              className="type-body w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          </label>

          <label className="block space-y-2">
            <span className="type-label">Description</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Scouts LP opportunities and reports findings in-app."
              className="type-body w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)]"
            />
          </label>

          <p className="type-data text-[var(--muted)]">Spend starts as observe</p>

          {error ? (
            <p className="type-ui rounded-xl bg-[#2a1818] px-4 py-3 text-[var(--danger)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-5 py-3 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create agent"}
          </button>
        </form>
      </div>
    </DeskShell>
  );
}
