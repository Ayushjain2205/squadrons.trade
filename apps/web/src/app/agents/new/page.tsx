import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AGENT_AVATARS, type AvatarId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { AppShell } from "@/components/AppShell";
import { createAgent } from "@/lib/host";

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarId, setAvatarId] = useState<AvatarId>("01");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const agent = await createAgent({
          name,
          description,
          avatarId,
        });
        router.push(`/agents/${agent.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  return (
    <AppShell
      action={
        <Link
          href="/"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
        >
          Cancel
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="rise mx-auto max-w-xl space-y-8">
        <div className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-[-0.03em]">
            New agent
          </h1>
          <p className="text-[var(--ink-soft)]">
            Pick a face, name it, describe its mandate. Chain is Base for now.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-[var(--ink-soft)]">
            Face
          </legend>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {AGENT_AVATARS.map((avatar) => {
              const selected = avatar.id === avatarId;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setAvatarId(avatar.id)}
                  aria-pressed={selected}
                  aria-label={avatar.name}
                  className={`flex items-center justify-center rounded-2xl border p-2 transition ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--panel)]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <AgentOrb id={avatar.id} size={48} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--ink-soft)]">
            Name
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Base LP Scout"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)]"
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
            placeholder="Scouts LP opportunities on Base and reports findings in-app."
            className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </label>

        <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
          Chain · Base (8453) · spend mode starts as observe
        </p>

        {error ? (
          <p className="rounded-xl bg-[#2a1818] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#0c1210] transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create agent"}
        </button>
      </form>
    </AppShell>
  );
}
