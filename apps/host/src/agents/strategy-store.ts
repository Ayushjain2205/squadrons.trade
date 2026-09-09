import type Database from "better-sqlite3";
import type {
  Strategy,
  StrategyAction,
  StrategyCaps,
  StrategyStatus,
  StrategyTrigger,
  UpsertStrategyDraftInput,
} from "@squadrons/shared";

type StrategyRow = {
  agent_id: string;
  status: string;
  summary: string;
  trigger_json: string;
  action_json: string;
  caps_json: string;
  last_tick_at: number | null;
  created_at: number;
  updated_at: number;
};

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Corrupt strategy ${label}`);
  }
}

function rowToStrategy(row: StrategyRow): Strategy {
  if (row.status !== "draft" && row.status !== "running" && row.status !== "paused") {
    throw new Error(`Corrupt strategy status: ${row.status}`);
  }
  return {
    agentId: row.agent_id,
    status: row.status,
    summary: row.summary,
    trigger: parseJson<StrategyTrigger>(row.trigger_json, "trigger"),
    action: parseJson<StrategyAction>(row.action_json, "action"),
    caps: parseJson<StrategyCaps>(row.caps_json, "caps"),
    lastTickAt: row.last_tick_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class StrategyStore {
  constructor(private readonly db: Database.Database) {}

  get(agentId: string): Strategy | null {
    const row = this.db
      .prepare(`SELECT * FROM strategies WHERE agent_id = ?`)
      .get(agentId) as StrategyRow | undefined;
    return row ? rowToStrategy(row) : null;
  }

  getMany(agentIds: string[]): Map<string, Strategy> {
    const map = new Map<string, Strategy>();
    if (agentIds.length === 0) return map;

    const placeholders = agentIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT * FROM strategies WHERE agent_id IN (${placeholders})`,
      )
      .all(...agentIds) as StrategyRow[];

    for (const row of rows) {
      map.set(row.agent_id, rowToStrategy(row));
    }
    return map;
  }

  upsertDraft(agentId: string, input: UpsertStrategyDraftInput): Strategy {
    const summary = input.summary.trim();
    if (!summary) throw new Error("strategy summary is required");
    if (!input.trigger?.type) throw new Error("strategy trigger is required");
    if (!input.action?.type) throw new Error("strategy action is required");

    const existing = this.get(agentId);
    if (existing?.status === "running") {
      throw new Error("cannot overwrite a running strategy; pause or disarm first");
    }

    const now = Date.now();
    const caps = input.caps ?? {};
    const createdAt = existing?.createdAt ?? now;

    this.db
      .prepare(
        `INSERT INTO strategies (
          agent_id, status, summary, trigger_json, action_json, caps_json,
          last_tick_at, created_at, updated_at
        ) VALUES (
          @agentId, @status, @summary, @triggerJson, @actionJson, @capsJson,
          @lastTickAt, @createdAt, @updatedAt
        )
        ON CONFLICT(agent_id) DO UPDATE SET
          status = excluded.status,
          summary = excluded.summary,
          trigger_json = excluded.trigger_json,
          action_json = excluded.action_json,
          caps_json = excluded.caps_json,
          updated_at = excluded.updated_at`,
      )
      .run({
        agentId,
        status: "draft" satisfies Exclude<StrategyStatus, "none">,
        summary,
        triggerJson: JSON.stringify(input.trigger),
        actionJson: JSON.stringify(input.action),
        capsJson: JSON.stringify(caps),
        lastTickAt: existing?.lastTickAt ?? null,
        createdAt,
        updatedAt: now,
      });

    const strategy = this.get(agentId);
    if (!strategy) throw new Error("failed to persist strategy draft");
    return strategy;
  }

  setStatus(
    agentId: string,
    status: Exclude<StrategyStatus, "none">,
  ): Strategy | null {
    const existing = this.get(agentId);
    if (!existing) return null;

    const updatedAt = Date.now();
    this.db
      .prepare(
        `UPDATE strategies
         SET status = @status, updated_at = @updatedAt
         WHERE agent_id = @agentId`,
      )
      .run({ agentId, status, updatedAt });

    return this.get(agentId);
  }

  arm(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status !== "draft" && existing.status !== "paused") {
      throw new Error("only draft or paused strategies can be armed");
    }
    const armed = this.setStatus(agentId, "running");
    if (!armed) throw new Error("failed to arm strategy");
    return armed;
  }

  pause(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status !== "running") {
      throw new Error("only a running strategy can be paused");
    }
    const paused = this.setStatus(agentId, "paused");
    if (!paused) throw new Error("failed to pause strategy");
    return paused;
  }

  resume(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status !== "paused") {
      throw new Error("only a paused strategy can be resumed");
    }
    const resumed = this.setStatus(agentId, "running");
    if (!resumed) throw new Error("failed to resume strategy");
    return resumed;
  }

  /** Stop live run and keep the plan as a draft. */
  disarm(agentId: string): Strategy {
    const existing = this.get(agentId);
    if (!existing) throw new Error("strategy not found");
    if (existing.status === "draft") return existing;
    const draft = this.setStatus(agentId, "draft");
    if (!draft) throw new Error("failed to disarm strategy");
    return draft;
  }

  delete(agentId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM strategies WHERE agent_id = ?`)
      .run(agentId);
    return result.changes > 0;
  }

  listRunning(): Strategy[] {
    const rows = this.db
      .prepare(`SELECT * FROM strategies WHERE status = 'running'`)
      .all() as StrategyRow[];
    return rows.map(rowToStrategy);
  }
}
