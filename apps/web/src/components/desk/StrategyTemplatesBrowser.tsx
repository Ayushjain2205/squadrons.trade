"use client";

import { useEffect, useState, useTransition } from "react";
import {
  chainLabel,
  type StrategyTemplate,
  type SupportedChainId,
} from "@squadrons/shared";
import {
  importStrategyTemplate,
  listStrategyTemplates,
  type AgentWithWorkspace,
} from "@/lib/host";
import { useToast } from "@/components/Toast";

type ConfirmState = {
  template: StrategyTemplate;
  params: Record<string, string>;
};

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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const locked = busy || pending;

  useEffect(() => {
    let cancelled = false;
    void listStrategyTemplates(chainId)
      .then((data) => {
        if (!cancelled) setTemplates(data.templates);
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

  function startConfirm(template: StrategyTemplate) {
    const params: Record<string, string> = {};
    for (const key of template.editableKeys) {
      const value = template.draft.params?.[key];
      params[key] = value === undefined || value === null ? "" : String(value);
    }
    setConfirm({ template, params });
  }

  function runImport() {
    if (!confirm || locked) return;
    const { template, params } = confirm;
    const overrides: Record<string, unknown> = {};
    for (const key of template.editableKeys) {
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
          template.id,
          overrides,
        );
        onImported(updated);
        toast.info(`Imported ${template.name} — Arm when ready`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not import template",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="type-ui text-[var(--ink)]">Templates</h3>
          <p className="type-meta text-[var(--muted)]">
            Curated for {chainLabel(chainId)} · import is a draft only
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="type-meta cursor-pointer text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-40"
        >
          Close
        </button>
      </div>

      {confirm ? (
        <div className="space-y-3 rounded-lg border border-[var(--line-soft)] px-3 py-2.5">
          <div>
            <p className="type-ui text-[var(--ink)]">{confirm.template.name}</p>
            <p className="type-meta text-[var(--muted)]">
              {confirm.template.blurb}
            </p>
          </div>
          {confirm.template.editableKeys.length > 0 ? (
            <div className="space-y-2">
              {confirm.template.editableKeys.map((key) => (
                <label key={key} className="block space-y-1">
                  <span className="type-meta capitalize text-[var(--muted)]">
                    {key}
                  </span>
                  {key === "direction" ? (
                    <select
                      value={confirm.params[key] ?? "below"}
                      disabled={locked}
                      onChange={(e) =>
                        setConfirm({
                          ...confirm,
                          params: { ...confirm.params, [key]: e.target.value },
                        })
                      }
                      className="w-full rounded-lg bg-[var(--panel-2)] px-2.5 py-1.5 type-meta text-[var(--ink)] outline-none"
                    >
                      <option value="below">below</option>
                      <option value="above">above</option>
                      <option value="either">either</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      inputMode="decimal"
                      value={confirm.params[key] ?? ""}
                      disabled={locked}
                      onChange={(e) =>
                        setConfirm({
                          ...confirm,
                          params: { ...confirm.params, [key]: e.target.value },
                        })
                      }
                      className="w-full rounded-lg bg-[var(--panel-2)] px-2.5 py-1.5 type-meta text-[var(--ink)] outline-none"
                    />
                  )}
                </label>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={locked}
              onClick={() => setConfirm(null)}
              className="type-ui flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={runImport}
              className="type-ui flex-1 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] disabled:opacity-40"
            >
              {pending ? "Importing…" : "Import draft"}
            </button>
          </div>
        </div>
      ) : templates === null ? (
        <p className="type-meta text-[var(--muted)]">Loading templates…</p>
      ) : templates.length === 0 ? (
        <p className="type-meta text-[var(--muted)]">
          No templates for this chain yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-start justify-between gap-2 rounded-lg bg-[var(--panel-2)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="type-ui text-[var(--ink)]">{template.name}</p>
                <p className="type-meta text-[var(--muted)]">{template.blurb}</p>
              </div>
              <button
                type="button"
                disabled={locked}
                onClick={() => startConfirm(template)}
                className="type-meta shrink-0 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-medium text-[var(--canvas)] disabled:opacity-40"
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
