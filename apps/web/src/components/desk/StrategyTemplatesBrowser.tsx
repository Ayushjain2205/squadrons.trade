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
import { useToast } from "@/components/Toast";

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
  const [params, setParams] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const locked = busy || pending;

  useEffect(() => {
    let cancelled = false;
    void listStrategyTemplates(chainId)
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates);
        const first = data.templates[0];
        if (first) {
          setSelectedId(first.id);
          setParams(editableParamsFrom(first));
        }
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

  function selectTemplate(template: StrategyTemplate) {
    setSelectedId(template.id);
    setParams(editableParamsFrom(template));
  }

  function runImport() {
    if (!selected || locked) return;
    const overrides: Record<string, unknown> = {};
    for (const key of selected.editableKeys) {
      const raw = params[key]?.trim() ?? "";
      if (!raw) continue;
      if (key === "direction") {
        overrides[key] = raw;
      } else {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          toast.error(`${key} must be a number`);
          return;
        }
        overrides[key] = num;
      }
    }

    startTransition(async () => {
      try {
        const updated = await importStrategyTemplate(
          agentId,
          selected.id,
          overrides,
        );
        onImported(updated);
        toast.info(`Imported ${selected.name} — Arm when ready`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not import template",
        );
      }
    });
  }

  const planLine = selected
    ? describeRecipePlan(
        selected.draft.recipeId,
        { ...selected.draft.params, ...numericOverrides(params, selected) },
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
        className="flex max-h-[min(40rem,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_16px_48px_rgb(0_0_0_/_0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id="strategy-templates-title"
              className="type-ui text-[var(--ink)]"
            >
              Strategy templates
            </h2>
            <p className="type-meta text-[var(--muted)]">
              Curated for {chainLabel(chainId)} · import is a draft — you still
              Arm
            </p>
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

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-[var(--line-soft)] md:w-[15.5rem] md:border-b-0 md:border-r">
            <div className="shrink-0 p-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-lg bg-[var(--panel-2)] px-2.5 py-2 type-meta text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {templates === null ? (
                <p className="px-2 type-meta text-[var(--muted)]">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="px-2 type-meta text-[var(--muted)]">
                  No templates match.
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((template) => {
                    const active = template.id === selected?.id;
                    return (
                      <li key={template.id}>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => selectTemplate(template)}
                          className={`w-full cursor-pointer rounded-xl px-2.5 py-2 text-left transition disabled:opacity-40 ${
                            active
                              ? "bg-[var(--panel-2)]"
                              : "hover:bg-[var(--panel-2)]/70"
                          }`}
                        >
                          <span className="type-ui block text-[var(--ink)]">
                            {template.name}
                          </span>
                          <span className="type-meta mt-0.5 line-clamp-2 block text-[var(--muted)]">
                            {template.blurb}
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
            {selected ? (
              <>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className="space-y-2">
                    <h3 className="type-title text-[var(--ink)]">
                      {selected.name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.tags.map((tag) => (
                        <span
                          key={tag}
                          className="type-meta rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[var(--muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                      <span className="type-meta rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[var(--muted)]">
                        {recipeLabel(selected.draft.recipeId)}
                      </span>
                      <span className="type-meta rounded-md bg-[var(--panel-2)] px-1.5 py-0.5 text-[var(--muted)]">
                        {selected.draft.action.type === "propose_trade"
                          ? "Propose trade"
                          : "Alert"}
                      </span>
                    </div>
                    <p className="type-body text-[var(--ink-soft)]">
                      {selected.description}
                    </p>
                  </div>

                  <div className="space-y-1 rounded-xl bg-[var(--panel-2)] px-3 py-2.5">
                    <p className="type-meta text-[var(--muted)]">Plan preview</p>
                    <p className="type-ui text-[var(--ink)]">{planLine}</p>
                    {schedule ? (
                      <p className="type-meta text-[var(--muted)]">{schedule}</p>
                    ) : null}
                  </div>

                  {selected.editableKeys.length > 0 ? (
                    <div className="space-y-2">
                      <p className="type-meta text-[var(--muted)]">
                        Tweak before import
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selected.editableKeys.map((key) => (
                          <label key={key} className="block space-y-1">
                            <span className="type-meta capitalize text-[var(--muted)]">
                              {key}
                            </span>
                            {key === "direction" ? (
                              <select
                                value={params[key] ?? "below"}
                                disabled={locked}
                                onChange={(e) =>
                                  setParams({
                                    ...params,
                                    [key]: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg bg-[var(--panel-2)] px-2.5 py-2 type-meta text-[var(--ink)] outline-none"
                              >
                                <option value="below">below</option>
                                <option value="above">above</option>
                                <option value="either">either</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                inputMode="decimal"
                                value={params[key] ?? ""}
                                disabled={locked}
                                onChange={(e) =>
                                  setParams({
                                    ...params,
                                    [key]: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg bg-[var(--panel-2)] px-2.5 py-2 type-meta text-[var(--ink)] outline-none"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                    className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-40"
                  >
                    {pending ? "Importing…" : "Import draft"}
                  </button>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <p className="type-meta text-[var(--muted)]">
                  {templates === null
                    ? "Loading templates…"
                    : "No templates for this chain yet."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function editableParamsFrom(template: StrategyTemplate): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of template.editableKeys) {
    const value = template.draft.params?.[key];
    next[key] = value === undefined || value === null ? "" : String(value);
  }
  return next;
}

/** Best-effort live preview merges for numeric editable knobs. */
function numericOverrides(
  params: Record<string, string>,
  template: StrategyTemplate,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of template.editableKeys) {
    const raw = params[key]?.trim() ?? "";
    if (!raw) continue;
    if (key === "direction") {
      out[key] = raw;
      continue;
    }
    const num = Number(raw);
    if (Number.isFinite(num)) out[key] = num;
  }
  return out;
}
