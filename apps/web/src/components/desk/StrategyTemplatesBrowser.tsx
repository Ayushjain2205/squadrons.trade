"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  chainLabel,
  describeRecipePlan,
  describeStrategySchedule,
  recipeLabel,
  type StrategyTemplate,
  type SupportedChainId,
} from "@squadrons/shared";
import {
  importStrategyTemplate,
  listStrategyTemplates,
  type AgentWithWorkspace,
} from "@/lib/host";
import { ChainLogo } from "@/components/ChainLogo";
import { SkeletonBone } from "@/components/desk/DeskSkeleton";
import { useToast } from "@/components/Toast";

type TemplateTone = {
  accent: string;
  dim: string;
};

function toneForTemplate(template: StrategyTemplate): TemplateTone {
  if (template.tags.includes("wallet")) {
    return { accent: "var(--warn)", dim: "color-mix(in srgb, var(--warn) 18%, transparent)" };
  }
  if (template.tags.includes("price")) {
    return { accent: "var(--link)", dim: "color-mix(in srgb, var(--link) 18%, transparent)" };
  }
  return {
    accent: "var(--accent)",
    dim: "color-mix(in srgb, var(--accent) 16%, transparent)",
  };
}

function chainsForTemplate(
  template: StrategyTemplate,
  agentChainId: SupportedChainId,
): SupportedChainId[] {
  if (template.chainIds.length === 0) return [agentChainId];
  return [...template.chainIds];
}

export function StrategyTemplatesBrowser({
  agentId,
  chainId,
  busy = false,
  onClose,
  onImported,
}: {
  agentId: string;
  chainId: SupportedChainId;
  busy?: boolean;
  onClose: () => void;
  onImported: (agent: AgentWithWorkspace) => void;
}) {
  const [templates, setTemplates] = useState<StrategyTemplate[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const locked = busy || pending;
  const loading = templates === null;

  useEffect(() => {
    let cancelled = false;
    void listStrategyTemplates(chainId)
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates);
        const first = data.templates[0];
        if (first) setSelectedId(first.id);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load templates",
          );
          setTemplates([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, toast]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !locked) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  const filtered = useMemo(() => {
    const rows = templates ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (template) =>
        template.name.toLowerCase().includes(q) ||
        template.blurb.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [templates, query]);

  const selected =
    filtered.find((template) => template.id === selectedId) ??
    filtered[0] ??
    null;

  useEffect(() => {
    if (!selected) return;
    if (selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  function runImport() {
    if (!selected || locked) return;
    startTransition(async () => {
      try {
        const updated = await importStrategyTemplate(agentId, selected.id);
        onImported(updated);
        toast.info(`Imported ${selected.name} — tweak in chat, then Arm`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not import template",
        );
      }
    });
  }

  const selectedTone = selected ? toneForTemplate(selected) : null;
  const planLine = selected
    ? describeRecipePlan(
        selected.draft.recipeId,
        selected.draft.params,
        selected.draft.action.type,
      ) ?? selected.draft.summary
    : null;
  const schedule = selected
    ? describeStrategySchedule(selected.draft.trigger)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onClick={() => {
        if (!locked) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="strategy-templates-title"
        aria-busy={loading}
        className="flex max-h-[min(40rem,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_16px_48px_rgb(0_0_0_/_0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in srgb, var(--accent) 14%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 28%, transparent)",
              }}
            >
              <ChainLogo chainId={chainId} size={22} className="rounded-md" />
            </span>
            <div className="min-w-0">
              <h2
                id="strategy-templates-title"
                className="type-ui text-[var(--ink)]"
              >
                Strategy templates
              </h2>
              <p className="type-meta text-[var(--muted)]">
                Curated for {chainLabel(chainId)} · import draft, refine in
                chat, then Arm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="type-meta shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Close
          </button>
        </header>

        {loading ? (
          <TemplatesSkeleton />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-[var(--line-soft)] md:w-[16.5rem] md:border-b-0 md:border-r">
              <div className="shrink-0 p-3">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search templates…"
                    className="w-full rounded-xl bg-[var(--panel-2)] py-2 pl-8 pr-2.5 type-meta text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
                {filtered.length === 0 ? (
                  <p className="px-2 type-meta text-[var(--muted)]">
                    No templates match.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filtered.map((template) => {
                      const active = template.id === selected?.id;
                      const tone = toneForTemplate(template);
                      const chains = chainsForTemplate(template, chainId);
                      return (
                        <li key={template.id}>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => setSelectedId(template.id)}
                            className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition disabled:opacity-40 ${
                              active
                                ? "bg-[var(--panel-2)]"
                                : "hover:bg-[var(--panel-2)]/70"
                            }`}
                            style={
                              active
                                ? {
                                    boxShadow: `inset 2px 0 0 ${tone.accent}`,
                                  }
                                : undefined
                            }
                          >
                            <TemplateGlyph
                              template={template}
                              tone={tone}
                              size={34}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="type-ui flex items-center gap-1.5 text-[var(--ink)]">
                                <span className="min-w-0 truncate">
                                  {template.name}
                                </span>
                                <span className="flex shrink-0 items-center gap-0.5">
                                  {chains.slice(0, 2).map((id) => (
                                    <ChainLogo
                                      key={id}
                                      chainId={id}
                                      size={12}
                                      className="rounded-[3px]"
                                    />
                                  ))}
                                </span>
                              </span>
                              <span className="type-meta mt-0.5 line-clamp-2 block text-[var(--muted)]">
                                {template.blurb}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              {selected && selectedTone ? (
                <>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <TemplateGlyph
                        template={selected}
                        tone={selectedTone}
                        size={48}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <h3 className="type-title text-[var(--ink)]">
                          {selected.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {chainsForTemplate(selected, chainId).map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--panel-2)] px-1.5 py-0.5"
                            >
                              <ChainLogo
                                chainId={id}
                                size={12}
                                className="rounded-[3px]"
                              />
                              <span className="type-meta text-[var(--ink-soft)]">
                                {chainLabel(id)}
                              </span>
                            </span>
                          ))}
                          {selected.chainIds.length === 0 ? (
                            <span className="type-meta rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[var(--muted)]">
                              Any chain
                            </span>
                          ) : null}
                          {selected.tags.map((tag) => (
                            <span
                              key={tag}
                              className="type-meta rounded-md px-1.5 py-0.5"
                              style={{
                                color: selectedTone.accent,
                                background: selectedTone.dim,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <p className="type-body text-[var(--ink-soft)]">
                      {selected.description}
                    </p>

                    <div
                      className="space-y-2 rounded-xl px-3.5 py-3"
                      style={{
                        background: selectedTone.dim,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${selectedTone.accent} 28%, transparent)`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className="type-meta"
                          style={{ color: selectedTone.accent }}
                        >
                          Plan preview
                        </p>
                        <span className="type-meta text-[var(--muted)]">
                          {recipeLabel(selected.draft.recipeId)} ·{" "}
                          {selected.draft.action.type === "propose_trade"
                            ? "Propose trade"
                            : "Alert"}
                        </span>
                      </div>
                      <p className="type-ui text-[var(--ink)]">{planLine}</p>
                      {schedule ? (
                        <p className="type-meta text-[var(--muted)]">
                          {schedule}
                        </p>
                      ) : null}
                    </div>

                    <p className="type-meta text-[var(--muted)]">
                      After import, ask in chat to retune levels or knobs — then
                      Arm on the Strategy card.
                    </p>
                  </div>

                  <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line-soft)] px-4 py-3 sm:px-5">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={onClose}
                      className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={runImport}
                      className="type-ui cursor-pointer rounded-full px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-40"
                      style={{ background: selectedTone.accent, color: "#0a0a0a" }}
                    >
                      {pending ? "Importing…" : "Import draft"}
                    </button>
                  </footer>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <p className="type-meta text-[var(--muted)]">
                    No templates for this chain yet.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplatesSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col md:flex-row"
      aria-hidden
    >
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--line-soft)] md:w-[16.5rem] md:border-b-0 md:border-r">
        <div className="p-3">
          <SkeletonBone className="h-9 w-full rounded-xl bg-[var(--panel-2)]" />
        </div>
        <div className="space-y-2 px-3 pb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2.5 px-1 py-1.5">
              <SkeletonBone className="size-[34px] shrink-0 rounded-[22%] bg-[var(--panel-2)]" />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <SkeletonBone
                  className="h-3.5 bg-[var(--panel-2)]"
                  style={{ width: i === 1 ? "58%" : "46%" }}
                />
                <SkeletonBone
                  className="h-2.5 bg-[var(--panel-2)]"
                  style={{ width: i === 2 ? "88%" : "72%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <SkeletonBone className="size-12 shrink-0 rounded-[22%] bg-[var(--panel-2)]" />
          <div className="min-w-0 flex-1 space-y-2.5 pt-1">
            <SkeletonBone className="h-5 w-44 bg-[var(--panel-2)]" />
            <div className="flex gap-1.5">
              <SkeletonBone className="h-5 w-16 rounded-md bg-[var(--panel-2)]" />
              <SkeletonBone className="h-5 w-14 rounded-md bg-[var(--panel-2)]" />
              <SkeletonBone className="h-5 w-12 rounded-md bg-[var(--panel-2)]" />
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <SkeletonBone className="h-3 w-full bg-[var(--panel-2)]" />
          <SkeletonBone className="h-3 w-[92%] bg-[var(--panel-2)]" />
          <SkeletonBone className="h-3 w-[78%] bg-[var(--panel-2)]" />
        </div>
        <SkeletonBone className="mt-5 h-24 w-full rounded-xl bg-[var(--panel-2)]" />
        <div className="mt-auto flex justify-end gap-2 border-t border-[var(--line-soft)] pt-3">
          <SkeletonBone className="h-9 w-20 rounded-full bg-[var(--panel-2)]" />
          <SkeletonBone className="h-9 w-28 rounded-full bg-[var(--panel-2)]" />
        </div>
      </section>
    </div>
  );
}

function TemplateGlyph({
  template,
  tone,
  size,
}: {
  template: StrategyTemplate;
  tone: TemplateTone;
  size: number;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-[22%]"
      style={{
        width: size,
        height: size,
        background: tone.dim,
        color: tone.accent,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone.accent} 35%, transparent)`,
      }}
      aria-hidden
    >
      <TemplateKindIcon tags={template.tags} size={Math.round(size * 0.48)} />
    </span>
  );
}

function TemplateKindIcon({
  tags,
  size,
}: {
  tags: readonly string[];
  size: number;
}) {
  if (tags.includes("wallet")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect
          x="3.5"
          y="6.5"
          width="17"
          height="12"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path
          d="M3.5 10h17"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="16.5" cy="14.5" r="1.25" fill="currentColor" />
      </svg>
    );
  }
  if (tags.includes("price")) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16.5l4.2-4.2 3.1 3.1L19.5 7"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 7h4.5V11.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4.5a6 6 0 016 6c0 4-2.5 6.2-4.2 7.6-.7.6-1.1.9-1.8.9s-1.1-.3-1.8-.9C8.5 16.7 6 14.5 6 10.5a6 6 0 016-6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 20h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15 15l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
