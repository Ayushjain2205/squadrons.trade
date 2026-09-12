import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  getMcpCatalogEntry,
  isMcpCatalogId,
  isValidMcpServerName,
  MCP_CATALOG,
  type AgentPluginView,
  type CreateCustomPluginInput,
  type CustomMcpConfig,
  type PluginKind,
  type UpsertCatalogPluginInput,
  type UpdateCustomPluginInput,
} from "@squadrons/shared";
import {
  decryptSecrets,
  encryptSecrets,
  mergeSecrets,
} from "./secrets.js";
import { isChainSearchAvailable } from "./graph-gateway.js";

type PluginRow = {
  id: string;
  agent_id: string;
  kind: string;
  catalog_id: string | null;
  name: string;
  description: string;
  server_name: string;
  enabled: number;
  config_json: string;
  secrets_enc: string | null;
  created_at: number;
  updated_at: number;
};

function parseCustomConfig(raw: string): CustomMcpConfig {
  try {
    const parsed = JSON.parse(raw) as CustomMcpConfig;
    if (parsed.transport !== "stdio" && parsed.transport !== "streamable-http") {
      return { transport: "streamable-http" };
    }
    return parsed;
  } catch {
    return { transport: "streamable-http" };
  }
}

function catalogConfigured(
  entrySecrets: { key: string }[],
  secrets: Record<string, string>,
): boolean {
  return entrySecrets.every((spec) => Boolean(secrets[spec.key]?.trim()));
}

function rowSecrets(row: PluginRow): Record<string, string> {
  try {
    return decryptSecrets(row.secrets_enc);
  } catch {
    return {};
  }
}

function toCatalogView(
  catalogId: string,
  row: PluginRow | null,
): AgentPluginView | null {
  const entry = getMcpCatalogEntry(catalogId);
  if (!entry) return null;

  // Host-provisioned builtins (Chain Search) — no per-agent install/key.
  if (entry.builtin) {
    const available =
      catalogId === "chain-search" ? isChainSearchAvailable() : true;
    return {
      id: `catalog:${catalogId}`,
      kind: "catalog",
      catalogId,
      name: entry.name,
      description: entry.description,
      serverName: entry.serverName,
      enabled: available,
      configured: available,
      builtin: true,
      secretSpecs: [],
      secretsSet: [],
      docsUrl: entry.docsUrl,
      createdAt: null,
      updatedAt: null,
    };
  }

  const secrets = row ? rowSecrets(row) : {};
  const secretsSet = Object.keys(secrets);
  return {
    id: row?.id ?? `catalog:${catalogId}`,
    kind: "catalog",
    catalogId,
    name: entry.name,
    description: entry.description,
    serverName: entry.serverName,
    enabled: row ? row.enabled === 1 : false,
    configured: catalogConfigured(entry.secrets, secrets),
    secretSpecs: entry.secrets,
    secretsSet,
    docsUrl: entry.docsUrl,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

function toCustomView(row: PluginRow): AgentPluginView {
  const secrets = rowSecrets(row);
  const config = parseCustomConfig(row.config_json);
  const secretSpecs = [
    ...Object.entries(config.headerSecretKeys ?? {}).map(([key, headerName]) => ({
      key,
      label: key,
      headerName,
    })),
    ...Object.entries(config.envSecretKeys ?? {}).map(([key, envName]) => ({
      key,
      label: key,
      envName,
    })),
  ];
  return {
    id: row.id,
    kind: "custom",
    catalogId: null,
    name: row.name,
    description: row.description,
    serverName: row.server_name,
    enabled: row.enabled === 1,
    configured: secretsSetNonEmpty(secrets),
    secretSpecs,
    secretsSet: Object.keys(secrets),
    custom: config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function secretsSetNonEmpty(secrets: Record<string, string>): boolean {
  return Object.values(secrets).some((v) => v.trim().length > 0);
}

/** Runtime row used to build Cordis patches (includes decrypted secrets). */
export type EnabledPluginRuntime = {
  id: string;
  kind: PluginKind;
  catalogId: string | null;
  name: string;
  serverName: string;
  config: CustomMcpConfig | null;
  secrets: Record<string, string>;
};

export class AgentPluginStore {
  constructor(private readonly db: Database.Database) {}

  listForAgent(agentId: string): AgentPluginView[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_plugins WHERE agent_id = ? ORDER BY created_at ASC`,
      )
      .all(agentId) as PluginRow[];

    const byCatalog = new Map<string, PluginRow>();
    const customs: PluginRow[] = [];
    for (const row of rows) {
      if (row.kind === "catalog" && row.catalog_id) {
        byCatalog.set(row.catalog_id, row);
      } else if (row.kind === "custom") {
        customs.push(row);
      }
    }

    const catalogViews = MCP_CATALOG.map((entry) =>
      toCatalogView(entry.id, byCatalog.get(entry.id) ?? null),
    ).filter((v): v is AgentPluginView => v !== null);

    return [...catalogViews, ...customs.map(toCustomView)];
  }

  /**
   * Enabled + configured plugins for harness injection.
   * Catalog must have required secrets; custom must be enabled (secrets optional).
   */
  listEnabledRuntime(agentId: string): EnabledPluginRuntime[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM agent_plugins WHERE agent_id = ? AND enabled = 1`,
      )
      .all(agentId) as PluginRow[];

    const out: EnabledPluginRuntime[] = [];
    for (const row of rows) {
      const secrets = rowSecrets(row);
      if (row.kind === "catalog" && row.catalog_id) {
        const entry = getMcpCatalogEntry(row.catalog_id);
        if (!entry) continue;
        if (!catalogConfigured(entry.secrets, secrets)) continue;
        out.push({
          id: row.id,
          kind: "catalog",
          catalogId: row.catalog_id,
          name: entry.name,
          serverName: entry.serverName,
          config: null,
          secrets,
        });
        continue;
      }
      if (row.kind === "custom") {
        out.push({
          id: row.id,
          kind: "custom",
          catalogId: null,
          name: row.name,
          serverName: row.server_name,
          config: parseCustomConfig(row.config_json),
          secrets,
        });
      }
    }
    return out;
  }

  /** Stable hash for harness pool invalidation. */
  configHash(agentId: string): string {
    const runtime = this.listEnabledRuntime(agentId);
    const payload = runtime.map((p) => ({
      id: p.id,
      serverName: p.serverName,
      catalogId: p.catalogId,
      secretKeys: Object.keys(p.secrets).sort(),
      config: p.config,
    }));
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
  }

  upsertCatalog(
    agentId: string,
    catalogId: string,
    input: UpsertCatalogPluginInput,
  ): AgentPluginView {
    if (!isMcpCatalogId(catalogId)) {
      throw new Error(`Unknown catalog plugin: ${catalogId}`);
    }
    const entry = getMcpCatalogEntry(catalogId)!;
    if (entry.builtin) {
      throw new Error(
        `${entry.name} is included by the host — no per-agent install`,
      );
    }
    const now = Date.now();
    const existing = this.db
      .prepare(
        `SELECT * FROM agent_plugins WHERE agent_id = ? AND catalog_id = ?`,
      )
      .get(agentId, catalogId) as PluginRow | undefined;

    const secrets = mergeSecrets(
      existing ? rowSecrets(existing) : {},
      input.secrets,
    );
    const secretsEnc =
      Object.keys(secrets).length > 0 ? encryptSecrets(secrets) : null;

    if (existing) {
      this.db
        .prepare(
          `UPDATE agent_plugins
           SET enabled = ?, secrets_enc = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(input.enabled ? 1 : 0, secretsEnc, now, existing.id);
    } else {
      this.db
        .prepare(
          `INSERT INTO agent_plugins (
             id, agent_id, kind, catalog_id, name, description, server_name,
             enabled, config_json, secrets_enc, created_at, updated_at
           ) VALUES (?, ?, 'catalog', ?, ?, ?, ?, ?, '{}', ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          agentId,
          catalogId,
          entry.name,
          entry.description,
          entry.serverName,
          input.enabled ? 1 : 0,
          secretsEnc,
          now,
          now,
        );
    }

    const view = this.listForAgent(agentId).find(
      (p) => p.kind === "catalog" && p.catalogId === catalogId,
    );
    if (!view) throw new Error("Failed to upsert catalog plugin");
    return view;
  }

  createCustom(
    agentId: string,
    input: CreateCustomPluginInput,
  ): AgentPluginView {
    const serverName = input.serverName.trim();
    if (!isValidMcpServerName(serverName)) {
      throw new Error(
        "serverName must match [A-Za-z0-9_-]{1,32}",
      );
    }
    this.assertServerNameFree(agentId, serverName);
    validateCustomConfig(input.config);

    const now = Date.now();
    const id = randomUUID();
    const secrets = mergeSecrets({}, input.secrets);
    const secretsEnc =
      Object.keys(secrets).length > 0 ? encryptSecrets(secrets) : null;

    this.db
      .prepare(
        `INSERT INTO agent_plugins (
           id, agent_id, kind, catalog_id, name, description, server_name,
           enabled, config_json, secrets_enc, created_at, updated_at
         ) VALUES (?, ?, 'custom', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        agentId,
        input.name.trim() || serverName,
        (input.description ?? "").trim(),
        serverName,
        input.enabled === false ? 0 : 1,
        JSON.stringify(input.config),
        secretsEnc,
        now,
        now,
      );

    const row = this.db
      .prepare(`SELECT * FROM agent_plugins WHERE id = ?`)
      .get(id) as PluginRow;
    return toCustomView(row);
  }

  updateCustom(
    agentId: string,
    pluginId: string,
    input: UpdateCustomPluginInput,
  ): AgentPluginView {
    const row = this.getOwned(agentId, pluginId);
    if (row.kind !== "custom") {
      throw new Error("Not a custom plugin");
    }

    const now = Date.now();
    const secrets = mergeSecrets(rowSecrets(row), input.secrets);
    const secretsEnc =
      Object.keys(secrets).length > 0 ? encryptSecrets(secrets) : null;
    const config = input.config
      ? (validateCustomConfig(input.config), input.config)
      : parseCustomConfig(row.config_json);
    const name = input.name?.trim() || row.name;
    const description =
      input.description !== undefined
        ? input.description.trim()
        : row.description;
    const enabled =
      input.enabled === undefined ? row.enabled : input.enabled ? 1 : 0;

    this.db
      .prepare(
        `UPDATE agent_plugins
         SET name = ?, description = ?, enabled = ?, config_json = ?,
             secrets_enc = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        name,
        description,
        enabled,
        JSON.stringify(config),
        secretsEnc,
        now,
        pluginId,
      );

    const updated = this.db
      .prepare(`SELECT * FROM agent_plugins WHERE id = ?`)
      .get(pluginId) as PluginRow;
    return toCustomView(updated);
  }

  delete(agentId: string, pluginId: string): void {
    const row = this.getOwned(agentId, pluginId);
    // Catalog: deleting = wipe row (falls back to catalog default off)
    this.db.prepare(`DELETE FROM agent_plugins WHERE id = ?`).run(row.id);
  }

  private getOwned(agentId: string, pluginId: string): PluginRow {
    const row = this.db
      .prepare(
        `SELECT * FROM agent_plugins WHERE id = ? AND agent_id = ?`,
      )
      .get(pluginId, agentId) as PluginRow | undefined;
    if (!row) throw new Error("Plugin not found");
    return row;
  }

  private assertServerNameFree(agentId: string, serverName: string): void {
    const clash = this.db
      .prepare(
        `SELECT id FROM agent_plugins WHERE agent_id = ? AND server_name = ?`,
      )
      .get(agentId, serverName) as { id: string } | undefined;
    if (clash) {
      throw new Error(`serverName "${serverName}" already in use for this agent`);
    }
    // Catalog server names are reserved
    if (MCP_CATALOG.some((e) => e.serverName === serverName)) {
      throw new Error(`serverName "${serverName}" is reserved for a catalog plugin`);
    }
  }
}

function validateCustomConfig(config: CustomMcpConfig): void {
  if (config.transport === "streamable-http") {
    if (!config.url || typeof config.url !== "string") {
      throw new Error("Custom HTTP MCP requires url");
    }
    try {
      const parsed = new URL(config.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("bad protocol");
      }
    } catch {
      throw new Error("Custom HTTP MCP url is invalid");
    }
    return;
  }
  if (config.transport === "stdio") {
    if (!config.command || typeof config.command !== "string") {
      throw new Error("Custom stdio MCP requires command");
    }
    if (config.args && !Array.isArray(config.args)) {
      throw new Error("Custom stdio MCP args must be a string array");
    }
    if (config.args?.some((a) => typeof a !== "string")) {
      throw new Error("Custom stdio MCP args must be strings");
    }
    return;
  }
  throw new Error("Unsupported MCP transport");
}
