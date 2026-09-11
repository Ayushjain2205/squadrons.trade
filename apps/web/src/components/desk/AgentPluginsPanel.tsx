"use client";

import { useEffect, useState, useTransition } from "react";
import type { AgentPluginView } from "@squadrons/shared";
import {
  createCustomPlugin,
  deleteAgentPlugin,
  listAgentPlugins,
  updateCustomPlugin,
  upsertCatalogPlugin,
} from "@/lib/host";
import { useToast } from "@/components/Toast";

export function AgentPluginsPanel({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const [plugins, setPlugins] = useState<AgentPluginView[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCustom, setShowCustom] = useState(false);
  const toast = useToast();

  function reload() {
    startTransition(async () => {
      try {
        setPlugins(await listAgentPlugins(agentId));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load plugins");
      }
    });
  }

  useEffect(() => {
    let cancelled = false;
    void listAgentPlugins(agentId)
      .then((list) => {
        if (!cancelled) setPlugins(list);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load plugins");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, toast]);

  const catalog = plugins?.filter((p) => p.kind === "catalog") ?? [];
  const custom = plugins?.filter((p) => p.kind === "custom") ?? [];

  return (
    <div className="space-y-6">
      <p className="type-meta text-[var(--muted)]">
        Optional MCP connectors for this agent. Keys stay on the host and never
        enter chat.
      </p>

      <section className="space-y-3">
        <h3 className="type-label">Catalog</h3>
        {plugins === null ? (
          <p className="type-meta text-[var(--muted)]">Loading…</p>
        ) : (
          catalog.map((plugin) => (
            <CatalogPluginRow
              key={plugin.catalogId ?? plugin.id}
              agentId={agentId}
              plugin={plugin}
              busy={pending}
              onUpdated={(next) => {
                setPlugins((prev) =>
                  prev
                    ? prev.map((p) =>
                        p.catalogId === next.catalogId ? next : p,
                      )
                    : prev,
                );
              }}
              onError={(message) => toast.error(message)}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-label">Custom MCP</h3>
          <button
            type="button"
            onClick={() => setShowCustom((v) => !v)}
            className="type-meta cursor-pointer text-[var(--accent)] transition hover:opacity-80"
          >
            {showCustom ? "Cancel" : "Add"}
          </button>
        </div>

        {showCustom ? (
          <CustomPluginForm
            agentId={agentId}
            busy={pending}
            onCreated={(plugin) => {
              setPlugins((prev) => (prev ? [...prev, plugin] : [plugin]));
              setShowCustom(false);
            }}
            onError={(message) => toast.error(message)}
          />
        ) : null}

        {custom.length === 0 && !showCustom ? (
          <p className="type-meta text-[var(--muted)]">
            No custom servers yet.
          </p>
        ) : (
          custom.map((plugin) => (
            <CustomPluginRow
              key={plugin.id}
              agentId={agentId}
              plugin={plugin}
              busy={pending}
              onUpdated={(next) => {
                setPlugins((prev) =>
                  prev
                    ? prev.map((p) => (p.id === next.id ? next : p))
                    : prev,
                );
              }}
              onDeleted={() => {
                setPlugins((prev) =>
                  prev ? prev.filter((p) => p.id !== plugin.id) : prev,
                );
                reload();
              }}
              onError={(message) => toast.error(message)}
            />
          ))
        )}
      </section>

      <button
        type="button"
        onClick={onClose}
        className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
      >
        Done
      </button>
    </div>
  );
}

function CatalogPluginRow({
  agentId,
  plugin,
  busy,
  onUpdated,
  onError,
}: {
  agentId: string;
  plugin: AgentPluginView;
  busy: boolean;
  onUpdated: (plugin: AgentPluginView) => void;
  onError: (message: string) => void;
}) {
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const catalogId = plugin.catalogId!;
  const secretKey = plugin.secretSpecs[0]?.key ?? "API_KEY";
  const hasKey = plugin.secretsSet.includes(secretKey);

  async function save(enabled: boolean, secrets?: Record<string, string>) {
    setSaving(true);
    try {
      const updated = await upsertCatalogPlugin(agentId, catalogId, {
        enabled,
        secrets,
      });
      onUpdated(updated);
      setKeyDraft("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-[var(--line)] pb-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-ui text-[var(--ink)]">{plugin.name}</p>
          <p className="type-meta text-[var(--muted)]">{plugin.description}</p>
          {plugin.docsUrl ? (
            <a
              href={plugin.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="type-meta text-[var(--accent)] hover:underline"
            >
              Docs
            </a>
          ) : null}
        </div>
        <Toggle
          checked={plugin.enabled}
          disabled={busy || saving || (!plugin.enabled && !hasKey && !keyDraft.trim())}
          onChange={(next) => {
            if (next && !hasKey && !keyDraft.trim()) {
              onError("Paste an API key first");
              return;
            }
            const secrets = keyDraft.trim()
              ? { [secretKey]: keyDraft.trim() }
              : undefined;
            void save(next, secrets);
          }}
        />
      </div>
      <label className="block space-y-1">
        <span className="type-meta text-[var(--muted)]">
          {plugin.secretSpecs[0]?.label ?? "API key"}
          {hasKey ? " · saved" : ""}
        </span>
        <input
          type="password"
          autoComplete="off"
          placeholder={hasKey ? "•••••••• (leave blank to keep)" : "Paste key"}
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          className="type-ui w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        />
      </label>
      {keyDraft.trim() ? (
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void save(plugin.enabled || Boolean(keyDraft.trim()), {
              [secretKey]: keyDraft.trim(),
            })
          }
          className="type-meta cursor-pointer text-[var(--accent)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save key"}
        </button>
      ) : null}
    </div>
  );
}

function CustomPluginRow({
  agentId,
  plugin,
  busy,
  onUpdated,
  onDeleted,
  onError,
}: {
  agentId: string;
  plugin: AgentPluginView;
  busy: boolean;
  onUpdated: (plugin: AgentPluginView) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-1 border-b border-[var(--line)] pb-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-ui text-[var(--ink)]">{plugin.name}</p>
          <p className="type-meta text-[var(--muted)]">
            mcp__{plugin.serverName}__… ·{" "}
            {plugin.custom?.transport === "stdio"
              ? plugin.custom.command
              : plugin.custom?.url}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Toggle
            checked={plugin.enabled}
            disabled={busy || saving}
            onChange={(next) => {
              setSaving(true);
              void updateCustomPlugin(agentId, plugin.id, { enabled: next })
                .then(onUpdated)
                .catch((err) =>
                  onError(err instanceof Error ? err.message : "Update failed"),
                )
                .finally(() => setSaving(false));
            }}
          />
          <button
            type="button"
            disabled={busy || saving}
            onClick={() => {
              setSaving(true);
              void deleteAgentPlugin(agentId, plugin.id)
                .then(onDeleted)
                .catch((err) =>
                  onError(err instanceof Error ? err.message : "Delete failed"),
                )
                .finally(() => setSaving(false));
            }}
            className="type-meta cursor-pointer text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label={`Remove ${plugin.name}`}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomPluginForm({
  agentId,
  busy,
  onCreated,
  onError,
}: {
  agentId: string;
  busy: boolean;
  onCreated: (plugin: AgentPluginView) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [serverName, setServerName] = useState("");
  const [url, setUrl] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const sn = serverName.trim();
    if (!sn || !url.trim()) {
      onError("server name and URL required");
      return;
    }
    setSaving(true);
    const secrets: Record<string, string> = {};
    const headerSecretKeys: Record<string, string> = {};
    if (headerName.trim() && apiKey.trim()) {
      secrets.API_KEY = apiKey.trim();
      headerSecretKeys.API_KEY = headerName.trim();
    }
    void createCustomPlugin(agentId, {
      name: name.trim() || sn,
      serverName: sn,
      enabled: true,
      config: {
        transport: "streamable-http",
        url: url.trim(),
        headerSecretKeys:
          Object.keys(headerSecretKeys).length > 0
            ? headerSecretKeys
            : undefined,
      },
      secrets: Object.keys(secrets).length > 0 ? secrets : undefined,
    })
      .then(onCreated)
      .catch((err) =>
        onError(err instanceof Error ? err.message : "Create failed"),
      )
      .finally(() => setSaving(false));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Display name" value={name} onChange={setName} placeholder="My MCP" />
      <Field
        label="Server name"
        value={serverName}
        onChange={setServerName}
        placeholder="my_mcp"
        hint="mcp__&lt;name&gt;__tool — letters, numbers, _ -"
        required
      />
      <Field
        label="URL"
        value={url}
        onChange={setUrl}
        placeholder="https://…/mcp"
        required
      />
      <Field
        label="Auth header (optional)"
        value={headerName}
        onChange={setHeaderName}
        placeholder="Authorization or x-api-key"
      />
      <Field
        label="API key (optional)"
        value={apiKey}
        onChange={setApiKey}
        placeholder="Secret value"
        type="password"
      />
      <button
        type="submit"
        disabled={busy || saving}
        className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Adding…" : "Add MCP"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="type-meta text-[var(--muted)]">{label}</span>
      <input
        type={type}
        required={required}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="type-ui w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
      />
      {hint ? <span className="type-meta text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[var(--accent)]" : "bg-[var(--panel-2)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
