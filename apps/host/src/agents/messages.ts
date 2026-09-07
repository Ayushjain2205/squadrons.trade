import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type MessageRole = "user" | "assistant" | "system";

export type AgentMessage = {
  id: string;
  agentId: string;
  role: MessageRole;
  content: string;
  createdAt: number;
};

type MessageRow = {
  id: string;
  agent_id: string;
  role: string;
  content: string;
  created_at: number;
};

function rowToMessage(row: MessageRow): AgentMessage {
  return {
    id: row.id,
    agentId: row.agent_id,
    role: row.role as MessageRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class MessageStore {
  constructor(private readonly db: Database.Database) {}

  listByAgent(agentId: string): AgentMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages
         WHERE agent_id = ?
         ORDER BY created_at ASC, id ASC`,
      )
      .all(agentId) as MessageRow[];
    return rows.map(rowToMessage);
  }

  append(
    agentId: string,
    role: MessageRole,
    content: string,
  ): AgentMessage {
    const message: AgentMessage = {
      id: randomUUID(),
      agentId,
      role,
      content,
      createdAt: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO messages (id, agent_id, role, content, created_at)
         VALUES (@id, @agentId, @role, @content, @createdAt)`,
      )
      .run({
        id: message.id,
        agentId: message.agentId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      });

    return message;
  }

  countByAgent(agentId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM messages WHERE agent_id = ?`)
      .get(agentId) as { c: number };
    return row.c;
  }
}
