import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { StrategyTradeIntent } from "@squadrons/shared";

export type TradeIntentStatus = "proposed" | "blocked";

export type TradeIntentRecord = {
  id: string;
  agentId: string;
  status: TradeIntentStatus;
  amountUsd: number;
  symbol: string | null;
  side: "buy" | "sell" | null;
  label: string;
  detail: string | null;
  reason: string | null;
  createdAt: number;
};

type TradeIntentRow = {
  id: string;
  agent_id: string;
  status: string;
  amount_usd: number;
  symbol: string | null;
  side: string | null;
  label: string;
  detail: string | null;
  reason: string | null;
  created_at: number;
};

function rowToRecord(row: TradeIntentRow): TradeIntentRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    status: row.status as TradeIntentStatus,
    amountUsd: row.amount_usd,
    symbol: row.symbol,
    side: row.side === "buy" || row.side === "sell" ? row.side : null,
    label: row.label,
    detail: row.detail,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class TradeIntentStore {
  constructor(private readonly db: Database.Database) {}

  append(input: {
    agentId: string;
    status: TradeIntentStatus;
    intent?: StrategyTradeIntent | null;
    label: string;
    detail?: string | null;
    reason?: string | null;
  }): TradeIntentRecord {
    const record: TradeIntentRecord = {
      id: randomUUID(),
      agentId: input.agentId,
      status: input.status,
      amountUsd: input.intent?.amountUsd ?? 0,
      symbol: input.intent?.symbol ?? null,
      side: input.intent?.side ?? null,
      label: input.label,
      detail: input.detail ?? null,
      reason: input.reason ?? null,
      createdAt: Date.now(),
    };

    this.db
      .prepare(
        `INSERT INTO trade_intents (
          id, agent_id, status, amount_usd, symbol, side,
          label, detail, reason, created_at
        ) VALUES (
          @id, @agentId, @status, @amountUsd, @symbol, @side,
          @label, @detail, @reason, @createdAt
        )`,
      )
      .run(record);

    return record;
  }

  listByAgent(agentId: string, limit = 50): TradeIntentRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM trade_intents
         WHERE agent_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(agentId, Math.max(1, Math.min(limit, 200))) as TradeIntentRow[];
    return rows.map(rowToRecord);
  }
}
