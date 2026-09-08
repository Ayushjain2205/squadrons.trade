import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { ActivityEvent, ActivityKind } from "@squadrons/shared";

type ActivityRow = {
  id: string;
  agent_id: string;
  kind: string;
  label: string;
  detail: string | null;
  tool_name: string | null;
  created_at: number;
};

function rowToEvent(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    agentId: row.agent_id,
    kind: row.kind as ActivityKind,
    label: row.label,
    detail: row.detail,
    toolName: row.tool_name,
    createdAt: row.created_at,
  };
}

export type NewActivityEvent = {
  agentId: string;
  kind: ActivityKind;
  label: string;
  detail?: string | null;
  toolName?: string | null;
  createdAt?: number;
};

export class ActivityStore {
  constructor(private readonly db: Database.Database) {}

  listByAgent(agentId: string, limit = 100): ActivityEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM activity
         WHERE agent_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(agentId, Math.max(1, Math.min(limit, 500))) as ActivityRow[];
    return rows.map(rowToEvent).reverse();
  }

  append(input: NewActivityEvent): ActivityEvent {
    const event: ActivityEvent = {
      id: randomUUID(),
      agentId: input.agentId,
      kind: input.kind,
      label: input.label,
      detail: input.detail ?? null,
      toolName: input.toolName ?? null,
      createdAt: input.createdAt ?? Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO activity (id, agent_id, kind, label, detail, tool_name, created_at)
         VALUES (@id, @agentId, @kind, @label, @detail, @toolName, @createdAt)`,
      )
      .run({
        id: event.id,
        agentId: event.agentId,
        kind: event.kind,
        label: event.label,
        detail: event.detail,
        toolName: event.toolName,
        createdAt: event.createdAt,
      });

    return event;
  }
}
