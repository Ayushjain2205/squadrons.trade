import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
  ActivityEvent,
  ActivityKind,
  ActivitySource,
} from "@squadrons/shared";

type ActivityRow = {
  id: string;
  agent_id: string;
  kind: string;
  source: string | null;
  label: string;
  detail: string | null;
  tool_name: string | null;
  created_at: number;
};

function rowToEvent(row: ActivityRow): ActivityEvent {
  const source =
    row.source === "chat" || row.source === "strategy" || row.source === "system"
      ? row.source
      : "system";
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind as ActivityKind,
    source,
    label: row.label,
    detail: row.detail,
    toolName: row.tool_name,
    createdAt: row.created_at,
  };
}

export type NewActivityEvent = {
  agentId: string;
  kind: ActivityKind;
  source?: ActivitySource;
  label: string;
  detail?: string | null;
  toolName?: string | null;
  createdAt?: number;
};

export class ActivityStore {
  constructor(private readonly db: Database.Database) {}

  listByAgent(
    agentId: string,
    options: {
      limit?: number;
      beforeCreatedAt?: number;
      beforeId?: string;
      sources?: ActivitySource[];
    } = {},
  ): { events: ActivityEvent[]; hasMore: boolean } {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 100));
    const sources = options.sources?.filter(
      (s) => s === "chat" || s === "strategy" || s === "system",
    );
    const beforeCreatedAt = options.beforeCreatedAt;
    const beforeId = options.beforeId;

    const clauses = ["agent_id = ?"];
    const params: Array<string | number> = [agentId];

    if (sources && sources.length > 0) {
      clauses.push(`source IN (${sources.map(() => "?").join(", ")})`);
      params.push(...sources);
    }

    if (
      beforeCreatedAt != null &&
      Number.isFinite(beforeCreatedAt) &&
      beforeId
    ) {
      clauses.push("(created_at < ? OR (created_at = ? AND id < ?))");
      params.push(beforeCreatedAt, beforeCreatedAt, beforeId);
    } else if (beforeCreatedAt != null && Number.isFinite(beforeCreatedAt)) {
      clauses.push("created_at < ?");
      params.push(beforeCreatedAt);
    }

    params.push(limit + 1);

    const rows = this.db
      .prepare(
        `SELECT * FROM activity
         WHERE ${clauses.join(" AND ")}
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(...params) as ActivityRow[];

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      events: page.map(rowToEvent).reverse(),
      hasMore,
    };
  }

  append(input: NewActivityEvent): ActivityEvent {
    const event: ActivityEvent = {
      id: randomUUID(),
      agentId: input.agentId,
      kind: input.kind,
      source: input.source ?? "system",
      label: input.label,
      detail: input.detail ?? null,
      toolName: input.toolName ?? null,
      createdAt: input.createdAt ?? Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO activity (
          id, agent_id, kind, source, label, detail, tool_name, created_at
        ) VALUES (
          @id, @agentId, @kind, @source, @label, @detail, @toolName, @createdAt
        )`,
      )
      .run({
        id: event.id,
        agentId: event.agentId,
        kind: event.kind,
        source: event.source,
        label: event.label,
        detail: event.detail,
        toolName: event.toolName,
        createdAt: event.createdAt,
      });

    return event;
  }
}
