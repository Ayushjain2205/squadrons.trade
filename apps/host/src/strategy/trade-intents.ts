import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { StrategyTradeIntent } from "@squadrons/shared";

export type TradeIntentStatus =
  | "proposed"
  | "blocked"
  | "dry_run"
  | "awaiting_allowance"
  | "dismissed"
  | "failed"
  | "submitted";

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
  txHash: string | null;
  executionJson: string | null;
  createdAt: number;
  updatedAt: number;
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
  tx_hash: string | null;
  execution_json: string | null;
  created_at: number;
  updated_at: number;
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
    txHash: row.tx_hash,
    executionJson: row.execution_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
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
    txHash?: string | null;
    execution?: unknown;
  }): TradeIntentRecord {
    const now = Date.now();
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
      txHash: input.txHash ?? null,
      executionJson:
        input.execution === undefined
          ? null
          : JSON.stringify(input.execution),
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO trade_intents (
          id, agent_id, status, amount_usd, symbol, side,
          label, detail, reason, tx_hash, execution_json,
          created_at, updated_at
        ) VALUES (
          @id, @agentId, @status, @amountUsd, @symbol, @side,
          @label, @detail, @reason, @txHash, @executionJson,
          @createdAt, @updatedAt
        )`,
      )
      .run(record);

    return record;
  }

  updateExecution(
    id: string,
    patch: {
      status: TradeIntentStatus;
      detail?: string | null;
      reason?: string | null;
      txHash?: string | null;
      execution?: unknown;
    },
  ): TradeIntentRecord | null {
    const existing = this.db
      .prepare(`SELECT * FROM trade_intents WHERE id = ?`)
      .get(id) as TradeIntentRow | undefined;
    if (!existing) return null;

    const updatedAt = Date.now();
    const executionJson =
      patch.execution === undefined
        ? existing.execution_json
        : JSON.stringify(patch.execution);
    const detail =
      patch.detail !== undefined ? patch.detail : existing.detail;
    const reason =
      patch.reason !== undefined ? patch.reason : existing.reason;
    const txHash =
      patch.txHash !== undefined ? patch.txHash : existing.tx_hash;

    this.db
      .prepare(
        `UPDATE trade_intents
         SET status = ?, detail = ?, reason = ?, tx_hash = ?,
             execution_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        patch.status,
        detail,
        reason,
        txHash,
        executionJson,
        updatedAt,
        id,
      );

    return rowToRecord({
      ...existing,
      status: patch.status,
      detail,
      reason,
      tx_hash: txHash,
      execution_json: executionJson,
      updated_at: updatedAt,
    });
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

  get(id: string): TradeIntentRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM trade_intents WHERE id = ?`)
      .get(id) as TradeIntentRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  listAwaitingAllowance(agentId: string): TradeIntentRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM trade_intents
         WHERE agent_id = ? AND status = 'awaiting_allowance'
         ORDER BY created_at DESC`,
      )
      .all(agentId) as TradeIntentRow[];
    return rows.map(rowToRecord);
  }
}
